// EMERGENCY: Direct Twilio API search for Chris LaFond's call
import twilio from 'twilio';

async function emergencyTwilioSearch() {
  console.log('🚨 EMERGENCY TWILIO API SEARCH FOR CHRIS LAFOND');
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    console.error('❌ Missing Twilio credentials');
    return;
  }
  
  const client = twilio(accountSid, authToken);
  
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  console.log(`\n⏰ Searching Twilio API for calls in last 10 minutes:`);
  console.log(`From: ${tenMinutesAgo.toISOString()}`);
  console.log(`To: ${now.toISOString()}`);
  
  try {
    // Get all recent calls from Twilio API
    const calls = await client.calls.list({
      startTimeAfter: tenMinutesAgo,
      startTimeBefore: now,
      limit: 50
    });
    
    console.log(`\n📞 DIRECT TWILIO API RESULTS: ${calls.length} calls found`);
    
    if (calls.length > 0) {
      calls.forEach((call, i) => {
        console.log(`\n${i+1}. TWILIO CALL FOUND:`);
        console.log(`   SID: ${call.sid}`);
        console.log(`   Direction: ${call.direction}`);
        console.log(`   From: ${call.from}`);
        console.log(`   To: ${call.to}`);
        console.log(`   Status: ${call.status}`);
        console.log(`   Duration: ${call.duration}s`);
        console.log(`   Start: ${call.startTime}`);
        console.log(`   Phone Sid: ${call.phoneNumberSid}`);
        
        // Check if this could be Chris's call based on phone number
        if (call.phoneNumberSid) {
          console.log(`   📞 Phone Number SID: ${call.phoneNumberSid}`);
          
          // Check if this matches known agent phone patterns
          const phonePatterns = {
            'PN09d4b8c98bb0e9061ad5c8bcdde7b831': 'davidfulfer@aoglobelife.com',
            'PN0a2b8c9d8e7f6a5b4c3d2e1f0a9b8c7d': 'chrislafond@aoglobelife.com', // placeholder pattern
            // Add more patterns as needed
          };
          
          if (phonePatterns[call.phoneNumberSid]) {
            console.log(`   🎯 MATCHED AGENT: ${phonePatterns[call.phoneNumberSid]}`);
          }
        }
        
        // Look for any metadata that might identify the caller
        console.log(`   🔍 Call metadata check:`);
        if (call.callerName) console.log(`   Caller Name: ${call.callerName}`);
        if (call.forwardedFrom) console.log(`   Forwarded From: ${call.forwardedFrom}`);
      });
    } else {
      console.log('❌ NO CALLS FOUND IN TWILIO API IN LAST 10 MINUTES');
    }
    
    // Also search for any calls with "chris" or "lafond" in any field (if possible)
    console.log('\n🔍 SEARCHING FOR ANY CHRIS/LAFOND RELATED CALLS TODAY...');
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayCalls = await client.calls.list({
      startTimeAfter: todayStart,
      limit: 100
    });
    
    console.log(`📅 ALL TODAY'S CALLS: ${todayCalls.length}`);
    
    // Check if any recent calls match known Chris LaFond phone numbers
    const chrisPhoneNumbers = [
      // Add any known Chris LaFond phone numbers here
      '+1234567890', // placeholder
    ];
    
    const recentChrisCalls = todayCalls.filter(call => 
      chrisPhoneNumbers.includes(call.from) || 
      chrisPhoneNumbers.includes(call.to) ||
      call.phoneNumberSid?.includes('chrislafond') // if we can identify by SID
    );
    
    if (recentChrisCalls.length > 0) {
      console.log(`🎯 FOUND ${recentChrisCalls.length} POTENTIAL CHRIS CALLS TODAY`);
      recentChrisCalls.forEach((call, i) => {
        console.log(`${i+1}. ${call.startTime} - ${call.from} → ${call.to} (${call.duration}s)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Emergency Twilio search failed:', error);
  }
}

emergencyTwilioSearch();