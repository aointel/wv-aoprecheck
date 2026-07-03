import { pool } from "../db.js";

async function main() {
  const day =
    process.argv[2] ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const metrics = await pool.query<{ agent_email: string; dials: string }>({
    text: `
      SELECT
        LOWER(TRIM(agent_email)) AS agent_email,
        COUNT(*) FILTER (WHERE LOWER(TRIM(event_type)) = 'dial')::int AS dials
      FROM agent_dial_metrics
      WHERE event_timestamp >= ($1::date::timestamp AT TIME ZONE 'America/New_York')
        AND event_timestamp < (($1::date + 1)::timestamp AT TIME ZONE 'America/New_York')
        AND COALESCE(TRIM(agent_email), '') <> ''
      GROUP BY LOWER(TRIM(agent_email))
    `,
    values: [day],
    query_timeout: 120000,
  });

  const metricRows = metrics.rows
    .map((row) => ({
      agentEmail: String(row.agent_email || "").toLowerCase().trim(),
      dials: Number(row.dials || 0),
    }))
    .filter((row) => row.agentEmail && row.dials > 0);

  const emails = metricRows.map((r) => r.agentEmail);
  const dials = metricRows.map((r) => r.dials);

  let upsertedRows = 0;
  if (emails.length > 0) {
    const updated = await pool.query({
      text: `
        WITH src AS (
          SELECT * FROM UNNEST($1::text[], $2::int[]) AS t(agent_email, dials)
        )
        UPDATE agent_daily_stats ads
        SET dials = GREATEST(COALESCE(ads.dials, 0), src.dials),
            updated_at = NOW()
        FROM src
        WHERE ads.stat_date = $3::date
          AND LOWER(TRIM(ads.agent_email)) = src.agent_email
      `,
      values: [emails, dials, day],
      query_timeout: 120000,
    });

    const inserted = await pool.query({
      text: `
        WITH src AS (
          SELECT * FROM UNNEST($1::text[], $2::int[]) AS t(agent_email, dials)
        )
        INSERT INTO agent_daily_stats (
          agent_email,
          stat_date,
          dials,
          reached,
          booked,
          instants,
          sales,
          alp,
          plus,
          presentations,
          declared_sales,
          declared_alp,
          updated_at
        )
        SELECT
          src.agent_email,
          $3::date,
          src.dials,
          0, 0, 0, 0, 0, 0, 0, 0, 0,
          NOW()
        FROM src
        LEFT JOIN agent_daily_stats ads
          ON ads.stat_date = $3::date
         AND LOWER(TRIM(ads.agent_email)) = src.agent_email
        WHERE ads.agent_email IS NULL
      `,
      values: [emails, dials, day],
      query_timeout: 120000,
    });

    upsertedRows = (updated.rowCount || 0) + (inserted.rowCount || 0);
  }

  const totals = await pool.query<{ total_dials: string }>(
    `
      SELECT COALESCE(SUM(dials), 0)::text AS total_dials
      FROM agent_daily_stats
      WHERE stat_date = $1::date
    `,
    [day],
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        day,
        timezone: "America/New_York",
        upsertedRows,
        totalDials: Number(totals.rows[0]?.total_dials || 0),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
