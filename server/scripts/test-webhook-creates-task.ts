/**
 * POST to the inbound webhook (same shape as Twilio) and verify:
 * 1) Webhook returns 200 and Enqueue TwiML (server is routing to TaskRouter).
 * 2) Optionally list recent TaskRouter tasks so you can see if real calls created tasks.
 *
 * Note: A script POST does not create a task — only when Twilio POSTs (real call) does
 * Twilio create the task. This script only verifies the webhook response.
 *
 * Run: npx tsx server/scripts/test-webhook-creates-task.ts
 *      npx tsx server/scripts/test-webhook-creates-task.ts (uses production URL)
 *      npx tsx server/scripts/test-webhook-creates-task.ts --loop 60   (test every 60 seconds)
 */
import { isTaskRouterConfigured, getWorkflowSidForEnqueue, fetchWorkspace } from '../taskrouter-service.js';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } from '../hardcoded-config.js';

const BASE_URL = process.env.BASE_URL || WEBHOOK_BASE_URL;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || 'incomingcall'; // 609 uses /incomingcall
const WEBHOOK_URL = `${BASE_URL.replace(/\/$/, '')}/${WEBHOOK_PATH}`;

async function runOneTest(): Promise<{ ok: boolean; message: string; recentTaskCount?: number }> {
  const callSid = `test-webhook-${Date.now()}`;
  const from = '+15551234567';
  const to = '+16096048379'; // 609 so server treats as inbound

  const body = new URLSearchParams({
    CallSid: callSid,
    From: from,
    To: to,
  });

  let res: Response;
  try {
    res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Fetch failed: ${msg}` };
  }

  let text = await res.text();
  if (!res.ok) {
    return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  // Two-step /incomingcall: first response is Redirect, follow it and check second for Enqueue
  if (text.includes('<Redirect') && WEBHOOK_PATH === 'incomingcall') {
    const m = text.match(/<Redirect[^>]*>([^<]+)<\/Redirect>/i) || text.match(/Redirect[^>]*>([^<]+)</);
    const redirectUrl = m ? m[1].replace(/&amp;/g, '&').trim() : '';
    if (redirectUrl) {
      const res2 = await fetch(redirectUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      text = await res2.text();
      if (!res2.ok) return { ok: false, message: `Redirect target returned HTTP ${res2.status}: ${text.slice(0, 200)}` };
    }
  }

  if (!text.includes('<Enqueue') && !text.includes('Enqueue')) {
    return { ok: false, message: `Response is not Enqueue TwiML: ${text.slice(0, 300)}` };
  }

  // Webhook is returning Enqueue. Optionally report recent task count (from real calls).
  let recentTaskCount: number | undefined;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && isTaskRouterConfigured()) {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const { sid: wsSid } = await fetchWorkspace();
      const workflowSid = getWorkflowSidForEnqueue();
      const tasks = await client.taskrouter.v1.workspaces(wsSid).tasks.list({
        workflowSid,
        limit: 50,
      });
      recentTaskCount = tasks.length;
    } catch (_) {}
  }

  return {
    ok: true,
    message: 'Webhook returned Enqueue TwiML (inbound would route to TaskRouter)',
    recentTaskCount,
  };
}

async function main() {
  const loopSec = process.argv.includes('--loop')
    ? parseInt(process.argv[process.argv.indexOf('--loop') + 1], 10) || 60
    : 0;

  console.log('Testing webhook -> TaskRouter task creation');
  console.log('POST', WEBHOOK_URL);
  console.log('');

  const run = async () => {
    const result = await runOneTest();
    const ts = new Date().toISOString();
    if (result.ok) {
      const extra = result.recentTaskCount !== undefined ? ` | recent tasks in workflow: ${result.recentTaskCount}` : '';
      console.log(`[${ts}] PASS: ${result.message}${extra}`);
    } else {
      console.error(`[${ts}] FAIL: ${result.message}`);
    }
    return result.ok;
  };

  const ok = await run();
  if (loopSec > 0) {
    console.log(`\nRe-running every ${loopSec}s (Ctrl+C to stop).\n`);
    setInterval(run, loopSec * 1000);
  } else {
    process.exit(ok ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
