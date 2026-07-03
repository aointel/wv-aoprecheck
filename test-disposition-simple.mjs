// Simple test script to check if disposition endpoint exists and test validation
import https from 'https';
import http from 'http';

const BASE_URL = process.env.API_URL || 'https://aoi-rail.onrender.com';

console.log('🔍 Testing Disposition Endpoint\n');
console.log(`📍 URL: ${BASE_URL}/api/outbound-dialer/save-disposition\n`);

// Test 1: Check if endpoint exists (missing fields should return 400, not 404)
console.log('Test 1: Missing required fields (should return 400, not 404)');
const test1 = {
  body: {
    // Missing leadId and disposition
    agentEmail: 'test@aoglobelife.com'
  }
};

// Test 2: Valid structure but fake data
console.log('\nTest 2: Valid structure with fake data');
const test2 = {
  body: {
    leadId: 999999, // Non-existent lead
    disposition: 'booked',
    agentEmail: 'test@aoglobelife.com',
    leadPhone: '+15551234567',
    callDuration: 120
  }
};

function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/api/outbound-dialer/save-disposition',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = JSON.parse(responseData);
        } catch (e) {
          parsedData = responseData;
        }
        
        resolve({
          status: res.statusCode,
          data: parsedData,
          raw: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  try {
    console.log('Sending request...');
    const response = await makeRequest(test1.body);
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));
    
    if (response.status === 404) {
      console.log('\n❌ Endpoint not found (404)');
      console.log('   This means the route might not exist or the URL is wrong.');
      console.log('   Check:');
      console.log('   1. Is the server running?');
      console.log('   2. Is the route path correct?');
      console.log('   3. Is there a proxy/load balancer in front?');
    } else if (response.status === 400) {
      console.log('\n✅ Endpoint exists! Got 400 as expected for missing fields.');
    } else {
      console.log(`\n⚠️  Got status ${response.status} - endpoint exists but unexpected response`);
    }
    
    // Try test 2
    console.log('\n' + '='.repeat(60));
    console.log('Test 2: Valid structure');
    const response2 = await makeRequest(test2.body);
    console.log(`Status: ${response2.status}`);
    console.log(`Response:`, JSON.stringify(response2.data, null, 2));
    
    if (response2.status === 404) {
      console.log('   Lead not found (expected if leadId 999999 doesn\'t exist)');
    } else if (response2.status === 400) {
      console.log('   Validation error (check if it\'s the answer validation)');
    } else if (response2.status === 500) {
      console.log('   Server error - check server logs');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('   Full error:', error);
  }
}

runTests();


