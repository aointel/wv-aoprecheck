require('dotenv').config();
const fetch = require('node-fetch');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

async function getOct2024Calls() {
  try {
    console.log('✅ Fetching calls from OCTOBER 2024...\n');

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    // Query for October 23, 2024
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=2024-10-23&EndTimeBefore=2024-10-24&PageSize=1000`;
    
    console.log(`🔍 Querying: October 23, 2024\n`);
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    const data = await response.json();
    const calls = data.calls || [];

    console.log(`📊 Total calls on Oct 23, 2024: ${calls.length}\n`);

    if (calls.length === 0) {
      console.log('❌ NO CALLS FOUND ON OCTOBER 23, 2024');
      console.log('The system date might be wrong, or these are actually 2025 calls\n');
      return;
    }

    // Show first 10 calls
    console.log('First 10 calls:\n');
    calls.slice(0, 10).forEach((call, i) => {
      console.log(`${i + 1}. ${call.sid}`);
      console.log(`   ${call.from} → ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Started: ${call.start_time}\n`);
    });

    // Count outbound over 60s
    const outboundLong = calls.filter(c => 
      c.direction === 'outbound-dial' &&
      c.status === 'completed' &&
      parseInt(c.duration) >= 60
    );

    console.log(`🔥 Outbound calls over 60s on Oct 23, 2024: ${outboundLong.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getOct2024Calls();

