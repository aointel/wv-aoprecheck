/**
 * Test script to check if call analytics data exists
 */

import { supabaseAdmin } from './server/supabase';

async function testCallAnalyticsData() {
  console.log('🔍 Testing call analytics data...\n');

  // Check total billing_transactions with type='connect'
  const { data: allConnects, error: allError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, agent_email, transaction_date, transaction_type')
    .eq('transaction_type', 'connect')
    .limit(10);

  console.log(`📊 Total connect transactions (first 10):`, allConnects?.length || 0);
  if (allError) {
    console.error('❌ Error:', allError);
  } else if (allConnects && allConnects.length > 0) {
    console.log('Sample transactions:');
    allConnects.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.transaction_id} - ${t.agent_email} - ${t.transaction_date}`);
    });
  }

  // Check recent ones (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentConnects, error: recentError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, agent_email, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', sevenDaysAgo.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(10);

  console.log(`\n📊 Recent connect transactions (last 7 days):`, recentConnects?.length || 0);
  if (recentError) {
    console.error('❌ Error:', recentError);
  } else if (recentConnects && recentConnects.length > 0) {
    console.log('Recent transactions:');
    recentConnects.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.transaction_id} - ${t.agent_email} - ${t.transaction_date}`);
    });
  }

  // Check if any have analytics
  const { data: analytics, error: analyticsError } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('billing_transaction_id, analysis_status, call_score')
    .limit(10);

  console.log(`\n📊 Total analytics records:`, analytics?.length || 0);
  if (analyticsError) {
    console.error('❌ Error:', analyticsError);
  } else if (analytics && analytics.length > 0) {
    console.log('Sample analytics:');
    analytics.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.billing_transaction_id} - Status: ${a.analysis_status} - Score: ${a.call_score}`);
    });
  }

  // Check vdp_calls with Event='END'
  const { data: vdpCalls, error: vdpError } = await supabaseAdmin
    .from('vdp_calls')
    .select('id, Event, Params, Date, Time')
    .eq('Event', 'END')
    .limit(10);

  console.log(`\n📊 VDP calls with Event='END' (first 10):`, vdpCalls?.length || 0);
  if (vdpError) {
    console.error('❌ Error:', vdpError);
  } else if (vdpCalls && vdpCalls.length > 0) {
    console.log('Sample vdp_calls:');
    vdpCalls.forEach((v, i) => {
      let callId = 'N/A';
      try {
        const params = typeof v.Params === 'string' ? JSON.parse(v.Params) : v.Params;
        callId = params?.callId || params?.call_id || 'N/A';
      } catch (e) {
        // ignore
      }
      console.log(`  ${i + 1}. ID: ${v.id} - CallId: ${callId} - Date: ${v.Date} ${v.Time}`);
    });
  }

  process.exit(0);
}

testCallAnalyticsData().catch(console.error);
