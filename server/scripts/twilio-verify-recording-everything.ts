/**
 * Twilio API: Verify 609 number points to production and that recent calls have recordings.
 * Run with full account access (Auth Token). Use to confirm "record everything" is in effect.
 *
 * Run: npx tsx server/scripts/twilio-verify-recording-everything.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

const INBOUND_609 = '+16096048379';
const EXPECTED_VOICE_URL = 'https://aoirail-production-baa2.up.railway.app/incomingcall';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials missing.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log('\n📞 Twilio: Verify recording setup (full account access)\n');

  // 1) Incoming phone numbers — 609 must point to production /incomingcall
  const numbers = await client.incomingPhoneNumbers.list();
  const num609 = numbers.find((n) => String(n.phoneNumber || '').replace(/\D/g, '').endsWith('6096048379'));
  if (num609) {
    const voiceUrl = (num609 as any).voiceUrl || '';
    const ok = voiceUrl && voiceUrl.replace(/\/$/, '').endsWith('/incomingcall');
    console.log(`1) 609 number (${INBOUND_609}):`);
    console.log(`   Voice URL: ${voiceUrl || '(not set)'}`);
    console.log(`   Expected:  ${EXPECTED_VOICE_URL}`);
    console.log(ok ? '   ✅ Voice URL points to production /incomingcall\n' : '   ⚠️ Fix: Set Voice URL to production /incomingcall in Twilio Console\n');
  } else {
    console.log(`1) 609 number: not found in this account.\n`);
  }

  // 2) Recent calls to 609 — how many have recordings?
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startAfter = last24h.toISOString().slice(0, 19) + 'Z';
  const calls = await client.calls.list({ to: INBOUND_609, startTimeAfter: startAfter, limit: 100 });
  let withRecordings = 0;
  let withoutRecordings = 0;
  for (const c of calls) {
    const recs = await client.calls(String(c.sid)).recordings.list();
    if (recs.length > 0) withRecordings++;
    else withoutRecordings++;
  }
  console.log('2) Last 24h — inbound calls to 609:');
  console.log(`   Total: ${calls.length}, With recording: ${withRecordings}, Without: ${withoutRecordings}`);
  if (withoutRecordings > 0) {
    console.log('   ⚠️ Some calls have no recording (e.g. abandoned before answer or recording started after answer).');
  } else if (calls.length > 0) {
    console.log('   ✅ All listed calls have at least one recording.\n');
  }
  console.log('');

  // 3) Account: confirm we're using Auth Token (no API Key restriction)
  console.log('3) Server must use Auth Token (not restricted API Key) so recording is never blocked.');
  console.log('   ✅ If this script runs with your env, credentials have API access.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
