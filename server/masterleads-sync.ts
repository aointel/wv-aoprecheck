import { masterleadClient } from "./local-masterlead-client";
import { isCallPermissible, getNextCallableTime } from './ftc-compliance';

export interface MasterLead {
  id: string;
  cn_email: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  taalk_market?: string;
  taalk_lead_source?: string;
  taalk_state?: string;
  taalk_lead_id?: string;
  taalk_group_code?: string;
  taalk_groupname?: string;
  groupcode?: string;
  group_name?: string;
  taalk_email?: string;
  taalk_city?: string;
  taalk_zip?: string;
  taalk_address?: string;
  taalk_beneficiary?: string;
  taalk_relationship?: string;
  taalk_reffered?: string;
  taalk_referred?: string;
  taalk_sponsor_org?: string;
  cnresolution?: string;
  status?: string;
  last_contacted?: string;

  created_at?: string;
  updated_at?: string;
}

export class MasterLeadsSync {
  
  /**
   * ONLY query masterlead table - NO FALLBACKS
   */
  async getLeadsForUser(userEmail: string): Promise<MasterLead[]> {
    console.log(`🔎 Querying masterlead (Postgres) for: ${userEmail}`);
    
    try {
      // SUPABASE ONLY - Get ALL leads for this user
      const { data: masterLeads, error: masterError } = await masterleadClient.from('masterlead')
        .select('*')
        .eq('cn_email', userEmail)
        .order('created_at', { ascending: false });

      console.log(`🎯 SUPABASE QUERY for ${userEmail}: found ${masterLeads?.length || 0} leads`);

      if (masterError) {
        console.error(`❌ Error querying masterlead table:`, masterError);
        throw masterError;
      }

      // ONLY USE MASTERLEAD TABLE - NO OTHER SOURCES
      const allLeads = [...(masterLeads || [])];

      if (!allLeads || allLeads.length === 0) {
        console.log(`📭 No leads found in masterlead table for ${userEmail}`);
        return [];
      }

      console.log(`✅ Found ${masterLeads?.length || 0} masterlead leads total for ${userEmail}`);
      

      
      // DEBUG: Check all leads for taalk_groupname field
      const leadsWithGroupName = allLeads.filter(lead => lead.taalk_groupname && lead.taalk_groupname.trim() !== '');
      console.log(`🔍 GROUPNAME DEBUG: Found ${leadsWithGroupName.length} leads with non-empty taalk_groupname out of ${allLeads.length} total`);
      
      // Show first 5 leads with groupnames (prioritizing hotleads)
      leadsWithGroupName.slice(0, 5).forEach((lead, i) => {
        const isHotlead = lead.id && lead.id.toString().startsWith('hotlead_');
        console.log(`Lead ${i+1} ${isHotlead ? '[HOTLEAD]' : ''}: ${lead.first_name} ${lead.last_name} - taalk_groupname: "${lead.taalk_groupname}" - market: ${lead.taalk_market}`);
      });
      
      // Apply FTC time zone compliance filtering
      const ftcCompliantLeads = allLeads.filter(lead => {
        const leadState = lead.taalk_state || lead.state;
        if (!leadState) {
          console.warn(`⚠️ Lead ${lead.id} has no state - skipping FTC check`);
          return true; // Allow leads without state info for now
        }
        
        const isPermissible = isCallPermissible(leadState);
        if (!isPermissible) {
          const nextCallTime = getNextCallableTime(leadState);
          console.log(`🚫 FTC: Skipping lead ${lead.id} in ${leadState} - next callable: ${nextCallTime}`);
        }
        
        return isPermissible;
      });
      
      console.log(`🕐 FTC Compliance: ${allLeads.length} total → ${ftcCompliantLeads.length} callable leads`);
      
      return ftcCompliantLeads as MasterLead[];
      
    } catch (error) {
      console.error(`❌ Failed to query masterlead table for ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Get market statistics from masterlead table ONLY
   */
  async getMarketStatsForUser(userEmail: string): Promise<any> {
    try {
      // Use the email as provided - no special handling needed
      let queryEmail = userEmail;
      
      const marketCounts = {
        masterlead: 0,
        globe_leads: 0, 
        plus_leads: 0,
        willkit_leads: 0,
        connectnow_leads: 0
      };

      // Query ONLY the masterlead table with cn_email
      const { data: stats, error } = await masterleadClient.from('masterlead')
        .select('taalk_market, taalk_lead_source')
        .eq('cn_email', queryEmail);

      if (error) {
        console.error(`Market stats query failed: ${error.message}`);
        throw new Error(`Market stats query failed: ${error.message}`);
      }

      console.log(`📊 Found ${stats?.length || 0} leads for market stats calculation`);

      stats?.forEach((lead: any) => {
        const market = (lead.taalk_market || lead.taalk_lead_source || '').toLowerCase();
        if (market.includes('veteran')) {
          marketCounts.masterlead++;
        } else if (market.includes('globe')) {
          marketCounts.globe_leads++;
        } else if (market.includes('plus')) {
          marketCounts.plus_leads++;
        } else if (market.includes('will') || market.includes('kit')) {
          marketCounts.willkit_leads++;
        } else if (market.includes('connectnow') || market.includes('connect')) {
          marketCounts.connectnow_leads++;
        } else {
          // No default category - only count leads that explicitly match a market type
          // This prevents incorrectly categorizing leads as veteran when they're not
        }
      });

      console.log(`📊 Masterleads market stats for ${userEmail} (${queryEmail}):`, marketCounts);
      return marketCounts;
      
    } catch (error) {
      console.error(`❌ Failed to get market stats from masterlead:`, error);
      throw error;
    }
  }
}

export const masterLeadsSync = new MasterLeadsSync();