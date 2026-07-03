/**
 * Check if presentation screenshots are being captured
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkRecentScreenshots() {
  console.log('\n🔍 CHECKING RECENT PRESENTATION SCREENSHOTS\n');
  console.log('='.repeat(60));

  try {
    // Check recent presentation sessions (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentSessions, error: sessionsError } = await supabase
      .from('presentation_sessions')
      .select('session_id, agent_email, started_at, ended_at, status, screenshot_count, current_phase')
      .gte('started_at', oneDayAgo.toISOString())
      .order('started_at', { ascending: false })
      .limit(20);

    if (sessionsError) {
      console.error('❌ Error:', sessionsError);
      return;
    }

    console.log(`📊 Found ${recentSessions?.length || 0} presentation sessions in last 24 hours\n`);

    if (!recentSessions || recentSessions.length === 0) {
      console.log('⚠️ No presentations found in last 24 hours!');
      return;
    }

    let withScreenshots = 0;
    let withoutScreenshots = 0;
    let withPhaseTracking = 0;

    console.log('📋 RECENT PRESENTATIONS:\n');

    for (const session of recentSessions) {
      const hasScreenshots = (session.screenshot_count || 0) > 0;
      const hasPhase = session.current_phase && session.current_phase !== 'unknown';
      
      if (hasScreenshots) withScreenshots++;
      else withoutScreenshots++;
      
      if (hasPhase) withPhaseTracking++;

      const status = hasScreenshots ? '✅' : '❌';
      const phaseDisplay = hasPhase ? `📍 ${session.current_phase}` : '⚠️ No phase';
      
      console.log(`${status} ${session.agent_email} - ${session.started_at.substring(0, 16)}`);
      console.log(`   Screenshots: ${session.screenshot_count || 0}, Status: ${session.status}, ${phaseDisplay}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 SCREENSHOT CAPTURE STATS (Last 24h):\n`);
    console.log(`   Total Sessions: ${recentSessions.length}`);
    console.log(`   ✅ WITH Screenshots: ${withScreenshots} (${((withScreenshots / recentSessions.length) * 100).toFixed(1)}%)`);
    console.log(`   ❌ WITHOUT Screenshots: ${withoutScreenshots} (${((withoutScreenshots / recentSessions.length) * 100).toFixed(1)}%)`);
    console.log(`   📍 WITH Phase Tracking: ${withPhaseTracking} (${((withPhaseTracking / recentSessions.length) * 100).toFixed(1)}%)`);

    if (withoutScreenshots > 0) {
      console.log(`\n⚠️ WARNING: ${withoutScreenshots} presentations have NO screenshots!`);
      console.log(`   This means:`);
      console.log(`   1. HPPRO is being opened in web browser (not Electron)`);
      console.log(`   2. Screenshot capture API is not being called`);
      console.log(`   3. AI analysis cannot run without screenshots`);
    }

    // Check most recent screenshot capture
    console.log(`\n\n🔍 CHECKING MOST RECENT SCREENSHOT CAPTURE:\n`);
    
    const { data: recentScreenshot, error: screenshotError } = await supabase
      .from('presentation_screenshots')
      .select('session_id, sequence_number, created_at, ai_analysis')
      .order('created_at', { ascending: false })
      .limit(1);

    if (screenshotError) {
      console.error('❌ Error:', screenshotError);
    } else if (recentScreenshot && recentScreenshot.length > 0) {
      const screenshot = recentScreenshot[0];
      console.log(`✅ Most recent screenshot: ${screenshot.created_at}`);
      console.log(`   Session ID: ${screenshot.session_id}`);
      console.log(`   Sequence: ${screenshot.sequence_number}`);
      console.log(`   AI Analysis: ${screenshot.ai_analysis ? '✅ Present' : '❌ Missing'}`);
    } else {
      console.log(`❌ NO SCREENSHOTS FOUND IN DATABASE!`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkRecentScreenshots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

