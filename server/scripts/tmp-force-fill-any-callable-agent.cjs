const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TARGET_QUEUED = Math.max(1, Math.min(500, Number(process.env.TARGET_QUEUED || 100)));

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: node server/scripts/tmp-force-fill-any-callable-agent.cjs <agent_email>");
  }

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
    const needed = Math.max(0, TARGET_QUEUED - current);
    if (needed <= 0) {
      console.log(JSON.stringify({ email, target: TARGET_QUEUED, current, inserted: 0, after: current }, null, 2));
      return;
    }

    await client.query("BEGIN");
    try {
      const insertedFromPool = await client.query(
        `
          WITH picked AS (
            SELECT ep.id, ep.lead_id
            FROM leasedialer_eligible_pool ep
            WHERE ep.queue = 'hotlead'
              AND ep.status = 'ready'
            ORDER BY ep.lead_received_at DESC NULLS LAST, ep.lead_id DESC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
          ),
          claimed AS (
            UPDATE leasedialer_eligible_pool ep
            SET status = 'claimed',
                claimed_by_agent_email = $1,
                claimed_at = NOW(),
                updated_at = NOW()
            FROM picked p
            WHERE ep.id = p.id
            RETURNING ep.lead_id
          ),
          ins AS (
            INSERT INTO leasedialer_assignments (
              lead_id, agent_email, queue, status, assigned_at, created_at, updated_at
            )
            SELECT lead_id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
            FROM claimed
            ON CONFLICT DO NOTHING
            RETURNING lead_id
          )
          SELECT COUNT(*)::int AS count
          FROM ins
        `,
        [email, needed],
      );

      let insertedCount = Number(insertedFromPool.rows[0]?.count || 0);

      if (insertedCount < needed) {
        const stillNeeded = needed - insertedCount;
        const insertedDirect = await client.query(
        `
          WITH eligible AS (
            SELECT ml.id
            FROM masterlead ml
            WHERE COALESCE(btrim(ml.cn_email), '') = ''
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
              AND NOT EXISTS (
                SELECT 1
                FROM leasedialer_assignments la
                WHERE la.lead_id = ml.id
                  AND la.status IN ('queued', 'active')
              )
            ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
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
          [email, stillNeeded],
        );
        insertedCount += Number(insertedDirect.rows[0]?.count || 0);
      }
      await client.query("COMMIT");

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
      console.log(
        JSON.stringify(
          {
            email,
            target: TARGET_QUEUED,
            current,
            inserted: insertedCount,
            after,
            mode: "force_any_callable_unassigned",
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
