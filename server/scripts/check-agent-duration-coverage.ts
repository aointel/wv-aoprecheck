import { pool } from "../db.js";

async function main() {
  const agent = String(process.argv[2] || "").trim().toLowerCase();
  const day = String(process.argv[3] || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })).trim();
  if (!agent.includes("@")) {
    throw new Error("Usage: npx tsx server/scripts/check-agent-duration-coverage.ts <agent_email> [YYYY-MM-DD]");
  }

  const totals = await pool.query<{
    rows_total: string;
    rows_with_duration: string;
    avg_duration: string;
    max_duration: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS rows_total,
        COUNT(*) FILTER (WHERE COALESCE(call_duration, 0) > 0)::text AS rows_with_duration,
        COALESCE(AVG(NULLIF(call_duration, 0)), 0)::text AS avg_duration,
        COALESCE(MAX(call_duration), 0)::text AS max_duration
      FROM twilio_call_logs
      WHERE lower(owner_email) = $1
        AND call_started_at >= (($2::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND call_started_at < ((($2::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
    `,
    [agent, day],
  );

  console.log(
    JSON.stringify(
      {
        agent,
        day,
        window: `${day} 06:00:00 -> next day 06:00:00 America/New_York`,
        rows_total: Number(totals.rows[0]?.rows_total || 0),
        rows_with_duration_gt_zero: Number(totals.rows[0]?.rows_with_duration || 0),
        avg_duration_when_present_seconds: Number(totals.rows[0]?.avg_duration || 0),
        max_duration_seconds: Number(totals.rows[0]?.max_duration || 0),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error((error as Error)?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

