const http = require('http');

const postData = JSON.stringify({
  leadId: '44',
  agentEmail: 'chrislafond@aoglobelife.com',
  duration: 125,
  autoAssigned: true,
  reason: 'test_zapier_and_transfer'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/hotleads/assign-to-agent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Assignment Response:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Raw Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error: ${e.message}`);
});

req.write(postData);
req.end();