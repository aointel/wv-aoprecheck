const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildMarketPredicate(market) {
  const normalized = String(market || "").toLowerCase().replace(/\s+/g, "");
  const marketExpr = "lower(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''))";
  if (normalized.includes("globe")) {
    return { sql: `${marketExpr} LIKE '%globe%'`, exactParam: null };
  }
  if (normalized.includes("veteran")) {
    return { sql: `${marketExpr} LIKE '%veteran%'`, exactParam: null };
  }
  return { sql: `${marketExpr} = lower($2)`, exactParam: market };
}

async function run() {
  const market = String(process.argv[2] || "Globe Market").trim();
  const idleMinutes = Math.max(1, toInt(process.argv[3], 120));
  const scheduledWindowHours = Math.max(1, toInt(process.argv[4], 12));
  const marketPredicate = buildMarketPredicate(market);
  const reportParams = marketPredicate.exactParam == null ? [idleMinutes] : [idleMinutes, marketPredicate.exactParam];

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const scheduled = await client.query(
      `
        SELECT
          release_reason,
          COUNT(*)::int AS count,
          MAX(updated_at) AS latest_updated_at
        FROM leasedialer_assignments
        WHERE release_reason IN ('hourly_stale_queue_sweeper', 'hourly_bad_queue_sweeper', 'stale_lease_cleanup')
          AND updated_at >= NOW() - ($1::int * INTERVAL '1 hour')
        GROUP BY release_reason
        ORDER BY count DESC, release_reason ASC
      `,
      [scheduledWindowHours],
    );

    const holders = await client.query(
      `
        WITH callable AS (
          SELECT
            lower(la.agent_email) AS agent_email,
            COUNT(*)::int AS callable_count
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE la.status IN ('queued', 'active')
            AND la.queue = 'hotlead'
            AND ${marketPredicate.sql}
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND (
              COALESCE(btrim(ml.cn_email), '') = ''
              OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
            )
          GROUP BY lower(la.agent_email)
        )
        SELECT
          c.agent_email,
          c.callable_count,
          d.last_dial_at,
          CASE
            WHEN d.last_dial_at IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - d.last_dial_at)) / 60)::int
          END AS mins_since_last_dial,
          (
            d.last_dial_at IS NULL
            OR d.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
          ) AS reclaimable_by_idle
        FROM callable c
        LEFT JOIN LATERAL (
          SELECT MAX(adm.event_timestamp) AS last_dial_at
          FROM agent_dial_metrics adm
          WHERE lower(adm.agent_email) = c.agent_email
            AND adm.event_type = 'dial'
        ) d ON true
        ORDER BY c.callable_count DESC, c.agent_email ASC
      `,
      reportParams,
    );

    const byState = await client.query(
      `
        WITH base AS (
          SELECT
            upper(COALESCE(NULLIF(btrim(ml.taalk_state::text), ''), NULLIF(btrim(ml.state::text), ''))) AS state,
            lower(la.agent_email) AS agent_email
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE la.status IN ('queued', 'active')
            AND la.queue = 'hotlead'
            AND ${marketPredicate.sql}
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND (
              COALESCE(btrim(ml.cn_email), '') = ''
              OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
            )
        ),
        agents AS (
          SELECT DISTINCT agent_email FROM base
        ),
        last_dials AS (
          SELECT lower(adm.agent_email) AS agent_email, MAX(adm.event_timestamp) AS last_dial_at
          FROM agent_dial_metrics adm
          JOIN agents a ON a.agent_email = lower(adm.agent_email)
          WHERE adm.event_type = 'dial'
          GROUP BY lower(adm.agent_email)
        )
        SELECT
          b.state,
          COUNT(*)::int AS callable_total,
          COUNT(*) FILTER (
            WHERE d.last_dial_at IS NULL OR d.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
          )::int AS reclaimable_by_idle
        FROM base b
        LEFT JOIN last_dials d ON d.agent_email = b.agent_email
        GROUP BY b.state
        ORDER BY reclaimable_by_idle DESC, callable_total DESC, b.state ASC
        LIMIT 100
      `,
      reportParams,
    );

    const reclaimableNow = holders.rows
      .filter((r) => r.reclaimable_by_idle)
      .reduce((sum, r) => sum + Number(r.callable_count || 0), 0);

    console.log(
      JSON.stringify(
        {
          market,
          idleMinutes,
          scheduledWindowHours,
          scheduled_job_reassignments_recent: scheduled.rows,
          total_holders: holders.rows.length,
          total_callable_in_market: holders.rows.reduce((sum, r) => sum + Number(r.callable_count || 0), 0),
          reclaimable_callable_now_by_idle: reclaimableNow,
          reclaimable_by_state: byState.rows,
          holders: holders.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
