/**
 * Check screenshot capture activity across ALL agents
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkAllScreenshotActivity() {
  console.log('\n🔍 CHECKING SCREENSHOT CAPTURE ACTIVITY - ALL AGENTS\n');
  console.log('='.repeat(60));

  try {
    // Check last 7 days of screenshots
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: screenshots, error } = await supabase
      .from('presentation_screenshots')
      .select('session_id, sequence_number, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`📊 Found ${screenshots?.length || 0} screenshots in last 7 days\n`);

    if (!screenshots || screenshots.length === 0) {
      console.log('🚨 NO SCREENSHOTS CAPTURED IN LAST 7 DAYS!');
      console.log('   This means NO agents are using Electron app for HPPRO!\n');
      return;
    }

    // Group by date
    const byDate = {};
    screenshots.forEach(ss => {
      const date = ss.created_at.substring(0, 10);
      if (!byDate[date]) byDate[date] = 0;
      byDate[date]++;
    });

    console.log('📅 SCREENSHOTS BY DATE:\n');
    Object.keys(byDate).sort().reverse().forEach(date => {
      console.log(`   ${date}: ${byDate[date]} screenshots`);
    });

    // Get unique sessions with screenshots
    const uniqueSessions = new Set(screenshots.map(ss => ss.session_id));
    
    console.log(`\n📊 SUMMARY:\n`);
    console.log(`   Total Screenshots: ${screenshots.length}`);
    console.log(`   Unique Sessions: ${uniqueSessions.size}`);
    console.log(`   Avg per Session: ${(screenshots.length / uniqueSessions.size).toFixed(1)}`);

    // Check most recent
    const mostRecent = screenshots[0];
    console.log(`\n🕐 MOST RECENT SCREENSHOT:`);
    console.log(`   Date: ${mostRecent.created_at}`);
    console.log(`   Session: ${mostRecent.session_id}`);
    console.log(`   Sequence: ${mostRecent.sequence_number}`);

    const hoursSince = Math.floor((Date.now() - new Date(mostRecent.created_at).getTime()) / (1000 * 60 * 60));
    console.log(`   ⏰ ${hoursSince} hours ago`);

    if (hoursSince > 24) {
      console.log(`\n🚨 WARNING: No screenshots in ${hoursSince} hours!`);
      console.log(`   Agents are NOT using Electron app!`);
    }

    // Now check how many presentations happened WITHOUT screenshots
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('presentation_sessions')
      .select('session_id, agent_email, started_at, screenshot_count')
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: false });

    if (!sessionsError && recentSessions) {
      const withScreenshots = recentSessions.filter(s => (s.screenshot_count || 0) > 0).length;
      const withoutScreenshots = recentSessions.length - withScreenshots;

      console.log(`\n\n📊 PRESENTATION SESSIONS (Last 7 days):\n`);
      console.log(`   Total Presentations: ${recentSessions.length}`);
      console.log(`   ✅ WITH Screenshots: ${withScreenshots} (${((withScreenshots / recentSessions.length) * 100).toFixed(1)}%)`);
      console.log(`   ❌ WITHOUT Screenshots: ${withoutScreenshots} (${((withoutScreenshots / recentSessions.length) * 100).toFixed(1)}%)`);

      if (withoutScreenshots > withScreenshots) {
        console.log(`\n🚨 CRITICAL: Majority of presentations have NO screenshots!`);
        console.log(`   ${withoutScreenshots} out of ${recentSessions.length} presentations are BLIND!`);
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkAllScreenshotActivity()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

