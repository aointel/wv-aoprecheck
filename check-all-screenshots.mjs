import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING WHO HAS SCREENSHOTS STORED...\n');

// Get all screenshots from today
const { data: screenshots, error } = await supabase
  .from('presentation_screenshots')
  .select('session_id, sequence_number, captured_at')
  .gte('captured_at', '2025-10-26T00:00:00Z')
  .order('captured_at', { ascending: false });

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

if (!screenshots || screenshots.length === 0) {
  console.log('❌ NO SCREENSHOTS STORED IN DATABASE TODAY');
  process.exit(0);
}

console.log(`✅ Found ${screenshots.length} screenshots stored today\n`);

// Group by session
const bySession = {};
screenshots.forEach(s => {
  if (!bySession[s.session_id]) {
    bySession[s.session_id] = [];
  }
  bySession[s.session_id].push(s);
});

console.log(`📊 ${Object.keys(bySession).length} sessions with screenshots:\n`);

// Get session details
for (const sessionId of Object.keys(bySession)) {
  const { data: session } = await supabase
    .from('presentation_sessions')
    .select('agent_email, agent_name, started_at')
    .eq('id', sessionId)
    .single();
  
  const screenshotCount = bySession[sessionId].length;
  const latestScreenshot = bySession[sessionId][0];
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Agent: ${session?.agent_email || 'UNKNOWN'}`);
  console.log(`Session: ${sessionId}`);
  console.log(`Screenshots: ${screenshotCount}`);
  console.log(`Latest: ${latestScreenshot.captured_at}`);
  console.log();
}

