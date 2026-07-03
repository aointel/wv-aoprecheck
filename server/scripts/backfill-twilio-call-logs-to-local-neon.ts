import { pool } from '../db.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import twilio from 'twilio';

type TwilioCall = {
  sid: string;
  parent_call_sid?: string | null;
  parentCallSid?: string | null;
  from?: string | null;
  to?: string | null;
  direction?: string | null;
  status?: string | null;
  duration?: string | number | null;
  start_time?: string | null;
  startTime?: string | null;
  end_time?: string | null;
  endTime?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

type UpsertRow = {
  twilio_call_sid: string;
  owner_email: string | null;
  agent_identity: string | null;
  from_number: string | null;
  to_number: string | null;
  call_direction: string | null;
  call_status: string | null;
  call_duration: number;
  call_started_at: string | null;
  call_ended_at: string | null;
  parent_call_sid: string | null;
  call_source: string;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function toPtDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function parseDuration(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function endpointToOwner(value: unknown): string | null {
  const s = String(value || '').trim().toLowerCase();
  if (!s.startsWith('client:')) return null;
  const identity = s.slice('client:'.length).trim();
  return identity.includes('@') ? identity : null;
}

function extractDirectOwner(call: TwilioCall): string | null {
  return endpointToOwner(call.to) || endpointToOwner(call.from);
}

async function fetchAllCalls(startDatePt: string, endDatePt?: string): Promise<TwilioCall[]> {
  const endDayPt = endDatePt || startDatePt;
  const bounds = await pool.query<{ start_utc: string; end_utc: string }>(
    `
      SELECT
        (($1::date)::timestamp AT TIME ZONE 'America/Los_Angeles')::text AS start_utc,
        ((($2::date + 1)::timestamp) AT TIME ZONE 'America/Los_Angeles')::text AS end_utc
    `,
    [startDatePt, endDayPt],
  );

  const startUtc = new Date(bounds.rows[0].start_utc);
  const endUtc = new Date(bounds.rows[0].end_utc);
  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    throw new Error(`Invalid PT bounds: start=${startDatePt} end=${endDayPt}`);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const out = (await client.calls.list({
    startTimeAfter: startUtc,
    startTimeBefore: endUtc,
    pageSize: 1000,
    limit: 300000,
  } as any)) as unknown as TwilioCall[];

  console.log(
    `[twilio-backfill] fetched ${out.length} calls for bounded window ${startDatePt}..${endDayPt} (PT)`,
  );
  return out;
}

function buildOwnerMap(calls: TwilioCall[]): Map<string, string> {
  const ownerBySid = new Map<string, string>();

  for (const c of calls) {
    const owner = extractDirectOwner(c);
    if (owner && c.sid) ownerBySid.set(c.sid, owner);
  }

  // Propagate owner across parent/child relations in both directions until stable.
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of calls) {
      const sid = c.sid;
      const parent = c.parentCallSid || c.parent_call_sid || '';
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

async function bulkUpsertCalls(rows: UpsertRow[]): Promise<number> {
  if (!rows.length) return 0;
  await pool.query(
    `
      INSERT INTO twilio_call_logs (
        twilio_call_sid,
        owner_email,
        agent_identity,
        from_number,
        to_number,
        call_direction,
        call_status,
        call_duration,
        call_started_at,
        call_ended_at,
        parent_call_sid,
        call_source,
        created_at,
        updated_at
      )
      SELECT
        x.twilio_call_sid,
        x.owner_email,
        x.agent_identity,
        x.from_number,
        x.to_number,
        x.call_direction,
        x.call_status,
        x.call_duration,
        x.call_started_at,
        x.call_ended_at,
        x.parent_call_sid,
        x.call_source,
        NOW(),
        NOW()
      FROM json_to_recordset($1::json) AS x(
        twilio_call_sid text,
        owner_email text,
        agent_identity text,
        from_number text,
        to_number text,
        call_direction text,
        call_status text,
        call_duration integer,
        call_started_at timestamptz,
        call_ended_at timestamptz,
        parent_call_sid text,
        call_source text
      )
      ON CONFLICT (twilio_call_sid) DO UPDATE SET
        owner_email = COALESCE(EXCLUDED.owner_email, twilio_call_logs.owner_email),
        agent_identity = COALESCE(EXCLUDED.agent_identity, twilio_call_logs.agent_identity),
        from_number = COALESCE(EXCLUDED.from_number, twilio_call_logs.from_number),
        to_number = COALESCE(EXCLUDED.to_number, twilio_call_logs.to_number),
        call_direction = COALESCE(EXCLUDED.call_direction, twilio_call_logs.call_direction),
        call_status = EXCLUDED.call_status,
        call_duration = GREATEST(COALESCE(twilio_call_logs.call_duration, 0), COALESCE(EXCLUDED.call_duration, 0)),
        call_started_at = COALESCE(EXCLUDED.call_started_at, twilio_call_logs.call_started_at),
        call_ended_at = COALESCE(twilio_call_logs.call_ended_at, EXCLUDED.call_ended_at),
        parent_call_sid = COALESCE(EXCLUDED.parent_call_sid, twilio_call_logs.parent_call_sid),
        call_source = EXCLUDED.call_source,
        updated_at = NOW()
    `,
    [JSON.stringify(rows)],
  );
  return rows.length;
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Missing Twilio credentials in hardcoded-config/env');
  }

  const daysBack = Number(getArg('days') || 1);
  const startDatePt = getArg('start') || toPtDate(daysBack);
  const endDatePt = getArg('end');
  const batchSize = Math.max(25, Math.min(500, Number(getArg('batch') || 100)));

  console.log(`[twilio-backfill] startDate(PT)=${startDatePt}${endDatePt ? ` endDate(PT)=${endDatePt}` : ''} batchSize=${batchSize}`);
  const calls = await fetchAllCalls(startDatePt, endDatePt);
  console.log(`[twilio-backfill] total fetched=${calls.length}`);

  const ownerBySid = buildOwnerMap(calls);
  console.log(`[twilio-backfill] owner map size=${ownerBySid.size}`);

  const rows: UpsertRow[] = calls
    .filter((c) => String(c.sid || '').trim().length > 0)
    .map((c) => ({
      twilio_call_sid: c.sid,
      owner_email: ownerBySid.get(c.sid) || null,
      agent_identity: endpointToOwner(c.to) ? c.to || null : endpointToOwner(c.from) ? c.from || null : null,
      from_number: c.from || null,
      to_number: c.to || null,
      call_direction: c.direction || null,
      call_status: c.status || null,
      call_duration: parseDuration(c.duration),
      call_started_at: c.startTime
        ? new Date(c.startTime).toISOString()
        : c.start_time
          ? new Date(c.start_time).toISOString()
          : c.dateCreated
            ? new Date(c.dateCreated).toISOString()
            : c.date_created
              ? new Date(c.date_created).toISOString()
              : null,
      call_ended_at: c.endTime
        ? new Date(c.endTime).toISOString()
        : c.end_time
          ? new Date(c.end_time).toISOString()
          : c.dateUpdated
            ? new Date(c.dateUpdated).toISOString()
            : c.date_updated
              ? new Date(c.date_updated).toISOString()
              : null,
      parent_call_sid: c.parentCallSid || c.parent_call_sid || null,
      call_source: 'twilio-api-backfill-local-neon',
    }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    upserted += await bulkUpsertCalls(batch);
    console.log(`[twilio-backfill] upsert progress ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }

  const summary = await pool.query<{ calls: string; agents: string }>(
    `
      SELECT
        COUNT(*)::text AS calls,
        COUNT(DISTINCT owner_email)::text AS agents
      FROM twilio_call_logs
      WHERE call_started_at >= $1::date
        AND ($2::text IS NULL OR call_started_at < (($2::date + 1)::timestamp))
    `,
    [startDatePt, endDatePt || null],
  );

  console.log(
    `[twilio-backfill] done upserted=${upserted} errors=0 local_calls_since_start=${summary.rows[0]?.calls || '0'} local_agents_since_start=${summary.rows[0]?.agents || '0'}`,
  );
}

main()
  .catch((e) => {
    console.error('[twilio-backfill] fatal:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

