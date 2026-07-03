const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUnanalyzed() {
  console.log('🔍 Checking for recent sessions without AI analysis...\n');
  console.log('='.repeat(80));
  
  try {
    // Get sessions from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: sessions, error } = await supabase
      .from('verification_sessions')
      .select('id, session_id, first_name, last_name, agent_first_name, agent_last_name, company_email, verification_method, screenshot_url, screenshot_validation, recording_url, audio_analysis, status, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`\n📊 Total sessions (last 7 days): ${sessions.length}\n`);
    
    // Categorize sessions
    const withScreenshotNoAnalysis = sessions.filter(s => 
      s.screenshot_url && s.screenshot_url !== 'PENDING' && !s.screenshot_validation
    );
    
    const withRecordingNoAnalysis = sessions.filter(s => 
      s.recording_url && s.recording_url !== 'PENDING' && !s.audio_analysis
    );
    
    const fullyAnalyzed = sessions.filter(s => 
      (s.screenshot_url && s.screenshot_validation) || 
      (s.recording_url && s.audio_analysis)
    );
    
    const noUrls = sessions.filter(s => 
      (!s.screenshot_url || s.screenshot_url === 'PENDING') && 
      (!s.recording_url || s.recording_url === 'PENDING')
    );
    
    console.log('📊 SESSION BREAKDOWN:\n');
    console.log(`   ✅ Fully Analyzed: ${fullyAnalyzed.length}`);
    console.log(`   ⏳ Has Screenshot, NO Analysis: ${withScreenshotNoAnalysis.length}`);
    console.log(`   ⏳ Has Recording, NO Analysis: ${withRecordingNoAnalysis.length}`);
    console.log(`   ⚠️  No URLs uploaded: ${noUrls.length}\n`);
    
    console.log('='.repeat(80));
    
    if (withScreenshotNoAnalysis.length > 0) {
      console.log('\n❌ SESSIONS WITH SCREENSHOTS BUT NO AI ANALYSIS:\n');
      withScreenshotNoAnalysis.slice(0, 10).forEach(s => {
        console.log(`   ID: ${s.id}`);
        console.log(`   Client: ${s.first_name} ${s.last_name}`);
        console.log(`   Agent: ${s.agent_first_name} ${s.agent_last_name} (${s.company_email})`);
        console.log(`   Method: ${s.verification_method}`);
        console.log(`   Screenshot: ${s.screenshot_url ? 'YES' : 'NO'}`);
        console.log(`   Screenshot Analysis: ${s.screenshot_validation ? 'YES' : 'NO'}`);
        console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
        console.log();
      });
      
      if (withScreenshotNoAnalysis.length > 10) {
        console.log(`   ... and ${withScreenshotNoAnalysis.length - 10} more\n`);
      }
      
      console.log('💡 These sessions SHOULD be analyzed but aren\'t!');
      console.log('   The scheduler might be failing or not running.\n');
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUnanalyzed();






