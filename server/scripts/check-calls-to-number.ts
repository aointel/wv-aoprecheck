import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const TO_NUMBER = '+16096048379';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({ to: TO_NUMBER, limit: 20 });
  console.log(`Calls to ${TO_NUMBER} (most recent ${calls.length}):\n`);
  if (!calls.length) {
    console.log('No calls found.');
    return;
  }
  for (const c of calls) {
    const start = c.startTime ? new Date(c.startTime).toISOString() : '—';
    const end = c.endTime ? new Date(c.endTime).toISOString() : '—';
    const status = c.status ?? '—';
    const duration = c.duration ?? (status === 'in-progress' || status === 'ringing' ? 'ongoing' : '—');
    console.log(`  ${c.sid}  ${start}  from=${c.from}  status=${status}  duration=${duration}`);
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
