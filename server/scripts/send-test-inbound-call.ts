/**
 * Trigger a test inbound call that rings a client on /connect.
 * Usage: npx tsx server/scripts/send-test-inbound-call.ts [target@email.com]
 * Default target: chrislafond@aoglobelife.com
 * Base URL: BASE_URL env or https://aoirail-production.up.railway.app
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '../hardcoded-config';

const DEFAULT_BASE_URL = 'https://aoirail-production.up.railway.app';
const DEFAULT_CLIENT = 'chrislafond@aoglobelife.com';
const TEST_CALLER = TWILIO_PHONE_NUMBER || '+15032018470';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const targetEmail = (process.argv[2] || DEFAULT_CLIENT).trim().toLowerCase();
  if (!targetEmail.includes('@')) {
    console.error('Usage: npx tsx server/scripts/send-test-inbound-call.ts [target@email.com]');
    process.exit(1);
  }
  const baseUrl = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const webhookUrl = `${baseUrl}/webhook/test-inbound?client=${encodeURIComponent(targetEmail)}`;
  const call = await client.calls.create({
    from: TEST_CALLER,
    to: `client:${targetEmail}`,
    url: webhookUrl,
    method: 'POST',
  });
  console.log('Test call started:', call.sid);
  console.log('From:', TEST_CALLER, '-> Target:', targetEmail);
  console.log('Webhook:', webhookUrl);
  console.log(`${targetEmail} /connect should ring — have them Accept.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
