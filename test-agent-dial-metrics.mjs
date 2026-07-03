// Test script to verify agent_dial_metrics table is working
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('🧪 Testing agent_dial_metrics insert...');
  
  const testData = {
    agent_email: 'test@example.com',
    lead_phone: '1234567890',
    event_type: 'dial',
    event_timestamp: new Date().toISOString(),
    source: 'test'
  };
  
  console.log('📝 Inserting test data:', testData);
  
  const { data, error } = await supabase
    .from('agent_dial_metrics')
    .insert(testData)
    .select();
  
  if (error) {
    console.error('❌ INSERT FAILED:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ INSERT SUCCESS:', data);
  }
  
  // Check if table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('agent_dial_metrics')
    .select('count')
    .limit(1);
  
  if (tableError) {
    console.error('❌ TABLE CHECK FAILED:', tableError);
    console.error('❌ This means the table does not exist or has wrong permissions!');
  } else {
    console.log('✅ Table exists and is accessible');
  }
}

testInsert().catch(console.error);

