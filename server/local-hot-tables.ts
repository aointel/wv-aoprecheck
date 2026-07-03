import { pool } from "./db";

type JsonLike = Record<string, unknown> | unknown[] | null;

const DB_WRITE_COOLDOWN_MS = 15000;
let twilioCallLogWritesPausedUntil = 0;
let twilioCallLogPauseLoggedAt = 0;
let dialMetricWritesPausedUntil = 0;
let dialMetricPauseLoggedAt = 0;
let masterleadLastContactPausedUntil = 0;
let masterleadLastContactPauseLoggedAt = 0;

const TWILIO_CALL_LOG_COLUMNS = new Set([
  "twilio_call_sid",
  "owner_email",
  "agent_identity",
  "from_number",
  "to_number",
  "call_direction",
  "call_status",
  "call_duration",
  "call_started_at",
  "call_ended_at",
  "parent_call_sid",
  "call_source",
  "answered_by",
  "amd_duration_ms",
  "metadata",
  "recording_url",
  "associate_id",
  "lead_id",
  "taalk_lead_id",
  "created_at",
  "updated_at",
]);

const AGENT_DIAL_METRIC_COLUMNS = new Set([
  "agent_email",
  "agent_name",
  "lead_id",
  "lead_phone",
  "lead_name",
  "lead_state",
  "event_type",
  "event_timestamp",
  "call_duration",
  "call_status",
  "disposition",
  "call_sid",
  "source",
  "notes",
  "isHotLead",
]);

function last10Digits(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

const JSON_COLUMNS = new Set(["metadata"]);
let masterleadTableEnsured = false;

async function ensureMasterleadLocalTable(): Promise<void> {
  if (masterleadTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS masterlead (
      id BIGINT PRIMARY KEY,
      taalk_lead_id TEXT,
      phone TEXT,
      first_name TEXT,
      last_name TEXT,
      state TEXT,
      associate_id TEXT,
      cn_email TEXT,
      previous_cn_email TEXT,
      market TEXT,
      taalk_groupname TEXT,
      cnresolution TEXT,
      last_contacted TIMESTAMPTZ,
      webhook_sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  masterleadTableEnsured = true;
}

function normalizeForDb(column: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (JSON_COLUMNS.has(column)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

function placeholders(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `$${start + i}`);
}

function columnValueExpr(column: string, placeholder: string): string {
  if (JSON_COLUMNS.has(column)) return `${placeholder}::jsonb`;
  return placeholder;
}

function isDbConnectivityError(error: unknown): boolean {
  const code = String((error as any)?.code || "").toUpperCase();
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("could not connect") ||
    code === "57P01" ||
    code === "57P03" ||
    code === "53300"
  );
}

function shouldSkipTwilioCallLogWrite(): boolean {
  return Date.now() < twilioCallLogWritesPausedUntil;
}

function pauseTwilioCallLogWrites(error: unknown): void {
  twilioCallLogWritesPausedUntil = Date.now() + DB_WRITE_COOLDOWN_MS;
  const now = Date.now();
  if (now - twilioCallLogPauseLoggedAt > DB_WRITE_COOLDOWN_MS) {
    twilioCallLogPauseLoggedAt = now;
    console.warn(
      `⚠️ Pausing twilio_call_logs writes for ${Math.round(DB_WRITE_COOLDOWN_MS / 1000)}s after DB connectivity error:`,
      (error as any)?.message || String(error),
    );
  }
}

function shouldSkipDialMetricWrite(): boolean {
  return Date.now() < dialMetricWritesPausedUntil;
}

function pauseDialMetricWrites(error: unknown): void {
  dialMetricWritesPausedUntil = Date.now() + DB_WRITE_COOLDOWN_MS;
  const now = Date.now();
  if (now - dialMetricPauseLoggedAt > DB_WRITE_COOLDOWN_MS) {
    dialMetricPauseLoggedAt = now;
    console.warn(
      `⚠️ Pausing agent_dial_metrics writes for ${Math.round(DB_WRITE_COOLDOWN_MS / 1000)}s after DB connectivity error:`,
      (error as any)?.message || String(error),
    );
  }
}

function shouldSkipMasterleadLastContactWrite(): boolean {
  return Date.now() < masterleadLastContactPausedUntil;
}

function pauseMasterleadLastContactWrites(error: unknown): void {
  masterleadLastContactPausedUntil = Date.now() + DB_WRITE_COOLDOWN_MS;
  const now = Date.now();
  if (now - masterleadLastContactPauseLoggedAt > DB_WRITE_COOLDOWN_MS) {
    masterleadLastContactPauseLoggedAt = now;
    console.warn(
      `⚠️ Pausing masterlead last_contacted updates for ${Math.round(DB_WRITE_COOLDOWN_MS / 1000)}s after DB connectivity error:`,
      (error as any)?.message || String(error),
    );
  }
}

// --- Batch buffer: coalesces concurrent upserts by twilio_call_sid, flushes every 5s ---
const pendingTwilioCallLogLocalUpserts = new Map<string, Record<string, unknown>>();
let twilioCallLogFlushTimer: ReturnType<typeof setInterval> | null = null;

async function flushTwilioCallLogLocalBuffer(): Promise<void> {
  if (pendingTwilioCallLogLocalUpserts.size === 0) return;
  const payloads = [...pendingTwilioCallLogLocalUpserts.values()];
  pendingTwilioCallLogLocalUpserts.clear();
  for (const payload of payloads) {
    try {
      await upsertTwilioCallLogLocalDirect(payload);
    } catch (e) {
      // best effort — don't let one failure block the rest
    }
  }
}

function ensureTwilioCallLogFlushTimer() {
  if (!twilioCallLogFlushTimer) {
    twilioCallLogFlushTimer = setInterval(flushTwilioCallLogLocalBuffer, 5000);
  }
}

export async function upsertTwilioCallLogLocal(
  payload: Record<string, unknown>,
): Promise<void> {
  if (shouldSkipTwilioCallLogWrite()) return;
  const sid = String(payload.twilio_call_sid || '').trim();
  if (sid) {
    // Merge into buffer — newer fields overwrite older ones for the same SID
    const existing = pendingTwilioCallLogLocalUpserts.get(sid) || {};
    pendingTwilioCallLogLocalUpserts.set(sid, { ...existing, ...payload });
    ensureTwilioCallLogFlushTimer();
    return;
  }
  // No SID — fall through to direct write
  await upsertTwilioCallLogLocalDirect(payload);
}

async function upsertTwilioCallLogLocalDirect(
  payload: Record<string, unknown>,
): Promise<void> {
  if (shouldSkipTwilioCallLogWrite()) return;

  const entries = Object.entries(payload).filter(
    ([column, value]) =>
      TWILIO_CALL_LOG_COLUMNS.has(column) && value !== undefined,
  );
  if (!entries.length) return;

  const columns = entries.map(([column]) => column);
  const values = entries.map(([column, value]) => normalizeForDb(column, value));
  const valueExprs = placeholders(1, values.length).map((ph, idx) =>
    columnValueExpr(columns[idx], ph),
  );

  const updates = columns
    .filter((column) => column !== "twilio_call_sid")
    .map((column) => `"${column}" = EXCLUDED."${column}"`);

  const sql = `
    INSERT INTO twilio_call_logs (${columns.map((c) => `"${c}"`).join(", ")})
    VALUES (${valueExprs.join(", ")})
    ON CONFLICT ("twilio_call_sid")
    DO UPDATE SET ${updates.length ? updates.join(", ") : `"twilio_call_sid" = EXCLUDED."twilio_call_sid"`}
  `;

  try {
    await pool.query(sql, values);
  } catch (error) {
    if (isDbConnectivityError(error)) {
      pauseTwilioCallLogWrites(error);
      return;
    }
    throw error;
  }
}

export async function updateTwilioCallLogBySidLocal(
  twilioCallSid: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const entries = Object.entries(patch).filter(
    ([column, value]) =>
      column !== "twilio_call_sid" &&
      TWILIO_CALL_LOG_COLUMNS.has(column) &&
      value !== undefined,
  );
  if (!entries.length) return false;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  entries.forEach(([column, rawValue], idx) => {
    const value = normalizeForDb(column, rawValue);
    values.push(value);
    const ph = `$${idx + 1}`;
    setClauses.push(`"${column}" = ${columnValueExpr(column, ph)}`);
  });
  values.push(twilioCallSid);

  const sql = `
    UPDATE twilio_call_logs
    SET ${setClauses.join(", ")}
    WHERE twilio_call_sid = $${values.length}
  `;

  const result = await pool.query(sql, values);
  return (result.rowCount || 0) > 0;
}

export async function getTwilioCallBySidLocal(
  twilioCallSid: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `
      SELECT call_direction, to_number, metadata, call_source, owner_email
      FROM twilio_call_logs
      WHERE twilio_call_sid = $1
      LIMIT 1
    `,
    [twilioCallSid],
  );
  return result.rows[0] || null;
}

export async function getLatestChildToNumberLocal(
  parentCallSid: string,
): Promise<string | null> {
  const result = await pool.query(
    `
      SELECT to_number
      FROM twilio_call_logs
      WHERE parent_call_sid = $1
        AND to_number IS NOT NULL
        AND to_number <> ''
      ORDER BY call_started_at DESC
      LIMIT 1
    `,
    [parentCallSid],
  );
  return (result.rows[0]?.to_number as string | undefined) || null;
}

export async function getChildOwnersForParentLocal(
  parentCallSid: string,
  limit = 5,
): Promise<string[]> {
  const result = await pool.query(
    `
      SELECT owner_email
      FROM twilio_call_logs
      WHERE parent_call_sid = $1
      ORDER BY call_started_at DESC
      LIMIT $2
    `,
    [parentCallSid, limit],
  );
  return result.rows
    .map((row) => String(row.owner_email || "").trim())
    .filter(Boolean);
}

export async function getLatestInbound609CallSidByOwnerLocal(
  ownerEmail: string,
): Promise<string | null> {
  const result = await pool.query(
    `
      SELECT twilio_call_sid
      FROM twilio_call_logs
      WHERE call_source = 'incomingcall_609'
        AND owner_email = $1
      ORDER BY call_started_at DESC
      LIMIT 1
    `,
    [ownerEmail],
  );
  return (result.rows[0]?.twilio_call_sid as string | undefined) || null;
}

export async function getTwilioCallMetadataLocal(
  twilioCallSid: string,
): Promise<JsonLike> {
  const result = await pool.query(
    `
      SELECT metadata
      FROM twilio_call_logs
      WHERE twilio_call_sid = $1
      LIMIT 1
    `,
    [twilioCallSid],
  );
  return (result.rows[0]?.metadata as JsonLike | undefined) ?? null;
}

export async function getLatestPstnCallByOwnerLocal(
  ownerEmail: string,
  sinceIso?: string,
): Promise<{
  twilio_call_sid: string;
  to_number: string | null;
  from_number: string | null;
  call_started_at: string | null;
  call_duration: number | null;
  metadata: JsonLike;
} | null> {
  const normalized = String(ownerEmail || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  const result = await pool.query(
    `
      SELECT twilio_call_sid, to_number, from_number, call_started_at, call_duration, metadata
      FROM twilio_call_logs
      WHERE owner_email = $1
        AND (
          (to_number IS NOT NULL AND to_number <> '' AND to_number NOT ILIKE 'client:%')
          OR (from_number IS NOT NULL AND from_number <> '' AND from_number NOT ILIKE 'client:%')
        )
        AND ($2::timestamptz IS NULL OR call_started_at >= $2::timestamptz)
      ORDER BY call_started_at DESC
      LIMIT 1
    `,
    [normalized, sinceIso || null],
  );

  return (result.rows[0] as any) || null;
}

export async function getLatestCallContextForLeadLocal(params: {
  phone10?: string | null;
  ownerEmail?: string | null;
  leadId?: number | string | null;
  taalkLeadId?: string | null;
}): Promise<{
  twilio_call_sid: string;
  call_duration: number;
  owner_email: string | null;
  call_direction: string | null;
  call_started_at: string | null;
} | null> {
  const phone10 = String(params.phone10 || "").replace(/\D/g, "").slice(-10);
  const ownerEmail = String(params.ownerEmail || "").trim().toLowerCase();
  const leadId = params.leadId != null ? String(params.leadId).trim() : "";
  const taalkLeadId = String(params.taalkLeadId || "").trim();

  if (!phone10 && !leadId && !taalkLeadId) return null;

  const result = await pool.query(
    `
      SELECT
        twilio_call_sid,
        call_duration,
        owner_email,
        call_direction,
        call_started_at
      FROM twilio_call_logs
      WHERE COALESCE(call_duration, 0) > 0
        AND (
          ($1 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '[^0-9]', '', 'g'), 10) = $1)
          OR ($1 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(from_number, ''), '[^0-9]', '', 'g'), 10) = $1)
          OR ($1 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(metadata->>'lead_phone', ''), '[^0-9]', '', 'g'), 10) = $1)
          OR ($2 <> '' AND COALESCE(metadata->>'lead_id', '') = $2)
          OR ($2 <> '' AND COALESCE(metadata->>'leadId', '') = $2)
          OR ($3 <> '' AND COALESCE(metadata->>'taalk_lead_id', '') = $3)
          OR ($3 <> '' AND COALESCE(metadata->>'taalkLeadId', '') = $3)
        )
      ORDER BY
        CASE WHEN $4 <> '' AND LOWER(COALESCE(owner_email, '')) = $4 THEN 0 ELSE 1 END,
        CASE WHEN $2 <> '' AND (COALESCE(metadata->>'lead_id', '') = $2 OR COALESCE(metadata->>'leadId', '') = $2) THEN 0 ELSE 1 END,
        CASE WHEN $3 <> '' AND (COALESCE(metadata->>'taalk_lead_id', '') = $3 OR COALESCE(metadata->>'taalkLeadId', '') = $3) THEN 0 ELSE 1 END,
        call_started_at DESC
      LIMIT 1
    `,
    [phone10, leadId, taalkLeadId, ownerEmail],
  );

  return (result.rows[0] as any) || null;
}

export async function findLatestCallSidByToNumberLocal(
  toNumber: string,
): Promise<string | null> {
  const result = await pool.query(
    `
      SELECT twilio_call_sid
      FROM twilio_call_logs
      WHERE to_number = $1
      ORDER BY call_started_at DESC
      LIMIT 1
    `,
    [toNumber],
  );
  return (result.rows[0]?.twilio_call_sid as string | undefined) || null;
}

export async function findUnansweredChildrenByParentLocal(
  parentCallSid: string,
): Promise<string[]> {
  const result = await pool.query(
    `
      SELECT twilio_call_sid
      FROM twilio_call_logs
      WHERE parent_call_sid = $1
        AND answered_by IS NULL
    `,
    [parentCallSid],
  );
  return result.rows
    .map((row) => String(row.twilio_call_sid || "").trim())
    .filter(Boolean);
}

export async function existsRecentDialMetricLocal(params: {
  agentEmail: string;
  eventType: string;
  leadPhone: string;
  sinceIso: string;
}): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT id
      FROM agent_dial_metrics
      WHERE agent_email = $1
        AND event_type = $2
        AND lead_phone = $3
        AND event_timestamp >= $4::timestamptz
      LIMIT 1
    `,
    [params.agentEmail, params.eventType, params.leadPhone, params.sinceIso],
  );
  return (result.rowCount || 0) > 0;
}

export async function insertAgentDialMetricLocal(
  payload: Record<string, unknown>,
): Promise<number | null> {
  if (shouldSkipDialMetricWrite()) return null;

  const entries = Object.entries(payload).filter(
    ([column, value]) =>
      AGENT_DIAL_METRIC_COLUMNS.has(column) && value !== undefined,
  );
  if (!entries.length) return null;

  const columns = entries.map(([column]) => column);
  const values = entries.map(([column, value]) => normalizeForDb(column, value));
  const valueExprs = placeholders(1, values.length).map((ph, idx) =>
    columnValueExpr(columns[idx], ph),
  );

  const sql = `
    INSERT INTO agent_dial_metrics (${columns.map((c) => `"${c}"`).join(", ")})
    VALUES (${valueExprs.join(", ")})
    RETURNING id
  `;
  try {
    const result = await pool.query(sql, values);
    return (result.rows[0]?.id as number | undefined) ?? null;
  } catch (error: any) {
    // Self-heal when the table sequence drifts behind max(id), which causes
    // duplicate key errors on agent_dial_metrics_pkey during inserts.
    const isDuplicatePkey =
      String(error?.code || "") === "23505" &&
      String(error?.constraint || "") === "agent_dial_metrics_pkey";

    if (!isDuplicatePkey) {
      if (isDbConnectivityError(error)) {
        pauseDialMetricWrites(error);
        return null;
      }
      throw error;
    }

    try {
      await pool.query(`
        SELECT setval(
          pg_get_serial_sequence('agent_dial_metrics', 'id'),
          COALESCE((SELECT MAX(id) FROM agent_dial_metrics), 0) + 1,
          false
        )
      `);
      const retry = await pool.query(sql, values);
      return (retry.rows[0]?.id as number | undefined) ?? null;
    } catch (retryErr) {
      if (isDbConnectivityError(retryErr)) {
        pauseDialMetricWrites(retryErr);
        return null;
      }
      throw error;
    }
  }
}

export async function updateMasterleadLastContactedByPhoneLocal(
  phoneNumber: string,
): Promise<number> {
  if (shouldSkipMasterleadLastContactWrite()) return 0;

  await ensureMasterleadLocalTable();
  const last10 = last10Digits(phoneNumber);
  if (last10.length < 10) return 0;
  const nowIso = new Date().toISOString();
  try {
    const result = await pool.query(
      `
        UPDATE masterlead
        SET last_contacted = $1::timestamptz,
            updated_at = $1::timestamptz
        WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $2
      `,
      [nowIso, last10],
    );
    return result.rowCount || 0;
  } catch (error) {
    if (isDbConnectivityError(error)) {
      pauseMasterleadLastContactWrites(error);
      return 0;
    }
    throw error;
  }
}

export async function updateMasterleadResolutionLocal(params: {
  leadId?: number | string | null;
  leadPhone?: string | null;
  cnresolution: string;
  agentEmail?: string | null;
}): Promise<number> {
  await ensureMasterleadLocalTable();
  const nowIso = new Date().toISOString();
  const updates: string[] = [
    `cnresolution = $1`,
    `updated_at = $2::timestamptz`,
  ];
  const values: unknown[] = [params.cnresolution, nowIso];
  if (params.agentEmail && String(params.agentEmail).includes("@")) {
    updates.push(`cn_email = $3`);
    values.push(String(params.agentEmail).trim().toLowerCase());
  }

  const baseSet = updates.join(", ");
  if (params.leadId != null && String(params.leadId).trim() !== "") {
    const leadId = String(params.leadId).trim();
    const idParam = values.length + 1;
    const taalkParam = values.length + 2;
    const sql = `
      UPDATE masterlead
      SET ${baseSet}
      WHERE id::text = $${idParam}
         OR taalk_lead_id = $${taalkParam}
    `;
    const result = await pool.query(sql, [...values, leadId, leadId]);
    if ((result.rowCount || 0) > 0) return result.rowCount || 0;

    const isNumericId = /^[0-9]+$/.test(leadId);
    if (!isNumericId) return 0;

    // Row missing locally: create a minimal row so EOD sync can carry the latest resolution.
    await pool.query(
      `
        INSERT INTO masterlead (id, taalk_lead_id, cnresolution, cn_email, updated_at, created_at)
        VALUES (
          $1::bigint,
          $1,
          $2,
          $3,
          $4::timestamptz,
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          taalk_lead_id = COALESCE(EXCLUDED.taalk_lead_id, masterlead.taalk_lead_id),
          cnresolution = EXCLUDED.cnresolution,
          cn_email = COALESCE(EXCLUDED.cn_email, masterlead.cn_email),
          updated_at = EXCLUDED.updated_at
      `,
      [
        leadId,
        params.cnresolution,
        params.agentEmail && String(params.agentEmail).includes("@")
          ? String(params.agentEmail).trim().toLowerCase()
          : null,
        nowIso,
      ],
    );
    return 1;
  }

  const last10 = last10Digits(String(params.leadPhone || ""));
  if (last10.length < 10) return 0;
  const phoneParam = values.length + 1;
  const sql = `
    UPDATE masterlead
    SET ${baseSet}
    WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $${phoneParam}
  `;
  const result = await pool.query(sql, [...values, last10]);
  return result.rowCount || 0;
}

export async function updateMasterleadCnEmailByFilterLocal(params: {
  leadId?: number | string | null;
  leadPhone?: string | null;
  agentEmail: string;
}): Promise<{ id: number; taalk_lead_id: string | null } | null> {
  await ensureMasterleadLocalTable();
  const email = String(params.agentEmail || "").trim().toLowerCase();
  if (!email.includes("@")) return null;
  const nowIso = new Date().toISOString();

  if (params.leadId != null && String(params.leadId).trim() !== "") {
    const idValue = String(params.leadId).trim();
    const result = await pool.query<{ id: number; taalk_lead_id: string | null }>(
      `
        UPDATE masterlead
        SET cn_email = $1,
            updated_at = $2::timestamptz
        WHERE id::text = $3
           OR taalk_lead_id = $3
        RETURNING id, taalk_lead_id
      `,
      [email, nowIso, idValue],
    );
    if (result.rows[0]) return result.rows[0];
  }

  const last10 = last10Digits(String(params.leadPhone || ""));
  if (last10.length < 10) return null;
  const result = await pool.query<{ id: number; taalk_lead_id: string | null }>(
    `
      UPDATE masterlead
      SET cn_email = $1,
          updated_at = $2::timestamptz
      WHERE id = (
        SELECT id
        FROM masterlead
        WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $3
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      )
      RETURNING id, taalk_lead_id
    `,
    [email, nowIso, last10],
  );
  return result.rows[0] || null;
}

export async function updateMasterleadWebhookSentAtByIdLocal(
  leadId: number | string,
): Promise<void> {
  await ensureMasterleadLocalTable();
  await pool.query(
    `
      UPDATE masterlead
      SET webhook_sent_at = $1::timestamptz,
          updated_at = $1::timestamptz
      WHERE id::text = $2
    `,
    [new Date().toISOString(), String(leadId)],
  );
}

/**
 * Atomically increment agent_daily_stats for one event type.
 * Uses INSERT ... ON CONFLICT DO UPDATE so it's a single upsert — no race conditions.
 */
export async function incrementAgentDailyStat(
  agentEmail: string,
  eventType: 'dial' | 'reach' | 'booked' | 'instant_presentation',
  statDate?: string, // YYYY-MM-DD, defaults to today PT
): Promise<void> {
  if (!agentEmail || !eventType) return;
  // Booked is reconciled deterministically from masterlead contact/resolution timing.
  // Do not increment it here; event-level increments caused inflated AOI Command totals.
  if (eventType === 'booked') return;
  const email = agentEmail.toLowerCase().trim();
  const date = statDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  const col =
    eventType === 'dial'
      ? 'dials'
      : eventType === 'reach'
        ? 'reached'
        : eventType === 'booked'
          ? 'booked'
          : 'instants';

  await pool.query(
    `INSERT INTO agent_daily_stats (agent_email, stat_date, ${col}, updated_at)
     VALUES ($1, $2::date, 1, NOW())
     ON CONFLICT (agent_email, stat_date)
     DO UPDATE SET ${col} = agent_daily_stats.${col} + 1, updated_at = NOW()`,
    [email, date],
  );
}

/**
 * Adjust declared sales/ALP on agent_daily_stats for a specific date.
 * Supports positive and negative deltas so edits don't double count.
 */
export async function adjustAgentDailyDeclaredStats(
  agentEmail: string,
  statDate: string,
  declaredSalesDelta: number,
  declaredAlpDelta: number,
): Promise<void> {
  if (!agentEmail || !statDate) return;
  if (!Number.isFinite(declaredSalesDelta) || !Number.isFinite(declaredAlpDelta)) return;
  if (declaredSalesDelta === 0 && declaredAlpDelta === 0) return;

  const email = agentEmail.toLowerCase().trim();
  const salesDelta = Math.trunc(declaredSalesDelta);
  const alpDelta = Number(declaredAlpDelta) || 0;

  await pool.query(
    `INSERT INTO agent_daily_stats (agent_email, stat_date, declared_sales, declared_alp, updated_at)
     VALUES ($1, $2::date, GREATEST($3, 0), GREATEST($4::numeric, 0), NOW())
     ON CONFLICT (agent_email, stat_date)
     DO UPDATE SET
       declared_sales = GREATEST(agent_daily_stats.declared_sales + $3, 0),
       declared_alp = GREATEST(agent_daily_stats.declared_alp + $4::numeric, 0),
       updated_at = NOW()`,
    [email, statDate, salesDelta, alpDelta],
  );
}

/**
 * Get today's stats for one agent from agent_daily_stats.
 */
export async function getAgentDailyStats(
  agentEmail: string,
  statDate?: string,
): Promise<{ dials: number; reached: number; booked: number; instants: number; sales: number; alp: number; presentations: number; declared_sales: number; declared_alp: number }> {
  const email = agentEmail.toLowerCase().trim();
  const date = statDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const { rows } = await pool.query(
    `SELECT dials, reached, booked, instants, sales, alp, presentations, declared_sales, declared_alp FROM agent_daily_stats WHERE agent_email = $1 AND stat_date = $2::date`,
    [email, date],
  );
  return {
    dials: rows[0]?.dials || 0,
    reached: rows[0]?.reached || 0,
    booked: rows[0]?.booked || 0,
    instants: rows[0]?.instants || 0,
    sales: rows[0]?.sales || 0,
    alp: Number(rows[0]?.alp || 0),
    presentations: rows[0]?.presentations || 0,
    declared_sales: rows[0]?.declared_sales || 0,
    declared_alp: Number(rows[0]?.declared_alp || 0),
  };
}
