const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const before = await client.query(
      `
        SELECT COUNT(*)::int AS assigned_count
        FROM masterlead
        WHERE COALESCE(BTRIM(cn_email), '') <> ''
      `,
    );

    const update = await client.query(
      `
        UPDATE masterlead
        SET previous_cn_email = COALESCE(NULLIF(BTRIM(cn_email), ''), previous_cn_email),
            last_assigned_date = NOW(),
            cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        WHERE COALESCE(BTRIM(cn_email), '') <> ''
      `,
    );

    const after = await client.query(
      `
        SELECT COUNT(*)::int AS assigned_count
        FROM masterlead
        WHERE COALESCE(BTRIM(cn_email), '') <> ''
      `,
    );

    console.log(
      JSON.stringify(
        {
          before_assigned: Number(before.rows[0]?.assigned_count || 0),
          recalled: Number(update.rowCount || 0),
          after_assigned: Number(after.rows[0]?.assigned_count || 0),
          completed_at: new Date().toISOString(),
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

