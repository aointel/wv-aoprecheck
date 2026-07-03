const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

function escCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const sql = `
      WITH daily AS (
        SELECT
          COALESCE(NULLIF(UPPER(TRIM(state)), ''), '??') AS state,
          (created_at AT TIME ZONE 'America/New_York')::date AS created_day_et,
          COUNT(*)::int AS leads_created
        FROM masterlead
        WHERE (
          LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
          OR LOWER(COALESCE(market, '')) LIKE '%globe%'
        )
        GROUP BY 1, 2
      ),
      ranked AS (
        SELECT
          d.*,
          ROW_NUMBER() OVER (PARTITION BY d.state ORDER BY d.leads_created DESC, d.created_day_et DESC) AS rn
        FROM daily d
      ),
      top2 AS (
        SELECT
          state,
          MAX(CASE WHEN rn = 1 THEN created_day_et END) AS peak_day,
          MAX(CASE WHEN rn = 1 THEN leads_created END) AS peak_count,
          MAX(CASE WHEN rn = 2 THEN created_day_et END) AS second_day,
          MAX(CASE WHEN rn = 2 THEN leads_created END) AS second_count
        FROM ranked
        WHERE rn <= 2
        GROUP BY state
      ),
      summary AS (
        SELECT
          state,
          COUNT(*)::int AS active_days,
          SUM(leads_created)::int AS total_created,
          AVG(leads_created)::numeric(12,2) AS avg_created,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY leads_created)::numeric(12,2) AS median_created
        FROM daily
        GROUP BY state
      )
      SELECT
        t.state,
        t.peak_day,
        t.peak_count,
        t.second_day,
        t.second_count,
        s.active_days,
        s.total_created,
        s.avg_created,
        s.median_created,
        CASE
          WHEN COALESCE(t.second_count, 0) = 0 THEN NULL
          ELSE ROUND((t.peak_count::numeric / t.second_count::numeric), 2)
        END AS peak_vs_second_ratio,
        CASE
          WHEN COALESCE(s.avg_created, 0) = 0 THEN NULL
          ELSE ROUND((t.peak_count::numeric / s.avg_created::numeric), 2)
        END AS peak_vs_avg_ratio
      FROM top2 t
      JOIN summary s USING (state)
      ORDER BY t.peak_count DESC, peak_vs_second_ratio DESC NULLS LAST;
    `;

    const result = await client.query(sql);
    const rows = result.rows || [];

    const outDir = path.join(__dirname, 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outCsv = path.join(outDir, `globe-state-created-spikes-${stamp}.csv`);

    const headers = [
      'state',
      'peak_day',
      'peak_count',
      'second_day',
      'second_count',
      'active_days',
      'total_created',
      'avg_created',
      'median_created',
      'peak_vs_second_ratio',
      'peak_vs_avg_ratio',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map((h) => escCsv(r[h])).join(','));
    }
    fs.writeFileSync(outCsv, lines.join('\n'));

    const focusStates = new Set(['RI', 'MA', 'CA', 'NC']);
    const focus = rows.filter((r) => focusStates.has(String(r.state || '').toUpperCase()));
    const likelySpikes = rows.filter((r) => {
      const peak = Number(r.peak_count || 0);
      const second = Number(r.second_count || 0);
      const ratio = second > 0 ? peak / second : 0;
      return peak >= 100 && ratio >= 2;
    });

    console.log(
      JSON.stringify(
        {
          total_states: rows.length,
          likely_spike_states_count: likelySpikes.length,
          likely_spike_states_top10: likelySpikes.slice(0, 10),
          focus_states: focus,
          csv_path: outCsv,
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

