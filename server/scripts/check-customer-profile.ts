import { supabaseAdmin } from "../supabase";

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Usage: npx tsx server/scripts/check-customer-profile.ts <email>");
  }
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, company_email, personal_email, states, market, created_at")
    .or(`company_email.eq.${email},personal_email.eq.${email}`)
    .order("created_at", { ascending: false })
    .limit(5);

  console.log(JSON.stringify({ email, error, rows: data || [] }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});

