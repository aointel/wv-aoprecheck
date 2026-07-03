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
    await client.query("BEGIN");
    let invalidInsertBlocked = false;
    try {
      await client.query(`
        INSERT INTO masterlead (phone, first_name, last_name, cnresolution, created_at, updated_at)
        VALUES ('12345', 'TEST', 'BADPHONE', 'pending', NOW(), NOW())
      `);
    } catch (e) {
      invalidInsertBlocked = true;
      console.log("invalid_insert_blocked:", String(e.message || e).slice(0, 220));
    }
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ invalidInsertBlocked }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
