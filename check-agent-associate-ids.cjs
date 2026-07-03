/**
 * Check if agents have associate_id in customers table
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkAgentAssociateIDs() {
  console.log('\n🔍 CHECKING AGENT ASSOCIATE IDs\n');
  console.log('='.repeat(60));

  try {
    // Get all agents from customers table
    const { data: agents, error } = await supabase
      .from('customers')
      .select('company_email, associate_id')
      .ilike('company_email', '%@aoglobelife.com')
      .order('company_email', { ascending: true });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`\n📋 Found ${agents?.length || 0} agents\n`);

    let withAssociateId = 0;
    let withoutAssociateId = 0;

    // Currently hardcoded mappings
    const hardcodedMappings = {
      'martintoma@aoglobelife.com': '1253',
      'cnsysop@aoglobelife.com': '1253',
      'davidfulfer@aoglobelife.com': '124235'
    };

    for (const agent of agents || []) {
      const hasAssociateId = agent.associate_id && agent.associate_id !== '';
      const isHardcoded = !!hardcodedMappings[agent.company_email];
      
      if (hasAssociateId) {
        withAssociateId++;
      } else {
        withoutAssociateId++;
      }

      const status = hasAssociateId ? '✅' : '❌';
      console.log(`${status} ${agent.company_email}`);
      console.log(`   Associate ID: ${agent.associate_id || 'NONE'}`);
      
      if (isHardcoded) {
        console.log(`   🔧 Hardcoded in scheduler: "${hardcodedMappings[agent.company_email]}"`);
        if (agent.associate_id && agent.associate_id !== hardcodedMappings[agent.company_email]) {
          console.log(`   ⚠️  MISMATCH! Database has "${agent.associate_id}" but code uses "${hardcodedMappings[agent.company_email]}"`);
        }
      } else if (!hasAssociateId) {
        console.log(`   ⚠️  Will default to "999" in webhook!`);
      }
      
      console.log('');
    }

    console.log('='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   With Associate ID: ${withAssociateId}`);
    console.log(`   Without Associate ID: ${withoutAssociateId}`);
    console.log(`   Hardcoded Mappings: ${Object.keys(hardcodedMappings).length}`);
    
    console.log(`\n💡 RECOMMENDATION:`);
    if (withoutAssociateId > 0) {
      console.log(`   ${withoutAssociateId} agents are missing associate_id!`);
      console.log(`   They will get "999" in webhooks, which may not assign leads correctly.`);
      console.log(`   Update customers table with their real associate_id from Planet ALTIG.`);
    } else {
      console.log(`   All agents have associate_id in database!`);
      console.log(`   Update scheduler to use database associate_id instead of hardcoded values.`);
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkAgentAssociateIDs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

