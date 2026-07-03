const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const limit = Math.max(1, Math.min(500, Number(process.argv[2] || 100)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const exact = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM masterlead
      WHERE COALESCE(btrim(cn_email), '') <> ''
        AND cnresolution IS NULL
      `,
    );

    const nullLike = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM masterlead
      WHERE COALESCE(btrim(cn_email), '') <> ''
        AND (cnresolution IS NULL OR lower(btrim(cnresolution)) = 'null')
      `,
    );

    const rows = await client.query(
      `
      SELECT
        id,
        lower(btrim(cn_email)) AS cn_email,
        cnresolution,
        created_at,
        updated_at
      FROM masterlead
      WHERE COALESCE(btrim(cn_email), '') <> ''
        AND cnresolution IS NULL
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT $1
      `,
      [limit],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          exact_null_count: Number(exact.rows[0]?.count || 0),
          null_or_string_null_count: Number(nullLike.rows[0]?.count || 0),
          sample_limit: limit,
          sample_rows: rows.rows,
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
