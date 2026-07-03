/**
 * Check Twilio: recent TaskRouter tasks and recent calls (to see 5032018470 / 609).
 * Run: npx tsx server/scripts/check-recent-taskrouter-and-calls.ts
 */
import {
  isTaskRouterConfigured,
  fetchWorkspace,
} from '../taskrouter-service.js';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log('--- Recent Twilio calls (last 15) ---');
  const calls = await client.calls.list({ limit: 15 });
  for (const c of calls) {
    const from = (c as any).from;
    const to = (c as any).to;
    const sid = (c as any).sid;
    const status = (c as any).status;
    const dateCreated = (c as any).dateCreated ?? (c as any).date_created;
    const toLast10 = String(to ?? '').replace(/\D/g, '').slice(-10);
    const fromLast10 = String(from ?? '').replace(/\D/g, '').slice(-10);
    const is609 = toLast10 === '6096048379';
    const is503 = fromLast10 === '5032018470';
    const mark = is609 || is503 ? ' <<<' : '';
    console.log(sid, '|', from, '->', to, '|', status, '|', dateCreated, mark);
  }

  if (!isTaskRouterConfigured()) {
    console.log('\nTaskRouter not configured, skipping tasks.');
    return;
  }
  const { sid: ws } = await fetchWorkspace();
  console.log('\n--- Recent TaskRouter tasks (last 10) ---');
  const tasks = await client.taskrouter.v1.workspaces(ws).tasks.list({ limit: 10 });
  for (const t of tasks) {
    const sid = (t as any).sid;
    const status = (t as any).assignmentStatus ?? (t as any).assignment_status;
    const attrs = (t as any).attributes ?? '{}';
    const dateCreated = (t as any).dateCreated ?? (t as any).date_created;
    let phone = '';
    try {
      const a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
      phone = a.phone_number || a.phone || '';
    } catch (_) {}
    console.log(sid, '|', status, '|', dateCreated, '| phone:', phone);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
