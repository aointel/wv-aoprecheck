require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Caller IDs from the 29 outbound calls
const callerIds = [
  '+15712404954',
  '+19519035177',
  '+19016757510',
  '+19806552155',
  '+13613373273',
  '+13865171587',
  '+17697598161',
  '+15045004784',
  '+19133939602',
  '+19187255983'
];

async function mapCallerIds() {
  try {
    console.log('✅ Mapping caller IDs to agents...\n');
    console.log('📞 Caller IDs to map:', callerIds.length, '\n');

    // Check twilio_call_logs for owner_email by from_number
    const { data: callLogs } = await supabase
      .from('twilio_call_logs')
      .select('from_number, owner_email')
      .in('from_number', callerIds)
      .not('owner_email', 'is', null);

    console.log(`📊 Found ${callLogs?.length || 0} matches in twilio_call_logs\n`);

    const callerIdMap = {};
    (callLogs || []).forEach(log => {
      callerIdMap[log.from_number] = log.owner_email;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CALLER ID → AGENT EMAIL MAPPING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const callerId of callerIds) {
      const email = callerIdMap[callerId];
      if (email) {
        console.log(`✅ ${callerId} → ${email}`);
      } else {
        console.log(`❌ ${callerId} → NOT FOUND`);
      }
    }

    // Get associate_ids for found emails
    const emails = [...new Set(Object.values(callerIdMap))];
    
    if (emails.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 AGENT EMAIL → ASSOCIATE ID');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const { data: producers } = await supabase
        .from('producerlist')
        .select('company_email, associate_id')
        .in('company_email', emails);

      const associateMap = {};
      (producers || []).forEach(p => {
        associateMap[p.company_email] = p.associate_id;
      });

      for (const email of emails) {
        const associateId = associateMap[email];
        if (associateId) {
          console.log(`✅ ${email} → ${associateId}`);
        } else {
          console.log(`❌ ${email} → NOT IN PRODUCERLIST`);
        }
      }

      // Final mapping: Caller ID → Associate ID
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 FINAL: CALLER ID → ASSOCIATE ID');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      let validCount = 0;
      for (const callerId of callerIds) {
        const email = callerIdMap[callerId];
        const associateId = email ? associateMap[email] : null;
        
        if (associateId) {
          console.log(`✅ ${callerId} → ${email} → ${associateId}`);
          validCount++;
        } else {
          console.log(`❌ ${callerId} → ${email || 'NO EMAIL'} → NO ASSOCIATE_ID`);
        }
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ ${validCount}/${callerIds.length} caller IDs can be mapped to associate_id`);
      console.log(`⚠️  ${callerIds.length - validCount} missing mappings`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

mapCallerIds();

