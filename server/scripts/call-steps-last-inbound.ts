/**
 * Last call to 6096048379: step-by-step what Twilio did (request URLs + response codes).
 * Run: npx tsx server/scripts/call-steps-last-inbound.ts
 */
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const TO = '+16096048379';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const auth = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const base = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;

  const listRes = await fetch(`${base}/Calls.json?To=${encodeURIComponent(TO)}&PageSize=1`, {
    headers: { Authorization: auth },
  });
  if (!listRes.ok) {
    console.error('List failed', listRes.status, await listRes.text());
    process.exit(1);
  }
  const list = (await listRes.json()) as { calls?: { sid: string; from: string; to: string; status: string; start_time: string }[] };
  const calls = list.calls || [];
  if (calls.length === 0) {
    console.log('No calls to', TO);
    return;
  }
  const call = calls[0];
  const sid = call.sid;
  const monitorUrl = `https://console.twilio.com/us1/monitor/logs/calls?sid=${sid}`;
  console.log('=== LAST CALL TO', TO, '===');
  console.log('Sid:', sid);
  console.log('From:', call.from, '-> To:', call.to);
  console.log('Status:', call.status);
  console.log('Start:', call.start_time);
  console.log('Twilio Monitor:', monitorUrl);
  console.log('');

  const eventsRes = await fetch(`${base}/Calls/${sid}/Events.json?PageSize=20`, {
    headers: { Authorization: auth },
  });
  if (!eventsRes.ok) {
    console.log('Events not available (may need 15+ min after call end):', eventsRes.status);
    return;
  }
  const eventsData = (await eventsRes.json()) as { events?: { request?: { url?: string; method?: string }; response?: { response_code?: number; request_duration?: number; response_body?: string } }[] };
  const events = eventsData.events || [];
  console.log('=== STEP BY STEP (what Twilio did) ===');
  events.forEach((e, i) => {
    const req = e.request || {};
    const res = e.response || {};
    const code = res.response_code;
    const ok = code >= 200 && code < 300;
    console.log(`Step ${i + 1}: ${req.method || '?'} ${req.url || '?'}`);
    console.log(`  Response: ${code ?? '?'} ${ok ? 'OK' : 'ERROR/FAIL'}`);
    if (res.request_duration != null) console.log(`  Duration: ${res.request_duration}ms`);
    if (res.response_body && res.response_body.length < 400) console.log(`  Body: ${res.response_body}`);
    else if (res.response_body) console.log(`  Body length: ${res.response_body.length} chars`);
    console.log('');
  });

  const hitBaa2 = events.some((e) => (e.request?.url || '').includes('aoirail-production-baa2'));
  const hitProd = events.some((e) => {
    const u = e.request?.url || '';
    return u.includes('railway.app') && !u.includes('baa2');
  });
  console.log('=== SUMMARY ===');
  console.log('Hit DEV (baa2):', hitBaa2 ? 'YES' : 'NO');
  console.log('Hit PRODUCTION (no baa2):', hitProd ? 'YES' : 'NO');
  const anyFail = events.some((e) => (e.response?.response_code ?? 0) >= 400 || (e.response?.response_code ?? 0) < 200);
  console.log('Any HTTP error (4xx/5xx):', anyFail ? 'YES' : 'NO');
  console.log('\n(Events are available ~15 min after call ends. If none above, run again later or check Monitor link.)');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
