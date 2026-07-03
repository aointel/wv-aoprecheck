// ── AOI Usage Analytics ────────────────────────────────────────────────────────
// Per-agent breakdown across all 4 AOI products: Connect, Recruit, CCPro, Inbound

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

function supaFetch(path: string): Promise<any[]> {
  const url = `${SUPA_URL}/rest/v1/${path}`;
  return fetch(url, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Accept': 'application/json',
    },
  }).then(r => r.json()).then(d => (Array.isArray(d) ? d : []));
}

export interface AgentUsageRow {
  email: string;
  // AOI Connect (VDP)
  connect_dials: number;
  connect_answered: number;
  connect_booked: number;
  connect_credits_used: number;
  connect_veteran_dials: number;
  connect_globe_dials: number;
  // AO Recruit
  recruit_touches: number;
  recruit_credits_used: number;
  // CC Pro / AOI Plus
  ccpro_credits_used: number;
  ccpro_enabled: boolean;
  // AOI Inbound
  inbound_calls: number;
  // Revenue
  alp_submitted: number;
  // Availability
  last_seen: string | null;
  // Derived
  connect_conversion_rate: number;
  credits_total_used: number;
  roi_score: number;
}

export interface TeamUsageSummary {
  total_connect_dials: number;
  total_connect_booked: number;
  team_connect_conversion: number;
  total_recruit_touches: number;
  total_inbound_calls: number;
  total_alp_submitted: number;
  total_credits_used: number;
  veteran_dials: number;
  globe_dials: number;
  active_agents_today: number;
}

// Cache
let _breakdownCache: AgentUsageRow[] | null = null;
let _breakdownCacheTime = 0;
let _breakdownDays = 30;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

export async function getUsageBreakdown(days = 30): Promise<AgentUsageRow[]> {
  if (_breakdownCache && Date.now() - _breakdownCacheTime < CACHE_TTL && _breakdownDays === days) {
    return _breakdownCache;
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all data sources in parallel
  const [
    pickupRows,
    endRows,
    billingRows,
    userCredits,
    inboundRows,
    liveStatusRows,
    salesRows,
  ] = await Promise.all([
    // VDP PICK_UP events (agent = associate_id on the call, company_email is the lead)
    supaFetch(`vdp_calls?select=company_email,agent,market,time&event=eq.PICK_UP&time=gte.${since}&limit=50000`),
    // VDP END events with resolutions
    supaFetch(`vdp_calls?select=company_email,agent,cnresolution,time&event=eq.END&time=gte.${since}&cnresolution=not.is.null&limit=50000`),
    // Billing transactions
    supaFetch(`billing_transactions?select=agent_email,transaction_type,credits_charged,transaction_date&transaction_date=gte.${since.split('T')[0]}&limit=50000`),
    // All user credits
    supaFetch(`user_credits?select=email,credits_used,credits_remaining,aoi_connect_credits_used,aoi_plus_credits_used,aoi_recruit_credits_used&limit=10000`),
    // All inbound success events
    supaFetch(`inbound_success_events?select=agent_id,market,state,connected_at&limit=1000`),
    // Agent live call status
    supaFetch(`agent_live_call_status?select=agent_email,status,last_heartbeat_at,ccpro_enabled&limit=5000`),
    // Platform sales
    supaFetch(`platform_sales?select=associate_id,company_email,platform_alp,market,sga_submit&limit=50000`),
  ]);

  // ── Aggregate by email ────────────────────────────────────────────────────

  const agentMap = new Map<string, AgentUsageRow>();

  function getOrCreate(email: string): AgentUsageRow {
    if (!agentMap.has(email)) {
      agentMap.set(email, {
        email,
        connect_dials: 0,
        connect_answered: 0,
        connect_booked: 0,
        connect_credits_used: 0,
        connect_veteran_dials: 0,
        connect_globe_dials: 0,
        recruit_touches: 0,
        recruit_credits_used: 0,
        ccpro_credits_used: 0,
        ccpro_enabled: false,
        inbound_calls: 0,
        alp_submitted: 0,
        last_seen: null,
        connect_conversion_rate: 0,
        credits_total_used: 0,
        roi_score: 0,
      });
    }
    return agentMap.get(email)!;
  }

  // VDP PICK_UP — note: vdp_calls uses company_email as the lead email, agent is an associate_id
  // We need to match agent (associate_id) back to email. user_credits has email.
  // However the spec says "company_email is null → skip". Looking at the data: company_email is the
  // lead's email. The agent field is associate_id (not email). We'll use billing_transactions to
  // cross-reference, or just use company_email to identify per-agent activity when agent is present.
  // Actually: vdp_calls.agent = associate_id (not email). We'll build a dial count per associate_id.
  // user_credits.email is agent email. We may not be able to join these directly without a roster.
  // Strategy: use agent field as-is for connect stats. For ROI/credits, use user_credits by email.
  // We'll store connect stats under agent (associate_id) and credit stats under email, then merge
  // where possible. For the UI, we'll show agents that appear in at least one data source.

  // Build associate_id → email mapping from billing_transactions (has agent_email)
  // and inbound (has agent_id as email). We'll use whatever identifier we have.
  
  // For vdp_calls: use agent field. If it looks like an email, use directly; else use as key.
  const isEmail = (s: string) => s && s.includes('@');

  // VDP PICK_UP aggregation
  for (const row of pickupRows) {
    const agentKey = row.agent;
    if (!agentKey) continue;
    const email = isEmail(agentKey) ? agentKey : `associate:${agentKey}`;
    const rec = getOrCreate(email);
    rec.connect_dials++;
    if (row.company_email) rec.connect_answered++;
    const mkt = (row.market || '').toLowerCase();
    if (mkt.includes('veteran')) rec.connect_veteran_dials++;
    else if (mkt.includes('globe')) rec.connect_globe_dials++;
  }

  // VDP END with resolution = booked
  const BOOKED_RESOLUTIONS = ['appointment_set', 'sold', 'Appointment Set', 'Sold'];
  for (const row of endRows) {
    const agentKey = row.agent;
    if (!agentKey) continue;
    if (!row.cnresolution) continue;
    const res = row.cnresolution;
    if (BOOKED_RESOLUTIONS.some(br => res.toLowerCase() === br.toLowerCase() || res === br)) {
      const email = isEmail(agentKey) ? agentKey : `associate:${agentKey}`;
      getOrCreate(email).connect_booked++;
    }
  }

  // Billing transactions
  for (const row of billingRows) {
    if (!row.agent_email) continue;
    const rec = getOrCreate(row.agent_email);
    if (row.transaction_type === 'recruit') {
      rec.recruit_touches++;
    }
  }

  // User credits — merge by email (prefer email-based keys)
  for (const row of userCredits) {
    if (!row.email) continue;
    const rec = getOrCreate(row.email);
    rec.credits_total_used = parseFloat(row.credits_used) || 0;
    rec.connect_credits_used = parseFloat(row.aoi_connect_credits_used) || 0;
    rec.ccpro_credits_used = parseFloat(row.aoi_plus_credits_used) || 0;
    rec.recruit_credits_used = parseFloat(row.aoi_recruit_credits_used) || 0;
  }

  // Inbound success events
  for (const row of inboundRows) {
    if (!row.agent_id) continue;
    getOrCreate(row.agent_id).inbound_calls++;
  }

  // Agent live call status
  for (const row of liveStatusRows) {
    if (!row.agent_email) continue;
    const rec = getOrCreate(row.agent_email);
    rec.last_seen = row.last_heartbeat_at || null;
    rec.ccpro_enabled = !!row.ccpro_enabled;
  }

  // Platform sales — group by associate_id or company_email
  // associate_id may be email or ID. Try as email first.
  for (const row of salesRows) {
    const alp = parseFloat(row.platform_alp) || 0;
    if (alp <= 0) continue;
    // Try associate_id as email
    const key = row.associate_id || row.company_email;
    if (!key) continue;
    const email = isEmail(key) ? key : `associate:${key}`;
    getOrCreate(email).alp_submitted += alp;
  }

  // Derive calculated fields
  const rows: AgentUsageRow[] = [];
  for (const rec of agentMap.values()) {
    rec.connect_conversion_rate = rec.connect_dials > 0
      ? Math.round((rec.connect_booked / rec.connect_dials) * 100 * 10) / 10
      : 0;
    rec.roi_score = rec.credits_total_used > 0
      ? Math.round((rec.alp_submitted / rec.credits_total_used) * 10) / 10
      : 0;
    rec.alp_submitted = Math.round(rec.alp_submitted);
    rows.push(rec);
  }

  // Sort by connect_dials desc
  rows.sort((a, b) => b.connect_dials - a.connect_dials || b.credits_total_used - a.credits_total_used);

  _breakdownCache = rows;
  _breakdownCacheTime = Date.now();
  _breakdownDays = days;

  return rows;
}

export async function getTeamUsageSummary(days = 30): Promise<TeamUsageSummary> {
  const rows = await getUsageBreakdown(days);

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  let total_connect_dials = 0;
  let total_connect_booked = 0;
  let total_recruit_touches = 0;
  let total_inbound_calls = 0;
  let total_alp_submitted = 0;
  let total_credits_used = 0;
  let veteran_dials = 0;
  let globe_dials = 0;
  let active_agents_today = 0;

  for (const r of rows) {
    total_connect_dials += r.connect_dials;
    total_connect_booked += r.connect_booked;
    total_recruit_touches += r.recruit_touches;
    total_inbound_calls += r.inbound_calls;
    total_alp_submitted += r.alp_submitted;
    total_credits_used += r.credits_total_used;
    veteran_dials += r.connect_veteran_dials;
    globe_dials += r.connect_globe_dials;
    if (r.last_seen && new Date(r.last_seen).getTime() > dayAgo) {
      active_agents_today++;
    }
  }

  return {
    total_connect_dials,
    total_connect_booked,
    team_connect_conversion: total_connect_dials > 0
      ? Math.round((total_connect_booked / total_connect_dials) * 100 * 10) / 10
      : 0,
    total_recruit_touches,
    total_inbound_calls,
    total_alp_submitted: Math.round(total_alp_submitted),
    total_credits_used: Math.round(total_credits_used),
    veteran_dials,
    globe_dials,
    active_agents_today,
  };
}
