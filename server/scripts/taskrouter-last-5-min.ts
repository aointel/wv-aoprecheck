/**
 * List TaskRouter tasks created in the last 5 minutes (inbound 609 flow).
 * Run: npx tsx server/scripts/taskrouter-last-5-min.ts
 */
import { isTaskRouterConfigured, listRecentTasks } from '../taskrouter-service.js';

const MS_5_MIN = 5 * 60 * 1000;

function parseAttrs(attrs: string): Record<string, unknown> {
  try {
    return typeof attrs === 'string' ? JSON.parse(attrs) : (attrs as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured (workspace/workflow SIDs).');
    process.exit(1);
  }

  const cutoff = Date.now() - MS_5_MIN;
  const tasks = await listRecentTasks({ limit: 100 });
  const recent = tasks.filter((t) => {
    const created = t.dateCreated ? new Date(t.dateCreated).getTime() : 0;
    return created >= cutoff;
  });

  console.log(`\nTaskRouter — tasks in last 5 min: ${recent.length} (total listed: ${tasks.length})\n`);
  if (recent.length === 0) {
    console.log('No tasks created in the last 5 minutes.');
    process.exit(0);
  }

  for (const t of recent) {
    const attrs = parseAttrs(t.attributes);
    const created = t.dateCreated ? new Date(t.dateCreated).toISOString() : '—';
    console.log('---');
    console.log('Task SID:    ', t.sid);
    console.log('Status:      ', t.status);
    console.log('Created:     ', created);
    console.log('call_sid:    ', attrs.call_sid ?? '—');
    console.log('phone_number:', attrs.phone_number ?? '—');
    console.log('market:      ', attrs.market ?? '—');
    console.log('state:       ', attrs.state ?? '—');
    console.log('connection_type:', attrs.connection_type ?? '—');
    console.log('charge:      ', attrs.charge ?? '—');
    console.log('routing_target:', attrs.routing_target ?? '—');
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
