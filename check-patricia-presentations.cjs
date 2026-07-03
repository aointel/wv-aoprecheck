const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkPatriciaData() {
  console.log('\n📊 CHECKING PATRICIA\'S PRESENTATION DATA\n');
  console.log('='.repeat(80));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get Patricia's presentations with ALL fields
  const { data: presentations, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('agent_email', 'patriciasantamarina@aoglobelife.com')
    .gte('started_at', today.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n✅ Found ${presentations?.length || 0} presentations for Patricia today\n`);

  presentations?.forEach((pres, index) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📊 PRESENTATION #${index + 1}`);
    console.log('─'.repeat(80));
    
    console.log(`\n🆔 Session ID: ${pres.id}`);
    console.log(`📅 Started: ${new Date(pres.started_at).toLocaleString()}`);
    console.log(`🏁 Ended: ${pres.ended_at ? new Date(pres.ended_at).toLocaleString() : 'STILL RUNNING or NOT ENDED'}`);
    
    // Duration
    if (pres.started_at && pres.ended_at) {
      const duration = Math.floor((new Date(pres.ended_at) - new Date(pres.started_at)) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      console.log(`⏱️  Duration: ${minutes}m ${seconds}s (${duration} seconds total)`);
    } else {
      console.log(`⏱️  Duration: UNKNOWN (no end time)`);
    }
    
    console.log(`\n📝 Presentation Details:`);
    console.log(`   Type: ${pres.presentation_type || 'N/A'}`);
    console.log(`   URL: ${pres.presentation_url || 'N/A'}`);
    console.log(`   Window Title: ${pres.window_title || 'N/A'}`);
    
    console.log(`\n👤 Agent:`);
    console.log(`   Email: ${pres.agent_email}`);
    console.log(`   Name: ${pres.agent_name || 'N/A'}`);
    
    console.log(`\n📸 Screenshot Data:`);
    console.log(`   Total Screenshots: ${pres.screenshot_count || 0}`);
    console.log(`   Has Screenshots: ${pres.screenshots && pres.screenshots.length > 0 ? 'YES' : 'NO'}`);
    if (pres.screenshots && pres.screenshots.length > 0) {
      console.log(`   Screenshot URLs: ${pres.screenshots.slice(0, 3).join(', ')}${pres.screenshots.length > 3 ? '...' : ''}`);
    }
    
    console.log(`\n🤖 AI Analysis:`);
    console.log(`   AI Summary: ${pres.ai_summary ? pres.ai_summary.substring(0, 100) + '...' : 'NONE'}`);
    console.log(`   Current Phase: ${pres.current_phase ? JSON.stringify(pres.current_phase) : 'NONE'}`);
    console.log(`   Presentation Quality: ${pres.presentation_quality || 'NOT ANALYZED'}`);
    
    console.log(`\n📊 Engagement Metrics:`);
    console.log(`   Tab Switches: ${pres.tab_switch_count || 0}`);
    console.log(`   Active Time: ${pres.active_time_seconds ? `${Math.floor(pres.active_time_seconds / 60)}m ${pres.active_time_seconds % 60}s` : 'N/A'}`);
    console.log(`   Idle Time: ${pres.idle_time_seconds ? `${Math.floor(pres.idle_time_seconds / 60)}m ${pres.idle_time_seconds % 60}s` : 'N/A'}`);
    
    console.log(`\n🎯 Status & Outcome:`);
    console.log(`   Session Status: ${pres.session_status || 'UNKNOWN'}`);
    console.log(`   Outcome: ${pres.outcome || 'NOT SET'}`);
    
    // VERDICT
    const hasEvidence = (
      pres.ended_at || 
      (pres.screenshot_count && pres.screenshot_count > 0) ||
      pres.ai_summary ||
      (pres.active_time_seconds && pres.active_time_seconds > 60)
    );
    
    console.log(`\n🔍 VERDICT: ${hasEvidence ? '✅ REAL PRESENTATION (has evidence)' : '❌ NO SHOW / NO DATA (missing evidence)'}`);
    
    if (!hasEvidence) {
      console.log(`\n⚠️  WARNING: This session has NO evidence of actual presentation:`);
      if (!pres.ended_at) console.log(`   - No end time recorded`);
      if (!pres.screenshot_count) console.log(`   - No screenshots captured`);
      if (!pres.ai_summary) console.log(`   - No AI analysis`);
      if (!pres.active_time_seconds) console.log(`   - No active time tracked`);
    }
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

checkPatriciaData().then(() => process.exit(0));

