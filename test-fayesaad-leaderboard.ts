/**
 * Test if fayesaad appears on leaderboard
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST, calculateDialReachBookedRealtime } from './server/scripts/calculate-dial-reach-booked-realtime';

async function testFayesaadLeaderboard() {
  console.log('🔍 Testing fayesaad on leaderboard...\n');
  
  const email = 'fayesaad@aoglobelife.com';
  const { start, end } = getTodayEST();
  
  // 1. Get hierarchy
  const { data: allHierarchyData } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email, agent_name, agent_associate_id, mga_name, mga_associate_id, rga_name, rga_associate_id')
    .not('agent_email', 'is', null);
  
  const allHierarchyMap = new Map<string, any>();
  (allHierarchyData || []).forEach(row => {
    if (row.agent_email) {
      const emailKey = String(row.agent_email).toLowerCase().trim();
      allHierarchyMap.set(emailKey, row);
    }
  });
  
  console.log(`✅ Hierarchy map size: ${allHierarchyMap.size}`);
  console.log(`   fayesaad in map: ${allHierarchyMap.has(email.toLowerCase())}`);
  
  // 2. Get stats
  const realtimeStats = await calculateDialReachBookedRealtime();
  const statsMap = new Map<string, { dialed: number; reached: number; booked: number }>();
  realtimeStats.forEach(stat => {
    statsMap.set(stat.agentEmail.toLowerCase().trim(), {
      dialed: stat.dialed,
      reached: stat.reached,
      booked: stat.booked
    });
  });
  
  console.log(`✅ Stats map size: ${statsMap.size}`);
  console.log(`   fayesaad in stats: ${statsMap.has(email.toLowerCase())}`);
  
  // 3. Get connects
  const { data: connectTransactions } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(100000);
  
  const connectsByAgent = new Map<string, number>();
  (connectTransactions || []).forEach(tx => {
    const emailKey = tx.agent_email?.toLowerCase().trim();
    if (emailKey) {
      connectsByAgent.set(emailKey, (connectsByAgent.get(emailKey) || 0) + 1);
      
      if (!allHierarchyMap.has(emailKey)) {
        allHierarchyMap.set(emailKey, {
          agent_email: emailKey,
          agent_name: emailKey.split('@')[0].replace(/([a-z])([A-Z])/g, '$1 $2'),
          agent_associate_id: null,
          mga_name: null,
          mga_associate_id: null,
          rga_name: null,
          rga_associate_id: null
        });
      }
    }
  });
  
  console.log(`✅ Connects map size: ${connectsByAgent.size}`);
  console.log(`   fayesaad connects: ${connectsByAgent.get(email.toLowerCase()) || 0}`);
  
  // 4. Build leaderboard data (exact same logic as routes.ts)
  const leaderboardData = Array.from(allHierarchyMap.entries())
    .map(([emailKey, hierarchyRow]) => {
      let agentName = hierarchyRow?.agent_name;
      if (!agentName || agentName === 'Agent User' || agentName === 'Unknown Agent') {
        const emailPrefix = emailKey.split('@')[0];
        agentName = emailPrefix.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase());
      }
      
      const stats = statsMap.get(emailKey) || { dialed: 0, reached: 0, booked: 0 };
      const connects = connectsByAgent.get(emailKey) || 0;
      
      return {
        agentName: agentName,
        email: emailKey,
        dials: stats.dialed,
        reaches: stats.reached,
        bookings: stats.booked,
        connects: connects
      };
    })
    .filter(agent => {
      return agent.dials > 0 || agent.connects > 0;
    });
  
  // Sort by points (same as leaderboard)
  const calculatePoints = (agent: any) => {
    const dials = Number(agent?.dials || 0) || 0;
    const reaches = Number(agent?.reaches || 0) || 0;
    const bookings = Number(agent?.bookings || 0) || 0;
    const presentations = Number(agent?.presentations || 0) || 0;
    const sales = Number(agent?.sales || 0) || 0;
    return (dials * 1) + (reaches * 25) + (bookings * 50) + (presentations * 200) + (sales * 800);
  };
  
  leaderboardData.forEach(agent => {
    agent.calculatedPoints = calculatePoints(agent);
  });
  
  leaderboardData.sort((a, b) => (b.calculatedPoints || 0) - (a.calculatedPoints || 0));
  
  const top20 = leaderboardData.slice(0, 20);
  
  console.log(`\n📊 LEADERBOARD DATA:`);
  console.log(`   Total agents after filter: ${leaderboardData.length}`);
  console.log(`   Top 20 by points: ${top20.length}`);
  
  const fayesaadInLeaderboard = leaderboardData.find(a => a.email === email.toLowerCase());
  const fayesaadInTop20 = top20.find(a => a.email === email.toLowerCase());
  
  if (fayesaadInLeaderboard) {
    console.log(`\n✅ FAYESAAD FOUND IN LEADERBOARD:`);
    console.log(`   Name: ${fayesaadInLeaderboard.agentName}`);
    console.log(`   Email: ${fayesaadInLeaderboard.email}`);
    console.log(`   Dials: ${fayesaadInLeaderboard.dials}`);
    console.log(`   Connects: ${fayesaadInLeaderboard.connects}`);
    console.log(`   Reaches: ${fayesaadInLeaderboard.reaches}`);
    console.log(`   Bookings: ${fayesaadInLeaderboard.bookings}`);
    console.log(`   Points: ${fayesaadInLeaderboard.calculatedPoints || 0}`);
    console.log(`   Rank: ${leaderboardData.indexOf(fayesaadInLeaderboard) + 1} of ${leaderboardData.length}`);
    console.log(`   In Top 20: ${fayesaadInTop20 ? 'YES ✅' : 'NO ❌'}`);
    if (!fayesaadInTop20) {
      console.log(`   Top 20 points range: ${top20[top20.length - 1]?.calculatedPoints || 0} to ${top20[0]?.calculatedPoints || 0}`);
      console.log(`   fayesaad points: ${fayesaadInLeaderboard.calculatedPoints || 0}`);
    }
  } else {
    console.log(`\n❌ FAYESAAD NOT FOUND IN LEADERBOARD`);
    console.log(`   Checking why...`);
    
    const emailLower = email.toLowerCase();
    const inHierarchy = allHierarchyMap.has(emailLower);
    const hasConnects = (connectsByAgent.get(emailLower) || 0) > 0;
    const hasDials = (statsMap.get(emailLower)?.dialed || 0) > 0;
    
    console.log(`   In hierarchy: ${inHierarchy}`);
    console.log(`   Has connects: ${hasConnects} (${connectsByAgent.get(emailLower) || 0})`);
    console.log(`   Has dials: ${hasDials} (${statsMap.get(emailLower)?.dialed || 0})`);
    console.log(`   Would pass filter: ${hasDials || hasConnects}`);
    
    if (!inHierarchy && !hasConnects) {
      console.log(`   ❌ PROBLEM: Not in hierarchy AND no connects - won't be in allHierarchyMap`);
    }
  }
}

testFayesaadLeaderboard()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
