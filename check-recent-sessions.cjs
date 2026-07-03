/**
 * Check if HPPRO sessions are being saved
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkRecentSessions() {
  console.log('\n📊 CHECKING RECENT HPPRO SESSIONS\n');
  console.log('='.repeat(60));

  try {
    // Get sessions from the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: sessions, error } = await supabase
      .from('presentation_sessions')
      .select('*')
      .gte('started_at', thirtyMinutesAgo)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`\n📝 Found ${sessions?.length || 0} sessions in last 30 minutes\n`);

    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        console.log('─'.repeat(60));
        console.log(`Session ID: ${session.session_id}`);
        console.log(`Agent: ${session.agent_name} (${session.agent_email})`);
        console.log(`Type: ${session.presentation_type}`);
        console.log(`Started: ${new Date(session.started_at).toLocaleString()}`);
        console.log(`Status: ${session.status}`);
        
        // Check screenshots for this session
        const { data: screenshots, error: screenshotError } = await supabase
          .from('presentation_screenshots')
          .select('*')
          .eq('session_id', session.id) // Use UUID id
          .order('captured_at', { ascending: false });

        if (!screenshotError && screenshots) {
          console.log(`📸 Screenshots: ${screenshots.length}`);
          if (screenshots.length > 0) {
            const latest = screenshots[0];
            console.log(`   Latest: ${new Date(latest.captured_at).toLocaleString()}`);
            console.log(`   Has URL: ${!!latest.screenshot_url}`);
          }
        } else {
          console.log(`📸 Screenshots: 0 (or error: ${screenshotError?.message})`);
        }
      }
      console.log('─'.repeat(60));
    } else {
      console.log('⚠️  No sessions found in the last 30 minutes');
      console.log('\nTips:');
      console.log('  - Make sure HPPRO is open in the Electron app');
      console.log('  - Check that you are logged in');
      console.log('  - Verify the presentation window was detected');
      console.log('  - Check Electron console logs for errors');
    }

    // Also check very recent screenshots (any session)
    console.log('\n\n📸 RECENT SCREENSHOTS (last 10 minutes, any session)\n');
    console.log('='.repeat(60));
    
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentScreenshots, error: recentError } = await supabase
      .from('presentation_screenshots')
      .select('*, presentation_sessions!inner(session_id, agent_email)')
      .gte('captured_at', tenMinutesAgo)
      .order('captured_at', { ascending: false })
      .limit(10);

    if (!recentError && recentScreenshots && recentScreenshots.length > 0) {
      console.log(`Found ${recentScreenshots.length} recent screenshots:\n`);
      recentScreenshots.forEach((ss, i) => {
        console.log(`${i + 1}. Captured: ${new Date(ss.captured_at).toLocaleString()}`);
        console.log(`   Session: ${ss.presentation_sessions?.session_id}`);
        console.log(`   Agent: ${ss.presentation_sessions?.agent_email}`);
        console.log(`   Sequence: #${ss.sequence_number}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No screenshots captured in last 10 minutes');
      console.log('\nThis means:');
      console.log('  ❌ Screenshots are NOT being saved to database');
      console.log('  💡 Check server logs for errors');
      console.log('  💡 Make sure fix is deployed to production');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRecentSessions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

