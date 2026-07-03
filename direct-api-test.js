// Direct test of Supabase analytics system
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function directSupabaseTest() {
  console.log('🧪 DIRECT SUPABASE TEST - bypassing server\n');
  
  try {
    // Connect to Supabase directly
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials not found in environment');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('📊 Querying twilio_call_logs table directly...');
    
    // Get today's date for filtering
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    console.log(`🔍 Querying calls from ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
    
    // Query the table
    const { data: calls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', todayStart.toISOString())
      .lte('call_started_at', todayEnd.toISOString());
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return;
    }
    
    console.log(`📞 Found ${calls?.length || 0} calls in twilio_call_logs for today`);
    
    if (calls?.length > 0) {
      console.log('\n📋 Call breakdown:');
      const agentCounts = {};
      calls.forEach(call => {
        const owner = call.owner_email || 'unknown';
        agentCounts[owner] = (agentCounts[owner] || 0) + 1;
      });
      
      Object.entries(agentCounts).forEach(([agent, count]) => {
        console.log(`   ${agent}: ${count} calls`);
      });
    } else {
      console.log('✅ Confirmed: twilio_call_logs table is EMPTY for today');
      console.log('🎯 This means Chris LaFond should show 0 calls when using Supabase-only data');
    }
    
    // Also check total records
    const { data: allCalls, error: allError } = await supabase
      .from('twilio_call_logs')
      .select('*', { count: 'exact' });
    
    if (!allError) {
      console.log(`📊 Total records in twilio_call_logs: ${allCalls?.length || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Direct test failed:', error);
  }
}

directSupabaseTest();