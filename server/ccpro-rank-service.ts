/**
 * CCPro Rank Service
 * Calculates user rank based on weekly net production (ALP)
 * Tiers: Gold ($0), Platinum ($1000), Diamond ($2000), Blue Diamond ($5000)
 */

import { supabaseAdmin } from './supabase';
import { formatInTimeZone } from 'date-fns-tz';
import { dispositionWritePool as rankPool } from './db';
import { shouldYieldToLeadDelivery } from './leasedialer-priority-gate';

export type CCProRank = 'gold' | 'platinum' | 'diamond' | 'blue-diamond';

export interface TierInfo {
  id: CCProRank;
  name: string;
  threshold: number; // Weekly ALP required
  description: string;
  advantages: string[];
}

export interface CCProRankResult {
  rank: CCProRank;
  weeklyALP: number;
  rolling21DayALP?: number;
  averageWeeklyALP?: number;
  leadMix?: Record<string, number>;
  calculatedAt?: string;
  progressToNext: number; // 0-100
  nextTier?: {
    name: string;
    threshold: number;
    description: string;
    progressPct: number;
  };
  currentTier: TierInfo;
  allTiers: TierInfo[];
}

export const CCPro_RANK_TIERS: TierInfo[] = [
  {
    id: 'gold',
    name: 'Gold',
    threshold: 0,
    description: 'Welcome to the Gold Tier! Your relentless pursuit of excellence has earned you a badge of honor - the golden hexagonal shield radiating strength, prestige, and power. This warm metallic badge is a testament to your unbeatable spirit and dedication to building your legacy.',
    advantages: [
      'Priority Queue Access - Jump straight into premium leads with elite level priority',
      'Exclusive Gold Badge - Flaunt your achievements with a badge only the best can possess',
      'Early Access to New Features - Get exclusive early access to upcoming tools and features',
      'Elite Gold Support - Premium customer support to help you dominate the leaderboards'
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    threshold: 1000,
    description: 'Dive into the realm of elite production with the illustrious Platinum Tier. This badge, adorned with wing extensions, gleams with a striking silver-platinum hue, reflecting your sheer excellence and supremacy. It\'s more than just a mark of prestige - it\'s a testament to your fearlessness, grit, and determination.',
    advantages: [
      'Platinum Priority Access - Jump the queue and get first access to premium leads and opportunities',
      'Platinum Loadout - Exclusive tools and resources that make you the center of attention',
      'Platinum Bonus Rewards - Earn accelerated rewards and climb the ranks like a true legend',
      'Platinum Support - Premium 24/7 customer support. Your queries are addressed on priority because you deserve nothing but the best'
    ],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    threshold: 2000,
    description: 'Welcome to the Diamond tier, where only the most daring and skilled producers reside. This elite rank is symbolized by an impressive hexagonal shield badge, adorned with medium wings and dual ribbon tails, all encasing a radiant purple diamond core. You\'ve earned the right to flaunt this badge as proof of your skill and dedication.',
    advantages: [
      'Diamond Edge Arsenal - Gain access to an exclusive, high-powered toolkit that ensures your dominance',
      'Diamond Fast-Track - Enjoy expedited access to premium leads, making success just a moment away',
      'Diamond Performance Boost - Experience enhanced features and capabilities that give you the edge in critical moments',
      'Diamond Reserve - Gain special weekly bonuses and resources, helping you stay ahead of the competition',
      'Diamond Prestige Events - Get invited to exclusive events and opportunities only open to Diamond tier producers'
    ],
  },
  {
    id: 'blue-diamond',
    name: 'Blue Diamond',
    threshold: 5000,
    description: 'Welcome to the Blue Diamond Tier, the pinnacle of power and prestige. Your journey has led you to this, the ultimate emblem of dominance, a rare hexagonal shield of matchless design, accented with grand wings and triple ribbon tails. The core, a captivating electric blue diamond, pulsates with an enthralling neon glow, symbolizing your legendary stature.',
    advantages: [
      'Infinite Valor - Unleash your prowess with unlimited access to premium features and resources',
      'Diamond Arsenal - Gain access to the most formidable tools, every single one gleaming with blue diamond enhancements',
      'Wings of Glory - Utilize exclusive features that let you deploy faster and dominate with the speed of a comet',
      'Time Mastery - Master your workflow with advanced time-saving features that turn the tide in your favor',
      'Crystal Vision - Unlock the power to see opportunities others miss, making you a tactical genius',
      'Celestial Resurgence - In any challenge, you have the tools to rise again, ready to conquer, making your presence both feared and revered'
    ],
  },
];

const RANK_LEAD_MIX: Record<CCProRank, Record<string, number>> = {
  gold: { tier1: 10, tier2: 50, tier3: 40 },
  platinum: { tier1: 50, tier2: 50, tier3: 0 },
  diamond: { tier1: 70, tier2: 30, tier3: 0 },
  'blue-diamond': { tier1: 100, tier2: 0, tier3: 0 },
};

let rankSchedulerStarted = false;

export async function ensureAgentProductionRankTable(): Promise<void> {
  await rankPool.query(`
    CREATE TABLE IF NOT EXISTS agent_production_rank (
      agent_email TEXT PRIMARY KEY,
      rolling_21_day_alp NUMERIC NOT NULL DEFAULT 0,
      average_weekly_alp NUMERIC NOT NULL DEFAULT 0,
      rank TEXT NOT NULL DEFAULT 'gold',
      lead_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await rankPool.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_daily_stats_email_date
      ON agent_daily_stats (lower(agent_email), stat_date DESC);
  `);
}

function getPstWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  // Use same logic as activity-card-report-service.ts
  const { start: dayStart } = getPstDayRange(date);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
  }).format(date);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday] ?? 0;
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const start = new Date(dayStart);
  start.setDate(start.getDate() + mondayDelta);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function getPstDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const start = new Date(pstDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(pstDate);
  end.setHours(23, 59, 59, 999);
  
  // Convert back to UTC
  const startStr = formatInTimeZone(start, 'America/Los_Angeles', 'yyyy-MM-dd\'T\'00:00:00');
  const endStr = formatInTimeZone(end, 'America/Los_Angeles', 'yyyy-MM-dd\'T\'23:59:59');
  
  return {
    start: new Date(startStr + '-08:00'),
    end: new Date(endStr + '-08:00'),
  };
}

async function fetchWeeklyALP(agentEmail: string): Promise<number> {
  if (!supabaseAdmin) {
    console.warn('⚠️ CCPro rank: Supabase admin not available');
    return 0;
  }
  
  const weekRange = getPstWeekRange();
  const startDate = weekRange.start.toISOString().split('T')[0]; // YYYY-MM-DD
  const endDate = weekRange.end.toISOString().split('T')[0]; // YYYY-MM-DD
  
  console.log(`🔍 CCPro rank: Fetching weekly ALP for ${agentEmail}`);
  console.log(`   Week range: ${startDate} to ${endDate}`);
  
  // Get weekly ALP from war_connects (sale_amount)
  // connect_date is stored as DATE, so we use date string comparison
  const { data, error } = await supabaseAdmin
    .from('war_connects')
    .select('sale_amount, connect_date')
    .eq('agent_email', agentEmail.toLowerCase().trim())
    .gte('connect_date', startDate)
    .lte('connect_date', endDate);
  
  if (error) {
    console.error('❌ CCPro rank: Error fetching weekly ALP:', error);
    return 0;
  }
  
  const totalALP = (data || []).reduce((sum, row) => {
    return sum + Number(row.sale_amount || 0);
  }, 0);
  
  const roundedALP = Math.round(totalALP);
  console.log(`💰 CCPro rank: Found ${data?.length || 0} records, total ALP: $${roundedALP}`);
  
  return roundedALP;
}

function weeklyALPToRank(weeklyALP: number): CCProRank {
  if (weeklyALP >= 5000) return 'blue-diamond';
  if (weeklyALP >= 2000) return 'diamond';
  if (weeklyALP >= 1000) return 'platinum';
  return 'gold';
}

async function calculateAndUpsertProductionRank(agentEmail: string): Promise<{
  rolling21DayALP: number;
  averageWeeklyALP: number;
  rank: CCProRank;
  leadMix: Record<string, number>;
  calculatedAt: string;
}> {
  const email = agentEmail.trim().toLowerCase();
  await ensureAgentProductionRankTable();

  const result = await rankPool.query<{ rolling_21_day_alp: string }>(
    `
      SELECT COALESCE(SUM(alp), 0)::text AS rolling_21_day_alp
      FROM agent_daily_stats
      WHERE lower(agent_email) = $1
        AND stat_date >= ((NOW() AT TIME ZONE 'America/Los_Angeles')::date - INTERVAL '20 days')
        AND stat_date <= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
    `,
    [email],
  );

  const rolling21DayALP = Math.round(Number(result.rows[0]?.rolling_21_day_alp || 0));
  const averageWeeklyALP = Math.round(rolling21DayALP / 3);
  const rank = weeklyALPToRank(averageWeeklyALP);
  const leadMix = RANK_LEAD_MIX[rank];
  const calculatedAt = new Date().toISOString();

  await rankPool.query(
    `
      INSERT INTO agent_production_rank (
        agent_email,
        rolling_21_day_alp,
        average_weekly_alp,
        rank,
        lead_mix,
        calculated_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
      ON CONFLICT (agent_email)
      DO UPDATE SET
        rolling_21_day_alp = EXCLUDED.rolling_21_day_alp,
        average_weekly_alp = EXCLUDED.average_weekly_alp,
        rank = EXCLUDED.rank,
        lead_mix = EXCLUDED.lead_mix,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW()
    `,
    [email, rolling21DayALP, averageWeeklyALP, rank, JSON.stringify(leadMix)],
  );

  return { rolling21DayALP, averageWeeklyALP, rank, leadMix, calculatedAt };
}

export async function refreshAgentProductionRanks(): Promise<{ updated: number }> {
  await ensureAgentProductionRankTable();
  const agents = await rankPool.query<{ agent_email: string }>(
    `
      SELECT DISTINCT lower(agent_email) AS agent_email
      FROM agent_daily_stats
      WHERE agent_email IS NOT NULL
        AND btrim(agent_email) <> ''
        AND stat_date >= ((NOW() AT TIME ZONE 'America/Los_Angeles')::date - INTERVAL '20 days')
    `,
  );

  let updated = 0;
  for (const row of agents.rows) {
    await calculateAndUpsertProductionRank(row.agent_email);
    updated += 1;
  }
  console.error('[CCPRO_RANK] refreshed production ranks', { updated });
  return { updated };
}

export function startAgentProductionRankScheduler(): void {
  if (rankSchedulerStarted) return;
  rankSchedulerStarted = true;
  const run = () => {
    void (async () => {
      if (await shouldYieldToLeadDelivery('ccpro_rank_refresh')) return;
      await refreshAgentProductionRanks();
    })().catch((error: any) => {
      console.error('[CCPRO_RANK] refresh failed:', error?.message || error);
    });
  };
  setTimeout(run, 45_000).unref?.();
  const interval = setInterval(run, 60 * 60 * 1000);
  interval.unref?.();
  console.error('[CCPRO_RANK] scheduler started (hourly, source=agent_daily_stats rolling 21d)');
}

/**
 * Get CCPro rank for an agent based on weekly net production
 */
export async function getCCProRankForEmail(agentEmail: string): Promise<CCProRankResult | null> {
  if (!agentEmail?.trim()) {
    console.warn('⚠️ CCPro rank: No agent email provided');
    return null;
  }
  
  const email = agentEmail.trim().toLowerCase();
  let productionRank: {
    rolling21DayALP: number;
    averageWeeklyALP: number;
    rank: CCProRank;
    leadMix: Record<string, number>;
    calculatedAt: string;
  } | null = null;

  try {
    const cached = await rankPool.query<{
      rolling_21_day_alp: string;
      average_weekly_alp: string;
      rank: CCProRank;
      lead_mix: Record<string, number>;
      calculated_at: string;
    }>(
      `
        SELECT rolling_21_day_alp, average_weekly_alp, rank, lead_mix, calculated_at
        FROM agent_production_rank
        WHERE lower(agent_email) = $1
        LIMIT 1
      `,
      [email],
    );
    const row = cached.rows[0];
    if (row) {
      productionRank = {
        rolling21DayALP: Math.round(Number(row.rolling_21_day_alp || 0)),
        averageWeeklyALP: Math.round(Number(row.average_weekly_alp || 0)),
        rank: row.rank || 'gold',
        leadMix: row.lead_mix || RANK_LEAD_MIX[row.rank || 'gold'],
        calculatedAt: row.calculated_at,
      };
    }
  } catch (error: any) {
    console.warn('⚠️ CCPro rank cache read failed:', error?.message || error);
  }

  if (!productionRank) {
    productionRank = {
      rolling21DayALP: 0,
      averageWeeklyALP: 0,
      rank: 'gold',
      leadMix: RANK_LEAD_MIX.gold,
      calculatedAt: new Date().toISOString(),
    };
  }

  const weeklyALP = productionRank.averageWeeklyALP;
  const rank = productionRank.rank || weeklyALPToRank(weeklyALP);
  
  const currentIndex = CCPro_RANK_TIERS.findIndex((t) => t.id === rank);
  const currentTier = CCPro_RANK_TIERS[currentIndex];
  
  let nextTier: CCProRankResult['nextTier'] | undefined;
  let progressToNext = 0;
  
  if (currentIndex >= 0 && currentIndex < CCPro_RANK_TIERS.length - 1) {
    const next = CCPro_RANK_TIERS[currentIndex + 1];
    const currentThreshold = currentTier.threshold;
    const nextThreshold = next.threshold;
    const progress = weeklyALP - currentThreshold;
    const range = nextThreshold - currentThreshold;
    
    if (range > 0) {
      progressToNext = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
    } else {
      progressToNext = 100;
    }
    
    nextTier = {
      name: next.name,
      threshold: next.threshold,
      description: next.description,
      progressPct: progressToNext,
    };
  } else {
    // At max rank (Blue Diamond)
    progressToNext = 100;
  }
  
  return {
    rank,
    weeklyALP,
    rolling21DayALP: productionRank.rolling21DayALP,
    averageWeeklyALP: productionRank.averageWeeklyALP,
    leadMix: productionRank.leadMix,
    calculatedAt: productionRank.calculatedAt,
    progressToNext,
    nextTier,
    currentTier,
    allTiers: CCPro_RANK_TIERS,
  };
}
