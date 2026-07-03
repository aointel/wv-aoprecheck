const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 60000,
    query_timeout: 60000,
  });
  await client.connect();
  try {
    await client.query(`ALTER TABLE masterlead DROP CONSTRAINT IF EXISTS masterlead_phone_canonical_check;`);
    console.log(JSON.stringify({ dropped: true, constraint: "masterlead_phone_canonical_check" }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

