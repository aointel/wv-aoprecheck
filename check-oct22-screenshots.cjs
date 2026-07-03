const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkOct22Screenshots() {
  console.log('\n📊 CHECKING SCREENSHOTS FROM OCTOBER 22, 2025\n');
  console.log('============================================================');
  
  const startDate = '2025-10-22T00:00:00Z';
  const endDate = '2025-10-23T00:00:00Z';
  
  // Check database
  const { data: dbScreenshots, error } = await supabase
    .from('presentation_screenshots')
    .select('*, presentation_sessions(agent_email, session_id)')
    .gte('captured_at', startDate)
    .lt('captured_at', endDate)
    .order('captured_at', { ascending: false });
  
  console.log(`📊 Database: ${dbScreenshots?.length || 0} screenshots on Oct 22\n`);
  
  if (dbScreenshots && dbScreenshots.length > 0) {
    const byAgent = {};
    for (const screenshot of dbScreenshots) {
      const email = screenshot.presentation_sessions?.agent_email || 'Unknown';
      byAgent[email] = (byAgent[email] || 0) + 1;
    }
    
    console.log('Screenshots by agent:');
    for (const [email, count] of Object.entries(byAgent)) {
      console.log(`  ${email}: ${count} screenshots`);
    }
    
    console.log('\nFirst 5 screenshots:');
    for (let i = 0; i < Math.min(5, dbScreenshots.length); i++) {
      const s = dbScreenshots[i];
      console.log(`  ${new Date(s.captured_at).toLocaleString()}`);
      console.log(`    File: ${s.file_path || 'NULL'}`);
      console.log(`    Has URL: ${s.screenshot_url ? 'YES' : 'NO'}`);
    }
  }
  
  // Check storage
  const { data: files } = await supabase.storage
    .from('verify_agent_screenshot')
    .list('', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' }
    });
  
  const oct22Files = files?.filter(f => {
    if (!f.created_at) return false;
    const fileDate = new Date(f.created_at);
    return fileDate >= new Date(startDate) && fileDate < new Date(endDate) && f.name.startsWith('PRES-');
  });
  
  console.log(`\n📦 Storage: ${oct22Files?.length || 0} PRES files on Oct 22`);
}

checkOct22Screenshots().catch(console.error);

