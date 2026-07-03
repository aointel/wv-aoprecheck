import crypto from 'crypto';
import { pool } from './db';
import { supabaseAdmin } from './supabase';

type AgentSnapshot = {
  rank: number;
  name: string;
  email: string;
  score: number;
  dials: number;
  reach: number;
  booked: number;
  instant: number;
  connects: number;
  missedCalls: number;
  aoiUsage: number;
  photoUrl?: string;
  isLive?: boolean;
};

type TotalsSnapshot = {
  activeAgents: number;
  totalAgents: number;
  dials: number;
  reach: number;
  booked: number;
  instant: number;
  connects: number;
  missedCalls: number;
  aoiUsage: number;
};

type ManagerScope = {
  scopeKey: string;
  managerEmail: string;
  managerName: string;
  agentEmails: string[];
  hierarchyNameByEmail: Record<string, string>;
};

type DateRangeNormalized = {
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
  isTodayRange: boolean;
};

let tablesReady = false;

function scoreAgent(a: Pick<AgentSnapshot, 'dials' | 'reach' | 'booked' | 'connects' | 'instant'>): number {
  return (a.dials * 1) + (a.reach * 10) + (a.booked * 40) + (a.connects * 25) + (a.instant * 80);
}

function stableScopeKey(managerEmail: string): string {
  return `hier_${managerEmail.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
}

function randomToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function getPstTodayDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function getPstDayUtcRange(dateYmd: string): { startIso: string; endIso: string } {
  const now = new Date();
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || 'GMT-8';
  const m = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(m?.[1] || -8);
  const sign = hours >= 0 ? '+' : '-';
  const hh = String(Math.abs(hours)).padStart(2, '0');
  const offset = `${sign}${hh}:00`;
  // Use 5 AM to 11:59 PM PST for today's date (matching getPstDayRange in activity-card-report-service.ts)
  const today = getPstTodayDateString();
  if (dateYmd === today) {
    const start = new Date(`${dateYmd}T05:00:00${offset}`);
    const end = new Date(`${dateYmd}T23:59:59${offset}`);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }
  // For other dates, use full day
  const start = new Date(`${dateYmd}T00:00:00${offset}`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function addDaysYmd(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normalizeDateRange(startDate?: string, endDate?: string): DateRangeNormalized {
  const valid = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const today = getPstTodayDateString();
  const start = valid(startDate) ? String(startDate) : today;
  const end = valid(endDate) ? String(endDate) : start;
  const normalizedStart = start <= end ? start : end;
  const normalizedEnd = start <= end ? end : start;
  const { startIso } = getPstDayUtcRange(normalizedStart);
  // For end date, if it's today, use 23:59:59 from today's range, otherwise use next day's 00:00:00
  let endIso: string;
  if (normalizedEnd === today) {
    const todayRange = getPstDayUtcRange(normalizedEnd);
    endIso = todayRange.endIso;
  } else {
    const nextDayRange = getPstDayUtcRange(addDaysYmd(normalizedEnd, 1));
    endIso = nextDayRange.startIso;
  }
  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    startIso,
    endIso,
    isTodayRange: normalizedStart === today && normalizedEnd === today,
  };
}

function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function uniqueVanitySlug(base: string): Promise<string> {
  const cleaned = slugify(base) || 'hierarchy';
  let candidate = cleaned;
  let suffix = 1;
  for (;;) {
    const { rows } = await pool.query(
      `SELECT 1 FROM public_hierarchy_links WHERE vanity_slug = $1 LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${cleaned}-${suffix}`;
  }
}

export async function ensurePublicLiveCardTables(): Promise<void> {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public_hierarchy_links (
      token TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL UNIQUE,
      vanity_slug TEXT UNIQUE,
      manager_email TEXT NOT NULL,
      manager_name TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE public_hierarchy_links ADD COLUMN IF NOT EXISTS vanity_slug TEXT;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_public_hierarchy_links_manager_email ON public_hierarchy_links(manager_email);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_public_hierarchy_links_enabled ON public_hierarchy_links(enabled);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_public_hierarchy_links_vanity_slug ON public_hierarchy_links(vanity_slug) WHERE vanity_slug IS NOT NULL;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hierarchy_live_snapshots (
      scope_key TEXT PRIMARY KEY,
      manager_email TEXT NOT NULL,
      manager_name TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      top5_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      bottom5_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      full_rank_json JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_hierarchy_live_snapshots_updated_at ON hierarchy_live_snapshots(updated_at DESC);`);
  tablesReady = true;
}

export async function getManagerScope(managerEmail: string): Promise<ManagerScope> {
  const normalizedManager = managerEmail.toLowerCase().trim();
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_email, first_name, last_name, associate_id, mga')
    .eq('company_email', normalizedManager)
    .maybeSingle();

  const managerName = `${String((customer as any)?.first_name || '').trim()} ${String((customer as any)?.last_name || '').trim()}`.trim() || normalizedManager;
  const associateId = Number((customer as any)?.associate_id || 0);
  const hierarchyNameByEmail: Record<string, string> = {};
  const emails = new Set<string>();

  // AOI: only MGA hierarchy (not RGA)
  if (associateId > 0) {
    const { data: mgaRows } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email,agent_name')
      .eq('mga_associate_id', associateId);
    for (const row of mgaRows || []) {
      const email = String((row as any).agent_email || '').toLowerCase().trim();
      const name = String((row as any).agent_name || '').trim();
      if (!email) continue;
      emails.add(email);
      if (name) hierarchyNameByEmail[email] = name;
    }
  }

  if (emails.size === 0) {
    const targetMga = String((customer as any)?.mga || '').trim();
    if (targetMga) {
      const { data: byMga } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email,agent_name')
        .eq('mga_name', targetMga);
      for (const row of byMga || []) {
        const email = String((row as any).agent_email || '').toLowerCase().trim();
        const name = String((row as any).agent_name || '').trim();
        if (!email) continue;
        emails.add(email);
        if (name) hierarchyNameByEmail[email] = name;
      }
    }
  }

  emails.add(normalizedManager);
  return {
    scopeKey: stableScopeKey(normalizedManager),
    managerEmail: normalizedManager,
    managerName,
    agentEmails: [...emails],
    hierarchyNameByEmail,
  };
}

async function getIdentity(agentEmails: string[]): Promise<Map<string, { name: string; photo?: string }>> {
  const out = new Map<string, { name: string; photo?: string }>();
  if (agentEmails.length === 0) return out;

  const { data: customersCompany } = await supabaseAdmin
    .from('customers')
    .select('company_email,personal_email,first_name,last_name')
    .in('company_email', agentEmails);
  const { data: customersPersonal } = await supabaseAdmin
    .from('customers')
    .select('company_email,personal_email,first_name,last_name')
    .in('personal_email', agentEmails);
  const allCustomers = [...(customersCompany || []), ...(customersPersonal || [])];

  const { data: profiles } = await supabaseAdmin
    .from('agent_profiles')
    .select('email,profile_picture')
    .in('email', agentEmails);
  const photoByEmail = new Map<string, string>();
  for (const p of profiles || []) {
    const email = String((p as any).email || '').toLowerCase().trim();
    const pic = String((p as any).profile_picture || '').trim();
    if (email && pic) photoByEmail.set(email, pic);
  }

  for (const email of agentEmails) {
    const cust = allCustomers.find((c: any) =>
      String(c.company_email || '').toLowerCase().trim() === email ||
      String(c.personal_email || '').toLowerCase().trim() === email
    );
    const first = String((cust as any)?.first_name || '').trim();
    const last = String((cust as any)?.last_name || '').trim();
    const full = `${first} ${last}`.trim() || email;
    out.set(email, { name: full, photo: photoByEmail.get(email) });
  }
  return out;
}

export async function buildSnapshotForScope(scope: ManagerScope, dateRange: DateRangeNormalized): Promise<{
  totals: TotalsSnapshot;
  top5: AgentSnapshot[];
  bottom5: AgentSnapshot[];
  fullRank: AgentSnapshot[];
}> {
  const identity = await getIdentity(scope.agentEmails);
  const agents: AgentSnapshot[] = [];

  // Always use date-filtered queries instead of live_call_boardt to ensure correct date range filtering
  // (live_call_boardt doesn't respect custom time ranges like 5 AM - 11:59 PM PST)
  {
    const byAgent = new Map<string, {
      dialPhones: Map<string, number>;
      reachedPhones: Set<string>;
      bookedPhones: Set<string>;
      instantPhones: Set<string>;
      connects: number;
      missedCalls: number;
    }>();
    for (const email of scope.agentEmails) {
      byAgent.set(email, {
        dialPhones: new Map(),
        reachedPhones: new Set(),
        bookedPhones: new Set(),
        instantPhones: new Set(),
        connects: 0,
        missedCalls: 0,
      });
    }

    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email,to_number,call_status,call_duration,call_started_at')
        .eq('call_direction', 'outbound')
        .gte('call_started_at', dateRange.startIso)
        .lt('call_started_at', dateRange.endIso)
        .in('owner_email', scope.agentEmails)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String((row as any).owner_email || '').toLowerCase().trim();
        const agg = byAgent.get(email);
        if (!agg) continue;
        const phone = normalizePhone((row as any).to_number);
        const status = String((row as any).call_status || '').toLowerCase();
        const duration = Number((row as any).call_duration || 0);
        const callTs = new Date(String((row as any).call_started_at || '')).getTime();
        if (phone.length !== 10) continue;
        const previousTs = agg.dialPhones.get(phone);
        if (!previousTs || callTs - previousTs >= 5 * 60 * 1000) {
          agg.dialPhones.set(phone, callTs);
        }
        if (duration >= 55 && (status === 'answered' || status === 'completed')) {
          agg.reachedPhones.add(phone);
        }
        if (duration >= 600 && (status === 'answered' || status === 'completed')) {
          agg.instantPhones.add(phone);
        }
      }
      if (rows.length < pageSize) break;
    }

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email,transaction_type,created_at')
        .eq('transaction_type', 'missed_call')
        .gte('created_at', dateRange.startIso)
        .lt('created_at', dateRange.endIso)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String((row as any).agent_email || '').toLowerCase().trim();
        const agg = byAgent.get(email);
        if (agg) agg.missedCalls += 1;
      }
      if (rows.length < pageSize) break;
    }

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('agent_email,event_type,lead_phone')
        .in('event_type', ['booked'])
        .gte('event_timestamp', dateRange.startIso)
        .lt('event_timestamp', dateRange.endIso)
        .in('agent_email', scope.agentEmails)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String((row as any).agent_email || '').toLowerCase().trim();
        const agg = byAgent.get(email);
        if (!agg) continue;
        const phone = normalizePhone((row as any).lead_phone);
        if (phone.length === 10) agg.bookedPhones.add(phone);
      }
      if (rows.length < pageSize) break;
    }

    // Connects: Query billing_transactions with transaction_date filter (not vdp_calls with updated_at)
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email,transaction_date')
        .eq('transaction_type', 'connect')
        .gte('transaction_date', dateRange.startIso)
        .lt('transaction_date', dateRange.endIso)
        .in('agent_email', scope.agentEmails)
        .not('agent_email', 'is', null)
        .neq('agent_email', '')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const email = String((row as any).agent_email || '').toLowerCase().trim();
        const agg = byAgent.get(email);
        if (agg) agg.connects += 1;
      }
      if (rows.length < pageSize) break;
    }

    for (const email of scope.agentEmails) {
      const id = identity.get(email);
      const agg = byAgent.get(email);
      const dials = agg?.dialPhones.size || 0;
      const reach = agg?.reachedPhones.size || 0;
      const booked = agg?.bookedPhones.size || 0;
      const instant = agg?.instantPhones.size || 0;
      const connects = agg?.connects || 0;
      const missedCalls = agg?.missedCalls || 0;
      agents.push({
        rank: 0,
        name: id?.name || scope.hierarchyNameByEmail[email] || email,
        email,
        score: scoreAgent({ dials, reach, booked, instant, connects }),
        dials,
        reach,
        booked,
        instant,
        connects,
        missedCalls,
        aoiUsage: 0,
        photoUrl: id?.photo,
        isLive: false,
      });
    }
  }

  const hasAnyDisplayedStat = (a: AgentSnapshot): boolean =>
    a.dials > 0 ||
    a.reach > 0 ||
    a.booked > 0 ||
    a.instant > 0 ||
    a.connects > 0 ||
    a.missedCalls > 0 ||
    a.aoiUsage > 0;

  const active = agents.filter(hasAnyDisplayedStat);
  active.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.booked !== a.booked) return b.booked - a.booked;
    if (b.reach !== a.reach) return b.reach - a.reach;
    return b.dials - a.dials;
  });
  active.forEach((a, idx) => { a.rank = idx + 1; });

  const top5 = active.slice(0, 5);
  const topSet = new Set(top5.map((a) => a.email));
  const bottom5 = active.filter((a) => !topSet.has(a.email)).slice(-5).reverse();

  const totals: TotalsSnapshot = {
    activeAgents: active.length,
    totalAgents: scope.agentEmails.length,
    dials: active.reduce((s, a) => s + a.dials, 0),
    reach: active.reduce((s, a) => s + a.reach, 0),
    booked: active.reduce((s, a) => s + a.booked, 0),
    instant: active.reduce((s, a) => s + a.instant, 0),
    connects: active.reduce((s, a) => s + a.connects, 0),
    missedCalls: active.reduce((s, a) => s + a.missedCalls, 0),
    aoiUsage: Math.round(active.reduce((s, a) => s + a.aoiUsage, 0) / Math.max(1, active.length)),
  };

  return { totals, top5, bottom5, fullRank: active };
}

export async function getOrCreatePermanentHierarchyLink(managerEmail: string): Promise<{ token: string; scopeKey: string; vanitySlug: string; managerEmail: string; managerName: string }> {
  await ensurePublicLiveCardTables();
  const scope = await getManagerScope(managerEmail);

  const existing = await pool.query(
    `SELECT token, scope_key, vanity_slug, manager_email, manager_name
     FROM public_hierarchy_links
     WHERE scope_key = $1
     LIMIT 1`,
    [scope.scopeKey]
  );
  const defaultSlug = await uniqueVanitySlug(scope.managerName.split(/\s+/).slice(-1)[0] || scope.managerName || scope.managerEmail);

  if (existing.rows.length > 0) {
    const vanitySlug = String(existing.rows[0].vanity_slug || '').trim() || defaultSlug;
    if (!String(existing.rows[0].vanity_slug || '').trim()) {
      await pool.query(
        `UPDATE public_hierarchy_links SET vanity_slug = $2, updated_at = NOW() WHERE scope_key = $1`,
        [scope.scopeKey, vanitySlug]
      );
    }
    return {
      token: String(existing.rows[0].token),
      scopeKey: String(existing.rows[0].scope_key),
      vanitySlug,
      managerEmail: String(existing.rows[0].manager_email),
      managerName: String(existing.rows[0].manager_name || scope.managerName),
    };
  }

  const token = randomToken();
  const vanitySlug = defaultSlug;
  await pool.query(
    `INSERT INTO public_hierarchy_links (token, scope_key, vanity_slug, manager_email, manager_name, enabled)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [token, scope.scopeKey, vanitySlug, scope.managerEmail, scope.managerName]
  );
  return { token, scopeKey: scope.scopeKey, vanitySlug, managerEmail: scope.managerEmail, managerName: scope.managerName };
}

export async function rebuildSnapshotForManager(managerEmail: string): Promise<void> {
  await ensurePublicLiveCardTables();
  const scope = await getManagerScope(managerEmail);
  const snapshot = await buildSnapshotForScope(scope, normalizeDateRange());
  await pool.query(
    `INSERT INTO hierarchy_live_snapshots
      (scope_key, manager_email, manager_name, updated_at, totals_json, top5_json, bottom5_json, full_rank_json)
     VALUES ($1, $2, $3, NOW(), $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
     ON CONFLICT (scope_key) DO UPDATE SET
      manager_email = EXCLUDED.manager_email,
      manager_name = EXCLUDED.manager_name,
      updated_at = NOW(),
      totals_json = EXCLUDED.totals_json,
      top5_json = EXCLUDED.top5_json,
      bottom5_json = EXCLUDED.bottom5_json,
      full_rank_json = EXCLUDED.full_rank_json`,
    [
      scope.scopeKey,
      scope.managerEmail,
      scope.managerName,
      JSON.stringify(snapshot.totals),
      JSON.stringify(snapshot.top5),
      JSON.stringify(snapshot.bottom5),
      JSON.stringify(snapshot.fullRank),
    ]
  );
}

export async function rebuildAllLiveSnapshots(): Promise<number> {
  await ensurePublicLiveCardTables();
  const { rows } = await pool.query(
    `SELECT manager_email
     FROM public_hierarchy_links
     WHERE enabled = TRUE`
  );
  let updated = 0;
  for (const row of rows) {
    const email = String(row.manager_email || '').toLowerCase().trim();
    if (!email) continue;
    await rebuildSnapshotForManager(email);
    updated += 1;
  }
  return updated;
}

export async function getSnapshotByToken(tokenOrSlug: string, options?: { startDate?: string; endDate?: string }): Promise<null | {
  token: string;
  vanitySlug: string;
  scopeKey: string;
  managerEmail: string;
  managerName: string;
  updatedAt: string;
  dateRange: { startDate: string; endDate: string; isRealtime: boolean };
  totals: TotalsSnapshot;
  top5: AgentSnapshot[];
  bottom5: AgentSnapshot[];
  fullRank: AgentSnapshot[];
}> {
  await ensurePublicLiveCardTables();
  const trimmed = String(tokenOrSlug || '').trim();
  if (!trimmed) return null;

  const { rows: linkRows } = await pool.query(
    `SELECT token, scope_key, vanity_slug, manager_email, manager_name, enabled
     FROM public_hierarchy_links
     WHERE token = $1 OR vanity_slug = $1
     LIMIT 1`,
    [trimmed]
  );
  if (linkRows.length === 0) return null;
  const link = linkRows[0];
  if (!Boolean(link.enabled)) return null;
  const dateRange = normalizeDateRange(options?.startDate, options?.endDate);

  if (!dateRange.isTodayRange) {
    const scope = await getManagerScope(String(link.manager_email));
    const computed = await buildSnapshotForScope(scope, dateRange);
    return {
      token: String(link.token),
      vanitySlug: String(link.vanity_slug || ''),
      scopeKey: scope.scopeKey,
      managerEmail: scope.managerEmail,
      managerName: scope.managerName,
      updatedAt: dateRange.endIso,
      dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate, isRealtime: false },
      totals: computed.totals,
      top5: computed.top5,
      bottom5: computed.bottom5,
      fullRank: computed.fullRank,
    };
  }

  const { rows: snapshotRows } = await pool.query(
    `SELECT scope_key, manager_email, manager_name, updated_at, totals_json, top5_json, bottom5_json, full_rank_json
     FROM hierarchy_live_snapshots
     WHERE scope_key = $1
     LIMIT 1`,
    [String(link.scope_key)]
  );

  if (snapshotRows.length === 0) {
    await rebuildSnapshotForManager(String(link.manager_email));
    return getSnapshotByToken(trimmed, options);
  }

  const snapshot = snapshotRows[0];
  return {
    token: String(link.token),
    vanitySlug: String(link.vanity_slug || ''),
    scopeKey: String(snapshot.scope_key),
    managerEmail: String(snapshot.manager_email),
    managerName: String(snapshot.manager_name || link.manager_name || ''),
    updatedAt: new Date(snapshot.updated_at).toISOString(),
    dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate, isRealtime: true },
    totals: snapshot.totals_json || {},
    top5: snapshot.top5_json || [],
    bottom5: snapshot.bottom5_json || [],
    fullRank: snapshot.full_rank_json || [],
  };
}

export async function seedChrisLiveLink(): Promise<{ token: string; urlPath: string }> {
  const link = await getOrCreatePermanentHierarchyLink('chrislafond@aoglobelife.com');
  await rebuildSnapshotForManager(link.managerEmail);
  return { token: link.token, urlPath: `/${link.vanitySlug || link.token}` };
}

