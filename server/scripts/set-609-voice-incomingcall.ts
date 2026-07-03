/**
 * Tie 609 number to the dedicated /incomingcall webhook.
 * Dev branch: points to baa2. Override with BASE_URL for production.
 * Run: npx tsx server/scripts/set-609-voice-incomingcall.ts
 *      BASE_URL=https://aoirail-production.up.railway.app npx tsx server/scripts/set-609-voice-incomingcall.ts  (production)
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } from '../hardcoded-config';

const INBOUND_LAST10 = '6096048379';
const BASE = process.env.BASE_URL || WEBHOOK_BASE_URL;
const VOICE_URL = `${BASE}/incomingcall`;
const STATUS_CALLBACK = `${BASE}/api/twilio/call-status`;

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const list = await client.incomingPhoneNumbers.list();
  const target = list.find((n) => {
    const digits = String(n.phoneNumber || '').replace(/\D/g, '');
    return digits.slice(-10) === INBOUND_LAST10;
  });
  if (!target) {
    console.error('No number ending in', INBOUND_LAST10, 'found.');
    process.exit(1);
  }
  await client.incomingPhoneNumbers(target.sid).update({
    voiceUrl: VOICE_URL,
    statusCallback: STATUS_CALLBACK,
    voiceApplicationSid: '',
  });
  console.log('OK:', target.phoneNumber, '-> voiceUrl:', VOICE_URL);
  console.log('TwiML App cleared. Calls to 609 will POST to /incomingcall → TaskRouter Enqueue only.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
