import { leaseDialerPool as pool } from "../db";
import { supabaseAdmin } from "../supabase";

type CustomerRow = {
  company_email?: string | null;
  personal_email?: string | null;
  market?: unknown;
  states?: unknown;
  CCPRO?: boolean | null;
};

type LeadChunkRow = {
  state: string;
  leads_pending_null_called: number;
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
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeState(s: string): string {
  return String(s || "").trim().toUpperCase();
}

async function fetchGlobeAgentsByState(): Promise<Map<string, Set<string>>> {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");
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

  const stateToAgents = new Map<string, Set<string>>();
  for (const c of customers) {
    if (!Boolean(c.CCPRO)) continue;
    const markets = parseArrayField(c.market).map((m) => m.toLowerCase());
    const isGlobe = markets.some((m) => m.includes("globe market") || "globe market".includes(m));
    if (!isGlobe) continue;
    const agentEmail = String(c.company_email || c.personal_email || "").toLowerCase().trim();
    if (!agentEmail || !agentEmail.includes("@")) continue;
    const states = parseArrayField(c.states).map(normalizeState).filter(Boolean);
    for (const state of states) {
      if (!stateToAgents.has(state)) stateToAgents.set(state, new Set<string>());
      stateToAgents.get(state)!.add(agentEmail);
    }
  }
  return stateToAgents;
}

async function fetchGlobePendingNullCalledLeadsByState(): Promise<Map<string, number>> {
  const colsRes = await pool.query<{ column_name: string }>({
    text: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='masterlead'
    `,
  });
  const cols = new Set(colsRes.rows.map((r) => r.column_name));
  const marketParts = [
    "LOWER(COALESCE(taalk_market, '')) LIKE '%globe market%'",
    "LOWER(COALESCE(market, '')) LIKE '%globe market%'",
  ];
  if (cols.has("groupcode")) marketParts.push("LOWER(COALESCE(groupcode::text, '')) LIKE '%globe market%'");
  if (cols.has("group_code")) marketParts.push("LOWER(COALESCE(group_code::text, '')) LIKE '%globe market%'");

  const bounds = await pool.query<{ min_id: number; max_id: number }>({
    text: `SELECT COALESCE(MIN(id),0)::int AS min_id, COALESCE(MAX(id),0)::int AS max_id FROM masterlead`,
  });
  const minId = Number(bounds.rows[0]?.min_id || 0);
  const maxId = Number(bounds.rows[0]?.max_id || 0);

  const byState = new Map<string, number>();
  const STEP = 25000;
  for (let start = minId; start <= maxId; start += STEP) {
    const end = start + STEP;
    const part = await pool.query<LeadChunkRow>({
      text: `
        SELECT
          UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), 'UNKNOWN')) AS state,
          COUNT(*)::int AS leads_pending_null_called
        FROM masterlead
        WHERE id >= $1
          AND id < $2
          AND (${marketParts.join(" OR ")})
          AND (
            cnresolution IS NULL
            OR LOWER(TRIM(COALESCE(cnresolution, ''))) IN ('pending', '', 'called')
          )
        GROUP BY 1
      `,
      values: [start, end],
      query_timeout: 120000,
    });

    for (const row of part.rows) {
      const state = normalizeState(row.state || "UNKNOWN") || "UNKNOWN";
      byState.set(state, (byState.get(state) || 0) + Number(row.leads_pending_null_called || 0));
    }
  }
  return byState;
}

async function main() {
  const [agentStateMap, leadStateMap] = await Promise.all([
    fetchGlobeAgentsByState(),
    fetchGlobePendingNullCalledLeadsByState(),
  ]);

  const allStates = new Set<string>([...agentStateMap.keys(), ...leadStateMap.keys()]);
  const rows = Array.from(allStates)
    .map((state) => {
      const agents = agentStateMap.get(state)?.size || 0;
      const leads = leadStateMap.get(state) || 0;
      const leadsPerAgent = agents > 0 ? Number((leads / agents).toFixed(2)) : null;
      const agentsPer1000Leads = leads > 0 ? Number(((agents * 1000) / leads).toFixed(2)) : agents > 0 ? null : 0;
      return {
        state,
        licensed_globe_agents: agents,
        pending_null_called_globe_leads: leads,
        leads_per_agent: leadsPerAgent,
        agents_per_1000_leads: agentsPer1000Leads,
      };
    })
    .sort((a, b) => b.licensed_globe_agents - a.licensed_globe_agents || a.state.localeCompare(b.state));

  const overCovered = rows
    .filter((r) => r.licensed_globe_agents >= 5)
    .sort((a, b) => {
      const aRatio = a.leads_per_agent == null ? Number.NEGATIVE_INFINITY : a.leads_per_agent;
      const bRatio = b.leads_per_agent == null ? Number.NEGATIVE_INFINITY : b.leads_per_agent;
      return aRatio - bRatio || b.licensed_globe_agents - a.licensed_globe_agents;
    })
    .slice(0, 20);

  console.log(
    JSON.stringify(
      {
        scope: "globe-market licensed agents by state vs pending/null/called lead load",
        as_of_utc: new Date().toISOString(),
        ranked_by_licensed_agents_desc: rows,
        likely_overcovered_states: overCovered,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

