const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkIssue() {
  console.log('🔍 CHECKING LIVE CALL BOARD ISSUE...\n');
  
  // Get today range
  const { data: range, error: rangeError } = await supabase.rpc('get_today_pst_range');
  if (rangeError) {
    console.error('Error getting today range:', rangeError);
    return;
  }
  
  const todayStart = range[0].today_start;
  const todayEnd = range[0].today_end;
  
  console.log('📅 TODAY range (PST):');
  console.log('   Start:', todayStart);
  console.log('   End:', todayEnd);
  console.log('');
  
  // Check ankitadas
  const email = 'ankitadas@aoglobelife.com';
  
  // Get from live_call_board
  const { data: board } = await supabase
    .from('live_call_board')
    .select('*')
    .eq('agent_email', email)
    .maybeSingle();
  
  console.log('📊 LIVE_CALL_BOARD:');
  console.log('   Dialed:', board?.today_dialed || 0);
  console.log('   Reached:', board?.today_reached || 0);
  console.log('   Booked:', board?.today_booked || 0);
  console.log('   Updated:', board?.updated_at);
  console.log('');
  
  // Get from agent_dial_metrics for TODAY
  const { data: metricsToday } = await supabase
    .from('agent_dial_metrics')
    .select('event_type, lead_phone, event_timestamp')
    .eq('agent_email', email)
    .gte('event_timestamp', todayStart)
    .lt('event_timestamp', todayEnd)
    .not('lead_phone', 'is', null);
  
  const dialedSet = new Set();
  const reachedSet = new Set();
  const bookedSet = new Set();
  
  metricsToday.forEach(m => {
    if (m.event_type === 'dial') dialedSet.add(m.lead_phone);
    if (m.event_type === 'reach') reachedSet.add(m.lead_phone);
    if (m.event_type === 'booked') bookedSet.add(m.lead_phone);
  });
  
  console.log('📊 AGENT_DIAL_METRICS (TODAY in PST):');
  console.log('   Total metrics:', metricsToday.length);
  console.log('   Unique dialed phones:', dialedSet.size);
  console.log('   Unique reached phones:', reachedSet.size);
  console.log('   Unique booked phones:', bookedSet.size);
  console.log('');
  
  console.log('❌ MISMATCH:');
  console.log('   Dialed difference:', dialedSet.size - (board?.today_dialed || 0));
  console.log('   Reached difference:', reachedSet.size - (board?.today_reached || 0));
  console.log('   Booked difference:', bookedSet.size - (board?.today_booked || 0));
  console.log('');
  
  // Check if there are metrics outside today range
  const { data: metricsAll } = await supabase
    .from('agent_dial_metrics')
    .select('event_type, lead_phone, event_timestamp')
    .eq('agent_email', email)
    .order('event_timestamp', { ascending: false })
    .limit(20);
  
  console.log('📊 RECENT METRICS (last 20, any time):');
  metricsAll.forEach(m => {
    const age = Math.round((Date.now() - new Date(m.event_timestamp).getTime()) / 1000 / 60);
    const inRange = m.event_timestamp >= todayStart && m.event_timestamp < todayEnd;
    console.log(`   ${m.event_type}: ${m.lead_phone} (${age} min ago, ${inRange ? 'IN TODAY' : 'OUTSIDE TODAY'})`);
  });
}

checkIssue();


































