const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0',
  { global: { fetch } }
);

(async () => {
  console.log('🔍 Checking webhook data for lead 17566324...\n');
  
  // Get the lead from masterlead
  const { data: leads } = await supabase
    .from('masterlead')
    .select('taalk_lead_id, email, first_name, last_name, last_contacted')
    .eq('taalk_lead_id', '17566324')
    .order('last_contacted', { ascending: false })
    .limit(5);
  
  if (!leads || leads.length === 0) {
    console.log('❌ No leads found with taalk_lead_id 17566324');
    return;
  }
  
  console.log(`📋 Found ${leads.length} record(s) for lead 17566324:`);
  leads.forEach((lead, i) => {
    console.log(`\n[${i+1}] Agent Email: ${lead.email}`);
    console.log(`    Lead Name: ${lead.first_name} ${lead.last_name}`);
    console.log(`    Last Contacted: ${lead.last_contacted}`);
  });
  
  // For each agent, get their associate_id
  console.log('\n\n🔎 Looking up associate_ids...\n');
  
  const uniqueEmails = [...new Set(leads.map(l => l.email))];
  
  for (const email of uniqueEmails) {
    console.log(`\n👤 Agent: ${email}`);
    
    // Check producers table
    const { data: producer } = await supabase
      .from('producers')
      .select('email, agent_name, associate_id')
      .eq('email', email)
      .single();
    
    if (producer) {
      console.log(`   ✅ [producers] Name: ${producer.agent_name}`);
      console.log(`   ✅ [producers] Associate ID: ${producer.associate_id || 'NULL'}`);
    } else {
      console.log(`   ❌ Not found in producers table`);
    }
    
    // Check producerlist table
    const { data: producerlist } = await supabase
      .from('producerlist')
      .select('company_email, agent_name, associate_id')
      .eq('company_email', email)
      .single();
    
    if (producerlist) {
      console.log(`   ✅ [producerlist] Name: ${producerlist.agent_name}`);
      console.log(`   ✅ [producerlist] Associate ID: ${producerlist.associate_id || 'NULL'}`);
      console.log(`\n   📤 CORRECT WEBHOOK PAYLOAD:`);
      console.log(`   {`);
      console.log(`     "lead_id": "17566324",`);
      console.log(`     "associate_id": "${producerlist.associate_id || '999'}"`);
      console.log(`   }`);
    } else {
      console.log(`   ❌ Not found in producerlist table`);
    }
  }
})();

