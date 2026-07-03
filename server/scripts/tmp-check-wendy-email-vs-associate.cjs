const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const EMAIL = (process.argv[2] || "wendybiddle@aoglobelife.com").toLowerCase().trim();
const ASSOCIATE_ID = Number(process.argv[3] || "199256");

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const byEmail = await client.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE lower(trim(COALESCE(cnresolution, ''))) IN ('pending','new','','null'))::int AS pending_like
      FROM masterlead
      WHERE lower(trim(COALESCE(cn_email, ''))) = lower($1)
      `,
      [EMAIL],
    );

    const byEmailAssocBreakdown = await client.query(
      `
      SELECT
        COALESCE(associate_id::text, '(null)') AS associate_id,
        COUNT(*)::int AS count
      FROM masterlead
      WHERE lower(trim(COALESCE(cn_email, ''))) = lower($1)
      GROUP BY 1
      ORDER BY 2 DESC
      `,
      [EMAIL],
    );

    const byEmailStateBreakdown = await client.query(
      `
      SELECT
        COALESCE(NULLIF(upper(trim(COALESCE(taalk_state::text, state::text, ''))), ''), '(none)') AS state,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE lower(trim(COALESCE(cnresolution, ''))) IN ('pending','new','','null'))::int AS pending_like
      FROM masterlead
      WHERE lower(trim(COALESCE(cn_email, ''))) = lower($1)
      GROUP BY 1
      ORDER BY 2 DESC
      `,
      [EMAIL],
    );

    const byEmailPendingSample = await client.query(
      `
      SELECT
        id,
        associate_id,
        cnresolution,
        ao_lead_box,
        taalk_market,
        market,
        taalk_state,
        state,
        taalk_lead_id,
        dnc
      FROM masterlead
      WHERE lower(trim(COALESCE(cn_email, ''))) = lower($1)
        AND lower(trim(COALESCE(cnresolution, ''))) IN ('pending','new','','null')
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 30
      `,
      [EMAIL],
    );

    let byAssociate = null;
    if (ASSOCIATE_ID > 0) {
      byAssociate = (
        await client.query(
          `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE lower(trim(COALESCE(cnresolution, ''))) IN ('pending','new','','null'))::int AS pending_like
          FROM masterlead
          WHERE associate_id = $1
          `,
          [ASSOCIATE_ID],
        )
      ).rows[0];
    }

    console.log(
      JSON.stringify(
        {
          email: EMAIL,
          associate_id: ASSOCIATE_ID,
          masterlead_by_email: byEmail.rows[0] || null,
          masterlead_by_email_associate_breakdown: byEmailAssocBreakdown.rows,
          masterlead_by_email_state_breakdown: byEmailStateBreakdown.rows,
          pending_like_by_email_sample: byEmailPendingSample.rows,
          masterlead_by_customer_associate: byAssociate,
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
