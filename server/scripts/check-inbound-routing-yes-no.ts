/**
 * Check TaskRouter/Twilio: is anyone getting routed inbound calls? (YES/NO)
 * Run: npx tsx server/scripts/check-inbound-routing-yes-no.ts
 */
import { isTaskRouterConfigured, getWorkflowSidForEnqueue, fetchWorkspace } from '../taskrouter-service.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import twilio from 'twilio';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !isTaskRouterConfigured()) {
    console.log('NO (TaskRouter or Twilio not configured)');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { sid: wsSid } = await fetchWorkspace();
  const workflowSid = getWorkflowSidForEnqueue();
  const workspace = client.taskrouter.v1.workspaces(wsSid);

  const tasks = await workspace.tasks.list({ workflowSid, limit: 30 });
  let tasksWithReservations = 0;
  let totalReservations = 0;
  const workerEmails: string[] = [];

  for (const t of tasks as any[]) {
    const reservations = await workspace.tasks(t.sid).reservations.list({ limit: 20 });
    if (reservations.length > 0) {
      tasksWithReservations++;
      totalReservations += reservations.length;
      for (const r of reservations as any[]) {
        const attrs = (r.workerAttributes ?? r.worker_attributes ?? '{}') as string;
        try {
          const a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
          const email = a.agent_email ?? a.email ?? r.workerSid ?? r.worker_sid;
          if (email && typeof email === 'string' && !workerEmails.includes(email)) workerEmails.push(email);
        } catch (_) {}
      }
    }
  }

  console.log('Recent inbound tasks (workflow):', tasks.length);
  console.log('Tasks that got at least one reservation (offered to a worker):', tasksWithReservations);
  console.log('Total reservations:', totalReservations);
  if (workerEmails.length > 0) {
    console.log('Workers who received at least one offer:', workerEmails.slice(0, 20).join(', '));
  }
  console.log('');
  if (tasksWithReservations > 0) {
    console.log('YES — Inbound calls are being routed to workers (TaskRouter is offering tasks).');
  } else {
    console.log('NO — No recent inbound task received any reservation. No worker is being offered these calls.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
