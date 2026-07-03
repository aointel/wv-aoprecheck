import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixJoeTomanovich() {
  try {
    console.log('Fixing Joe Tomanovich session to use JOSEPH TOMANOVICH data...');
    
    // Get JOSEPH TOMANOVICH from producerlist
    const { data: josephProducer, error: josephError } = await supabase
      .from('producerlist')
      .select('*')
      .ilike('agent_name', '%JOSEPH%TOMANOVICH%')
      .single();
    
    if (josephError || !josephProducer) {
      console.error('JOSEPH TOMANOVICH not found:', josephError);
      return;
    }
    
    console.log(`Found JOSEPH TOMANOVICH: ${josephProducer.agent_name} (MGA: ${josephProducer.mga}, ID: ${josephProducer.associate_id})`);
    
    // Find the Joe Tomanovich session
    const { data: joeSession, error: joeError } = await supabase
      .from('verification_sessions')
      .select('*')
      .eq('agent_first_name', 'Joe')
      .eq('agent_last_name', 'Tomanovich')
      .single();
    
    if (joeError || !joeSession) {
      console.error('Joe Tomanovich session not found:', joeError);
      return;
    }
    
    console.log(`Found Joe Tomanovich session: ${joeSession.id}`);
    
    // Update the session with JOSEPH TOMANOVICH data
    const updateData = {
      agent_mga_team: josephProducer.mga,
      agent_rga_team: josephProducer.rga,
      associate_id: josephProducer.associate_id,
      company_email: josephProducer.company_email
    };
    
    const { error: updateError } = await supabase
      .from('verification_sessions')
      .update(updateData)
      .eq('id', joeSession.id);
    
    if (updateError) {
      console.error('Error updating Joe Tomanovich session:', updateError);
    } else {
      console.log(`✅ Updated Joe Tomanovich session ${joeSession.id} with JOSEPH TOMANOVICH data:`);
      console.log(`   - MGA: ${josephProducer.mga}`);
      console.log(`   - RGA: ${josephProducer.rga}`);
      console.log(`   - Associate ID: ${josephProducer.associate_id}`);
      console.log(`   - Company Email: ${josephProducer.company_email}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixJoeTomanovich();

