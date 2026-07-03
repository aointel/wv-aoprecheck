/**
 * List recent inbound calls TO +16096048379 so you can get the Call SID and
 * check Twilio Request Inspector / webhook response for the LIVE call.
 *
 * Run: npx tsx server/scripts/list-recent-609-calls.ts
 *      npx tsx server/scripts/list-recent-609-calls.ts 20   (last 20 calls)
 *
 * Then: Open the "Console URL" for the call you just made → Request Inspector
 *       shows the exact request Twilio sent and the response body we returned.
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const TO_609 = '+16096048379';
const LIMIT = parseInt(process.argv[2] || '10', 10);

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const accountSid = TWILIO_ACCOUNT_SID;
  const base = `https://console.twilio.com/us1/monitor/logs/calls`;
  const calls = await client.calls.list({ to: TO_609, limit: LIMIT });
  console.log(`\n=== Recent calls TO ${TO_609} (last ${calls.length}) ===\n`);
  if (calls.length === 0) {
    console.log('No calls found. Make a test call to 609 then run this again.');
    return;
  }
  for (const c of calls) {
    const start = c.startTime ? new Date(c.startTime).toISOString() : '—';
    const dur = c.duration != null ? `${c.duration}s` : '—';
    const consoleUrl = `${base}?sid=${c.sid}`;
    console.log(`SID:    ${c.sid}`);
    console.log(`From:   ${c.from}`);
    console.log(`To:     ${c.to}`);
    console.log(`Status: ${c.status}`);
    console.log(`Start:  ${start}  Duration: ${dur}`);
    console.log(`Console (Request Inspector): ${consoleUrl}`);
    console.log('');
  }
  console.log('--- What to check in Request Inspector for your live call ---');
  console.log('1. Request URL must be: .../incomingcall  (not /webhook/webrtc)');
  console.log('2. Request method: POST');
  console.log('3. Response code: 200');
  console.log('4. Response body must contain: <Enqueue workflowSid="WW...">');
  console.log('   If it does NOT, the issue is webhook path/response, not TaskRouter.');
  console.log('5. If response body IS Enqueue TwiML, then check TaskRouter for a Task with that call_sid.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
