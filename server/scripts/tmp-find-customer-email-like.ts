import { supabaseAdmin } from "../supabase";

async function main() {
  const raw = String(process.argv[2] || "").trim().toLowerCase();
  if (!raw) {
    throw new Error("Usage: npx tsx server/scripts/tmp-find-customer-email-like.ts <needle>");
  }
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin not configured");
  }

  const emailNeedle = raw.includes("@") ? raw.split("@")[0] : raw;
  const baseNeedle = emailNeedle.replace(/[^a-z0-9]/g, "");

  const patterns = Array.from(
    new Set([
      `%${emailNeedle}%`,
      `%${baseNeedle}%`,
      "%janissa%",
      "%vinsnaw%",
      "%vinson%",
    ]),
  );

  const rows: any[] = [];
  for (const pattern of patterns) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("company_email, personal_email, market, states, associate_id")
      .or(`company_email.ilike.${pattern},personal_email.ilike.${pattern}`)
      .limit(25);
    if (error) {
      throw new Error(`Pattern ${pattern} failed: ${error.message}`);
    }
    for (const row of data || []) {
      const key = `${row.company_email || ""}|${row.personal_email || ""}`;
      if (!rows.some((r) => `${r.company_email || ""}|${r.personal_email || ""}` === key)) {
        rows.push(row);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        needle: raw,
        matched_rows: rows,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});
