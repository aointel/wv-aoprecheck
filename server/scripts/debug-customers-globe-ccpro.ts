import { supabaseAdmin } from "../supabase";

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  const s = String(value || "").trim();
  if (!s) return [];
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
    } catch {}
  }
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

async function main() {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = data || [];
  const globe = rows.filter((r: any) => {
    const markets = parseArrayField(r.market).map((m) => m.toLowerCase());
    return markets.some((m) => m.includes("globe market") || "globe market".includes(m));
  });

  const sample = globe.slice(0, 25).map((r: any) => ({
    company_email: r.company_email,
    personal_email: r.personal_email,
    market: r.market,
    ccpro_upper: r.CCPRO,
    ccpro_lower: r.ccpro,
    keys: Object.keys(r).filter((k) => k.toLowerCase().includes("ccpro")),
  }));

  console.log(JSON.stringify({
    totalRows: rows.length,
    globeRows: globe.length,
    sample,
  }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});

