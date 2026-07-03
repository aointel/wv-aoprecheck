import twilio from "twilio";
import { pool } from "../db.js";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

type AgentStats = { dials: number; reached: number };
type OwnerTimeCandidate = { ownerEmail: string; startedAtMs: number };
type Queryable = {
  query: <T = any>(queryConfig: any, values?: any[]) => Promise<{ rows: T[]; rowCount?: number }>;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function isoPt(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function parseIsoDateOnly(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) throw new Error(`Invalid date "${v}" (expected YYYY-MM-DD)`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

function addUtcDays(d: Date, days: number): Date {
  const n = new Date(d.getTime());
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

function extractClientEmail(raw: unknown): string | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("client:")) {
    const identity = value.replace(/^client:/i, "").trim().toLowerCase();
    if (identity.includes("@")) return identity;
  }
  if (value.includes("@")) return value;
  return null;
}

function outboundDialDirection(direction: string | null | undefined): boolean {
  const d = String(direction || "").toLowerCase().trim();
  return d.startsWith("outbound");
}

function normalizeLast10(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function getTimeZoneOffsetMinutes(utcDate: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const part = fmt.formatToParts(utcDate).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(part);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2] || 0);
  const mins = Number(m[3] || 0);
  return sign * (hours * 60 + mins);
}

function pacificMidnightUtc(dayIso: string): Date {
  const d = parseIsoDateOnly(dayIso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const approx = new Date(Date.UTC(y, m, day, 12, 0, 0, 0));
  const offsetMin = getTimeZoneOffsetMinutes(approx, "America/Los_Angeles");
  const utcMs = Date.UTC(y, m, day, 0, 0, 0, 0) - offsetMin * 60_000;
  return new Date(utcMs);
}

async function fetchOwnerCandidatesByPhoneAndTimeDay(
  db: Queryable,
  ptDayIso: string,
): Promise<Map<string, OwnerTimeCandidate[]>> {
  const out = new Map<string, OwnerTimeCandidate[]>();
  const rangeStart = addUtcDays(parseIsoDateOnly(ptDayIso), -1);
  const rangeEnd = addUtcDays(parseIsoDateOnly(ptDayIso), 2);
  const WINDOW_MS = 2 * 60 * 60 * 1000;

  for (let ws = rangeStart.getTime(); ws < rangeEnd.getTime(); ws += WINDOW_MS) {
    const we = Math.min(ws + WINDOW_MS, rangeEnd.getTime());
    const res = await db.query<{
      owner_email: string;
      to_number: string;
      started_epoch_ms: string;
    }>({
      text: `
        SELECT
          LOWER(TRIM(owner_email)) AS owner_email,
          COALESCE(to_number, '') AS to_number,
          FLOOR(EXTRACT(EPOCH FROM call_started_at) * 1000)::bigint::text AS started_epoch_ms
        FROM twilio_call_logs
        WHERE owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
          AND LOWER(COALESCE(call_direction, '')) IN ('outbound-dial', 'outbound')
          AND call_started_at >= $1::timestamptz
          AND call_started_at < $2::timestamptz
      `,
      values: [new Date(ws).toISOString(), new Date(we).toISOString()],
      query_timeout: 120000,
    });

    for (const row of res.rows) {
      const to10 = normalizeLast10(row.to_number);
      const ownerEmail = String(row.owner_email || "").trim().toLowerCase();
      const startedAtMs = Number(row.started_epoch_ms || 0);
      if (!to10 || !ownerEmail || !startedAtMs) continue;
      const arr = out.get(to10) || [];
      arr.push({ ownerEmail, startedAtMs });
      out.set(to10, arr);
    }
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => a.startedAtMs - b.startedAtMs);
  }
  return out;
}

async function fetchOwnerFallbackBySid(db: Queryable, callSids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (callSids.length === 0) return out;

  const CHUNK = 500;
  for (let i = 0; i < callSids.length; i += CHUNK) {
    const chunk = callSids.slice(i, i + CHUNK);
    const res = await db.query<{ twilio_call_sid: string; owner_email: string }>({
      text: `
        SELECT twilio_call_sid, LOWER(TRIM(owner_email)) AS owner_email
        FROM twilio_call_logs
        WHERE twilio_call_sid = ANY($1::text[])
          AND owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
      `,
      values: [chunk],
      query_timeout: 120000,
    });
    for (const row of res.rows) {
      const sid = String(row.twilio_call_sid || "").trim();
      const email = String(row.owner_email || "").trim().toLowerCase();
      if (!sid || !email) continue;
      out.set(sid, email);
    }

    // Fallback: if Twilio API gives parent SIDs, recover owner from child legs.
    const childRes = await db.query<{ parent_call_sid: string; owner_email: string }>({
      text: `
        SELECT parent_call_sid, LOWER(TRIM(owner_email)) AS owner_email
        FROM twilio_call_logs
        WHERE parent_call_sid = ANY($1::text[])
          AND owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
      `,
      values: [chunk],
      query_timeout: 120000,
    });
    for (const row of childRes.rows) {
      const parentSid = String(row.parent_call_sid || "").trim();
      const email = String(row.owner_email || "").trim().toLowerCase();
      if (!parentSid || !email) continue;
      if (!out.has(parentSid)) out.set(parentSid, email);
    }
  }
  return out;
}

async function fetchTwilioCallsForDay(
  client: ReturnType<typeof twilio>,
  ptDayIso: string,
): Promise<any[]> {
  const queryStart = pacificMidnightUtc(ptDayIso);
  const queryEnd = pacificMidnightUtc(addUtcDays(parseIsoDateOnly(ptDayIso), 1).toISOString().slice(0, 10));
  const page = await client.calls.list({
    startTimeAfter: queryStart,
    startTimeBefore: queryEnd,
    pageSize: 1000,
    limit: 50000,
  } as any);
  const exactPtDay = (page as any[]).filter((c) => {
    const raw = c?.startTime || c?.dateCreated || null;
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    return isoPt(d) === ptDayIso;
  });
  return exactPtDay;
}

async function rebuildDayFromTwilioApi(
  client: ReturnType<typeof twilio>,
  db: Queryable,
  ptDayIso: string,
  dryRun: boolean,
): Promise<{ day: string; calls: number; outboundCalls: number; agents: number; dials: number; reached: number }> {
  const calls = await fetchTwilioCallsForDay(client, ptDayIso);
  const outbound = calls.filter((c) => outboundDialDirection(c?.direction));

  const missingOwnerSids: string[] = [];
  const preliminary = outbound.map((c) => {
    const callSid = String(c?.sid || "").trim();
    const fromEmail = extractClientEmail(c?.from);
    const toEmail = extractClientEmail(c?.to);
    const owner = fromEmail || toEmail;
    if (!owner && callSid) missingOwnerSids.push(callSid);
    return {
      callSid,
      owner,
      to10: normalizeLast10(c?.to),
      startedAtMs: Number(new Date(c?.startTime || c?.dateCreated || 0).getTime() || 0),
      durationSec: Number(c?.duration || 0) || 0,
    };
  });

  const ownerFallback = await fetchOwnerFallbackBySid(db, missingOwnerSids);
  const ownerByPhoneTime = await fetchOwnerCandidatesByPhoneAndTimeDay(db, ptDayIso);
  const byAgent = new Map<string, AgentStats>();
  for (const row of preliminary) {
    let email = (row.owner || ownerFallback.get(row.callSid) || "").toLowerCase().trim();
    if (!email && row.to10 && row.startedAtMs > 0) {
      const candidates = ownerByPhoneTime.get(row.to10) || [];
      let best: OwnerTimeCandidate | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const c of candidates) {
        const delta = Math.abs(c.startedAtMs - row.startedAtMs);
        if (delta < bestDelta) {
          best = c;
          bestDelta = delta;
        }
      }
      if (best && bestDelta <= 5 * 60 * 1000) {
        email = best.ownerEmail;
      }
    }
    if (!email || !email.includes("@")) continue;
    const prev = byAgent.get(email) || { dials: 0, reached: 0 };
    prev.dials += 1;
    if (row.durationSec >= 45) prev.reached += 1;
    byAgent.set(email, prev);
  }

  const statsRows = Array.from(byAgent.entries()).map(([agentEmail, stat]) => ({
    agentEmail,
    dials: stat.dials,
    reached: stat.reached,
  }));

  if (!dryRun && statsRows.length > 0) {
    for (const row of statsRows) {
      await db.query({
        text: `
          INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
          VALUES ($1, $2::date, $3, $4, 0, NOW())
          ON CONFLICT (agent_email, stat_date)
          DO UPDATE SET
            dials = EXCLUDED.dials,
            reached = EXCLUDED.reached,
            booked = agent_daily_stats.booked,
            updated_at = NOW()
        `,
        values: [row.agentEmail, ptDayIso, row.dials, row.reached],
        query_timeout: 120000,
      });
    }
  }

  const totals = statsRows.reduce(
    (acc, row) => {
      acc.dials += row.dials;
      acc.reached += row.reached;
      return acc;
    },
    { dials: 0, reached: 0 },
  );

  return {
    day: ptDayIso,
    calls: calls.length,
    outboundCalls: outbound.length,
    agents: statsRows.length,
    dials: totals.dials,
    reached: totals.reached,
  };
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }

  const dryRun = hasFlag("dry-run");
  const daysArg = Number(getArg("days") || "60");
  const days = Number.isFinite(daysArg) && daysArg > 0 ? Math.floor(daysArg) : 60;
  const endArg = getArg("end");
  const startArg = getArg("start");

  const todayPt = isoPt(new Date());
  const endIso = endArg || todayPt;
  const endDate = parseIsoDateOnly(endIso);
  const startIso = startArg || addUtcDays(endDate, -(days - 1)).toISOString().slice(0, 10);
  const startDate = parseIsoDateOnly(startIso);

  if (startDate > endDate) {
    throw new Error(`Invalid range: start (${startIso}) is after end (${endIso})`);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const summaries: Array<{
    day: string;
    calls: number;
    outboundCalls: number;
    agents: number;
    dials: number;
    reached: number;
  }> = [];

  console.log(
    `[twilio-api-backfill] range=${startIso}..${endIso} mode=${dryRun ? "dry-run" : "write"} source=twilio-api`,
  );

  const dbClient = await pool.connect();
  await dbClient.query("SET statement_timeout TO 300000");
  await dbClient.query("SET lock_timeout TO 300000");
  try {
    let cur = new Date(startDate.getTime());
    while (cur <= endDate) {
      const dayIso = cur.toISOString().slice(0, 10);
      const summary = await rebuildDayFromTwilioApi(client, dbClient, dayIso, dryRun);
      summaries.push(summary);
      console.log(
        `[twilio-api-backfill] ${dayIso} calls=${summary.calls} outbound=${summary.outboundCalls} agents=${summary.agents} dials=${summary.dials} reached=${summary.reached}`,
      );
      cur = addUtcDays(cur, 1);
    }
  } finally {
    dbClient.release();
  }

  const grand = summaries.reduce(
    (acc, s) => {
      acc.calls += s.calls;
      acc.outboundCalls += s.outboundCalls;
      acc.dials += s.dials;
      acc.reached += s.reached;
      return acc;
    },
    { calls: 0, outboundCalls: 0, dials: 0, reached: 0 },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "twilio-api",
        mode: dryRun ? "dry-run" : "write",
        range: { start: startIso, end: endIso },
        totals: grand,
        days: summaries.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("[twilio-api-backfill] fatal:", (err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

