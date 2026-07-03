const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function parseStates(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || "").toUpperCase().trim())
      .filter((v) => /^[A-Z]{2}$/.test(v));
  }
  const s = String(value || "").trim();
  if (!s) return [];
  return s
    .replace(/[\[\]"]/g, "")
    .split(/[,\s]+/)
    .map((v) => v.toUpperCase().trim())
    .filter((v) => /^[A-Z]{2}$/.test(v));
}

function canonicalizeMarket(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("globe")) return "Globe Market";
  if (normalized.includes("veteran")) return "Veteran";
  return value;
}

function parseMarkets(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((v) => v.trim());
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const market = canonicalizeMarket(item);
    const key = market.toLowerCase().replace(/\s+/g, "");
    if (!market) continue;
    if (key === "0" || key === "null" || key === "undefined" || key === "n/a") continue;
    if (key === "aorecruit" || key === "aovamos") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(market);
  }
  return out;
}

function getSupabaseAdminClient() {
  let supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  let supabaseServiceKey = String(
    process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      "",
  ).trim();
  if (!supabaseUrl || !supabaseServiceKey) {
    try {
      const hardcodedPath = path.resolve(__dirname, "..", "hardcoded-config.ts");
      const configText = fs.readFileSync(hardcodedPath, "utf8");
      const urlMatch = configText.match(/SUPABASE_URL:\s*'([^']+)'/);
      const serviceKeyMatch = configText.match(/SUPABASE_SERVICE_KEY:\s*'([^']+)'/);
      if (!supabaseUrl && urlMatch?.[1]) supabaseUrl = String(urlMatch[1]).trim();
      if (!supabaseServiceKey && serviceKeyMatch?.[1]) supabaseServiceKey = String(serviceKeyMatch[1]).trim();
    } catch {
      // keep env-only behavior if hardcoded config is unavailable
    }
  }
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
}

async function fetchCustomerRoutingFromSupabase(email) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return { source: "none", row: null };

  const byCompany = await supabaseAdmin
    .from("customers")
    .select(
      "company_email, personal_email, market, primary_market, secondary_market, designated_market, aoi_market, states, licensed_life_only_states, life_and_health_states, life_only_licensed_states, health_only_licensed_states",
    )
    .eq("company_email", email)
    .limit(3);
  if (byCompany.error) {
    throw new Error(`SUPABASE_CUSTOMERS_LOOKUP_FAILED(company_email): ${byCompany.error.message}`);
  }
  if (Array.isArray(byCompany.data) && byCompany.data.length > 0) {
    return { source: "supabase.customers.company_email", row: byCompany.data[0] };
  }

  const byPersonal = await supabaseAdmin
    .from("customers")
    .select(
      "company_email, personal_email, market, primary_market, secondary_market, designated_market, aoi_market, states, licensed_life_only_states, life_and_health_states, life_only_licensed_states, health_only_licensed_states",
    )
    .eq("personal_email", email)
    .limit(3);
  if (byPersonal.error) {
    throw new Error(`SUPABASE_CUSTOMERS_LOOKUP_FAILED(personal_email): ${byPersonal.error.message}`);
  }
  if (Array.isArray(byPersonal.data) && byPersonal.data.length > 0) {
    return { source: "supabase.customers.personal_email", row: byPersonal.data[0] };
  }

  return { source: "supabase.customers", row: null };
}

function parseCustomerStates(row) {
  const candidates = [
    row?.states,
    row?.licensed_states,
    row?.licensed_life_only_states,
    row?.life_and_health_states,
    row?.life_only_licensed_states,
    row?.health_only_licensed_states,
  ];
  const out = [];
  const seen = new Set();
  for (const candidate of candidates) {
    for (const state of parseStates(candidate)) {
      if (seen.has(state)) continue;
      seen.add(state);
      out.push(state);
    }
  }
  return out;
}

function parseCustomerMarkets(row) {
  const candidates = [
    row?.taalk_market,
    row?.market,
    row?.primary_market,
    row?.secondary_market,
    row?.designated_market,
    row?.aoi_market,
  ];
  const out = [];
  const seen = new Set();
  for (const candidate of candidates) {
    for (const market of parseMarkets(candidate)) {
      const key = market.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(market);
    }
  }
  return out;
}

async function fetchCustomerRoutingFromPostgres(client, email) {
  const customer = await client.query(
    `
    SELECT
      company_email,
      personal_email,
      taalk_market,
      market,
      licensed_states,
      states
    FROM customers
    WHERE lower(COALESCE(company_email, '')) = lower($1)
       OR lower(COALESCE(personal_email, '')) = lower($1)
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [email],
  );
  return customer.rows[0] || null;
}

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const queue = String(process.argv[3] || "hotlead").trim().toLowerCase();
  const skipCleanup = process.argv.includes("--no-clean");
  if (!email || !email.includes("@")) {
    throw new Error("Usage: node server/scripts/tmp-check-agent-masterlead-funnel.cjs <agent_email> [queue]");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    await client.query("SET statement_timeout = '60000ms'");

    let routingProfileSource = "supabase.customers";
    let customerRow = null;
    const supabaseRouting = await fetchCustomerRoutingFromSupabase(email);
    if (supabaseRouting.row) {
      routingProfileSource = supabaseRouting.source;
      customerRow = supabaseRouting.row;
    } else {
      try {
        customerRow = await fetchCustomerRoutingFromPostgres(client, email);
        if (customerRow) {
          routingProfileSource = "postgres.customers_fallback";
        }
      } catch (postgresRoutingError) {
        if (!String(postgresRoutingError?.message || "").includes('relation "customers" does not exist')) {
          throw postgresRoutingError;
        }
      }
    }

    const markets = parseCustomerMarkets(customerRow);
    const states = parseCustomerStates(customerRow);

    if (!customerRow || markets.length === 0 || states.length === 0) {
      throw new Error(
        `MISSING_CUSTOMER_ROUTING: no usable customers profile for ${email} (markets=${markets.length}, states=${states.length})`,
      );
    }

    let cleanup = { completed_count: 0 };
    if (!skipCleanup) {
      const cleanupRes = await client.query(
        `
        WITH scoped AS (
          SELECT la.id, la.lead_id
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          LEFT JOIN (
            VALUES
              ('CT','America/New_York'),('DC','America/New_York'),('DE','America/New_York'),('FL','America/New_York'),
              ('GA','America/New_York'),('MA','America/New_York'),('MD','America/New_York'),('ME','America/New_York'),
              ('MI','America/New_York'),('NC','America/New_York'),('NH','America/New_York'),('NJ','America/New_York'),
              ('NY','America/New_York'),('OH','America/New_York'),('PA','America/New_York'),('RI','America/New_York'),
              ('SC','America/New_York'),('VA','America/New_York'),('VT','America/New_York'),('WV','America/New_York'),
              ('IN','America/Indiana/Indianapolis'),
              ('AL','America/Chicago'),('AR','America/Chicago'),('IA','America/Chicago'),('IL','America/Chicago'),
              ('KS','America/Chicago'),('KY','America/Chicago'),('LA','America/Chicago'),('MN','America/Chicago'),
              ('MO','America/Chicago'),('MS','America/Chicago'),('ND','America/Chicago'),('NE','America/Chicago'),
              ('OK','America/Chicago'),('SD','America/Chicago'),('TN','America/Chicago'),('TX','America/Chicago'),
              ('WI','America/Chicago'),
              ('AZ','America/Phoenix'),
              ('CO','America/Denver'),('ID','America/Denver'),('MT','America/Denver'),('NM','America/Denver'),
              ('UT','America/Denver'),('WY','America/Denver'),
              ('CA','America/Los_Angeles'),('NV','America/Los_Angeles'),('OR','America/Los_Angeles'),('WA','America/Los_Angeles'),
              ('AK','America/Anchorage'),
              ('HI','Pacific/Honolulu')
          ) AS tm(state, tz) ON tm.state = COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''))
          WHERE lower(la.agent_email) = lower($1)
            AND la.queue = $2
            AND la.status IN ('queued', 'active')
            AND (
              lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
              OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
              OR lower(COALESCE(ml.dnc::text, 'false')) IN ('true', 't', 'yes', '1')
              OR (COALESCE(btrim(ml.cn_email), '') <> '' AND lower(btrim(ml.cn_email)) <> lower($1))
              OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($3::text[])
              OR (
                CASE
                  WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                  WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                  ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
                END
              ) <> ALL($4::text[])
              OR tm.tz IS NULL
              OR (now() AT TIME ZONE tm.tz)::time NOT BETWEEN time '08:00' AND time '21:00'
            )
          ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
          LIMIT 250
        ),
        completed AS (
          UPDATE leasedialer_assignments la
          SET status = 'completed',
              released_at = NOW(),
              release_reason = 'manual_noncallable_cleanup_customers_routing',
              updated_at = NOW()
          FROM scoped
          WHERE la.id = scoped.id
          RETURNING scoped.lead_id
        ),
        owner_cleared AS (
          UPDATE masterlead ml
          SET cn_email = NULL,
              assigned_date = NULL,
              updated_at = NOW()
          FROM completed c
          WHERE ml.id = c.lead_id
            AND lower(trim(coalesce(ml.cn_email, ''))) = lower($1)
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          RETURNING ml.id
        )
        SELECT COUNT(*)::int AS completed_count
        FROM completed
        `,
        [email, queue, states, markets],
      );
      cleanup = cleanupRes.rows[0] || cleanup;
    }

    const funnel = await client.query(
      `
      WITH routing AS (
        SELECT $1::text AS email, $2::text[] AS markets, $3::text[] AS states, $4::text AS queue
      ),
      tz_map(state, tz) AS (
        VALUES
          ('CT','America/New_York'),('DC','America/New_York'),('DE','America/New_York'),('FL','America/New_York'),
          ('GA','America/New_York'),('MA','America/New_York'),('MD','America/New_York'),('ME','America/New_York'),
          ('MI','America/New_York'),('NC','America/New_York'),('NH','America/New_York'),('NJ','America/New_York'),
          ('NY','America/New_York'),('OH','America/New_York'),('PA','America/New_York'),('RI','America/New_York'),
          ('SC','America/New_York'),('VA','America/New_York'),('VT','America/New_York'),('WV','America/New_York'),
          ('IN','America/Indiana/Indianapolis'),
          ('AL','America/Chicago'),('AR','America/Chicago'),('IA','America/Chicago'),('IL','America/Chicago'),
          ('KS','America/Chicago'),('KY','America/Chicago'),('LA','America/Chicago'),('MN','America/Chicago'),
          ('MO','America/Chicago'),('MS','America/Chicago'),('ND','America/Chicago'),('NE','America/Chicago'),
          ('OK','America/Chicago'),('SD','America/Chicago'),('TN','America/Chicago'),('TX','America/Chicago'),
          ('WI','America/Chicago'),
          ('AZ','America/Phoenix'),
          ('CO','America/Denver'),('ID','America/Denver'),('MT','America/Denver'),('NM','America/Denver'),
          ('UT','America/Denver'),('WY','America/Denver'),
          ('CA','America/Los_Angeles'),('NV','America/Los_Angeles'),('OR','America/Los_Angeles'),('WA','America/Los_Angeles'),
          ('AK','America/Anchorage'),
          ('HI','Pacific/Honolulu')
      ),
      active AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = (SELECT queue FROM routing)
          AND status IN ('queued', 'active')
      ),
      base AS (
        SELECT
          ml.id,
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS canonical_market,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS canonical_state,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id,
          COALESCE(btrim(ml.cn_email), '') AS cn_email,
          (
            lower(COALESCE(ml.taalk_market, '')) LIKE '%plus%'
            OR lower(COALESCE(ml.market, '')) LIKE '%plus%'
          ) AS is_plus,
          a.lead_id IS NOT NULL AS has_active_assignment
        FROM masterlead ml
        CROSS JOIN routing r
        LEFT JOIN active a ON a.lead_id = ml.id
        WHERE
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY(r.states)
          AND (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END
          ) = ANY(r.markets)
      ),
      scored AS (
        SELECT
          b.*,
          r.queue,
          tm.tz,
          (
            tm.tz IS NOT NULL
            AND (now() AT TIME ZONE tm.tz)::time BETWEEN time '08:00' AND time '21:00'
          ) AS in_calling_window,
          b.norm_resolution IN ('pending', 'new', '', 'null') AS resolution_callable,
          b.taalk_lead_id <> '' AS has_taalk_id,
          b.cn_email = '' AS owner_blank,
          NOT b.has_active_assignment AS not_already_assigned,
          CASE
            WHEN r.queue = 'plus' THEN b.is_plus
            ELSE NOT b.is_plus
          END AS queue_compat
        FROM base b
        CROSS JOIN routing r
        LEFT JOIN tz_map tm ON tm.state = b.canonical_state
      )
      SELECT
        COUNT(*) AS match_market_state,
        COUNT(*) FILTER (WHERE resolution_callable) AS plus_resolution,
        COUNT(*) FILTER (WHERE resolution_callable AND has_taalk_id) AS plus_taalk_id,
        COUNT(*) FILTER (WHERE resolution_callable AND has_taalk_id AND owner_blank) AS plus_owner_blank,
        COUNT(*) FILTER (WHERE resolution_callable AND has_taalk_id AND owner_blank AND queue_compat) AS plus_queue_compat,
        COUNT(*) FILTER (WHERE resolution_callable AND has_taalk_id AND owner_blank AND queue_compat AND not_already_assigned) AS plus_not_already_assigned,
        COUNT(*) FILTER (WHERE resolution_callable AND has_taalk_id AND owner_blank AND queue_compat AND not_already_assigned AND in_calling_window) AS strict_assignable_now
      FROM scored
      `,
      [email, markets, states, queue],
    );

    console.log(
      JSON.stringify(
        {
          email,
          queue,
          routing_profile_source: routingProfileSource,
          routing_profile: { markets, states },
          cleanup,
          funnel: funnel.rows[0] || null,
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
