#!/usr/bin/env node

/**
 * Test script to verify /api/war/connects-for-review endpoint
 * Run: node test-connects-api.js
 */

const https = require('https');
const http = require('http');

const agentEmail = 'cnsysop@aoglobelife.com';
const baseUrl = 'https://aoirail-production-baa2.up.railway.app';
const endpoint = `/api/war/connects-for-review?agentEmail=${encodeURIComponent(agentEmail)}`;

console.log('🧪 Testing API endpoint:', `${baseUrl}${endpoint}`);
console.log('📧 Agent Email:', agentEmail);
console.log('');

const url = new URL(`${baseUrl}${endpoint}`);
const client = url.protocol === 'https:' ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = client.request(options, (res) => {
  console.log('📡 Response Status:', res.statusCode);
  console.log('📡 Response Headers:', res.headers);
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ Response Body:');
      console.log(JSON.stringify(json, null, 2));
      console.log('');
      
      if (Array.isArray(json)) {
        console.log(`📊 Array length: ${json.length}`);
        if (json.length > 0) {
          console.log('📋 First item:');
          console.log(JSON.stringify(json[0], null, 2));
        } else {
          console.log('⚠️  Array is empty!');
        }
      } else {
        console.log('⚠️  Response is not an array!');
        console.log('Type:', typeof json);
      }
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.end();
