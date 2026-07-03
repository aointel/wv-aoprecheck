const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const day = String(process.argv[2] || "2026-05-15").trim();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const byResolution = await client.query(
      `
        WITH w AS (
          SELECT
            ((($1::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS start_utc,
            ((((($1::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')) AS end_utc
        )
        SELECT
          lower(trim(COALESCE(cnresolution, ''))) AS cnresolution,
          COUNT(*)::int AS updated_rows
        FROM masterlead ml
        CROSS JOIN w
        WHERE ml.updated_at >= w.start_utc
          AND ml.updated_at < w.end_utc
          AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
        GROUP BY 1
        ORDER BY updated_rows DESC, cnresolution ASC
      `,
      [day],
    );

    const noAnswerRecent = await client.query(
      `
        SELECT COUNT(*)::int AS no_answer_last_2h
        FROM masterlead
        WHERE updated_at >= NOW() - INTERVAL '2 hours'
          AND lower(trim(COALESCE(cnresolution, ''))) = 'no_answer'
      `,
    );

    console.log(
      JSON.stringify(
        {
          day,
          terminal_resolution_updates_today: byResolution.rows,
          no_answer_last_2h: Number(noAnswerRecent.rows[0]?.no_answer_last_2h || 0),
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
