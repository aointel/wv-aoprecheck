/**
 * Manual script to analyze all screenshots that haven't been analyzed
 * 
 * Usage:
 *   tsx server/manual-screenshot-analysis.ts                    # Analyze all unprocessed
 *   tsx server/manual-screenshot-analysis.ts --limit 50          # Analyze first 50
 *   tsx server/manual-screenshot-analysis.ts --session <id>      # Analyze specific session
 */

import { supabaseAdmin } from './supabase.js';
import { verificationScreenshotValidator } from './verification-screenshot-validator.js';
import { SUPABASE_URL } from './hardcoded-config.js';
import fetch from 'node-fetch';

async function analyzeScreenshot(session: any, forceReanalyze: boolean = false): Promise<void> {
  try {
    // SAFETY CHECK: Skip if already analyzed to prevent duplicate API calls (unless force re-analyze)
    if (!forceReanalyze && session.screenshot_analysis_complete === true) {
      console.log(`  ⏭️  Skipping session ${session.session_id} - already analyzed (complete=${session.screenshot_analysis_complete})`);
      return;
    }
    
    if (forceReanalyze && session.screenshot_analysis_complete === true) {
      console.log(`  🔄 Re-analyzing session ${session.session_id} (force re-analyze mode)`);
    }

    console.log(`  Processing screenshot for session ${session.session_id} (${session.id})`);

    const screenshotDataUrl = await fetchScreenshotDataUrl(session);
    if (!screenshotDataUrl) {
      console.warn(`  ⚠️ No screenshot available for session ${session.session_id}`);
      await supabaseAdmin
        .from('verification_sessions')
        .update({
          screenshot_validation: {
            issues: ['Missing required screenshot'],
            reason: 'NO SCREENSHOT PROVIDED - Screenshot is required for all verifications',
            isValid: false,
            confidence: 1,
            validationType: 'invalid',
            detectedElements: {
              hasZoomUI: false,
              isInPerson: false,
              peopleCount: 0,
              imageQuality: 'unusable',
              hasFaceTimeUI: false,
              hasWhatsAppUI: false,
              hasMultiplePeople: false,
              hasOtherVideoCallUI: false,
              hasVideoCallInterface: false
            }
          },
          screenshot_analysis_complete: true,
          screenshot_analysis_confidence: 0
        })
        .eq('id', session.id);
      return;
    }

    const validation = await verificationScreenshotValidator.validateScreenshot(
      screenshotDataUrl,
      session.verification_method || 'zoom'
    );

    // CRITICAL: Mark as complete BEFORE saving to prevent re-analysis
    const { error: updateError, data: updatedData } = await supabaseAdmin
      .from('verification_sessions')
      .update({ 
        screenshot_validation: validation,
        screenshot_analysis_complete: true,
        screenshot_analysis_confidence: validation?.confidence ?? 0,
        verification_result: validation.isValid ? 'COMPLETED' : 'FAILED'
      })
      .eq('id', session.id)
      .select('id, screenshot_analysis_complete');

    if (updateError) {
      console.error(`  ❌ FAILED to save analysis results for session ${session.id}:`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    if (!updatedData || updatedData.length === 0) {
      console.error(`  ❌ No rows updated for session ${session.id} - session may not exist`);
      throw new Error('No rows updated');
    }

    console.log(`  ✅ Screenshot analyzed and SAVED: ${validation.isValid ? 'VALID' : 'INVALID'} (${validation.confidence} confidence)`);
  } catch (error: any) {
    console.error(`  ❌ Failed to analyze screenshot for session ${session.session_id}:`, error.message);
  }
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

async function fetchScreenshotDataUrl(session: any): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const sources: Array<string | null | undefined> = [session.screenshot_path, session.screenshot_url];

  for (const source of sources) {
    if (!source || source === 'PENDING') continue;

    let urlToFetch = source;

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
        console.warn(`  ⚠️ Failed to generate signed URL for ${session.session_id}:`, error);
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
      console.warn(`  ⚠️ Unable to download screenshot from ${urlToFetch}:`, error instanceof Error ? error.message : error);
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) || 100 : 100;
  const sessionIndex = args.indexOf('--session');
  const sessionId = sessionIndex !== -1 ? args[sessionIndex + 1] : null;
  const forceReanalyze = args.includes('--force') || args.includes('--reanalyze');

  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }

  try {
    if (sessionId) {
      // Analyze specific session
      const { data: session, error } = await supabaseAdmin
        .from('verification_sessions')
        .select('*')
        .or(`session_id.eq.${sessionId},id.eq.${sessionId}`)
        .single();

      if (error || !session) {
        console.error(`❌ Session ${sessionId} not found`);
        return;
      }

      await analyzeScreenshot(session, forceReanalyze);
      return;
    }

    // Find all sessions with screenshots that need analysis
    console.log(forceReanalyze ? '🔄 Finding last sessions with screenshots for RE-ANALYSIS...' : '🔍 Finding sessions with screenshots that need analysis...');
    
    // Fetch sessions with screenshots first, then filter for unanalyzed in JavaScript
    // This avoids complex OR query conflicts
    const { data: allSessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .or('screenshot_url.not.is.null,screenshot_path.not.is.null')
      .neq('screenshot_url', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Fetch more to account for filtering

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }

    if (!allSessions || allSessions.length === 0) {
      console.log('✅ No sessions with screenshots found');
      return;
    }

    // Filter sessions - if force re-analyze, include all; otherwise only unanalyzed
    const sessions = allSessions.filter(session => {
      const hasScreenshot = (session.screenshot_url && session.screenshot_url !== 'PENDING' && session.screenshot_url !== null) ||
                           (session.screenshot_path && session.screenshot_path !== 'PENDING' && session.screenshot_path !== null);
      if (forceReanalyze) {
        return hasScreenshot; // Include all sessions with screenshots
      }
      const isNotComplete = session.screenshot_analysis_complete === null || 
                           session.screenshot_analysis_complete === false ||
                           !session.screenshot_analysis_complete;
      return hasScreenshot && isNotComplete;
    });

    if (!sessions || sessions.length === 0) {
      console.log(`✅ No sessions needing screenshot analysis (filtered from ${allSessions.length} total sessions with screenshots)`);
      return;
    }

    // Limit to last N sessions if force re-analyze
    const sessionsToAnalyze = forceReanalyze ? sessions.slice(0, limit) : sessions;
    
    console.log(`📸 Found ${sessionsToAnalyze.length} session(s) ${forceReanalyze ? 'to RE-ANALYZE' : 'needing screenshot analysis'}`);
    console.log('🚀 Starting analysis...\n');

    for (let i = 0; i < sessionsToAnalyze.length; i++) {
      const session = sessionsToAnalyze[i];
      await analyzeScreenshot(session, forceReanalyze);
      
      // Rate limiting: Wait 2 seconds between API calls to prevent hitting OpenAI rate limits
      // This prevents 429 errors when processing multiple screenshots
      if (i < sessionsToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n✅ Analysis complete! Processed ${sessionsToAnalyze.length} session(s)`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

