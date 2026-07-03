import { pool } from "../db.js";

async function main() {
  const day =
    process.argv[2] ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const total = await pool.query<{ c: string }>(
    `
      SELECT COUNT(DISTINCT twilio_call_sid)::text AS c
      FROM twilio_call_logs
      WHERE call_started_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND call_started_at < ((($1::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
        AND COALESCE(TRIM(twilio_call_sid), '') <> ''
    `,
    [day],
  );

  const withOwner = await pool.query<{ c: string }>(
    `
      SELECT COUNT(DISTINCT twilio_call_sid)::text AS c
      FROM twilio_call_logs
      WHERE call_started_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND call_started_at < ((($1::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
        AND COALESCE(TRIM(twilio_call_sid), '') <> ''
        AND COALESCE(TRIM(owner_email), '') <> ''
    `,
    [day],
  );

  const totalN = Number(total.rows[0]?.c || 0);
  const withOwnerN = Number(withOwner.rows[0]?.c || 0);
  const withoutOwnerN = Math.max(0, totalN - withOwnerN);

  console.log(
    JSON.stringify(
      {
        day,
        window: `${day} 06:00:00 -> next day 06:00:00 America/New_York`,
        outboundDistinctSidsTotal: totalN,
        outboundDistinctSidsWithOwner: withOwnerN,
        outboundDistinctSidsWithoutOwner: withoutOwnerN,
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

