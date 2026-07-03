/**
 * Agent Scorer
 *
 * Pulls pick rate from vdp_calls and production from billing_transactions/platform_sales,
 * combines with live status to produce a score and tier for each agent.
 *
 * Tiers:
 *   elite  — pickRate > 0.50, any production
 *   active — pickRate 0.20-0.50 OR recent production
 *   low    — pickRate < 0.20, minimal production
 *   ghost  — pickRate < 0.05 with 100+ blasts (rolling 7 days)
 *
 * Score formula (0-100):
 *   pickScore    = pickRate * 40          (0-40)  — quality: do they answer?
 *   waitBonus    = min(minutesSincePick / 3, 40)  (0-40)  — fairness: longer wait = higher priority
 *                  (caps at 2 hours = max bonus; new agents with no history get full 40)
 *   productionScore * 20                  (0-20)  — production weight
 *
 * This ensures:
 *   - Ghosts stay at rank 0 (< 5% pick rate, 100+ blasts)
 *   - Good agents who JUST got a call drop in priority while agents waiting get boosted
 *   - New agents (no history) get max wait bonus = fair chance alongside elites
 *   - Elites who wait long enough will still float to top again
 *
 * Ghost agents are not suspended — they stay in Taalk at rank 0 (absolute bottom).
 * They can earn back: once rolling pickRate crosses 0.10 they re-enter "low" tier.
 */

const SUPA_URL  = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY  = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const GHOST_MIN_BLASTS   = 100;
const GHOST_MAX_PICK     = 0.05;
const GHOST_RECOVER_PICK = 0.10;  // crosses this → promoted to 'low'

export type AgentTier = 'elite' | 'active' | 'low' | 'ghost';

export interface AgentScore {
  email: string;
  associateId: number | null;
  tier: AgentTier;
  score: number;           // 0-100 composite (pick quality + wait fairness + production)
  pickRate: number;        // rolling 7-day
  blasts: number;          // rolling 7-day blast count
  alpLast30: number;       // ALP $ last 30 days
  productionScore: number; // 0-1 normalized
  wasOnlineLast24h: boolean;
  minutesSinceLastPick: number; // minutes since last VDP PICK_UP (large sentinel = none in window)
  /** Latest VDP PICK_UP time (ms); 0 = none in merged lookback — used for AO Recruit ordering */
  lastVdpPickAtMs: number;
  suggestedRank: number;   // 1-99 position-based: higher score = higher rank
  isNewlyGhost: boolean;   // true if crossed ghost threshold this cycle (for SMS trigger)
}

interface SupaRow { [k: string]: any }

async function supaFetch(table: string, params: string): Promise<SupaRow[]> {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Cache to detect ghost transitions (email → was ghost last cycle)
const prevGhostSet = new Set<string>();

/**
 * Score a list of agents by email.
 * Pass the full agent email list from Taalk — we batch all DB queries.
 * Also accepts an optional email→associateId map to resolve vdp_calls by agent field.
 * Pass unresolvedAssocIds for online agents whose email couldn't be resolved (e.g. recruit agents
 * not in customers table) — they get scored by associate ID and keyed by ID in the result map.
 */
export async function scoreAgents(
  agentEmails: string[],  // company_email values from customers/producerlist
  emailToAssociateId?: Map<string, string>, // email → associate_id for vdp_calls lookup
  unresolvedAssocIds?: string[], // associate IDs for agents with no resolvable email
  emailToMarket?: Map<string, string>, // email/assocId → normalized market for per-market rank assignment
): Promise<Map<string, AgentScore>> {
  const allAssocIds = [
    ...Array.from(emailToAssociateId?.values() ?? []),
    ...(unresolvedAssocIds ?? []),
  ].filter(Boolean);

  if (agentEmails.length === 0 && allAssocIds.length === 0) return new Map();

  const now = Date.now();
  const day7ago  = new Date(now - 7  * 86400_000).toISOString();
  const day30ago = new Date(now - 30 * 86400_000).toISOString();
  const day1ago  = new Date(now - 86400_000).toISOString();

  // Build associate_id → email reverse map for vdp_calls lookup
  const associateIdToEmail = new Map<string, string>();
  if (emailToAssociateId) {
    for (const [email, id] of emailToAssociateId) {
      if (id) associateIdToEmail.set(id, email);
    }
  }

  // ── 1. VDP call data (blasts + picks, rolling 7 days) ──────────────────────
  const BATCH = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < agentEmails.length; i += BATCH) {
    chunks.push(agentEmails.slice(i, i + BATCH));
  }

  // Also build associate ID chunks for querying vdp_calls.agent field.
  // Must include unresolvedAssocIds (e.g. online AO Recruit not in customers) — they are not in
  // emailToAssociateId, so omitting them left idChunks empty and recruit VDP rows never loaded.
  const associateIdsForVdp = new Set<string>();
  for (const id of associateIdToEmail.keys()) {
    if (id) associateIdsForVdp.add(String(id).trim());
  }
  for (const id of unresolvedAssocIds ?? []) {
    if (id) associateIdsForVdp.add(String(id).trim());
  }
  const associateIds = Array.from(associateIdsForVdp);
  const idChunks: string[][] = [];
  for (let i = 0; i < associateIds.length; i += BATCH) {
    idChunks.push(associateIds.slice(i, i + BATCH));
  }

  async function batchFetch(table: string, emailField: string, extraParams: string): Promise<SupaRow[]> {
    const results: SupaRow[] = [];
    for (const chunk of chunks) {
      const emailList = chunk.map(e => `"${e}"`).join(',');
      const rows = await supaFetch(table, `${emailField}=in.(${emailList})&${extraParams}`);
      results.push(...rows);
    }
    return results;
  }

  // Fetch vdp_calls by agent (associate ID) — more complete than by email
  async function fetchVdpByAgent(extraParams: string): Promise<SupaRow[]> {
    if (idChunks.length === 0) return [];
    const results: SupaRow[] = [];
    for (const chunk of idChunks) {
      const idList = chunk.map(id => `"${id}"`).join(',');
      const rows = await supaFetch('vdp_calls', `agent=in.(${idList})&${extraParams}`);
      results.push(...rows);
    }
    return results;
  }

  const [vdpRowsByEmail, vdpRowsByAgent, btRows, vdpOnlineRows, pickUpRows30d] = await Promise.all([
    // VDP events by email (PICK_UP events usually have email)
    batchFetch('vdp_calls', 'company_email',
      `select=company_email,event,agent,time&time=gte.${day7ago}&limit=50000`
    ),
    // VDP events by associate ID (END/blast events usually only have agent)
    fetchVdpByAgent(`select=company_email,event,agent,time&time=gte.${day7ago}&limit=50000`),
    // Billing transactions last 30 days
    batchFetch('billing_transactions', 'agent_email',
      `select=agent_email,created_at,adjudication_decision,status&status=eq.completed&created_at=gte.${day30ago}&limit=50000`
    ),
    // VDP heartbeat last 24h (proxy for "was online")
    batchFetch('vdp_calls', 'company_email',
      `select=company_email,time&time=gte.${day1ago}&limit=10000`
    ),
    // PICK_UP events 30d — build true "last call" per agent (24h window made everyone without a recent pick tie)
    fetchVdpByAgent(`select=company_email,agent,time&event=eq.PICK_UP&time=gte.${day30ago}&limit=50000`),
  ]);

  // Build per-email aggregates
  const blastsByEmail    = new Map<string, number>();
  const picksByEmail     = new Map<string, number>();
  const onlineLast24     = new Set<string>();
  const alpByEmail       = new Map<string, number>();
  // Also track by associate ID directly (for unresolved recruit agents)
  const blastsByAssocId  = new Map<string, number>();
  const picksByAssocId   = new Map<string, number>();
  const onlineLast24ById = new Set<string>();

  // Helper: resolve email from a vdp_calls row (by company_email or agent→associateId map)
  function resolveEmail(r: SupaRow): string {
    const byEmail = String(r.company_email || '').toLowerCase().trim();
    if (byEmail) return byEmail;
    const agentId = String(r.agent || '').trim();
    return associateIdToEmail.get(agentId) ?? '';
  }

  // Merge both vdp result sets (deduplicated is fine — counting is additive)
  const allVdpRows = [...vdpRowsByEmail, ...vdpRowsByAgent];

  for (const r of allVdpRows) {
    const e = resolveEmail(r);
    const agentId = String(r.agent || '').trim();
    const ev = String(r.event || '').toUpperCase();

    if (e) {
      blastsByEmail.set(e, (blastsByEmail.get(e) ?? 0) + 1);
      if (ev === 'PICK_UP' || ev === 'PICKUP') {
        picksByEmail.set(e, (picksByEmail.get(e) ?? 0) + 1);
      }
    }

    // Always track by associate ID for unresolved agents
    if (agentId) {
      blastsByAssocId.set(agentId, (blastsByAssocId.get(agentId) ?? 0) + 1);
      if (ev === 'PICK_UP' || ev === 'PICKUP') {
        picksByAssocId.set(agentId, (picksByAssocId.get(agentId) ?? 0) + 1);
      }
    }
  }

  // Mark online last 24h
  for (const r of [...vdpRowsByEmail, ...vdpRowsByAgent]) {
    const e = resolveEmail(r);
    if (e) onlineLast24.add(e);
    const agentId = String(r.agent || '').trim();
    if (agentId) onlineLast24ById.add(agentId);
  }

  // Last VDP PICK_UP per agent (email + associateId) — merge 7d all events + 30d pick-ups only
  const lastPickByEmail = new Map<string, number>();
  const lastPickByAssocId = new Map<string, number>();
  function bumpLastPickFromRow(r: SupaRow, requirePickEvent: boolean) {
    if (requirePickEvent) {
      const ev = String(r.event || '').toUpperCase();
      if (ev !== 'PICK_UP' && ev !== 'PICKUP') return;
    }
    const t = r.time ? new Date(r.time).getTime() : 0;
    if (!t) return;
    const e = resolveEmail(r);
    const agentId = String(r.agent || '').trim();
    if (e && (!lastPickByEmail.has(e) || t > lastPickByEmail.get(e)!)) lastPickByEmail.set(e, t);
    if (agentId && (!lastPickByAssocId.has(agentId) || t > lastPickByAssocId.get(agentId)!)) {
      lastPickByAssocId.set(agentId, t);
    }
  }
  for (const r of allVdpRows) bumpLastPickFromRow(r, true);
  for (const r of pickUpRows30d) bumpLastPickFromRow(r, false);

  for (const r of btRows) {
    const e = String(r.agent_email || '').toLowerCase().trim();
    if (!e || r.adjudication_decision === 'refund') continue;
    // Each completed non-refund billing transaction ≈ 1 connect
    // We don't have direct ALP here — use count as proxy for now
    // TODO: join with platform_sales for real ALP
    alpByEmail.set(e, (alpByEmail.get(e) ?? 0) + 1);
  }

  // Max ALP for normalization
  const maxAlp = Math.max(...Array.from(alpByEmail.values()), 1);

  const result = new Map<string, AgentScore>();

  for (const email of agentEmails) {
    const e = email.toLowerCase().trim();
    const blasts  = blastsByEmail.get(e)  ?? 0;
    const picks   = picksByEmail.get(e)   ?? 0;
    const alp     = alpByEmail.get(e)     ?? 0;
    const online24 = onlineLast24.has(e);

    const pickRate = blasts > 0 ? picks / blasts : 0;
    const productionScore = alp / maxAlp;

    const lastPickMs = lastPickByEmail.get(e) ?? 0;
    const minutesSinceLastPick = lastPickMs > 0 ? Math.round((now - lastPickMs) / 60000) : 999999;

    // Ghost: 100+ blasts, pick rate < 5%
    const isGhost = blasts >= GHOST_MIN_BLASTS && pickRate < GHOST_MAX_PICK;
    const wasGhost = prevGhostSet.has(e);
    const recovering = wasGhost && pickRate >= GHOST_RECOVER_PICK;

    let tier: AgentTier;
    if (isGhost && !recovering) {
      tier = 'ghost';
    } else if (pickRate >= 0.50) {
      tier = 'elite';
    } else if (pickRate >= 0.20 || productionScore > 0.1) {
      tier = 'active';
    } else {
      tier = 'low';
    }

    const isNewlyGhost = tier === 'ghost' && !wasGhost;

    // ── New composite score ──────────────────────────────────────────────────
    // pickScore (0-40):  quality — do they answer when blasted?
    const pickScore = pickRate * 40;
    // waitBonus (0-40):  fairness — the longer since last pick, the higher priority
    //   No pick today (9999) = full 40 bonus (new/waiting agents get fair shot)
    //   Caps at 120 minutes = max bonus
    const waitBonus = lastPickMs <= 0 ? 40 : Math.min(minutesSinceLastPick / 3, 40);
    // productionBonus (0-20): production weight
    const productionBonus = productionScore * 20;

    const score = Math.round(Math.min(100, Math.max(0, pickScore + waitBonus + productionBonus)));

    // suggestedRank is assigned AFTER all agents are scored (position-based, see below)
    result.set(e, {
      email: e,
      associateId: null,
      tier,
      score,
      pickRate,
      blasts,
      alpLast30: alp,
      productionScore,
      wasOnlineLast24h: online24,
      minutesSinceLastPick,
      lastVdpPickAtMs: lastPickMs,
      suggestedRank: tier === 'ghost' ? 0 : 50, // placeholder — set below
      isNewlyGhost,
    });
  }

  // Score unresolved associate IDs (online agents with no email, e.g. recruit agents)
  for (const id of (unresolvedAssocIds ?? [])) {
    if (!id || result.has(id)) continue;
    const blasts   = blastsByAssocId.get(id)  ?? 0;
    const picks    = picksByAssocId.get(id)   ?? 0;
    const online24 = onlineLast24ById.has(id);

    const pickRate = blasts > 0 ? picks / blasts : 0;

    const lastPickMs = lastPickByAssocId.get(id) ?? 0;
    const minutesSinceLastPick = lastPickMs > 0 ? Math.round((now - lastPickMs) / 60000) : 999999;

    const isGhost = blasts >= GHOST_MIN_BLASTS && pickRate < GHOST_MAX_PICK;
    const wasGhost = prevGhostSet.has(id);
    const recovering = wasGhost && pickRate >= GHOST_RECOVER_PICK;

    let tier: AgentTier;
    if (isGhost && !recovering) tier = 'ghost';
    else if (pickRate >= 0.50)  tier = 'elite';
    else if (pickRate >= 0.20)  tier = 'active';
    else                        tier = 'low';

    const pickScore  = pickRate * 40;
    const waitBonus  = lastPickMs <= 0 ? 40 : Math.min(minutesSinceLastPick / 3, 40);
    const score = Math.round(Math.min(100, Math.max(0, pickScore + waitBonus)));

    result.set(id, {
      email: id,
      associateId: null,
      tier,
      score,
      pickRate,
      blasts,
      alpLast30: 0,
      productionScore: 0,
      wasOnlineLast24h: online24,
      minutesSinceLastPick,
      lastVdpPickAtMs: lastPickMs,
      suggestedRank: tier === 'ghost' ? 0 : 50, // placeholder
      isNewlyGhost: tier === 'ghost' && !wasGhost,
    });
  }

  // ── Position-based rank assignment (per market) ─────────────────────────────
  // Ranks are assigned WITHIN each market so Veteran/Globe/AO Recruit each get
  // their own 1-99 spread. Agents in different markets never steal ranks from each other.
  // Ghosts stay at 0 globally.
  // emailToMarket is passed in so we know which market each agent belongs to.
  const byMarket = new Map<string, AgentScore[]>();
  for (const s of result.values()) {
    if (s.tier === 'ghost') continue;
    const market = (emailToMarket?.get(s.email) ?? 'unknown').toLowerCase();
    if (!byMarket.has(market)) byMarket.set(market, []);
    byMarket.get(market)!.push(s);
  }
  for (const [marketKey, group] of byMarket) {
    // AO Recruit: rank strictly by longest time since last VDP PICK_UP (ms precision).
    if (marketKey === 'ao recruit') {
      group.sort((a, b) => {
        const wa = a.lastVdpPickAtMs > 0 ? now - a.lastVdpPickAtMs : Number.MAX_SAFE_INTEGER;
        const wb = b.lastVdpPickAtMs > 0 ? now - b.lastVdpPickAtMs : Number.MAX_SAFE_INTEGER;
        const d = wb - wa;
        return d !== 0 ? d : a.email.localeCompare(b.email);
      });
    } else {
      group.sort((a, b) => b.score - a.score);
    }
    const total = group.length;
    group.forEach((s, i) => {
      const rank = total <= 1 ? 99 : Math.max(1, Math.round(99 - (i / (total - 1)) * 98));
      s.suggestedRank = rank;
    });
  }

  // Update ghost set for next cycle
  prevGhostSet.clear();
  for (const [e, s] of result) {
    if (s.tier === 'ghost') prevGhostSet.add(e);
  }

  return result;
}
