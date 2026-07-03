import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateExistingSessionsMGA() {
  try {
    console.log('🚀 Updating existing verification sessions with MGA teams from producerlist...');

    // 1. Get all verification sessions that have associate_id but missing or incorrect agent_mga_team
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

    const producerMap = new Map(producers.map(p => [p.associate_id, p]));

    let updatedCount = 0;
    let noChangeCount = 0;
    let notFoundCount = 0;
    const updatedSessionsDetails = [];

    for (const session of sessions) {
      const producer = producerMap.get(session.associate_id);

      if (producer) {
        const currentMga = session.agent_mga_team;
        const newMga = producer.mga || 'Unassigned'; // Default to 'Unassigned' if MGA is null/empty
        const currentRga = session.agent_rga_team;
        const newRga = producer.rga || 'Unassigned'; // Default to 'Unassigned' if RGA is null/empty

        // Check if we need to update MGA or RGA
        const needsUpdate = currentMga !== newMga || currentRga !== newRga;

        if (needsUpdate) {
          const updateData = {
            agent_mga_team: newMga,
            agent_rga_team: newRga,
            // Also update agent names if they are different or null
            // Note: producerlist has agent_name as single field, so we'll keep existing first/last names
            // Add company_email for future searching
            company_email: producer.company_email || null
          };

          const { error: updateError } = await supabase
            .from('verification_sessions')
            .update(updateData)
            .eq('id', session.id);

          if (updateError) {
            console.error(`❌ Error updating session ${session.id}:`, updateError);
          } else {
            updatedCount++;
            updatedSessionsDetails.push({
              id: session.id,
              session_id: session.session_id,
              associate_id: session.associate_id,
              agent_name: `${session.agent_first_name} ${session.agent_last_name}`,
              old_mga: currentMga,
              new_mga: newMga,
              old_rga: currentRga,
              new_rga: newRga,
              company_email: producer.company_email
            });
          }
        } else {
          noChangeCount++;
        }
      } else {
        notFoundCount++;
        console.warn(`⚠️ Associate ID ${session.associate_id} not found in producerlist for session ${session.session_id}`);
      }
    }

    console.log('\n🎉 Update Summary:');
    console.log(`   ✅ Updated: ${updatedCount} sessions`);
    console.log(`   ➡️ No change needed: ${noChangeCount} sessions`);
    console.log(`   ⚠️ Not found in producerlist: ${notFoundCount} sessions`);

    if (updatedSessionsDetails.length > 0) {
      console.log('\n📋 Detailed Updates:');
      updatedSessionsDetails.forEach(detail => {
        console.log(`   - Session ${detail.session_id} (Associate ${detail.associate_id}, ${detail.agent_name}):`);
        console.log(`     MGA: ${detail.old_mga} -> ${detail.new_mga}`);
        console.log(`     RGA: ${detail.old_rga} -> ${detail.new_rga}`);
        console.log(`     Company Email: ${detail.company_email || 'N/A'}`);
      });
    }

    console.log('\n✅ Existing verification sessions update process complete!');

  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

updateExistingSessionsMGA();
