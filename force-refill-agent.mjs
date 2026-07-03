// Force refill leads for a specific agent
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ycztjetxwpfgtrzeytt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const userEmail = 'alisaharrell@aoglobelife.com';

async function forceRefill() {
  try {
    console.log(`🔄 Force refilling leads for ${userEmail}...\n`);

    // Check current pending leads
    const { count: pendingCount } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .eq('cn_email', userEmail)
      .eq('cnresolution', 'pending');

    console.log(`📊 Current pending leads: ${pendingCount || 0}`);

    // Get agent's states and market from customers table
    const { data: agentDataRows } = await supabase
      .from('customers')
      .select('states, market')
      .or(`company_email.eq.${userEmail},personal_email.eq.${userEmail}`)
      .limit(1);

    const agentData = agentDataRows?.[0] || null;

    // Parse states and markets (use defaults if not in customers table)
    let agentStates = [];
    let agentMarkets = ['Veteran']; // Default market

    if (agentData) {
      if (agentData?.states) {
        if (typeof agentData.states === 'string') {
          try {
            agentStates = JSON.parse(agentData.states);
          } catch (e) {
            agentStates = [];
          }
        } else if (Array.isArray(agentData.states)) {
          agentStates = agentData.states;
        }
      }

      if (agentData?.market) {
        if (typeof agentData.market === 'string') {
          try {
            agentMarkets = JSON.parse(agentData.market);
          } catch (e) {
            agentMarkets = [agentData.market];
          }
        } else if (Array.isArray(agentData.market)) {
          agentMarkets = agentData.market;
        } else {
          agentMarkets = [agentData.market];
        }
      }
    } else {
      console.warn(`⚠️ Agent ${userEmail} not found in customers table - using defaults (Veteran market, no state filter)`);
    }

    console.log(`📋 Agent states: ${agentStates.join(', ') || 'None (will assign any state)'}`);
    console.log(`📋 Agent markets: ${agentMarkets.join(', ') || 'Veteran (default)'}`);

    const currentPending = pendingCount || 0;
    const leadsNeeded = 50 - currentPending;

    if (leadsNeeded <= 0) {
      console.log(`✅ Agent already has ${currentPending} pending leads (target: 50)`);
      process.exit(0);
    }

    console.log(`📤 Need to assign ${leadsNeeded} more leads\n`);

    // Get state rarity counts
    const { data: allAgents } = await supabase
      .from('customers')
      .select('states')
      .not('states', 'is', null);

    const agentsPerState = {};
    allAgents?.forEach(agent => {
      let states = [];
      if (typeof agent.states === 'string') {
        try {
          states = JSON.parse(agent.states);
        } catch (e) {
          states = [];
        }
      } else if (Array.isArray(agent.states)) {
        states = agent.states;
      }
      states.forEach(state => {
        agentsPerState[state] = (agentsPerState[state] || 0) + 1;
      });
    });

    // Build query for unassigned leads
    let refillQuery = supabase
      .from('masterlead')
      .select('id, state, taalk_state, taalk_market')
      .is('cn_email', null)
      .eq('dnc', false)
      .neq('state', 'DC')
      .neq('taalk_state', 'DC')
      .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called');

    // Filter by market if we have markets and agent is in customers table
    if (agentData && agentMarkets && agentMarkets.length > 0) {
      const marketFilter = agentMarkets.map(m => `taalk_market.eq.${m}`).join(',');
      refillQuery = refillQuery.or(marketFilter);
    }
    // If agent not in customers table, don't filter by market (assign any available leads)

    const { data: matchingLeads } = await refillQuery.limit(25000);

    console.log(`📋 Found ${matchingLeads?.length || 0} unassigned leads before state filtering`);
    
    if (!matchingLeads || matchingLeads.length === 0) {
      console.error(`❌ No unassigned leads found in database`);
      process.exit(1);
    }

    // Filter by states in memory
    let filteredLeads = matchingLeads || [];
    if (agentStates.length > 0 && filteredLeads.length > 0) {
      filteredLeads = filteredLeads.filter(lead => {
        const leadState = lead.state || lead.taalk_state || '';
        return agentStates.includes(leadState);
      });
      console.log(`📋 After state filtering: ${filteredLeads.length} leads remaining`);
    } else if (agentStates.length === 0) {
      console.warn(`⚠️ Agent has NO states configured!`);
    }

    // Sort by state rarity
    const sortedLeads = [...filteredLeads].sort((a, b) => {
      const stateA = a.state || a.taalk_state || '';
      const stateB = b.state || b.taalk_state || '';
      const agentCountA = agentsPerState[stateA] || 999;
      const agentCountB = agentsPerState[stateB] || 999;
      return agentCountA - agentCountB;
    }).slice(0, leadsNeeded);

    if (!sortedLeads || sortedLeads.length === 0) {
      console.error(`❌ No leads available to assign`);
      process.exit(1);
    }

    console.log(`📋 Assigning ${sortedLeads.length} leads...`);

    const { data: updated, error: updateError } = await supabase
      .from('masterlead')
      .update({
        cn_email: userEmail,
        assigned_date: new Date().toISOString(),
        cnresolution: 'pending'
      })
      .in('id', sortedLeads.map(l => l.id))
      .select();

    if (updateError) {
      console.error(`❌ Error assigning leads:`, updateError);
      process.exit(1);
    }

    console.log(`\n✅ Successfully assigned ${updated?.length || 0} leads to ${userEmail}`);
    console.log(`   Lead IDs: ${updated?.map(l => l.id).slice(0, 10).join(', ')}${updated.length > 10 ? '...' : ''}`);
    process.exit(0);

  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

forceRefill();

