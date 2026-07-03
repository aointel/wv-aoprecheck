/**
 * AO Recruit Dial Manager
 * Automatically adjusts aorecruittest campaign dials per hour based on active agents
 * Formula: activeAgents * 400 dials/hour
 */

import { recruitTracker } from './recruit-tracker';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const DIALS_PER_AGENT = 400;

// Actual Taalk campaign ID for aorecruittest
const AORECRUITTEST_CAMPAIGN_ID = "68cc2de5f67f5aeafec89b3b";

class AORecruitDialManager {
  private lastUpdateTime: Date | null = null;
  private lastAgentCount: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring and auto-adjusting dials per hour
   */
  start() {
    console.log('🚀 AO Recruit Dial Manager started');
    console.log(`📊 Configuration: ${DIALS_PER_AGENT} dials per agent per hour`);
    
    // Update immediately on start
    this.updateDialRate();
    
    // Update every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateDialRate();
    }, 30000);
  }

  /**
   * Stop the dial manager
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('🛑 AO Recruit Dial Manager stopped');
  }

  /**
   * Update the campaign dial rate based on active agents
   */
  private async updateDialRate() {
    try {
      // Get active agents from recruit tracker
      const activeAgents = recruitTracker.getActiveAgents();
      const agentCount = activeAgents.length;
      
      // Calculate target dials per hour: 0 if no agents, 400 per agent
      const targetDialsPerHour = agentCount * DIALS_PER_AGENT;
      
      // ALWAYS update (removed the agentCount !== lastAgentCount check)
      // This ensures we push updates to Taalk even if count hasn't changed
      console.log(`👥 Active AO Recruit Agents: ${agentCount}`);
      console.log(`📞 Updating aorecruittest campaign to ${targetDialsPerHour} dials/hour (${agentCount} agents × ${DIALS_PER_AGENT})`);
      
      // Log active agent emails
      if (agentCount > 0) {
        const agentEmails = activeAgents.map(a => a.agentEmail).join(', ');
        console.log(`   Active agents: ${agentEmails}`);
      } else {
        console.log(`   No agents currently active on AO Recruit page`);
      }
      
      // Update campaign via Taalk API
      const success = await this.updateCampaignDialRate(AORECRUITTEST_CAMPAIGN_ID, targetDialsPerHour);
      
      if (success) {
        this.lastAgentCount = agentCount;
        this.lastUpdateTime = new Date();
        console.log(`✅ Successfully updated aorecruittest campaign to ${targetDialsPerHour} dials/hour`);
      } else {
        console.error(`❌ Failed to update aorecruittest campaign to Taalk API`);
      }
      
    } catch (error) {
      console.error('❌ Error in updateDialRate:', error);
    }
  }

  /**
   * Update campaign dial rate via Taalk API
   */
  private async updateCampaignDialRate(campaignId: string, limitPerHour: number): Promise<boolean> {
    try {
      const response = await fetch(`https://api.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${TAALK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limitPerHour })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Taalk API error (${response.status}):`, errorText);
        return false;
      }
      
      const result = await response.json();
      console.log('📡 Taalk API response:', result);
      return true;
      
    } catch (error) {
      console.error('❌ Error calling Taalk API:', error);
      return false;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    const activeAgents = recruitTracker.getActiveAgents();
    return {
      activeAgentCount: activeAgents.length,
      activeAgents: activeAgents.map(a => a.agentEmail),
      currentDialsPerHour: activeAgents.length * DIALS_PER_AGENT,
      lastUpdateTime: this.lastUpdateTime,
      lastAgentCount: this.lastAgentCount
    };
  }
}

// Singleton instance
export const aoRecruitDialManager = new AORecruitDialManager();

