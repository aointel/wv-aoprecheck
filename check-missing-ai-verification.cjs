/**
 * Check which verification sessions are missing AI analysis
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkMissingAnalysis() {
  console.log('\n🔍 CHECKING VERIFICATION SESSIONS MISSING AI ANALYSIS\n');
  console.log('='.repeat(60));

  try {
    // Get sessions with screenshots but no validation
    const { data: missingScreenshot, error: screenshotError } = await supabase
      .from('verification_sessions')
      .select('*')
      .not('screenshot_url', 'is', null)
      .is('screenshot_validation', null)
      .order('created_at', { ascending: false })
      .limit(20);

    console.log(`\n📸 Sessions with screenshot but NO validation: ${missingScreenshot?.length || 0}\n`);
    
    if (missingScreenshot && missingScreenshot.length > 0) {
      missingScreenshot.forEach(session => {
        const age = Math.round((Date.now() - new Date(session.created_at).getTime()) / (1000 * 60));
        console.log(`  ID: ${session.id}`);
        console.log(`  Agent: ${session.agent_email}`);
        console.log(`  Phone: ${session.phone}`);
        console.log(`  Created: ${new Date(session.created_at).toLocaleString()} (${age} minutes ago)`);
        console.log(`  Screenshot: ${session.screenshot_url ? 'YES' : 'NO'}`);
        console.log(`  Method: ${session.verification_method}`);
        console.log('  ---');
      });
    }

    // Get sessions with recording but no audio analysis
    const { data: missingAudio, error: audioError } = await supabase
      .from('verification_sessions')
      .select('*')
      .not('recording_url', 'is', null)
      .is('audio_analysis', null)
      .order('created_at', { ascending: false })
      .limit(20);

    console.log(`\n🎵 Sessions with recording but NO audio analysis: ${missingAudio?.length || 0}\n`);
    
    if (missingAudio && missingAudio.length > 0) {
      missingAudio.forEach(session => {
        const age = Math.round((Date.now() - new Date(session.created_at).getTime()) / (1000 * 60));
        console.log(`  ID: ${session.id}`);
        console.log(`  Agent: ${session.agent_email}`);
        console.log(`  Phone: ${session.phone}`);
        console.log(`  Created: ${new Date(session.created_at).toLocaleString()} (${age} minutes ago)`);
        console.log(`  Recording: ${session.recording_url ? 'YES' : 'NO'}`);
        console.log('  ---');
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 POSSIBLE ISSUES:');
    console.log('  1. Analysis scheduler not running');
    console.log('  2. Screenshot/recording URLs are invalid');
    console.log('  3. OpenAI API errors');
    console.log('  4. Sessions created AFTER scheduler last ran');
    console.log('\n📝 The scheduler runs every 30 minutes.');
    console.log('   Sessions older than 30 min should have been analyzed.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMissingAnalysis()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

