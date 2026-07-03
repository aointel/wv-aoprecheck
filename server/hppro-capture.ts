/**
 * hppro-capture.ts
 * Intercepts HPPRO API calls flowing through the proxy and writes clean
 * records to Supabase. Called from the impactapi proxy before forwarding.
 *
 * Key endpoints captured:
 *  POST /Presentation/SyncPresentation  — full presentation save (the money endpoint)
 *  GET  /Lead/GetLeadDetailForHpPro     — lead selected for presentation
 */

import { pool } from './db.js';
import { getCampaignManagerBaseUrl } from './external-service-urls.js';
import {
  buildEappInjectPayloadFromSyncPresentation,
  shouldQueueEappInject,
} from './hppro-eapp-bridge.js';

/** In-memory tail for “is the server seeing SyncPresentation?” without re-running a presentation. */
export type HpproCaptureWatchEvent = {
  at: string;
  kind:
    | 'impact_sync_post'
    | 'sync_saved'
    | 'sync_skipped'
    | 'sync_db_error'
    | 'eapp_queued'
    | 'eapp_skip'
    | 'lead_selection_saved';
  presentationGuid?: string;
  leadId?: string | number | null;
  detail: string;
};

const WATCH_MAX = 60;
const watchEvents: HpproCaptureWatchEvent[] = [];
let eventsTableEnsured = false;
let hpproStatsSchemaEnsured = false;

type PresentationLifecycleEventType = 'started' | 'ended';

function parseIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isTerminalPresentationStatus(whatHappened: string | null): boolean {
  const status = String(whatHappened || '').trim().toUpperCase();
  if (!status) return false;
  return status !== 'IN_PROGRESS';
}

function getPacificDateFromIso(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function normalizeHpproAgentEmail(value: unknown): string | null {
  const email = String(value || '').trim().toLowerCase();
  return email.includes('@') ? email : null;
}

function isSalePresentationStatus(value: unknown): boolean {
  return String(value || '').trim().toUpperCase() === 'SALE';
}

async function ensureHpproStatsSchema(): Promise<void> {
  if (hpproStatsSchemaEnsured) return;
  await pool.query(`
    ALTER TABLE IF EXISTS hppro_presentations
      ADD COLUMN IF NOT EXISTS agent_email TEXT,
      ADD COLUMN IF NOT EXISTS raw_payload JSONB
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS agent_daily_stats
      ADD COLUMN IF NOT EXISTS presentations INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS declared_sales INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS declared_alp NUMERIC NOT NULL DEFAULT 0
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hppro_presentations_agent_date
      ON hppro_presentations (lower(agent_email), ((COALESCE(end_time, start_time, synced_at))::date))
  `).catch(() => undefined);
  hpproStatsSchemaEnsured = true;
}

async function refreshHpproAgentDailyStats(input: {
  agentEmail: string | null;
  statDate: string;
}): Promise<void> {
  const agentEmail = normalizeHpproAgentEmail(input.agentEmail);
  if (!agentEmail) return;
  await ensureHpproStatsSchema();

  await pool.query(
    `
      WITH hppro AS (
        SELECT
          lower(trim(agent_email)) AS agent_email,
          COUNT(*) FILTER (
            WHERE COALESCE(trim(what_happened), '') <> ''
              AND upper(trim(what_happened)) <> 'IN_PROGRESS'
          )::int AS presentations,
          COUNT(*) FILTER (WHERE upper(trim(COALESCE(what_happened, ''))) = 'SALE')::int AS declared_sales,
          COALESCE(SUM(CASE
            WHEN COALESCE(total_alp, 0) > 0 THEN COALESCE(total_alp, 0)
            ELSE 0
          END), 0)::numeric AS declared_alp
        FROM hppro_presentations
        WHERE lower(trim(agent_email)) = $1
          AND (
            COALESCE(end_time, start_time, synced_at)::date = $2::date
            OR ((COALESCE(end_time, start_time, synced_at) AT TIME ZONE 'America/Los_Angeles')::date = $2::date)
          )
        GROUP BY lower(trim(agent_email))
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
        $1,
        $2::date,
        COALESCE(existing.dials, 0),
        COALESCE(existing.reached, 0),
        COALESCE(existing.booked, 0),
        COALESCE(existing.instants, 0),
        COALESCE(existing.sales, 0),
        COALESCE(existing.alp, 0),
        COALESCE(existing.plus, 0),
        COALESCE(hppro.presentations, 0),
        COALESCE(hppro.declared_sales, 0),
        COALESCE(hppro.declared_alp, 0),
        NOW()
      FROM (SELECT $1::text AS agent_email) seed
      LEFT JOIN hppro ON hppro.agent_email = seed.agent_email
      LEFT JOIN agent_daily_stats existing
        ON lower(existing.agent_email) = seed.agent_email
       AND existing.stat_date = $2::date
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        presentations = EXCLUDED.presentations,
        declared_sales = EXCLUDED.declared_sales,
        declared_alp = EXCLUDED.declared_alp,
        updated_at = NOW()
    `,
    [agentEmail, input.statDate],
  );
}

async function ensureHpproPresentationEventsTable(): Promise<void> {
  if (eventsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hppro_presentation_events (
      id BIGSERIAL PRIMARY KEY,
      presentation_guid TEXT NOT NULL,
      lead_id BIGINT NULL,
      agent_number TEXT NULL,
      agent_email TEXT NULL,
      event_type TEXT NOT NULL,
      event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      what_happened TEXT NULL,
      total_alp NUMERIC NULL,
      payload JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hppro_presentation_events_guid_type
      ON hppro_presentation_events (presentation_guid, event_type)
  `);
  eventsTableEnsured = true;
}

async function hasLifecycleEvent(presentationGuid: string, eventType: PresentationLifecycleEventType): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM hppro_presentation_events
      WHERE presentation_guid = $1
        AND event_type = $2
      LIMIT 1`,
    [presentationGuid, eventType]
  );
  return rows.length > 0;
}

async function forwardLifecycleEventToAoiCommand(payload: Record<string, unknown>): Promise<void> {
  const base = getCampaignManagerBaseUrl();
  if (!base) return;
  const url = `${base}/api/hppro/presentation-events`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e: any) {
    pushHpproWatch({
      kind: 'sync_skipped',
      presentationGuid: String(payload.presentation_guid || ''),
      leadId: (payload.lead_id as string | number | null) ?? null,
      detail: `AOI command forward failed: ${e?.message || 'unknown'}`,
    });
  }
}

async function persistAndForwardLifecycleEvent(input: {
  presentationGuid: string;
  leadId: number | null;
  agentNumber: string | null;
  agentEmail: string | null;
  eventType: PresentationLifecycleEventType;
  eventTimeIso: string;
  whatHappened: string | null;
  totalAlp: number | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  await ensureHpproPresentationEventsTable();
  await pool.query(
    `INSERT INTO hppro_presentation_events
      (presentation_guid, lead_id, agent_number, agent_email, event_type, event_time, what_happened, total_alp, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.presentationGuid,
      input.leadId,
      input.agentNumber,
      input.agentEmail,
      input.eventType,
      input.eventTimeIso,
      input.whatHappened,
      input.totalAlp,
      JSON.stringify(input.payload ?? {}),
    ]
  );

  await forwardLifecycleEventToAoiCommand({
    event_type: input.eventType,
    presentation_guid: input.presentationGuid,
    lead_id: input.leadId,
    agent_number: input.agentNumber,
    agent_email: input.agentEmail,
    event_time: input.eventTimeIso,
    what_happened: input.whatHappened,
    total_alp: input.totalAlp,
    source: 'hppro_capture',
    captured_at: new Date().toISOString(),
  });
}

export function pushHpproWatch(entry: Omit<HpproCaptureWatchEvent, 'at'>): void {
  const row: HpproCaptureWatchEvent = {
    at: new Date().toISOString(),
    ...entry,
  };
  watchEvents.unshift(row);
  if (watchEvents.length > WATCH_MAX) watchEvents.length = WATCH_MAX;
  // Production silences console.log/warn — use error so Railway still shows it.
  console.error(
    '[HPPRO_CAPTURE_WATCH]',
    row.kind,
    row.detail,
    row.presentationGuid ? `guid=${row.presentationGuid}` : '',
  );
}

export function getHpproWatchEvents(): HpproCaptureWatchEvent[] {
  return [...watchEvents];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJwt(authHeader: string): { agentNumber?: string; agentEmail?: string; userId?: number } {
  // The JWT payload is in the second segment (base64url encoded JSON)
  try {
    const token = authHeader.replace(/^bearer\s+/i, '');
    const payload = token.split('.')[1];
    if (!payload) return {};
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const un = decoded?.unique_name ?? decoded?.preferred_username ?? decoded?.upn;
    const unStr = typeof un === 'string' ? un.trim() : '';
    const fromUnique = unStr.includes('@') ? unStr : undefined;
    return {
      agentNumber: decoded?.AgentNumber || decoded?.sub,
      agentEmail:
        decoded?.email ||
        decoded?.Email ||
        decoded?.UserInfo?.Email ||
        fromUnique,
      userId: decoded?.userId || decoded?.UserId,
    };
  } catch { return {}; }
}

function safeJson(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

// ── Main capture function — call from impactRouter ─────────────────────────

export async function captureHpproRequest(opts: {
  method: string;
  path: string;
  query: Record<string, any>;
  authHeader: string;
  requestBody: any;         // parsed request body (JSON object or string)
  responseBody: string;     // raw response body text
  responseStatus: number;
}): Promise<void> {
  const { method, path, query, authHeader, requestBody, responseBody, responseStatus } = opts;

  const agentInfo = parseJwt(authHeader);

  // ── SyncPresentation (POST) ─────────────────────────────────────────────
  if (method === 'POST' && path.includes('SyncPresentation')) {
    if (responseStatus < 200 || responseStatus >= 400) {
      pushHpproWatch({
        kind: 'sync_skipped',
        detail: `SyncPresentation HTTP ${responseStatus} (not saved)`,
      });
      return;
    }
    await captureSyncPresentation(requestBody, responseBody, agentInfo);
    return;
  }

  // Only process successful responses for other capture types
  if (responseStatus < 200 || responseStatus >= 400) return;

  // ── Lead detail fetched (GET) ────────────────────────────────────────────
  if (method === 'GET' && path.includes('GetLeadDetailForHpPro')) {
    const leadId = query.leadId || query.LeadId;
    try {
      const lead = JSON.parse(responseBody);
      if (lead?.LeadId) await captureLeadSelection(lead, leadId, agentInfo);
    } catch { /* not JSON */ }
    return;
  }
}

// ── SyncPresentation handler ─────────────────────────────────────────────────

async function captureSyncPresentation(
  body: any,
  responseBody: string,
  agentInfo: ReturnType<typeof parseJwt>,
) {
  let payload: any =
    body == null
      ? null
      : typeof body === 'string'
        ? safeJson(body)
        : body;
  if (!payload || typeof payload !== 'object') {
    const fromResp = safeJson(responseBody);
    if (fromResp && typeof fromResp === 'object' && (fromResp as any).PresentationGuid != null) {
      payload = fromResp;
    } else {
      pushHpproWatch({
        kind: 'sync_skipped',
        detail:
          'No JSON body/response with PresentationGuid — use /api/hppro iframe + /api/hppro-impact',
      });
      return;
    }
  }

  const presGuid = payload.PresentationGuid;
  if (!presGuid) {
    pushHpproWatch({
      kind: 'sync_skipped',
      detail: 'Payload missing PresentationGuid',
    });
    return;
  }

  // Extract the key fields from the je() payload
  const startTimeIso = parseIsoOrNull(payload.StartTime) ?? new Date().toISOString();
  const endTimeIso = parseIsoOrNull(payload.EndTime);
  const whatHappened = payload.WhatHappenedString ? String(payload.WhatHappenedString) : null;
  const totalAlpNum = payload.TotalALP == null ? null : Number(payload.TotalALP);
  const normalizedAgentEmail = (
    (typeof agentInfo.agentEmail === 'string' && agentInfo.agentEmail) ||
    (typeof (payload as any).AgentEmail === 'string' && (payload as any).AgentEmail) ||
    (typeof (payload as any).agentEmail === 'string' && (payload as any).agentEmail) ||
    null
  );
  const agentEmailForStats = normalizeHpproAgentEmail(normalizedAgentEmail);
  const normalizedLeadId = (payload.LeadId && String(payload.LeadId).trim()) ? Number(payload.LeadId) || null : null;

  const record = {
    presentation_guid:         presGuid,
    lead_id:                   normalizedLeadId,
    agent_email:               agentEmailForStats,
    agent_number:              payload.AgentNumber || agentInfo.agentNumber || null,
    agent_user_id:             agentInfo.userId || null,
    presentation_type_id:      payload.PresentationTypeId || null,
    group_id:                  payload.PresentedGroupId || null,
    state_id:                  payload.StateId || null,
    country_id:                payload.CountryId || 1,
    start_time:                payload.StartTime || null,
    end_time:                  payload.EndTime || null,
    step_completed:            payload.StepCompleted ?? null,
    what_happened:             payload.WhatHappenedString || null,
    is_sale:                   isSalePresentationStatus(payload.WhatHappenedString),
    total_alp:                 payload.TotalALP ?? null,
    total_ahp:                 payload.TotalAHP ?? null,
    premium_plan:              payload.PremiumPlan || null,
    premium_type_id:           payload.PremiumTypeId || null,
    wage_type_id:              payload.WageTypeId || null,
    // Completion flags
    is_need_analysis_done:     payload.IsNeedAnalysisCompleted ?? false,
    is_benefit_summary_done:   payload.IsBenefitsSummaryCompleted ?? false,
    is_plan_generator_done:    payload.IsPlanGeneratorCompleted ?? false,
    is_report_card_done:       payload.IsReportCardCompleted ?? false,
    is_no_cost_done:           payload.IsNoCostCompleted ?? false,
    is_present_plan_done:      payload.IsPresentPlanCompleted ?? false,
    // Time on screen (ms)
    time_need_analysis_ms:     payload.NeedAnalysisDurationTicks ?? null,
    time_benefit_summary_ms:   payload.BenefitsSummaryDurationTicks ?? null,
    time_no_cost_ms:           payload.NoCostDurationTicks ?? null,
    time_plan_generator_ms:    payload.PlanGeneratorDurationTicks ?? null,
    time_present_plan_ms:      payload.PresentPlanDurationTicks ?? null,
    time_report_card_ms:       payload.ReportCardDurationTicks ?? null,
    // Sub-type / metadata
    presentation_sub_type_id:  payload.PresentationSubTypeId || null,
    presentation_code:         payload.PresentationCode || null,
    member_lookup_type_id:     payload.MemberLookupTypeId || null,
    location_context:          payload.LocationContext || null,
    language_id:               payload.Language || null,
    sg_number:                 payload.SGNumber || null,
    license_id:                payload.LicenseId || null,
    precheck_status_id:        payload.PreCheckVerificationStatusId || null,
    is_senior:                 payload.IsSenior ?? null,
    benefit_email_count:       payload.BenefitAndDocumentEmailCount ?? 0,
    na_notes:                  payload.NANotes || null,
    fp_notes:                  payload.FPNotes || null,
    // Nested data — stored as JSONB
    plan_options:              safeJson(payload.PlanOptions) || null,
    need_analysis_items:       safeJson(payload.NeedAnalysisItems) || null,
    basic_info:                safeJson(payload.BasicInfo) || null,
    general_questions:         safeJson(payload.GeneralQuestionsAnswers) || null,
    medical_answers:           safeJson(payload.MedicalAnswers) || null,
    sponsorships:              safeJson(payload.SponserShips) || null,
    precheck_verification:     safeJson(payload.PreCheckVerification) || null,
    rate_list_version:         payload.RateListVersion || null,
    product_list_version:      payload.ProductListVersion || null,
    synced_at:                 new Date().toISOString(),
    raw_payload:               payload,  // keep full payload for debugging
  };

  let dbError: string | null = null;
  try {
    await ensureHpproStatsSchema();
    const cols = Object.keys(record);
    const vals = cols.map((_, i) => `$${i + 1}`);
    const updates = cols.filter(c => c !== 'presentation_guid').map(c => `${c} = EXCLUDED.${c}`);
    await pool.query(
      `INSERT INTO hppro_presentations (${cols.join(', ')}) VALUES (${vals.join(', ')})
       ON CONFLICT (presentation_guid) DO UPDATE SET ${updates.join(', ')}`,
      cols.map(c => {
        const v = (record as any)[c];
        return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
      })
    );
  } catch (e: any) {
    dbError = e.message;
  }

  if (dbError) {
    // Log but don't return — still queue eApp inject even if presentations table write fails
    pushHpproWatch({
      kind: 'sync_db_error',
      presentationGuid: String(presGuid),
      leadId: payload.LeadId ?? null,
      detail: dbError,
    });
  }

  pushHpproWatch({
    kind: 'sync_saved',
    presentationGuid: String(presGuid),
    leadId: payload.LeadId ?? null,
    detail: `${payload.WhatHappenedString || 'IN_PROGRESS'} ALP=${payload.TotalALP ?? 'n/a'} → hppro_presentations`,
  });

  if (!dbError && isTerminalPresentationStatus(whatHappened)) {
    try {
      await refreshHpproAgentDailyStats({
        agentEmail: agentEmailForStats,
        statDate: getPacificDateFromIso(endTimeIso ?? startTimeIso),
      });
      pushHpproWatch({
        kind: 'sync_saved',
        presentationGuid: String(presGuid),
        leadId: payload.LeadId ?? null,
        detail: `agent_daily_stats AO Present refreshed for ${agentEmailForStats || 'unknown'} ${getPacificDateFromIso(endTimeIso ?? startTimeIso)}`,
      });
    } catch (statsErr: any) {
      pushHpproWatch({
        kind: 'sync_db_error',
        presentationGuid: String(presGuid),
        leadId: payload.LeadId ?? null,
        detail: `agent_daily_stats AO Present refresh failed: ${statsErr?.message || statsErr}`,
      });
    }
  }

  try {
    const guid = String(presGuid);
    const alreadyStarted = await hasLifecycleEvent(guid, 'started');
    if (!alreadyStarted) {
      await persistAndForwardLifecycleEvent({
        presentationGuid: guid,
        leadId: normalizedLeadId,
        agentNumber: record.agent_number ? String(record.agent_number) : null,
        agentEmail: normalizedAgentEmail ? String(normalizedAgentEmail).toLowerCase().trim() : null,
        eventType: 'started',
        eventTimeIso: startTimeIso,
        whatHappened,
        totalAlp: Number.isFinite(totalAlpNum as number) ? totalAlpNum : null,
        payload,
      });
      pushHpproWatch({
        kind: 'sync_saved',
        presentationGuid: guid,
        leadId: normalizedLeadId,
        detail: `lifecycle started tracked (${startTimeIso})`,
      });
    }

    const shouldMarkEnded = !!endTimeIso || isTerminalPresentationStatus(whatHappened);
    if (shouldMarkEnded) {
      const alreadyEnded = await hasLifecycleEvent(guid, 'ended');
      if (!alreadyEnded) {
        await persistAndForwardLifecycleEvent({
          presentationGuid: guid,
          leadId: normalizedLeadId,
          agentNumber: record.agent_number ? String(record.agent_number) : null,
          agentEmail: normalizedAgentEmail ? String(normalizedAgentEmail).toLowerCase().trim() : null,
          eventType: 'ended',
          eventTimeIso: endTimeIso ?? new Date().toISOString(),
          whatHappened,
          totalAlp: Number.isFinite(totalAlpNum as number) ? totalAlpNum : null,
          payload,
        });
        pushHpproWatch({
          kind: 'sync_saved',
          presentationGuid: guid,
          leadId: normalizedLeadId,
          detail: `lifecycle ended tracked (${endTimeIso ?? 'now'})`,
        });
      }
    }
  } catch (lifecycleErr: any) {
    pushHpproWatch({
      kind: 'sync_db_error',
      presentationGuid: String(presGuid),
      leadId: normalizedLeadId,
      detail: `Lifecycle tracking failed: ${lifecycleErr?.message || lifecycleErr}`,
    });
  }

  const payloadRec = payload as Record<string, unknown>;
  if (!shouldQueueEappInject(payloadRec)) return;

  // Try multiple sources for agent email
  let agentEmailRaw =
    (typeof agentInfo.agentEmail === 'string' && agentInfo.agentEmail) ||
    (typeof (payload as any).AgentEmail === 'string' && (payload as any).AgentEmail) ||
    (typeof (payload as any).agentEmail === 'string' && (payload as any).agentEmail) ||
    '';

  // Fallback: read from hppro_jwt_cache.json which has UserDetail.UserInfo.Email
  if (!agentEmailRaw || !agentEmailRaw.includes('@')) {
    try {
      const { readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const cacheFile = join(process.cwd(), 'hppro_jwt_cache.json');
      if (existsSync(cacheFile)) {
        const cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
        const user = JSON.parse(cache.user || '{}');
        const email = user?.UserDetail?.UserInfo?.BussinessEmail || user?.UserDetail?.UserInfo?.Email;
        if (email && email.includes('@')) agentEmailRaw = email;
      }
    } catch {}
  }

  const agentEmail = agentEmailRaw.trim().toLowerCase();
  if (!agentEmail.includes('@')) {
    pushHpproWatch({
      kind: 'eapp_skip',
      presentationGuid: String(presGuid),
      leadId: payload.LeadId ?? null,
      detail: 'No agent email on JWT/payload — eApp queue skipped',
    });
    return;
  }

  const injectPayload = buildEappInjectPayloadFromSyncPresentation(payloadRec);
  const q = await upsertHpproEappPending({
    agentEmail,
    presentationGuid: String(presGuid),
    injectPayload,
    whatHappened: String(payload.WhatHappenedString ?? ''),
  });
  if (q.ok) {
    pushHpproWatch({
      kind: 'eapp_queued',
      presentationGuid: String(presGuid),
      detail: `hppro_eapp_pending for ${agentEmail}`,
    });
  } else {
    pushHpproWatch({
      kind: 'eapp_skip',
      presentationGuid: String(presGuid),
      detail: `eApp upsert failed: ${q.error}`,
    });
  }
}

// ── Lead selection handler ────────────────────────────────────────────────────

async function captureLeadSelection(lead: any, leadId: any, agentInfo: ReturnType<typeof parseJwt>) {
  const record = {
    lead_id:        lead.LeadId || leadId,
    agent_number:   agentInfo.agentNumber || null,
    agent_user_id:  agentInfo.userId || null,
    first_name:     lead.FirstName || null,
    last_name:      lead.LastName || null,
    email:          lead.PrimaryEmail || lead.Email || null,
    phone:          lead.PrimaryPhone || null,
    state:          lead.StateCode || lead.State || null,
    state_id:       lead.StateId || null,
    city:           lead.City || null,
    zip:            lead.Zip || null,
    dob:            lead.DateOfBirth || null,
    age:            lead.Age || lead._Age || null,
    group_id:       lead.GroupId || null,
    group_name:     lead.GroupName || null,
    group_code:     lead.GroupCode || null,
    occupation:     lead.Occupation || null,
    has_spouse:     lead.Spouse != null,
    selected_at:    new Date().toISOString(),
  };

  let leadSelectErr: string | null = null;
  try {
    const cols = Object.keys(record);
    const vals = cols.map((_, i) => `$${i + 1}`);
    const updates = cols.filter(c => c !== 'lead_id' && c !== 'agent_number').map(c => `${c} = EXCLUDED.${c}`);
    await pool.query(
      `INSERT INTO hppro_lead_selections (${cols.join(', ')}) VALUES (${vals.join(', ')})
       ON CONFLICT (lead_id, agent_number) DO UPDATE SET ${updates.join(', ')}`,
      cols.map(c => (record as any)[c])
    );
  } catch (e: any) {
    leadSelectErr = e.message;
  }

  if (leadSelectErr) {
    pushHpproWatch({
      kind: 'sync_db_error',
      leadId: lead.LeadId,
      detail: `Lead selection upsert: ${leadSelectErr}`,
    });
  } else {
    pushHpproWatch({
      kind: 'lead_selection_saved',
      leadId: lead.LeadId,
      detail: `${lead.FirstName} ${lead.LastName} → hppro_lead_selections`,
    });
  }
}
