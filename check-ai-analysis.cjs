const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkAIAnalysis() {
  console.log('\n🤖 CHECKING AI ANALYSIS STATUS\n');
  console.log('============================================================');
  
  // Get screenshots with AI analysis
  const { data: analyzed, error: err1 } = await supabase
    .from('presentation_screenshots')
    .select('*')
    .not('detected_slide_title', 'is', null)
    .limit(10);
  
  console.log(`✅ Screenshots WITH AI analysis: ${analyzed?.length || 0}`);
  
  // Get screenshots without AI analysis
  const { data: notAnalyzed, error: err2 } = await supabase
    .from('presentation_screenshots')
    .select('*')
    .is('detected_slide_title', null)
    .order('captured_at', { ascending: false })
    .limit(5);
  
  console.log(`❌ Screenshots WITHOUT AI analysis: ${notAnalyzed?.length || 0}\n`);
  
  if (notAnalyzed && notAnalyzed.length > 0) {
    console.log('Recent screenshots awaiting analysis:');
    for (const screenshot of notAnalyzed) {
      const time = new Date(screenshot.captured_at).toLocaleString();
      console.log(`  - Seq ${screenshot.sequence_number}: ${time} (${screenshot.file_path})`);
    }
  }
}

checkAIAnalysis().catch(console.error);

