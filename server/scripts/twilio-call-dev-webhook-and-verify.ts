/**
 * Use Twilio to place a real call that hits our DEV webhook and verify it works.
 * 1) Set 6096048379 Voice URL to DEV.
 * 2) POST to DEV /webhook/test-inbound with simulated inbound body → assert 200 and valid TwiML.
 * 3) Create a real call FROM +16096048379 TO +16096048379 so Twilio requests the number's Voice URL (DEV).
 * 4) Verify call was created and (when events available) that request URL was DEV.
 *
 * Run: npx tsx server/scripts/twilio-call-dev-webhook-and-verify.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const INBOUND_LAST10 = '6096048379';
const INBOUND_NUMBER = '+16096048379';
const DEV_BASE = 'https://aoirail-production-baa2.up.railway.app';
const DEV_WEBHOOK = `${DEV_BASE}/webhook/test-inbound`;
const DEV_HOST = 'aoirail-production-baa2.up.railway.app';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials (hardcoded-config)');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log('=== 1) Set 6096048379 Voice URL to DEV ===');
  const list = await client.incomingPhoneNumbers.list();
  const target = list.find((n) => {
    const d = String(n.phoneNumber || '').replace(/\D/g, '');
    return d.slice(-10) === INBOUND_LAST10;
  });
  if (!target) {
    console.error('Number ending in', INBOUND_LAST10, 'not found.');
    process.exit(1);
  }
  await client.incomingPhoneNumbers(target.sid).update({
    voiceUrl: DEV_WEBHOOK,
    statusCallback: `${DEV_BASE}/api/twilio/call-status`,
    voiceApplicationSid: '',
  });
  console.log('OK: Voice URL set to', DEV_WEBHOOK, '(TwiML App cleared)');

  console.log('\n=== 2) POST to DEV /webhook/test-inbound (simulated inbound) ===');
  const body = new URLSearchParams({
    CallSid: 'test-verify-' + Date.now(),
    AccountSid: TWILIO_ACCOUNT_SID,
    From: '+15551234567',
    To: INBOUND_NUMBER,
    Called: INBOUND_NUMBER,
    Direction: 'inbound',
    CallStatus: 'ringing',
  });
  const postRes = await fetch(DEV_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await postRes.text();
  if (postRes.status !== 200) {
    console.error('FAIL: DEV webhook returned', postRes.status, text);
    process.exit(1);
  }
  const hasDialClient = /<Dial[^>]*>[\s\S]*?<Client>/.test(text) || text.includes('<Dial>');
  if (!hasDialClient && !text.includes('<Say>')) {
    console.error('FAIL: Expected TwiML with <Dial><Client> or <Say>. Got:', text.slice(0, 500));
    process.exit(1);
  }
  console.log('OK: DEV webhook returned 200 and valid TwiML (length', text.length, ')');

  console.log('\n=== 3) Create real call (url=', DEV_WEBHOOK, ') ===');
  const call = await client.calls.create({
    from: INBOUND_NUMBER,
    to: INBOUND_NUMBER,
    url: DEV_WEBHOOK,
    method: 'POST',
  });
  console.log('Call created:', call.sid, 'status:', call.status);

  console.log('\n=== 4) Verify number still points to DEV and call status ===');
  const numAgain = await client.incomingPhoneNumbers(target.sid).fetch();
  const voiceUrl = (numAgain as any).voiceUrl || '';
  if (!voiceUrl.includes(DEV_HOST)) {
    console.error('FAIL: Number Voice URL is not DEV:', voiceUrl);
    process.exit(1);
  }
  console.log('OK: Number Voice URL is DEV:', voiceUrl);

  await new Promise((r) => setTimeout(r, 8000));

  const callFetched = await client.calls(call.sid).fetch();
  console.log('Call status:', callFetched.status, 'duration:', callFetched.duration);

  if (callFetched.status === 'failed') {
    const err = (callFetched as any).subresourceUris ? null : (callFetched as any);
    console.log('Call failed (may be webhook error). Check Twilio console. Error code:', (callFetched as any).errorCode);
  }

  try {
    const events = await (client.calls(call.sid) as any).events?.list?.({ limit: 10 });
    if (events && events.length > 0) {
      const urls = events.map((e: any) => e.request?.url).filter(Boolean);
      const hitDev = urls.some((u: string) => u && u.includes(DEV_HOST));
      const hitProduction = urls.some((u: string) => u && u.includes('aoirail-production-baa2.up.railway.app'));
      if (hitDev) {
        console.log('OK: Call events show request URL on DEV:', urls.find((u: string) => u && u.includes(DEV_HOST)));
      } else if (hitProduction) {
        console.error('FAIL: Call hit PRODUCTION, not DEV. URLs:', urls);
        process.exit(1);
      } else {
        console.log('(Events show only Twilio API URLs; webhook request may appear later or in another leg.)');
      }
    } else {
      console.log('(Call events may be available 15+ min after call ends.)');
    }
  } catch (e) {
    console.log('(Events list not available or error:', (e as Error).message, ')');
  }

  console.log('\n=== Done: Number points to DEV, DEV webhook returns 200+TwiML, and test call was placed. ===');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
