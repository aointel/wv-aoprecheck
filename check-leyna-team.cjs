const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkLeyna() {
  console.log('\n🔍 Checking Leyna Team Info...\n');
  
  // Get Leyna's data
  const { data: leyna } = await supabase
    .from('customers')
    .select('associate_id, first_name, last_name')
    .eq('company_email', 'leynatran@aoglobelife.com')
    .single();
  
  console.log('Leyna data:', leyna);
  
  if (!leyna) {
    console.log('❌ Leyna not found in customers');
    process.exit(1);
  }
  
  // Check if Leyna is an MGA
  const { data: asMGA } = await supabase
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_name')
    .eq('mga_associate_id', leyna.associate_id);
  
  console.log('\n📊 Agents reporting to Leyna as MGA:', asMGA);
  
  // Check if Leyna is an RGA
  const { data: asRGA } = await supabase
    .from('agent_hierarchy')
    .select('agent_associate_id, agent_name')
    .eq('rga_associate_id', leyna.associate_id);
  
  console.log('\n📊 Agents reporting to Leyna as RGA:', asRGA);
  
  // Get Tabitha's data for comparison
  const { data: tabitha } = await supabase
    .from('customers')
    .select('associate_id, first_name, last_name')
    .eq('company_email', 'tabithamcdermid@aoglobelife.com')
    .single();
  
  console.log('\n👤 Tabitha data:', tabitha);
  
  if (tabitha) {
    // Check Tabitha's team
    const { data: tabithaTeam } = await supabase
      .from('agent_hierarchy')
      .select('*')
      .eq('agent_associate_id', tabitha.associate_id)
      .single();
    
    console.log('\n📋 Tabitha\'s team (hierarchy):', tabithaTeam);
    
    // Check if Tabitha reports to Leyna
    const reportsToLeyna = 
      tabithaTeam?.mga_associate_id === leyna.associate_id ||
      tabithaTeam?.rga_associate_id === leyna.associate_id;
    
    console.log('\n❓ Does Tabitha report to Leyna?', reportsToLeyna);
  }
}

checkLeyna().then(() => {
  console.log('\n✅ Check complete\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

