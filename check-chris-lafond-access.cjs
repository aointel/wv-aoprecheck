const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkChrisLafond() {
  console.log('🔍 Checking Chris Lafond access...\n');
  console.log('='.repeat(80));
  
  try {
    // 1. Check mga_rga_directory for Chris's role
    const { data: directory, error: dirError } = await supabase
      .from('mga_rga_directory')
      .select('*')
      .eq('email', 'chrislafond@aoglobelife.com')
      .maybeSingle();
    
    console.log('\n📋 Chris Lafond in mga_rga_directory:');
    if (directory) {
      console.log(`   Name: ${directory.name}`);
      console.log(`   Associate ID: ${directory.associate_id}`);
      console.log(`   Role: ${directory.role}`);
      console.log(`   Email: ${directory.email}`);
    } else {
      console.log('   ❌ NOT FOUND in mga_rga_directory!');
    }
    
    // 2. Check agent_hierarchy for agents under Chris
    const { data: agents, error: agentsError } = await supabase
      .from('agent_hierarchy')
      .select('*')
      .or(`mga_email.eq.chrislafond@aoglobelife.com,rga_email.eq.chrislafond@aoglobelife.com`);
    
    console.log(`\n👥 Agents under Chris Lafond in agent_hierarchy: ${agents?.length || 0}`);
    
    if (agents && agents.length > 0) {
      console.log('\n   Agent list:');
      agents.forEach(a => {
        console.log(`   - ${a.agent_name} (${a.agent_email})`);
        console.log(`     Associate ID: ${a.agent_associate_id}`);
        console.log(`     MGA: ${a.mga_name} (${a.mga_email})`);
        console.log(`     RGA: ${a.rga_name} (${a.rga_email})`);
        console.log();
      });
    } else {
      console.log('   ❌ NO AGENTS FOUND under Chris Lafond!');
    }
    
    // 3. Check if Chris is in agent_hierarchy as MGA/RGA
    const { data: hierarchy, error: hierError } = await supabase
      .from('agent_hierarchy')
      .select('*')
      .eq('agent_email', 'chrislafond@aoglobelife.com')
      .maybeSingle();
    
    console.log('\n📊 Chris Lafond in agent_hierarchy (as agent):');
    if (hierarchy) {
      console.log(`   Name: ${hierarchy.agent_name}`);
      console.log(`   Associate ID: ${hierarchy.agent_associate_id}`);
      console.log(`   MGA: ${hierarchy.mga_name} (ID: ${hierarchy.mga_associate_id})`);
      console.log(`   RGA: ${hierarchy.rga_name} (ID: ${hierarchy.rga_associate_id})`);
    } else {
      console.log('   ❌ NOT FOUND as agent in hierarchy');
    }
    
    // 4. Check Producer List for Chris's MGA team
    const { data: producers, error: prodError } = await supabase
      .from('producerlist')
      .select('*')
      .eq('company_email', 'chrislafond@aoglobelife.com')
      .maybeSingle();
    
    console.log('\n📋 Chris Lafond in producerlist:');
    if (producers) {
      console.log(`   Name: ${producers.agent_name}`);
      console.log(`   Associate ID: ${producers.associate_id}`);
      console.log(`   MGA: ${producers.mga}`);
      console.log(`   RGA: ${producers.rga}`);
    }
    
    // 5. Find all agents with Chris's name as MGA in producerlist
    if (producers && producers.agent_name) {
      const mgaName = producers.agent_name.toUpperCase();
      
      const { data: mgaAgents, error: mgaError } = await supabase
        .from('producerlist')
        .select('agent_name, company_email, associate_id')
        .eq('mga', mgaName);
      
      console.log(`\n👥 Agents with "${mgaName}" as MGA in producerlist: ${mgaAgents?.length || 0}`);
      
      if (mgaAgents && mgaAgents.length > 0) {
        mgaAgents.slice(0, 10).forEach(a => {
          console.log(`   - ${a.agent_name} (${a.company_email}) - ID: ${a.associate_id}`);
        });
        
        if (mgaAgents.length > 10) {
          console.log(`   ... and ${mgaAgents.length - 10} more`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n💡 DIAGNOSIS:');
    
    if (!directory || directory.role !== 'MGA' && directory.role !== 'BOTH') {
      console.log('❌ Chris is NOT listed as MGA in mga_rga_directory');
      console.log('   He needs to be added with role="MGA" or "BOTH"');
    }
    
    if (!agents || agents.length === 0) {
      console.log('❌ No agents linked to Chris in agent_hierarchy');
      console.log('   The agent_hierarchy table needs to be populated with his team');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkChrisLafond();






