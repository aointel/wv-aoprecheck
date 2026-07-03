import { pool } from "../db.js";
import { supabaseAdmin } from "../supabase";

type MarketRequest = {
  name: string;
  targetMarket: "Veteran" | "Globe Market";
};

const REQUESTS: MarketRequest[] = [
  { name: "Elijah Green", targetMarket: "Veteran" },
  { name: "Sophia Kersten", targetMarket: "Globe Market" },
  { name: "Billy Lopez", targetMarket: "Veteran" },
  { name: "Gibson Wein", targetMarket: "Veteran" },
  { name: "Nathalia Brennan", targetMarket: "Globe Market" },
];

function normalizeName(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || "", last: "" };
  return { first: parts[0], last: parts[parts.length - 1] };
}

async function resolveEmailByName(name: string): Promise<{
  email: string | null;
  matchedCustomer: any | null;
}> {
  if (!supabaseAdmin) return { email: null, matchedCustomer: null };

  const { first, last } = splitName(name);
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("company_email,personal_email,first_name,last_name,market")
    .or(`first_name.ilike.%${first}%,last_name.ilike.%${last}%`)
    .limit(200);

  if (error || !data || data.length === 0) return { email: null, matchedCustomer: null };

  const wantedNorm = normalizeName(name);
  const ranked = data
    .map((row: any) => {
      const rowName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
      const rowNorm = normalizeName(rowName);
      const exact = rowNorm === wantedNorm;
      const score = exact ? 100 : Number(rowNorm.includes(normalizeName(first))) + Number(rowNorm.includes(normalizeName(last)));
      return { row, score, exact };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.row;
  if (!best) return { email: null, matchedCustomer: null };
  const email = String(best.company_email || best.personal_email || "").trim().toLowerCase() || null;
  return { email, matchedCustomer: best };
}

async function updateCustomerMarket(email: string, targetMarket: string): Promise<{ updated: boolean; error?: string }> {
  if (!supabaseAdmin) return { updated: false, error: "supabaseAdmin unavailable" };
  const { error } = await supabaseAdmin
    .from("customers")
    .update({ market: [targetMarket] })
    .or(`company_email.eq.${email},personal_email.eq.${email}`);
  if (error) return { updated: false, error: error.message };
  return { updated: true };
}

async function updateRoutingProfileMarket(email: string, targetMarket: string): Promise<number> {
  const result = await pool.query(
    `
      INSERT INTO agent_routing_profiles (agent_email, markets, states, source, updated_at)
      VALUES ($1, ARRAY[$2]::text[], ARRAY[]::text[], 'manual_market_fix', NOW())
      ON CONFLICT (agent_email)
      DO UPDATE SET
        markets = ARRAY[$2]::text[],
        source = 'manual_market_fix',
        updated_at = NOW()
    `,
    [email, targetMarket],
  );
  return Number(result.rowCount || 0);
}

async function run() {
  const results: any[] = [];
  for (const req of REQUESTS) {
    const resolved = await resolveEmailByName(req.name);
    if (!resolved.email) {
      results.push({
        name: req.name,
        targetMarket: req.targetMarket,
        ok: false,
        reason: "EMAIL_NOT_FOUND",
      });
      continue;
    }

    const customerUpdate = await updateCustomerMarket(resolved.email, req.targetMarket);
    const routingUpdated = await updateRoutingProfileMarket(resolved.email, req.targetMarket);

    results.push({
      name: req.name,
      targetMarket: req.targetMarket,
      email: resolved.email,
      customerUpdated: customerUpdate.updated,
      customerError: customerUpdate.error || null,
      routingProfileUpdated: routingUpdated > 0,
      matchedCustomerName: `${resolved.matchedCustomer?.first_name || ""} ${resolved.matchedCustomer?.last_name || ""}`.trim(),
    });
  }

  console.log(JSON.stringify({ updatedAt: new Date().toISOString(), results }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

