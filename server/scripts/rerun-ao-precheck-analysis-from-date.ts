/**
 * Re-run AO Precheck verification (management) analysis from a given date.
 * Covers both screenshot and audio analysis. Use when API was exceeded.
 *
 * Usage:
 *   npx tsx server/scripts/rerun-ao-precheck-analysis-from-date.ts [sinceDate] [--delay=6000] [--reset-only]
 *   [--screenshots-only] [--audio-only]
 *
 * Examples:
 *   npx tsx server/scripts/rerun-ao-precheck-analysis-from-date.ts 2026-02-07
 *   npx tsx server/scripts/rerun-ao-precheck-analysis-from-date.ts 2026-02-07 --delay=8000
 *   npx tsx server/scripts/rerun-ao-precheck-analysis-from-date.ts 2026-02-07 --screenshots-only
 *   npx tsx server/scripts/rerun-ao-precheck-analysis-from-date.ts 2026-02-07 --audio-only
 *   npx tsx server/scripts/rerun-ao-precheck-analysis-from-date.ts 2026-02-07 --reset-only
 *
 * Default: sinceDate = 2026-02-07, runs screenshots then audio. delay = 6000 ms (audio), 3000 ms (screenshots).
 * --screenshots-only: only re-run screenshot analysis. --audio-only: only re-run audio analysis.
 */
import 'dotenv/config';
import { supabaseAdmin } from '../supabase';
import { verificationAnalysisScheduler } from '../verification-analysis-scheduler';

const sinceDefault = '2026-02-07';
let sinceDate = sinceDefault;
let delayMs = 6000;
let resetOnly = false;
let screenshotsOnly = false;
let audioOnly = false;

for (const a of process.argv.slice(2)) {
  if (a === '--reset-only') resetOnly = true;
  else if (a === '--screenshots-only') screenshotsOnly = true;
  else if (a === '--audio-only') audioOnly = true;
  else if (a.startsWith('--delay=')) delayMs = Math.max(2000, parseInt(a.split('=')[1], 10) || 6000);
  else if (!a.startsWith('--')) sinceDate = a;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  const since = new Date(sinceDate);
  since.setHours(0, 0, 0, 0);
  const sinceStr = since.toISOString();

  const runScreenshots = screenshotsOnly || (!audioOnly && !screenshotsOnly);
  const runAudio = audioOnly || (!audioOnly && !screenshotsOnly);

  console.log(`📋 Resetting AO precheck verification analysis state for sessions created on or after ${sinceDate}...`);

  // Sessions with recording/transcript (for audio reset)
  const { data: audioToReset } = await supabaseAdmin
    .from('verification_sessions')
    .select('id')
    .gte('created_at', sinceStr)
    .or('and(recording_url.not.is.null,recording_url.neq.PENDING),and(call_transcript.not.is.null,call_transcript.neq.PENDING)');
  const audioIds = (audioToReset || []).map((r: any) => r.id);

  // Sessions with screenshot (for screenshot reset)
  const { data: screenshotToReset } = await supabaseAdmin
    .from('verification_sessions')
    .select('id')
    .gte('created_at', sinceStr)
    .or('screenshot_url.not.is.null,screenshot_path.not.is.null');
  const screenshotIds = (screenshotToReset || []).map((r: any) => r.id);

  const allIds = [...new Set([...audioIds, ...screenshotIds])];
  if (allIds.length === 0) {
    console.log('No sessions to reset in that date range.');
    if (!resetOnly) console.log('Exiting.');
    process.exit(0);
  }

  if (audioIds.length > 0) {
    const { error: e1 } = await supabaseAdmin
      .from('verification_sessions')
      .update({ call_analysis_complete: false, audio_analysis: null, audio_analysis_retry_count: 0 })
      .in('id', audioIds);
    if (e1) {
      console.error('❌ Failed to reset audio state:', e1);
      process.exit(1);
    }
    console.log(`✅ Reset audio analysis state for ${audioIds.length} session(s).`);
  }

  if (screenshotIds.length > 0) {
    const { error: e2 } = await supabaseAdmin
      .from('verification_sessions')
      .update({
        screenshot_analysis_complete: false,
        screenshot_validation: null,
        screenshot_analysis_retry_count: 0,
        screenshot_analysis_confidence: null
      })
      .in('id', screenshotIds);
    if (e2) {
      console.error('❌ Failed to reset screenshot state:', e2);
      process.exit(1);
    }
    console.log(`✅ Reset screenshot analysis state for ${screenshotIds.length} session(s).`);
  }

  if (resetOnly) {
    console.log('Done (--reset-only). Run without --reset-only to run analysis.');
    process.exit(0);
  }

  let totalProcessed = 0;
  let totalFailed = 0;

  if (runScreenshots) {
    console.log(`\n📸 Running screenshot analysis from ${sinceDate} (delay 3000ms)...\n`);
    const screenshotDelay = Math.max(2000, Math.min(delayMs, 5000));
    const r1 = await verificationAnalysisScheduler.runScreenshotAnalysisFromDate(sinceDate, { delayMs: screenshotDelay, batchSize: 10 });
    totalProcessed += r1.processed;
    totalFailed += r1.failed;
  }

  if (runAudio) {
    console.log(`\n🎵 Running audio analysis from ${sinceDate} (delay ${delayMs}ms)...\n`);
    const r2 = await verificationAnalysisScheduler.runAudioAnalysisFromDate(sinceDate, { delayMs, batchSize: 5 });
    totalProcessed += r2.processed;
    totalFailed += r2.failed;
  }

  console.log(`\n✅ Done. Total processed: ${totalProcessed}, failed: ${totalFailed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
