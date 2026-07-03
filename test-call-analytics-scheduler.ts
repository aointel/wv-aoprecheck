/**
 * Test script to run call analytics scheduler
 */

import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function testScheduler() {
  console.log('🧪 Testing Call Analytics Scheduler...\n');
  
  try {
    // Process pending calls (last 7 days)
    await callAnalyticsScheduler.processPendingCalls(7);
    console.log('\n✅ Scheduler test completed successfully');
  } catch (error: any) {
    console.error('\n❌ Scheduler test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testScheduler();
