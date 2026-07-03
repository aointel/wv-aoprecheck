const { Client } = require("pg");
const twilio = require("twilio");
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = require("../hardcoded-config.js");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const phone = "6512836435";
  const leadId = 1237424;
  const aoLeadId = "21442052";
  const pg = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await pg.connect();
  try {
    const dbRows = await pg.query(
      `
      SELECT
        id,
        twilio_call_sid,
        call_status,
        call_direction,
        call_source,
        owner_email,
        from_number,
        to_number,
        call_started_at,
        metadata
      FROM twilio_call_logs
      WHERE
        RIGHT(REGEXP_REPLACE(COALESCE(to_number,''), '\\D', '', 'g'), 10) = $1
        OR RIGHT(REGEXP_REPLACE(COALESCE(from_number,''), '\\D', '', 'g'), 10) = $1
        OR metadata::text ILIKE $2
        OR metadata::text ILIKE $3
      ORDER BY call_started_at DESC NULLS LAST
      LIMIT 40
      `,
      [phone, `%${leadId}%`, `%${aoLeadId}%`],
    );

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const twCalls = await client.calls.list({ to: `+1${phone}`, limit: 50 });
    const twCallsRecent = twCalls
      .filter((c) => (c.dateCreated ? c.dateCreated >= since : true))
      .map((c) => ({
        sid: c.sid,
        status: c.status,
        from: c.from,
        to: c.to,
        direction: c.direction,
        dateCreated: c.dateCreated,
        dateUpdated: c.dateUpdated,
        duration: c.duration,
        answeredBy: c.answeredBy,
        errorCode: c.errorCode,
        errorMessage: c.errorMessage,
      }));

    const alerts = await client.monitor.v1.alerts.list({ limit: 3000 });
    const relatedAlerts = alerts
      .filter((a) => {
        const t = String(a.alertText || "");
        const u = String(a.requestUrl || "");
        const rs = String(a.resourceSid || "");
        return t.includes(phone) || u.includes(phone) || rs.includes(phone);
      })
      .slice(0, 50)
      .map((a) => ({
        sid: a.sid,
        dateCreated: a.dateCreated,
        errorCode: a.errorCode,
        requestUrl: a.requestUrl,
        alertText: String(a.alertText || "").slice(0, 280),
      }));

    console.log(
      JSON.stringify(
        {
          query: { phone, leadId, aoLeadId },
          dbCalls: dbRows.rows,
          twilioCallsToPhoneRecent: twCallsRecent,
          alertsDirectlyReferencingPhone: relatedAlerts,
        },
        null,
        2,
      ),
    );
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
