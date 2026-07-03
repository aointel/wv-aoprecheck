const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeMarket(value) {
  const raw = String(value || "").trim();
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  if (compact.includes("globe")) return "Globe Market";
  if (compact.includes("veteran")) return "Veteran";
  return raw;
}

function normalizeState(value) {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("usage: node tmp-check-masterlead-profile-inventory.cjs <agentEmail>");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const profileRes = await client.query(
      `
      SELECT markets, states
      FROM agent_routing_profiles
      WHERE lower(agent_email) = lower($1)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [email],
    );

    const markets = Array.from(
      new Set((profileRes.rows[0]?.markets || []).map(normalizeMarket).filter(Boolean)),
    );
    const states = Array.from(
      new Set((profileRes.rows[0]?.states || []).map(normalizeState).filter((s) => /^[A-Z]{2}$/.test(s))),
    );

    if (!markets.length || !states.length) {
      console.log(
        JSON.stringify(
          {
            email,
            routing_profile: profileRes.rows[0] || null,
            error: "missing_routing_profile",
          },
          null,
          2,
        ),
      );
      return;
    }

    const byState = await client.query(
      `
      WITH active AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued', 'active')
      ),
      scoped AS (
        SELECT
          ml.id,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'XX') AS state,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS cnresolution,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id,
          COALESCE(btrim(ml.cn_email), '') AS cn_email,
          CASE WHEN a.lead_id IS NULL THEN 0 ELSE 1 END AS is_actively_assigned
        FROM masterlead ml
        LEFT JOIN active a ON a.lead_id = ml.id
        WHERE (
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END
        ) = ANY($1::text[])
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'XX') = ANY($2::text[])
      )
      SELECT
        state,
        COUNT(*)::int AS total_masterlead,
        COUNT(*) FILTER (WHERE cnresolution IN ('pending', 'new', '', 'null'))::int AS pending_like,
        COUNT(*) FILTER (WHERE cnresolution IN ('pending', 'new', '', 'null') AND taalk_lead_id <> '')::int AS pending_like_with_taalk,
        COUNT(*) FILTER (
          WHERE cnresolution IN ('pending', 'new', '', 'null')
            AND taalk_lead_id <> ''
            AND cn_email = ''
            AND is_actively_assigned = 0
        )::int AS callable_unowned_unassigned
      FROM scoped
      GROUP BY state
      ORDER BY state
      `,
      [markets, states],
    );

    const totals = byState.rows.reduce(
      (acc, row) => {
        acc.total_masterlead += Number(row.total_masterlead || 0);
        acc.pending_like += Number(row.pending_like || 0);
        acc.pending_like_with_taalk += Number(row.pending_like_with_taalk || 0);
        acc.callable_unowned_unassigned += Number(row.callable_unowned_unassigned || 0);
        return acc;
      },
      {
        total_masterlead: 0,
        pending_like: 0,
        pending_like_with_taalk: 0,
        callable_unowned_unassigned: 0,
      },
    );

    console.log(
      JSON.stringify(
        {
          email,
          routing_profile: { markets, states },
          totals,
          by_state: byState.rows,
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
