const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration from hardcoded-config
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const USER_EMAIL = 'cnsysop@aoglobelife.com';

async function createExpiredAOReports() {
  console.log(`\n🔧 Creating expired AO reports for ${USER_EMAIL}...\n`);

  try {
    // 1. Get user's associate_id
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('associate_id')
      .eq('company_email', USER_EMAIL)
      .single();

    if (customerError || !customerData) {
      console.error('❌ Could not find customer record:', customerError);
      console.log('⚠️  Using default associate_id: 999');
    }

    const associateId = customerData?.associate_id?.toString() || '999';
    console.log(`✅ Found associate_id: ${associateId}\n`);

    // 2. Create VDP calls with null cnresolution (pending reports)
    console.log('📞 Creating VDP calls with pending resolutions...');
    const vdpCalls = [];
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    for (let i = 1; i <= 3; i++) {
      const callDate = i === 1 ? twoDaysAgo : threeDaysAgo;
      // Minimal VDP call - Supabase uses lowercase column names
      const vdpCall = {
        date: callDate.toISOString().split('T')[0],
        time: callDate.toTimeString().split(' ')[0].substring(0, 5),
        event: 'CONNECT',
        phone: `555000${i}000`,
        agent: associateId, // lowercase - this is what the query uses
        duration: '300',
        leadid: `TEST_LEAD_${i}`,
        firstname: `Test${i}`,
        lastname: 'Client',
        market: 'TEST',
        state: 'TX',
        cnresolution: null // Pending resolution - this is what makes it show up
      };

      const { data: insertedCall, error: vdpError } = await supabase
        .from('vdp_calls')
        .insert(vdpCall)
        .select()
        .single();

      if (vdpError) {
        console.error(`❌ Error creating VDP call ${i}:`, vdpError.message || JSON.stringify(vdpError));
      } else {
        console.log(`✅ Created VDP call ${i} (ID: ${insertedCall.id})`);
        vdpCalls.push(insertedCall);
      }
    }

    // 3. Create masterlead records with booked/appointment_set status (some overdue 3+ days)
    console.log('\n📋 Creating masterlead records with pending follow-ups...');
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    
    for (let i = 1; i <= 5; i++) {
      let callDate, resolution;
      if (i === 1) {
        callDate = twoDaysAgo;
        resolution = 'booked';
      } else if (i === 2) {
        callDate = threeDaysAgo;
        resolution = 'appointment_set';
      } else if (i === 3) {
        callDate = fourDaysAgo; // Overdue (4 days)
        resolution = 'booked';
      } else if (i === 4) {
        callDate = fiveDaysAgo; // Overdue (5 days)
        resolution = 'appointment_set';
      } else {
        callDate = fourDaysAgo;
        resolution = 'callback_requested';
      }
      
      const masterlead = {
        cn_email: USER_EMAIL,
        cnresolution: resolution,
        first_name: `Test${i + 3}`,
        last_name: 'Client',
        phone: `555000${i + 3}000`,
        taalk_market: 'TEST',
        state: 'TX',
        city: 'Test City',
        called_at: callDate.toISOString(), // This is used for days_since_call calculation
        created_at: callDate.toISOString(),
        updated_at: callDate.toISOString(),
        last_contacted: callDate.toISOString() // Also set this for date calculation
      };

      const { data: insertedLead, error: leadError } = await supabase
        .from('masterlead')
        .insert(masterlead)
        .select()
        .single();

      if (leadError) {
        console.error(`❌ Error creating masterlead ${i}:`, leadError.message);
      } else {
        console.log(`✅ Created masterlead ${i} (ID: ${insertedLead.id}) with cnresolution: ${masterlead.cnresolution}`);
      }
    }

    // 4. Create appointments scheduled 24+ hours ago
    console.log('\n📅 Creating appointments scheduled 24+ hours ago...');
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const twentySixHoursAgo = new Date(now.getTime() - 26 * 60 * 60 * 1000);
    const appointmentTimes = [twentyFiveHoursAgo, twentySixHoursAgo];
    let appointmentsCreated = 0;

    for (let i = 0; i < 2; i++) {
      const startTime = appointmentTimes[i];
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      // Create appointment with all required fields
      const appointment = {
        title: `Test Appointment ${i + 1} - Requires Resolution`,
        description: 'Test appointment created to force AO report resolution',
        appointment_type: 'consultation',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: 60,
        timezone: 'America/New_York',
        agent_id: associateId.toString(),
        agent_email: USER_EMAIL,
        agent_name: 'System Operator',
        lead_name: `Test Client ${i + 1}`,
        lead_phone: `555000${i + 4}000`,
        meeting_platform: 'zoom',
        status: 'scheduled' // Still scheduled, not completed - this is required
      };

      // Try without .single() first
      const { data: insertedData, error: insertError } = await supabase
        .from('appointments')
        .insert(appointment)
        .select();

      if (insertError) {
        console.error(`❌ Error creating appointment ${i + 1}:`);
        console.error(`   Code: ${insertError.code}`);
        console.error(`   Message: ${insertError.message}`);
        console.error(`   Details: ${insertError.details}`);
        console.error(`   Hint: ${insertError.hint}`);
        console.error(`   Status: ${insertError.status}`);
        if (insertError.status === 404) {
          console.error(`   ⚠️  Table 'appointments' may not exist or is not accessible. Skipping appointments.`);
        }
      } else if (insertedData && insertedData.length > 0) {
        console.log(`✅ Created appointment ${i + 1} (ID: ${insertedData[0].id}) scheduled ${Math.round((now - startTime) / (60 * 60 * 1000))} hours ago`);
        appointmentsCreated++;
      } else {
        console.error(`❌ No data returned for appointment ${i + 1}`);
      }
    }

    console.log('\n✅ Successfully created expired AO reports!');
    console.log('\n📊 Summary:');
    console.log(`   - ${vdpCalls.length} VDP calls with pending resolutions`);
    console.log(`   - 5 masterlead records with booked/appointment_set/callback_requested status`);
    console.log(`   - ${appointmentsCreated} appointments scheduled 24+ hours ago`);
    console.log(`\n📋 Records created:`);
    console.log(`   - Check /aoi-reports page to see pending resolutions`);
    console.log(`   - Some records are overdue (3+ days) and will show in the overdue section`);
    console.log(`\n🔒 ${USER_EMAIL} should now see pending reports that need resolution.\n`);

  } catch (error) {
    console.error('❌ Error creating expired AO reports:', error);
    process.exit(1);
  }
}

createExpiredAOReports();

