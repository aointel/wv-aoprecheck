/**
 * Check why fouziehsaad is not showing on leaderboard
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkFouziehsaad() {
  console.log('🔍 Checking fouziehsaad...\n');
  
  const email = 'fouziehsaad@aoglobelife.com';
  const { start, end } = getTodayEST();
  
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // 1. Check if they have connects
  console.log('📊 Checking connects from billing_transactions...');
  const { data: connects, error: connectsError } = await supabaseAdmin
    .from('billing_transactions')
    .select('id, agent_email, transaction_date, transaction_type')
    .eq('transaction_type', 'connect')
    .eq('agent_email', email)
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString());
  
  if (connectsError) {
    console.error('❌ Error:', connectsError);
  } else {
    console.log(`   ✅ Found ${connects?.length || 0} connects for ${email}`);
    if (connects && connects.length > 0) {
      console.log(`   Sample connects:`);
      for (const conn of connects.slice(0, 5)) {
        console.log(`      - ${conn.transaction_date} (ID: ${conn.id})`);
      }
    }
  }
  
  // 2. Check if they're in agent_hierarchy
  console.log('\n📊 Checking agent_hierarchy...');
  const { data: hierarchy, error: hierarchyError } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('*')
    .eq('agent_email', email)
    .maybeSingle();
  
  if (hierarchyError) {
    console.error('❌ Error:', hierarchyError);
  } else {
    if (hierarchy) {
      console.log(`   ✅ Found in hierarchy:`);
      console.log(`      Agent: ${hierarchy.agent_name || 'N/A'}`);
      console.log(`      MGA: ${hierarchy.mga_name || 'N/A'}`);
      console.log(`      RGA: ${hierarchy.rga_name || 'N/A'}`);
    } else {
      console.log(`   ⚠️ NOT FOUND in agent_hierarchy`);
    }
  }
  
  // 3. Check dial/reach/booked stats
  console.log('\n📊 Checking dial/reach/booked stats...');
  const { calculateDialReachBookedRealtime } = await import('./server/scripts/calculate-dial-reach-booked-realtime.js');
  const stats = await calculateDialReachBookedRealtime(email);
  
  if (stats && stats.length > 0) {
    const agentStats = stats[0];
    console.log(`   ✅ Stats found:`);
    console.log(`      Dialed: ${agentStats.dialed}`);
    console.log(`      Reached: ${agentStats.reached}`);
    console.log(`      Booked: ${agentStats.booked}`);
  } else {
    console.log(`   ⚠️ No dial/reach/booked stats found`);
  }
  
  // 4. Simulate leaderboard logic
  console.log('\n📊 SIMULATING LEADERBOARD LOGIC:\n');
  
  const connectsCount = connects?.length || 0;
  const dialsCount = stats && stats.length > 0 ? stats[0].dials || 0 : 0;
  const hasActivity = dialsCount > 0 || connectsCount > 0;
  
  console.log(`   Dials: ${dialsCount}`);
  console.log(`   Connects: ${connectsCount}`);
  console.log(`   Has activity (dials > 0 OR connects > 0): ${hasActivity}`);
  console.log(`   In hierarchy: ${!!hierarchy}`);
  
  if (!hasActivity) {
    console.log(`   ❌ WOULD BE FILTERED OUT: No dials and no connects`);
  } else if (!hierarchy) {
    console.log(`   ⚠️ NOT IN HIERARCHY but has activity - should still show (we fixed this)`);
  } else {
    console.log(`   ✅ SHOULD APPEAR on leaderboard`);
  }
  
  // 5. Check vdp_calls for connects (before they're billed)
  console.log('\n📊 Checking vdp_calls for connects...');
  const { data: vdpCalls, error: vdpError } = await supabaseAdmin
    .from('vdp_calls')
    .select('company_email, event, updated_at')
    .or('event.eq.PICK_UP,event.eq.pick_up,event.eq.PICKUP')
    .gte('updated_at', start.toISOString())
    .lt('updated_at', end.toISOString())
    .ilike('company_email', '%fouzieh%');
  
  if (vdpError) {
    console.error('❌ Error:', vdpError);
  } else {
    console.log(`   Found ${vdpCalls?.length || 0} vdp_calls with PICK_UP for fouzieh`);
    if (vdpCalls && vdpCalls.length > 0) {
      console.log(`   Sample:`);
      for (const call of vdpCalls.slice(0, 5)) {
        console.log(`      - ${call.company_email} | ${call.event} | ${call.updated_at}`);
      }
    }
  }
  
  // 6. Check all connects today to see if email format is different
  console.log('\n📊 Checking all agents with connects today...');
  const { data: allConnectsToday, error: allConnectsError } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(100000);
  
  if (allConnectsError) {
    console.error('❌ Error:', allConnectsError);
  } else {
    const allEmails = new Set((allConnectsToday || []).map(t => t.agent_email?.toLowerCase().trim()).filter(Boolean));
    const sortedEmails = Array.from(allEmails).sort();
    console.log(`   Total unique agents with connects today: ${sortedEmails.length}`);
    
    // Check if fouzieh appears in any form
    const fouziehMatches = sortedEmails.filter(e => e.includes('fouzieh'));
    if (fouziehMatches.length > 0) {
      console.log(`   ⚠️ Found fouzieh matches: ${fouziehMatches.join(', ')}`);
    } else {
      console.log(`   ❌ No fouzieh found in connects today`);
      console.log(`   First 20 agents with connects:`, sortedEmails.slice(0, 20));
    }
  }
  
  // 7. Check what the actual leaderboard query returns
  console.log('\n📊 Testing actual leaderboard query...');
  
  // Get all hierarchy
  const { data: allHierarchy } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email, agent_name')
    .not('agent_email', 'is', null);
  
  // Get all connects
  const { data: allConnects } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(100000);
  
  const allHierarchyMap = new Map();
  (allHierarchy || []).forEach(row => {
    if (row.agent_email) {
      allHierarchyMap.set(row.agent_email.toLowerCase().trim(), row);
    }
  });
  
  const connectsByAgent = new Map();
  (allConnects || []).forEach(tx => {
    const email = tx.agent_email?.toLowerCase().trim();
    if (email) {
      connectsByAgent.set(email, (connectsByAgent.get(email) || 0) + 1);
      
      // If agent not in hierarchy, add them (this is what we fixed)
      if (!allHierarchyMap.has(email)) {
        allHierarchyMap.set(email, {
          agent_email: email,
          agent_name: email.split('@')[0].replace(/([a-z])([A-Z])/g, '$1 $2')
        });
      }
    }
  });
  
  const emailLower = email.toLowerCase().trim();
  const hasInMap = allHierarchyMap.has(emailLower);
  const connectsCountInMap = connectsByAgent.get(emailLower) || 0;
  
  console.log(`   In allHierarchyMap after processing connects: ${hasInMap}`);
  console.log(`   Connects count: ${connects}`);
  
  // Check if they would pass the filter
  const statsMap = new Map();
  if (stats && stats.length > 0) {
    statsMap.set(emailLower, {
      dialed: stats[0].dialed,
      reached: stats[0].reached,
      booked: stats[0].booked
    });
  }
  
  const agentDials = statsMap.get(emailLower)?.dialed || 0;
  const agentConnects = connectsByAgent.get(emailLower) || 0;
  const wouldShow = agentDials > 0 || agentConnects > 0;
  
  console.log(`\n📊 FINAL FILTER CHECK:`);
  console.log(`   Agent dials: ${agentDials}`);
  console.log(`   Agent connects: ${agentConnects}`);
  console.log(`   Filter: dials > 0 OR connects > 0`);
  console.log(`   Would show: ${wouldShow}`);
  
  if (!wouldShow) {
    console.log(`   ❌ PROBLEM: Would be filtered out because both dials and connects are 0`);
    console.log(`   But we found ${connectsCount} connects! There's a mismatch.`);
  }
}

checkFouziehsaad()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
