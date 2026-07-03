/**
 * List inbound calls TO +16096048379 that were taken (answered) today.
 * Uses Twilio API with startTimeAfter/Before for today UTC; marks completed + duration as "taken".
 *
 * Run: npx tsx server/scripts/inbound-calls-taken-today.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const TO_609 = '+16096048379';

function getTodayUTC(): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const start = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { start, end } = getTodayUTC();
  const calls = await client.calls.list({
    to: TO_609,
    startTimeAfter: start,
    startTimeBefore: end,
    limit: 200,
  });
  // Most recent first
  calls.sort((a, b) => {
    const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
    const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
    return tb - ta;
  });

  const taken = calls.filter((c) => c.status === 'completed' && (c.duration == null || c.duration > 0));
  const notTaken = calls.filter((c) => c.status !== 'completed' || (c.duration != null && c.duration <= 0));

  console.log(`\n=== Inbound 609 calls today (UTC ${start.toISOString().slice(0, 10)}) ===\n`);
  console.log(`Total calls to ${TO_609}: ${calls.length}`);
  console.log(`Taken (completed, duration > 0): ${taken.length}`);
  console.log(`Not taken (no-answer / busy / failed / in-progress): ${notTaken.length}\n`);

  if (calls.length === 0) {
    console.log('No inbound calls today.');
    return;
  }

  console.log('--- All calls (most recent first) ---\n');
  for (const c of calls) {
    const startStr = c.startTime ? new Date(c.startTime).toISOString() : '—';
    const dur = c.duration != null ? `${c.duration}s` : '—';
    const takenLabel = c.status === 'completed' && (c.duration == null || c.duration > 0) ? '  TAKEN' : '';
    console.log(`${c.sid}  From: ${c.from}  Start: ${startStr}  Duration: ${dur}  Status: ${c.status}${takenLabel}`);
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
