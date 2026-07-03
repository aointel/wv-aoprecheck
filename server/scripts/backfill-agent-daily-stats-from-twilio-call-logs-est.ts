import { pool } from "../db.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function nyTodayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function upsertDay(day: string): Promise<number> {
  const result = await pool.query({
    text: `
      WITH tw AS (
        SELECT
          LOWER(TRIM(owner_email)) AS agent_email,
          COUNT(*)::int AS dials,
          COUNT(*) FILTER (WHERE COALESCE(call_duration, 0) >= 45)::int AS reached
        FROM twilio_call_logs
        WHERE owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
          AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
          AND call_started_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND call_started_at < ((($1::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        GROUP BY 1
      )
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, instants, updated_at)
      SELECT
        tw.agent_email,
        $1::date AS stat_date,
        tw.dials,
        tw.reached,
        COALESCE(existing.booked, 0) AS booked,
        COALESCE(existing.instants, 0) AS instants,
        NOW() AS updated_at
      FROM tw
      LEFT JOIN agent_daily_stats existing
        ON existing.agent_email = tw.agent_email
       AND existing.stat_date = $1::date
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        dials = EXCLUDED.dials,
        reached = EXCLUDED.reached,
        booked = agent_daily_stats.booked,
        instants = agent_daily_stats.instants,
        updated_at = NOW()
    `,
    values: [day],
    query_timeout: 180000,
  });
  return Number(result.rowCount || 0);
}

async function summarizeDay(day: string) {
  const totals = await pool.query<{
    agents: string;
    dials: string;
    reached: string;
    booked: string;
    instants: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS agents,
        COALESCE(SUM(dials), 0)::text AS dials,
        COALESCE(SUM(reached), 0)::text AS reached,
        COALESCE(SUM(booked), 0)::text AS booked,
        COALESCE(SUM(instants), 0)::text AS instants
      FROM agent_daily_stats
      WHERE stat_date = $1::date
    `,
    [day],
  );

  return totals.rows[0] || {
    agents: "0",
    dials: "0",
    reached: "0",
    booked: "0",
    instants: "0",
  };
}

async function main() {
  const day = getArg("day") || nyTodayIso();
  const upsertedRows = await upsertDay(day);
  const totals = await summarizeDay(day);

  console.log(
    JSON.stringify(
      {
        ok: true,
        day,
        source: "twilio_call_logs",
        window: `${day} 06:00:00 -> next day 06:00:00 America/New_York`,
        upsertedRows,
        totals: {
          agents: Number(totals.agents || 0),
          dials: Number(totals.dials || 0),
          reached: Number(totals.reached || 0),
          booked: Number(totals.booked || 0),
          instants: Number(totals.instants || 0),
        },
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

