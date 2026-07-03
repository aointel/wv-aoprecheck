/**
 * Test script to verify ConnectNow Analytics database table and data
 */

import { supabaseAdmin } from './supabase';

async function testDatabase() {
  console.log('🔍 Testing ConnectNow Analytics Database...\n');
  
  try {
    // Test 1: Check if table exists
    console.log('1️⃣ Checking if table exists...');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Table does not exist or error:', testError);
      console.error('   Code:', testError.code);
      console.error('   Message:', testError.message);
      console.error('   Details:', testError.details);
      return;
    }
    
    console.log('✅ Table exists!\n');
    
    // Test 2: Count total records
    console.log('2️⃣ Counting total records...');
    const { count, error: countError } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting:', countError);
    } else {
      console.log(`✅ Total records: ${count || 0}\n`);
    }
    
    // Test 3: Get sample records
    console.log('3️⃣ Getting sample records...');
    const { data: samples, error: samplesError } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .select('date, campaign_id, market, total_new, connected')
      .order('date', { ascending: false })
      .limit(10);
    
    if (samplesError) {
      console.error('❌ Error getting samples:', samplesError);
    } else {
      console.log(`✅ Found ${samples?.length || 0} sample records:`);
      samples?.forEach((record, idx) => {
        console.log(`   ${idx + 1}. Date: ${record.date}, Campaign: ${record.campaign_id.substring(0, 8)}..., Market: ${record.market}, NEW: ${record.total_new}, Connected: ${record.connected}`);
      });
      console.log('');
    }
    
    // Test 4: Check unique dates
    console.log('4️⃣ Checking unique dates...');
    const { data: allRecords } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .select('date')
      .order('date', { ascending: true });
    
    if (allRecords) {
      const uniqueDates = [...new Set(allRecords.map(r => r.date))];
      console.log(`✅ Found ${uniqueDates.length} unique dates:`);
      console.log(`   First: ${uniqueDates[0]}, Last: ${uniqueDates[uniqueDates.length - 1]}`);
      console.log(`   Sample dates: ${uniqueDates.slice(0, 5).join(', ')}...`);
      console.log('');
    }
    
    // Test 5: Test date range query (November week)
    console.log('5️⃣ Testing date range query (November 2025)...');
    const { data: novemberData, error: novemberError } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .select('*')
      .gte('date', '2025-11-01')
      .lte('date', '2025-11-07')
      .order('date', { ascending: true });
    
    if (novemberError) {
      console.error('❌ Error querying November:', novemberError);
    } else {
      console.log(`✅ Found ${novemberData?.length || 0} records for Nov 1-7, 2025`);
      if (novemberData && novemberData.length > 0) {
        const dates = [...new Set(novemberData.map(r => r.date))];
        console.log(`   Dates found: ${dates.join(', ')}`);
      }
      console.log('');
    }
    
    // Test 6: Check current rolling week
    console.log('6️⃣ Testing current rolling week query...');
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysSinceThursday = (dayOfWeek + 3) % 7;
    const weekStart = new Date(now);
    if (daysSinceThursday > 0) {
      weekStart.setDate(now.getDate() - daysSinceThursday);
    }
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    console.log(`   Looking for week: ${weekStartStr} to ${weekEndStr}`);
    
    const { data: weekData, error: weekError } = await supabaseAdmin
      .from('connectnow_daily_kpis')
      .select('*')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);
    
    if (weekError) {
      console.error('❌ Error querying current week:', weekError);
    } else {
      console.log(`✅ Found ${weekData?.length || 0} records for current rolling week`);
      if (weekData && weekData.length === 0) {
        console.log('   ⚠️  No data found for current week - may need to populate');
      }
      console.log('');
    }
    
    console.log('✅ All tests completed!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error('   Stack:', error.stack);
  }
}

testDatabase()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

