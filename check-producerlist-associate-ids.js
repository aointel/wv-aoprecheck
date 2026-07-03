import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducerlistAssociateIds() {
  try {
    console.log('🔍 Checking associate_id ranges in producerlist...');

    // Get associate_id range
    const { data: range, error: rangeError } = await supabase
      .from('producerlist')
      .select('associate_id')
      .order('associate_id', { ascending: true });

    if (rangeError) {
      console.error('❌ Error fetching associate_id range:', rangeError);
      return;
    }

    const associateIds = range.map(r => r.associate_id);
    console.log(`📊 Total associate_ids in producerlist: ${associateIds.length}`);
    console.log(`📈 Min associate_id: ${Math.min(...associateIds)}`);
    console.log(`📈 Max associate_id: ${Math.max(...associateIds)}`);
    
    // Show first 10 and last 10
    console.log('\n📋 First 10 associate_ids:');
    associateIds.slice(0, 10).forEach(id => console.log(`   - ${id}`));
    
    console.log('\n📋 Last 10 associate_ids:');
    associateIds.slice(-10).forEach(id => console.log(`   - ${id}`));

    // Now check what associate_ids are in verification_sessions
    console.log('\n🔍 Checking associate_ids in verification_sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('verification_sessions')
      .select('associate_id')
      .not('associate_id', 'is', null);

    if (sessionsError) {
      console.error('❌ Error fetching verification sessions:', sessionsError);
      return;
    }

    const sessionAssociateIds = [...new Set(sessions.map(s => s.associate_id))];
    console.log(`📊 Unique associate_ids in verification_sessions: ${sessionAssociateIds.length}`);
    console.log(`📈 Min associate_id: ${Math.min(...sessionAssociateIds)}`);
    console.log(`📈 Max associate_id: ${Math.max(...sessionAssociateIds)}`);
    
    console.log('\n📋 All associate_ids in verification_sessions:');
    sessionAssociateIds.sort((a, b) => a - b).forEach(id => console.log(`   - ${id}`));

    // Check for overlap
    const overlap = sessionAssociateIds.filter(id => associateIds.includes(id));
    console.log(`\n✅ Overlap between tables: ${overlap.length} associate_ids`);
    if (overlap.length > 0) {
      console.log('📋 Overlapping associate_ids:');
      overlap.forEach(id => console.log(`   - ${id}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkProducerlistAssociateIds();

