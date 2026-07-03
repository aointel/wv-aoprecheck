const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function run() {
  const idleMinutes = Math.max(1, Number(process.argv[2] || 60));
  const outDir = path.join(__dirname, "output");
  const outPath = path.join(outDir, `idle-callable-holders-${idleMinutes}m-${stamp()}.csv`);

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const idleResult = await client.query(
      `
        WITH holders AS (
          SELECT
            lower(la.agent_email) AS agent_email,
            COUNT(*)::int AS held_count
          FROM leasedialer_assignments la
          WHERE la.queue = 'hotlead'
            AND la.status IN ('queued', 'active')
          GROUP BY 1
        ),
        agent_last_dial AS (
          SELECT
            h.agent_email,
            h.held_count,
            MAX(adm.event_timestamp) AS last_dial_at
          FROM holders h
          LEFT JOIN agent_dial_metrics adm
            ON lower(adm.agent_email) = h.agent_email
           AND adm.event_type = 'dial'
          GROUP BY h.agent_email, h.held_count
        )
        SELECT
          ald.agent_email,
          ald.held_count,
          ald.last_dial_at,
          CASE
            WHEN ald.last_dial_at IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - ald.last_dial_at)) / 60)::int
          END AS mins_since_last_dial
        FROM agent_last_dial ald
        WHERE ald.last_dial_at IS NULL
           OR ald.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
        ORDER BY ald.held_count DESC, ald.agent_email ASC
      `,
      [idleMinutes],
    );

    const idleEmails = idleResult.rows.map((r) => String(r.agent_email).toLowerCase());
    let callableMap = new Map();
    if (idleEmails.length > 0) {
      const callableResult = await client.query(
        `
          SELECT
            lower(la.agent_email) AS agent_email,
            COUNT(*)::int AS callable_count
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE lower(la.agent_email) = ANY($1::text[])
            AND la.queue = 'hotlead'
            AND la.status IN ('queued', 'active')
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND (
              COALESCE(btrim(ml.cn_email), '') = ''
              OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
            )
          GROUP BY 1
        `,
        [idleEmails],
      );
      callableMap = new Map(
        callableResult.rows.map((r) => [String(r.agent_email).toLowerCase(), Number(r.callable_count || 0)]),
      );
    }

    const rowsWithCallable = idleResult.rows
      .map((r) => ({
        agent_email: String(r.agent_email).toLowerCase(),
        callable_count: callableMap.get(String(r.agent_email).toLowerCase()) || 0,
        raw_held_count: Number(r.held_count || 0),
        last_dial_at: r.last_dial_at,
        mins_since_last_dial: r.mins_since_last_dial == null ? null : Number(r.mins_since_last_dial),
      }))
      .filter((r) => r.callable_count > 0)
      .sort((a, b) => b.callable_count - a.callable_count || a.agent_email.localeCompare(b.agent_email));

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const header = "agent_email,callable_count,raw_held_count,last_dial_at,mins_since_last_dial";
    const rows = rowsWithCallable.map((r) =>
      [
        r.agent_email,
        Number(r.callable_count || 0),
        Number(r.raw_held_count || 0),
        r.last_dial_at ? new Date(r.last_dial_at).toISOString() : "",
        r.mins_since_last_dial == null ? "" : Number(r.mins_since_last_dial),
      ].join(","),
    );
    fs.writeFileSync(outPath, [header, ...rows].join("\n"), "utf8");

    const totalCallableHeld = rowsWithCallable.reduce((sum, r) => sum + Number(r.callable_count || 0), 0);
    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          idleMinutes,
          idleAgents: idleResult.rows.length,
          idleAgentsHoldingCallable: rowsWithCallable.length,
          callableHeldByIdleAgents: totalCallableHeld,
          outputCsv: outPath,
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
