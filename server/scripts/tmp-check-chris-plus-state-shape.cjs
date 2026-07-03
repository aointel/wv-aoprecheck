const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const res = await client.query(
      `
      WITH plus_rows AS (
        SELECT
          id,
          associate_id,
          COALESCE(NULLIF(upper(btrim(taalk_state::text)), ''), NULLIF(upper(btrim(state::text)), '')) AS canonical_state,
          lower(trim(coalesce(cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(btrim(taalk_lead_id::text), '') AS taalk_lead_id,
          lower(COALESCE(dnc::text, 'false')) AS dnc_text
        FROM masterlead
        WHERE btrim(associate_id::text) = '409'
          AND lower(coalesce(taalk_market, market, '')) LIKE '%plus%'
      )
      SELECT
        COUNT(*)::int AS total_plus,
        COUNT(*) FILTER (WHERE canonical_state IS NULL)::int AS missing_state,
        COUNT(*) FILTER (WHERE canonical_state IS NOT NULL)::int AS with_state,
        COUNT(*) FILTER (WHERE canonical_state = 'CA')::int AS state_ca,
        COUNT(*) FILTER (WHERE norm_resolution IN ('pending','new','','null'))::int AS pending_like,
        COUNT(*) FILTER (WHERE taalk_lead_id <> '')::int AS with_taalk_lead_id,
        COUNT(*) FILTER (WHERE dnc_text NOT IN ('true','t','yes','1'))::int AS dnc_ok,
        COUNT(*) FILTER (
          WHERE canonical_state IS NOT NULL
            AND norm_resolution IN ('pending','new','','null')
            AND taalk_lead_id <> ''
            AND dnc_text NOT IN ('true','t','yes','1')
        )::int AS strict_like_server
      FROM plus_rows
      `,
    );
    console.log(JSON.stringify(res.rows[0] || {}, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

