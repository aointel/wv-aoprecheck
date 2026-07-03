/**
 * Confirm TaskRouter status (activity, markets, licensed_states) for five agents.
 * Run: npx tsx server/scripts/status-five-agents-taskrouter.ts
 */

const AGENTS = [
  'chrislafond@aoglobelife.com',
  'jessicaboll@aoglobelife.com',
  'jakobleblue@aoglobelife.com',
  'johnsalinas@aoglobelife.com',
  'lanebeasley@aoglobelife.com',
];

async function main() {
  const { isTaskRouterConfigured, listWorkers } = await import('../taskrouter-service.js');
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const workers = await listWorkers({ limit: 10000 });
  const want = new Set(AGENTS.map((e) => e.trim().toLowerCase()));

  type Row = { email: string; activity: string; available: boolean; markets: string; states: string; inTaskRouter: boolean };
  const rows: Row[] = AGENTS.map((email) => {
    const w = workers.find((x) => (x.friendlyName || '').trim().toLowerCase() === email.trim().toLowerCase());
    if (!w) {
      return { email, activity: '—', available: false, markets: '—', states: '—', inTaskRouter: false };
    }
    let attrs: { markets?: string[]; licensed_states?: string[] } = {};
    try {
      attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : (w.attributes || {});
    } catch (_) {}
    const markets = Array.isArray(attrs.markets) ? attrs.markets.join(', ') : (attrs.markets ?? '—');
    const states = Array.isArray(attrs.licensed_states) ? attrs.licensed_states.join(', ') : (attrs.licensed_states ?? '—');
    return {
      email,
      activity: w.activityName || '—',
      available: !!w.available,
      markets: markets || '—',
      states: states || '—',
      inTaskRouter: true,
    };
  });

  console.log('');
  console.log('TaskRouter status for 5 agents');
  console.log('─'.repeat(100));
  console.log(
    'Email'.padEnd(36) +
      'Activity'.padEnd(22) +
      'Available'.padEnd(12) +
      'Markets'.padEnd(24) +
      'Licensed states'
  );
  console.log('─'.repeat(100));
  for (const r of rows) {
    const avail = r.inTaskRouter ? (r.available ? 'Yes' : 'No') : '—';
    console.log(
      r.email.padEnd(36) +
        (r.activity || '—').padEnd(22) +
        avail.padEnd(12) +
        (r.markets || '—').padEnd(24) +
        (r.states || '—')
    );
  }
  console.log('─'.repeat(100));
  const found = rows.filter((r) => r.inTaskRouter).length;
  const withData = rows.filter((r) => r.inTaskRouter && (r.markets !== '—' || r.states !== '—')).length;
  console.log(`Found ${found}/${AGENTS.length} in TaskRouter. ${withData} have market/state set.`);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
