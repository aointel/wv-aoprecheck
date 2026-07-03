// Direct check using server supabase connection
import { supabase } from './server/supabase.js';

async function directCheck() {
  console.log('🔍 DIRECT SUPABASE CHECK FOR PHANTOM BOOKINGS...');
  
  try {
    // Check for calls marked as "booked"
    const { data: bookedCalls, error } = await supabase
      .from('hotleads')
      .select('phone, first_name, last_name, cnresolution, owned_by_user_id, created_at, updated_at')
      .eq('cnresolution', 'booked')
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return;
    }
    
    console.log(`📞 Found ${bookedCalls.length} calls marked as "booked"`);
    
    if (bookedCalls.length > 0) {
      console.log('\n🚨 PHANTOM BOOKINGS DETECTED:');
      for (const call of bookedCalls) {
        console.log(`   → ${call.first_name} ${call.last_name} (${call.phone}) - ${call.updated_at?.split('T')[0]}`);
        console.log(`     Owner: ${call.owned_by_user_id || 'Unknown'}`);
      }
    } else {
      console.log('✅ No calls found with cnresolution = "booked"');
      
      // Check what resolutions DO exist
      const { data: allResolutions } = await supabase
        .from('hotleads')
        .select('cnresolution')
        .not('cnresolution', 'is', null)
        .limit(50);
      
      console.log('\n📋 Existing resolutions in database:');
      const uniqueResolutions = [...new Set(allResolutions?.map(r => r.cnresolution) || [])];
      uniqueResolutions.forEach(res => console.log(`   → "${res}"`));
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

directCheck().catch(console.error);