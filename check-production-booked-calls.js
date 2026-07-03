// Use the exact same Supabase connection as the server to find booked calls
import { supabase } from './server/supabase.ts';

async function checkProductionBookedCalls() {
  console.log('🔍 CHECKING PRODUCTION DATABASE FOR BOOKED CALLS...');
  
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return;
  }
  
  try {
    // First, let's see what's actually in the database
    const { data: allData, error: allError } = await supabase
      .from('hotleads')
      .select('cnresolution, COUNT(*)')
      .not('cnresolution', 'is', null)
      .limit(10);
    
    if (allError) {
      console.error('❌ Error querying all data:', allError);
      return;
    }
    
    console.log('📊 All resolutions in database:', allData);
    
    // Now search specifically for booked calls
    const { data: bookedCalls, error: bookedError } = await supabase
      .from('hotleads')
      .select('phone, first_name, last_name, cnresolution, created_at, updated_at, owned_by_user_id, taalk_market')
      .ilike('cnresolution', '%booked%')  // Try case-insensitive search
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (bookedError) {
      console.error('❌ Error searching for booked calls:', bookedError);
      return;
    }
    
    console.log(`\n📞 BOOKED CALLS SEARCH RESULTS: ${bookedCalls.length} found`);
    
    if (bookedCalls.length > 0) {
      console.log('\n🚨 FOUND CALLS WITH "BOOKED" RESOLUTION:');
      bookedCalls.forEach((call, index) => {
        console.log(`\n${index + 1}. ${call.first_name} ${call.last_name} (${call.phone})`);
        console.log(`   Resolution: "${call.cnresolution}"`);
        console.log(`   Date: ${call.updated_at?.split('T')[0] || call.created_at?.split('T')[0]}`);
        console.log(`   Owner: ${call.owned_by_user_id || 'Unknown'}`);
        console.log(`   Market: ${call.taalk_market || 'Unknown'}`);
      });
      
      console.log(`\n✅ FOUND ${bookedCalls.length} CALLS THAT MATCH YOUR SCREENSHOT!`);
      console.log('These are the phantom bookings that need to be checked for matching appointments.');
      
    } else {
      console.log('\n❌ No calls found with "booked" in resolution');
      
      // Try different search approaches
      const { data: exactBooked } = await supabase
        .from('hotleads')
        .select('cnresolution')
        .eq('cnresolution', 'booked');
      
      const { data: containsBooked } = await supabase
        .from('hotleads')
        .select('cnresolution')
        .textSearch('cnresolution', 'booked');
      
      console.log('Exact "booked" search:', exactBooked?.length || 0);
      console.log('Contains "booked" search:', containsBooked?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkProductionBookedCalls().catch(console.error);