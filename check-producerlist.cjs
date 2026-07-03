/**
 * Check PRODUCERLIST table (not producers)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkProducerlist() {
  console.log('\n🔍 CHECKING PRODUCERLIST TABLE');
  console.log('═'.repeat(70));
  
  try {
    // First get column names
    const { data: sample, error: sampleError } = await supabase
      .from('producerlist')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error:', sampleError.message);
      return;
    }
    
    if (sample && sample.length > 0) {
      console.log('\n📋 Available columns in producerlist:');
      console.log(Object.keys(sample[0]).join(', '));
      console.log('');
    }
    
    // Now search for Leyna
    const { data: leyna, error } = await supabase
      .from('producerlist')
      .select('*')
      .or('mga.ilike.%LEYNA%,rga.ilike.%LEYNA%,email.ilike.%leynatran%');
    
    if (error) {
      console.error('❌ Query error:', error.message);
      return;
    }
    
    console.log(`\n📊 Found ${leyna.length} records for Leyna\n`);
    
    if (leyna.length === 0) {
      console.log('❌ NO RECORDS FOUND FOR LEYNA IN PRODUCERLIST!');
    } else {
      leyna.forEach(record => {
        console.log(JSON.stringify(record, null, 2));
        console.log('---');
      });
    }
    
    // Also check for working agents
    console.log('\n🔍 Comparing with working agents:\n');
    
    const { data: working } = await supabase
      .from('producerlist')
      .select('*')
      .or('email.ilike.%cnsysop%,email.ilike.%chrislafond%')
      .limit(5);
    
    if (working && working.length > 0) {
      console.log('📋 Sample working agent records:');
      working.forEach(w => {
        console.log(JSON.stringify(w, null, 2));
        console.log('---');
      });
    }
    
    console.log('\n' + '═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkProducerlist();

