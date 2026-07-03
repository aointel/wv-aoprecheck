#!/usr/bin/env node

/**
 * Script to test duration validation for lead assignment
 * Tests that leads are NOT assigned if duration < 45 seconds
 */

import fetch from 'node-fetch';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function testDurationValidation() {
  console.log('🔍 TESTING DURATION VALIDATION FOR LEAD ASSIGNMENT\n');
  console.log('='.repeat(60));

  const testCases = [
    { duration: 0, shouldPass: false, description: 'Zero duration' },
    { duration: 10, shouldPass: false, description: '10 seconds (too short)' },
    { duration: 30, shouldPass: false, description: '30 seconds (too short)' },
    { duration: 44, shouldPass: false, description: '44 seconds (just below threshold)' },
    { duration: 45, shouldPass: true, description: '45 seconds (exact threshold)' },
    { duration: 46, shouldPass: true, description: '46 seconds (above threshold)' },
    { duration: 60, shouldPass: true, description: '60 seconds (well above threshold)' },
    { duration: 120, shouldPass: true, description: '120 seconds (2 minutes)' },
    { duration: null, shouldPass: false, description: 'Null duration' },
    { duration: undefined, shouldPass: false, description: 'Undefined duration' },
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    const { duration, shouldPass, description } = testCase;
    
    try {
      console.log(`\n📋 Test: ${description}`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Expected: ${shouldPass ? '✅ PASS (assign lead)' : '❌ BLOCK (reject assignment)'}`);

      const response = await fetch(`${API_BASE_URL}/api/hotleads/assign-to-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (shouldPass) {
        // Should pass - either success OR blocked (because dummy lead doesn't exist, but validation passed)
        if (actualBlocked && result.error.includes('at least 45 seconds')) {
          // Actually blocked by duration check - this is wrong if shouldPass is true
          console.log(`   ❌ FAIL: Assignment was blocked by duration validation (should have passed)`);
          console.log(`   Response: ${JSON.stringify(result)}`);
          failedTests++;
        } else {
          // Validation passed (might fail on lead not found, but duration check passed)
          if (actualBlocked && !result.error.includes('duration')) {
            console.log(`   ✅ PASS: Duration validation passed (assignment failed for other reason: ${result.error})`);
            passedTests++;
          } else if (actualPassed) {
            console.log(`   ✅ PASS: Assignment succeeded`);
            passedTests++;
          } else {
            console.log(`   ✅ PASS: Duration validation passed (status: ${response.status})`);
            passedTests++;
          }
        }
      } else {
        // Should be blocked
        if (actualBlocked && result.error.includes('duration')) {
          console.log(`   ✅ PASS: Assignment correctly blocked by duration validation`);
          console.log(`   Error: ${result.error}`);
          passedTests++;
        } else {
          console.log(`   ❌ FAIL: Assignment was NOT blocked (should have been blocked)`);
          console.log(`   Response: ${JSON.stringify(result)}`);
          console.log(`   Status: ${response.status}`);
          failedTests++;
        }
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failedTests++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   Total: ${testCases.length}`);
  
  if (failedTests === 0) {
    console.log(`\n🎉 ALL TESTS PASSED! Duration validation is working correctly.`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  SOME TESTS FAILED! Duration validation may not be working correctly.`);
    process.exit(1);
  }
}

// Run the tests
testDurationValidation().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
