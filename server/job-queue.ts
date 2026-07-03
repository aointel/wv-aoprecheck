/**
 * Redis Job Queue
 * Web server pushes jobs → Worker consumes and runs them
 * Uses Redis LIST with LPUSH/BRPOP (reliable, no extra deps)
 */

import { createClient } from 'redis';
import { getRedisUrl } from './redis-config.js';

export type JobType =
  | 'backfill-billing-transactions'
  | 'backfill-call-log'
  | 'backfill-call-analytics'
  | 'backfill-twilio-parent-to-number'
  | 'backfill-twilio-child-recording-url'
  | 'backfill-twilio-call-numbers'
  | 'backfill-owner-email'
  | 'ai-screenshot-analysis'
  | 'transcript-sync'
  | 'recording-download';

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, any>;
  createdAt: string;
  createdBy?: string;
}

const QUEUE_KEY = 'aoirail:jobs';
const RESULTS_KEY = 'aoirail:job_results';
const RESULT_TTL = 60 * 60; // 1 hour

// ── Client singleton ─────────────────────────────────────────────────────────
let _client: ReturnType<typeof createClient> | null = null;

async function getClient() {
  if (_client) return _client;
  const url = getRedisUrl();
  if (!url) throw new Error('REDIS_URL not configured (set REDIS_URL or hardcoded-config REDIS_URL)');
  _client = createClient({ url });
  _client.on('error', (err) => console.error('[JobQueue] Redis error:', err.message));
  await _client.connect();
  return _client;
}

// ── Push a job (web server calls this) ───────────────────────────────────────
export async function enqueueJob(
  type: JobType,
  payload: Record<string, any> = {},
  createdBy?: string
): Promise<string> {
  const client = await getClient();
  const job: Job = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  await client.lPush(QUEUE_KEY, JSON.stringify(job));
  console.log(`[JobQueue] Enqueued job ${job.id} (${type})`);
  return job.id;
}

// ── Store result so web server can poll status ────────────────────────────────
export async function setJobResult(
  jobId: string,
  result: { status: 'done' | 'error'; message: string; data?: any }
): Promise<void> {
  const client = await getClient();
  await client.setEx(`${RESULTS_KEY}:${jobId}`, RESULT_TTL, JSON.stringify(result));
}

export async function getJobResult(jobId: string): Promise<any | null> {
  const client = await getClient();
  const val = await client.get(`${RESULTS_KEY}:${jobId}`);
  return val ? JSON.parse(val) : null;
}

// ── Worker loop (entry-worker.ts calls this) ──────────────────────────────────
export async function startJobWorker(): Promise<void> {
  console.log('[JobQueue] Worker started — listening for jobs...');
  const client = await getClient();

  while (true) {
    try {
      // BRPOP blocks up to 5s waiting for a job — zero CPU when idle
      const result = await client.brPop(QUEUE_KEY, 5);
      if (!result) continue;

      const job: Job = JSON.parse(result.element);
      console.log(`[JobQueue] Processing job ${job.id} (${job.type})`);

      try {
        await runJob(job);
        await setJobResult(job.id, { status: 'done', message: 'Completed successfully' });
        console.log(`[JobQueue] ✅ Job ${job.id} done`);
      } catch (err: any) {
        console.error(`[JobQueue] ❌ Job ${job.id} failed:`, err.message);
        await setJobResult(job.id, { status: 'error', message: err.message });
      }
    } catch (err: any) {
      console.error('[JobQueue] Worker loop error:', err.message);
      await new Promise((r) => setTimeout(r, 2000)); // back off on error
    }
  }
}

// ── Job runners ───────────────────────────────────────────────────────────────
async function runJob(job: Job): Promise<void> {
  const { supabaseAdmin } = await import('./supabase.js');

  switch (job.type) {

    case 'backfill-billing-transactions': {
      const { billingTransactionSync } = await import('./billing-transaction-sync.js');
      await (billingTransactionSync as any).runOnce?.();
      break;
    }

    case 'backfill-call-log': {
      // Dynamic import to avoid loading at startup
      const mod = await import('./backfill-call-log-from-twilio.js');
      await (mod as any).run?.();
      break;
    }

    case 'backfill-call-analytics': {
      const mod = await import('./backfill-call-analytics-table.js');
      await (mod as any).run?.();
      break;
    }

    case 'backfill-twilio-parent-to-number': {
      if (!supabaseAdmin) throw new Error('Supabase not configured');
      // Find calls missing to_number and try to backfill from Twilio API
      const { data: calls } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, parent_call_sid')
        .is('to_number', null)
        .not('parent_call_sid', 'is', null)
        .limit(job.payload.limit || 100);
      if (!calls?.length) break;
      const twilio = (await import('twilio')).default;
      const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await import('./hardcoded-config.js');
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      let fixed = 0;
      for (const call of calls) {
        try {
          const tc = await client.calls(call.twilio_call_sid).fetch();
          if (tc.to) {
            await supabaseAdmin.from('twilio_call_logs').update({ to_number: tc.to }).eq('twilio_call_sid', call.twilio_call_sid);
            fixed++;
          }
        } catch { /* skip individual failures */ }
      }
      console.log(`[JobQueue] backfill-twilio-parent-to-number: fixed ${fixed}/${calls.length}`);
      break;
    }

    case 'backfill-twilio-child-recording-url': {
      if (!supabaseAdmin) throw new Error('Supabase not configured');
      const { data: calls } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid')
        .is('recording_url', null)
        .eq('call_direction', 'outbound')
        .limit(job.payload.limit || 50);
      if (!calls?.length) break;
      const twilio = (await import('twilio')).default;
      const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await import('./hardcoded-config.js');
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      let fixed = 0;
      for (const call of calls) {
        try {
          const recordings = await client.recordings.list({ callSid: call.twilio_call_sid, limit: 1 });
          if (recordings[0]) {
            const url = `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;
            await supabaseAdmin.from('twilio_call_logs').update({ recording_url: url }).eq('twilio_call_sid', call.twilio_call_sid);
            fixed++;
          }
        } catch { /* skip */ }
      }
      console.log(`[JobQueue] backfill-twilio-child-recording-url: fixed ${fixed}/${calls.length}`);
      break;
    }

    case 'backfill-twilio-call-numbers':
    case 'backfill-owner-email': {
      // These are complex — log and skip for now, can implement later
      console.log(`[JobQueue] ${job.type} not yet implemented in worker`);
      break;
    }

    case 'ai-screenshot-analysis': {
      const { sessionId } = job.payload;
      if (!sessionId) throw new Error('Missing sessionId');
      const { verificationAnalysisScheduler } = await import('./verification-analysis-scheduler.js');
      await (verificationAnalysisScheduler as any).analyzeSession?.(sessionId);
      break;
    }

    case 'transcript-sync': {
      const { sessionId } = job.payload;
      if (!sessionId) throw new Error('Missing sessionId');
      const mod = await import('./call-analytics-transcript-upload.js');
      await (mod as any).syncTranscript?.(sessionId);
      break;
    }

    case 'recording-download': {
      const { sessionId } = job.payload;
      if (!sessionId) throw new Error('Missing sessionId');
      const mod = await import('./recording-downloader-scheduler.js');
      await (mod as any).downloadRecording?.(sessionId);
      break;
    }

    default:
      throw new Error(`Unknown job type: ${(job as any).type}`);
  }
}
