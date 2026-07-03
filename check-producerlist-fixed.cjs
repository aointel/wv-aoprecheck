/**
 * Check PRODUCERLIST table with correct columns
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkProducerlist() {
  console.log('\n🔍 CHECKING PRODUCERLIST FOR LEYNA');
  console.log('═'.repeat(70));
  
  try {
    // Search by company_email (not email)
    const { data: leyna, error } = await supabase
      .from('producerlist')
      .select('*')
      .or('company_email.ilike.%leynatran%,personal_email.ilike.%leynatran%,agent_name.ilike.%LEYNA%');
    
    if (error) {
      console.error('❌ Query error:', error.message);
      return;
    }
    
    console.log(`\n📊 Found ${leyna.length} records for Leyna\n`);
    
    if (leyna.length === 0) {
      console.log('❌ NO RECORDS FOUND FOR LEYNA IN PRODUCERLIST!');
      console.log('   This is why WebRTC is failing!');
    } else {
      leyna.forEach(record => {
        console.log('LEYNA\'S RECORD:');
        console.log(JSON.stringify(record, null, 2));
        console.log('');
      });
    }
    
    // Compare with cnsysop
    console.log('\n🔍 Comparing with CNSYSOP (working account):\n');
    
    const { data: cnsysop } = await supabase
      .from('producerlist')
      .select('*')
      .or('company_email.ilike.%cnsysop%,agent_name.ilike.%SYSOP%')
      .limit(2);
    
    if (cnsysop && cnsysop.length > 0) {
      console.log('CNSYSOP RECORD:');
      cnsysop.forEach(w => {
        console.log(JSON.stringify(w, null, 2));
        console.log('');
      });
    } else {
      console.log('❌ NO CNSYSOP FOUND EITHER');
    }
    
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkProducerlist();

