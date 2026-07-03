import { pool } from "../db.js";

async function main() {
  const outbound = await pool.query(
    `
      SELECT
        twilio_call_sid,
        parent_call_sid,
        owner_email,
        from_number,
        to_number,
        call_direction,
        call_status,
        call_duration,
        call_started_at
      FROM twilio_call_logs
      WHERE LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
      ORDER BY call_started_at DESC
      LIMIT 5
    `,
  );

  const inbound = await pool.query(
    `
      SELECT
        twilio_call_sid,
        parent_call_sid,
        owner_email,
        from_number,
        to_number,
        call_direction,
        call_status,
        call_duration,
        call_started_at
      FROM twilio_call_logs
      WHERE LOWER(COALESCE(call_direction, '')) = 'inbound'
      ORDER BY call_started_at DESC
      LIMIT 5
    `,
  );

  console.log(
    JSON.stringify(
      {
        outbound: outbound.rows,
        inbound: inbound.rows,
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

