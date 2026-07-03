const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function monitorLiveScreenshots() {
  console.log('\n🔴 LIVE SCREENSHOT MONITORING\n');
  console.log('============================================================');
  console.log('Checking for screenshots in last 2 minutes...\n');
  
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  // Check database
  const { data: dbScreenshots, error: dbError } = await supabase
    .from('presentation_screenshots')
    .select('*, presentation_sessions(agent_email, session_id)')
    .gte('captured_at', twoMinutesAgo)
    .order('captured_at', { ascending: false });
  
  console.log(`📊 Database: ${dbScreenshots?.length || 0} screenshots in last 2 minutes`);
  
  if (dbScreenshots && dbScreenshots.length > 0) {
    for (const screenshot of dbScreenshots) {
      const time = new Date(screenshot.captured_at).toLocaleTimeString();
      const session = screenshot.presentation_sessions;
      console.log(`  ✅ ${time} - ${session?.agent_email || 'Unknown'} - Seq ${screenshot.sequence_number}`);
      console.log(`     File: ${screenshot.file_path}`);
    }
  }
  
  console.log('\n📦 Checking Supabase Storage for recent files...');
  
  // Check storage
  const { data: files, error: storageError } = await supabase.storage
    .from('verify_agent_screenshot')
    .list('', {
      limit: 20,
      sortBy: { column: 'created_at', order: 'desc' }
    });
  
  const recentFiles = files?.filter(f => {
    if (!f.created_at) return false;
    const fileTime = new Date(f.created_at).getTime();
    const cutoff = Date.now() - (2 * 60 * 1000);
    return fileTime > cutoff && f.name.startsWith('PRES-');
  });
  
  console.log(`📦 Storage: ${recentFiles?.length || 0} PRES files in last 2 minutes`);
  
  if (recentFiles && recentFiles.length > 0) {
    for (const file of recentFiles) {
      const time = new Date(file.created_at).toLocaleTimeString();
      const size = (file.metadata?.size / 1024).toFixed(1);
      console.log(`  ✅ ${time} - ${file.name} (${size} KB)`);
    }
  }
  
  console.log('\n💡 If both show screenshots, the system is working!');
}

monitorLiveScreenshots().catch(console.error);

