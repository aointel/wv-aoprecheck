import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const email = 'leynatran@aoglobelife.com';

console.log(`🔍 Checking Leyna's presentations...\n`);

const { data: sessions, error } = await supabase
  .from('presentation_sessions')
  .select('id, started_at, status, screenshot_count, client_data, current_phase')
  .eq('agent_email', email)
  .order('started_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Found ${sessions.length} sessions:\n`);
  
  for (const session of sessions) {
    console.log(`Session: ${session.id}`);
    console.log(`  Started: ${session.started_at}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  screenshot_count: ${session.screenshot_count}`);
    console.log(`  client_data: ${JSON.stringify(session.client_data)?.substring(0, 100)}`);
    console.log(`  current_phase: ${JSON.stringify(session.current_phase)?.substring(0, 100)}`);
    
    // Count actual screenshots
    const { count } = await supabase
      .from('presentation_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    
    console.log(`  ACTUAL screenshot count in DB: ${count}`);
    console.log('');
  }
}

