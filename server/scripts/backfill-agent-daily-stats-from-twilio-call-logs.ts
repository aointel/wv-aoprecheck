import { pool } from '../db.js';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function todayPt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

async function backfillDay(day: string): Promise<{ upsertedRows: number }> {
  const result = await pool.query(
    `
      WITH tw AS (
        SELECT
          LOWER(TRIM(owner_email)) AS agent_email,
          COUNT(*)::int AS dials,
          COUNT(*) FILTER (WHERE COALESCE(call_duration, 0) >= 45)::int AS reached
        FROM twilio_call_logs
        WHERE owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
          -- Use dial legs only to avoid double counting parent API legs
          AND LOWER(COALESCE(call_direction, '')) = 'outbound-dial'
          AND call_started_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND call_started_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
        GROUP BY LOWER(TRIM(owner_email))
      )
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
      SELECT
        tw.agent_email,
        $1::date AS stat_date,
        tw.dials,
        tw.reached,
        COALESCE(existing.booked, 0) AS booked,
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
        updated_at = NOW()
    `,
    [day],
  );

  return { upsertedRows: result.rowCount || 0 };
}

async function summarizeDay(day: string) {
  const totals = await pool.query<{ agents: string; dials: string; reached: string; booked: string }>(
    `
      SELECT
        COUNT(*)::text AS agents,
        COALESCE(SUM(dials), 0)::text AS dials,
        COALESCE(SUM(reached), 0)::text AS reached,
        COALESCE(SUM(booked), 0)::text AS booked
      FROM agent_daily_stats
      WHERE stat_date = $1::date
    `,
    [day],
  );

  const top = await pool.query<{ agent_email: string; dials: number; reached: number; booked: number }>(
    `
      SELECT agent_email, dials, reached, booked
      FROM agent_daily_stats
      WHERE stat_date = $1::date
      ORDER BY dials DESC
      LIMIT 15
    `,
    [day],
  );

  return { totals: totals.rows[0], top: top.rows };
}

async function main() {
  const day = getArg('day') || todayPt();
  console.log(`[daily-stats-backfill] Rebuilding dials/reached from twilio_call_logs for ${day} (PT day)`);

  const { upsertedRows } = await backfillDay(day);
  const summary = await summarizeDay(day);

  console.log(
    JSON.stringify(
      {
        day,
        source: 'twilio_call_logs.outbound-dial',
        upsertedRows,
        totals: summary.totals,
        top: summary.top,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error('[daily-stats-backfill] fatal:', (e as Error)?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

