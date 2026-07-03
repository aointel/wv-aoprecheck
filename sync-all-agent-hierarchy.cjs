const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncAllAgentHierarchy() {
  console.log('🔄 Syncing ALL agents from producerlist to agent_hierarchy...\n');
  console.log('='.repeat(80));
  
  try {
    // Get ALL agents from producerlist
    const { data: allAgents, error: agentsError } = await supabase
      .from('producerlist')
      .select('agent_name, company_email, associate_id, mga, rga, aoi_market, ao_market_2, designated_market')
      .not('company_email', 'is', null)
      .not('company_email', 'eq', '');
    
    if (agentsError) {
      console.error('❌ Error fetching agents:', agentsError);
      return;
    }
    
    console.log(`📊 Found ${allAgents.length} total agents in producerlist\n`);
    
    // Get MGA/RGA directory for lookup
    const { data: directory, error: dirError } = await supabase
      .from('mga_rga_directory')
      .select('name, associate_id, email');
    
    const mgaLookup = new Map();
    const rgaLookup = new Map();
    
    if (directory) {
      directory.forEach(d => {
        mgaLookup.set(d.name.toUpperCase(), { id: d.associate_id, email: d.email });
        rgaLookup.set(d.name.toUpperCase(), { id: d.associate_id, email: d.email });
      });
    }
    
    console.log(`📊 MGA/RGA directory loaded: ${mgaLookup.size} entries\n`);
    
    // Process agents
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    console.log('📝 Processing agents...\n');
    
    for (let i = 0; i < allAgents.length; i++) {
      const agent = allAgents[i];
      
      if ((i + 1) % 50 === 0) {
        console.log(`   Progress: ${i + 1}/${allAgents.length} agents processed...`);
      }
      
      // Skip if no valid MGA
      if (!agent.mga || agent.mga === '0') {
        skippedCount++;
        continue;
      }
      
      // Look up MGA associate ID
      const mgaInfo = mgaLookup.get(agent.mga.toUpperCase());
      const mgaAssociateId = mgaInfo?.id || null;
      
      // Look up RGA associate ID
      let rgaAssociateId = null;
      if (agent.rga && agent.rga !== '0') {
        const rgaInfo = rgaLookup.get(agent.rga.toUpperCase());
        rgaAssociateId = rgaInfo?.id || null;
      }
      
      const record = {
        agent_email: agent.company_email.toLowerCase(),
        agent_name: agent.agent_name,
        agent_associate_id: agent.associate_id,
        mga_name: agent.mga && agent.mga !== '0' ? agent.mga : null,
        mga_associate_id: mgaAssociateId,
        rga_name: agent.rga && agent.rga !== '0' ? agent.rga : null,
        rga_associate_id: rgaAssociateId,
        aoi_market: agent.aoi_market || null,
        ao_market_2: agent.ao_market_2 || null,
        designated_market: agent.designated_market || null
      };
      
      // Check if exists
      const { data: existing } = await supabase
        .from('agent_hierarchy')
        .select('id')
        .eq('agent_email', record.agent_email)
        .maybeSingle();
      
      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from('agent_hierarchy')
          .update(record)
          .eq('agent_email', record.agent_email);
        
        if (!updateError) {
          successCount++;
        } else {
          console.error(`   ❌ Error updating ${record.agent_email}:`, updateError.message);
          errorCount++;
        }
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('agent_hierarchy')
          .insert(record);
        
        if (!insertError) {
          successCount++;
        } else {
          console.error(`   ❌ Error inserting ${record.agent_email}:`, insertError.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SYNC COMPLETE!\n');
    console.log(`   ✅ Successfully synced: ${successCount} agents`);
    console.log(`   ❌ Errors: ${errorCount} agents`);
    console.log(`   ⏭️  Skipped (no MGA): ${skippedCount} agents`);
    console.log(`   📊 Total processed: ${allAgents.length} agents\n`);
    
    // Verify final count
    const { data: finalCount } = await supabase
      .from('agent_hierarchy')
      .select('id', { count: 'exact', head: true });
    
    console.log(`✅ Total records in agent_hierarchy: ${finalCount || 0}\n`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

syncAllAgentHierarchy();
