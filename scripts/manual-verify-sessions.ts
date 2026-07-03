import 'dotenv/config';

import fetch from 'node-fetch';

import { supabaseAdmin } from '../server/supabase';
import { verificationScreenshotValidator } from '../server/verification-screenshot-validator';
import { verificationAudioAnalyzer } from '../server/verification-audio-analyzer';

type VerificationSession = {
  id: number;
  session_id: string;
  screenshot_url: string | null;
  screenshot_path: string | null;
  recording_url: string | null;
  verification_method: 'zoom' | 'phone' | 'conference' | null;
};

function usage(): never {
  console.log('Usage: npx tsx scripts/manual-verify-sessions.ts <session_id>[,<session_id>...]');
  process.exit(1);
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
    throw new Error('No screenshot URL available');
  }

  const firstUrl = primarySource.startsWith('http')
    ? primarySource
    : `https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/${primarySource.replace(/^\//, '')}`;

  try {
    return await fetchAsBase64(firstUrl);
  } catch (err) {
    console.warn(`⚠️ Primary screenshot fetch failed: ${(err as Error).message}`);
  }

  const storagePath = extractStoragePath(session.screenshot_path || session.screenshot_url || '');
  if (!storagePath) {
    throw new Error('Unable to determine storage path for screenshot');
  }

  const { data, error } = await supabaseAdmin!
    .storage
    .from(storagePath.bucket)
    .createSignedUrl(storagePath.object, 60);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL for screenshot: ${error?.message || 'unknown error'}`);
  }

  return fetchAsBase64(data.signedUrl);
}

async function analyzeSession(session: VerificationSession) {
  console.log(`\n🧪 Running manual analysis for ${session.session_id} (row ${session.id})`);

  const screenshotData = await toBase64Screenshot(session);
  const screenshotResult = await verificationScreenshotValidator.validateScreenshot(
    screenshotData,
    session.verification_method === 'zoom' ? 'zoom' : 'phone'
  );

  const audioResult = session.recording_url
    ? await verificationAudioAnalyzer.analyzeAudioFromUrl(
        session.recording_url,
        session.verification_method === 'zoom' ? 'zoom' : 'phone'
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

  console.log(`✅ Updated session ${session.session_id} → ${verificationResult}`);
}

async function main() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured');
  }

  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) usage();

  const ids = rawArgs
    .flatMap(arg => arg.split(','))
    .map(id => id.trim())
    .filter(Boolean);

  if (ids.length === 0) usage();

  console.log('🎯 Target sessions:', ids);

  const { data, error } = await supabaseAdmin
    .from('verification_sessions')
    .select('id, session_id, screenshot_url, screenshot_path, recording_url, verification_method')
    .in('session_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('No matching sessions found.');
    return;
  }

  for (const session of data as VerificationSession[]) {
    try {
      await analyzeSession(session);
    } catch (err: any) {
      console.error(`❌ Failed to analyze ${session.session_id}:`, err?.message || err);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

