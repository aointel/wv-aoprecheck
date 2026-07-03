const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const apply = process.argv.includes("--apply");
  const idStep = Math.max(5000, Math.min(100000, Number(process.env.RESET_ID_STEP || 25000)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();
  try {
    const preview = await client.query(
      `
      WITH candidates AS (
        SELECT ml.id
        FROM masterlead ml
        WHERE COALESCE(btrim(ml.cn_email), '') <> ''
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM leasedialer_assignments la
            WHERE la.lead_id = ml.id
              AND la.status IN ('queued', 'active')
          )
      )
      SELECT COUNT(*)::int AS candidate_count
      FROM candidates
      `,
    );

    const candidateCount = Number(preview.rows[0]?.candidate_count || 0);

    if (!apply || candidateCount === 0) {
      console.log(
        JSON.stringify(
          {
            mode: apply ? "apply_noop" : "preview",
            candidate_count: candidateCount,
          },
          null,
          2,
        ),
      );
      return;
    }

    const bounds = await client.query(
      `
      SELECT COALESCE(MIN(id), 0)::int AS min_id, COALESCE(MAX(id), 0)::int AS max_id
      FROM masterlead
      `,
    );
    const minId = Number(bounds.rows[0]?.min_id || 0);
    const maxId = Number(bounds.rows[0]?.max_id || 0);

    let clearedTotal = 0;
    let passes = 0;
    for (let start = minId; start <= maxId; start += idStep) {
      const end = start + idStep;
      const updated = await client.query(
        `
        WITH candidates AS (
          SELECT ml.id
          FROM masterlead ml
          WHERE ml.id >= $1
            AND ml.id < $2
            AND COALESCE(btrim(ml.cn_email), '') <> ''
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
          ORDER BY ml.id
          FOR UPDATE SKIP LOCKED
        ),
        updated AS (
          UPDATE masterlead ml
          SET cn_email = NULL,
              assigned_date = NULL,
              updated_at = NOW()
          FROM candidates c
          WHERE ml.id = c.id
          RETURNING ml.id
        )
        SELECT COUNT(*)::int AS cleared_count FROM updated
        `,
        [start, end],
      );
      const cleared = Number(updated.rows[0]?.cleared_count || 0);
      clearedTotal += cleared;
      passes += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: "apply",
          id_step: idStep,
          passes,
          candidate_count: candidateCount,
          cleared_count: clearedTotal,
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
