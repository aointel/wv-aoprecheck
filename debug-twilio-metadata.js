// DEBUG: Check what metadata Twilio actually stores for recent calls
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './server/hardcoded-config.js';
import twilio from 'twilio';

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.log('❌ Missing Twilio credentials');
  process.exit(1);
}

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function debugRecentCalls() {
  try {
    console.log('🔍 Fetching recent Twilio calls to check metadata...');
    
    // Get calls from last hour to check metadata
    const lastHour = new Date();
    lastHour.setHours(lastHour.getHours() - 1);
    
    const calls = await twilioClient.calls.list({
      startTimeAfter: lastHour,
      limit: 10
    });
    
    console.log(`📞 Found ${calls.length} recent calls:`);
    
    for (let i = 0; i < Math.min(calls.length, 5); i++) {
      const call = calls[i];
      console.log('\n--- Call ' + (i + 1) + ' ---');
      console.log('SID:', call.sid);
      console.log('Direction:', call.direction);
      console.log('From:', call.from);
      console.log('To:', call.to);
      console.log('Status:', call.status);
      console.log('Started:', call.dateCreated);
      console.log('Metadata:', JSON.stringify(call.metadata, null, 2));
      
      // Check if metadata exists and what's in it
      if (call.metadata && Object.keys(call.metadata).length > 0) {
        console.log('✅ HAS METADATA with agent:', call.metadata.agent_email || 'NO AGENT EMAIL');
      } else {
        console.log('❌ NO METADATA FOUND');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugRecentCalls();