/**
 * Dial Rate Controller
 *
 * Reactor override: campaign rates are intentionally fixed while markets are disabled.
 *
 * All non-AO-Recruit Taalk campaigns are forced to 0 dial/hour (hard stopped).
 * AO Recruit
 * campaigns scale from active recruiter headcount at 1000 dials/hour each.
 */

import { isAoRecruitCampaignName } from './normalize.js';
import type { NormalizedAgent, NormalizedCampaign } from '../shared/types.js';
import type { AgentScore } from './agent-scorer.js';

const DISABLED_CAMPAIGN_RATE = 0;
const AO_RECRUIT_DIALS_PER_ONLINE_AGENT = 1000;

export interface CampaignDialPlan {
  campaignId: string;
  campaignName: string;
  state: string;
  currentRate: number;
  targetRate: number;
  agentsCovering: number;   // online, non-ghost agents for this state
  dialsPerTransfer: number;
  reason: string;
  shouldUpdate: boolean;
  /** Legacy field kept for dashboard compatibility; fixed override no longer sets it. */
  globeHardStop?: boolean;
}

/** Extract primary state abbreviation from campaign name or host field. */
function extractState(campaign: NormalizedCampaign): string {
  // Campaign names typically contain state abbreviations: "Veteran FL", "Globe - OH", etc.
  const name = campaign.name || '';
  // Non-state tokens to skip (market codes, campaign type prefixes)
  const SKIP = new Set(['VN', 'WK', 'WB', 'AO', 'RMS']);
  // Find the LAST 2-letter uppercase word that isn't a skip token
  const allMatches = [...name.matchAll(/\b([A-Z]{2})\b/g)];
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const token = allMatches[i][1];
    if (!SKIP.has(token)) return token;
  }
  return '';
}

/**
 * Calculate target dial rates for all campaigns.
 */
export function calculateDialPlans(
  campaigns: NormalizedCampaign[],
  agents: NormalizedAgent[],
  _scores: Map<string, AgentScore>,
  _noAgentRateByState: Map<string, number>,
): CampaignDialPlan[] {
  const onlineRecruitAgents = agents.filter((agent) => {
    if (!agent.online || agent.suspended || agent.away) return false;
    const market = String((agent as any).normalizedMarket || agent.market || '').toLowerCase();
    const campaign = String((agent as any).campaign || '').toLowerCase();
    return market.includes('recruit') || market.includes('rms') || campaign.includes('recruit') || campaign.includes('rms');
  });
  const recruitTargetRate = onlineRecruitAgents.length * AO_RECRUIT_DIALS_PER_ONLINE_AGENT;

  return campaigns.map(campaign => {
    const state = extractState(campaign);
    const currentRate = campaign.limitPerHour ?? 0;
    const isRecruit = isAoRecruitCampaignName(campaign.name);
    const targetRate = isRecruit ? recruitTargetRate : DISABLED_CAMPAIGN_RATE;

    return {
      campaignId: campaign._id,
      campaignName: campaign.name,
      state: isRecruit ? state || 'NATIONAL' : state,
      currentRate,
      targetRate,
      agentsCovering: isRecruit ? onlineRecruitAgents.length : 0,
      dialsPerTransfer: isRecruit ? AO_RECRUIT_DIALS_PER_ONLINE_AGENT : 0,
      reason: isRecruit
        ? `AO Recruit: ${onlineRecruitAgents.length} online agents x ${AO_RECRUIT_DIALS_PER_ONLINE_AGENT}/hr`
        : 'Veteran/Globe disabled: reactor hard-stop (rate 0 + pause)',
      shouldUpdate: currentRate !== targetRate,
      globeHardStop: !isRecruit,
    };
  });
}
