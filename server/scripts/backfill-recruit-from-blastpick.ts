/**
 * Backfill: Emulate the recruit VDP poller — create recruit_candidates from vdp_calls_BLASTPICK.
 *
 * Reads all aorecruit rows from vdp_calls_BLASTPICK and for each:
 * - Resolves agent email (producerlist, agent_hierarchy, agent_profiles, customers).
 * - If a candidate exists for that phone: optionally updates agent_email/agent_id and fetches AI summary if missing.
 * - If no candidate: inserts a new recruit_candidate (with optional Taalk AI summary).
 *
 * Run: npx tsx server/scripts/backfill-recruit-from-blastpick.ts [--limit N] [--no-summaries]
 */

import { supabaseAdmin } from '../supabase';

const taalkApiKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';

interface BlastPickRecord {
  id: number;
  market: string;
  agent: string;
  firstName: string;
  lastName: string;
  phone: string;
  event: string;
  time: string;
  sessionid: string;
  [key: string]: unknown;
}

/** Normalize raw row from Supabase (may return snake_case or camelCase). */
function normalizeBlastPickRecord(raw: Record<string, unknown>): BlastPickRecord {
  return {
    ...raw,
    id: Number((raw as any).id),
    market: String((raw as any).market ?? ''),
    agent: String((raw as any).agent ?? (raw as any).agent_associate_id ?? ''),
    firstName: String((raw as any).firstName ?? (raw as any).first_name ?? 'Unknown'),
    lastName: String((raw as any).lastName ?? (raw as any).last_name ?? ''),
    phone: String((raw as any).phone ?? ''),
    event: String((raw as any).event ?? ''),
    time: String((raw as any).time ?? (raw as any).created_at ?? new Date().toISOString()),
    sessionid: String((raw as any).sessionid ?? (raw as any).session_id ?? (raw as any).leadid ?? ''),
  } as BlastPickRecord;
}

async function getAgentEmailFromAssociateId(associateId: string): Promise<string | null> {
  if (!associateId) return null;
  try {
    if (associateId === '2233111') return 'taylorermis@aoglobelife.com';
    const associateIdInt = parseInt(associateId, 10);
    if (Number.isNaN(associateIdInt)) return null;

    const { data: producer } = await supabaseAdmin
      .from('producerlist')
      .select('company_email, associate_id')
      .eq('associate_id', associateIdInt)
      .maybeSingle();
    if (producer?.company_email) return producer.company_email;

    const { data: hierarchyRow } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email')
      .eq('agent_associate_id', associateIdInt)
      .limit(1)
      .maybeSingle();
    if (hierarchyRow?.agent_email) return hierarchyRow.agent_email;

    const { data: hierarchyByStr } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email')
      .eq('agent_associate_id', associateId)
      .limit(1)
      .maybeSingle();
    if (hierarchyByStr?.agent_email) return hierarchyByStr.agent_email;

    const { data: agentProfile } = await supabaseAdmin
      .from('agent_profiles')
      .select('email')
      .eq('agent_id', associateId)
      .maybeSingle();
    if (agentProfile?.email) return agentProfile.email;

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email')
      .eq('associate_id', associateIdInt)
      .maybeSingle();
    if (customer?.company_email) return customer.company_email;
    if (customer?.personal_email) return customer.personal_email;

    return null;
  } catch (err) {
    console.error(`  ❌ getAgentEmail(${associateId}):`, err);
    return null;
  }
}

async function fetchAISummary(sessionid: string): Promise<string | null> {
  if (!sessionid) return null;
  try {
    const url = `https://api.taalk.ai/api/calls/${sessionid}/summary?db=michaelmandella`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${taalkApiKey}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { payload?: { summary?: unknown }; summary?: unknown };
    const raw = json.payload?.summary ?? json.summary;
    if (raw == null) return null;
    if (Array.isArray(raw) && raw.length > 0) return JSON.stringify(raw);
    if (typeof raw === 'string' && raw.trim().length > 0) return raw;
    if (typeof raw === 'object' && Object.keys(raw as object).length > 0) return JSON.stringify(raw);
    return null;
  } catch {
    return null;
  }
}

async function processRecord(
  record: BlastPickRecord,
  fetchSummaries: boolean
): Promise<'created' | 'updated' | 'skipped'> {
  const agentEmail = await getAgentEmailFromAssociateId(record.agent);
  const finalAgentEmail = agentEmail || `unknown-agent-${record.agent}@aoglobelife.com`;
  const candidateName = `${record.firstName ?? ''} ${record.lastName ?? ''}`.trim() || 'Unknown Candidate';
  const phone = record.phone;

  const { data: existing } = await supabaseAdmin
    .from('recruit_candidates')
    .select('id, ai_summary, agent_email, agent_id')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const updates: { agent_email?: string; agent_id?: string; ai_summary?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (existing.agent_email !== finalAgentEmail || existing.agent_id !== record.agent) {
      updates.agent_email = finalAgentEmail;
      updates.agent_id = record.agent;
    }
    if (fetchSummaries && !existing.ai_summary && record.sessionid) {
      const summary = await fetchAISummary(record.sessionid);
      if (summary) updates.ai_summary = summary;
    }
    if (Object.keys(updates).length > 1) {
      await supabaseAdmin.from('recruit_candidates').update(updates).eq('id', existing.id);
      return 'updated';
    }
    return 'skipped';
  }

  let aiSummary: string | null = null;
  if (fetchSummaries && record.sessionid) aiSummary = await fetchAISummary(record.sessionid);

  const insertRow = {
    first_name: record.firstName || 'Unknown',
    last_name: record.lastName || 'Candidate',
    phone,
    email: '',
    status: 'contacted',
    agent_id: record.agent,
    agent_email: finalAgentEmail,
    ai_summary: aiSummary,
    notes: `Backfill from VDP BLAST PICK. Agent: ${finalAgentEmail} (ID: ${record.agent}), Market: ${record.market ?? 'Unknown'}, Session: ${record.sessionid}`,
    created_at: record.time || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('recruit_candidates').insert(insertRow);
  if (error) {
    console.error(`  ❌ Insert failed for ${phone}:`, error.message);
    return 'skipped';
  }
  return 'created';
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : 2000;
  const sinceIdx = args.indexOf('--since');
  const since = sinceIdx >= 0 && args[sinceIdx + 1] ? String(args[sinceIdx + 1]).trim() : '';
  const fetchSummaries = !args.includes('--no-summaries');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available. Check env (SUPABASE_URL, SUPABASE_SERVICE_KEY).');
    process.exit(1);
  }

  console.log('🎯 Backfill recruit_candidates from vdp_calls_BLASTPICK (aorecruit)...');
  console.log(`   Limit: ${limit}, Since: ${since || 'none'}, Fetch Taalk summaries: ${fetchSummaries}\n`);

  let query = supabaseAdmin
    .from('vdp_calls_BLASTPICK')
    .select('*')
    .ilike('market', '%aorecruit%')
    .eq('event', 'PICK_UP')
    .order('time', { ascending: false })
    .limit(limit);
  if (since) {
    query = query.gte('time', since);
  }
  const { data: rawRecords, error } = await query;

  if (error) {
    console.error('❌ Failed to fetch vdp_calls_BLASTPICK:', error.message);
    process.exit(1);
  }

  const records = (rawRecords || []).filter((r: any) => r?.phone);
  if (!records.length) {
    console.log('ℹ️ No aorecruit PICK_UP rows with phone in vdp_calls_BLASTPICK.');
    return;
  }

  console.log(`📞 Processing ${records.length} BLASTPICK PICK_UP record(s)...\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const record = normalizeBlastPickRecord(records[i] as Record<string, unknown>);
    const phone = record.phone || '(no phone)';
    const name = [record.firstName, record.lastName].filter(Boolean).join(' ') || 'Unknown';
    process.stdout.write(`  [${i + 1}/${records.length}] ${name} (${phone}) ... `);
    try {
      const result = await processRecord(record, fetchSummaries);
      if (result === 'created') {
        created++;
        console.log('created');
      } else if (result === 'updated') {
        updated++;
        console.log('updated');
      } else {
        skipped++;
        console.log('skipped');
      }
    } catch (err) {
      skipped++;
      console.log('error:', (err as Error).message);
    }
  }

  console.log('\n✅ Done.');
  console.log(`   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
