const https = require('https');

const payload = JSON.stringify({
  sessionId: "test-123-456",
  screenshotUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
});

const options = {
  hostname: 'aoirail-production.up.railway.app',
  port: 443,
  path: '/api/live-call-board/presentations/screenshot',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('🧪 Testing screenshot upload endpoint...');
console.log('📤 Sending to:', `https://${options.hostname}${options.path}`);

const request = https.request(options, (response) => {
  let data = '';
  
  response.on('data', (chunk) => {
    data += chunk.toString();
  });
  
  response.on('end', () => {
    console.log('📥 Response Status:', response.statusCode);
    console.log('📥 Response Body:', data);
    
    if (response.statusCode === 200) {
      console.log('✅ SUCCESS - Screenshot endpoint is working!');
    } else {
      console.log('❌ FAILED - Screenshot endpoint returned error');
    }
  });
});

request.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

request.write(payload);
request.end();

