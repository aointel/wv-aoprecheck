import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { usageTracker } from './usage-tracker';
import { countCallableLeads } from './timezone-helper';
import { getRankTierForEmail, getRankOrder, type ProductionRank } from './production-rank-service';

const LEAD_CAP = 300;

/**
 * Auto-assign unassigned hotleads to currently active agents
 * Runs every minute to ensure new hotleads are immediately distributed
 */
export async function autoAssignHotleadsToActiveAgents() {
  try {
    console.log('🔥 AUTO-ASSIGN: Checking for unassigned hotleads and active agents...');
    
    // Get all unassigned hotleads
    // CRITICAL: Exclude TaalkResolve=true leads (frozen leads)
    const { data: unassignedLeads, error: leadsError } = await masterleadClient.from('masterlead')
      .select('*')
      .eq('is_hot_lead', true)
      .is('cn_email', null)
      .or('TaalkResolve.is.null,TaalkResolve.eq.false')  // Exclude TaalkResolve=true leads (frozen)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (leadsError) {
      console.error('❌ Error fetching unassigned hotleads:', leadsError);
      return;
    }
    
    if (!unassignedLeads || unassignedLeads.length === 0) {
      console.log('✅ No unassigned hotleads - all good!');
      return;
    }
    
    console.log(`📊 Found ${unassignedLeads.length} unassigned hotleads`);
    
    // Get agents who completed calls >= 70 seconds TODAY
    // CRITICAL: Only assign leads to agents who completed 70+ second calls
    // This prevents assigning leads to agents who just churn through calls
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Get agents with calls >= 70 seconds from twilio_call_logs (more reliable)
    const { data: recentLongCalls, error: callsError } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email, call_duration, call_started_at')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', todayStart.toISOString())
      .gte('call_duration', 70)
      .in('call_status', ['answered', 'completed'])
      .not('owner_email', 'is', null)
      .neq('owner_email', '');
    
    if (callsError) {
      console.error('❌ Error fetching agents with long calls:', callsError);
      return;
    }
    
    if (!recentLongCalls || recentLongCalls.length === 0) {
      console.log('⚠️ No agents with 70+ second calls today');
      return;
    }
    
    // Get unique agent emails who have 70+ second calls
    const agentEmailsWithLongCalls = new Set<string>();
    for (const call of recentLongCalls) {
      const email = (call.owner_email || '').toLowerCase().trim();
      if (email && email.includes('@')) {
        agentEmailsWithLongCalls.add(email);
      }
    }
    
    if (agentEmailsWithLongCalls.size === 0) {
      console.log('⚠️ No valid agent emails found in long calls');
      return;
    }
    
    console.log(`👥 Found ${agentEmailsWithLongCalls.size} agents with 70+ second calls today (${recentLongCalls.length} total calls)`);
    
    // Convert to agent objects
    const activeAgents = Array.from(agentEmailsWithLongCalls).map(email => ({
      agent_email: email
    }));
    
    // Get agent market/state permissions from customers table
    // CRITICAL: If agent has 70+ second calls, assign leads even without customer record (use empty markets/states = all)
    const agentPermissions = new Map<string, { markets: string[], states: string[] }>();
    
    for (const agent of activeAgents) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('markets, states, company_email, eligible_for_hotleads')
        .eq('company_email', agent.agent_email)
        .maybeSingle();
      
      if (customerError || !customer) {
        // CRITICAL: Agent has 70+ second calls - assign leads anyway (no market/state restrictions)
        console.log(`⚠️ No customer record for ${agent.agent_email} - assigning leads anyway (has 70+ second calls)`);
        agentPermissions.set(agent.agent_email, { markets: [], states: [] }); // Empty = all markets/states
        continue;
      }
      
      if (customer.eligible_for_hotleads !== true) {
        // CRITICAL: Even if eligible_for_hotleads is false, if they have 70+ second calls, assign leads
        console.log(`⚠️ ${agent.agent_email}: eligible_for_hotleads false - assigning anyway (has 70+ second calls)`);
        const markets = customer.markets || [];
        const states = customer.states || [];
        agentPermissions.set(agent.agent_email, { markets, states });
        continue;
      }
      
      const markets = customer.markets || [];
      const states = customer.states || [];
      
      agentPermissions.set(agent.agent_email, { markets, states });
      console.log(`   ${agent.agent_email}: Markets=[${markets.join(', ') || 'ALL'}] States=[${states.join(', ') || 'ALL'}]`);
    }
    
    // All agents with 70+ second calls are eligible (even without customer records)
    const eligibleAgents = activeAgents.filter(agent => agentPermissions.has(agent.agent_email));
    
    if (eligibleAgents.length === 0) {
      console.log('⚠️ No eligible agents found');
      return;
    }
    
    console.log(`✅ ${eligibleAgents.length} eligible agents (with 70+ second calls)`);
    
    // Get each agent's current callable lead count (EXCLUDING leads outside timezone restriction)
    const agentLeadCounts = new Map<string, number>();
    for (const agent of eligibleAgents) {
      const callableCount = await countCallableLeads(supabaseAdmin, agent.agent_email);
      agentLeadCounts.set(agent.agent_email, callableCount);
    }

    // Production rank: higher rank = higher priority for AO Queue leads and AOI Connects
    const agentRanks = new Map<string, ProductionRank>();
    await Promise.all(eligibleAgents.map(async (agent) => {
      const rank = await getRankTierForEmail(agent.agent_email);
      agentRanks.set(agent.agent_email, rank);
    }));

    // Sort by rank (Platinum first, then Gold, Silver, Bronze), then by lead count (fewest first)
    const sortedAgents = [...eligibleAgents].sort((a, b) => {
      const orderA = getRankOrder(agentRanks.get(a.agent_email) ?? 'bronze');
      const orderB = getRankOrder(agentRanks.get(b.agent_email) ?? 'bronze');
      if (orderB !== orderA) return orderB - orderA;
      const countA = agentLeadCounts.get(a.agent_email) || 0;
      const countB = agentLeadCounts.get(b.agent_email) || 0;
      return countA - countB;
    });
    
    console.log('📊 Agent lead counts:');
    sortedAgents.forEach(agent => {
      console.log(`   ${agent.agent_email}: ${agentLeadCounts.get(agent.agent_email)} pending leads`);
    });
    
    // Assign leads to matching agents based on market and state permissions
    let assignedCount = 0;
    let skippedCount = 0;
    
      for (const lead of unassignedLeads) {
      const leadMarket = lead.taalk_market || '';
      const leadState = lead.taalk_state || lead.state || '';
      
      console.log(`🔍 Processing lead ${lead.first_name} ${lead.last_name} (Market: ${leadMarket}, State: ${leadState})`);
      
      // Find first agent who can handle this lead's market and state AND has room under cap
      let assignedAgent = null;
      
      for (const agent of sortedAgents) {
        const permissions = agentPermissions.get(agent.agent_email);
        if (!permissions) continue;
        
        // CRITICAL: Check if agent already has cap leads (count ALL leads, not just callable)
        const currentCount = agentLeadCounts.get(agent.agent_email) || 0;
        if (currentCount >= LEAD_CAP) {
          console.log(`   ⏭️ Skipping ${agent.agent_email} - already has ${currentCount} leads (>= ${LEAD_CAP})`);
          continue;
        }
        
        const { markets, states } = permissions;
        
        // Check if agent has this market
        const hasMarket = markets.length === 0 || markets.includes(leadMarket) || leadMarket === '';
        
        // Check if agent has this state
        const hasState = states.length === 0 || states.includes(leadState) || leadState === '';
        
        if (hasMarket && hasState) {
          assignedAgent = agent;
          break;
        }
      }
      
      if (!assignedAgent) {
        console.log(`⚠️ No eligible agent for lead ${lead.taalk_lead_id} (Market: ${leadMarket}, State: ${leadState})`);
        skippedCount++;
        continue;
      }
      
      console.log(`🎯 Assigning lead ${lead.first_name} ${lead.last_name} (${lead.taalk_lead_id}) to ${assignedAgent.agent_email}`);
      
      // Track VDP connect for weekly usage stats
      try {
        await usageTracker.trackVDPConnect(assignedAgent.agent_email, 0);
        console.log(`✅ VDP connect tracked for ${assignedAgent.agent_email}`);
      } catch (err) {
        console.error('❌ CRITICAL: Failed to track VDP connect:', err);
        // Don't block the assignment, but log the error
      }
      
      const { error: updateError } = await masterleadClient.from('masterlead')
        .update({
          cn_email: assignedAgent.agent_email,
          cnresolution: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);
      
      if (updateError) {
        console.error(`❌ Failed to assign lead ${lead.taalk_lead_id}:`, updateError);
      } else {
        console.log(`✅ Lead ${lead.taalk_lead_id} assigned to ${assignedAgent.agent_email}`);
        assignedCount++;
        
        // Update the agent's lead count for round-robin fairness
        const currentCount = agentLeadCounts.get(assignedAgent.agent_email) || 0;
        agentLeadCounts.set(assignedAgent.agent_email, currentCount + 1);
        
        // Re-sort: rank first (higher priority), then lead count (fewest first)
        sortedAgents.sort((a, b) => {
          const orderA = getRankOrder(agentRanks.get(a.agent_email) ?? 'bronze');
          const orderB = getRankOrder(agentRanks.get(b.agent_email) ?? 'bronze');
          if (orderB !== orderA) return orderB - orderA;
          const countA = agentLeadCounts.get(a.agent_email) || 0;
          const countB = agentLeadCounts.get(b.agent_email) || 0;
          return countA - countB;
        });
      }
    }
    
    console.log(`🎉 AUTO-ASSIGN COMPLETE: Assigned ${assignedCount}/${unassignedLeads.length} hotleads, Skipped ${skippedCount} (no matching agent)`);
    
  } catch (error) {
    console.error('❌ Error in auto-assign hotleads:', error);
  }
}

// Cron job - run every 60 seconds
let autoAssignInterval: NodeJS.Timeout | null = null;

export function startAutoAssignScheduler() {
  if (autoAssignInterval) {
    console.log('⚠️ Auto-assign scheduler already running');
    return;
  }
  
  console.log('🚀 Starting auto-assign hotleads scheduler (every 60 seconds)');
  
  // Run immediately on startup
  autoAssignHotleadsToActiveAgents();
  
  // Then run every 60 seconds
  autoAssignInterval = setInterval(() => {
    autoAssignHotleadsToActiveAgents();
  }, 60000); // 60 seconds
}

export function stopAutoAssignScheduler() {
  if (autoAssignInterval) {
    clearInterval(autoAssignInterval);
    autoAssignInterval = null;
    console.log('🛑 Auto-assign scheduler stopped');
  }
}

