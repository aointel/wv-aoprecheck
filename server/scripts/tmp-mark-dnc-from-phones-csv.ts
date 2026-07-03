import { leaseDialerPool as pool } from "../db";
import { readFile } from "node:fs/promises";

function normalizePhone(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return "";
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error("Usage: npx tsx server/scripts/tmp-mark-dnc-from-phones-csv.ts <csv_path>");
  }

  const raw = await readFile(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) throw new Error("CSV has no data rows");

  const phones = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const [phone] = lines[i].split(",");
    const normalized = normalizePhone(phone || "");
    if (normalized) phones.add(normalized);
  }
  if (phones.size === 0) throw new Error("No valid phone numbers found in CSV");

  const phoneList = Array.from(phones);
  const colsRes = await pool.query<{ column_name: string }>({
    text: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='masterlead'
    `,
    query_timeout: 300000,
  });
  const cols = new Set(colsRes.rows.map((r) => r.column_name));
  const setParts = ["dnc = TRUE", "cnresolution = 'do_not_call'"];
  if (cols.has("TaalkResolve")) setParts.push(`"TaalkResolve" = TRUE`);
  if (cols.has("updated_at")) setParts.push("updated_at = NOW()");

  const deleteAssignmentsSql = `
    DELETE FROM leasedialer_assignments la
    WHERE la.lead_id::text = ANY($1::text[])
    RETURNING la.lead_id
  `;

  const CHUNK = 50;
  let updatedTotal = 0;
  let deletedTotal = 0;
  for (let i = 0; i < phoneList.length; i += CHUNK) {
    const chunk = phoneList.slice(i, i + CHUNK);
    const chunkPlusOne = chunk.map((p) => `1${p}`);
    const chunkPlusPrefixed = chunk.map((p) => `+1${p}`);
    const chunkPrefixedOnly = chunk.map((p) => `+${p}`);
    await pool.query("BEGIN");
    try {
      const updated = await pool.query<{ id: string }>({
        text: `
          WITH target AS (
            SELECT DISTINCT m.id::text AS id
            FROM masterlead m
            WHERE COALESCE(m.phone::text, '') = ANY($1::text[])
               OR COALESCE(m.phone_number::text, '') = ANY($1::text[])
               OR COALESCE(m.phone::text, '') = ANY($2::text[])
               OR COALESCE(m.phone_number::text, '') = ANY($2::text[])
               OR COALESCE(m.phone::text, '') = ANY($3::text[])
               OR COALESCE(m.phone_number::text, '') = ANY($3::text[])
               OR COALESCE(m.phone::text, '') = ANY($4::text[])
               OR COALESCE(m.phone_number::text, '') = ANY($4::text[])
          )
          UPDATE masterlead m
          SET ${setParts.join(", ")}
          WHERE m.id::text IN (SELECT id FROM target)
          RETURNING m.id::text AS id
        `,
        values: [chunk, chunkPlusOne, chunkPlusPrefixed, chunkPrefixedOnly],
        query_timeout: 300000,
      });
      const updatedIds = updated.rows.map((r) => r.id);
      const deletedAssignments =
        updatedIds.length > 0
          ? await pool.query({
              text: deleteAssignmentsSql,
              values: [updatedIds],
              query_timeout: 300000,
            })
          : { rowCount: 0 };
      await pool.query("COMMIT");
      updatedTotal += updated.rowCount ?? 0;
      deletedTotal += deletedAssignments.rowCount ?? 0;
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  }

  console.log(
    JSON.stringify(
      {
        csv_path: csvPath,
        phones_in_csv: phoneList.length,
        masterlead_rows_marked_dnc: updatedTotal,
        leasedialer_assignments_deleted: deletedTotal,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("tmp-mark-dnc-from-phones-csv failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

