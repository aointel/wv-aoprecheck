/**
 * Check if instant presentations and connects are hitting Supabase limits
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkLimits() {
  console.log('🔍 Checking instant presentations and connects for limits...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Check instant_presentation count
  console.log('📊 Checking instant_presentation events...');
  const { count: instantPresCount, error: instantPresCountError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'instant_presentation')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .not('lead_phone', 'is', null)
    .not('agent_email', 'is', null);
  
  if (instantPresCountError) {
    console.error('❌ Error counting instant_presentation:', instantPresCountError);
  } else {
    console.log(`   Total instant_presentation events in DB: ${instantPresCount || 0}`);
    if (instantPresCount && instantPresCount > 1000) {
      console.log(`   ⚠️ WARNING: ${instantPresCount} events > 1000 limit! Missing ${instantPresCount - 1000} events!`);
    } else {
      console.log(`   ✅ Under 1000 limit (current: ${instantPresCount || 0})`);
    }
  }
  
  // Check connects count
  console.log('\n📊 Checking connects from billing_transactions...');
  const { count: connectsCount, error: connectsCountError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '');
  
  if (connectsCountError) {
    console.error('❌ Error counting connects:', connectsCountError);
  } else {
    console.log(`   Total connect transactions in DB: ${connectsCount || 0}`);
    if (connectsCount && connectsCount > 1000) {
      console.log(`   ⚠️ WARNING: ${connectsCount} transactions > 1000 limit! Missing ${connectsCount - 1000} transactions!`);
    } else {
      console.log(`   ✅ Under 1000 limit (current: ${connectsCount || 0})`);
    }
  }
  
  // Check what queries actually return
  console.log('\n🔍 Testing actual query results...');
  
  // Query instant_presentation (what the code does)
  const { data: instantPresQuery, error: instantPresQueryError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone')
    .eq('event_type', 'instant_presentation')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .not('agent_email', 'is', null)
    .not('lead_phone', 'is', null)
    .limit(100000);
  
  if (instantPresQueryError) {
    console.error('❌ Error querying instant_presentation:', instantPresQueryError);
  } else {
    const queryCount = instantPresQuery?.length || 0;
    console.log(`   Query returned: ${queryCount} instant_presentation events`);
    if (queryCount === 1000 && (instantPresCount || 0) > 1000) {
      console.log(`   ⚠️ HITTING LIMIT: Query capped at 1000 but DB has ${instantPresCount}`);
    }
  }
  
  // Query connects (what the code does)
  const { data: connectsQuery, error: connectsQueryError } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(100000);
  
  if (connectsQueryError) {
    console.error('❌ Error querying connects:', connectsQueryError);
  } else {
    const queryCount = connectsQuery?.length || 0;
    console.log(`   Query returned: ${connectsQuery?.length || 0} connect transactions`);
    if (queryCount === 1000 && (connectsCount || 0) > 1000) {
      console.log(`   ⚠️ HITTING LIMIT: Query capped at 1000 but DB has ${connectsCount}`);
    }
  }
  
  console.log('\n💡 RECOMMENDATION:');
  console.log('   If counts exceed 1000, implement pagination or use count queries.');
  console.log('   Instant presentations: Already separate query, but needs pagination if > 1000.');
  console.log('   Connects: Already separate query, but needs pagination if > 1000.');
}

checkLimits()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
