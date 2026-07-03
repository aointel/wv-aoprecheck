const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const limit = Math.max(1, Math.min(100, Number(process.argv[2] || 100)));
  const step = Math.max(5000, Math.min(50000, Number(process.env.GLOBE_CALLABLE_STEP || 25000)));

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

    const agg = new Map();
    for (let start = minId; start <= maxId; start += step) {
      const end = start + step;
      const part = await client.query(
        `
        WITH active AS (
          SELECT DISTINCT lead_id
          FROM leasedialer_assignments
          WHERE queue = 'hotlead'
            AND status IN ('queued','active')
        ),
        scoped AS (
          SELECT
            COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state
          FROM masterlead ml
          LEFT JOIN active a ON a.lead_id = ml.id
          WHERE ml.id >= $1
            AND ml.id < $2
            AND (
              CASE
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
              END
            ) = 'Globe Market'
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND COALESCE(btrim(ml.cn_email), '') = ''
            AND a.lead_id IS NULL
        )
        SELECT state, COUNT(*)::int AS callable_total
        FROM scoped
        GROUP BY state
        `,
        [start, end],
      );

      for (const row of part.rows) {
        const state = String(row.state || "UNKNOWN").toUpperCase();
        agg.set(state, (agg.get(state) || 0) + Number(row.callable_total || 0));
      }
    }

    const states = Array.from(agg.entries())
      .map(([state, callable_total]) => ({ state, callable_total }))
      .sort((a, b) => b.callable_total - a.callable_total || a.state.localeCompare(b.state))
      .slice(0, limit);
    const totals = {
      callable_total: states.reduce((sum, row) => sum + Number(row.callable_total || 0), 0),
    };

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          scope: "Globe Market callable inventory by state",
          callable_definition: [
            "market normalized to Globe Market",
            "cnresolution in (pending,new,'',null)",
            "taalk_lead_id present",
            "cn_email blank (unowned)",
            "not currently queued/active in hotlead assignments",
          ],
          totals,
          states,
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
