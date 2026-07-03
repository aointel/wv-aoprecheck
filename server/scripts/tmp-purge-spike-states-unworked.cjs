const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const TARGETS = [
  { state: 'MA', day: '2026-04-02' },
  { state: 'RI', day: '2026-04-02' },
  { state: 'CA', day: '2026-05-01' },
  { state: 'NC', day: '2026-03-26' },
];

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    await client.query(`SET lock_timeout = '5000ms'`);
    await client.query(`SET idle_in_transaction_session_timeout = '120000ms'`);

    const summary = [];
    let deletedTotal = 0;

    for (const t of TARGETS) {
      const whereSql = `
        UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) = $1
        AND created_at >= (($2::date::timestamp AT TIME ZONE 'America/New_York'))
        AND created_at < ((($2::date + 1)::timestamp AT TIME ZONE 'America/New_York'))
        AND (
          LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
          OR LOWER(COALESCE(market, '')) LIKE '%globe%'
        )
        AND (
          cnresolution IS NULL
          OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', 'no answer')
        )
      `;

      const before = await client.query(
        `SELECT COUNT(*)::int AS n FROM masterlead WHERE ${whereSql}`,
        [t.state, t.day],
      );
      const targetBefore = Number(before.rows?.[0]?.n || 0);

      let stateDeleted = 0;
      const batchSize = 1000;
      let lastId = 0;
      while (true) {
        const pick = await client.query(
          `
            SELECT id
            FROM masterlead
            WHERE id > $3
              AND ${whereSql}
            ORDER BY id ASC
            LIMIT $4
          `,
          [t.state, t.day, lastId, batchSize],
        );
        const ids = pick.rows.map((r) => Number(r.id)).filter(Number.isFinite);
        if (ids.length === 0) break;
        lastId = ids[ids.length - 1];

        const del = await client.query(
          `
            DELETE FROM masterlead
            WHERE id = ANY($1::int[])
          `,
          [ids],
        );
        const changed = Number(del.rowCount || 0);
        stateDeleted += changed;
        deletedTotal += changed;
      }

      const after = await client.query(
        `SELECT COUNT(*)::int AS n FROM masterlead WHERE ${whereSql}`,
        [t.state, t.day],
      );
      const targetAfter = Number(after.rows?.[0]?.n || 0);

      summary.push({
        state: t.state,
        day: t.day,
        target_before: targetBefore,
        deleted: stateDeleted,
        target_after: targetAfter,
      });
    }

    console.log(
      JSON.stringify(
        {
          purge: 'globe_spike_states_unworked',
          deleted_total: deletedTotal,
          by_state_day: summary,
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

