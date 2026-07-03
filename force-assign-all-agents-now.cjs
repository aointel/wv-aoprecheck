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

async function forceAssignAllAgents() {
  console.log('🔄 FORCE ASSIGNING ALL AGENTS TO 50 LEADS\n');
  console.log('='.repeat(80));
  
  try {
    // Get all active agents
    const { data: agents, error: agentsError } = await supabase
      .from('customers')
      .select('company_email, personal_email')
      .or('company_email.not.is.null,personal_email.not.is.null')
      .eq('role', 'agent')
      .eq('status', 'active');

    if (agentsError) throw agentsError;

    console.log(`\n👥 Found ${agents.length} active agents\n`);

    let totalAssigned = 0;

    for (const agent of agents) {
      const agentEmail = agent.company_email || agent.personal_email;
      if (!agentEmail) continue;

      // Count current pending leads
      const { count: currentCount } = await supabase
        .from('masterlead')
        .select('*', { count: 'exact', head: true })
        .eq('cn_email', agentEmail)
        .or('cnresolution.is.null,cnresolution.eq.pending')
        .eq('dnc', false);

      const current = currentCount || 0;
      const needed = 50 - current;

      if (needed <= 0) {
        console.log(`✅ ${agentEmail}: Already has ${current} leads`);
        continue;
      }

      console.log(`📤 ${agentEmail}: Has ${current}, need ${needed} more...`);

      // Get unassigned leads - ANY unassigned lead that's not DNC, not booked, not closed
      const { data: availableLeads } = await supabase
        .from('masterlead')
        .select('id, cnresolution')
        .is('cn_email', null)
        .eq('dnc', false)
        .not('cnresolution', 'in', '(booked,closed,sale)')
        .limit(needed);

      if (!availableLeads || availableLeads.length === 0) {
        console.log(`   ⚠️ No unassigned leads available`);
        continue;
      }

      // Assign them
      const { error: assignError } = await supabase
        .from('masterlead')
        .update({
          cn_email: agentEmail,
          assigned_date: new Date().toISOString(),
          cnresolution: 'pending'
        })
        .in('id', availableLeads.map(l => l.id));

      if (assignError) {
        console.error(`   ❌ Error assigning to ${agentEmail}:`, assignError);
        continue;
      }

      totalAssigned += availableLeads.length;
      console.log(`   ✅ Assigned ${availableLeads.length} leads`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 SUMMARY: Assigned ${totalAssigned} total leads`);
    console.log('✅ Done!\n');

  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

forceAssignAllAgents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

