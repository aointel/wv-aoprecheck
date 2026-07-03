const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const upsertSql = `
    WITH booked AS (
      SELECT
        LOWER(TRIM(cn_email)) AS agent_email,
        COUNT(*)::int AS booked
      FROM masterlead
      WHERE LOWER(COALESCE(cnresolution, '')) IN ('booked', 'appointment', 'appointment_set')
        AND COALESCE(TRIM(cn_email), '') <> ''
        AND updated_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND updated_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
      GROUP BY LOWER(TRIM(cn_email))
    )
    INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
    SELECT
      b.agent_email,
      $1::date,
      COALESCE(a.dials, 0),
      COALESCE(a.reached, 0),
      b.booked,
      NOW()
    FROM booked b
    LEFT JOIN agent_daily_stats a
      ON a.agent_email = b.agent_email
     AND a.stat_date = $1::date
    ON CONFLICT (agent_email, stat_date)
    DO UPDATE SET
      booked = EXCLUDED.booked,
      updated_at = NOW()
    RETURNING agent_email, booked
  `;

  const result = await pool.query(upsertSql, [ptDay]);

  const totals = await pool.query(
    `
      SELECT
        COUNT(*)::int AS agents,
        COALESCE(SUM(dials), 0)::int AS dials,
        COALESCE(SUM(reached), 0)::int AS reached,
        COALESCE(SUM(booked), 0)::int AS booked
      FROM agent_daily_stats
      WHERE stat_date = $1::date
    `,
    [ptDay],
  );

  console.log(
    JSON.stringify(
      {
        ptDay,
        bookedAgentsUpserted: result.rowCount || 0,
        totals: totals.rows[0],
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
