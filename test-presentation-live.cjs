const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkLiveSession() {
  console.log('🔍 Checking for active presentation sessions...\n');
  
  const { data: sessions } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false });
  
  if (!sessions || sessions.length === 0) {
    console.log('❌ No active sessions found');
    return;
  }
  
  console.log(`Found ${sessions.length} active session(s):\n`);
  
  for (const session of sessions) {
    console.log(`Session: ${session.session_id}`);
    console.log(`  Agent: ${session.agent_email}`);
    console.log(`  Started: ${new Date(session.started_at).toLocaleString()}`);
    console.log(`  Current phase: ${session.current_phase || 'NOT SET'}`);
    console.log(`  Client: ${session.client_full_name || 'NO DATA'}`);
    
    // Check screenshot count
    const { count } = await supabase
      .from('presentation_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    
    console.log(`  Screenshots: ${count || 0}`);
    console.log('');
  }
}

checkLiveSession();

