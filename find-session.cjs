const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0',
  { global: { fetch } }
);

(async () => {
  const sessionId = 'session_1761156940902_9tfsj0d4m';
  
  console.log(`🔍 Searching for session: ${sessionId}\n`);
  
  const { data: session, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!session) {
    console.log('❌ Session not found');
    return;
  }
  
  console.log('✅ Session found:');
  console.log(JSON.stringify(session, null, 2));
  
  // Get screenshots
  const { data: screenshots } = await supabase
    .from('presentation_screenshots')
    .select('sequence_number, file_path, slide_title, slide_type, created_at')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });
  
  console.log(`\n📸 Screenshots: ${screenshots?.length || 0} found`);
  if (screenshots && screenshots.length > 0) {
    screenshots.forEach(s => {
      console.log(`  [${s.sequence_number}] ${s.slide_title || 'no title'} (${s.slide_type || 'unknown'})`);
      console.log(`      ${s.file_path}`);
    });
  }
})();

