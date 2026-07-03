import { pool } from "../db";
import { supabaseAdmin } from "../supabase";

const email = String(process.argv[2] || "").toLowerCase().trim();
if (!email) {
  console.error("Usage: npx tsx server/scripts/diagnose-request-leads-fallback.ts <agent-email>");
  process.exit(1);
}

const timezoneSql = `
  CASE UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), ''))
    WHEN 'CT' THEN 'America/New_York'
    WHEN 'DE' THEN 'America/New_York'
    WHEN 'FL' THEN 'America/New_York'
    WHEN 'GA' THEN 'America/New_York'
    WHEN 'MA' THEN 'America/New_York'
    WHEN 'MD' THEN 'America/New_York'
    WHEN 'ME' THEN 'America/New_York'
    WHEN 'NC' THEN 'America/New_York'
    WHEN 'NH' THEN 'America/New_York'
    WHEN 'NJ' THEN 'America/New_York'
    WHEN 'NY' THEN 'America/New_York'
    WHEN 'OH' THEN 'America/New_York'
    WHEN 'PA' THEN 'America/New_York'
    WHEN 'RI' THEN 'America/New_York'
    WHEN 'SC' THEN 'America/New_York'
    WHEN 'VA' THEN 'America/New_York'
    WHEN 'VT' THEN 'America/New_York'
    WHEN 'WV' THEN 'America/New_York'
    WHEN 'MI' THEN 'America/Detroit'
    WHEN 'IN' THEN 'America/Indiana/Indianapolis'
    WHEN 'KY' THEN 'America/Kentucky/Louisville'
    WHEN 'AL' THEN 'America/Chicago'
    WHEN 'AR' THEN 'America/Chicago'
    WHEN 'IA' THEN 'America/Chicago'
    WHEN 'IL' THEN 'America/Chicago'
    WHEN 'KS' THEN 'America/Chicago'
    WHEN 'LA' THEN 'America/Chicago'
    WHEN 'MN' THEN 'America/Chicago'
    WHEN 'MO' THEN 'America/Chicago'
    WHEN 'MS' THEN 'America/Chicago'
    WHEN 'NE' THEN 'America/Chicago'
    WHEN 'OK' THEN 'America/Chicago'
    WHEN 'SD' THEN 'America/Chicago'
    WHEN 'TN' THEN 'America/Chicago'
    WHEN 'TX' THEN 'America/Chicago'
    WHEN 'WI' THEN 'America/Chicago'
    WHEN 'ND' THEN 'America/North_Dakota/Center'
    WHEN 'AZ' THEN 'America/Phoenix'
    WHEN 'CO' THEN 'America/Denver'
    WHEN 'ID' THEN 'America/Boise'
    WHEN 'MT' THEN 'America/Denver'
    WHEN 'NM' THEN 'America/Denver'
    WHEN 'UT' THEN 'America/Denver'
    WHEN 'WY' THEN 'America/Denver'
    WHEN 'CA' THEN 'America/Los_Angeles'
    WHEN 'NV' THEN 'America/Los_Angeles'
    WHEN 'OR' THEN 'America/Los_Angeles'
    WHEN 'WA' THEN 'America/Los_Angeles'
    WHEN 'AK' THEN 'America/Anchorage'
    WHEN 'HI' THEN 'Pacific/Honolulu'
    ELSE 'America/New_York'
  END
`;

const ftcCallableClause = `
  COALESCE(LOWER(TRIM(ftcrestricted::text)), '') NOT IN ('yes', 'true', '1', 'y')
  AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE (${timezoneSql}))) BETWEEN 8 AND 20
`;

const recentClause = `
  (last_contacted IS NULL OR last_contacted < NOW() - ('4 hours')::interval)
`;

async function main() {
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin not configured");
  }
  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("company_email, personal_email, market, states")
    .or(`company_email.eq.${email},personal_email.eq.${email}`)
    .limit(1)
    .maybeSingle();
  if (customerError) {
    throw new Error(`Failed to fetch customer row: ${customerError.message}`);
  }
  if (!customer) {
    console.log(JSON.stringify({ email, error: "Customer not found" }, null, 2));
    return;
  }

  const parseArray = (value: unknown): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
    const s = String(value || "").trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
      } catch {
        // ignore invalid json-like string
      }
    }
    return s.split(",").map((v) => v.trim()).filter(Boolean);
  };

  const states = parseArray(customer.states).map((s) => s.toUpperCase());
  const markets = parseArray(customer.market).map((m) => m.toLowerCase());
  const primaryMarket = markets[0] || "globe market";

  const qBase = `
    FROM masterlead
    WHERE (cn_email IS NULL OR cn_email = '')
      AND LOWER(COALESCE(cnresolution,'pending')) = 'pending'
      AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
      AND COALESCE(dnc::text,'false') != 'true'
  `;
  const qState = states.length
    ? `${qBase} AND UPPER(COALESCE(state, taalk_state, '')) = ANY($1::text[])`
    : qBase;
  const qStateMarket = states.length
    ? `${qState} AND (LOWER(COALESCE(taalk_market,'')) = $2 OR LOWER(COALESCE(market,'')) = $2)`
    : `${qBase} AND (LOWER(COALESCE(taalk_market,'')) = $1 OR LOWER(COALESCE(market,'')) = $1)`;
  const qCallable = `${qStateMarket} AND (${ftcCallableClause}) AND (${recentClause})`;

  const [baseCnt, stateCnt, stateMarketCnt, callableCnt, currentCnt, sample] = await Promise.all([
    pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qBase}`),
    states.length
      ? pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qState}`, [states])
      : pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qState}`),
    states.length
      ? pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qStateMarket}`, [states, primaryMarket])
      : pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qStateMarket}`, [primaryMarket]),
    states.length
      ? pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qCallable}`, [states, primaryMarket])
      : pool.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt ${qCallable}`, [primaryMarket]),
    pool.query<{ cnt: number }>(
      `
        SELECT COUNT(*)::int AS cnt
        FROM masterlead
        WHERE cn_email = $1
          AND LOWER(COALESCE(cnresolution,'')) = 'pending'
          AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
          AND COALESCE(dnc::text,'false') != 'true'
          AND (${ftcCallableClause})
          AND (${recentClause})
      `,
      [email],
    ),
    states.length
      ? pool.query(
          `
            SELECT id, first_name, last_name, COALESCE(taalk_market, market) AS lead_market, COALESCE(state, taalk_state) AS lead_state
            ${qStateMarket}
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 10
          `,
          [states, primaryMarket],
        )
      : pool.query(
          `
            SELECT id, first_name, last_name, COALESCE(taalk_market, market) AS lead_market, COALESCE(state, taalk_state) AS lead_state
            ${qStateMarket}
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 10
          `,
          [primaryMarket],
        ),
  ]);

  console.log(
    JSON.stringify(
      {
        email,
        profile: { states, markets },
        counts: {
          unassignedPendingNonPlusNonDnc: baseCnt.rows[0]?.cnt || 0,
          afterStateFilter: stateCnt.rows[0]?.cnt || 0,
          afterStateAndMarket: stateMarketCnt.rows[0]?.cnt || 0,
          afterStateMarketCallableNowNotRecent: callableCnt.rows[0]?.cnt || 0,
          currentCallableAssigned: currentCnt.rows[0]?.cnt || 0,
        },
        sampleStateMarketMatches: sample.rows,
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
    await pool.end().catch(() => {});
  });

