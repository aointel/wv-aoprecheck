/**
 * Backfill recording_url for inbound calls that have none.
 * Twilio often attaches the recording to the worker leg, not the caller leg — so we try:
 * 1) recordings for the row's twilio_call_sid (caller), 2) recordings for metadata.worker_call_sid,
 * 3) child calls of the row (find client: leg) and use that call's recordings.
 *
 * Run: npx tsx server/scripts/backfill-inbound-recording-url-from-twilio.ts [days=30] [limit=500]
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 500;
const DELAY_MS = 180;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function recordingMp3Url(recordingSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
}

/** Get first completed recording for a call SID, or null. */
async function getRecordingForCall(client: ReturnType<typeof twilio>, callSid: string): Promise<{ sid: string; duration: number | null } | null> {
  try {
    const recs = await client.calls(callSid).recordings.list();
    const completed = (recs as any[]).filter((r) => (r.status || '') === 'completed' || (r as any).Status === 'completed');
    const rec = completed.length > 0 ? completed[0] : (recs as any[])[0];
    if (!rec) return null;
    const sid = rec.sid ?? (rec as any).Sid;
    const duration = rec.duration != null ? parseInt(String(rec.duration), 10) : null;
    return { sid, duration };
  } catch {
    return null;
  }
}

/** Find worker (client:) leg SID from children of inbound call, or null. */
async function findWorkerLegSid(client: ReturnType<typeof twilio>, parentCallSid: string): Promise<string | null> {
  try {
    const children = await client.calls.list({ parentCallSid, limit: 20 });
    const agent = (children as any[]).find((c) => {
      const to = String(c.to || '').trim();
      const from = String(c.from || '').trim();
      return to.startsWith('client:') || from.startsWith('client:');
    });
    return agent?.sid ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const days = parseInt(process.argv[2] || String(DEFAULT_DAYS), 10);
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !supabaseAdmin) {
    console.error('❌ Need Twilio credentials and supabaseAdmin.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, metadata, call_started_at')
    .eq('call_direction', 'inbound')
    .is('recording_url', null)
    .gte('call_started_at', since)
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Fetch failed:', error.message);
    process.exit(1);
  }

  const list = (rows || []) as { id: number; twilio_call_sid: string; metadata: unknown; call_started_at: string }[];
  console.log(`\n📹 Backfill recording_url for inbound calls (last ${days}d, limit ${limit}) — ${list.length} rows\n`);

  let updated = 0;
  let noRecording = 0;
  let errs = 0;

  for (const row of list) {
    const meta = (row.metadata && typeof row.metadata === 'object') ? (row.metadata as Record<string, unknown>) : {};
    const workerSid = meta.worker_call_sid as string | undefined;

    // Skip test/fake SIDs so we don't 404
    if (row.twilio_call_sid.startsWith('CA-test-')) {
      noRecording++;
      continue;
    }

    try {
      let rec = await getRecordingForCall(client, row.twilio_call_sid);
      if (!rec && workerSid) rec = await getRecordingForCall(client, workerSid);
      if (!rec) {
        const childSid = await findWorkerLegSid(client, row.twilio_call_sid);
        if (childSid) rec = await getRecordingForCall(client, childSid);
      }
      if (!rec) {
        noRecording++;
        await sleep(DELAY_MS);
        continue;
      }

      const url = recordingMp3Url(rec.sid);
      const updatedMeta = { ...meta, recording_sid: rec.sid, recording_url: url, ...(rec.duration != null ? { recording_duration: rec.duration } : {}) };

      const { error: upErr } = await supabaseAdmin
        .from('twilio_call_logs')
        .update({ recording_url: url, metadata: updatedMeta })
        .eq('twilio_call_sid', row.twilio_call_sid);

      if (upErr) {
        errs++;
        if (errs <= 5) console.error('   ❌ update', row.twilio_call_sid, upErr.message);
        await sleep(DELAY_MS);
        continue;
      }
      updated++;
      if (updated <= 25) console.log(`   ✅ ${row.twilio_call_sid} → recording`);
    } catch (e) {
      errs++;
      if (errs <= 5) console.error('   ❌', row.twilio_call_sid, (e as Error).message);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done. Updated: ${updated}, No recording in Twilio: ${noRecording}, Errors: ${errs}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
