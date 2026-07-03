#!/usr/bin/env node

const https = require('https');

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'aoirail-production.up.railway.app',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkStatus() {
  console.log('📊 Checking Twilio purchase status...\n');
  
  try {
    const result = await makeRequest('GET', '/api/twilio/list-numbers');
    
    if (result.success) {
      const totalCount = result.numbers?.length || 0;
      const uniqueAreaCodes = new Set(result.numbers?.map(n => {
        const cleaned = n.phoneNumber.replace(/\D/g, '');
        if (cleaned.length === 11) return cleaned.substring(1, 4);
        return cleaned.substring(0, 3);
      })).size;
      
      console.log(`✅ Total numbers purchased: ${totalCount}`);
      console.log(`📍 Unique area codes covered: ${uniqueAreaCodes}`);
      console.log(`💰 Monthly cost: $${totalCount}.00\n`);
      
      // Group by state
      const byState = {};
      result.numbers.forEach(num => {
        const state = num.friendlyName.split('-')[0].replace('State ', '');
        byState[state] = (byState[state] || 0) + 1;
      });
      
      console.log('📊 Numbers by State:');
      Object.entries(byState)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([state, count]) => {
          console.log(`   ${state}: ${count} numbers`);
        });
    } else {
      console.log('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

checkStatus();

