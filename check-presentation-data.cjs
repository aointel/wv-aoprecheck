const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  console.log('🔍 Checking presentation_sessions table...\n');
  
  const { data, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Found ${data.length} sessions\n`);
  
  for (const session of data) {
    console.log(`\n========================================`);
    console.log(`Session ID: ${session.session_id}`);
    console.log(`Agent: ${session.agent_email}`);
    console.log(`Status: ${session.status}`);
    console.log(`Started: ${session.started_at}`);
    console.log(`Current Phase:`, JSON.stringify(session.current_phase, null, 2));
    console.log(`Client Data:`, JSON.stringify(session.client_data, null, 2));
    
    // Check screenshot count
    const { count } = await supabase
      .from('presentation_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.session_id);
      
    console.log(`Screenshot Count: ${count || 0}`);
  }
  
  process.exit(0);
}

checkData();

