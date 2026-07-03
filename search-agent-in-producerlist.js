import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchAgentInProducerlist() {
  try {
    console.log('🔍 Searching for agent "HENDERSON TORREALBA" in producerlist...');

    // Search for exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('producerlist')
      .select('associate_id, agent_name, mga, rga, company_email')
      .eq('agent_name', 'HENDERSON TORREALBA');

    if (exactError) {
      console.error('❌ Error searching for exact match:', exactError);
    } else if (exactMatch && exactMatch.length > 0) {
      console.log('✅ EXACT MATCH FOUND:');
      exactMatch.forEach(agent => {
        console.log(`   - Associate ID: ${agent.associate_id}`);
        console.log(`   - Agent Name: ${agent.agent_name}`);
        console.log(`   - MGA: ${agent.mga}`);
        console.log(`   - RGA: ${agent.rga}`);
        console.log(`   - Company Email: ${agent.company_email}`);
      });
    } else {
      console.log('❌ No exact match found');
    }

    // Search for partial matches
    console.log('\n🔍 Searching for partial matches...');
    const { data: partialMatches, error: partialError } = await supabase
      .from('producerlist')
      .select('associate_id, agent_name, mga, rga, company_email')
      .or('agent_name.ilike.%HENDERSON%,agent_name.ilike.%TORREALBA%');

    if (partialError) {
      console.error('❌ Error searching for partial matches:', partialError);
    } else if (partialMatches && partialMatches.length > 0) {
      console.log('✅ PARTIAL MATCHES FOUND:');
      partialMatches.forEach(agent => {
        console.log(`   - Associate ID: ${agent.associate_id}`);
        console.log(`   - Agent Name: ${agent.agent_name}`);
        console.log(`   - MGA: ${agent.mga}`);
        console.log(`   - RGA: ${agent.rga}`);
        console.log(`   - Company Email: ${agent.company_email}`);
      });
    } else {
      console.log('❌ No partial matches found');
    }

    // Search for similar names
    console.log('\n🔍 Searching for similar names...');
    const { data: similarMatches, error: similarError } = await supabase
      .from('producerlist')
      .select('associate_id, agent_name, mga, rga, company_email')
      .ilike('agent_name', '%HENDERSON%')
      .limit(10);

    if (similarError) {
      console.error('❌ Error searching for similar names:', similarError);
    } else if (similarMatches && similarMatches.length > 0) {
      console.log('✅ SIMILAR NAMES FOUND:');
      similarMatches.forEach(agent => {
        console.log(`   - Associate ID: ${agent.associate_id}`);
        console.log(`   - Agent Name: ${agent.agent_name}`);
        console.log(`   - MGA: ${agent.mga}`);
        console.log(`   - RGA: ${agent.rga}`);
        console.log(`   - Company Email: ${agent.company_email}`);
      });
    } else {
      console.log('❌ No similar names found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

searchAgentInProducerlist();

