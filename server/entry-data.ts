/**
 * Data section entry point — masterlead, outbound dialer leads, hotlead cache.
 * Deployed as a separate Railway service with SECTION=data.
 * Build: esbuild server/entry-data.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/data.js
 * Start: node dist/data.js
 */
import http from "http";
import { createApp, addErrorHandler } from "./setup-app";
import { startDialStatsChainScheduler } from "./dial-stats-chain.js";

process.env.TZ = "America/Los_Angeles";
process.env.SECTION = "data";

process.on("uncaughtException", (err) => console.error("[data] uncaught:", err));
process.on("unhandledRejection", (r) => console.error("[data] rejection:", r));

const app = createApp({ serveSpa: false });

async function main() {
  // Register all routes — section filtering in index handles restricting to data paths
  const { registerRoutes } = await import("./routes.js");
  await registerRoutes(app);
  addErrorHandler(app);

  const leadOnlyMode = String(process.env.LEAD_ONLY_MODE || "").toLowerCase() === "true";
  if (!leadOnlyMode) {
    // Dial metrics chain (every 10 min): Twilio API -> twilio_call_logs -> agent_dial_metrics -> agent_daily_stats
    startDialStatsChainScheduler();
  } else {
    console.error("[LEAD_ONLY_MODE] DialStatsChain disabled on data entrypoint");
  }

  const { startCustomerRoutingProfileSyncScheduler, startHourlyLeasedialerQueueSweeper, startLeaseDialerQueuePreloaderScheduler } = await import("./leasedialer-assignment-service.js");
  startCustomerRoutingProfileSyncScheduler();
  startHourlyLeasedialerQueueSweeper();
  startLeaseDialerQueuePreloaderScheduler();

  if (process.env.LEASEDIALER_AUTOMATION_ENABLED !== 'false') {
    const { startLeasedialerAutomationWorker } = await import("./leasedialer-automation-worker.js");
    startLeasedialerAutomationWorker();
  } else {
    console.error("[LEASE_AUTO] disabled by env");
  }

  // Hourly health monitor — SMS alert during business hours if dialer is degraded
  const { startDialerHealthMonitor } = await import("./dialer-health-monitor.js");
  startDialerHealthMonitor();

  // Recycle unowned called/no-answer leads back to pending after 1 hour
  // Runs every 5 minutes so agents always have fresh leads without waiting for midnight
  const runUnownedLeadRecycle = async () => {
    try {
      const { leaseDialerPool: recyclePool } = await import("./db.js");
      const result = await recyclePool.query(`
        WITH candidates AS (
          SELECT id FROM masterlead
          WHERE lower(trim(coalesce(cnresolution, ''))) IN ('called', 'call', 'no_answer', 'no answer', 'no_answer_vm', 'voicemail')
            AND (cn_email IS NULL OR btrim(cn_email) = '')
            AND COALESCE(btrim(taalk_lead_id::text), '') <> ''
            AND COALESCE(lower(dnc::text), '') NOT IN ('true', '1', 'yes', 'y')
            AND NOT (lower(COALESCE(taalk_market::text, '')) LIKE '%plus%' OR lower(COALESCE(market::text, '')) LIKE '%plus%')
            AND COALESCE(updated_at, last_contacted, created_at, NOW()) < NOW() - INTERVAL '1 hour'
          LIMIT 2000
          FOR UPDATE SKIP LOCKED
        )
        UPDATE masterlead SET cnresolution = 'pending', updated_at = NOW()
        FROM candidates WHERE masterlead.id = candidates.id
        RETURNING masterlead.id
      `);
      if (result.rowCount && result.rowCount > 0) {
        console.error("[UNOWNED_RECYCLE] Reset " + result.rowCount + " unowned called leads to pending");
      }
    } catch (err: any) {
      console.error('[UNOWNED_RECYCLE] Failed:', err?.message);
    }
  };
  setTimeout(runUnownedLeadRecycle, 30_000);
  setInterval(runUnownedLeadRecycle, 5 * 60 * 1000);

  if (!leadOnlyMode) {
    const { startAgentProductionRankScheduler } = await import("./ccpro-rank-service.js");
    startAgentProductionRankScheduler();

    const { startPlatformSalesNightlySyncScheduler } = await import("./platform-sales-nightly-sync.js");
    startPlatformSalesNightlySyncScheduler();
  } else {
    console.error("[LEAD_ONLY_MODE] Non-lead schedulers disabled on data entrypoint");
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("[data] Port", port, "in use");
      process.exit(1);
    }
    throw err;
  });

  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));

  server.listen(port, "0.0.0.0", () => {
    console.error(`[AOIrail] data section listening on port ${port} (SECTION=data)`);
  });
}

main().catch((e) => {
  console.error("[data] Fatal:", e);
  process.exit(1);
});
