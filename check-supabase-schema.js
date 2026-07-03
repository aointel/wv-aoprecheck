import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHotleadsSchema() {
  console.log('Checking Supabase hotleads table schema...');
  
  // Try a simple insert to see what columns are accepted
  const testData = {
    first_name: 'Test',
    last_name: 'Schema',
    phone: '+1234567890',
    duration_seconds: 60,
    hot_lead_reason: 'Schema Test',
    priority_score: 5,
    transferred: false,
    taalk_call_id: 'schema_test_' + Date.now(),
    status: 'NEW'
  };
  
  const { data, error } = await supabase
    .from('hotleads')
    .insert([testData])
    .select();
    
  if (error) {
    console.error('Schema test error:', error);
  } else {
    console.log('Schema test successful. Columns accepted:', Object.keys(data[0]));
    
    // Clean up
    await supabase
      .from('hotleads')
      .delete()
      .eq('taalk_call_id', testData.taalk_call_id);
  }
}

checkHotleadsSchema();