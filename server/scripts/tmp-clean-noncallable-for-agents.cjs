const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeStates(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((s) => String(s || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s)),
    ),
  );
}

async function run() {
  const emails = process.argv.slice(2).map((e) => String(e || "").trim().toLowerCase()).filter((e) => e.includes("@"));
  if (emails.length === 0) {
    throw new Error("usage: node tmp-clean-noncallable-for-agents.cjs <email1> <email2> ...");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const results = [];
    for (const email of emails) {
      const profile = await client.query(
        `
        SELECT states
        FROM agent_routing_profiles
        WHERE lower(agent_email) = lower($1)
        ORDER BY updated_at DESC
        LIMIT 1
        `,
        [email],
      );
      const states = normalizeStates(profile.rows[0]?.states);

      const before = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE la.status IN ('queued','active') AND la.queue='hotlead')::int AS raw_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue='hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = lower($1)
              )
              AND array_length($2::text[], 1) IS NOT NULL
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
          )::int AS strict_callable
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
        `,
        [email, states],
      );

      const cleanup = await client.query(
        `
        UPDATE leasedialer_assignments la
        SET status = 'released',
            released_at = NOW(),
            release_reason = 'manual_noncallable_cleanup',
            updated_at = NOW()
        FROM masterlead ml
        WHERE ml.id = la.lead_id
          AND lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued','active')
          AND (
            lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
            OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
            OR (
              COALESCE(btrim(ml.cn_email), '') <> ''
              AND lower(btrim(ml.cn_email)) <> lower($1)
            )
            OR array_length($2::text[], 1) IS NULL
            OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) IS NULL
            OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($2::text[])
          )
        `,
        [email, states],
      );

      const after = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE la.status IN ('queued','active') AND la.queue='hotlead')::int AS raw_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue='hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = lower($1)
              )
              AND array_length($2::text[], 1) IS NOT NULL
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
          )::int AS strict_callable
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
        `,
        [email, states],
      );

      results.push({
        agent_email: email,
        profile_states: states.length,
        released_noncallable: Number(cleanup.rowCount || 0),
        before: before.rows[0] || null,
        after: after.rows[0] || null,
      });
    }

    console.log(JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
