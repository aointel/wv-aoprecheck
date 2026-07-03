/**
 * Create a TaskRouter task for a caller, using the same masterlead lookup fields as /incomingcall.
 * This is the fastest way to prove reservation + UI payload while preserving real lead data.
 *
 * Run: npx tsx server/scripts/enqueue-test-task-globe-co.ts
 *      npx tsx server/scripts/enqueue-test-task-globe-co.ts +15032018470
 *
 * Prereq: cnsysop must be online (AvailableInbound) to get the reservation.
 * After run: check reservations for this task; assignment callback should have been hit.
 */
import twilio from 'twilio';
import {
  isTaskRouterConfigured,
  buildTaskAttributesFor609Inbound,
  createTask,
} from '../taskrouter-service.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const PHONE = process.argv[2]?.trim() || '+15032018470';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured. Set TWILIO_TASKROUTER_WORKSPACE_SID and TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID.');
    process.exit(1);
  }

  const callerLast10 = PHONE.replace(/\D/g, '').slice(-10);
  let leadId: string | undefined;
  let leadName = 'Unknown';
  let firstName: string | undefined;
  let lastName: string | undefined;
  let taalkLeadId: string | undefined;
  let leadEmail: string | undefined;
  let market = 'Globe Market';
  let state = 'CO';

  if (supabaseAdmin && callerLast10.length >= 10) {
    const { data: leadRow } = await supabaseAdmin
      .from('masterlead')
      .select('id, state, taalk_state, taalk_market, first_name, last_name, taalk_lead_id, email, cn_email')
      .ilike('phone', `%${callerLast10}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadRow) {
      const rawState = (leadRow.state ?? (leadRow as any).taalk_state) != null ? String(leadRow.state ?? (leadRow as any).taalk_state).trim() : '';
      const rawMarket = (leadRow as any).taalk_market != null ? String((leadRow as any).taalk_market).trim() : '';
      if (rawState) state = rawState.length === 2 ? rawState.toUpperCase() : rawState;
      if (rawMarket) market = rawMarket;
      if (leadRow.id != null) leadId = String(leadRow.id);
      if ((leadRow as any).first_name) firstName = String((leadRow as any).first_name).trim();
      if ((leadRow as any).last_name) lastName = String((leadRow as any).last_name).trim();
      leadName = [firstName, lastName].filter(Boolean).join(' ').trim() || firstName || 'Unknown';
      if ((leadRow as any).taalk_lead_id) taalkLeadId = String((leadRow as any).taalk_lead_id).trim();
      const em = (leadRow as any).email || (leadRow as any).cn_email;
      if (em) leadEmail = String(em).trim();
    }
  }

  const attributes = buildTaskAttributesFor609Inbound({
    call_sid: 'CA-script-' + Date.now(),
    phone_number: PHONE,
    market,
    state,
    lead_id: leadId,
    lead_name: leadName,
    first_name: firstName,
    last_name: lastName,
    lead_email: leadEmail,
    taalk_lead_id: taalkLeadId,
  });

  console.log('Creating task using 609 lead payload:');
  console.log('  market:', market);
  console.log('  state:', state);
  console.log('  phone_number:', PHONE);
  console.log('  routing_target: inbound609');
  console.log('  attributes:', attributes);
  console.log('');

  const { taskSid } = await createTask(attributes);
  console.log('Task created:', taskSid);
  console.log('Waiting 6s for TaskRouter to run workflow and hit assignment callback...');
  await new Promise((r) => setTimeout(r, 6000));

  const workspaceSid = TWILIO_TASKROUTER_WORKSPACE_SID || process.env.TWILIO_TASKROUTER_WORKSPACE_SID;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !workspaceSid) {
    console.log('Missing Twilio config to list reservations. Task SID above — run: npx tsx server/scripts/task-reservations.ts', taskSid);
    return;
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const reservations = await client.taskrouter.v1
    .workspaces(workspaceSid)
    .tasks(taskSid)
    .reservations.list();

  console.log('');
  console.log('Reservations for this task:', reservations.length);
  if (reservations.length === 0) {
    console.log('  → No reservations. Either no worker matched (market/state) or assignment callback URL is wrong/unreachable.');
    console.log('  → Check: cnsysop online? routing_target=inbound609? markets includes "Globe Market", licensed_states includes "CO"?');
    process.exit(1);
  }

  for (const r of reservations as any[]) {
    const status = r.reservationStatus ?? r.reservation_status ?? r.status;
    const workerSid = r.workerSid ?? r.worker_sid;
    const sid = r.sid;
    let workerName = workerSid;
    if (workerSid) {
      try {
        const w = await client.taskrouter.v1.workspaces(workspaceSid).workers(workerSid).fetch();
        workerName = (w as any).friendlyName ?? (w as any).friendly_name ?? workerSid;
        const attrs = typeof (w as any).attributes === 'string' ? JSON.parse((w as any).attributes) : (w as any).attributes || {};
        const email = attrs.agent_email ?? attrs.email ?? '';
        if (email) workerName += ' (' + email + ')';
      } catch (_) {}
    }
    console.log('  ', sid, '| worker:', workerName, '| status:', status);
  }

  console.log('');
  console.log('TaskRouter got the task and assigned to the worker(s) above. If cnsysop is listed, routing works.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
