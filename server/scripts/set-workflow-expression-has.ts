/**
 * Update workflow target expression to use HAS instead of IN (array HAS value).
 * Some Twilio environments may evaluate IN differently; HAS is the array-contains operator.
 *
 * Run: npx tsx server/scripts/set-workflow-expression-has.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID } from '../hardcoded-config.js';

const TARGET_EXPRESSION_HAS =
  '(task.market == "Unknown" OR worker.markets HAS task.market) AND (task.state == "XX" OR worker.licensed_states HAS task.state)';

async function main() {
  const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
  const ws = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID!);
  const wf = await ws.workflows(TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID!).fetch();
  const configRaw = (wf as any).configuration ?? (wf as any).config;
  const config = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw || {};

  const tr = config.task_routing || config.taskRouting || {};
  const filters = tr.filters || [];
  let updated = false;
  for (const filter of filters) {
    if (Array.isArray(filter.targets)) {
      for (const target of filter.targets) {
        if (target.expression !== TARGET_EXPRESSION_HAS) {
          target.expression = TARGET_EXPRESSION_HAS;
          updated = true;
        }
      }
    }
  }

  if (!updated) {
    console.log('Expression already uses HAS. Current:', filters[0]?.targets?.[0]?.expression);
    return;
  }

  await ws.workflows(TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID!).update({
    configuration: JSON.stringify(config),
  });
  console.log('Updated workflow target expression to:');
  console.log(TARGET_EXPRESSION_HAS);
  console.log('');
  console.log('Run enqueue-test-task-globe-co.ts again to test.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
