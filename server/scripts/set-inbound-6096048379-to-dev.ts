/**
 * Set Twilio number 6096048379 Voice URL to the dedicated inbound webhook.
 * Run: npx tsx server/scripts/set-inbound-6096048379-to-dev.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const INBOUND_LAST10 = '6096048379';
const DEV_BASE = 'https://aoirail-production-baa2.up.railway.app';

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
    console.error('No number ending in', INBOUND_LAST10, 'found. Numbers:', list.map((n) => n.phoneNumber));
    process.exit(1);
  }
  const voiceUrl = `${DEV_BASE}/incomingcall`;
  const statusCallback = `${DEV_BASE}/api/twilio/call-status`;
  // Clear TwiML App so Twilio uses this number's Voice URL (not the app's production URL)
  await client.incomingPhoneNumbers(target.sid).update({
    voiceUrl,
    statusCallback,
    voiceApplicationSid: '',
  });
  console.log('OK:', target.phoneNumber, '-> voiceUrl:', voiceUrl, '(TwiML App cleared)');
  console.log('Calls to this number route through /incomingcall (dedicated TaskRouter inbound path).');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
