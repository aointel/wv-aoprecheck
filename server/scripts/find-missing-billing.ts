/**
 * Finds all non-aorecruit vdp_calls END events that are missing billing_transactions.
 * Outputs a list so we can retroactively bill.
 *
 * Usage: npx ts-node scripts/find-missing-billing.ts
 */

import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🔍 Fetching all non-aorecruit END events from vdp_calls...\n');

  // Step 1: Fetch all END events from vdp_calls, excluding aorecruit
  let allCalls: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('vdp_calls')
      .select('id, agent, company_email, firstName, lastName, phone, time, updated_at, market, event, sessionID')
      .or('event.eq.END,event.eq.end')
      .not('market', 'ilike', '%aorecruit%')
      .order('updated_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching vdp_calls:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    allCalls = allCalls.concat(data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`📊 Total non-aorecruit END events: ${allCalls.length}`);

  // Step 2: Get all existing billing transaction source_ids from vdp_calls (paginate)
  const billedIds = new Set<number>();
  let billingOffset = 0;
  while (true) {
    const { data: billingBatch, error: billingError } = await supabase
      .from('billing_transactions')
      .select('source_id')
      .eq('source_table', 'vdp_calls')
      .not('source_id', 'is', null)
      .range(billingOffset, billingOffset + 999);

    if (billingError) {
      console.error('❌ Error fetching billing_transactions:', billingError.message);
      process.exit(1);
    }
    if (!billingBatch || billingBatch.length === 0) break;
    for (const r of billingBatch) {
      if (typeof r.source_id === 'number') billedIds.add(r.source_id);
    }
    if (billingBatch.length < 1000) break;
    billingOffset += 1000;
  }

  console.log(`💳 Already billed vdp_call IDs: ${billedIds.size}`);

  // Step 3: Find unbilled calls
  const unbilled = allCalls.filter(c => typeof c.id === 'number' && !billedIds.has(c.id));

  console.log(`\n🚨 UNBILLED non-aorecruit END calls: ${unbilled.length}\n`);

  if (unbilled.length === 0) {
    console.log('✅ All calls are billed — nothing missing!');
    return;
  }

  // Group by agent
  const byAgent = new Map<string, typeof unbilled>();
  for (const call of unbilled) {
    const key = call.company_email || call.agent || 'unknown';
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key)!.push(call);
  }

  console.log('📋 Unbilled calls by agent:');
  console.log('='.repeat(80));

  // Sort by count descending
  const sorted = [...byAgent.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [agent, calls] of sorted) {
    console.log(`\n  Agent: ${agent}  (${calls.length} unbilled calls)`);
    for (const c of calls.slice(0, 5)) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
      const date = c.time || c.updated_at || 'unknown date';
      const market = c.market || 'unknown market';
      const session = c.sessionID || 'no session';
      console.log(`    - ID ${c.id} | ${name} | ${market} | ${date} | session: ${session}`);
    }
    if (calls.length > 5) console.log(`    ... and ${calls.length - 5} more`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`  Total unbilled END calls: ${unbilled.length}`);
  console.log(`  Affected agents: ${byAgent.size}`);

  // Show market breakdown
  const byMarket = new Map<string, number>();
  for (const c of unbilled) {
    const m = c.market || 'unknown';
    byMarket.set(m, (byMarket.get(m) || 0) + 1);
  }
  console.log(`\n  By market:`);
  for (const [market, count] of [...byMarket.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${market}: ${count}`);
  }

  // Show Globe Market Inbound specifically
  const globeMarket = unbilled.filter(c => c.market && c.market.toLowerCase().includes('globe'));
  if (globeMarket.length > 0) {
    console.log(`\n  🌐 Globe Market calls specifically: ${globeMarket.length}`);
  }

  console.log(`\n💡 To retroactively bill these, run: npx ts-node scripts/backfill-missing-billing.ts`);
}

main().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
