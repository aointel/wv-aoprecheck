/**
 * Point the TaskRouter workflow's Assignment Callback URL at baa2.
 * So when TaskRouter offers a task to a worker, it POSTs to baa2 (where we return dequeue).
 * Run: npx tsx server/scripts/set-workflow-assignment-callback-to-baa2.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID } from '../hardcoded-config.js';

const BAA2_ASSIGNMENT_URL = 'https://aoirail-production-baa2.up.railway.app/api/twilio/taskrouter/assignment';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_TASKROUTER_WORKSPACE_SID || !TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID) {
    console.error('Missing TaskRouter config (workspace + workflow SIDs and Twilio creds).');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const workspace = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID);
  const workflowSid = TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID;

  const before = await workspace.workflows(workflowSid).fetch();
  const currentUrl = (before as any).assignmentCallbackUrl ?? (before as any).assignment_callback_url ?? '';
  console.log('Current assignment callback:', currentUrl);

  await workspace.workflows(workflowSid).update({
    assignmentCallbackUrl: BAA2_ASSIGNMENT_URL,
  });

  const after = await workspace.workflows(workflowSid).fetch();
  const newUrl = (after as any).assignmentCallbackUrl ?? (after as any).assignment_callback_url ?? '';
  console.log('New assignment callback: ', newUrl);
  console.log('');
  console.log('Done. TaskRouter will now POST to baa2 when offering 609 tasks. Call 609 again to test.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
