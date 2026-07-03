const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: node server/scripts/tmp-check-agent-callable-supply-fast.cjs <agent_email>");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
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
    const markets = Array.isArray(profile.rows[0]?.markets) ? profile.rows[0].markets : [];
    const states = Array.isArray(profile.rows[0]?.states)
      ? profile.rows[0].states.map((s) => String(s || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()).filter(Boolean)
      : [];

    if (markets.length === 0 || states.length === 0) {
      console.log(
        JSON.stringify(
          {
            email,
            markets,
            states,
            error: "MISSING_ROUTING_PROFILE",
          },
          null,
          2,
        ),
      );
      return;
    }

    const market = markets[0];
    const marketToken = String(market || "").toLowerCase().includes("globe")
      ? "globe"
      : String(market || "").toLowerCase().includes("veteran")
        ? "veteran"
        : String(market || "").toLowerCase().trim();

    const cooldownMinutes = 120;
    const counts = await client.query(
      `
      WITH scoped AS (
        SELECT
          ml.id,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS canonical_state,
          lower(COALESCE(ml.taalk_market::text, ml.market::text, '')) AS market_raw,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id,
          lower(COALESCE(ml.dnc::text, 'false')) AS dnc_text,
          lower(COALESCE(btrim(ml.cn_email), '')) AS owner_email
        FROM masterlead ml
        WHERE COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
          AND lower(COALESCE(ml.taalk_market::text, ml.market::text, '')) LIKE ('%' || $3 || '%')
      ),
      callable AS (
        SELECT *
        FROM scoped s
        WHERE s.norm_resolution IN ('pending', 'new', '', 'null')
          AND s.taalk_lead_id <> ''
          AND s.dnc_text NOT IN ('true', 't', 'yes', '1')
      ),
      unassigned AS (
        SELECT c.*
        FROM callable c
        LEFT JOIN leasedialer_assignments la
          ON la.lead_id = c.id
         AND la.status IN ('queued', 'active')
        WHERE la.lead_id IS NULL
      ),
      recent_agent_blocked AS (
        SELECT u.*
        FROM unassigned u
        WHERE NOT EXISTS (
          SELECT 1
          FROM leasedialer_assignments la_hist
          WHERE la_hist.lead_id = u.id
            AND lower(la_hist.agent_email) = $1
            AND la_hist.created_at >= NOW() - INTERVAL '7 days'
        )
      ),
      recent_failed_phones AS (
        SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10
        FROM twilio_call_logs t
        WHERE lower(COALESCE(t.owner_email, '')) = lower($1)
          AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND lower(COALESCE(t.call_status, '')) IN ('failed', 'no-answer', 'no_answer')
          AND t.call_started_at >= NOW() - ($4::int * INTERVAL '1 minute')
          AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
      ),
      after_failed_phone_block AS (
        SELECT r.*
        FROM recent_agent_blocked r
        LEFT JOIN masterlead ml ON ml.id = r.id
        WHERE NOT EXISTS (
          SELECT 1
          FROM recent_failed_phones f
          WHERE f.phone10 = COALESCE(
            NULLIF(btrim(ml.phone_last10), ''),
            RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
          )
        )
      )
      SELECT
        (SELECT COUNT(*)::int FROM callable) AS callable_total_market_states,
        (SELECT COUNT(*)::int FROM unassigned) AS callable_unassigned_market_states,
        (SELECT COUNT(*)::int FROM unassigned WHERE owner_email = '' OR owner_email = $1) AS callable_unassigned_owner_blank_or_agent,
        (SELECT COUNT(*)::int FROM recent_agent_blocked) AS after_recent_agent_block,
        (SELECT COUNT(*)::int FROM after_failed_phone_block) AS after_recent_failed_phone_block
      `,
      [email, states, marketToken, cooldownMinutes],
    );

    console.log(
      JSON.stringify(
        {
          email,
          market,
          states,
          market_token_used: marketToken,
          failed_phone_cooldown_minutes: cooldownMinutes,
          counts: counts.rows[0] || null,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
