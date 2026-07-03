/**
 * Reactor — Master Control Loop
 *
 * Runs every POLL_INTERVAL_MS (60s by default).
 * Sequence:
 *   1. Fetch live agent states from Taalk (RTS)
 *   2. Fetch all campaigns from Taalk
 *   3. Score all agents (pick rate + production from Supabase)
 *   4. Detect ghost transitions → trigger SMS
 *   5. Push new ranks to Taalk for agents whose rank changed
 *   6. Calculate optimal dial rates per campaign
 *   7. Push rate updates to Taalk for campaigns that need adjustment
 *   8. Publish state to in-memory store for dashboard reads
 *
 * The reactor is the only thing that writes agent rank + dial rates to Taalk.
 * (state.ts priority queue is UI / Supabase only — it no longer POSTs rank, which used to
 *  overwrite scorer ranks with Math.max(90 - i, 1) and pin most agents at rank 1.)
 */

import * as taalk from './taalk-client.js';
import { appState } from './state.js';
import { normalizeAgent, normalizeMarket } from './normalize.js';
import { scoreAgents } from './agent-scorer.js';
import { processGhostTransitions, markGhostRecovered, getActiveGhosts } from './ghost-tracker.js';
import { calculateDialPlans } from './dial-rate-controller.js';
import type { NormalizedAgent, NormalizedCampaign } from '../shared/types.js';
import type { AgentScore } from './agent-scorer.js';
import type { CampaignDialPlan } from './dial-rate-controller.js';
import type { GhostRecord } from './ghost-tracker.js';

const POLL_INTERVAL_MS = 120_000; // 120s

export interface ReactorState {
  lastRun: Date | null;
  agentScores: Map<string, AgentScore>;
  dialPlans: CampaignDialPlan[];
  ghosts: GhostRecord[];
  rankUpdates: number;
  rateUpdates: number;
  errors: string[];
  running: boolean;
}

const state: ReactorState = {
  lastRun: null,
  agentScores: new Map(),
  dialPlans: [],
  ghosts: [],
  rankUpdates: 0,
  rateUpdates: 0,
  errors: [],
  running: false,
};

let timer: ReturnType<typeof setInterval> | null = null;

function isCampaignAlreadyStoppedError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('campaign is not under run') || message.includes('404 not found');
}

export function getReactorState(): ReactorState {
  return { ...state, agentScores: new Map(state.agentScores) };
}

// Temporary store for agent contact info (names, phones) keyed by email
// Populated from Supabase customers table on first run
const agentNames  = new Map<string, string>();
const agentPhones = new Map<string, string>();
const agentStates = new Map<string, string[]>(); // email → licensed states

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

// Associate ID → company email map (populated from Supabase customers table)
// Taalk agents only have params.id (associate ID) — no email in params
const associateIdToEmail = new Map<string, string>();

async function loadAssociateIdMap(): Promise<void> {
  try {
    // Load from both customers and producerlist — recruit agents are often only in producerlist
    async function fetchAllPages(table: string): Promise<any[]> {
      const PAGE = 1000;
      const all: any[] = [];
      let offset = 0;
      while (true) {
        const res = await fetch(
          `${SUPA_URL}/rest/v1/${table}?select=associate_id,company_email&associate_id=not.is.null&company_email=not.is.null&limit=${PAGE}&offset=${offset}`,
          { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
        );
        if (!res.ok) break;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) break;
        all.push(...rows);
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
      return all;
    }

    const [custRows, prodRows] = await Promise.all([
      fetchAllPages('customers'),
      fetchAllPages('producerlist'),
    ]);

    // producerlist first (so customers can override if both have the same ID)
    for (const r of (Array.isArray(prodRows) ? prodRows : [])) {
      const id    = String(r.associate_id ?? '').trim();
      const email = String(r.company_email ?? '').toLowerCase().trim();
      if (id && email) associateIdToEmail.set(id, email);
    }
    for (const r of (Array.isArray(custRows) ? custRows : [])) {
      const id    = String(r.associate_id ?? '').trim();
      const email = String(r.company_email ?? '').toLowerCase().trim();
      if (id && email) associateIdToEmail.set(id, email);
    }

    console.log(`⚛️  Loaded ${associateIdToEmail.size} associate ID → email mappings (customers + producerlist)`);
  } catch (err: any) {
    console.error('⚛️  Failed to load associate ID map:', err.message);
  }
}

/** CRM / MLM associate id — prefer params over Taalk roster `id` (roster id is often a different numeric worker key). */
function taalkAssociateId(agent: any): string {
  const p = agent?.params || {};
  const raw =
    p.associate_id ??
    agent?.id ??
    p.id ??
    '';
  if (raw === '' || raw == null) return '';
  return String(raw).trim();
}

/** Resolve agent email from Taalk agent object.
 *  Priority: params.company_email → params.email → associateIdToEmail[id] → fallback */
function resolveAgentEmail(agent: any): string {
  const fromParams = String(agent.params?.company_email || agent.params?.email || '').toLowerCase().trim();
  if (fromParams.includes('@')) return fromParams;
  const associateId = taalkAssociateId(agent);
  if (associateId && associateIdToEmail.has(associateId)) {
    return associateIdToEmail.get(associateId)!;
  }
  return '';
}

async function loadAgentContacts(emails: string[]): Promise<void> {
  try {
    const list = emails.map(e => `"${e}"`).join(',');
    const res = await fetch(
      `${SUPA_URL}/rest/v1/customers?company_email=in.(${list})&select=company_email,first_name,last_name,cell_phone,states`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    if (!res.ok) return;
    const rows = await res.json();
    for (const r of (Array.isArray(rows) ? rows : [])) {
      const e = String(r.company_email || '').toLowerCase().trim();
      if (!e) continue;
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
      if (name) agentNames.set(e, name);
      if (r.cell_phone) agentPhones.set(e, r.cell_phone);
      if (Array.isArray(r.states) && r.states.length > 0) agentStates.set(e, r.states);
    }
  } catch { /* non-critical */ }
}

/** Estimate NO_AGENT rate per state from recent VDP data (last 30 min). */
async function fetchNoAgentRates(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const res = await fetch(
      `${SUPA_URL}/rest/v1/vdp_calls?select=state,event&time=gte.${since}&limit=5000`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    if (!res.ok) return map;
    const rows: any[] = await res.json();

    const transfersByState  = new Map<string, number>();
    const noAgentByState    = new Map<string, number>();

    for (const r of rows) {
      const s = String(r.state || '').toUpperCase().slice(0, 2);
      if (!s || s.length < 2) continue;
      const ev = String(r.event || '').toUpperCase();
      if (ev === 'TRANSFER' || ev === 'END') {
        transfersByState.set(s, (transfersByState.get(s) ?? 0) + 1);
      }
      if (ev === 'NO_AGENT' || ev === 'NOAGENT') {
        noAgentByState.set(s, (noAgentByState.get(s) ?? 0) + 1);
      }
    }

    for (const [state, transfers] of transfersByState) {
      const noAgent = noAgentByState.get(state) ?? 0;
      const total = transfers + noAgent;
      if (total > 0) map.set(state, noAgent / total);
    }
  } catch { /* non-critical */ }
  return map;
}

/** Campaign IDs that belong to the AO Recruit market (national — no state filter). */
const RECRUIT_CAMPAIGN_IDS = new Set(['68cc2de5f67f5aeafec89b3b', '67c4c3c89333db8e651d07be']);

function recruitCampaignMatch(agent: any): boolean {
  const candidates = [
    agent?.params?.campaign,
    agent?.params?.campaign_id,
    agent?.params?.campaignId,
    agent?.campaign,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'object' && c._id != null) {
      const id = String(c._id).trim();
      if (id && RECRUIT_CAMPAIGN_IDS.has(id)) return true;
    }
    const s = String(c).trim();
    if (s && RECRUIT_CAMPAIGN_IDS.has(s)) return true;
  }
  return false;
}

/** Market bucket for scoring + rank push (must match dashboard normalizeMarket / RMS / recruit campaigns). */
function agentMarket(agent: any): string {
  if (recruitCampaignMatch(agent)) return 'AO Recruit';
  const raw = agent.params?.market || agent.params?.group_name || agent.market || '';
  const n = normalizeMarket(raw);
  if (n === 'Veteran' || n === 'AO Recruit') return n;
  return 'Globe';
}

function taalkAgentMongoId(agent: any): string | null {
  const cands = [
    agent?._id,
    agent?.mongoId,
    agent?.mongo_id,
    agent?.params?.mongo_id,
    agent?.params?._id,
    agent?.params?.agent_mongo_id,
  ];
  for (const c of cands) {
    const s = c != null ? String(c).trim() : '';
    if (s) return s;
  }
  return null;
}

/**
 * Upsert agent_queue_position rows to Supabase.
 * AOIrail reads this table to determine inbound call routing priority.
 * Positions are assigned per-market. AO Recruit: round-robin by minutes since last VDP pick only.
 */
async function syncQueuePositions(allAgents: any[], scores: Map<string, AgentScore>): Promise<void> {
  try {
    // Build rows — only online, non-ghost agents get a real position
    const rows: Record<string, any>[] = [];

    // Group online eligible agents by market, sort by score desc
    const byMarket = new Map<string, { email: string; score: AgentScore; agent: any }[]>();
    for (const agent of allAgents) {
      const email = resolveAgentEmail(agent);
      if (!email) continue;
      const associateId = taalkAssociateId(agent);
      const score =
        scores.get(email) ||
        (associateId ? scores.get(associateId) : undefined) ||
        undefined;
      if (!score || score.tier === 'ghost') continue;
      if (!agent.online) continue;
      const market = agentMarket(agent);
      if (!byMarket.has(market)) byMarket.set(market, []);
      byMarket.get(market)!.push({ email, score, agent });
    }

    const rankNow = Date.now();
    for (const [market, entries] of byMarket) {
      if (market === 'AO Recruit') {
        entries.sort((a, b) => {
          const wa =
            a.score.lastVdpPickAtMs > 0 ? rankNow - a.score.lastVdpPickAtMs : Number.MAX_SAFE_INTEGER;
          const wb =
            b.score.lastVdpPickAtMs > 0 ? rankNow - b.score.lastVdpPickAtMs : Number.MAX_SAFE_INTEGER;
          const d = wb - wa;
          return d !== 0 ? d : a.email.localeCompare(b.email);
        });
      } else {
        entries.sort((a, b) => b.score.score - a.score.score);
      }
      entries.forEach(({ email, score, agent }, idx) => {
        rows.push({
          email,
          position: idx + 1,
          score: score.score,
          calls_today: 0, // placeholder — not tracked here
          minutes_idle: score.wasOnlineLast24h ? 0 : 999,
          has_credits: true, // AOIrail owns credit tracking; default true
          ccpro: false,
          market,
          worker_sid: agent.worker_sid ?? null,
          is_online: true,
          updated_at: new Date().toISOString(),
        });
      });
    }

    // Also write offline/ghost agents as is_online=false so AOIrail knows they exist
    for (const agent of allAgents) {
      const email = resolveAgentEmail(agent);
      if (!email) continue;
      if (rows.some(r => r.email === email)) continue; // already added
      const score = scores.get(email);
      rows.push({
        email,
        position: 0,
        score: score?.score ?? 0,
        calls_today: 0,
        minutes_idle: 999,
        has_credits: false,
        ccpro: false,
        market: agentMarket(agent),
        worker_sid: agent.worker_sid ?? null,
        is_online: false,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length === 0) return;

    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      await fetch(`${SUPA_URL}/rest/v1/agent_queue_position`, {
        method: 'POST',
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(batch),
      });
    }

    console.log(`⚛️  Queue sync: ${rows.filter(r => r.is_online).length} online agents written to agent_queue_position`);
  } catch (err: any) {
    console.error('⚛️  Queue sync error:', err.message);
  }
}

async function runCycle(): Promise<void> {
  if (state.running) return; // skip if previous cycle still running
  state.running = true;
  state.errors = [];

  try {
    // ── 1. Fetch live data ──────────────────────────────────────────────────
    // Ensure associate ID map is loaded (loads once, then stays cached)
    if (associateIdToEmail.size === 0) await loadAssociateIdMap();

    const [allAgents, campaigns] = await Promise.all([
      taalk.fetchAllAgents(),
      taalk.fetchAllCampaigns(), // fetch ALL campaigns (not just page 1)
    ]);

    const onlineAgents: NormalizedAgent[] = allAgents.filter((a: any) => a.online);

    // Resolve emails via associate ID map since params.company_email is not set
    const emails = allAgents
      .map((a: any) => resolveAgentEmail(a))
      .filter((e: string) => e.includes('@'));

    // scoreAgents can run on unresolved associate IDs alone (recruit agents often have no customer email).
    const hasOnlineUnresolved = allAgents.some((a: any) => {
      const e = resolveAgentEmail(a);
      const id = taalkAssociateId(a);
      return !!a.online && !!id && !(e && id);
    });
    if (emails.length === 0 && !hasOnlineUnresolved) {
      console.log('⚛️  Reactor: no agent emails found — skipping cycle');
      return;
    }

    // Load contact info (names + phones) for ghost SMS
    await loadAgentContacts(emails);

    // ── 2. Score agents ─────────────────────────────────────────────────────
    const emailToAssocId = new Map<string, string>();
    const emailToMarket  = new Map<string, string>(); // email/assocId → market
    const unresolvedAssocIds: string[] = [];

    for (const a of allAgents) {
      const email = resolveAgentEmail(a);
      const id    = taalkAssociateId(a);
      const mkt   = agentMarket(a); // 'Veteran' | 'AO Recruit' | 'Globe'

      if (email && id) {
        emailToAssocId.set(email, id);
        emailToMarket.set(email, mkt);
      } else if (email && !id) {
        // Taalk sometimes omits associate id; still score + rank by email with correct market bucket
        emailToMarket.set(email, mkt);
      } else if (id && a.online) {
        unresolvedAssocIds.push(id);
        emailToMarket.set(id, mkt); // keyed by assocId for unresolved agents
      }
    }
    const scores = await scoreAgents(emails, emailToAssocId, unresolvedAssocIds, emailToMarket);
    state.agentScores = scores;

    // ── 3. Ghost transitions ────────────────────────────────────────────────
    const newlyGhost = [...scores.values()]
      .filter(s => s.isNewlyGhost)
      .map(s => s.email);

    const recovering = allAgents
      .map((a: any) => resolveAgentEmail(a))
      .filter((e: string) => {
        const s = scores.get(e);
        return s && s.tier !== 'ghost' && s.pickRate >= 0.10;
      });

    await processGhostTransitions(newlyGhost, agentNames, agentPhones);
    for (const e of recovering) await markGhostRecovered(e);

    state.ghosts = await getActiveGhosts();

    // ── 4. Sync agent_queue_position to Supabase (AOIrail reads this) ────────
    await syncQueuePositions(allAgents, scores);

    // Normalized roster (same shape as dial-rate + AOI) — must run before rank push.
    const normalizedAgents: NormalizedAgent[] = allAgents.map((a: any) => {
      const base = normalizeAgent(a);
      const email = resolveAgentEmail(a);
      const taalkStates: string[] = a.params?.states ?? [];
      const custStates: string[] = agentStates.get(email) ?? [];
      const rawMkt = a.params?.market || a.params?.group_name || a.market || '';
      return {
        ...base,
        normalizedEmail: email,
        normalizedMarket: normalizeMarket(rawMkt),
        states: custStates.length > 0 ? custStates : taalkStates,
        ccPro: a.ccPro ?? false,
        online: !!a.online,
        busy: !!a.busy,
        away: !!a.away,
        suspended: !!a.suspended,
      };
    });

    // ── 5. Push rank updates to Taalk ─────────────────────────────────────────
    // Business rule: every online agent is forced to rank 1.
    // Do not apply scorer/queue/starred/demotion variants here.

    let rankUpdates = 0;
    let rankSkippedNoMongo = 0;
    for (let idx = 0; idx < allAgents.length; idx++) {
      const agent = allAgents[idx];
      if (!agent.online) continue; // only push rank for online agents

      const email = resolveAgentEmail(agent);
      const associateId = taalkAssociateId(agent);

      const mongoId = taalkAgentMongoId(agent);

      if (!mongoId) {
        rankSkippedNoMongo++;
        continue;
      }

      const targetRank = 1;

      // Always POST — Taalk often returns a stale `rank` on fetch; skipping when "equal" never fixes drift.
      try {
        await taalk.updateAgentRank(mongoId, targetRank);
        rankUpdates++;
      } catch (err: any) {
        state.errors.push(`rank update ${email || associateId}: ${err.message}`);
      }
    }
    if (rankSkippedNoMongo > 0) {
      state.errors.push(
        `⚛️  ${rankSkippedNoMongo} online agent(s) skipped rank: no mongo _id on roster payload`,
      );
    }
    state.rankUpdates = rankUpdates;

    // ── 6. Calculate + push dial rate updates ───────────────────────────────
    const noAgentRates = await fetchNoAgentRates();

    const normalizedCampaigns: NormalizedCampaign[] = campaigns.map((c: any) => ({
      _id: c._id,
      name: c.name,
      limitPerHour: c.limitPerHour,
      contactCount: c.contactCount ?? 0,
      status:
        Number(c?.currentTask?.status) === 1
          ? 'running'
          : Number(c?.currentTask?.status) === 0
            ? 'stopped'
            : Number(c?.currentTask?.status) === 3
              ? 'completed'
              : 'unknown',
    }));

    const plans = calculateDialPlans(normalizedCampaigns, normalizedAgents, scores, noAgentRates);

    state.dialPlans = plans;

    let rateUpdates = 0;
    const campaignStatusById = new Map(
      normalizedCampaigns.map((campaign) => [campaign._id, String(campaign.status || 'unknown').toLowerCase()]),
    );
    for (const plan of plans) {
      // Non-recruit (Veteran/Globe): hard-stopped — rate 0 + pause every cycle.
      if (plan.globeHardStop) {
        try {
          if (plan.shouldUpdate) {
            await taalk.updateCampaignRate(plan.campaignId, 0);
            rateUpdates++;
            console.log(`⚛️  Non-recruit disabled — rate ${plan.campaignName} (${plan.state}): ${plan.currentRate} → 0 | ${plan.reason}`);
          }
          const campaignStatus = campaignStatusById.get(plan.campaignId) || 'unknown';
          if (campaignStatus === 'running' || campaignStatus === 'unknown') {
            await taalk.pauseCampaign(plan.campaignId);
            console.log(`⚛️  Non-recruit disabled — pause: ${plan.campaignName}`);
          }
        } catch (err: any) {
          if (isCampaignAlreadyStoppedError(err)) {
            continue;
          }
          state.errors.push(`non-recruit pause/rate ${plan.campaignName}: ${err.message}`);
        }
        continue;
      }

      if (!plan.shouldUpdate) continue;
      try {
        await taalk.updateCampaignRate(plan.campaignId, plan.targetRate);
        console.log(`⚛️  Rate ${plan.campaignName} (${plan.state}): ${plan.currentRate} → ${plan.targetRate} | ${plan.reason}`);
        rateUpdates++;
      } catch (err: any) {
        state.errors.push(`rate update ${plan.campaignName}: ${err.message}`);
      }
    }
    state.rateUpdates = rateUpdates;

    state.lastRun = new Date();
    console.log(`⚛️  Reactor cycle complete — ${rankUpdates} rank updates, ${rateUpdates} rate updates, ${newlyGhost.length} new ghosts`);

  } catch (err: any) {
    state.errors.push(`cycle error: ${err.message}`);
    console.error('⚛️  Reactor cycle error:', err.message);
  } finally {
    state.running = false;
  }
}

export function startReactor(): void {
  if (timer) return;
  console.log('⚛️  Reactor starting...');
  runCycle(); // run immediately on start
  timer = setInterval(runCycle, POLL_INTERVAL_MS);
}

export function stopReactor(): void {
  if (timer) { clearInterval(timer); timer = null; }
  console.log('⚛️  Reactor stopped');
}
