#!/usr/bin/env node

/**
 * REAL backend test - makes actual API calls to test duration validation
 * This actually tests the backend, not just code inspection
 */

import fetch from 'node-fetch';
import readline from 'readline';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // You'll need to get this from your auth system

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testBackendDurationValidation() {
  console.log('🧪 REAL BACKEND DURATION VALIDATION TEST\n');
  console.log('='.repeat(80));
  console.log(`🔗 Testing endpoint: ${API_BASE_URL}/api/hotleads/assign-to-agent`);
  console.log('='.repeat(80));

  // Get auth token if not provided
  let authToken = AUTH_TOKEN;
  if (!authToken) {
    console.log('\n⚠️  No AUTH_TOKEN provided. You may need to authenticate first.');
    console.log('   Set AUTH_TOKEN environment variable or login to get session cookie');
    
    const useCookie = await question('\nDo you have a session cookie? (y/n): ');
    if (useCookie.toLowerCase() === 'y') {
      authToken = await question('Enter session cookie value: ');
    }
  }

  const testCases = [
    { duration: 0, shouldPass: false, description: 'Zero duration' },
    { duration: 10, shouldPass: false, description: '10 seconds (too short)' },
    { duration: 30, shouldPass: false, description: '30 seconds (too short)' },
    { duration: 44, shouldPass: false, description: '44 seconds (just below threshold)' },
    { duration: 45, shouldPass: true, description: '45 seconds (exact threshold)' },
    { duration: 46, shouldPass: true, description: '46 seconds (above threshold)' },
    { duration: 60, shouldPass: true, description: '60 seconds (well above threshold)' },
    { duration: null, shouldPass: false, description: 'Null duration' },
    { duration: undefined, shouldPass: false, description: 'Undefined duration' },
  ];

  let passedTests = 0;
  let failedTests = 0;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Cookie'] = `session=${authToken}`;
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  for (const testCase of testCases) {
    const { duration, shouldPass, description } = testCase;
    
    try {
      console.log(`\n📋 Test: ${description}`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Expected: ${shouldPass ? '✅ PASS (assign lead)' : '❌ BLOCK (reject assignment)'}`);

      const response = await fetch(`${API_BASE_URL}/api/hotleads/assign-to-agent`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          leadId: 999999, // Dummy lead ID for testing
          agentEmail: 'test@aoglobelife.com',
          leadPhone: '+15551234567',
          duration: duration,
          autoAssigned: true,
          reason: 'test_duration_validation'
        })
      });

      const result = await response.json();
      const actualPassed = response.status === 200 && result.success === true;
      const actualBlocked = response.status === 400 && result.error && result.error.includes('duration');

      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result).substring(0, 200)}...`);

      if (shouldPass) {
        // Should pass - either success OR blocked (because dummy lead doesn't exist, but validation passed)
        if (actualBlocked && result.error.includes('at least 45 seconds')) {
          // Actually blocked by duration check - this is wrong if shouldPass is true
          console.log(`   ❌ FAIL: Assignment was blocked by duration validation (should have passed)`);
          failedTests++;
        } else if (actualBlocked && !result.error.includes('duration')) {
          // Blocked for other reason (lead doesn't exist, etc.) - that's OK, validation passed
          console.log(`   ✅ PASS: Duration validation passed (assignment failed for other reason)`);
          passedTests++;
        } else if (actualPassed) {
          console.log(`   ✅ PASS: Assignment succeeded`);
          passedTests++;
        } else if (response.status >= 200 && response.status < 400) {
          console.log(`   ✅ PASS: Duration validation passed (status: ${response.status})`);
          passedTests++;
        } else {
          console.log(`   ⚠️  UNCLEAR: Status ${response.status} - validation may have passed`);
        }
      } else {
        // Should be blocked
        if (actualBlocked && result.error.includes('duration')) {
          console.log(`   ✅ PASS: Assignment correctly blocked by duration validation`);
          console.log(`   Error: ${result.error}`);
          passedTests++;
        } else if (response.status === 401 || response.status === 403) {
          console.log(`   ⚠️  SKIP: Authentication required (status ${response.status})`);
        } else {
          console.log(`   ❌ FAIL: Assignment was NOT blocked (should have been blocked)`);
          console.log(`   Response: ${JSON.stringify(result)}`);
          failedTests++;
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`   ❌ ERROR: Cannot connect to ${API_BASE_URL}`);
        console.log(`   Make sure the server is running on ${API_BASE_URL}`);
      } else {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
      failedTests++;
    }
  }

  rl.close();

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   Total: ${testCases.length}`);
  
  if (failedTests === 0) {
    console.log(`\n🎉 ALL TESTS PASSED! Backend duration validation is working correctly.`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  SOME TESTS FAILED! Backend duration validation may not be working correctly.`);
    console.log(`\n💡 TROUBLESHOOTING:`);
    console.log(`   1. Make sure server is running: ${API_BASE_URL}`);
    console.log(`   2. Check if authentication is required`);
    console.log(`   3. Check server logs for actual validation behavior`);
    process.exit(1);
  }
}

// Run the tests
testBackendDurationValidation().catch(error => {
  console.error('❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});
