import { Router } from 'express';
import twilio from 'twilio';
import { appState } from './state.js';
import * as taalk from './taalk-client.js';
import { normalizeMarket } from './normalize.js';
import type { AgentHealthReport, AgentCommand, AgentCommandType } from '../shared/types.js';
import { SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL } from './hardcoded-config.js';

const router = Router();
const hpproPresentationEvents: any[] = [];
const AOIRAIL_DATA_URL = 'https://aoirail-data-production.up.railway.app';
const AOIRAIL_CONNECT_URL = 'https://aoirail-connect-production.up.railway.app';
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

type ViewerContext = {
  email: string | null;
  isSysop: boolean;
  mgaName: string | null;
  scopedEmails: Set<string> | null;
};

type TeamDailyStatsCacheEntry = { ts: number; payload: any };
const teamDailyStatsCache = new Map<string, TeamDailyStatsCacheEntry>();
const TEAM_DAILY_STATS_CACHE_TTL_MS = 60_000;
let leadFlowSnapshot: any | null = null;
let leadFlowSnapshotAsOf: string | null = null;

function getBearerToken(authHeader: string | undefined): string {
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

async function resolveSupabaseEmailFromToken(token: string): Promise<string | null> {
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    const email = String(data?.email || '').toLowerCase().trim();
    return email && email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

async function getViewerContext(req: any): Promise<ViewerContext> {
  const token = getBearerToken(req.headers?.authorization);
  const tokenEmail = await resolveSupabaseEmailFromToken(token);
  const email = tokenEmail;
  // Preserve legacy behavior for this service: when no bearer token is present,
  // keep dashboards accessible instead of hard-failing sysop checks.
  const isSysop = !email || email === 'cnsysop@aoglobelife.com' || email === 'robhay@aoglobelife.com';
  const hierarchy = email ? appState.getHierarchyForEmail(email) : null;
  // No email = unauthenticated request â€” show all (null scopedEmails = sysop-level)
  // This covers direct API calls or cases where token isn't sent yet
  const scopedEmails = email ? appState.getScopedAgentEmailsForViewer(email) : null;
  return {
    email,
    isSysop,
    mgaName: hierarchy?.mgaName ?? null,
    scopedEmails: (isSysop || !email) ? null : scopedEmails,
  };
}

function applyEmailScope<T>(rows: T[], scopedEmails: Set<string> | null, pickEmail: (row: T) => string | null): T[] {
  if (!scopedEmails) return rows;
  return rows.filter((row) => {
    const email = String(pickEmail(row) || '').toLowerCase().trim();
    return !!email && scopedEmails.has(email);
  });
}

function inScope(email: string | null | undefined, scopedEmails: Set<string> | null): boolean {
  if (!scopedEmails) return true;
  const e = String(email || '').toLowerCase().trim();
  return !!e && scopedEmails.has(e);
}

function last10(value: unknown): string {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

async function supabaseRest(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase query failed ${res.status}: ${await res.text()}`);
  return await res.json();
}

function shiftIsoDate(dateIso: string, days: number): string {
  const [y, m, d] = String(dateIso || '').split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

async function fetchTeamDailyStatsLive(date?: string): Promise<any | null> {
  const baseDate = date || operationalDialDateIso();
  const candidateDates = date ? [baseDate] : [baseDate, shiftIsoDate(baseDate, -1)];

  for (const statsDate of candidateDates) {
    const cacheKey = `team_daily_stats::${statsDate}`;
    const cached = teamDailyStatsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TEAM_DAILY_STATS_CACHE_TTL_MS) {
      if (cached.payload?.agents && (date || (Array.isArray(cached.payload.agents) && cached.payload.agents.length > 0))) {
        return cached.payload;
      }
    }

    // Source-of-truth: aoirail-data (agent_daily_stats-backed endpoint).
    try {
      const query = new URLSearchParams();
      query.set('date', statsDate);
      query.set('_ts', String(Date.now()));
      const r = await fetch(`${AOIRAIL_DATA_URL}/api/agent-daily-stats/team?${query.toString()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(70000),
      });
      if (r.ok) {
        const payload = await r.json().catch(() => null);
        if (payload?.agents) {
          teamDailyStatsCache.set(cacheKey, { ts: Date.now(), payload });
        }
        if (payload?.agents && (date || (Array.isArray(payload.agents) && payload.agents.length > 0))) {
          return payload;
        }
      }
    } catch {
      // Try next candidate date.
    }
  }
  return null;
}

type TwilioRawCountCache = { value: number; ts: number };
let twilioRawOutboundCache: TwilioRawCountCache | null = null;
const TWILIO_RAW_CACHE_TTL_MS = 10 * 60_000;
type TwilioPerAgentStats = { d: number; r: number; b: number; i: number };
type TwilioPerAgentCache = { ts: number; totalOutbound: number; byEmail: Record<string, TwilioPerAgentStats> };
let twilioPerAgentCache: TwilioPerAgentCache | null = null;

function extractClientEmail(raw: unknown): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('client:')) {
    const identity = value.replace(/^client:/i, '').trim().toLowerCase();
    return identity.includes('@') ? identity : null;
  }
  return value.includes('@') ? value : null;
}

function nyDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function operationalDialDateIso(now = new Date()): string {
  // Operational dial day boundary is 06:00 ET; shift back 6h then format ET date.
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

function nyLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): number {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(targetLocalAsUtc);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(guess)
      .filter((p) => p.type !== 'literal')
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

async function fetchTwilioRawOutboundSince6amEst(): Promise<number> {
  const now = Date.now();
  if (twilioRawOutboundCache && now - twilioRawOutboundCache.ts < TWILIO_RAW_CACHE_TTL_MS) {
    return twilioRawOutboundCache.value;
  }

  const isoDate = nyDateIso();
  const [year, month, day] = isoDate.split('-').map(Number);
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const sinceDate = new Date(sinceUtcMs);

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let pageToken: string | undefined;
  let pageNumber: string | undefined;
  let count = 0;

  while (true) {
    const page = await client.calls.page({
      startTimeAfter: sinceDate,
      pageSize: 1000,
      pageToken,
      pageNumber,
    } as any);
    const calls: any[] = Array.isArray((page as any)?.instances) ? (page as any).instances : [];
    for (const c of calls) {
      const dir = String(c?.direction || '').toLowerCase();
      if (!dir.startsWith('outbound')) continue;
      const t = c?.startTime || c?.dateCreated;
      if (!t) continue;
      if (new Date(t).getTime() >= sinceUtcMs) count += 1;
    }
    const nextPageUrl = String((page as any)?.nextPageUrl || '');
    if (!nextPageUrl) break;
    const u = new URL(nextPageUrl);
    pageToken = u.searchParams.get('PageToken') || undefined;
    pageNumber = u.searchParams.get('Page') || undefined;
  }

  twilioRawOutboundCache = { value: count, ts: Date.now() };
  return count;
}

async function fetchTwilioPerAgentSince6amEst(): Promise<TwilioPerAgentCache> {
  const now = Date.now();
  if (twilioPerAgentCache && now - twilioPerAgentCache.ts < TWILIO_RAW_CACHE_TTL_MS) {
    return twilioPerAgentCache;
  }

  const isoDate = nyDateIso();
  const [year, month, day] = isoDate.split('-').map(Number);
  const sinceUtcMs = nyLocalToUtcMs(year, month, day, 6, 0, 0);
  const sinceDate = new Date(sinceUtcMs);

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let pageToken: string | undefined;
  let pageNumber: string | undefined;
  let totalOutbound = 0;
  const byEmail: Record<string, TwilioPerAgentStats> = {};

  while (true) {
    const page = await client.calls.page({
      startTimeAfter: sinceDate,
      pageSize: 1000,
      pageToken,
      pageNumber,
    } as any);
    const calls: any[] = Array.isArray((page as any)?.instances) ? (page as any).instances : [];
    for (const c of calls) {
      const dir = String(c?.direction || '').toLowerCase();
      const t = c?.startTime || c?.dateCreated;
      if (!t) continue;
      if (new Date(t).getTime() < sinceUtcMs) continue;
      if (dir.startsWith('outbound')) totalOutbound += 1;

      // Agent identity appears on WebRTC legs (often direction=inbound); use identity presence for per-agent Live rows.
      const identities = new Set<string>();
      const fromEmail = extractClientEmail(c?.from);
      const toEmail = extractClientEmail(c?.to);
      if (fromEmail) identities.add(fromEmail);
      if (toEmail) identities.add(toEmail);
      if (identities.size === 0) continue;

      const duration = Number(c?.duration || 0) || 0;
      for (const email of identities) {
        const cur = byEmail[email] || { d: 0, r: 0, b: 0, i: 0 };
        cur.d += 1;
        if (duration >= 45) cur.r += 1;
        if (duration >= 600) {
          cur.b += 1;
          cur.i += 1;
        }
        byEmail[email] = cur;
      }
    }
    const nextPageUrl = String((page as any)?.nextPageUrl || '');
    if (!nextPageUrl) break;
    const u = new URL(nextPageUrl);
    pageToken = u.searchParams.get('PageToken') || undefined;
    pageNumber = u.searchParams.get('Page') || undefined;
  }

  const value: TwilioPerAgentCache = { ts: Date.now(), totalOutbound, byEmail };
  twilioPerAgentCache = value;
  return value;
}

router.get('/health', (_req, res) => {
  const buildRef =
    String(
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.RAILWAY_DEPLOYMENT_ID ||
      process.env.RENDER_GIT_COMMIT ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      ''
    ).trim() || 'unknown';
  res.json({
    ok: true,
    uptime: process.uptime(),
    taalkTokenConfigured: taalk.isTaalkTokenConfigured(),
    build: buildRef,
    service: 'campaign-manager',
    now: new Date().toISOString(),
  });
});

router.get('/viewer-context', async (req, res) => {
  const viewer = await getViewerContext(req);
  res.json({
    email: viewer.email,
    isSysop: viewer.isSysop,
    mgaName: viewer.mgaName,
  });
});

router.get('/debug/customer/:email', async (req, res) => {
  const viewer = await getViewerContext(req);
  if (!viewer.isSysop) return res.status(403).json({ error: 'debug is restricted to cnsysop' });
  const email = String(req.params.email || '').toLowerCase().trim();
  if (!email.includes('@')) return res.status(400).json({ error: 'valid email is required' });
  const customer = appState.getCustomerForEmail(email);
  const hierarchy = appState.getHierarchyForEmail(email);
  return res.json({ email, customer, hierarchy });
});

// â”€â”€ Agents â”€â”€

// GET /api/agents/rts â€” online agents (from last poll)
router.get('/agents/rts', (_req, res) => {
  res.json({
    agents: appState.agents,
    stats: appState.stats,
    polledAt: appState.lastRTSPoll,
  });
});

// GET /api/agents/roster â€” full roster
router.get('/agents/roster', async (_req, res) => {
  // If stale, re-poll
  if (Date.now() - appState.lastRosterPoll > 120_000) {
    await appState.pollRoster();
  }
  res.json({
    agents: appState.allAgents,
    polledAt: appState.lastRosterPoll,
  });
});

// POST /api/agents/:mongoId/suspend
router.post('/agents/:mongoId/suspend', async (req, res) => {
  try {
    const { mongoId } = req.params;
    await taalk.suspendAgent(mongoId);
    // Force an immediate RTS poll to reflect the change
    setTimeout(() => appState.pollRTS(), 1000);
    res.json({ success: true, action: 'suspended', mongoId });
  } catch (err: any) {
    console.error('Suspend error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/:mongoId/unsuspend
router.post('/agents/:mongoId/unsuspend', async (req, res) => {
  try {
    const { mongoId } = req.params;
    await taalk.unsuspendAgent(mongoId);
    setTimeout(() => appState.pollRTS(), 1000);
    res.json({ success: true, action: 'unsuspended', mongoId });
  } catch (err: any) {
    console.error('Unsuspend error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ccpro-roster â€” CCPro subscribers (company-email keyed). Used by dashboard as N/Total denominator only.
// These agents are NOT in mergedAgents unless they also appear in Taalk/Twilio/AOIrail.
router.get('/ccpro-roster', (_req, res) => {
  res.json({ roster: [...appState.ccProRoster.values()], count: appState.ccProRoster.size });
});

// GET /api/agents/merged â€” unified agent list with Taalk + Twilio status
router.get('/agents/merged', (_req, res) => {
  res.json({
    agents: appState.getMergedAgents(),
    stats: appState.stats,
    credits: Object.fromEntries(appState.agentCredits),
    polledAt: { taalk: appState.lastRTSPoll, twilio: appState.lastTwilioPoll },
  });
});

// GET /api/agents/drb — per-agent DRB from agent_daily_stats
router.get('/agents/drb', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    // Live fetch from data service with no-store + connect fallback.
    const data = await fetchTeamDailyStatsLive(undefined);
    const agents: any[] = data?.agents || [];

    const out: Record<string, { d: number; r: number; b: number; i: number }> = {};
    for (const a of agents) {
      const email = String(a.agent_email || '').toLowerCase().trim();
      if (!email || (viewer.scopedEmails && !viewer.scopedEmails.has(email))) continue;
      out[email] = {
        d: Number((a as any).dials || 0),
        r: Number(a.reached || 0),
        b: Number(a.booked || 0),
        i: Number(a.instants || 0),
      };
    }
    const rawTeamDials = Object.values(out).reduce((sum, row) => sum + Number(row?.d || 0), 0);
    const rawDialSource: 'agent_daily_stats' = 'agent_daily_stats';
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ drb: out, rawTeamDials, rawDialSource, polledAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch DRB' });
  }
});

router.get('/agents/:email/call-log', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const email = String(req.params.email || '').toLowerCase().trim();
    if (!email.includes('@')) return res.status(400).json({ error: 'valid email required' });
    if (!inScope(email, viewer.scopedEmails)) return res.status(403).json({ error: 'Not authorized for this agent' });

    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '300'), 10) || 300));
    const date = String(req.query.date || '').trim();
    const hours = Math.min(72, Math.max(1, parseInt(String(req.query.hours || '24'), 10) || 24));

    // AOIrail data service owns the hot/local twilio_call_logs table used by DRB.
    // Prefer enriched mode first (lead linkage + normalized outcomes), then
    // fall back to raw Twilio mode if needed.
    try {
      const callLogBaseUrl =
        `${AOIRAIL_DATA_URL}/api/twilio-calls/agent-log/${encodeURIComponent(email)}?limit=${Math.max(limit, 2000)}&hours=${hours}${date ? `&date=${encodeURIComponent(date)}` : ''}`;
      const livePayloads: any[] = [];
      for (const sourceUrl of [
        `${callLogBaseUrl}&_ts=${Date.now()}`,
        `${callLogBaseUrl}&mode=twilio_api_all&_ts=${Date.now()}`,
      ]) {
        const dataRes = await fetch(sourceUrl, {
          cache: 'no-store',
          signal: AbortSignal.timeout(12_000),
        });
        if (!dataRes.ok) continue;
        const payload = await dataRes.json();
        if (Array.isArray(payload?.calls)) {
          livePayloads.push(payload);
          if (payload.calls.length > 0) {
            return res.json(payload);
          }
        }
      }
      if (livePayloads.length > 0) {
        return res.json(livePayloads[0]);
      }
    } catch {
      // Fall through to legacy Supabase REST query.
    }

    const rows = await supabaseRest(
      `/twilio_call_logs?select=id,twilio_call_sid,parent_call_sid,owner_email,from_number,to_number,call_started_at,call_duration,call_status,call_direction,recording_url,metadata,associate_id,lead_id,taalk_lead_id&or=(owner_email.eq.${encodeURIComponent(email)},agent_identity.ilike.*${encodeURIComponent(email)}*)&order=call_started_at.desc&limit=${limit}`,
    );

    const leadIds = new Set<string>();
    const taalkIds = new Set<string>();
    const phones = new Set<string>();
    for (const row of rows) {
      const meta = row?.metadata || {};
      const leadId = String(row?.lead_id || meta.lead_id || meta.leadId || '').trim();
      const taalkLeadId = String(row?.taalk_lead_id || meta.taalk_lead_id || meta.taalkLeadId || '').trim();
      if (leadId) leadIds.add(leadId);
      if (taalkLeadId) taalkIds.add(taalkLeadId);
      const phone = last10(meta.lead_phone || meta.leadPhone || row?.to_number);
      if (phone) phones.add(phone);
    }

    const leadByAny = new Map<string, any>();
    const leadSelect = 'id,taalk_lead_id,phone,phone_number,cnresolution,associate_id,first_name,last_name,updated_at';
    const leadClauses: string[] = [];
    if (leadIds.size) leadClauses.push(`id.in.(${Array.from(leadIds).map(encodeURIComponent).join(',')})`);
    if (taalkIds.size) leadClauses.push(`taalk_lead_id.in.(${Array.from(taalkIds).map(encodeURIComponent).join(',')})`);
    for (const p of phones) {
      leadClauses.push(`phone.eq.${encodeURIComponent(p)}`);
      leadClauses.push(`phone.eq.${encodeURIComponent(`+1${p}`)}`);
      leadClauses.push(`phone_number.eq.${encodeURIComponent(p)}`);
      leadClauses.push(`phone_number.eq.${encodeURIComponent(`+1${p}`)}`);
    }
    if (leadClauses.length) {
      const leads = await supabaseRest(
        `/masterlead?select=${leadSelect}&or=(${leadClauses.join(',')})&order=updated_at.desc&limit=500`,
      ).catch(() => []);
      for (const lead of leads) {
        if (lead?.id != null) leadByAny.set(String(lead.id), lead);
        if (lead?.taalk_lead_id != null) leadByAny.set(String(lead.taalk_lead_id), lead);
        const p1 = last10(lead?.phone);
        const p2 = last10(lead?.phone_number);
        if (p1) leadByAny.set(p1, lead);
        if (p2) leadByAny.set(p2, lead);
      }
    }

    const calls = rows.map((row) => {
      const meta = row?.metadata || {};
      const leadId = String(row?.lead_id || meta.lead_id || meta.leadId || '').trim();
      const taalkLeadIdRaw = String(row?.taalk_lead_id || meta.taalk_lead_id || meta.taalkLeadId || '').trim();
      const phoneKey = last10(meta.lead_phone || meta.leadPhone || row?.to_number);
      const lead = leadByAny.get(leadId) || leadByAny.get(taalkLeadIdRaw) || leadByAny.get(phoneKey) || null;
      const taalkLeadId = String(lead?.taalk_lead_id || taalkLeadIdRaw || '').trim();
      const localLeadId = lead?.id != null ? String(lead.id) : leadId;
      const result = String(lead?.cnresolution || meta.disposition || meta.result || row?.call_status || 'unknown').trim();
      const callId = String(row.twilio_call_sid || row.id);
      const fromNumber =
        String(
          row.from_number ||
          meta.from_number ||
          meta.from ||
          meta.From ||
          meta.caller ||
          meta.Caller ||
          ''
        ).trim();
      const toNumber =
        String(
          row.to_number ||
          meta.to_number ||
          meta.to ||
          meta.To ||
          meta.called ||
          meta.Called ||
          meta.dialed_to ||
          meta.DialCallTo ||
          meta.lead_phone ||
          meta.leadPhone ||
          lead?.phone ||
          lead?.phone_number ||
          ''
        ).trim();
      const scorecard = getScorecard(callId);
      const scoreTotal = scorecard?.scores
        ? Object.values(scorecard.scores).filter(Boolean).length
        : null;
      return {
        id: callId,
        twilio_call_sid: row.twilio_call_sid,
        parent_call_sid: row.parent_call_sid || null,
        agent_email: email,
        call_date: row.call_started_at,
        from_number: fromNumber,
        to_number: toNumber,
        duration_seconds: Number(row.call_duration || 0),
        call_status: row.call_status || '',
        call_direction: row.call_direction || '',
        recording_url: row.recording_url || '',
        taalk_lead_id: taalkLeadId || null,
        lead_id: localLeadId || null,
        associate_id: row.associate_id || lead?.associate_id || meta.associate_id || null,
        result: result || 'unknown',
        cnresolution: result || 'unknown',
        lead_name: [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || meta.lead_name || '',
        score: scoreTotal == null ? null : `${scoreTotal}/6`,
        score_total: scoreTotal,
        has_scorecard: !!scorecard,
        outcome_grade: scoreTotal == null ? 'â€”' : scoreTotal >= 5 ? 'A' : scoreTotal >= 4 ? 'B' : scoreTotal >= 3 ? 'C' : scoreTotal >= 2 ? 'D' : 'F',
        converted: ['booked', 'appointment', 'appointment_set', 'sale', 'sold', 'instant_presentation'].includes(result.toLowerCase()),
        ai_summary: '',
        flags: [],
      };
    });

    res.json({ calls, total: calls.length, polledAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('agents call-log error:', err);
    res.status(500).json({ error: err?.message || 'Failed to load call log' });
  }
});

// GET /api/agents/pending-leads — per-agent pending counts from aoirail-data team stats
router.get('/agents/pending-leads', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const raw = String(req.query?.emails || '');
    const requested = raw
      .split(',')
      .map((e) => String(e || '').toLowerCase().trim())
      .filter((e) => e.includes('@'));

    const scopedEmails = requested.filter((email) => inScope(email, viewer.scopedEmails));
    if (scopedEmails.length === 0) {
      return res.json({ pending: {}, callablePlus: {}, cap: null });
    }

    const pending: Record<string, number> = {};
    const callablePlus: Record<string, number> = {};
    for (const email of scopedEmails) pending[email] = 0;
    for (const email of scopedEmails) callablePlus[email] = 0;
    let sawPoolHealth = false;
    const reqHost = String(req.headers?.host || '').trim();
    const selfPoolHealthUrl = reqHost
      ? `${reqHost.includes('localhost') || reqHost.includes('127.0.0.1') ? 'http' : 'https'}://${reqHost}/api/reactor/pool-health`
      : null;
    const poolHealthSources = [
      ...(selfPoolHealthUrl ? [selfPoolHealthUrl] : []),
      `${AOIRAIL_DATA_URL}/api/reactor/pool-health`,
      `https://aoirail-production.up.railway.app/api/reactor/pool-health`,
    ];
    for (const url of poolHealthSources) {
      const poolHealthRes = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      }).catch(() => null);
      if (!poolHealthRes?.ok) continue;
      const payload = await poolHealthRes.json().catch(() => null);
      const agentBuffers = Array.isArray(payload?.agentBuffers) ? payload.agentBuffers : [];
      for (const row of agentBuffers) {
        const email = String(row?.agent_email || '').toLowerCase().trim();
        if (!email || pending[email] == null) continue;
        const queued = Number(row?.queued || 0);
        const active = Number(row?.active || 0);
        pending[email] = Math.max(0, queued + active);
      }
      sawPoolHealth = agentBuffers.length > 0;
      if (sawPoolHealth) break;
    }

    // Fallback if pool-health is unavailable.
    if (!sawPoolHealth) {
      const data = await fetchTeamDailyStatsLive(undefined).catch(() => null);
      const agents: any[] = Array.isArray(data?.agents) ? data.agents : [];
      for (const row of agents) {
        const email = String(row?.agent_email || '').toLowerCase().trim();
        if (!email || pending[email] == null) continue;
        pending[email] = Number((row as any)?.pendingLeads || 0);
        callablePlus[email] = Number((row as any)?.callablePlusLeads || 0);
      }
    }

    res.json({
      pending,
      callablePlus,
      cap: null,
      source: sawPoolHealth ? 'aoirail_pool_health_agent_buffers' : 'aoirail_agent_daily_stats_fallback',
      asOf: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch pending lead counts' });
  }
});

// POST /api/webrtc/presence â€” webhook from AOIrail WebRTC client
router.post('/webrtc/presence', (req, res) => {
  const { identity, status, callDirection, market, states, name, leadName, leadPhone, leadState, leadId } = req.body || {};
  if (!identity || !status) {
    return res.status(400).json({ error: 'identity and status are required' });
  }
  const validStatuses = ['available', 'on_call', 'offline', 'dialing', 'ringing'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }
  appState.updateWebhookPresence(identity, { status, callDirection, market, states, name, leadName, leadPhone, leadState, leadId });
  res.json({ success: true, identity, status });
});

// â”€â”€ Campaigns â”€â”€

// GET /api/campaigns â€” all campaigns (from last poll)
router.get('/campaigns', async (req, res) => {
  const viewer = await getViewerContext(req);
  if (!viewer.isSysop) return res.status(403).json({ error: 'Campaigns are restricted to cnsysop' });
  res.json({
    campaigns: appState.campaigns,
    stats: appState.stats,
    polledAt: appState.lastCampaignPoll,
  });
});

// POST /api/campaigns/:id/rate â€” update dial rate
router.post('/campaigns/:id/rate', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Campaign controls are restricted to cnsysop' });
    const { id } = req.params;
    const { limitPerHour } = req.body;
    if (typeof limitPerHour !== 'number' || limitPerHour < 0) {
      return res.status(400).json({ error: 'limitPerHour must be a non-negative number' });
    }
    await taalk.updateCampaignRate(id, limitPerHour);
    // Refresh campaigns
    setTimeout(() => appState.pollCampaigns(), 1500);
    res.json({ success: true, id, limitPerHour });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/pause
router.post('/campaigns/:id/pause', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Campaign controls are restricted to cnsysop' });
    await taalk.pauseCampaign(req.params.id);
    setTimeout(() => appState.pollCampaigns(), 1500);
    res.json({ success: true, action: 'paused' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/resume
router.post('/campaigns/:id/resume', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Campaign controls are restricted to cnsysop' });
    await taalk.resumeCampaign(req.params.id);
    setTimeout(() => appState.pollCampaigns(), 1500);
    res.json({ success: true, action: 'resumed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/bulk/pause â€” pause all running campaigns
router.post('/campaigns/bulk/pause', async (_req, res) => {
  try {
    const viewer = await getViewerContext(_req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Campaign controls are restricted to cnsysop' });
    const running = appState.campaigns.filter(c => c.status === 'running');
    let paused = 0;
    for (const c of running) {
      try {
        await taalk.pauseCampaign(c._id);
        paused++;
        // Rate limit: 500ms between calls
        await new Promise(r => setTimeout(r, 500));
      } catch { /* continue */ }
    }
    setTimeout(() => appState.pollCampaigns(), 2000);
    res.json({ success: true, paused, total: running.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/bulk/resume â€” resume all stopped campaigns
router.post('/campaigns/bulk/resume', async (_req, res) => {
  try {
    const viewer = await getViewerContext(_req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Campaign controls are restricted to cnsysop' });
    const stopped = appState.campaigns.filter(c => c.status === 'stopped');
    let resumed = 0;
    for (const c of stopped) {
      try {
        await taalk.resumeCampaign(c._id);
        resumed++;
        await new Promise(r => setTimeout(r, 500));
      } catch { /* continue */ }
    }
    setTimeout(() => appState.pollCampaigns(), 2000);
    res.json({ success: true, resumed, total: stopped.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Auto-Management â”€â”€

// GET /api/auto/log â€” activity log
router.get('/auto/log', (_req, res) => {
  res.json({ log: appState.autoManager.getActionLog() });
});

// POST /api/auto/toggle â€” enable/disable auto-management
router.post('/auto/toggle', (req, res) => {
  const { enabled } = req.body;
  appState.autoManager.enabled = !!enabled;
  appState.stats.autoManagementEnabled = appState.autoManager.enabled;
  res.json({ enabled: appState.autoManager.enabled });
});

// POST /api/auto/override/:agentId â€” toggle manual override for an agent
router.post('/auto/override/:agentId', (req, res) => {
  const agentId = parseInt(req.params.agentId, 10);
  const { override } = req.body;
  appState.autoManager.setOverride(agentId, !!override);
  res.json({ agentId, override: !!override });
});

// GET /api/auto/overrides â€” list all overrides
router.get('/auto/overrides', (_req, res) => {
  const memory = appState.autoManager.getStateMemory();
  const overrides: number[] = [];
  for (const [id] of memory) {
    if (appState.autoManager.isOverridden(id)) overrides.push(id);
  }
  res.json({ overrides });
});

// â”€â”€ Activity & Accountability â”€â”€

// GET /api/agents/activity-summary â€” per-agent call stats today
router.get('/agents/activity-summary', (_req, res) => {
  res.json({ agents: appState.getActivitySummary() });
});

// GET /api/calls/active â€” all agents currently on a Taalk transfer
router.get('/calls/active', (_req, res) => {
  res.json({ activeCalls: appState.getActiveCalls() });
});

// GET /api/campaigns/dialing-now â€” campaigns actively dialing
router.get('/campaigns/dialing-now', (_req, res) => {
  res.json({ dialingCampaigns: appState.getDialingCampaigns() });
});

// GET /api/queue-positions â€” priority queue
router.get('/queue-positions', (_req, res) => {
  res.json({ positions: appState.getQueuePositions() });
});

// â”€â”€ Agent Health â”€â”€

// POST /api/agent-health â€” receive health report from an agent
router.post('/agent-health', (req, res) => {
  const report = req.body as AgentHealthReport;
  if (!report.email) {
    return res.status(400).json({ error: 'email is required' });
  }
  // Ensure timestamp
  if (!report.timestamp) report.timestamp = new Date().toISOString();
  appState.setAgentHealth(report);
  res.json({ success: true, email: report.email });
});

// GET /api/agent-health â€” all agent health reports
router.get('/agent-health', (_req, res) => {
  res.json({ reports: appState.getAllAgentHealth() });
});

// GET /api/agent-health/:email â€” health report for a specific agent
router.get('/agent-health/:email', (req, res) => {
  const report = appState.getAgentHealth(req.params.email);
  if (!report) return res.status(404).json({ error: 'No health report found' });
  res.json(report);
});

// POST /api/hppro/presentation-events â€” receive HPPro presentation lifecycle events from AOIrail
router.post('/hppro/presentation-events', (req, res) => {
  const body = req.body || {};
  const presentationGuid = String(body.presentation_guid || '').trim();
  const eventType = String(body.event_type || '').trim().toLowerCase();
  if (!presentationGuid || !eventType) {
    return res.status(400).json({ error: 'presentation_guid and event_type are required' });
  }
  const row = {
    ...body,
    received_at: new Date().toISOString(),
  };
  hpproPresentationEvents.unshift(row);
  if (hpproPresentationEvents.length > 500) hpproPresentationEvents.length = 500;
  console.log(`[HPPRO_EVENT] ${eventType} guid=${presentationGuid} agent=${body.agent_email || body.agent_number || 'unknown'}`);
  res.json({ success: true });
});

// GET /api/hppro/presentation-events â€” latest HPPro lifecycle events
router.get('/hppro/presentation-events', (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 500);
  res.json({ events: hpproPresentationEvents.slice(0, limit) });
});

// POST /api/agent-command â€” send a command to a specific agent
router.post('/agent-command', (req, res) => {
  const { email, command } = req.body as { email: string; command: AgentCommandType };
  if (!email || !command) {
    return res.status(400).json({ error: 'email and command are required' });
  }
  const validCommands: AgentCommandType[] = ['force_refresh', 're_register', 'test_audio', 'clear_state', 'screen_share'];
  if (!validCommands.includes(command)) {
    return res.status(400).json({ error: `Invalid command. Must be one of: ${validCommands.join(', ')}` });
  }
  const cmd: AgentCommand = { email, command, issuedAt: new Date().toISOString() };
  appState.pushAgentCommand(cmd);
  res.json({ success: true, command: cmd });
});

// GET /api/agent-command/:email â€” agent polls for pending commands
router.get('/agent-command/:email', (req, res) => {
  const commands = appState.popAgentCommands(req.params.email);
  res.json({ commands: commands.map((c: any) => typeof c === 'string' ? c : c.command) });
});

// â”€â”€ VDP Force Online/Offline â”€â”€
import { vdpHeartbeat } from './vdp-heartbeat.js';

// POST /api/vdp/force-online â€” force an agent online via heartbeat
router.post('/vdp/force-online', async (req, res) => {
  const { agentId, states, market, first_name, last_name } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  const result = await vdpHeartbeat.forceOnline(String(agentId), {
    states: states || [],
    market: market || '',
    first_name: first_name || '',
    last_name: last_name || '',
  });
  res.json(result);
});

// POST /api/vdp/force-offline â€” stop heartbeating
router.post('/vdp/force-offline', (req, res) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  const stopped = vdpHeartbeat.forceOffline(String(agentId));
  res.json({ success: stopped });
});

// GET /api/vdp/managed â€” list all managed agents
router.get('/vdp/managed', (_req, res) => {
  res.json({ agents: vdpHeartbeat.getStatus() });
});

// â”€â”€ Support Tickets (Supabase persisted) â”€â”€
import { syncTwilioMessages, getTickets, sendReply as sendTicketReply, updateTicket, backfillCallerNames, autoCategorizeTickets, runCsBotOnAll, getCsBotEnabled, setCsBotEnabled } from './support-tickets.js';
// Backfill caller names for existing tickets in background
backfillCallerNames().catch(() => {});

// GET /api/support/tickets â€” all active tickets with messages
router.get('/support/tickets', async (_req, res) => {
  try {
    const tickets = await getTickets();
    res.json({ tickets, polledAt: Date.now() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/support/reply â€” send SMS reply
router.post('/support/reply', async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) return res.status(400).json({ error: 'to and body required' });
  const ok = await sendTicketReply(to, body);
  res.json({ success: ok });
});

// POST /api/support/refresh â€” sync Twilio â†’ DB
router.post('/support/refresh', async (_req, res) => {
  await syncTwilioMessages();
  const tickets = await getTickets();
  res.json({ tickets, polledAt: Date.now() });
});

// POST /api/support/webhook/incoming â€” Twilio SMS webhook (real-time)
router.post('/support/webhook/incoming', async (req, res) => {
  try {
    const { From, Body, MessageSid, NumMedia } = req.body;
    if (!From || !MessageSid) return res.type('text/xml').send('<Response></Response>');

    // Import and store immediately
    const { syncIncomingMessage } = await import('./support-tickets.js');
    await syncIncomingMessage(From, MessageSid, Body || '', parseInt(NumMedia || '0') > 0);

    console.log(`[Support] Incoming SMS from ${From}: ${(Body || '').slice(0, 50)}`);

    // Return empty TwiML (no auto-reply for now)
    res.type('text/xml').send('<Response></Response>');
  } catch (err) {
    console.error('[Support webhook error]', err);
    res.type('text/xml').send('<Response></Response>');
  }
});

// POST /api/support/create â€” create ticket from web form or API
router.post('/support/create', async (req, res) => {
  const { phone, email, name, message, category } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const { createTicketFromForm } = await import('./support-tickets.js');
    const ticket = await createTicketFromForm(phone || '', email || '', name || '', message, category || 'other');
    res.json({ success: true, ticketId: ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/support/media/:messageSid â€” proxy Twilio MMS media (first attachment)
router.get('/support/media/:messageSid', async (req, res) => {
  try {
    const { messageSid } = req.params;
    const auth = 'Basic ' + Buffer.from('AC25d37aa41aed0df4fddd81ecf7abf00d:b275d646252457344ff62528e3538ea9').toString('base64');
    // Get media list
    const listRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/AC25d37aa41aed0df4fddd81ecf7abf00d/Messages/${messageSid}/Media.json`, { headers: { Authorization: auth } });
    if (!listRes.ok) return res.status(404).send('No media');
    const list: any = await listRes.json();
    const media = list.media_list?.[0];
    if (!media) return res.status(404).send('No media');
    // Fetch actual media â€” manual redirect handling to avoid sending auth to S3
    const mediaUrl = 'https://api.twilio.com' + media.uri.replace('.json', '');
    const mediaRes = await fetch(mediaUrl, { headers: { Authorization: auth }, redirect: 'manual' });
    let finalRes: Response;
    if (mediaRes.status === 301 || mediaRes.status === 302 || mediaRes.status === 303 || mediaRes.status === 307 || mediaRes.status === 308) {
      const location = mediaRes.headers.get('location');
      if (!location) return res.status(502).send('Bad redirect');
      finalRes = await fetch(location); // no auth header â€” S3 presigned URL
    } else {
      finalRes = mediaRes;
    }
    if (!finalRes.ok) return res.status(finalRes.status).send('Media fetch failed');
    res.setHeader('Content-Type', media.content_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await finalRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    res.status(500).send('Error');
  }
});

// PATCH /api/support/tickets/:id â€” update ticket metadata
router.patch('/support/tickets/:id', async (req, res) => {
  const ok = await updateTicket(req.params.id, req.body);
  res.json({ success: ok });
});

// POST /api/support/auto-categorize â€” auto-close thanks + categorize all open tickets
router.post('/support/auto-categorize', async (_req, res) => {
  try {
    const result = await autoCategorizeTickets();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/support/bot-status â€” CS bot enabled/disabled
router.get('/support/bot-status', (_req, res) => {
  res.json({ enabled: getCsBotEnabled() });
});

// POST /api/support/bot-toggle â€” enable or disable CS bot
router.post('/support/bot-toggle', (req, res) => {
  const { enabled } = req.body;
  setCsBotEnabled(!!enabled);
  res.json({ enabled: getCsBotEnabled() });
});

// POST /api/support/bot-run â€” run CS bot on all open tickets now
router.post('/support/bot-run', async (_req, res) => {
  try {
    const result = await runCsBotOnAll();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Auto VDP Management â”€â”€
import { autoVDPManager } from './auto-vdp-manager.js';

// GET /api/vdp/auto-status â€” current auto-managed agents
router.get('/vdp/auto-status', (_req, res) => {
  res.json({ agents: autoVDPManager.getStatus(), enabled: autoVDPManager.enabled });
});

// POST /api/vdp/auto-toggle â€” enable/disable auto VDP management
router.post('/vdp/auto-toggle', (req, res) => {
  const { enabled } = req.body;
  autoVDPManager.enabled = !!enabled;
  if (!enabled) autoVDPManager.stopAll();
  res.json({ enabled: autoVDPManager.enabled });
});

// â”€â”€ Bulk upload submitted applications to Supabase â”€â”€
router.post('/submitted-apps/upload', async (req, res) => {
  const rows = req.body.rows;
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'rows array required' });
  try {
    const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
    const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
    const supaRes = await fetch(`${SUPA_URL}/rest/v1/submitted_applications`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });
    res.json({ success: supaRes.ok, count: rows.length, status: supaRes.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Incoming Transfer Queue (real-time from Taalk webhook) â”€â”€
type TransferStage = 'ai_qualifying' | 'queued' | 'ringing' | 'no_agent';
const incomingTransfers = new Map<string, { leadId: string; firstName: string; lastName: string; market: string; phone: string; state: string; agents: string[]; agentBlasts: Record<string, number>; currentRound: string[]; stage: TransferStage; blasted: boolean; time: number; pickedUp: boolean; answered: boolean }>();
(globalThis as any).__incomingTransfers = incomingTransfers; // shared with poller in state.ts

// Rolling log of last 100 raw webhook payloads â€” for debugging stuck AI Qualifying
const webhookEventLog: { ts: string; event: string; leadId: string; blasted: boolean; raw: any }[] = [];
const MAX_WEBHOOK_LOG = 100;

router.get('/transfers/webhook-log', (_req, res) => {
  res.json(webhookEventLog.slice().reverse());
});

// POST /api/transfers/incoming â€” receives raw Taalk webhook data (any format)
router.post('/transfers/incoming', (req, res) => {
  try {
    const d = req.body || {};

    // Parse Params if it's a JSON string (Zapier format)
    let params: any = {};
    try {
      const rawParams = d.Params || d.params || '';
      if (typeof rawParams === 'string' && rawParams.startsWith('{')) {
        params = JSON.parse(rawParams);
      } else if (typeof rawParams === 'object') {
        params = rawParams;
      }
    } catch { /* ignore parse errors */ }

    // Also check nested task.params (VDP system format)
    const taskParams = d.task?.params || {};

    // Extract fields from all possible locations
    const event = d.Event || d.event || d.EVENT || d.type || '';
    const agent = d.Agent || d.agent || d.AgentId || d.agent_id || d.Blastered || d.blastered ||
      d.AsscociateId || d.AssociateId || d.associateId || d.associate_id ||  // AO Recruit webhook typo + variants
      d.persona ||                                                              // AO Recruit sends agent as "persona"
      params.Agent || params.agent || params.AgentId || params.agent_id || params['Agent Id'] || params.Blastered || params.AssociateId || params.associate_id || params.AsscociateId ||
      taskParams.Agent || taskParams.agent || taskParams.AgentId || taskParams.agent_id || taskParams.AssociateId ||
      (typeof d.agent === 'object' ? d.agent?.id : '') || '';
    const leadId = params.Leadid || params.LeadId || params.leadid || taskParams.Leadid || d.Leadid || d.LeadId || d.leadId || d.lead_id || d.leadid || d.Taalk_Session || d['Taalk_Session'] || '';
    const firstName = params['First Name'] || params.firstName || params.first_name || taskParams['First Name'] || d['First Name'] || d.firstName || d.first_name || d.FirstName || '';
    const lastName = params['Last Name'] || params.lastName || params.last_name || taskParams['Last Name'] || d['Last Name'] || d.lastName || d.last_name || d.LastName || '';
    const market = normalizeMarket(params.Market || params.market || taskParams.Market || d.Market || d.market || '');
    const phone = params.Phone || params.phone || taskParams.Phone || d.Phone || d.phone || '';
    const state = params.State || params.state || taskParams.State || d.State || d.state || '';

    // Helper: resolve agent ID to a display name
    const resolveAgentName = (aid: string): string => {
      const sid = String(aid).trim();
      // 1. Check online merged agents (Taalk id, _id, associateId, or email prefix)
      const matched = appState.mergedAgents.find(a =>
        String(a.id) === sid || a._id === sid ||
        String((a as any).associateId) === sid ||
        a.email?.split('@')[0].toLowerCase() === sid.toLowerCase()
      );
      if (matched) return matched.fullName || matched.email.split('@')[0];
      // 2. Check full roster (offline agents too)
      const rosterMatch = appState.allAgents.find((a: any) =>
        String(a.id) === sid || a._id === sid || String(a.params?.associate_id) === sid
      );
      if (rosterMatch) return rosterMatch.fullName || sid;
      // 3. Fall back to associateId â†’ agent_name from customers table (most reliable)
      const agentName = appState.associateIdToName?.get(sid);
      if (agentName) return agentName;
      // 4. Last resort: parse email prefix
      const email = appState.associateIdToEmail?.get(sid);
      if (email) {
        const parts = email.split('@')[0].split(/[._]/);
        return parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
      }
      return '';
    };

    // Store raw payload for debugging
    const resolvedName = agent ? resolveAgentName(String(agent)) : '';
    console.log(`[Transfer] ${event} agent=${agent} (resolved: "${resolvedName}") lead=${leadId} ${firstName} ${lastName} (${market}) | keys: ${Object.keys(d).join(',')}`);
    if (!resolvedName && agent) {
      console.log(`[Transfer] Agent ID "${agent}" not found in mergedAgents(${appState.mergedAgents.length}) or allAgents(${appState.allAgents.length})`);
    }

    // Skip if we couldn't extract a real leadId
    if (!leadId) {
      res.json({ ok: true, skipped: 'no leadId found', keys: Object.keys(d) });
      return;
    }

    const lid = String(leadId);
    const eventUpper = String(event).toUpperCase();

    // Determine stage from event
    const stageFromEvent = (ev: string): TransferStage | null => {
      if (ev.includes('NO_AGENT') || ev.includes('NOAGENT')) return 'no_agent';
      if (ev.includes('BLAST') || ev.includes('RING') || ev.includes('TRANSFER')) return 'ringing';
      if (ev.includes('DISTRIBUTE') || ev.includes('ASSIGN')) return 'queued';
      if (ev.includes('ROUTE') || ev === 'NEW' || ev === '' || ev.includes('AI_QUAL') || ev === 'AI_QUALIFYING') return 'ai_qualifying';
      return null;
    };

    // Log every raw event for debugging
    const isBlastEvent = eventUpper.includes('BLAST') || eventUpper.includes('ASSIGN') || eventUpper.includes('RING') || eventUpper.includes('TRANSFER') || eventUpper.includes('ROUTE') || eventUpper.includes('DISTRIBUTE');
    webhookEventLog.push({ ts: new Date().toISOString(), event: String(event), leadId: lid, blasted: isBlastEvent, raw: d });
    if (webhookEventLog.length > MAX_WEBHOOK_LOG) webhookEventLog.splice(0, webhookEventLog.length - MAX_WEBHOOK_LOG);

    // Helper: record a blast event for an agent (tracks how many times they've been blasted)
    const addBlastAgent = (entry: { agents: string[]; agentBlasts: Record<string, number> }, aid: string) => {
      if (!aid) return;
      const name = resolveAgentName(aid) || `Agent ${aid}`;
      if (!entry.agents.includes(aid)) entry.agents.push(aid);
      entry.agentBlasts[name] = (entry.agentBlasts[name] ?? 0) + 1;
    };

    if (eventUpper.includes('MISS') || eventUpper.includes('TIMEOUT') || eventUpper.includes('NO_ANSWER') || eventUpper.includes('NOANSWER')) {
      // MISSED â€” call died, nobody answered.
      const existing = incomingTransfers.get(lid);
      if (existing) existing.pickedUp = true; // remove from pending

      // Use pre-stored agentBlasts (name â†’ count); fall back to resolving IDs
      let missedBy: string[] = existing ? Object.keys(existing.agentBlasts) : [];
      if (missedBy.length === 0 && existing?.agents?.length) {
        missedBy = existing.agents.map(aid => resolveAgentName(aid) || `Agent ${aid}`).filter(Boolean);
      }

      appState.recordMissedTransfer({
        leadName: `${firstName} ${lastName}`.trim() || 'Unknown',
        leadState: state || '',
        leadType: params.Type || taskParams.Type || '',
        market: market || '',
        phone: phone || '',
        missedBy,
        missedAt: new Date().toISOString(),
      });

      console.log(`[Transfer] MISSED: ${firstName} ${lastName} (${market}) â€” missed by: ${missedBy.join(', ') || 'unknown'}`);
    } else if (eventUpper.includes('NO_AGENT') || eventUpper.includes('NOAGENT')) {
      // NO_AGENT â€” call arrived but zero agents were online. Call will die. Show prominently.
      const existing = incomingTransfers.get(lid);
      if (existing) {
        existing.stage = 'no_agent';
        existing.blasted = false;
        if (!existing.firstName && firstName) existing.firstName = firstName;
        if (!existing.market && market) existing.market = market;
      } else {
        incomingTransfers.set(lid, { leadId: lid, firstName, lastName, market, phone, state, agents: [] as string[], agentBlasts: {} as Record<string, number>, currentRound: [] as string[], stage: 'no_agent', blasted: false, time: Date.now(), pickedUp: false, answered: false });
      }
      console.log(`[Transfer] NO_AGENT: ${firstName} ${lastName} (${market}) â€” nobody was online to take this call`);
    } else if (eventUpper.includes('BLAST') || eventUpper.includes('RING') || eventUpper.includes('TRANSFER')) {
      // RINGING â€” blast fired, agents' phones are ringing
      const rawBlastered = d.Blastered ?? d.blastered ?? params.Blastered ?? null;
      const blastAgentIds: string[] = rawBlastered !== null
        ? (Array.isArray(rawBlastered)
            ? rawBlastered.map(String)
            : String(rawBlastered).split(',').map(s => s.trim()).filter(Boolean))
        : (agent ? String(agent).split(',').map(s => s.trim()).filter(Boolean) : []);

      const existing = incomingTransfers.get(lid);
      // Resolve names for this blast round
      const roundNames = blastAgentIds.map(aid => resolveAgentName(aid) || `Agent ${aid}`).filter(Boolean);
      if (existing) {
        existing.stage = 'ringing';
        existing.blasted = true;
        existing.currentRound = roundNames; // replace with ONLY this round's agents
        for (const aid of blastAgentIds) addBlastAgent(existing, aid);
        if (!existing.firstName && firstName) existing.firstName = firstName;
        if (!existing.lastName && lastName) existing.lastName = lastName;
        if (!existing.market && market) existing.market = market;
      } else {
        const entry = { leadId: lid, firstName, lastName, market, phone, state, agents: [] as string[], agentBlasts: {} as Record<string, number>, currentRound: roundNames, stage: 'ringing' as TransferStage, blasted: true, time: Date.now(), pickedUp: false, answered: false };
        for (const aid of blastAgentIds) addBlastAgent(entry, aid);
        incomingTransfers.set(lid, entry);
      }
    } else if (eventUpper.includes('DISTRIBUTE') || eventUpper.includes('ASSIGN')) {
      // QUEUED â€” AI finished qualifying, lead is now in queue waiting for blast
      const existing = incomingTransfers.get(lid);
      if (existing) {
        if (existing.stage === 'new' || existing.stage === 'ai_qualifying') existing.stage = 'queued';
        if (agent) addBlastAgent(existing, String(agent));
        if (!existing.firstName && firstName) existing.firstName = firstName;
        if (!existing.market && market) existing.market = market;
      } else {
        const entry = { leadId: lid, firstName, lastName, market, phone, state, agents: [] as string[], agentBlasts: {} as Record<string, number>, currentRound: [] as string[], stage: 'queued' as TransferStage, blasted: false, time: Date.now(), pickedUp: false, answered: false };
        if (agent) addBlastAgent(entry, String(agent));
        incomingTransfers.set(lid, entry);
      }
    } else if (eventUpper.includes('ROUTE')) {
      // AI QUALIFYING â€” lead is being routed/qualified by AI agent
      const existing = incomingTransfers.get(lid);
      if (existing) {
        if (existing.stage === 'new') existing.stage = 'ai_qualifying';
        if (!existing.firstName && firstName) existing.firstName = firstName;
        if (!existing.market && market) existing.market = market;
      } else {
        incomingTransfers.set(lid, { leadId: lid, firstName, lastName, market, phone, state, agents: [] as string[], agentBlasts: {} as Record<string, number>, currentRound: [] as string[], stage: 'ai_qualifying', blasted: false, time: Date.now(), pickedUp: false, answered: false });
      }
    } else if (eventUpper.includes('PICK') || eventUpper.includes('ANSWER') || (eventUpper.includes('CONNECT') && !eventUpper.includes('DISCONNECT'))) {
      const existing = incomingTransfers.get(lid);
      if (existing) { existing.pickedUp = true; existing.answered = true; }
    } else if (eventUpper.includes('END') || eventUpper.includes('HANG') || eventUpper.includes('COMPLETE') || eventUpper.includes('DISCONNECT')) {
      const existing = incomingTransfers.get(lid);
      if (existing) { existing.pickedUp = true; }
    } else {
      // Unknown event â€” treat as AI Qualifying (initial call entry)
      const existing = incomingTransfers.get(lid);
      if (existing) {
        if (agent) addBlastAgent(existing, String(agent));
      } else if (lid) {
        const entry = { leadId: lid, firstName, lastName, market, phone, state, agents: [] as string[], agentBlasts: {} as Record<string, number>, currentRound: [] as string[], stage: 'ai_qualifying' as TransferStage, blasted: false, time: Date.now(), pickedUp: false, answered: false };
        if (agent) addBlastAgent(entry, String(agent));
        incomingTransfers.set(lid, entry);
      }
    }

    // Prune old entries (>5 min normal, >15 min for no_agent) and junk entries
    // AO Recruit entries only send one webhook (AI_QUALIFYING) with no follow-up events â€”
    // auto-expire them after 90 seconds so they don't stick forever in ai_qualifying.
    const cutoff = Date.now() - 5 * 60 * 1000;
    const noAgentCutoff = Date.now() - 15 * 60 * 1000;
    const recruitCutoff = Date.now() - 90 * 1000; // 90s TTL for recruit single-event entries
    for (const [k, v] of incomingTransfers) {
      // Recruit entries: keyed by UUID (Taalk_Session), market is AO Recruit, stage stuck at ai_qualifying
      const isRecruitEntry = v.market?.toLowerCase().includes('recruit') && v.stage === 'ai_qualifying';
      if (isRecruitEntry && v.time < recruitCutoff) { incomingTransfers.delete(k); continue; }
      const expired = v.stage === 'no_agent' ? v.time < noAgentCutoff : v.time < cutoff;
      if (expired) incomingTransfers.delete(k);
      if (k.startsWith('unknown-')) incomingTransfers.delete(k);
      // Don't prune entries that just arrived (< 30s) â€” they may not have name/agent yet
      const isNew = Date.now() - v.time < 30_000;
      if (!isNew && !v.firstName && !v.lastName && v.agents.length === 0 && v.stage !== 'no_agent') incomingTransfers.delete(k);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Transfer webhook error]', err);
    res.json({ ok: true }); // Always 200 so Zapier doesn't retry
  }
});

// GET /api/transfers/incoming â€” pending transfers for dashboard
router.get('/transfers/incoming', (_req, res) => {
  const pending = [...incomingTransfers.values()].filter(t => !t.pickedUp).sort((a, b) => b.time - a.time)
    .map(t => ({ ...t, agentBlasts: t.agentBlasts ?? {}, stage: t.stage ?? 'new', blasted: t.stage === 'ringing' }));
  const picked = [...incomingTransfers.values()].filter(t => t.pickedUp && t.answered).sort((a, b) => b.time - a.time);

  // Build per-agent miss stats from current window
  const agentMisses: Record<string, number> = {};
  const agentRings: Record<string, number> = {};
  for (const t of incomingTransfers.values()) {
    for (const a of t.agents) {
      agentRings[a] = (agentRings[a] || 0) + 1;
      if (!t.pickedUp) agentMisses[a] = (agentMisses[a] || 0) + 1;
    }
  }

  res.json({ pending, picked, total: incomingTransfers.size, agentMisses, agentRings, missedTransfers: appState.getMissedTransfers() });
});

// â”€â”€ Fallback Agent Blast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// When Taalk has no agent it forwards the lead call to our Twilio number.
// We put the lead in a conference and blast every eligible agent's cell phone
// simultaneously. First to press 1 gets connected; everyone else is hung up.
//
// Setup required in Taalk: set fallback/no-agent transfer number to +19142289324
// and set that number's Voice webhook in Twilio to:
//   ${BLAST_CAMPAIGN_URL}/api/fallback-blast/lead-call

const BLAST_ACCOUNT_SID  = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const BLAST_AUTH_TOKEN   = 'b275d646252457344ff62528e3538ea9';
const BLAST_FROM_NUMBER  = '+19142289324';
const BLAST_CAMPAIGN_URL = String(process.env.BLAST_CAMPAIGN_URL || '').trim();
const BLAST_SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const BLAST_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc';

interface ActiveBlast {
  confName: string;
  leadPhone: string;
  leadName: string;
  leadState: string;
  leadMarket: string;
  agentSids: string[];
  connectedAgent: string | null;
}
const activeBlasts = new Map<string, ActiveBlast>();

function twilioBasicAuth() {
  return 'Basic ' + Buffer.from(`${BLAST_ACCOUNT_SID}:${BLAST_AUTH_TOKEN}`).toString('base64');
}

async function fetchEligibleAgents(): Promise<{ email: string; phone: string }[]> {
  const [profiles, credits] = await Promise.all([
    fetch(`${BLAST_SUPABASE_URL}/rest/v1/agent_profiles?select=email,phone&phone=neq.&is_active=eq.true`, {
      headers: { apikey: BLAST_SUPABASE_KEY, Authorization: `Bearer ${BLAST_SUPABASE_KEY}` },
    }).then(r => r.json()),
    fetch(`${BLAST_SUPABASE_URL}/rest/v1/user_credits?select=email,credits_remaining&credits_remaining=gt.0`, {
      headers: { apikey: BLAST_SUPABASE_KEY, Authorization: `Bearer ${BLAST_SUPABASE_KEY}` },
    }).then(r => r.json()),
  ]);
  const creditSet = new Set((credits as any[]).map((c: any) => c.email.toLowerCase()));
  return (profiles as any[]).filter((p: any) =>
    p.phone && p.phone.replace(/\D/g, '').length >= 10 && creditSet.has(p.email.toLowerCase())
  );
}

async function cancelCall(sid: string) {
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${BLAST_ACCOUNT_SID}/Calls/${sid}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: twilioBasicAuth() },
    body: 'Status=completed',
  }).catch(() => {});
}

// 1. Lead call arrives from Taalk â†’ put in conference, blast all agents
router.post('/fallback-blast/lead-call', (req, res) => {
  const callSid  = req.body.CallSid as string;
  const fromPhone = (req.body.From as string || '').replace(/\D/g, '');
  const confName  = `blast-${callSid}`;

  const lead = [...incomingTransfers.values()].find(t =>
    t.phone?.replace(/\D/g, '') === fromPhone
  );

  const blast: ActiveBlast = {
    confName,
    leadPhone: req.body.From || fromPhone,
    leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() : 'a client',
    leadState: lead?.state || '',
    leadMarket: lead?.market || '',
    agentSids: [],
    connectedAgent: null,
  };
  activeBlasts.set(confName, blast);

  // Mark in transfer map
  if (lead) { lead.stage = 'no_agent'; }

  // Fire blast async
  (async () => {
    try {
      const agents = await fetchEligibleAgents();
      console.log(`[FallbackBlast] Blasting ${agents.length} agents for conf ${confName}`);
      await Promise.all(agents.map(async (agent) => {
        const phone = `+1${agent.phone.replace(/\D/g, '').slice(-10)}`;
        const qs = new URLSearchParams({
          conf: confName,
          leadName: blast.leadName,
          leadState: blast.leadState,
          leadMarket: blast.leadMarket,
          agentEmail: agent.email,
          agentPhone: agent.phone.replace(/\D/g, '').slice(-10),
        });
        const callRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${BLAST_ACCOUNT_SID}/Calls.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: twilioBasicAuth() },
          body: new URLSearchParams({
            To: phone,
            From: BLAST_FROM_NUMBER,
            Url: `${BLAST_CAMPAIGN_URL}/api/fallback-blast/agent-answer?${qs}`,
            StatusCallback: `${BLAST_CAMPAIGN_URL}/api/fallback-blast/agent-status`,
            Timeout: '25',
          }).toString(),
        }).then(r => r.json()).catch(() => null);
        if (callRes?.sid) blast.agentSids.push(callRes.sid);
      }));
    } catch (e) {
      console.error('[FallbackBlast] blast error', e);
    }
  })();

  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold, we are connecting you with an agent now.</Say>
  <Dial>
    <Conference waitUrl="https://twimlets.com/holdmusic?Bucket=com.twilio.music.classical"
                waitMethod="GET"
                beep="false"
                endConferenceOnExit="true">${confName}</Conference>
  </Dial>
</Response>`);
});

// 2. Agent's phone rings â€” play lead info, ask for keypress
router.post('/fallback-blast/agent-answer', (req, res) => {
  const { conf, leadName, leadState, leadMarket, agentEmail, agentPhone } = req.query as Record<string, string>;
  const safeConf     = encodeURIComponent(conf || '');
  const safeEmail    = encodeURIComponent(agentEmail || '');
  const safePhone    = encodeURIComponent(agentPhone || '');
  const stateStr     = leadState ? ` from ${leadState}` : '';
  const marketStr    = leadMarket ? `, ${leadMarket} market` : '';

  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/api/fallback-blast/agent-keypress?conf=${safeConf}&amp;agentEmail=${safeEmail}&amp;agentPhone=${safePhone}" method="POST" timeout="12">
    <Say voice="alice">Live transfer. ${leadName}${stateStr}${marketStr}. Press 1 to connect now, or hang up to pass.</Say>
    <Say voice="alice">Press 1 to connect.</Say>
  </Gather>
  <Hangup/>
</Response>`);
});

// 3. Agent presses a key
router.post('/fallback-blast/agent-keypress', async (req, res) => {
  const { conf, agentEmail, agentPhone } = req.query as Record<string, string>;
  const digit        = req.body.Digits as string;
  const agentCallSid = req.body.CallSid as string;
  const blast        = activeBlasts.get(conf);

  if (digit !== '1' || !blast || blast.connectedAgent) {
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="alice">Call already taken. Goodbye.</Say><Hangup/></Response>`);
    return;
  }

  // Claim the call
  blast.connectedAgent = agentEmail;
  console.log(`[FallbackBlast] ${agentEmail} claimed conf ${conf}`);

  // Cancel all other agent calls async
  const othersids = blast.agentSids.filter(s => s !== agentCallSid);
  Promise.all(othersids.map(cancelCall)).catch(() => {});

  // SMS agent with lead details
  const smsBody = `LIVE TRANSFER\nLead: ${blast.leadName}\nState: ${blast.leadState}\nMarket: ${blast.leadMarket}\nPhone: ${blast.leadPhone}\nGood luck!`;
  fetch(`https://api.twilio.com/2010-04-01/Accounts/${BLAST_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: twilioBasicAuth() },
    body: new URLSearchParams({ To: `+1${agentPhone.replace(/\D/g, '').slice(-10)}`, From: BLAST_FROM_NUMBER, Body: smsBody }).toString(),
  }).catch(() => {});

  // Join conference
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now. Good luck!</Say>
  <Dial>
    <Conference beep="false" endConferenceOnExit="true">${conf}</Conference>
  </Dial>
</Response>`);
});

// 4. Agent call status callback â€” cleanup when blast finishes
router.post('/fallback-blast/agent-status', (req, res) => {
  res.sendStatus(204);
});

// â”€â”€ Starred Agents (max rank override) â”€â”€
router.post('/agents/star', (req, res) => {
  const { agentId, starred } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  if (starred) {
    appState.starredAgents.add(String(agentId));
  } else {
    appState.starredAgents.delete(String(agentId));
  }
  res.json({ success: true, starred: appState.starredAgents.has(String(agentId)) });
});

router.get('/agents/starred', (_req, res) => {
  res.json({ starred: [...appState.starredAgents] });
});

// â”€â”€ Credits â”€â”€
router.get('/credits', (_req, res) => {
  // Build credits map keyed by email AND by associate_id (for Taalk agents)
  const credits: Record<string, number> = {};
  for (const [email, amount] of appState.agentCredits) {
    credits[email] = amount;
  }
  // Also key by associate_id for Taalk agent matching
  const byAssociateId: Record<string, number> = {};
  for (const [id, amount] of appState.agentCreditsByAssociateId) {
    byAssociateId[id] = amount;
  }
  res.json({ credits, byAssociateId, polledAt: appState.lastCreditsPoll });
});

// â”€â”€ Stats â”€â”€
router.get('/stats', (_req, res) => {
  res.json(appState.stats);
});

// â”€â”€ WebRTC Presence (push from AOIrail client â€” real-time dialing/on_call status) â”€â”€
// POST /api/webrtc/presence
// body: { identity: email, status: 'available'|'dialing'|'ringing'|'on_call'|'offline', callDirection?, market?, states?, name? }
router.post('/webrtc/presence', (req, res) => {
  const { identity, status, callDirection, market, states, name, leadName, leadPhone, leadState, leadId } = req.body || {};
  if (!identity || !status) return res.status(400).json({ error: 'identity and status required' });
  appState.updateWebhookPresence(String(identity).toLowerCase().trim(), {
    status,
    callDirection: callDirection || undefined,
    market: market || undefined,
    states: Array.isArray(states) ? states : undefined,
    name: name || undefined,
    leadName: leadName || undefined,
    leadPhone: leadPhone || undefined,
    leadState: leadState || undefined,
    leadId: leadId || undefined,
  });
  res.json({ ok: true });
});

// GET /api/debug/markets â€” show normalizedMarket for all agents (to debug board filtering)
router.get('/debug/markets', (_req, res) => {
  const counts: Record<string, number> = {};
  const agents = appState.mergedAgents.map(a => {
    counts[a.normalizedMarket] = (counts[a.normalizedMarket] || 0) + 1;
    return { name: a.fullName, email: a.email, market: a.market, normalizedMarket: a.normalizedMarket, online: a.online };
  });
  res.json({ counts, agents });
});

// â”€â”€ Force refresh â”€â”€
router.post('/refresh', async (_req, res) => {
  await Promise.all([
    appState.pollRTS(),
    appState.pollCampaigns(),
  ]);
  res.json({ success: true, timestamp: Date.now() });
});

export default router;

// GET /api/agents/offline â€” all roster agents not on any system
router.get('/agents/offline', (_req, res) => {
  const onlineEmails = new Set(appState.mergedAgents.map(a => a.email));
  const offline = appState.allAgents.filter(a => {
    const email = `${(a.firstName || '').toLowerCase()}${(a.lastName || '').toLowerCase()}@aoglobelife.com`.replace(/\s+/g, '');
    return !onlineEmails.has(email);
  }).map(a => ({
    id: a.id,
    name: a.fullName,
    email: `${(a.firstName || '').toLowerCase()}${(a.lastName || '').toLowerCase()}@aoglobelife.com`.replace(/\s+/g, ''),
    market: a.normalizedMarket,
    states: a.states,
    lastHeartbeat: a.lastHeartbeat,
  }));
  res.json({ offline, total: offline.length });
});

// â”€â”€ Reactor endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/reactor/state', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Reactor is restricted to cnsysop' });
    const { getReactorState } = await import('./reactor.js');
    const s = getReactorState();
    res.json({
      lastRun: s.lastRun,
      running: s.running,
      rankUpdates: s.rankUpdates,
      rateUpdates: s.rateUpdates,
      errors: s.errors,
      ghosts: s.ghosts,
      dialPlans: s.dialPlans,
      agentScores: Object.fromEntries(s.agentScores),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reactor/run-now', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Reactor is restricted to cnsysop' });
    const { stopReactor, startReactor } = await import('./reactor.js');
    stopReactor();
    startReactor();
    res.json({ ok: true, message: 'Reactor restarted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// Pool health endpoint - proxies to aoirail-data leasedialer pool status
// 30-second server-side cache to prevent thundering herd from 15s frontend polling
let poolHealthCache: { data: any; ts: number } | null = null;
let poolHealthInflight: Promise<any> | null = null;
router.get('/reactor/pool-health', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Restricted to cnsysop' });
    // Return cached result if fresh
    if (poolHealthCache && Date.now() - poolHealthCache.ts < 30_000) {
      return res.json(poolHealthCache.data);
    }
    // Deduplicate: if a fetch is already in flight, wait for it
    if (!poolHealthInflight) {
      const dataUrl = `${AOIRAIL_DATA_URL}/api/leasedialer/pool-status`;
      poolHealthInflight = fetch(dataUrl, { signal: AbortSignal.timeout(8000) })
        .then(r => r.json())
        .then((data) => {
          const statusRows = Array.isArray(data?.overall)
            ? data.overall
            : (Array.isArray(data?.poolSummary) ? data.poolSummary : []);
          const overallMetrics =
            data?.overall && !Array.isArray(data.overall)
              ? data.overall
              : (data?.overallMetrics && !Array.isArray(data.overallMetrics) ? data.overallMetrics : null);
          const normalized = {
            ...data,
            overall: statusRows,
            overallMetrics,
            byMarket: Array.isArray(data?.byMarket) ? data.byMarket : [],
            lowBuckets: Array.isArray(data?.lowBuckets) ? data.lowBuckets : [],
            agentBuffers: Array.isArray(data?.agentBuffers) ? data.agentBuffers : [],
          };
          poolHealthCache = { data: normalized, ts: Date.now() };
          return normalized;
        })
        .finally(() => { poolHealthInflight = null; });
    }
    const data = await poolHealthInflight;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reactor/lead-flow', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!viewer.isSysop) return res.status(403).json({ error: 'Restricted to cnsysop' });
    const dataUrl = `${AOIRAIL_DATA_URL}/api/leasedialer/flow-utilization`;
    const r = await fetch(dataUrl, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) return res.status(502).json({ error: `Data service returned ${r.status}` });
    const data = await r.json();
    leadFlowSnapshot = data;
    leadFlowSnapshotAsOf = String(data?.generatedAt || new Date().toISOString());
    res.json(data);
  } catch (err: any) {
    if (leadFlowSnapshot) {
      return res.json({
        ...leadFlowSnapshot,
        stale: true,
        staleReason: String(err?.message || 'lead flow timeout'),
        staleAsOf: leadFlowSnapshotAsOf,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Call Intelligence â”€â”€
import {
  getAgentCalls, getAgentStats, getTeamScoreboard, getTeamStats, backfillRecentCalls,
  getAgentTrend, getCoachingAlerts, getLeaderboard, getVolumeQualityMatrix, getWeeklyDigest,
  saveScorecard, getScorecard, addCoachingNote, getCoachingNotes,
} from './call-intelligence.js';

// GET /api/call-intelligence/team â€” team scoreboard
router.get('/call-intelligence/team', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const [scoreboard, stats] = await Promise.all([getTeamScoreboard(), getTeamStats()]);
    const filteredBoard = applyEmailScope(scoreboard || [], viewer.scopedEmails, (r: any) => r?.agent_email ?? null);
    res.json({ scoreboard: filteredBoard, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/agent/:email â€” agent's scored calls
router.get('/call-intelligence/agent/:email', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!inScope(req.params.email, viewer.scopedEmails)) return res.status(403).json({ error: 'Not authorized for this agent' });
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const seg = String(req.query.segment || '').toLowerCase();
    const segment = seg === 'recruit' || seg === 'sales' ? (seg as 'recruit' | 'sales') : undefined;
    const calls = await getAgentCalls(req.params.email, limit, segment);
    res.json(calls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/stats/:email â€” agent stats summary
router.get('/call-intelligence/stats/:email', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!inScope(req.params.email, viewer.scopedEmails)) return res.status(403).json({ error: 'Not authorized for this agent' });
    const seg = String(req.query.segment || '').toLowerCase();
    const segment = seg === 'recruit' || seg === 'sales' ? (seg as 'recruit' | 'sales') : undefined;
    const stats = await getAgentStats(req.params.email, segment);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/call-intelligence/backfill â€” score recent unscored calls
router.post('/call-intelligence/backfill', async (req, res) => {
  try {
    const limit = parseInt(String(req.body?.limit || '200'), 10);
    const result = await backfillRecentCalls(limit);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/alerts
router.get('/call-intelligence/alerts', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const alerts = await getCoachingAlerts();
    res.json(applyEmailScope(alerts || [], viewer.scopedEmails, (a: any) => a?.agent_email ?? null));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/leaderboard
router.get('/call-intelligence/leaderboard', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const board = await getLeaderboard();
    res.json(applyEmailScope(board || [], viewer.scopedEmails, (r: any) => r?.agent_email ?? null));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/digest
router.get('/call-intelligence/digest', async (_req, res) => {
  try {
    const digest = await getWeeklyDigest();
    res.json(digest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/matrix
router.get('/call-intelligence/matrix', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const matrix = await getVolumeQualityMatrix();
    res.json(applyEmailScope(matrix || [], viewer.scopedEmails, (r: any) => r?.agent_email ?? null));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/trend/:email
router.get('/call-intelligence/trend/:email', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!inScope(req.params.email, viewer.scopedEmails)) return res.status(403).json({ error: 'Not authorized for this agent' });
    const seg = String(req.query.segment || '').toLowerCase();
    const segment = seg === 'recruit' || seg === 'sales' ? (seg as 'recruit' | 'sales') : undefined;
    const trend = await getAgentTrend(req.params.email, segment);
    res.json(trend);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/call-intelligence/scorecard/:callId
router.post('/call-intelligence/scorecard/:callId', (req, res) => {
  try {
    const { scores, manager_notes, filled_by } = req.body;
    if (!scores || !filled_by) return res.status(400).json({ error: 'scores and filled_by required' });
    saveScorecard(req.params.callId, { scores, manager_notes: manager_notes || '', filled_by, filled_at: new Date().toISOString() });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/scorecard/:callId
router.get('/call-intelligence/scorecard/:callId', (req, res) => {
  try {
    const sc = getScorecard(req.params.callId);
    if (!sc) return res.status(404).json({ error: 'Not found' });
    res.json(sc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/call-intelligence/coaching/:email
router.post('/call-intelligence/coaching/:email', (req, res) => {
  try {
    const { note, manager, call_id } = req.body;
    if (!note || !manager) return res.status(400).json({ error: 'note and manager required' });
    const entry = addCoachingNote(req.params.email, note, manager, call_id);
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call-intelligence/coaching/:email
router.get('/call-intelligence/coaching/:email', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    if (!inScope(req.params.email, viewer.scopedEmails)) return res.status(403).json({ error: 'Not authorized for this agent' });
    const notes = getCoachingNotes(req.params.email);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Sales Funnel â”€â”€
import { getFunnelData, getFunnelSummary, getAgentPresentations, getWeeklyComparison, getBatchAoiScores, getAgentAoiScore } from './funnel.js';

// GET /api/funnel?days=30&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD â€” per-agent funnel rows
router.get('/funnel', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const data = await getFunnelData(days, null, startDate, endDate);
    const scopedRows = applyEmailScope(data?.rows || [], viewer.scopedEmails, (r: any) => r?.email || r?.company_email || r?.agent_email || null);
    res.json({ ...(data || {}), rows: scopedRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funnel/summary?days=30&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD â€” team totals
router.get('/funnel/summary', async (req, res) => {
  try {
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const data = await getFunnelSummary(days, startDate, endDate);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funnel/agent/:associateId/presentations â€” recruit_candidates for recruiter (legacy path name)
router.get('/funnel/agent/:associateId/presentations', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '5'), 10) || 5;
    const data = await getAgentPresentations(req.params.associateId, limit);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funnel/weekly-comparison
router.get('/funnel/weekly-comparison', async (_req, res) => {
  try {
    const data = await getWeeklyComparison();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funnel/scores â€” batch AOI scores for all agents { [email]: { grade, total } }
router.get('/funnel/scores', async (_req, res) => {
  try {
    const data = await getBatchAoiScores();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funnel/agent-score/:email â€” full AoiScore breakdown for one agent
router.get('/funnel/agent-score/:email', async (req, res) => {
  try {
    const data = await getAgentAoiScore(req.params.email);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Real-time team daily stats from agent_daily_stats (Postgres via AOIrail data) â”€â”€

router.get('/agent-daily-stats/team', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const date = req.query.date as string | undefined;
    const data = await fetchTeamDailyStatsLive(date);
    if (!data) return res.status(502).json({ success: false, error: 'upstream error' });

    // Scope to viewer's agents
    const agents: any[] = data.agents || [];
    const scoped = applyEmailScope(agents, viewer.scopedEmails, (a: any) => a.agent_email);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ ...data, agents: scoped, polledAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// â”€â”€ AOI Usage Analytics â”€â”€
import { getUsageBreakdown, getTeamUsageSummary } from './aoi-usage.js';

// GET /api/usage/breakdown?days=30
router.get('/usage/breakdown', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const data = await getUsageBreakdown(days);
    const scoped = applyEmailScope(Array.isArray(data) ? data : [], viewer.scopedEmails, (r: any) => r?.email || null);
    res.json(scoped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/summary?days=30
router.get('/usage/summary', async (req, res) => {
  try {
    const viewer = await getViewerContext(req);
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const data = await getTeamUsageSummary(days);
    const scopedRows = applyEmailScope(data?.rows || [], viewer.scopedEmails, (r: any) => r?.email || null);
    res.json({ ...(data || {}), rows: scopedRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ ALP Monthly Stats â”€â”€
const ALP_SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const ALP_SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

let _alpCache: { months: { month: string; year: number; alp: number }[]; asOf: string } | null = null;
let _alpCacheTime = 0;
const ALP_CACHE_TTL = 15 * 60 * 1000; // 15 min

// â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/analytics/weekly?weekStart=YYYY-MM-DD&viewerEmail=...
// Returns per-agent weekly D/R/B with 7 day breakdown.
router.get('/analytics/weekly', async (req, res) => {
  try {
    const ANALYTICS_SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
    const ANALYTICS_SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
    const ANALYTICS_HEADERS = { apikey: ANALYTICS_SUPA_KEY, Authorization: `Bearer ${ANALYTICS_SUPA_KEY}` };

    // Parse + validate weekStart (must be a Monday)
    const rawWeekStart = String(req.query.weekStart || '').trim();
    let weekStartDate: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawWeekStart)) {
      const [y, m, d] = rawWeekStart.split('-').map(Number);
      weekStartDate = new Date(y, m - 1, d, 0, 0, 0);
    } else {
      // Default to this Wednesday (production week Wed-Tue)
      const now = new Date();
      const day = now.getDay(); // 0=Sun,3=Wed
      const daysSinceWed = (day + 4) % 7;
      weekStartDate = new Date(now);
      weekStartDate.setDate(now.getDate() - daysSinceWed);
      weekStartDate.setHours(0, 0, 0, 0);
    }
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekStart = fmtDate(weekStartDate);
    const weekEnd = fmtDate(weekEndDate);
    const shouldExcludeAnalyticsEmail = (rawEmail: string): boolean => {
      const email = String(rawEmail || '').toLowerCase().trim();
      if (!email.includes('@')) return true;
      const local = email.split('@')[0] || '';
      // Drop synthetic load-test agents from analytics/reporting.
      return /^loadagent\d+$/i.test(local) || /^load_agent\d+$/i.test(local);
    };

    // Build list of 7 dates Monâ€“Sun
    const DAY_NAMES = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      weekDates.push(fmtDate(d));
    }

    // Viewer scoping
    const viewerEmail = String(req.query.viewerEmail || '').toLowerCase().trim();
    let scopedEmails: Set<string> | null = null;
    if (viewerEmail && viewerEmail.includes('@')) {
      const viewer = appState.getViewerContext ? null : null; // use existing helper
      const hierarchy = appState.getHierarchyForEmail(viewerEmail);
      if (hierarchy) {
        scopedEmails = appState.getScopedAgentEmailsForViewer(viewerEmail);
      }
    }

    // Query agent_daily_stats from aoirail-data only.
    const AOIRAIL_DATA = 'https://aoirail-data-production.up.railway.app';
    const fetchTeamDailyStats = async (date: string): Promise<any[] | null> => {
      const cacheKey = `analytics_weekly_day::${date}`;
      const cached = teamDailyStatsCache.get(cacheKey);
      if (cached?.payload?.agents && Array.isArray(cached.payload.agents)) {
        return cached.payload.agents as any[];
      }

      const timeouts = [12000, 20000, 30000];
      for (let i = 0; i < timeouts.length; i++) {
        try {
          const dataUrl = `${AOIRAIL_DATA}/api/agent-daily-stats/team?date=${date}&_ts=${Date.now()}`;
          const dataRes = await fetch(dataUrl, { signal: AbortSignal.timeout(timeouts[i]) });
          if (!dataRes.ok) continue;
          const dataJson = await dataRes.json().catch(() => null);
          const dataAgents: any[] = dataJson?.agents || [];
          teamDailyStatsCache.set(cacheKey, { ts: Date.now(), payload: { agents: dataAgents } });
          return dataAgents;
        } catch (err: any) {
          if (i === timeouts.length - 1) {
            console.warn(`[analytics/weekly] aoirail-data fetch failed for ${date}:`, err?.message || err);
          }
        }
      }

      // If live fetch fails, use stale cached day instead of dropping the day to zero.
      if (cached?.payload?.agents && Array.isArray(cached.payload.agents)) {
        return cached.payload.agents as any[];
      }
      return null;
    };
    // Calendar outcomes are source-of-truth for presentation accountability metrics.
    // Pull once for the selected week and build per-agent/day aggregates.
    const appointmentMetricsByEmailDate = new Map<string, Map<string, { presentations: number; declaredSales: number; declaredAlp: number }>>();
    const weekEndExclusive = new Date(weekEndDate);
    weekEndExclusive.setDate(weekEndExclusive.getDate() + 1);
    const parseDeclaredAlp = (text: unknown): number => {
      const raw = String(text || '');
      const m = raw.match(/ALP:\s*\$?\s*([0-9,]+(?:\.[0-9]+)?)/i);
      if (!m) return 0;
      const n = Number(String(m[1] || '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    try {
      const apptRows: any[] = [];
      const limit = 1000;
      let offset = 0;
      while (true) {
        const apptUrl =
          `${ANALYTICS_SUPA_URL}/rest/v1/appointments` +
          `?select=agent_email,start_time,appointment_type,status,outcome,outcome_notes` +
          `&start_time=gte.${encodeURIComponent(`${weekStart}T00:00:00.000Z`)}` +
          `&start_time=lt.${encodeURIComponent(weekEndExclusive.toISOString())}` +
          `&limit=${limit}&offset=${offset}`;
        const apptRes = await fetch(apptUrl, { headers: ANALYTICS_HEADERS, signal: AbortSignal.timeout(12000) });
        if (!apptRes.ok) break;
        const page: any[] = await apptRes.json().catch(() => []);
        if (!Array.isArray(page) || page.length === 0) break;
        apptRows.push(...page);
        offset += page.length;
        if (page.length < limit) break;
      }

      for (const row of apptRows) {
        const email = String(row?.agent_email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) continue;
        if (shouldExcludeAnalyticsEmail(email)) continue;
        if (scopedEmails && !scopedEmails.has(email)) continue;
        const dateKey = String(row?.start_time || '').slice(0, 10);
        if (!weekDates.includes(dateKey)) continue;

        const appointmentType = String(row?.appointment_type || '').toLowerCase();
        const status = String(row?.status || '').toLowerCase();
        const outcome = String(row?.outcome || '').toLowerCase();
        if (status === 'cancelled') continue;

        const isPresentationLike =
          appointmentType === 'presentation' ||
          appointmentType === 'instant_presentation' ||
          appointmentType === 'appointment';

        if (!appointmentMetricsByEmailDate.has(email)) {
          appointmentMetricsByEmailDate.set(email, new Map());
        }
        const byDate = appointmentMetricsByEmailDate.get(email)!;
        const current = byDate.get(dateKey) || { presentations: 0, declaredSales: 0, declaredAlp: 0 };
        if (isPresentationLike) current.presentations += 1;
        if (outcome === 'sale') {
          current.declaredSales += 1;
          current.declaredAlp += parseDeclaredAlp(row?.outcome_notes);
        }
        byDate.set(dateKey, current);
      }
    } catch (err: any) {
      console.warn('[analytics/weekly] appointments metrics fetch failed:', err?.message || err);
    }

    // Fetch all 7 days in parallel so the endpoint stays fast enough for UI loading.
    const allRows: Array<{
      agent_email: string;
      stat_date: string;
      dials: number;
      reached: number;
      booked: number;
      instants?: number;
      sales?: number;
      alp?: number;
      plus?: number;
      presentations?: number;
      declared_sales?: number;
      declared_alp?: number;
    }> = [];
    const perDayRows = await Promise.all(
      weekDates.map(async (date) => {
        const agents = await fetchTeamDailyStats(date);
        if (!agents?.length) return [] as typeof allRows;
        const rowsForDate: typeof allRows = [];
        for (const a of agents) {
          rowsForDate.push({
            ...a,
            stat_date: date,
            sales: Number(a.sales || 0),
            alp: Number(a.alp || 0),
            plus: Number((a as any).plus || 0),
            presentations: Number((a as any).presentations || 0),
            declared_sales: Number((a as any).declared_sales || 0),
            declared_alp: Number((a as any).declared_alp || 0),
          });
        }
        return rowsForDate;
      }),
    );
    for (const dayRows of perDayRows) {
      if (!dayRows.length) continue;
      allRows.push(...dayRows);
    }
    const rows = allRows;

    // Group by agent â†’ by date
    type AgentAccum = {
      email: string;
      byDate: Map<string, { dials: number; reached: number; booked: number; instants: number; sales: number; alp: number; plus: number; presentations: number; declared_sales: number; declared_alp: number }>;
    };
    const agentMap = new Map<string, AgentAccum>();

    for (const row of rows) {
      const email = String(row.agent_email || '').toLowerCase().trim();
      if (!email || !email.includes('@')) continue;
      if (shouldExcludeAnalyticsEmail(email)) continue;
      if (scopedEmails && !scopedEmails.has(email)) continue;

      const dateKey = String(row.stat_date || '').slice(0, 10);
      if (!weekDates.includes(dateKey)) continue;

      if (!agentMap.has(email)) {
        agentMap.set(email, { email, byDate: new Map() });
      }
      const acc = agentMap.get(email)!;
      const existing = acc.byDate.get(dateKey) ?? { dials: 0, reached: 0, booked: 0, instants: 0, sales: 0, alp: 0, plus: 0, presentations: 0, declared_sales: 0, declared_alp: 0 };
      const rawDials = Number((row as any).raw_dials || 0);
      const resolvedDials = rawDials > 0 ? rawDials : (Number(row.dials) || 0);
      acc.byDate.set(dateKey, {
        dials: existing.dials + resolvedDials,
        reached: existing.reached + (Number(row.reached) || 0),
        booked: existing.booked + (Number(row.booked) || 0),
        instants: existing.instants + (Number((row as any).instants) || 0),
        sales: existing.sales + (Number((row as any).sales) || 0),
        alp: existing.alp + (Number((row as any).alp) || 0),
        plus: existing.plus + (Number((row as any).plus) || 0),
        presentations: existing.presentations + (Number((row as any).presentations) || 0),
        declared_sales: existing.declared_sales + (Number((row as any).declared_sales) || 0),
        declared_alp: existing.declared_alp + (Number((row as any).declared_alp) || 0),
      });
    }

    // Fallback hierarchy hydrate for analytics: resolve MGA/RGA directly from
    // customers table for any agent emails missing in in-memory cache.
    const hierarchyFallbackByEmail = new Map<string, { mgaName: string | null; rgaName: string | null }>();
    const hierarchyFallbackByLocal = new Map<string, { mgaName: string | null; rgaName: string | null }>();
    const cleanHierarchy = (value: unknown): string | null => {
      const text = String(value || '').trim();
      if (!text) return null;
      return text
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    };
    const setHierarchyFallback = (emailLike: unknown, mapped: { mgaName: string | null; rgaName: string | null }) => {
      const email = String(emailLike || '').toLowerCase().trim();
      if (!email || !email.includes('@')) return;
      hierarchyFallbackByEmail.set(email, mapped);
      const local = email.split('@')[0]?.trim();
      if (local) hierarchyFallbackByLocal.set(local, mapped);
    };
    try {
      const emails = Array.from(agentMap.keys()).filter((e) => e.includes('@'));
      const BATCH = 60;
      for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH);
        const orClauses: string[] = [];
        for (const email of batch) {
          orClauses.push(`company_email.eq.${encodeURIComponent(email)}`);
          orClauses.push(`personal_email.eq.${encodeURIComponent(email)}`);
        }
        if (orClauses.length === 0) continue;
        const url =
          `${ANALYTICS_SUPA_URL}/rest/v1/customers` +
          `?select=company_email,personal_email,mga,rga` +
          `&or=(${orClauses.join(',')})` +
          `&limit=2000`;
        const resp = await fetch(url, { headers: ANALYTICS_HEADERS, signal: AbortSignal.timeout(12000) });
        if (!resp.ok) continue;
        const rows: any[] = await resp.json().catch(() => []);
        for (const row of rows) {
          const mapped = {
            mgaName: cleanHierarchy(row?.mga),
            rgaName: cleanHierarchy(row?.rga),
          };
          setHierarchyFallback(row?.company_email, mapped);
          setHierarchyFallback(row?.personal_email, mapped);
        }

        // Secondary source: agent_hierarchy table (authoritative for many users).
        const hierarchyOrClauses = batch.map((email) => `agent_email.eq.${encodeURIComponent(email)}`);
        if (hierarchyOrClauses.length) {
          const hierarchyUrl =
            `${ANALYTICS_SUPA_URL}/rest/v1/agent_hierarchy` +
            `?select=agent_email,mga_name,rga_name` +
            `&or=(${hierarchyOrClauses.join(',')})` +
            `&limit=2000`;
          const hierarchyResp = await fetch(hierarchyUrl, { headers: ANALYTICS_HEADERS, signal: AbortSignal.timeout(12000) });
          if (hierarchyResp.ok) {
            const hierarchyRows: any[] = await hierarchyResp.json().catch(() => []);
            for (const row of hierarchyRows) {
              const mapped = {
                mgaName: cleanHierarchy(row?.mga_name),
                rgaName: cleanHierarchy(row?.rga_name),
              };
              setHierarchyFallback(row?.agent_email, mapped);
            }
          }
        }

        // Tertiary source: producerlist often has MGA/RGA when customers row is stale.
        if (orClauses.length) {
          const producerUrl =
            `${ANALYTICS_SUPA_URL}/rest/v1/producerlist` +
            `?select=company_email,personal_email,mga,rga` +
            `&or=(${orClauses.join(',')})` +
            `&limit=2000`;
          const producerResp = await fetch(producerUrl, { headers: ANALYTICS_HEADERS, signal: AbortSignal.timeout(12000) });
          if (producerResp.ok) {
            const producerRows: any[] = await producerResp.json().catch(() => []);
            for (const row of producerRows) {
              const mapped = {
                mgaName: cleanHierarchy(row?.mga),
                rgaName: cleanHierarchy(row?.rga),
              };
              setHierarchyFallback(row?.company_email, mapped);
              setHierarchyFallback(row?.personal_email, mapped);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[analytics/weekly] hierarchy fallback hydrate failed:', err?.message || err);
    }

    // Build agent result objects, enriched via public appState accessors
    const agents = Array.from(agentMap.values()).map(acc => {
      const cust = appState.getCustomerForEmail(acc.email);
      const mergedAgent = appState.mergedAgents.find(m => m.email === acc.email);
      const hierarchyFallback =
        hierarchyFallbackByEmail.get(acc.email) ||
        hierarchyFallbackByLocal.get(String(acc.email || '').split('@')[0] || '');

      // Name fallback chain: explicit customer first/last -> customer full name ->
      // merged agent full name -> email local-part. This prevents joined names
      // like "johnavila" when customer profile has proper first/last values.
      const customerFirst = String((cust as any)?.firstName || '').trim();
      const customerLast = String((cust as any)?.lastName || '').trim();
      const customerFull = `${customerFirst} ${customerLast}`.trim();
      const rawName =
        customerFull ||
        String((cust as any)?.fullName || '').trim() ||
        String(mergedAgent?.fullName || '').trim() ||
        acc.email.split('@')[0].replace(/[._]/g, ' ');
      const fullName = rawName
        .split(' ')
        .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
      const market = cust?.market || mergedAgent?.market || '';
      const mgaName = cust?.mgaName || mergedAgent?.mgaName || hierarchyFallback?.mgaName || null;
      const rgaName = (cust as any)?.rgaName || mergedAgent?.rgaName || hierarchyFallback?.rgaName || null;

      let totalDials = 0, totalReached = 0, totalBooked = 0, totalInstants = 0, totalSales = 0, totalAlp = 0, totalPlus = 0;
      let totalPresentations = 0, totalDeclaredSales = 0, totalDeclaredAlp = 0;
      const days = weekDates.map((date, i) => {
        const d = acc.byDate.get(date) ?? { dials: 0, reached: 0, booked: 0, instants: 0, sales: 0, alp: 0, plus: 0, presentations: 0, declared_sales: 0, declared_alp: 0 };
        const apptMetrics = appointmentMetricsByEmailDate.get(acc.email)?.get(date) || null;
        const effectivePresentations = apptMetrics ? apptMetrics.presentations : d.presentations;
        const effectiveDeclaredSales = apptMetrics ? apptMetrics.declaredSales : d.declared_sales;
        const effectiveDeclaredAlp = apptMetrics ? apptMetrics.declaredAlp : d.declared_alp;
        totalDials += d.dials;
        totalReached += d.reached;
        totalBooked += d.booked;
        totalInstants += d.instants;
        totalSales += d.sales;
        totalAlp += d.alp;
        totalPlus += d.plus;
        totalPresentations += effectivePresentations;
        totalDeclaredSales += effectiveDeclaredSales;
        totalDeclaredAlp += effectiveDeclaredAlp;
        return {
          date,
          dayName: DAY_NAMES[i],
          dials: d.dials,
          reached: d.reached,
          booked: d.booked,
          instants: d.instants,
          sales: d.sales,
          alp: d.alp,
          plus: d.plus,
          presentations: effectivePresentations,
          declared_sales: effectiveDeclaredSales,
          declared_alp: Number(effectiveDeclaredAlp.toFixed(2)),
        };
      });

      return {
        email: acc.email,
        fullName,
        market,
        mgaName,
        rgaName,
        totals: { dials: totalDials, reached: totalReached, booked: totalBooked, instants: totalInstants },
        days,
        declared: {
          presentations: totalPresentations,
          sales: totalDeclaredSales,
          alp: Math.round(totalDeclaredAlp),
        },
        alp: {
          marketAlp: 0,
          nonMarketAlp: 0,
          plusLeadAlp: totalPlus,
          totalAlp: Math.round(totalAlp),
          sales: Math.round(totalSales),
          alpPer100: totalDials > 0 ? Math.round((totalAlp / totalDials) * 100) : 0,
        },
      };
    });

    const unresolvedHierarchy = agents
      .filter((a) => !String(a.mgaName || '').trim() && !String(a.rgaName || '').trim())
      .map((a) => a.email);
    if (unresolvedHierarchy.length > 0) {
      console.warn(
        `[analytics/weekly] unresolved MGA/RGA for ${unresolvedHierarchy.length} agents (sample):`,
        unresolvedHierarchy.slice(0, 10).join(', ')
      );
    }

    // Team totals
    const teamDials = agents.reduce((s, a) => s + a.totals.dials, 0);
    const teamReached = agents.reduce((s, a) => s + a.totals.reached, 0);
    const teamBooked = agents.reduce((s, a) => s + a.totals.booked, 0);
    const teamInstants = agents.reduce((s, a) => s + a.totals.instants, 0);
    const activeAgents = agents.filter(a => a.totals.dials > 0).length;
    const teamDeclared = {
      presentations: agents.reduce((s, a: any) => s + Number(a?.declared?.presentations || 0), 0),
      declaredSales: agents.reduce((s, a: any) => s + Number(a?.declared?.sales || 0), 0),
      declaredAlp: agents.reduce((s, a: any) => s + Number(a?.declared?.alp || 0), 0),
    };
    const teamAlp = {
      marketAlp: 0,
      nonMarketAlp: 0,
      plusLeadAlp: 0,
      totalAlp: agents.reduce((s, a) => s + (a.alp?.totalAlp || 0), 0),
      totalSales: agents.reduce((s, a) => s + (a.alp?.sales || 0), 0),
    };

    res.json({
      weekStart,
      weekEnd,
      agents,
      totals: { dials: teamDials, reached: teamReached, booked: teamBooked, instants: teamInstants, activeAgents, ...teamDeclared, ...teamAlp },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch weekly analytics' });
  }
});

// GET /api/alp/monthly â€” rolling last 3 calendar months ALP from platform_sales
router.get('/alp/monthly', async (_req, res) => {
  try {
    if (_alpCache && Date.now() - _alpCacheTime < ALP_CACHE_TTL) {
      return res.json(_alpCache);
    }

    const now = new Date();
    const monthDefs = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthDefs.push({ year: d.getFullYear(), monthIdx: d.getMonth() });
    }

    const months = await Promise.all(monthDefs.map(async ({ year, monthIdx }) => {
      const start = `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
      const nextM = monthIdx === 11 ? { y: year + 1, m: 0 } : { y: year, m: monthIdx + 1 };
      const end   = `${nextM.y}-${String(nextM.m + 1).padStart(2, '0')}-01`;

      const url = `${ALP_SUPA_URL}/rest/v1/platform_sales?select=platform_alp&sga_submit=gte.${start}&sga_submit=lt.${end}&limit=50000`;
      const r = await fetch(url, { headers: { apikey: ALP_SUPA_KEY, Authorization: `Bearer ${ALP_SUPA_KEY}` } });
      const rows: any[] = await r.json();
      const alp = rows.reduce((sum, row) => sum + (parseFloat(row.platform_alp) || 0), 0);
      return { month: MONTH_NAMES[monthIdx], year, alp: Math.round(alp) };
    }));

    const asOf = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
                 ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';

    _alpCache = { months, asOf };
    _alpCacheTime = Date.now();
    res.json(_alpCache);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});