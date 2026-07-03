/**
 * Backfill Script: Analyze Screenshots and Generate Summaries for Verification Sessions
 * 
 * This script finds all verification_sessions with screenshots that haven't been analyzed
 * and runs AI validation to generate screenshot summaries.
 * 
 * Run with: tsx server/backfill-screenshot-summaries.ts
 * 
 * Options:
 *   --limit N        Process only first N sessions (for testing)
 *   --force          Re-analyze even if already analyzed
 */

import { supabaseAdmin } from './supabase';
import { verificationScreenshotValidator } from './verification-screenshot-validator';
import { SUPABASE_URL } from './hardcoded-config';
import fetch from 'node-fetch';

async function fetchScreenshotDataUrl(session: any): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const sources: Array<string | null | undefined> = [session.screenshot_path, session.screenshot_url];

  for (const source of sources) {
    if (!source || source === 'PENDING') continue;

    let urlToFetch = source;

    // Try to resolve storage reference
    const ref = resolveStorageReference(source);
    if (ref) {
      try {
        const { data, error } = await supabaseAdmin
          .storage
          .from(ref.bucket)
          .createSignedUrl(ref.object, 300);
        if (!error && data?.signedUrl) {
          urlToFetch = data.signedUrl;
        } else if (!urlToFetch.startsWith('http')) {
          const baseUrl = SUPABASE_URL || process.env.SUPABASE_URL;
          if (baseUrl) {
            urlToFetch = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${ref.bucket}/${ref.object}`;
          }
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to generate signed URL:`, error);
      }
    }

    try {
      const response = await fetch(urlToFetch);
      if (!response.ok) {
        throw new Error(`Screenshot download failed (${response.status})`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
      return dataUri;
    } catch (error) {
      console.warn(`  ⚠️ Unable to download screenshot:`, error instanceof Error ? error.message : error);
    }
  }

  return null;
}

function resolveStorageReference(value?: string | null): { bucket: string; object: string } | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'PENDING') return null;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const objectIndex = segments.indexOf('object');
    if (objectIndex !== -1 && objectIndex + 1 < segments.length) {
      let idx = objectIndex + 1;
      if (['sign', 'public', 'render'].includes(segments[idx])) {
        idx += 1;
      }
      if (idx >= segments.length) return null;
      const bucket = segments[idx];
      const object = segments.slice(idx + 1).join('/');
      return bucket && object ? { bucket, object } : null;
    }
  } catch {
    // Not a URL, fall through
  }

  const cleaned = trimmed.replace(/^\/+/, '');
  const parts = cleaned.split('/');
  if (parts.length < 2) return null;
  const bucket = parts.shift()!;
  const object = parts.join('/');
  return bucket && object ? { bucket, object } : null;
}

async function analyzeScreenshot(session: any, forceReanalyze: boolean = false): Promise<void> {
  try {
    // Log if re-analyzing
    if (forceReanalyze && session.screenshot_analysis_complete === true) {
      console.log(`  🔄 Re-analyzing session ${session.session_id} (force mode)...`);
    } else {
      console.log(`  📸 Processing session ${session.session_id}...`);
    }

    const screenshotDataUrl = await fetchScreenshotDataUrl(session);
    if (!screenshotDataUrl) {
      console.warn(`  ⚠️ No screenshot available for session ${session.session_id}`);
      await supabaseAdmin
        .from('verification_sessions')
        .update({
          screenshot_validation: {
            issues: ['Missing required screenshot'],
            reason: 'NO SCREENSHOT PROVIDED',
            isValid: false,
            confidence: 1,
            validationType: 'invalid',
            detectedElements: {}
          },
          screenshot_analysis_complete: true,
          screenshot_analysis_confidence: 0
        })
        .eq('id', session.id);
      return;
    }

    // Validate screenshot using OpenAI
    const validation = await verificationScreenshotValidator.validateScreenshot(
      screenshotDataUrl,
      session.verification_method || 'zoom'
    );

    // Update session with validation results
    const { error: updateError } = await supabaseAdmin
      .from('verification_sessions')
      .update({ 
        screenshot_validation: validation,
        screenshot_analysis_complete: true,
        screenshot_analysis_confidence: validation?.confidence ?? 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (updateError) {
      console.error(`  ❌ Failed to save analysis for session ${session.session_id}:`, updateError);
      throw updateError;
    }

    console.log(`  ✅ Screenshot analyzed: ${validation.isValid ? 'VALID' : 'INVALID'} (${(validation.confidence * 100).toFixed(0)}% confidence)`);
  } catch (error: any) {
    console.error(`  ❌ Error analyzing session ${session.session_id}:`, error.message);
    throw error;
  }
}

async function backfillScreenshotSummaries(limit?: number, force: boolean = false) {
  console.log('🔄 Starting screenshot analysis backfill...');
  console.log('📋 Processing verification_sessions with screenshots\n');
  
  try {
    // Find sessions with screenshots that need analysis
    console.log(force ? '📊 Fetching ALL sessions with screenshots for re-analysis (most recent first)...' : '📊 Fetching sessions with screenshots...');
    let query = supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, screenshot_url, screenshot_path, screenshot_analysis_complete, verification_method, created_at')
      .or('screenshot_url.not.is.null,screenshot_path.not.is.null')
      .neq('screenshot_url', 'PENDING')
      .order('created_at', { ascending: false }); // Most recent first
    
    // Apply limit - if force mode, use limit or fetch more
    if (limit) {
      query = query.limit(limit);
      console.log(`   Limiting to first ${limit} sessions`);
    } else if (!force) {
      query = query.limit(1000); // Default limit when not forcing
    } else {
      // Force mode without limit - fetch a large batch (will process most recent first)
      query = query.limit(5000);
      console.log(`   Force mode: Fetching up to 5000 most recent sessions`);
    }
    
    const { data: sessions, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('⚠️ No sessions with screenshots found');
      return;
    }
    
    console.log(`📊 Fetched ${sessions.length} sessions with screenshots`);
    
    // Filter sessions that need analysis
    const sessionsToAnalyze = sessions.filter(session => {
      const hasScreenshot = (session.screenshot_url && session.screenshot_url !== 'PENDING') ||
                           (session.screenshot_path && session.screenshot_path !== 'PENDING');
      if (!hasScreenshot) return false;
      
      // If force mode, process ALL sessions with screenshots (even if already analyzed)
      if (force) return true;
      
      // Need analysis if not complete or null
      return session.screenshot_analysis_complete === null || 
             session.screenshot_analysis_complete === false;
    });
    
    console.log(`📊 After filtering: ${sessionsToAnalyze.length} sessions to analyze (force=${force})`);
    
    // Apply limit after filtering if force mode
    if (force && limit && sessionsToAnalyze.length > limit) {
      console.log(`   Limiting to first ${limit} sessions (force mode)`);
      sessionsToAnalyze.splice(limit);
    }
    
    if (sessionsToAnalyze.length === 0) {
      console.log(`✅ No sessions needing screenshot analysis (${sessions.length} total with screenshots)`);
      if (force) {
        console.log(`⚠️ Force mode enabled but no sessions found - check filter logic`);
      }
      return;
    }
    
    console.log(`✅ Found ${sessionsToAnalyze.length} sessions needing screenshot analysis (out of ${sessions.length} with screenshots)\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < sessionsToAnalyze.length; i++) {
      const session = sessionsToAnalyze[i];
      const progress = `[${i + 1}/${sessionsToAnalyze.length}]`;
      
      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`${progress} Processing session ${session.session_id}...`);
      }
      
      try {
        await analyzeScreenshot(session, force);
        successCount++;
        
        // Rate limiting: Wait 2 seconds between API calls
        if (i < sessionsToAnalyze.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`  ❌ Error processing session ${session.session_id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 SCREENSHOT ANALYSIS BACKFILL COMPLETE:`);
    console.log(`   ✅ Successfully analyzed: ${successCount} sessions`);
    console.log(`   ⚠️ Skipped: ${skippedCount} sessions`);
    console.log(`   ❌ Errors: ${errorCount} sessions`);
    console.log(`   📊 Total processed: ${sessionsToAnalyze.length} sessions\n`);
    
  } catch (error) {
    console.error('❌ Fatal error in backfill:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
console.log('🔍 Parsed arguments:', args);

// Handle --limit=10 or --limit 10
let limit: number | undefined;
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1) {
  // Check if next arg is a number (--limit 10)
  if (args[limitIndex + 1] && !args[limitIndex + 1].startsWith('--')) {
    limit = parseInt(args[limitIndex + 1]);
  }
}
// Also check for --limit=10 format
const limitArg = args.find(arg => arg.startsWith('--limit='));
if (limitArg) {
  limit = parseInt(limitArg.split('=')[1]);
}

const force = args.includes('--force');
console.log(`🔍 Parsed: limit=${limit}, force=${force}`);

// Run the backfill
backfillScreenshotSummaries(limit, force)
  .then(() => {
    console.log('✅ Backfill script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill script failed:', error);
    process.exit(1);
  });








