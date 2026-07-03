// Diagnostic script to check why screenshots aren't being analyzed
const { createClient } = require('@supabase/supabase-js');

// Use same credentials as check-recent-unanalyzed-sessions.cjs
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnose() {
  console.log('\n🔍 DIAGNOSING SCREENSHOT ANALYSIS ISSUE\n');
  console.log('='.repeat(60));

  // 1. Check recent PENDING sessions
  console.log('\n📋 Checking recent PENDING sessions...');
  const { data: pendingSessions, error: pendingError } = await supabase
    .from('verification_sessions')
    .select('*')  // Get all columns
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(20);

  if (pendingError) {
    console.error('❌ Error fetching sessions:', pendingError);
    return;
  }

  console.log(`\nFound ${pendingSessions?.length || 0} PENDING sessions\n`);

  // 2. Analyze each session
  let withScreenshots = 0;
  let withoutScreenshots = 0;
  let analyzed = 0;
  let notAnalyzed = 0;
  let pendingUrl = 0;
  let nullUrl = 0;
  let hasPath = 0;

  pendingSessions?.forEach((session, idx) => {
    const hasScreenshotUrl = session.screenshot_url && session.screenshot_url !== 'PENDING' && session.screenshot_url.trim() !== '';
    const hasScreenshotPath = session.screenshot_path && session.screenshot_path !== 'PENDING' && session.screenshot_path.trim() !== '';
    const hasScreenshot = hasScreenshotUrl || hasScreenshotPath;
    const isAnalyzed = session.screenshot_analysis_complete === true;
    const retryCount = session.screenshot_analysis_retry_count || 0;

    if (hasScreenshot) withScreenshots++;
    else withoutScreenshots++;

    if (isAnalyzed) analyzed++;
    else if (hasScreenshot) notAnalyzed++;

    if (session.screenshot_url === 'PENDING') pendingUrl++;
    if (!session.screenshot_url || session.screenshot_url === null) nullUrl++;
    if (hasScreenshotPath) hasPath++;

    // Show details for sessions with screenshots but not analyzed
    if (hasScreenshot && !isAnalyzed) {
      console.log(`\n${idx + 1}. ${session.first_name || ''} ${session.last_name || ''} (${session.company_email || 'no email'})`);
      console.log(`   ID: ${session.id}`);
      console.log(`   screenshot_url: ${session.screenshot_url || 'NULL'}`);
      console.log(`   screenshot_path: ${session.screenshot_path || 'NULL'}`);
      console.log(`   screenshot_analysis_complete: ${session.screenshot_analysis_complete}`);
      console.log(`   screenshot_analysis_retry_count: ${retryCount}`);
      console.log(`   Created: ${session.created_at}`);
      console.log(`   ✅ HAS SCREENSHOT but ❌ NOT ANALYZED`);
      
      // Check if it would be found by scheduler query
      const wouldBeFound = hasScreenshot && 
                          (session.screenshot_analysis_complete === null || session.screenshot_analysis_complete === false) &&
                          retryCount < 1;
      console.log(`   Would scheduler find this? ${wouldBeFound ? '✅ YES' : '❌ NO'}`);
    }
  });

  // 3. Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total PENDING sessions: ${pendingSessions?.length || 0}`);
  console.log(`   Sessions WITH screenshots: ${withScreenshots}`);
  console.log(`   Sessions WITHOUT screenshots: ${withoutScreenshots}`);
  console.log(`   Screenshots analyzed: ${analyzed}`);
  console.log(`   Screenshots NOT analyzed: ${notAnalyzed}`);
  console.log(`   screenshot_url = 'PENDING': ${pendingUrl}`);
  console.log(`   screenshot_url = NULL: ${nullUrl}`);
  console.log(`   Has screenshot_path: ${hasPath}`);

  // 4. Test the scheduler query
  console.log('\n' + '='.repeat(60));
  console.log('\n🧪 Testing scheduler query...');
  
  const { data: schedulerQuery, error: schedulerError } = await supabase
    .from('verification_sessions')
    .select('*')  // Get all columns
    .or('screenshot_url.not.is.null,screenshot_path.not.is.null')
    .order('created_at', { ascending: false })
    .limit(50);

  if (schedulerError) {
    console.error('❌ Scheduler query error:', schedulerError);
  } else {
    console.log(`\nScheduler query found: ${schedulerQuery?.length || 0} sessions`);
    
    // Filter like the scheduler does
    const filtered = schedulerQuery?.filter(session => {
      const hasScreenshot = (session.screenshot_url && 
                             session.screenshot_url !== 'PENDING' && 
                             session.screenshot_url.trim() !== '') ||
                            (session.screenshot_path && 
                             session.screenshot_path !== 'PENDING' && 
                             session.screenshot_path.trim() !== '');
      
      const needsAnalysis = session.screenshot_analysis_complete === null || 
                            session.screenshot_analysis_complete === false;
      
      const retryCount = session.screenshot_analysis_retry_count || session.audio_analysis_retry_count || 0;
      const canRetry = retryCount < 1;
      
      return hasScreenshot && needsAnalysis && canRetry;
    });

    console.log(`After filtering: ${filtered?.length || 0} sessions would be processed`);
    
    if (filtered && filtered.length > 0) {
      console.log('\nSessions that SHOULD be analyzed:');
      filtered.slice(0, 10).forEach((s, idx) => {
        console.log(`   ${idx + 1}. ${s.first_name || ''} ${s.last_name || ''} - ${s.company_email || 'no email'}`);
        console.log(`      screenshot_url: ${s.screenshot_url || 'NULL'}`);
        console.log(`      screenshot_path: ${s.screenshot_path || 'NULL'}`);
      });
    }
  }

  // 5. Check if columns exist
  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 Checking if required columns exist...');
  
  const { data: columns, error: columnsError } = await supabase
    .rpc('get_table_columns', { table_name: 'verification_sessions' })
    .catch(() => {
      // Fallback: try direct query
      return supabase
        .from('verification_sessions')
        .select('*')
        .limit(1);
    });

  if (columnsError) {
    console.log('⚠️  Could not check columns directly, but query worked so columns likely exist');
  }

  console.log('\n✅ Diagnosis complete!\n');
}

diagnose().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
