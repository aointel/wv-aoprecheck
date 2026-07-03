const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = `
    WITH base AS (
      SELECT DISTINCT ON (
        COALESCE(
          NULLIF(TRIM(twilio_call_sid), ''),
          CONCAT('nosid:', COALESCE(id::text, '0'))
        )
      )
        COALESCE(
          NULLIF(TRIM(twilio_call_sid), ''),
          CONCAT('nosid:', COALESCE(id::text, '0'))
        ) AS dial_key,
        LOWER(TRIM(COALESCE(owner_email, ''))) AS owner_email,
        COALESCE(call_duration, 0) AS call_duration
      FROM twilio_call_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND COALESCE(call_direction, 'outbound') = 'outbound'
      ORDER BY
        COALESCE(
          NULLIF(TRIM(twilio_call_sid), ''),
          CONCAT('nosid:', COALESCE(id::text, '0'))
        ),
        created_at DESC
    )
    SELECT
      COUNT(*)::int AS unique_dials_24h,
      COUNT(DISTINCT owner_email)::int AS unique_users_24h,
      COUNT(*) FILTER (WHERE call_duration > 45)::int AS unique_dials_over_45s_24h
    FROM base
  `;

  const { rows } = await pool.query(sql);
  console.log(JSON.stringify(rows[0] || {}, null, 2));
}

run()
  .catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

