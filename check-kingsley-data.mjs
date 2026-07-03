// Check Kingsley's masterlead data to see why reached = 0
import fetch from 'node-fetch';

async function checkKingsleyData() {
  const email = 'kingsleyibeh@aoglobelife.com';
  
  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`\n🔍 Checking masterlead data for ${email}`);
    console.log(`📅 Today: ${today.toISOString()}\n`);
    
    // Query the API
    const response = await fetch('https://aoirail-production.up.railway.app/api/leaderboard');
    const data = await response.json();
    
    // Find Kingsley
    const kingsley = data.leaderboard?.find(agent => agent.email === email);
    
    if (kingsley) {
      console.log('✅ Found Kingsley in leaderboard:');
      console.log(JSON.stringify(kingsley, null, 2));
    } else {
      console.log('❌ Kingsley NOT found in leaderboard');
      console.log('\nAll agents:');
      data.leaderboard?.forEach(agent => {
        console.log(`  - ${agent.agentName} (${agent.email}): Dials=${agent.dials}, Reached=${agent.reaches}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkKingsleyData();

