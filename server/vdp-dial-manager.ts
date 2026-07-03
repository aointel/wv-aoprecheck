/**
 * VDP Dial Manager
 * Automatically adjusts ALL VDP campaign dials per hour based on online agents
 * Groups agents by market and state, then updates each campaign accordingly
 */

import { taalkVDPPoller } from './taalk-vdp-poller';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const DIALS_PER_AGENT = 400;
const MINIMUM_DIALS_IF_NO_AGENTS = 0; // Set to 0 if no agents available

// Campaign ID mapping - we'll fetch this from Taalk API
interface VDPCampaign {
  id: string;
  name: string;
  market: 'Veteran' | 'Globe';
  state: string;
  currentDialsPerHour: number;
}

class VDPDialManager {
  private campaigns: Map<string, VDPCampaign> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime: Date | null = null;

  /**
   * Start the VDP dial manager
   */
  async start() {
    console.log('🚀 VDP Dial Manager starting...');
    
    // Load all VDP campaigns from Taalk
    await this.loadVDPCampaigns();
    
    // Update immediately
    await this.updateAllCampaigns();
    
    // Update every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateAllCampaigns();
    }, 30000);
    
    console.log('✅ VDP Dial Manager started');
  }

  /**
   * Stop the manager
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('🛑 VDP Dial Manager stopped');
  }

  /**
   * Load all VDP campaigns from Taalk API
   */
  private async loadVDPCampaigns() {
    try {
      console.log('📋 Loading VDP campaigns from Taalk...');
      
      // Fetch ALL campaigns with pagination (API returns { payload: [...] }, not a plain array)
      let allCampaigns: any[] = [];
      let page = 1;
      while (true) {
        const pageResponse = await fetch(`https://api.taalk.ai/api/campaign2s?db=michaelmandella&limit=200&page=${page}`, {
          headers: {
            'Authorization': `Bearer ${TAALK_API_KEY}`
          }
        });
        if (!pageResponse.ok) {
          throw new Error(`Failed to fetch campaigns page ${page}: ${pageResponse.status}`);
        }
        const pageData = await pageResponse.json();
        // API returns { payload: [...] } — extract the array
        const batch: any[] = Array.isArray(pageData) ? pageData : (pageData.payload || []);
        if (batch.length === 0) break;
        allCampaigns = allCampaigns.concat(batch);
        if (batch.length < 200) break;
        page++;
      }
      
      // Filter for VDP campaigns (Veteran-PAVET and Globe-VN)
      const vdpCampaigns = allCampaigns.filter((c: any) => 
        c.name?.includes('Veteran - PAVET') || c.name?.includes('Globe-VN')
      );
      
      console.log(`📊 Found ${vdpCampaigns.length} VDP campaigns`);
      
      // Parse campaign names to extract market and state
      vdpCampaigns.forEach((c: any) => {
        let market: 'Veteran' | 'Globe' | null = null;
        let state: string | null = null;
        
        // Parse "Veteran - PAVET - CA" or "Globe-VN-CA"
        if (c.name.includes('Veteran - PAVET')) {
          market = 'Veteran';
          const parts = c.name.split(' - ');
          state = parts[2]?.trim(); // "CA"
        } else if (c.name.includes('Globe-VN')) {
          market = 'Globe';
          const parts = c.name.split('-');
          state = parts[2]?.trim(); // "CA"
        }
        
        if (market && state) {
          this.campaigns.set(c._id, {
            id: c._id,
            name: c.name,
            market,
            state,
            currentDialsPerHour: c.limitPerHour || 0
          });
        }
      });
      
      console.log(`✅ Loaded ${this.campaigns.size} VDP campaigns for management`);
      
    } catch (error) {
      console.error('❌ Error loading VDP campaigns:', error);
    }
  }

  /**
   * Update all VDP campaigns based on online agents
   */
  private async updateAllCampaigns() {
    try {
      // Get all online/available agents from VDP poller
      const agents = taalkVDPPoller.getAgents();
      const onlineAgents = agents.filter(a => a.status === 'online' || a.status === 'calling');
      
      console.log(`\n📡 VDP Dial Manager Update - ${onlineAgents.length} agents online`);
      
      // Group agents by market and state (even if 0 agents, we still need to set campaigns to 0)
      const agentsByMarketState = await this.groupAgentsByMarketState(onlineAgents);
      
      // Update each campaign
      let updatedCount = 0;
      const updates: Array<{ campaign: string; agents: number; dials: number; agentNames: string[] }> = [];
      
      for (const [campaignId, campaign] of this.campaigns.entries()) {
        const key = `${campaign.market}-${campaign.state}`;
        const data = agentsByMarketState.get(key);
        const agentCount = data?.count || 0;
        const agentNames = data?.agents || [];
        const targetDialsPerHour = agentCount > 0 ? agentCount * DIALS_PER_AGENT : MINIMUM_DIALS_IF_NO_AGENTS;
        
        // Only update if changed
        if (targetDialsPerHour !== campaign.currentDialsPerHour) {
          const success = await this.updateCampaignDialRate(campaignId, targetDialsPerHour);
          
          if (success) {
            campaign.currentDialsPerHour = targetDialsPerHour;
            updates.push({
              campaign: campaign.name,
              agents: agentCount,
              dials: targetDialsPerHour,
              agentNames
            });
            updatedCount++;
          }
        }
      }
      
      if (updatedCount > 0) {
        console.log(`\n📊 UPDATED ${updatedCount} VDP CAMPAIGNS:`);
        console.log('='.repeat(80));
        updates.forEach(u => {
          console.log(`\n✅ ${u.campaign}`);
          console.log(`   Agents: ${u.agents} → Dials: ${u.dials}/hr`);
          if (u.agentNames.length > 0) {
            console.log(`   Agent list:`);
            u.agentNames.forEach(name => console.log(`      - ${name}`));
          }
        });
        console.log('='.repeat(80));
      } else {
        console.log(`✓ All campaigns already at correct dial rates (no changes needed)`);
      }
      
      this.lastUpdateTime = new Date();
      
    } catch (error) {
      console.error('❌ Error updating campaigns:', error);
    }
  }

  /**
   * Group online agents by market and state
   * Returns Map of "Market-State" -> { count, agents[] }
   */
  private async groupAgentsByMarketState(agents: any[]): Promise<Map<string, { count: number; agents: string[] }>> {
    const groupMap = new Map<string, { count: number; agents: string[] }>();
    
    console.log(`\n📊 Grouping ${agents.length} online agents by market/state...`);
    console.log(`   Online agent emails: ${agents.map(a => a.email).join(', ')}\n`);
    
    const { supabaseAdmin } = await import('./supabase.js');
    
    // Get all agent emails
    const agentEmails = agents.map(a => a.email).filter(Boolean);
    
    if (agentEmails.length === 0) {
      console.log('⚠️  No agent emails found');
      return groupMap;
    }
    
    // Fetch agent data from customers table (markets and states)
    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('company_email, market, states, first_name, last_name')
      .in('company_email', agentEmails);
    
    if (error || !customers) {
      console.error('❌ Error fetching agent data:', error);
      return groupMap;
    }
    
    console.log(`✅ Found ${customers.length} agent records with market/state data\n`);
    
    // Group agents by market-state combinations
    customers.forEach((customer: any) => {
      const agentName = `${customer.first_name} ${customer.last_name}`.trim();
      const agentEmail = customer.company_email;
      const markets = Array.isArray(customer.market) ? customer.market : [customer.market];
      const states = Array.isArray(customer.states) ? customer.states : [];
      
      console.log(`👤 ${agentName} (${agentEmail}):`);
      console.log(`   Markets: ${markets.join(', ') || 'NONE'}`);
      console.log(`   States: ${states.join(', ') || 'NONE'}`);
      
      // For each market this agent works
      markets.forEach((market: string) => {
        if (!market) return;
        
        // Normalize market name
        let normalizedMarket: 'Veteran' | 'Globe' | null = null;
        if (market.toLowerCase().includes('vet')) {
          normalizedMarket = 'Veteran';
        } else if (market.toLowerCase().includes('globe')) {
          normalizedMarket = 'Globe';
        }
        
        if (!normalizedMarket) {
          console.log(`   ⚠️  Unknown market: ${market}`);
          return;
        }
        
        // For each state this agent is licensed in
        states.forEach((state: string) => {
          if (!state) return;
          
          const key = `${normalizedMarket}-${state}`;
          
          if (!groupMap.has(key)) {
            groupMap.set(key, { count: 0, agents: [] });
          }
          
          const group = groupMap.get(key)!;
          group.count++;
          group.agents.push(`${agentName} (${agentEmail})`);
          
          console.log(`   ✅ Counted for: ${key}`);
        });
      });
      console.log();
    });
    
    // Log the final grouping
    console.log(`\n📊 FINAL AGENT DISTRIBUTION BY MARKET-STATE:`);
    console.log('='.repeat(80));
    for (const [key, data] of groupMap.entries()) {
      if (data.count > 0) {
        console.log(`\n${key}: ${data.count} agents`);
        data.agents.forEach(agent => console.log(`   - ${agent}`));
      }
    }
    console.log('='.repeat(80) + '\n');
    
    return groupMap;
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
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ Error updating campaign ${campaignId}:`, error);
      return false;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      totalCampaigns: this.campaigns.size,
      lastUpdateTime: this.lastUpdateTime,
      campaigns: Array.from(this.campaigns.values())
    };
  }
}

// Singleton instance
export const vdpDialManager = new VDPDialManager();

