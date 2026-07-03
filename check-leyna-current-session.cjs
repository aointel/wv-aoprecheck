/**
 * Check Leyna's current/most recent session for screenshots
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkLeynaCurrentSession() {
  console.log('\n🔍 CHECKING LEYNA\'S CURRENT SESSION\n');
  console.log('='.repeat(60));

  try {
    // Get Leyna's most recent session
    const { data: sessions, error: sessionError } = await supabase
      .from('presentation_sessions')
      .select('*')
      .eq('agent_email', 'leynatran@aoglobelife.com')
      .order('started_at', { ascending: false })
      .limit(1);

    if (sessionError) {
      console.error('❌ Error:', sessionError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('❌ No sessions found for Leyna!');
      return;
    }

    const session = sessions[0];
    
    console.log(`📋 MOST RECENT SESSION:\n`);
    console.log(`   Session ID: ${session.session_id}`);
    console.log(`   Internal ID: ${session.id}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Started: ${session.started_at}`);
    console.log(`   Ended: ${session.ended_at || 'Still active'}`);
    console.log(`   Screenshot Count: ${session.screenshot_count || 0}`);
    
    const startTime = new Date(session.started_at);
    const now = new Date();
    const minutesAgo = Math.floor((now - startTime) / (1000 * 60));
    console.log(`   ⏰ Started ${minutesAgo} minutes ago`);

    // Check for screenshots for this specific session
    const { data: screenshots, error: screenshotError } = await supabase
      .from('presentation_screenshots')
      .select('*')
      .eq('session_id', session.id)
      .order('sequence_number', { ascending: true });

    if (screenshotError) {
      console.error('\n❌ Error fetching screenshots:', screenshotError);
    } else {
      console.log(`\n📸 SCREENSHOTS FOR THIS SESSION:\n`);
      if (!screenshots || screenshots.length === 0) {
        console.log(`   ❌ NO SCREENSHOTS FOUND!`);
        console.log(`\n🚨 PROBLEM: Leyna opened HPPRO but NO screenshots captured!`);
        console.log(`   This means:`);
        console.log(`   1. She opened HPPRO in web browser (not Electron app)`);
        console.log(`   2. OR Electron screenshot capture is broken`);
        console.log(`   3. Without screenshots, we CANNOT see what she's presenting`);
        console.log(`   4. AI analysis CANNOT run`);
      } else {
        console.log(`   ✅ Found ${screenshots.length} screenshot(s)!`);
        screenshots.forEach((ss, idx) => {
          console.log(`\n   Screenshot ${idx + 1}:`);
          console.log(`      Sequence: ${ss.sequence_number}`);
          console.log(`      Captured: ${ss.created_at}`);
          console.log(`      Has Data: ${ss.screenshot_data ? 'Yes' : 'No'}`);
          console.log(`      AI Analysis: ${ss.ai_analysis ? 'Yes' : 'No'}`);
          if (ss.ai_analysis) {
            console.log(`      Analysis: ${JSON.stringify(ss.ai_analysis, null, 2).substring(0, 200)}...`);
          }
        });
      }
    }

    // Check if the session was created by the right endpoint
    console.log(`\n\n🔍 SESSION CREATION DEBUG:\n`);
    console.log(`   Created At: ${session.created_at}`);
    console.log(`   Updated At: ${session.updated_at}`);
    console.log(`   Screenshot Count in DB: ${session.screenshot_count}`);
    
    // Try to match by session_id string pattern
    if (session.session_id.includes('session_')) {
      console.log(`   ✅ Session ID format is correct (session_timestamp_random)`);
    } else {
      console.log(`   ⚠️ Session ID format is unusual: ${session.session_id}`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkLeynaCurrentSession()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

