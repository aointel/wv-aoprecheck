/**
 * Test script to run Twilio outbound call analysis for 5 calls
 */

import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function testTwilioAnalysis() {
  console.log('🧪 Testing Twilio Outbound Call Analysis (5 calls)...\n');
  
  try {
    // Access the private method via type casting for testing
    const scheduler = callAnalyticsScheduler as any;
    
    // Temporarily set batch size to 5
    const originalBatchSize = scheduler.batchSize;
    scheduler.batchSize = 5;
    
    console.log('📊 Processing Twilio outbound calls (max 5 calls)...\n');
    
    // Process only Twilio calls (pass null to skip Taalk calls processing)
    // We'll call processTwilioOutboundCalls directly
    await scheduler.processTwilioOutboundCalls(7); // Last 7 days
    
    // Restore original batch size
    scheduler.batchSize = originalBatchSize;
    
    console.log('\n✅ Twilio call analysis test completed successfully');
  } catch (error: any) {
    console.error('\n❌ Twilio call analysis test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
  
  // Wait a bit for any async operations to complete
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

testTwilioAnalysis();
