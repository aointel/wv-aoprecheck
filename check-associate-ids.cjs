/**
 * Simple check of what associate_ids are in the database
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkAssociateIds() {
  console.log('\n🔍 CHECKING ASSOCIATE IDS IN DATABASE');
  console.log('═'.repeat(70));
  
  try {
    // First, let's just get ALL columns from producers to see what exists
    const { data: sample, error: sampleError } = await supabase
      .from('producers')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error:', sampleError.message);
      return;
    }
    
    if (sample && sample.length > 0) {
      console.log('\n📋 Available columns in producers table:');
      console.log(Object.keys(sample[0]).join(', '));
      console.log('');
    }
    
    // Now try to get the agent data
    const { data: agents, error } = await supabase
      .from('producers')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('❌ Query error:', error.message);
      return;
    }
    
    console.log(`\n📊 Found ${agents.length} producers\n`);
    
    agents.slice(0, 5).forEach(agent => {
      console.log(`Agent: ${JSON.stringify(agent, null, 2)}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkAssociateIds();

