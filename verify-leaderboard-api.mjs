/**
 * VERIFY: Test the actual leaderboard API endpoint to verify hierarchy data is returned
 */

async function verifyLeaderboardAPI() {
  console.log('🧪 VERIFYING LEADERBOARD API ENDPOINT...\n');
  console.log('='.repeat(100));
  
  try {
    // Call the actual leaderboard API
    const response = await fetch('http://localhost:3000/api/leaderboard', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ API returned status ${response.status}: ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text.substring(0, 500)}`);
      return;
    }
    
    const data = await response.json();
    const leaderboard = data?.leaderboard || [];
    
    console.log(`✅ API returned ${leaderboard.length} agents\n`);
    
    // Check hierarchy data
    const agentsWithMga = leaderboard.filter(a => a.mga).length;
    const agentsWithRga = leaderboard.filter(a => a.rga).length;
    const agentsWithBoth = leaderboard.filter(a => a.mga && a.rga).length;
    const agentsWithoutHierarchy = leaderboard.filter(a => !a.mga && !a.rga).length;
    
    console.log('📊 HIERARCHY DATA STATISTICS:');
    console.log(`   Total agents: ${leaderboard.length}`);
    console.log(`   Agents with MGA: ${agentsWithMga} (${Math.round((agentsWithMga / leaderboard.length) * 100)}%)`);
    console.log(`   Agents with RGA: ${agentsWithRga} (${Math.round((agentsWithRga / leaderboard.length) * 100)}%)`);
    console.log(`   Agents with both: ${agentsWithBoth} (${Math.round((agentsWithBoth / leaderboard.length) * 100)}%)`);
    console.log(`   Agents without hierarchy: ${agentsWithoutHierarchy} (${Math.round((agentsWithoutHierarchy / leaderboard.length) * 100)}%)`);
    
    // Show sample agents with hierarchy
    console.log('\n📋 Sample agents WITH hierarchy data:');
    leaderboard.filter(a => a.mga || a.rga).slice(0, 5).forEach((agent, idx) => {
      console.log(`\n  ${idx + 1}. ${agent.agentName} (${agent.email})`);
      console.log(`     MGA: ${agent.mga || 'NULL'}`);
      console.log(`     RGA: ${agent.rga || 'NULL'}`);
      console.log(`     Connects: ${agent.connects || 0}, Dials: ${agent.dials || 0}`);
    });
    
    // Show sample agents WITHOUT hierarchy
    if (agentsWithoutHierarchy > 0) {
      console.log('\n⚠️ Sample agents WITHOUT hierarchy data:');
      leaderboard.filter(a => !a.mga && !a.rga).slice(0, 5).forEach((agent, idx) => {
        console.log(`\n  ${idx + 1}. ${agent.agentName} (${agent.email})`);
        console.log(`     Connects: ${agent.connects || 0}, Dials: ${agent.dials || 0}`);
      });
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('✅ VERIFICATION COMPLETE');
    
    if (agentsWithMga === 0 && agentsWithRga === 0) {
      console.log('\n❌ ISSUE DETECTED: No agents have hierarchy data!');
      console.log('   This indicates the fix did not work properly.');
    } else if (agentsWithoutHierarchy > leaderboard.length * 0.5) {
      console.log('\n⚠️ WARNING: More than 50% of agents are missing hierarchy data.');
      console.log('   This may indicate missing data in agent_hierarchy or agent_profiles.');
    } else {
      console.log('\n✅ SUCCESS: Hierarchy data is being returned correctly!');
    }
    
  } catch (error) {
    console.error('❌ Error calling leaderboard API:', error);
    console.log('\n💡 Make sure the server is running on localhost:3000');
  }
}

verifyLeaderboardAPI().catch(console.error);
