import { supabaseAdmin } from './supabase.js';

async function checkSession888() {
  console.log('🔍 Checking session 888...\n');
  
  const { data: session, error } = await supabaseAdmin
    .from('verification_sessions')
    .select('*')
    .eq('id', 888)
    .single();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('Session 888 data:');
  console.log('─'.repeat(80));
  console.log(`ID: ${session.id}`);
  console.log(`Session ID: ${session.session_id}`);
  console.log(`Client: ${session.first_name} ${session.last_name}`);
  console.log(`Agent: ${session.agent_email}`);
  console.log(`Status: ${session.status}`);
  console.log(`Created: ${session.created_at}`);
  console.log(`\n📞 RECORDING INFO:`);
  console.log(`taalk_call_id: ${session.taalk_call_id || 'NULL'}`);
  console.log(`taalk_call_url: ${session.taalk_call_url || 'NULL'}`);
  console.log(`taalk_call_status: ${session.taalk_call_status || 'NULL'}`);
  console.log(`taalk_call_completed_at: ${session.taalk_call_completed_at || 'NULL'}`);
  console.log('─'.repeat(80));
  
  // Try to fetch from Taalk API if we have a call ID
  if (session.taalk_call_id) {
    console.log(`\n🌐 Trying to fetch from Taalk API...`);
    try {
      const taalkUrl = `https://api.taalk.co/calls/${session.taalk_call_id}`;
      const response = await fetch(taalkUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.TAALK_API_KEY}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Taalk API Response:');
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`❌ Taalk API returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Taalk API error:', error);
    }
  } else {
    console.log('\n⚠️ No taalk_call_id - cannot fetch from Taalk API');
  }
  
  process.exit(0);
}

checkSession888();

