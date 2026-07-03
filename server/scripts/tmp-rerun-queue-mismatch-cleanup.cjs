const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function getCounts(client) {
  const sql = `
    WITH base AS (
      SELECT
        la.id,
        la.queue,
        lower(COALESCE(ml.taalk_market, '')) AS tmarket,
        lower(COALESCE(ml.market, '')) AS market
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE la.status IN ('queued', 'active')
    )
    SELECT
      COUNT(*)::int AS queued_active,
      COUNT(*) FILTER (
        WHERE queue = 'plus'
          AND NOT (tmarket LIKE '%plus%' OR market LIKE '%plus%')
      )::int AS plus_queue_nonplus_market,
      COUNT(*) FILTER (
        WHERE queue = 'hotlead'
          AND (tmarket LIKE '%plus%' OR market LIKE '%plus%')
      )::int AS hotlead_queue_plus_market
    FROM base
  `;
  const { rows } = await client.query(sql);
  return rows[0] || {};
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const before = await getCounts(client);

    await client.query("BEGIN");
    const cleanupRes = await client.query(`
      WITH mismatched AS (
        SELECT la.id, la.lead_id, la.agent_email
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.status IN ('queued', 'active')
          AND (
            (
              la.queue = 'plus'
              AND NOT (
                lower(COALESCE(ml.taalk_market, '')) LIKE '%plus%'
                OR lower(COALESCE(ml.market, '')) LIKE '%plus%'
              )
            )
            OR (
              la.queue = 'hotlead'
              AND (
                lower(COALESCE(ml.taalk_market, '')) LIKE '%plus%'
                OR lower(COALESCE(ml.market, '')) LIKE '%plus%'
              )
            )
          )
      ),
      updated_assignments AS (
        UPDATE leasedialer_assignments la
        SET status = 'completed',
            released_at = NOW(),
            release_reason = 'manual_queue_market_mismatch_cleanup',
            updated_at = NOW()
        FROM mismatched m
        WHERE la.id = m.id
        RETURNING m.lead_id, m.agent_email
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        FROM updated_assignments ua
        WHERE ml.id = ua.lead_id
          AND lower(trim(COALESCE(ml.cn_email, ''))) = lower(ua.agent_email)
          AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        RETURNING ml.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM updated_assignments) AS assignments_completed,
        (SELECT COUNT(*)::int FROM cleared_owner) AS owners_cleared
    `);
    await client.query("COMMIT");

    const after = await getCounts(client);
    console.log(
      JSON.stringify(
        {
          before,
          cleanup: cleanupRes.rows[0] || {},
          after,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
