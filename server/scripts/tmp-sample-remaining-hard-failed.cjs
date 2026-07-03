const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT ml.id, ml.phone, ml.phone_last10, ml.cnresolution
      FROM masterlead ml
      WHERE EXISTS (
        SELECT 1
        FROM twilio_call_logs t
        WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND lower(COALESCE(t.call_status, '')) = 'failed'
          AND t.call_started_at >= NOW() - INTERVAL '30 days'
          AND RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) =
              COALESCE(NULLIF(btrim(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10))
      )
      AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
      ORDER BY ml.updated_at DESC NULLS LAST
      LIMIT 200
    `);

    console.log(
      JSON.stringify(
        {
          count: result.rowCount,
          sample: result.rows.slice(0, 10),
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

