const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

const AGENT_EMAIL = "coxsteven@aoglobelife.com";
const STATES = ["AZ", "CA", "MN", "OH", "OR", "SD", "TN", "TX", "VA", "WA"];
const MARKETS = ["globe market"];
const RECENT_HOURS = 4;
const CAP = 50;
const STATES_SQL_LIST = STATES.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(",");
const MARKETS_SQL_LIST = MARKETS.map((m) => `'${String(m).replace(/'/g, "''")}'`).join(",");

const TIMEZONE_SQL = `
CASE UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), ''))
  WHEN 'AZ' THEN 'America/Phoenix'
  WHEN 'CA' THEN 'America/Los_Angeles'
  WHEN 'MN' THEN 'America/Chicago'
  WHEN 'OH' THEN 'America/New_York'
  WHEN 'OR' THEN 'America/Los_Angeles'
  WHEN 'SD' THEN 'America/Chicago'
  WHEN 'TN' THEN 'America/Chicago'
  WHEN 'TX' THEN 'America/Chicago'
  WHEN 'VA' THEN 'America/New_York'
  WHEN 'WA' THEN 'America/Los_Angeles'
  ELSE 'America/New_York'
END
`;

const BASE_MATCH_SQL = `
  LOWER(COALESCE(taalk_market, '')) NOT IN ('plus lead', 'plus leads')
  AND COALESCE(dnc::text, 'false') NOT IN ('true', '1')
  AND COALESCE("TaalkResolve"::text, '') NOT IN ('true', '1')
  AND LOWER(COALESCE(cnresolution, 'pending')) = 'pending'
  AND (
    UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''))) IN (${STATES_SQL_LIST})
  )
  AND (
    LOWER(COALESCE(taalk_market, '')) IN (${MARKETS_SQL_LIST})
    OR LOWER(COALESCE(market, '')) IN (${MARKETS_SQL_LIST})
  )
`;

const FTC_SAFE_SQL = `
  COALESCE(LOWER(TRIM(ftcrestricted::text)), '') NOT IN ('yes', 'true', '1', 'y')
  AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE (${TIMEZONE_SQL}))) BETWEEN 8 AND 20
`;

const NOT_RECENT_SQL = `
  (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '${RECENT_HOURS} hours')
`;

async function run() {
  const client = await pool.connect();
  try {
    const capCountSql = `
      SELECT COUNT(*)::int AS cnt
      FROM masterlead
      WHERE cn_email = $1
        AND LOWER(COALESCE(cnresolution, '')) = 'pending'
        AND LOWER(COALESCE(taalk_market, '')) NOT IN ('plus lead', 'plus leads')
        AND COALESCE(dnc::text, 'false') NOT IN ('true', '1')
        AND COALESCE("TaalkResolve"::text, '') NOT IN ('true', '1')
    `;
    const capCount = (await client.query(capCountSql, [AGENT_EMAIL])).rows[0]?.cnt || 0;

    const assignedBreakdownSql = `
      SELECT
        COUNT(*)::int AS assigned_matching_filters,
        COUNT(*) FILTER (WHERE ${FTC_SAFE_SQL})::int AS assigned_ftc_callable_now,
        COUNT(*) FILTER (WHERE NOT (${FTC_SAFE_SQL}))::int AS assigned_ftc_blocked_now,
        COUNT(*) FILTER (WHERE NOT ${NOT_RECENT_SQL})::int AS assigned_recently_called_${RECENT_HOURS}h,
        COUNT(*) FILTER (WHERE ${FTC_SAFE_SQL} AND ${NOT_RECENT_SQL})::int AS assigned_callable_now_not_recent
      FROM masterlead
      WHERE cn_email = $1
        AND ${BASE_MATCH_SQL}
    `;
    const assigned = (await client.query(assignedBreakdownSql, [AGENT_EMAIL])).rows[0] || {};

    const unassignedBreakdownSql = `
      SELECT
        COUNT(*)::int AS unassigned_matching_filters,
        COUNT(*) FILTER (WHERE ${FTC_SAFE_SQL})::int AS unassigned_ftc_callable_now,
        COUNT(*) FILTER (WHERE NOT (${FTC_SAFE_SQL}))::int AS unassigned_ftc_blocked_now,
        COUNT(*) FILTER (WHERE NOT ${NOT_RECENT_SQL})::int AS unassigned_recently_called_${RECENT_HOURS}h,
        COUNT(*) FILTER (WHERE ${FTC_SAFE_SQL} AND ${NOT_RECENT_SQL})::int AS unassigned_callable_now_not_recent
      FROM masterlead
      WHERE (cn_email IS NULL OR cn_email = '')
        AND ${BASE_MATCH_SQL}
    `;
    const unassigned = (await client.query(unassignedBreakdownSql)).rows[0] || {};

    const sampleSql = `
      SELECT
        id,
        taalk_lead_id,
        first_name,
        last_name,
        phone,
        COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), '')) AS state,
        LOWER(COALESCE(taalk_market, market, '')) AS market,
        ftcrestricted,
        last_contacted
      FROM masterlead
      WHERE (cn_email IS NULL OR cn_email = '')
        AND ${BASE_MATCH_SQL}
        AND ${FTC_SAFE_SQL}
        AND ${NOT_RECENT_SQL}
      ORDER BY
        CASE
          WHEN COALESCE(taalk_lead_id, '') ~ '^[0-9]+$' THEN taalk_lead_id::bigint
          ELSE NULL
        END DESC NULLS LAST
      LIMIT 75
    `;
    const sample = (await client.query(sampleSql)).rows || [];

    const report = {
      agent: AGENT_EMAIL,
      cap: CAP,
      states: STATES,
      markets: MARKETS,
      recentHours: RECENT_HOURS,
      capCountFromAssignmentTrigger: capCount,
      capStatus: capCount >= CAP ? `at_or_above_cap (${capCount}/${CAP})` : `below_cap (${capCount}/${CAP})`,
      assignedBreakdown: assigned,
      unassignedBreakdown: unassigned,
      sampleCallableUnassignedLeadCount: sample.length,
      sampleCallableUnassignedLeads: sample,
      generatedAtUtc: new Date().toISOString(),
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.release();
  }
}

run()
  .catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

