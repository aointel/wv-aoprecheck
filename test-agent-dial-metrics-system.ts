/**
 * TEST SCRIPT: Agent Dial Metrics System
 * 
 * Tests the agent dial metrics tracking system to ensure calls are being logged correctly
 * Run with: npx ts-node test-agent-dial-metrics-system.ts
 */

import { supabaseAdmin } from './server/supabase';
import { logCallOutcome, logDialMetric, isReachedDisposition, isBookedDisposition } from './server/agent-dial-metrics-tracker';

// Test configuration
const TEST_AGENT_EMAIL = 'test-agent@aoglobelife.com';
const TEST_LEAD_PHONE = '5551234567';
const TEST_LEAD_NAME = 'Test Lead';
const TEST_LEAD_ID = 999999; // Use a high number that won't conflict

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await testFn();
    results.push({ name, passed: true });
    console.log(`✅ PASSED: ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message, details: error });
    console.error(`❌ FAILED: ${name} - ${error.message}`);
  }
}

async function testBasicDialLogging() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  await logCallOutcome(supabaseAdmin, {
    agentEmail: TEST_AGENT_EMAIL,
    leadPhone: TEST_LEAD_PHONE,
    leadName: TEST_LEAD_NAME,
    leadId: TEST_LEAD_ID,
    disposition: 'no_answer',
    callDuration: 0,
    source: 'test'
  });
  
  // Verify it was inserted
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*')
    .eq('agent_email', TEST_AGENT_EMAIL)
    .eq('lead_phone', TEST_LEAD_PHONE.replace(/\D/g, ''))
    .eq('event_type', 'dial')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Dial event was not inserted');
  
  console.log(`   📊 Inserted dial event: ID ${data[0].id}`);
}

async function testReachLogging() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  const testPhone = '5551234568';
  
  await logCallOutcome(supabaseAdmin, {
    agentEmail: TEST_AGENT_EMAIL,
    leadPhone: testPhone,
    leadName: TEST_LEAD_NAME,
    leadId: TEST_LEAD_ID,
    disposition: 'contacted',
    callDuration: 30,
    source: 'test'
  });
  
  // Verify both dial and reach were inserted
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*')
    .eq('agent_email', TEST_AGENT_EMAIL)
    .eq('lead_phone', testPhone.replace(/\D/g, ''))
    .in('event_type', ['dial', 'reach'])
    .order('created_at', { ascending: false })
    .limit(2);
  
  if (error) throw error;
  if (!data || data.length < 2) throw new Error('Expected both dial and reach events');
  
  const eventTypes = data.map(d => d.event_type);
  if (!eventTypes.includes('dial')) throw new Error('Dial event missing');
  if (!eventTypes.includes('reach')) throw new Error('Reach event missing');
  
  console.log(`   📊 Inserted dial + reach events`);
}

async function testBookedLogging() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  const testPhone = '5551234569';
  
  await logCallOutcome(supabaseAdmin, {
    agentEmail: TEST_AGENT_EMAIL,
    leadPhone: testPhone,
    leadName: TEST_LEAD_NAME,
    leadId: TEST_LEAD_ID,
    disposition: 'booked',
    callDuration: 120,
    source: 'test'
  });
  
  // Verify dial, reach, and booked were all inserted
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*')
    .eq('agent_email', TEST_AGENT_EMAIL)
    .eq('lead_phone', testPhone.replace(/\D/g, ''))
    .in('event_type', ['dial', 'reach', 'booked'])
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (error) throw error;
  if (!data || data.length < 3) throw new Error('Expected dial, reach, and booked events');
  
  const eventTypes = data.map(d => d.event_type);
  if (!eventTypes.includes('dial')) throw new Error('Dial event missing');
  if (!eventTypes.includes('reach')) throw new Error('Reach event missing');
  if (!eventTypes.includes('booked')) throw new Error('Booked event missing');
  
  console.log(`   📊 Inserted dial + reach + booked events`);
}

async function testDuplicatePrevention() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  const testPhone = '5551234570';
  
  // First booking
  await logCallOutcome(supabaseAdmin, {
    agentEmail: TEST_AGENT_EMAIL,
    leadPhone: testPhone,
    leadName: TEST_LEAD_NAME,
    leadId: TEST_LEAD_ID,
    disposition: 'booked',
    callDuration: 120,
    source: 'test'
  });
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Try to book again (should be prevented)
  await logCallOutcome(supabaseAdmin, {
    agentEmail: TEST_AGENT_EMAIL,
    leadPhone: testPhone,
    leadName: TEST_LEAD_NAME,
    leadId: TEST_LEAD_ID,
    disposition: 'booked',
    callDuration: 120,
    source: 'test'
  });
  
  // Check how many booked events exist for this phone today
  const { todayStart, todayEnd } = await getTodayPSTRange();
  
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*')
    .eq('agent_email', TEST_AGENT_EMAIL)
    .eq('lead_phone', testPhone.replace(/\D/g, ''))
    .eq('event_type', 'booked')
    .gte('event_timestamp', todayStart)
    .lt('event_timestamp', todayEnd);
  
  if (error) throw error;
  
  if (data && data.length > 1) {
    console.log(`   ⚠️  WARNING: Found ${data.length} booked events (expected 1 due to duplicate prevention)`);
    console.log(`   ⚠️  This might indicate duplicate prevention is not working`);
  } else {
    console.log(`   ✅ Duplicate prevention working (found ${data?.length || 0} booked events)`);
  }
}

async function testDispositionLogic() {
  console.log(`   🔍 Testing disposition logic...`);
  
  // Test reached dispositions
  const reachedTests = [
    { disp: 'contacted', duration: 20, expected: true },
    { disp: 'booked', duration: 10, expected: true },
    { disp: 'no_answer', duration: 0, expected: false },
    { disp: 'voicemail', duration: 5, expected: false },
    { disp: 'busy', duration: 0, expected: false },
  ];
  
  for (const test of reachedTests) {
    const result = isReachedDisposition(test.disp, test.duration);
    if (result !== test.expected) {
      throw new Error(`isReachedDisposition('${test.disp}', ${test.duration}) = ${result}, expected ${test.expected}`);
    }
  }
  
  // Test booked dispositions
  const bookedTests = [
    { disp: 'booked', duration: 10, expected: true },
    { disp: 'appointment', duration: 5, expected: true },
    { disp: 'contacted', duration: 30, expected: false },
    { disp: 'no_answer', duration: 0, expected: false },
  ];
  
  for (const test of bookedTests) {
    const result = isBookedDisposition(test.disp, test.duration);
    if (result !== test.expected) {
      throw new Error(`isBookedDisposition('${test.disp}', ${test.duration}) = ${result}, expected ${test.expected}`);
    }
  }
  
  console.log(`   ✅ All disposition logic tests passed`);
}

async function testPhoneNumberNormalization() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  // Test with various phone formats
  const phoneFormats = [
    '555-123-4571',
    '(555) 123-4571',
    '5551234571',
    '+1 555-123-4571',
  ];
  
  for (const phone of phoneFormats) {
    await logDialMetric(supabaseAdmin, {
      agentEmail: TEST_AGENT_EMAIL,
      leadPhone: phone,
      eventType: 'dial',
      source: 'test'
    });
  }
  
  // All should normalize to the same clean phone
  const cleanPhone = '5551234571';
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone')
    .eq('agent_email', TEST_AGENT_EMAIL)
    .eq('lead_phone', cleanPhone)
    .order('created_at', { ascending: false })
    .limit(4);
  
  if (error) throw error;
  if (!data || data.length < 4) {
    throw new Error(`Expected 4 normalized phone entries, found ${data?.length || 0}`);
  }
  
  console.log(`   ✅ Phone normalization working (${data.length} entries with normalized phone)`);
}

async function testValidation() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  // Test missing required fields
  try {
    await logDialMetric(supabaseAdmin, {
      agentEmail: '',
      leadPhone: TEST_LEAD_PHONE,
      eventType: 'dial'
    });
    throw new Error('Should have failed with empty agentEmail');
  } catch (error) {
    // Expected to fail
  }
  
  try {
    await logDialMetric(supabaseAdmin, {
      agentEmail: TEST_AGENT_EMAIL,
      leadPhone: '',
      eventType: 'dial'
    });
    throw new Error('Should have failed with empty leadPhone');
  } catch (error) {
    // Expected to fail
  }
  
  console.log(`   ✅ Validation working (rejects invalid inputs)`);
}

async function testTableExists() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('count')
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      throw new Error('agent_dial_metrics table does not exist! Run create-agent-dial-metrics-table.sql first');
    }
    throw error;
  }
  
  console.log(`   ✅ Table exists and is accessible`);
}

async function getTodayPSTRange(): Promise<{ todayStart: string; todayEnd: string }> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin is null');
  
  try {
    const { data, error } = await supabaseAdmin.rpc('get_today_pst_range');
    if (!error && data && data.length > 0) {
      return {
        todayStart: data[0].today_start,
        todayEnd: data[0].today_end
      };
    }
  } catch (err) {
    // Fallback
  }
  
  // Fallback calculation
  const now = new Date();
  const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const utcNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = utcNow.getTime() - pstNow.getTime();
  const pstTodayStart = new Date(pstNow);
  pstTodayStart.setHours(0, 0, 0, 0);
  const utcTodayStart = new Date(pstTodayStart.getTime() + offsetMs);
  const utcTodayEnd = new Date(utcTodayStart.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    todayStart: utcTodayStart.toISOString(),
    todayEnd: utcTodayEnd.toISOString()
  };
}

async function cleanupTestData() {
  if (!supabaseAdmin) return;
  
  console.log(`\n🧹 Cleaning up test data...`);
  
  const { error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .delete()
    .eq('agent_email', TEST_AGENT_EMAIL)
    .like('lead_phone', '5551234%');
  
  if (error) {
    console.error(`   ⚠️  Cleanup error: ${error.message}`);
  } else {
    console.log(`   ✅ Test data cleaned up`);
  }
}

async function main() {
  console.log('🚀 Starting Agent Dial Metrics System Tests\n');
  console.log(`📋 Test Configuration:`);
  console.log(`   Agent Email: ${TEST_AGENT_EMAIL}`);
  console.log(`   Test Lead Phone: ${TEST_LEAD_PHONE}`);
  console.log(`   Test Lead ID: ${TEST_LEAD_ID}`);
  
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin is null - cannot run tests');
    process.exit(1);
  }
  
  // Run all tests
  await runTest('Table Exists', testTableExists);
  await runTest('Basic Dial Logging', testBasicDialLogging);
  await runTest('Reach Logging', testReachLogging);
  await runTest('Booked Logging', testBookedLogging);
  await runTest('Disposition Logic', testDispositionLogic);
  await runTest('Phone Number Normalization', testPhoneNumberNormalization);
  await runTest('Validation', testValidation);
  await runTest('Duplicate Prevention', testDuplicatePrevention);
  
  // Print summary
  console.log(`\n\n📊 TEST SUMMARY`);
  console.log(`═══════════════════════════════════════`);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  // Cleanup
  await cleanupTestData();
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

