/**
 * Transfer Rates Per 15 Minutes Per Agent
 * Analyzes agent_dial_metrics for dispositions that trigger lead transfer (unassign).
 * Uses ALL data to determine typical transfer rates and identify outliers.
 *
 * Usage: npm run transfer-rates-per-15min
 *        npx tsx scripts/transfer-rates-per-15min.ts
 *        npx tsx scripts/transfer-rates-per-15min.ts --format=json
 *
 * See docs/TRANSFER_THROTTLE_STANDARD.md for definitions.
 */

import { supabaseAdmin } from '../server/supabase';

const supabase = supabaseAdmin;
if (!supabase) {
  console.error('❌ Supabase not configured.');
  process.exit(1);
}

interface TransferEvent {
  agent_email: string;
  event_timestamp: string;
  disposition: string | null;
}

function to15MinBucket(iso: string): string {
  const d = new Date(iso);
  const s = d.toLocaleString('sv-SE', { timeZone: 'America/New_York' });
  const [datePart, timePart] = s.split(' ');
  const [h, m] = timePart.split(':').map(Number);
  const bucketMin = Math.floor(m / 15) * 15;
  const bucketHour = bucketMin === 60 ? h + 1 : h;
  const bucketMinStr = bucketMin === 60 ? '00' : String(bucketMin).padStart(2, '0');
  return `${datePart} ${String(bucketHour).padStart(2, '0')}:${bucketMinStr}`;
}

async function fetchAllTransferEvents(): Promise<TransferEvent[]> {
  const all: TransferEvent[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('agent_dial_metrics')
      .select('agent_email, event_timestamp, disposition')
      .not('disposition', 'is', null)
      .not('disposition', 'in', '(sale,already_been_sold,already_been_seen,"already been seen")')
      .range(from, from + pageSize - 1)
      .order('event_timestamp', { ascending: true });

    if (error) {
      console.error('❌ Error fetching agent_dial_metrics:', error);
      throw error;
    }

    if (!data || data.length === 0) break;

    const transferOnly = data.map((r: any) => ({
        agent_email: r.agent_email,
        event_timestamp: r.event_timestamp,
        disposition: r.disposition,
      }));

    all.push(...transferOnly);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function main() {
  const formatJson = process.argv.includes('--format=json');

  if (!formatJson) {
    console.log('\n📊 TRANSFER RATES PER 15 MIN PER AGENT\n');
    console.log('Transfer = disposition that unassigns lead (excl. sale, already_been_sold, already_been_seen)');
    console.log('═'.repeat(70));
  }

  const events = await fetchAllTransferEvents();

  if (!formatJson) {
    console.log(`Fetched ${events.length} transfer events from agent_dial_metrics\n`);
  }

  if (events.length === 0) {
    if (!formatJson) console.log('No transfer events found.');
    process.exit(0);
  }

  // Group by agent + 15-min bucket
  const buckets = new Map<string, number>();
  for (const e of events) {
    const key = `${e.agent_email}|${to15MinBucket(e.event_timestamp)}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  // Per-agent summary
  const agentStats = new Map<string, { total: number; buckets: number; maxIn15: number; p95: number }>();
  const perAgentBuckets = new Map<string, number[]>();

  for (const [key, count] of buckets) {
    const [agent] = key.split('|');
    let stats = agentStats.get(agent);
    if (!stats) {
      stats = { total: 0, buckets: 0, maxIn15: 0, p95: 0 };
      agentStats.set(agent, stats);
      perAgentBuckets.set(agent, []);
    }
    stats.total += count;
    stats.buckets++;
    stats.maxIn15 = Math.max(stats.maxIn15, count);
    perAgentBuckets.get(agent)!.push(count);
  }

  // Compute p95 per agent
  for (const [agent, counts] of perAgentBuckets) {
    const sorted = [...counts].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Idx] ?? sorted[sorted.length - 1] ?? 0;
    agentStats.get(agent)!.p95 = p95;
  }

  const sortedAgents = Array.from(agentStats.entries()).sort((a, b) => b[1].maxIn15 - a[1].maxIn15);

  if (formatJson) {
    console.log(
      JSON.stringify(
        {
          total_transfer_events: events.length,
          agents: sortedAgents.map(([agent, s]) => ({
            agent_email: agent,
            total_transfers: s.total,
            buckets_15min: s.buckets,
            max_per_15min: s.maxIn15,
            p95_per_15min: s.p95,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  // Human-readable
  console.log('AGENT SUMMARY (transfers per 15-min bucket)\n');
  console.log('Agent Email                    | Total | Buckets | Max/15min | P95/15min');
  console.log('-'.repeat(85));

  for (const [agent, s] of sortedAgents.slice(0, 60)) {
    console.log(
      `${agent.padEnd(30)} | ${String(s.total).padStart(5)} | ${String(s.buckets).padStart(7)} | ${String(s.maxIn15).padStart(9)} | ${String(s.p95).padStart(9)}`
    );
  }

  const globalMax = Math.max(...Array.from(agentStats.values()).map((s) => s.maxIn15));
  const globalP95s = Array.from(agentStats.values()).map((s) => s.p95);
  const globalP95 = globalP95s.length
    ? globalP95s.sort((a, b) => b - a)[Math.floor(globalP95s.length * 0.05)] ?? 0
    : 0;

  console.log('\n' + '═'.repeat(70));
  console.log('RECOMMENDED THRESHOLD (for TRANSFER_THROTTLE_MAX_PER_15_MIN):');
  console.log(`  Global max per 15 min: ${globalMax}`);
  console.log(`  Suggested limit: ${Math.max(10, Math.ceil(globalP95 * 1.5))} (P95 * 1.5, min 10)`);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
