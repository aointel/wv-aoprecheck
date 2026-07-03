const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const EMAIL = process.argv[2] || 'chrislafond@aoglobelife.com';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const associateRow = await client.query(
      `
      SELECT associate_id
      FROM customers
      WHERE lower(company_email) = lower($1)
         OR lower(personal_email) = lower($1)
      LIMIT 1
      `,
      [EMAIL],
    );

    const associateId = associateRow.rows[0]?.associate_id ?? null;

    let plusInventory = null;
    let plusResolutionBreakdown = [];
    if (associateId !== null) {
      plusInventory = (
        await client.query(
          `
          SELECT
            COUNT(*)::int AS total_plus,
            COUNT(*) FILTER (WHERE lower(trim(COALESCE(cnresolution, ''))) IN ('pending','new',''))::int AS callable_plus,
            COUNT(*) FILTER (WHERE lower(COALESCE(dnc::text, 'false')) IN ('true','t','yes','1'))::int AS dnc_plus
          FROM masterlead
          WHERE associate_id = $1
            AND (
              lower(COALESCE(taalk_market::text, '')) LIKE '%plus%'
              OR lower(COALESCE(market::text, '')) LIKE '%plus%'
            )
          `,
          [associateId],
        )
      ).rows[0];

      plusResolutionBreakdown = (
        await client.query(
          `
          SELECT lower(trim(COALESCE(cnresolution, ''))) AS resolution, COUNT(*)::int AS count
          FROM masterlead
          WHERE associate_id = $1
            AND (
              lower(COALESCE(taalk_market::text, '')) LIKE '%plus%'
              OR lower(COALESCE(market::text, '')) LIKE '%plus%'
            )
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 20
          `,
          [associateId],
        )
      ).rows;
    }

    const plusAssignments = (
      await client.query(
        `
        SELECT status, COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'plus'
        GROUP BY status
        ORDER BY status ASC
        `,
        [EMAIL],
      )
    ).rows;

    const plusAssignmentSample = (
      await client.query(
        `
        SELECT
          la.lead_id,
          la.status,
          la.created_at,
          ml.cnresolution,
          ml.taalk_market,
          ml.market
        FROM leasedialer_assignments la
        LEFT JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'plus'
          AND la.status IN ('queued', 'active')
        ORDER BY la.created_at DESC
        LIMIT 20
        `,
        [EMAIL],
      )
    ).rows;

    console.log(
      JSON.stringify(
        {
          email: EMAIL,
          associate_id: associateId,
          plus_inventory_by_associate: plusInventory,
          plus_resolution_breakdown: plusResolutionBreakdown,
          plus_assignments_for_agent: plusAssignments,
          plus_assignment_sample: plusAssignmentSample,
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
