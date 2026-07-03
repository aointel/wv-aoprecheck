/**
 * Point a different number (NOT 609) at the same /incomingcall + Status Callback as 609.
 * Use this to test that recording works without touching the live 609 number.
 * Once recording works on this number, apply the same to 609 with set-609-voice-incomingcall.ts.
 *
 * Run: npx tsx server/scripts/point-number-to-incomingcall.ts [last4]
 *      e.g. npx tsx server/scripts/point-number-to-incomingcall.ts 5032
 *      (no arg = list numbers and use first non-609, or pass last 4 digits to pick one)
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } from '../hardcoded-config.js';

const INBOUND_609_LAST10 = '6096048379';
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
      console.error('No other numbers in account (only 609). Buy another number in Twilio first.');
      process.exit(1);
    }
    target = not609[0];
    console.log('No number specified. Using first non-609:', target.phoneNumber);
    console.log('(Pass last 4 digits to pick another: npx tsx server/scripts/point-number-to-incomingcall.ts 5032)\n');
  }

  const digits = String(target.phoneNumber || '').replace(/\D/g, '');
  if (digits.endsWith(INBOUND_609_LAST10)) {
    console.error('Refusing to change 609 with this script. Use set-609-voice-incomingcall.ts for 609.');
    process.exit(1);
  }

  await client.incomingPhoneNumbers(target.sid).update({
    voiceUrl: VOICE_URL,
    statusCallback: STATUS_CALLBACK,
    voiceApplicationSid: '',
  });

  console.log('OK:', target.phoneNumber);
  console.log('  Voice URL:     ', VOICE_URL);
  console.log('  Status Cb:     ', STATUS_CALLBACK);
  console.log('');
  console.log('Call this number, let it ring/answer, hang up. Then check twilio_call_logs for that To number — recording_url should get set if the flow works. Once it does, run set-609-voice-incomingcall.ts on 609.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
