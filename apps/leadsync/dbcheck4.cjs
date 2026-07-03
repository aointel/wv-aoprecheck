const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require" });
async function main() {
  const r = await pool.query(
    "SELECT id, cn_email, cnresolution FROM masterlead WHERE cn_email = $1 AND cnresolution = $2 ORDER BY id DESC LIMIT 5",
    ["chrislafond@aoglobelife.com", "pending"]
  );
  console.log("simple query rows:", r.rowCount);
  const r2 = await pool.query(
    "SELECT id, cn_email, cnresolution FROM masterlead WHERE COALESCE(cn_email, '') = $1 AND COALESCE(cnresolution, '') = $2 ORDER BY id DESC LIMIT 5",
    ["chrislafond@aoglobelife.com", "pending"]
  );
  console.log("coalesce query rows:", r2.rowCount);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
