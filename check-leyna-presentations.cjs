/**
 * Check Leyna's presentation sessions
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkLeynaPresentations() {
  console.log('\n🔍 CHECKING LEYNA TRAN PRESENTATIONS\n');
  console.log('='.repeat(60));

  try {
    const { data: sessions, error } = await supabase
      .from('presentation_sessions')
      .select('*')
      .eq('agent_email', 'leynatran@aoglobelife.com')
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`📊 Found ${sessions?.length || 0} total presentations for leynatran@aoglobelife.com\n`);

    if (!sessions || sessions.length === 0) {
      console.log('❌ No presentations found!');
      return;
    }

    console.log('📋 RECENT PRESENTATIONS:\n');

    for (const session of sessions) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Session ID: ${session.session_id}`);
      console.log(`Started: ${session.started_at}`);
      console.log(`Ended: ${session.ended_at || 'Still active'}`);
      console.log(`Status: ${session.status}`);
      console.log(`Screenshots: ${session.screenshot_count || 0}`);
      console.log(`Current Phase: ${session.current_phase || 'None'}`);
      console.log(`Phase Updated: ${session.phase_updated_at || 'Never'}`);
      
      // Parse client_data
      let clientData = session.client_data || {};
      if (typeof clientData === 'string') {
        try {
          clientData = JSON.parse(clientData);
        } catch (e) {
          clientData = {};
        }
      }
      
      console.log(`\nClient Data:`);
      console.log(`   First Name: ${clientData.firstName || 'N/A'}`);
      console.log(`   Last Name: ${clientData.lastName || 'N/A'}`);
      console.log(`   Phone: ${clientData.phone || 'N/A'}`);
      console.log(`   State: ${clientData.state || 'N/A'}`);
      console.log(`   Lead Type: ${clientData.leadType || 'N/A'}`);
      
      // Check for screenshots
      if ((session.screenshot_count || 0) > 0) {
        const { data: screenshots } = await supabase
          .from('presentation_screenshots')
          .select('sequence_number, created_at, ai_analysis')
          .eq('session_id', session.id)
          .order('sequence_number', { ascending: true });
        
        console.log(`\n📸 Screenshots:`);
        screenshots?.forEach(ss => {
          console.log(`   ${ss.sequence_number}. Captured: ${ss.created_at.substring(0, 19)}, AI: ${ss.ai_analysis ? '✅' : '❌'}`);
        });
      } else {
        console.log(`\n⚠️ NO SCREENSHOTS CAPTURED`);
        console.log(`   This means HPPRO was opened in web browser, not Electron!`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n💡 TRACKING STATUS:\n`);
    
    const withScreenshots = sessions.filter(s => (s.screenshot_count || 0) > 0).length;
    const withPhase = sessions.filter(s => s.current_phase && s.current_phase !== 'unknown').length;
    
    console.log(`   Total Sessions: ${sessions.length}`);
    console.log(`   ✅ WITH Screenshots: ${withScreenshots}`);
    console.log(`   📍 WITH Phase Tracking: ${withPhase}`);
    console.log(`   ❌ WITHOUT Screenshots: ${sessions.length - withScreenshots}`);
    
    if (withScreenshots === 0) {
      console.log(`\n🚨 PROBLEM: NONE of Leyna's presentations have screenshots!`);
      console.log(`   She is NOT using the Electron app to open HPPRO.`);
      console.log(`   Without screenshots, we CANNOT track presentation progress or AI analysis.`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkLeynaPresentations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

