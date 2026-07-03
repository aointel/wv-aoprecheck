const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const step = Math.max(5000, Math.min(50000, Number(process.env.GLOBE_VERIFY_STEP || 25000)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const bounds = await client.query(`
      SELECT COALESCE(MIN(id),0)::int AS min_id, COALESCE(MAX(id),0)::int AS max_id
      FROM masterlead
    `);
    const minId = Number(bounds.rows[0]?.min_id || 0);
    const maxId = Number(bounds.rows[0]?.max_id || 0);

    const totals = {
      globe_all: 0,
      globe_callable_resolution: 0,
      globe_callable_with_taalk_id: 0,
      globe_callable_unowned: 0,
      globe_callable_unowned_two_letter_state: 0,
    };
    const byState = new Map();

    for (let start = minId; start <= maxId; start += step) {
      const end = start + step;
      const chunkTotals = await client.query(
        `
        WITH base AS (
          SELECT
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END AS canonical_market,
            lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
            COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id,
            COALESCE(btrim(ml.cn_email), '') AS cn_email,
            COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state
          FROM masterlead ml
          WHERE ml.id >= $1 AND ml.id < $2
        )
        SELECT
          COUNT(*) FILTER (WHERE canonical_market = 'Globe Market')::int AS globe_all,
          COUNT(*) FILTER (WHERE canonical_market = 'Globe Market' AND norm_resolution IN ('pending','new','','null'))::int AS globe_callable_resolution,
          COUNT(*) FILTER (WHERE canonical_market = 'Globe Market' AND norm_resolution IN ('pending','new','','null') AND taalk_lead_id <> '')::int AS globe_callable_with_taalk_id,
          COUNT(*) FILTER (WHERE canonical_market = 'Globe Market' AND norm_resolution IN ('pending','new','','null') AND taalk_lead_id <> '' AND cn_email = '')::int AS globe_callable_unowned,
          COUNT(*) FILTER (WHERE canonical_market = 'Globe Market' AND norm_resolution IN ('pending','new','','null') AND taalk_lead_id <> '' AND cn_email = '' AND state ~ '^[A-Z]{2}$')::int AS globe_callable_unowned_two_letter_state
        FROM base
        `,
        [start, end],
      );
      const row = chunkTotals.rows[0] || {};
      for (const key of Object.keys(totals)) {
        totals[key] += Number(row[key] || 0);
      }

      const chunkStates = await client.query(
        `
        WITH base AS (
          SELECT
            COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state,
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END AS canonical_market,
            lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
            COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id,
            COALESCE(btrim(ml.cn_email), '') AS cn_email
          FROM masterlead ml
          WHERE ml.id >= $1 AND ml.id < $2
        )
        SELECT
          state,
          COUNT(*) FILTER (WHERE canonical_market='Globe Market' AND norm_resolution IN ('pending','new','','null') AND taalk_lead_id <> '')::int AS callable_any_owner,
          COUNT(*) FILTER (WHERE canonical_market='Globe Market' AND norm_resolution IN ('pending','new','','null') AND taalk_lead_id <> '' AND cn_email='')::int AS callable_unowned
        FROM base
        GROUP BY state
        HAVING COUNT(*) FILTER (WHERE canonical_market='Globe Market' AND norm_resolution IN ('pending','new','','null') AND taalk_lead_id <> '') > 0
        `,
        [start, end],
      );

      for (const stateRow of chunkStates.rows) {
        const state = String(stateRow.state || "UNKNOWN");
        const prev = byState.get(state) || { state, callable_any_owner: 0, callable_unowned: 0 };
        prev.callable_any_owner += Number(stateRow.callable_any_owner || 0);
        prev.callable_unowned += Number(stateRow.callable_unowned || 0);
        byState.set(state, prev);
      }
    }

    const stateBreakdown = Array.from(byState.values())
      .sort((a, b) => b.callable_unowned - a.callable_unowned || b.callable_any_owner - a.callable_any_owner || a.state.localeCompare(b.state))
      .slice(0, 50);

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          totals,
          top_states: stateBreakdown,
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
