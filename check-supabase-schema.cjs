/**
 * Check Supabase table schemas and identify missing columns
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSchemas() {
  try {
    console.log('🔍 Checking Supabase table schemas...\n');
    
    // Check agent_activity_log columns
    console.log('1️⃣ Checking agent_activity_log table...');
    const { data: activityLogSample, error: activityError } = await supabase
      .from('agent_activity_log')
      .select('*')
      .limit(1);
    
    if (activityError) {
      console.error('❌ Error:', activityError.message);
    } else if (activityLogSample && activityLogSample.length > 0) {
      console.log('✅ agent_activity_log columns:', Object.keys(activityLogSample[0]));
      console.log('Sample row:', activityLogSample[0]);
    } else {
      // Try to insert a test row to see what columns are required
      const { data: testInsert, error: insertError } = await supabase
        .from('agent_activity_log')
        .insert({
          agent_email: 'schema-test@test.com',
          activity_type: 'test',
          timestamp: new Date().toISOString()
        })
        .select('*')
        .single();
      
      if (insertError) {
        console.error('❌ Insert test error:', insertError.message);
        console.error('Details:', JSON.stringify(insertError, null, 2));
      } else {
        console.log('✅ agent_activity_log columns:', Object.keys(testInsert));
        // Delete test row
        await supabase.from('agent_activity_log').delete().eq('id', testInsert.id);
      }
    }
    console.log('');
    
    // Check weekly_usage_stats columns
    console.log('2️⃣ Checking weekly_usage_stats table...');
    const { data: weeklyStatsSample, error: weeklyError } = await supabase
      .from('weekly_usage_stats')
      .select('*')
      .limit(1);
    
    if (weeklyError) {
      console.error('❌ Error:', weeklyError.message);
    } else if (weeklyStatsSample && weeklyStatsSample.length > 0) {
      console.log('✅ weekly_usage_stats columns:', Object.keys(weeklyStatsSample[0]));
      console.log('Sample row:', weeklyStatsSample[0]);
    } else {
      console.log('⚠️ Table exists but is empty');
    }
    console.log('');
    
    // Expected columns for agent_activity_log
    const expectedActivityLogColumns = [
      'id',
      'agent_email',
      'activity_type',
      'timestamp',  // or started_at?
      'session_id',
      'ip_address',
      'activity_data'
    ];
    
    // Expected columns for weekly_usage_stats
    const expectedWeeklyStatsColumns = [
      'id',
      'agent_email',
      'agent_name',
      'week_start_date',
      'week_end_date',
      'total_logins',
      'unique_login_days',
      'total_online_minutes',
      'last_activity_at',
      'vdp_connects_received',
      'vdp_total_minutes',
      'total_dials_made',
      'total_call_minutes',
      'ccpro_call_minutes',
      'appointments_scheduled',
      'sales_made',
      'total_alp',
      'created_at',
      'updated_at'
    ];
    
    console.log('📋 Expected columns:');
    console.log('agent_activity_log:', expectedActivityLogColumns);
    console.log('weekly_usage_stats:', expectedWeeklyStatsColumns);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSchemas();
