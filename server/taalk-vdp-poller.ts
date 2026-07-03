/**
 * Taalk VDP Poller
 * Polls Taalk API every 10 seconds to get real-time agent call status
 */

// Main Taalk API token (works for vdp_agents endpoint)
const TAALK_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const VDP_AGENTS_URL = "https://lets.taalk.ai/api/vdp_agents";

import { agentAvailabilityTracker } from './agent-availability-tracker';
import { supabaseAdmin } from './supabase.js';
import { mapEmailToRealEmail } from './email-mapper';

interface TaalkCall {
  _id: string;
  name: string;
  phone: string;
  agent: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer';
  direction: 'inbound' | 'outbound';
  startTime: string;
  endTime?: string;
  duration?: number;
  recording?: string;
}

interface AgentCallStatus {
  email: string;
  name: string;
  status: 'online' | 'calling' | 'offline';
  currentCall?: {
    callId: string;
    phoneNumber: string;
    direction: 'inbound' | 'outbound';
    duration: number;
    startTime: Date;
  };
  todayStats: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    totalCallTime: number;
  };
  lastActivity: Date;
  availableTime?: number;
  waitingTime?: number;
  // Available time tracking
  onlineStartTime?: Date;
  dailyAvailableTime: number; // Total seconds available today
  lastStatusChange: Date;
}

class TaalkVDPPoller {
  private agents: Map<string, AgentCallStatus> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private lastPollTime: Date = new Date();
  private agentIdToEmailMap: Map<string, string> = new Map(); // Cache agent ID -> email mappings
  private lastWeeklyStatsSync: Date = new Date(0); // Track when we last synced weekly stats
  
  constructor() {
    console.log('≡ƒôí Taalk VDP Poller initialized');
    this.loadAgentMappings(); // Load agent ID -> email mappings on startup
  }
  
  /**
   * Load agent ID to email mappings from database
   */
  private async loadAgentMappings() {
    try {
      if (!supabaseAdmin) return;
      
      // Method 1: Try customers table (PRIMARY SOURCE - has associate_id -> company_email/personal_email mapping)
      const { data: customers, error: customersError } = await supabaseAdmin
        .from('customers')
        .select('associate_id, company_email, personal_email')
        .not('associate_id', 'is', null);
      
      if (!customersError && customers) {
        customers.forEach((record: any) => {
          const associateId = record.associate_id?.toString().toLowerCase();
          const email = (record.company_email || record.personal_email)?.toLowerCase();
          if (associateId && email) {
            this.agentIdToEmailMap.set(associateId, email);
          }
        });
      }
      
      // Method 2: Try producerlist table as fallback (has associate_id -> company_email mapping)
      const { data: producers, error: producersError } = await supabaseAdmin
        .from('producerlist')
        .select('associate_id, company_email')
        .not('associate_id', 'is', null)
        .not('company_email', 'is', null);
      
      if (!producersError && producers) {
        producers.forEach((record: any) => {
          const associateId = record.associate_id?.toString().toLowerCase();
          const email = record.company_email?.toLowerCase();
          if (associateId && email && !this.agentIdToEmailMap.has(associateId)) {
            // Only add if not already in map from customers table
            this.agentIdToEmailMap.set(associateId, email);
          }
        });
      }
      
      console.log(`Loaded ${this.agentIdToEmailMap.size} agent ID -> email mappings from customers and producerlist`);
      
      // Debug for cnsysop/1253 - only log summary to avoid log spam / Railway rate limit
      if (this.agentIdToEmailMap.has('1253')) {
        console.log(`  1253 maps to: ${this.agentIdToEmailMap.get('1253')}`);
      } else {
        console.log(`  1253 NOT found in mapping (total mappings: ${this.agentIdToEmailMap.size})`);
      }
      
    } catch (error) {
      console.error('Γ¥î Error loading agent mappings:', error);
    }
  }
  
  /**
   * Resolve Taalk agent ID to email address
   */
  private resolveAgentEmail(taalkAgentId: string): string {
    const normalizedId = taalkAgentId.toString().toLowerCase();
    
    // Check cache first
    if (this.agentIdToEmailMap.has(normalizedId)) {
      return this.agentIdToEmailMap.get(normalizedId)!;
    }
    
    // If it looks like an email already, use it
    if (normalizedId.includes('@')) {
      return normalizedId;
    }
    
    // Try to construct email from ID (common pattern: chrislafond -> chrislafond@aoglobelife.com)
    return `${normalizedId}@aoglobelife.com`;
  }

  /**
   * Start polling Taalk API for active calls
   */
  start() {
    console.log('≡ƒÜÇ Starting Taalk VDP Poller...');
    
    // Poll immediately on start
    this.pollTaalkAPI();
    
    // Then poll every 10 seconds
    this.pollInterval = setInterval(() => {
      this.pollTaalkAPI();
    }, 10000); // 10 seconds
    
    console.log('Γ£à Taalk VDP Poller started - polling every 10 seconds');
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('≡ƒ¢æ Taalk VDP Poller stopped');
  }

  /**
   * Poll Taalk VDP Agents API for real-time agent status
   */
  private async trackStatusChange(agent: AgentCallStatus, now: Date, previousStatus: string) {
    try {
      // Only track if status actually changed
      if (previousStatus === agent.status) {
        return; // No change
      }

      // Update status in database
      await agentAvailabilityTracker.updateAgentStatus({
        agentId: agent.email.split('@')[0], // Use associate ID
        agentEmail: agent.email,
        agentName: agent.name,
        newStatus: agent.status
      });

      // Log VDP status changes to agent_activity_log for audit trail
      if (supabaseAdmin && previousStatus !== 'online' && agent.status === 'online') {
        // Agent came online (was offline/calling, now online)
        try {
          const { error } = await supabaseAdmin
            .from('agent_activity_log')
            .insert({
              agent_email: agent.email.toLowerCase(),
              activity_type: 'vdp_available_start',
              timestamp: now.toISOString(),
              activity_data: { 
                previous_status: previousStatus,
                new_status: 'online', 
                source: 'taalk_vdp_poller' 
              }
            });
          
          if (error) {
            console.error('⚠️ Failed to log vdp_available_start:', error);
          } else {
            console.log(`✅ Logged vdp_available_start for ${agent.email}`);
          }
        } catch (err) {
          console.error('⚠️ Failed to log vdp_available_start:', err);
        }
      } else if (supabaseAdmin && previousStatus === 'online' && agent.status !== 'online') {
        // Agent went offline (was online, now not online)
        const onlineDuration = agent.onlineStartTime ? Math.round((now.getTime() - agent.onlineStartTime.getTime()) / 1000) : null;
        try {
          const { error } = await supabaseAdmin
            .from('agent_activity_log')
            .insert({
              agent_email: agent.email.toLowerCase(),
              activity_type: 'vdp_available_end',
              timestamp: now.toISOString(),
              activity_data: { 
                previous_status: 'online', 
                new_status: agent.status,
                source: 'taalk_vdp_poller',
                online_duration_seconds: onlineDuration
              }
            });
          
          if (error) {
            console.error('⚠️ Failed to log vdp_available_end:', error);
          } else {
            console.log(`✅ Logged vdp_available_end for ${agent.email} (duration: ${onlineDuration}s)`);
          }
        } catch (err) {
          console.error('⚠️ Failed to log vdp_available_end:', err);
        }
      }

      // Update local tracking
      agent.lastStatusChange = now;
      
      // Get updated daily summary for available time
      const summary = await agentAvailabilityTracker.getAgentDailySummary(agent.email.split('@')[0]);
      if (summary) {
        agent.availableTime = summary.totalAvailableTime;
        agent.dailyAvailableTime = summary.totalAvailableTime;
      }
    } catch (error) {
      console.error('❌ Error tracking agent status change:', error);
    }
  }

  private async pollTaalkAPI() {
    try {
      const response = await fetch(VDP_AGENTS_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TAALK_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'TaalkDashboard/1.0'
        }
      });

      if (!response.ok) {
        console.error(`Γ¥î Taalk VDP Agents API failed: ${response.status} ${response.statusText}`);
        return;
      }

      const agentsData = await response.json();
      
      // Handle different response formats: payload array, direct array, or object with agents
      const agents = agentsData.payload || (Array.isArray(agentsData) ? agentsData : (agentsData.agents || agentsData.data || []));
      
      console.log(`≡ƒôí Taalk VDP API: Found ${agents.length} agents`);
      
      // Process agent data
      await this.processVDPAgentsData(agents);
      
      // Sync VDP status to recruit table for recruit agents (async, don't await)
      this.syncVdpStatusToRecruitTable().catch(err => {
        console.error('Γ¥î Error in syncVdpStatusToRecruitTable:', err);
      });
      
      this.lastPollTime = new Date();
      
    } catch (error) {
      console.error('Γ¥î Taalk VDP poll error:', error);
    }
  }

  /**
   * Process VDP agents data from Taalk API
   */
  private async processVDPAgentsData(agentsData: any[]) {
    const now = new Date();
    
    console.log(`≡ƒôí Processing ${agentsData.length} agents from Taalk VDP API`);
    
    for (const agentData of agentsData) {
      // Get Taalk agent ID from the API data
      const taalkAgentId = agentData.id || agentData.agent || agentData.email;
      if (!taalkAgentId) continue;
      
      // REDUCED LOGGING - only log if status changed or agent is online/calling
      // console.log(`≡ƒôï Taalk Agent ID: ${taalkAgentId} (status: ${agentData.status || agentData.state || 'unknown'})`);
      
      // Resolve to actual email address
      const agentEmail = this.resolveAgentEmail(taalkAgentId);
      // console.log(`  Γ₧í∩╕Å Resolved to: ${agentEmail}`);
      
      // Get or create agent (store by EMAIL, not Taalk ID)
      let agent = this.agents.get(agentEmail);
      
      if (!agent) {
        // Try to get agent name from database
        let agentName = agentData.name || `Agent ${taalkAgentId}`;
        
        // Lookup agent profile for proper name
        if (supabaseAdmin) {
          try {
            const { data: profile } = await supabaseAdmin
              .from('agent_profiles')
              .select('first_name, last_name')
              .eq('email', agentEmail)
              .maybeSingle();
            
            if (profile) {
              agentName = `${profile.first_name} ${profile.last_name}`;
            }
          } catch (e) {
            // Use default name
          }
        }
        
        agent = {
          email: agentEmail, // Use resolved email
          name: agentName,
          status: 'offline',
          todayStats: {
            totalCalls: 0,
            inboundCalls: 0,
            outboundCalls: 0,
            totalCallTime: 0
          },
          lastActivity: now,
          onlineStartTime: undefined,
          dailyAvailableTime: 0,
          lastStatusChange: now
        };
        this.agents.set(agentEmail, agent);
      }
      
      // Update agent status from API
      agent.lastActivity = now;
      
      // Capture previous status BEFORE updating
      const previousStatus = agent.status;
      
      // LOG STATUSES FROM TAALK API - Only for agents who are ONLINE/AVAILABLE or ON A CALL
      // This helps us see what statuses Taalk is actually returning
      const rawStatus = {
        busy: agentData.busy,
        status: agentData.status,
        state: agentData.state,
        online: agentData.online,
        available: agentData.available
      };
      
      // Only log if agent is online/available or busy (to see what statuses we're getting)
      if (agentData.busy === true || agentData.status === 'busy' || agentData.state === 'busy' ||
          agentData.online === true || agentData.status === 'online' || agentData.state === 'available' || agentData.available === true) {
        console.log(`📊 TAALK STATUS for ${agentEmail}:`, JSON.stringify(rawStatus));
      }
      
      // SIMPLIFIED: Only two states matter - ONLINE/AVAILABLE or ON A CALL
      // Determine status from API fields
      if (agentData.busy === true || agentData.status === 'busy' || agentData.state === 'busy') {
        agent.status = 'calling'; // ON A CALL
        
        // If we have current call info
        if (agentData.currentCall || agentData.call) {
          const callData = agentData.currentCall || agentData.call;
          agent.currentCall = {
            callId: callData.id || callData.callId || 'unknown',
            phoneNumber: callData.phone || callData.phoneNumber || 'Unknown',
            direction: callData.direction || 'outbound',
            duration: callData.duration || 0,
            startTime: callData.startTime ? new Date(callData.startTime) : now
          };
        } else {
          // Busy but no call details - create placeholder
          agent.currentCall = {
            callId: 'active',
            phoneNumber: 'Active Call',
            direction: 'outbound',
            duration: 0,
            startTime: now
          };
        }
      } else if (agentData.online === true || agentData.status === 'online' || agentData.state === 'available' || agentData.available === true) {
        // ONLINE/AVAILABLE - This is what we track for VDP time
        const wasOffline = previousStatus === 'offline' || previousStatus === 'calling';
        agent.status = 'online'; // ONLINE/AVAILABLE
        agent.currentCall = undefined;
        
        // Set onlineStartTime when agent comes online
        if (wasOffline || !agent.onlineStartTime) {
          agent.onlineStartTime = now;
          console.log(`📊 ${agent.email} is ONLINE/AVAILABLE at ${now.toISOString()}`);
        }
      } else {
        // Everything else = OFFLINE (we don't care about this)
        const wasOnline = previousStatus === 'online';
        agent.status = 'offline';
        agent.currentCall = undefined;
        
        // Calculate and log time spent online when going offline
        if (wasOnline && agent.onlineStartTime) {
          const onlineDuration = Math.round((now.getTime() - agent.onlineStartTime.getTime()) / 1000);
          agent.dailyAvailableTime += onlineDuration;
          console.log(`📊 ${agent.email} went OFFLINE after ${onlineDuration} seconds online`);
          agent.onlineStartTime = undefined;
        }
      }
      
      // Track status changes in database (pass previous status)
      await this.trackStatusChange(agent, now, previousStatus);
    }
    
    // CRITICAL: Also accumulate time for agents who are currently online/calling
    // This ensures time is tracked even if status hasn't changed
    await this.accumulateCurrentSessionTime(now);
    
    // Log summary - ONLY TWO STATES MATTER: ONLINE/AVAILABLE or ON A CALL
    const online = Array.from(this.agents.values()).filter(a => a.status === 'online').length;
    const calling = Array.from(this.agents.values()).filter(a => a.status === 'calling').length;
    const offline = Array.from(this.agents.values()).filter(a => a.status === 'offline').length;
    
    // Show which agents are actually ONLINE/AVAILABLE
    const onlineAgentsList = Array.from(this.agents.values())
      .filter(a => a.status === 'online')
      .map(a => a.email)
      .slice(0, 10); // Limit to first 10 to avoid spam
    
    console.log(`📊 VDP Status: ${online} ONLINE/AVAILABLE, ${calling} ON A CALL, ${offline} offline (${this.agents.size} total)`);
    if (onlineAgentsList.length > 0) {
      console.log(`📊 ONLINE agents: ${onlineAgentsList.join(', ')}${online > 10 ? ' ...' : ''}`);
    }
  }

  /**
   * Accumulate time for agents currently ONLINE/AVAILABLE or ON A CALL
   * This runs every poll (every 10 seconds) to track time
   * SIMPLE: Track time when status === 'online' (ONLINE/AVAILABLE) or 'calling' (ON A CALL)
   */
  private async accumulateCurrentSessionTime(now: Date) {
    try {
      // Track agents who are ONLINE/AVAILABLE (status === 'online')
      // OR ON A CALL (status === 'calling')
      const activeAgents = Array.from(this.agents.values()).filter(a => 
        a.status === 'online' || a.status === 'calling'
      );
      
      // Separate for clarity
      const onlineAgents = activeAgents.filter(a => a.status === 'online');
      const callingAgents = activeAgents.filter(a => a.status === 'calling');
      
      if (activeAgents.length === 0) {
        return; // No agents online or on call
      }
      
      console.log(`📊 VDP Poller: ${onlineAgents.length} ONLINE/AVAILABLE, ${callingAgents.length} ON A CALL`);
      
      // Update each ONLINE/AVAILABLE agent's time - accumulate 10 seconds (poll interval)
      for (const agent of onlineAgents) {
        try {
          const agentId = agent.email.split('@')[0];
          const trackingDate = now.toISOString().split('T')[0];
          
          // Get or create tracking record
          let { data: existingRecord, error: fetchError } = await supabaseAdmin
            .from('agent_availability_tracking')
            .select('*')
            .eq('agent_id', agentId)
            .eq('tracking_date', trackingDate)
            .single();
          
          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error(`❌ Error fetching record for ${agent.email}:`, fetchError);
            continue;
          }
          
          if (!existingRecord) {
            // Create new record for today
            // Calculate initial time from onlineStartTime to now
            const sessionStart = agent.onlineStartTime || now;
            const initialTime = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
            
            const { data: newRecord, error: createError } = await supabaseAdmin
              .from('agent_availability_tracking')
              .insert({
                agent_id: agentId,
                agent_email: agent.email,
                agent_name: agent.name,
                tracking_date: trackingDate,
                current_status: 'online',
                status_changed_at: now,
                last_activity: now,
                current_session_start: sessionStart,
                total_available_time: initialTime > 0 ? initialTime : 0
              })
              .select()
              .single();
            
            if (createError) {
              console.error(`❌ Error creating record for ${agent.email}:`, createError);
              console.error(`   Error details:`, JSON.stringify(createError, null, 2));
            } else {
              console.log(`✅ Created tracking record for ${agent.email} with ${Math.round(initialTime / 60)} min initial time`);
            }
            continue;
          }
          
          // Agent is online - accumulate time
          // Calculate time since last update (or session start)
          const lastUpdate = existingRecord.status_changed_at 
            ? new Date(existingRecord.status_changed_at)
            : (existingRecord.current_session_start 
                ? new Date(existingRecord.current_session_start)
                : now);
          
          const timeSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
          
          // Accumulate time (poll runs every 10 seconds, so typically 10 seconds per poll)
          if (timeSinceUpdate > 0) {
            const newTotalTime = (existingRecord.total_available_time || 0) + timeSinceUpdate;
            
            const { data: updatedRecord, error: updateError } = await supabaseAdmin
              .from('agent_availability_tracking')
              .update({
                total_available_time: newTotalTime,
                status_changed_at: now, // Update timestamp for next poll
                last_activity: now,
                current_status: 'online'
              })
              .eq('id', existingRecord.id)
              .select()
              .single();
            
            if (updateError) {
              console.error(`❌ Error accumulating time for ${agent.email}:`, updateError);
              console.error(`   Error details:`, JSON.stringify(updateError, null, 2));
            } else {
              // Log updates periodically (every minute or significant changes)
              if (timeSinceUpdate >= 60) {
                console.log(`✅ VDP ONLINE: ${agent.email} accumulated ${Math.round(timeSinceUpdate/60)}min (total: ${Math.round(newTotalTime/60)}min today)`);
              }
              // Verify the update actually worked
              if (updatedRecord && updatedRecord.total_available_time !== newTotalTime) {
                console.error(`⚠️ WARNING: Update didn't work! Expected ${newTotalTime}, got ${updatedRecord.total_available_time}`);
              }
            }
          } else {
            // Still update last_activity even if no time accumulated
            await supabaseAdmin
              .from('agent_availability_tracking')
              .update({
                last_activity: now,
                current_status: 'online'
              })
              .eq('id', existingRecord.id);
          }
        } catch (agentError) {
          console.error(`❌ Error processing agent ${agent.email}:`, agentError);
        }
      }
      
      // Also track agents ON A CALL (status === 'calling')
      // This is separate from VDP available time, but we track it for completeness
      for (const agent of callingAgents) {
        try {
          const agentId = agent.email.split('@')[0];
          const trackingDate = now.toISOString().split('T')[0];
          
          let { data: existingRecord, error: fetchError } = await supabaseAdmin
            .from('agent_availability_tracking')
            .select('*')
            .eq('agent_id', agentId)
            .eq('tracking_date', trackingDate)
            .single();
          
          if (fetchError && fetchError.code !== 'PGRST116') {
            continue;
          }
          
          if (!existingRecord) {
            // Create new record for calling agent
            // Calculate initial time from call start to now
            const callStart = agent.currentCall?.startTime || now;
            const initialTime = Math.floor((now.getTime() - callStart.getTime()) / 1000);
            
            const { data: newRecord, error: createError } = await supabaseAdmin
              .from('agent_availability_tracking')
              .insert({
                agent_id: agentId,
                agent_email: agent.email,
                agent_name: agent.name,
                tracking_date: trackingDate,
                current_status: 'calling',
                status_changed_at: now,
                last_activity: now,
                total_calling_time: initialTime > 0 ? initialTime : 0
              })
              .select()
              .single();
            
            if (createError) {
              console.error(`❌ Error creating calling record for ${agent.email}:`, createError);
              console.error(`   Error details:`, JSON.stringify(createError, null, 2));
            } else {
              console.log(`✅ Created calling record for ${agent.email} with ${Math.round(initialTime / 60)} min initial time`);
            }
            continue;
          }
          
          // Accumulate calling time
          const lastUpdate = existingRecord.status_changed_at 
            ? new Date(existingRecord.status_changed_at)
            : now;
          
          const timeSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
          
          if (timeSinceUpdate > 0) {
            const newTotalCallingTime = (existingRecord.total_calling_time || 0) + timeSinceUpdate;
            
            const { data: updatedRecord, error: updateError } = await supabaseAdmin
              .from('agent_availability_tracking')
              .update({
                total_calling_time: newTotalCallingTime,
                status_changed_at: now,
                last_activity: now,
                current_status: 'calling'
              })
              .eq('id', existingRecord.id)
              .select()
              .single();
            
            if (updateError) {
              console.error(`❌ Error accumulating calling time for ${agent.email}:`, updateError);
              console.error(`   Error details:`, JSON.stringify(updateError, null, 2));
            } else if (timeSinceUpdate >= 60) {
              console.log(`✅ VDP ON CALL: ${agent.email} accumulated ${Math.round(timeSinceUpdate/60)}min (total: ${Math.round(newTotalCallingTime/60)}min today)`);
            }
          } else {
            // Still update last_activity even if no time accumulated
            await supabaseAdmin
              .from('agent_availability_tracking')
              .update({
                last_activity: now,
                current_status: 'calling'
              })
              .eq('id', existingRecord.id);
          }
        } catch (agentError) {
          console.error(`❌ Error processing calling agent ${agent.email}:`, agentError);
        }
      }
      
      // Sync to weekly_usage_stats periodically (every 60 seconds)
      const timeSinceLastSync = (now.getTime() - this.lastWeeklyStatsSync.getTime()) / 1000;
      if (timeSinceLastSync >= 60) {
        await this.syncDailyTrackingToWeeklyStats(now).catch(err => {
          console.error('❌ Error syncing daily tracking to weekly stats:', err);
        });
        this.lastWeeklyStatsSync = now;
      }
    } catch (error) {
      console.error('❌ Error in accumulateCurrentSessionTime:', error);
    }
  }

  /**
   * Sync accumulated time from agent_availability_tracking to weekly_usage_stats
   * This aggregates daily tracking data into weekly stats
   */
  private async syncDailyTrackingToWeeklyStats(now: Date) {
    try {
      if (!supabaseAdmin) {
        console.warn('⚠️ supabaseAdmin not available, skipping weekly stats sync');
        return;
      }

      // Calculate current week boundaries (Sunday to Saturday)
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
      weekEnd.setHours(23, 59, 59, 999);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      console.log(`📊 Syncing daily tracking to weekly stats for week ${weekStartStr} to ${weekEndStr}`);

      // Get all daily tracking records for this week
      const { data: dailyTracking, error: trackingError } = await supabaseAdmin
        .from('agent_availability_tracking')
        .select('agent_email, agent_id, agent_name, tracking_date, total_available_time, total_calling_time')
        .gte('tracking_date', weekStartStr)
        .lte('tracking_date', weekEndStr);

      if (trackingError) {
        console.error('❌ Error fetching daily tracking data:', trackingError);
        return;
      }

      if (!dailyTracking || dailyTracking.length === 0) {
        console.log('📊 No daily tracking data found for this week');
        return;
      }


      // Group by agent_email and sum up the time, then map to real emails
      const weeklyDataByAgent = new Map<string, {
        agent_email: string;
        agent_name: string | null;
        total_available_minutes: number;
        total_calling_minutes: number;
      }>();

      for (const record of dailyTracking) {
        const email = record.agent_email?.toLowerCase();
        if (!email) continue;

        if (!weeklyDataByAgent.has(email)) {
          weeklyDataByAgent.set(email, {
            agent_email: email,
            agent_name: record.agent_name || null,
            total_available_minutes: 0,
            total_calling_minutes: 0
          });
        }

        const weeklyData = weeklyDataByAgent.get(email)!;
        // Convert seconds to minutes
        weeklyData.total_available_minutes += Math.round((record.total_available_time || 0) / 60);
        weeklyData.total_calling_minutes += Math.round((record.total_calling_time || 0) / 60);
      }

      console.log(`📊 Found ${weeklyDataByAgent.size} agents with tracking data this week`);

      // Map all emails to real emails and consolidate by real email
      const weeklyDataByRealEmail = new Map<string, {
        agent_email: string;
        agent_name: string | null;
        total_available_minutes: number;
        total_calling_minutes: number;
        numericEmails: string[]; // Track which numeric emails map to this real email
      }>();

      for (const [email, data] of weeklyDataByAgent) {
        const realEmail = await mapEmailToRealEmail(email);
        
        if (realEmail !== email) {
          console.log(`🔄 Mapping numeric email ${email} -> ${realEmail}`);
        }
        
        if (!weeklyDataByRealEmail.has(realEmail)) {
          weeklyDataByRealEmail.set(realEmail, {
            agent_email: realEmail,
            agent_name: data.agent_name,
            total_available_minutes: data.total_available_minutes,
            total_calling_minutes: data.total_calling_minutes,
            numericEmails: email !== realEmail ? [email] : []
          });
        } else {
          // Merge stats if multiple numeric emails map to same real email
          const existing = weeklyDataByRealEmail.get(realEmail)!;
          existing.total_available_minutes += data.total_available_minutes;
          existing.total_calling_minutes += data.total_calling_minutes;
          if (email !== realEmail) {
            existing.numericEmails.push(email);
          }
        }
      }

      // Update weekly_usage_stats for each agent (using real emails)
      for (const [realEmail, data] of weeklyDataByRealEmail) {
        try {
          // Check if a record with the real email already exists
          const { data: existingRecord } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('id, vdp_total_minutes, vdp_available_minutes, vdp_call_minutes')
            .eq('agent_email', realEmail)
            .eq('week_start_date', weekStartStr)
            .maybeSingle();

          if (existingRecord) {
            // Record exists - update it with merged stats (take max values)
            const totalVdpMinutes = data.total_available_minutes + data.total_calling_minutes;
            
            const { error: updateError } = await supabaseAdmin
              .from('weekly_usage_stats')
              .update({
                vdp_available_minutes: Math.max(
                  existingRecord.vdp_available_minutes || 0,
                  data.total_available_minutes
                ),
                vdp_call_minutes: Math.max(
                  existingRecord.vdp_call_minutes || 0,
                  data.total_calling_minutes
                ),
                vdp_total_minutes: Math.max(
                  existingRecord.vdp_total_minutes || 0,
                  totalVdpMinutes
                ),
                updated_at: now.toISOString()
              })
              .eq('agent_email', realEmail)
              .eq('week_start_date', weekStartStr);

            if (updateError) {
              console.error(`❌ Error updating weekly stats for ${realEmail}:`, updateError);
            } else if (totalVdpMinutes > 0) {
              console.log(`✅ Updated weekly stats for ${realEmail}: ${data.total_available_minutes} min available, ${data.total_calling_minutes} min calling, ${totalVdpMinutes} min total VDP`);
            }

            // Delete any numeric email records for this week
            if (data.numericEmails.length > 0) {
              for (const numericEmail of data.numericEmails) {
                await supabaseAdmin
                  .from('weekly_usage_stats')
                  .delete()
                  .eq('agent_email', numericEmail)
                  .eq('week_start_date', weekStartStr);
              }
            }
          } else {
            // No existing record - create/update with real email
            const totalVdpMinutes = data.total_available_minutes + data.total_calling_minutes;
            
            const { error: upsertError } = await supabaseAdmin
              .from('weekly_usage_stats')
              .upsert({
                agent_email: realEmail,
                agent_name: data.agent_name,
                week_start_date: weekStartStr,
                week_end_date: weekEndStr,
                vdp_available_minutes: data.total_available_minutes,
                vdp_call_minutes: data.total_calling_minutes,
                vdp_total_minutes: totalVdpMinutes,
                updated_at: now.toISOString()
              }, {
                onConflict: 'agent_email,week_start_date'
              });

            if (upsertError) {
              console.error(`❌ Error upserting weekly stats for ${realEmail}:`, upsertError);
            } else if (totalVdpMinutes > 0) {
              console.log(`✅ Created/updated weekly stats for ${realEmail}: ${data.total_available_minutes} min available, ${data.total_calling_minutes} min calling, ${totalVdpMinutes} min total VDP`);
            }

            // Delete any numeric email records for this week
            if (data.numericEmails.length > 0) {
              for (const numericEmail of data.numericEmails) {
                await supabaseAdmin
                  .from('weekly_usage_stats')
                  .delete()
                  .eq('agent_email', numericEmail)
                  .eq('week_start_date', weekStartStr);
              }
            }
          }
        } catch (agentError) {
          console.error(`❌ Error processing agent ${realEmail} in weekly stats sync:`, agentError);
        }
      }

      console.log(`✅ Completed weekly stats sync for ${weeklyDataByAgent.size} agents`);
    } catch (error) {
      console.error('❌ Error in syncDailyTrackingToWeeklyStats:', error);
    }
  }

  /**
   * Process VDP webhook events from database (DEPRECATED - using API instead)
   */
  private processWebhookEvents(events: any[]) {
    const agentMap = new Map<string, AgentCallStatus>();
    const now = new Date();
    
    // Group events by agent
    const agentEvents = new Map<string, any[]>();
    
    for (const event of events) {
      const agentId = event.agent_id;
      if (!agentId) continue;
      
      const agentEmail = agentId.includes('@') ? agentId : `${agentId}@aoglobelife.com`;
      
      if (!agentEvents.has(agentEmail)) {
        agentEvents.set(agentEmail, []);
      }
      agentEvents.get(agentEmail)!.push(event);
    }
    
    console.log(`≡ƒôí Processing events for ${agentEvents.size} agents`);
    
    // Process each agent's events
    for (const [agentEmail, events] of agentEvents.entries()) {
      // Get or create agent
      let agent = this.agents.get(agentEmail);
      
      if (!agent) {
        agent = {
          email: agentEmail,
          name: agentEmail.split('@')[0],
          status: 'offline',
          todayStats: {
            totalCalls: 0,
            inboundCalls: 0,
            outboundCalls: 0,
            totalCallTime: 0
          },
          lastActivity: new Date(events[0].created_at)
        };
        this.agents.set(agentEmail, agent);
      }
      
      // Find most recent event
      const latestEvent = events[0]; // Already ordered by created_at desc
      const eventTime = new Date(latestEvent.created_at);
      agent.lastActivity = eventTime;
      
      // Check if agent is currently on a call
      const hasRecentConnect = events.some(e => 
        e.event_type === 'CONNECT' && 
        (now.getTime() - new Date(e.created_at).getTime()) < 5 * 60 * 1000 // Last 5 mins
      );
      
      // Determine status based on recent activity
      const minutesSinceActivity = (now.getTime() - eventTime.getTime()) / (1000 * 60);
      
      if (hasRecentConnect && minutesSinceActivity < 15) {
        agent.status = 'calling';
        // Find the CONNECT event details
        const connectEvent = events.find(e => e.event_type === 'CONNECT');
        if (connectEvent) {
          agent.currentCall = {
            callId: connectEvent.id?.toString() || 'unknown',
            phoneNumber: connectEvent.phone_number || 'Unknown',
            direction: 'outbound', // VDP calls are typically outbound
            duration: Math.floor((now.getTime() - new Date(connectEvent.created_at).getTime()) / 1000),
            startTime: new Date(connectEvent.created_at)
          };
        }
      } else if (minutesSinceActivity < 30) {
        agent.status = 'online';
        agent.currentCall = undefined;
      } else {
        agent.status = 'offline';
        agent.currentCall = undefined;
      }
      
      // Count today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayEvents = events.filter(e => {
        const eventDate = new Date(e.created_at);
        return eventDate >= today;
      });
      
      agent.todayStats.totalCalls = todayEvents.filter(e => e.event_type === 'CONNECT').length;
      agent.todayStats.outboundCalls = agent.todayStats.totalCalls; // VDP calls are outbound
      agent.todayStats.inboundCalls = 0;
    }
    
    // Log summary
    const online = Array.from(this.agents.values()).filter(a => a.status === 'online').length;
    const calling = Array.from(this.agents.values()).filter(a => a.status === 'calling').length;
    
    if (this.agents.size > 0) {
      console.log(`≡ƒôí VDP Status: ${online} online, ${calling} calling, ${this.agents.size} total agents`);
    }
  }

  /**
   * Process calls data and update agent statuses (DEPRECATED - using webhooks instead)
   */
  private processCallsData(calls: TaalkCall[]) {
    const agentMap = new Map<string, AgentCallStatus>();
    const now = new Date();
    
    // Reset all agents to offline initially
    for (const agent of this.agents.values()) {
      agent.status = 'offline';
      agent.currentCall = undefined;
    }
    
    // Process each call
    for (const call of calls) {
      const agentEmail = `${call.agent}@aoglobelife.com`;
      
      // Get or create agent
      let agent = this.agents.get(agentEmail) || agentMap.get(agentEmail);
      
      if (!agent) {
        agent = {
          email: agentEmail,
          name: call.agent,
          status: 'offline',
          todayStats: {
            totalCalls: 0,
            inboundCalls: 0,
            outboundCalls: 0,
            totalCallTime: 0
          },
          lastActivity: new Date(call.startTime)
        };
        agentMap.set(agentEmail, agent);
      }
      
      // Update last activity
      const callTime = new Date(call.startTime);
      if (callTime > agent.lastActivity) {
        agent.lastActivity = callTime;
      }
      
      // Check if call is currently active
      const isActive = ['initiated', 'ringing', 'in-progress'].includes(call.status);
      
      if (isActive) {
        agent.status = 'calling';
        const startTime = new Date(call.startTime);
        const duration = (now.getTime() - startTime.getTime()) / 1000;
        
        agent.currentCall = {
          callId: call._id,
          phoneNumber: call.phone,
          direction: call.direction || 'outbound',
          duration: Math.floor(duration),
          startTime
        };
      } else {
        // Completed call - just count stats
        if (call.status === 'completed') {
          // Count in today's stats
          const callDate = new Date(call.startTime);
          const isToday = callDate.toDateString() === now.toDateString();
          
          if (isToday) {
            agent.todayStats.totalCalls++;
            if (call.direction === 'inbound') {
              agent.todayStats.inboundCalls++;
            } else {
              agent.todayStats.outboundCalls++;
            }
            
            if (call.duration) {
              agent.todayStats.totalCallTime += call.duration;
            }
          }
        }
        
        // If agent had recent activity (last 5 minutes) and no active call, mark as online
        const minutesSinceActivity = (now.getTime() - agent.lastActivity.getTime()) / (1000 * 60);
        if (minutesSinceActivity < 5 && !agent.currentCall) {
          agent.status = 'online';
        }
      }
    }
    
    // Merge new agents into main map
    for (const [email, agent] of agentMap.entries()) {
      this.agents.set(email, agent);
    }
    
    // Count agents by status
    const online = Array.from(this.agents.values()).filter(a => a.status === 'online').length;
    const calling = Array.from(this.agents.values()).filter(a => a.status === 'calling').length;
    
    if (online > 0 || calling > 0) {
      console.log(`≡ƒôí VDP Status: ${online} online, ${calling} calling, ${this.agents.size} total agents`);
    }
  }
  
  /**
   * Sync VDP status to live_call_boardt_recruit table for recruit agents
   * Ensures agents who go online in recruiting VDP get an entry so managers can see they're online
   */
  private async syncVdpStatusToRecruitTable() {
    if (!supabaseAdmin) return;
    
    try {
      // Get all agents who are online or calling in VDP
      const activeAgents = Array.from(this.agents.values()).filter(a => 
        a.status === 'online' || a.status === 'calling'
      );
      
      if (activeAgents.length === 0) return;
      
      // Identify which agents are recruit agents (have market='aorecruit')
      // Method 1: Check recruit_candidates table
      const { data: recruitCandidates } = await supabaseAdmin
        .from('recruit_candidates')
        .select('agent_email')
        .not('agent_email', 'is', null)
        .limit(10000);
      
      const recruitAgentEmails = new Set<string>();
      if (recruitCandidates) {
        recruitCandidates.forEach((c: any) => {
          const email = c.agent_email?.toLowerCase();
          if (email) recruitAgentEmails.add(email);
        });
      }
      
      // Method 2: Check vdp_calls for market='aorecruit' in last 30 days
      const { data: recruitVdpCalls } = await supabaseAdmin
        .from('vdp_calls')
        .select('agent_email, market')
        .ilike('market', '%aorecruit%')
        .gte('time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .not('agent_email', 'is', null);
      
      if (recruitVdpCalls) {
        recruitVdpCalls.forEach((call: any) => {
          const email = call.agent_email?.toLowerCase();
          if (email) recruitAgentEmails.add(email);
        });
      }
      
      // Sync status for recruit agents who are online/calling
      // This ensures managers can see agents are online/waiting even if they haven't made calls yet
      for (const agent of activeAgents) {
        const email = agent.email.toLowerCase();
        
        // Check if this agent is a recruit agent (has ever done recruiting)
        // We check: recruit_candidates OR vdp_calls with market='aorecruit' in last 30 days
        let isRecruitAgent = recruitAgentEmails.has(email);
        
        // If not found, do a quick check - maybe they just went online and don't have history yet
        // But we only create entries for agents who have some recruit activity
        if (!isRecruitAgent) continue;
        
        // Get agent name from hierarchy or use email
        let agentName = agent.name || email.split('@')[0];
        const { data: hierarchy } = await supabaseAdmin
          .from('agent_hierarchy')
          .select('agent_name')
          .eq('agent_email', email)
          .maybeSingle();
        
        if (hierarchy?.agent_name) {
          agentName = hierarchy.agent_name;
        }
        
        // Determine status: 'online' or 'calling'
        const dbStatus = agent.status === 'calling' ? 'calling' : 'online';
        
        // Check if entry exists first
        const { data: existing } = await supabaseAdmin
          .from('live_call_boardt_recruit')
          .select('agent_email')
          .eq('agent_email', email)
          .maybeSingle();
        
        if (!existing) {
          // New entry - INSERT with all stats initialized to 0
          // CRITICAL: This ensures agents show up in the leaderboard even if they have no calls/stats yet
          const { error: insertError } = await supabaseAdmin
            .from('live_call_boardt_recruit')
            .insert({
              agent_email: email,
              agent_name: agentName,
              status: dbStatus,
              today_dialed: 0,
              today_reached: 0,
              today_booked: 0,
              today_connects: 0,
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error(`Γ¥î Failed to insert new recruit agent ${email}:`, insertError);
          } else {
            console.log(`Γ£à Inserted new recruit agent ${email} with status: ${dbStatus} (all stats initialized to 0)`);
          }
        } else {
          // Existing entry - just UPDATE status (preserve existing stats)
          const { error: updateError } = await supabaseAdmin
            .from('live_call_boardt_recruit')
            .update({
              status: dbStatus,
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', email);
          
          if (updateError) {
            console.error(`Γ¥î Failed to update status for ${email}:`, updateError);
          }
        }
        
        // Also update status for existing entries (upsert might not update status if row exists)
        // This ensures status is always current even if stats were already populated
        await supabaseAdmin
          .from('live_call_boardt_recruit')
          .update({
            status: dbStatus,
            updated_at: new Date().toISOString()
          })
          .eq('agent_email', email);
      }
      
      // Set status to 'offline' for recruit agents who were online but are now offline
      const activeEmails = new Set(activeAgents.map(a => a.email.toLowerCase()));
      const offlineRecruitAgents = Array.from(recruitAgentEmails).filter(email => 
        !activeEmails.has(email)
      );
      
      if (offlineRecruitAgents.length > 0) {
        const { error } = await supabaseAdmin
          .from('live_call_boardt_recruit')
          .update({ 
            status: 'offline',
            updated_at: new Date().toISOString()
          })
          .in('agent_email', offlineRecruitAgents)
          .or('status.eq.online,status.eq.calling');
        
        if (error) {
          console.error('Γ¥î Failed to update offline status for recruit agents:', error);
        }
      }
      
    } catch (error) {
      console.error('Γ¥î Error syncing VDP status to recruit table:', error);
    }
  }

  /**
   * Get all agents
   */
  getAgents(): AgentCallStatus[] {
    return Array.from(this.agents.values())
      .sort((a, b) => {
        // Sort: calling > online > offline
        if (a.status === 'calling' && b.status !== 'calling') return -1;
        if (a.status !== 'calling' && b.status === 'calling') return 1;
        if (a.status === 'online' && b.status === 'offline') return -1;
        if (a.status === 'offline' && b.status === 'online') return 1;
        return b.lastActivity.getTime() - a.lastActivity.getTime();
      });
  }

  /**
   * Get dashboard stats
   */
  getStats() {
    const agents = Array.from(this.agents.values());
    const onlineAgents = agents.filter(a => a.status === 'online');
    const callingAgents = agents.filter(a => a.status === 'calling');
    
    const totalCalls = agents.reduce((sum, a) => sum + a.todayStats.totalCalls, 0);
    const inboundCalls = agents.reduce((sum, a) => sum + a.todayStats.inboundCalls, 0);
    const outboundCalls = agents.reduce((sum, a) => sum + a.todayStats.outboundCalls, 0);
    const totalCallTime = agents.reduce((sum, a) => sum + a.todayStats.totalCallTime, 0);
    
    const avgCallTime = totalCalls > 0 ? totalCallTime / totalCalls : 0;
    const avgMins = Math.floor(avgCallTime / 60);
    const avgSecs = Math.floor(avgCallTime % 60);

    return {
      totalAgents: agents.length,
      onlineAgents: onlineAgents.length + callingAgents.length,
      callingAgents: callingAgents.length,
      totalCalls,
      inboundCalls,
      outboundCalls,
      avgCallTime: `${avgMins}:${avgSecs.toString().padStart(2, '0')}`,
      avgUtilization: 0 // TODO: Calculate based on available time
    };
  }
}

// Export singleton
export const taalkVDPPoller = new TaalkVDPPoller();

