/**
 * Backfill Last 50 Most Recent Verification Sessions with Screenshot Analysis
 * Tests the screenshot validation and processes the 50 most recent sessions
 */

import { supabaseAdmin } from './server/supabase';
import { verificationScreenshotValidator } from './server/verification-screenshot-validator';

import fetch from 'node-fetch';
import { SUPABASE_URL } from './server/hardcoded-config';

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

async function analyzeScreenshot(session: any, forceReanalyze: boolean = false): Promise<void> {
  try {
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
    console.log('   🤖 Validating screenshot with AI...');
    const validation = await verificationScreenshotValidator.validateScreenshot(
      screenshotDataUrl,
      (session.verification_method || 'zoom') as 'zoom' | 'phone' | 'conference'
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
    console.log(`     Type: ${validation.validationType}`);
    console.log(`     Reason: ${validation.reason?.substring(0, 100)}...`);

  } catch (error: any) {
    console.error(`  ❌ Error analyzing screenshot for session ${session.session_id}:`, error.message);
    throw error;
  }
}

async function backfillLast50Screenshots() {
  console.log('\n🔄 Starting screenshot analysis backfill for last 50 sessions...\n');

  try {
    // Find last 50 sessions with screenshots
    console.log('📊 Fetching last 50 sessions with screenshots (most recent first)...');
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, screenshot_url, screenshot_path, screenshot_analysis_complete, verification_method, created_at')
      .not('screenshot_url', 'is', null)
      .neq('screenshot_url', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(50);

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions needing screenshot analysis');
      return;
    }

    console.log(`✅ Found ${sessions.length} sessions with screenshots\n`);

    // Process each session
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\n[${i + 1}/${sessions.length}] Session: ${session.session_id}`);
      console.log(`   Created: ${session.created_at}`);
      console.log(`   Already analyzed: ${session.screenshot_analysis_complete || false}`);
      
      try {
        await analyzeScreenshot(session, true); // Force reanalyze
        successCount++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between requests
      } catch (error) {
        console.error(`   ❌ Failed to analyze: ${error}`);
        errorCount++;
      }
    }

    console.log(`\n\n🎉 SCREENSHOT ANALYSIS BACKFILL COMPLETE:`);
    console.log(`   Successfully analyzed: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total processed: ${sessions.length}\n`);

  } catch (error) {
    console.error('❌ Error in backfill process:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('backfill-last-50-screenshots.ts')) {
  backfillLast50Screenshots().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { backfillLast50Screenshots };

