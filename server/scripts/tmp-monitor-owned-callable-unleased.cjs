const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const step = Math.max(5000, Math.min(50000, Number(process.env.MONITOR_ID_STEP || 20000)));
  const alertThreshold = Math.max(0, Number(process.env.MONITOR_ALERT_THRESHOLD || process.argv[2] || 0));
  const topLimit = Math.max(1, Math.min(50, Number(process.env.MONITOR_TOP_LIMIT || 20)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const bounds = await client.query(`
      SELECT COALESCE(MIN(id), 0)::int AS min_id, COALESCE(MAX(id), 0)::int AS max_id
      FROM masterlead
    `);
    const minId = Number(bounds.rows[0]?.min_id || 0);
    const maxId = Number(bounds.rows[0]?.max_id || 0);

    let total = 0;
    const byOwner = new Map();

    for (let start = minId; start <= maxId; start += step) {
      const end = start + step;

      const chunkTotal = await client.query(
        `
        WITH scoped AS (
          SELECT ml.id, lower(btrim(ml.cn_email)) AS owner_email
          FROM masterlead ml
          WHERE ml.id >= $1
            AND ml.id < $2
            AND COALESCE(btrim(ml.cn_email), '') <> ''
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
        )
        SELECT COUNT(*)::int AS total_count
        FROM scoped
        `,
        [start, end],
      );
      total += Number(chunkTotal.rows[0]?.total_count || 0);

      const chunkOwners = await client.query(
        `
        WITH scoped AS (
          SELECT lower(btrim(ml.cn_email)) AS owner_email
          FROM masterlead ml
          WHERE ml.id >= $1
            AND ml.id < $2
            AND COALESCE(btrim(ml.cn_email), '') <> ''
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
        )
        SELECT owner_email, COUNT(*)::int AS owner_count
        FROM scoped
        GROUP BY owner_email
        `,
        [start, end],
      );

      for (const row of chunkOwners.rows) {
        const owner = String(row.owner_email || "");
        if (!owner) continue;
        byOwner.set(owner, (byOwner.get(owner) || 0) + Number(row.owner_count || 0));
      }
    }

    const topOwners = Array.from(byOwner.entries())
      .map(([owner_email, count]) => ({ owner_email, count }))
      .sort((a, b) => b.count - a.count || a.owner_email.localeCompare(b.owner_email))
      .slice(0, topLimit);

    const payload = {
      ranAt: new Date().toISOString(),
      threshold: alertThreshold,
      drift_count: total,
      alert: total > alertThreshold,
      top_owners: topOwners,
    };

    console.log(JSON.stringify(payload, null, 2));
    if (total > alertThreshold) {
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
