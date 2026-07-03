const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 0,
    query_timeout: 0,
  });
  await client.connect();
  try {
    const failedPhonesResult = await client.query(`
      SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10
      FROM twilio_call_logs
      WHERE lower(COALESCE(call_status, '')) = 'failed'
        AND call_started_at >= NOW() - INTERVAL '30 days'
        AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
    `);

    const failedPhones = failedPhonesResult.rows.map((r) => r.phone10).filter(Boolean);
    const phonesMarked = new Set();
    let totalRowsMarkedFailed = 0;
    let skippedBatches = 0;
    const batchSize = 150;
    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '20s'");

    for (let i = 0; i < failedPhones.length; i += batchSize) {
      const batch = failedPhones.slice(i, i + batchSize);
      try {
        const update = await client.query(
          `
            WITH updated AS (
              UPDATE masterlead ml
              SET cnresolution = 'failed',
                  updated_at = NOW()
              WHERE ml.phone_last10 = ANY($1::text[])
                AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              RETURNING ml.phone_last10
            )
            SELECT COUNT(*)::int AS rows_marked_failed,
                   ARRAY_AGG(DISTINCT phone_last10) AS phones
            FROM updated
          `,
          [batch]
        );
        totalRowsMarkedFailed += update.rows[0]?.rows_marked_failed || 0;
        for (const phone of update.rows[0]?.phones || []) {
          if (phone) phonesMarked.add(phone);
        }
      } catch (error) {
        skippedBatches += 1;
      }
    }

    const fallbackResult = await client.query(
      `
        WITH failed_phones AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10
          FROM twilio_call_logs
          WHERE lower(COALESCE(call_status, '')) = 'failed'
            AND call_started_at >= NOW() - INTERVAL '30 days'
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
        ),
        updated AS (
          UPDATE masterlead ml
          SET cnresolution = 'failed',
              updated_at = NOW()
          WHERE (ml.phone_last10 IS NULL OR btrim(ml.phone_last10) = '')
            AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND EXISTS (
              SELECT 1
              FROM failed_phones fp
              WHERE fp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
            )
          RETURNING RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone10
        )
        SELECT COUNT(*)::int AS rows_marked_failed,
               ARRAY_AGG(DISTINCT phone10) AS phones
        FROM updated
      `
    );
    totalRowsMarkedFailed += fallbackResult.rows[0]?.rows_marked_failed || 0;
    for (const phone of fallbackResult.rows[0]?.phones || []) {
      if (phone) phonesMarked.add(phone);
    }

    console.log(
      JSON.stringify(
        {
          hard_failed_phone_count_30d: failedPhones.length,
          rows_marked_failed: totalRowsMarkedFailed,
          distinct_phones_marked_failed: phonesMarked.size,
          batch_size: batchSize,
          skipped_batches_due_to_locks_or_timeouts: skippedBatches,
          fallback_rows_marked_failed: fallbackResult.rows[0]?.rows_marked_failed || 0,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

