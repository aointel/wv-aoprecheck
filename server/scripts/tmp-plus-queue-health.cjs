const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const assignmentQueues = await client.query(`
      SELECT queue, status, COUNT(*)::int AS count
      FROM leasedialer_assignments
      WHERE lower(queue) LIKE '%plus%'
      GROUP BY queue, status
      ORDER BY queue ASC, status ASC
    `);

    const assignmentSummary = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'released')::int AS released,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM leasedialer_assignments
      WHERE queue = 'plus'
    `);

    const poolSummary = await client.query(`
      SELECT queue, status, COUNT(*)::int AS count
      FROM leasedialer_eligible_pool
      WHERE lower(queue) LIKE '%plus%'
      GROUP BY queue, status
      ORDER BY queue ASC, status ASC
    `);

    const callablePlusInventory = await client.query(`
      SELECT COUNT(*)::int AS callable_plus_inventory
      FROM masterlead ml
      WHERE (
          lower(COALESCE(ml.taalk_market::text, '')) LIKE '%plus%'
          OR lower(COALESCE(ml.market::text, '')) LIKE '%plus%'
        )
        AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
    `);

    const currentlyAssignedPlus = await client.query(`
      SELECT COUNT(*)::int AS assigned_plus_queued_active
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE la.status IN ('queued', 'active')
        AND (
          lower(COALESCE(ml.taalk_market::text, '')) LIKE '%plus%'
          OR lower(COALESCE(ml.market::text, '')) LIKE '%plus%'
        )
    `);

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          plus_assignment_summary: assignmentSummary.rows[0] || null,
          plus_like_assignment_queues: assignmentQueues.rows,
          plus_pool_summary: poolSummary.rows,
          callable_plus_inventory: callablePlusInventory.rows[0] || null,
          currently_assigned_plus_queued_active: currentlyAssignedPlus.rows[0] || null,
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
