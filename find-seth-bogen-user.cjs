const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findSethBogen() {
  console.log('🔍 Looking for Seth Bogen in the system...\n');
  
  try {
    // Check auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authUser) {
      const sethAuth = authUser.users.find(u => 
        u.email && u.email.toLowerCase().includes('seth') && u.email.toLowerCase().includes('bogen')
      );
      
      if (sethAuth) {
        console.log('✅ Found in auth.users:');
        console.log(`   Email: ${sethAuth.email}`);
        console.log(`   ID: ${sethAuth.id}`);
        console.log(`   Created: ${sethAuth.created_at}\n`);
      } else {
        console.log('❌ Not found in auth.users\n');
      }
    }
    
    // Check customers table
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('*')
      .or('company_email.ilike.%seth%bogen%,personal_email.ilike.%seth%bogen%,first_name.ilike.%seth%,last_name.ilike.%bogen%');
    
    if (customers && customers.length > 0) {
      console.log('✅ Found in customers table:');
      customers.forEach(c => {
        console.log(`   Name: ${c.first_name} ${c.last_name}`);
        console.log(`   Email: ${c.company_email}`);
        console.log(`   Associate ID: ${c.associate_id}`);
        console.log();
      });
    } else {
      console.log('❌ Not found in customers table\n');
    }
    
    // Check if there are ANY calls in twilio_call_logs (to verify table works)
    const { data: anyCalls, error: callsError } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, count')
      .limit(5);
    
    console.log('\n📊 Sample of twilio_call_logs table:');
    if (anyCalls && anyCalls.length > 0) {
      console.log(`   ✅ Table has data (${anyCalls.length} sample records)`);
      console.log('   Recent owner emails:');
      anyCalls.forEach(c => console.log(`     - ${c.owner_email}`));
    } else {
      console.log('   ⚠️  Table is EMPTY - calls not being logged!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findSethBogen();






