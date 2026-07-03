const { Pool } = require("pg");

const API_URL = "https://aoirail-production.up.railway.app/api/outbound-dialer/send-booked-lead";

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 20000,
  statement_timeout: 20000,
});

async function run() {
  const ptDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const bookedRows = await pool.query(
    `
      SELECT
        id,
        taalk_lead_id,
        LOWER(TRIM(COALESCE(cn_email, ''))) AS cn_email,
        cnresolution,
        updated_at
      FROM masterlead
      WHERE LOWER(COALESCE(cnresolution, '')) IN ('booked', 'appointment', 'appointment_set')
        AND updated_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND updated_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
      ORDER BY updated_at DESC
    `,
    [ptDay],
  );
  console.log(`Found ${bookedRows.rowCount || 0} booked rows for ${ptDay}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const details = [];

  for (const row of bookedRows.rows) {
    const taalkLeadId = String(row.taalk_lead_id || "").trim();
    const agentEmail = String(row.cn_email || "").trim();

    if (!taalkLeadId || !agentEmail || !agentEmail.includes("@")) {
      skipped++;
      details.push({
        id: row.id,
        taalk_lead_id: taalkLeadId || null,
        cn_email: agentEmail || null,
        status: "skipped_missing_taalk_or_email",
      });
      continue;
    }

    try {
      console.log(`Resending taalk_lead_id=${taalkLeadId} agent=${agentEmail}`);
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taalk_lead_id: taalkLeadId,
          agentEmail,
        }),
      });

      let body = null;
      try {
        body = await resp.json();
      } catch (_e) {
        body = null;
      }

      if (!resp.ok) {
        failed++;
        details.push({
          id: row.id,
          taalk_lead_id: taalkLeadId,
          cn_email: agentEmail,
          status: "api_failed",
          http_status: resp.status,
          body,
        });
        continue;
      }

      sent++;
      details.push({
        id: row.id,
        taalk_lead_id: taalkLeadId,
        cn_email: agentEmail,
        status: "sent",
        body,
      });
    } catch (err) {
      failed++;
      details.push({
        id: row.id,
        taalk_lead_id: taalkLeadId,
        cn_email: agentEmail,
        status: "exception",
        error: err?.message || String(err),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ptDay,
        bookedRows: bookedRows.rowCount || 0,
        sent,
        skipped,
        failed,
        details,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((err) => {
    console.error(err.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
