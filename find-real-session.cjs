const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pscpjfkhvdozqzhglxyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzY3BqZmtodmRvenF6aGdseHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTU2NzU2OSwiZXhwIjoyMDQxMTQzNTY5fQ.u4VY3K2BoOnixHBPPLXZ-nD0CBlE5kpH0LIOhvDfwFo'
);

async function findSessions() {
  const { data, error } = await supabase
    .from('presentation_sessions')
    .select('session_id, agent_email, started_at, screenshot_count')
    .order('started_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  console.log('📊 Recent presentation sessions:\n');
  data.forEach(s => {
    console.log(`Session: ${s.session_id}`);
    console.log(`  Agent: ${s.agent_email}`);
    console.log(`  Started: ${s.started_at}`);
    console.log(`  Screenshots: ${s.screenshot_count || 0}`);
    console.log('');
  });
}

findSessions();

