const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from hardcoded-config
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const USER_EMAIL = 'cnsysop@aoglobelife.com';

async function createBookedLeadWithoutAppointment() {
  console.log(`\n🔧 Creating "booked" lead without appointment for ${USER_EMAIL}...\n`);

  try {
    // Create a masterlead record with "booked" status
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const masterlead = {
      cn_email: USER_EMAIL,
      cnresolution: 'booked', // This is the key - "booked" without an appointment
      first_name: 'Test',
      last_name: 'Booked Lead',
      phone: '5559998888', // Use a unique phone number that won't match any existing appointments
      taalk_market: 'TEST',
      state: 'TX',
      city: 'Test City',
      created_at: twoDaysAgo.toISOString(),
      updated_at: twoDaysAgo.toISOString(),
      called_at: twoDaysAgo.toISOString(),
      last_contacted: twoDaysAgo.toISOString(),
    };

    console.log('📋 Creating masterlead record with "booked" status...');
    const { data: insertedLead, error: leadError } = await supabase
      .from('masterlead')
      .insert(masterlead)
      .select()
      .single();

    if (leadError) {
      console.error('❌ Error creating masterlead:', leadError.message);
      console.error('   Full error:', JSON.stringify(leadError, null, 2));
      return;
    }

    console.log(`✅ Created masterlead record:`);
    console.log(`   ID: ${insertedLead.id}`);
    console.log(`   Name: ${insertedLead.first_name} ${insertedLead.last_name}`);
    console.log(`   Phone: ${insertedLead.phone}`);
    console.log(`   Resolution: ${insertedLead.cnresolution}`);
    console.log(`   Email: ${insertedLead.cn_email}`);

    // Verify no appointment exists for this phone number
    console.log('\n🔍 Checking for existing appointments...');
    try {
      const { data: existingAppointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, lead_phone, start_time, status')
        .eq('agent_email', USER_EMAIL)
        .eq('lead_phone', masterlead.phone);

      if (aptError) {
        // If table doesn't exist, that's okay - we'll just skip the check
        if (aptError.code === '42P01' || aptError.message.includes('does not exist')) {
          console.log(`⚠️  Appointments table not found - skipping appointment check`);
          console.log(`   The booked lead was created and should trigger the blocker!`);
        } else {
          console.error('❌ Error checking appointments:', aptError.message);
        }
      } else {
        const futureAppointments = (existingAppointments || []).filter((apt) => {
          return new Date(apt.start_time) > new Date();
        });
        
        if (futureAppointments.length > 0) {
          console.log(`⚠️  WARNING: Found ${futureAppointments.length} future appointment(s) for this phone number:`);
          futureAppointments.forEach((apt) => {
            console.log(`   - Appointment ${apt.id}: ${apt.start_time} (${apt.status})`);
          });
          console.log(`\n   This lead may not trigger the blocker since an appointment exists.`);
        } else {
          console.log(`✅ No future appointments found for phone ${masterlead.phone}`);
          console.log(`   This lead should trigger the blocker!`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not check appointments (this is okay): ${error.message}`);
      console.log(`   The booked lead was created and should trigger the blocker!`);
    }

    console.log('\n✅ Successfully created "booked" lead without appointment!');
    console.log('\n📋 Next steps:');
    console.log(`   1. Log in as ${USER_EMAIL}`);
    console.log(`   2. You should be blocked and see: "You have 1 call(s) marked as 'booked' without scheduled appointments"`);
    console.log(`   3. Click "Schedule Appointments Now" to go to AO Meet`);
    console.log(`   4. Schedule an appointment for this lead to resolve the block`);
    console.log(`\n🔒 The blocker should prevent access until an appointment is scheduled.\n`);

  } catch (error) {
    console.error('❌ Error creating booked lead:', error);
    process.exit(1);
  }
}

createBookedLeadWithoutAppointment();

