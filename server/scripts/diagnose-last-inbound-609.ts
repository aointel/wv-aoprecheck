/**
 * Diagnose what happened with the LAST incoming 609 call:
 * - Did /incomingcall get hit? (you check Railway logs for LIVE_CALL_INCOMINGCALL)
 * - Was a Task created? (we list recent tasks and match by call_sid)
 * - Did routing check market/state? (assignment callback rejects on mismatch)
 * - Did the panel show the call? (only if we returned dequeue and wrote to taskrouter_pending)
 * - Did the call connect? (only if we returned dequeue and Twilio bridged)
 *
 * Run: npx tsx server/scripts/diagnose-last-inbound-609.ts
 *      npx tsx server/scripts/diagnose-last-inbound-609.ts 5   (last 5 calls)
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { isTaskRouterConfigured, listRecentTasks } from '../taskrouter-service.js';
import { supabaseAdmin } from '../supabase.js';

const TO_609 = '+16096048379';
const LIMIT = parseInt(process.argv[2] || '5', 10);

function parseTaskAttrs(attrs: string): Record<string, unknown> {
  try {
    return typeof attrs === 'string' ? JSON.parse(attrs) : (attrs as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

async function main() {
  console.log('\n=== LAST INBOUND 609 CALL — WHAT HAPPENED? ===\n');

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({ to: TO_609, limit: LIMIT });
  if (calls.length === 0) {
    console.log('No calls to 609 found. Make a test call, then run this again.');
    console.log('\nThen check Railway logs for: LIVE_CALL_INCOMINGCALL');
    process.exit(0);
  }

  const lastCall = calls[0];
  const callSid = lastCall.sid;
  const consoleUrl = `https://console.twilio.com/us1/monitor/logs/calls?sid=${callSid}`;

  console.log('--- LAST CALL TO 609 ---');
  console.log('Call SID:   ', callSid);
  console.log('From:       ', lastCall.from);
  console.log('To:         ', lastCall.to);
  console.log('Status:     ', lastCall.status);
  console.log('Start:      ', lastCall.startTime ? new Date(lastCall.startTime).toISOString() : '—');
  console.log('Duration:   ', lastCall.duration != null ? `${lastCall.duration}s` : '—');
  console.log('Console:    ', consoleUrl);
  console.log('');

  // Recent TaskRouter tasks
  let tasks: Array<{ sid: string; attributes: string; status: string; dateCreated?: string }> = [];
  if (isTaskRouterConfigured()) {
    try {
      tasks = await listRecentTasks({ limit: 30 });
    } catch (e) {
      console.error('TaskRouter list tasks failed:', (e as Error).message);
    }
  }

  const taskForCall = tasks.find((t) => {
    const attrs = parseTaskAttrs(t.attributes);
    const sid = (attrs.call_sid as string) || '';
    return sid === callSid;
  });

  if (taskForCall) {
    const rawAttrs = taskForCall.attributes;
    const attrs = parseTaskAttrs(rawAttrs);
    console.log('--- TASK CREATED FOR THIS CALL ---');
    console.log('Task SID:   ', taskForCall.sid);
    console.log('Task status:', taskForCall.status);
    console.log('Task market:', attrs.market ?? '(none)');
    console.log('Task state: ', attrs.state ?? '(none)');
    console.log('routing_target:', attrs.routing_target ?? '(none)');
    if (!attrs.market || !attrs.state) {
      console.log('');
      console.log('>>> TASK HAS NO MARKET/STATE — workflow target expression will match NO workers (0 reservations).');
      console.log('>>> Raw task attributes from Twilio:', typeof rawAttrs === 'string' ? rawAttrs.slice(0, 500) : JSON.stringify(rawAttrs).slice(0, 500));
      console.log('>>> FIX: Deploy latest code to Railway so /incomingcall sends market and state in Enqueue.');
    }
    console.log('');
  } else {
    console.log('--- NO TASK FOUND FOR THIS CALL SID ---');
    console.log('Either /incomingcall did not return Enqueue TwiML, or the task was created with a different call_sid.');
    console.log('Check Railway: grep LIVE_CALL_INCOMINGCALL — response body must contain <Enqueue workflowSid="WW...">');
    console.log('');
  }

  // Recent pending rows (who got an offer we accepted for dequeue = panel would show)
  let pendingRows: Array<{ reservation_sid: string; task_sid: string; worker_attributes: string; task_attributes: string; created_at: string }> = [];
  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('taskrouter_pending')
        .select('reservation_sid, task_sid, worker_attributes, task_attributes, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      pendingRows = (data as typeof pendingRows) ?? [];
    } catch (_) {}
  }

  const pendingForThisTask = taskForCall ? pendingRows.filter((r) => r.task_sid === taskForCall.sid) : [];
  const pendingForCallSid = pendingRows.filter((r) => {
    try {
      const ta = typeof r.task_attributes === 'string' ? JSON.parse(r.task_attributes) : r.task_attributes;
      return (ta?.call_sid as string) === callSid;
    } catch {
      return false;
    }
  });

  console.log('--- ROUTING & PANEL ---');
  console.log('Assignment callback always returns dequeue (we do not reject). TaskRouter only offers to workers that match TaskQueue (routing_target==inbound609) and Workflow (market/state).');
  console.log('If we get a reservation: we log "TaskRouter assignment", write to taskrouter_pending, return dequeue → panel shows; Twilio bridges the call.');
  console.log('If 0 reservations: TaskRouter never called our callback → no worker matched. Run diagnose-taskrouter-why-no-reservations and readiness-609-for-caller.');
  console.log('');
  if (pendingForCallSid.length > 0) {
    console.log('Pending row(s) for this call (panel would have shown for this agent):', pendingForCallSid.length);
    for (const row of pendingForCallSid) {
      let wa: Record<string, unknown> = {};
      try {
        wa = typeof row.worker_attributes === 'string' ? JSON.parse(row.worker_attributes) : row.worker_attributes || {};
      } catch (_) {}
      console.log('  reservation:', row.reservation_sid, '| worker:', (wa.agent_email ?? wa.email) ?? '', '| created:', row.created_at);
    }
  } else if (taskForCall) {
    console.log('No taskrouter_pending rows for this call right now.');
    if (lastCall.status === 'completed' || lastCall.status === 'busy' || lastCall.status === 'canceled' || lastCall.status === 'failed') {
      console.log('Call already ended (status=' + lastCall.status + '). We delete pending rows when call ends, so no row is expected.');
      console.log('Check Railway: "TaskRouter assignment: dequeue" = call was offered and connected; "reject (market/state mismatch)" = we rejected.');
    } else {
      console.log('Likely: 0 reservations — no worker matched OR worker had 0 voice capacity.');
      console.log('So: assignment callback was never called; panel did NOT show, call did NOT connect.');
      console.log('');
      console.log('Run these to debug and fix:');
      console.log('  npx tsx server/scripts/check-task-reservations.ts', taskForCall.sid);
      console.log('  npx tsx server/scripts/list-workers-voice-capacity.ts   (fixes 0 voice capacity for online workers)');
      console.log('  npx tsx server/scripts/diagnose-taskrouter-why-no-reservations.ts');
    }
  } else {
    console.log('No task found for this call — no assignment callback would have run.');
  }
  console.log('');

  console.log('--- WHAT TO CHECK IN RAILWAY LOGS ---');
  console.log('1. "609 /incomingcall" or LIVE_CALL_INCOMINGCALL — confirms /incomingcall was hit; twiml= must contain <Enqueue>.');
  console.log('2. "TaskRouter assignment" — we were offered a reservation; we always return dequeue. Panel shows, call bridges.');
  console.log('If you see NO "TaskRouter assignment" after a call: 0 reservations. TaskQueue/Workflow filtered out all workers.');
  console.log('  Run readiness-609-for-caller.ts +<caller> to see who would match; fix customers (market/states) or masterlead.');
  console.log('  Run diagnose-taskrouter-why-no-reservations.ts to see available workers and voice channel.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
