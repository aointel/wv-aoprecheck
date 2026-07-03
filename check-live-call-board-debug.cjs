// Debug script to check Live Call Board data flow
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc'
);

async function debug() {
  console.log('=== LIVE CALL BOARD DEBUG ===\n');
  
  // 1. Check current server time
  const now = new Date();
  console.log('1. CURRENT TIME:');
  console.log('   UTC:', now.toISOString());
  console.log('   PST:', now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  
  // 2. Calculate PST day boundaries
  const pstYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric' }));
  const pstMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit' }));
  const pstDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit' }));
  
  // Try PST (UTC-8) first
  const pstMidnightString = `${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}T00:00:00`;
  let todayStart = new Date(`${pstMidnightString}-08:00`);
  
  // Check if we need PDT (UTC-7) instead
  const verifyPST = todayStart.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const expectedDate = `${String(pstMonth).padStart(2, '0')}/${String(pstDay).padStart(2, '0')}/${pstYear}`;
  
  if (verifyPST !== expectedDate) {
    todayStart = new Date(`${pstMidnightString}-07:00`);
    console.log('   Using PDT (UTC-7)');
  } else {
    console.log('   Using PST (UTC-8)');
  }
  
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  console.log('\n2. TODAY BOUNDARIES (for queries):');
  console.log('   Start:', todayStart.toISOString());
  console.log('   End:', todayEnd.toISOString());
  
  // 3. Check agent_dial_metrics for today
  console.log('\n3. AGENT_DIAL_METRICS (today):');
  const { data: metrics, error: metricsError } = await supabase
    .from('agent_dial_metrics')
    .select('agent_email, event_type, lead_phone, event_timestamp')
    .gte('event_timestamp', todayStart.toISOString())
    .lt('event_timestamp', todayEnd.toISOString())
    .order('event_timestamp', { ascending: false })
    .limit(20);
  
  if (metricsError) {
    console.log('   ERROR:', metricsError.message);
  } else if (!metrics || metrics.length === 0) {
    console.log('   ⚠️ NO METRICS FOUND FOR TODAY');
  } else {
    console.log(`   Found ${metrics.length} recent metrics (showing up to 20):`);
    metrics.forEach(m => {
      const ts = new Date(m.event_timestamp);
      console.log(`   - ${m.event_type.padEnd(8)} | ${m.agent_email?.substring(0, 25).padEnd(25)} | ${ts.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
    });
  }
  
  // 4. Check live_call_board recent updates
  console.log('\n4. LIVE_CALL_BOARD (recent updates):');
  const { data: board, error: boardError } = await supabase
    .from('live_call_board')
    .select('agent_email, today_dialed, today_reached, today_booked, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);
  
  if (boardError) {
    console.log('   ERROR:', boardError.message);
  } else if (!board || board.length === 0) {
    console.log('   ⚠️ NO DATA IN LIVE_CALL_BOARD');
  } else {
    console.log(`   Found ${board.length} agents:`);
    board.forEach(b => {
      const updated = b.updated_at ? new Date(b.updated_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : 'never';
      console.log(`   - ${b.agent_email?.substring(0, 25).padEnd(25)} | D:${b.today_dialed || 0} R:${b.today_reached || 0} B:${b.today_booked || 0} | Updated: ${updated}`);
    });
  }
  
  // 5. Compare: Find agent with metrics but wrong board stats
  console.log('\n5. COMPARISON (checking for mismatches):');
  if (metrics && metrics.length > 0) {
    const agentCounts = {};
    metrics.forEach(m => {
      if (!agentCounts[m.agent_email]) {
        agentCounts[m.agent_email] = { dial: 0, reach: 0, booked: 0 };
      }
      if (m.event_type === 'dial') agentCounts[m.agent_email].dial++;
      if (m.event_type === 'reach') agentCounts[m.agent_email].reach++;
      if (m.event_type === 'booked') agentCounts[m.agent_email].booked++;
    });
    
    for (const [email, counts] of Object.entries(agentCounts)) {
      const boardRow = board?.find(b => b.agent_email?.toLowerCase() === email.toLowerCase());
      if (boardRow) {
        const match = boardRow.today_dialed === counts.dial && 
                      boardRow.today_reached === counts.reach;
        console.log(`   ${email}: Metrics(D:${counts.dial} R:${counts.reach}) vs Board(D:${boardRow.today_dialed} R:${boardRow.today_reached}) ${match ? '✅' : '❌ MISMATCH'}`);
      } else {
        console.log(`   ${email}: Metrics(D:${counts.dial} R:${counts.reach}) vs Board: NOT FOUND ❌`);
      }
    }
  }
  
  console.log('\n=== END DEBUG ===');
}

debug().catch(console.error);



























