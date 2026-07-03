const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkScreenshotsWithUrls() {
  console.log('\n📊 CHECKING RECENT SCREENSHOTS WITH STORAGE STATUS\n');
  console.log('============================================================');
  
  const { data: screenshots, error } = await supabase
    .from('presentation_screenshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📸 Found ${screenshots.length} recent screenshots\n`);
  
  for (const screenshot of screenshots) {
    const time = new Date(screenshot.captured_at).toLocaleString();
    console.log('────────────────────────────────────────────────────────────');
    console.log(`ID: ${screenshot.id}`);
    console.log(`Session: ${screenshot.session_id}`);
    console.log(`Sequence: ${screenshot.sequence_number}`);
    console.log(`Captured: ${time}`);
    console.log(`File Path: ${screenshot.file_path || 'NULL'}`);
    console.log(`Has URL: ${screenshot.screenshot_url ? '✅ YES' : '❌ NO'}`);
    if (screenshot.screenshot_url) {
      console.log(`URL: ${screenshot.screenshot_url.substring(0, 80)}...`);
    }
  }
  
  console.log('────────────────────────────────────────────────────────────');
}

checkScreenshotsWithUrls().catch(console.error);

