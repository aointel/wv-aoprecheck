const { Pool } = require("pg");

const leadKey = String(process.argv[2] || "").trim();
const resolution = String(process.argv[3] || "").trim();
const agentEmail = String(process.argv[4] || "manual@aoglobelife.com").trim();

if (!leadKey || !resolution) {
  console.error("Usage: node scripts/set-masterlead-resolution.cjs <taalk_lead_id_or_id> <resolution> [agentEmail]");
  process.exit(1);
}

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const updateSql = `
    UPDATE masterlead
    SET
      cnresolution = $2,
      cn_email = COALESCE(NULLIF(TRIM(cn_email), ''), $3),
      updated_at = NOW(),
      last_contacted = NOW()
    WHERE taalk_lead_id = $1
       OR id::text = $1
    RETURNING id, taalk_lead_id, first_name, last_name, phone, cn_email, cnresolution, updated_at, last_contacted
  `;

  const result = await pool.query(updateSql, [leadKey, resolution, agentEmail]);
  console.log(
    JSON.stringify(
      {
        leadKey,
        resolution,
        updatedRows: result.rowCount || 0,
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
