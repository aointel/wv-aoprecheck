/**
 * Auto Campaign Manager
 *
 * CORE VALUE: Automatically throttle state-level campaign dial rates based on
 * real-time agent availability so leads don't get burned when nobody's there
 * to take transfers.
 *
 * FORMULA (global pool, not per-market):
 *   1. Total capacity = total IDLE agents × 150 dials/hr
 *   2. For each state campaign, count how many idle agents are licensed for that state
 *   3. If a state has LESS THAN 3 licensed idle agents → rate = 0 (not enough coverage)
 *   4. Distribute total capacity proportionally among ELIGIBLE campaigns (3+ agents),
 *      weighted by contactCount (lead count)
 *   5. When agents go busy, recalculate — their states may drop below threshold
 *
 * Example: 10 idle agents, total capacity = 1,500/hr
 *   FL: 8 agents licensed → eligible (477 leads)
 *   TX: 5 agents → eligible (1200 leads)
 *   IL: 4 agents → eligible (1559 leads)
 *   KS: 2 agents → ZERO (below 3-agent threshold)
 *   Distribute 1,500 proportionally by leads among FL, TX, IL
 *
 * IMPORTANT: This ACTUALLY SETS rates via the Taalk API every poll cycle.
 */

import type { NormalizedAgent, NormalizedCampaign, AgentStatus, AgentStateMemory, AutoAction, MergedAgent } from '../shared/types.js';
import { isAoRecruitCampaignName } from './normalize.js';
import * as taalk from './taalk-client.js';

// Global rate per idle agent
const RATE_PER_AGENT = 150;
// Minimum idle agents licensed for a state before we dial that state
const MIN_AGENTS_PER_STATE = 2;
const REACTOR_OWNS_CAMPAIGN_RATES = true;

export interface CampaignRateInfo {
  campaignId: string;
  targetRate: number;
  reason: string;
  agentsAvailable: number;
  state: string;
}

export class AutoCampaignManager {
  // agentId → last known state
  private stateMemory = new Map<number, AgentStateMemory>();
  // Manual override per agent
  private manualOverrides = new Set<number>();
  // Manual rate overrides per campaign (don't auto-adjust)
  private campaignOverrides = new Set<string>();
  // Activity log
  private actionLog: AutoAction[] = [];
  private maxLogSize = 500;
  // Global enable/disable
  public enabled = true;
  private startupTime = Date.now();
  // Track last optimization to avoid thrashing
  private lastOptimizeTime = 0;
  private optimizeCooldown = 10000; // 10s min between rate-change API batches
  // Track last rate set per campaign to avoid redundant API calls
  private lastSetRate = new Map<string, number>();
  // Latest rate reasons per campaign (for dashboard display)
  private _rateReasons = new Map<string, CampaignRateInfo>();

  getActionLog(): AutoAction[] {
    return [...this.actionLog];
  }

  /** Log an activity event (call pickup, completion, idle warning, etc.) */
  logActivityEvent(
    agentId: number,
    agentName: string,
    action: string,
    detail: string,
  ): void {
    this.logAction(agentId, action, detail, 'idle', 'idle', true, undefined, undefined, agentName);
    if (this.actionLog.length > this.maxLogSize) {
      this.actionLog = this.actionLog.slice(0, this.maxLogSize);
    }
  }

  getStateMemory(): Map<number, AgentStateMemory> {
    return new Map(this.stateMemory);
  }

  getRateReasons(): Map<string, CampaignRateInfo> {
    return new Map(this._rateReasons);
  }

  getRateReason(campaignId: string): string | undefined {
    return this._rateReasons.get(campaignId)?.reason;
  }

  isOverridden(agentId: number): boolean {
    return this.manualOverrides.has(agentId);
  }

  isCampaignOverridden(campaignId: string): boolean {
    return this.campaignOverrides.has(campaignId);
  }

  setOverride(agentId: number, override: boolean): void {
    if (override) {
      this.manualOverrides.add(agentId);
      this.logAction(0, 'MANUAL_OVERRIDE_ON', `Auto-management disabled for agent ${agentId}`, 'idle', 'idle', true);
    } else {
      this.manualOverrides.delete(agentId);
      this.logAction(0, 'MANUAL_OVERRIDE_OFF', `Auto-management re-enabled for agent ${agentId}`, 'idle', 'idle', true);
    }
  }

  setCampaignOverride(campaignId: string, override: boolean): void {
    if (override) this.campaignOverrides.add(campaignId);
    else this.campaignOverrides.delete(campaignId);
  }

  updateCampaignMap(_campaigns: NormalizedCampaign[]): void {}

  /**
   * Process agent updates. Detects state changes and logs them.
   */
  async processAgentUpdates(agents: NormalizedAgent[]): Promise<AutoAction[]> {
    if (!this.enabled) return [];

    const actions: AutoAction[] = [];

    for (const agent of agents) {
      const prev = this.stateMemory.get(agent.id);
      const prevStatus: AgentStatus = prev?.status ?? 'offline';
      const newStatus = agent.status;

      this.stateMemory.set(agent.id, {
        agentId: agent.id,
        agentMongoId: agent._id,
        status: newStatus,
        campaignId: undefined,
        campaignName: agent.campaign,
        previousLimitPerHour: 0,
        manualOverride: this.manualOverrides.has(agent.id),
        lastUpdated: new Date().toISOString(),
      });

      if (prevStatus === newStatus) continue;

      const action = this.logAction(
        agent.id, 'STATE_CHANGE',
        `${prevStatus} → ${newStatus}`,
        prevStatus, newStatus, true,
        undefined, agent.campaign, agent.fullName,
      );
      actions.push(action);
    }

    if (this.actionLog.length > this.maxLogSize) {
      this.actionLog = this.actionLog.slice(0, this.maxLogSize);
    }

    return actions;
  }

  /**
   * CORE: Optimize campaign dial rates every RTS poll cycle.
   *
   * Global pool formula:
   *   totalCapacity = idleAgents.length × 150
   *   For each state: if <3 idle agents licensed → rate = 0
   *   Distribute totalCapacity among eligible campaigns proportionally by contactCount
   *   ACTUALLY SET rates via Taalk API
   */
  async optimizeCampaignRates(
    agents: NormalizedAgent[],
    campaigns: NormalizedCampaign[],
  ): Promise<AutoAction[]> {
    if (REACTOR_OWNS_CAMPAIGN_RATES) {
      // Reactor is the only writer for Taalk campaign rates. Keep auto-manager
      // available for agent state/cross-system actions, but never let it
      // override the reactor's disabled-market fixed rates.
      for (const c of campaigns) {
        const isRecruit = isAoRecruitCampaignName(c.name || '');
        this._rateReasons.set(c._id, {
          campaignId: c._id,
          targetRate: isRecruit ? c.limitPerHour : 1,
          reason: isRecruit ? 'Reactor-owned: AO Recruit = 1000/hr per online recruiter' : 'Reactor-owned: fixed at 1/hr',
          agentsAvailable: 0,
          state: c.state,
        });
        c.rateReason = isRecruit ? 'Reactor-owned: AO Recruit = 1000/hr per online recruiter' : 'Reactor-owned: fixed at 1/hr';
      }
      return [];
    }

    if (!this.enabled) {
      for (const c of campaigns) {
        this._rateReasons.set(c._id, {
          campaignId: c._id, targetRate: c.limitPerHour,
          reason: 'Auto-management disabled', agentsAvailable: 0, state: c.state,
        });
        c.rateReason = 'Auto-management disabled';
      }
      return [];
    }

    if (!this.isWithinBusinessHours()) {
      for (const c of campaigns) {
        this._rateReasons.set(c._id, {
          campaignId: c._id, targetRate: 0,
          reason: 'Outside business hours', agentsAvailable: 0, state: c.state,
        });
        c.rateReason = 'Outside business hours';
      }
      return [];
    }

    const actions: AutoAction[] = [];

    // ── 1. Idle agents grouped by market, then by state within market ──
    const idleAgents = agents.filter(a => a.online && !a.busy && !a.away && !a.suspended);

    // Group idle agents by normalizedMarket
    const idleByMarket = new Map<string, NormalizedAgent[]>();
    for (const agent of idleAgents) {
      const mkt = agent.normalizedMarket || 'Unknown';
      if (!idleByMarket.has(mkt)) idleByMarket.set(mkt, []);
      idleByMarket.get(mkt)!.push(agent);
    }

    // Per-market capacity
    const marketCapacity = new Map<string, number>();
    for (const [mkt, mktAgents] of idleByMarket) {
      marketCapacity.set(mkt, mktAgents.length * RATE_PER_AGENT);
    }

    // Build: market → state → idle agents licensed for that state
    const marketStateAgentMap = new Map<string, Map<string, NormalizedAgent[]>>();
    for (const [mkt, mktAgents] of idleByMarket) {
      const stateMap = new Map<string, NormalizedAgent[]>();
      for (const agent of mktAgents) {
        if (agent.states.length > 0) {
          for (const st of agent.states) {
            const s = st.toUpperCase().trim();
            if (!stateMap.has(s)) stateMap.set(s, []);
            stateMap.get(s)!.push(agent);
          }
        }
      }
      marketStateAgentMap.set(mkt, stateMap);
    }

    // ── 2. Determine eligibility for each campaign (per-market) ──
    interface CampaignCalc {
      campaign: NormalizedCampaign;
      agentsInState: number;
      eligible: boolean;
      targetRate: number;
      reason: string;
      market: string;
    }

    // Group campaigns by their normalizedMarket
    const campaignsByMarket = new Map<string, CampaignCalc[]>();
    const eligibleLeadsByMarket = new Map<string, number>();

    for (const campaign of campaigns) {
      // Skip non-actionable campaigns
      if (campaign.status === 'completed') {
        campaign.rateReason = 'Campaign completed';
        this._rateReasons.set(campaign._id, {
          campaignId: campaign._id, targetRate: 0, reason: 'Campaign completed',
          agentsAvailable: 0, state: campaign.state,
        });
        continue;
      }

      if (this.campaignOverrides.has(campaign._id)) {
        campaign.rateReason = 'Manual override';
        this._rateReasons.set(campaign._id, {
          campaignId: campaign._id, targetRate: campaign.limitPerHour, reason: 'Manual override',
          agentsAvailable: 0, state: campaign.state,
        });
        continue;
      }

      if (isAoRecruitCampaignName(campaign.name || '')) {
        campaign.rateReason = 'AO Recruit: dial rate set by reactor (1000 × online agents)';
        this._rateReasons.set(campaign._id, {
          campaignId: campaign._id,
          targetRate: campaign.limitPerHour,
          reason: campaign.rateReason,
          agentsAvailable: 0,
          state: campaign.state,
        });
        continue;
      }

      if (campaign.contactCount <= 0) {
        campaign.rateReason = 'No leads';
        this._rateReasons.set(campaign._id, {
          campaignId: campaign._id, targetRate: 0, reason: 'No leads',
          agentsAvailable: 0, state: campaign.state,
        });
        continue;
      }

      const mkt = campaign.normalizedMarket || 'Other';
      const state = campaign.state;
      const stateMap = marketStateAgentMap.get(mkt);
      const mktIdleAgents = idleByMarket.get(mkt) ?? [];
      let agentsInState = 0;

      if (state && state !== 'ALL') {
        agentsInState = stateMap ? (stateMap.get(state) ?? []).length : 0;
      } else {
        // state=ALL or no-state campaigns — count total idle agents in this market
        agentsInState = mktIdleAgents.length;
      }

      const eligible = agentsInState >= MIN_AGENTS_PER_STATE;

      if (eligible) {
        const prev = eligibleLeadsByMarket.get(mkt) ?? 0;
        eligibleLeadsByMarket.set(mkt, prev + campaign.contactCount);
      }

      const calc: CampaignCalc = {
        campaign,
        agentsInState,
        eligible,
        targetRate: 0,
        reason: '',
        market: mkt,
      };

      if (!campaignsByMarket.has(mkt)) campaignsByMarket.set(mkt, []);
      campaignsByMarket.get(mkt)!.push(calc);
    }

    // ── 3. Distribute per-market capacity among eligible campaigns by contactCount ──
    const allCalcs: CampaignCalc[] = [];

    for (const [mkt, calcs] of campaignsByMarket) {
      const mktCapacity = marketCapacity.get(mkt) ?? 0;
      const totalEligibleLeads = eligibleLeadsByMarket.get(mkt) ?? 0;
      const stateMap = marketStateAgentMap.get(mkt);
      const mktIdleAgents = idleByMarket.get(mkt) ?? [];

      for (const calc of calcs) {
        const { campaign, agentsInState, eligible } = calc;
        const state = campaign.state;

        if (!eligible) {
          calc.targetRate = 0;
          if (agentsInState === 0) {
            calc.reason = `0 ${mkt} agents for ${state !== 'ALL' ? state : 'pool'} → paused`;
          } else {
            calc.reason = `Only ${agentsInState} ${mkt} agent${agentsInState > 1 ? 's' : ''} in ${state !== 'ALL' ? state : 'pool'} (need ${MIN_AGENTS_PER_STATE}) → paused`;
          }
        } else {
          const proportion = totalEligibleLeads > 0
            ? campaign.contactCount / totalEligibleLeads
            : 0;
          calc.targetRate = Math.round(mktCapacity * proportion);

          const stateLabel = state !== 'ALL' ? state : 'pool';
          const agentNames = (state && state !== 'ALL')
            ? (stateMap?.get(state) ?? []).slice(0, 3).map(a => a.firstName).join(', ')
            : mktIdleAgents.slice(0, 3).map(a => a.firstName).join(', ');
          const extra = agentsInState > 3 ? ` +${agentsInState - 3}` : '';
          calc.reason = `${agentsInState} ${mkt} agents in ${stateLabel} (${agentNames}${extra}), ${campaign.contactCount.toLocaleString()} leads → ${calc.targetRate}/hr`;
        }

        campaign.rateReason = calc.reason;
        this._rateReasons.set(campaign._id, {
          campaignId: campaign._id,
          targetRate: calc.targetRate,
          reason: calc.reason,
          agentsAvailable: agentsInState,
          state: campaign.state,
        });

        allCalcs.push(calc);
      }
    }

    const calcs = allCalcs;

    // ── 4. Apply rate changes via Taalk API ──
    // Clear cache — always re-apply rates to ensure Taalk reflects our targets
    this.lastSetRate.clear();
    const now = Date.now();
    // Wait 30s after startup before making rate API calls (avoid hammering on boot)
    if (Date.now() - this.startupTime < 60_000) return actions;

    let apiCallsMade = 0;
    for (const calc of calcs) {
      const { campaign, targetRate, reason } = calc;
      const lastRate = this.lastSetRate.get(campaign._id);

      // Skip ONLY if we just set this exact rate last cycle
      if (lastRate !== undefined && lastRate === targetRate) continue;

      try {
        // Resume campaign if it's stopped and we want to dial
        if (targetRate > 0 && campaign.status !== 'running') {
          try {
            await taalk.resumeCampaign(campaign._id);
            console.log(`[RATE API] ${campaign.name}: RESUMED + ${campaign.limitPerHour} → ${targetRate}`);
          } catch (_) {
            console.log(`[RATE API] ${campaign.name}: resume failed, setting rate anyway`);
          }
          await new Promise(r => setTimeout(r, 100));
        } else {
          console.log(`[RATE API] ${campaign.name}: ${campaign.limitPerHour} → ${targetRate}`);
        }
        await taalk.updateCampaignRate(campaign._id, targetRate);
        this.lastSetRate.set(campaign._id, targetRate);

        const action = this.logAction(
          0, 'RATE_ADJUSTED',
          `${campaign.name} (${campaign.state}): ${campaign.limitPerHour} → ${targetRate}/hr — ${reason}`,
          'idle', 'idle', true,
          campaign._id, campaign.name,
        );
        actions.push(action);

        apiCallsMade++;
        // Rate limit: 500ms between API calls to avoid Taalk 429s
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        const action = this.logAction(
          0, 'RATE_ERROR',
          `Failed to update ${campaign.name}: ${err.message}`,
          'idle', 'idle', false,
          campaign._id, campaign.name,
        );
        actions.push(action);
      }

      // No cap — process ALL campaigns every cycle
    }

    if (apiCallsMade > 0) {
      this.lastOptimizeTime = now;
      const mktSummary = [...marketCapacity.entries()].map(([m, c]) => `${m}:${(idleByMarket.get(m) ?? []).length}idle/${c}/hr`).join(', ');
      console.log(`[AutoManager] Adjusted ${apiCallsMade} campaign rates — per-market: ${mktSummary}`);
    }

    return actions;
  }

  // ── Previous WebRTC status per email (for change detection) ──
  private prevWebrtcStatus = new Map<string, string>();

  /**
   * Cross-system orchestration: suspend/unsuspend on Taalk based on WebRTC state.
   *
   * - Agent goes ON CALL on WebRTC AND is on Taalk → SUSPEND on Taalk
   * - Agent finishes WebRTC call (back to available) → UNSUSPEND on Taalk
   */
  async processCrossSystemUpdates(
    mergedAgents: MergedAgent[],
    webrtcSuspendedAgents: Set<string>,
  ): Promise<AutoAction[]> {
    if (!this.enabled) return [];

    const actions: AutoAction[] = [];

    for (const agent of mergedAgents) {
      const prevStatus = this.prevWebrtcStatus.get(agent.email);
      const currentStatus = agent.webrtcStatus;

      // Update tracking
      this.prevWebrtcStatus.set(agent.email, currentStatus);

      // Skip if no change
      if (prevStatus === currentStatus) continue;

      // Agent went ON CALL on WebRTC
      if (currentStatus === 'on_call' && prevStatus !== 'on_call') {
        // If they're on Taalk (inbound enabled, not already suspended), suspend them
        if (agent.inboundEnabled && !agent.suspended && agent._id) {
          try {
            await taalk.suspendAgent(agent._id);
            webrtcSuspendedAgents.add(agent.email);
            const action = this.logAction(
              agent.id, 'WEBRTC_SUSPEND',
              `${agent.fullName} started WebRTC outbound → suspended on Taalk`,
              agent.taalkStatus, 'suspended', true,
              undefined, undefined, agent.fullName,
            );
            actions.push(action);
            console.log(`[CrossSystem] SUSPENDED ${agent.fullName} on Taalk (WebRTC call started)`);
          } catch (err: any) {
            const action = this.logAction(
              agent.id, 'WEBRTC_SUSPEND_ERROR',
              `Failed to suspend ${agent.fullName} on Taalk: ${err.message}`,
              agent.taalkStatus, agent.taalkStatus, false,
              undefined, undefined, agent.fullName,
            );
            actions.push(action);
          }
        }
      }

      // Agent finished WebRTC call (went back to idle from on_call)
      if (currentStatus === 'idle' && prevStatus === 'on_call') {
        // If we previously auto-suspended them, unsuspend
        if (webrtcSuspendedAgents.has(agent.email) && agent._id) {
          try {
            await taalk.unsuspendAgent(agent._id);
            webrtcSuspendedAgents.delete(agent.email);
            const action = this.logAction(
              agent.id, 'WEBRTC_UNSUSPEND',
              `${agent.fullName} finished WebRTC call → unsuspended on Taalk`,
              'suspended', 'idle', true,
              undefined, undefined, agent.fullName,
            );
            actions.push(action);
            console.log(`[CrossSystem] UNSUSPENDED ${agent.fullName} on Taalk (WebRTC call ended)`);
          } catch (err: any) {
            const action = this.logAction(
              agent.id, 'WEBRTC_UNSUSPEND_ERROR',
              `Failed to unsuspend ${agent.fullName} on Taalk: ${err.message}`,
              'suspended', 'suspended', false,
              undefined, undefined, agent.fullName,
            );
            actions.push(action);
          }
        }
      }

      // Agent went offline on Twilio — clean up if we had auto-suspended
      if (currentStatus === 'offline' && webrtcSuspendedAgents.has(agent.email)) {
        if (agent._id) {
          try {
            await taalk.unsuspendAgent(agent._id);
            webrtcSuspendedAgents.delete(agent.email);
            const action = this.logAction(
              agent.id, 'WEBRTC_UNSUSPEND',
              `${agent.fullName} went offline on WebRTC → unsuspended on Taalk`,
              'suspended', 'idle', true,
              undefined, undefined, agent.fullName,
            );
            actions.push(action);
          } catch { /* best effort */ }
        }
      }
    }

    // Log shame event if many agents are outbound-only
    const outboundOnly = mergedAgents.filter(a => a.outboundEnabled && !a.inboundEnabled);
    if (outboundOnly.length >= 10) {
      // Only log this periodically (check if we logged it recently)
      const lastShameLog = this.actionLog.find(a => a.action === 'OUTBOUND_ONLY_WARNING');
      const shouldLog = !lastShameLog || (Date.now() - new Date(lastShameLog.timestamp).getTime() > 300000); // every 5min max
      if (shouldLog) {
        const action = this.logAction(
          0, 'OUTBOUND_ONLY_WARNING',
          `⚠️ ${outboundOnly.length} agents outbound-only, missing inbound transfers`,
          'idle', 'idle', true,
          undefined, undefined, 'System',
        );
        actions.push(action);
      }
    }

    return actions;
  }

  /** Count campaigns currently throttled to 0 because of insufficient agents */
  getThrottledCount(): number {
    let count = 0;
    for (const [, info] of this._rateReasons) {
      if (info.targetRate === 0 && (info.reason.includes('agents') && info.reason.includes('paused'))) {
        count++;
      }
    }
    return count;
  }

  private isWithinBusinessHours(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const pstHour = (utcHour - 8 + 24) % 24;
    const pdtHour = (utcHour - 7 + 24) % 24;
    const hour = Math.min(pstHour, pdtHour);
    return hour >= 6 && hour < 21;
  }

  private logAction(
    agentId: number,
    action: string,
    detail: string,
    prevState: AgentStatus,
    newState: AgentStatus,
    success: boolean,
    campaignId?: string,
    campaignName?: string,
    agentName?: string,
  ): AutoAction {
    const entry: AutoAction = {
      id: `${Date.now()}-${agentId}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      agentId,
      agentName: agentName ?? (agentId > 0 ? `Agent ${agentId}` : 'System'),
      action,
      detail,
      previousState: prevState,
      newState: newState,
      campaignId,
      campaignName,
      success,
    };
    this.actionLog.unshift(entry);
    return entry;
  }
}
