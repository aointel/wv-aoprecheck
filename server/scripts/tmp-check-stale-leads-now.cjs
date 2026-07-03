const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const idleMinutes = Math.max(15, Number(process.argv[2] || 120));
  const mode = String(process.argv[3] || "full").toLowerCase();
  const queue = String(process.argv[4] || "hotlead").toLowerCase().trim();
  const staleOnly = mode === "stale-only";
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 90000,
    query_timeout: 90000,
  });
  await client.connect();
  try {
    const snapshot = staleOnly
      ? await client.query(
          `
            WITH scoped AS (
              SELECT
                lower(la.agent_email) AS agent_email,
                ml.cnresolution,
                ml.taalk_lead_id,
                ml.cn_email
              FROM leasedialer_assignments la
              JOIN masterlead ml ON ml.id = la.lead_id
              WHERE la.status IN ('queued', 'active')
                AND la.queue = $1
            )
            SELECT
              COUNT(*)::int AS total_queue_queued_active,
              COUNT(*) FILTER (
                WHERE lower(trim(coalesce(cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
              )::int AS stale_bad_resolution,
              COUNT(*) FILTER (
                WHERE COALESCE(btrim(taalk_lead_id::text), '') = ''
              )::int AS stale_missing_taalk_lead_id,
              COUNT(*) FILTER (
                WHERE COALESCE(btrim(cn_email), '') <> ''
                  AND lower(btrim(cn_email)) <> agent_email
              )::int AS stale_owned_by_other_email,
              COUNT(*) FILTER (
                WHERE lower(trim(coalesce(cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                  AND COALESCE(btrim(taalk_lead_id::text), '') <> ''
                  AND (
                    COALESCE(btrim(cn_email), '') = ''
                    OR lower(btrim(cn_email)) = agent_email
                  )
              )::int AS callable_now
            FROM scoped
          `,
          [queue],
        )
      : await client.query(
          `
            WITH scoped AS (
              SELECT
                la.id,
                lower(la.agent_email) AS agent_email,
                la.status,
                la.queue,
                ml.cnresolution,
                ml.taalk_lead_id,
                ml.cn_email
              FROM leasedialer_assignments la
              JOIN masterlead ml ON ml.id = la.lead_id
              WHERE la.status IN ('queued', 'active')
                AND la.queue = $2
            ),
            active_agents AS (
              SELECT DISTINCT agent_email FROM scoped
            ),
            agent_last_dial AS (
              SELECT aa.agent_email, MAX(adm.event_timestamp) AS last_dial_at
              FROM active_agents aa
              LEFT JOIN agent_dial_metrics adm
                ON lower(adm.agent_email) = aa.agent_email
               AND adm.event_type = 'dial'
              GROUP BY aa.agent_email
            )
            SELECT
              COUNT(*)::int AS total_queue_queued_active,
              COUNT(*) FILTER (
                WHERE lower(trim(coalesce(s.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
              )::int AS stale_bad_resolution,
              COUNT(*) FILTER (
                WHERE COALESCE(btrim(s.taalk_lead_id::text), '') = ''
              )::int AS stale_missing_taalk_lead_id,
              COUNT(*) FILTER (
                WHERE COALESCE(btrim(s.cn_email), '') <> ''
                  AND lower(btrim(s.cn_email)) <> s.agent_email
              )::int AS stale_owned_by_other_email,
              COUNT(*) FILTER (
                WHERE lower(trim(coalesce(s.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                  AND COALESCE(btrim(s.taalk_lead_id::text), '') <> ''
                  AND (
                    COALESCE(btrim(s.cn_email), '') = ''
                    OR lower(btrim(s.cn_email)) = s.agent_email
                  )
              )::int AS callable_now,
              COUNT(*) FILTER (
                WHERE lower(trim(coalesce(s.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                  AND COALESCE(btrim(s.taalk_lead_id::text), '') <> ''
                  AND (
                    COALESCE(btrim(s.cn_email), '') = ''
                    OR lower(btrim(s.cn_email)) = s.agent_email
                  )
                  AND (
                    ald.last_dial_at IS NULL
                    OR ald.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
                  )
              )::int AS callable_with_idle_owner,
              COUNT(*) FILTER (
                WHERE lower(trim(coalesce(s.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                  AND COALESCE(btrim(s.taalk_lead_id::text), '') <> ''
                  AND (
                    COALESCE(btrim(s.cn_email), '') = ''
                    OR lower(btrim(s.cn_email)) = s.agent_email
                  )
                  AND ald.last_dial_at >= NOW() - ($1::int * INTERVAL '1 minute')
              )::int AS callable_with_recent_owner
            FROM scoped s
            LEFT JOIN agent_last_dial ald ON ald.agent_email = s.agent_email
          `,
          [idleMinutes, queue],
        );

    const topIdleOwners = staleOnly
      ? { rows: [] }
      : await client.query(
      `
        WITH scoped AS (
          SELECT
            lower(la.agent_email) AS agent_email
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE la.status IN ('queued', 'active')
            AND la.queue = $2
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND (
              COALESCE(btrim(ml.cn_email), '') = ''
              OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
            )
        ),
        active_agents AS (
          SELECT DISTINCT agent_email FROM scoped
        ),
        agent_last_dial AS (
          SELECT aa.agent_email, MAX(adm.event_timestamp) AS last_dial_at
          FROM active_agents aa
          LEFT JOIN agent_dial_metrics adm
            ON lower(adm.agent_email) = aa.agent_email
           AND adm.event_type = 'dial'
          GROUP BY aa.agent_email
        )
        SELECT
          s.agent_email,
          COUNT(*)::int AS callable_count,
          ald.last_dial_at,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - ald.last_dial_at))/60)::int AS mins_since_last_dial
        FROM scoped s
        LEFT JOIN agent_last_dial ald ON ald.agent_email = s.agent_email
        WHERE ald.last_dial_at IS NULL
           OR ald.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
        GROUP BY s.agent_email, ald.last_dial_at
        ORDER BY callable_count DESC, s.agent_email ASC
        LIMIT 15
      `,
          [idleMinutes, queue],
        );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          idleMinutes,
          queue,
          mode: staleOnly ? "stale-only" : "full",
          snapshot: snapshot.rows[0] || null,
          top_idle_callable_holders: topIdleOwners.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
