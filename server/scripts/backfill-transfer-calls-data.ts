/**
 * Backfill data so Transfer Calls show Producer, Client, Phone.
 * 1) Parent rows in twilio_call_logs get to_number from child (enables Client/Phone via masterlead).
 * 2) taalk_call_analytics rows with missing/unknown agent get agent_email from twilio_call_logs.owner_email.
 * 3) taalk_call_analytics rows get to_number, lead_name, market from twilio_call_logs + masterlead (by phone).
 *
 * Run from project root:
 *   npx tsx server/scripts/backfill-transfer-calls-data.ts
 *   npx tsx server/scripts/backfill-transfer-calls-data.ts --parentLimit=5000 --agentLimit=3000 --clientLimit=5000
 */

import { supabaseAdmin } from '../supabase';

const DEFAULT_PARENT_LIMIT = 5000;
const DEFAULT_AGENT_LIMIT = 2000;
const DEFAULT_CLIENT_LIMIT = 5000;
const BAD_AGENT = ['unknown', 'unknown@aoglobelife.com', 'system@aoglobelife.com', ''];
const MASTERLEAD_BATCH = 250;

function normPhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '').slice(-10);
  return digits.length >= 10 ? digits : null;
}

function parseArgs(): { parentLimit: number; agentLimit: number; clientLimit: number } {
  let parentLimit = DEFAULT_PARENT_LIMIT;
  let agentLimit = DEFAULT_AGENT_LIMIT;
  let clientLimit = DEFAULT_CLIENT_LIMIT;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--parentLimit=')) parentLimit = Math.min(10000, parseInt(arg.split('=')[1], 10) || parentLimit);
    if (arg.startsWith('--agentLimit=')) agentLimit = Math.min(5000, parseInt(arg.split('=')[1], 10) || agentLimit);
    if (arg.startsWith('--clientLimit=')) clientLimit = Math.min(20000, parseInt(arg.split('=')[1], 10) || clientLimit);
  }
  return { parentLimit, agentLimit, clientLimit };
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const { parentLimit, agentLimit, clientLimit } = parseArgs();
  console.log('🔧 Backfill Transfer Calls data (Producer, Client, Phone)\n');
  console.log(`   parentLimit=${parentLimit}, agentLimit=${agentLimit}, clientLimit=${clientLimit}\n`);

  let parentUpdated = 0;
  const { data: parentsRaw, error: fetchErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, to_number, from_number')
    .like('from_number', 'client:%')
    .order('call_started_at', { ascending: false })
    .limit(parentLimit * 2);

  if (fetchErr) {
    console.error('❌ Fetch parent rows:', fetchErr.message);
  } else if (parentsRaw?.length) {
    const parents = (parentsRaw as any[]).filter((r) => !r.to_number || String(r.to_number).trim() === '');
    console.log(`📋 Parent to_number: ${parents.length} parent rows with empty to_number`);
    for (const row of parents.slice(0, parentLimit)) {
      const { data: children } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('to_number')
        .eq('parent_call_sid', row.twilio_call_sid)
        .not('to_number', 'is', null)
        .limit(1);
      const childTo = (children as any)?.[0]?.to_number?.trim();
      if (!childTo) continue;
      const { error: upErr } = await supabaseAdmin
        .from('twilio_call_logs')
        .update({ to_number: childTo, updated_at: new Date().toISOString() })
        .eq('twilio_call_sid', row.twilio_call_sid);
      if (!upErr) {
        parentUpdated++;
        if (parentUpdated <= 10) console.log(`   ✅ ${row.twilio_call_sid} -> ${childTo}`);
      }
    }
    console.log(`✅ Parent to_number: updated ${parentUpdated} rows.\n`);
  } else {
    console.log('✅ Parent to_number: no parent rows with empty to_number.\n');
  }

  const { data: rows, error: rowsErr } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, taalk_call_id, agent_email')
    .or('agent_email.is.null,agent_email.eq.,agent_email.eq.unknown,agent_email.eq.unknown@aoglobelife.com,agent_email.eq.system@aoglobelife.com')
    .not('taalk_call_id', 'is', null)
    .limit(agentLimit);

  if (rowsErr) {
    console.error('❌ Fetch taalk_call_analytics:', rowsErr.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('✅ Agent email: no taalk_call_analytics rows needing agent backfill.\n');
  } else {
  const sids = (rows as any[]).map((r) => r.taalk_call_id).filter(Boolean);
  const { data: tclRows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, owner_email')
    .in('twilio_call_sid', sids)
    .not('owner_email', 'is', null);

  const emailBySid = new Map<string, string>();
  (tclRows || []).forEach((r: any) => {
    const e = (r.owner_email || '').trim().toLowerCase();
    if (e && e.includes('@') && !BAD_AGENT.includes(e)) emailBySid.set(r.twilio_call_sid, e);
  });

  let agentUpdated = 0;
  for (const row of rows as any[]) {
    const email = row.taalk_call_id ? emailBySid.get(row.taalk_call_id) : null;
    if (!email) continue;
    const { error } = await supabaseAdmin.from('taalk_call_analytics').update({ agent_email: email }).eq('id', row.id);
    if (!error) {
      agentUpdated++;
      if (agentUpdated <= 10) console.log(`   ✅ ${row.taalk_call_id} -> ${email}`);
    }
  }

  console.log(`✅ Agent email: updated ${agentUpdated} of ${rows.length} rows.\n`);
  }

  // 3) Client data: backfill taalk_call_analytics using twilio call info (to_number from twilio_call_logs self + child) + masterlead (lead_name, market by phone)
  // Fetch rows with taalk_call_id set; filter in code to those missing any of to_number, lead_name, market (all often missing)
  const { data: clientRowsRaw, error: clientRowsErr } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, taalk_call_id, to_number, lead_name, market')
    .not('taalk_call_id', 'is', null)
    .limit(clientLimit * 2);
  const allWithSid = clientRowsRaw || [];
  const clientRows = allWithSid.filter(
    (r: any) => !(r.to_number || '').trim() || !(r.lead_name || '').trim() || !(r.market || '').trim()
  ).slice(0, clientLimit);
  console.log(`📋 Client backfill: ${allWithSid.length} rows with taalk_call_id, ${clientRows.length} missing to_number/lead_name/market`);

  if (clientRowsErr) {
    console.error('❌ Fetch taalk_call_analytics for client backfill:', clientRowsErr.message);
  } else if (clientRows.length > 0) {
    const sids = [...new Set((clientRows as any[]).map((r: any) => r.taalk_call_id).filter(Boolean))];
    const { data: tclAll } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, to_number, parent_call_sid')
      .in('twilio_call_sid', sids);
    const { data: childRows } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('parent_call_sid, to_number')
      .in('parent_call_sid', sids)
      .not('to_number', 'is', null);

    const toBySid = new Map<string, string>();
    (tclAll || []).forEach((r: any) => {
      const to = (r.to_number || '').trim();
      if (to) toBySid.set(r.twilio_call_sid, to);
    });
    (childRows || []).forEach((r: any) => {
      const to = (r.to_number || '').trim();
      if (r.parent_call_sid && to) toBySid.set(r.parent_call_sid, to);
    });

    const idToPhone = new Map<number, string>();
    (clientRows as any[]).forEach((r: any) => {
      const phone = r.to_number?.trim() || (r.taalk_call_id ? toBySid.get(r.taalk_call_id) : null)?.trim();
      if (phone) idToPhone.set(r.id, phone);
    });

    const uniquePhones = [...new Set(idToPhone.values())].map((p) => normPhone(p)).filter(Boolean) as string[];
    const mlByNorm = new Map<string, { lead_name: string | null; market: string | null }>();
    for (let i = 0; i < uniquePhones.length; i += MASTERLEAD_BATCH) {
      const batch = uniquePhones.slice(i, i + MASTERLEAD_BATCH);
      try {
        const { data: mlRows } = await supabaseAdmin.rpc('get_masterlead_cn_email_by_phones', { phone_arr: batch });
        (mlRows || []).forEach((row: any) => {
          const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
          if (norm.length >= 10) mlByNorm.set(norm, { lead_name: row?.lead_name?.trim() || null, market: row?.taalk_market?.trim() || null });
        });
      } catch (e) {
        console.warn('⚠️ get_masterlead_cn_email_by_phones batch failed:', (e as Error)?.message);
      }
    }

    let clientUpdated = 0;
    for (const row of clientRows as any[]) {
      const phone = row.to_number?.trim() || (row.taalk_call_id ? toBySid.get(row.taalk_call_id) : null)?.trim();
      const norm = normPhone(phone);
      const ml = norm ? mlByNorm.get(norm) : null;
      const toNumber = phone || null;
      const leadName = (ml?.lead_name ?? row.lead_name?.trim()) || null;
      const market = (ml?.market ?? (row as any).market?.trim()) || null;
      if (!toNumber && !leadName && !market) continue;
      const payload: Record<string, unknown> = {};
      if (toNumber) payload.to_number = toNumber;
      if (leadName) payload.lead_name = leadName;
      if (market) payload.market = market;
      if (Object.keys(payload).length === 0) continue;
      const { error: upErr } = await supabaseAdmin.from('taalk_call_analytics').update(payload).eq('id', row.id);
      if (!upErr) {
        clientUpdated++;
        if (clientUpdated <= 10) console.log(`   ✅ id=${row.id} to_number=${toNumber || '-'} lead_name=${leadName || '-'}`);
      }
    }
    console.log(`✅ Client data (to_number, lead_name, market): updated ${clientUpdated} of ${clientRows.length} rows.`);
  } else {
    console.log(`✅ Client data: no rows to backfill (see count above).`);
  }

  console.log('\n✅ Backfill done. Refresh Transfer Calls to see Producer/Client/Phone where data existed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
