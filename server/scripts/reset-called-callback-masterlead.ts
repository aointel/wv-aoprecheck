import { pool } from "../db";

const STATUS_NORMALIZED = ["called", "callback", "call back", "call_back", "call-back"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const statusListSql = STATUS_NORMALIZED.map((s) => `'${s}'`).join(", ");

  const countSql = `
    SELECT COUNT(*)::int AS c
    FROM masterlead
    WHERE lower(trim(coalesce(cnresolution, ''))) IN (${statusListSql})
  `;

  const before = await pool.query<{ c: number }>(countSql);
  const eligible = Number(before.rows[0]?.c || 0);

  console.log(`Eligible rows (called/callback variants): ${eligible}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  if (dryRun || eligible === 0) {
    return;
  }

  const updateSql = `
    UPDATE masterlead
    SET cnresolution = NULL,
        cn_email = NULL,
        updated_at = NOW()
    WHERE lower(trim(coalesce(cnresolution, ''))) IN (${statusListSql})
  `;

  const updated = await pool.query(updateSql);
  const updatedCount = Number(updated.rowCount || 0);
  console.log(`Updated rows: ${updatedCount}`);

  const after = await pool.query<{ c: number }>(countSql);
  const remaining = Number(after.rows[0]?.c || 0);
  console.log(`Remaining eligible rows after reset: ${remaining}`);
}

main()
  .then(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Reset failed:", err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

