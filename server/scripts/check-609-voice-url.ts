/**
 * Print 609 number's current Voice URL from Twilio.
 * If the number has a TwiML App (voiceApplicationSid), Twilio uses the APP's Voice URL, not the number's.
 * Run: npx tsx server/scripts/check-609-voice-url.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const PROD_INCOMINGCALL = 'https://aoirail-production.up.railway.app/incomingcall';
const BAA2_INCOMINGCALL = 'https://aoirail-production-baa2.up.railway.app/incomingcall';
const PROD_STATUS_CALLBACK = 'https://aoirail-production.up.railway.app/api/twilio/call-status';
const BAA2_STATUS_CALLBACK = 'https://aoirail-production-baa2.up.railway.app/api/twilio/call-status';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const list = await client.incomingPhoneNumbers.list();
  const n = list.find((x) => String(x.phoneNumber || '').replace(/\D/g, '').endsWith('6096048379'));
  if (!n) {
    console.log('609 number not found in account');
    return;
  }
  const num = n as any;
  const appSid = num.voiceApplicationSid || num.voice_application_sid || '';
  console.log('609 number:', n.phoneNumber);
  console.log('Number Voice URL:', n.voiceUrl ?? '(null)');
  console.log('Voice Application SID (TwiML App):', appSid || '(none)');
  console.log('Voice Method:', n.voiceMethod ?? '(default)');
  const currentStatusCallback = (n.statusCallback ?? (n as any).status_callback ?? '').trim();
  console.log('StatusCallback:', currentStatusCallback || '(null)');
  if (!currentStatusCallback) {
    console.log('  ⚠️ Status callback is NOT set – inbound leg status (completed/failed) will NOT update twilio_call_logs.');
    console.log('     Fix: npx tsx server/scripts/set-609-voice-to-baa2.ts  (or set-609-voice-incomingcall.ts for prod)');
  } else if (currentStatusCallback !== PROD_STATUS_CALLBACK && currentStatusCallback !== BAA2_STATUS_CALLBACK) {
    console.log('  ⚠️ Status callback does not match expected (prod or baa2). Expected:', BAA2_STATUS_CALLBACK);
    console.log('     Fix: npx tsx server/scripts/set-609-voice-to-baa2.ts  (or set-609-voice-incomingcall.ts for prod)');
  } else {
    console.log('  ✅ Status callback is set – call status webhooks will update twilio_call_logs.');
  }

  let urlTwilioActuallyUses = (n.voiceUrl || '').trim();
  if (appSid) {
    try {
      const app = await client.applications(appSid).fetch();
      const appUrl = (app as any).voiceUrl || (app as any).voice_url || '';
      console.log('TwiML App Voice URL:', appUrl || '(null)');
      urlTwilioActuallyUses = appUrl.trim() || urlTwilioActuallyUses;
      console.log('\n>>> Twilio uses the TwiML App for this number, so the URL called is the APP Voice URL above.');
    } catch (e: any) {
      console.log('(Could not fetch TwiML App:', e?.message ?? e, ')');
    }
  } else {
    console.log('\n>>> Twilio uses the number Voice URL (no TwiML App).');
  }

  console.log('\n--- URL Twilio will POST to for 609 inbound ---');
  console.log(urlTwilioActuallyUses || '(none – request will fail)');
  if (urlTwilioActuallyUses === PROD_INCOMINGCALL) {
    console.log('\n>>> OK: 609 points at PRODUCTION /incomingcall');
  } else if (urlTwilioActuallyUses === BAA2_INCOMINGCALL) {
    console.log('\n>>> OK: 609 points at BAA2 (dev) /incomingcall');
  } else {
    console.log('\n>>> Set 609 Voice URL:');
    console.log('    Production: npx tsx server/scripts/set-609-voice-incomingcall.ts');
    console.log('    Baa2 (dev): npx tsx server/scripts/set-609-voice-to-baa2.ts');
  }
  console.log('\n--- Summary ---');
  const voiceOk = urlTwilioActuallyUses === PROD_INCOMINGCALL || urlTwilioActuallyUses === BAA2_INCOMINGCALL;
  const statusOk = currentStatusCallback === PROD_STATUS_CALLBACK || currentStatusCallback === BAA2_STATUS_CALLBACK;
  if (voiceOk && statusOk) {
    console.log('✅ 609 is correctly configured: Voice URL and StatusCallback both set.');
  } else {
    if (!voiceOk) console.log('❌ Fix Voice URL (see above).');
    if (!statusOk) console.log('❌ Fix StatusCallback (see above).');
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
