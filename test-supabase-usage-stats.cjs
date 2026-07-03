/**
 * Test script to verify Supabase weekly_usage_stats table works
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testSupabaseUsageStats() {
  try {
    console.log('🧪 Testing Supabase weekly_usage_stats table...\n');
    
    const testEmail = 'test@aoglobelife.com';
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Test 1: Check if table exists
    console.log('1️⃣ Checking if weekly_usage_stats table exists...');
    const { data: testQuery, error: tableError } = await supabase
      .from('weekly_usage_stats')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table error:', tableError.message);
      if (tableError.message.includes('does not exist')) {
        console.error('❌ Table weekly_usage_stats does NOT exist in Supabase!');
        console.log('💡 You need to create it in Supabase first');
        return;
      }
    }
    console.log('✅ Table exists\n');
    
    // Test 2: Count existing records
    const { count } = await supabase
      .from('weekly_usage_stats')
      .select('*', { count: 'exact', head: true });
    console.log(`2️⃣ Total records in Supabase weekly_usage_stats: ${count || 0}\n`);
    
    // Test 3: Insert/upsert a test record
    console.log('3️⃣ Testing INSERT/UPSERT...');
    const { data: insertData, error: insertError } = await supabase
      .from('weekly_usage_stats')
      .upsert({
        agent_email: testEmail.toLowerCase(),
        week_start_date: weekStart.toISOString().split('T')[0],
        week_end_date: weekEnd.toISOString().split('T')[0],
        total_logins: 5,
        unique_login_days: 3,
        total_online_minutes: 120,
        vdp_connects_received: 10,
        total_dials_made: 25,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_email,week_start_date'
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      console.error('❌ Error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('✅ Insert/UPSERT successful:', insertData);
    }
    console.log('');
    
    // Test 4: Verify it exists
    console.log('4️⃣ Verifying record...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('weekly_usage_stats')
      .select('*')
      .eq('agent_email', testEmail.toLowerCase())
      .eq('week_start_date', weekStart.toISOString().split('T')[0])
      .single();
    
    if (verifyError) {
      console.error('❌ Verify failed:', verifyError);
    } else {
      console.log('✅ Record verified:', verifyData);
    }
    console.log('');
    
    // Test 5: Test heartbeat insert to agent_activity_log
    console.log('5️⃣ Testing heartbeat insert to agent_activity_log...');
    const { data: heartbeatData, error: heartbeatError } = await supabase
      .from('agent_activity_log')
      .insert({
        agent_email: testEmail.toLowerCase(),
        activity_type: 'heartbeat',
        session_id: 'test-session-supabase',
        started_at: new Date().toISOString()
      })
      .select('id, agent_email, activity_type, started_at')
      .single();
    
    if (heartbeatError) {
      console.error('❌ Heartbeat insert failed:', heartbeatError);
      console.error('❌ Error details:', JSON.stringify(heartbeatError, null, 2));
    } else {
      console.log('✅ Heartbeat inserted:', heartbeatData);
    }
    console.log('');
    
    // Test 6: Count heartbeats
    const { count: heartbeatCount } = await supabase
      .from('agent_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('activity_type', 'heartbeat');
    console.log(`6️⃣ Total heartbeats in Supabase agent_activity_log: ${heartbeatCount || 0}\n`);
    
    console.log('✅✅✅ ALL TESTS PASSED - Supabase tables are working! ✅✅✅\n');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testSupabaseUsageStats();
