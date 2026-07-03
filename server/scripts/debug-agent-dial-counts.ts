import twilio from "twilio";
import { pool } from "../db.js";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseNyDate(dayIso?: string): { isoDate: string; year: number; month: number; day: number } {
  if (!dayIso) {
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [year, month, day] = isoDate.split("-").map(Number);
    return { isoDate, year, month, day };
  }
  const [year, month, day] = dayIso.split("-").map(Number);
  return { isoDate: dayIso, year, month, day };
}

function nyLocalToUtcMs(year: number, month: number, day: number, hour: number, minute = 0, second = 0): number {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(targetLocalAsUtc);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(guess)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = representedAsUtc - guess.getTime();
  return targetLocalAsUtc - offsetMs;
}

function normalizePhoneLast10(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function isLikelyPstn(value: unknown): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s.toLowerCase().startsWith("client:")) return false;
  return /\d/.test(s);
}

async function fetchTwilioCallsForWindow(dayIso: string): Promise<any[]> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error("Twilio credentials missing");
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { year, month, day } = parseNyDate(dayIso);
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const nextDayDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
  const nextIsoDate = nextDayDate.toISOString().slice(0, 10);
  const nextParts = parseNyDate(nextIsoDate);
  const untilUtcMs = nyLocalToUtcMs(nextParts.year, nextParts.month, nextParts.day, 6, 0, 0);

  let startTimeBefore: string | undefined;
  const calls: any[] = [];
  while (true) {
    const page = await client.calls.list({
      startTimeAfter: dayIso,
      startTimeBefore,
      limit: 1000,
    } as any);
    if (!page.length) break;
    calls.push(...page);
    if (page.length < 1000) break;
    const last = page[page.length - 1] as any;
    const t = last.startTime || last.dateCreated;
    if (!t) break;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }

  return calls.filter((c: any) => {
    const t = c.startTime || c.dateCreated;
    if (!t) return false;
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms)) return false;
    return ms >= sinceUtcMs && ms < untilUtcMs;
  });
}

async function main() {
  const agent = String(getArg("agent") || "").trim().toLowerCase();
  const day = String(getArg("day") || "").trim() || parseNyDate().isoDate;
  if (!agent.includes("@")) throw new Error("Pass --agent=<email>");

  const twilioCalls = await fetchTwilioCallsForWindow(day);
  const agentLegs = twilioCalls.filter((c: any) => {
    const from = String(c.from || "").toLowerCase();
    const to = String(c.to || "").toLowerCase();
    return from.includes(agent) || to.includes(agent);
  });
  const outboundLike = agentLegs.filter((c: any) => String(c.direction || "").toLowerCase().startsWith("outbound"));
  const byDirection = agentLegs.reduce((acc: Record<string, number>, c: any) => {
    const key = String(c.direction || "unknown").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sidSet = new Set(agentLegs.map((c: any) => String(c.sid || "").trim()).filter(Boolean));
  const familySet = new Set(
    agentLegs.map((c: any) => String(c.parentCallSid || c.sid || "").trim()).filter(Boolean),
  );
  const uniqueToPstn = new Set(
    agentLegs.map((c: any) => normalizePhoneLast10(c.to)).filter((p) => p.length === 10),
  );
  const childLegsFromAgentParents = twilioCalls.filter((c: any) => {
    const parent = String(c.parentCallSid || "").trim();
    if (!parent || !sidSet.has(parent)) return false;
    return true;
  });
  const childLegsToPstn = childLegsFromAgentParents.filter((c: any) => isLikelyPstn(c.to));
  const childLegDistinctSids = new Set(childLegsToPstn.map((c: any) => String(c.sid || "").trim()).filter(Boolean));
  const childLegDistinctTo = new Set(
    childLegsToPstn.map((c: any) => normalizePhoneLast10(c.to)).filter((p) => p.length === 10),
  );

  const dbRaw = await pool.query<{
    rows_total: string;
    distinct_sids: string;
    distinct_phones: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS rows_total,
        COUNT(DISTINCT twilio_call_sid)::text AS distinct_sids,
        COUNT(DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '[^0-9]', '', 'g'), 10))::text AS distinct_phones
      FROM twilio_call_logs
      WHERE call_started_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND call_started_at < ((($1::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND LOWER(COALESCE(owner_email, '')) = $2
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
    `,
    [day, agent],
  );

  console.log(
    JSON.stringify(
      {
        day,
        window: `${day} 06:00:00 -> next day 06:00:00 America/New_York`,
        agent,
        twilio_api: {
          agent_leg_records: agentLegs.length,
          outbound_like_direction: outboundLike.length,
          by_direction: byDirection,
          distinct_call_sids: sidSet.size,
          distinct_call_families_parent_or_sid: familySet.size,
          distinct_to_phone_last10: uniqueToPstn.size,
          child_legs_where_parent_is_agent_leg: childLegsFromAgentParents.length,
          child_legs_to_pstn: childLegsToPstn.length,
          child_legs_to_pstn_distinct_sids: childLegDistinctSids.size,
          child_legs_to_pstn_distinct_to_phone_last10: childLegDistinctTo.size,
          sample: agentLegs.slice(0, 8).map((c: any) => ({
            sid: c.sid,
            direction: c.direction,
            from: c.from,
            to: c.to,
            parentCallSid: c.parentCallSid || null,
            status: c.status,
            startTime: c.startTime ? new Date(c.startTime).toISOString() : null,
          })),
        },
        twilio_call_logs_owner_email: {
          rows_total: Number(dbRaw.rows[0]?.rows_total || 0),
          distinct_sids: Number(dbRaw.rows[0]?.distinct_sids || 0),
          distinct_to_phone_last10: Number(dbRaw.rows[0]?.distinct_phones || 0),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error((error as Error)?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

