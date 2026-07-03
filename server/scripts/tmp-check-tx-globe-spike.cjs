const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const summary = await client.query(`
      WITH daily AS (
        SELECT
          (created_at AT TIME ZONE 'America/New_York')::date AS day_et,
          COUNT(*)::int AS leads
        FROM masterlead
        WHERE UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) = 'TX'
          AND (
            LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
            OR LOWER(COALESCE(market, '')) LIKE '%globe%'
          )
        GROUP BY 1
      ),
      ranked AS (
        SELECT
          day_et,
          leads,
          ROW_NUMBER() OVER (ORDER BY leads DESC, day_et DESC) AS rn
        FROM daily
      )
      SELECT
        (SELECT day_et FROM ranked WHERE rn = 1) AS peak_day,
        (SELECT leads FROM ranked WHERE rn = 1) AS peak_count,
        (SELECT day_et FROM ranked WHERE rn = 2) AS second_day,
        (SELECT leads FROM ranked WHERE rn = 2) AS second_count,
        (SELECT ROUND(AVG(leads)::numeric,2) FROM daily) AS avg_daily,
        (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY leads)::numeric,2) FROM daily) AS median_daily,
        (SELECT COUNT(*)::int FROM daily) AS active_days,
        (SELECT SUM(leads)::int FROM daily) AS total_leads
    `);

    const topDays = await client.query(`
      SELECT
        (created_at AT TIME ZONE 'America/New_York')::date AS day_et,
        TO_CHAR((created_at AT TIME ZONE 'America/New_York')::date, 'Dy') AS dow,
        COUNT(*)::int AS leads
      FROM masterlead
      WHERE UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) = 'TX'
        AND (
          LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
          OR LOWER(COALESCE(market, '')) LIKE '%globe%'
        )
      GROUP BY 1,2
      ORDER BY leads DESC, day_et DESC
      LIMIT 15
    `);

    const s = summary.rows[0] || {};
    const peak = Number(s.peak_count || 0);
    const second = Number(s.second_count || 0);
    const avg = Number(s.avg_daily || 0);

    const result = {
      state: 'TX',
      peak_day: s.peak_day || null,
      peak_count: peak,
      second_day: s.second_day || null,
      second_count: second,
      avg_daily: avg,
      median_daily: Number(s.median_daily || 0),
      active_days: Number(s.active_days || 0),
      total_leads: Number(s.total_leads || 0),
      peak_vs_second_ratio: second > 0 ? Number((peak / second).toFixed(2)) : null,
      peak_vs_avg_ratio: avg > 0 ? Number((peak / avg).toFixed(2)) : null,
      top_days: topDays.rows,
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

