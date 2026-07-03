import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseProducerlist() {
  try {
    console.log('🔍 Checking Supabase producerlist table...');

    // Get total count
    const countResult = await supabase
      .from('producerlist')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total agents in Supabase producerlist: ${countResult.count}`);

    // Get sample of agents
    const sampleResult = await supabase
      .from('producerlist')
      .select('associate_id, agent_name, mga, rga, company_email')
      .order('associate_id')
      .limit(20);

    if (sampleResult.error) {
      console.error('❌ Error fetching sample data:', sampleResult.error);
      return;
    }

    console.log(`\n📋 Sample agents from Supabase producerlist:`);
    sampleResult.data.forEach(agent => {
      console.log(`   ${agent.associate_id}: ${agent.agent_name} -> MGA: ${agent.mga || 'NULL'}, RGA: ${agent.rga || 'NULL'}`);
    });

    // Check for specific associate_ids that we know exist in verification sessions
    const knownAssociateIds = [122582, 205517, 409, 65269, 204102, 21812, 111822, 112240, 93983, 56995, 172746, 1253];
    
    console.log(`\n🔍 Checking for known associate_ids from verification sessions:`);
    for (const id of knownAssociateIds) {
      const result = await supabase
        .from('producerlist')
        .select('associate_id, agent_name, mga, rga, company_email')
        .eq('associate_id', id)
        .single();

      if (result.data) {
        console.log(`   ✅ Found ${id}: ${result.data.agent_name} -> MGA: ${result.data.mga || 'NULL'}, RGA: ${result.data.rga || 'NULL'}`);
      } else {
        console.log(`   ❌ Not found: ${id}`);
      }
    }

    // Get unique MGA teams
    const mgaTeamsResult = await supabase
      .from('producerlist')
      .select('mga')
      .not('mga', 'is', null)
      .not('mga', 'eq', '');

    if (mgaTeamsResult.data) {
      const uniqueMgaTeams = [...new Set(mgaTeamsResult.data.map(agent => agent.mga))];
      console.log(`\n📋 Unique MGA teams in Supabase producerlist:`);
      uniqueMgaTeams.forEach(team => {
        console.log(`   - ${team}`);
      });
    }

    // Check if there are any agents with MGA assignments
    const mgaCountResult = await supabase
      .from('producerlist')
      .select('*', { count: 'exact', head: true })
      .not('mga', 'is', null)
      .not('mga', 'eq', '');

    console.log(`\n📊 Agents with MGA assignments: ${mgaCountResult.count}`);

    // Check if there are any agents with RGA assignments
    const rgaCountResult = await supabase
      .from('producerlist')
      .select('*', { count: 'exact', head: true })
      .not('rga', 'is', null)
      .not('rga', 'eq', '');

    console.log(`📊 Agents with RGA assignments: ${rgaCountResult.count}`);

  } catch (error) {
    console.error('❌ Error checking Supabase producerlist:', error);
  }
}

// Run the check
checkSupabaseProducerlist();

