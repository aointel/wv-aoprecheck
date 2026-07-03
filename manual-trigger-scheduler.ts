/**
 * Manually trigger the scheduler to see what happens
 */

import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function manualTrigger() {
  console.log('🚀 Manually triggering call analytics scheduler...\n');

  // Access the private method via type casting (hacky but works for testing)
  const scheduler = callAnalyticsScheduler as any;
  
  try {
    await scheduler.processPendingCalls();
    console.log('\n✅ Scheduler run completed');
  } catch (error) {
    console.error('\n❌ Scheduler run failed:', error);
  }

  // Wait a bit to see any async operations
  setTimeout(() => {
    process.exit(0);
  }, 5000);
}

manualTrigger().catch(console.error);
