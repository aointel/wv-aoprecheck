const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const whereSql = `
      created_at < (NOW() - INTERVAL '6 months')
      AND (
        LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
        OR LOWER(COALESCE(market, '')) LIKE '%globe%'
        OR LOWER(COALESCE(taalk_market, '')) LIKE '%veteran%'
        OR LOWER(COALESCE(market, '')) LIKE '%veteran%'
      )
      AND (
        cnresolution IS NULL
        OR LOWER(TRIM(cnresolution)) IN ('pending', 'no answer', 'called')
      )
    `;

    const before = await client.query(
      `SELECT COUNT(*)::bigint AS n FROM masterlead WHERE ${whereSql}`,
    );
    const targetBefore = Number(before.rows?.[0]?.n || 0);

    let deletedTotal = 0;
    const batchSize = 2000;

    while (true) {
      const del = await client.query(
        `
          WITH pick AS (
            SELECT id
            FROM masterlead
            WHERE ${whereSql}
            ORDER BY id
            LIMIT $1
          )
          DELETE FROM masterlead m
          USING pick
          WHERE m.id = pick.id
        `,
        [batchSize],
      );
      const changed = Number(del.rowCount || 0);
      deletedTotal += changed;
      if (changed === 0) break;
      console.log(`purge batch deleted=${changed} total_deleted=${deletedTotal}`);
    }

    const after = await client.query(
      `SELECT COUNT(*)::bigint AS n FROM masterlead WHERE ${whereSql}`,
    );
    const targetAfter = Number(after.rows?.[0]?.n || 0);

    console.log(
      JSON.stringify(
        {
          purge: 'old_globe_veteran_unworked',
          target_before: targetBefore,
          deleted_total: deletedTotal,
          target_after: targetAfter,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

