const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TARGET_QUEUED = Number(process.env.TARGET_QUEUED || 20);

async function run() {
  const email = String(process.argv[2] || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: node server/scripts/tmp-force-assign-owned-leads.cjs <agent_email>");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'hotlead'
          AND status IN ('queued','active')
      `,
      [email],
    );
    const currentQueued = Number(current.rows[0]?.count || 0);
    const needed = Math.max(0, TARGET_QUEUED - currentQueued);

    let inserted = 0;
    let sample = [];
    if (needed > 0) {
      const insertResult = await client.query(
        `
          WITH eligible AS (
            SELECT ml.id
            FROM masterlead ml
            WHERE lower(trim(COALESCE(ml.cn_email, ''))) = lower($1)
              AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending','new','','null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true','t','yes','1')
              AND NOT EXISTS (
                SELECT 1
                FROM leasedialer_assignments la
                WHERE la.lead_id = ml.id
                  AND la.status IN ('queued','active')
              )
            ORDER BY ml.updated_at DESC NULLS LAST, ml.id DESC
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
          SELECT lead_id
          FROM ins
          LIMIT 20
        `,
        [email, needed],
      );
      sample = insertResult.rows.map((r) => String(r.lead_id));

      const insertedCount = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM leasedialer_assignments
          WHERE lower(agent_email) = lower($1)
            AND queue = 'hotlead'
            AND status = 'queued'
            AND created_at >= NOW() - INTERVAL '2 minutes'
        `,
        [email],
      );
      inserted = Number(insertedCount.rows[0]?.count || 0);
    }

    const after = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'hotlead'
          AND status IN ('queued','active')
      `,
      [email],
    );
    const afterQueued = Number(after.rows[0]?.count || 0);

    await client.query(
      `
        INSERT INTO leasedialer_client_status (agent_email, local_leased_lead_count, current_lead_id, updated_at)
        VALUES ($1, $2, NULL, NOW())
        ON CONFLICT (agent_email) DO UPDATE
        SET local_leased_lead_count = EXCLUDED.local_leased_lead_count,
            updated_at = NOW()
      `,
      [email, afterQueued],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          email,
          targetQueued: TARGET_QUEUED,
          currentQueued,
          needed,
          insertedRecentQueuedRows: inserted,
          afterQueued,
          sampleLeadIds: sample,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
