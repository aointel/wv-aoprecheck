import https from 'https';

// Test comprehensive Twilio API access
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

if (!twilioAccountSid || !twilioAuthToken) {
  console.log('❌ Missing Twilio credentials');
  process.exit(1);
}

console.log('🎯 COMPREHENSIVE TWILIO CALL TRACKING TEST');
console.log('📞 Account SID:', twilioAccountSid.substring(0, 10) + '...');

// Create auth header
const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

const today = new Date();
today.setHours(0, 0, 0, 0);

const options = {
  hostname: 'api.twilio.com',
  port: 443,
  path: `/2010-04-01/Accounts/${twilioAccountSid}/Calls.json?StartTime%3E=${today.toISOString()}&PageSize=1000`,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  }
};

console.log('📞 Fetching ALL calls from Twilio for today...');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      const calls = response.calls || [];
      
      console.log(`📞 TWILIO RESPONSE: Found ${calls.length} total calls today`);
      
      // Analyze all calls
      let outboundCalls = 0;
      let inboundCalls = 0;
      let agentStats = {};
      
      calls.forEach(call => {
        console.log(`📞 Call: ${call.direction} | From: ${call.from} | To: ${call.to} | Duration: ${call.duration}s | Status: ${call.status}`);
        
        if (call.direction === 'outbound-api' || call.direction === 'outbound-dial') {
          outboundCalls++;
          
          // Map phone numbers to agents
          let agentEmail = 'unknown';
          if (call.from === '+16052500834' || call.from === '+19142289324') {
            agentEmail = 'davidfulfer@aoglobelife.com';
          } else if (call.from && call.from.includes('+1')) {
            agentEmail = 'kingsleyibeh@aoglobelife.com';
          }
          
          if (!agentStats[agentEmail]) {
            agentStats[agentEmail] = { dials: 0, reached: 0, duration: 0 };
          }
          
          agentStats[agentEmail].dials++;
          agentStats[agentEmail].duration += parseInt(call.duration || 0);
          
          if (call.duration && parseInt(call.duration) >= 30) {
            agentStats[agentEmail].reached++;
          }
        } else if (call.direction === 'inbound') {
          inboundCalls++;
        }
      });
      
      console.log('\n🎯 COMPREHENSIVE CALL ANALYSIS:');
      console.log(`📞 Total Calls: ${calls.length}`);
      console.log(`📞 Outbound Calls: ${outboundCalls}`);
      console.log(`📞 Inbound Calls: ${inboundCalls}`);
      
      console.log('\n🎯 AGENT OUTBOUND STATS:');
      Object.entries(agentStats).forEach(([agent, stats]) => {
        console.log(`📞 ${agent}: ${stats.dials} dials, ${stats.reached} reached (30+s), ${stats.duration}s total`);
      });
      
      if (outboundCalls === 0) {
        console.log('\n⚠️ NO OUTBOUND CALLS FOUND - Make some test calls to see data');
      }
      
    } catch (error) {
      console.error('❌ Error parsing Twilio response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Twilio API request failed:', error.message);
});

req.end();