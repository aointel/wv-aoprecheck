const { Pool } = require("pg");

const leadId = String(process.argv[2] || "").trim();
if (!leadId) {
  console.error("Usage: node scripts/check-masterlead-status.cjs <taalk_lead_id_or_id>");
  process.exit(1);
}

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = `
    SELECT
      id,
      taalk_lead_id,
      first_name,
      last_name,
      phone,
      cn_email,
      cnresolution,
      status,
      updated_at,
      last_contacted
    FROM masterlead
    WHERE taalk_lead_id = $1
       OR id::text = $1
    ORDER BY updated_at DESC
    LIMIT 3
  `;

  const result = await pool.query(sql, [leadId]);
  console.log(
    JSON.stringify(
      {
        query: leadId,
        count: result.rowCount || 0,
        rows: result.rows || [],
      },
      null,
      2,
    ),
  );
}

run()
  .catch((err) => {
    console.error(err.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
