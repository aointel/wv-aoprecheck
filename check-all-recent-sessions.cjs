const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkAllRecentSessions() {
  console.log('\n📊 CHECKING ALL RECENT SESSIONS (LAST 2 HOURS)\n');
  console.log('============================================================');
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data: sessions, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .gte('started_at', twoHoursAgo)
    .order('started_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📝 Found ${sessions.length} sessions in last 2 hours\n`);
  
  for (const session of sessions) {
    // Count screenshots for this session
    const { count } = await supabase
      .from('presentation_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    
    const startTime = new Date(session.started_at).toLocaleString();
    
    console.log('────────────────────────────────────────────────────────────');
    console.log(`Session ID: ${session.session_id}`);
    console.log(`Agent: ${session.agent_email} (${session.agent_name || 'N/A'})`);
    console.log(`Type: ${session.presentation_type || 'N/A'}`);
    console.log(`Started: ${startTime}`);
    console.log(`Status: ${session.status}`);
    console.log(`📸 Screenshots: ${count || 0}`);
  }
  
  console.log('────────────────────────────────────────────────────────────');
}

checkAllRecentSessions().catch(console.error);

