import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { countCallableLeads, isSafeToCall } from './timezone-helper';

// Enable FTC/timezone-based lead stripping in scheduler.
const FTC_TIMEZONE_RECYCLING_ENABLED = true;
// Auto top-up uses the existing assignment rules; it only removes manual dependence.
const AUTO_TOPUP_ENABLED = String(process.env.LEAD_AUTO_TOPUP_ENABLED || 'true').toLowerCase() !== 'false';
const LEAD_CAP = 300;
const LEAD_RECYCLE_AFTER_MS = Number(process.env.LEAD_RECYCLE_AFTER_MS || 2 * 60 * 60 * 1000);

function parseProfileArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v ?? '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? '').trim()).filter(Boolean);
      }
    } catch {
      // not JSON, continue with CSV split
    }
    return trimmed
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function getCustomerStates(customerData: any): string[] {
  const raw = parseProfileArray(customerData?.states ?? customerData?.licensed_states);
  return raw.map((s) => s.toUpperCase().trim()).filter(Boolean);
}

function getCustomerMarkets(customerData: any): string[] {
  const raw = parseProfileArray(customerData?.market ?? customerData?.taalk_market);
  return raw.map((m) => m.trim()).filter(Boolean);
}

/**
 * Lead Assignment Scheduler
 * 1. Midnight Reset: Unassigns pending/called leads daily at 12 AM
 * 2. Lead Recycling: Recycles called/no-answer/voicemail leads and enforces lead cap
 * 3. Continuous Assignment: DISABLED - Agents request leads manually via "Get Started" button
 */

class LeadAssignmentScheduler {
  private midnightResetTask: cron.ScheduledTask | null = null;
  private continuousAssignmentTask: cron.ScheduledTask | null = null;
  private leadRecyclingTask: cron.ScheduledTask | null = null;

  startScheduler(): void {
    console.log('🔄 Starting Lead Assignment Scheduler...');
    
    // MIDNIGHT RESET: Runs daily at 12:00 AM
    this.midnightResetTask = cron.schedule('0 0 * * *', async () => {
      console.log('🌙 MIDNIGHT RESET: Starting daily lead unassignment...');
      await this.midnightReset();
    });

    // CONTINUOUS ASSIGNMENT (auto top-up): keep active agents from running dry.
    // Uses the same existing assignment rules/filters (states, market, FTC callable, dnc/plus exclusions).
    if (AUTO_TOPUP_ENABLED) {
      this.continuousAssignmentTask = cron.schedule('*/30 * * * *', async () => {
        console.log('📦 AUTO TOP-UP: Starting periodic lead refill for today-active agents...');
        await this.topUpActiveAgentsToday();
      });
    } else {
      this.continuousAssignmentTask = null;
      console.log('⏭️ AUTO TOP-UP disabled via LEAD_AUTO_TOPUP_ENABLED=false');
    }

    // LEAD RECYCLING: Runs every 5 minutes to enforce lead cap and recycle leads
    this.leadRecyclingTask = cron.schedule('*/5 * * * *', async () => {
      console.log('♻️ LEAD RECYCLING: Starting periodic lead recycling and limit enforcement...');
      await this.recycleCalledLeads();
      await this.enforceLeadCap(); // Enforce lead cap for ALL leads
    });

    console.log('✅ Lead Assignment Scheduler started');
    console.log('   - Midnight reset: Daily at 12:00 AM');
    console.log('   - Lead recycling: Every 5 minutes');
    console.log(`   - Lead cap enforcement (${LEAD_CAP}): Every 5 minutes`);
    console.log(`   - Auto top-up: ${AUTO_TOPUP_ENABLED ? 'Every 30 minutes (enabled)' : 'Disabled'}`);

    if (AUTO_TOPUP_ENABLED) {
      // Run an immediate top-up pass on startup so today-active agents are filled without waiting for cron.
      setTimeout(() => {
        this.topUpActiveAgentsToday().catch((error) => {
          console.error('❌ Startup top-up pass failed:', error);
        });
      }, 2000);
    }
  }

  /**
   * MIDNIGHT RESET
   * Unassigns all pending/called/null leads and saves assignment history
   */
  private async midnightReset(): Promise<void> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase not available');
        return;
      }

      // Find all leads with pending/called/null status that have an agent assigned
      const { data: leadsToReset, error: fetchError } = await masterleadClient.from('masterlead')
        .select('id, cn_email, cnresolution')
        .not('cn_email', 'is', null)
        .or('cnresolution.eq.pending,cnresolution.eq.called,cnresolution.is.null');

      if (fetchError) {
        console.error('❌ Error fetching leads for reset:', fetchError);
        return;
      }

      if (!leadsToReset || leadsToReset.length === 0) {
        console.log('✅ No leads to reset');
        return;
      }

      console.log(`📊 Found ${leadsToReset.length} leads to unassign`);

      // Update all leads: save current agent, clear assignment, set status to pending
      const { data: updatedLeads, error: updateError } = await masterleadClient.from('masterlead')
        .update({
          previous_cn_email: supabaseAdmin.sql`cn_email`,
          last_assigned_date: new Date().toISOString(),
          cn_email: null,
          cnresolution: supabaseAdmin.sql`CASE 
            WHEN cnresolution IS NULL THEN 'pending'
            WHEN cnresolution = 'called' THEN 'pending'
            ELSE cnresolution
          END`
        })
        .not('cn_email', 'is', null)
        .or('cnresolution.eq.pending,cnresolution.eq.called,cnresolution.is.null');

      if (updateError) {
        console.error('❌ Error updating leads:', updateError);
        return;
      }

      console.log(`✅ MIDNIGHT RESET COMPLETE: ${leadsToReset.length} leads unassigned and reset to pending`);
      
    } catch (error) {
      console.error('❌ Midnight reset error:', error);
    }
  }

  /**
   * CONTINUOUS ASSIGNMENT
   * Checks active agents and fills them to lead cap when below cap
   */
  private async continuousAssignment(): Promise<void> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase not available');
        return;
      }

      // Get agents who made Twilio calls in the last 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      const { data: recentCalls, error: callsError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email')
        .gte('created_at', twoHoursAgo.toISOString())
        .not('owner_email', 'is', null);
      
      if (callsError) {
        console.error('❌ Error fetching recent calls:', callsError);
        return;
      }
      
      // Get unique agent emails from Twilio calls
      const activeEmails = [...new Set(recentCalls?.map(c => c.owner_email) || [])];
      const activeAgents = activeEmails.map(email => ({ agentEmail: email }));
      
      if (!activeAgents || activeAgents.length === 0) {
        console.log('⚠️ No agents with Twilio calls in last 2 hours');
        return;
      }

      console.log(`👥 Checking ${activeAgents.length} agents with Twilio calls in last 2 hours...`);

      // First, unassign leads from agents who haven't made Twilio calls in last 2 hours
      
      const { data: allAssignedLeads } = await masterleadClient.from('masterlead')
        .select('cn_email')
        .not('cn_email', 'is', null)
        .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.')
        .limit(100000);
      
      const inactiveAgents = [...new Set(allAssignedLeads?.map(l => l.cn_email).filter(email => !activeEmails.includes(email)) || [])];
      
      let totalUnassignedFromInactive = 0;
      
      for (const inactiveEmail of inactiveAgents) {
        const { data: leadsToUnassign } = await masterleadClient.from('masterlead')
          .select('id')
          .eq('cn_email', inactiveEmail)
          .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.')
          .eq('dnc', false);
        
        if (leadsToUnassign && leadsToUnassign.length > 0) {
          const { error: unassignError } = await masterleadClient.from('masterlead')
            .update({
              previous_cn_email: inactiveEmail,
              last_assigned_date: new Date().toISOString(),
              cn_email: null,
              assigned_date: null,
              cnresolution: 'pending'
            })
            .in('id', leadsToUnassign.map(l => l.id));
          
          if (!unassignError) {
            totalUnassignedFromInactive += leadsToUnassign.length;
            console.log(`🚫 Unassigned ${leadsToUnassign.length} leads from inactive agent ${inactiveEmail}`);
          }
        }
      }
      
      if (totalUnassignedFromInactive > 0) {
        console.log(`✅ Unassigned ${totalUnassignedFromInactive} total leads from ${inactiveAgents.length} inactive agents`);
      }

      let assignedAgents = 0;
      let totalLeadsAssigned = 0;

      // Check each agent's callable lead count
      for (const agent of activeAgents) {
        const agentEmail = agent.agentEmail;
        
        // Count callable leads for this agent - EXCLUDING leads outside timezone restriction
        const currentCallableLeads = await countCallableLeads(supabaseAdmin, agentEmail);

        // NEVER ALLOW MORE THAN LEAD_CAP PENDING LEADS
        // If agent has MORE than cap, unassign the excess immediately
        if (currentCallableLeads > LEAD_CAP) {
          const excessLeads = currentCallableLeads - LEAD_CAP;
          console.log(`🚨 EXCESS LEADS: ${agentEmail} has ${currentCallableLeads} pending leads (OVER LIMIT). Unassigning ${excessLeads}...`);
          
          // Get the excess leads (oldest first) - ONLY pending, called, null, blank
          const { data: leadsToUnassign } = await masterleadClient.from('masterlead')
            .select('id, currently_calling')
            .eq('cn_email', agentEmail)
            .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.')
            .eq('dnc', false)
            .or('currently_calling.is.null,currently_calling.eq.false') // Protection: never unassign active call
            .order('assigned_date', { ascending: true, nullsFirst: true })
            .limit(excessLeads);

          if (leadsToUnassign && leadsToUnassign.length > 0) {
            const { error: unassignError } = await masterleadClient.from('masterlead')
              .update({
                previous_cn_email: agentEmail,
                last_assigned_date: new Date().toISOString(),
                cn_email: null,
                assigned_date: null,
                cnresolution: 'pending' // Reset back to pending when unassigning
              })
              .in('id', leadsToUnassign.map(l => l.id));

            if (unassignError) throw unassignError;
            console.log(`   ✅ Unassigned ${leadsToUnassign.length} excess leads from ${agentEmail}`);
          }
        }
        // If agent has less than cap callable leads, bring them up to cap
        else if (currentCallableLeads < LEAD_CAP) {
          const leadsNeeded = LEAD_CAP - currentCallableLeads;
          console.log(`📤 ASSIGNING: ${agentEmail} has ${currentCallableLeads} callable leads, adding ${leadsNeeded} to reach ${LEAD_CAP}...`);
          
          // Get agent's states and market from customers table
          const { data: customerData } = await supabaseAdmin
            .from('customers')
            .select('states, market, licensed_states, taalk_market')
            .or(`company_email.eq.${agentEmail},personal_email.eq.${agentEmail}`)
            .maybeSingle();

          const customerStates = getCustomerStates(customerData);
          const customerMarkets = getCustomerMarkets(customerData);
          if (customerStates.length === 0 || customerMarkets.length === 0) {
            console.warn(
              `⚠️ SKIP ASSIGN: ${agentEmail} missing states/market profile (states=${JSON.stringify(customerStates)}, markets=${JSON.stringify(customerMarkets)})`,
            );
            continue;
          }
          
          const leadsAssigned = await this.assignLeadsToAgent(
            agentEmail,
            customerStates,
            customerMarkets,
            leadsNeeded
          );

          if (leadsAssigned > 0) {
            assignedAgents++;
            totalLeadsAssigned += leadsAssigned;
            console.log(`✅ Assigned ${leadsAssigned} leads to ${agentEmail}`);
          }
        } else {
          console.log(`⏭️ SKIPPED: ${agentEmail} has ${currentCallableLeads} callable leads`);
        }
      }

      console.log(`✅ CONTINUOUS ASSIGNMENT COMPLETE: ${totalLeadsAssigned} leads assigned to ${assignedAgents} agents`);
      
    } catch (error) {
      console.error('❌ Continuous assignment error:', error);
    }
  }

  /**
   * TODAY-ACTIVE TOP-UP
   * Finds agents who made at least one outbound/inbound call today and fills them to lead cap.
   * Uses the same Leadsync assignment webhook logic as other top-up paths.
   */
  private async topUpActiveAgentsToday(): Promise<void> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase not available');
        return;
      }

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      const { data: todayCalls, error: callsError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email')
        .gte('call_started_at', dayStart.toISOString())
        .not('owner_email', 'is', null);

      if (callsError) {
        console.error('❌ Error fetching today calls for top-up:', callsError);
        return;
      }

      const activeEmails = [...new Set((todayCalls || []).map((c: any) => String(c.owner_email || '').toLowerCase().trim()).filter(Boolean))];
      if (activeEmails.length === 0) {
        console.log('⏭️ AUTO TOP-UP: No agents with calls today');
        return;
      }

      console.log(`👥 AUTO TOP-UP: Found ${activeEmails.length} today-active agents`);

      let assignedAgents = 0;
      let totalLeadsAssigned = 0;

      for (const agentEmail of activeEmails) {
        const currentCallableLeads = await countCallableLeads(supabaseAdmin, agentEmail);

        if (currentCallableLeads >= LEAD_CAP) {
          console.log(`⏭️ SKIPPED: ${agentEmail} has ${currentCallableLeads} callable leads`);
          continue;
        }

        const leadsNeeded = LEAD_CAP - currentCallableLeads;
        console.log(`📤 ASSIGNING: ${agentEmail} has ${currentCallableLeads} callable leads, adding ${leadsNeeded} to reach ${LEAD_CAP}...`);

        const { data: customerData } = await supabaseAdmin
          .from('customers')
          .select('states, market, licensed_states, taalk_market')
          .or(`company_email.eq.${agentEmail},personal_email.eq.${agentEmail}`)
          .maybeSingle();

        const customerStates = getCustomerStates(customerData);
        const customerMarkets = getCustomerMarkets(customerData);
        if (customerStates.length === 0 || customerMarkets.length === 0) {
          console.warn(
            `⚠️ SKIP ASSIGN: ${agentEmail} missing states/market profile (states=${JSON.stringify(customerStates)}, markets=${JSON.stringify(customerMarkets)})`,
          );
          continue;
        }

        const leadsAssigned = await this.assignLeadsToAgent(
          agentEmail,
          customerStates,
          customerMarkets,
          leadsNeeded
        );

        if (leadsAssigned > 0) {
          assignedAgents++;
          totalLeadsAssigned += leadsAssigned;
          console.log(`✅ Assigned ${leadsAssigned} leads to ${agentEmail}`);
        }
      }

      console.log(`✅ AUTO TOP-UP COMPLETE (today-active): ${totalLeadsAssigned} leads assigned to ${assignedAgents} agents`);
    } catch (error) {
      console.error('❌ Today-active auto top-up error:', error);
    }
  }

  /**
   * Assign leads to a specific agent based on territory and market matching
   */
  private async assignLeadsToAgent(
    agentEmail: string,
    licensedStates: string[],
    markets: string[],
    count: number
  ): Promise<number> {
    try {
      if (!supabaseAdmin) return 0;

      // Get current callable leads count
      const currentCallable = await countCallableLeads(supabaseAdmin, agentEmail.toLowerCase());
      
      console.warn(
        `LEADSYNC DISABLED: lead-assignment-scheduler skipped old bulk assignment for ${agentEmail} (current: ${currentCallable}, would have requested: ${count})`,
      );
      return 0;
      
    } catch (error) {
      console.error(`❌ Error in assignLeadsToAgent for ${agentEmail}:`, error);
      return 0;
    }
  }

  /**
   * LEAD RECYCLING
   * Recycles called/no-answer/voicemail leads and ensures agents never exceed lead cap
   * Runs every 30 minutes
   * Can also be called manually via admin endpoint
   */
  async recycleCalledLeads(): Promise<{ recycled: number; unassigned: number; agentsProcessed: number }> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase not available');
        return { recycled: 0, unassigned: 0, agentsProcessed: 0 };
      }
      const recycleCutoff = new Date(Date.now() - LEAD_RECYCLE_AFTER_MS).toISOString();

      console.log('♻️ Starting lead recycling process...');
      console.log('🔍 Checking Supabase connection...', !!supabaseAdmin);

      // Get all agents with assigned leads - get unique agent emails directly
      const { data: agentData, error: fetchError } = await masterleadClient.from('masterlead')
        .select('cn_email')
        .not('cn_email', 'is', null)
        .neq('cn_email', '')
        .eq('dnc', false)
        .lt('updated_at', recycleCutoff)
        .limit(100000);

      console.log('📊 Query result:', { 
        hasData: !!agentData, 
        dataLength: agentData?.length || 0, 
        hasError: !!fetchError,
        error: fetchError?.message || null
      });

      if (fetchError) {
        console.error('❌ Error fetching assigned leads:', fetchError);
        return { recycled: 0, unassigned: 0, agentsProcessed: 0 };
      }

      if (!agentData || agentData.length === 0) {
        console.log('✅ No assigned leads to recycle');
        return { recycled: 0, unassigned: 0, agentsProcessed: 0 };
      }

      // Get unique agent emails
      const agentEmails = [...new Set(agentData.map(l => l.cn_email).filter(Boolean))];
      console.log(`👥 Found ${agentEmails.length} agents with assigned leads (total assigned leads: ${agentData.length})`);
      console.log(`📋 Sample agents: ${agentEmails.slice(0, 5).join(', ')}`);

      let totalRecycled = 0;
      let totalUnassigned = 0;
      let agentsProcessed = 0;

      for (const agentEmail of agentEmails) {
        // STEP 1: Recycle stale "called/no_answer" leads (regardless of count)
        // 🔥 CRITICAL: DO NOT TOUCH PLUS LEADS - Plus leads are NEVER recycled!
        // LEAVE ALL OTHER RESOLUTIONS ALONE (booked, closed, sale, etc.) - those are good resolutions
        // Process in batches to handle large numbers (78k+ leads)
        let hasMoreCalled = true;
        let batchCount = 0;
        while (hasMoreCalled && batchCount < 50) { // Max 50 batches per agent (100k leads)
          const { data: calledLeads, error: calledError } = await masterleadClient.from('masterlead')
            .select('id, cnresolution, currently_calling, aointel')
            .eq('cn_email', agentEmail)
            .in('cnresolution', ['called', 'no_answer_vm', 'no_answer'])
            .eq('dnc', false)
            .lt('updated_at', recycleCutoff)
            .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)') // 🔥 NEVER TOUCH PLUS LEADS!
            .or('aointel.is.null,aointel.eq.false') // 🔥 NEVER TOUCH AOINTEL LEADS! (AOIntel leads have aointel=true)
            .or('currently_calling.is.null,currently_calling.eq.false')
            .limit(2000); // Process 2000 at a time

          if (calledError || !calledLeads || calledLeads.length === 0) {
            hasMoreCalled = false;
            break;
          }

          const calledIds = calledLeads.map(l => l.id);
          const { error: unassignError } = await masterleadClient.from('masterlead')
            .update({
              previous_cn_email: agentEmail,
              last_assigned_date: new Date().toISOString(),
              cn_email: null,
              assigned_date: null,
              cnresolution: 'pending' // Reset stale called/no-answer leads to pending for recycling
            })
            .in('id', calledIds);

          if (!unassignError) {
            totalRecycled += calledIds.length;
            console.log(`   ♻️ Batch ${batchCount + 1}: Recycled ${calledIds.length} stale called/no_answer leads from ${agentEmail}`);
          }

          hasMoreCalled = calledLeads.length === 2000; // If we got 2000, there might be more
          batchCount++;
        }

        // STEP 2: Unassign timezone-restricted leads
        // Disabled per ops request: do not remove leads due to FTC/time-window.
        if (FTC_TIMEZONE_RECYCLING_ENABLED) {
          let hasMoreTimezoneRestricted = true;
          let timezoneBatchCount = 0;
          while (hasMoreTimezoneRestricted && timezoneBatchCount < 50) {
            const { data: recyclableLeads, error: allLeadsError } = await masterleadClient.from('masterlead')
              .select('id, state, taalk_state, currently_calling, cnresolution, aointel')
              .eq('cn_email', agentEmail)
              .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.no_answer_vm,cnresolution.eq.no_answer')
              .eq('dnc', false)
              .lt('updated_at', recycleCutoff)
              .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
              .or('aointel.is.null,aointel.eq.false')
              .or('currently_calling.is.null,currently_calling.eq.false')
              .limit(2000);

            if (allLeadsError || !recyclableLeads || recyclableLeads.length === 0) {
              hasMoreTimezoneRestricted = false;
              break;
            }

            const nonCallableLeads = recyclableLeads.filter(lead => {
              const leadState = lead.taalk_state || lead.state;
              if (!leadState) return false;
              const safeCheck = isSafeToCall(leadState);
              return !safeCheck.safe;
            });

            if (nonCallableLeads.length > 0) {
              const nonCallableIds = nonCallableLeads.map(l => l.id);
              const { error: unassignError } = await masterleadClient.from('masterlead')
                .update({
                  previous_cn_email: agentEmail,
                  last_assigned_date: new Date().toISOString(),
                  cn_email: null,
                  assigned_date: null
                })
                .in('id', nonCallableIds);

              if (!unassignError) {
                totalUnassigned += nonCallableIds.length;
                console.log(`   🌍 Batch ${timezoneBatchCount + 1}: Unassigned ${nonCallableIds.length} timezone-restricted leads from ${agentEmail}`);
              }
            }

            hasMoreTimezoneRestricted = recyclableLeads.length === 2000;
            timezoneBatchCount++;
          }
        }

        // STEP 3: Count recyclable leads (pending/called/no_answer) and ensure agent never exceeds cap
        // 🔥 CRITICAL: Only count/unassign RECYCLABLE dispositions - LEAVE OTHER DISPOSITIONS ALONE (booked, closed, sale, etc.)
        // 🔥 CRITICAL: EXCLUDE PLUS LEADS - Plus leads do NOT count toward recyclable leads!
        // Use separate queries for null and pending to avoid .or() syntax issues
        const [nullCountResult, pendingCountResult, calledCountResult, noAnswerCountResult] = await Promise.all([
          masterleadClient.from('masterlead')
            .select('*', { count: 'exact', head: true })
            .eq('cn_email', agentEmail)
            .is('cnresolution', null)
            .eq('dnc', false)
            .lt('updated_at', recycleCutoff)
            .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)'),
          masterleadClient.from('masterlead')
            .select('*', { count: 'exact', head: true })
            .eq('cn_email', agentEmail)
            .eq('cnresolution', 'pending')
            .eq('dnc', false)
            .lt('updated_at', recycleCutoff)
            .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)'),
          masterleadClient.from('masterlead')
            .select('*', { count: 'exact', head: true })
            .eq('cn_email', agentEmail)
            .eq('cnresolution', 'called')
            .eq('dnc', false)
            .lt('updated_at', recycleCutoff)
            .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)'),
          masterleadClient.from('masterlead')
            .select('*', { count: 'exact', head: true })
            .eq('cn_email', agentEmail)
            .in('cnresolution', ['no_answer_vm', 'no_answer'])
            .eq('dnc', false)
            .lt('updated_at', recycleCutoff)
            .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
        ]);
        
        const recyclableLeadsCount = (nullCountResult.count || 0) + 
                                     (pendingCountResult.count || 0) + 
                                     (calledCountResult.count || 0) + 
                                     (noAnswerCountResult.count || 0);
        
        if (recyclableLeadsCount > LEAD_CAP) {
          const excessRecyclable = recyclableLeadsCount - LEAD_CAP;
          console.log(`🚨 EXCESS RECYCLABLE: ${agentEmail} has ${recyclableLeadsCount} recyclable leads (limit: ${LEAD_CAP}). Unassigning ${excessRecyclable}...`);

          // 🔥 CRITICAL: Get ONLY recyclable leads (pending/called/no_answer/null) - DO NOT TOUCH OTHER DISPOSITIONS
          // Keep only the LEAD_CAP most recent recyclable leads, unassign the rest
          let hasMoreRecyclable = true;
          let totalUnassignedThisAgent = 0;
          let batchNum = 0;
          
          while (hasMoreRecyclable && batchNum < 200) { // Max 200 batches (400k leads) - handle massive lead counts
            // Get recyclable leads in batches - use separate queries to avoid .or() issues
            // 🔥 CRITICAL: EXCLUDE PLUS LEADS - Plus leads are NOT recyclable!
            const [nullLeads, pendingLeads, calledLeads, noAnswerLeads] = await Promise.all([
              masterleadClient.from('masterlead')
                .select('id, assigned_date, currently_calling, cnresolution')
                .eq('cn_email', agentEmail)
                .is('cnresolution', null)
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .or('currently_calling.is.null,currently_calling.eq.false')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(2000),
              masterleadClient.from('masterlead')
                .select('id, assigned_date, currently_calling, cnresolution')
                .eq('cn_email', agentEmail)
                .eq('cnresolution', 'pending')
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .or('currently_calling.is.null,currently_calling.eq.false')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(2000),
              masterleadClient.from('masterlead')
                .select('id, assigned_date, currently_calling, cnresolution')
                .eq('cn_email', agentEmail)
                .eq('cnresolution', 'called')
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .or('currently_calling.is.null,currently_calling.eq.false')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(2000),
              masterleadClient.from('masterlead')
                .select('id, assigned_date, currently_calling, cnresolution')
                .eq('cn_email', agentEmail)
                .in('cnresolution', ['no_answer_vm', 'no_answer'])
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .or('currently_calling.is.null,currently_calling.eq.false')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(2000)
            ]);

            const allRecyclableLeads = [
              ...(nullLeads.data || []),
              ...(pendingLeads.data || []),
              ...(calledLeads.data || []),
              ...(noAnswerLeads.data || [])
            ];

            if (allRecyclableLeads.length === 0) {
              hasMoreRecyclable = false;
              break;
            }

            // Sort by assigned_date DESC (newest first), keep top 50, unassign the rest
            const sortedLeads = [...allRecyclableLeads].sort((a, b) => {
              const dateA = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
              const dateB = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
              return dateB - dateA; // Newest first
            });
            
            // Keep only the LEAD_CAP most recent recyclable leads, unassign ALL the rest
            const keepIds = new Set(sortedLeads.slice(0, LEAD_CAP).map(l => l.id));
            const leadsToUnassign = allRecyclableLeads.filter(lead => !keepIds.has(lead.id));

            if (leadsToUnassign.length > 0) {
              const unassignIds = leadsToUnassign.map(l => l.id);
              const { error: unassignError } = await masterleadClient.from('masterlead')
                .update({
                  previous_cn_email: agentEmail,
                  last_assigned_date: new Date().toISOString(),
                  cn_email: null,
                  assigned_date: null
                  // Keep resolution status - don't reset to pending
                })
                .in('id', unassignIds);

              if (!unassignError) {
                totalUnassignedThisAgent += unassignIds.length;
                totalUnassigned += unassignIds.length;
                console.log(`   🗑️ Batch ${batchNum + 1}: Unassigned ${unassignIds.length} excess recyclable leads from ${agentEmail} (${totalUnassignedThisAgent} total unassigned so far)`);
              }
            }

            hasMoreRecyclable = allRecyclableLeads.length >= 2000; // If we got 2000+, there might be more
            batchNum++;
            
            // Safety check: if we've unassigned enough to get under 50, stop
            if (totalUnassignedThisAgent >= excessRecyclable) {
              break;
            }
          }
          
          // Final check: ensure we're at cap or below for RECYCLABLE leads only
          // 🔥 CRITICAL: EXCLUDE PLUS LEADS - Plus leads are NOT recyclable!
          const [finalNullCount, finalPendingCount, finalCalledCount, finalNoAnswerCount] = await Promise.all([
            masterleadClient.from('masterlead')
              .select('*', { count: 'exact', head: true })
              .eq('cn_email', agentEmail)
              .is('cnresolution', null)
              .eq('dnc', false)
              .lt('updated_at', recycleCutoff)
              .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)'),
            masterleadClient.from('masterlead')
              .select('*', { count: 'exact', head: true })
              .eq('cn_email', agentEmail)
              .eq('cnresolution', 'pending')
              .eq('dnc', false)
              .lt('updated_at', recycleCutoff)
              .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)'),
            masterleadClient.from('masterlead')
              .select('*', { count: 'exact', head: true })
              .eq('cn_email', agentEmail)
              .eq('cnresolution', 'called')
              .eq('dnc', false)
              .lt('updated_at', recycleCutoff)
              .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)'),
            masterleadClient.from('masterlead')
              .select('*', { count: 'exact', head: true })
              .eq('cn_email', agentEmail)
              .in('cnresolution', ['no_answer_vm', 'no_answer'])
              .eq('dnc', false)
              .lt('updated_at', recycleCutoff)
              .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
          ]);
          
          const finalRecyclableCount = (finalNullCount.count || 0) + 
                                       (finalPendingCount.count || 0) + 
                                       (finalCalledCount.count || 0) + 
                                       (finalNoAnswerCount.count || 0);
          
          if (finalRecyclableCount > LEAD_CAP) {
            // 🔥 CRITICAL: One more aggressive pass - get ONLY recyclable leads, keep only LEAD_CAP most recent
            // 🔥 CRITICAL: EXCLUDE PLUS LEADS - Plus leads are NOT recyclable!
            const [finalNullLeads, finalPendingLeads, finalCalledLeads, finalNoAnswerLeads] = await Promise.all([
              masterleadClient.from('masterlead')
                .select('id, assigned_date')
                .eq('cn_email', agentEmail)
                .is('cnresolution', null)
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(5000),
              masterleadClient.from('masterlead')
                .select('id, assigned_date')
                .eq('cn_email', agentEmail)
                .eq('cnresolution', 'pending')
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(5000),
              masterleadClient.from('masterlead')
                .select('id, assigned_date')
                .eq('cn_email', agentEmail)
                .eq('cnresolution', 'called')
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(5000),
              masterleadClient.from('masterlead')
                .select('id, assigned_date')
                .eq('cn_email', agentEmail)
                .in('cnresolution', ['no_answer_vm', 'no_answer'])
                .eq('dnc', false)
                .lt('updated_at', recycleCutoff)
                .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
                .order('assigned_date', { ascending: false, nullsFirst: false })
                .limit(5000)
            ]);
            
            const allFinalRecyclable = [
              ...(finalNullLeads.data || []),
              ...(finalPendingLeads.data || []),
              ...(finalCalledLeads.data || []),
              ...(finalNoAnswerLeads.data || [])
            ];
            
            if (allFinalRecyclable.length > LEAD_CAP) {
              // Sort by assigned_date DESC, keep only LEAD_CAP most recent recyclable leads
              const sortedFinal = [...allFinalRecyclable].sort((a, b) => {
                const dateA = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
                const dateB = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
                return dateB - dateA; // Newest first
              });
              
              const keepIds = new Set(sortedFinal.slice(0, LEAD_CAP).map(l => l.id));
              const unassignFinal = allFinalRecyclable.filter(l => !keepIds.has(l.id));
              
              if (unassignFinal.length > 0) {
                const finalUnassignIds = unassignFinal.map(l => l.id);
                await masterleadClient.from('masterlead')
                  .update({
                    previous_cn_email: agentEmail,
                    last_assigned_date: new Date().toISOString(),
                    cn_email: null,
                    assigned_date: null
                  })
                  .in('id', finalUnassignIds);
                
                totalUnassigned += finalUnassignIds.length;
                console.log(`   ✅ FINAL CLEANUP: Unassigned ${finalUnassignIds.length} recyclable leads from ${agentEmail} (now at ${finalRecyclableCount - finalUnassignIds.length} recyclable leads)`);
              }
            }
          }
        }

        if (totalRecycled > 0 || totalUnassigned > 0) {
          agentsProcessed++;
        }
      }

      console.log(`✅ LEAD RECYCLING COMPLETE:`);
      console.log(`   - Recycled ${totalRecycled} no-answer/voicemail leads`);
      console.log(`   - Unassigned ${totalUnassigned} excess leads`);
      console.log(`   - Processed ${agentsProcessed} agents`);
      
      return {
        recycled: totalRecycled,
        unassigned: totalUnassigned,
        agentsProcessed: agentsProcessed
      };
      
    } catch (error) {
      console.error('❌ Lead recycling error:', error);
      return {
        recycled: 0,
        unassigned: 0,
        agentsProcessed: 0
      };
    }
  }

  /**
   * ENFORCE LEAD CAP
   * Unassigns excess leads from agents who have MORE than cap assigned leads (regardless of resolution)
   * This prevents agents from accumulating thousands of leads
   */
  async enforceLeadCap(): Promise<{ unassigned: number; agentsProcessed: number }> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase not available');
        return { unassigned: 0, agentsProcessed: 0 };
      }
      console.log(`🚨 ENFORCING LEAD CAP (${LEAD_CAP}): Checking all agents for excess leads...`);

      // Get all agents with assigned leads — NO time filter, catch everyone immediately
      const { data: agentData, error: fetchError } = await masterleadClient.from('masterlead')
        .select('cn_email')
        .not('cn_email', 'is', null)
        .neq('cn_email', '')
        .eq('dnc', false)
        .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
        .limit(100000);

      if (fetchError) {
        console.error('❌ Error fetching assigned leads:', fetchError);
        return { unassigned: 0, agentsProcessed: 0 };
      }

      if (!agentData || agentData.length === 0) {
        console.log('✅ No assigned leads to check');
        return { unassigned: 0, agentsProcessed: 0 };
      }

      // Get unique agent emails
      const agentEmails = [...new Set(agentData.map(l => l.cn_email).filter(Boolean))];
      console.log(`👥 Checking ${agentEmails.length} agents for excess leads...`);

      let totalUnassigned = 0;
      let agentsProcessed = 0;

      for (const agentEmail of agentEmails) {
        // Count ONLY callable leads (pending, called, no_answer_vm, new, null) - excluding plus leads
        // DO NOT count leads with real dispositions (booked, sale, etc.) - those don't affect callable count
        // Count ALL callable leads regardless of age — cap must be enforced immediately
        const { count: callableCount, error: countError } = await masterleadClient.from('masterlead')
          .select('*', { count: 'exact', head: true })
          .eq('cn_email', agentEmail)
          .eq('dnc', false)
          .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
          .or('TaalkResolve.is.null,TaalkResolve.eq.false')
          .or('cnresolution.is.null,cnresolution.in.(pending,called,no_answer_vm,new)');

        if (countError) {
          console.error(`❌ Error counting callable leads for ${agentEmail}:`, countError);
          continue;
        }

        const callableLeads = callableCount || 0;

        // If agent has MORE than cap callable leads, unassign the excess
        // DO NOT touch leads with real dispositions (booked, sale, etc.) - they don't count!
        if (callableLeads > LEAD_CAP) {
          const excessLeads = callableLeads - LEAD_CAP;
          console.log(`🚨 EXCESS CALLABLE LEADS: ${agentEmail} has ${callableLeads} callable leads (OVER LIMIT by ${excessLeads}). Unassigning excess...`);

          // Get excess callable leads (oldest first, but NEVER unassign active calls)
          // ONLY unassign leads with callable resolutions (pending, called, no_answer_vm, new, null)
          let hasMore = true;
          let batchNum = 0;
          let unassignedThisAgent = 0;

          while (hasMore && batchNum < 50 && unassignedThisAgent < excessLeads) {
            // No time filter — strip excess leads regardless of when they were assigned
            const { data: callableLeadsToUnassign } = await masterleadClient.from('masterlead')
              .select('id, assigned_date, currently_calling, cnresolution')
              .eq('cn_email', agentEmail)
              .eq('dnc', false)
              .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)')
              .or('cnresolution.is.null,cnresolution.in.(pending,no_answer_vm,new)')
              .or('currently_calling.is.null,currently_calling.eq.false')
              .order('assigned_date', { ascending: true, nullsFirst: true })
              .limit(2000);

            if (callableLeadsToUnassign && callableLeadsToUnassign.length > 0) {
              const toUnassign = callableLeadsToUnassign.slice(0, Math.min(2000, excessLeads - unassignedThisAgent));
              const unassignIds = toUnassign.map(l => l.id);

              const { error: unassignError } = await masterleadClient.from('masterlead')
                .update({
                  previous_cn_email: agentEmail,
                  last_assigned_date: new Date().toISOString(),
                  cn_email: null,
                  assigned_date: null,
                  cnresolution: 'pending' // Reset to pending
                })
                .in('id', unassignIds);

              if (!unassignError) {
                unassignedThisAgent += unassignIds.length;
                totalUnassigned += unassignIds.length;
                console.log(`   ✅ Batch ${batchNum + 1}: Unassigned ${unassignIds.length} callable leads from ${agentEmail}`);
              }

              hasMore = callableLeadsToUnassign.length === 2000 && unassignedThisAgent < excessLeads;
            } else {
              hasMore = false;
            }

            batchNum++;
          }

          if (unassignedThisAgent > 0) {
            agentsProcessed++;
            console.log(`   ✅ ${agentEmail}: Unassigned ${unassignedThisAgent} excess callable leads (now at ${callableLeads - unassignedThisAgent} callable leads)`);
          }
        }
      }

      console.log(`✅ LEAD CAP ENFORCEMENT COMPLETE:`);
      console.log(`   - Unassigned ${totalUnassigned} excess leads`);
      console.log(`   - Processed ${agentsProcessed} agents with excess leads`);

      return {
        unassigned: totalUnassigned,
        agentsProcessed: agentsProcessed
      };

    } catch (error) {
      console.error('❌ Error enforcing lead cap:', error);
      return {
        unassigned: 0,
        agentsProcessed: 0
      };
    }
  }

  stopScheduler(): void {
    if (this.midnightResetTask) {
      this.midnightResetTask.stop();
      this.midnightResetTask = null;
    }
    if (this.continuousAssignmentTask) {
      this.continuousAssignmentTask.stop();
      this.continuousAssignmentTask = null;
    }
    if (this.leadRecyclingTask) {
      this.leadRecyclingTask.stop();
      this.leadRecyclingTask = null;
    }
    console.log('🛑 Lead Assignment Scheduler stopped');
  }
}

export const leadAssignmentScheduler = new LeadAssignmentScheduler();

