/**
 * Retroactively inserts billing_transactions for non-aorecruit vdp_calls END rows missing a row.
 * Does NOT deduct user_credits again (ledger-only backfill; credits may already have been charged).
 *
 * Usage (from repo root):
 *   npx tsx server/scripts/backfill-missing-billing.ts --dry-run
 *   npx tsx server/scripts/backfill-missing-billing.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabase.js';

const DRY_RUN = process.argv.includes('--dry-run');

type AgentInfo = { email: string; associateId: number | null; name: string };
const agentCache = new Map<string, AgentInfo>();

async function resolveAgent(
  db: SupabaseClient,
  email?: string | null,
  associateId?: string | number | null,
): Promise<AgentInfo> {
  const emailKey = (email || '').toLowerCase().trim();
  const idKey = associateId != null ? String(associateId).trim() : null;

  const cacheKey = emailKey || idKey || 'unknown';
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey)!;

  let resolvedEmail = emailKey || null;
  let resolvedId: number | null = null;
  let resolvedName: string | null = null;

  if (resolvedEmail && resolvedEmail.includes('@')) {
    const { data } = await db
      .from('customers')
      .select('associate_id, first_name, last_name, company_email, personal_email')
      .or(`company_email.eq.${resolvedEmail},personal_email.eq.${resolvedEmail}`)
      .maybeSingle();
    if (data) {
      resolvedId = data.associate_id ?? null;
      resolvedEmail = (data.company_email || data.personal_email || resolvedEmail)?.toLowerCase() || resolvedEmail;
      resolvedName = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
    }
  }

  if (!resolvedEmail && idKey && /^\d+$/.test(idKey)) {
    const { data } = await db
      .from('customers')
      .select('associate_id, first_name, last_name, company_email, personal_email')
      .eq('associate_id', idKey)
      .order('company_email', { ascending: false, nullsFirst: false })
      .limit(1);
    const row = data?.[0];
    if (row) {
      resolvedId = row.associate_id ?? null;
      resolvedEmail = (row.company_email || row.personal_email || null)?.toLowerCase() || null;
      resolvedName = [row.first_name, row.last_name].filter(Boolean).join(' ') || null;
    }
  }

  if (!resolvedEmail && idKey) resolvedEmail = `associate-${idKey}@pending-lookup.aogi`;
  if (!resolvedEmail) resolvedEmail = 'unknown@pending-lookup.aogi';
  if (!resolvedId && idKey && /^\d+$/.test(idKey)) resolvedId = Number(idKey);
  if (!resolvedName) resolvedName = resolvedEmail.split('@')[0];

  const info: AgentInfo = { email: resolvedEmail, associateId: resolvedId, name: resolvedName };
  agentCache.set(cacheKey, info);
  if (emailKey) agentCache.set(emailKey, info);
  if (idKey) agentCache.set(idKey, info);
  return info;
}

async function main() {
  const db = supabaseAdmin;
  if (!db) {
    console.error('❌ supabaseAdmin not configured (server/hardcoded-config or supabase.ts)');
    process.exit(1);
  }
  console.log(`🚀 Backfill missing billing transactions (${DRY_RUN ? 'DRY RUN' : 'LIVE'})\n`);

  // 1. Fetch all non-aorecruit END vdp_calls
  let allCalls: any[] = [];
  let offset = 0;
  process.stdout.write('📥 Loading vdp_calls...');
  while (true) {
    const { data, error } = await db
      .from('vdp_calls')
      .select('id, agent, company_email, firstName, lastName, phone, time, updated_at, market, event, sessionID')
      .or('event.eq.END,event.eq.end')
      .not('market', 'ilike', '%aorecruit%')
      .order('id', { ascending: true })
      .range(offset, offset + 999);
    if (error) { console.error('\n❌ vdp_calls fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allCalls = allCalls.concat(data);
    process.stdout.write(`\r📥 Loading vdp_calls... ${allCalls.length}`);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`\n📊 Total END calls (non-aorecruit): ${allCalls.length}`);

  // 2. Fetch all billed source_ids
  const billedIds = new Set<number>();
  let bOffset = 0;
  process.stdout.write('📥 Loading existing billing transactions...');
  while (true) {
    const { data, error } = await db
      .from('billing_transactions')
      .select('source_id')
      .eq('source_table', 'vdp_calls')
      .not('source_id', 'is', null)
      .range(bOffset, bOffset + 999);
    if (error) { console.error('\n❌ billing_transactions fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (typeof r.source_id === 'number') billedIds.add(r.source_id);
    }
    process.stdout.write(`\r📥 Loading existing billing transactions... ${billedIds.size}`);
    if (data.length < 1000) break;
    bOffset += 1000;
  }
  console.log(`\n💳 Already billed: ${billedIds.size}`);

  // 3. Find unbilled
  const unbilled = allCalls.filter(c => typeof c.id === 'number' && !billedIds.has(c.id));
  console.log(`🚨 Unbilled calls to process: ${unbilled.length}\n`);

  if (unbilled.length === 0) {
    console.log('✅ Nothing to do!');
    return;
  }

  // 4. Process
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const call of unbilled) {
    const agent = await resolveAgent(db, call.company_email, call.agent);

    const transactionId = `connect-${call.id}`;
    const transactionDate = call.time || call.updated_at || new Date().toISOString();
    const leadName = [call.firstName, call.lastName].filter(Boolean).join(' ') || null;

    if (DRY_RUN) {
      console.log(`[DRY] Would bill: ${agent.email} (${agent.associateId}) | ${leadName} | ${call.market} | ${transactionDate}`);
      processed++;
      continue;
    }

    const { error: insertError } = await db
      .from('billing_transactions')
      .insert({
        transaction_id: transactionId,
        transaction_type: 'connect',
        agent_email: agent.email,
        agent_associate_id: agent.associateId,
        agent_name: agent.name,
        transaction_date: transactionDate,
        amount_usd: 8.0,
        credits_charged: 8,
        lead_name: leadName,
        lead_phone: call.phone || null,
        source_table: 'vdp_calls',
        source_id: call.id,
        description: 'AO Connect charge (retroactive backfill)',
        metadata: {
          market: call.market ?? null,
          sessionID: call.sessionID ?? null,
          taalk_call_id: call.sessionID ?? null,
          backfill: true,
        },
      });

    if (insertError) {
      if (insertError.code === '23505') {
        skipped++;
      } else {
        console.error(`\n❌ Insert failed for call ${call.id}:`, insertError.message);
        errors++;
      }
    } else {
      processed++;
    }

    if ((processed + skipped + errors) % 100 === 0) {
      process.stdout.write(`\r✅ ${processed} billed, ${skipped} already exist, ${errors} errors`);
    }

    await new Promise(r => setTimeout(r, 30)); // gentle rate limit
  }

  console.log(`\n\n✅ Done!`);
  console.log(`   Billed: ${processed}`);
  console.log(`   Already existed: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply.');
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
