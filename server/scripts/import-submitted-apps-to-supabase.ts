/**
 * Import pasted portal table into submitted_applications in Supabase.
 * Run: npx tsx server/scripts/import-submitted-apps-to-supabase.ts [path/to/paste.txt]
 * Default: submitted-apps-paste.txt in project root
 */

import * as fs from "fs";
import * as path from "path";
import { supabaseAdmin } from "../supabase";
import { parsePastedSubmittedApplications, computeAlp } from "../submitted-applications";

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const filePath =
    args[0] && !args[0].startsWith("--")
      ? path.resolve(process.cwd(), args[0])
      : path.join(process.cwd(), "submitted-apps-paste.txt");

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  let content =
    buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString("utf16le").replace(/^\uFEFF/, "")
      : buf.toString("utf8").replace(/^\uFEFF/, "");
  // If this looks like raw portal paste (UI chrome, "Showing" blocks, or "===== PAGE" dump), extract only data lines
  const isRawPaste =
    content.includes("Showing") ||
    content.includes("Review Apps") ||
    content.includes("===== PAGE");
  if (isRawPaste) {
    const header =
      "Insured\tAgent Release\tSGA Submit\tTenure\tPolicy #\tLOB\tCWA\tSubmit Type\tNILICO Status\tAgent\tOffice\tQA Specialist\tDirector\tTelecheck\tVerification Result\tSubmitted By\tMAC Status";
    const policyRe = new RegExp("^\\d{5,}$");
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const dataLines: string[] = [];
    for (const line of lines) {
      if (!line.includes("\t")) continue;
      const cells = line.split("\t").map((c) => c.trim());
      if (cells.length < 9) continue;
      const first = (cells[0] ?? "").toLowerCase();
      if (first === "insured" || first === "agent release") continue;
      const policy = (cells[4] ?? "").replace(/[$,]/g, "");
      if (!policyRe.test(policy)) continue;
      dataLines.push(line);
    }
    content = header + "\n" + dataLines.join("\n");
    console.log("Raw paste: extracted %d data rows", dataLines.length);
  }
  const rows = parsePastedSubmittedApplications(content);
  console.log("Parsed", rows.length, "rows from", filePath);

  if (rows.length === 0) {
    console.log("No rows to import.");
    return;
  }

  let inserted = 0;
  let updated = 0;
  const BATCH = 50;

  for (let b = 0; b < rows.length; b += BATCH) {
    const batch = rows.slice(b, b + BATCH);
    const policyNumbers = [...new Set(batch.map((r) => r.policy_number).filter(Boolean))] as string[];

    const existingMap = new Map<string, number>();
    if (policyNumbers.length > 0) {
      const { data: existingRows } = await supabaseAdmin
        .from("submitted_applications")
        .select("id, policy_number, sga_submit")
        .in("policy_number", policyNumbers);
      for (const r of existingRows ?? []) {
        const key = `${r.policy_number ?? ""}\0${r.sga_submit ?? ""}`;
        existingMap.set(key, r.id);
      }
    }

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: number; payload: Record<string, unknown> }[] = [];

    for (const row of batch) {
      const alp = computeAlp(row.lob, row.cwa);
      const payload = {
        insured: row.insured ?? null,
        agent_release: row.agent_release ?? null,
        sga_submit: row.sga_submit ?? null,
        tenure: row.tenure ?? null,
        policy_number: row.policy_number ?? null,
        lob: row.lob ?? null,
        cwa: row.cwa ?? null,
        alp: alp ?? null,
        submit_type: row.submit_type ?? null,
        nilico_status: row.nilico_status ?? null,
        agent: row.agent ?? null,
        office: row.office ?? null,
        qa_specialist: row.qa_specialist ?? null,
        director: row.director ?? null,
        telecheck: row.telecheck ?? null,
        verification_result: row.verification_result ?? null,
        submitted_by: row.submitted_by ?? null,
        mac_status: row.mac_status ?? null,
      };
      const key = `${payload.policy_number ?? ""}\0${payload.sga_submit ?? ""}`;
      const existingId = existingMap.get(key);
      if (existingId != null) {
        toUpdate.push({ id: existingId, payload });
      } else {
        toInsert.push(payload);
      }
    }

    await Promise.all(
      toUpdate.map(({ id, payload }) =>
        supabaseAdmin.from("submitted_applications").update(payload).eq("id", id)
      )
    );
    updated += toUpdate.length;

    if (toInsert.length > 0) {
      const { error: inErr } = await supabaseAdmin.from("submitted_applications").insert(toInsert);
      if (!inErr) inserted += toInsert.length;
    }

    if ((b + BATCH) % 500 === 0 || b + BATCH >= rows.length) {
      console.log("  Progress: %d / %d rows", Math.min(b + BATCH, rows.length), rows.length);
    }
  }

  console.log("Done. Inserted:", inserted, "Updated:", updated, "Total parsed:", rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
