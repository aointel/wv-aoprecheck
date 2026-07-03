#!/usr/bin/env node

const https = require('https');

console.log('🚀 Forcing backend to send lead 18506806...\n');

// Step 1: Call the reset endpoint
const resetOptions = {
  hostname: 'aoirail-production.up.railway.app',
  port: 443,
  path: '/api/webhook/resend-all-booked-leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(resetOptions, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ Backend response:', data);
    console.log('\n🎯 Lead 18506806 is being sent by the backend webhook sender');
    console.log('   Check Railway logs to confirm');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(JSON.stringify({}));
req.end();

