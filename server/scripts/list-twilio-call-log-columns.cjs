const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'twilio_call_logs'
    ORDER BY ordinal_position
  `);
  console.log(rows.map((r) => r.column_name).join("\n"));
}

run()
  .catch((e) => {
    console.error(e?.message || String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

