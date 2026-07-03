// ── Sales Funnel Data ──────────────────────────────────────────────────────────
// Merges recruit_candidates + vdp_calls + hppro_presentations + platform_sales + customers
// into per-agent funnel rows.
//
// AOI Activity — AOI Recruit (Twilio): every attempted dial counts, ≥45s = reach +
//   agent_dial_metrics.disposition=booked. Call AOI (IB): vdp_calls PICK_UP / ring events
//   filtered to AOI IB market heuristic.
//
// Recruit pipeline: Supabase `recruit_candidates` counted by stage per recruiter associate id.
//   Expected stages (normalized): First Interview, Virtual Overview, Group Final, Hired.
//   Tries recruiter_associate_id, recruiting_agent_associate_id, agent_associate_id, assigned_associate_id.

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

/** Synced Twilio rows in Supabase — change if your table name differs */
const TWILIO_CALL_LOGS_TABLE = 'twilio_call_logs';
const TWILIO_REACH_SECONDS = 45;

const HEADERS = {
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
};

async function fetchAll(path: string): Promise<any[]> {
  const sep = path.includes('?') ? '&' : '?';
  // Don't add limit if path already has one
  const hasLimit = path.includes('limit=');
  const url = `${SUPA_URL}/rest/v1/${path}${hasLimit ? '' : `${sep}limit=50000`}`;
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase ${path.split('?')[0]}: ${r.status} ${text}`);
  }
  return r.json();
}

async function fetchAllOptional(path: string): Promise<any[]> {
  try {
    return await fetchAll(path);
  } catch {
    return [];
  }
}

async function fetchDailyStatsFromDataService(startDate: string, endDate: string): Promise<any[]> {
  const rows: any[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return rows;
  }

  const AOIRAIL_DATA = "https://aoirail-data-production.up.railway.app";
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.toLocaleDateString("en-CA");
    try {
      const r = await fetch(`${AOIRAIL_DATA}/api/agent-daily-stats/team?date=${day}`);
      if (!r.ok) continue;
      const payload = await r.json().catch(() => null);
      const agents = Array.isArray(payload?.agents) ? payload.agents : [];
      for (const a of agents) {
        rows.push({
          agent_email: a.agent_email,
          dials: Number(a.dials || 0),
          reached: Number(a.reached || 0),
          booked: Number(a.booked || 0),
          stat_date: day,
        });
      }
    } catch {
      // Non-blocking fallback; caller handles empty result.
    }
  }
  return rows;
}

/** Canonical recruit pipeline stages (matches recruit_candidates.stage labels, case-insensitive). */
export type RecruitPipelineStage = 'first_interview' | 'virtual_overview' | 'group_final' | 'hired';

export function normalizeRecruitCandidateStage(raw: unknown): RecruitPipelineStage | null {
  const s = String(raw ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  if (s.includes('first interview') || s === 'first interview' || s === 'fi' || s === 'first int') {
    return 'first_interview';
  }
  if (
    (s.includes('virtual') && s.includes('overview')) ||
    s.includes('virtual overview') ||
    s === 'vo' ||
    s.includes('overvbiew')
  ) {
    return 'virtual_overview';
  }
  if (s.includes('group final') || s === 'gf' || (s.includes('group') && s.includes('final'))) {
    return 'group_final';
  }
  if (s === 'hired' || s.startsWith('hired ') || s.includes(' hired')) {
    return 'hired';
  }
  return null;
}

function emptyRecruitPipeline(): Record<RecruitPipelineStage, number> {
  return { first_interview: 0, virtual_overview: 0, group_final: 0, hired: 0 };
}

function associateKeyFromRecruitRow(r: Record<string, unknown>): string {
  const keys = [
    'recruiter_associate_id',
    'recruiting_agent_associate_id',
    'agent_associate_id',
    'assigned_associate_id',
  ] as const;
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== '' && String(v) !== '0') return String(v).trim();
  }
  return '';
}

function aggregateRecruitCandidatesByRecruiter(rows: any[]): Map<string, Record<RecruitPipelineStage, number>> {
  const map = new Map<string, Record<RecruitPipelineStage, number>>();
  for (const r of rows) {
    const id = associateKeyFromRecruitRow(r);
    if (!id) continue;
    const stage = normalizeRecruitCandidateStage(r.stage ?? r.pipeline_stage ?? r.current_stage ?? r.recruit_stage);
    if (!stage) continue;
    if (!map.has(id)) map.set(id, emptyRecruitPipeline());
    const bucket = map.get(id)!;
    bucket[stage]++;
  }
  return map;
}

function recruitPipelineTotal(p: Record<RecruitPipelineStage, number>): number {
  return p.first_interview + p.virtual_overview + p.group_final + p.hired;
}

/** Load rows; tries common column sets so one missing column does not break the whole query. */
async function fetchRecruitCandidateRows(): Promise<any[]> {
  const attempts = [
    'recruit_candidates?select=stage,recruiter_associate_id',
    'recruit_candidates?select=stage,agent_associate_id',
    'recruit_candidates?select=stage,recruiting_agent_associate_id',
    'recruit_candidates?select=stage,assigned_associate_id',
  ];
  for (const path of attempts) {
    const rows = await fetchAllOptional(path);
    if (rows.length > 0) return rows;
  }
  return fetchAllOptional(attempts[0]);
}

/** AOI IB product line on vdp_calls.market (tune if your payloads differ) */
function isAoiIbMarket(market: string): boolean {
  const s = (market || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return false;
  if (s.includes('aoi ib') || s.includes('aoi_ib') || s.includes('aoi-ib')) return true;
  if (s.includes('recruit') || s.includes('rms')) return false;
  return s.includes('ib') && (s.includes('inbound') || s.includes('aoi'));
}

function twilioAgentEmail(r: any): string {
  return String(
    r.agent_email ?? r.agentEmail ?? r.user_email ?? r.to_agent_email ?? '',
  )
    .toLowerCase()
    .trim();
}

function twilioRowTimeMs(r: any): number {
  const t = r.started_at ?? r.created_at ?? r.date_created ?? r.timestamp ?? r.call_started_at;
  if (!t) return 0;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function twilioDurationSec(r: any): number {
  const v = r.duration ?? r.duration_seconds ?? r.call_duration ?? r.Duration;
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Per email: count every Twilio attempt row as dial; reach = rows with duration ≥ TWILIO_REACH_SECONDS */
function aggregateTwilioByEmail(rows: any[]): Map<string, { dials: number; reach: number }> {
  const byEmail = new Map<string, any[]>();
  for (const r of rows) {
    const em = twilioAgentEmail(r);
    if (!em) continue;
    if (!byEmail.has(em)) byEmail.set(em, []);
    byEmail.get(em)!.push(r);
  }
  const out = new Map<string, { dials: number; reach: number }>();
  for (const [em, list] of byEmail) {
    let dials = 0;
    let reach = 0;
    for (const r of list) {
      const t = twilioRowTimeMs(r);
      if (!t) continue;
      dials++;
      if (twilioDurationSec(r) >= TWILIO_REACH_SECONDS) reach++;
    }
    out.set(em, { dials, reach });
  }
  return out;
}

function twilioEmailToAssoc(
  byEmail: Map<string, { dials: number; reach: number }>,
  emailToAssoc: Map<string, string>,
): Map<string, { dials: number; reach: number }> {
  const out = new Map<string, { dials: number; reach: number }>();
  for (const [em, v] of byEmail) {
    const id = emailToAssoc.get(em);
    if (!id) continue;
    const cur = out.get(id) ?? { dials: 0, reach: 0 };
    cur.dials += v.dials;
    cur.reach += v.reach;
    out.set(id, cur);
  }
  return out;
}

/** "jane.doe@x.com" → "Jane Doe" when we lack a roster name */
function displayNameFromEmail(email: string): string {
  const e = String(email || '').toLowerCase().trim();
  if (!e.includes('@')) return '';
  const local = e.split('@')[0].replace(/[._+]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!local) return '';
  return local
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function preferLongerName(a: string, b: string): string {
  const x = (a || '').trim();
  const y = (b || '').trim();
  if (!y) return x;
  if (!x) return y;
  return y.length > x.length ? y : x;
}

/** platform_sales columns vary; request names when available */
async function fetchPlatformSalesForFunnel(): Promise<any[]> {
  try {
    return await fetchAll(
      'platform_sales?select=associate_id,platform_alp,agent_name,company_email&limit=50000',
    );
  } catch {
    return await fetchAll('platform_sales?select=associate_id,platform_alp&limit=50000');
  }
}

async function fetchHpproForFunnel(hpproDate: string): Promise<any[]> {
  try {
    return await fetchAll(
      `hppro_presentations?select=agent_associate_id,what_happened,alp,agent_name,agent_email,create_date${hpproDate}`,
    );
  } catch {
    return await fetchAllOptional(
      `hppro_presentations?select=agent_associate_id,what_happened,alp,agent_name,create_date${hpproDate}`,
    );
  }
}

async function fetchCustomersForFunnel(): Promise<any[]> {
  try {
    return await fetchAll(
      'customers?select=associate_id,company_email,primary_market,agent_name&limit=50000',
    );
  } catch {
    return await fetchAll('customers?select=associate_id,company_email,primary_market&limit=50000');
  }
}

export interface FunnelRow {
  associate_id: string;
  agent_name: string;
  email: string;
  market: string;
  /** vdp_calls PICK_UP on AOI IB market */
  aoi_inbound: number;
  /** vdp_calls TRANSFER/BLAST ring events on AOI IB market (for missed / ANS %) */
  aoi_ib_ring: number;
  /** Twilio logs: every attempted dial row */
  connect_dials: number;
  /** Twilio logs: dials with duration ≥ 45s */
  connect_reached: number;
  /** agent_dial_metrics rows with disposition booked */
  connect_booked: number;
  /** Booked ÷ Twilio dials × 100 */
  connect_book_pct: number;
  // Scoring compat: dials ≈ connect reach; booked = connect_booked; book_rate = connect_book_pct
  dials: number;
  booked: number;
  book_rate: number;
  /** user_credits.credits_used when joined by email */
  credits_used?: number;
  /** recruit_candidates pipeline counts for this recruiter (associate id) */
  recruit_first_interview: number;
  recruit_virtual_overview: number;
  recruit_group_final: number;
  recruit_hired: number;
  recruit_pipeline_total: number;
  /** HPPRO: presentation rows in window (all outcomes) */
  presentations: number;
  /** HPPRO: rows where what_happened === Enrollment */
  sales: number;
  /** HPPRO: enrollments ÷ presentations × 100 */
  close_rate: number;
  /** HPPRO: sum ALP on enrollment rows */
  alp: number;
  /** HPPRO: ALP ÷ presentations */
  alp_per_pres: number;
  /** platform_sales row count (HO submits in window if table is date-filtered elsewhere) */
  ho_submits: number;
  ho_alp: number;
  // AOI Score (optional, computed separately)
  aoi_score?: number;
  aoi_grade?: string;
}

export interface FunnelSummary {
  total_dials: number;
  total_booked: number;
  book_rate: number;
  /** Sum of recruit pipeline candidates across agents */
  total_presentations: number;
  total_recruit_first_interview: number;
  total_recruit_virtual_overview: number;
  total_recruit_group_final: number;
  total_recruit_hired: number;
  total_sales: number;
  close_rate: number;
  total_alp: number;
  total_ho_submits: number;
  total_ho_alp: number;
  agent_count: number;
}

export async function getFunnelData(
  days: number = 30,
  week: 'current' | null = null,
  startDate?: string,
  endDate?: string,
): Promise<FunnelRow[]> {
  let dateFilter = '';
  let timeGteIso: string | null = null;
  let timeLteIso: string | null = null;

  if (startDate) {
    // Explicit date range takes priority
    timeGteIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    timeLteIso = endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : null;
    dateFilter = `&time=gte.${timeGteIso}${timeLteIso ? `&time=lte.${timeLteIso}` : ''}`;
  } else if (week === 'current') {
    const now = new Date();
    const dow = now.getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMon);
    weekStart.setHours(0, 0, 0, 0);
    const iso = weekStart.toISOString();
    dateFilter = `&time=gte.${iso}`;
    timeGteIso = iso;
  } else if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    dateFilter = `&time=gte.${cutoff}`;
    timeGteIso = cutoff;
  }

  const twilioSuffix = timeGteIso
    ? `&started_at=gte.${encodeURIComponent(timeGteIso)}`
    : '';
  const dialMetricsSuffix = timeGteIso
    ? `&event_timestamp=gte.${encodeURIComponent(timeGteIso)}`
    : '';

  const hpproDate =
    timeGteIso && (days > 0 || week === 'current')
      ? `&create_date=gte.${encodeURIComponent(timeGteIso.slice(0, 10))}`
      : '';

  // Use agent_daily_stats for DRB aggregation in Campaign Manager.
  // Filter by stat_date window (date-based rollup table).
  const statDateGte = timeGteIso ? timeGteIso.slice(0, 10) : null;
  const statDateLte = timeLteIso ? timeLteIso.slice(0, 10) : null;
  const dailyStatsSuffix = [
    statDateGte ? `&stat_date=gte.${encodeURIComponent(statDateGte)}` : '',
    statDateLte ? `&stat_date=lte.${encodeURIComponent(statDateLte)}` : '',
  ].join('');

  const [
    vdpIbPickups,
    vdpIbOffers,
    recruitCandidates,
    hpproRows,
    platformSales,
    customers,
    userCredits,
    dailyStatsRows,
  ] = await Promise.all([
    fetchAll(`vdp_calls?select=agent,market&event=eq.PICK_UP${dateFilter}`),
    fetchAllOptional(`vdp_calls?select=agent,market&event=in.(TRANSFER,BLASTER,BLAST)${dateFilter}`),
    fetchRecruitCandidateRows(),
    fetchHpproForFunnel(hpproDate),
    fetchPlatformSalesForFunnel(),
    fetchCustomersForFunnel(),
    fetchAllOptional('user_credits?select=email,credits_used,aoi_connect_credits_used&limit=10000'),
    // Legacy path: pull DRB from Supabase agent_daily_stats rollups (if present).
    // Some environments do not host this table, so we fallback to aoirail-data below.
    fetchAllOptional(
      `agent_daily_stats?select=agent_email,dials,reached,booked,stat_date${dailyStatsSuffix}&limit=500000`,
    ),
  ]);

  let normalizedDailyStatsRows = Array.isArray(dailyStatsRows) ? dailyStatsRows : [];
  if (normalizedDailyStatsRows.length === 0) {
    // Supabase doesn't have agent_daily_stats - always fall back to data service
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const start = statDateGte || today;
    const end = statDateLte || today;
    normalizedDailyStatsRows = await fetchDailyStatsFromDataService(start, end);
  }

  // Aggregate dials/reach/booked from agent_daily_stats
  const dialsByEmail = new Map<string, number>();
  const reachByEmail = new Map<string, number>();
  const bookedByEmail = new Map<string, number>();

  for (const row of normalizedDailyStatsRows) {
    const email = String(row.agent_email || '').toLowerCase().trim();
    if (!email) continue;
    dialsByEmail.set(email, (dialsByEmail.get(email) || 0) + (Number(row.dials) || 0));
    reachByEmail.set(email, (reachByEmail.get(email) || 0) + (Number(row.reached) || 0));
    bookedByEmail.set(email, (bookedByEmail.get(email) || 0) + (Number(row.booked) || 0));
  }

  // ── Customer map: associate_id → { email, market, agent_name }; email → associate_id
  const customerMap = new Map<string, { email: string; market: string; agent_name: string }>();
  const emailToAssoc = new Map<string, string>();
  for (const c of customers) {
    const id = String(c.associate_id ?? '').trim();
    if (!id) continue;
    customerMap.set(id, {
      email: c.company_email || '',
      market: c.primary_market || '',
      agent_name: String(c.agent_name || '').trim(),
    });
    const em = String(c.company_email || '').toLowerCase().trim();
    if (em) emailToAssoc.set(em, id);
  }

  // Build twilioByAssoc from agent_dial_metrics aggregates (consistent with agent view)
  const twilioByAssoc = new Map<string, { dials: number; reach: number }>();
  for (const [email, dials] of dialsByEmail) {
    const id = emailToAssoc.get(email);
    if (!id) continue;
    const existing = twilioByAssoc.get(id) || { dials: 0, reach: 0 };
    twilioByAssoc.set(id, { dials: existing.dials + dials, reach: existing.reach });
  }
  for (const [email, reach] of reachByEmail) {
    const id = emailToAssoc.get(email);
    if (!id) continue;
    const existing = twilioByAssoc.get(id) || { dials: 0, reach: 0 };
    twilioByAssoc.set(id, { dials: existing.dials, reach: existing.reach + reach });
  }

  // Name resolution from email only (no raw twilio rows needed)
  const twilioNameByAssoc = new Map<string, string>();
  for (const [email] of dialsByEmail) {
    const id = emailToAssoc.get(email);
    if (!id) continue;
    const hint = displayNameFromEmail(email);
    if (hint) twilioNameByAssoc.set(id, preferLongerName(twilioNameByAssoc.get(id) || '', hint));
  }

  function bumpIbAgentMap(m: Map<string, number>, rows: any[]) {
    for (const r of rows) {
      if (!isAoiIbMarket(String(r.market || ''))) continue;
      const id = String(r.agent || '').trim();
      if (!id) continue;
      m.set(id, (m.get(id) || 0) + 1);
    }
  }

  const ibPickupsMap = new Map<string, number>();
  bumpIbAgentMap(ibPickupsMap, vdpIbPickups);
  const ibRingMap = new Map<string, number>();
  bumpIbAgentMap(ibRingMap, vdpIbOffers);

  const bookedByAssoc = new Map<string, number>();
  for (const [em, booked] of bookedByEmail) {
    if (!em) continue;
    const id = emailToAssoc.get(em);
    if (!id) continue;
    bookedByAssoc.set(id, (bookedByAssoc.get(id) || 0) + booked);
  }

  // Credits by associate_id (via customer email)
  const creditsByEmail = new Map<string, number>();
  for (const u of userCredits) {
    const em = String(u.email || '').toLowerCase().trim();
    if (!em) continue;
    const connect = parseFloat(String(u.aoi_connect_credits_used)) || 0;
    creditsByEmail.set(em, connect > 0 ? connect : parseFloat(String(u.credits_used)) || 0);
  }

  const recruitByRecruiter = aggregateRecruitCandidatesByRecruiter(recruitCandidates);

  // ── Platform sales: group by associate_id
  interface HoStats { count: number; alp: number; }
  const hoMap = new Map<string, HoStats>();
  const platformNameByAssoc = new Map<string, string>();
  const platformEmailByAssoc = new Map<string, string>();
  for (const ps of platformSales) {
    const id = String(ps.associate_id || '').trim();
    if (!id) continue;
    if (!hoMap.has(id)) hoMap.set(id, { count: 0, alp: 0 });
    const s = hoMap.get(id)!;
    s.count++;
    s.alp += parseFloat(String(ps.platform_alp)) || 0;
    const pn = String(ps.agent_name || '').trim();
    if (pn) {
      platformNameByAssoc.set(id, preferLongerName(platformNameByAssoc.get(id) || '', pn));
    } else {
      const ce = String(ps.company_email || '').trim();
      const fromEm = displayNameFromEmail(ce);
      if (fromEm && !platformNameByAssoc.has(id)) platformNameByAssoc.set(id, fromEm);
    }
    const cem = String(ps.company_email || '').toLowerCase().trim();
    if (cem && !platformEmailByAssoc.has(id)) platformEmailByAssoc.set(id, cem);
  }

  interface PresStats {
    count: number;
    sales: number;
    alp: number;
    agent_name: string;
  }
  const presMap = new Map<string, PresStats>();
  for (const r of hpproRows) {
    const id = String(r.agent_associate_id ?? '').trim();
    if (!id) continue;
    if (!presMap.has(id)) {
      presMap.set(id, { count: 0, sales: 0, alp: 0, agent_name: '' });
    }
    const p = presMap.get(id)!;
    p.count++;
    const wh = String(r.what_happened || '').trim();
    if (wh === 'Enrollment') {
      p.sales++;
      p.alp += parseFloat(String(r.alp)) || 0;
    }
    const an = String(r.agent_name || '').trim();
    if (an) p.agent_name = preferLongerName(p.agent_name, an);
    const fromHpEmail = displayNameFromEmail(String(r.agent_email || ''));
    if (fromHpEmail) p.agent_name = preferLongerName(p.agent_name, fromHpEmail);
  }

  // ── Associate ids with any measurable activity (do not list every customer with no touches)
  const allIds = new Set<string>();
  for (const id of recruitByRecruiter.keys()) allIds.add(id);
  for (const id of twilioByAssoc.keys()) allIds.add(id);
  for (const id of bookedByAssoc.keys()) allIds.add(id);
  for (const id of ibPickupsMap.keys()) allIds.add(id);
  for (const id of ibRingMap.keys()) allIds.add(id);
  for (const id of hoMap.keys()) allIds.add(id);
  for (const id of presMap.keys()) allIds.add(id);

  // ── Build result rows
  const rows: FunnelRow[] = [];
  for (const id of allIds) {
    const cust = customerMap.get(id);
    const tw = twilioByAssoc.get(id) ?? { dials: 0, reach: 0 };
    const connect_dials = tw.dials;
    const connect_reached = tw.reach;
    const booked = bookedByAssoc.get(id) || 0;
    const bookPct =
      connect_dials > 0 ? Math.round((booked / connect_dials) * 1000) / 10 : 0;
    const ho = hoMap.get(id) || { count: 0, alp: 0 };
    const emailResolved = (cust?.email || '').trim() || platformEmailByAssoc.get(id) || '';
    const emForCredits = emailResolved.toLowerCase().trim();
    const credits_used = emForCredits ? creditsByEmail.get(emForCredits) ?? 0 : 0;
    const aoi_inbound = ibPickupsMap.get(id) || 0;
    let aoi_ib_ring = ibRingMap.get(id) || 0;
    if (aoi_ib_ring < aoi_inbound) aoi_ib_ring = aoi_inbound;

    const rp = recruitByRecruiter.get(id) ?? emptyRecruitPipeline();
    const pipelineTotal = recruitPipelineTotal(rp);
    const pres = presMap.get(id) ?? { count: 0, sales: 0, alp: 0, agent_name: '' };
    const hpPres = pres.count;
    const hpSales = pres.sales;
    const close_rate =
      hpPres > 0 ? Math.round((hpSales / hpPres) * 1000) / 10 : 0;
    const alp = Math.round(pres.alp);
    const alp_per_pres = hpPres > 0 ? Math.round(pres.alp / hpPres) : 0;

    const fromCustEmail = displayNameFromEmail(emailResolved);
    const agent_name =
      (cust?.agent_name && cust.agent_name.trim()) ||
      (platformNameByAssoc.get(id) || '').trim() ||
      (pres.agent_name || '').trim() ||
      fromCustEmail ||
      (twilioNameByAssoc.get(id) || '').trim() ||
      `Agent ${id}`;

    rows.push({
      associate_id: id,
      agent_name,
      email: emailResolved,
      market: cust?.market || '',
      aoi_inbound,
      aoi_ib_ring,
      connect_dials,
      connect_reached,
      connect_booked: booked,
      connect_book_pct: bookPct,
      dials: connect_reached,
      booked,
      book_rate: bookPct,
      recruit_first_interview: rp.first_interview,
      recruit_virtual_overview: rp.virtual_overview,
      recruit_group_final: rp.group_final,
      recruit_hired: rp.hired,
      recruit_pipeline_total: pipelineTotal,
      presentations: hpPres,
      sales: hpSales,
      close_rate,
      alp,
      alp_per_pres,
      ho_submits: ho.count,
      ho_alp: Math.round(ho.alp),
      credits_used,
    });
  }

  rows.sort((a, b) => {
    if (b.presentations !== a.presentations) return b.presentations - a.presentations;
    return b.recruit_pipeline_total - a.recruit_pipeline_total;
  });
  return rows;
}

export async function getFunnelSummary(days: number = 30, startDate?: string, endDate?: string): Promise<FunnelSummary> {
  const rows = await getFunnelData(days, null, startDate, endDate);
  const total_dials = rows.reduce((s, r) => s + r.connect_dials, 0);
  const total_booked = rows.reduce((s, r) => s + r.booked, 0);
  const total_hppro_pres = rows.reduce((s, r) => s + r.presentations, 0);
  const total_recruit_first_interview = rows.reduce((s, r) => s + r.recruit_first_interview, 0);
  const total_recruit_virtual_overview = rows.reduce((s, r) => s + r.recruit_virtual_overview, 0);
  const total_recruit_group_final = rows.reduce((s, r) => s + r.recruit_group_final, 0);
  const total_recruit_hired = rows.reduce((s, r) => s + r.recruit_hired, 0);
  const total_sales = rows.reduce((s, r) => s + r.sales, 0);
  const total_alp = rows.reduce((s, r) => s + r.alp, 0);
  const total_ho_submits = rows.reduce((s, r) => s + r.ho_submits, 0);
  const total_ho_alp = rows.reduce((s, r) => s + r.ho_alp, 0);

  return {
    total_dials,
    total_booked,
    book_rate: total_dials > 0 ? Math.round((total_booked / total_dials) * 1000) / 10 : 0,
    total_presentations: total_hppro_pres,
    total_recruit_first_interview,
    total_recruit_virtual_overview,
    total_recruit_group_final,
    total_recruit_hired,
    total_sales,
    close_rate:
      total_hppro_pres > 0
        ? Math.round((total_sales / total_hppro_pres) * 1000) / 10
        : 0,
    total_alp: Math.round(total_alp),
    total_ho_submits,
    total_ho_alp: Math.round(total_ho_alp),
    agent_count: rows.length,
  };
}

export async function getAgentPresentations(associateId: string, limit = 5): Promise<any[]> {
  const q = encodeURIComponent(associateId);
  const attempts = [
    `recruit_candidates?select=*&recruiter_associate_id=eq.${q}&order=created_at.desc&limit=${limit}`,
    `recruit_candidates?select=*&recruiter_associate_id=eq.${q}&limit=${limit}`,
    `recruit_candidates?select=*&agent_associate_id=eq.${q}&order=created_at.desc&limit=${limit}`,
    `recruit_candidates?select=*&agent_associate_id=eq.${q}&limit=${limit}`,
  ];
  for (const path of attempts) {
    const rows = await fetchAllOptional(path);
    if (rows.length > 0) return rows;
  }
  return [];
}

// ── AOI Score ─────────────────────────────────────────────────────────────────

export interface AoiScore {
  total: number;
  show_rate_score: number;
  close_rate_score: number;
  alp_score: number;
  call_grade_score: number;
  trend_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

const CI_GRADE_MAP: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const CI_REVERSE_GRADE: Record<number, string> = { 4: 'A', 3: 'B', 2: 'C', 1: 'D', 0: 'F' };

export function computeAoiScore(
  row: FunnelRow,
  callStats: { avg_grade: string | null; trend: 'up' | 'flat' | 'down' }
): AoiScore {
  const pipeline = row.presentations || row.recruit_pipeline_total || 0;
  const show_rate = pipeline / Math.max(row.dials, 1);
  const show_rate_score = (Math.min(show_rate, 0.15) / 0.15) * 20;

  const close_rate_score = (Math.min(row.close_rate / 100, 0.60) / 0.60) * 30;

  const alp_score = pipeline > 0 ? (Math.min(row.alp_per_pres, 2000) / 2000) * 20 : 0;

  const callGradeMap: Record<string, number> = { A: 20, B: 16, C: 12, D: 8, F: 4 };
  const call_grade_score = callStats.avg_grade ? (callGradeMap[callStats.avg_grade] ?? 0) : 0;

  const trendMap: Record<string, number> = { up: 10, flat: 5, down: 0 };
  const trend_score = trendMap[callStats.trend] ?? 5;

  const total = Math.round(show_rate_score + close_rate_score + alp_score + call_grade_score + trend_score);

  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    total >= 85 ? 'A' :
    total >= 70 ? 'B' :
    total >= 55 ? 'C' :
    total >= 40 ? 'D' : 'F';

  return {
    total,
    show_rate_score: Math.round(show_rate_score * 10) / 10,
    close_rate_score: Math.round(close_rate_score * 10) / 10,
    alp_score: Math.round(alp_score * 10) / 10,
    call_grade_score,
    trend_score,
    grade,
  };
}

export async function getBatchAoiScores(): Promise<Record<string, { grade: string; total: number }>> {
  const [funnelRows, ciData] = await Promise.all([
    getFunnelData(0),
    fetchAll('call_intelligence?select=agent_email,outcome_grade,converted,call_date&limit=10000'),
  ]);

  const now = new Date();
  const day7ago = new Date(now); day7ago.setDate(day7ago.getDate() - 7);
  const day14ago = new Date(now); day14ago.setDate(day14ago.getDate() - 14);

  // Build per-email stats from call_intelligence
  const emailStats: Record<string, { grades: string[]; last7conv: number; last7total: number; prior7conv: number; prior7total: number }> = {};
  for (const row of ciData) {
    if (!row.agent_email) continue;
    if (!emailStats[row.agent_email]) {
      emailStats[row.agent_email] = { grades: [], last7conv: 0, last7total: 0, prior7conv: 0, prior7total: 0 };
    }
    const s = emailStats[row.agent_email];
    if (row.outcome_grade) s.grades.push(row.outcome_grade);
    if (row.call_date) {
      const d = new Date(row.call_date);
      if (d >= day7ago) {
        s.last7total++;
        if (row.converted) s.last7conv++;
      } else if (d >= day14ago) {
        s.prior7total++;
        if (row.converted) s.prior7conv++;
      }
    }
  }

  // Build email → call stats
  const callStatsMap: Record<string, { avg_grade: string | null; trend: 'up' | 'flat' | 'down' }> = {};
  for (const [email, stats] of Object.entries(emailStats)) {
    const gradeSum = stats.grades.reduce((s, g) => s + (CI_GRADE_MAP[g] ?? 1), 0);
    const avgNum = stats.grades.length > 0 ? Math.round(gradeSum / stats.grades.length) : null;
    const avg_grade = avgNum !== null ? (CI_REVERSE_GRADE[avgNum] || 'D') : null;

    let trend: 'up' | 'flat' | 'down' = 'flat';
    if (stats.last7total > 0 && stats.prior7total > 0) {
      const l7 = stats.last7conv / stats.last7total;
      const p7 = stats.prior7conv / stats.prior7total;
      if (l7 > p7 + 0.05) trend = 'up';
      else if (l7 < p7 - 0.05) trend = 'down';
    }
    callStatsMap[email] = { avg_grade, trend };
  }

  const result: Record<string, { grade: string; total: number }> = {};
  for (const row of funnelRows) {
    if (!row.email) continue;
    const callStats = callStatsMap[row.email] || { avg_grade: null, trend: 'flat' as const };
    const score = computeAoiScore(row, callStats);
    result[row.email] = { grade: score.grade, total: score.total };
  }
  return result;
}

export async function getAgentAoiScore(email: string): Promise<AoiScore & { row?: FunnelRow }> {
  const [funnelRows, ciData] = await Promise.all([
    getFunnelData(0),
    fetchAll(`call_intelligence?select=outcome_grade,converted,call_date&agent_email=eq.${encodeURIComponent(email)}&limit=1000`),
  ]);

  const row = funnelRows.find(r => r.email === email);
  if (!row) {
    return { total: 0, show_rate_score: 0, close_rate_score: 0, alp_score: 0, call_grade_score: 0, trend_score: 5, grade: 'F' };
  }

  const now = new Date();
  const day7ago = new Date(now); day7ago.setDate(day7ago.getDate() - 7);
  const day14ago = new Date(now); day14ago.setDate(day14ago.getDate() - 14);

  const gradeSum = ciData.reduce((s: number, r: any) => s + (CI_GRADE_MAP[r.outcome_grade] ?? 1), 0);
  const avgNum = ciData.length > 0 ? Math.round(gradeSum / ciData.length) : null;
  const avg_grade = avgNum !== null ? (CI_REVERSE_GRADE[avgNum] || 'D') : null;

  const last7 = ciData.filter((r: any) => r.call_date && new Date(r.call_date) >= day7ago);
  const prior7 = ciData.filter((r: any) => {
    if (!r.call_date) return false;
    const d = new Date(r.call_date);
    return d >= day14ago && d < day7ago;
  });

  let trend: 'up' | 'flat' | 'down' = 'flat';
  if (last7.length > 0 && prior7.length > 0) {
    const l7 = last7.filter((r: any) => r.converted).length / last7.length;
    const p7 = prior7.filter((r: any) => r.converted).length / prior7.length;
    if (l7 > p7 + 0.05) trend = 'up';
    else if (l7 < p7 - 0.05) trend = 'down';
  }

  const score = computeAoiScore(row, { avg_grade, trend });
  return { ...score, row };
}

// ── Weekly Comparison ─────────────────────────────────────────────────────────

export interface WeeklyComparison {
  metric: string;
  this_week: number;
  last_week: number;
  change_pct: number | null;
  trend: 'up' | 'down' | 'flat';
}

function getWeekBounds() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const daysFromMon = dow === 0 ? 6 : dow - 1;

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - daysFromMon);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  return {
    thisWeekStartISO: thisWeekStart.toISOString(),
    lastWeekStartISO: lastWeekStart.toISOString(),
    thisWeekStartDate: thisWeekStart.toISOString().slice(0, 10),
    lastWeekStartDate: lastWeekStart.toISOString().slice(0, 10),
    nowISO: now.toISOString(),
    nowDate: now.toISOString().slice(0, 10),
  };
}

export async function getWeeklyComparison(): Promise<WeeklyComparison[]> {
  const { thisWeekStartISO, lastWeekStartISO, thisWeekStartDate, lastWeekStartDate, nowISO, nowDate } = getWeekBounds();

  const [
    thisDialRows, lastDialRows,
    thisBookedRows, lastBookedRows,
    thisRecruitRows, lastRecruitRows,
    thisPlatformSales, lastPlatformSales,
  ] = await Promise.all([
    fetchAll(`vdp_calls?select=agent&event=eq.PICK_UP&time=gte.${thisWeekStartISO}&time=lte.${nowISO}`),
    fetchAll(`vdp_calls?select=agent&event=eq.PICK_UP&time=gte.${lastWeekStartISO}&time=lt.${thisWeekStartISO}`),
    fetchAll(`vdp_calls?select=agent&event=eq.END&cnresolution=in.(appointment_set,sold)&time=gte.${thisWeekStartISO}&time=lte.${nowISO}`),
    fetchAll(`vdp_calls?select=agent&event=eq.END&cnresolution=in.(appointment_set,sold)&time=gte.${lastWeekStartISO}&time=lt.${thisWeekStartISO}`),
    fetchAllOptional(
      `recruit_candidates?select=stage,created_at&created_at=gte.${encodeURIComponent(thisWeekStartISO)}&created_at=lte.${encodeURIComponent(nowISO)}`,
    ),
    fetchAllOptional(
      `recruit_candidates?select=stage,created_at&created_at=gte.${encodeURIComponent(lastWeekStartISO)}&created_at=lt.${encodeURIComponent(thisWeekStartISO)}`,
    ),
    fetchAll(`platform_sales?select=platform_alp&sga_submit=gte.${thisWeekStartDate}&sga_submit=lte.${nowDate}`),
    fetchAll(`platform_sales?select=platform_alp&sga_submit=gte.${lastWeekStartDate}&sga_submit=lt.${thisWeekStartDate}`),
  ]);

  const thisDials = thisDialRows.length;
  const lastDials = lastDialRows.length;
  const thisBooked = thisBookedRows.length;
  const lastBooked = lastBookedRows.length;

  const sumStages = (rows: any[]) => {
    const o = emptyRecruitPipeline();
    for (const r of rows) {
      const st = normalizeRecruitCandidateStage(r.stage);
      if (st) o[st]++;
    }
    return o;
  };
  const thisSt = sumStages(thisRecruitRows);
  const lastSt = sumStages(lastRecruitRows);
  const thisPres = recruitPipelineTotal(thisSt);
  const lastPres = recruitPipelineTotal(lastSt);

  const thisSales = thisPlatformSales.length;
  const lastSales = lastPlatformSales.length;
  const thisALP = thisPlatformSales.reduce((s: number, p: any) => s + (parseFloat(p.platform_alp) || 0), 0);
  const lastALP = lastPlatformSales.reduce((s: number, p: any) => s + (parseFloat(p.platform_alp) || 0), 0);
  const thisHO = thisPlatformSales.length;
  const lastHO = lastPlatformSales.length;

  const thisBookRate = thisDials > 0 ? (thisBooked / thisDials) * 100 : 0;
  const lastBookRate = lastDials > 0 ? (lastBooked / lastDials) * 100 : 0;
  const thisCloseRate = thisPres > 0 ? (thisSt.hired / thisPres) * 100 : 0;
  const lastCloseRate = lastPres > 0 ? (lastSt.hired / lastPres) * 100 : 0;

  const mkComp = (metric: string, tw: number, lw: number): WeeklyComparison => {
    const change_pct = lw > 0 ? ((tw - lw) / lw) * 100 : null;
    const trend: 'up' | 'down' | 'flat' =
      change_pct === null
        ? tw > 0 ? 'up' : 'flat'
        : Math.abs(change_pct) <= 2 ? 'flat'
        : change_pct > 0 ? 'up' : 'down';
    return {
      metric,
      this_week: Math.round(tw * 10) / 10,
      last_week: Math.round(lw * 10) / 10,
      change_pct: change_pct !== null ? Math.round(change_pct * 10) / 10 : null,
      trend,
    };
  };

  return [
    mkComp('dials', thisDials, lastDials),
    mkComp('booked', thisBooked, lastBooked),
    mkComp('book_rate', thisBookRate, lastBookRate),
    mkComp('recruit_first_interview', thisSt.first_interview, lastSt.first_interview),
    mkComp('recruit_virtual_overview', thisSt.virtual_overview, lastSt.virtual_overview),
    mkComp('recruit_group_final', thisSt.group_final, lastSt.group_final),
    mkComp('recruit_hired', thisSt.hired, lastSt.hired),
    mkComp('presentations', thisPres, lastPres),
    mkComp('sales', thisSales, lastSales),
    mkComp('close_rate', thisCloseRate, lastCloseRate),
    mkComp('alp', Math.round(thisALP), Math.round(lastALP)),
  ];
}
