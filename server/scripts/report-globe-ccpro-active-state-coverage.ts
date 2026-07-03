import { supabaseAdmin } from "../supabase";

type CustomerRow = {
  company_email?: string | null;
  personal_email?: string | null;
  market?: unknown;
  states?: unknown;
  CCPRO?: boolean | null;
};

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const s = String(value || "").trim();
  if (!s) return [];
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
    } catch {
      // continue
    }
  }
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

function getYesterdayPacificRangeUtc(): { startIso: string; endIso: string; label: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const todayPacificUtc = new Date(Date.UTC(y, m - 1, d, 8, 0, 0, 0)); // ~midnight PT in UTC (safe enough for report)
  const start = new Date(todayPacificUtc.getTime() - 24 * 60 * 60 * 1000);
  const end = todayPacificUtc;
  const label = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), label };
}

async function fetchAllCallOwners(startIso: string, endIso: string): Promise<Set<string>> {
  const owners = new Set<string>();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin!
      .from("twilio_call_logs")
      .select("owner_email, call_status, call_direction, call_started_at")
      .gte("call_started_at", startIso)
      .lt("call_started_at", endIso)
      .not("owner_email", "is", null)
      .neq("owner_email", "")
      .in("call_status", ["answered", "completed"])
      .range(from, from + page - 1);
    if (error) throw new Error(`twilio_call_logs query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ owner_email?: string | null }>) {
      const e = String(row.owner_email || "").toLowerCase().trim();
      if (e) owners.add(e);
    }
    if (data.length < page) break;
    from += page;
  }
  return owners;
}

async function main() {
  if (!supabaseAdmin) throw new Error("supabaseAdmin is not configured");

  const { startIso, endIso, label } = getYesterdayPacificRangeUtc();
  const activeOwners = await fetchAllCallOwners(startIso, endIso);

  const customers: CustomerRow[] = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("company_email, personal_email, market, states, CCPRO")
      .range(from, from + page - 1);
    if (error) throw new Error(`customers query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    customers.push(...(data as CustomerRow[]));
    if (data.length < page) break;
    from += page;
  }

  const eligibleAgents = new Map<string, { states: string[]; companyEmail: string; personalEmail: string }>();

  for (const c of customers) {
    const ccpro = Boolean(c.CCPRO);
    if (!ccpro) continue;

    const markets = parseArrayField(c.market).map((m) => m.toLowerCase());
    const isGlobe = markets.some((m) => m.includes("globe market") || "globe market".includes(m));
    if (!isGlobe) continue;

    const company = String(c.company_email || "").toLowerCase().trim();
    const personal = String(c.personal_email || "").toLowerCase().trim();
    const active = (company && activeOwners.has(company)) || (personal && activeOwners.has(personal));
    if (!active) continue;

    const states = parseArrayField(c.states).map((s) => s.toUpperCase().trim()).filter(Boolean);
    const key = company || personal;
    if (!key) continue;
    eligibleAgents.set(key, { states, companyEmail: company, personalEmail: personal });
  }

  const stateCounts = new Map<string, number>();
  for (const a of eligibleAgents.values()) {
    const dedup = new Set(a.states);
    for (const st of dedup) stateCounts.set(st, (stateCounts.get(st) || 0) + 1);
  }

  const sortedByState = Array.from(stateCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, agentCount]) => ({ state, agentCount }));

  console.log(
    JSON.stringify(
      {
        periodPacificDate: label,
        rangeUtc: { startIso, endIso },
        activeOwnersYesterdayAnsweredCompleted: activeOwners.size,
        eligibleGlobeCcproAgentsWhoTookCalls: eligibleAgents.size,
        stateCoverage: sortedByState,
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

