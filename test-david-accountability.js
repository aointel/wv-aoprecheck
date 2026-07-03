// Test David's accountability system comprehensively
import { createClient } from '@neon/serverless';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient(process.env.DATABASE_URL);

async function testDavidAccountability() {
  console.log('🔍 Testing David\'s accountability system...');
  
  try {
    // 1. Check David's accountability records
    const accountabilityRecords = await db`
      SELECT 
        agent_email,
        accountability_date,
        has_completed_report,
        created_at,
        updated_at
      FROM daily_accountability 
      WHERE agent_email = 'davidfulfer@aoglobelife.com'
      ORDER BY accountability_date DESC;
    `;
    
    console.log(`📋 David's accountability records: ${accountabilityRecords.length}`);
    accountabilityRecords.forEach(record => {
      console.log(`   ${record.accountability_date}: ${record.has_completed_report ? '✅ Complete' : '❌ Incomplete'}`);
    });

    // 2. Check David's 4+ minute calls in PostgreSQL
    const localCalls = await db`
      SELECT 
        twilio_call_sid,
        call_duration,
        call_started_at,
        to_number,
        from_number,
        call_direction
      FROM twilio_call_logs 
      WHERE owner_email = 'davidfulfer@aoglobelife.com'
        AND call_duration >= 240 
        AND call_status = 'completed'
        AND call_started_at >= NOW() - INTERVAL '30 days'
      ORDER BY call_started_at DESC;
    `;
    
    console.log(`📞 David's local 4+ minute calls: ${localCalls.length}`);
    localCalls.forEach(call => {
      const callDate = call.call_started_at.toISOString().split('T')[0];
      const minutes = Math.floor(call.call_duration / 60);
      const seconds = call.call_duration % 60;
      console.log(`   ${callDate}: ${call.twilio_call_sid} (${minutes}:${seconds.toString().padStart(2, '0')}) ${call.call_direction}`);
    });

    // 3. Check if any accountability records are incomplete
    const incompleteRecords = accountabilityRecords.filter(r => !r.has_completed_report);
    console.log(`\n🚨 Incomplete accountability records: ${incompleteRecords.length}`);
    
    if (incompleteRecords.length > 0) {
      console.log('❌ David SHOULD have accountability items but system says he doesn\'t!');
      console.log('🔧 This indicates the accountability check logic is broken');
    } else if (localCalls.length > 0) {
      console.log('❌ David has 4+ minute calls but NO accountability records created!');
      console.log('🔧 This indicates the accountability creation logic is broken');
    } else {
      console.log('✅ David correctly has no accountability issues');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDavidAccountability();