/**
 * Test the inbound call dashboard endpoints to see what data they return
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
      console.log(`📊 Response:`, JSON.stringify(data, null, 2));
      
      if (data.agents) {
        console.log(`\n👥 Agents found: ${data.agents.length}`);
        if (data.agents.length > 0) {
          console.log(`   First agent:`, JSON.stringify(data.agents[0], null, 2));
        }
      }
      
      if (data.summary) {
        console.log(`\n📈 Summary:`, data.summary);
      }
      
      if (data.activeCalls) {
        console.log(`\n📞 Active calls: ${data.activeCalls.length}`);
      }
      
      if (data.waitingCalls) {
        console.log(`\n⏳ Waiting calls: ${data.waitingCalls.length}`);
      }
      
      if (data.queueStats) {
        console.log(`\n📊 Queue stats:`, data.queueStats);
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
  console.log('INBOUND CALL DASHBOARD ENDPOINT TESTS');
  console.log('═'.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  
  await testEndpoint('Agent Availability', '/api/inbound-calls/agent-availability');
  await testEndpoint('Active Calls', '/api/inbound-calls/active');
  await testEndpoint('Queue Stats', '/api/inbound-calls/queue-stats');
  await testEndpoint('Callback Stats', '/api/inbound-calls/callback-stats');
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ TESTS COMPLETE');
  console.log('═'.repeat(60));
}

runTests();
