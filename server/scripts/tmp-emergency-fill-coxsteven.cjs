const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = "coxsteven@aoglobelife.com";
  const target = Number(process.env.TARGET_QUEUED || 25);

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const currentRes = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'hotlead'
          AND status IN ('queued', 'active')
      `,
      [email],
    );
    const current = Number(currentRes.rows[0]?.count || 0);
    const needed = Math.max(0, target - current);
    if (needed <= 0) {
      console.log(JSON.stringify({ email, current, inserted: 0, after: current }, null, 2));
      return;
    }

    const insertRes = await client.query(
      `
        WITH eligible AS (
          SELECT ml.id
          FROM masterlead ml
          WHERE (
              CASE
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
              END
            ) = 'Globe Market'
            AND COALESCE(btrim(ml.cn_email), '') = ''
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
          ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
          LIMIT $2
        ),
        ins AS (
          INSERT INTO leasedialer_assignments (
            lead_id, agent_email, queue, status, assigned_at, created_at, updated_at
          )
          SELECT id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM eligible
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS count
        FROM ins
      `,
      [email, needed],
    );
    const inserted = Number(insertRes.rows[0]?.count || 0);

    const afterRes = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'hotlead'
          AND status IN ('queued', 'active')
      `,
      [email],
    );
    const after = Number(afterRes.rows[0]?.count || 0);

    await client.query(
      `
        INSERT INTO leasedialer_client_status (agent_email, local_leased_lead_count, current_lead_id, updated_at)
        VALUES ($1, $2, NULL, NOW())
        ON CONFLICT (agent_email) DO UPDATE
        SET local_leased_lead_count = EXCLUDED.local_leased_lead_count,
            updated_at = NOW()
      `,
      [email, after],
    );

    console.log(JSON.stringify({ email, current, needed, inserted, after }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
