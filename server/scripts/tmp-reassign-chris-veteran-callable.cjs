const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TARGET_EMAIL = (process.env.TARGET_EMAIL || "chrislafond@aoglobelife.com")
  .toLowerCase()
  .trim();
const EXCLUDED_STATES = ["CT", "PA", "NJ"];

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    await client.query("BEGIN");

    // 1) Pull back every Veteran lead currently assigned to Chris.
    const pulled = await client.query(
      `
      WITH veteran_assigned AS (
        SELECT ml.id
        FROM masterlead ml
        WHERE lower(coalesce(ml.cn_email, '')) = lower($1)
          AND (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%'
                THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
            END
          ) = 'Veteran'
      )
      UPDATE masterlead ml
      SET previous_cn_email = ml.cn_email,
          cn_email = NULL,
          assigned_date = NULL,
          last_assigned_date = NOW(),
          updated_at = NOW()
      FROM veteran_assigned va
      WHERE ml.id = va.id
      RETURNING ml.id
      `,
      [TARGET_EMAIL],
    );

    const pulledCount = Number(pulled.rowCount || 0);

    // 2) Assign Chris the newest callable Veteran leads excluding CT/PA/NJ.
    //    Refill count = pulled count so this is a true "pull back + replace" operation.
    let assignedCount = 0;
    if (pulledCount > 0) {
      const assigned = await client.query(
        `
        WITH newest_callable AS (
          SELECT ml.id
          FROM masterlead ml
          WHERE (ml.cn_email IS NULL OR btrim(ml.cn_email) = '')
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(NULLIF(lower(btrim(ml.dnc::text)), ''), 'false') <> 'true'
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND (
              CASE
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%'
                  THEN 'Veteran'
                ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
              END
            ) = 'Veteran'
            AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($2::text[])
          ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
          LIMIT $3
          FOR UPDATE SKIP LOCKED
        )
        UPDATE masterlead ml
        SET previous_cn_email = COALESCE(NULLIF(btrim(ml.cn_email), ''), ml.previous_cn_email),
            cn_email = $1,
            cnresolution = 'pending',
            assigned_date = NOW(),
            last_assigned_date = NOW(),
            updated_at = NOW()
        FROM newest_callable nc
        WHERE ml.id = nc.id
        RETURNING ml.id
        `,
        [TARGET_EMAIL, EXCLUDED_STATES, pulledCount],
      );
      assignedCount = Number(assigned.rowCount || 0);
    }

    // 3) Clear any queued/active leasedialer assignments for Chris in excluded states.
    //    This ensures no CT/PA/NJ Veteran queue remains tied to Chris after the swap.
    const releasedBadStates = await client.query(
      `
      DELETE FROM leasedialer_assignments la
      USING masterlead ml
      WHERE la.lead_id = ml.id
        AND lower(la.agent_email) = lower($1)
        AND la.status IN ('queued', 'active')
        AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
      RETURNING la.lead_id
      `,
      [TARGET_EMAIL, EXCLUDED_STATES],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          targetEmail: TARGET_EMAIL,
          excludedStates: EXCLUDED_STATES,
          pulledVeteranAssignedFromChris: pulledCount,
          assignedNewestCallableVeteranToChris: assignedCount,
          releasedQueuedOrActiveInExcludedStates: Number(releasedBadStates.rowCount || 0),
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
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

