import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    // List all tables
    console.log('🔍 Listing all tables...');
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_names');
    
    if (tablesError) {
      console.log('❌ Failed to get tables via RPC, trying alternative method...');
      
      // Try to query a known table that should exist
      const { data: testData, error: testError } = await supabase
        .from('customers')
        .select('*')
        .limit(1);
        
      if (testError) {
        console.log('❌ Test query failed:', testError.message);
      } else {
        console.log('✅ Supabase connection working - found customers table');
      }
      
      // Try to find any leads-related tables
      const possibleTables = ['masterleads', 'veteran_leads', 'leads', 'outbound_leads', 'Taalk2CN'];
      
      for (const tableName of possibleTables) {
        console.log(`🔍 Testing table: ${tableName}`);
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Found table with ${data ? data.length : 0} sample records`);
          if (data && data.length > 0) {
            console.log(`📋 Sample record from ${tableName}:`, Object.keys(data[0]));
          }
        }
      }
    } else {
      console.log('✅ Found tables:', tables);
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testConnection();