// Use built-in fetch (Node 18+) or http module
const http = require('http');
const https = require('https');
const { URL } = require('url');

const USER_EMAIL = 'cnsysop@aoglobelife.com';
const API_URL = `http://localhost:5000/api/aoi-reports/check-blocking/${encodeURIComponent(USER_EMAIL)}`;

function testBlockingAPI() {
  console.log(`\n🔍 Testing blocking API endpoint...\n`);
  console.log(`URL: ${API_URL}\n`);

  const url = new URL(API_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 5000,
    path: url.pathname,
    method: 'GET',
    headers: {
      'x-user-email': USER_EMAIL
    }
  };

  const client = url.protocol === 'https:' ? https : http;

  const req = client.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const responseData = JSON.parse(data);
        console.log('📊 Blocking Status Response:');
        console.log(JSON.stringify(responseData, null, 2));
        
        console.log(`\n📋 Summary:`);
        console.log(`   - Has pending reports: ${responseData.hasPendingReports}`);
        console.log(`   - Pending count: ${responseData.pendingCount}`);
        console.log(`   - Booked calls without appointments: ${responseData.bookedCallsWithoutAppointments || 0}`);
        console.log(`   - Has overdue appointments: ${responseData.hasOverdueAppointments || false}`);
        console.log(`   - Overdue appointments count: ${responseData.overdueAppointmentsCount || 0}`);
        console.log(`   - Must resolve reports: ${responseData.mustResolveReports}`);
        
        if (responseData.mustResolveReports) {
          console.log(`\n✅ SHOULD BE BLOCKING!`);
        } else {
          console.log(`\n❌ NOT BLOCKING - Check why:`);
          if ((responseData.bookedCallsWithoutAppointments || 0) === 0) {
            console.log(`   - No booked calls without appointments found (but we know there are 18!)`);
            console.log(`   - Check server console logs for "📅 Found" messages`);
          }
          if (!responseData.hasOverdueAppointments) {
            console.log(`   - No overdue appointments found`);
          }
        }
      } catch (error) {
        console.error('❌ Error parsing response:', error.message);
        console.error('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
    console.error('   Make sure the server is running on localhost:5000');
  });

  req.end();
}

testBlockingAPI();

