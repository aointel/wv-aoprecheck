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
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE masterlead
      DROP CONSTRAINT IF EXISTS masterlead_phone_canonical_check;
    `);

    await client.query(`
      ALTER TABLE masterlead
      ADD CONSTRAINT masterlead_phone_canonical_check
      CHECK (
        regexp_replace(COALESCE(phone::text, ''), '\\D', '', 'g') ~ '^1[2-9][0-9]{2}[2-9][0-9]{6}$'
        AND regexp_replace(COALESCE(phone_last10::text, ''), '\\D', '', 'g') =
            right(regexp_replace(COALESCE(phone::text, ''), '\\D', '', 'g'), 10)
      ) NOT VALID;
    `);

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          reverted: true,
          constraint: "masterlead_phone_canonical_check restored to strict 11-digit canonical format",
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

