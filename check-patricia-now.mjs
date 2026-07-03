import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const NOW = new Date();
const FIVE_MIN_AGO = new Date(NOW - 5 * 60 * 1000);

console.log('\n🔍 CHECKING PATRICIA\'S ACTIVE PRESENTATION...\n');
console.log(`Current time: ${NOW.toISOString()}`);
console.log(`Looking for sessions started after: ${FIVE_MIN_AGO.toISOString()}\n`);

// Get Patricia's recent sessions
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('*')
  .eq('agent_email', 'patriciasantamarina@aoglobelife.com')
  .gte('started_at', FIVE_MIN_AGO.toISOString())
  .order('started_at', { ascending: false });

console.log(`📊 Active sessions in last 5 minutes: ${sessions?.length || 0}\n`);

if (!sessions || sessions.length === 0) {
  console.log('❌ NO ACTIVE SESSIONS for Patricia\n');
  process.exit(0);
}

for (const session of sessions) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Session ID: ${session.id}`);
  console.log(`Electron ID: ${session.electron_session_id}`);
  console.log(`Started: ${session.started_at}`);
  console.log(`Status: ${session.status}`);
  
  // Check for screenshots
  const { data: screenshots, count } = await supabase
    .from('presentation_screenshots')
    .select('*', { count: 'exact' })
    .eq('session_id', session.id);
  
  console.log(`\n📸 SCREENSHOTS: ${count || 0}`);
  
  if (screenshots && screenshots.length > 0) {
    console.log(`   Latest screenshot: ${screenshots[0].captured_at}`);
    console.log(`   Screenshot size: ${(screenshots[0].screenshot_data?.length || 0 / 1024).toFixed(2)} KB`);
  } else {
    console.log(`   ❌ NO SCREENSHOTS CAPTURED YET`);
  }
  
  // Check for scraped data
  const { count: scrapedCount } = await supabase
    .from('scraped_presentation_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id);
  
  console.log(`\n📊 SCRAPED DATA: ${scrapedCount || 0} records`);
  console.log();
}

console.log('\n🔍 CHECKING WHY NO VIEW BUTTON...\n');
console.log('The VIEW button appears when:');
console.log('1. ✅ Session is in presentationLiveTracker (in-memory)');
console.log('2. ✅ Session has confirmedLive = true (30s open OR 2+ screenshots)');
console.log('3. ✅ Session has latestScreenshot populated');
console.log();
console.log('💡 DIAGNOSIS:');
console.log('- If screenshots = 0: Screenshot capture is BROKEN in Electron');
console.log('- If screenshots > 0 but count < 2: Wait for 2nd screenshot (30s interval)');
console.log('- If screenshots > 2: Server not uploading to presentationLiveTracker');
console.log();

