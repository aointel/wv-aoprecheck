/**
 * Prove 609 inbound returns TaskRouter Enqueue (not Dial/Conference).
 * Simulates Twilio POST to /webhook/webrtc for a call TO +16096048379.
 *
 * Run: BASE_URL=https://aoirail-production-baa2.up.railway.app npx tsx server/scripts/prove-609-goes-to-taskrouter.ts
 *
 * Success: response is 200 and body contains <Enqueue and workflowSid.
 * If TaskRouter is not configured on that server, you'll get Dial or Conference instead.
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function main() {
  const url = `${BASE_URL}/webhook/webrtc`;
  // Twilio sends application/x-www-form-urlencoded for voice webhooks
  const body = new URLSearchParams({
    CallSid: 'CA' + 'test'.padEnd(32, '0').slice(0, 32),
    From: '+15551234567',
    To: '+16096048379',
    Called: '+16096048379',
    Direction: 'inbound',
  });

  console.log('POST', url);
  console.log('Body: To=+16096048379 (609), From=+15551234567\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const text = await res.text();
  const hasEnqueue = /<Enqueue\b/i.test(text);
  // Twilio workflow SIDs are WW... (task queues are WQ..., workflows are WW...)
  const hasWorkflowSid = /workflowSid\s*=\s*["']WW[a-z0-9]{32}["']/i.test(text);
  const hasDial = /<Dial\b/i.test(text);
  const hasConference = /<Conference\b/i.test(text);

  console.log('Status:', res.status);
  console.log('Contains <Enqueue:', hasEnqueue);
  console.log('Contains workflowSid (WW...):', hasWorkflowSid);
  console.log('Contains <Dial:', hasDial);
  console.log('Contains <Conference:', hasConference);
  console.log('\n--- Response snippet (first 600 chars) ---');
  console.log(text.slice(0, 600));

  if (res.status !== 200) {
    console.error('\nFAIL: not 200');
    process.exit(1);
  }
  if (!hasEnqueue || !hasWorkflowSid) {
    console.error('\nFAIL: 609 did NOT return TaskRouter Enqueue. TaskRouter may not be configured on this server (missing TWILIO_TASKROUTER_* env).');
    process.exit(1);
  }
  console.log('\nOK: 609 path returns TaskRouter Enqueue.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
