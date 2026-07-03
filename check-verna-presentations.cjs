/**
 * Check Verna's presentations - are we tracking screenshots and milestones?
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkVernaPresentations() {
  console.log('\n🔍 CHECKING VERNA\'S PRESENTATIONS TODAY\n');
  console.log('='.repeat(60));

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get Verna's presentations from today
    const { data: presentations, error } = await supabase
      .from('presentation_sessions')
      .select('*')
      .ilike('agent_email', '%verna%')
      .gte('started_at', today.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`\n📊 Found ${presentations?.length || 0} presentations for Verna today\n`);

    if (!presentations || presentations.length === 0) {
      console.log('❌ No presentations found for Verna today!');
      return;
    }

    for (const p of presentations) {
      console.log('='.repeat(60));
      console.log(`\n📋 Presentation: ${p.session_id}`);
      console.log(`   Started: ${new Date(p.started_at).toLocaleString()}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Agent: ${p.agent_email}`);
      
      // Parse client data
      let clientData = {};
      try {
        clientData = typeof p.client_data === 'string' ? JSON.parse(p.client_data) : p.client_data || {};
      } catch (e) {}
      
      console.log(`   Client: ${clientData.firstName || 'N/A'} ${clientData.lastName || 'N/A'}`);
      console.log(`   Phone: ${clientData.phone || 'N/A'}`);
      
      // Parse current phase
      let currentPhase = null;
      try {
        currentPhase = typeof p.current_phase === 'string' ? JSON.parse(p.current_phase) : p.current_phase;
      } catch (e) {}
      
      console.log(`\n   📍 Current Phase: ${currentPhase?.phase || 'NONE'}`);
      if (currentPhase?.timestamp) {
        console.log(`   Phase Updated: ${new Date(currentPhase.timestamp).toLocaleString()}`);
      }

      // Get screenshot count
      const { count: screenshotCount } = await supabase
        .from('presentation_screenshots')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', p.id);

      console.log(`\n   📸 Screenshots: ${screenshotCount || 0}`);

      // Get screenshots with AI analysis
      const { data: screenshots, error: screenshotError } = await supabase
        .from('presentation_screenshots')
        .select('sequence_number, ai_analysis, captured_at')
        .eq('session_id', p.id)
        .order('sequence_number', { ascending: false })
        .limit(10);

      if (screenshots && screenshots.length > 0) {
        console.log(`\n   🤖 AI Analysis Status:`);
        const analyzed = screenshots.filter(s => s.ai_analysis).length;
        console.log(`      ${analyzed}/${screenshots.length} screenshots analyzed`);
        
        if (analyzed > 0) {
          console.log(`\n   📊 Latest Screenshot Analysis:`);
          const latest = screenshots.find(s => s.ai_analysis);
          if (latest) {
            let analysis = latest.ai_analysis;
            try {
              analysis = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
            } catch (e) {}
            
            console.log(`      Milestone: ${analysis.milestone || 'N/A'}`);
            console.log(`      Confidence: ${analysis.confidence || 'N/A'}`);
            console.log(`      Has Client Data: ${analysis.hasClientData ? 'Yes' : 'No'}`);
            
            if (analysis.detectedElements) {
              console.log(`      Detected: ${analysis.detectedElements.join(', ')}`);
            }
          }
        } else {
          console.log(`      ⚠️  NO AI ANALYSIS FOUND!`);
        }
      }

      console.log('\n');
    }

    console.log('='.repeat(60));
    console.log('\n✅ Analysis Complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkVernaPresentations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

