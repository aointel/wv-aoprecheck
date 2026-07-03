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
    const byState = await client.query(`
      SELECT
        (created_at AT TIME ZONE 'America/New_York')::date AS day_et,
        TO_CHAR((created_at AT TIME ZONE 'America/New_York')::date, 'Dy') AS dow,
        UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) AS state,
        COUNT(*)::int AS leads
      FROM masterlead
      WHERE (
        LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
        OR LOWER(COALESCE(market, '')) LIKE '%globe%'
      )
        AND (created_at AT TIME ZONE 'America/New_York')::date IN (DATE '2026-04-30', DATE '2026-05-01')
      GROUP BY 1,2,3
      ORDER BY 1, 4 DESC, 3 ASC;
    `);

    const totals = await client.query(`
      SELECT
        (created_at AT TIME ZONE 'America/New_York')::date AS day_et,
        TO_CHAR((created_at AT TIME ZONE 'America/New_York')::date, 'Dy') AS dow,
        COUNT(*)::int AS total_leads
      FROM masterlead
      WHERE (
        LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
        OR LOWER(COALESCE(market, '')) LIKE '%globe%'
      )
        AND (created_at AT TIME ZONE 'America/New_York')::date IN (DATE '2026-04-30', DATE '2026-05-01')
      GROUP BY 1,2
      ORDER BY 1;
    `);

    const rows = byState.rows || [];
    const totalRows = totals.rows || [];
    const concentration = totalRows.map((t) => {
      const dayRows = rows.filter((r) => String(r.day_et).slice(0, 10) === String(t.day_et).slice(0, 10));
      const top = dayRows[0] || null;
      const total = Number(t.total_leads || 0);
      const topCount = Number(top?.leads || 0);
      return {
        day_et: t.day_et,
        dow: t.dow,
        total_leads: total,
        top_state: top?.state || null,
        top_state_leads: topCount,
        top_state_share_pct: total > 0 ? Number(((topCount / total) * 100).toFixed(2)) : null,
      };
    });

    console.log(
      JSON.stringify(
        {
          window: ['2026-04-30', '2026-05-01'],
          totals: totalRows,
          concentration,
          by_state: rows,
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

