/**
 * Push a test incoming call directly into the incoming call module (no TaskRouter assignment needed).
 * Run: npx tsx server/scripts/inject-test-incoming-call.ts
 * Or:  npx tsx server/scripts/inject-test-incoming-call.ts (default: production URL)
 * Optional: AGENT_EMAIL=you@example.com (default: cnsysop@aoglobelife.com)
 *
 * Have the app open with that agent logged in and VDP/WebRTC online; the card appears on next poll (~2.5s).
 */
const BASE_URL = process.env.BASE_URL || 'https://aoirail-production.up.railway.app';
const AGENT_EMAIL = process.env.AGENT_EMAIL || 'cnsysop@aoglobelife.com';

async function main() {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/twilio/taskrouter/test/inject-pending`;
  console.log('Injecting test incoming call for', AGENT_EMAIL, 'at', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentEmail: AGENT_EMAIL,
      phone_number: '+15032018470',
      lead_name: 'Test Call 5032018470',
      market: 'Test',
      state: 'OR',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Failed:', res.status, data);
    process.exit(1);
  }
  console.log('OK:', data?.message || data);
  console.log('Open the app as', AGENT_EMAIL, 'with VDP or WebRTC online; the incoming call card should appear within a few seconds.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
