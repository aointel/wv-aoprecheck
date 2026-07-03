const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const BATCH_SIZE = Math.max(100, Number(process.env.BATCH_SIZE || 1000));

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    let totalDeleted = 0;
    const deletedByState = { TX: 0, NV: 0 };

    for (;;) {
      const del = await client.query(
        `
        WITH pick AS (
          SELECT id
          FROM masterlead
          WHERE UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) IN ('TX', 'NV')
            AND (
              cnresolution IS NULL
              OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', 'no answer')
            )
          ORDER BY id
          LIMIT $1
        )
        DELETE FROM masterlead m
        USING pick
        WHERE m.id = pick.id
        RETURNING UPPER(COALESCE(NULLIF(TRIM(m.state), ''), '??')) AS state
        `,
        [BATCH_SIZE],
      );

      const rows = del.rows || [];
      if (rows.length === 0) break;

      totalDeleted += rows.length;
      for (const r of rows) {
        const st = String(r.state || '').toUpperCase();
        if (st === 'TX') deletedByState.TX += 1;
        if (st === 'NV') deletedByState.NV += 1;
      }

      console.log(`[purge-tx-nv-unworked-resume] deleted batch=${rows.length} total=${totalDeleted}`);
    }

    console.log(
      JSON.stringify(
        {
          batchSize: BATCH_SIZE,
          deleted: {
            total: totalDeleted,
            by_state: deletedByState,
          },
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

