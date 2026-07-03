/**
 * What task market/state would /incomingcall send for this caller?
 * Uses same masterlead lookup as handleIncomingCall (state, taalk_state, taalk_market).
 * Prints full task JSON we send in Enqueue and TaskRouter keeps for routing.
 * Run: npx tsx server/scripts/show-task-attrs-for-caller.ts +15032018470
 */
import { supabaseAdmin } from '../supabase.js';
import { buildTaskAttributesForEnqueue } from '../taskrouter-service.js';

const phoneArg = process.argv[2] || '';
const callerLast10 = String(phoneArg).replace(/\D/g, '').slice(-10);

async function main() {
  if (callerLast10.length < 10) {
    console.error('Usage: npx tsx server/scripts/show-task-attrs-for-caller.ts <phone>');
    console.error('Example: npx tsx server/scripts/show-task-attrs-for-caller.ts +15032018470');
    process.exit(1);
  }

  console.log('\n=== Task attributes for caller (same lookup as /incomingcall) ===');
  console.log('Caller phone (last 10):', callerLast10);
  console.log('');

  if (!supabaseAdmin) {
    console.error('Supabase admin not configured');
    process.exit(1);
  }

  // Same lookup as /incomingcall: RPC (normalized phone) first, then ilike fallback
  let leadRow: Record<string, unknown> | null = null;
  try {
    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc('get_masterlead_by_phone_last10', { last10: callerLast10 });
    if (!rpcErr && rpcRows && Array.isArray(rpcRows) && rpcRows.length > 0) {
      leadRow = rpcRows[0] as Record<string, unknown>;
    }
  } catch (_) {}
  if (!leadRow) {
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, state, taalk_state, taalk_market, first_name, last_name, taalk_lead_id, email, cn_email, phone, updated_at')
      .ilike('phone', `%${callerLast10}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('masterlead query error:', error.message);
      process.exit(1);
    }
    leadRow = data ?? null;
  }

  console.log('--- masterlead row (same as /incomingcall: RPC then ilike) ---');
  if (!leadRow) {
    console.log('No row found → task will get market=Unknown, state=XX');
    const taskAttributesJson = buildTaskAttributesForEnqueue({
      call_sid: 'CA-demo-' + Date.now(),
      lead_id: '',
      source: 'direct_inbound',
      market: 'Unknown',
      state: 'XX',
      phone_number: '+1' + callerLast10,
      routing_target: 'inbound609',
    });
    console.log('');
    console.log('--- Full task JSON sent in Enqueue (TaskRouter keeps for routing) ---');
    console.log(taskAttributesJson);
    return;
  }

  console.log('  id:', leadRow.id);
  console.log('  phone:', (leadRow as any).phone);
  console.log('  state:', (leadRow as any).state);
  console.log('  taalk_state:', (leadRow as any).taalk_state);
  console.log('  taalk_market:', (leadRow as any).taalk_market);
  console.log('  first_name:', (leadRow as any).first_name);
  console.log('  last_name:', (leadRow as any).last_name);
  console.log('  updated_at:', (leadRow as any).updated_at);
  console.log('');

  const rawState = (leadRow as any).state ?? (leadRow as any).taalk_state;
  const rawMarket = (leadRow as any).taalk_market ?? (leadRow as any).market;
  let leadState = 'XX';
  let leadMarket = 'Unknown';
  if (rawState != null && String(rawState).trim()) {
    const s = String(rawState).trim();
    leadState = s.length === 2 ? s.toUpperCase() : s;
  }
  if (rawMarket != null && String(rawMarket).trim()) leadMarket = String(rawMarket).trim();

  console.log('--- Normalized (same as handleIncomingCall) ---');
  console.log('  leadMarket:', leadMarket);
  console.log('  leadState:', leadState);
  const taskMarket = (leadMarket && leadMarket !== 'Unknown') ? leadMarket : 'Unknown';
  const taskState = (leadState && leadState !== 'XX' && leadState.length === 2) ? leadState.toUpperCase() : 'XX';
  console.log('');
  console.log('--- Full task JSON sent in <Enqueue><Task>...</Task></Enqueue> (TaskRouter keeps this for routing) ---');
  const leadId = leadRow?.id != null ? String(leadRow.id) : undefined;
  const firstName = (leadRow as any).first_name ? String((leadRow as any).first_name).trim() : undefined;
  const lastName = (leadRow as any).last_name ? String((leadRow as any).last_name).trim() : undefined;
  const leadName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unknown';
  const taalkLeadId = (leadRow as any).taalk_lead_id ? String((leadRow as any).taalk_lead_id).trim() : undefined;
  const leadEmail = ((leadRow as any).email || (leadRow as any).cn_email) ? String((leadRow as any).email || (leadRow as any).cn_email).trim() : undefined;
  const phoneNumber = (leadRow as any).phone ? String((leadRow as any).phone) : `+1${callerLast10}`;
  const taskAttributesJson = buildTaskAttributesForEnqueue({
    call_sid: 'CA-demo-' + Date.now(),
    lead_id: leadId,
    source: 'direct_inbound',
    market: taskMarket,
    state: taskState,
    phone_number: phoneNumber,
    lead_name: leadName,
    first_name: firstName,
    last_name: lastName,
    taalk_lead_id: taalkLeadId,
    lead_email: leadEmail,
    routing_target: 'inbound609',
  });
  console.log(taskAttributesJson);
  console.log('');
  console.log('Routing keys TaskRouter uses: task.market, task.state (must match worker.markets, worker.licensed_states)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
