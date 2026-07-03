/**
 * Point a non-609 number at /test-record so we can prove recording works.
 * Flow: call the number → hear "Test recording" → get recorded → Twilio POSTs to recording-status → we upsert twilio_call_logs with recording_url.
 * Check: twilio_call_logs where call_source = 'recording_status_fallback' and to_number = this number.
 *
 * Run: npx tsx server/scripts/point-number-to-test-record.ts [last4]
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } from '../hardcoded-config.js';

const INBOUND_609_LAST10 = '6096048379';
const BASE = process.env.BASE_URL || WEBHOOK_BASE_URL;
const VOICE_URL = `${BASE}/test-record`;
const STATUS_CALLBACK = `${BASE}/api/twilio/call-status`;

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const list = await client.incomingPhoneNumbers.list();
  const last4Arg = process.argv[2]?.replace(/\D/g, '').slice(-4);

  let target: (typeof list)[0] | null = null;
  if (last4Arg && last4Arg.length >= 4) {
    target = list.find((n) => String(n.phoneNumber || '').replace(/\D/g, '').endsWith(last4Arg)) ?? null;
    if (!target) {
      console.error('No number ending in', last4Arg, 'found.');
      process.exit(1);
    }
  } else {
    const not609 = list.filter((n) => !String(n.phoneNumber || '').replace(/\D/g, '').endsWith(INBOUND_609_LAST10));
    if (not609.length === 0) {
      console.error('No other numbers in account. Buy one or pass last 4.');
      process.exit(1);
    }
    target = not609[0];
    console.log('Using first non-609:', target.phoneNumber, '\n');
  }

  const digits = String(target.phoneNumber || '').replace(/\D/g, '');
  if (digits.endsWith(INBOUND_609_LAST10)) {
    console.error('Refusing to change 609. Use a different number.');
    process.exit(1);
  }

  await client.incomingPhoneNumbers(target.sid).update({
    voiceUrl: VOICE_URL,
    statusCallback: STATUS_CALLBACK,
    voiceApplicationSid: '',
  });

  console.log('OK:', target.phoneNumber);
  console.log('  Voice URL: ', VOICE_URL);
  console.log('');
  console.log('Call this number → hear "Test recording" → speak or wait → hang up or press #.');
  console.log('Then: SELECT * FROM twilio_call_logs WHERE call_source = \'recording_status_fallback\' ORDER BY created_at DESC LIMIT 5;');
  console.log('  (or check latest rows for to_number =', target.phoneNumber + ')');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
