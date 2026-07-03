import { pool } from "../db.js";

async function main() {
  const day =
    process.argv[2] ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const rowCount = await pool.query<{ c: string }>(
    `
      SELECT COUNT(*)::text AS c
      FROM twilio_call_logs
      WHERE call_started_at >= ($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
        AND COALESCE(TRIM(owner_email), '') <> ''
    `,
    [day],
  );

  const distinctSidCount = await pool.query<{ c: string }>(
    `
      SELECT COUNT(DISTINCT twilio_call_sid)::text AS c
      FROM twilio_call_logs
      WHERE call_started_at >= ($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
        AND COALESCE(TRIM(owner_email), '') <> ''
    `,
    [day],
  );

  console.log(
    JSON.stringify(
      {
        day,
        sinceEst: `${day} 06:00:00 America/New_York`,
        outboundRowsWithOwnerEmail: Number(rowCount.rows[0]?.c || 0),
        distinctCallSidWithOwnerEmail: Number(distinctSidCount.rows[0]?.c || 0),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error((e as Error)?.message || String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
