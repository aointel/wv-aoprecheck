const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const days = Math.max(7, Number(process.argv[2] || 30) || 30);
  const minCount = Math.max(5, Number(process.argv[3] || 20) || 20);

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
        WITH daily AS (
          SELECT
            (created_at AT TIME ZONE 'America/Chicago')::date AS day_ct,
            COALESCE(NULLIF(upper(btrim(taalk_state::text)), ''), NULLIF(upper(btrim(state::text)), ''), '??') AS state,
            COUNT(*)::int AS leads
          FROM masterlead
          WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
            AND taalk_group_code ILIKE '%VN125%'
          GROUP BY 1, 2
        ),
        state_stats AS (
          SELECT
            state,
            AVG(leads)::numeric AS avg_daily,
            STDDEV_POP(leads)::numeric AS std_daily,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY leads)::numeric AS p90_daily,
            COUNT(*)::int AS days_with_volume
          FROM daily
          GROUP BY 1
        ),
        spikes AS (
          SELECT
            d.day_ct,
            d.state,
            d.leads,
            s.avg_daily,
            s.std_daily,
            s.p90_daily,
            s.days_with_volume,
            CASE
              WHEN s.avg_daily > 0 THEN d.leads::numeric / s.avg_daily
              ELSE NULL
            END AS ratio_to_avg,
            CASE
              WHEN COALESCE(s.std_daily, 0) > 0 THEN (d.leads::numeric - s.avg_daily) / s.std_daily
              ELSE NULL
            END AS z_score
          FROM daily d
          JOIN state_stats s ON s.state = d.state
          WHERE d.leads >= $2::int
        )
        SELECT
          day_ct,
          state,
          leads,
          ROUND(avg_daily, 2) AS avg_daily,
          ROUND(p90_daily, 2) AS p90_daily,
          ROUND(ratio_to_avg, 2) AS ratio_to_avg,
          ROUND(z_score, 2) AS z_score
        FROM spikes
        ORDER BY ratio_to_avg DESC NULLS LAST, leads DESC, day_ct DESC
      `,
      [days, minCount],
    );

    const totals = await client.query(
      `
        SELECT
          (created_at AT TIME ZONE 'America/Chicago')::date AS day_ct,
          COUNT(*)::int AS total_vn125
        FROM masterlead
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
          AND taalk_group_code ILIKE '%VN125%'
        GROUP BY 1
        ORDER BY day_ct DESC
      `,
      [days],
    );

    console.log(
      JSON.stringify(
        {
          marker: "VN125",
          lookback_days: days,
          min_count_filter: minCount,
          spike_rows: result.rows,
          daily_totals: totals.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
