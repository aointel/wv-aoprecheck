import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function checkCustomersTable() {
  console.log('🔍 Checking Supabase customers table...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // First, check what fields exist in customers table
    const { data: sample, error: sampleError } = await supabase
      .from('customers')
      .select('*')
      .limit(3);
      
    if (sampleError) {
      console.log('❌ Sample query error:', sampleError);
      return;
    }
    
    if (sample && sample.length > 0) {
      console.log('📋 Customers table fields:', Object.keys(sample[0]));
      console.log('📊 Sample record:', sample[0]);
    }
    
    // Query customers table for our test users (using correct field)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .limit(10);
      
    if (error) {
      console.log('❌ Supabase query error:', error);
      return;
    }
    
    console.log('✅ Found customers:', data);
    
    if (data && data.length > 0) {
      console.log('📋 Customer fields:', Object.keys(data[0]));
      data.forEach(customer => {
        console.log(`👤 ${customer.email}: Associate ID = ${customer.associate_id || 'NULL'}`);
      });
    }
    
    // Search for users by looking for emails in any text fields
    const { data: searchData, error: searchError } = await supabase
      .from('customers')
      .select('*')
      .or('id.ilike.%cnsysop%,id.ilike.%martin%,name.ilike.%michael%,name.ilike.%martin%');
    
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

checkCustomersTable();