import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 LEYNA ACTIVITY TODAY...\n');

// Get all sessions today
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('*')
  .eq('agent_email', 'leynatran@aoglobelife.com')
  .gte('started_at', '2025-10-26T00:00:00Z')
  .order('started_at', { ascending: false});

console.log(`📊 Total sessions today: ${sessions?.length || 0}\n`);

if (!sessions || sessions.length === 0) {
  console.log('❌ NO sessions today\n');
  process.exit(0);
}

for (const s of sessions) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Session: ${s.id}`);
  console.log(`Started: ${s.started_at}`);
  console.log(`Status: ${s.status}`);
  
  // Check scraped data
  const { count } = await supabase
    .from('scraped_presentation_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', s.id);
  
  console.log(`Scraped data: ${count}`);
  
  if (count > 0) {
    // Get first and last
    const { data: first } = await supabase
      .from('scraped_presentation_data')
      .select('timestamp, scraped_data')
      .eq('session_id', s.id)
      .order('timestamp', { ascending: true })
      .limit(1);
    
    const { data: last } = await supabase
      .from('scraped_presentation_data')
      .select('timestamp, scraped_data')
      .eq('session_id', s.id)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (first && first[0]) {
      console.log(`First scrape: ${first[0].timestamp}`);
      console.log(`  URL: ${first[0].scraped_data?.url}`);
    }
    if (last && last[0]) {
      console.log(`Last scrape: ${last[0].timestamp}`);
      console.log(`  URL: ${last[0].scraped_data?.url}`);
    }
  }
  console.log('');
}

console.log('\n✅ Done');

