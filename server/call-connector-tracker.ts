/**
 * Call Connector Pro Tracker
 * Tracks real-time outbound calls from Call Connector Pro for Live Board display
 */

interface OutboundCall {
  callSid: string;
  agentEmail: string;
  agentName: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadState?: string;
  conferenceName?: string;
  status: 'dialing' | 'ringing' | 'answered' | 'completed' | 'failed';
  startedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  disposition?: string;
  reached: boolean; // true when status === 'answered'
}

interface AgentStats {
  agentEmail: string;
  dialed: number;
  reached: number;
  booked: number;
}

interface AgentHeartbeat {
  agentEmail: string;
  lastHeartbeat: Date;
  sessionId: string;
  isActive: boolean;
}

interface AgentActivity {
  agentEmail: string;
  activity: 'idle' | 'dialing' | 'ringing' | 'live' | 'wrapping_up';
  lastUpdate: Date;
  callDetails?: {
    phoneNumber?: string;
    clientName?: string;
    duration?: number;
    direction?: 'inbound' | 'outbound';
  };
}

// Lazy import cache for timezone helper
let timezoneHelperPromise: Promise<any> | null = null;
const getTimezoneHelper = async () => {
  if (!timezoneHelperPromise) {
    timezoneHelperPromise = import('./timezone-helper');
  }
  return timezoneHelperPromise;
};

class CallConnectorTracker {
  private activeCalls: Map<string, OutboundCall> = new Map(); // Key: callSid
  private dailyStats: Map<string, AgentStats> = new Map(); // Key: agentEmail
  private agentHeartbeats: Map<string, AgentHeartbeat> = new Map(); // Key: agentEmail
  private agentActivities: Map<string, AgentActivity> = new Map(); // Key: agentEmail
  private lastCleanup: Date = new Date();

  /**
   * Start tracking a new outbound call
   */
  startCall(data: {
    callSid: string;
    agentEmail: string;
    agentName?: string;
    leadId: string;
    leadName: string;
    leadPhone: string;
    leadState?: string;
    conferenceName?: string;
  }) {
    console.log(`📞 Call Connector Tracker: Starting call ${data.callSid} for ${data.agentEmail}`);
    
    const call: OutboundCall = {
      callSid: data.callSid,
      agentEmail: data.agentEmail,
      agentName: data.agentName || data.agentEmail,
      leadId: data.leadId,
      leadName: data.leadName,
      leadPhone: data.leadPhone,
      leadState: data.leadState,
      conferenceName: data.conferenceName,
      status: 'dialing',
      startedAt: new Date(),
      reached: false
    };

    this.activeCalls.set(data.callSid, call);
    
    // Increment dialed count
    this.incrementStat(data.agentEmail, 'dialed');
    
    return call;
  }

  /**
   * Update call status from Twilio webhook
   */
  updateCallStatus(callSid: string, status: 'ringing' | 'answered' | 'completed' | 'failed', duration?: number) {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      console.log(`⚠️ Call Connector Tracker: Call ${callSid} not found for status update`);
      return null;
    }

    console.log(`📞 Call Connector Tracker: Updating ${callSid} to ${status}`);
    
    call.status = status;

    if (status === 'answered' && !call.answeredAt) {
      call.answeredAt = new Date();
      call.reached = true;
      // Increment reached count
      this.incrementStat(call.agentEmail, 'reached');
      console.log(`🎉 Call answered! Agent: ${call.agentEmail}, Lead: ${call.leadName}`);
    }

    if (status === 'completed' || status === 'failed') {
      call.endedAt = new Date();
      call.durationSeconds = duration || Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000);
      
      // Remove from active calls after a delay (for Live Board to show completion)
      setTimeout(() => {
        this.activeCalls.delete(callSid);
        console.log(`🗑️ Call Connector Tracker: Removed completed call ${callSid}`);
      }, 5000); // Keep for 5 seconds after completion
    }

    return call;
  }

  /**
   * Update call disposition (booked, no_answer, etc.)
   */
  updateDisposition(callSid: string, disposition: string) {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      console.log(`⚠️ Call Connector Tracker: Call ${callSid} not found for disposition update`);
      return null;
    }

    call.disposition = disposition;
    
    if (disposition === 'booked') {
      this.incrementStat(call.agentEmail, 'booked');
      console.log(`📅 Booking recorded! Agent: ${call.agentEmail}, Lead: ${call.leadName}`);
    }

    return call;
  }

  /**
   * Get all active outbound calls
   * Returns calls with timestamps in PST (for logging) and lead's local time (for display)
   */
  async getActiveCalls(): Promise<OutboundCall[]> {
    this.cleanupOldCalls();
    const calls = Array.from(this.activeCalls.values());
    
    // Import timezone helper dynamically
    const { formatTimeInStateTimezone, getTimezoneAbbr, isSafeToCall, getTimezoneForState } = await getTimezoneHelper();
    
    // Convert Date objects and add timezone info
    return calls.map(call => {
      // Format PST time (for logging/display consistency)
      const pstTime = call.startedAt.toLocaleString('en-US', { 
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      // Get lead's current local time (what time is it for THEM right now)
      const now = new Date();
      const leadCurrentTime = call.leadState ? now.toLocaleString('en-US', {
        timeZone: getTimezoneForState(call.leadState),
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : null;
      
      // Check FTC calling restrictions (8 AM - 9 PM in lead's timezone)
      const ftcCheck = call.leadState ? isSafeToCall(call.leadState) : { safe: true, leadLocalTime: '', leadHour: 12 };
      
      return {
        ...call,
        startedAt: call.startedAt.toISOString() as any,
        answeredAt: call.answeredAt?.toISOString() as any,
        endedAt: call.endedAt?.toISOString() as any,
        callStartedPST: pstTime,
        leadCurrentLocalTime: leadCurrentTime, // What time is it for the lead RIGHT NOW
        leadTimezone: call.leadState ? getTimezoneAbbr(call.leadState) : null,
        ftcSafe: ftcCheck.safe,
        ftcWarning: ftcCheck.reason
      };
    });
  }

  /**
   * Get active calls for a specific agent
   */
  async getAgentCalls(agentEmail: string): Promise<OutboundCall[]> {
    const calls = await this.getActiveCalls();
    return calls.filter(call => call.agentEmail === agentEmail);
  }

  /**
   * Get daily stats for all agents
   */
  getAllStats(): AgentStats[] {
    return Array.from(this.dailyStats.values());
  }

  /**
   * Get daily stats for a specific agent
   */
  getAgentStats(agentEmail: string): AgentStats {
    return this.dailyStats.get(agentEmail) || {
      agentEmail,
      dialed: 0,
      reached: 0,
      booked: 0
    };
  }

  /**
   * Get aggregate stats across all agents
   */
  getAggregateStats() {
    const stats = this.getAllStats();
    return {
      totalDialed: stats.reduce((sum, s) => sum + s.dialed, 0),
      totalReached: stats.reduce((sum, s) => sum + s.reached, 0),
      totalBooked: stats.reduce((sum, s) => sum + s.booked, 0),
      activeAgents: new Set(this.getActiveCalls().map(c => c.agentEmail)).size,
      activeCalls: this.activeCalls.size
    };
  }

  /**
   * Update agent heartbeat - called every 30 seconds from Call Connector Pro
   */
  updateHeartbeat(agentEmail: string, sessionId: string) {
    console.log(`💓 Call Connector Heartbeat: ${agentEmail}`);
    
    this.agentHeartbeats.set(agentEmail, {
      agentEmail,
      lastHeartbeat: new Date(),
      sessionId,
      isActive: true
    });
  }

  /**
   * Get all agents with recent heartbeats (active in last 2 hours)
   */
  getActiveAgents(): AgentHeartbeat[] {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const activeAgents: AgentHeartbeat[] = [];
    
    for (const [email, heartbeat] of this.agentHeartbeats.entries()) {
      if (heartbeat.lastHeartbeat > twoHoursAgo) {
        activeAgents.push(heartbeat);
      }
    }
    
    return activeAgents;
  }

  /**
   * Check if an agent has a recent heartbeat (last 2 hours)
   */
  isAgentActive(agentEmail: string): boolean {
    const heartbeat = this.agentHeartbeats.get(agentEmail);
    if (!heartbeat) return false;
    
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    return heartbeat.lastHeartbeat > twoHoursAgo;
  }

  /**
   * Get agent's last heartbeat time
   */
  getAgentLastHeartbeat(agentEmail: string): Date | null {
    const heartbeat = this.agentHeartbeats.get(agentEmail);
    return heartbeat?.lastHeartbeat || null;
  }

  /**
   * Get call by CallSid (for webhook handler to retrieve agent email)
   */
  getCallByCallSid(callSid: string): OutboundCall | undefined {
    return this.activeCalls.get(callSid);
  }

  /**
   * Increment a stat for an agent
   */
  private incrementStat(agentEmail: string, stat: 'dialed' | 'reached' | 'booked') {
    let stats = this.dailyStats.get(agentEmail);
    if (!stats) {
      stats = { agentEmail, dialed: 0, reached: 0, booked: 0 };
      this.dailyStats.set(agentEmail, stats);
    }
    stats[stat]++;
  }

  /**
   * Clean up old calls (calls that have been completed for more than 1 hour)
   */
  private cleanupOldCalls() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Only cleanup once per minute
    if (now.getTime() - this.lastCleanup.getTime() < 60000) {
      return;
    }

    this.lastCleanup = now;

    for (const [callSid, call] of this.activeCalls.entries()) {
      if (call.endedAt && call.endedAt < oneHourAgo) {
        this.activeCalls.delete(callSid);
        console.log(`🗑️ Cleaned up old call: ${callSid}`);
      }
    }
  }

  /**
   * Reset daily stats (call at midnight)
   */
  resetDailyStats() {
    console.log('🔄 Resetting Call Connector daily stats');
    this.dailyStats.clear();
  }

  /**
   * Update agent activity status
   */
  updateActivity(data: {
    agentEmail: string;
    activity: 'idle' | 'dialing' | 'ringing' | 'live' | 'wrapping_up';
    callDetails?: {
      phoneNumber?: string;
      clientName?: string;
      duration?: number;
      direction?: 'inbound' | 'outbound';
    };
  }) {
    console.log(`📊 Call Connector Activity Update: ${data.agentEmail} -> ${data.activity}`, data.callDetails);
    
    this.agentActivities.set(data.agentEmail, {
      agentEmail: data.agentEmail,
      activity: data.activity,
      lastUpdate: new Date(),
      callDetails: data.callDetails
    });
  }

  /**
   * Get agent's current activity
   */
  getAgentActivity(agentEmail: string): AgentActivity | undefined {
    const activity = this.agentActivities.get(agentEmail);
    
    // Clean up stale activities (older than 20 seconds — calls resolve fast)
    if (activity) {
      const staleThreshold = new Date(Date.now() - 20 * 1000);
      if (activity.lastUpdate < staleThreshold) {
        this.agentActivities.delete(agentEmail);
        return undefined;
      }
    }
    
    return activity;
  }

  /**
   * Get all active agents with their activities
   */
  getAllAgentActivities(): AgentActivity[] {
    const staleThreshold = new Date(Date.now() - 20 * 1000);
    const activities: AgentActivity[] = [];
    
    for (const [email, activity] of this.agentActivities.entries()) {
      if (activity.lastUpdate > staleThreshold) {
        activities.push(activity);
      } else {
        // Clean up stale activity — 20s without update means call is over
        this.agentActivities.delete(email);
      }
    }
    
    return activities;
  }
}

// Singleton instance
export const callConnectorTracker = new CallConnectorTracker();

// Reset stats at midnight
const scheduleStatReset = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    callConnectorTracker.resetDailyStats();
    // Schedule next reset
    scheduleStatReset();
  }, msUntilMidnight);
};

scheduleStatReset();

