/**
 * Clear all TaskRouter queue state and pending DB rows so nothing stale is kicking around.
 * 1. Deletes all rows from taskrouter_pending and taskrouter_injected_pending (Supabase).
 * 2. Cancels all TaskRouter tasks that are pending or reserved (clears the actual queue).
 *
 * Run: npx tsx server/scripts/clear-taskrouter-queue.ts
 *      npx tsx server/scripts/clear-taskrouter-queue.ts --db-only   (only clear DB, don't cancel tasks)
 *      npx tsx server/scripts/clear-taskrouter-queue.ts --tasks-only (only cancel tasks, don't clear DB)
 *
 * Note: In-memory pendingReservations on a running server are not cleared; restart the server to reset those.
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { isTaskRouterConfigured, fetchWorkspace } from '../taskrouter-service.js';
import { supabaseAdmin } from '../supabase.js';

const DB_ONLY = process.argv.includes('--db-only');
const TASKS_ONLY = process.argv.includes('--tasks-only');

async function main() {
  console.log('\n=== Clear TaskRouter queue state ===\n');

  if (!DB_ONLY) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('Missing Twilio credentials (required unless --db-only)');
      process.exit(1);
    }
    if (!isTaskRouterConfigured()) {
      console.error('TaskRouter not configured (required unless --db-only)');
      process.exit(1);
    }
  }

  // 1) Clear Supabase pending tables (filter matches all rows: created_at >= epoch)
  if (!TASKS_ONLY && supabaseAdmin) {
    const { error: errPending } = await supabaseAdmin.from('taskrouter_pending').delete().gte('created_at', '1970-01-01T00:00:00Z');
    const { error: errInjected } = await supabaseAdmin.from('taskrouter_injected_pending').delete().gte('created_at', '1970-01-01T00:00:00Z');
    if (errPending) {
      console.warn('taskrouter_pending delete:', errPending.message);
    } else {
      console.log('✅ Cleared taskrouter_pending');
    }
    if (errInjected) {
      console.warn('taskrouter_injected_pending delete:', errInjected.message);
    } else {
      console.log('✅ Cleared taskrouter_injected_pending');
    }
  } else if (!TASKS_ONLY && !supabaseAdmin) {
    console.warn('Supabase not configured – skipped DB clear');
  }

  // 2) Cancel all pending/reserved tasks in TaskRouter (clears the queue)
  if (!DB_ONLY && isTaskRouterConfigured()) {
    const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
    const { sid: wsSid } = await fetchWorkspace();
    const workspace = client.taskrouter.v1.workspaces(wsSid);

    const pending = await workspace.tasks.list({
      assignmentStatus: ['pending', 'reserved'],
      limit: 100,
    });

    if (!pending || pending.length === 0) {
      console.log('✅ No pending/reserved tasks in TaskRouter');
    } else {
      for (const t of pending as any[]) {
        try {
          await workspace.tasks(t.sid).update({ assignmentStatus: 'canceled' });
          const attrs = t.attributes ?? '{}';
          let a: Record<string, unknown> = {};
          try {
            a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
          } catch (_) {}
          const callSid = a.call_sid ?? t.sid;
          console.log('✅ Canceled task', t.sid, '| call_sid:', callSid);
        } catch (e: any) {
          console.warn('Failed to cancel task', t.sid, e?.message ?? e);
        }
      }
    }
  }

  console.log('\n=== Done ===\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
