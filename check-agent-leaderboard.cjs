const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jownsgizhqneyxypakmq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvd25zZ2l6aHFuZXl4eXBha21xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODkzNDUxOCwiZXhwIjoyMDQ0NTEwNTE4fQ.JMHygMwHY9RFfdsKRPm1lSqT1sdWNoLdSYcYagBvfeo';

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_EMAIL = 'chrislafond@aoglobelife.com';

async function main() {
  console.log(`\n🔍 Checking why ${TARGET_EMAIL} is not in leaderboard...\n`);
  
  // 1. Check live_call_board
  console.log('1️⃣ Checking live_call_board table...');
  const { data: liveBoard, error: liveError } = await supabase
    .from('live_call_board')
    .select('*')
    .ilike('agent_email', TARGET_EMAIL);
  
  if (liveError) {
    console.log('   ❌ Error:', liveError.message);
  } else if (!liveBoard || liveBoard.length === 0) {
    console.log('   ❌ NOT FOUND in live_call_board');
  } else {
    console.log('   ✅ Found in live_call_board:');
    liveBoard.forEach(row => {
      console.log(`      Email: ${row.agent_email}`);
      console.log(`      Name: ${row.agent_name}`);
      console.log(`      Today Dialed: ${row.today_dialed}`);
      console.log(`      Today Reached: ${row.today_reached}`);
      console.log(`      Today Booked: ${row.today_booked}`);
      console.log(`      Updated: ${row.updated_at}`);
    });
  }
  
  // 2. Check agent_dial_metrics for today
  console.log('\n2️⃣ Checking agent_dial_metrics for today...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: metrics, error: metricsError } = await supabase
    .from('agent_dial_metrics')
    .select('*')
    .ilike('agent', TARGET_EMAIL)
    .gte('dialed_at', today.toISOString())
    .order('dialed_at', { ascending: false })
    .limit(10);
  
  if (metricsError) {
    console.log('   ❌ Error:', metricsError.message);
  } else if (!metrics || metrics.length === 0) {
    console.log('   ❌ No dial metrics for today');
  } else {
    console.log(`   ✅ Found ${metrics.length} dial events today:`);
    metrics.forEach(m => {
      console.log(`      ${m.dialed_at} - Event: ${m.event_type}, Outcome: ${m.outcome}`);
    });
  }
  
  // 3. Check producers table
  console.log('\n3️⃣ Checking producers table...');
  const { data: producer, error: prodError } = await supabase
    .from('producers')
    .select('*')
    .ilike('email', TARGET_EMAIL)
    .maybeSingle();
  
  if (prodError) {
    console.log('   ❌ Error:', prodError.message);
  } else if (!producer) {
    console.log('   ❌ NOT FOUND in producers table');
  } else {
    console.log('   ✅ Found in producers:');
    console.log(`      Name: ${producer.agent_name}`);
    console.log(`      Email: ${producer.email}`);
    console.log(`      Active: ${producer.is_active}`);
  }
  
  // 4. Check all agents in live_call_board to see who IS showing
  console.log('\n4️⃣ Agents currently in leaderboard (has activity today)...');
  const { data: allLive, error: allError } = await supabase
    .from('live_call_board')
    .select('agent_email, agent_name, today_dialed, today_reached, today_booked')
    .or('today_dialed.gt.0,today_reached.gt.0,today_booked.gt.0')
    .order('today_dialed', { ascending: false })
    .limit(15);
  
  if (allError) {
    console.log('   ❌ Error:', allError.message);
  } else {
    console.log(`   Found ${allLive?.length || 0} agents with activity today:`);
    allLive?.forEach(a => {
      const match = a.agent_email?.toLowerCase() === TARGET_EMAIL.toLowerCase() ? ' ⬅️ TARGET' : '';
      console.log(`      ${a.agent_email}: D=${a.today_dialed} R=${a.today_reached} B=${a.today_booked}${match}`);
    });
  }
  
  // 5. Check case sensitivity issues
  console.log('\n5️⃣ Checking for case sensitivity issues...');
  const { data: allEmails } = await supabase
    .from('live_call_board')
    .select('agent_email')
    .ilike('agent_email', '%lafond%');
  
  console.log('   Emails containing "lafond":');
  allEmails?.forEach(e => console.log(`      ${e.agent_email}`));
  
  console.log('\n✅ Done');
}

main().catch(console.error);



























