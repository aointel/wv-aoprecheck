const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const totalsSql = `
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(TRIM(cn_email), '') <> '')::int AS assigned,
      COUNT(*) FILTER (WHERE COALESCE(TRIM(cn_email), '') = '')::int AS unassigned,
      COUNT(*)::int AS total
    FROM masterlead
    WHERE LOWER(COALESCE(dnc::text, 'false')) IN ('false', 'f', '0', 'no', '')
      AND (
        cnresolution IS NULL
        OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', '')
      )
  `;

  const topAgentsSql = `
    SELECT
      LOWER(TRIM(cn_email)) AS agent_email,
      COUNT(*)::int AS leads
    FROM masterlead
    WHERE LOWER(COALESCE(dnc::text, 'false')) IN ('false', 'f', '0', 'no', '')
      AND COALESCE(TRIM(cn_email), '') <> ''
      AND (
        cnresolution IS NULL
        OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', '')
      )
    GROUP BY LOWER(TRIM(cn_email))
    ORDER BY leads DESC
    LIMIT 20
  `;

  const [totals, topAgents] = await Promise.all([
    pool.query(totalsSql),
    pool.query(topAgentsSql),
  ]);

  console.log(
    JSON.stringify(
      {
        pool: totals.rows[0] || null,
        topAgents: topAgents.rows || [],
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
