/**
 * What happened with the call FROM this number (to 609)?
 * Run: npx tsx server/scripts/diagnose-call-by-from.ts 5032018470
 *      npx tsx server/scripts/diagnose-call-by-from.ts +15032018470
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';
import { isTaskRouterConfigured, listRecentTasks } from '../taskrouter-service.js';
import { supabaseAdmin } from '../supabase.js';

const raw = process.argv[2]?.trim();
if (!raw) {
  console.error('Usage: npx tsx server/scripts/diagnose-call-by-from.ts <phone>');
  process.exit(1);
}
const digits = raw.replace(/\D/g, '');
const fromE164 = digits.length === 10 ? `+1${digits}` : raw.startsWith('+') ? raw : `+${digits}`;

async function main() {
  const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);

  // Twilio: calls to 609 from this number
  const calls = await client.calls.list({ to: '+16096048379', limit: 50 });
  const fromCalls = (calls as any[]).filter((c) => (c.from || '').replace(/\D/g, '').endsWith(digits.slice(-10)));
  if (fromCalls.length === 0) {
    console.log(`No calls to 609 from ${fromE164} (or ${raw}) in recent Twilio list.`);
    process.exit(0);
  }
  const last = fromCalls[0];
  const callSid = last.sid;
  console.log('=== Call from', fromE164, 'to 609 ===\n');
  console.log('Call SID:  ', callSid);
  console.log('From:      ', last.from);
  console.log('Status:    ', last.status);
  console.log('Start:     ', last.startTime ? new Date(last.startTime).toISOString() : '—');
  console.log('Duration:  ', last.duration != null ? `${last.duration}s` : '—');
  console.log('');

  // TaskRouter task for this call
  let taskForCall: { sid: string; attributes: string; status: string; dateCreated?: string } | null = null;
  if (isTaskRouterConfigured()) {
    const tasks = await listRecentTasks({ limit: 80 });
    taskForCall = tasks.find((t) => {
      try {
        const a = typeof t.attributes === 'string' ? JSON.parse(t.attributes) : t.attributes || {};
        const phone = (a.phone_number || a.phone || '').replace(/\D/g, '');
        return (a.call_sid === callSid) || phone.endsWith(digits.slice(-10));
      } catch { return false; }
    }) ?? null;
  }

  if (taskForCall) {
    const attrs = typeof taskForCall.attributes === 'string' ? JSON.parse(taskForCall.attributes) : taskForCall.attributes || {};
    console.log('--- TaskRouter task ---');
    console.log('Task SID:  ', taskForCall.sid);
    console.log('Status:    ', (taskForCall as any).assignmentStatus ?? taskForCall.status);
    console.log('market:    ', attrs.market);
    console.log('state:     ', attrs.state);
    console.log('call_sid:  ', attrs.call_sid);
    console.log('');

    const ws = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID!);
    const reservations = await ws.tasks(taskForCall.sid).reservations.list();
    console.log('Reservations:', reservations.length);
    for (const r of reservations as any[]) {
      console.log('  ', r.sid, '| worker:', r.workerSid ?? r.worker_sid, '|', r.reservationStatus ?? r.reservation_status);
    }
    if (reservations.length === 0) {
      console.log('  → No worker was offered this task (no match or 0 voice capacity).');
    }
    console.log('');
  } else {
    console.log('--- No TaskRouter task found for this call. ---\n');
  }

  // DB: twilio_call_logs
  if (supabaseAdmin) {
    const { data: rows } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, call_status, call_duration, call_started_at, owner_email, call_source')
      .ilike('from_number', `%${digits.slice(-10)}%`)
      .order('call_started_at', { ascending: false })
      .limit(5);
    if (rows?.length) {
      console.log('--- twilio_call_logs (from this number) ---');
      for (const r of rows) {
        console.log('  ', r.twilio_call_sid, '|', r.call_status, '|', r.call_duration ?? '—', 's | owner:', r.owner_email ?? '—', '|', r.call_started_at);
      }
    }
  }
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
