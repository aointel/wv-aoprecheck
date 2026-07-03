/**
 * Test the live call board endpoint to see how it detects agents making calls
 */

const BASE_URL = process.env.BASE_URL || 'https://aoirail-production.up.railway.app';

async function testEndpoint(name, endpoint) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   GET ${endpoint}`);
  console.log('─'.repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Status: ${response.status}`);
      
      if (Array.isArray(data)) {
        console.log(`\n👥 Agents found: ${data.length}`);
        
        // Find agents with active calls
        const agentsWithCalls = data.filter(agent => 
          agent.currentCall || 
          agent.status === 'dialing' || 
          agent.status === 'calling' ||
          agent.status === 'live'
        );
        
        console.log(`\n📞 Agents with active calls: ${agentsWithCalls.length}`);
        
        if (agentsWithCalls.length > 0) {
          console.log(`\n📋 Agents making calls:`);
          agentsWithCalls.slice(0, 10).forEach((agent, idx) => {
            console.log(`\n   ${idx + 1}. ${agent.name || agent.email}`);
            console.log(`      Email: ${agent.email}`);
            console.log(`      Status: ${agent.status}`);
            console.log(`      Current Call:`, agent.currentCall ? JSON.stringify(agent.currentCall, null, 8) : 'None');
            console.log(`      Today Stats:`, agent.todayStats || {});
          });
        }
        
        // Show all agents
        console.log(`\n📋 All agents (first 20):`);
        data.slice(0, 20).forEach((agent, idx) => {
          console.log(`   ${idx + 1}. ${agent.name || agent.email} - Status: ${agent.status}`);
        });
        
      } else {
        console.log(`📊 Response:`, JSON.stringify(data, null, 2));
      }
      
      return true;
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`❌ Error:`, data);
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function runTests() {
  console.log('═'.repeat(60));
  console.log('LIVE CALL BOARD AGENTS TEST');
  console.log('═'.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  
  await testEndpoint('Live Call Board Agents', '/api/live-call-board/agents');
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ TEST COMPLETE');
  console.log('═'.repeat(60));
}

runTests();
