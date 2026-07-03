const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const owner = String(process.argv[2] || "").trim().toLowerCase();
  const days = Math.max(1, Number(process.argv[3] || 3) || 3);
  const minCalls = Math.max(2, Number(process.argv[4] || 5) || 5);
  const topN = Math.max(1, Number(process.argv[5] || 50) || 50);

  if (!owner || !owner.includes("@")) {
    throw new Error(
      "usage: node server/scripts/tmp-list-repeated-leads-for-agent.cjs <owner_email> [days=3] [min_calls=5] [topN=50]",
    );
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const repeated = await client.query(
      `
        WITH attempts AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            COUNT(*)::int AS call_attempts,
            COUNT(DISTINCT t.twilio_call_sid)::int AS distinct_sids,
            MIN(t.call_started_at) AS first_called_at,
            MAX(t.call_started_at) AS last_called_at
          FROM twilio_call_logs t
          WHERE lower(COALESCE(t.owner_email, '')) = lower($1)
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND t.call_started_at >= NOW() - ($2::int * INTERVAL '1 day')
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
          GROUP BY 1
          HAVING COUNT(*) >= $3
          ORDER BY COUNT(*) DESC, MAX(t.call_started_at) DESC
          LIMIT $4
        )
        SELECT
          a.phone10,
          a.call_attempts,
          a.distinct_sids,
          a.first_called_at,
          a.last_called_at,
          ml.id AS masterlead_id,
          ml.taalk_lead_id,
          ml.first_name,
          ml.last_name,
          ml.phone,
          ml.cn_email,
          ml.cnresolution,
          ml.updated_at
        FROM attempts a
        LEFT JOIN LATERAL (
          SELECT
            m.id,
            m.taalk_lead_id,
            m.first_name,
            m.last_name,
            m.phone,
            m.cn_email,
            m.cnresolution,
            m.updated_at
          FROM masterlead m
          WHERE RIGHT(REGEXP_REPLACE(COALESCE(m.phone::text, ''), '\\D', '', 'g'), 10) = a.phone10
             OR RIGHT(REGEXP_REPLACE(COALESCE(m.phone_number::text, ''), '\\D', '', 'g'), 10) = a.phone10
          ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC NULLS LAST, m.id DESC
          LIMIT 3
        ) ml ON TRUE
        ORDER BY a.call_attempts DESC, a.last_called_at DESC, ml.updated_at DESC NULLS LAST
      `,
      [owner, days, minCalls, topN],
    );

    const grouped = new Map();
    for (const row of repeated.rows) {
      const key = row.phone10;
      if (!grouped.has(key)) {
        grouped.set(key, {
          phone10: row.phone10,
          call_attempts: row.call_attempts,
          distinct_sids: row.distinct_sids,
          first_called_at: row.first_called_at,
          last_called_at: row.last_called_at,
          mapped_masterlead_rows: [],
        });
      }
      if (row.masterlead_id) {
        grouped.get(key).mapped_masterlead_rows.push({
          masterlead_id: row.masterlead_id,
          taalk_lead_id: row.taalk_lead_id,
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone,
          cn_email: row.cn_email,
          cnresolution: row.cnresolution,
          updated_at: row.updated_at,
        });
      }
    }

    const result = Array.from(grouped.values());
    console.log(
      JSON.stringify(
        {
          owner,
          days,
          min_calls: minCalls,
          repeated_phone_count: result.length,
          rows: result,
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

