const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const queue = String(process.argv[2] || "hotlead").trim().toLowerCase();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 300000,
    query_timeout: 300000,
  });

  await client.connect();
  try {
    const strictReport = await client.query(
      `
      WITH active_assignments AS (
        SELECT DISTINCT la.lead_id
        FROM leasedialer_assignments la
        WHERE la.queue = $1
          AND la.status IN ('queued', 'active')
      ),
      eligible AS (
        SELECT
          upper(
            COALESCE(
              NULLIF(btrim(ml.taalk_state::text), ''),
              NULLIF(btrim(ml.state::text), ''),
              'UNKNOWN'
            )
          ) AS state,
          CASE
            WHEN ml.created_at >= NOW() - INTERVAL '3 months' THEN '0-3m'
            WHEN ml.created_at >= NOW() - INTERVAL '6 months' THEN '3-6m'
            ELSE 'older'
          END AS age_bucket
        FROM masterlead ml
        LEFT JOIN active_assignments aa ON aa.lead_id = ml.id
        WHERE aa.lead_id IS NULL
          AND ml.created_at >= NOW() - INTERVAL '6 months'
          AND lower(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')) LIKE '%globe%'
          AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND COALESCE(btrim(ml.cn_email), '') = ''
          AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
      ),
      grouped AS (
        SELECT age_bucket, state, COUNT(*)::int AS assignable_count
        FROM eligible
        WHERE age_bucket IN ('0-3m', '3-6m')
        GROUP BY age_bucket, state
      )
      SELECT
        age_bucket,
        state,
        assignable_count
      FROM grouped
      ORDER BY
        CASE age_bucket WHEN '3-6m' THEN 1 WHEN '0-3m' THEN 2 ELSE 3 END,
        assignable_count DESC,
        state ASC
      `,
      [queue],
    );

    const callableInventory = await client.query(
      `
      WITH eligible AS (
        SELECT
          upper(
            COALESCE(
              NULLIF(btrim(ml.taalk_state::text), ''),
              NULLIF(btrim(ml.state::text), ''),
              'UNKNOWN'
            )
          ) AS state,
          CASE
            WHEN ml.created_at >= NOW() - INTERVAL '3 months' THEN '0-3m'
            WHEN ml.created_at >= NOW() - INTERVAL '6 months' THEN '3-6m'
            ELSE 'older'
          END AS age_bucket
        FROM masterlead ml
        WHERE ml.created_at >= NOW() - INTERVAL '6 months'
          AND lower(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')) LIKE '%globe%'
          AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
      ),
      grouped AS (
        SELECT age_bucket, state, COUNT(*)::int AS assignable_count
        FROM eligible
        WHERE age_bucket IN ('0-3m', '3-6m')
        GROUP BY age_bucket, state
      )
      SELECT
        age_bucket,
        state,
        assignable_count
      FROM grouped
      ORDER BY
        CASE age_bucket WHEN '3-6m' THEN 1 WHEN '0-3m' THEN 2 ELSE 3 END,
        assignable_count DESC,
        state ASC
      `,
    );

    const totals = { "3-6m": 0, "0-3m": 0, "0-6m": 0 };
    for (const row of strictReport.rows) {
      const n = Number(row.assignable_count || 0);
      if (row.age_bucket === "3-6m") totals["3-6m"] += n;
      if (row.age_bucket === "0-3m") totals["0-3m"] += n;
    }
    totals["0-6m"] = totals["3-6m"] + totals["0-3m"];

    const inventoryTotals = { "3-6m": 0, "0-3m": 0, "0-6m": 0 };
    for (const row of callableInventory.rows) {
      const n = Number(row.assignable_count || 0);
      if (row.age_bucket === "3-6m") inventoryTotals["3-6m"] += n;
      if (row.age_bucket === "0-3m") inventoryTotals["0-3m"] += n;
    }
    inventoryTotals["0-6m"] = inventoryTotals["3-6m"] + inventoryTotals["0-3m"];

    console.log(
      JSON.stringify(
        {
          queue,
          definitions: {
            strict_assignable_now: [
              "not currently queued/active in leasedialer_assignments for queue",
              "cn_email empty",
              "cnresolution in pending/new/blank/null",
              "taalk_lead_id present",
              "dnc is false",
            ],
            callable_inventory: [
              "cnresolution in pending/new/blank/null",
              "taalk_lead_id present",
              "dnc is false",
              "includes leads currently assigned/owned",
            ],
          },
          strict_assignable_now: {
            totals,
            rows: strictReport.rows,
          },
          callable_inventory: {
            totals: inventoryTotals,
            rows: callableInventory.rows,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
