/**
 * Test script to verify billing summary table and data
 */

import { supabaseAdmin } from './supabase';

async function testBillingSummary() {
  console.log('🔍 Testing ConnectNow Billing Summary Database...\n');
  
  try {
    // Test 1: Check if table exists
    console.log('1️⃣ Checking if table exists...');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('connectnow_billing_summary')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Table does not exist or error:', testError);
      console.error('   Code:', testError.code);
      console.error('   Message:', testError.message);
      console.error('   Details:', testError.details);
      console.error('\n⚠️  You need to run the SQL schema to create the table!');
      return;
    }
    
    console.log('✅ Table exists!\n');
    
    // Test 2: Count total records
    console.log('2️⃣ Counting total records...');
    const { count, error: countError } = await supabaseAdmin
      .from('connectnow_billing_summary')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting:', countError);
    } else {
      console.log(`✅ Total records: ${count || 0}\n`);
    }
    
    // Test 3: Get sample records
    console.log('3️⃣ Getting sample records...');
    const { data: samples, error: samplesError } = await supabaseAdmin
      .from('connectnow_billing_summary')
      .select('*')
      .order('date', { ascending: false })
      .limit(10);
    
    if (samplesError) {
      console.error('❌ Error fetching samples:', samplesError);
    } else {
      console.log(`✅ Sample records (latest 10):`);
      samples?.forEach((record: any) => {
        console.log(`   ${record.date}: Pre-Check billed=${record.precheck_billed}, sign-ups=${record.precheck_sign_ups}, CCPRO active=${record.call_connector_pro_active_accounts}, sign-ups=${record.call_connector_pro_sign_ups}`);
      });
      console.log('');
    }
    
    // Test 4: Test date range query (current week)
    console.log('4️⃣ Testing date range query for current week...');
    const now = new Date();
    const pstOffset = -8 * 60;
    const pstNow = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60 * 1000);
    let weekStart = new Date(pstNow);
    const dayOfWeek = weekStart.getDay();
    const daysSinceThursday = (dayOfWeek + 3) % 7;
    if (daysSinceThursday > 0) {
      weekStart.setDate(weekStart.getDate() - daysSinceThursday);
    }
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;
    
    console.log(`   Querying: ${weekStartStr} to ${weekEndStr}`);
    
    const { data: weekData, error: weekError } = await supabaseAdmin
      .from('connectnow_billing_summary')
      .select('*')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .order('date', { ascending: true });
    
    if (weekError) {
      console.error('❌ Error fetching week data:', weekError);
    } else {
      console.log(`✅ Found ${weekData?.length || 0} records for current week`);
      if (weekData && weekData.length > 0) {
        let totalPrecheckBilled = 0;
        let totalPrecheckSignUps = 0;
        let totalCcpSignUps = 0;
        weekData.forEach((day: any) => {
          totalPrecheckBilled += day.precheck_billed || 0;
          totalPrecheckSignUps += day.precheck_sign_ups || 0;
          totalCcpSignUps += day.call_connector_pro_sign_ups || 0;
        });
        console.log(`   Week totals: Pre-Check billed=${totalPrecheckBilled}, sign-ups=${totalPrecheckSignUps}, CCPRO sign-ups=${totalCcpSignUps}`);
        if (weekData.length > 0) {
          console.log(`   Latest CCPRO active accounts: ${weekData[weekData.length - 1].call_connector_pro_active_accounts}`);
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error);
  }
}

testBillingSummary()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

