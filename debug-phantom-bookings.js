const { createClient } = require('@supabase/supabase-js');

async function checkPhantomBookings() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  console.log('🔍 Checking phantom bookings for David Fulfer...');
  
  // Get David's phantom bookings
  const { data: davidBookings, error } = await supabase
    .from('masterlead')
    .select('phone, first_name, last_name, cn_email, taalk_market, updated_at, cnresolution')
    .eq('cnresolution', 'booked')
    .eq('cn_email', 'davidfulfer@aoglobelife.com');
    
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${davidBookings?.length || 0} bookings for David:`);
  console.log(JSON.stringify(davidBookings, null, 2));
  
  // Also check Faye for comparison
  const { data: fayeBookings, error: fayeError } = await supabase
    .from('masterlead')
    .select('phone, first_name, last_name, cn_email, taalk_market, updated_at, cnresolution')
    .eq('cnresolution', 'booked')
    .eq('cn_email', 'fayesaad@aoglobelife.com');
    
  if (!fayeError) {
    console.log(`📊 Found ${fayeBookings?.length || 0} bookings for Faye (for comparison):`);
    console.log(JSON.stringify(fayeBookings?.slice(0, 3), null, 2));
  }
}

checkPhantomBookings().catch(console.error);