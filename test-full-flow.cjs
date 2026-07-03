const https = require('https');

function makeRequest(options, payload) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk.toString());
      response.on('end', () => resolve({ status: response.statusCode, body: data }));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function testFlow() {
  console.log('🧪 Testing full presentation flow...\n');
  
  // Step 1: Start presentation
  console.log('1️⃣ Starting presentation...');
  const startPayload = JSON.stringify({
    agent_email: "test@test.com",
    agent_name: "Test Agent",
    presentation_url: "https://test.com",
    presentation_type: "hppro",
    window_title: "HP-PRO Test"
  });
  
  const startOptions = {
    hostname: 'aoirail-production.up.railway.app',
    port: 443,
    path: '/api/presentations/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(startPayload)
    }
  };
  
  const startResponse = await makeRequest(startOptions, startPayload);
  console.log('   Status:', startResponse.status);
  console.log('   Response:', startResponse.body.substring(0, 200));
  
  if (startResponse.status !== 200) {
    console.log('❌ FAILED to start presentation');
    return;
  }
  
  const { sessionId } = JSON.parse(startResponse.body);
  console.log('   ✅ Session created:', sessionId);
  
  // Step 2: Upload screenshot
  console.log('\n2️⃣ Uploading screenshot...');
  const screenshotPayload = JSON.stringify({
    sessionId: sessionId,
    screenshotUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  });
  
  const screenshotOptions = {
    hostname: 'aoirail-production.up.railway.app',
    port: 443,
    path: '/api/live-call-board/presentations/screenshot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(screenshotPayload)
    }
  };
  
  const screenshotResponse = await makeRequest(screenshotOptions, screenshotPayload);
  console.log('   Status:', screenshotResponse.status);
  console.log('   Response:', screenshotResponse.body.substring(0, 200));
  
  if (screenshotResponse.status === 200) {
    console.log('\n✅ SUCCESS - FULL FLOW WORKING!');
  } else {
    console.log('\n❌ FAILED - Screenshot upload failed');
  }
}

testFlow().catch(err => console.error('❌ Error:', err));

