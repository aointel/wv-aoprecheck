import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://chjcwolkdwhpgapgvvby.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('Testing Supabase connection...');
console.log('Service key exists:', !!supabaseServiceKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('veteran_leads')
      .select('id')
      .limit(1);
    
    console.log('✅ Supabase connection working');
    console.log('Veteran leads test:', data?.length || 0, 'records');
    
    // Test Taalk2CN table existence
    const { data: taalkData, error: taalkError } = await supabase
      .from('Taalk2CN')
      .select('id')
      .limit(1);
    
    if (taalkError) {
      console.log('❌ Taalk2CN table error:', taalkError.code, taalkError.message);
    } else {
      console.log('✅ Taalk2CN table exists with', taalkData?.length || 0, 'records');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testConnection();