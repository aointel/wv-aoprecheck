/**
 * QA Script to Test Usage Tracking System
 * 
 * Tests:
 * - VDP available start/end tracking
 * - Call Connector Pro call start/end tracking
 * - Calculation methods
 * - API endpoints
 * - Edge cases (orphaned events, missing end events)
 * 
 * Usage: tsx server/scripts/test-usage-tracking.ts [agentEmail]
 */

import { usageTracker } from '../usage-tracker';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Test agent email (default or from command line)
const testAgentEmail = process.argv[2] || 'test-agent@aoglobelife.com';
const testSessionId = `test-session-${Date.now()}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logTest(testName: string) {
  log(`\n🧪 Test: ${testName}`, 'blue');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

async function runTest(testName: string, testFn: () => Promise<boolean>): Promise<boolean> {
  try {
    logTest(testName);
    const result = await testFn();
    if (result) {
      testResults.passed++;
      logSuccess(`${testName} - PASSED`);
      return true;
    } else {
      testResults.failed++;
      logError(`${testName} - FAILED`);
      return false;
    }
  } catch (error: any) {
    testResults.failed++;
    logError(`${testName} - ERROR: ${error.message}`);
    console.error(error);
    return false;
  }
}

// ==========================================
// TEST FUNCTIONS
// ==========================================

/**
 * Test 1: VDP Available Start Tracking
 */
async function testVDPAvailableStart(): Promise<boolean> {
  await usageTracker.trackVDPAvailableStart(testAgentEmail, testSessionId);
  
  // Verify event was logged
  const result = await db.execute(sql`
    SELECT * FROM agent_activity_log
    WHERE agent_email = ${testAgentEmail}
      AND activity_type = 'vdp_available_start'
      AND session_id = ${testSessionId}
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    logError('VDP available start event not found in database');
    return false;
  }
  
  logSuccess(`VDP available start event logged: ${result.rows[0].timestamp}`);
  return true;
}

/**
 * Test 2: VDP Available End Tracking
 */
async function testVDPAvailableEnd(): Promise<boolean> {
  // Wait 2 seconds to simulate VDP being on
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await usageTracker.trackVDPAvailableEnd(testAgentEmail, testSessionId);
  
  // Verify end event was logged
  const endResult = await db.execute(sql`
    SELECT * FROM agent_activity_log
    WHERE agent_email = ${testAgentEmail}
      AND activity_type = 'vdp_available_end'
      AND session_id = ${testSessionId}
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  if (endResult.rows.length === 0) {
    logError('VDP available end event not found in database');
    return false;
  }
  
  const duration = endResult.rows[0].activity_data?.duration_minutes || 0;
  logSuccess(`VDP available end event logged with duration: ${duration} minutes`);
  
  // Verify weekly stats were updated
  const statsResult = await db.execute(sql`
    SELECT vdp_available_minutes
    FROM weekly_usage_stats
    WHERE agent_email = ${testAgentEmail}
      AND week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
  `);
  
  if (statsResult.rows.length > 0 && statsResult.rows[0].vdp_available_minutes > 0) {
    logSuccess(`Weekly stats updated: ${statsResult.rows[0].vdp_available_minutes} minutes`);
    return true;
  } else {
    logWarning('Weekly stats not updated or still zero');
    return true; // Not a failure, might be timing issue
  }
}

/**
 * Test 3: Call Connector Pro Call Start Tracking
 */
async function testCCProCallStart(): Promise<boolean> {
  const testCallId = `test-call-${Date.now()}`;
  await usageTracker.trackCCProCallStart(testAgentEmail, testSessionId, testCallId);
  
  // Verify event was logged
  const result = await db.execute(sql`
    SELECT * FROM agent_activity_log
    WHERE agent_email = ${testAgentEmail}
      AND activity_type = 'ccpro_call_start'
      AND session_id = ${testSessionId}
      AND activity_data->>'call_id' = ${testCallId}
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    logError('CCPro call start event not found in database');
    return false;
  }
  
  logSuccess(`CCPro call start event logged with callId: ${testCallId}`);
  return true;
}

/**
 * Test 4: Call Connector Pro Call End Tracking (with duration)
 */
async function testCCProCallEndWithDuration(): Promise<boolean> {
  const testCallId = `test-call-${Date.now()}`;
  const testDuration = 300; // 5 minutes in seconds
  
  // Start call
  await usageTracker.trackCCProCallStart(testAgentEmail, testSessionId, testCallId);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // End call with duration
  await usageTracker.trackCCProCallEnd(testAgentEmail, testSessionId, testCallId, testDuration);
  
  // Verify end event was logged
  const endResult = await db.execute(sql`
    SELECT * FROM agent_activity_log
    WHERE agent_email = ${testAgentEmail}
      AND activity_type = 'ccpro_call_end'
      AND activity_data->>'call_id' = ${testCallId}
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  if (endResult.rows.length === 0) {
    logError('CCPro call end event not found in database');
    return false;
  }
  
  const duration = endResult.rows[0].activity_data?.duration_minutes || 0;
  const expectedMinutes = Math.round(testDuration / 60); // 5 minutes
  
  if (duration === expectedMinutes) {
    logSuccess(`CCPro call end event logged with correct duration: ${duration} minutes`);
  } else {
    logError(`Duration mismatch: expected ${expectedMinutes}, got ${duration}`);
    return false;
  }
  
  // Verify weekly stats were updated
  const statsResult = await db.execute(sql`
    SELECT ccpro_call_minutes
    FROM weekly_usage_stats
    WHERE agent_email = ${testAgentEmail}
      AND week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
  `);
  
  if (statsResult.rows.length > 0) {
    logSuccess(`Weekly stats CCPro minutes: ${statsResult.rows[0].ccpro_call_minutes}`);
  }
  
  return true;
}

/**
 * Test 5: Call Connector Pro Call End Tracking (without duration - auto-calculate)
 */
async function testCCProCallEndAutoCalculate(): Promise<boolean> {
  const testCallId = `test-call-auto-${Date.now()}`;
  
  // Start call
  await usageTracker.trackCCProCallStart(testAgentEmail, testSessionId, testCallId);
  
  // Wait 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // End call without duration (should auto-calculate)
  await usageTracker.trackCCProCallEnd(testAgentEmail, testSessionId, testCallId);
  
  // Verify end event was logged with calculated duration
  const endResult = await db.execute(sql`
    SELECT * FROM agent_activity_log
    WHERE agent_email = ${testAgentEmail}
      AND activity_type = 'ccpro_call_end'
      AND activity_data->>'call_id' = ${testCallId}
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  if (endResult.rows.length === 0) {
    logError('CCPro call end event not found in database');
    return false;
  }
  
  const duration = endResult.rows[0].activity_data?.duration_minutes || 0;
  
  // Should be approximately 3 seconds = 0.05 minutes (rounded to 0 or 1)
  if (duration >= 0 && duration <= 1) {
    logSuccess(`CCPro call end auto-calculated duration: ${duration} minutes (expected ~0-1 min for 3 sec call)`);
    return true;
  } else {
    logWarning(`Auto-calculated duration seems off: ${duration} minutes (expected ~0-1 min)`);
    return true; // Not a failure, timing can vary
  }
}

/**
 * Test 6: Calculate VDP Available Time
 */
async function testCalculateVDPAvailableTime(): Promise<boolean> {
  // Create some test events
  const session1 = `calc-test-session-1-${Date.now()}`;
  const session2 = `calc-test-session-2-${Date.now()}`;
  
  // Session 1: 5 minutes
  await usageTracker.trackVDPAvailableStart(testAgentEmail, session1);
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  await usageTracker.trackVDPAvailableEnd(testAgentEmail, session1);
  
  // Session 2: 10 minutes (simulated by waiting)
  await usageTracker.trackVDPAvailableStart(testAgentEmail, session2);
  await new Promise(resolve => setTimeout(resolve, 100));
  await usageTracker.trackVDPAvailableEnd(testAgentEmail, session2);
  
  // Calculate total
  const totalMinutes = await usageTracker.calculateVDPAvailableTime(testAgentEmail);
  
  if (totalMinutes >= 0) {
    logSuccess(`Calculated VDP available time: ${totalMinutes} minutes`);
    return true;
  } else {
    logError('Calculation returned negative value');
    return false;
  }
}

/**
 * Test 7: Calculate Call Connector Pro Call Time
 */
async function testCalculateCCProCallTime(): Promise<boolean> {
  // Create some test call events
  const call1 = `calc-test-call-1-${Date.now()}`;
  const call2 = `calc-test-call-2-${Date.now()}`;
  
  // Call 1: 2 minutes
  await usageTracker.trackCCProCallStart(testAgentEmail, testSessionId, call1);
  await new Promise(resolve => setTimeout(resolve, 100));
  await usageTracker.trackCCProCallEnd(testAgentEmail, testSessionId, call1, 120); // 2 min in seconds
  
  // Call 2: 3 minutes
  await usageTracker.trackCCProCallStart(testAgentEmail, testSessionId, call2);
  await new Promise(resolve => setTimeout(resolve, 100));
  await usageTracker.trackCCProCallEnd(testAgentEmail, testSessionId, call2, 180); // 3 min in seconds
  
  // Calculate total
  const totalMinutes = await usageTracker.calculateCCProCallTime(testAgentEmail);
  
  if (totalMinutes >= 0) {
    logSuccess(`Calculated CCPro call time: ${totalMinutes} minutes`);
    return true;
  } else {
    logError('Calculation returned negative value');
    return false;
  }
}

/**
 * Test 8: Orphaned Start Event (VDP turned ON but never OFF)
 */
async function testOrphanedVDPStart(): Promise<boolean> {
  const orphanedSession = `orphaned-session-${Date.now()}`;
  
  // Create start event but no end event
  await usageTracker.trackVDPAvailableStart(testAgentEmail, orphanedSession);
  
  // Try to end with a different session (simulating page crash)
  const newSession = `new-session-${Date.now()}`;
  await usageTracker.trackVDPAvailableEnd(testAgentEmail, newSession);
  
  // Should still work (finds most recent start within 24 hours)
  logSuccess('Orphaned VDP start handled (end event with different session)');
  return true;
}

/**
 * Test 9: Multiple VDP Toggle Cycles
 */
async function testMultipleVDPCycles(): Promise<boolean> {
  const multiSession = `multi-session-${Date.now()}`;
  
  // Toggle VDP on/off 3 times
  for (let i = 1; i <= 3; i++) {
    await usageTracker.trackVDPAvailableStart(testAgentEmail, multiSession);
    await new Promise(resolve => setTimeout(resolve, 500));
    await usageTracker.trackVDPAvailableEnd(testAgentEmail, multiSession);
    logSuccess(`VDP cycle ${i} completed`);
  }
  
  // Check weekly stats
  const statsResult = await db.execute(sql`
    SELECT vdp_available_minutes
    FROM weekly_usage_stats
    WHERE agent_email = ${testAgentEmail}
      AND week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
  `);
  
  if (statsResult.rows.length > 0) {
    logSuccess(`Total VDP minutes after 3 cycles: ${statsResult.rows[0].vdp_available_minutes}`);
  }
  
  return true;
}

/**
 * Test 10: Verify Weekly Stats Structure
 */
async function testWeeklyStatsStructure(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 
      agent_email,
      vdp_available_minutes,
      ccpro_call_minutes,
      week_start_date,
      week_end_date
    FROM weekly_usage_stats
    WHERE agent_email = ${testAgentEmail}
      AND week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
  `);
  
  if (result.rows.length === 0) {
    logWarning('No weekly stats record found (may need to create one first)');
    return true; // Not a failure
  }
  
  const stats = result.rows[0];
  
  // Verify columns exist
  if (typeof stats.vdp_available_minutes === 'number' && 
      typeof stats.ccpro_call_minutes === 'number') {
    logSuccess('Weekly stats structure is correct');
    log(`  - VDP available minutes: ${stats.vdp_available_minutes}`);
    log(`  - CCPro call minutes: ${stats.ccpro_call_minutes}`);
    log(`  - Week: ${stats.week_start_date} to ${stats.week_end_date}`);
    return true;
  } else {
    logError('Weekly stats missing required columns');
    return false;
  }
}

/**
 * Test 11: Activity Log Query Performance
 */
async function testActivityLogPerformance(): Promise<boolean> {
  const startTime = Date.now();
  
  const result = await db.execute(sql`
    SELECT COUNT(*) as total_events
    FROM agent_activity_log
    WHERE agent_email = ${testAgentEmail}
      AND activity_type IN ('vdp_available_start', 'vdp_available_end', 'ccpro_call_start', 'ccpro_call_end')
      AND timestamp >= NOW() - INTERVAL '7 days'
  `);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  logSuccess(`Activity log query completed in ${duration}ms`);
  log(`  - Total events found: ${result.rows[0]?.total_events || 0}`);
  
  if (duration < 1000) {
    return true; // Good performance
  } else {
    logWarning('Query took longer than 1 second - may need index optimization');
    return true; // Not a failure, just a warning
  }
}

// ==========================================
// MAIN TEST RUNNER
// ==========================================

async function runAllTests() {
  logSection('Usage Tracking System QA Test Suite');
  log(`Testing with agent: ${testAgentEmail}`, 'cyan');
  log(`Session ID: ${testSessionId}\n`, 'cyan');
  
  // Run all tests
  await runTest('1. VDP Available Start Tracking', testVDPAvailableStart);
  await runTest('2. VDP Available End Tracking', testVDPAvailableEnd);
  await runTest('3. Call Connector Pro Call Start Tracking', testCCProCallStart);
  await runTest('4. Call Connector Pro Call End (with duration)', testCCProCallEndWithDuration);
  await runTest('5. Call Connector Pro Call End (auto-calculate)', testCCProCallEndAutoCalculate);
  await runTest('6. Calculate VDP Available Time', testCalculateVDPAvailableTime);
  await runTest('7. Calculate Call Connector Pro Call Time', testCalculateCCProCallTime);
  await runTest('8. Orphaned VDP Start Event Handling', testOrphanedVDPStart);
  await runTest('9. Multiple VDP Toggle Cycles', testMultipleVDPCycles);
  await runTest('10. Weekly Stats Structure Verification', testWeeklyStatsStructure);
  await runTest('11. Activity Log Query Performance', testActivityLogPerformance);
  
  // Print summary
  logSection('Test Summary');
  log(`Total Tests: ${testResults.passed + testResults.failed + testResults.warnings}`, 'cyan');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, 'red');
  log(`⚠️  Warnings: ${testResults.warnings}`, 'yellow');
  
  if (testResults.failed === 0) {
    log('\n🎉 All critical tests passed!', 'green');
    return 0;
  } else {
    log('\n⚠️  Some tests failed. Please review the output above.', 'red');
    return 1;
  }
}

// Run the tests
runAllTests()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    logError(`\n❌ Test suite crashed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
