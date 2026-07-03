// Test 3-day comprehensive Twilio pull
import https from 'https';

async function testTwilio3Days() {
  try {
    console.log('🎯 TESTING 3-DAY TWILIO COMPREHENSIVE PULL');
    
    const response = await fetch('http://localhost:5000/api/analytics/live-stats');
    const data = await response.json();
    
    console.log('📊 CURRENT LIVE STATS:');
    console.log(`Total Dials: ${data.totals.total_dials}`);
    console.log(`Total Reached: ${data.totals.total_reached}`);
    console.log(`Total Booked: ${data.totals.total_booked}`);
    
    console.log('\n👥 AGENT BREAKDOWN:');
    data.agents.forEach(agent => {
      if (agent.dials > 0) {
        console.log(`${agent.name}: ${agent.dials} dials, ${agent.reached} reached, ${agent.booked} booked`);
      }
    });
    
    // Now test the manual monitoring trigger
    console.log('\n🔄 Manual monitoring trigger - checking logs...');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTwilio3Days();