import { pool } from "../db";

function parseStates(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").toUpperCase().trim()).filter(Boolean);
  }
  const s = String(value || "").trim();
  if (!s) return [];
  return s
    .replace(/[\[\]"]/g, "")
    .split(/[,\s]+/)
    .map((v) => v.toUpperCase().trim())
    .filter((v) => v.length === 2);
}

function parseMarkets(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").toLowerCase().trim()).filter(Boolean);
  }
  const s = String(value || "").trim().toLowerCase();
  if (!s) return [];
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toSqlList(values: string[]): string {
  if (!values.length) return "";
  return values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(",");
}

async function main() {
  const agentEmail = String(process.argv[2] || "").toLowerCase().trim();
  if (!agentEmail) {
    throw new Error("Usage: npx tsx server/scripts/debug-agent-assignment-eligibility.ts <agentEmail>");
  }
  const statesArg = String(
    process.argv.find((arg) => arg.startsWith("--states=")) || "",
  ).replace(/^--states=/, "");
  const marketsArg = String(
    process.argv.find((arg) => arg.startsWith("--markets=")) || "",
  ).replace(/^--markets=/, "");

  let customer: any = {};
  let customerRowFound = false;
  try {
    const customerSql = `
    SELECT company_email, personal_email, licensed_states, taalk_market, market
    FROM customers
    WHERE lower(coalesce(company_email, '')) = $1
       OR lower(coalesce(personal_email, '')) = $1
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
  `;
    const customerRes = await pool.query(customerSql, [agentEmail]);
    customer = customerRes.rows[0] || {};
    customerRowFound = !!customerRes.rows[0];
  } catch (e) {
    customer = {};
    customerRowFound = false;
  }

  const states = statesArg
    ? parseStates(statesArg)
    : parseStates(customer.licensed_states);
  const markets = marketsArg
    ? parseMarkets(marketsArg)
    : parseMarkets(customer.taalk_market || customer.market);

  const TIMEZONE_SQL = `
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

  const FTC_CALLABLE_SQL = `
    COALESCE(LOWER(TRIM(ftcrestricted::text)), '') NOT IN ('yes', 'true', '1', 'y')
    AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE (${TIMEZONE_SQL}))) BETWEEN 8 AND 20
  `;
  const RECENT_CONTACT_SQL = `
    (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '4 hours')
  `;

  const baseSql = `
    LOWER(COALESCE(cnresolution, 'pending')) = 'pending'
    AND LOWER(COALESCE(taalk_market, '')) NOT IN ('plus lead','plus leads')
    AND COALESCE(dnc::text, 'false') NOT IN ('true','1')
    AND COALESCE("TaalkResolve"::text, '') NOT IN ('true','1')
  `;

  const countOne = async (where: string, params: unknown[] = []) => {
    const q = `SELECT COUNT(*)::int AS c FROM masterlead WHERE ${where}`;
    const res = await pool.query(q, params);
    return Number(res.rows[0]?.c || 0);
  };

  const statesSql = toSqlList(states);
  const marketsSql = toSqlList(markets);
  const stateClause =
    states.length > 0
      ? `(UPPER(COALESCE(state,'')) IN (${statesSql}) OR UPPER(COALESCE(taalk_state,'')) IN (${statesSql}))`
      : "TRUE";
  const marketClause =
    markets.length > 0
      ? `(LOWER(COALESCE(taalk_market,'')) IN (${marketsSql}) OR LOWER(COALESCE(market,'')) IN (${marketsSql}))`
      : "TRUE";

  const currentCap = await countOne(
    `cn_email = $1 AND ${baseSql} AND (${FTC_CALLABLE_SQL}) AND (${RECENT_CONTACT_SQL})`,
    [agentEmail],
  );
  const assignedPending = await countOne(`cn_email = $1 AND ${baseSql}`, [agentEmail]);
  const unassignedBase = await countOne(`(cn_email IS NULL OR cn_email = '') AND ${baseSql}`);
  const unassignedState = await countOne(
    `(cn_email IS NULL OR cn_email = '') AND ${baseSql} AND ${stateClause}`,
  );
  const unassignedMarket = await countOne(
    `(cn_email IS NULL OR cn_email = '') AND ${baseSql} AND ${marketClause}`,
  );
  const unassignedBoth = await countOne(
    `(cn_email IS NULL OR cn_email = '') AND ${baseSql} AND ${stateClause} AND ${marketClause}`,
  );
  const unassignedBothCallableNow = await countOne(
    `(cn_email IS NULL OR cn_email = '') AND ${baseSql} AND ${stateClause} AND ${marketClause} AND (${FTC_CALLABLE_SQL}) AND (${RECENT_CONTACT_SQL})`,
  );

  const report = {
    agentEmail,
    customerRowFound,
    profile: {
      company_email: customer.company_email || null,
      personal_email: customer.personal_email || null,
      taalk_market: customer.taalk_market || null,
      market: customer.market || null,
      states,
      markets,
      statesArgApplied: !!statesArg,
      marketsArgApplied: !!marketsArg,
    },
    counts: {
      currentCapCallablePending: currentCap,
      assignedPendingTotal: assignedPending,
      unassignedBasePendingPool: unassignedBase,
      unassignedAfterStateFilter: unassignedState,
      unassignedAfterMarketFilter: unassignedMarket,
      unassignedAfterStateAndMarket: unassignedBoth,
      unassignedCallableNowNotRecent: unassignedBothCallableNow,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err?.stack || err?.message || String(err));
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

