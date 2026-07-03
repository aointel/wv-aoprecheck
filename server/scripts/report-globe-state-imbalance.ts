import { pool } from "../db";
import { supabaseAdmin } from "../supabase";

type StateLead = { state: string; lead_count: number };
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

async function fetchGlobeLeadsByState(): Promise<Map<string, number>> {
  const colsRes = await pool.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='masterlead'
  `);
  const cols = new Set(colsRes.rows.map((r) => r.column_name));
  const keyMatchParts = [
    "LOWER(COALESCE(taalk_market, '')) LIKE '%globe market%'",
    "LOWER(COALESCE(market, '')) LIKE '%globe market%'",
  ];
  if (cols.has("groupcode")) keyMatchParts.push("LOWER(COALESCE(groupcode::text, '')) LIKE '%globe market%'");
  if (cols.has("group_code")) keyMatchParts.push("LOWER(COALESCE(group_code::text, '')) LIKE '%globe market%'");

  const sql = `
    SELECT
      UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), 'UNKNOWN')) AS state,
      COUNT(*)::int AS lead_count
    FROM masterlead
    WHERE (${keyMatchParts.join(" OR ")})
      AND (
        cnresolution IS NULL
        OR LOWER(TRIM(COALESCE(cnresolution, ''))) = 'pending'
        OR TRIM(COALESCE(cnresolution, '')) = ''
      )
    GROUP BY 1
  `;
  const { rows } = await pool.query<StateLead>(sql);
  const m = new Map<string, number>();
  for (const r of rows) m.set(String(r.state || "UNKNOWN").toUpperCase(), Number(r.lead_count || 0));
  return m;
}

async function fetchGlobeCcproActiveStateCoverage(activeOwners: Set<string>): Promise<Map<string, number>> {
  const customers: CustomerRow[] = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin!
      .from("customers")
      .select("company_email, personal_email, market, states, CCPRO")
      .range(from, from + page - 1);
    if (error) throw new Error(`customers query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    customers.push(...(data as CustomerRow[]));
    if (data.length < page) break;
    from += page;
  }

  const eligibleAgents = new Map<string, Set<string>>();
  for (const c of customers) {
    if (!Boolean(c.CCPRO)) continue;
    const markets = parseArrayField(c.market).map((m) => m.toLowerCase());
    const isGlobe = markets.some((m) => m.includes("globe market") || "globe market".includes(m));
    if (!isGlobe) continue;
    const company = String(c.company_email || "").toLowerCase().trim();
    const personal = String(c.personal_email || "").toLowerCase().trim();
    const active = (company && activeOwners.has(company)) || (personal && activeOwners.has(personal));
    if (!active) continue;
    const agentKey = company || personal;
    if (!agentKey) continue;
    const states = new Set(parseArrayField(c.states).map((s) => s.toUpperCase().trim()).filter(Boolean));
    eligibleAgents.set(agentKey, states);
  }

  const stateAgents = new Map<string, number>();
  for (const states of eligibleAgents.values()) {
    for (const s of states) stateAgents.set(s, (stateAgents.get(s) || 0) + 1);
  }
  return stateAgents;
}

async function main() {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");
  const { startIso, endIso, label } = getYesterdayPacificRangeUtc();
  const activeOwners = await fetchActiveOwnersYesterday(startIso, endIso);
  const leadByState = await fetchGlobeLeadsByState();
  const agentByState = await fetchGlobeCcproActiveStateCoverage(activeOwners);

  const states = new Set<string>([...leadByState.keys(), ...agentByState.keys()]);
  const rows = Array.from(states).map((state) => {
    const leads = leadByState.get(state) || 0;
    const agents = agentByState.get(state) || 0;
    const leadsPerAgent = agents > 0 ? leads / agents : null;
    const agentsPer1000Leads = leads > 0 ? (agents * 1000) / leads : agents > 0 ? Infinity : 0;
    return {
      state,
      leadsPendingNull: leads,
      activeGlobeCcproAgentsLicensed: agents,
      leadsPerAgent: leadsPerAgent == null ? null : Number(leadsPerAgent.toFixed(2)),
      agentsPer1000Leads: Number.isFinite(agentsPer1000Leads) ? Number(agentsPer1000Leads.toFixed(2)) : null,
      imbalanceScore: agents > 0 ? Number((agents / Math.max(1, leads)).toFixed(6)) : 0,
    };
  });

  const highLicenseLowLead = rows
    .filter((r) => r.activeGlobeCcproAgentsLicensed >= 10)
    .sort((a, b) => (b.imbalanceScore - a.imbalanceScore) || (a.leadsPendingNull - b.leadsPendingNull));

  console.log(
    JSON.stringify(
      {
        periodPacificDate: label,
        activeOwnersYesterdayAnsweredCompleted: activeOwners.size,
        statesCompared: rows.length,
        highLicenseLowLead,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e?.stack || e?.message || String(e));
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

