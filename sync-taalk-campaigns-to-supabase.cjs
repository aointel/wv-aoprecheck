/**
 * Fetch all campaigns from Taalk API and sync to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Supabase
const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function syncCampaigns() {
  console.log('\n🚀 SYNCING TAALK CAMPAIGNS TO SUPABASE');
  console.log('═'.repeat(70));
  
  try {
    // 1. Fetch ALL campaigns from Taalk API (handle pagination)
    console.log('\n📥 Fetching campaigns from Taalk API...');
    
    let allCampaigns = [];
    let page = 1;
    let totalPages = 1;
    
    do {
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await fetch(`https://api.taalk.ai/api/campaign2s?db=michaelmandella&page=${page}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${TAALK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ Taalk API returned ${response.status}`);
        const text = await response.text();
        console.error('Response:', text);
        break;
      }
      
      const response_data = await response.json();
      const campaigns = response_data.payload || [];
      const total = response_data.total || 0;
      
      allCampaigns = allCampaigns.concat(campaigns);
      
      // Taalk returns 20 per page regardless of limit param
      const itemsPerPage = campaigns.length || 20;
      totalPages = Math.ceil(total / itemsPerPage);
      
      console.log(`   ✅ Page ${page}: ${campaigns.length} campaigns (${allCampaigns.length}/${total} total)`);
      
      page++;
    } while (page <= totalPages);
    
    console.log(`\n✅ Fetched ${allCampaigns.length} campaigns from Taalk API`);
    
    // Taalk returns { payload: [...], total: 240 }
    const campaigns = allCampaigns;
    
    if (campaigns.length > 0) {
      console.log(`📋 Found ${campaigns.length} campaigns in payload`);
      console.log('\n📄 Sample campaign:');
      console.log(`   Name: ${campaigns[0].name}`);
      console.log(`   ID: ${campaigns[0]._id}`);
      console.log(`   Type: ${campaigns[0].type}`);
      console.log(`   Contacts: ${campaigns[0].contactCount}`);
    } else {
      console.log('⚠️  No campaigns in payload');
    }
    
    // 2. Transform and upsert to Supabase
    const campaignsToSync = campaigns;
    
    if (campaignsToSync.length === 0) {
      console.log('\n⚠️  No campaigns found in response');
      return;
    }
    
    console.log(`\n🔄 Syncing ${campaignsToSync.length} campaigns to Supabase...`);
    console.log('═'.repeat(70));
    
    let synced = 0;
    let errors = 0;
    
    for (const campaign of campaignsToSync) {
      try {
        const campaignId = campaign._id || campaign.id;
        
        if (!campaignId) {
          console.warn('⚠️  Skipping campaign without ID:', campaign);
          errors++;
          continue;
        }
        
        const campaignData = {
          id: campaignId,
          name: campaign.name || 'Unnamed Campaign',
          description: campaign.description || null,
          status: campaign.status || 'active',
          persona_id: campaign.persona || campaign.personaId || null,
          script_id: campaign.script || campaign.scriptId || null,
          campaign_type: campaign.type || 'VDP',
          total_agents: 0, // Will calculate from agent_profiles
          active_agents: 0, // Will calculate from agent_profiles
          total_calls: 0, // Will calculate from vdp_calls
          taalk_data: campaign, // Store full Taalk response
          last_synced_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('taalk_campaigns')
          .upsert(campaignData, {
            onConflict: 'id'
          });
        
        if (error) {
          console.error(`❌ Error syncing campaign ${campaignId}:`, error);
          errors++;
        } else {
          synced++;
          console.log(`✅ ${campaignData.name} (${campaignId})`);
        }
        
      } catch (err) {
        console.error('❌ Error processing campaign:', err);
        errors++;
      }
    }
    
    // 3. Calculate stats from our database
    console.log('\n📊 Calculating campaign stats from database...');
    
    const { data: syncedCampaigns } = await supabase
      .from('taalk_campaigns')
      .select('id');
    
    if (syncedCampaigns) {
      for (const campaign of syncedCampaigns) {
        // Count agents using this campaign
        const { count: agentCount } = await supabase
          .from('agent_profiles')
          .select('*', { count: 'exact', head: true })
          .contains('market', [campaign.id])
          .eq('VDPACTIVE', 'ACTIVE');
        
        // Count total calls for this campaign (from vdp_calls)
        const { count: callCount } = await supabase
          .from('vdp_calls')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
        
        // Update stats
        await supabase
          .from('taalk_campaigns')
          .update({
            total_agents: agentCount || 0,
            active_agents: agentCount || 0,
            total_calls: callCount || 0
          })
          .eq('id', campaign.id);
      }
    }
    
    // 4. Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 CAMPAIGN SYNC COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n✅ Synced: ${synced} campaigns`);
    console.log(`❌ Errors: ${errors}`);
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run
syncCampaigns().then(() => {
  console.log('✅ Sync complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

