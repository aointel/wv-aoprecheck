import { masterleadClient } from "./local-masterlead-client";

export interface MasterLead {
  id?: string;
  cn_email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
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
  
  async getLeadsForUser(userEmail: string): Promise<MasterLead[]> {
    console.log(`🔎 Querying masterlead (Postgres) for ${userEmail}`);
    
    try {
      // Get ALL leads for user - no limit
      let allLeads: any[] = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        console.log(`📊 Fetching batch starting at ${from}...`);
        // For system operators, allow them to see both assigned leads and unassigned leads
        let query = masterleadClient.from('masterlead')
          .select('*')
          .eq('cnresolution', 'pending')  // Only pending leads
          .eq('cn_email', userEmail)  // Only leads they own
          .or('TaalkResolve.is.null,TaalkResolve.eq.false');  // Exclude TaalkResolve=true leads (frozen)
        
        const { data: batchLeads, error: batchError } = await query
          .order('id', { ascending: true })  // Simple ID sort for consistency
          .range(from, from + batchSize - 1);
        
        if (batchError) {
          console.error(`❌ Supabase batch error:`, batchError);
          throw batchError;
        }
        
        if (!batchLeads || batchLeads.length === 0) {
          console.log(`📊 No more leads found - stopping at ${allLeads.length} total`);
          break; // No more leads
        }
        
        allLeads.push(...batchLeads);
        console.log(`📊 Loaded batch ${Math.floor(from/batchSize) + 1}: ${batchLeads.length} leads (${allLeads.length} total so far)`);
        
        if (batchLeads.length < batchSize) {
          console.log(`📊 Last batch was partial (${batchLeads.length} < ${batchSize}) - done with ${allLeads.length} total leads`);
          break; // Last batch was partial, we're done
        }
        
        from += batchSize;
      }
      
      const masterLeads = allLeads;
      const masterError = null;

      if (masterError) {
        console.error(`❌ Supabase error:`, masterError);
        throw masterError;
      }

      if (!masterLeads || masterLeads.length === 0) {
        console.log(`📭 No leads found for ${userEmail}`);
        return [];
      }

      console.log(`✅ Found ${masterLeads.length} leads for ${userEmail}`);
      return masterLeads as MasterLead[];
      
    } catch (error) {
      console.error(`❌ Query failed for ${userEmail}:`, error);
      throw error;
    }
  }
}