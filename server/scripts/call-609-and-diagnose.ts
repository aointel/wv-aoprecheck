/**
 * Call the 609 number and diagnose why the caller might hear an error instead of ringing.
 * 1. POST to /incomingcall (same as Twilio) and print response + timing.
 * 2. Fetch the waitUrl (ringback) and check it returns valid TwiML and the Play URL is reachable.
 * 3. With --live: place a REAL call to 609 using OUR incomingcall URL so Twilio actually hits our server.
 *
 * Run: npx tsx server/scripts/call-609-and-diagnose.ts
 *      npx tsx server/scripts/call-609-and-diagnose.ts --live   (real call; our server gets the webhook)
 */
const BASE = process.env.BASE_URL || process.env.WEBHOOK_BASE_URL || 'https://aoirail-production-baa2.up.railway.app';

async function main() {
  const doLiveCall = process.argv.includes('--live');

  console.log('\n=== 609 INBOUND DIAGNOSTIC ===\n');
  console.log('Base URL:', BASE);

  // 1) Simulate Twilio POST to /incomingcall
  const form = new URLSearchParams({
    CallSid: 'CA-test-' + Date.now(),
    From: '+15551234567',
    To: '+16096048379',
    Called: '+16096048379',
  });
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}/incomingcall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (e: any) {
    console.error('FAILED to reach /incomingcall:', e?.message ?? e);
    process.exit(1);
  }
  const elapsed = Date.now() - start;
  const text = await res.text();

  console.log('\n--- /incomingcall response ---');
  console.log('Status:', res.status, res.statusText);
  console.log('Time:', elapsed, 'ms');
  if (elapsed > 10000) console.warn('WARNING: >10s — Twilio may timeout and play "application error"');
  console.log('Body (first 800 chars):');
  console.log(text.slice(0, 800));
  if (text.length > 800) console.log('...');

  const hasEnqueue = text.includes('<Enqueue') && text.includes('workflowSid=');
  const hasFallback = text.includes('temporarily unable to route');
  const hasSay = text.includes('<Say');

  if (hasEnqueue) {
    console.log('\n[OK] Response contains Enqueue TwiML — TaskRouter path is used.');
    const waitUrlMatch = text.match(/waitUrl="([^"]+)"/);
    const actionUrlMatch = text.match(/action="([^"]+)"/);
    const waitUrl = waitUrlMatch ? waitUrlMatch[1] : null;
    const actionUrl = actionUrlMatch ? actionUrlMatch[1] : null;
    if (waitUrl) {
      console.log('waitUrl:', waitUrl);
      const wStart = Date.now();
      try {
        const wRes = await fetch(waitUrl, { method: 'GET' });
        const wText = await wRes.text();
        const wElapsed = Date.now() - wStart;
        console.log('waitUrl fetch:', wRes.status, wElapsed + 'ms');
        const playMatch = wText.match(/<Play[^>]*>([^<]+)</);
        const playUrl = playMatch ? playMatch[1].trim() : null;
        if (playUrl) {
          console.log('Play URL from waitUrl:', playUrl);
          const pStart = Date.now();
          const pRes = await fetch(playUrl, { method: 'HEAD' });
          const pElapsed = Date.now() - pStart;
          console.log('Play URL HEAD:', pRes.status, pElapsed + 'ms');
          if (!pRes.ok) {
            console.error('>>> Play URL FAILS — caller will hear "application error". Use a reliable audio URL.');
          }
        }
      } catch (e: any) {
        console.error('waitUrl fetch failed:', e?.message ?? e);
      }
    }
    if (actionUrl) console.log('actionUrl:', actionUrl);
  } else if (hasFallback || hasSay) {
    console.log('\n[FALLBACK] Response is Say/fallback — TaskRouter not configured or exception.');
    console.log('Fix: set TWILIO_TASKROUTER_WORKSPACE_SID and TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID on Railway.');
  } else {
    console.log('\n[UNEXPECTED] Response is not Enqueue or fallback — check for errors.');
  }

  if (doLiveCall) {
    console.log('\n--- Placing REAL call to 609 (Twilio will POST to our incomingcall URL) ---');
    try {
      const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await import('../hardcoded-config.js');
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.log('Skip live call: no Twilio credentials in env.');
      } else {
        const twilio = (await import('twilio')).default;
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const numbers = await client.incomingPhoneNumbers.list();
        const fromNumber = numbers.find((n) => String(n.phoneNumber || '').replace(/\D/g, '').slice(-10) !== '6096048379')?.phoneNumber || numbers[0]?.phoneNumber;
        if (!fromNumber) {
          console.log('No Twilio number to call from.');
        } else {
          const incomingcallUrl = `${BASE.replace(/\/$/, '')}/incomingcall`;
          console.log('URL Twilio will request:', incomingcallUrl);
          const call = await client.calls.create({
            from: fromNumber,
            to: '+16096048379',
            method: 'POST',
            url: incomingcallUrl,
          });
          console.log('Call SID:', call.sid);
          console.log('Logs: https://console.twilio.com/us1/monitor/logs/calls?sid=' + call.sid);
          console.log('This call will hit our server; listen for ringback or "application error".');
        }
      }
    } catch (e: any) {
      console.error('Live call failed:', e?.message ?? e);
    }
  } else {
    console.log('\nTo place a REAL call to 609 (hit our server), run: npx tsx server/scripts/call-609-and-diagnose.ts --live');
  }

  console.log('\n=== Done ===\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
