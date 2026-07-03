const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function listColumns(client) {
  const res = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'masterlead'
      ORDER BY ordinal_position
    `,
  );
  return res.rows.map((r) => r.column_name);
}

function pickExisting(cols, names) {
  for (const n of names) if (cols.includes(n)) return n;
  return null;
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const cols = await listColumns(client);
    const cnResolutionCol = pickExisting(cols, ['cnresolution', 'cn_resolution']);
    const cnEmailCol = pickExisting(cols, ['cn_email', 'cnemail']);
    const previousCnEmailCol = pickExisting(cols, [
      'previous_cn_email',
      'previous_cnemail',
      'prev_cn_email',
      'previous_email',
      'previous_cn',
    ]);
    const leaseStatusCol = pickExisting(cols, ['lease_status', 'leasestatus']);
    const leaseExpiresCol = pickExisting(cols, ['lease_expires_at', 'leased_until', 'lease_until']);
    const leaseAssignedCol = pickExisting(cols, ['leased_at', 'lease_assigned_at']);

    if (!cnResolutionCol || !cnEmailCol || !previousCnEmailCol) {
      throw new Error(
        `Missing required columns: cnResolution=${cnResolutionCol}, cnEmail=${cnEmailCol}, previousCnEmail=${previousCnEmailCol}`,
      );
    }

    const filterSql = `
      (
        ${cnResolutionCol} IS NULL
        OR LOWER(TRIM(${cnResolutionCol})) IN ('called', 'pending', 'no answer')
      )
      AND COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NOT NULL
      AND COALESCE(NULLIF(TRIM(${previousCnEmailCol}), ''), NULL) IS NOT NULL
    `;

    const beforeCount = await client.query(`SELECT COUNT(*)::int AS n FROM masterlead WHERE ${filterSql}`);

    const setParts = [`${cnEmailCol} = NULL`, `${cnResolutionCol} = NULL`];
    if (leaseStatusCol) setParts.push(`${leaseStatusCol} = NULL`);
    if (leaseExpiresCol) setParts.push(`${leaseExpiresCol} = NULL`);
    if (leaseAssignedCol) setParts.push(`${leaseAssignedCol} = NULL`);

    let unleasedUpdatedTotal = 0;
    const unleaseBatchSize = 1000;
    let lastId = 0;
    while (true) {
      const pick = await client.query(
        `
          SELECT id
          FROM masterlead
          WHERE id > $1
            AND ${filterSql}
          ORDER BY id ASC
          LIMIT $2
        `,
        [lastId, unleaseBatchSize],
      );
      const ids = pick.rows.map((r) => Number(r.id)).filter(Number.isFinite);
      if (ids.length === 0) break;
      lastId = ids[ids.length - 1];
      const batchUpdate = await client.query(
        `
          UPDATE masterlead
          SET ${setParts.join(', ')}, updated_at = NOW()
          WHERE id = ANY($1::int[])
        `,
        [ids],
      );
      const changed = Number(batchUpdate.rowCount || 0);
      unleasedUpdatedTotal += changed;
      console.log(`unlease batch ids=${ids.length} updated=${changed} total=${unleasedUpdatedTotal}`);
    }

    let mismatchLeasedAssigned = 0;
    let mismatchAssignedLeased = 0;
    let fixedLeaseMismatchRows = 0;

    if (leaseStatusCol && cnEmailCol) {
      const mismatchA = await client.query(
        `
          SELECT COUNT(*)::int AS n
          FROM masterlead
          WHERE LOWER(COALESCE(${leaseStatusCol}, '')) = 'leased_out'
            AND COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NULL
        `,
      );
      mismatchLeasedAssigned = Number(mismatchA.rows[0]?.n || 0);

      const mismatchB = await client.query(
        `
          SELECT COUNT(*)::int AS n
          FROM masterlead
          WHERE LOWER(COALESCE(${leaseStatusCol}, '')) <> 'leased_out'
            AND COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NOT NULL
        `,
      );
      mismatchAssignedLeased = Number(mismatchB.rows[0]?.n || 0);

      const mismatchWhere = `
        (
          (LOWER(COALESCE(${leaseStatusCol}, '')) = 'leased_out' AND COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NULL)
          OR
          (LOWER(COALESCE(${leaseStatusCol}, '')) <> 'leased_out' AND COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NOT NULL)
        )
      `;
      const fixBatchSize = 1000;
      let lastFixId = 0;
      while (true) {
        const pick = await client.query(
          `
            SELECT id
            FROM masterlead
            WHERE id > $1
              AND ${mismatchWhere}
            ORDER BY id ASC
            LIMIT $2
          `,
          [lastFixId, fixBatchSize],
        );
        const ids = pick.rows.map((r) => Number(r.id)).filter(Number.isFinite);
        if (ids.length === 0) break;
        lastFixId = ids[ids.length - 1];
        const fixRes = await client.query(
          `
            UPDATE masterlead
            SET ${leaseStatusCol} = CASE
              WHEN COALESCE(NULLIF(TRIM(${cnEmailCol}), ''), NULL) IS NOT NULL THEN 'leased_out'
              ELSE NULL
            END,
            updated_at = NOW()
            WHERE id = ANY($1::int[])
          `,
          [ids],
        );
        const changed = Number(fixRes.rowCount || 0);
        fixedLeaseMismatchRows += changed;
        console.log(`fix batch ids=${ids.length} updated=${changed} total=${fixedLeaseMismatchRows}`);
      }
    }

    const afterCount = await client.query(`SELECT COUNT(*)::int AS n FROM masterlead WHERE ${filterSql}`);

    console.log(
      JSON.stringify(
        {
          columns_used: {
            cnResolutionCol,
            cnEmailCol,
            previousCnEmailCol,
            leaseStatusCol,
            leaseExpiresCol,
            leaseAssignedCol,
          },
          unlease_target_before: Number(beforeCount.rows[0]?.n || 0),
          unleased_rows_updated: unleasedUpdatedTotal,
          unlease_target_after: Number(afterCount.rows[0]?.n || 0),
          lease_mismatch_checks: {
            leased_out_but_unassigned: mismatchLeasedAssigned,
            assigned_but_not_leased_out: mismatchAssignedLeased,
            fixed_lease_status_rows: fixedLeaseMismatchRows,
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

