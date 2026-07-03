import { Client } from "pg";
import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

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
    const dbRecent = await pg.query(
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
      WHERE call_started_at >= NOW() - INTERVAL '14 days'
      ORDER BY call_started_at DESC NULLS LAST
      LIMIT 5000
      `,
      [],
    );
    const onlyPhone = (dbRecent.rows || []).filter((r: any) => {
      const to10 = String(r.to_number || "").replace(/\D/g, "").slice(-10);
      const from10 = String(r.from_number || "").replace(/\D/g, "").slice(-10);
      return to10 === phone || from10 === phone;
    });

    const leadRows = await pg.query(
      `
      SELECT id, taalk_lead_id, first_name, last_name, phone, phone_last10, cnresolution, cn_email, market, state, updated_at
      FROM masterlead
      WHERE id = $1 OR taalk_lead_id = $2 OR phone_last10 = $3
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 10
      `,
      [leadId, aoLeadId, phone],
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
        duration: c.duration,
        answeredBy: c.answeredBy,
        errorCode: c.errorCode,
        errorMessage: c.errorMessage,
      }));

    const alerts = await (client as any).monitor.v1.alerts.list({ limit: 4000 });
    const relatedAlerts = alerts
      .filter((a: any) => {
        const t = String(a.alertText || "");
        const u = String(a.requestUrl || "");
        const rs = String(a.resourceSid || "");
        return t.includes(phone) || u.includes(phone) || rs.includes(phone);
      })
      .slice(0, 50)
      .map((a: any) => ({
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
          masterleadRows: leadRows.rows,
          dbCalls: onlyPhone.slice(0, 40),
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

