const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();
  try {
    const colsRes = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'masterlead'
          AND data_type IN ('text', 'character varying')
        ORDER BY ordinal_position
      `,
    );

    const cols = colsRes.rows.map((r) => r.column_name);
    const hits = [];
    for (const col of cols) {
      const q = `SELECT COUNT(*)::int AS n FROM masterlead WHERE created_at >= NOW() - INTERVAL '30 days' AND COALESCE(${JSON.stringify(col)}::text, '') <> ''`;
      // json stringify not valid identifier usage. Use quoted identifier safely:
      const identifier = `"${String(col).replace(/"/g, '""')}"`;
      const res = await client.query(
        `SELECT COUNT(*)::int AS n
         FROM masterlead
         WHERE created_at >= NOW() - INTERVAL '30 days'
           AND ${identifier} ILIKE '%VN125%'`,
      );
      const n = Number(res.rows[0]?.n || 0);
      if (n > 0) hits.push({ column: col, matches_30d: n });
    }

    if (hits.length === 0) {
      console.log(
        JSON.stringify(
          {
            error: "No text column in masterlead matched VN125 in last 30 days.",
            detected_columns: [],
          },
          null,
          2,
        ),
      );
      return;
    }

    hits.sort((a, b) => b.matches_30d - a.matches_30d);
    const primaryColumn = hits[0].column;
    const idCol = `"${primaryColumn.replace(/"/g, '""')}"`;

    const saturationRes = await client.query(
      `
        WITH current_72 AS (
          SELECT
            COALESCE(NULLIF(upper(btrim(taalk_state::text)), ''), NULLIF(upper(btrim(state::text)), ''), '??') AS state,
            COUNT(*)::int AS current_72h
          FROM masterlead
          WHERE created_at >= NOW() - INTERVAL '72 hours'
            AND ${idCol} ILIKE '%VN125%'
          GROUP BY 1
        ),
        baseline AS (
          SELECT
            COALESCE(NULLIF(upper(btrim(taalk_state::text)), ''), NULLIF(upper(btrim(state::text)), ''), '??') AS state,
            COUNT(*)::int AS baseline_25d
          FROM masterlead
          WHERE created_at >= NOW() - INTERVAL '28 days'
            AND created_at < NOW() - INTERVAL '72 hours'
            AND ${idCol} ILIKE '%VN125%'
          GROUP BY 1
        ),
        joined AS (
          SELECT
            c.state,
            c.current_72h,
            COALESCE(b.baseline_25d, 0) AS baseline_25d,
            (COALESCE(b.baseline_25d, 0)::numeric / 25.0) AS baseline_daily_avg,
            (COALESCE(b.baseline_25d, 0)::numeric / 25.0) * 3.0 AS expected_72h
          FROM current_72 c
          LEFT JOIN baseline b ON b.state = c.state
        )
        SELECT
          state,
          current_72h,
          baseline_25d,
          ROUND(baseline_daily_avg, 2) AS baseline_daily_avg,
          ROUND(expected_72h, 2) AS expected_72h,
          ROUND(
            CASE
              WHEN expected_72h <= 0 THEN NULL
              ELSE current_72h::numeric / expected_72h
            END
          , 2) AS saturation_ratio,
          ROUND(current_72h - expected_72h, 2) AS excess_vs_expected_72h
        FROM joined
        ORDER BY
          CASE WHEN expected_72h > 0 THEN current_72h::numeric / expected_72h ELSE 9999 END DESC,
          current_72h DESC,
          state ASC
      `,
    );

    const rows = saturationRes.rows;
    const aboveNormal = rows.filter((r) => {
      const ratio = r.saturation_ratio == null ? null : Number(r.saturation_ratio);
      const current = Number(r.current_72h || 0);
      return current >= 10 && (ratio == null || ratio >= 1.5);
    });

    const total72 = rows.reduce((sum, r) => sum + Number(r.current_72h || 0), 0);

    console.log(
      JSON.stringify(
        {
          marker: "VN125",
          detected_columns: hits.slice(0, 10),
          primary_column_used: primaryColumn,
          total_vn125_last_72h: total72,
          states_ranked: rows,
          states_above_normal: aboveNormal,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
