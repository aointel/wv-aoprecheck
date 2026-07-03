/**
 * Reach Events Per Hour Per Agent
 * Scans agent_dial_metrics on Supabase and outputs how many reach events
 * occur per hour per agent. Uses ALL data in the table.
 *
 * Usage: npm run reach-events-per-hour
 *        npx tsx scripts/reach-events-per-hour-per-agent.ts
 *        npx tsx scripts/reach-events-per-hour-per-agent.ts --format=json
 */

import { supabaseAdmin } from '../server/supabase';

const supabase = supabaseAdmin;
if (!supabase) {
  console.error('❌ Supabase not configured.');
  process.exit(1);
}

interface ReachEvent {
  agent_email: string;
  event_timestamp: string;
  lead_phone: string;
}

interface HourlyBucket {
  agent_email: string;
  hour_key: string; // YYYY-MM-DD HH
  reach_count: number;
  unique_phones: number;
}

function toEasternHour(iso: string): string {
  const d = new Date(iso);
  const s = d.toLocaleString('sv-SE', { timeZone: 'America/New_York' }); // YYYY-MM-DD HH:mm:ss
  return s.slice(0, 13); // "YYYY-MM-DD HH"
}

async function fetchAllReachEvents(): Promise<ReachEvent[]> {
  const all: ReachEvent[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('agent_dial_metrics')
      .select('agent_email, event_timestamp, lead_phone')
      .eq('event_type', 'reach')
      .range(from, from + pageSize - 1)
      .order('event_timestamp', { ascending: true });

    if (error) {
      console.error('❌ Error fetching agent_dial_metrics:', error);
      throw error;
    }

    if (!data || data.length === 0) break;

    all.push(...data.map((r: any) => ({
      agent_email: r.agent_email,
      event_timestamp: r.event_timestamp,
      lead_phone: r.lead_phone || ''
    })));

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function aggregateByHourAndAgent(events: ReachEvent[]): Map<string, { count: number; phones: Set<string> }> {
  const buckets = new Map<string, { count: number; phones: Set<string> }>();

  for (const e of events) {
    const hourKey = `${e.agent_email}|${toEasternHour(e.event_timestamp)}`;
    let b = buckets.get(hourKey);
    if (!b) {
      b = { count: 0, phones: new Set() };
      buckets.set(hourKey, b);
    }
    b.count++;
    if (e.lead_phone) b.phones.add(e.lead_phone);
  }

  return buckets;
}

async function main() {
  const formatJson = process.argv.includes('--format=json');

  if (!formatJson) {
    console.log('\n📊 REACH EVENTS PER HOUR PER AGENT\n');
    console.log('═'.repeat(70));
  }

  const events = await fetchAllReachEvents();

  if (!formatJson) {
    console.log(`Fetched ${events.length} reach events from agent_dial_metrics`);
  }

  if (events.length === 0) {
    if (!formatJson) console.log('No reach events found.');
    process.exit(0);
  }

  const buckets = aggregateByHourAndAgent(events);

  // Build hourly breakdown
  const hourly: HourlyBucket[] = [];
  for (const [key, val] of buckets) {
    const [agent_email, hour_key] = key.split('|');
    hourly.push({
      agent_email,
      hour_key,
      reach_count: val.count,
      unique_phones: val.phones.size
    });
  }

  hourly.sort((a, b) => {
    if (a.agent_email !== b.agent_email) return a.agent_email.localeCompare(b.agent_email);
    return a.hour_key.localeCompare(b.hour_key);
  });

  // Agent summary (with std dev of reach per hour)
  const agentTotals = new Map<string, { total: number; hours: number; maxHour: number; counts: number[] }>();
  for (const h of hourly) {
    let a = agentTotals.get(h.agent_email);
    if (!a) a = { total: 0, hours: 0, maxHour: 0, counts: [] };
    a.total += h.reach_count;
    a.hours++;
    a.maxHour = Math.max(a.maxHour, h.reach_count);
    a.counts.push(h.reach_count);
    agentTotals.set(h.agent_email, a);
  }

  function stdDev(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
    const sqDiffs = arr.map((x) => (x - mean) ** 2);
    return Math.sqrt(sqDiffs.reduce((s, x) => s + x, 0) / (arr.length - 1));
  }

  const agentStdDevs: number[] = [];
  const typicalAgentStdDevs: number[] = []; // Exclude spikers (max > 8 per hour = cheaters)
  for (const a of agentTotals.values()) {
    const sd = stdDev(a.counts);
    if (!isNaN(sd) && a.hours >= 2) {
      agentStdDevs.push(sd);
      if (a.maxHour <= 8) typicalAgentStdDevs.push(sd); // Typical agents only - exclude obvious spikers
    }
  }
  agentStdDevs.sort((a, b) => a - b);
  typicalAgentStdDevs.sort((a, b) => a - b);
  const medianStdDev = agentStdDevs.length ? agentStdDevs[Math.floor(agentStdDevs.length / 2)] : 0;
  const meanStdDev = agentStdDevs.length ? agentStdDevs.reduce((s, x) => s + x, 0) / agentStdDevs.length : 0;
  const typicalMedianStdDev = typicalAgentStdDevs.length ? typicalAgentStdDevs[Math.floor(typicalAgentStdDevs.length / 2)] : 0;
  const typicalMeanStdDev = typicalAgentStdDevs.length ? typicalAgentStdDevs.reduce((s, x) => s + x, 0) / typicalAgentStdDevs.length : 0;

  if (formatJson) {
    console.log(JSON.stringify({
      total_reach_events: events.length,
      typical_agent_std_dev: { median: typicalMedianStdDev, mean: typicalMeanStdDev, n_typical: typicalAgentStdDevs.length, excludes_max_over_8_per_hour: true },
      hourly: hourly,
      summary: Array.from(agentTotals.entries()).map(([agent, s]) => ({
        agent_email: agent,
        total_reach: s.total,
        hours_with_activity: s.hours,
        avg_per_hour_when_active: Math.round((s.total / s.hours) * 100) / 100,
        std_dev_per_hour: Math.round(stdDev(s.counts) * 100) / 100,
        max_in_single_hour: s.maxHour
      }))
    }, null, 2));
    return;
  }

  if (!formatJson) {
    console.log(`\n📐 Std dev of reach per hour when active:`);
    console.log(`   All agents: median=${medianStdDev.toFixed(2)}, mean=${meanStdDev.toFixed(2)} (n=${agentStdDevs.length})`);
    console.log(`   Typical only (max ≤8/hr, excludes spikers): median=${typicalMedianStdDev.toFixed(2)}, mean=${typicalMeanStdDev.toFixed(2)} (n=${typicalAgentStdDevs.length})\n`);
  }

  // Human-readable output
  console.log('AGENT SUMMARY (all time)\n');
  console.log('Agent Email                    | Total Reach | Hours Active | Avg/Hour | Peak Hour');
  console.log('-'.repeat(90));

  const sortedAgents = Array.from(agentTotals.entries())
    .sort((a, b) => b[1].total - a[1].total);

  for (const [agent, s] of sortedAgents) {
    const avg = (s.total / s.hours).toFixed(2);
    console.log(
      `${agent.padEnd(30)} | ${String(s.total).padStart(11)} | ${String(s.hours).padStart(12)} | ${String(avg).padStart(7)} | ${String(s.maxHour).padStart(10)}`
    );
  }

  console.log('\n' + '═'.repeat(70));
  console.log('HOURLY BREAKDOWN (first 50 rows)\n');

  for (const h of hourly.slice(0, 50)) {
    console.log(`  ${h.agent_email} | ${h.hour_key} | reach: ${h.reach_count} | unique phones: ${h.unique_phones}`);
  }

  if (hourly.length > 50) {
    console.log(`\n  ... and ${hourly.length - 50} more hourly buckets. Use --format=json for full output.`);
  }

  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
