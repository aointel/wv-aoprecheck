/**
 * Check whether Twilio inbound 609 number is configured to hit /incomingcall.
 * Read-only; does not change anything.
 * Run: npx tsx server/scripts/check-609-inbound-webhook.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const INBOUND_LAST10 = '6096048379';
const EXPECTED_VOICE_PATH = '/incomingcall';
const EXPECTED_BASE = 'https://aoirail-production-baa2.up.railway.app';

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
    console.error('No number ending in', INBOUND_LAST10, 'found in this account.');
    console.log('Numbers:', list.map((n) => n.phoneNumber).join(', ') || '(none)');
    process.exit(1);
  }
  const voiceUrl = target.voiceUrl || '';
  const statusCallback = target.statusCallback || '';
  const hasIncomingcall = voiceUrl.includes(EXPECTED_VOICE_PATH);
  const baseOk = voiceUrl.startsWith(EXPECTED_BASE) || voiceUrl.includes('railway.app');
  console.log('');
  console.log('=== 609 Inbound number (Twilio) ===');
  console.log('  Number:        ', target.phoneNumber);
  console.log('  SID:           ', target.sid);
  console.log('  Voice URL:     ', voiceUrl || '(not set)');
  console.log('  Status Callback:', statusCallback || '(not set)');
  console.log('  TwiML App SID: ', target.voiceApplicationSid || '(none – uses Voice URL)');
  console.log('');
  if (hasIncomingcall && baseOk) {
    console.log('  Result:        Inbound calls TO 609 WILL hit /incomingcall.');
  } else if (voiceUrl) {
    console.log('  Result:        Inbound calls are NOT going to /incomingcall.');
    console.log('                 Expected Voice URL to contain:', EXPECTED_VOICE_PATH);
    console.log('                 Fix: npx tsx server/scripts/set-609-voice-incomingcall.ts');
  } else {
    console.log('  Result:        Voice URL not set – calls may use TwiML App or default.');
    console.log('                 Fix: npx tsx server/scripts/set-609-voice-incomingcall.ts');
  }
  console.log('');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
