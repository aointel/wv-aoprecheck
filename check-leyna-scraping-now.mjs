import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const NOW = new Date();
const FIVE_MINUTES_AGO = new Date(NOW - 5 * 60 * 1000);

console.log('\n🔍 CHECKING LEYNA SCRAPING ACTIVITY...\n');

// Check for active sessions in last 5 minutes
const { data: recentSessions } = await supabase
  .from('presentation_sessions')
  .select('id, electron_session_id, started_at, status')
  .eq('agent_email', 'leynatran@aoglobelife.com')
  .gte('started_at', FIVE_MINUTES_AGO.toISOString())
  .order('started_at', { ascending: false });

console.log(`📊 Sessions in last 5 minutes: ${recentSessions?.length || 0}`);

if (!recentSessions || recentSessions.length === 0) {
  console.log('\n❌ NO - Leyna has NO active sessions in the last 5 minutes');
  console.log('   She needs to open HPPRO to start scraping\n');
  process.exit(0);
}

// Check for scraped data in last 5 minutes
for (const session of recentSessions) {
  console.log(`\n📁 Session: ${session.id}`);
  console.log(`   Started: ${session.started_at}`);
  console.log(`   Status: ${session.status}`);
  
  const { count } = await supabase
    .from('scraped_presentation_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .gte('timestamp', FIVE_MINUTES_AGO.toISOString());
  
  console.log(`   Scrapes in last 5 min: ${count}`);
  
  if (count > 0) {
    console.log('\n✅ YES - Leyna IS scraping RIGHT NOW!');
    
    // Get latest scrape
    const { data: latest } = await supabase
      .from('scraped_presentation_data')
      .select('scraped_data, timestamp')
      .eq('session_id', session.id)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (latest && latest[0]) {
      console.log(`\n   Latest scrape:`);
      console.log(`   Time: ${latest[0].timestamp}`);
      console.log(`   URL: ${latest[0].scraped_data?.url || 'N/A'}`);
      console.log(`   Title: ${latest[0].scraped_data?.title || 'N/A'}`);
    }
    process.exit(0);
  }
}

console.log('\n❌ NO - Session exists but NO scraping activity in last 5 minutes\n');
process.exit(0);

