require('dotenv').config();
const fetch = require('node-fetch');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';

async function getAllRecentCalls() {
  try {
    console.log('🚀 FETCHING ALL CALLS FROM LAST 3 DAYS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    // Calculate dates
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);
    
    console.log(`📅 Current time: ${now.toISOString()}`);
    console.log(`📅 3 days ago: ${threeDaysAgo.toISOString()}\n`);
    
    // Get ALL calls - no date filter, just recent ones
    console.log('🔍 Fetching most recent 1000 calls from Twilio API...\n');
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?PageSize=1000`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Twilio API Error:', response.status, error);
      return;
    }

    const data = await response.json();
    const calls = data.calls || [];

    console.log(`📊 Total calls retrieved: ${calls.length}\n`);

    if (calls.length === 0) {
      console.log('❌ NO CALLS FOUND');
      return;
    }

    // Parse dates and filter last 3 days
    const callsWithDates = calls.map(c => ({
      ...c,
      startDate: new Date(c.start_time)
    }));

    const recentCalls = callsWithDates.filter(c => c.startDate >= threeDaysAgo);
    
    console.log(`📊 Calls from last 3 days: ${recentCalls.length}\n`);

    // Show date range
    const dates = callsWithDates.map(c => c.startDate);
    const newest = new Date(Math.max(...dates));
    const oldest = new Date(Math.min(...dates));
    
    console.log('📅 Date range of retrieved calls:');
    console.log(`   Newest: ${newest.toISOString()}`);
    console.log(`   Oldest: ${oldest.toISOString()}\n`);

    // Show breakdown by direction
    const outbound = recentCalls.filter(c => c.direction === 'outbound-dial');
    const inbound = recentCalls.filter(c => c.direction === 'inbound');
    
    console.log('📊 Call breakdown (last 3 days):');
    console.log(`   Outbound-dial: ${outbound.length}`);
    console.log(`   Inbound: ${inbound.length}`);
    console.log(`   Other: ${recentCalls.length - outbound.length - inbound.length}\n`);

    // Outbound calls over 60s
    const outboundLong = outbound.filter(c => 
      c.status === 'completed' &&
      parseInt(c.duration) >= 60
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔥 OUTBOUND CALLS OVER 60 SECONDS: ${outboundLong.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    outboundLong.forEach((call, i) => {
      console.log(`${i + 1}. SID: ${call.sid}`);
      console.log(`   From: ${call.from} → To: ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Started: ${call.start_time}`);
      console.log(`   Real timestamp: ${call.startDate.toISOString()}\n`);
    });

    // Show all outbound calls (even under 60s)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 ALL OUTBOUND CALLS: ${outbound.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Group by duration range
    const ranges = {
      '0-10s': outbound.filter(c => parseInt(c.duration) < 10).length,
      '10-30s': outbound.filter(c => parseInt(c.duration) >= 10 && parseInt(c.duration) < 30).length,
      '30-60s': outbound.filter(c => parseInt(c.duration) >= 30 && parseInt(c.duration) < 60).length,
      '60s+': outbound.filter(c => parseInt(c.duration) >= 60).length
    };

    console.log('⏱️  Duration breakdown:');
    for (const [range, count] of Object.entries(ranges)) {
      console.log(`   ${range}: ${count}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
  }
}

getAllRecentCalls();

