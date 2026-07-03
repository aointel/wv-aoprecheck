/**
 * Import Twilio calls NOW - downloads recordings and analyzes them
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function importTwilioCalls() {
  console.log('🚀 Starting Twilio call import...\n');

  const scheduler = callAnalyticsScheduler as any;
  
  // Process Twilio calls (no days limit = all calls)
  await scheduler.processTwilioOutboundCalls(null);
  
  console.log('\n✅ Twilio call import complete');
}

importTwilioCalls().catch(console.error);
