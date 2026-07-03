/**
 * Runs inbound enrich-from-Taalk on a schedule: match inbound twilio_call_logs to Taalk by phone+time,
 * set call_source (persona) and recording_url (Supabase).
 */
import { runInboundEnrichFromTaalk } from './inbound-enrich-from-taalk.js';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const DAYS = 1;
const LIMIT = 50;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startInboundEnrichFromTaalkScheduler(): void {
  if (intervalId != null) return;
  async function tick() {
    try {
      const result = await runInboundEnrichFromTaalk(DAYS, LIMIT);
      if (result.updated > 0 || result.errors > 0) {
        console.log(`[inbound-enrich-taalk] updated=${result.updated} skipped=${result.skipped} errors=${result.errors}`);
      }
    } catch (e) {
      console.warn('[inbound-enrich-taalk] run failed (non-critical):', e);
    }
  }
  void tick();
  intervalId = setInterval(tick, INTERVAL_MS);
  console.log('✅ Inbound enrich-from-Taalk scheduler started (every 10 min, last 1 day, limit 50)');
}
