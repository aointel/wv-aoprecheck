import cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import fetch from 'node-fetch';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

class TaalkCampaignSyncScheduler {
  private static instance: TaalkCampaignSyncScheduler;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  static getInstance(): TaalkCampaignSyncScheduler {
    if (!TaalkCampaignSyncScheduler.instance) {
      TaalkCampaignSyncScheduler.instance = new TaalkCampaignSyncScheduler();
    }
    return TaalkCampaignSyncScheduler.instance;
  }

  start(): void {
    if (this.isRunning) {
      console.log('🔄 Taalk campaign sync scheduler already running');
      return;
    }

    // Run once daily at 3 AM (campaigns don't change often)
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      await this.syncCampaigns();
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    this.isRunning = true;
    console.log('✅ Taalk campaign sync scheduler started - syncing daily at 3 AM ET');

    // Run initial sync after 30 seconds on startup
    setTimeout(() => {
      this.syncCampaigns();
    }, 30000);
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Taalk campaign sync scheduler stopped');
  }

  private async syncCampaigns(): Promise<void> {
    console.log('📡 Syncing Taalk campaigns from API to Supabase...');
    
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase client not initialized');
        return;
      }

      // Fetch ALL campaigns from Taalk API (with pagination)
      let allCampaigns = [];
      let page = 1;
      let totalPages = 1;
      
      do {
        const response = await fetch(`https://api.taalk.ai/api/campaign2s?db=michaelmandella&page=${page}&limit=100`, {
          headers: {
            'Authorization': `Bearer ${TAALK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`❌ Taalk API error on page ${page}: ${response.status}`);
          break;
        }
        
        const response_data = await response.json();
        const campaigns = response_data.payload || [];
        const total = response_data.total || 0;
        
        allCampaigns = allCampaigns.concat(campaigns);
        
        // Taalk returns 20 per page
        const itemsPerPage = campaigns.length || 20;
        totalPages = Math.ceil(total / itemsPerPage);
        
        page++;
        
        // Avoid rate limiting
        if (page <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } while (page <= totalPages && page <= 15); // Safety cap at 15 pages (300 campaigns)
      
      if (allCampaigns.length === 0) {
        console.log('⚠️  No campaigns fetched from Taalk');
        return;
      }
      
      console.log(`✅ Fetched ${allCampaigns.length} campaigns from Taalk API`);
      
      // Upsert campaigns to Supabase
      let synced = 0;
      let errors = 0;
      
      for (const campaign of allCampaigns) {
        try {
          const campaignId = campaign._id || campaign.id;
          
          if (!campaignId) {
            errors++;
            continue;
          }
          
          const campaignData = {
            id: campaignId,
            name: campaign.name || 'Unnamed Campaign',
            description: campaign.desc || null,
            status: 'active', // Taalk doesn't have explicit status
            persona_id: campaign.persona || null,
            script_id: campaign.script || null,
            campaign_type: campaign.type === 0 ? 'inbound' : campaign.type === 1 ? 'outbound' : 'unknown',
            total_agents: 0,
            active_agents: 0,
            total_calls: campaign.contactCount || 0,
            taalk_data: campaign,
            last_synced_at: new Date().toISOString()
          };
          
          const { error } = await supabaseAdmin
            .from('taalk_campaigns')
            .upsert(campaignData, {
              onConflict: 'id'
            });
          
          if (error) {
            console.error(`❌ Error syncing ${campaign.name}:`, error.message);
            errors++;
          } else {
            synced++;
          }
          
        } catch (err: any) {
          console.error('❌ Error processing campaign:', err.message);
          errors++;
        }
      }
      
      console.log(`📊 Campaign sync: ${synced} synced, ${errors} errors`);
      
    } catch (error: any) {
      console.error('❌ Campaign sync error:', error.message);
    }
  }
}

export const taalkCampaignSyncScheduler = TaalkCampaignSyncScheduler.getInstance();

