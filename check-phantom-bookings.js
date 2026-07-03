// Check for phantom bookings - calls marked as "booked" but no matching appointments
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhantomBookings() {
  console.log('🔍 CHECKING FOR PHANTOM BOOKINGS...');
  
  try {
    // 1. Get ALL hotleads with cnresolution = "booked"
    console.log('📋 Step 1: Finding calls marked as "booked"...');
    
    const { data: bookedCalls, error: bookedError } = await supabase
      .from('hotleads')
      .select('*')
      .eq('cnresolution', 'booked')
      .order('updated_at', { ascending: false });
    
    if (bookedError) {
      console.error('❌ Error fetching booked calls:', bookedError);
      return;
    }
    
    console.log(`📞 Found ${bookedCalls.length} calls marked as "booked"`);
    
    if (bookedCalls.length === 0) {
      console.log('✅ No calls marked as "booked" found in database');
      return;
    }
    
    // 2. Check each booked call for matching appointments
    let phantomCount = 0;
    
    for (const call of bookedCalls) {
      console.log(`\n🔍 Checking: ${call.first_name} ${call.last_name} (${call.phone}) - ${call.updated_at?.split('T')[0]}`);
      
      const callDate = call.updated_at?.split('T')[0] || call.created_at?.split('T')[0];
      
      // Check for appointments on this date for this phone/email
      const appointmentQuery = supabase
        .from('appointments')
        .select('id, start_time, agent_email, client_phone, client_email')
        .eq('status', 'scheduled');
      
      // Try to match by phone or email
      if (call.phone) {
        appointmentQuery.or(`client_phone.eq.${call.phone},client_phone.eq.${call.phone.replace(/\D/g, '')}`);
      }
      
      const { data: appointments, error: appointmentError } = await appointmentQuery;
      
      if (appointmentError) {
        console.error(`❌ Error checking appointments for ${call.phone}:`, appointmentError);
        continue;
      }
      
      console.log(`   📅 Found ${appointments.length} appointments for this lead`);
      
      if (appointments.length === 0) {
        console.log(`   🚨 PHANTOM BOOKING DETECTED: ${call.first_name} ${call.last_name} (${call.phone})`);
        console.log(`      → Call marked "booked" on ${callDate} but NO appointment exists`);
        console.log(`      → Resolution: ${call.cnresolution}`);
        console.log(`      → Owner: ${call.owned_by_user_id || 'Unknown'}`);
        phantomCount++;
      } else {
        console.log(`   ✅ Valid booking: Has matching appointment(s)`);
        appointments.forEach(apt => {
          console.log(`      → Appointment: ${apt.start_time} with ${apt.agent_email}`);
        });
      }
    }
    
    console.log(`\n📊 PHANTOM BOOKING SUMMARY:`);
    console.log(`   Total calls marked "booked": ${bookedCalls.length}`);
    console.log(`   Phantom bookings found: ${phantomCount}`);
    console.log(`   Valid bookings: ${bookedCalls.length - phantomCount}`);
    
    if (phantomCount > 0) {
      console.log(`\n🚨 ACTION REQUIRED: ${phantomCount} calls are marked as "booked" but have no appointments!`);
      console.log(`   These should be added to the accountability system.`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkPhantomBookings().catch(console.error);