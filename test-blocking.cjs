const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const USER_EMAIL = 'cnsysop@aoglobelife.com';

async function testBlocking() {
  console.log(`\n🔍 Testing blocking logic for ${USER_EMAIL}...\n`);

  try {
    const normalizedEmail = USER_EMAIL.toLowerCase().trim();
    
    // Get booked calls
    const { data: bookedCalls, error: bookedError } = await supabase
      .from('masterlead')
      .select('id, first_name, last_name, phone, cnresolution, created_at')
      .eq('cn_email', normalizedEmail)
      .eq('cnresolution', 'booked');
    
    if (bookedError) {
      console.error('❌ Error getting booked calls:', bookedError);
      return;
    }
    
    console.log(`📅 Found ${bookedCalls?.length || 0} booked calls`);
    
    // Try to get appointments
    let appointmentPhones = new Set();
    try {
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('lead_phone, lead_name, start_time')
        .eq('agent_email', normalizedEmail)
        .gte('start_time', new Date().toISOString());
      
      if (aptError) {
        console.log(`⚠️  Appointments table error (assuming no appointments): ${aptError.message}`);
      } else {
        appointmentPhones = new Set((appointments || []).map((apt) => {
          const phone = apt.lead_phone?.replace(/\D/g, '') || '';
          return phone;
        }));
        console.log(`📅 Found ${appointmentPhones.size} future appointments`);
      }
    } catch (error) {
      console.log(`⚠️  Error checking appointments (assuming no appointments): ${error.message}`);
    }
    
    // Filter booked calls without appointments
    const bookedWithoutAppointments = (bookedCalls || []).filter((call) => {
      const callPhone = call.phone?.replace(/\D/g, '') || '';
      const hasAppointment = appointmentPhones.has(callPhone);
      return !hasAppointment;
    });
    
    console.log(`\n📊 Results:`);
    console.log(`   Total booked calls: ${bookedCalls?.length || 0}`);
    console.log(`   Booked calls WITHOUT appointments: ${bookedWithoutAppointments.length}`);
    console.log(`\n   Should block: ${bookedWithoutAppointments.length > 0 ? 'YES ✅' : 'NO ❌'}`);
    
    if (bookedWithoutAppointments.length > 0) {
      console.log(`\n   Booked calls without appointments:`);
      bookedWithoutAppointments.slice(0, 5).forEach((call) => {
        console.log(`     - ID ${call.id}: ${call.first_name} ${call.last_name} (${call.phone})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBlocking();

































