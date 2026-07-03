import { pool } from "../db.js";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function main() {
  const day = String(process.argv[2] || "");
  if (!isIsoDate(day)) {
    console.error("Usage: npx tsx server/scripts/audit-dials-day.ts YYYY-MM-DD");
    process.exit(1);
  }

  const result = await pool.query<{
    owner_sid: string;
    owner_family: string;
    owner_pstn_sid: string;
    all_sid: string;
    all_family: string;
    all_pstn_sid: string;
  }>(
    `
      WITH bounds AS (
        SELECT
          (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS ts_start,
          ((($1::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS ts_end
      ),
      base AS (
        SELECT
          twilio_call_sid,
          NULLIF(parent_call_sid, '') AS parent_call_sid,
          owner_email,
          LOWER(COALESCE(call_direction, '')) AS call_direction,
          COALESCE(to_number, '') AS to_number
        FROM twilio_call_logs t
        CROSS JOIN bounds b
        WHERE t.call_started_at >= b.ts_start
          AND t.call_started_at < b.ts_end
          AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial')
      ),
      owner_rows AS (
        SELECT *
        FROM base
        WHERE owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
      ),
      all_pstn AS (
        SELECT *
        FROM base
        WHERE to_number <> ''
          AND to_number NOT ILIKE 'client:%'
      ),
      owner_pstn AS (
        SELECT *
        FROM owner_rows
        WHERE to_number <> ''
          AND to_number NOT ILIKE 'client:%'
      )
      SELECT
        (SELECT COUNT(DISTINCT twilio_call_sid)::text FROM owner_rows) AS owner_sid,
        (SELECT COUNT(DISTINCT COALESCE(parent_call_sid, twilio_call_sid))::text FROM owner_rows) AS owner_family,
        (SELECT COUNT(DISTINCT twilio_call_sid)::text FROM owner_pstn) AS owner_pstn_sid,
        (SELECT COUNT(DISTINCT twilio_call_sid)::text FROM base) AS all_sid,
        (SELECT COUNT(DISTINCT COALESCE(parent_call_sid, twilio_call_sid))::text FROM base) AS all_family,
        (SELECT COUNT(DISTINCT twilio_call_sid)::text FROM all_pstn) AS all_pstn_sid
    `,
    [day],
  );

  console.log(
    JSON.stringify(
      {
        day,
        totals: result.rows[0],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error((err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
