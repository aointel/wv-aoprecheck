// Direct search for calls with booked resolution using production credentials
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Try multiple possible environment variable names
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('🔍 SEARCHING FOR BOOKED CALLS IN PRODUCTION DATABASE...');
console.log('🔧 Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT FOUND');
console.log('🔧 Supabase Key:', supabaseKey ? 'FOUND' : 'NOT FOUND');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Available env vars:');
  Object.keys(process.env).filter(key => key.toLowerCase().includes('supabase')).forEach(key => {
    console.log(`   ${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findBookedCalls() {
  try {
    // Search for calls with "booked" resolution
    console.log('📋 Searching for calls with cnresolution = "booked"...');
    
    const { data: bookedCalls, error } = await supabase
      .from('hotleads')
      .select('*')
      .eq('cnresolution', 'booked')
      .order('updated_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('❌ Supabase error:', error);
      return;
    }
    
    console.log(`📞 FOUND ${bookedCalls.length} CALLS WITH "booked" RESOLUTION:`);
    
    if (bookedCalls.length > 0) {
      bookedCalls.forEach((call, index) => {
        console.log(`\n${index + 1}. ${call.first_name} ${call.last_name}`);
        console.log(`   📞 Phone: ${call.phone}`);
        console.log(`   📅 Date: ${call.created_at?.split('T')[0] || 'Unknown'}`);
        console.log(`   👤 Owner: ${call.owned_by_user_id || 'Unknown'}`);
        console.log(`   ✅ Resolution: ${call.cnresolution}`);
        console.log(`   🏢 Market: ${call.taalk_market || 'Unknown'}`);
      });
      
      console.log(`\n🚨 PHANTOM BOOKING ANALYSIS:`);
      console.log(`Found ${bookedCalls.length} calls marked as "booked" - need to check for matching appointments`);
      
    } else {
      console.log('❌ No calls found with "booked" resolution');
      
      // Check what resolutions exist
      const { data: resolutions } = await supabase
        .from('hotleads')
        .select('cnresolution')
        .not('cnresolution', 'is', null)
        .limit(100);
      
      const unique = [...new Set(resolutions?.map(r => r.cnresolution))];
      console.log('📋 Available resolutions in database:', unique);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

findBookedCalls().catch(console.error);