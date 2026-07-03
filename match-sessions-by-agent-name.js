import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function matchSessionsByAgentName() {
  try {
    console.log('🔍 Attempting to match verification sessions by agent name...');

    // 1. Get verification sessions with agent names
    const { data: sessions, error: sessionsError } = await supabase
      .from('verification_sessions')
      .select('id, session_id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team')
      .not('associate_id', 'is', null);

    if (sessionsError) {
      console.error('❌ Error fetching verification sessions:', sessionsError);
      return;
    }
    console.log(`✅ Found ${sessions.length} verification sessions with associate_id`);

    // 2. Get all producers from producerlist
    const { data: producers, error: producersError } = await supabase
      .from('producerlist')
      .select('associate_id, mga, rga, agent_name, company_email');

    if (producersError) {
      console.error('❌ Error fetching producerlist:', producersError);
      return;
    }
    console.log(`✅ Found ${producers.length} producers in producerlist`);

    let matchedCount = 0;
    let unmatchedCount = 0;
    const matchedSessions = [];
    const unmatchedSessions = [];

    for (const session of sessions) {
      const sessionFullName = `${session.agent_first_name} ${session.agent_last_name}`.toLowerCase().trim();
      
      // Try to find a match by agent name
      const matchingProducer = producers.find(producer => {
        const producerName = producer.agent_name.toLowerCase().trim();
        return producerName === sessionFullName;
      });

      if (matchingProducer) {
        matchedCount++;
        matchedSessions.push({
          session_id: session.session_id,
          associate_id: session.associate_id,
          session_name: sessionFullName,
          producer_name: matchingProducer.agent_name,
          producer_associate_id: matchingProducer.associate_id,
          mga: matchingProducer.mga,
          rga: matchingProducer.rga,
          company_email: matchingProducer.company_email
        });
      } else {
        unmatchedCount++;
        unmatchedSessions.push({
          session_id: session.session_id,
          associate_id: session.associate_id,
          agent_name: sessionFullName
        });
      }
    }

    console.log('\n🎉 Matching Results:');
    console.log(`   ✅ Matched by name: ${matchedCount} sessions`);
    console.log(`   ❌ Unmatched: ${unmatchedCount} sessions`);

    if (matchedSessions.length > 0) {
      console.log('\n📋 Matched Sessions:');
      matchedSessions.forEach(session => {
        console.log(`   - ${session.session_id}: ${session.session_name} -> MGA: ${session.mga}, RGA: ${session.rga}`);
      });
    }

    if (unmatchedSessions.length > 0) {
      console.log('\n⚠️ Unmatched Sessions:');
      unmatchedSessions.forEach(session => {
        console.log(`   - ${session.session_id}: ${session.agent_name} (associate_id: ${session.associate_id})`);
      });
    }

    // Now update the matched sessions
    if (matchedSessions.length > 0) {
      console.log('\n🔄 Updating matched sessions...');
      let updatedCount = 0;
      
      for (const session of matchedSessions) {
        const { error: updateError } = await supabase
          .from('verification_sessions')
          .update({
            agent_mga_team: session.mga,
            agent_rga_team: session.rga,
            company_email: session.company_email
          })
          .eq('session_id', session.session_id);

        if (updateError) {
          console.error(`❌ Error updating session ${session.session_id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
      
      console.log(`✅ Updated ${updatedCount} sessions with MGA/RGA data from producerlist`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

matchSessionsByAgentName();

