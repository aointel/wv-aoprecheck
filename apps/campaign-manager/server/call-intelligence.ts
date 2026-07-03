/**
 * Call Intelligence — post-call scoring & Gong-style analytics
 * Ported into AOI Command (TaalkCenterTracker). Scores calls from vdp_calls
 * in Supabase and stores results in call_intelligence table.
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } from './hardcoded-config.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const SCORECARDS_FILE = join(DATA_DIR, 'scorecards.json');
const COACHING_NOTES_FILE = join(DATA_DIR, 'coaching_notes.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDataDir();
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Supabase fetch helpers ──
async function supaFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  return res;
}

// ── Types ──
export interface VdpCallRow {
  id: string | number;
  agent_email?: string;
  associate_id?: number;
  duration_seconds?: number;
  cnresolution?: string;
  time?: string;
  firstName?: string;
  lastName?: string;
  mga?: string;
  market?: string;
}

interface ScoredCall {
  vdp_call_id: string;
  agent_email: string;
  associate_id: number | null;
  call_date: string | null;
  duration_seconds: number;
  cnresolution: string;
  intro_score: number;
  converted: boolean;
  outcome_grade: string;
  ai_summary: string;
  talk_ratio_estimate: number;
  flags: string[];
  ai_raw: any;
  processed_at: string;
  market?: string | null;
}

// ── Scoring logic ──
function computeIntroScore(dur: number): number {
  if (dur < 30) return 2;
  if (dur < 90) return 4;
  if (dur < 180) return 6;
  if (dur < 300) return 8;
  return 10;
}

function computeConverted(res: string): boolean {
  return ['booked', 'appointment_set', 'sold'].includes(res);
}

function computeGrade(res: string, dur: number): string {
  const converted = computeConverted(res);
  if (converted && dur > 180) return 'A';
  if (converted) return 'B';
  if ((res === 'in_progress' || res === 'callback_requested' || res === 'thinker') && dur > 180) return 'B';
  if (res === 'in_progress' || res === 'callback_requested' || res === 'thinker') return 'C';
  if (res === 'cannot_afford' && dur > 120) return 'C'; // long objection call — agent engaged
  if (dur < 30) return 'F';
  return 'D';
}

function computeFlags(res: string, dur: number): string[] {
  const flags: string[] = [];
  if (dur < 30) flags.push('short_call');
  if (computeConverted(res)) flags.push('converted');
  if (['no_answer', 'not_home'].includes(res)) flags.push('no_answer');
  if (res === 'callback_requested') flags.push('callback');
  if (res === 'do_not_call') flags.push('dnc');
  if (dur > 300) flags.push('long_call');
  return flags;
}

function buildFallbackSummary(call: VdpCallRow, grade: string, converted: boolean): string {
  const dur = call.duration_seconds || 0;
  const name = [call.firstName, call.lastName].filter(Boolean).join(' ') || 'prospect';
  const res = call.cnresolution || 'unresolved';
  const durStr = dur >= 60 ? `${Math.round(dur / 60)}m` : `${dur}s`;
  if (converted) return `Agent connected with ${name} for ${durStr} and set an appointment (Grade ${grade}).`;
  if (res === 'callback_requested') return `Agent spoke with ${name} for ${durStr}; callback requested (Grade ${grade}).`;
  if (dur < 30) return `Very brief contact with ${name} lasting ${durStr}; no meaningful engagement (Grade ${grade}).`;
  return `Agent contacted ${name} for ${durStr} — outcome: ${res} (Grade ${grade}).`;
}

async function getAiSummary(call: VdpCallRow, grade: string, converted: boolean): Promise<{ summary: string; raw: any }> {
  if (!OPENAI_API_KEY) {
    return { summary: buildFallbackSummary(call, grade, converted), raw: null };
  }
  try {
    const dur = call.duration_seconds || 0;
    const prompt = `You are a call quality analyst for an insurance sales team. Summarize this call in 1-2 plain English sentences for a manager dashboard.

Call data:
- Agent: ${call.agent_email}
- Prospect: ${[call.firstName, call.lastName].filter(Boolean).join(' ') || 'Unknown'}
- Market: ${call.market || 'Unknown'}
- MGA: ${call.mga || 'Unknown'}
- Duration: ${dur} seconds
- Resolution: ${call.cnresolution || 'none'}
- Grade: ${grade}
- Converted: ${converted}

Write a concise 1-2 sentence summary of what happened on this call. Be factual and professional.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a call quality analyst. Respond with a brief factual summary only.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.3,
      }),
    });
    const data: any = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return { summary: content.trim(), raw: { model: 'gpt-4o-mini', usage: data.usage } };
  } catch (e) {
    console.warn('[CallIntelligence] OpenAI failed, using fallback:', e);
  }
  return { summary: buildFallbackSummary(call, grade, converted), raw: null };
}

// ── Score a single call and upsert to call_intelligence ──
export async function scoreCall(call: VdpCallRow): Promise<void> {
  try {
    const dur = call.duration_seconds || 0;
    const res = call.cnresolution || '';
    const grade = computeGrade(res, dur);
    const converted = computeConverted(res);
    const { summary, raw } = await getAiSummary(call, grade, converted);

    const record: ScoredCall = {
      vdp_call_id: String(call.id),
      agent_email: call.agent_email || '',
      associate_id: call.associate_id || null,
      call_date: call.time || new Date().toISOString(),
      duration_seconds: dur,
      cnresolution: res,
      intro_score: computeIntroScore(dur),
      converted,
      outcome_grade: grade,
      ai_summary: summary,
      talk_ratio_estimate: dur > 0 ? Math.min(0.6 + (dur / 600) * 0.3, 0.9) : 0,
      flags: computeFlags(res, dur),
      ai_raw: raw,
      processed_at: new Date().toISOString(),
      market: call.market != null && String(call.market).trim() !== '' ? String(call.market) : null,
    };

    const r = await supaFetch('/call_intelligence', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(record),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.warn('[CallIntelligence] upsert failed:', txt);
    } else {
      console.log(`[CallIntelligence] scored call ${call.id} → Grade ${grade}`);
    }
  } catch (e) {
    console.warn('[CallIntelligence] scoreCall error:', e);
  }
}

// ── Query helpers ──
export const GRADE_MAP: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
export const REVERSE_GRADE: Record<number, string> = { 4: 'A', 3: 'B', 2: 'C', 1: 'D', 0: 'F' };

export type CallIntelSegment = 'sales' | 'recruit';

/** Aligns with Activity Tracker tabs: recruit = AO Recruit / RMS style markets; sales = everything else. */
export function isRecruitSegmentMarket(m: string | null | undefined): boolean {
  const raw = String(m || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  const compact = raw.replace(/\s/g, '');
  if (compact.includes('aorecruit')) return true;
  if (raw.includes('ao recruit')) return true;
  if (raw === 'recruit') return true;
  if (raw === 'rms' || raw.startsWith('rms ') || raw.endsWith(' rms') || raw.includes(' rms') || raw === 'ao rms') return true;
  if (raw.includes('ao rms')) return true;
  return false;
}

async function fetchVdpMarketsByCallIds(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const CHUNK = 50;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const q = chunk.map((id) => encodeURIComponent(id)).join(',');
    const r = await supaFetch(`/vdp_calls?select=id,market&id=in.(${q})`);
    if (!r.ok) continue;
    const rows: any[] = (await r.json()) || [];
    for (const row of rows) {
      if (row?.id != null && row.market != null) map.set(String(row.id), String(row.market));
    }
  }
  return map;
}

async function enrichRowsWithVdpMarket(
  rows: any[],
  opts?: { segment?: CallIntelSegment },
): Promise<any[]> {
  const seg = opts?.segment;
  const forSegment = seg === 'recruit' || seg === 'sales';
  const need = [
    ...new Set(
      forSegment
        ? rows.filter((row) => row?.vdp_call_id).map((row) => String(row.vdp_call_id))
        : rows
            .filter((row) => row && String(row.market ?? '').trim() === '' && row.vdp_call_id)
            .map((row) => String(row.vdp_call_id)),
    ),
  ];
  if (!need.length) return rows;
  const mm = await fetchVdpMarketsByCallIds(need);
  if (!mm.size) return rows;
  return rows.map((row) => {
    const id = String(row.vdp_call_id || '');
    const fromVdp = mm.get(id);
    if (!forSegment) {
      if (String(row.market ?? '').trim() !== '') return row;
      return fromVdp != null ? { ...row, market: fromVdp } : row;
    }
    const ciM = String(row.market ?? '').trim();
    const merged = ciM || (fromVdp != null ? String(fromVdp) : '');
    return merged ? { ...row, market: merged } : row;
  });
}

function filterRowsBySegment(rows: any[], segment: CallIntelSegment): any[] {
  if (segment === 'recruit') return rows.filter((row) => isRecruitSegmentMarket(row.market));
  return rows.filter((row) => !isRecruitSegmentMarket(row.market));
}

export async function getAgentCalls(email: string, limit = 20, segment?: CallIntelSegment): Promise<any[]> {
  const pool =
    segment === 'recruit' || segment === 'sales' ? Math.min(800, Math.max(limit * 15, 120)) : limit;
  const r = await supaFetch(
    `/call_intelligence?agent_email=eq.${encodeURIComponent(email)}&order=call_date.desc&limit=${pool}&select=*`
  );
  if (!r.ok) return [];
  let rows: any[] = (await r.json()) || [];
  if (segment === 'recruit' || segment === 'sales') {
    rows = await enrichRowsWithVdpMarket(rows, { segment });
    rows = filterRowsBySegment(rows, segment);
  }
  return rows.slice(0, limit);
}

export async function getAgentStats(email: string, segment?: CallIntelSegment): Promise<any> {
  const r = await supaFetch(
    `/call_intelligence?agent_email=eq.${encodeURIComponent(email)}&select=outcome_grade,converted,call_date,vdp_call_id&limit=2000`
  );
  if (!r.ok) return { total_calls: 0, avg_grade: null, conversion_rate: 0, calls_this_week: 0 };
  let data: any[] = (await r.json()) || [];
  if (segment === 'recruit' || segment === 'sales') {
    data = await enrichRowsWithVdpMarket(data, { segment });
    data = filterRowsBySegment(data, segment);
  }
  if (data.length === 0) return { total_calls: 0, avg_grade: null, conversion_rate: 0, calls_this_week: 0 };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const callsThisWeek = data.filter(r => r.call_date && new Date(r.call_date) >= weekAgo).length;
  const totalGrade = data.reduce((s, r) => s + (GRADE_MAP[r.outcome_grade] ?? 1), 0);
  const avgNum = Math.round(totalGrade / data.length);

  return {
    total_calls: data.length,
    avg_grade: REVERSE_GRADE[avgNum] || 'D',
    conversion_rate: Math.round((data.filter(r => r.converted).length / data.length) * 100),
    calls_this_week: callsThisWeek,
  };
}

export async function getTeamScoreboard(mga?: string): Promise<any[]> {
  const q = mga
    ? `/call_intelligence?mga=eq.${encodeURIComponent(mga)}&select=agent_email,outcome_grade,converted,mga,call_date&limit=5000`
    : `/call_intelligence?select=agent_email,outcome_grade,converted,mga,call_date&limit=5000`;
  const r = await supaFetch(q);
  if (!r.ok) return [];
  const data: any[] = (await r.json()) || [];

  const byAgent: Record<string, { grades: number[]; conversions: number; total: number; lastCall: string }> = {};
  for (const row of data) {
    if (!row.agent_email) continue;
    if (!byAgent[row.agent_email]) byAgent[row.agent_email] = { grades: [], conversions: 0, total: 0, lastCall: '' };
    byAgent[row.agent_email].grades.push(GRADE_MAP[row.outcome_grade] ?? 1);
    if (row.converted) byAgent[row.agent_email].conversions++;
    byAgent[row.agent_email].total++;
    if (!byAgent[row.agent_email].lastCall || row.call_date > byAgent[row.agent_email].lastCall) {
      byAgent[row.agent_email].lastCall = row.call_date || '';
    }
  }

  return Object.entries(byAgent).map(([email, stats]) => {
    const avgNum = Math.round(stats.grades.reduce((a, b) => a + b, 0) / stats.grades.length);
    return {
      agent_email: email,
      total_calls: stats.total,
      avg_grade: REVERSE_GRADE[avgNum] || 'D',
      conversion_rate: Math.round((stats.conversions / stats.total) * 100),
      last_call: stats.lastCall,
    };
  }).sort((a, b) => b.conversion_rate - a.conversion_rate);
}

export async function getTeamStats(): Promise<any> {
  const r = await supaFetch('/call_intelligence?select=outcome_grade,converted,call_date&limit=10000');
  if (!r.ok) return {};
  const data: any[] = (await r.json()) || [];
  if (!data.length) return { total_calls: 0, avg_grade: 'N/A', conversion_rate: 0, calls_today: 0, calls_this_week: 0 };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const callsToday = data.filter(r => r.call_date?.startsWith(todayStr)).length;
  const callsThisWeek = data.filter(r => r.call_date && new Date(r.call_date) >= weekAgo).length;
  const totalGrade = data.reduce((s, r) => s + (GRADE_MAP[r.outcome_grade] ?? 1), 0);
  const avgNum = Math.round(totalGrade / data.length);

  return {
    total_calls: data.length,
    avg_grade: REVERSE_GRADE[avgNum] || 'D',
    conversion_rate: Math.round((data.filter(r => r.converted).length / data.length) * 100),
    calls_today: callsToday,
    calls_this_week: callsThisWeek,
  };
}

// ── Batch backfill: score recent vdp_calls not yet in call_intelligence ──
export async function backfillRecentCalls(limit = 200): Promise<{ scored: number; skipped: number }> {
  try {
    // Get recently scored IDs
    const scoredR = await supaFetch('/call_intelligence?select=vdp_call_id&limit=2000&order=processed_at.desc');
    const scoredIds = new Set<string>(scoredR.ok ? (await scoredR.json() as any[]).map((r: any) => String(r.vdp_call_id)) : []);

    // Fetch recent vdp_calls with duration (real column names: duration, agent, company_email)
    const callsR = await supaFetch(
      `/vdp_calls?select=id,company_email,agent,duration,cnresolution,time,firstName,lastName,mga,market,state&event=eq.END&cnresolution=not.is.null&order=time.desc&limit=${limit}`
    );
    if (!callsR.ok) return { scored: 0, skipped: 0 };
    const calls: any[] = (await callsR.json()) || [];

    let scored = 0; let skipped = 0;
    for (const call of calls) {
      if (scoredIds.has(String(call.id))) { skipped++; continue; }
      if (!call.company_email && !call.agent) { skipped++; continue; }
      await scoreCall({
        id: call.id,
        agent_email: call.company_email || '',
        associate_id: call.agent ? parseInt(call.agent) : undefined,
        duration_seconds: Math.round(parseFloat(call.duration) || 0),
        cnresolution: call.cnresolution,
        time: call.time,
        firstName: call.firstName,
        lastName: call.lastName,
        mga: call.mga,
        market: call.market,
      });
      scored++;
      await new Promise(r => setTimeout(r, 50));
    }
    return { scored, skipped };
  } catch (e) {
    console.warn('[CallIntelligence] backfill error:', e);
    return { scored: 0, skipped: 0 };
  }
}

// ── NEW: Agent Trend (last 4 weeks) ──
export async function getAgentTrend(email: string, segment?: CallIntelSegment): Promise<any[]> {
  const r = await supaFetch(
    `/call_intelligence?agent_email=eq.${encodeURIComponent(email)}&select=call_date,converted,outcome_grade,vdp_call_id&limit=2000&order=call_date.desc`
  );
  if (!r.ok) return [];
  let data: any[] = (await r.json()) || [];
  if (segment === 'recruit' || segment === 'sales') {
    data = await enrichRowsWithVdpMarket(data, { segment });
    data = filterRowsBySegment(data, segment);
  }

  const now = new Date();
  const weeks: { week_label: string; conversion_rate: number; total_calls: number; avg_grade_num: number }[] = [];

  for (let w = 3; w >= 0; w--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (w + 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - w * 7);
    end.setHours(23, 59, 59, 999);

    const weekData = data.filter(d => {
      if (!d.call_date) return false;
      const dt = new Date(d.call_date);
      return dt >= start && dt <= end;
    });

    const conversions = weekData.filter(d => d.converted).length;
    const gradeSum = weekData.reduce((s, d) => s + (GRADE_MAP[d.outcome_grade] ?? 1), 0);
    const avgGradeNum = weekData.length > 0 ? gradeSum / weekData.length : 0;

    const label = `W${4 - w}`;
    weeks.push({
      week_label: label,
      conversion_rate: weekData.length > 0 ? Math.round((conversions / weekData.length) * 100) : 0,
      total_calls: weekData.length,
      avg_grade_num: Math.round(avgGradeNum * 10) / 10,
    });
  }

  return weeks;
}

// ── NEW: Coaching Alerts ──
export async function getCoachingAlerts(): Promise<any[]> {
  const r = await supaFetch(
    '/call_intelligence?select=agent_email,call_date,converted,outcome_grade,cnresolution&limit=5000&order=call_date.desc'
  );
  if (!r.ok) return [];
  const data: any[] = (await r.json()) || [];

  const now = new Date();
  const day7ago = new Date(now); day7ago.setDate(day7ago.getDate() - 7);
  const day14ago = new Date(now); day14ago.setDate(day14ago.getDate() - 14);
  const day3ago = new Date(now); day3ago.setDate(day3ago.getDate() - 3);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);

  // Group by agent
  const agentMap: Record<string, any[]> = {};
  for (const row of data) {
    if (!row.agent_email) continue;
    if (!agentMap[row.agent_email]) agentMap[row.agent_email] = [];
    agentMap[row.agent_email].push(row);
  }

  const alerts: any[] = [];

  for (const [email, calls] of Object.entries(agentMap)) {
    const last7 = calls.filter(c => c.call_date && new Date(c.call_date) >= day7ago);
    const prior7 = calls.filter(c => {
      if (!c.call_date) return false;
      const d = new Date(c.call_date);
      return d >= day14ago && d < day7ago;
    });

    // Declining alert
    if (prior7.length >= 5) {
      const prior7Conv = prior7.filter(c => c.converted).length / prior7.length;
      const last7Conv = last7.length > 0 ? last7.filter(c => c.converted).length / last7.length : 0;
      if (last7Conv < prior7Conv * 0.6) {
        const pct = Math.round(prior7Conv * 100);
        const cur = Math.round(last7Conv * 100);
        alerts.push({
          agent_email: email,
          alert_type: 'declining',
          message: `Conversion dropped from ${pct}% → ${cur}% (last 7 days vs prior 7)`,
          severity: cur < prior7Conv * 0.4 * 100 ? 'critical' : 'warning',
        });
      }
    }

    // Consecutive F alert — last 5 scored calls all F
    const scored = calls.filter(c => c.outcome_grade && c.outcome_grade !== '');
    if (scored.length >= 5 && scored.slice(0, 5).every(c => c.outcome_grade === 'F')) {
      alerts.push({
        agent_email: email,
        alert_type: 'consecutive_f',
        message: 'Last 5 scored calls all received F grade',
        severity: 'critical',
      });
    }

    // High DNC alert
    const thisWeek = calls.filter(c => c.call_date && new Date(c.call_date) >= weekStart);
    if (thisWeek.length > 0) {
      const dncCount = thisWeek.filter(c => c.cnresolution === 'do_not_call').length;
      const dncRate = dncCount / thisWeek.length;
      if (dncRate > 0.15) {
        alerts.push({
          agent_email: email,
          alert_type: 'high_dnc',
          message: `${Math.round(dncRate * 100)}% DNC rate this week (${dncCount}/${thisWeek.length} calls)`,
          severity: dncRate > 0.25 ? 'critical' : 'warning',
        });
      }
    }

    // No activity alert
    const recentCalls = calls.filter(c => c.call_date && new Date(c.call_date) >= day3ago);
    if (recentCalls.length === 0 && calls.length > 0) {
      alerts.push({
        agent_email: email,
        alert_type: 'no_activity',
        message: 'No calls logged in the last 3 days',
        severity: 'warning',
      });
    }
  }

  return alerts;
}

// ── NEW: Leaderboard ──
export async function getLeaderboard(): Promise<any[]> {
  const r = await supaFetch(
    '/call_intelligence?select=agent_email,call_date,converted,outcome_grade,cnresolution&limit=5000&order=call_date.desc'
  );
  if (!r.ok) return [];
  const data: any[] = (await r.json()) || [];

  const now = new Date();
  const day7ago = new Date(now); day7ago.setDate(day7ago.getDate() - 7);
  const day14ago = new Date(now); day14ago.setDate(day14ago.getDate() - 14);

  const agentMap: Record<string, any[]> = {};
  for (const row of data) {
    if (!row.agent_email) continue;
    if (!agentMap[row.agent_email]) agentMap[row.agent_email] = [];
    agentMap[row.agent_email].push(row);
  }

  const result: any[] = [];

  for (const [email, calls] of Object.entries(agentMap)) {
    // Points
    let points = 0;
    for (const c of calls) {
      points += 10; // per call
      if (c.converted) points += 50;
      if (c.outcome_grade === 'A') points += 100;
      if (c.outcome_grade === 'F') points -= 20;
      if (c.cnresolution === 'do_not_call') points -= 50;
    }

    // Badge
    let badge: string;
    if (points < 500) badge = 'bronze';
    else if (points < 1500) badge = 'silver';
    else if (points < 3000) badge = 'gold';
    else badge = 'platinum';

    // Streak: consecutive calendar days going back from today where agent had >= 1 conversion
    const convDates = new Set(
      calls.filter(c => c.converted && c.call_date).map(c => new Date(c.call_date).toISOString().slice(0, 10))
    );
    let streakDays = 0;
    const checkDate = new Date(now);
    while (true) {
      const ds = checkDate.toISOString().slice(0, 10);
      if (convDates.has(ds)) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calls this week
    const callsThisWeek = calls.filter(c => c.call_date && new Date(c.call_date) >= day7ago).length;

    // Conversion rate (all time)
    const conversions = calls.filter(c => c.converted).length;
    const conversionRate = Math.round((conversions / calls.length) * 100);

    // Avg grade
    const gradeSum = calls.reduce((s, c) => s + (GRADE_MAP[c.outcome_grade] ?? 1), 0);
    const avgGradeNum = Math.round(gradeSum / calls.length);
    const avgGrade = REVERSE_GRADE[avgGradeNum] || 'D';

    // Trend: compare last 7d conv% to prior 7d
    const last7 = calls.filter(c => c.call_date && new Date(c.call_date) >= day7ago);
    const prior7 = calls.filter(c => {
      if (!c.call_date) return false;
      const d = new Date(c.call_date);
      return d >= day14ago && d < day7ago;
    });
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (prior7.length > 0 && last7.length > 0) {
      const l = last7.filter(c => c.converted).length / last7.length;
      const p = prior7.filter(c => c.converted).length / prior7.length;
      if (l > p + 0.05) trend = 'up';
      else if (l < p - 0.05) trend = 'down';
    }

    result.push({
      agent_email: email,
      points,
      badge,
      streak_days: streakDays,
      calls_this_week: callsThisWeek,
      calls_total: calls.length,
      conversion_rate: conversionRate,
      avg_grade: avgGrade,
      trend,
    });
  }

  return result.sort((a, b) => b.points - a.points);
}

// ── NEW: Volume/Quality Matrix ──
export async function getVolumeQualityMatrix(): Promise<any[]> {
  const r = await supaFetch(
    '/call_intelligence?select=agent_email,call_date,converted,outcome_grade&limit=5000&order=call_date.desc'
  );
  if (!r.ok) return [];
  const data: any[] = (await r.json()) || [];

  const now = new Date();
  const day7ago = new Date(now); day7ago.setDate(day7ago.getDate() - 7);

  const agentMap: Record<string, any[]> = {};
  for (const row of data) {
    if (!row.agent_email) continue;
    if (!agentMap[row.agent_email]) agentMap[row.agent_email] = [];
    agentMap[row.agent_email].push(row);
  }

  return Object.entries(agentMap).map(([email, calls]) => {
    const thisWeek = calls.filter(c => c.call_date && new Date(c.call_date) >= day7ago);
    const gradeSum = calls.reduce((s, c) => s + (GRADE_MAP[c.outcome_grade] ?? 1), 0);
    const avgGradeNum = calls.length > 0 ? gradeSum / calls.length : 0;
    return {
      agent_email: email,
      calls_this_week: thisWeek.length,
      conversion_rate: calls.length > 0 ? Math.round((calls.filter(c => c.converted).length / calls.length) * 100) : 0,
      avg_grade_num: Math.round(avgGradeNum * 10) / 10,
    };
  });
}

// ── NEW: Weekly Digest ──
export async function getWeeklyDigest(): Promise<any> {
  const r = await supaFetch(
    '/call_intelligence?select=agent_email,call_date,converted,outcome_grade&limit=5000&order=call_date.desc'
  );
  if (!r.ok) return {};
  const data: any[] = (await r.json()) || [];

  const now = new Date();
  const day7ago = new Date(now); day7ago.setDate(day7ago.getDate() - 7);
  const day14ago = new Date(now); day14ago.setDate(day14ago.getDate() - 14);

  const thisWeek = data.filter(c => c.call_date && new Date(c.call_date) >= day7ago);
  const priorWeek = data.filter(c => {
    if (!c.call_date) return false;
    const d = new Date(c.call_date);
    return d >= day14ago && d < day7ago;
  });

  const teamConvRate = thisWeek.length > 0
    ? Math.round((thisWeek.filter(c => c.converted).length / thisWeek.length) * 100) : 0;
  const priorConvRate = priorWeek.length > 0
    ? Math.round((priorWeek.filter(c => c.converted).length / priorWeek.length) * 100) : 0;

  // Per-agent this week
  const agentThisWeek: Record<string, { calls: number; conversions: number }> = {};
  for (const c of thisWeek) {
    if (!c.agent_email) continue;
    if (!agentThisWeek[c.agent_email]) agentThisWeek[c.agent_email] = { calls: 0, conversions: 0 };
    agentThisWeek[c.agent_email].calls++;
    if (c.converted) agentThisWeek[c.agent_email].conversions++;
  }

  // Per-agent prior week
  const agentPriorWeek: Record<string, { calls: number; conversions: number }> = {};
  for (const c of priorWeek) {
    if (!c.agent_email) continue;
    if (!agentPriorWeek[c.agent_email]) agentPriorWeek[c.agent_email] = { calls: 0, conversions: 0 };
    agentPriorWeek[c.agent_email].calls++;
    if (c.converted) agentPriorWeek[c.agent_email].conversions++;
  }

  // Top performer: highest conv% this week (min 5 calls)
  let topPerformer = '';
  let topConv = -1;
  for (const [email, stats] of Object.entries(agentThisWeek)) {
    if (stats.calls >= 5) {
      const conv = stats.conversions / stats.calls;
      if (conv > topConv) { topConv = conv; topPerformer = email; }
    }
  }

  // Most improved: biggest conv% increase from prior to this week
  let mostImproved = '';
  let bestImprovement = -Infinity;
  for (const [email, cur] of Object.entries(agentThisWeek)) {
    const prior = agentPriorWeek[email];
    if (!prior || prior.calls < 3 || cur.calls < 3) continue;
    const improvement = (cur.conversions / cur.calls) - (prior.conversions / prior.calls);
    if (improvement > bestImprovement) { bestImprovement = improvement; mostImproved = email; }
  }

  // Needs coaching: low conv% or no activity
  const needsCoaching: string[] = [];
  for (const [email, stats] of Object.entries(agentThisWeek)) {
    if (stats.calls >= 3 && stats.conversions / stats.calls < 0.1) needsCoaching.push(email);
  }

  return {
    top_performer: topPerformer,
    most_improved: mostImproved,
    needs_coaching: needsCoaching,
    team_conversion_rate: teamConvRate,
    team_calls_this_week: thisWeek.length,
    week_over_week_change: teamConvRate - priorConvRate,
  };
}

// ── Scorecard file-based persistence ──
interface ScorecardData {
  scores: {
    intro: boolean;
    identified_need: boolean;
    explained_benefits: boolean;
    handled_objection: boolean;
    set_next_step: boolean;
    stayed_professional: boolean;
  };
  manager_notes: string;
  filled_by: string;
  filled_at: string;
}

export function saveScorecard(callId: string, data: ScorecardData): void {
  const all = readJson<Record<string, ScorecardData>>(SCORECARDS_FILE, {});
  all[callId] = { ...data, filled_at: new Date().toISOString() };
  writeJson(SCORECARDS_FILE, all);
}

export function getScorecard(callId: string): ScorecardData | null {
  const all = readJson<Record<string, ScorecardData>>(SCORECARDS_FILE, {});
  return all[callId] || null;
}

export function getAllScorecards(): Record<string, ScorecardData> {
  return readJson<Record<string, ScorecardData>>(SCORECARDS_FILE, {});
}

// ── Coaching notes file-based persistence ──
interface CoachingNote {
  id: string;
  note: string;
  manager: string;
  created_at: string;
  call_id?: string;
}

export function addCoachingNote(email: string, note: string, manager: string, callId?: string): CoachingNote {
  const all = readJson<Record<string, CoachingNote[]>>(COACHING_NOTES_FILE, {});
  if (!all[email]) all[email] = [];
  const entry: CoachingNote = {
    id: randomUUID(),
    note,
    manager,
    created_at: new Date().toISOString(),
    ...(callId ? { call_id: callId } : {}),
  };
  all[email].unshift(entry);
  writeJson(COACHING_NOTES_FILE, all);
  return entry;
}

export function getCoachingNotes(email: string): CoachingNote[] {
  const all = readJson<Record<string, CoachingNote[]>>(COACHING_NOTES_FILE, {});
  return all[email] || [];
}
