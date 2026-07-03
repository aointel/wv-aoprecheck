const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  max: 4,
});

function pacificDateIso(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function main() {
  const start = process.argv[2] || "2026-04-01";
  const end = process.argv[3] || pacificDateIso();

  const upsert = await pool.query(
    `
      WITH plus_src AS (
        SELECT
          (created_at AT TIME ZONE 'America/Los_Angeles')::date AS stat_date,
          LOWER(TRIM(COALESCE(NULLIF(cn_email, ''), NULLIF(previous_cn_email, '')))) AS agent_email,
          COUNT(*)::int AS plus
        FROM masterlead
        WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND created_at < (($2::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND (
            LOWER(COALESCE(taalk_market, '')) LIKE '%plus%'
            OR LOWER(COALESCE(market, '')) LIKE '%plus%'
          )
          AND COALESCE(TRIM(COALESCE(cn_email, previous_cn_email, '')), '') <> ''
        GROUP BY 1, 2
      )
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, instants, sales, alp, plus, updated_at)
      SELECT
        p.agent_email,
        p.stat_date,
        COALESCE(existing.dials, 0),
        COALESCE(existing.reached, 0),
        COALESCE(existing.booked, 0),
        COALESCE(existing.instants, 0),
        COALESCE(existing.sales, 0),
        COALESCE(existing.alp, 0),
        p.plus,
        NOW()
      FROM plus_src p
      LEFT JOIN agent_daily_stats existing
        ON existing.agent_email = p.agent_email
       AND existing.stat_date = p.stat_date
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        plus = EXCLUDED.plus,
        updated_at = NOW()
      RETURNING agent_email
    `,
    [start, end],
  );

  const zeroed = await pool.query(
    `
      WITH plus_src AS (
        SELECT
          (created_at AT TIME ZONE 'America/Los_Angeles')::date AS stat_date,
          LOWER(TRIM(COALESCE(NULLIF(cn_email, ''), NULLIF(previous_cn_email, '')))) AS agent_email
        FROM masterlead
        WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND created_at < (($2::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND (
            LOWER(COALESCE(taalk_market, '')) LIKE '%plus%'
            OR LOWER(COALESCE(market, '')) LIKE '%plus%'
          )
          AND COALESCE(TRIM(COALESCE(cn_email, previous_cn_email, '')), '') <> ''
        GROUP BY 1, 2
      )
      UPDATE agent_daily_stats ads
      SET plus = 0,
          updated_at = NOW()
      WHERE ads.stat_date >= $1::date
        AND ads.stat_date <= $2::date
        AND COALESCE(ads.plus, 0) <> 0
        AND NOT EXISTS (
          SELECT 1
          FROM plus_src p
          WHERE p.stat_date = ads.stat_date
            AND p.agent_email = LOWER(TRIM(ads.agent_email))
        )
    `,
    [start, end],
  );

  const verify = await pool.query(
    `
      SELECT
        stat_date::text AS stat_date,
        COALESCE(SUM(plus), 0)::int AS plus_total
      FROM agent_daily_stats
      WHERE stat_date >= $1::date
        AND stat_date <= $2::date
      GROUP BY stat_date
      ORDER BY stat_date
    `,
    [start, end],
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        start,
        end,
        upsertedRows: upsert.rowCount || 0,
        zeroedRows: zeroed.rowCount || 0,
        dayTotals: verify.rows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e?.message || String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
