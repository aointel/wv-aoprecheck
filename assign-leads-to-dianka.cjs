const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function assignLeadsToDianka() {
  const agentEmail = 'diankablash@aoglobelife.com';
  
  console.log(`🔄 Assigning leads to ${agentEmail}...\n`);
  
  try {
    // Check current pending leads
    const { count: currentCount } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .eq('cn_email', agentEmail)
      .in('cnresolution', ['pending', null])
      .eq('dnc', false);

    console.log(`📊 Current pending leads: ${currentCount}`);
    
    const leadsNeeded = 50 - (currentCount || 0);
    
    if (leadsNeeded <= 0) {
      console.log('✅ Agent already has 50 leads');
      return;
    }
    
    console.log(`📤 Need to assign ${leadsNeeded} more leads\n`);
    
    // Get unassigned leads
    const { data: availableLeads } = await supabase
      .from('masterlead')
      .select('id')
      .is('cn_email', null)
      .in('cnresolution', ['pending', null])
      .eq('dnc', false)
      .limit(leadsNeeded);
    
    if (!availableLeads || availableLeads.length === 0) {
      console.log('❌ No unassigned leads available');
      return;
    }
    
    console.log(`📋 Found ${availableLeads.length} unassigned leads to assign`);
    
    // Assign them
    const { error: assignError } = await supabase
      .from('masterlead')
      .update({
        cn_email: agentEmail,
        assigned_date: new Date().toISOString(),
        cnresolution: 'pending'
      })
      .in('id', availableLeads.map(l => l.id));
    
    if (assignError) throw assignError;
    
    console.log(`✅ Successfully assigned ${availableLeads.length} leads to ${agentEmail}\n`);
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

assignLeadsToDianka()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

