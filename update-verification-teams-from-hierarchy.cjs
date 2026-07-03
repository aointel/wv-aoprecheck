/**
 * Update all verification sessions with MGA/RGA team data from agent_hierarchy table
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase
const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function updateTeamsFromHierarchy() {
  console.log('\n🚀 UPDATING VERIFICATION SESSIONS WITH TEAM DATA FROM AGENT_HIERARCHY');
  console.log('═'.repeat(70));
  
  try {
    // 1. Fetch all verification sessions that have associate_id or company_email
    console.log('\n📥 Fetching verification sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('verification_sessions')
      .select('id, associate_id, company_email, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team')
      .or('associate_id.not.is.null,company_email.not.is.null')
      .order('id', { ascending: false });
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('⚠️  No sessions found');
      return;
    }
    
    console.log(`✅ Found ${sessions.length} sessions to check`);
    
    // 2. Fetch all agent hierarchy data
    console.log('\n📥 Fetching agent hierarchy data...');
    const { data: hierarchy, error: hierarchyError } = await supabase
      .from('agent_hierarchy')
      .select('agent_associate_id, agent_email, agent_name, mga_name, rga_name');
    
    if (hierarchyError) {
      console.error('❌ Error fetching hierarchy:', hierarchyError);
      return;
    }
    
    console.log(`✅ Found ${hierarchy?.length || 0} agents in hierarchy`);
    
    // 3. Create lookup maps
    const hierarchyByAssociateId = new Map();
    const hierarchyByEmail = new Map();
    
    (hierarchy || []).forEach(agent => {
      if (agent.agent_associate_id) {
        hierarchyByAssociateId.set(agent.agent_associate_id, agent);
      }
      if (agent.agent_email) {
        hierarchyByEmail.set(agent.agent_email.toLowerCase().trim(), agent);
      }
    });
    
    console.log(`\n🗺️  Created lookup maps:`);
    console.log(`   By Associate ID: ${hierarchyByAssociateId.size} agents`);
    console.log(`   By Email: ${hierarchyByEmail.size} agents`);
    
    // 4. Update sessions
    console.log('\n🔄 Updating sessions...');
    console.log('═'.repeat(70));
    
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const sessionNum = i + 1;
      
      if (sessionNum % 50 === 0) {
        console.log(`\n📊 Progress: ${sessionNum}/${sessions.length} sessions processed`);
      }
      
      // Find agent in hierarchy
      let agentData = null;
      let lookupMethod = null;
      
      if (session.associate_id) {
        agentData = hierarchyByAssociateId.get(session.associate_id);
        lookupMethod = 'associate_id';
      }
      
      if (!agentData && session.company_email) {
        agentData = hierarchyByEmail.get(session.company_email.toLowerCase().trim());
        lookupMethod = 'email';
      }
      
      if (!agentData) {
        notFoundCount++;
        if (sessionNum <= 10) {
          console.log(`⚠️  Session ${session.id}: Agent not found in hierarchy (Associate ID: ${session.associate_id}, Email: ${session.company_email})`);
        }
        continue;
      }
      
      // Check if update is needed
      const newMgaTeam = agentData.mga_name || null;
      const newRgaTeam = agentData.rga_name || null;
      
      const needsUpdate = 
        session.agent_mga_team !== newMgaTeam || 
        session.agent_rga_team !== newRgaTeam;
      
      if (!needsUpdate) {
        alreadyCorrectCount++;
        continue;
      }
      
      // Update session
      const { error: updateError } = await supabase
        .from('verification_sessions')
        .update({
          agent_mga_team: newMgaTeam,
          agent_rga_team: newRgaTeam
        })
        .eq('id', session.id);
      
      if (updateError) {
        errorCount++;
        console.error(`❌ Error updating session ${session.id}:`, updateError);
      } else {
        updatedCount++;
        if (updatedCount <= 20) {
          console.log(`✅ Session ${session.id}: ${agentData.agent_name} (via ${lookupMethod})`);
          console.log(`   MGA: ${session.agent_mga_team || 'null'} → ${newMgaTeam || 'null'}`);
          console.log(`   RGA: ${session.agent_rga_team || 'null'} → ${newRgaTeam || 'null'}`);
        }
      }
    }
    
    // 5. Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 TEAM UPDATE COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n✅ Updated: ${updatedCount} sessions`);
    console.log(`⏭️  Already Correct: ${alreadyCorrectCount} sessions`);
    console.log(`⚠️  Not Found in Hierarchy: ${notFoundCount} sessions`);
    console.log(`❌ Errors: ${errorCount} sessions`);
    console.log(`\n🎯 Total Processed: ${sessions.length} sessions`);
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run
updateTeamsFromHierarchy().then(() => {
  console.log('✅ Team update complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

