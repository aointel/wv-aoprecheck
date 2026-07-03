/**
 * Place a call TO the 609 number so the real inbound flow runs.
 * Twilio requires call instructions for the originating leg too, so we use a simple hold TwiML URL.
 * Run: npx tsx server/scripts/call-609-inbound.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const INBOUND_609 = '+16096048379';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const numbers = await client.incomingPhoneNumbers.list();
  const fromNumber = numbers.find((n) => {
    const d = String(n.phoneNumber || '').replace(/\D/g, '');
    return d.slice(-10) !== '6096048379';
  })?.phoneNumber || numbers[0]?.phoneNumber;

  if (!fromNumber) {
    console.error('No Twilio number to use as caller');
    process.exit(1);
  }

  console.log('Calling 609 to trigger real inbound flow...');
  console.log('From:', fromNumber, '-> To:', INBOUND_609);
  console.log('609 Voice URL should handle the inbound side; origin leg uses Twimlet hold music.');
  const call = await client.calls.create({
    from: fromNumber,
    to: INBOUND_609,
    method: 'POST',
    url: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.soft-rock',
  });
  console.log('Call SID:', call.sid);
  console.log('Check production logs and TaskRouter diagnostics for the created inbound task.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
