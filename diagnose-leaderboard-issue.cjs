const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jownsgizhqneyxypakmq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvd25zZ2l6aHFuZXl4eXBha21xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODkzNDUxOCwiZXhwIjoyMDQ0NTEwNTE4fQ.JMHygMwHY9RFfdsKRPm1lSqT1sdWNoLdSYcYagBvfeo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n🔍 DIAGNOSING LEADERBOARD ISSUE\n');
  console.log('='.repeat(60));
  
  // 1. Check if live_call_board exists
  console.log('\n1️⃣ Checking live_call_board table (without t)...');
  const { data: liveBoard, error: liveError } = await supabase
    .from('live_call_board')
    .select('agent_email, agent_name, today_dialed, today_reached, today_booked')
    .or('today_dialed.gt.0,today_reached.gt.0,today_booked.gt.0')
    .limit(10);
  
  if (liveError) {
    console.log('   ❌ Error accessing live_call_board:', liveError.message);
  } else {
    console.log(`   ✅ Found ${liveBoard?.length || 0} agents with activity in live_call_board`);
    if (liveBoard && liveBoard.length > 0) {
      console.log('   Sample data:');
      liveBoard.slice(0, 5).forEach(a => {
        console.log(`      ${a.agent_email}: D=${a.today_dialed} R=${a.today_reached} B=${a.today_booked}`);
      });
    }
  }
  
  // 2. Check if live_call_boardt exists (what the API is using)
  console.log('\n2️⃣ Checking live_call_boardt table (with t - what API uses)...');
  const { data: liveBoardt, error: liveBoardtError } = await supabase
    .from('live_call_boardt')
    .select('agent_email, agent_name, today_dialed, today_reached, today_booked')
    .or('today_dialed.gt.0,today_reached.gt.0,today_booked.gt.0')
    .limit(10);
  
  if (liveBoardtError) {
    console.log('   ❌ Error accessing live_call_boardt:', liveBoardtError.message);
    console.log('   ⚠️  This is the problem! The API is querying live_call_boardt but it may not exist.');
  } else {
    console.log(`   ✅ Found ${liveBoardt?.length || 0} agents with activity in live_call_boardt`);
    if (liveBoardt && liveBoardt.length > 0) {
      console.log('   Sample data:');
      liveBoardt.slice(0, 5).forEach(a => {
        console.log(`      ${a.agent_email}: D=${a.today_dialed} R=${a.today_reached} B=${a.today_booked}`);
      });
    } else {
      console.log('   ⚠️  Table exists but has no data with activity today');
    }
  }
  
  // 3. Check total counts in both tables
  console.log('\n3️⃣ Comparing table counts...');
  const { count: countBoard } = await supabase
    .from('live_call_board')
    .select('*', { count: 'exact', head: true });
  
  const { count: countBoardt } = await supabase
    .from('live_call_boardt')
    .select('*', { count: 'exact', head: true });
  
  console.log(`   live_call_board: ${countBoard || 0} total rows`);
  console.log(`   live_call_boardt: ${countBoardt || 0} total rows`);
  
  // 4. Check what columns exist in live_call_boardt
  console.log('\n4️⃣ Checking live_call_boardt structure...');
  const { data: sampleRow } = await supabase
    .from('live_call_boardt')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (sampleRow) {
    console.log('   ✅ Table exists with columns:', Object.keys(sampleRow).join(', '));
  } else {
    console.log('   ⚠️  No rows found - checking if table exists at all...');
    // Try to get schema info by attempting a select with no filters
    const { error: schemaError } = await supabase
      .from('live_call_boardt')
      .select('agent_email')
      .limit(0);
    
    if (schemaError) {
      console.log(`   ❌ Table may not exist: ${schemaError.message}`);
    } else {
      console.log('   ✅ Table exists but is empty');
    }
  }
  
  // 5. Check agent_dial_metrics to see if there's source data
  console.log('\n5️⃣ Checking agent_dial_metrics (source data)...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: metrics, error: metricsError } = await supabase
    .from('agent_dial_metrics')
    .select('agent_email, event_type, event_timestamp')
    .gte('event_timestamp', today.toISOString())
    .limit(20);
  
  if (metricsError) {
    console.log('   ❌ Error:', metricsError.message);
  } else {
    console.log(`   ✅ Found ${metrics?.length || 0} events today in agent_dial_metrics`);
    if (metrics && metrics.length > 0) {
      const agentCounts = {};
      metrics.forEach(m => {
        if (!agentCounts[m.agent_email]) {
          agentCounts[m.agent_email] = { dials: 0, reaches: 0, booked: 0 };
        }
        if (m.event_type === 'dial') agentCounts[m.agent_email].dials++;
        if (m.event_type === 'reach') agentCounts[m.agent_email].reaches++;
        if (m.event_type === 'booked') agentCounts[m.agent_email].booked++;
      });
      console.log('   Agents with activity:');
      Object.entries(agentCounts).slice(0, 5).forEach(([email, counts]) => {
        console.log(`      ${email}: D=${counts.dials} R=${counts.reaches} B=${counts.booked}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY:');
  console.log(`   - live_call_board: ${countBoard || 0} rows`);
  console.log(`   - live_call_boardt: ${countBoardt || 0} rows`);
  console.log(`   - API uses: live_call_boardt`);
  
  if (liveBoardtError) {
    console.log('\n❌ ISSUE FOUND: live_call_boardt table does not exist or is inaccessible!');
    console.log('   The API is trying to query live_call_boardt but it fails.');
    console.log('   Solution: Either create live_call_boardt or change API to use live_call_board');
  } else if ((liveBoardt?.length || 0) === 0 && (liveBoard?.length || 0) > 0) {
    console.log('\n⚠️  ISSUE FOUND: live_call_boardt exists but has no data!');
    console.log('   live_call_board has data but live_call_boardt is empty.');
    console.log('   Solution: Check if the cron job or triggers are updating live_call_boardt');
  } else if ((liveBoardt?.length || 0) > 0) {
    console.log('\n✅ Both tables exist and have data. Issue may be elsewhere.');
  }
  
  console.log('\n✅ Diagnosis complete\n');
}

main().catch(console.error);

