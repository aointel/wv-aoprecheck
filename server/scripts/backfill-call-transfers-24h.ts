/**
 * DEPRECATED: Call analytics now uses taalk_call_analytics only.
 * This script used to backfill call_analytics_transfers; that table is no longer used.
 * Run: npx tsx server/scripts/backfill-call-transfers-24h.ts (no-op, exits with message)
 */

import { supabaseAdmin } from '../supabase';

const HOURS_BACK = 24;

const BAD_PRODUCER_EMAILS = ['unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown', 'cnsysop@aoglobelife.com'];
const FALLBACK_PRODUCER = 'chrislafond@aoglobelife.com';

function isSupabaseRecordingUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return u.includes('supabase') && !u.includes('/api/');
}

function isBadProducer(cn: string): boolean {
  return BAD_PRODUCER_EMAILS.includes(cn.toLowerCase().trim());
}

async function main() {
  console.log('⚠️ Call analytics now uses taalk_call_analytics only. call_analytics_transfers is no longer used. This script is a no-op.');
  process.exit(0);
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    process.exit(1);
  }

  const dateLimit = new Date(Date.now() - HOURS_BACK * 60 * 60 * 1000);
  console.log(`📊 Backfilling call_analytics_transfers (last ${HOURS_BACK} hours, since ${dateLimit.toISOString()})...`);

  const { data: rows, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, taalk_call_id, to_number as a_to_number, call_date, agent_email, associate_id, call_duration, recording_url, transcript, call_score, analysis_status, analyzed_at, sentiment_label, call_outcome, outcome, ai_analysis, scorecard_results, coaching_notes, key_topics, objections_detected, sentiment_score, agent_talk_time_pct, client_engagement_level, call_outcome_confidence, compliance_flags, key_moments')
    .or('billing_transaction_id.ilike.twilio%,billing_transaction_id.ilike.csv%')
    .gte('call_date', dateLimit.toISOString())
    .order('call_date', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('❌ Fetch error:', error);
    process.exit(1);
  }
  if (!rows?.length) {
    console.log('✅ No rows to backfill');
    process.exit(0);
  }

  const sids = [...new Set((rows as any[]).map((r) => r.taalk_call_id).filter(Boolean))];
  const { data: tclRows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, to_number, recording_url, parent_call_sid')
    .in('twilio_call_sid', sids);

  const parentSids = [...new Set((tclRows || []).map((r: any) => r.parent_call_sid).filter(Boolean))];
  let parentMap: Map<string, { to_number: string | null; recording_url: string | null }> = new Map();
  if (parentSids.length > 0) {
    const { data: parents } = await supabaseAdmin.from('twilio_call_logs').select('twilio_call_sid, to_number, recording_url').in('twilio_call_sid', parentSids);
    (parents || []).forEach((p: any) => parentMap.set(p.twilio_call_sid, { to_number: p.to_number || null, recording_url: p.recording_url || null }));
  }

  const tclBySid = new Map<string, any>();
  (tclRows || []).forEach((r: any) => tclBySid.set(r.twilio_call_sid, r));

  const phones = [...new Set(
    (rows as any[]).flatMap((r) => {
      const sid = r.taalk_call_id;
      let toNum: string | null = null;
      if (sid) {
        const t = tclBySid.get(sid);
        toNum = t?.to_number ?? null;
        if (!toNum && t?.parent_call_sid) toNum = parentMap.get(t.parent_call_sid)?.to_number ?? null;
        if (!toNum && t?.parent_call_sid) toNum = (tclRows || []).find((c: any) => c.parent_call_sid === sid)?.to_number ?? null;
      }
      if (!toNum) toNum = (r as any).a_to_number ?? null;
      const digits = String(toNum || '').replace(/\D/g, '');
      return digits.length >= 10 ? [digits.slice(-10)] : [];
    })
  )].slice(0, 500);

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
        const { data: mlRows } = await supabaseAdmin.rpc('get_masterlead_cn_email_by_phones', { phone_arr: unresolvedPhones.slice(0, 500) });
        (mlRows || []).forEach((row: any) => {
          const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
          if (norm.length < 10) return;
          const email = String(row?.cn_email || '').toLowerCase().trim();
          if (!email || !email.includes('@') || isBadProducer(email)) return;
          if (!mlByPhone.has(norm)) mlByPhone.set(norm, { agent_email: email, agent_name: null, lead_name: row?.lead_name?.trim() || null, market: row?.taalk_market?.trim() || null });
        });
      } catch {
        // RPC may not exist
      }
    }
  }

  const producerEmails = [...new Set([...admByPhone.values(), ...mlByPhone.values()].map((v) => v.agent_email).filter(Boolean), FALLBACK_PRODUCER)];
  const custByEmail = new Map<string, { name: string; associate_id: number | null }>();
  if (producerEmails.length > 0) {
    const { data: cust } = await supabaseAdmin.from('customers').select('company_email, first_name, last_name, associate_id').in('company_email', producerEmails.slice(0, 200));
    (cust || []).forEach((c: any) => {
      const e = (c.company_email || '').toLowerCase();
      if (e) custByEmail.set(e, { name: `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim() || '', associate_id: c.associate_id ?? null });
    });
    const { data: pl } = await supabaseAdmin.from('producerlist').select('company_email, first_name, last_name, associate_id').in('company_email', producerEmails.slice(0, 200));
    (pl || []).forEach((p: any) => {
      const e = (p.company_email || '').toLowerCase();
      if (!e) return;
      const plRow = { name: `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() || '', associate_id: p.associate_id ?? null };
      if (custByEmail.has(e)) {
        const c = custByEmail.get(e)!;
        if (c.associate_id == null && plRow.associate_id != null) custByEmail.set(e, { ...c, associate_id: plRow.associate_id });
      } else {
        custByEmail.set(e, plRow);
      }
    });
  }

  const seen = new Set<string>();
  const toUpsert: any[] = [];
  for (const r of rows as any[]) {
    const tid = r.billing_transaction_id || '';
    const taalkId = r.taalk_call_id;
    if (seen.has(taalkId || tid)) continue;
    seen.add(taalkId || tid);

    const t = taalkId ? tclBySid.get(taalkId) : null;
    let toNumber = t?.to_number ?? null;
    let tRecUrl = t?.recording_url ?? null;
    let pRecUrl: string | null = null;
    if (t?.parent_call_sid) {
      const pm = parentMap.get(t.parent_call_sid);
      if (pm) {
        toNumber = toNumber || pm.to_number;
        pRecUrl = pm.recording_url;
      }
    }
    if (!toNumber && t?.parent_call_sid) {
      const ch = (tclRows || []).find((c: any) => c.parent_call_sid === taalkId);
      toNumber = ch?.to_number ?? null;
    }
    if (!toNumber) toNumber = (r as any).a_to_number ?? null;

    let recordingUrl: string | null = null;
    if (isSupabaseRecordingUrl(tRecUrl)) recordingUrl = tRecUrl;
    else if (isSupabaseRecordingUrl(pRecUrl)) recordingUrl = pRecUrl;
    else if (isSupabaseRecordingUrl(r.recording_url)) recordingUrl = r.recording_url;

    const digits = String(toNumber || '').replace(/\D/g, '');
    const phoneNorm = digits.length >= 10 ? digits.slice(-10) : digits;
    const adm = phoneNorm ? admByPhone.get(phoneNorm) : null;
    const ml = !adm && phoneNorm ? mlByPhone.get(phoneNorm) : null;

    const producerEmail = adm?.agent_email ?? ml?.agent_email ?? (r.agent_email && !isBadProducer(r.agent_email) ? r.agent_email : null) ?? FALLBACK_PRODUCER;
    const cust = custByEmail.get(producerEmail.toLowerCase());
    const agentName = adm?.agent_name ?? ml?.agent_name ?? cust?.name ?? null;
    // When using FALLBACK_PRODUCER (unknown agent), use null for associate_id - do NOT use 409
    const associateId = producerEmail.toLowerCase() === FALLBACK_PRODUCER
      ? null
      : (cust?.associate_id ?? r.associate_id ?? null);

    toUpsert.push({
      transaction_id: tid,
      taalk_call_id: taalkId,
      transaction_date: r.call_date || new Date().toISOString(),
      agent_email: producerEmail,
      associate_id: associateId,
      agent_name: agentName,
      lead_name: adm?.lead_name ?? ml?.lead_name ?? null,
      lead_phone: toNumber,
      market: ml?.market ?? null,
      recording_url: recordingUrl,
      transcript: r.transcript ?? null,
      call_duration: r.call_duration ?? null,
      call_score: r.call_score ?? null,
      analysis_status: r.analysis_status || 'pending',
      analyzed_at: r.analyzed_at ?? null,
      sentiment_label: r.sentiment_label ?? null,
      call_outcome: r.call_outcome ?? null,
      outcome: r.outcome ?? null,
      ai_analysis: r.ai_analysis ?? null,
      scorecard_results: r.scorecard_results ?? null,
      coaching_notes: r.coaching_notes ?? null,
      key_topics: r.key_topics ?? null,
      objections_detected: r.objections_detected ?? null,
      sentiment_score: r.sentiment_score ?? null,
      agent_talk_time_pct: r.agent_talk_time_pct ?? null,
      client_engagement_level: r.client_engagement_level ?? null,
      call_outcome_confidence: r.call_outcome_confidence ?? null,
      compliance_flags: r.compliance_flags ?? null,
      key_moments: r.key_moments ?? null,
      has_analysis: r.analysis_status === 'completed',
      type_label: tid.startsWith('twilio-') ? 'CCPRO' : null,
      updated_at: new Date().toISOString()
    });
  }

  let inserted = 0;
  let updated = 0;
  for (const row of toUpsert) {
    const { data: existing } = await supabaseAdmin
      .from('call_analytics_transfers')
      .select('id')
      .eq('transaction_id', row.transaction_id)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabaseAdmin
        .from('call_analytics_transfers')
        .update(row)
        .eq('transaction_id', row.transaction_id);
      if (!updErr) updated++;
    } else {
      const { error: insErr } = await supabaseAdmin
        .from('call_analytics_transfers')
        .insert(row);
      if (!insErr) inserted++;
    }
  }

  console.log(`✅ Backfilled ${inserted} inserted, ${updated} updated (${toUpsert.length} total) into call_analytics_transfers (last 24 hours)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
