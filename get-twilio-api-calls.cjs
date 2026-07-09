require('dotenv').config();
const fetch = require('node-fetch');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

async function getTwilioCalls() {
  try {
    console.log('✅ Connecting to Twilio API\n');

    // Get calls from last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`🔍 Fetching calls from Twilio (StartTime >= ${startDate})...\n`);

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=${startDate}&PageSize=1000`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Twilio API Error:', error);
      return;
    }

    const data = await response.json();
    const calls = data.calls || [];

    console.log(`📊 Total calls from Twilio API: ${calls.length}\n`);

    if (calls.length === 0) {
      console.log('No calls found');
      return;
    }

    // Filter for completed calls over 60 seconds
    const longCalls = calls.filter(c => 
      c.status === 'completed' && 
      parseInt(c.duration) >= 60 &&
      c.direction === 'outbound-api'
    );

    console.log(`🔥 Calls over 60 seconds: ${longCalls.length}\n`);

    // Group by from number (agent)
    const byAgent = {};
    longCalls.forEach(call => {
      const from = call.from;
      if (!byAgent[from]) {
        byAgent[from] = [];
      }
      byAgent[from].push(call);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 60+ SECOND CALLS BY AGENT PHONE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const [from, agentCalls] of Object.entries(byAgent)) {
      console.log(`📞 ${from} (${agentCalls.length} calls)`);
      agentCalls.slice(0, 10).forEach((call, i) => {
        console.log(`   ${i + 1}. To: ${call.to} | ${call.duration}s | ${call.start_time}`);
      });
      if (agentCalls.length > 10) {
        console.log(`   ... and ${agentCalls.length - 10} more`);
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ALL 60+ SECOND CALLS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    longCalls.forEach((call, i) => {
      console.log(`${i + 1}. SID: ${call.sid}`);
      console.log(`   From: ${call.from} → To: ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Started: ${call.start_time}`);
      console.log(`   Status: ${call.status}\n`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ TOTAL: ${longCalls.length} calls over 60 seconds`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show unique "to" numbers
    const uniqueTo = [...new Set(longCalls.map(c => c.to))];
    console.log(`📞 Unique phone numbers called: ${uniqueTo.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getTwilioCalls();

