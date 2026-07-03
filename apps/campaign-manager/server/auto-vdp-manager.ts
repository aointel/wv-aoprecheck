/**
 * Auto VDP Manager — automatically toggles agents on/off Taalk inbound
 * based on their outbound call activity.
 *
 * Rules:
 * 1. Agent on a LIVE outbound call (on_call debounced) → force OFFLINE on Taalk
 * 2. Agent finishes call, starts dialing again + has credits → force ONLINE on Taalk
 * 3. Agent goes offline then starts dialing → force ONLINE on Taalk
 * 4. Agent goes offline and doesn't dial → stays OFF Taalk
 *
 * Only manages agents who have credits and are actively using outbound.
 */

import { vdpHeartbeat } from './vdp-heartbeat.js';

type AgentOutboundState = 'idle' | 'dialing' | 'on_call' | 'offline';

interface ManagedAgent {
  email: string;
  agentId: string;        // Taalk numeric ID
  states: string[];
  market: string;
  firstName: string;
  lastName: string;
  lastState: AgentOutboundState;
  taalkOnline: boolean;   // Are we keeping them online on Taalk?
  lastStateChange: number;
  credits: number;
}

class AutoVDPManager {
  private agents = new Map<string, ManagedAgent>(); // email → state
  enabled = true;

  /**
   * Called every poll with updated agent statuses.
   * Decides who to put online/offline on Taalk.
   */
  async processUpdate(
    mergedAgents: { email: string; id: number; webrtcStatus: string; inboundEnabled: boolean; states: string[]; normalizedMarket: string; firstName: string; lastName: string; _id?: string }[],
    creditsMap: Map<string, number>,
    getCredits?: (email: string, agentId?: number) => number | null,
  ) {
    if (!this.enabled) return;

    for (const agent of mergedAgents) {
      if (!agent.email || agent.id <= 0) continue;

      const credits = getCredits ? (getCredits(agent.email, agent.id) ?? 0) : (creditsMap.get(agent.email.toLowerCase()) ?? 0);
      const currentState = this.mapWebrtcToState(agent.webrtcStatus);

      let managed = this.agents.get(agent.email.toLowerCase());

      // Only start managing agents who are actively outbound (dialing/on_call)
      if (!managed) {
        if (currentState === 'dialing' || currentState === 'on_call') {
          managed = {
            email: agent.email.toLowerCase(),
            agentId: String(agent.id),
            states: agent.states || [],
            market: agent.normalizedMarket || '',
            firstName: agent.firstName || '',
            lastName: agent.lastName || '',
            lastState: currentState,
            taalkOnline: false,
            lastStateChange: Date.now(),
            credits,
          };
          this.agents.set(agent.email.toLowerCase(), managed);
          // Newly discovered dialing agent — force online if they have credits and not already heartbeating
          if (currentState === 'dialing' && credits >= 8 && !vdpHeartbeat.isManaged(managed.agentId)) {
            console.log(`[AutoVDP] ${agent.email}: NEW dialing agent + ${credits} credits → forcing ON Taalk`);
            vdpHeartbeat.forceOnline(managed.agentId, {
              states: managed.states,
              market: managed.market,
              first_name: managed.firstName,
              last_name: managed.lastName,
            }).then(result => {
              if (result.success) managed!.taalkOnline = true;
              else console.error(`[AutoVDP] ${agent.email}: force-online failed: ${result.error}`);
            });
          }
        } else {
          continue; // Not outbound active, skip
        }
      }

      // Update credits
      managed.credits = credits;

      // Sync taalkOnline with actual heartbeat state
      if (vdpHeartbeat.isManaged(managed.agentId)) managed.taalkOnline = true;

      // State didn't change — skip
      if (managed.lastState === currentState) continue;

      const prevState = managed.lastState;
      managed.lastState = currentState;
      managed.lastStateChange = Date.now();

      // ── Rule 1: Goes on live call → force OFF Taalk ──
      if (currentState === 'on_call' && managed.taalkOnline) {
        console.log(`[AutoVDP] ${agent.email}: on_call → forcing OFF Taalk`);
        vdpHeartbeat.forceOffline(managed.agentId);
        managed.taalkOnline = false;
      }

      // ── Rule 0: Zero credits → force OFF Taalk immediately ──
      if (credits <= 0 && managed.taalkOnline) {
        console.log(`[AutoVDP] ${agent.email}: 0 credits → forcing OFF Taalk`);
        vdpHeartbeat.forceOffline(managed.agentId);
        managed.taalkOnline = false;
        continue;
      }

      // ── Rule 2: Was on call or idle, now dialing + has credits → force ON Taalk ──
      if (currentState === 'dialing' && !managed.taalkOnline && credits >= 8 && !vdpHeartbeat.isManaged(managed.agentId)) {
        console.log(`[AutoVDP] ${agent.email}: dialing detected + ${credits} credits → forcing ON Taalk`);
        const result = await vdpHeartbeat.forceOnline(managed.agentId, {
          states: managed.states,
          market: managed.market,
          first_name: managed.firstName,
          last_name: managed.lastName,
        });
        if (result.success) {
          managed.taalkOnline = true;
        } else {
          console.error(`[AutoVDP] ${agent.email}: force-online failed: ${result.error}`);
        }
      }

      // ── Rule 3: Goes idle/offline → force OFF Taalk ──
      if ((currentState === 'idle' || currentState === 'offline') && managed.taalkOnline) {
        console.log(`[AutoVDP] ${agent.email}: ${currentState} → forcing OFF Taalk`);
        vdpHeartbeat.forceOffline(managed.agentId);
        managed.taalkOnline = false;
      }

      // ── Rule 4: Goes offline and stays idle → remove from managed list after 5 min ──
      if (currentState === 'offline' || currentState === 'idle') {
        // Clean up after 5 minutes of inactivity
        setTimeout(() => {
          const current = this.agents.get(agent.email.toLowerCase());
          if (current && (current.lastState === 'idle' || current.lastState === 'offline') &&
              Date.now() - current.lastStateChange > 4.5 * 60 * 1000) {
            this.agents.delete(agent.email.toLowerCase());
          }
        }, 5 * 60 * 1000);
      }
    }
  }

  private mapWebrtcToState(status: string): AgentOutboundState {
    switch (status) {
      case 'on_call': return 'on_call';
      case 'dialing':
      case 'ringing': return 'dialing';
      case 'idle': return 'idle';
      default: return 'offline';
    }
  }

  /** Get status of all auto-managed agents */
  getStatus(): { email: string; agentId: string; state: AgentOutboundState; taalkOnline: boolean; credits: number }[] {
    return [...this.agents.values()].map(a => ({
      email: a.email,
      agentId: a.agentId,
      state: a.lastState,
      taalkOnline: a.taalkOnline,
      credits: a.credits,
    }));
  }

  /** Stop managing all agents */
  stopAll() {
    for (const agent of this.agents.values()) {
      if (agent.taalkOnline) {
        vdpHeartbeat.forceOffline(agent.agentId);
      }
    }
    this.agents.clear();
  }
}

export const autoVDPManager = new AutoVDPManager();
