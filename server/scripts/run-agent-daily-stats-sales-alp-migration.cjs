const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  await pool.query(`
    ALTER TABLE agent_daily_stats
      ADD COLUMN IF NOT EXISTS sales INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE agent_daily_stats
      ADD COLUMN IF NOT EXISTS alp NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);

  const verify = await pool.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'agent_daily_stats'
      AND column_name IN ('sales', 'alp')
    ORDER BY column_name;
  `);

  console.log(JSON.stringify({ ok: true, columns: verify.rows }, null, 2));
}

run()
  .catch((err) => {
    console.error(err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
