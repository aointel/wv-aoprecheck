import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno3amV0eXdwZmd0cnpleXl0dCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MjYxNjk0ODEsImV4cCI6MjA0MTc0NTQ4MX0.0z1Zdt2z2YNmLMYK1qvZ7UkS5QO3pFwipg7WYIobGt0'
);

// Get ALL of Dianka's sessions
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('id, electron_session_id, started_at, status, ai_summary, client_name')
  .eq('agent_email', 'diankablash@aoglobelife.com')
  .order('started_at', { ascending: false })
  .limit(10);

console.log('\n🔍 DIANKA ALL SESSIONS:', sessions?.length || 0);

for (const s of sessions || []) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Started:', s.started_at);
  console.log('Status:', s.status);
  console.log('Client:', s.client_name || 'NONE');
  console.log('Summary:', s.ai_summary || 'NONE');
  
  // Get scraped data count
  const { count } = await supabase
    .from('scraped_presentation_data')
    .select('*', { count: 'exact', head: true })
    .or(`session_id.eq.${s.id},session_id.eq.${s.electron_session_id}`);
  
  console.log('Scraped Data:', count);
}

// Check if she has v1.0.3
console.log('\n\n🔍 CHECKING APP VERSION...');
const { data: versionData } = await supabase
  .from('app_versions')
  .select('*')
  .eq('agent_email', 'diankablash@aoglobelife.com')
  .order('last_seen', { ascending: false })
  .limit(1);

console.log('Version info:', versionData);

console.log('\n✅ Done');

