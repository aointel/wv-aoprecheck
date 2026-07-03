import twilio from "twilio";
import { pool } from "../db.js";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";

type MetricInsertRow = {
  agent_email: string;
  lead_phone: string;
  event_type: "dial" | "reach";
  event_timestamp: string;
  call_duration: number | null;
  call_status: string | null;
  disposition: string | null;
  call_sid: string;
  source: string;
  lead_name: string | null;
  lead_state: string | null;
  lead_id: number | null;
};

function nyTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function normalizePhoneLast10(v: unknown): string {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

function extractAgentEmail(endpoint: unknown): string | null {
  const s = String(endpoint || "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("client:")) {
    const identity = s.slice("client:".length).trim().toLowerCase();
    return identity.includes("@") ? identity : null;
  }
  return s.includes("@") ? s : null;
}

function isOutbound(direction: unknown): boolean {
  return String(direction || "").toLowerCase().startsWith("outbound");
}

function isReach(status: unknown, duration: number): boolean {
  const st = String(status || "").toLowerCase();
  return duration >= 45 && (st === "completed" || st === "answered" || st === "in-progress");
}

function buildOwnerMap(allCalls: any[]): Map<string, string> {
  const ownerBySid = new Map<string, string>();
  for (const call of allCalls) {
    const sid = String(call?.sid || "").trim();
    if (!sid) continue;
    const owner = extractAgentEmail(call?.from) || extractAgentEmail(call?.to);
    if (owner) ownerBySid.set(sid, owner);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const call of allCalls) {
      const sid = String(call?.sid || "").trim();
      const parent = String(call?.parentCallSid || "").trim();
      if (!sid || !parent) continue;
      const sidOwner = ownerBySid.get(sid);
      const parentOwner = ownerBySid.get(parent);
      if (!sidOwner && parentOwner) {
        ownerBySid.set(sid, parentOwner);
        changed = true;
      } else if (sidOwner && !parentOwner) {
        ownerBySid.set(parent, sidOwner);
        changed = true;
      }
    }
  }
  return ownerBySid;
}

async function fetchTwilioCallsForWindow(startIsoUtc: string, endIsoUtc: string): Promise<any[]> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials missing");
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const all = await client.calls.list({
    startTimeAfter: new Date(startIsoUtc),
    startTimeBefore: new Date(endIsoUtc),
    pageSize: 1000,
    limit: 200000,
  } as any);
  return all as any[];
}

export async function resetAgentDialMetricsFromTwilioApi(dayInput?: string) {
  const day = String(dayInput || nyTodayIso());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid --day value "${day}" (expected YYYY-MM-DD)`);
  }

  const windowStart = `${day} 06:00:00 America/New_York`;
  console.log(`[reset-agent-dial-metrics] day=${day} windowStart=${windowStart}`);

  const windowResult = await pool.query<{
    start_utc: string;
    end_utc: string;
  }>(
    `
      SELECT
        ((($1::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')::text AS start_utc,
        ((((($1::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'))::text AS end_utc
    `,
    [day],
  );
  const startIsoUtc = new Date(windowResult.rows[0].start_utc).toISOString();
  const endIsoUtc = new Date(windowResult.rows[0].end_utc).toISOString();

  const twilioCalls = await fetchTwilioCallsForWindow(startIsoUtc, endIsoUtc);
  const outbound = twilioCalls.filter((c) => isOutbound(c?.direction));
  const ownerBySid = buildOwnerMap(twilioCalls);

  const rows: MetricInsertRow[] = [];
  let skippedNoAgent = 0;
  for (const call of outbound) {
    const sid = String(call?.sid || "").trim();
    if (!sid) continue;
    const startedAtRaw = call?.startTime || call?.dateCreated || null;
    if (!startedAtRaw) continue;
    const startedAt = new Date(startedAtRaw);
    if (Number.isNaN(startedAt.getTime())) continue;

    const parentSid = String(call?.parentCallSid || "").trim();
    const fromAgent = extractAgentEmail(call?.from);
    const toAgent = extractAgentEmail(call?.to);
    const mappedOwner = ownerBySid.get(sid) || (parentSid ? ownerBySid.get(parentSid) : null);
    const agentEmail = String(fromAgent || toAgent || mappedOwner || "").toLowerCase().trim();
    if (!agentEmail || !agentEmail.includes("@")) {
      skippedNoAgent += 1;
      continue;
    }

    const leadPhone = normalizePhoneLast10(call?.to) || normalizePhoneLast10(call?.from);
    const status = String(call?.status || "").toLowerCase() || null;
    const durationNum = Number(call?.duration || 0);
    const duration = Number.isFinite(durationNum) ? durationNum : 0;
    const tsIso = startedAt.toISOString();

    rows.push({
      agent_email: agentEmail,
      lead_phone: leadPhone,
      event_type: "dial",
      event_timestamp: tsIso,
      call_duration: duration > 0 ? duration : 0,
      call_status: status,
      disposition: null,
      call_sid: sid,
      source: "twilio_api_reset_6am_et",
      lead_name: null,
      lead_state: null,
      lead_id: null,
    });

    if (isReach(status, duration)) {
      rows.push({
        agent_email: agentEmail,
        lead_phone: leadPhone,
        event_type: "reach",
        event_timestamp: tsIso,
        call_duration: duration,
        call_status: status,
        disposition: "connected",
        call_sid: sid,
        source: "twilio_api_reset_6am_et",
        lead_name: null,
        lead_state: null,
        lead_id: null,
      });
    }
  }

  const deleted = await pool.query<{ id: string }>(
    `
      DELETE FROM agent_dial_metrics
      WHERE event_type IN ('dial', 'reach')
        AND event_timestamp >= ((($1::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND event_timestamp < ((((($1::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'))
      RETURNING id::text
    `,
    [day],
  );

  let inserted = 0;
  const CHUNK = 2000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const ins = await pool.query(
      `
        INSERT INTO agent_dial_metrics (
          agent_email,
          lead_phone,
          event_type,
          event_timestamp,
          call_duration,
          call_status,
          disposition,
          call_sid,
          source,
          lead_name,
          lead_state,
          lead_id
        )
        SELECT
          x.agent_email,
          x.lead_phone,
          x.event_type,
          x.event_timestamp,
          x.call_duration,
          x.call_status,
          x.disposition,
          x.call_sid,
          x.source,
          x.lead_name,
          x.lead_state,
          x.lead_id
        FROM json_to_recordset($1::json) AS x(
          agent_email text,
          lead_phone text,
          event_type text,
          event_timestamp timestamptz,
          call_duration integer,
          call_status text,
          disposition text,
          call_sid text,
          source text,
          lead_name text,
          lead_state text,
          lead_id bigint
        )
      `,
      [JSON.stringify(chunk)],
    );
    inserted += Number(ins.rowCount || 0);
  }

  const verify = await pool.query<{
    dials: string;
    reaches: string;
    unique_dial_sids: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'dial')::text AS dials,
        COUNT(*) FILTER (WHERE event_type = 'reach')::text AS reaches,
        COUNT(DISTINCT call_sid) FILTER (WHERE event_type = 'dial')::text AS unique_dial_sids
      FROM agent_dial_metrics
      WHERE event_timestamp >= ((($1::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND event_timestamp < ((((($1::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'))
    `,
    [day],
  );

  const summary = {
    ok: true,
    day,
    windowUtc: { start: startIsoUtc, end: endIsoUtc },
    twilioFetched: twilioCalls.length,
    twilioOutbound: outbound.length,
    skippedNoAgent,
    deletedDialReachRows: deleted.rowCount || 0,
    insertedRows: inserted,
    verification: verify.rows[0],
  };

  return summary;
}

async function main() {
  const day = String(getArg("day") || nyTodayIso());
  const result = await resetAgentDialMetricsFromTwilioApi(day);
  console.log(JSON.stringify(result, null, 2));
}

const isRunAsScript = process.argv[1]?.includes("reset-agent-dial-metrics-today-from-twilio-api");
if (isRunAsScript) {
  main()
    .catch((err) => {
      console.error("[reset-agent-dial-metrics] fatal:", (err as Error)?.message || String(err));
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => {});
    });
}
