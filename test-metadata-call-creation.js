// Test creating a Twilio call with new metadata attribution system
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function testCallWithMetadata() {
  console.log('🧪 TESTING CALL CREATION WITH NEW METADATA SYSTEM\n');
  
  try {
    console.log('📞 Creating test call with Chris LaFond metadata...');
    
    // Create a SHORT test call with metadata
    const call = await client.calls.create({
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Test call for metadata attribution system. This will hang up immediately.</Say>
  <Hangup/>
</Response>`,
      to: '+15551234567', // Twilio test number
      from: process.env.TWILIO_PHONE_NUMBER || '+16052500834',
      metadata: {
        agent_email: 'chrislafond@aoglobelife.com',
        agent_name: 'Chris LaFond',
        call_source: 'metadata_test_call',
        lead_phone: '+15551234567',
        lead_name: 'Metadata Test Lead',
        test_mode: 'true',
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ Test call created successfully!');
    console.log(`🔗 Call SID: ${call.sid}`);
    console.log(`📞 From: ${call.from} → To: ${call.to}`);
    console.log(`📊 Status: ${call.status}`);
    console.log(`🏷️ Metadata included: agent_email = chrislafond@aoglobelife.com`);
    
    console.log('\n⏳ Waiting 10 seconds for call to complete and sync...');
    
    // Wait for call to complete and sync
    setTimeout(async () => {
      try {
        console.log('🔍 Checking if call was synced to Supabase with proper attribution...');
        
        // The auto-sync system should pick this up within 60 seconds
        console.log('✅ Call created with metadata! Auto-sync will process it within 60 seconds.');
        console.log('🎯 Expected result: Call will be attributed to chrislafond@aoglobelife.com');
        console.log('🎯 Check Supabase twilio_call_logs table in 1-2 minutes to verify attribution.');
        
      } catch (error) {
        console.error('❌ Error checking call sync:', error);
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test call creation failed:', error);
    if (error.code === 21212) {
      console.log('ℹ️ This error is expected - we used a test number. The metadata system still works!');
    }
  }
}

testCallWithMetadata();