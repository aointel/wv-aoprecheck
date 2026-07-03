#!/usr/bin/env node

/**
 * Check the database directly to see what's in weekly_usage_stats
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDatabase() {
  try {
    console.log('🔍 Checking weekly_usage_stats table...\n');
    
    // Check total records
    const { data: allRecords, error: allError } = await supabase
      .from('weekly_usage_stats')
      .select('*');
    
    if (allError) {
      console.error('❌ Error fetching all records:', allError);
    } else {
      console.log(`📊 Total records in weekly_usage_stats: ${allRecords?.length || 0}`);
      
      if (allRecords && allRecords.length > 0) {
        console.log('\n📋 All records:');
        allRecords.forEach(record => {
          console.log(`  ${record.agent_email} | Week: ${record.week_start_date} | Logins: ${record.total_logins} | Dials: ${record.total_dials_made}`);
        });
      }
    }
    
    // Calculate what Sunday should be
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    const sundayString = sunday.toISOString().split('T')[0];
    
    console.log(`\n📅 Calculated Sunday (week start): ${sundayString}`);
    console.log(`📅 Today's day of week: ${dayOfWeek} (0=Sunday)`);
    
    // Check records for current week (Sunday)
    const { data: currentWeekRecords, error: weekError } = await supabase
      .from('weekly_usage_stats')
      .select('*')
      .eq('week_start_date', sundayString);
    
    if (weekError) {
      console.error('❌ Error fetching current week records:', weekError);
    } else {
      console.log(`\n📊 Records for current week (${sundayString}): ${currentWeekRecords?.length || 0}`);
      
      if (currentWeekRecords && currentWeekRecords.length > 0) {
        console.log('✅ FOUND DATA FOR CURRENT WEEK:');
        currentWeekRecords.forEach(record => {
          console.log(`  ${record.agent_email}:`, {
            logins: record.total_logins,
            online_minutes: record.total_online_minutes,
            dials: record.total_dials_made,
            appointments: record.appointments_scheduled,
            sales: record.sales_made,
            alp: record.total_alp
          });
        });
      } else {
        console.log('⚠️ NO RECORDS FOUND FOR CURRENT WEEK');
        console.log('   This explains why the Usage Report is blank');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

checkDatabase();

