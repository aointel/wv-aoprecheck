const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Polyfill fetch for older Node versions
if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

async function resetPendingLeadsTo50() {
  console.log('🔄 RESETTING ALL AGENTS TO MAX 50 PENDING LEADS\n');
  console.log('='.repeat(80));

  try {
    // 1. Get all agents with assigned leads
    const { data: agents, error: agentsError } = await supabase
      .from('masterlead')
      .select('cn_email')
      .not('cn_email', 'is', null)
      .in('cnresolution', ['pending', null]);

    if (agentsError) throw agentsError;

    // Get unique agent emails
    const uniqueAgents = [...new Set(agents.map(a => a.cn_email))];
    console.log(`\n👥 Found ${uniqueAgents.length} agents with pending leads\n`);

    let totalUnassigned = 0;
    let agentsProcessed = 0;

    for (const agentEmail of uniqueAgents) {
      // Count their current pending leads
      const { count: pendingCount } = await supabase
        .from('masterlead')
        .select('*', { count: 'exact', head: true })
        .eq('cn_email', agentEmail)
        .in('cnresolution', ['pending', null])
        .eq('dnc', false);

      const currentPending = pendingCount || 0;

      if (currentPending > 50) {
        const toUnassign = currentPending - 50;
        console.log(`📋 ${agentEmail}: ${currentPending} pending → Unassigning ${toUnassign} leads`);

        // Get the excess leads (oldest first)
        const { data: excessLeads } = await supabase
          .from('masterlead')
          .select('id')
          .eq('cn_email', agentEmail)
          .in('cnresolution', ['pending', null])
          .eq('dnc', false)
          .order('assigned_date', { ascending: true, nullsFirst: true })
          .limit(toUnassign);

        if (excessLeads && excessLeads.length > 0) {
          // Unassign them
          const { error: unassignError } = await supabase
            .from('masterlead')
            .update({
              previous_cn_email: agentEmail,
              last_assigned_date: new Date().toISOString(),
              cn_email: null,
              assigned_date: null
            })
            .in('id', excessLeads.map(l => l.id));

          if (unassignError) throw unassignError;

          totalUnassigned += excessLeads.length;
          agentsProcessed++;
          console.log(`   ✅ Unassigned ${excessLeads.length} leads`);
        }
      } else {
        console.log(`✅ ${agentEmail}: ${currentPending} pending (OK)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log(`   Agents processed: ${agentsProcessed}`);
    console.log(`   Total leads unassigned: ${totalUnassigned}`);
    console.log('✅ Done!\n');

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

resetPendingLeadsTo50()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

