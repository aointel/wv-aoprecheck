import { supabaseAdmin } from './supabase';
import { pool } from './db';

type Trend = 'up' | 'down';

export type ActivityCardAgentData = {
  rank: number;
  rankChange?: number;
  name: string;
  dials: number;
  dialsPct: number;
  dialsTrend: Trend;
  reach: number;
  reachPct: number;
  reachTrend: Trend;
  booked: number;
  bookedPct: number;
  bookedTrend: Trend;
  instant: number;
  instantPct: number;
  instantTrend: Trend;
  connects: number;
  connectsPct: number;
  connectsTrend: Trend;
  missedCalls: number;
  missedCallsPct: number;
  missedCallsTrend: Trend;
  aoiUsage: number;
  aoiUsagePct: number;
  aoiUsageTrend: Trend;
  photoUrl?: string;
  isLive?: boolean;
};

export type ActivityCardPayloadData = {
  generatedAt: string;
  agencyName: string;
  totals: {
    activeAgents: number;
    totalAgents: number;
    dials: number;
    dialsPct: number;
    dialsTrend: Trend;
    reach: number;
    reachPct: number;
    reachTrend: Trend;
    booked: number;
    bookedPct: number;
    bookedTrend: Trend;
    instant: number;
    instantPct: number;
    instantTrend: Trend;
    connects: number;
    connectsPct: number;
    connectsTrend: Trend;
    missedCalls: number;
    missedCallsPct: number;
    missedCallsTrend: Trend;
    aoiUsage: number;
    aoiUsagePct: number;
    aoiUsageTrend: Trend;
    deltaPct: number;
    weeklyProductionEst?: number;
    previousWeeksALP?: number;
  };
  chart: {
    labels: string[];
    series: number[];
  };
  agents: ActivityCardAgentData[];
};

export type ReportScope = {
  scopeKey: string;
  managerName: string;
  managerEmail: string;
  agentEmails: string[];
  hierarchyNameByEmail?: Record<string, string>;
};

type Recipient = {
  email?: string;
  phone?: string;
  role: 'manager' | 'agent';
  agentEmail: string;
  fullName: string;
};

let tablesReady = false;

function pctChange(current: number, previous: number): { pct: number; trend: Trend } {
  if (!previous) {
    if (!current) return { pct: 0, trend: 'up' };
    return { pct: 100, trend: 'up' };
  }
  const pct = ((current - previous) / previous) * 100;
  return { pct: Number(pct.toFixed(1)), trend: pct >= 0 ? 'up' : 'down' };
}

function performanceScore(agent: Pick<ActivityCardAgentData, 'dials' | 'reach' | 'booked' | 'connects' | 'instant'>): number {
  return (agent.dials * 1) + (agent.reach * 10) + (agent.booked * 40) + (agent.connects * 25) + (agent.instant * 80);
}

async function ensureReportTables(): Promise<void> {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_card_runs (
      id BIGSERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'started',
      generated_image_path TEXT,
      generated_image_url TEXT,
      payload_json JSONB,
      agent_ranks JSONB,
      error_message TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_card_deliveries (
      id BIGSERIAL PRIMARY KEY,
      run_id BIGINT REFERENCES activity_card_runs(id) ON DELETE CASCADE,
      recipient_email TEXT,
      recipient_phone TEXT,
      recipient_role TEXT,
      channel TEXT NOT NULL,
      provider_sid TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      error_code TEXT,
      error_message TEXT,
      retry_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tablesReady = true;
}

function getPstDayRange(now = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || 'GMT-8';
  const m = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(m?.[1] || -8);
  const sign = hours >= 0 ? '+' : '-';
  const hh = String(Math.abs(hours)).padStart(2, '0');
  const offset = `${sign}${hh}:00`;
  // 5 AM to 11:59 PM PST for today's date
  const start = new Date(`${year}-${month}-${day}T05:00:00${offset}`);
  const end = new Date(`${year}-${month}-${day}T23:59:59${offset}`);
  return { start, end };
}

function getLaDateYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function getLaUtcForYmdTime(ymd: string, hour24: number, minute = 0): Date {
  const hh = String(hour24).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const approxUtc = new Date(`${ymd}T${hh}:${mm}:00Z`);
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  }).formatToParts(approxUtc).find((p) => p.type === 'timeZoneName')?.value || 'GMT-8';
  const match = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(match?.[1] || -8);
  const sign = hours >= 0 ? '+' : '-';
  const offH = String(Math.abs(hours)).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00${sign}${offH}:00`);
}

function getDailyBusinessWindow(now = new Date()): { start: Date; end: Date; ymd: string } {
  const ymd = getLaDateYmd(now);
  const start = getLaUtcForYmdTime(ymd, 9, 0);
  const end = getLaUtcForYmdTime(ymd, 21, 0);
  return { start, end, ymd };
}

function previousBusinessDayYmd(fromYmd: string): string {
  const d = new Date(`${fromYmd}T12:00:00Z`);
  for (let i = 0; i < 7; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dow = d.getUTCDay(); // 0 Sun ... 6 Sat
    if (dow >= 1 && dow <= 5) return d.toISOString().slice(0, 10);
  }
  return new Date(`${fromYmd}T12:00:00Z`).toISOString().slice(0, 10);
}

function getPstWeekRange(now = new Date()): { start: Date; end: Date } {
  const { start: dayStart } = getPstDayRange(now);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
  }).format(now);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday] ?? 0;
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const start = new Date(dayStart);
  start.setDate(start.getDate() + mondayDelta);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

async function getChrisScope(): Promise<ReportScope> {
  const managerEmail = 'chrislafond@aoglobelife.com';

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_email, first_name, last_name, mga, associate_id')
    .eq('company_email', managerEmail)
    .maybeSingle();

  const { data: profile } = await supabaseAdmin
    .from('agent_profiles')
    .select('email, mga_team, rga_team')
    .ilike('email', managerEmail)
    .maybeSingle();

  const associateId = Number(customer?.associate_id || 0);

  const rows = new Map<string, boolean>();
  const hierarchyNameByEmail: Record<string, string> = {};
  // AOI activity card: count only MGA hierarchy (not RGA)
  if (associateId > 0) {
    const { data: mgaRows } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email,agent_name')
      .eq('mga_associate_id', associateId);
    for (const r of mgaRows || []) {
      const e = String((r as any).agent_email || '').toLowerCase().trim();
      const n = String((r as any).agent_name || '').trim();
      if (e) rows.set(e, true);
      if (e && n) hierarchyNameByEmail[e] = n;
    }
  }

  // Fallback if associate based lookup is empty.
  if (rows.size === 0) {
    const targetMga = String(customer?.mga || profile?.mga_team || '').trim();
    if (targetMga) {
      const { data } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email,agent_name')
        .eq('mga_name', targetMga);
      for (const r of data || []) {
        const e = String((r as any).agent_email || '').toLowerCase().trim();
        const n = String((r as any).agent_name || '').trim();
        if (e) rows.set(e, true);
        if (e && n) hierarchyNameByEmail[e] = n;
      }
    }
  }

  const agentEmails = [...rows.keys()];
  if (!agentEmails.includes(managerEmail)) agentEmails.unshift(managerEmail);

  return {
    scopeKey: 'chris_lafond_hierarchy',
    managerName: `${String(customer?.first_name || 'Chris').trim()} ${String(customer?.last_name || 'Lafond').trim()}`.trim(),
    managerEmail: managerEmail,
    agentEmails,
    hierarchyNameByEmail,
  };
}

async function getAgentIdentity(agentEmails: string[]): Promise<Map<string, { firstName: string; lastName: string; photo?: string; fullName: string; phone?: string; companyEmail?: string }>> {
  const out = new Map<string, { firstName: string; lastName: string; photo?: string; fullName: string; phone?: string; companyEmail?: string }>();

  const { data: companyCustomers } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email, first_name, last_name, phone')
    .in('company_email', agentEmails);

  const { data: personalCustomers } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email, first_name, last_name, phone')
    .in('personal_email', agentEmails);
  const customers = [...(companyCustomers || []), ...(personalCustomers || [])];

  const { data: profiles } = await supabaseAdmin
    .from('agent_profiles')
    .select('email, profile_picture')
    .in('email', agentEmails);

  const photoByEmail = new Map<string, string>();
  for (const p of profiles || []) {
    const email = String((p as any).email || '').toLowerCase().trim();
    const pic = String((p as any).profile_picture || '').trim();
    if (email && pic) photoByEmail.set(email, pic);
  }

  for (const email of agentEmails) {
    const cust = (customers || []).find((c: any) =>
      String(c.company_email || '').toLowerCase().trim() === email ||
      String(c.personal_email || '').toLowerCase().trim() === email
    );
    const firstName = String((cust as any)?.first_name || '').trim();
    const lastName = String((cust as any)?.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || email;
    out.set(email, {
      firstName: firstName || fullName.split(' ')[0] || 'Agent',
      lastName: lastName || fullName.split(' ').slice(1).join(' '),
      photo: photoByEmail.get(email),
      fullName,
      phone: String((cust as any)?.phone || '').trim() || undefined,
      companyEmail: String((cust as any)?.company_email || '').trim() || email,
    });
  }
  return out;
}

async function getConnectsByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (agentEmails.length === 0) return map;

  // Query billing_transactions for connects, filtered by transaction_date (not updated_at)
  const normalizedEmails = agentEmails.map(e => e.toLowerCase().trim());
  
  // Process in batches to avoid query size limits
  for (let i = 0; i < normalizedEmails.length; i += 500) {
    const chunk = normalizedEmails.slice(i, i + 500);
    
    const { data: rows, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('agent_email')
      .eq('transaction_type', 'connect')
      .gte('transaction_date', start.toISOString())
      .lt('transaction_date', end.toISOString())
      .in('agent_email', chunk)
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    if (error) {
      console.error('❌ Error fetching connects from billing_transactions:', error);
      continue;
    }

    for (const row of rows || []) {
      const email = String((row as any).agent_email || '').toLowerCase().trim();
      if (email && normalizedEmails.includes(email)) {
        map.set(email, (map.get(email) || 0) + 1);
      }
    }
  }
  
  return map;
}

/** Max rows to scan for raw totals (avoids deploy/request timeouts on huge tables) */
const RAW_TOTALS_ROW_CAP = 60_000;

/**
 * Get TOTAL counts from data tables for the date range — NO agent/hierarchy filter.
 * Used for AOI card top-level totals so the numbers are company-wide.
 * Uses count queries for billing; caps pagination for twilio/agent_dial_metrics to avoid timeouts.
 */
async function getRawTotalsForDateRange(start: Date, end: Date): Promise<{
  dials: number;
  reach: number;
  booked: number;
  instant: number;
  connects: number;
  missedCalls: number;
}> {
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  let totalConnects = 0;
  let totalMissedCalls = 0;

  const { count: connectCount } = await supabaseAdmin
    .from('billing_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', 'connect')
    .gte('transaction_date', startIso)
    .lt('transaction_date', endIso);
  totalConnects = connectCount ?? 0;

  const { count: missedCount } = await supabaseAdmin
    .from('billing_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', 'missed_call')
    .gte('created_at', startIso)
    .lt('created_at', endIso);
  totalMissedCalls = missedCount ?? 0;

  const pageSize = 1000;
  const bookedSet = new Set<string>();
  for (let from = 0; from < RAW_TOTALS_ROW_CAP; from += pageSize) {
    const { data: rows, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email,lead_phone')
      .eq('event_type', 'booked')
      .gte('event_timestamp', startIso)
      .lt('event_timestamp', endIso)
      .range(from, from + pageSize - 1);
    if (error) break;
    for (const row of rows || []) {
      const phone = String((row as any).lead_phone || '').replace(/\D/g, '').slice(-10);
      if (phone.length === 10) bookedSet.add(phone);
    }
    if ((rows || []).length < pageSize) break;
  }

  const dialSeen = new Map<string, number>();
  const reachSeen = new Set<string>();
  const instantSeen = new Set<string>();
  let totalDials = 0;
  let totalReach = 0;
  let totalInstant = 0;

  for (let from = 0; from < RAW_TOTALS_ROW_CAP; from += pageSize) {
    const { data: rows, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email,to_number,call_started_at,call_duration,call_status')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startIso)
      .lt('call_started_at', endIso)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) break;
    for (const row of rows || []) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = String((row as any).to_number || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10) continue;
      const status = String((row as any).call_status || '').toLowerCase();
      const duration = Number((row as any).call_duration || 0);
      const answeredOrCompleted = status === 'answered' || status === 'completed';
      const excluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !answeredOrCompleted;
      if (excluded) continue;
      const ts = new Date(String((row as any).call_started_at));
      const key = `${email}:${phone}`;
      if (duration >= 1 || answeredOrCompleted) {
        const lastTs = dialSeen.get(key);
        if (!lastTs || ts.getTime() - lastTs >= 5 * 60 * 1000) {
          dialSeen.set(key, ts.getTime());
          totalDials++;
        }
      }
      if (duration >= 55 && answeredOrCompleted && !reachSeen.has(key)) {
        reachSeen.add(key);
        totalReach++;
      }
      if (duration >= 600 && answeredOrCompleted && !instantSeen.has(key)) {
        instantSeen.add(key);
        totalInstant++;
      }
    }
    if ((rows || []).length < pageSize) break;
  }

  return {
    dials: totalDials,
    reach: totalReach,
    booked: bookedSet.size,
    instant: totalInstant,
    connects: totalConnects,
    missedCalls: totalMissedCalls,
  };
}

async function getMissedCallsByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (agentEmails.length === 0) return map;

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('agent_email,transaction_type,created_at')
      .eq('transaction_type', 'missed_call')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const a = String((row as any).agent_email || '').toLowerCase().trim();
      const email = agentEmails.includes(a) ? a : '';
      if (!email) continue;
      map.set(email, (map.get(email) || 0) + 1);
    }
    if (rows.length < pageSize) break;
  }
  return map;
}

export async function getBookedByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const byEmail = new Map<string, Set<string>>();
  if (agentEmails.length === 0) return new Map<string, number>();

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone')
      .eq('event_type', 'booked')
      .gte('event_timestamp', start.toISOString())
      .lt('event_timestamp', end.toISOString())
      .in('agent_email', agentEmails)
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`❌ Error paginating booked data (offset ${from}):`, error);
      throw error;
    }
    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).agent_email || '').toLowerCase().trim();
      const phone = String((row as any).lead_phone || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10) continue;
      if (!byEmail.has(email)) byEmail.set(email, new Set<string>());
      byEmail.get(email)!.add(phone);
    }
    if (rows.length < pageSize) break;
  }

  const out = new Map<string, number>();
  for (const [email, phones] of byEmail.entries()) out.set(email, phones.size);
  return out;
}

async function getInstantByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const byEmail = new Map<string, Set<string>>();
  if (agentEmails.length === 0) return new Map<string, number>();

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email,to_number,call_duration,call_status')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', start.toISOString())
      .lt('call_started_at', end.toISOString())
      .gte('call_duration', 600)
      .in('call_status', ['answered', 'completed'])
      .in('owner_email', agentEmails)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`❌ Error paginating instant data (offset ${from}):`, error);
      throw error;
    }
    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = String((row as any).to_number || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10) continue;
      if (!byEmail.has(email)) byEmail.set(email, new Set<string>());
      byEmail.get(email)!.add(phone);
    }
    if (rows.length < pageSize) break;
  }

  const out = new Map<string, number>();
  for (const [email, phones] of byEmail.entries()) out.set(email, phones.size);
  return out;
}

async function getUsageMinutesByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data: rows } = await supabaseAdmin
    .from('agent_activity_log')
    .select('agent_email, activity_type')
    .in('agent_email', agentEmails)
    .gte('timestamp', start.toISOString())
    .lt('timestamp', end.toISOString())
    .eq('activity_type', 'heartbeat');

  for (const row of rows || []) {
    const email = String((row as any).agent_email || '').toLowerCase().trim();
    if (!email) continue;
    map.set(email, (map.get(email) || 0) + 1);
  }
  return map;
}

export async function getDialsByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (agentEmails.length === 0) return map;

  const normalizedEmails = agentEmails.map(e => e.toLowerCase().trim());
  const dialSeen = new Map<string, number>(); // email:phone -> last timestamp

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email, to_number, call_started_at, call_duration, call_status, call_direction')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', start.toISOString())
      .lt('call_started_at', end.toISOString())
      .in('owner_email', normalizedEmails)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`❌ Error paginating dials data (offset ${from}):`, error);
      break;
    }

    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = String((row as any).to_number || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10 || !normalizedEmails.includes(email)) continue;

      const status = String((row as any).call_status || '').toLowerCase();
      const duration = Number((row as any).call_duration || 0);
      const answeredOrCompleted = status === 'answered' || status === 'completed';
      const excluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !answeredOrCompleted;
      if (excluded) continue;

      const ts = new Date(String((row as any).call_started_at));
      const key = `${email}:${phone}`;
      const lastTs = dialSeen.get(key);
      
      // Count as dial if duration >= 1 or answered/completed, and it's been at least 5 minutes since last dial to same number
      if ((duration >= 1 || answeredOrCompleted) && (!lastTs || ts.getTime() - lastTs >= 5 * 60 * 1000)) {
        dialSeen.set(key, ts.getTime());
        map.set(email, (map.get(email) || 0) + 1);
      }
    }
    if (rows.length < pageSize) break;
  }

  return map;
}

export async function getReachByAgent(agentEmails: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (agentEmails.length === 0) return map;

  const normalizedEmails = agentEmails.map(e => e.toLowerCase().trim());
  const reachSeen = new Set<string>(); // email:phone

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email, to_number, call_started_at, call_duration, call_status, call_direction')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', start.toISOString())
      .lt('call_started_at', end.toISOString())
      .in('owner_email', normalizedEmails)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`❌ Error paginating reach data (offset ${from}):`, error);
      break;
    }

    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = String((row as any).to_number || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10 || !normalizedEmails.includes(email)) continue;

      const status = String((row as any).call_status || '').toLowerCase();
      const duration = Number((row as any).call_duration || 0);
      const answeredOrCompleted = status === 'answered' || status === 'completed';
      
      // Count as reach if duration >= 55 seconds and answered/completed
      if (duration >= 55 && answeredOrCompleted) {
        const key = `${email}:${phone}`;
        if (!reachSeen.has(key)) {
          reachSeen.add(key);
          map.set(email, (map.get(email) || 0) + 1);
        }
      }
    }
    if (rows.length < pageSize) break;
  }

  return map;
}

async function getLiveCallBoardStatsByAgent(agentEmails: string[]): Promise<Map<string, {
  dials: number;
  reach: number;
  booked: number;
  instant: number;
  connects: number;
  status: string;
  updatedAt?: string;
  agentName?: string;
}>> {
  const map = new Map<string, {
    dials: number;
    reach: number;
    booked: number;
    instant: number;
    connects: number;
    status: string;
    updatedAt?: string;
    agentName?: string;
  }>();
  if (agentEmails.length === 0) return map;

  const { data: rows } = await supabaseAdmin
    .from('live_call_boardt')
    .select('agent_email,agent_name,status,today_dialed,today_reached,today_booked,today_instant_presentation,today_connects,updated_at')
    .in('agent_email', agentEmails);

  for (const row of rows || []) {
    const email = String((row as any).agent_email || '').toLowerCase().trim();
    if (!email) continue;
    map.set(email, {
      dials: Number((row as any).today_dialed || 0),
      reach: Number((row as any).today_reached || 0),
      booked: Number((row as any).today_booked || 0),
      instant: Number((row as any).today_instant_presentation || 0),
      connects: Number((row as any).today_connects || 0),
      status: String((row as any).status || '').toLowerCase(),
      updatedAt: String((row as any).updated_at || ''),
      agentName: String((row as any).agent_name || ''),
    });
  }
  return map;
}

async function buildWeightedPointIncrements(agentEmails: string[], start: Date, end: Date, bucketMs = 5 * 60 * 1000): Promise<number[]> {
  const bucketCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / bucketMs));
  const increments = new Array<number>(bucketCount).fill(0);
  if (agentEmails.length === 0) return increments;

  const dialLastAt = new Map<string, number>();
  const reachedSeen = new Set<string>();
  const instantSeen = new Set<string>();
  const bookedSeen = new Set<string>();

  const bucketIndex = (ts: Date): number => Math.max(0, Math.min(bucketCount - 1, Math.floor((ts.getTime() - start.getTime()) / bucketMs)));

  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email,to_number,call_status,call_duration,call_started_at')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', start.toISOString())
      .lt('call_started_at', end.toISOString())
      .in('owner_email', agentEmails)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = String((row as any).to_number || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10) continue;
      const status = String((row as any).call_status || '').toLowerCase();
      const duration = Number((row as any).call_duration || 0);
      const answeredOrCompleted = status === 'answered' || status === 'completed';
      const excluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !answeredOrCompleted;
      if (excluded) continue;
      const ts = new Date(String((row as any).call_started_at));
      const idx = bucketIndex(ts);
      const key = `${email}:${phone}`;

      if (duration >= 1 || answeredOrCompleted) {
        const lastTs = dialLastAt.get(key);
        if (!lastTs || ts.getTime() - lastTs >= 5 * 60 * 1000) {
          dialLastAt.set(key, ts.getTime());
          increments[idx] += 1; // dials
        }
      }
      if (duration >= 55 && answeredOrCompleted && !reachedSeen.has(key)) {
        reachedSeen.add(key);
        increments[idx] += 10; // reach
      }
      if (duration >= 600 && answeredOrCompleted && !instantSeen.has(key)) {
        instantSeen.add(key);
        increments[idx] += 80; // instant
      }
    }
    if (rows.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email,lead_phone,event_timestamp')
      .eq('event_type', 'booked')
      .gte('event_timestamp', start.toISOString())
      .lt('event_timestamp', end.toISOString())
      .in('agent_email', agentEmails)
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).agent_email || '').toLowerCase().trim();
      const phone = String((row as any).lead_phone || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10) continue;
      const key = `${email}:${phone}`;
      if (bookedSeen.has(key)) continue;
      bookedSeen.add(key);
      const ts = new Date(String((row as any).event_timestamp || start.toISOString()));
      const idx = bucketIndex(ts);
      increments[idx] += 40; // booked
    }
    if (rows.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('vdp_calls')
      .select('company_email,agent,updated_at')
      .gte('updated_at', start.toISOString())
      .lt('updated_at', end.toISOString())
      .order('updated_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const c = String((row as any).company_email || '').toLowerCase().trim();
      if (!agentEmails.includes(c)) continue;
      const ts = new Date(String((row as any).updated_at || start.toISOString()));
      const idx = bucketIndex(ts);
      increments[idx] += 25; // connects
    }
    if (rows.length < pageSize) break;
  }

  return increments;
}

async function getPaceDeltaSeries(agentEmails: string[], now = new Date()): Promise<{ labels: string[]; series: number[]; paceDeltaPct: number }> {
  const bucketMs = 5 * 60 * 1000;
  const todayWindow = getDailyBusinessWindow(now);
  const bucketCount = Math.max(1, Math.floor((todayWindow.end.getTime() - todayWindow.start.getTime()) / bucketMs)); // 144
  const todayIncrements = await buildWeightedPointIncrements(agentEmails, todayWindow.start, todayWindow.end, bucketMs);

  const prevYmd = previousBusinessDayYmd(todayWindow.ymd);
  const prevStart = getLaUtcForYmdTime(prevYmd, 9, 0);
  const prevEnd = getLaUtcForYmdTime(prevYmd, 21, 0);
  const prevIncrements = await buildWeightedPointIncrements(agentEmails, prevStart, prevEnd, bucketMs);
  const baselineTotal = prevIncrements.reduce((s, v) => s + v, 0);

  const nowClamped = new Date(Math.min(Math.max(now.getTime(), todayWindow.start.getTime()), todayWindow.end.getTime()));
  const elapsedBuckets = Math.max(1, Math.min(bucketCount, Math.ceil((nowClamped.getTime() - todayWindow.start.getTime()) / bucketMs)));
  const expectedPerBucket = baselineTotal / bucketCount;

  const labels: string[] = [];
  const series: number[] = [];
  let cumulativeActual = 0;
  // Only generate data up to the current time (elapsedBuckets), not the full day
  for (let i = 0; i < elapsedBuckets; i++) {
    const t = new Date(todayWindow.start.getTime() + (i * bucketMs));
    const shouldLabel = i === 0 || i === elapsedBuckets - 1 || t.getMinutes() % 60 === 0;
    labels.push(shouldLabel ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '');

    cumulativeActual += (todayIncrements[i] || 0);
    const expected = expectedPerBucket * (i + 1);
    const delta = cumulativeActual - expected;
    series.push(Number(delta.toFixed(2)));
  }

  const expectedNow = expectedPerBucket * elapsedBuckets;
  const paceDeltaPct = expectedNow > 0 ? ((cumulativeActual - expectedNow) / expectedNow) * 100 : 0;
  return { labels, series, paceDeltaPct: Number(paceDeltaPct.toFixed(1)) };
}

async function getWeeklyAlp(agentEmails: string[], now: Date): Promise<{ currentWeek: number; previousWeek: number }> {
  const thisWeek = getPstWeekRange(now);
  const prevWeekStart = new Date(thisWeek.start);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(thisWeek.start);

  const sumBetween = async (start: Date, end: Date): Promise<number> => {
    const { data } = await supabaseAdmin
      .from('billing_transactions')
      .select('amount,agent_email,created_at')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    let total = 0;
    for (const row of data || []) {
      const a = String((row as any).agent_email || '').toLowerCase().trim();
      if (!agentEmails.includes(a)) continue;
      total += Number((row as any).amount || 0);
    }
    return Math.round(total);
  };

  return {
    currentWeek: await sumBetween(thisWeek.start, thisWeek.end),
    previousWeek: await sumBetween(prevWeekStart, prevWeekEnd),
  };
}

export async function createRunRecord(scopeKey: string): Promise<number> {
  await ensureReportTables();
  const result = await pool.query(
    `INSERT INTO activity_card_runs (scope_key, status) VALUES ($1, 'started') RETURNING id`,
    [scopeKey]
  );
  return Number(result.rows[0].id);
}

export async function updateRunRecord(runId: number, updates: {
  status?: string;
  generatedImagePath?: string;
  generatedImageUrl?: string;
  payload?: unknown;
  agentRanks?: Record<string, number>;
  errorMessage?: string;
}): Promise<void> {
  await ensureReportTables();
  await pool.query(
    `UPDATE activity_card_runs
     SET status = COALESCE($2, status),
         generated_image_path = COALESCE($3, generated_image_path),
         generated_image_url = COALESCE($4, generated_image_url),
         payload_json = COALESCE($5::jsonb, payload_json),
         agent_ranks = COALESCE($6::jsonb, agent_ranks),
         error_message = COALESCE($7, error_message)
     WHERE id = $1`,
    [
      runId,
      updates.status || null,
      updates.generatedImagePath || null,
      updates.generatedImageUrl || null,
      updates.payload ? JSON.stringify(updates.payload) : null,
      updates.agentRanks ? JSON.stringify(updates.agentRanks) : null,
      updates.errorMessage || null,
    ]
  );
}

export async function createDeliveryRecord(runId: number, recipient: Recipient, channel: 'email' | 'mms'): Promise<number> {
  await ensureReportTables();
  const result = await pool.query(
    `INSERT INTO activity_card_deliveries
     (run_id, recipient_email, recipient_phone, recipient_role, channel, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [runId, recipient.email || null, recipient.phone || null, recipient.role, channel]
  );
  return Number(result.rows[0].id);
}

export async function updateDeliveryRecord(deliveryId: number, updates: {
  status?: string;
  providerSid?: string;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  await ensureReportTables();
  await pool.query(
    `UPDATE activity_card_deliveries
     SET status = COALESCE($2, status),
         provider_sid = COALESCE($3, provider_sid),
         error_code = COALESCE($4, error_code),
         error_message = COALESCE($5, error_message),
         updated_at = NOW()
     WHERE id = $1`,
    [deliveryId, updates.status || null, updates.providerSid || null, updates.errorCode || null, updates.errorMessage || null]
  );
}

export async function resolveChrisRecipients(): Promise<{ scope: ReportScope; recipients: Recipient[] }> {
  const scope = await getChrisScope();
  const identity = await getAgentIdentity(scope.agentEmails);
  const recipients: Recipient[] = [];

  for (const email of scope.agentEmails) {
    const id = identity.get(email);
    if (!id) continue;
    recipients.push({
      email: id.companyEmail || email,
      phone: id.phone,
      role: email === scope.managerEmail ? 'manager' : 'agent',
      agentEmail: email,
      fullName: id.fullName,
    });
  }

  return { scope, recipients };
}

const RAW_TOTALS_TIMEOUT_MS = 8000;

/**
 * Get company-wide totals for the date range (with timeout). For use by routes that need
 * the top row only without building a full payload per owner (e.g. AOI exact-html).
 */
export async function getCompanyWideTotalsWithTimeout(): Promise<{
  dials: number;
  reach: number;
  booked: number;
  instant: number;
  connects: number;
  missedCalls: number;
} | null> {
  const now = new Date();
  const { start, end } = getPstDayRange(now);
  try {
    return await Promise.race([
      getRawTotalsForDateRange(start, end),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RAW_TOTALS_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

export async function buildActivityCardPayload(scope?: ReportScope): Promise<ActivityCardPayloadData> {
  const effectiveScope = scope || await getChrisScope();
  const now = new Date();
  const { start, end } = getPstDayRange(now);

  let rawTotals: { dials: number; reach: number; booked: number; instant: number; connects: number; missedCalls: number } | null = null;
  try {
    rawTotals = await Promise.race([
      getRawTotalsForDateRange(start, end),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Raw totals timeout')), RAW_TOTALS_TIMEOUT_MS)),
    ]);
  } catch (_) {
    rawTotals = null;
  }

  const lcbMap = await getLiveCallBoardStatsByAgent(effectiveScope.agentEmails);
  const identity = await getAgentIdentity(effectiveScope.agentEmails);
  const usageMap = await getUsageMinutesByAgent(effectiveScope.agentEmails, start, end);
  const dialsMap = await getDialsByAgent(effectiveScope.agentEmails, start, end);
  const reachMap = await getReachByAgent(effectiveScope.agentEmails, start, end);
  const bookedMap = await getBookedByAgent(effectiveScope.agentEmails, start, end);
  const instantMap = await getInstantByAgent(effectiveScope.agentEmails, start, end);
  const connectsMap = await getConnectsByAgent(effectiveScope.agentEmails, start, end);
  const missedCallsMap = await getMissedCallsByAgent(effectiveScope.agentEmails, start, end);

  const { rows: prevRuns } = await pool.query(
    `SELECT payload_json, agent_ranks FROM activity_card_runs
     WHERE scope_key = $1 AND status = 'completed'
     ORDER BY run_at DESC LIMIT 1`,
    [effectiveScope.scopeKey]
  ).catch(() => ({ rows: [] as any[] }));
  const prevPayload = prevRuns[0]?.payload_json || null;
  const prevRanks = (prevRuns[0]?.agent_ranks || {}) as Record<string, number>;

  const agentsRaw: ActivityCardAgentData[] = effectiveScope.agentEmails.map((email) => {
    const stat = lcbMap.get(email);
    const id = identity.get(email);
    // Use date-filtered queries instead of live_call_boardt stats
    const dials = Number(dialsMap.get(email) ?? 0);
    const reach = Number(reachMap.get(email) ?? 0);
    const booked = Number(bookedMap.get(email) ?? 0);
    const instant = Number(instantMap.get(email) ?? 0);
    const connects = Number(connectsMap.get(email) ?? 0);
    const missedCalls = Number(missedCallsMap.get(email) ?? 0);
    const aoiUsage = Number(usageMap.get(email) || 0);

    const prevAgent = (prevPayload?.agents || []).find((a: any) => String(a?.name || '').toLowerCase() === String(id?.fullName || '').toLowerCase());
    const dialsDelta = pctChange(dials, Number(prevAgent?.dials || 0));
    const reachDelta = pctChange(reach, Number(prevAgent?.reach || 0));
    const bookedDelta = pctChange(booked, Number(prevAgent?.booked || 0));
    const instantDelta = pctChange(instant, Number(prevAgent?.instant || 0));
    const connectsDelta = pctChange(connects, Number(prevAgent?.connects || 0));
    const missedCallsDelta = pctChange(missedCalls, Number(prevAgent?.missedCalls || 0));
    const usageDelta = pctChange(aoiUsage, Number(prevAgent?.aoiUsage || 0));

    return {
      rank: 0,
      rankChange: 0,
      name: id?.fullName || stat?.agentName || effectiveScope.hierarchyNameByEmail?.[email] || email,
      photoUrl: id?.photo,
      isLive: stat ? stat.status !== 'offline' : false,
      dials,
      dialsPct: Math.abs(dialsDelta.pct),
      dialsTrend: dialsDelta.trend,
      reach,
      reachPct: Math.abs(reachDelta.pct),
      reachTrend: reachDelta.trend,
      booked,
      bookedPct: Math.abs(bookedDelta.pct),
      bookedTrend: bookedDelta.trend,
      instant,
      instantPct: Math.abs(instantDelta.pct),
      instantTrend: instantDelta.trend,
      connects,
      connectsPct: Math.abs(connectsDelta.pct),
      connectsTrend: connectsDelta.trend,
      missedCalls,
      missedCallsPct: Math.abs(missedCallsDelta.pct),
      missedCallsTrend: missedCallsDelta.trend,
      aoiUsage,
      aoiUsagePct: Math.abs(usageDelta.pct),
      aoiUsageTrend: usageDelta.trend,
    };
  });

  const agentsWithActivity = agentsRaw.filter((a) =>
    a.dials > 0 || a.reach > 0 || a.booked > 0 || a.instant > 0 || a.connects > 0 || a.missedCalls > 0
  );

  agentsWithActivity.sort((a, b) => {
    const scoreDiff = performanceScore(b) - performanceScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    if (b.booked !== a.booked) return b.booked - a.booked;
    if (b.reach !== a.reach) return b.reach - a.reach;
    return b.dials - a.dials;
  });

  const agentRanks: Record<string, number> = {};
  agentsWithActivity.forEach((a, i) => {
    const rank = i + 1;
    a.rank = rank;
    const key = a.name.toLowerCase();
    agentRanks[key] = rank;
    const previousRank = Number(prevRanks[key] || rank);
    a.rankChange = previousRank - rank;
  });

  // Top-level totals: use raw (all-data) when available and fast; else hierarchy sum so we never block/timeout
  const hierarchySum = {
    dials: agentsWithActivity.reduce((s, a) => s + a.dials, 0),
    reach: agentsWithActivity.reduce((s, a) => s + a.reach, 0),
    booked: agentsWithActivity.reduce((s, a) => s + a.booked, 0),
    instant: agentsWithActivity.reduce((s, a) => s + a.instant, 0),
    connects: agentsWithActivity.reduce((s, a) => s + a.connects, 0),
    missedCalls: agentsWithActivity.reduce((s, a) => s + a.missedCalls, 0),
  };
  const totalsNow = {
    activeAgents: agentsWithActivity.length,
    totalAgents: effectiveScope.agentEmails.length,
    dials: rawTotals?.dials ?? hierarchySum.dials,
    reach: rawTotals?.reach ?? hierarchySum.reach,
    booked: rawTotals?.booked ?? hierarchySum.booked,
    instant: rawTotals?.instant ?? hierarchySum.instant,
    connects: rawTotals?.connects ?? hierarchySum.connects,
    missedCalls: rawTotals?.missedCalls ?? hierarchySum.missedCalls,
    aoiUsage: Math.round(agentsWithActivity.reduce((s, a) => s + a.aoiUsage, 0) / Math.max(1, agentsWithActivity.length)),
  };

  const prevTotals = prevPayload?.totals || {};
  const dialsPct = pctChange(totalsNow.dials, Number(prevTotals.dials || 0));
  const reachPct = pctChange(totalsNow.reach, Number(prevTotals.reach || 0));
  const bookedPct = pctChange(totalsNow.booked, Number(prevTotals.booked || 0));
  const instantPct = pctChange(totalsNow.instant, Number(prevTotals.instant || 0));
  const connectsPct = pctChange(totalsNow.connects, Number(prevTotals.connects || 0));
  const missedCallsPct = pctChange(totalsNow.missedCalls, Number(prevTotals.missedCalls || 0));
  const usagePct = pctChange(totalsNow.aoiUsage, Number(prevTotals.aoiUsage || 0));
  const pace = await getPaceDeltaSeries(effectiveScope.agentEmails, now);
  const deltaPct = pace.paceDeltaPct;
  const alp = await getWeeklyAlp(effectiveScope.agentEmails, now);
  // Show ALL active agents, not just top 5 + bottom 5
  const displayAgents = agentsWithActivity;

  // EST Weekly Production: Use booked * 220 as the calculation (standard industry estimate)
  // Fallback to ALP if booked is 0 or ALP is higher
  const weeklyProductionEst = Math.max(
    Math.round(totalsNow.booked * 220),
    alp.currentWeek || 0
  );

  return {
    generatedAt: now.toISOString(),
    agencyName: 'AO Intelligence',
    totals: {
      activeAgents: totalsNow.activeAgents,
      totalAgents: totalsNow.totalAgents,
      dials: totalsNow.dials,
      dialsPct: Math.abs(dialsPct.pct),
      dialsTrend: dialsPct.trend,
      reach: totalsNow.reach,
      reachPct: Math.abs(reachPct.pct),
      reachTrend: reachPct.trend,
      booked: totalsNow.booked,
      bookedPct: Math.abs(bookedPct.pct),
      bookedTrend: bookedPct.trend,
      instant: totalsNow.instant,
      instantPct: Math.abs(instantPct.pct),
      instantTrend: instantPct.trend,
      connects: totalsNow.connects,
      connectsPct: Math.abs(connectsPct.pct),
      connectsTrend: connectsPct.trend,
      missedCalls: totalsNow.missedCalls,
      missedCallsPct: Math.abs(missedCallsPct.pct),
      missedCallsTrend: missedCallsPct.trend,
      aoiUsage: totalsNow.aoiUsage,
      aoiUsagePct: Math.abs(usagePct.pct),
      aoiUsageTrend: usagePct.trend,
      deltaPct,
      weeklyProductionEst,
      previousWeeksALP: alp.previousWeek || 89000,
    },
    chart: { labels: pace.labels, series: pace.series },
    agents: displayAgents,
  };
}

/**
 * Get ALL database totals (no hierarchy filtering) for the entire database
 * Used for AOI card top-level totals
 */
export async function getAllDatabaseTotals(): Promise<{
  activeAgents: number;
  totalAgents: number;
  dials: number;
  reach: number;
  booked: number;
  instant: number;
  connects: number;
  missedCalls: number;
  aoiUsage: number;
}> {
  const now = new Date();
  const { start, end } = getPstDayRange(now);
  
  // Get ALL agent emails from customers table (no hierarchy filter)
  const { data: allCustomers } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email')
    .or('company_email.not.is.null,personal_email.not.is.null')
    .limit(50000);
  
  const allAgentEmails = new Set<string>();
  (allCustomers || []).forEach(c => {
    const companyEmail = String(c.company_email || '').toLowerCase().trim();
    const personalEmail = String(c.personal_email || '').toLowerCase().trim();
    if (companyEmail && companyEmail.includes('@')) allAgentEmails.add(companyEmail);
    if (personalEmail && personalEmail.includes('@')) allAgentEmails.add(personalEmail);
  });
  
  const agentEmailsArray = Array.from(allAgentEmails);
  console.log(`📊 getAllDatabaseTotals: Found ${agentEmailsArray.length} total agents in database`);
  
  // Calculate totals for ALL agents
  const lcbMap = await getLiveCallBoardStatsByAgent(agentEmailsArray);
  const usageMap = await getUsageMinutesByAgent(agentEmailsArray, start, end);
  const bookedMap = await getBookedByAgent(agentEmailsArray, start, end);
  const instantMap = await getInstantByAgent(agentEmailsArray, start, end);
  const connectsMap = await getConnectsByAgent(agentEmailsArray, start, end);
  const missedCallsMap = await getMissedCallsByAgent(agentEmailsArray, start, end);
  
  let totalDials = 0;
  let totalReach = 0;
  let totalBooked = 0;
  let totalInstant = 0;
  let totalConnects = 0;
  let totalMissedCalls = 0;
  let totalAoiUsage = 0;
  let activeCount = 0;
  
  for (const email of agentEmailsArray) {
    const stat = lcbMap.get(email);
    const dials = Number(stat?.dials || 0);
    const reach = Number(stat?.reach || 0);
    const booked = Number(bookedMap.get(email) ?? stat?.booked ?? 0);
    const instant = Number(instantMap.get(email) ?? stat?.instant ?? 0);
    const connects = Number(connectsMap.get(email) ?? stat?.connects ?? 0);
    const missedCalls = Number(missedCallsMap.get(email) ?? 0);
    const aoiUsage = Number(usageMap.get(email) || 0);
    
    if (dials > 0 || reach > 0 || booked > 0 || instant > 0 || connects > 0) {
      activeCount++;
    }
    
    totalDials += dials;
    totalReach += reach;
    totalBooked += booked;
    totalInstant += instant;
    totalConnects += connects;
    totalMissedCalls += missedCalls;
    totalAoiUsage += aoiUsage;
  }
  
  const avgAoiUsage = activeCount > 0 ? Math.round(totalAoiUsage / activeCount) : 0;
  
  return {
    activeAgents: activeCount,
    totalAgents: agentEmailsArray.length,
    dials: totalDials,
    reach: totalReach,
    booked: totalBooked,
    instant: totalInstant,
    connects: totalConnects,
    missedCalls: totalMissedCalls,
    aoiUsage: avgAoiUsage,
  };
}

