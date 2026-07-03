/**
 * List recent Twilio calls TO the inbound number 6096048379.
 * Run: npx tsx server/scripts/check-calls-to-6096048379.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const TO_NUMBER = '+16096048379';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({ to: TO_NUMBER, limit: 25 });
  console.log(`Calls TO ${TO_NUMBER} (inbound to this number): ${calls.length} recent\n`);
  if (calls.length === 0) {
    console.log('No calls found. No one has called this number in the retrieved window.');
    return;
  }
  for (const c of calls) {
    const start = c.startTime ? new Date(c.startTime).toISOString() : '—';
    const end = c.endTime ? new Date(c.endTime).toISOString() : '—';
    const dur = c.duration != null ? `${c.duration}s` : '—';
    console.log(`${c.sid}  From: ${c.from}  To: ${c.to}  Status: ${c.status}  Start: ${start}  Duration: ${dur}`);
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
