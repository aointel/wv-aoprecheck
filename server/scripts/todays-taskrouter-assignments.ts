/**
 * Today's TaskRouter assignments: agent, phone, taalk_lead_id, associate_id. Outputs CSV.
 * - taalk_lead_id: masterlead by caller phone (last 10).
 * - associate_id: customers / agent_profiles / etc. by agent email (or by name if no @).
 *
 * Run: npx tsx server/scripts/todays-taskrouter-assignments.ts
 * Writes: todays-taskrouter-assignments.csv
 */
import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from '../supabase';

function getTodayUTC(): { start: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const start = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  return { start };
}

function phoneToLast10(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return last10.length >= 10 ? last10 : null;
}

async function getTaalkLeadIdByPhone(phone: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const last10 = phoneToLast10(phone);
  if (!last10) return null;
  try {
    const { data: rpc } = await supabaseAdmin.rpc('get_masterlead_by_phone_last10', { last10 });
    const row = Array.isArray(rpc) && rpc.length ? rpc[0] : null;
    const id = (row as any)?.taalk_lead_id;
    return id != null && String(id).trim() ? String(id).trim() : null;
  } catch (_) {}
  const { data: lead } = await supabaseAdmin
    .from('masterlead')
    .select('taalk_lead_id')
    .ilike('phone', `%${last10}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = (lead as any)?.taalk_lead_id;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

async function resolveAssociateIdByEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin || !email || !email.includes('@')) return null;
  const e = email.trim().toLowerCase();
  const { data: c } = await supabaseAdmin.from('customers').select('associate_id').ilike('company_email', e).maybeSingle();
  if ((c as any)?.associate_id != null) return String((c as any).associate_id);
  const { data: p } = await supabaseAdmin.from('customers').select('associate_id').ilike('personal_email', e).maybeSingle();
  if ((p as any)?.associate_id != null) return String((p as any).associate_id);
  let ap: any = (await supabaseAdmin.from('agent_profiles').select('agent_associate_id').ilike('email', e).limit(1).maybeSingle()).data;
  if (!ap?.agent_associate_id) ap = (await supabaseAdmin.from('agent_profiles').select('agent_associate_id').ilike('agent_email', e).limit(1).maybeSingle()).data;
  if ((ap as any)?.agent_associate_id != null) return String((ap as any).agent_associate_id);
  const { data: ah } = await supabaseAdmin.from('agent_hierarchy').select('agent_associate_id').ilike('agent_email', e).limit(1).maybeSingle();
  if ((ah as any)?.agent_associate_id != null) return String((ah as any).agent_associate_id);
  const { data: mg } = await supabaseAdmin.from('mga_rga_directory').select('associate_id').ilike('email', e).maybeSingle();
  if ((mg as any)?.associate_id != null) return String((mg as any).associate_id);
  return null;
}

async function resolveAssociateIdByAgentName(agentName: string): Promise<string | null> {
  if (!agentName || !supabaseAdmin) return null;
  if (agentName.includes('@')) return resolveAssociateIdByEmail(agentName);
  const parts = agentName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const first = parts[0];
  const last = parts.slice(1).join(' ');
  const { data: cust } = await supabaseAdmin
    .from('customers')
    .select('associate_id, company_email')
    .ilike('first_name', first)
    .ilike('last_name', last)
    .limit(1)
    .maybeSingle();
  if ((cust as any)?.associate_id != null) return String((cust as any).associate_id);
  if ((cust as any)?.company_email) return resolveAssociateIdByEmail((cust as any).company_email);
  const { data: prof } = await supabaseAdmin
    .from('agent_profiles')
    .select('agent_associate_id, agent_email')
    .ilike('agent_name', agentName.trim())
    .limit(1)
    .maybeSingle();
  if ((prof as any)?.agent_associate_id != null) return String((prof as any).agent_associate_id);
  if ((prof as any)?.agent_email) return resolveAssociateIdByEmail((prof as any).agent_email);
  return null;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase not configured');
    process.exit(1);
  }
  const { start } = getTodayUTC();
  const startStr = start.toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('inbound_success_events')
    .select('call_sid, agent_name, agent_id, connected_at')
    .gte('connected_at', startStr)
    .order('connected_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  if (!rows?.length) {
    console.log('\nNo TaskRouter assignments today.\n');
    return;
  }

  const callSids = [...new Set((rows as any[]).map((r: any) => r.call_sid).filter(Boolean))];
  const { data: callRows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number')
    .in('twilio_call_sid', callSids);
  const phoneBySid = new Map<string, string>();
  (callRows || []).forEach((r: any) => {
    if (r.twilio_call_sid && r.from_number) phoneBySid.set(r.twilio_call_sid, r.from_number);
  });

  const escape = (s: string) => (/,|"/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = ['agent,phone,taalk_lead_id,associate_id'];
  for (const r of rows as any[]) {
    const phone = r.call_sid ? phoneBySid.get(r.call_sid) ?? r.call_sid : '';
    const agent = r.agent_name || r.agent_id || '';
    const taalkLeadId = phone && phoneToLast10(phone) ? await getTaalkLeadIdByPhone(phone) : null;
    const associateId = await resolveAssociateIdByAgentName(agent);
    lines.push(
      `${escape(agent)},${escape(phone)},${escape(taalkLeadId ?? '')},${escape(associateId ?? '')}`
    );
  }
  const csv = lines.join('\n');
  const outPath = path.join(process.cwd(), 'todays-taskrouter-assignments.csv');
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(csv);
  console.error(`\nWrote ${lines.length - 1} rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
