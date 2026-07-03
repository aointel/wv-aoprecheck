import { pool } from "../db.js";

async function main() {
  const day = String(process.argv[2] || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    console.error("Usage: npx tsx server/scripts/dial-direction-breakdown-day.ts YYYY-MM-DD");
    process.exit(1);
  }

  const rows = await pool.query<{ direction: string; calls: string; families: string }>(
    `
      WITH bounds AS (
        SELECT
          (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS ts_start,
          ((($1::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS ts_end
      )
      SELECT
        LOWER(COALESCE(call_direction, 'unknown')) AS direction,
        COUNT(DISTINCT twilio_call_sid)::text AS calls,
        COUNT(DISTINCT COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid))::text AS families
      FROM twilio_call_logs t
      CROSS JOIN bounds b
      WHERE t.call_started_at >= b.ts_start
        AND t.call_started_at < b.ts_end
      GROUP BY 1
      ORDER BY COUNT(DISTINCT twilio_call_sid) DESC
    `,
    [day],
  );

  console.log(JSON.stringify({ day, directions: rows.rows }, null, 2));
}

main()
  .catch((err) => {
    console.error((err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
