import { leaseDialerPool as pool } from "../db";
import { supabaseAdmin } from "../supabase";

type LeadRow = {
  state: string;
  lead_count: number;
};

type CustomerRow = {
  id?: number | string | null;
  company_email?: string | null;
  personal_email?: string | null;
  market?: unknown;
  states?: unknown;
  CCPRO?: boolean | null;
};

const US_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  const s = String(value || "").trim();
  if (!s) return [];
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
    } catch {
      // ignore and fall through
    }
  }
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

function normalizeUsState(value: unknown): string | null {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return null;
  const first = raw.split(",")[0].trim();
  const cleaned = first.replace(/[^A-Z]/g, "");
  if (cleaned.length !== 2) return null;
  return US_STATE_CODES.has(cleaned) ? cleaned : null;
}

async function fetchGlobeLeads0To100DaysByState(): Promise<Map<string, number>> {
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

  const whereResolution = `
    (
      cnresolution IS NULL
      OR TRIM(COALESCE(cnresolution, '')) = ''
      OR LOWER(TRIM(COALESCE(cnresolution, ''))) = 'pending'
      OR LOWER(TRIM(COALESCE(cnresolution, ''))) = 'called'
    )
  `;

  const bounds = await pool.query<{ min_id: number; max_id: number }>({
    text: `SELECT COALESCE(MIN(id),0)::int AS min_id, COALESCE(MAX(id),0)::int AS max_id FROM masterlead`,
  });
  const minId = Number(bounds.rows[0]?.min_id || 0);
  const maxId = Number(bounds.rows[0]?.max_id || 0);
  const STEP = 25000;
  const out = new Map<string, number>();

  for (let start = minId; start <= maxId; start += STEP) {
    const end = start + STEP;
    const part = await pool.query<LeadRow>({
      text: `
        SELECT
          UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), 'UNKNOWN')) AS state,
          COUNT(*)::int AS lead_count
        FROM masterlead
        WHERE id >= $1
          AND id < $2
          AND (${marketParts.join(" OR ")})
          AND ${whereResolution}
          AND created_at >= NOW() - INTERVAL '100 days'
        GROUP BY 1
      `,
      values: [start, end],
      query_timeout: 120000,
    });

    for (const row of part.rows) {
      const st = normalizeUsState(row.state);
      if (!st) continue;
      out.set(st, (out.get(st) || 0) + Number(row.lead_count || 0));
    }
  }
  return out;
}

async function fetchGlobeLicensedCustomersByState(): Promise<Map<string, number>> {
  if (!supabaseAdmin) throw new Error("supabaseAdmin is not configured");
  const customers: CustomerRow[] = [];
  const page = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id, company_email, personal_email, market, states, CCPRO")
      .range(from, from + page - 1);
    if (error) throw new Error(`customers query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    customers.push(...(data as CustomerRow[]));
    if (data.length < page) break;
    from += page;
  }

  const stateCounts = new Map<string, number>();
  const seenCustomer = new Set<string>();

  for (const c of customers) {
    const markets = parseArrayField(c.market).map((m) => m.toLowerCase());
    const isGlobe = markets.some((m) => m.includes("globe market") || "globe market".includes(m));
    if (!isGlobe) continue;

    // Keep it aligned to outbound users/licenses we can actually route.
    if (!Boolean(c.CCPRO)) continue;

    const key =
      String(c.company_email || "").toLowerCase().trim() ||
      String(c.personal_email || "").toLowerCase().trim() ||
      `id:${String(c.id || "").trim()}`;
    if (!key || seenCustomer.has(key)) continue;
    seenCustomer.add(key);

    const states = new Set(
      parseArrayField(c.states)
        .map((s) => normalizeUsState(s))
        .filter((s): s is string => Boolean(s)),
    );
    for (const st of states) {
      stateCounts.set(st, (stateCounts.get(st) || 0) + 1);
    }
  }

  return stateCounts;
}

async function main() {
  const leadsByState = await fetchGlobeLeads0To100DaysByState();
  const licensesByState = await fetchGlobeLicensedCustomersByState();

  const allStates = new Set<string>([...leadsByState.keys(), ...licensesByState.keys()]);
  const rows = Array.from(allStates).map((state) => {
    const leads = leadsByState.get(state) || 0;
    const licenses = licensesByState.get(state) || 0;
    const ratio = licenses > 0 ? leads / licenses : null;
    return {
      state,
      leads_0_100_pending_null_called: leads,
      licensed_ccpro_customers_globe: licenses,
      leads_per_license: ratio == null ? null : Number(ratio.toFixed(2)),
      needs_agents_rank_score: licenses > 0 ? ratio : leads > 0 ? 999999 : 0,
    };
  });

  const ranked = rows
    .filter((r) => r.leads_0_100_pending_null_called > 0)
    .sort((a, b) => {
      if (b.needs_agents_rank_score !== a.needs_agents_rank_score) {
        return b.needs_agents_rank_score - a.needs_agents_rank_score;
      }
      return b.leads_0_100_pending_null_called - a.leads_0_100_pending_null_called;
    });

  const top25 = ranked.slice(0, 25);

  console.log(
    JSON.stringify(
      {
        scope: "Globe Market leads cnresolution in (pending, null, called) over last 0-100 days",
        as_of_utc: new Date().toISOString(),
        ranking: "highest leads-per-license ratio first; zero-license states prioritized",
        totals: {
          states_with_leads: ranked.length,
          total_leads_0_100_pending_null_called: ranked.reduce(
            (sum, r) => sum + r.leads_0_100_pending_null_called,
            0,
          ),
          total_globe_licensed_ccpro_customers: Array.from(licensesByState.values()).reduce((s, n) => s + n, 0),
        },
        top25_states_need_agents: top25,
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
