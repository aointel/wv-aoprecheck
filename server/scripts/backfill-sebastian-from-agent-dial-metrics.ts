/**
 * Backfill producer/lead data from agent_dial_metrics into taalk_call_analytics only.
 * Fixes cases where lead_phone wasn't linked (e.g. Sebastian's call for 8328014188).
 * Run: npx tsx server/scripts/backfill-sebastian-from-agent-dial-metrics.ts
 */

import { supabaseAdmin } from '../supabase';

function normalizePhone(p: string | null | undefined): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // 1. Build agent_dial_metrics by phone
  const { data: admRows } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone, agent_email, agent_name, lead_name, event_timestamp')
    .gte('event_timestamp', weekAgo)
    .not('lead_phone', 'is', null)
    .not('agent_email', 'is', null)
    .order('event_timestamp', { ascending: false })
    .limit(2000);

  const admByPhone = new Map<string, { agent_email: string; agent_name: string | null; lead_name: string | null }>();
  for (const r of (admRows || []) as any[]) {
    const norm = normalizePhone(r.lead_phone);
    if (norm.length < 10) continue;
    const email = String(r.agent_email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue;
    if (!admByPhone.has(norm)) {
      admByPhone.set(norm, {
        agent_email: email,
        agent_name: r.agent_name?.trim() || null,
        lead_name: r.lead_name?.trim() || null
      });
    }
  }
  console.log(`📋 Loaded ${admByPhone.size} phones from agent_dial_metrics`);

  // 2. Get taalk_call_analytics (twilio/csv) - backfill lead_phone from twilio when null, then update producer
  const { data: catRows } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, taalk_call_id, to_number, agent_email, agent_name, associate_id, lead_name')
    .or('billing_transaction_id.ilike.twilio%,billing_transaction_id.ilike.csv%')
    .gte('call_date', weekAgo)
    .limit(2000);

  const tclBySid = new Map<string, { to_number: string }>();
  const sidsNeeded = [...new Set((catRows || []).map((r: any) => r.taalk_call_id).filter(Boolean))];
  if (sidsNeeded.length > 0) {
    const { data: tcl } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, to_number, parent_call_sid')
      .in('twilio_call_sid', sidsNeeded.slice(0, 500));
    (tcl || []).forEach((r: any) => tclBySid.set(r.twilio_call_sid, { to_number: r.to_number || '' }));
    const parentSids = [...new Set((tcl || []).map((r: any) => r.parent_call_sid).filter(Boolean))];
    if (parentSids.length > 0) {
      const { data: parents } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, to_number')
        .in('twilio_call_sid', parentSids);
      (parents || []).forEach((p: any) => {
        if (!tclBySid.has(p.twilio_call_sid)) tclBySid.set(p.twilio_call_sid, { to_number: p.to_number || '' });
      });
    }
    const childRows = (tcl || []).filter((r: any) => r.parent_call_sid && sidsNeeded.includes(r.parent_call_sid));
    childRows.forEach((r: any) => {
      const pSid = r.parent_call_sid;
      if (pSid && !tclBySid.get(pSid)?.to_number && r.to_number) {
        tclBySid.set(pSid, { to_number: r.to_number });
      }
    });
  }

  const rowsToProcess = (catRows || []) as any[];

  const custByEmail = new Map<string, { name: string; associate_id: number | null }>();
  const emails = [...new Set([...admByPhone.values()].map((v) => v.agent_email))];
  const { data: cust } = await supabaseAdmin
    .from('customers')
    .select('company_email, first_name, last_name, associate_id')
    .in('company_email', emails.slice(0, 200));
  (cust || []).forEach((c: any) => {
    const e = (c.company_email || '').toLowerCase();
    if (e) custByEmail.set(e, { name: `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim() || '', associate_id: c.associate_id ?? null });
  });
  const { data: pl } = await supabaseAdmin
    .from('producerlist')
    .select('company_email, first_name, last_name, associate_id')
    .in('company_email', emails.slice(0, 200));
  (pl || []).forEach((p: any) => {
    const e = (p.company_email || '').toLowerCase();
    if (e && !custByEmail.has(e)) custByEmail.set(e, { name: `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() || '', associate_id: p.associate_id ?? null });
  });

  const BATCH = 100;
  let taalkUpdated = 0;

  for (let i = 0; i < rowsToProcess.length; i += BATCH) {
    const batch = rowsToProcess.slice(i, i + BATCH);
    const res = await Promise.all(batch.map(async (row) => {
      let phoneNorm = normalizePhone(row.to_number ?? row.lead_phone);
      if (!phoneNorm && row.taalk_call_id) {
        const tcl = tclBySid.get(row.taalk_call_id);
        phoneNorm = normalizePhone(tcl?.to_number);
      }
      if (!phoneNorm) return 0;
      const adm = admByPhone.get(phoneNorm);
      if (!adm) return 0;
      const custRow = custByEmail.get(adm.agent_email);
      const agentName = adm.agent_name ?? custRow?.name ?? null;
      const associateId = custRow?.associate_id ?? null;
      const updatePayload: Record<string, unknown> = {
        agent_email: adm.agent_email,
        agent_name: agentName,
        associate_id: associateId,
        lead_name: adm.lead_name
      };
      if ((!row.to_number && !row.lead_phone) && row.taalk_call_id) {
        const tcl = tclBySid.get(row.taalk_call_id);
        if (tcl?.to_number) updatePayload.to_number = tcl.to_number;
      }
      const { error: u1 } = await supabaseAdmin
        .from('taalk_call_analytics')
        .update(updatePayload)
        .eq('id', row.id);
      return !u1 ? 1 : 0;
    }));
    taalkUpdated += res.reduce((a, r) => a + r, 0);
  }

  console.log(`✅ Updated taalk_call_analytics: ${taalkUpdated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
