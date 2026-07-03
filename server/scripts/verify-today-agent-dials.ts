import { pool } from "../db.js";

async function main() {
  const day = process.argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const result = await pool.query<{ total_dials: string; agent_rows: string }>(
    `
      SELECT
        COALESCE(SUM(dials), 0)::text AS total_dials,
        COUNT(*)::text AS agent_rows
      FROM agent_daily_stats
      WHERE stat_date = $1::date
        AND dials > 0
    `,
    [day],
  );

  console.log(
    JSON.stringify(
      {
        day,
        total_dials: Number(result.rows[0]?.total_dials || 0),
        agent_rows: Number(result.rows[0]?.agent_rows || 0),
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

