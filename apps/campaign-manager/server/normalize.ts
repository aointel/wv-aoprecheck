/**
 * Normalizes raw Taalk API responses into clean internal types.
 */

import type { TaalkAgent, TaalkCampaign, NormalizedAgent, NormalizedCampaign, AgentStatus } from '../shared/types.js';

// ── Market normalization ──

const MARKET_MAP: Record<string, string> = {
  'pavet': 'Veteran',
  'veteran': 'Veteran',
  'vet': 'Veteran',
  'globe': 'Globe',
  'globe market': 'Globe',
  'globe-market': 'Globe',
  'vn': 'Globe',
  'will kit': 'Will Kit',
  'willkit': 'Will Kit',
  'womens benefit': 'Womens Benefit',
  'womensbenefit': 'Womens Benefit',
  'women': 'Womens Benefit',
  'plus': 'Plus',
  'ao recruit': 'AO Recruit',
  'aorecruit': 'AO Recruit',
  'recruit': 'AO Recruit',
  'rms': 'AO Recruit',
  'ao rms': 'AO Recruit',
  'union': 'Union',
};

export function normalizeMarket(raw: any): string {
  // Handle arrays (e.g. ["Globe Market"])
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw || typeof raw !== 'string') return 'Unknown';
  const lower = raw.toLowerCase().trim();

  // Direct match
  if (MARKET_MAP[lower]) return MARKET_MAP[lower];

  // Substring match
  for (const [key, val] of Object.entries(MARKET_MAP)) {
    if (lower.includes(key)) return val;
  }

  return raw; // Pass through if unknown
}

// ── Agent normalization ──

export function normalizeAgent(raw: any): NormalizedAgent {
  const p = raw.params || {};
  const firstName = p.first_name || raw.first_name || '';
  const lastName = p.last_name || raw.last_name || '';
  const market = p.market || raw.market || raw.Market || '';
  const states = p.states || raw.states || [];
  const campaign = p.campaign || raw.campaign || '';

  let status: AgentStatus = 'offline';
  if (raw.suspended) {
    status = 'suspended';
  } else if (raw.online && raw.busy) {
    status = 'busy';
  } else if (raw.online && raw.away) {
    status = 'away';
  } else if (raw.online) {
    status = 'idle';
  }

  let callInfo: NormalizedAgent['callInfo'] = undefined;
  if (raw.taskSniff?.params) {
    const tp = raw.taskSniff.params;
    callInfo = {
      leadName: `${tp['First Name'] || ''} ${tp['Last Name'] || ''}`.trim(),
      leadPhone: tp.Phone || '',
      leadState: tp.State || '',
      leadMarket: tp.Market || '',
      leadId: tp.Leadid || '',
      leadType: tp.Type || '',
      campaignName: tp.Taalk_Campaign || '',
      sessionId: tp.Taalk_Session || '',
      serverNumber: raw.taskSniff?.serverNumber || '',
    };
  }

  return {
    _id: raw._id || '',
    id: typeof raw.id === 'string' ? parseInt(raw.id, 10) || 0 : (raw.id ?? 0),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    market,
    normalizedMarket: normalizeMarket(market),
    states: Array.isArray(states) ? states : [],
    campaign,
    status,
    online: !!raw.online,
    busy: !!raw.busy,
    away: !!raw.away,
    suspended: !!raw.suspended,
    statusSince: raw.recentStatusStartTime || '',
    currentTask: raw.currentTask || null,
    taskAssignedTime: raw.taskAssignedTime || null,
    lastHangupTime: raw.lastHangupTime || null,
    lastHeartbeat: raw.lastHeartbeat || '',
    rank: typeof raw.rank === 'number' ? raw.rank : null,
    callInfo,
  };
}

// ── Campaign normalization ──

export function extractStateFromName(name: string): string {
  // Pattern: VDP_Veteran_Campaign_TX_12345 or VDP_Globe_VN_CA_55555
  // Also: PAVET_TX_something, VN_Globe_CA_xxx
  const parts = name.split(/[-_\s]+/);
  const US_STATES = new Set([
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
    'VA','WA','WV','WI','WY','DC',
  ]);
  // Also map full state names
  const STATE_NAMES: Record<string, string> = {
    'ALASKA':'AK','ALABAMA':'AL','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA',
    'COLORADO':'CO','CONNECTICUT':'CT','DELAWARE':'DE','FLORIDA':'FL','GEORGIA':'GA',
    'HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL','INDIANA':'IN','IOWA':'IA','KANSAS':'KS',
    'KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD','MASSACHUSETTS':'MA',
    'MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO','MONTANA':'MT',
    'NEBRASKA':'NE','NEVADA':'NV','OHIO':'OH','OKLAHOMA':'OK','OREGON':'OR',
    'PENNSYLVANIA':'PA','TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT','VERMONT':'VT',
    'VIRGINIA':'VA','WASHINGTON':'WA','WISCONSIN':'WI','WYOMING':'WY',
  };
  for (const part of parts) {
    if (US_STATES.has(part.toUpperCase())) return part.toUpperCase();
    if (STATE_NAMES[part.toUpperCase()]) return STATE_NAMES[part.toUpperCase()];
  }
  return 'ALL';
}

export function normalizeCampaign(raw: any): NormalizedCampaign {
  const name = raw.name || '';
  const statusCode = raw.currentTask?.status ?? -1;
  let status: NormalizedCampaign['status'] = 'unknown';
  if (statusCode === 1) status = 'running';
  else if (statusCode === 0) status = 'stopped';
  else if (statusCode === 3) status = 'completed';

  const market = detectCampaignMarket(name);

  // Capture the raw Taalk market field if present (params.market, market, or group_name)
  const taalkMarket: string = raw.params?.market || raw.params?.group_name || raw.market || '';

  // Detect per-agent campaigns: VDP_Veteran_Campaign_73054 pattern
  const isPerAgent = /campaign[_\s]*\d{4,}/i.test(name);

  return {
    _id: raw._id || '',
    name,
    market,
    normalizedMarket: normalizeMarket(market),
    taalkMarket: taalkMarket || undefined,
    state: extractStateFromName(name),
    limitPerHour: raw.limitPerHour ?? 0,
    contactCount: raw.contactCount ?? 0,
    status,
    callsMade: raw.currentTask?.callMade ?? 0,
    callsAnswered: raw.currentTask?.callAnswered ?? 0,
    callsThisHour: raw.currentTask?.callMadeWithinHour ?? 0,
    isPerAgent,
    answerRate: (raw.currentTask?.callMade ?? 0) > 0
      ? Math.round(((raw.currentTask?.callAnswered ?? 0) / (raw.currentTask?.callMade ?? 1)) * 1000) / 10
      : 0,
  };
}

function detectCampaignMarket(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('pavet') || lower.includes('veteran')) return 'Veteran';
  if (lower.includes('vn') || lower.includes('globe')) return 'Globe';
  if (lower.includes('will kit') || lower.includes('willkit')) return 'Will Kit';
  if (lower.includes('women') || lower.includes('wmn')) return 'Womens Benefit';
  if (lower.includes('plus')) return 'Plus';
  if (lower.includes('recruit') || lower.includes('rms')) return 'AO Recruit';
  if (lower.includes('union')) return 'Union';
  return 'Other';
}

/** Recruit dial campaigns — matches detectCampaignMarket AO Recruit (name may say RMS not "recruit"). */
export function isAoRecruitCampaignName(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('recruit') || n.includes('rms');
}
