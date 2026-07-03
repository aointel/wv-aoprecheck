/**
 * Check CUSTOMERS table for Leyna
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkCustomers() {
  console.log('\n🔍 CHECKING CUSTOMERS TABLE');
  console.log('═'.repeat(70));
  
  try {
    // Get column names first
    const { data: sample, error: sampleError } = await supabase
      .from('customers')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error:', sampleError.message);
      return;
    }
    
    if (sample && sample.length > 0) {
      console.log('\n📋 Available columns in customers:');
      console.log(Object.keys(sample[0]).join(', '));
      console.log('');
    }
    
    // Search for Leyna
    const { data: leyna, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('email', '%leynatran%');
    
    if (error) {
      console.error('❌ Query error:', error.message);
      return;
    }
    
    console.log(`\n📊 LEYNA IN CUSTOMERS: ${leyna.length} records\n`);
    
    if (leyna.length === 0) {
      console.log('❌ LEYNA NOT IN CUSTOMERS TABLE!');
    } else {
      leyna.forEach(record => {
        console.log('LEYNA\'S CUSTOMER RECORD:');
        console.log(JSON.stringify(record, null, 2));
        console.log('');
      });
    }
    
    // Get cnsysop for comparison
    console.log('═'.repeat(70));
    console.log('🔍 COMPARING WITH CNSYSOP:\n');
    
    const { data: cnsysop } = await supabase
      .from('customers')
      .select('*')
      .ilike('email', '%cnsysop%');
    
    console.log(`\n📊 CNSYSOP IN CUSTOMERS: ${cnsysop?.length || 0} records\n`);
    
    if (cnsysop && cnsysop.length > 0) {
      cnsysop.forEach(record => {
        console.log('CNSYSOP CUSTOMER RECORD:');
        console.log(JSON.stringify(record, null, 2));
        console.log('');
      });
    } else {
      console.log('❌ CNSYSOP NOT IN CUSTOMERS EITHER');
    }
    
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkCustomers();

