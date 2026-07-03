import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://chjcwolkdwhpgapgvvby.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTaalk2CN() {
  try {
    console.log('🔍 Checking for Chris Lafond leads in Supabase Taalk2CN...');
    
    // Query Taalk2CN table specifically for Chris
    const { data, error } = await supabase
      .from('Taalk2CN')
      .select('*')
      .eq('CNEmail', 'chrislafond@aoglobelife.com')
      .limit(5);
    
    if (error) {
      console.log('❌ Supabase Taalk2CN query error:', error);
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);
    } else {
      console.log('✅ Supabase Taalk2CN query successful');
      console.log('Found', data?.length || 0, 'leads for Chris');
      if (data && data.length > 0) {
        console.log('Sample lead:', data[0]);
      }
    }
    
    // Also check total records in Taalk2CN
    const { data: allData, error: allError } = await supabase
      .from('Taalk2CN')
      .select('id, CNEmail')
      .limit(10);
      
    if (!allError && allData) {
      console.log('Total Taalk2CN records found:', allData.length);
      console.log('Sample records:', allData);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkTaalk2CN();