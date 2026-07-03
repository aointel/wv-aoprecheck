import { pool } from "../db.js";

async function main() {
  console.log("[ensure-backfill-indexes] creating indexes if needed...");

  await pool.query(
    `
      CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_started_brin
      ON twilio_call_logs
      USING BRIN (call_started_at)
    `,
  );

  await pool.query(
    `
      CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_event_brin
      ON agent_dial_metrics
      USING BRIN (event_timestamp)
    `,
  );

  console.log("[ensure-backfill-indexes] done");
}

main()
  .catch((err) => {
    console.error("[ensure-backfill-indexes] fatal:", (err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
