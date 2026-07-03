const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const totalSql = `
    SELECT
      COUNT(*)::int AS booked_rows
    FROM masterlead
    WHERE LOWER(COALESCE(cnresolution, '')) IN ('booked', 'appointment', 'appointment_set')
      AND updated_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
      AND updated_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
  `;

  const byAgentSql = `
    SELECT
      LOWER(TRIM(COALESCE(cn_email, 'unassigned'))) AS agent_email,
      COUNT(*)::int AS booked_rows
    FROM masterlead
    WHERE LOWER(COALESCE(cnresolution, '')) IN ('booked', 'appointment', 'appointment_set')
      AND updated_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
      AND updated_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
    GROUP BY LOWER(TRIM(COALESCE(cn_email, 'unassigned')))
    ORDER BY booked_rows DESC, agent_email ASC
    LIMIT 100
  `;

  const sampleSql = `
    SELECT
      id,
      taalk_lead_id,
      first_name,
      last_name,
      cn_email,
      cnresolution,
      updated_at
    FROM masterlead
    WHERE LOWER(COALESCE(cnresolution, '')) IN ('booked', 'appointment', 'appointment_set')
      AND updated_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
      AND updated_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
    ORDER BY updated_at DESC
    LIMIT 20
  `;

  const [total, byAgent, sample] = await Promise.all([
    pool.query(totalSql, [ptDay]),
    pool.query(byAgentSql, [ptDay]),
    pool.query(sampleSql, [ptDay]),
  ]);

  console.log(
    JSON.stringify(
      {
        ptDay,
        totalBookedRows: total.rows[0]?.booked_rows || 0,
        byAgent: byAgent.rows,
        recentSample: sample.rows,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((err) => {
    console.error(err.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
