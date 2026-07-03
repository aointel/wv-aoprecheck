const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const step = Math.max(5000, Math.min(50000, Number(process.env.GLOBE_TIED_STEP || 20000)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const bounds = await client.query(`
      SELECT COALESCE(MIN(id),0)::int AS min_id, COALESCE(MAX(id),0)::int AS max_id
      FROM masterlead
    `);
    const minId = Number(bounds.rows[0]?.min_id || 0);
    const maxId = Number(bounds.rows[0]?.max_id || 0);

    const totals = {
      callable_any_owner: 0,
      free_unowned_unassigned: 0,
      tied_unowned_but_assigned: 0,
      tied_owned_no_assignment: 0,
      tied_owned_and_assigned_same_owner: 0,
      tied_owner_assignment_mismatch: 0,
    };
    const holders = new Map();

    for (let start = minId; start <= maxId; start += step) {
      const end = start + step;

      const chunkSummary = await client.query(
        `
        WITH active AS (
          SELECT lead_id, lower(agent_email) AS assignment_agent_email
          FROM leasedialer_assignments
          WHERE queue = 'hotlead'
            AND status IN ('queued', 'active')
            AND lead_id >= $1
            AND lead_id < $2
        ),
        base AS (
          SELECT
            ml.id AS lead_id,
            lower(COALESCE(btrim(ml.cn_email), '')) AS owner_email,
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END AS canonical_market,
            lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
            COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id
          FROM masterlead ml
          WHERE ml.id >= $1
            AND ml.id < $2
        ),
        scoped AS (
          SELECT
            b.lead_id,
            b.owner_email,
            a.assignment_agent_email,
            CASE
              WHEN b.owner_email = '' AND a.assignment_agent_email IS NULL THEN 'free_unowned_unassigned'
              WHEN b.owner_email = '' AND a.assignment_agent_email IS NOT NULL THEN 'tied_unowned_but_assigned'
              WHEN b.owner_email <> '' AND a.assignment_agent_email IS NULL THEN 'tied_owned_no_assignment'
              WHEN b.owner_email <> '' AND a.assignment_agent_email = b.owner_email THEN 'tied_owned_and_assigned_same_owner'
              WHEN b.owner_email <> '' AND a.assignment_agent_email IS NOT NULL AND a.assignment_agent_email <> b.owner_email THEN 'tied_owner_assignment_mismatch'
              ELSE 'other'
            END AS blocker
          FROM base b
          LEFT JOIN active a ON a.lead_id = b.lead_id
          WHERE b.canonical_market = 'Globe Market'
            AND b.norm_resolution IN ('pending', 'new', '', 'null')
            AND b.taalk_lead_id <> ''
        )
        SELECT blocker, COUNT(*)::int AS lead_count
        FROM scoped
        GROUP BY blocker
        `,
        [start, end],
      );

      for (const row of chunkSummary.rows) {
        const blocker = String(row.blocker || "other");
        const count = Number(row.lead_count || 0);
        if (blocker === "free_unowned_unassigned") totals.free_unowned_unassigned += count;
        else if (blocker === "tied_unowned_but_assigned") totals.tied_unowned_but_assigned += count;
        else if (blocker === "tied_owned_no_assignment") totals.tied_owned_no_assignment += count;
        else if (blocker === "tied_owned_and_assigned_same_owner") totals.tied_owned_and_assigned_same_owner += count;
        else if (blocker === "tied_owner_assignment_mismatch") totals.tied_owner_assignment_mismatch += count;
      }

      const chunkHolders = await client.query(
        `
        WITH active AS (
          SELECT lead_id, lower(agent_email) AS assignment_agent_email
          FROM leasedialer_assignments
          WHERE queue = 'hotlead'
            AND status IN ('queued', 'active')
            AND lead_id >= $1
            AND lead_id < $2
        ),
        base AS (
          SELECT
            ml.id AS lead_id,
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END AS canonical_market,
            lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
            COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id
          FROM masterlead ml
          WHERE ml.id >= $1
            AND ml.id < $2
        )
        SELECT
          a.assignment_agent_email AS agent_email,
          COUNT(*)::int AS tied_count
        FROM base b
        JOIN active a ON a.lead_id = b.lead_id
        WHERE b.canonical_market = 'Globe Market'
          AND b.norm_resolution IN ('pending', 'new', '', 'null')
          AND b.taalk_lead_id <> ''
        GROUP BY a.assignment_agent_email
        `,
        [start, end],
      );

      for (const row of chunkHolders.rows) {
        const email = String(row.agent_email || "");
        if (!email) continue;
        holders.set(email, (holders.get(email) || 0) + Number(row.tied_count || 0));
      }
    }

    totals.callable_any_owner =
      totals.free_unowned_unassigned +
      totals.tied_unowned_but_assigned +
      totals.tied_owned_no_assignment +
      totals.tied_owned_and_assigned_same_owner +
      totals.tied_owner_assignment_mismatch;

    const top_holders = Array.from(holders.entries())
      .map(([agent_email, tied_count]) => ({ agent_email, tied_count }))
      .sort((a, b) => b.tied_count - a.tied_count || a.agent_email.localeCompare(b.agent_email))
      .slice(0, 50);

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          market: "Globe Market",
          chunkStep: step,
          totals,
          top_holders,
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
