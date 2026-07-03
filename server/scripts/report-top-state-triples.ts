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
  const todayPacificUtc = new Date(Date.UTC(y, m - 1, d, 8, 0, 0, 0));
  const start = new Date(todayPacificUtc.getTime() - 24 * 60 * 60 * 1000);
  const end = todayPacificUtc;
  return { startIso: start.toISOString(), endIso: end.toISOString(), label: start.toISOString().slice(0, 10) };
}

async function fetchActiveOwnersYesterday(startIso: string, endIso: string): Promise<Set<string>> {
  const owners = new Set<string>();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin!
      .from("twilio_call_logs")
      .select("owner_email, call_status, call_started_at")
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

function combinations3(states: string[]): string[] {
  const combos: string[] = [];
  for (let i = 0; i < states.length - 2; i++) {
    for (let j = i + 1; j < states.length - 1; j++) {
      for (let k = j + 1; k < states.length; k++) {
        combos.push(`${states[i]}|${states[j]}|${states[k]}`);
      }
    }
  }
  return combos;
}

async function main() {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");
  const { startIso, endIso, label } = getYesterdayPacificRangeUtc();
  const activeOwners = await fetchActiveOwnersYesterday(startIso, endIso);

  const customers: CustomerRow[] = [];
  let from = 0;
  const page = 1000;
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

  const agentStates = new Map<string, string[]>();
  for (const c of customers) {
    if (!Boolean(c.CCPRO)) continue;
    const markets = parseArrayField(c.market).map((m) => m.toLowerCase());
    const isGlobe = markets.some((m) => m.includes("globe market") || "globe market".includes(m));
    if (!isGlobe) continue;
    const company = String(c.company_email || "").toLowerCase().trim();
    const personal = String(c.personal_email || "").toLowerCase().trim();
    const active = (company && activeOwners.has(company)) || (personal && activeOwners.has(personal));
    if (!active) continue;
    const key = company || personal;
    if (!key) continue;
    const states = Array.from(new Set(parseArrayField(c.states).map((s) => s.toUpperCase().trim()).filter((s) => /^[A-Z]{2}$/.test(s)))).sort();
    if (states.length >= 3) agentStates.set(key, states);
  }

  const comboCount = new Map<string, number>();
  const allStateSets = Array.from(agentStates.values());
  const universalStates =
    allStateSets.length === 0
      ? []
      : allStateSets.reduce<string[]>((acc, states, idx) => {
          if (idx === 0) return [...states];
          const current = new Set(states);
          return acc.filter((s) => current.has(s));
        }, []);

  for (const states of agentStates.values()) {
    for (const combo of combinations3(states)) {
      comboCount.set(combo, (comboCount.get(combo) || 0) + 1);
    }
  }

  const top = Array.from(comboCount.entries())
    .map(([combo, count]) => ({ states: combo.split("|"), agentsWithAll3: count }))
    .sort((a, b) => b.agentsWithAll3 - a.agentsWithAll3)
    .slice(0, 25);

  console.log(JSON.stringify({
    periodPacificDate: label,
    cohortAgentCount: agentStates.size,
    universalStates,
    topTriples: top,
  }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});

