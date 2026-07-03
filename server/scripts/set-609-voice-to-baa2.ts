/**
 * Force 609 number to use the dedicated baa2 inbound webhook and CLEAR TwiML App.
 * When voiceApplicationSid is set, Twilio uses the APP's URL; clearing it makes Twilio use
 * this number's voiceUrl so 609 always hits /incomingcall.
 * Run: npx tsx server/scripts/set-609-voice-to-baa2.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const INBOUND_LAST10 = '6096048379';
const BAA2_BASE = 'https://aoirail-production-baa2.up.railway.app';
const VOICE_URL = `${BAA2_BASE}/incomingcall`;
const STATUS_CALLBACK = `${BAA2_BASE}/api/twilio/call-status`;

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
  console.log('TwiML App cleared (voiceApplicationSid = ""). Twilio will POST to /incomingcall for 609 inbound.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
