const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const USER_EMAIL = 'cnsysop@aoglobelife.com';

async function testDirect() {
  console.log(`\n🔍 Testing booked calls query directly...\n`);

  try {
    const normalizedEmail = USER_EMAIL.toLowerCase().trim();
    console.log(`📧 Normalized email: "${normalizedEmail}"\n`);

    const { data: bookedCalls, error: bookedError } = await supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, cnresolution, created_at')
      .eq('cn_email', normalizedEmail)
      .eq('cnresolution', 'booked');

    if (bookedError) {
      console.error('❌ Error:', bookedError);
      return;
    }

    console.log(`✅ Found ${bookedCalls?.length || 0} booked calls\n`);

    if (bookedCalls && bookedCalls.length > 0) {
      console.log('📋 First 5 booked calls:');
      bookedCalls.slice(0, 5).forEach((call, i) => {
        console.log(`  ${i + 1}. ID: ${call.id}, Name: ${call.first_name} ${call.last_name}, Phone: ${call.phone}`);
      });

      // Now check appointments
      console.log('\n🔍 Checking for appointments...');
      try {
        const { data: appointments, error: aptError } = await supabase
          .from('appointments')
          .select('lead_phone, lead_name, start_time')
          .eq('agent_email', normalizedEmail)
          .gte('start_time', new Date().toISOString());

        if (aptError) {
          console.log(`⚠️  Appointments table error: ${aptError.message}`);
          console.log(`   Assuming NO appointments exist`);
          console.log(`\n✅ Result: ${bookedCalls.length} booked calls WITHOUT appointments`);
          console.log(`   SHOULD BLOCK!`);
        } else {
          const appointmentPhones = new Set((appointments || []).map((apt) => {
            return apt.lead_phone?.replace(/\D/g, '') || '';
          }));
          console.log(`📅 Found ${appointmentPhones.size} future appointments`);

          const withoutAppointments = bookedCalls.filter((call) => {
            const callPhone = call.phone?.replace(/\D/g, '') || '';
            return !appointmentPhones.has(callPhone);
          });

          console.log(`\n📊 Result:`);
          console.log(`   Total booked calls: ${bookedCalls.length}`);
          console.log(`   Booked calls WITH appointments: ${bookedCalls.length - withoutAppointments.length}`);
          console.log(`   Booked calls WITHOUT appointments: ${withoutAppointments.length}`);
          
          if (withoutAppointments.length > 0) {
            console.log(`\n✅ SHOULD BLOCK! Found ${withoutAppointments.length} booked calls without appointments`);
            console.log(`\n   Examples:`);
            withoutAppointments.slice(0, 3).forEach((call) => {
              console.log(`     - ${call.first_name} ${call.last_name} (${call.phone})`);
            });
          } else {
            console.log(`\n❌ NOT BLOCKING - All booked calls have appointments`);
          }
        }
      } catch (error) {
        console.log(`⚠️  Error checking appointments: ${error.message}`);
        console.log(`   Assuming NO appointments exist`);
        console.log(`\n✅ Result: ${bookedCalls.length} booked calls WITHOUT appointments`);
        console.log(`   SHOULD BLOCK!`);
      }
    } else {
      console.log('❌ No booked calls found!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDirect();

































