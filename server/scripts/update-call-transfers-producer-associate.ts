/**
 * Update taalk_call_analytics with correct producer (agent_email) and associate_id/agent_name.
 * Resolves from agent_dial_metrics by lead_phone - NOT masterlead.
 * Run: npx tsx server/scripts/update-call-transfers-producer-associate.ts
 */

import { supabaseAdmin } from '../supabase';

const BAD_PRODUCER_EMAILS = ['unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown', 'cnsysop@aoglobelife.com'];
const FALLBACK_PRODUCER = 'chrislafond@aoglobelife.com';

function normalizePhone(p: string | null | undefined): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

function isBadProducer(cn: string): boolean {
  return BAD_PRODUCER_EMAILS.includes(cn.toLowerCase().trim());
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    process.exit(1);
  }

  const { data: rows, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, taalk_call_id, to_number, agent_email, associate_id, agent_name, lead_name, market')
    .or('billing_transaction_id.ilike.twilio%,billing_transaction_id.ilike.csv%')
    .order('call_date', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('❌ Fetch error:', error);
    process.exit(1);
  }
  if (!rows?.length) {
    console.log('✅ No rows to update');
    process.exit(0);
  }

  // Resolve lead_phone from to_number or twilio_call_logs for rows that need it
  const sids = [...new Set((rows || []).map((r: any) => r.taalk_call_id).filter(Boolean))];
  const tclBySid = new Map<string, string>();
  if (sids.length > 0) {
    const { data: tcl } = await supabaseAdmin.from('twilio_call_logs').select('twilio_call_sid, to_number, parent_call_sid').in('twilio_call_sid', sids.slice(0, 1000));
    (tcl || []).forEach((r: any) => { if (r.to_number) tclBySid.set(r.twilio_call_sid, r.to_number); });
    const parentSids = [...new Set((tcl || []).map((r: any) => r.parent_call_sid).filter(Boolean))];
    if (parentSids.length > 0) {
      const { data: parents } = await supabaseAdmin.from('twilio_call_logs').select('twilio_call_sid, to_number').in('twilio_call_sid', parentSids);
      (parents || []).forEach((p: any) => { if (p.to_number && !tclBySid.has(p.twilio_call_sid)) tclBySid.set(p.twilio_call_sid, p.to_number); });
    }
  }
  const getLeadPhone = (r: any) => r.to_number || (r.taalk_call_id ? tclBySid.get(r.taalk_call_id) : null) || r.lead_phone;

  const phones = [...new Set((rows || []).map((r: any) => normalizePhone(getLeadPhone(r))).filter((p) => p.length >= 10))];
  const admByPhone = new Map<string, { agent_email: string; agent_name: string | null; lead_name: string | null }>();
  const mlByPhone = new Map<string, { agent_email: string; agent_name: string | null; lead_name: string | null; market: string | null }>();
  if (phones.length > 0) {
    try {
      const { data: admRows } = await supabaseAdmin.rpc('get_agent_dial_metrics_by_phones', { phone_arr: phones.slice(0, 500) });
      (admRows || []).forEach((r: any) => {
        const norm = String(r?.norm_phone || '').replace(/\D/g, '').slice(-10);
        if (norm.length < 10) return;
        const email = String(r?.agent_email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || isBadProducer(email)) return;
        if (!admByPhone.has(norm)) admByPhone.set(norm, { agent_email: email, agent_name: r?.agent_name?.trim() || null, lead_name: r?.lead_name?.trim() || null });
      });
    } catch (admErr) {
      console.warn('⚠️ get_agent_dial_metrics_by_phones RPC failed, using ilike fallback:', (admErr as Error)?.message);
      const orClause = phones.map((p) => `lead_phone.ilike.%${p}`).join(',');
      const { data: admRows } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('lead_phone, agent_email, agent_name, lead_name, event_timestamp')
        .or(orClause)
        .not('agent_email', 'is', null)
        .order('event_timestamp', { ascending: false });
      (admRows || []).forEach((r: any) => {
        const digits = String(r.lead_phone || '').replace(/\D/g, '');
        const norm = digits.length >= 10 ? digits.slice(-10) : digits;
        if (!norm || norm.length < 10) return;
        const email = String(r.agent_email || '').toLowerCase().trim();
        if (!email || !email.includes('@') || isBadProducer(email)) return;
        if (!admByPhone.has(norm)) admByPhone.set(norm, { agent_email: email, agent_name: r.agent_name?.trim() || null, lead_name: r.lead_name?.trim() || null });
      });
    }
    const unresolvedPhones = phones.filter((p) => !admByPhone.has(p));
    if (unresolvedPhones.length > 0) {
      try {
        const { data: mlRows } = await supabaseAdmin.rpc('get_masterlead_cn_email_by_phones', { phone_arr: unresolvedPhones.slice(0, 200) });
        (mlRows || []).forEach((row: any) => {
          const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
          if (norm.length < 10) return;
          const email = String(row?.cn_email || '').toLowerCase().trim();
          if (!email || !email.includes('@') || isBadProducer(email)) return;
          if (!mlByPhone.has(norm)) mlByPhone.set(norm, { agent_email: email, agent_name: null, lead_name: row?.lead_name?.trim() || null, market: row?.taalk_market?.trim() || null });
        });
        if (mlByPhone.size > 0) console.log(`📋 Resolved ${mlByPhone.size} producers from masterlead fallback`);
      } catch {
        // RPC may not exist
      }
    }
  }

  const producerEmails = [...new Set([...admByPhone.values(), ...mlByPhone.values()].map((v) => v.agent_email).filter(Boolean), FALLBACK_PRODUCER)];

  const custByEmail = new Map<string, { name: string; associate_id: number | null }>();
  if (producerEmails.length > 0) {
    const { data: cust } = await supabaseAdmin
      .from('customers')
      .select('company_email, first_name, last_name, associate_id')
      .in('company_email', producerEmails.slice(0, 300));
    (cust || []).forEach((c: any) => {
      const e = (c.company_email || '').toLowerCase();
      if (e) custByEmail.set(e, { name: `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim() || '', associate_id: c.associate_id ?? null });
    });
  }

  const plByEmail = new Map<string, { name: string; associate_id: number | null }>();
  if (producerEmails.length > 0) {
    const { data: pl } = await supabaseAdmin
      .from('producerlist')
      .select('company_email, first_name, last_name, associate_id')
      .in('company_email', producerEmails.slice(0, 300));
    (pl || []).forEach((p: any) => {
      const e = (p.company_email || '').toLowerCase();
      if (!e) return;
      const plRow = { name: `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() || '', associate_id: p.associate_id ?? null };
      plByEmail.set(e, plRow);
      const custRow = custByEmail.get(e);
      if (custRow && custRow.associate_id == null && plRow.associate_id != null) {
        custByEmail.set(e, { ...custRow, associate_id: plRow.associate_id });
      }
    });
  }

  let updated = 0;
  for (const row of (rows || []) as any[]) {
    const leadPhone = getLeadPhone(row);
    const phoneNorm = normalizePhone(leadPhone);
    const adm = phoneNorm ? admByPhone.get(phoneNorm) : null;
    const ml = !adm && phoneNorm ? mlByPhone.get(phoneNorm) : null;
    const producerEmail = adm?.agent_email ?? ml?.agent_email ?? (row.agent_email && !isBadProducer(row.agent_email) ? row.agent_email : null) ?? FALLBACK_PRODUCER;

    const cust = custByEmail.get(producerEmail.toLowerCase());
    const pl = plByEmail.get(producerEmail.toLowerCase());
    const agentName = adm?.agent_name ?? ml?.agent_name ?? cust?.name ?? pl?.name ?? null;
    const leadName = adm?.lead_name ?? ml?.lead_name ?? row.lead_name ?? null;
    const market = ml?.market ?? row.market ?? null;
    const associateId = producerEmail.toLowerCase() === FALLBACK_PRODUCER
      ? null
      : (cust?.associate_id ?? pl?.associate_id ?? row.associate_id ?? null);

    const { error: updErr } = await supabaseAdmin
      .from('taalk_call_analytics')
      .update({
        agent_email: producerEmail,
        agent_name: agentName,
        associate_id: associateId,
        lead_name: leadName,
        market,
        ...(!row.to_number && leadPhone ? { to_number: leadPhone } : {})
      })
      .eq('id', row.id);

    if (!updErr) updated++;
  }

  console.log(`✅ Updated ${updated} rows in taalk_call_analytics from agent_dial_metrics`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
