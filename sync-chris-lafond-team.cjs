const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncChrisTeam() {
  console.log('🔄 Syncing Chris Lafond team to agent_hierarchy...\n');
  
  try {
    // Get all agents under Chris from producerlist
    const { data: agents, error } = await supabase
      .from('producerlist')
      .select('agent_name, company_email, associate_id, rga')
      .eq('mga', 'CHRISTOPHER LAFOND')
      .not('company_email', 'is', null);
    
    console.log(`📊 Found ${agents?.length || 0} agents under CHRISTOPHER LAFOND\n`);
    
    if (!agents || agents.length === 0) {
      console.log('❌ No agents found!');
      return;
    }
    
    // Insert into agent_hierarchy
    const hierarchyRecords = agents.map(a => ({
      agent_email: a.company_email.toLowerCase(),
      agent_name: a.agent_name,
      agent_associate_id: a.associate_id,
      mga_name: 'CHRISTOPHER LAFOND',
      mga_associate_id: 409,
      rga_name: a.rga && a.rga !== '0' ? a.rga : null,
      rga_associate_id: null // Don't have RGA IDs
    }));
    
    console.log('📝 Inserting records into agent_hierarchy...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of hierarchyRecords) {
      // Check if agent already exists
      const { data: existing } = await supabase
        .from('agent_hierarchy')
        .select('id')
        .eq('agent_email', record.agent_email)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('agent_hierarchy')
          .update(record)
          .eq('agent_email', record.agent_email);
        
        if (!updateError) {
          successCount++;
        } else {
          errorCount++;
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('agent_hierarchy')
          .insert(record);
        
        if (!insertError) {
          successCount++;
        } else {
          errorCount++;
        }
      }
    }
    
    console.log(`✅ Successfully synced ${successCount} agents!`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} errors\n`);
    } else {
      console.log();
    }
    
    // Verify
    const { data: verify, error: verifyError } = await supabase
      .from('agent_hierarchy')
      .select('agent_name, agent_email')
      .eq('mga_associate_id', 409);
    
    console.log(`📊 Verification: ${verify?.length || 0} agents now under Chris Lafond in agent_hierarchy\n`);
    
    if (verify && verify.length > 0) {
      console.log('Sample agents:');
      verify.slice(0, 5).forEach(a => {
        console.log(`   - ${a.agent_name} (${a.agent_email})`);
      });
      
      if (verify.length > 5) {
        console.log(`   ... and ${verify.length - 5} more`);
      }
    }
    
    console.log('\n✅ Chris Lafond can now see his team on Live Call Board!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

syncChrisTeam();

