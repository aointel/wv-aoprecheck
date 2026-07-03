const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Math.min(120, Number(process.argv[2] || 15)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const res = await client.query(
      `
      WITH recent_zero AS (
        SELECT lower(agent_email) AS agent_email, updated_at
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND COALESCE(local_leased_lead_count, 0) = 0
      ),
      queue_counts AS (
        SELECT
          rz.agent_email,
          rz.updated_at,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
          )::int AS raw_queue_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = rz.agent_email
              )
          )::int AS callable_rows
        FROM recent_zero rz
        LEFT JOIN leasedialer_assignments la ON lower(la.agent_email) = rz.agent_email
        LEFT JOIN masterlead ml ON ml.id = la.lead_id
        GROUP BY rz.agent_email, rz.updated_at
      )
      SELECT
        COUNT(*)::int AS recent_zero_status_agents,
        COUNT(*) FILTER (WHERE raw_queue_rows = 0)::int AS true_zero_raw_queue,
        COUNT(*) FILTER (WHERE callable_rows = 0)::int AS true_zero_callable_queue
      FROM queue_counts
      `,
      [minutes],
    );

    const sample = await client.query(
      `
      WITH recent_zero AS (
        SELECT lower(agent_email) AS agent_email, updated_at
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND COALESCE(local_leased_lead_count, 0) = 0
      ),
      queue_counts AS (
        SELECT
          rz.agent_email,
          rz.updated_at,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
          )::int AS raw_queue_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = rz.agent_email
              )
          )::int AS callable_rows
        FROM recent_zero rz
        LEFT JOIN leasedialer_assignments la ON lower(la.agent_email) = rz.agent_email
        LEFT JOIN masterlead ml ON ml.id = la.lead_id
        GROUP BY rz.agent_email, rz.updated_at
      )
      SELECT *
      FROM queue_counts
      WHERE callable_rows = 0
      ORDER BY updated_at DESC, agent_email ASC
      LIMIT 25
      `,
      [minutes],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          windowMinutes: minutes,
          summary: res.rows[0] || null,
          sample_true_zero_callable: sample.rows,
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
