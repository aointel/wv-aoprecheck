const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zrkzadkgjvzwgupryuha.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3phZGtnanZ6d2d1cHJ5dWhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDY2MzU4MiwiZXhwIjoyMDQ2MjM5NTgyfQ.hJ9r5_aSKx7TZu91XbA0ZyUdFAU5WcRPU8b8_Y3Vr2A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLeynaCalls() {
  console.log('\n🔍 CHECKING LEYNA\'S RECENT CALL ATTEMPTS...\n');
  
  const leynaEmail = 'leynatran@aoglobelife.com';
  
  // Check recent calls in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Check outbound_dialer_calls
  console.log('📞 Checking outbound_dialer_calls table...');
  const { data: dialerCalls, error: dialerError } = await supabase
    .from('outbound_dialer_calls')
    .select('*')
    .eq('agent_email', leynaEmail)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
  
  if (dialerError) {
    console.error('Error checking dialer calls:', dialerError);
  } else {
    console.log(`Found ${dialerCalls?.length || 0} calls in last 24h`);
    if (dialerCalls && dialerCalls.length > 0) {
      dialerCalls.forEach((call, idx) => {
        console.log(`\n  Call ${idx + 1}:`);
        console.log(`    Created: ${call.created_at}`);
        console.log(`    Call SID: ${call.call_sid || 'N/A'}`);
        console.log(`    Status: ${call.status || 'N/A'}`);
        console.log(`    Disposition: ${call.disposition || 'N/A'}`);
        console.log(`    Duration: ${call.duration || 0}s`);
        console.log(`    Lead ID: ${call.lead_id || 'N/A'}`);
      });
    }
  }
  
  // Check taalk_calls table
  console.log('\n📱 Checking taalk_calls table...');
  const { data: taalkCalls, error: taalkError } = await supabase
    .from('taalk_calls')
    .select('*')
    .eq('agent_email', leynaEmail)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
  
  if (taalkError) {
    console.error('Error checking taalk calls:', taalkError);
  } else {
    console.log(`Found ${taalkCalls?.length || 0} taalk calls in last 24h`);
    if (taalkCalls && taalkCalls.length > 0) {
      taalkCalls.forEach((call, idx) => {
        console.log(`\n  Call ${idx + 1}:`);
        console.log(`    Created: ${call.created_at}`);
        console.log(`    Call SID: ${call.call_sid || 'N/A'}`);
        console.log(`    Status: ${call.status || 'N/A'}`);
        console.log(`    Duration: ${call.duration || 0}s`);
      });
    }
  }
  
  // Check auth logs for Leyna
  console.log('\n👤 Checking Leyna\'s auth user record...');
  const { data: authUser, error: authError } = await supabase
    .from('auth.users')
    .select('*')
    .eq('email', leynaEmail)
    .single();
  
  if (authError) {
    console.error('Error checking auth:', authError);
  } else {
    console.log('Auth User ID:', authUser?.id);
    console.log('Last Sign In:', authUser?.last_sign_in_at);
    console.log('Email Confirmed:', authUser?.email_confirmed_at);
  }
  
  console.log('\n✅ Check complete!\n');
}

checkLeynaCalls().catch(console.error);

