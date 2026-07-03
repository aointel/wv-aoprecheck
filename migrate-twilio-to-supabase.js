// Migrate all existing Twilio call data to Supabase
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './server/hardcoded-config.ts';
import { supabase } from './server/supabase.js';
import Twilio from 'twilio';

const twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Agent phone number mapping for attribution - UPDATED WITH ALL AGENT NUMBERS
const AGENT_PHONE_MAPPING = {
  // David's numbers
  '+16052500834': 'davidfulfer@aoglobelife.com',
  '+19142289324': 'davidfulfer@aoglobelife.com',
  
  // Kingsley's numbers  
  '+14133750858': 'kingsleyibeh@aoglobelife.com',
  '+14133751173': 'kingsleyibeh@aoglobelife.com',
  
  // Other agent numbers
  '+15551234567': 'fayesaad@aoglobelife.com',
  '+15559876543': 'chrislafond@aoglobelife.com',
  '+15556547890': 'martintoma@aoglobelife.com',
  '+15554567890': 'tabithamcdermid@aoglobelife.com'
};

function determineCallOwner(call) {
  // 1. Check agent_email in metadata
  if (call.metadata?.agent_email) {
    return call.metadata.agent_email;
  }
  
  // 2. Check from_number mapping
  if (AGENT_PHONE_MAPPING[call.from]) {
    return AGENT_PHONE_MAPPING[call.from];
  }
  
  // 3. Default fallback
  return 'unknown@aoglobelife.com';
}

async function migrateTwilioData() {
  console.log('🚀 STARTING TWILIO DATA MIGRATION TO SUPABASE');
  console.log('📊 Downloading ALL Twilio call data...');
  
  try {
    // Get all calls from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const calls = await twilioClient.calls.list({
      startTimeAfter: thirtyDaysAgo,
      limit: 10000 // Get all calls
    });
    
    console.log(`📞 Found ${calls.length} Twilio calls to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const call of calls) {
      try {
        const ownerEmail = determineCallOwner(call);
        
        const callData = {
          twilio_call_sid: call.sid,
          call_direction: call.direction,
          from_number: call.from,
          to_number: call.to,
          call_status: call.status,
          call_duration: call.duration || 0,
          owner_email: ownerEmail,
          agent_identity: call.from,
          call_started_at: call.startTime,
          call_ended_at: call.endTime,
          answered_by: call.answeredBy,
          call_source: 'twilio_migration',
          metadata: {
            price: call.price,
            priceUnit: call.priceUnit,
            parentCallSid: call.parentCallSid,
            callerName: call.callerName,
            originalData: call
          }
        };
        
        const { data, error } = await supabase
          .from('twilio_call_logs')
          .upsert(callData, { 
            onConflict: 'twilio_call_sid',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.log(`⚠️ Error migrating call ${call.sid}:`, error.message);
          skipped++;
        } else {
          console.log(`✅ Migrated call ${call.sid} → ${ownerEmail}`);
          migrated++;
        }
        
      } catch (err) {
        console.log(`❌ Failed to migrate call ${call.sid}:`, err.message);
        skipped++;
      }
    }
    
    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log(`✅ Successfully migrated: ${migrated} calls`);
    console.log(`⚠️ Skipped/Failed: ${skipped} calls`);
    console.log(`📊 Total processed: ${calls.length} calls`);
    
    // Verify the migration
    const { data: verifyData, error: verifyError } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, count(*)')
      .group('owner_email');
    
    if (!verifyError && verifyData) {
      console.log('\n📊 MIGRATION VERIFICATION:');
      verifyData.forEach(row => {
        console.log(`📞 ${row.owner_email}: ${row.count} calls`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateTwilioData();