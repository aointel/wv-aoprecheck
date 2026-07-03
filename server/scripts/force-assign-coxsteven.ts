import { pool } from "../db";

async function main() {
  const email = "coxsteven@aoglobelife.com";
  const sql = `
    WITH picked AS (
      SELECT id
      FROM masterlead
      WHERE (cn_email IS NULL OR cn_email = '')
        AND LOWER(COALESCE(cnresolution, 'pending')) = 'pending'
        AND LOWER(COALESCE(taalk_market, market, '')) LIKE '%globe market%'
        AND UPPER(COALESCE(state, taalk_state, '')) IN ('AZ','CA','MN','OH','OR','SD','TN','TX','VA','WA')
      LIMIT 25
    )
    UPDATE masterlead m
    SET cn_email = $1,
        cnresolution = 'pending',
        updated_at = NOW()
    FROM picked p
    WHERE m.id = p.id
    RETURNING m.id
  `;

  const result = await pool.query<{ id: string }>(sql, [email]);
  console.log(
    JSON.stringify(
      {
        email,
        assigned: result.rowCount || 0,
        sampleIds: (result.rows || []).slice(0, 10).map((r) => r.id),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

