const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const windowDays = Number(process.argv[2] || 5);
    const sql = `
      WITH recent AS (
        SELECT
          created_at,
          COALESCE(
            NULLIF(upper(btrim(taalk_state::text)), ''),
            NULLIF(upper(btrim(state::text)), ''),
            'UNKNOWN'
          ) AS state_code
        FROM masterlead
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      )
      SELECT
        state_code,
        COUNT(*)::int AS added_count,
        MIN(created_at) AS first_seen,
        MAX(created_at) AS last_seen
      FROM recent
      GROUP BY state_code
      ORDER BY added_count DESC, state_code ASC
    `;
    const result = await client.query(sql, [windowDays]);
    const totalAdded = result.rows.reduce((n, row) => n + Number(row.added_count || 0), 0);
    console.log(
      JSON.stringify(
        {
          window_days: windowDays,
          total_added: totalAdded,
          states: result.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
