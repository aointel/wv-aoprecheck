/**
 * VDP Agent Tracker
 * Monitors all agents connected to Taalk VDP and tracks their availability and usage
 */

import { supabaseAdmin } from './supabase.js';
import { db } from './db.js';

interface VDPAgent {
  email: string;
  name: string;
  status: 'idle' | 'dialing' | 'live' | 'presentation' | 'offline';
  lastHeartbeat: Date;
  sessionStart: Date;
  availableTime: number; // in seconds
  callTime: number; // in seconds
  currentCall?: {
    callId: string;
    direction: 'inbound' | 'outbound';
    phoneNumber: string;
    startTime: Date;
    duration: number;
  };
  currentPresentation?: {
    sessionId: string;
    clientName: string;
    startTime: Date;
    duration: number;
  };
  todayStats: {
    dialed: number;
    reached: number;
    booked: number;
    inboundCalls: number;
    outboundCalls: number;
    totalCallTime: number;
    totalAvailableTime: number;
    utilization: number; // percentage
  };
}

class VDPAgentTracker {
  private agents: Map<string, VDPAgent> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 seconds

  constructor() {
    console.log('🎯 VDP Agent Tracker initialized');
  }

  /**
   * Start monitoring VDP agents
   */
  start() {
    console.log('🚀 Starting VDP Agent Tracker...');
    
    // Check for stale agents every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkStaleAgents();
    }, 10000);
    
    // Refresh dial/reached/booked stats every 15 seconds
    this.statsInterval = setInterval(() => {
      this.refreshAgentStats();
    }, 15000);
    
    console.log('✅ VDP Agent Tracker started - real-time dial/reached/booked enabled');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    console.log('🛑 VDP Agent Tracker stopped');
  }

  /**
   * Update agent heartbeat from VDP
   */
  updateHeartbeat(email: string, name: string) {
    const now = new Date();
    const agent = this.agents.get(email);

    if (agent) {
      // Update existing agent
      const timeSinceLastHeartbeat = (now.getTime() - agent.lastHeartbeat.getTime()) / 1000;
      
      // If agent was offline and came back online
      if (agent.status === 'offline') {
        agent.status = 'idle';
        agent.sessionStart = now;
        console.log(`👤 ${email} came ONLINE`);
      } else if (agent.status === 'idle') {
        // Add to available time
        agent.availableTime += timeSinceLastHeartbeat;
        agent.todayStats.totalAvailableTime += timeSinceLastHeartbeat;
      }
      
      agent.lastHeartbeat = now;
    } else {
      // New agent connected
      console.log(`✅ NEW agent connected: ${email}`);
      this.agents.set(email, {
        email,
        name,
        status: 'idle',
        lastHeartbeat: now,
        sessionStart: now,
        availableTime: 0,
        callTime: 0,
        todayStats: {
          dialed: 0,
          reached: 0,
          booked: 0,
          inboundCalls: 0,
          outboundCalls: 0,
          totalCallTime: 0,
          totalAvailableTime: 0,
          utilization: 0
        }
      });
      
      // Immediately fetch their stats
      this.fetchAgentStats(email);
    }
  }

  /**
   * Mark agent as dialing
   */
  startDialing(email: string, phoneNumber: string) {
    const agent = this.agents.get(email);
    if (!agent) {
      console.warn(`⚠️ Cannot start dialing for unknown agent: ${email}`);
      return;
    }

    agent.status = 'dialing';
    console.log(`📞 ${email} started DIALING ${phoneNumber}`);
  }

  /**
   * Mark agent as on a live call
   */
  startCall(email: string, callId: string, direction: 'inbound' | 'outbound', phoneNumber: string) {
    const agent = this.agents.get(email);
    if (!agent) {
      console.warn(`⚠️ Cannot start call for unknown agent: ${email}`);
      return;
    }

    agent.status = 'live';
    agent.currentCall = {
      callId,
      direction,
      phoneNumber,
      startTime: new Date(),
      duration: 0
    };

    if (direction === 'inbound') {
      agent.todayStats.inboundCalls++;
    } else {
      agent.todayStats.outboundCalls++;
    }

    console.log(`📞 ${email} on LIVE ${direction} call with ${phoneNumber}`);
  }

  /**
   * Mark agent as in presentation (HPPRO)
   */
  startPresentation(email: string, sessionId: string, clientName: string) {
    const agent = this.agents.get(email);
    if (!agent) {
      console.warn(`⚠️ Cannot start presentation for unknown agent: ${email}`);
      return;
    }

    agent.status = 'presentation';
    agent.currentPresentation = {
      sessionId,
      clientName,
      startTime: new Date(),
      duration: 0
    };

    console.log(`🎬 ${email} entered HPPRO presentation with ${clientName}`);
  }

  /**
   * End agent's current call
   */
  endCall(email: string) {
    const agent = this.agents.get(email);
    if (!agent || !agent.currentCall) {
      return;
    }

    const callDuration = (new Date().getTime() - agent.currentCall.startTime.getTime()) / 1000;
    agent.callTime += callDuration;
    agent.todayStats.totalCallTime += callDuration;
    
    console.log(`📞 ${email} ended call (${Math.round(callDuration)}s)`);
    
    agent.currentCall = undefined;
    agent.status = 'idle';
    
    // Recalculate utilization
    this.updateUtilization(agent);
    
    // Refresh dial/reached/booked stats
    this.fetchAgentStats(email);
  }

  /**
   * End agent's presentation
   */
  endPresentation(email: string) {
    const agent = this.agents.get(email);
    if (!agent || !agent.currentPresentation) {
      return;
    }

    const presentationDuration = (new Date().getTime() - agent.currentPresentation.startTime.getTime()) / 1000;
    console.log(`🎬 ${email} ended presentation (${Math.round(presentationDuration)}s)`);
    
    agent.currentPresentation = undefined;
    agent.status = 'idle';
    
    // Refresh stats after presentation
    this.fetchAgentStats(email);
  }

  /**
   * Fetch today's dial/reached/booked stats from agent_dial_metrics table (independent of masterlead)
   * CRITICAL: Uses agent_dial_metrics table so stats persist even when leads are cleaned/reassigned
   */
  private async fetchAgentStats(email: string) {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get dialed count from agent_dial_metrics table
      const { count: dialed } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', email.toLowerCase())
        .eq('event_type', 'dial')
        .gte('event_timestamp', todayStart.toISOString())
        .lt('event_timestamp', todayEnd.toISOString());

      // Get reached count from agent_dial_metrics table
      const { count: reached } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', email.toLowerCase())
        .eq('event_type', 'reach')
        .gte('event_timestamp', todayStart.toISOString())
        .lt('event_timestamp', todayEnd.toISOString());

      // Get booked count from agent_dial_metrics table
      const { count: booked } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', email.toLowerCase())
        .eq('event_type', 'booked')
        .gte('event_timestamp', todayStart.toISOString())
        .lt('event_timestamp', todayEnd.toISOString());

      const agent = this.agents.get(email);
      if (agent) {
        agent.todayStats.dialed = dialed || 0;
        agent.todayStats.reached = reached || 0;
        agent.todayStats.booked = booked || 0;
      }
    } catch (error) {
      console.error(`❌ Error fetching stats for ${email}:`, error);
    }
  }

  /**
   * Refresh stats for all online agents
   */
  private async refreshAgentStats() {
    const onlineAgents = Array.from(this.agents.values()).filter(a => a.status !== 'offline');
    for (const agent of onlineAgents) {
      await this.fetchAgentStats(agent.email);
    }
  }

  /**
   * Update call duration for active calls and presentations
   */
  private updateActiveCallDurations() {
    const now = new Date();
    for (const agent of this.agents.values()) {
      if (agent.currentCall) {
        agent.currentCall.duration = (now.getTime() - agent.currentCall.startTime.getTime()) / 1000;
      }
      if (agent.currentPresentation) {
        agent.currentPresentation.duration = (now.getTime() - agent.currentPresentation.startTime.getTime()) / 1000;
      }
    }
  }

  /**
   * Calculate utilization percentage
   */
  private updateUtilization(agent: VDPAgent) {
    const totalTime = agent.todayStats.totalAvailableTime + agent.todayStats.totalCallTime;
    if (totalTime > 0) {
      agent.todayStats.utilization = Math.round((agent.todayStats.totalCallTime / totalTime) * 100);
    }
  }

  /**
   * Check for agents that haven't sent heartbeat (offline)
   */
  private checkStaleAgents() {
    const now = new Date();
    
    // Update active call durations
    this.updateActiveCallDurations();
    
    for (const [email, agent] of this.agents.entries()) {
      const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT && agent.status !== 'offline') {
        console.log(`❌ ${email} went OFFLINE (no heartbeat for ${Math.round(timeSinceHeartbeat / 1000)}s)`);
        agent.status = 'offline';
        
        // If they were on a call, end it
        if (agent.currentCall) {
          this.endCall(email);
        }
        
        // If they were in presentation, end it
        if (agent.currentPresentation) {
          this.endPresentation(email);
        }
      }
    }
  }

  /**
   * Get all agents for the live call board
   */
  getAgents(): VDPAgent[] {
    return Array.from(this.agents.values())
      .sort((a, b) => {
        // Sort by status priority: live/presentation/dialing first, then idle, then offline
        const statusPriority = { 'live': 1, 'presentation': 2, 'dialing': 3, 'idle': 4, 'offline': 5 };
        const aPriority = statusPriority[a.status] || 6;
        const bPriority = statusPriority[b.status] || 6;
        
        if (aPriority !== bPriority) return aPriority - bPriority;
        return b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime();
      });
  }

  /**
   * Get agent by email
   */
  getAgentByEmail(email: string): VDPAgent | undefined {
    return this.agents.get(email);
  }

  /**
   * Get stats for dashboard
   */
  getStats() {
    const agents = Array.from(this.agents.values());
    const onlineAgents = agents.filter(a => a.status !== 'offline');
    const activeAgents = agents.filter(a => ['live', 'dialing', 'presentation'].includes(a.status));
    const idleAgents = agents.filter(a => a.status === 'idle');
    
    const totalDialed = agents.reduce((sum, a) => sum + a.todayStats.dialed, 0);
    const totalReached = agents.reduce((sum, a) => sum + a.todayStats.reached, 0);
    const totalBooked = agents.reduce((sum, a) => sum + a.todayStats.booked, 0);
    const totalInbound = agents.reduce((sum, a) => sum + a.todayStats.inboundCalls, 0);
    const totalOutbound = agents.reduce((sum, a) => sum + a.todayStats.outboundCalls, 0);
    const totalCallTime = agents.reduce((sum, a) => sum + a.todayStats.totalCallTime, 0);
    const avgUtilization = onlineAgents.length > 0 
      ? Math.round(onlineAgents.reduce((sum, a) => sum + a.todayStats.utilization, 0) / onlineAgents.length)
      : 0;

    return {
      totalAgents: agents.length,
      onlineAgents: onlineAgents.length,
      activeAgents: activeAgents.length,
      idleAgents: idleAgents.length,
      totalDialed,
      totalReached,
      totalBooked,
      inboundCalls: totalInbound,
      outboundCalls: totalOutbound,
      avgCallTime: this.formatDuration(totalDialed > 0 ? totalCallTime / totalDialed : 0),
      avgUtilization
    };
  }

  /**
   * Format seconds to MM:SS
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const vdpAgentTracker = new VDPAgentTracker();
