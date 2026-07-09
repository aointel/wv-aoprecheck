require('dotenv').config();
const fetch = require('node-fetch');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

async function analyzeCalls() {
  try {
    console.log('✅ Connecting to Twilio API\n');

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0];

    console.log(`🔍 Fetching calls from ${startDate}...\n`);

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=${startDate}&PageSize=1000`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    const data = await response.json();
    const calls = data.calls || [];

    console.log(`📊 Total calls: ${calls.length}\n`);

    // Analyze durations
    const durations = calls.map(c => parseInt(c.duration) || 0);
    const maxDuration = Math.max(...durations);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    console.log(`⏱️  Duration Analysis:`);
    console.log(`   Max: ${maxDuration}s`);
    console.log(`   Avg: ${avgDuration.toFixed(1)}s`);
    console.log(`   Over 60s: ${durations.filter(d => d >= 60).length}`);
    console.log(`   Over 30s: ${durations.filter(d => d >= 30).length}`);
    console.log(`   Over 10s: ${durations.filter(d => d >= 10).length}\n`);

    // Show call statuses
    const statuses = {};
    calls.forEach(c => {
      statuses[c.status] = (statuses[c.status] || 0) + 1;
    });

    console.log(`📊 Call Statuses:`);
    for (const [status, count] of Object.entries(statuses)) {
      console.log(`   ${status}: ${count}`);
    }
    console.log('');

    // Show directions
    const directions = {};
    calls.forEach(c => {
      directions[c.direction] = (directions[c.direction] || 0) + 1;
    });

    console.log(`📊 Call Directions:`);
    for (const [direction, count] of Object.entries(directions)) {
      console.log(`   ${direction}: ${count}`);
    }
    console.log('');

    // Show top 20 longest calls
    const sorted = calls.sort((a, b) => parseInt(b.duration) - parseInt(a.duration));
    
    console.log('🔥 TOP 20 LONGEST CALLS:\n');
    sorted.slice(0, 20).forEach((call, i) => {
      console.log(`${i + 1}. ${call.sid}`);
      console.log(`   ${call.from} → ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Direction: ${call.direction}`);
      console.log(`   Started: ${call.start_time}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeCalls();

