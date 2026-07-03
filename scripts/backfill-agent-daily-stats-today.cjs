const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_dial_metrics'",
  );
  const available = new Set(cols.rows.map((r) => String(r.column_name)));
  const phoneSource =
    ["phone_number", "lead_phone", "phone", "to_number"].find((c) => available.has(c)) || null;
  const phoneExpr = phoneSource
    ? `RIGHT(REGEXP_REPLACE(COALESCE(${phoneSource}, ''), '[^0-9]', '', 'g'), 10)`
    : "''";

  const previewSql = `
    WITH base AS (
      SELECT
        LOWER(TRIM(agent_email)) AS agent_email,
        LOWER(TRIM(event_type)) AS event_type,
        ${phoneExpr} AS phone10
      FROM agent_dial_metrics
      WHERE event_timestamp >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND event_timestamp <  (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND COALESCE(TRIM(agent_email), '') <> ''
    )
    SELECT
      agent_email,
      COUNT(*) FILTER (WHERE event_type = 'dial')::int AS raw_dials,
      COUNT(*) FILTER (WHERE event_type = 'reach')::int AS raw_reached,
      COUNT(*) FILTER (WHERE event_type = 'booked')::int AS raw_booked,
      COUNT(DISTINCT CASE WHEN event_type = 'dial'  AND phone10 <> '' THEN phone10 END)::int AS dedup_dials,
      COUNT(DISTINCT CASE WHEN event_type = 'reach' AND phone10 <> '' THEN phone10 END)::int AS dedup_reached
    FROM base
    GROUP BY agent_email
    ORDER BY dedup_dials DESC, raw_dials DESC
  `;

  const preview = await pool.query(previewSql, [ptDay]);

  const upsertSql = `
    WITH base AS (
      SELECT
        LOWER(TRIM(agent_email)) AS agent_email,
        LOWER(TRIM(event_type)) AS event_type,
        ${phoneExpr} AS phone10
      FROM agent_dial_metrics
      WHERE event_timestamp >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND event_timestamp <  (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND COALESCE(TRIM(agent_email), '') <> ''
    ),
    agg AS (
      SELECT
        agent_email,
        $1::date AS stat_date,
        COUNT(DISTINCT CASE WHEN event_type = 'dial'  AND phone10 <> '' THEN phone10 END)::int AS dials,
        COUNT(DISTINCT CASE WHEN event_type = 'reach' AND phone10 <> '' THEN phone10 END)::int AS reached,
        COUNT(*) FILTER (WHERE event_type = 'booked')::int AS booked
      FROM base
      GROUP BY agent_email
    )
    INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
    SELECT agent_email, stat_date, dials, reached, booked, NOW()
    FROM agg
    ON CONFLICT (agent_email, stat_date)
    DO UPDATE SET
      dials = EXCLUDED.dials,
      reached = EXCLUDED.reached,
      booked = EXCLUDED.booked,
      updated_at = NOW()
    RETURNING agent_email, dials, reached, booked
  `;

  const upsert = await pool.query(upsertSql, [ptDay]);

  const summarySql = `
    SELECT
      COUNT(*)::int AS agents,
      COALESCE(SUM(dials), 0)::int AS dials,
      COALESCE(SUM(reached), 0)::int AS reached,
      COALESCE(SUM(booked), 0)::int AS booked
    FROM agent_daily_stats
    WHERE stat_date = $1::date
  `;
  const summary = await pool.query(summarySql, [ptDay]);

  console.log(
    JSON.stringify(
      {
        ptDay,
        phoneSourceUsed: phoneSource,
        previewTop10: preview.rows.slice(0, 10),
        upsertedRows: upsert.rowCount,
        dailyTotals: summary.rows[0],
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
