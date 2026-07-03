// EMERGENCY: Direct server-side check for Chris LaFond's call
const fetch = require('node-fetch');

async function emergencyTwilioDataRecovery() {
  console.log('🚨 EMERGENCY: DIRECT SERVER SEARCH FOR CHRIS LAFOND CALL');
  
  try {
    // Use the server's Twilio sync endpoint to force immediate check
    const response = await fetch('http://localhost:5000/api/sync-twilio-calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Forced Twilio sync result:', result);
    } else {
      console.log('❌ Sync request failed:', response.status);
    }
    
    // Now check the database again
    const statsResponse = await fetch('http://localhost:5000/api/analytics/live-stats');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('\n📊 CURRENT LIVE STATS:');
      console.log('Total dials:', stats.totals?.total_dials);
      
      stats.agents?.forEach(agent => {
        if (agent.email.includes('chrislafond')) {
          console.log(`🎯 CHRIS LAFOND: ${agent.dials} dials, ${agent.reached} reached`);
        }
      });
    }
    
    // Check specific call logs endpoint
    const callsResponse = await fetch('http://localhost:5000/api/twilio-calls');
    if (callsResponse.ok) {
      const calls = await callsResponse.json();
      console.log(`\n📞 TWILIO CALLS ENDPOINT: ${calls.length || 0} total calls`);
      
      const chrisCalls = calls.filter(call => 
        call.owner_email?.includes('chrislafond') || 
        call.from_number?.includes('chrislafond') ||
        call.to_number?.includes('chrislafond')
      );
      
      if (chrisCalls.length > 0) {
        console.log(`🎯 FOUND ${chrisCalls.length} CHRIS CALLS:`);
        chrisCalls.forEach((call, i) => {
          console.log(`${i+1}. ${call.call_started_at}`);
          console.log(`   ${call.from_number} → ${call.to_number}`);
          console.log(`   Duration: ${call.call_duration}s`);
          console.log(`   Owner: ${call.owner_email}`);
        });
      } else {
        console.log('❌ No Chris calls in API endpoint');
      }
    }
    
  } catch (error) {
    console.error('❌ Emergency recovery failed:', error);
  }
}

emergencyTwilioDataRecovery();