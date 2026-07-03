import { pool } from "../db.js";

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const day = String(process.argv[3] || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })).trim();
  if (!email.includes("@")) throw new Error("Usage: npx tsx server/scripts/check-agent-daily-row.ts <email> [YYYY-MM-DD]");

  const row = await pool.query<{
    agent_email: string;
    stat_date: string;
    dials: string;
    reached: string;
    booked: string;
    instants: string;
    updated_at: string;
  }>(
    `
      SELECT agent_email, stat_date::text, dials::text, reached::text, booked::text, instants::text, updated_at::text
      FROM agent_daily_stats
      WHERE agent_email = $1
        AND stat_date = $2::date
      LIMIT 1
    `,
    [email, day],
  );

  console.log(
    JSON.stringify(
      {
        email,
        day,
        row: row.rows[0] || null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error((e as Error)?.message || String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

