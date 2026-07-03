const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 0,
    query_timeout: 0,
  });
  await client.connect();
  try {
    const badTargets = await client.query(`
      WITH bad_failed AS (
        SELECT
          t.twilio_call_sid,
          t.owner_email,
          REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g') AS digits,
          RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS last10,
          t.call_started_at
        FROM twilio_call_logs t
        WHERE t.call_started_at >= NOW() - INTERVAL '30 days'
          AND lower(COALESCE(t.call_status, '')) = 'failed'
          AND lower(COALESCE(t.call_direction, '')) = 'outbound-dial'
          AND NOT (
            length(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g')) = 11
            AND REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g') LIKE '1%'
          )
      )
      SELECT
        digits,
        last10,
        COUNT(*)::int AS failed_calls,
        COUNT(DISTINCT twilio_call_sid)::int AS distinct_failed_sids,
        MIN(call_started_at) AS first_seen,
        MAX(call_started_at) AS last_seen,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT owner_email), NULL) AS owners
      FROM bad_failed
      GROUP BY digits, last10
      ORDER BY failed_calls DESC, last_seen DESC
    `);

    const rows = (badTargets.rows || []).map((r) => ({
      ...r,
      queue_rows_active: 0,
      queue_agents: [],
      masterlead_assigned_pending_like: 0,
      assigned_agents: [],
    }));

    const byLast10 = new Map();
    for (const row of rows) {
      if (row.last10 && String(row.last10).length === 10) {
        if (!byLast10.has(row.last10)) byLast10.set(row.last10, []);
        byLast10.get(row.last10).push(row);
      }
    }

    const last10s = Array.from(byLast10.keys());
    const batchSize = 300;
    for (let i = 0; i < last10s.length; i += batchSize) {
      const batch = last10s.slice(i, i + batchSize);
      const batchRes = await client.query(
        `
          SELECT
            COALESCE(NULLIF(BTRIM(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)) AS last10,
            COUNT(*) FILTER (WHERE la.status IN ('queued', 'active'))::int AS queue_rows_active,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN la.status IN ('queued', 'active') THEN la.agent_email END), NULL) AS queue_agents,
            COUNT(*) FILTER (
              WHERE ml.cn_email IS NOT NULL
                AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null', 'called')
            )::int AS masterlead_assigned_pending_like,
            ARRAY_REMOVE(
              ARRAY_AGG(
                DISTINCT CASE
                  WHEN ml.cn_email IS NOT NULL
                    AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null', 'called')
                  THEN ml.cn_email
                END
              ),
              NULL
            ) AS assigned_agents
          FROM masterlead ml
          LEFT JOIN leasedialer_assignments la ON la.lead_id = ml.id
          WHERE COALESCE(NULLIF(BTRIM(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)) = ANY($1::text[])
          GROUP BY 1
        `,
        [batch]
      );

      for (const info of batchRes.rows || []) {
        const hits = byLast10.get(info.last10) || [];
        for (const row of hits) {
          row.queue_rows_active = Number(info.queue_rows_active || 0);
          row.queue_agents = info.queue_agents || [];
          row.masterlead_assigned_pending_like = Number(info.masterlead_assigned_pending_like || 0);
          row.assigned_agents = info.assigned_agents || [];
        }
      }
    }
    const summary = rows.reduce(
      (acc, r) => {
        acc.bad_targets += 1;
        acc.failed_calls += Number(r.failed_calls || 0);
        if (Number(r.queue_rows_active || 0) > 0) acc.targets_in_active_queue += 1;
        if (Number(r.masterlead_assigned_pending_like || 0) > 0) acc.targets_assigned_pending_like += 1;
        acc.queue_rows_active += Number(r.queue_rows_active || 0);
        acc.masterlead_assigned_pending_like += Number(r.masterlead_assigned_pending_like || 0);
        return acc;
      },
      {
        bad_targets: 0,
        failed_calls: 0,
        targets_in_active_queue: 0,
        targets_assigned_pending_like: 0,
        queue_rows_active: 0,
        masterlead_assigned_pending_like: 0,
      }
    );

    const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outDir, `bad-failed-targets-30d-${stamp}.json`);
    const csvPath = path.join(outDir, `bad-failed-targets-30d-${stamp}.csv`);

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAtUtc: new Date().toISOString(),
          window: "30 days",
          summary,
          rows,
        },
        null,
        2
      ),
      "utf8"
    );

    const header = [
      "digits",
      "last10",
      "failed_calls",
      "distinct_failed_sids",
      "first_seen",
      "last_seen",
      "owners",
      "queue_rows_active",
      "queue_agents",
      "masterlead_assigned_pending_like",
      "assigned_agents",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.digits,
          r.last10,
          r.failed_calls,
          r.distinct_failed_sids,
          r.first_seen,
          r.last_seen,
          (r.owners || []).join("|"),
          r.queue_rows_active,
          (r.queue_agents || []).join("|"),
          r.masterlead_assigned_pending_like,
          (r.assigned_agents || []).join("|"),
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    fs.writeFileSync(csvPath, lines.join("\n"), "utf8");

    console.log(
      JSON.stringify(
        {
          summary,
          jsonReport: jsonPath,
          csvReport: csvPath,
          top10: rows.slice(0, 10),
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

