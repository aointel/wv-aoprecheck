#!/usr/bin/env node

/**
 * Test the Usage Report API endpoint directly
 */

const fetch = require('node-fetch');

const API_URL = 'https://aoirail-production.up.railway.app/api/usage/weekly-stats-all';

async function testUsageAPI() {
  try {
    console.log('🧪 Testing Usage Report API...');
    console.log(`📡 Calling: ${API_URL}`);
    
    const response = await fetch(API_URL);
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API returned error:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    console.log(`📊 Number of agent records: ${data.stats?.length || 0}`);
    
    if (data.stats && data.stats.length > 0) {
      console.log('\n📋 Agent Stats:');
      data.stats.forEach(stat => {
        console.log(`  - ${stat.agent_email}: ${stat.total_logins} logins, ${stat.total_dials_made} dials, ${stat.sales_made} sales`);
      });
    } else {
      console.log('⚠️ NO DATA RETURNED - stats array is empty');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUsageAPI();

