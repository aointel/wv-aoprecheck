require('dotenv').config();
const fetch = require('node-fetch');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

async function getTodaysCalls() {
  try {
    console.log('✅ Fetching TODAY\'S Twilio calls...\n');

    // TODAY - October 23, 2024
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // 2024-10-23
    
    console.log(`📅 Today's date: ${todayStr}\n`);

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    // Get ALL calls from today
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=${todayStr}&PageSize=1000`;
    
    console.log(`🔍 Querying: ${url}\n`);
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    const data = await response.json();
    const calls = data.calls || [];

    console.log(`📊 Total calls today: ${calls.length}\n`);

    if (calls.length === 0) {
      console.log('❌ NO CALLS FOUND TODAY');
      return;
    }

    // Show all calls
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ALL CALLS TODAY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    calls.forEach((call, i) => {
      console.log(`${i + 1}. ${call.sid}`);
      console.log(`   ${call.from} → ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Direction: ${call.direction}`);
      console.log(`   Started: ${call.start_time}\n`);
    });

    // Filter for outbound over 60s
    const outboundLong = calls.filter(c => 
      c.direction === 'outbound-dial' &&
      c.status === 'completed' &&
      parseInt(c.duration) >= 60
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔥 OUTBOUND CALLS OVER 60s: ${outboundLong.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    outboundLong.forEach((call, i) => {
      console.log(`${i + 1}. ${call.sid}`);
      console.log(`   ${call.from} → ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Started: ${call.start_time}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getTodaysCalls();

