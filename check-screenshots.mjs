import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('📸 Checking screenshots in database...\n');

// Get total count
const { count: totalCount } = await supabase
  .from('presentation_screenshots')
  .select('*', { count: 'exact', head: true });

console.log(`Total screenshots: ${totalCount}\n`);

// Get recent screenshots
const { data: screenshots } = await supabase
  .from('presentation_screenshots')
  .select('session_id, sequence_number, captured_at, slide_title, slide_content')
  .order('captured_at', { ascending: false })
  .limit(10);

console.log('Recent screenshots:\n');
screenshots?.forEach(shot => {
  console.log(`Session: ${shot.session_id}`);
  console.log(`  Seq: ${shot.sequence_number}`);
  console.log(`  Captured: ${shot.captured_at}`);
  console.log(`  Title: ${shot.slide_title || 'N/A'}`);
  console.log(`  Content: ${shot.slide_content?.substring(0, 100) || 'N/A'}`);
  console.log('');
});

// Check which sessions have screenshots
const { data: sessionsWithScreenshots } = await supabase
  .from('presentation_screenshots')
  .select('session_id')
  .order('captured_at', { ascending: false });

const uniqueSessions = [...new Set(sessionsWithScreenshots?.map(s => s.session_id))];

console.log(`\n📊 ${uniqueSessions.length} unique sessions have screenshots\n`);
console.log('Session IDs with screenshots:');
uniqueSessions.slice(0, 10).forEach(id => console.log(`  - ${id}`));

