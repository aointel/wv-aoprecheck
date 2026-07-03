import { pool } from "../db.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseIsoDate(value: string, label: string): string {
  const v = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`Invalid ${label}: "${value}" (expected YYYY-MM-DD)`);
  }
  return v;
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function normalizeLast10(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

async function rebuildDay(day: string): Promise<{
  day: string;
  updated: number;
  inserted: number;
  agents: number;
  dials: number;
  reached: number;
  booked: number;
  instants: number;
}> {
  const raw = await pool.query<{
    id: string;
    agent_email: string;
    event_type: string;
    lead_phone: string | null;
    call_sid: string | null;
    call_duration: string | null;
  }>(
    `
      SELECT
        id::text,
        LOWER(TRIM(agent_email)) AS agent_email,
        LOWER(TRIM(event_type)) AS event_type,
        lead_phone,
        call_sid,
        call_duration::text
      FROM agent_dial_metrics
      WHERE COALESCE(TRIM(agent_email), '') <> ''
        AND event_timestamp >= ((($1::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND event_timestamp < ((((($1::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'))
    `,
    [day],
  );

  const byAgent = new Map<string, {
    dials: number;
    booked: number;
    reachedKeys: Set<string>;
    instantKeys: Set<string>;
  }>();

  for (const row of raw.rows) {
    const agentEmail = String(row.agent_email || "").trim().toLowerCase();
    if (!agentEmail) continue;
    if (!byAgent.has(agentEmail)) {
      byAgent.set(agentEmail, { dials: 0, booked: 0, reachedKeys: new Set(), instantKeys: new Set() });
    }
    const current = byAgent.get(agentEmail)!;
    const eventType = String(row.event_type || "").toLowerCase();
    const phone10 = normalizeLast10(row.lead_phone);
    const key = phone10 || String(row.call_sid || "").trim() || `row:${row.id}`;
    const duration = Number(row.call_duration || 0);

    if (eventType === "dial") {
      current.dials += 1;
      if (duration >= 600) current.instantKeys.add(key);
    } else if (eventType === "reach") {
      current.reachedKeys.add(key);
    } else if (eventType === "booked") {
      current.booked += 1;
    }
  }

  const rows = Array.from(byAgent.entries()).map(([agentEmail, stats]) => ({
    agentEmail,
    dials: stats.dials,
    reached: stats.reachedKeys.size,
    booked: stats.booked,
    instants: stats.instantKeys.size,
  }));

  // Hard reset this day's core counters before repopulating from agent_dial_metrics.
  await pool.query(
    `
      UPDATE agent_daily_stats
      SET
        dials = 0,
        reached = 0,
        booked = 0,
        instants = 0,
        updated_at = NOW()
      WHERE stat_date = $1::date
    `,
    [day],
  );

  if (rows.length === 0) {
    return {
      day,
      updated: 0,
      inserted: 0,
      agents: 0,
      dials: 0,
      reached: 0,
      booked: 0,
      instants: 0,
    };
  }

  const emails = rows.map((r) => r.agentEmail);
  const dials = rows.map((r) => r.dials);
  const reached = rows.map((r) => r.reached);
  const booked = rows.map((r) => r.booked);
  const instants = rows.map((r) => r.instants);

  const updated = await pool.query(
    `
      WITH src AS (
        SELECT * FROM UNNEST($1::text[], $2::int[], $3::int[], $4::int[], $5::int[])
        AS t(agent_email, dials, reached, booked, instants)
      )
      UPDATE agent_daily_stats ads
      SET
        dials = src.dials,
        reached = src.reached,
        booked = src.booked,
        instants = src.instants,
        updated_at = NOW()
      FROM src
      WHERE ads.stat_date = $6::date
        AND LOWER(TRIM(ads.agent_email)) = src.agent_email
    `,
    [emails, dials, reached, booked, instants, day],
  );

  const inserted = await pool.query(
    `
      WITH src AS (
        SELECT * FROM UNNEST($1::text[], $2::int[], $3::int[], $4::int[], $5::int[])
        AS t(agent_email, dials, reached, booked, instants)
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
        $6::date,
        src.dials,
        src.reached,
        src.booked,
        src.instants,
        0, 0, 0, 0, 0, 0,
        NOW()
      FROM src
      LEFT JOIN agent_daily_stats ads
        ON ads.stat_date = $6::date
       AND LOWER(TRIM(ads.agent_email)) = src.agent_email
      WHERE ads.agent_email IS NULL
    `,
    [emails, dials, reached, booked, instants, day],
  );

  return {
    day,
    updated: Number(updated.rowCount || 0),
    inserted: Number(inserted.rowCount || 0),
    agents: rows.length,
    dials: rows.reduce((s, r) => s + r.dials, 0),
    reached: rows.reduce((s, r) => s + r.reached, 0),
    booked: rows.reduce((s, r) => s + r.booked, 0),
    instants: rows.reduce((s, r) => s + r.instants, 0),
  };
}

async function main() {
  const start = parseIsoDate(getArg("start") || "2026-04-30", "start");
  const end = parseIsoDate(getArg("end") || "2026-05-06", "end");
  if (start > end) {
    throw new Error(`Invalid range: start (${start}) > end (${end})`);
  }

  const days: string[] = [];
  for (let d = start; d <= end; d = addDaysIso(d, 1)) {
    days.push(d);
  }

  const results: Array<{
    day: string;
    updated: number;
    inserted: number;
    agents: number;
    dials: number;
    reached: number;
    booked: number;
    instants: number;
  }> = [];

  for (const day of days) {
    const r = await rebuildDay(day);
    results.push(r);
    console.log(
      `[rebuild-ads-from-adm] ${day} agents=${r.agents} dials=${r.dials} reached=${r.reached} booked=${r.booked} instants=${r.instants} updated=${r.updated} inserted=${r.inserted}`,
    );
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.days += 1;
      acc.updated += r.updated;
      acc.inserted += r.inserted;
      acc.agents += r.agents;
      acc.dials += r.dials;
      acc.reached += r.reached;
      acc.booked += r.booked;
      acc.instants += r.instants;
      return acc;
    },
    { days: 0, updated: 0, inserted: 0, agents: 0, dials: 0, reached: 0, booked: 0, instants: 0 },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "agent_dial_metrics",
        window: "06:00 ET day boundary",
        range: { start, end },
        totals,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("[rebuild-ads-from-adm] fatal:", (err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
