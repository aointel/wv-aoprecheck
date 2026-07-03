/**
 * Standalone background worker — no HTTP server, no Twilio webhooks.
 *
 * Build:  npm run build (produces dist/worker.js) or npm run build:worker
 * Start:  npm run start:worker
 *
 * AOIntel VDP poller uses a no-op display hook; agents load leads via queue ignite / poll (same as web).
 */
import { isWorkersGloballyEnabled } from "./feature-flags.js";
import { startBackgroundWorkers } from "./background-workers.js";

process.env.TZ = "America/Los_Angeles";

process.on("uncaughtException", (error: Error) => {
  console.error("[WORKER] ❌ UNCAUGHT EXCEPTION:", error);
  console.error("[WORKER] Stack:", error.stack);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[WORKER] ❌ UNHANDLED REJECTION:", reason);
  if (reason instanceof Error) console.error("[WORKER] Stack:", reason.stack);
});

async function main(): Promise<void> {
  if (!isWorkersGloballyEnabled()) {
    console.log("[WORKER] ⏭️ ENABLE_WORKERS=false — exiting");
    process.exit(0);
    return;
  }
  console.log("[WORKER] 🚀 AOIrail background worker starting...");
  await startBackgroundWorkers();
  console.log("[WORKER] 🟢 Schedulers bootstrapped (async jobs may still be loading)");

  // Start Redis job queue consumer
  try {
    const { startJobWorker } = await import('./job-queue.js');
    startJobWorker().catch((err) => console.error('[WORKER] Job queue error:', err));
    console.log('[WORKER] ✅ Redis job queue worker started');
  } catch (err: any) {
    console.warn('[WORKER] ⚠️ Job queue failed to start (non-critical):', err.message);
  }
}

main().catch((err) => {
  console.error("[WORKER] ❌ Critical failure:", err);
  process.exit(1);
});
