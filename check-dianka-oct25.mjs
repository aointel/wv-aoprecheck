import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

// Get Dianka's sessions since Oct 25
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('id, electron_session_id, started_at, ended_at, status, ai_summary, client_name, client_data')
  .eq('agent_email', 'diankablash@aoglobelife.com')
  .gte('started_at', '2025-10-25T00:00:00Z')
  .order('started_at', { ascending: false });

console.log('\n🔍 DIANKA SESSIONS SINCE OCT 25:', sessions?.length || 0);

for (const s of sessions || []) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Session ID:', s.id);
  console.log('Electron ID:', s.electron_session_id);
  console.log('Started:', s.started_at);
  console.log('Ended:', s.ended_at);
  console.log('Status:', s.status);
  console.log('AI Summary:', s.ai_summary || 'NONE');
  console.log('Client Name:', s.client_name || 'NONE');
  
  // Get scraped data count
  const { count } = await supabase
    .from('scraped_presentation_data')
    .select('*', { count: 'exact', head: true })
    .or(`session_id.eq.${s.id},session_id.eq.${s.electron_session_id}`);
  
  console.log('Scraped Data Count:', count);
  
  // Get sample of scraped data
  const { data: samples } = await supabase
    .from('scraped_presentation_data')
    .select('url, text_content')
    .or(`session_id.eq.${s.id},session_id.eq.${s.electron_session_id}`)
    .order('timestamp', { ascending: false })
    .limit(5);
  
  console.log('\nLast 5 URLs:');
  samples?.forEach((d, i) => {
    console.log(`  ${i+1}. ${d.url}`);
  });
  
  console.log('\nClient Data:', JSON.stringify(s.client_data, null, 2));
}

console.log('\n✅ Done');

