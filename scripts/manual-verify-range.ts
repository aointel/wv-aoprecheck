import 'dotenv/config';

import fetch from 'node-fetch';

import { supabaseAdmin } from '../server/supabase';
import { verificationScreenshotValidator } from '../server/verification-screenshot-validator';
import { verificationAudioAnalyzer } from '../server/verification-audio-analyzer';

type VerificationMethod = 'zoom' | 'phone' | 'conference' | null;

interface VerificationSession {
  id: number;
  session_id: string;
  created_at: string;
  screenshot_url: string | null;
  screenshot_path: string | null;
  recording_url: string | null;
  verification_method: VerificationMethod;
}

const DELAY_MS = Number(process.env.AI_ANALYZER_DELAY_MS || '1500');

function usage(): never {
  console.log('Usage: npx tsx scripts/manual-verify-range.ts <start_iso> <end_iso>');
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractStoragePath(source: string): { bucket: string; object: string } | null {
  if (!source) return null;

  if (source.startsWith('http')) {
    try {
      const url = new URL(source);
      const parts = url.pathname.split('/').filter(Boolean);
      const objectIdx = parts.indexOf('object');
      if (objectIdx === -1 || objectIdx + 1 >= parts.length) {
        return null;
      }

      let idx = objectIdx + 1;
      if (['sign', 'public', 'render'].includes(parts[idx])) {
        idx += 1;
      }

      const bucket = parts[idx];
      const object = parts.slice(idx + 1).join('/');
      if (!bucket || !object) return null;
      return { bucket, object };
    } catch {
      return null;
    }
  }

  const trimmed = source.replace(/^\/+/, '');
  const [bucket, ...rest] = trimmed.split('/');
  if (!bucket || rest.length === 0) return null;
  return { bucket, object: rest.join('/') };
}

async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Screenshot download failed (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

async function toBase64Screenshot(session: VerificationSession): Promise<string> {
  const primarySource = session.screenshot_url || session.screenshot_path;
  if (!primarySource) {
    throw new Error('No screenshot available');
  }

  const firstUrl = primarySource.startsWith('http')
    ? primarySource
    : `https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/${primarySource.replace(/^\//, '')}`;

  try {
    return await fetchAsBase64(firstUrl);
  } catch (err) {
    console.warn(`⚠️ Primary screenshot fetch failed for ${session.session_id}: ${(err as Error).message}`);
  }

  const storagePath = extractStoragePath(primarySource);
  if (!storagePath) {
    throw new Error('Unable to determine storage path for screenshot');
  }

  const { data, error } = await supabaseAdmin!
    .storage
    .from(storagePath.bucket)
    .createSignedUrl(storagePath.object, 60);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message || 'unknown error'}`);
  }

  return fetchAsBase64(data.signedUrl);
}

async function analyzeSession(session: VerificationSession) {
  console.log(`\n🧪 Re-analyzing ${session.session_id} (${session.created_at})`);

  const screenshotData = await toBase64Screenshot(session);
  const method: VerificationMethod = session.verification_method ?? 'phone';

  const screenshotResult = await verificationScreenshotValidator.validateScreenshot(
    screenshotData,
    method === 'zoom' ? 'zoom' : method === 'conference' ? 'conference' : 'phone'
  );

  const audioResult = session.recording_url
    ? await verificationAudioAnalyzer.analyzeAudioFromUrl(
        session.recording_url,
        method === 'zoom' ? 'zoom' : method === 'conference' ? 'conference' : 'phone'
      )
    : null;

  const verificationResult = screenshotResult.isValid && (audioResult?.isLegitimate ?? true)
    ? 'COMPLETED'
    : 'FAILED';

  await supabaseAdmin!
    .from('verification_sessions')
    .update({
      screenshot_validation: screenshotResult,
      audio_analysis: audioResult,
      verification_result: verificationResult
    })
    .eq('id', session.id);

  console.log(`✅ Updated ${session.session_id} → ${verificationResult}`);
}

async function main() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured');
  }

  const [start, end] = process.argv.slice(2);
  if (!start || !end) usage();

  console.log(`🔍 Fetching sessions between ${start} and ${end}`);

  const { data, error } = await supabaseAdmin
    .from('verification_sessions')
    .select('id, session_id, created_at, screenshot_url, screenshot_path, recording_url, verification_method')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const sessions = (data ?? []) as VerificationSession[];
  console.log(`📦 Found ${sessions.length} session(s) in range`);

  if (sessions.length === 0) {
    return;
  }

  for (const session of sessions) {
    try {
      await analyzeSession(session);
    } catch (err: any) {
      console.error(`❌ Failed to analyze ${session.session_id}:`, err?.message || err);
    }

    if (DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  console.log('✅ Range re-analysis complete');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});






