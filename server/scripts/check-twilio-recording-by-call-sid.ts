/**
 * Check if Twilio has recordings for a call SID (and its children).
 * Run: npx tsx server/scripts/check-twilio-recording-by-call-sid.ts CA54aed32ceb0f576720e8816120119781
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

const callSid = process.argv[2]?.trim();
if (!callSid) {
  console.error('Usage: npx tsx server/scripts/check-twilio-recording-by-call-sid.ts <CallSid>');
  process.exit(1);
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials.');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log('Call SID:', callSid, '\n');

  const call = await client.calls(callSid).fetch().catch((e) => null);
  if (!call) {
    console.log('Call not found in Twilio.');
    return;
  }
  console.log('Call:', (call as any).from, '->', (call as any).to, 'status=', (call as any).status, 'duration=', (call as any).duration);

  const recsOnCall = await client.calls(callSid).recordings.list();
  console.log('Recordings on this call:', recsOnCall.length);
  for (const r of recsOnCall as any[]) {
    console.log('  ', r.sid, r.status, r.duration);
  }

  const children = await client.calls.list({ parentCallSid: callSid, limit: 20 });
  console.log('\nChild calls:', children.length);
  for (const ch of children as any[]) {
    const recs = await client.calls(ch.sid).recordings.list();
    console.log('  ', ch.sid, ch.to, ch.from, 'recordings:', recs.length);
    for (const r of recs as any[]) {
      console.log('    rec', r.sid, r.status);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
