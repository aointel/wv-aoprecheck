/**
 * Production Rank Service
 * Computes Bronze / Silver / Gold / Platinum from Production, Plus Leads, Call Score, and AOI Usage.
 * Used by GET /api/outbound-dialer/rank and by hotlead assignment (priority order).
 */

import { supabaseAdmin } from './supabase';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { getAOIScoreByEmail, getAssociateIdByEmail, calculateAndUpsertAOIScore } from './aoi-score-service';
import { connectnowService } from './connectnow-service';

export type ProductionRank = 'bronze' | 'silver' | 'gold' | 'platinum';

const RANK_ORDER: Record<ProductionRank, number> = {
  platinum: 4,
  gold: 3,
  silver: 2,
  bronze: 1,
};

export function getRankOrder(rank: ProductionRank): number {
  return RANK_ORDER[rank] ?? 0;
}

export interface RankInputs {
  production: number;
  plusLeads: number;
  callScore: number;
  aoiUsage: number;
}

export interface TierInfo {
  id: ProductionRank;
  name: string;
  requirements: string;
  advantages: string[];
}

export interface RankResult {
  rank: ProductionRank;
  inputs: RankInputs;
  nextTier?: { name: string; requirements: string; progressPct: number };
  tiers: TierInfo[];
}

export const PRODUCTION_RANK_TIERS: TierInfo[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    requirements: 'Get started: any activity in Production, Plus Leads, Call Score, or AOI Usage.',
    advantages: ['Access to AO Queue and tools', 'Baseline priority for leads and connects'],
  },
  {
    id: 'silver',
    name: 'Silver',
    requirements: 'Reach ~25% of the combined score (Production, Plus Leads, Call Score, AOI Usage).',
    advantages: ['Higher priority on AOI Connects', 'Higher priority on AO Queue leads and refreshes'],
  },
  {
    id: 'gold',
    name: 'Gold',
    requirements: 'Reach ~50% of the combined score across all four metrics.',
    advantages: ['Even higher priority on AOI Connects', 'Even higher priority on AO Queue leads and refreshes', 'Preferred in lead assignment'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    requirements: 'Reach ~75%+ of the combined score across all four metrics.',
    advantages: ['Highest priority on AOI Connects', 'Highest priority on AO Queue leads and refreshes', 'First in line for new Hot Leads', 'Peak performance tier'],
  },
];

// Normalize raw values to 0–100 for composite score. Tuned for typical ranges.
function normProduction(raw: number): number {
  return Math.min(100, (raw / 80) * 100); // e.g. 80 connects or 4000 ALP ≈ 100
}
function normPlusLeads(raw: number): number {
  return Math.min(100, raw * 5); // 20+ plus leads ≈ 100
}
function normCallScore(raw: number): number {
  return Math.min(100, raw); // already 0–100
}
function normAoiUsage(raw: number): number {
  return Math.min(100, (raw / 300) * 100); // 300 credits used ≈ 100
}

const WEIGHTS = { production: 0.4, plusLeads: 0.2, callScore: 0.25, aoiUsage: 0.15 };

function compositeScore(inputs: RankInputs): number {
  const p = normProduction(inputs.production);
  const pl = normPlusLeads(inputs.plusLeads);
  const c = normCallScore(inputs.callScore);
  const a = normAoiUsage(inputs.aoiUsage);
  return p * WEIGHTS.production + pl * WEIGHTS.plusLeads + c * WEIGHTS.callScore + a * WEIGHTS.aoiUsage;
}

function scoreToRank(score: number): ProductionRank {
  if (score >= 75) return 'platinum';
  if (score >= 50) return 'gold';
  if (score >= 25) return 'silver';
  return 'bronze';
}

async function fetchProduction(agentEmail: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const start = subDays(new Date(), 30).toISOString();
  const end = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('war_connects')
    .select('id, sale_amount')
    .eq('agent_email', agentEmail.toLowerCase())
    .gte('connect_date', start)
    .lt('connect_date', end);
  if (error) return 0;
  const count = (data?.length ?? 0);
  const totalRevenue = (data ?? []).reduce((sum, r) => sum + Number(r.sale_amount ?? 0), 0);
  return Math.max(count * 50, totalRevenue / 50);
}

async function fetchPlusLeads(agentEmail: string): Promise<number> {
  try {
    const start = subDays(new Date(), 30);
    const startStr = start.toISOString().slice(0, 10);
    const email = agentEmail.replace(/'/g, "''");
    const result = await db.execute(sql.raw(
      `SELECT COALESCE(SUM(plus_leads_collected), 0)::float as total FROM daily_accountability WHERE agent_email = '${email}' AND accountability_date >= '${startStr}'`
    ));
    const row = (result as { rows?: { total?: number }[] })?.rows?.[0];
    return Number(row?.total ?? 0);
  } catch {
    return 0;
  }
}

async function fetchCallScore(agentEmail: string): Promise<number> {
  let score = await getAOIScoreByEmail(agentEmail);
  if (!score) {
    const associateId = await getAssociateIdByEmail(agentEmail);
    if (associateId) score = await calculateAndUpsertAOIScore(associateId, agentEmail);
  }
  return score?.aoiScore ?? 0;
}

async function fetchAoiUsage(agentEmail: string): Promise<number> {
  const credits = await connectnowService.getUserCredits(agentEmail);
  const used = (credits as any)?.credits_used ?? 0;
  const connectUsed = (credits as any)?.aoi_connect_credits_used ?? 0;
  return Number(used) + Number(connectUsed);
}

/**
 * Get production rank for an agent. Used by the rank API and by hotlead assignment.
 */
export async function getRankForEmail(agentEmail: string): Promise<RankResult | null> {
  if (!agentEmail?.trim()) return null;
  const email = agentEmail.trim().toLowerCase();

  const [production, plusLeads, callScore, aoiUsage] = await Promise.all([
    fetchProduction(email),
    fetchPlusLeads(email),
    fetchCallScore(email),
    fetchAoiUsage(email),
  ]);

  const inputs: RankInputs = { production, plusLeads, callScore, aoiUsage };
  const score = compositeScore(inputs);
  const rank = scoreToRank(score);

  const currentIndex = PRODUCTION_RANK_TIERS.findIndex((t) => t.id === rank);
  let nextTier: RankResult['nextTier'];
  if (currentIndex >= 0 && currentIndex < PRODUCTION_RANK_TIERS.length - 1) {
    const next = PRODUCTION_RANK_TIERS[currentIndex + 1];
    const nextThreshold = currentIndex === 0 ? 25 : currentIndex === 1 ? 50 : 75;
    const prevThreshold = currentIndex === 0 ? 0 : currentIndex === 1 ? 25 : 50;
    const progressPct = Math.round(((score - prevThreshold) / (nextThreshold - prevThreshold)) * 100);
    nextTier = { name: next.name, requirements: next.requirements, progressPct: Math.min(100, Math.max(0, progressPct)) };
  }

  return {
    rank,
    inputs,
    nextTier,
  tiers: PRODUCTION_RANK_TIERS,
};
}

/**
 * Returns rank tier only (for sorting agents by priority). Uses cached/computed rank.
 */
export async function getRankTierForEmail(agentEmail: string): Promise<ProductionRank> {
  const result = await getRankForEmail(agentEmail);
  return result?.rank ?? 'bronze';
}
