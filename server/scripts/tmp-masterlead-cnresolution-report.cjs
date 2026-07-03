const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

function escCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
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
    const colsRes = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'masterlead'
      `
    );
    const cols = new Set(colsRes.rows.map((r) => String(r.column_name)));

    const cnResolutionCol = cols.has('cnresolution')
      ? 'cnresolution'
      : cols.has('cn_resolution')
      ? 'cn_resolution'
      : null;

    const cnEmailCol = cols.has('cn_email')
      ? 'cn_email'
      : cols.has('cnemail')
      ? 'cnemail'
      : null;

    const previousCandidates = [
      'previous_cn_email',
      'previous_cnemail',
      'prev_cn_email',
      'previous_email',
      'previous_cn',
    ];
    const previousCnEmailCol = previousCandidates.find((c) => cols.has(c)) || null;

    if (!cnResolutionCol || !cnEmailCol || !previousCnEmailCol) {
      throw new Error(
        `Missing required columns. cnResolution=${cnResolutionCol}, cnEmail=${cnEmailCol}, previousCnEmail=${previousCnEmailCol}`
      );
    }

    const baseWhere = `
      (
        ${cnResolutionCol} IS NULL
        OR LOWER(TRIM(${cnResolutionCol})) IN ('called', 'pending', 'no answer')
      )
      AND COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NOT NULL
      AND COALESCE(NULLIF(TRIM(${previousCnEmailCol}), ''), NULL) IS NOT NULL
    `;

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS total FROM masterlead WHERE ${baseWhere}`
    );
    const total = Number(countRes.rows?.[0]?.total || 0);

    const breakdownRes = await client.query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(${cnResolutionCol}), ''), 'NULL') AS cnresolution_bucket,
          COUNT(*)::int AS count
        FROM masterlead
        WHERE ${baseWhere}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
      `
    );

    const rowsRes = await client.query(
      `
        SELECT
          id,
          taalk_lead_id,
          phone,
          ${cnResolutionCol} AS cnresolution,
          ${cnEmailCol} AS cn_email,
          ${previousCnEmailCol} AS previous_cn_email,
          market,
          state,
          updated_at,
          created_at
        FROM masterlead
        WHERE ${baseWhere}
        ORDER BY updated_at DESC NULLS LAST, id DESC
      `
    );

    const outDir = path.join(__dirname, 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(outDir, `masterlead-cnresolution-called-pending-null-no-answer-${stamp}.csv`);

    const headers = [
      'id',
      'taalk_lead_id',
      'phone',
      'cnresolution',
      'cn_email',
      'previous_cn_email',
      'market',
      'state',
      'updated_at',
      'created_at',
    ];
    const lines = [headers.join(',')];
    for (const r of rowsRes.rows) {
      lines.push(
        headers
          .map((h) => escCsv(r[h]))
          .join(',')
      );
    }
    fs.writeFileSync(outPath, lines.join('\n'));

    console.log(JSON.stringify({
      total,
      breakdown: breakdownRes.rows,
      rows_exported: rowsRes.rows.length,
      csv_path: outPath,
      columns_used: {
        cnResolutionCol,
        cnEmailCol,
        previousCnEmailCol,
      },
    }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

