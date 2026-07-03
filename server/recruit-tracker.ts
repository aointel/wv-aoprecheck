/**
 * AO Recruit Tracker
 * Tracks agents who are actively on the AO Recruit page
 */

interface AgentHeartbeat {
  agentEmail: string;
  lastHeartbeat: Date;
  isActive: boolean;
}

class RecruitTracker {
  private agentHeartbeats: Map<string, AgentHeartbeat> = new Map(); // Key: agentEmail

  /**
   * Update agent heartbeat - called every 10 seconds from AO Recruit page
   */
  updateHeartbeat(agentEmail: string) {
    console.log(`💓 AO Recruit Heartbeat: ${agentEmail}`);
    
    this.agentHeartbeats.set(agentEmail, {
      agentEmail,
      lastHeartbeat: new Date(),
      isActive: true
    });
  }

  /**
   * Get all agents with recent heartbeats (active in last 2 minutes)
   */
  getActiveAgents(): AgentHeartbeat[] {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const activeAgents: AgentHeartbeat[] = [];
    
    for (const [email, heartbeat] of this.agentHeartbeats.entries()) {
      if (heartbeat.lastHeartbeat > twoMinutesAgo) {
        activeAgents.push(heartbeat);
      }
    }
    
    return activeAgents;
  }

  /**
   * Check if an agent has a recent heartbeat (active on AO Recruit in last 2 minutes)
   */
  isAgentActive(agentEmail: string): boolean {
    const heartbeat = this.agentHeartbeats.get(agentEmail);
    if (!heartbeat) return false;
    
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return heartbeat.lastHeartbeat > twoMinutesAgo;
  }

  /**
   * Get agent's last heartbeat time
   */
  getAgentLastHeartbeat(agentEmail: string): Date | null {
    const heartbeat = this.agentHeartbeats.get(agentEmail);
    return heartbeat?.lastHeartbeat || null;
  }
}

// Singleton instance
export const recruitTracker = new RecruitTracker();

