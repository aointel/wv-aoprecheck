const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeState(value) {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeMarket(value) {
  const raw = String(value || "").trim();
  const n = raw.toLowerCase().replace(/\s+/g, "");
  if (n.includes("globe")) return "Globe Market";
  if (n.includes("veteran")) return "Veteran";
  return raw;
}

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const targetQueued = Math.max(1, Number(process.argv[3] || 25));
  const idleMinutes = Math.max(15, Number(process.argv[4] || 120));
  if (!email || !email.includes("@")) {
    throw new Error("usage: node tmp-rescue-agent-strict-leads.cjs <agentEmail> [targetQueued=25] [idleMinutes=120]");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 240000,
    query_timeout: 240000,
  });
  await client.connect();
  try {
    await client.query("BEGIN");

    const profile = await client.query(
      `
      SELECT markets, states
      FROM agent_routing_profiles
      WHERE lower(agent_email) = lower($1)
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [email],
    );
    const markets = Array.from(new Set((profile.rows[0]?.markets || []).map(normalizeMarket).filter(Boolean)));
    const states = Array.from(new Set((profile.rows[0]?.states || []).map(normalizeState).filter((s) => /^[A-Z]{2}$/.test(s))));
    if (!markets.length || !states.length) {
      throw new Error("agent missing routing profile markets/states");
    }

    const cleanup = await client.query(
      `
      UPDATE leasedialer_assignments la
      SET status = 'released',
          released_at = NOW(),
          release_reason = 'manual_state_mismatch_cleanup',
          updated_at = NOW()
      FROM masterlead ml
      WHERE lower(la.agent_email) = lower($1)
        AND la.queue = 'hotlead'
        AND la.status IN ('queued', 'active')
        AND ml.id = la.lead_id
        AND (
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) IS NULL
          OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($2::text[])
        )
      `,
      [email, states],
    );

    const reclaim = await client.query(
      `
      WITH agent_last_dial AS (
        SELECT lower(adm.agent_email) AS agent_email, MAX(adm.event_timestamp) AS last_dial_at
        FROM agent_dial_metrics adm
        WHERE adm.event_type = 'dial'
        GROUP BY lower(adm.agent_email)
      ),
      candidates AS (
        SELECT la.id, la.lead_id, la.agent_email
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        LEFT JOIN agent_last_dial ald ON ald.agent_email = lower(la.agent_email)
        WHERE la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND lower(la.agent_email) <> lower($1)
          AND (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
            END
          ) = ANY($2::text[])
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
          AND (ald.last_dial_at IS NULL OR ald.last_dial_at < NOW() - ($4::int * INTERVAL '1 minute'))
        ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
        LIMIT 250
      )
      UPDATE leasedialer_assignments la
      SET status = 'released',
          released_at = NOW(),
          release_reason = 'manual_targeted_idle_reclaim',
          updated_at = NOW()
      FROM candidates c
      WHERE la.id = c.id
      `,
      [email, markets, states, idleMinutes],
    );

    const callableNow = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE lower(la.agent_email) = lower($1)
        AND la.queue = 'hotlead'
        AND la.status IN ('queued', 'active')
        AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND (
          COALESCE(btrim(ml.cn_email), '') = ''
          OR lower(btrim(ml.cn_email)) = lower($1)
        )
      `,
      [email, states],
    );
    const current = Number(callableNow.rows[0]?.count || 0);
    const needed = Math.max(0, targetQueued - current);

    let inserted = 0;
    if (needed > 0) {
      const fill = await client.query(
        `
        WITH eligible AS (
          SELECT ml.id
          FROM masterlead ml
          WHERE (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
            END
          ) = ANY($2::text[])
            AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND COALESCE(btrim(ml.cn_email), '') = ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
          ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
          LIMIT $4
        ),
        ins AS (
          INSERT INTO leasedialer_assignments (
            lead_id, agent_email, queue, status, assigned_at, created_at, updated_at
          )
          SELECT id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM eligible
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS count
        FROM ins
        `,
        [email, markets, states, needed],
      );
      inserted = Number(fill.rows[0]?.count || 0);
    }

    const after = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE lower(la.agent_email) = lower($1)
        AND la.queue = 'hotlead'
        AND la.status IN ('queued', 'active')
        AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND (
          COALESCE(btrim(ml.cn_email), '') = ''
          OR lower(btrim(ml.cn_email)) = lower($1)
        )
      `,
      [email, states],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          email,
          targetQueued,
          idleMinutes,
          markets,
          states,
          cleanedOutOfProfile: Number(cleanup.rowCount || 0),
          reclaimedIdleFromOtherAgents: Number(reclaim.rowCount || 0),
          insertedStrictMatching: inserted,
          callableInProfileAfter: Number(after.rows[0]?.count || 0),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
