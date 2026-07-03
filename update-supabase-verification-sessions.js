import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Database configuration for producerlist lookup
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function updateSupabaseVerificationSessions() {
  try {
    console.log('🚀 Updating Supabase verification sessions with current MGA assignments...');

    // 1. Get all verification sessions from Supabase that have associate_id
    const sessionsResult = await supabase
      .from('verification_sessions')
      .select('id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team')
      .not('associate_id', 'is', null)
      .order('id', { ascending: false })
      .limit(50);

    if (sessionsResult.error) {
      console.error('❌ Error fetching sessions from Supabase:', sessionsResult.error);
      return;
    }

    console.log(`📊 Found ${sessionsResult.data.length} verification sessions with associate_id`);

    if (sessionsResult.data.length === 0) {
      console.log('✅ No sessions to update');
      return;
    }

    // 2. Get unique associate_ids
    const associateIds = [...new Set(sessionsResult.data.map(row => row.associate_id))];
    console.log(`🔍 Looking up ${associateIds.length} unique associate IDs`);

    // 3. Look up current MGA teams from producerlist
    const producerResult = await pool.query(`
      SELECT associate_id, mga, rga, agent_name
      FROM producers 
      WHERE associate_id = ANY($1)
    `, [associateIds]);

    console.log(`📋 Found ${producerResult.rows.length} agents in producerlist table`);

    // 4. Create lookup map
    const mgaLookup = new Map();
    producerResult.rows.forEach(agent => {
      const mga = agent.mga || agent.rga || 'Unassigned';
      mgaLookup.set(agent.associate_id.toString(), {
        mga,
        agentName: agent.agent_name
      });
    });

    console.log(`🗺️ Created lookup map for ${mgaLookup.size} agents`);

    // 5. Show what we found vs what's in sessions
    console.log(`\n📊 Current MGA assignments from producerlist:`);
    mgaLookup.forEach((data, id) => {
      console.log(`   ${id}: ${data.agentName} -> ${data.mga}`);
    });

    // 6. Update verification sessions with current MGA teams
    let updatedCount = 0;
    let notFoundCount = 0;
    let noChangeCount = 0;
    
    for (const session of sessionsResult.data) {
      const agentData = mgaLookup.get(session.associate_id.toString());
      if (agentData) {
        // Check if the MGA team has changed
        if (session.agent_mga_team !== agentData.mga) {
          // Update with current MGA assignment
          const updateResult = await supabase
            .from('verification_sessions')
            .update({
              agent_mga_team: agentData.mga,
              agent_rga_team: agentData.mga
            })
            .eq('id', session.id);

          if (updateResult.error) {
            console.error(`❌ Error updating session ${session.id}:`, updateResult.error);
          } else {
            updatedCount++;
            console.log(`✅ Updated session ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> ${agentData.mga} (was: ${session.agent_mga_team})`);
          }
        } else {
          noChangeCount++;
          console.log(`➡️ No change needed for session ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> ${agentData.mga}`);
        }
      } else {
        notFoundCount++;
        console.log(`⚠️ No MGA data found for associate_id ${session.associate_id} (${session.agent_first_name} ${session.agent_last_name})`);
      }
    }

    console.log(`\n🎉 Update Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} sessions`);
    console.log(`   ➡️ No change needed: ${noChangeCount} sessions`);
    console.log(`   ⚠️ Not found in producerlist: ${notFoundCount} sessions`);

    // 7. Show sample of updated data
    const sampleResult = await supabase
      .from('verification_sessions')
      .select('id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team')
      .not('associate_id', 'is', null)
      .order('id', { ascending: false })
      .limit(5);

    if (sampleResult.data) {
      console.log(`\n📊 Sample updated sessions:`);
      sampleResult.data.forEach(session => {
        console.log(`   ID ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> MGA: ${session.agent_mga_team}`);
      });
    }

  } catch (error) {
    console.error('❌ Error updating Supabase verification sessions:', error);
  } finally {
    await pool.end();
  }
}

// Run the update
updateSupabaseVerificationSessions();

