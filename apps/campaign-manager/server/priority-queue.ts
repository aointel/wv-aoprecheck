/**
 * Priority Queue Scoring
 *
 * Scores each ONLINE agent to determine transfer priority order.
 * Higher score = higher priority = gets calls first.
 *
 * AO Recruit: no credits / calls-today / idle caps / busy penalties — strict round-robin by
 * time since last Taalk call end (ms; longest waiting = highest priority). Everyone gets a rank spread 1–99.
 *
 * Other markets:
 *   score = 100 − calls×5 + min(idle,30) + 20 + ccPro; busy/away penalties; credits gate.
 */

import type { NormalizedAgent } from '../shared/types.js';

export interface QueuePosition {
  agentId: number;
  agentMongoId: string;
  agentName: string;
  market: string;
  position: number;       // 1 = next to get a call
  score: number;
  callsToday: number;
  minutesIdle: number;
  taalkRank: number | null; // current Taalk rank from RTS
  suggestedRank: number;    // what we'd set if sync is enabled
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Calculate priority queue positions for all online, non-suspended agents.
 * Returns sorted array (position 1 = highest priority).
 */
export function calculateQueuePositions(
  agents: NormalizedAgent[],
  callsToday: Map<number, number>,
  idleAccumulator: Map<number, number>,
  lastCallEndTime: Map<number, string>,
  getCredits?: (agentId: number) => number | null,
): QueuePosition[] {
  // Only score online, non-suspended agents
  const eligible = agents.filter(a => a.online && !a.suspended);

  const scored: QueuePosition[] = eligible.map(agent => {
    const calls = callsToday.get(agent.id) ?? 0;
    const lastEnd = lastCallEndTime.get(agent.id) ?? agent.lastHangupTime ?? '';
    const msSinceLastCall = lastEnd
      ? Date.now() - new Date(lastEnd).getTime()
      : Number.MAX_SAFE_INTEGER;
    const minutesSinceCall = Math.round(msSinceLastCall / 60000);

    // ── AO Recruit: round-robin by last call end — score = raw ms since end (sort high first; no minute rounding ties)
    if (agent.normalizedMarket === 'AO Recruit') {
      let suggestedRank = 0;
      return {
        agentId: agent.id,
        agentMongoId: agent._id,
        agentName: agent.fullName,
        market: agent.normalizedMarket,
        position: 0,
        score: msSinceLastCall,
        callsToday: calls,
        minutesIdle: minutesSinceCall,
        taalkRank: agent.rank,
        suggestedRank,
      };
    }

    // ── Veteran / Globe / etc.: existing composite score
    let minutesIdle = 0;
    if (!agent.busy && !agent.away) {
      const idleMs = idleAccumulator.get(agent.id) ?? 0;
      minutesIdle = idleMs / 60000;
      if (lastEnd) {
        const sinceLast = (Date.now() - new Date(lastEnd).getTime()) / 60000;
        minutesIdle = Math.max(minutesIdle, sinceLast);
      }
    }

    let score = 100;
    score -= calls * 5;
    score += Math.min(minutesIdle, 30);
    score += 20;
    score += agent.ccPro ? 10 : 0;
    if (agent.busy) score -= 50;
    if (agent.away) score -= 80;
    score = clamp(score, 1, 200);

    const agentCredits = getCredits ? (getCredits(agent.id) ?? 0) : 0;
    if (agentCredits <= 0) score = 0;

    let suggestedRank = 0;

    return {
      agentId: agent.id,
      agentMongoId: agent._id,
      agentName: agent.fullName,
      market: agent.normalizedMarket,
      position: 0,
      score: Math.round(score),
      callsToday: calls,
      minutesIdle: Math.round(minutesIdle),
      taalkRank: agent.rank,
      suggestedRank,
    };
  });

  // Group by market and assign positions WITHIN each market
  const byMarket = new Map<string, QueuePosition[]>();
  for (const q of scored) {
    const mkt = q.market || 'Unknown';
    if (!byMarket.has(mkt)) byMarket.set(mkt, []);
    byMarket.get(mkt)!.push(q);
  }

  // Sort within each market by score descending, assign per-market positions
  for (const [mkt, group] of byMarket) {
    group.sort((a, b) => {
      const d = b.score - a.score;
      return d !== 0 ? d : a.agentId - b.agentId;
    });
    const total = group.length;
    const isRecruit = mkt === 'AO Recruit';
    group.forEach((q, i) => {
      q.position = i + 1;
      // AO Recruit: always assign 1–99 (fair rotation); others: 0 credits → rank 0
      const eligibleForRank = isRecruit || q.score > 0;
      q.suggestedRank = eligibleForRank
        ? total <= 1
          ? 99
          : Math.max(1, Math.round(99 - (i / (total - 1)) * 98))
        : 0;
    });
  }

  // Flatten back into a single array (sorted by market then position)
  const result: QueuePosition[] = [];
  for (const [, group] of byMarket) {
    result.push(...group);
  }

  return result;
}
