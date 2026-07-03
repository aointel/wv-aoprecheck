import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const list = await client.incomingPhoneNumbers.list();
  if (!list.length) {
    console.log('No incoming phone numbers in account.');
    process.exit(0);
  }
  const first = list[0];
  console.log(first.phoneNumber ?? first.friendlyName ?? first.sid);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
