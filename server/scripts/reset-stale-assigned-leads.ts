import { pool } from "../db";

const RESOLUTION_NORMALIZED = [
  "pending",
  "callback",
  "call back",
  "call_back",
  "call-back",
  "no_answer",
  "no answer",
  "no_answer_vm",
  "no answer vm",
  "no_answer_voicemail",
];

function buildResolutionListSql(): string {
  return RESOLUTION_NORMALIZED.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const resolutionListSql = buildResolutionListSql();

  const whereSql = `
    updated_at < (NOW() - INTERVAL '2 hours')
    AND NULLIF(BTRIM(COALESCE(cn_email, '')), '') IS NOT NULL
    AND (
      cnresolution IS NULL
      OR lower(btrim(coalesce(cnresolution, ''))) IN (${resolutionListSql})
    )
  `;

  const countSql = `
    SELECT COUNT(*)::int AS affected
    FROM masterlead
    WHERE ${whereSql}
  `;

  const countRes = await pool.query<{ affected: number }>(countSql);
  const affected = Number(countRes.rows[0]?.affected || 0);

  console.log(`Leads matching reset rule: ${affected}`);
  console.log(`Mode: ${apply ? "LIVE (--apply)" : "PREVIEW (no changes)"}`);

  if (!apply || affected === 0) {
    return;
  }

  const updateSql = `
    UPDATE masterlead
    SET cn_email = NULL,
        updated_at = NOW()
    WHERE ${whereSql}
  `;

  const updateRes = await pool.query(updateSql);
  const updated = Number(updateRes.rowCount || 0);
  console.log(`Rows updated (cn_email cleared): ${updated}`);
}

main()
  .then(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Reset script failed:", err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

