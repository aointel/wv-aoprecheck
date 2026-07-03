/**
 * Runs the inbound-owner backfill on a schedule (find other leg → set owner_email, associate_id, lead).
 * This is what cron effectively runs: same logic as backfill-inbound-owner-from-twilio-child-legs.ts.
 */
import { runInboundOwnerBackfill } from './scripts/backfill-inbound-owner-from-twilio-child-legs';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const DAYS = 1;
const LIMIT = 100;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startInboundOwnerBackfillScheduler(): void {
  if (intervalId != null) return;
  async function tick() {
    try {
      const result = await runInboundOwnerBackfill(DAYS, LIMIT);
      if (result.updated > 0 || result.errors > 0) {
        console.log(`[inbound-owner-backfill] updated=${result.updated} skipped=${result.skipped} errors=${result.errors}`);
      }
    } catch (e) {
      console.warn('[inbound-owner-backfill] run failed (non-critical):', e);
    }
  }
  void tick();
  intervalId = setInterval(tick, INTERVAL_MS);
  console.log('✅ Inbound owner backfill scheduler started (every 10 min, last 1 day, limit 100)');
}
