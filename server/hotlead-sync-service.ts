import { supabase } from './supabase';
import { getRankTierForEmail, getRankOrder, type ProductionRank } from './production-rank-service';

interface TaalkHotlead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  callDate: string;
  callTime: string;
  durationSeconds: number;
  hotLeadReason: string;
  priorityScore?: number;
  transferred: boolean;
  transferDurationMs?: number;
  transferStatus?: string;
  taalkCallId: string;
  taalkMarket?: string;
  taalkLeadSource?: string;
  taalkGroupCode?: string;
  taalkLeadId?: string;
  persona?: string;
  recordingUrl?: string;
  taalkState?: string;
  taalkCity?: string;
  taalkEmail?: string;
  taalkAddress?: string;
  taalkBeneficiary?: string;
  taalkRelationship?: string;
  taalkReffered?: string;
  taalkSponsorOrg?: string;
  taalkGroupname?: string;
}

interface TaalkApiResponse {
  success: boolean;
  data?: TaalkHotlead[];
  error?: string;
  pagination?: {
    page: number;
    totalPages: number;
    totalRecords: number;
  };
}

const TOTAL_ASSIGNED_LEAD_CAP = 300;

class HotleadSyncService {
  private readonly taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
  private readonly taalkBaseUrl = "https://api.taalk.ai/api";
  private readonly dbParam = "michaelmandella";
  private syncInProgress = false;

  private async fetchCallSummary(callId: string): Promise<string | null> {
    if (!callId) return null;
    try {
      const url = `${this.taalkBaseUrl}/calls/${callId}/summary?db=${this.dbParam}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.taalkApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return null;
      const json: any = await response.json().catch(() => null);
      const raw = json?.payload?.summary ?? json?.summary ?? null;
      if (raw == null) return null;
      if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
      if (Array.isArray(raw) && raw.length > 0) return JSON.stringify(raw);
      if (typeof raw === "object" && Object.keys(raw).length > 0) return JSON.stringify(raw);
      return null;
    } catch {
      return null;
    }
  }

  // REMOVED: All test/mock data creation functions eliminated per project requirements

  // Database sync - work with existing hotleads instead of API
  async fetchHotleadsFromTaalk(limit = 200, offset = 0, dateRange = 'all'): Promise<TaalkApiResponse> {
    console.log(`🔥 Working with existing hotlead database (no API sync needed)`);
    return { success: true, data: [], error: 'Using database hotleads instead of API' };
    
    try {
      console.log(`🔥 Fetching ALL Taalk API calls (limit: ${limit}, offset: ${offset}, range: ${dateRange})`);
      
      // API request with timezone and ALL historical data
      const apiUrl = new URL(`${this.taalkBaseUrl}/calls`);
      apiUrl.searchParams.append('db', this.dbParam);
      apiUrl.searchParams.append('limit', limit.toString());
      apiUrl.searchParams.append('offset', offset.toString());
      apiUrl.searchParams.append('tz', 'America/New_York'); // Required timezone
      if (dateRange !== 'all') {
        apiUrl.searchParams.append('date_range', dateRange); // Only add date filter if not 'all'
      }
      
      console.log(`🌐 Making API request to: ${apiUrl.toString()}`);
      
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.taalkApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log(`📡 Response preview: ${responseText.substring(0, 200)}...`);

      if (!response.ok) {
        console.error(`❌ Taalk API error ${response.status}: ${responseText}`);
        return { 
          success: false, 
          error: `API returned ${response.status}: ${responseText}` 
        };
      }

      // Try to parse as JSON
      let apiData;
      try {
        apiData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Response is not valid JSON:', parseError);
        return { 
          success: false, 
          error: `Response is not JSON: ${responseText.substring(0, 100)}...` 
        };
      }

      console.log(`📞 API response structure:`, Object.keys(apiData));
      console.log(`📞 Taalk API response: ${apiData.payload?.length || 0} calls received`);
      
      // Filter calls to identify hotleads based on our criteria
      const hotleads = this.filterHotleadCalls(apiData.payload || []);
      console.log(`🔥 Identified ${hotleads.length} hotleads from ${apiData.payload?.length || 0} calls`);
      
      return {
        success: true,
        data: hotleads,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil((apiData.total || hotleads.length) / limit),
          totalRecords: apiData.total || hotleads.length
        }
      };
      
    } catch (error) {
      console.error('❌ Network error:', error);
      return { 
        success: false, 
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Filter Taalk calls to identify hotleads based on strict criteria
  private filterHotleadCalls(calls: any[]): TaalkHotlead[] {
    const hotleads: TaalkHotlead[] = [];
    
    console.log(`🔍 Filtering ${calls.length} calls for hotlead criteria...`);
    
    for (const call of calls) {
      // STRICT CRITERIA for hotleads only:
      // 1. Human answered (duration > 30 seconds) AND
      // 2. (Transfer attempted OR Transfer lost quickly OR Human answered but no transfer completion)
      
      const duration = call.duration || call.durationSeconds || 0;
      const hasTransfer = call.transferred || call.transferStatus || call.transfer_status;
      const humanAnswered = duration > 30; // Likely human answer if >30 seconds
      const transferLost = hasTransfer && duration < 120; // Transfer attempted but lost quickly
      const transferCompleted = hasTransfer && call.transferStatus === 'completed';
      const humanNoTransfer = humanAnswered && !hasTransfer;
      
      // Only qualify as hotlead if it meets our specific criteria
      const isHotlead = humanAnswered && (transferLost || humanNoTransfer || (hasTransfer && !transferCompleted));
      
      if (isHotlead) {
        console.log(`🔥 Hotlead found: ${call.contact?.firstName || call.name} - Duration: ${duration}s, Transfer: ${!!hasTransfer}`);
        
        // Exclude calls that are already fully handled
        if (call.status === 'completed' && call.transferStatus === 'completed') {
          console.log(`⏭️ Skipping completed transfer: ${call.contact?.firstName || call.name}`);
          continue;
        }
        let hotLeadReason = '';
        if (transferLost) {
          hotLeadReason = 'Transfer Lost Quickly';
        } else if (humanAnswered && !hasTransfer) {
          hotLeadReason = 'Human Answered - No Transfer';
        } else if (hasTransfer) {
          hotLeadReason = 'Transfer Completed';
        }
        
        // Convert Taalk call to hotlead format - CAPTURE ALL AVAILABLE DATA
        console.log(`🔍 Full call data for ${call.name}:`, JSON.stringify(call, null, 2));
        console.log(`🔍 DEBUG PARAMS:`, call.params);
        console.log(`🔍 DEBUG STATE EXTRACTION:`, {
          'call.state': call.state,
          'call.contact?.state': call.contact?.state,
          'call.lead?.state': call.lead?.state,
          'call.params?.Taalk_State': call.params?.Taalk_State,
          'call.params?.Taalk_City': call.params?.Taalk_City,
          'call.params?.Taalk_Market': call.params?.Taalk_Market
        });
        
        // Extract rich conversation data
        const conversationSummary = call.messages ? 
          call.messages.map(m => `${m.role}: ${m.content}`).join(' | ') : '';
        const leadEmail = call.email || call.contact?.email || call.lead?.email || call.params?.Taalk_Email || call.params?.email || null;
        const leadCity = call.city || call.contact?.city || call.lead?.city || call.params?.Taalk_City || null;
        const leadState = call.state || call.contact?.state || call.lead?.state || call.params?.Taalk_State || null;
        
        const hotlead: TaalkHotlead = {
          id: call._id || call.id || call.phone?.replace(/\D/g, '') || `taalk_${call.phone || Date.now()}`,
          firstName: call.contact?.firstName || call.firstName || call.params?.firstName || call.name?.split(' ')[0] || call.name || 'Unknown',
          lastName: call.contact?.lastName || call.lastName || call.params?.lastName || call.name?.split(' ').slice(1).join(' ') || 'Unknown',
          phone: call.phone || call.contact?.phone || call.phoneNumber || '',
          email: call.contact?.email || call.email || null,
          city: call.contact?.city || call.city || null,
          state: call.contact?.state || call.state || null,
          zip: call.contact?.zip || call.zipCode || null,
          callDate: new Date(call.createdAt || call.startTime || Date.now()).toISOString(),
          callTime: new Date(call.createdAt || call.startTime || Date.now()).toTimeString().split(' ')[0],
          durationSeconds: duration,
          hotLeadReason,
          priorityScore: transferLost ? 8 : humanAnswered ? 6 : 4,
          transferred: !!hasTransfer,
          transferDurationMs: call.transferDuration || null,
          transferStatus: call.transferStatus || call.transfer_status || null,
          taalkCallId: call._id || call.id,
          
          // Enhanced mapping from actual API response structure with ALL available data
          taalkMarket: call.campaign?.name || call.campaignName || call.market || call.params?.Taalk_Market || 'Hot Lead',
          taalkLeadSource: call.source || call.leadSource || call.params?.Taalk_Lead_Source || 'Taalk Campaign',
          taalkGroupCode: call.groupCode || call.group_code || call.companyId || call.params?.Taalk_GroupCode || null,
          taalkLeadId: call.leadId || call.lead_id || call._id,
          persona: call.persona || call.triggerName || null,
          recordingUrl: call.recordingUrl || call.recording_url || null,
          
          // Contact/Lead specific data with enhanced extraction
          taalkState: leadState,
          taalkCity: leadCity,
          taalkEmail: leadEmail,
          taalkAddress: call.contact?.address || call.address || call.lead?.address || null,
          
          // Insurance/Lead specific fields from API with conversation context
          taalkBeneficiary: call.beneficiary || call.contact?.beneficiary || call.lead?.beneficiary || null,
          taalkRelationship: call.relationship || call.contact?.relationship || call.lead?.relationship || null,
          taalkReffered: call.referredBy || call.referred_by || call.contact?.referredBy || null,
          taalkSponsorOrg: call.sponsorOrg || call.sponsor_org || call.contact?.sponsorOrg || call.companyId || null,
          taalkGroupname: call.campaign?.name || call.groupName || call.group_name || call.campaignName || 'Hot Lead',
          
          // Rich performance and conversation data
          conversationData: conversationSummary ? conversationSummary.substring(0, 500) : null,
          callPerformance: `Duration: ${duration}s, Transfer: ${call.transferType || 0}, AI Error: ${call.AIError || 0}`,
          systemPrompt: call.system ? call.system.substring(0, 200) + '...' : null
          
          // Store additional fields in taalk_lead_source for now since schema is restricted
          // Will be enhanced once additional columns are available
        };
        
        hotleads.push(hotlead);
      }
    }
    
    return hotleads;
  }

  // Insert or update hotlead in Supabase - ENABLED for continuous lead flow
  async upsertHotlead(hotlead: TaalkHotlead): Promise<boolean> {
    console.log(`🔥 Processing hotlead: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
    
    
    try {
      // Use ONLY actual columns that exist in Supabase hotleads table based on JSON data
      const hotleadData = {
        first_name: hotlead.firstName || 'Unknown',
        last_name: hotlead.lastName || 'Unknown',
        phone: hotlead.phone,
        email: hotlead.email,
        type: null,
        status: 'new',
        notes: `${hotlead.hotLeadReason || 'Human Answered'} - Duration: ${hotlead.durationSeconds}s - ${hotlead.taalkMarket || 'Hot Lead'}`,
        taalk_market: hotlead.taalkMarket || 'Globe Market',
        taalk_state: hotlead.taalkState,
        taalk_city: hotlead.taalkCity,
        taalk_email: hotlead.taalkEmail,
        taalk_address: hotlead.taalkAddress,
        taalk_beneficiary: hotlead.taalkBeneficiary,
        taalk_relationship: hotlead.taalkRelationship,
        taalk_reffered: hotlead.taalkReffered,
        taalk_sponsor_org: hotlead.taalkSponsorOrg,
        taalk_group_code: hotlead.taalkGroupCode,
        taalk_groupname: hotlead.taalkGroupname,
        taalk_lead_id: hotlead.taalkLeadId,
        taalk_lead_source: hotlead.taalkLeadSource || 'Taalk AI Call',
        cnresolution: 'pending',
        priority_score: hotlead.priorityScore || 10
      };

      // Use ONLY Supabase client - NEVER PostgreSQL
      if (!supabase) {
        console.error('❌ Supabase client not available');
        return false;
      }

      // Check if this hotlead already exists by taalk_call_id
      const { data: existing } = await supabase
        .from('hotleads')
        .select('id')
        .eq('taalk_call_id', hotlead.taalkCallId)
        .single();

      if (existing) {
        // Already exists, skip insertion
        return true;
      }

      // Insert new hotlead using ONLY Supabase
      const { error: insertError } = await supabase
        .from('hotleads')
        .insert([hotleadData]);

      if (insertError) {
        console.error('❌ Supabase error inserting hotlead:', insertError);
        return false;
      }

      console.log(`✅ Inserted hotlead: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
      return true;
    } catch (error) {
      console.error('❌ Error in upsertHotlead:', error);
      return false;
    }
  }

  // Database management - redistribute existing hotleads
  async syncHotleads(dateRange = 'all'): Promise<{ success: boolean; newCount: number; updateCount: number; error?: string }> {
    console.log(`🔥 Managing existing hotlead database assignments`);
    this.syncInProgress = true;
    
    // Skip API sync, just manage existing database hotleads
    console.log('📊 Managing existing hotlead assignments in database');
    
    try {
      // Just run assignment logic on existing hotleads
      await this.assignHotleads();
      console.log('✅ Hotlead assignment management completed');
      return { success: true, newCount: 0, updateCount: 0 };
    } catch (error) {
      console.error('❌ Error in hotlead assignment management:', error);
      return { 
        success: false, 
        newCount: 0, 
        updateCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.syncInProgress = false;
    }
    
    try {
      let totalNew = 0;
      let totalUpdated = 0;
      let offset = 0;
      const limit = 200; // Larger batches for historical sync
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore && totalProcessed < 5000) { // Safety limit
        const result = await this.fetchHotleadsFromTaalk(limit, offset, dateRange);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch hotleads');
        }

        const hotleads = result.data || [];
        if (hotleads.length === 0) {
          hasMore = false;
          break;
        }

        // Process each hotlead with direct Supabase insert
        for (const hotlead of hotleads) {
          if (!supabase) {
            console.warn('⚠️ Supabase client not available - skipping hotlead processing');
            continue;
          }
          
          try {
            // Complete Supabase hotleads data structure with all taalk_ fields
            const insertData = {
              first_name: hotlead.firstName || 'Unknown',
              last_name: hotlead.lastName || 'Unknown', 
              phone: hotlead.phone,
              email: hotlead.email || hotlead.taalkEmail || null,
              type: null, // Will be determined by business logic later
              status: 'NEW',
              cnresolution: 'pending', // CORRECTED: Use cnresolution instead of hot_lead_reason
              notes: `${hotlead.hotLeadReason || 'Human Answered'} - Duration: ${hotlead.durationSeconds}s - ${hotlead.taalkMarket || 'Hot Lead'}`,
              // All taalk_ prefixed fields from API data
              taalk_market: hotlead.taalkMarket || null,
              taalk_state: hotlead.taalkState || hotlead.state || null,
              taalk_city: hotlead.taalkCity || hotlead.city || null,
              taalk_email: hotlead.taalkEmail || hotlead.email || null,
              taalk_address: hotlead.taalkAddress || null,
              taalk_beneficiary: hotlead.taalkBeneficiary || null,
              taalk_relationship: hotlead.taalkRelationship || null,
              taalk_reffered: hotlead.taalkReffered || null,
              taalk_sponsor_org: hotlead.taalkSponsorOrg || null,
              taalk_group_code: hotlead.taalkGroupCode || null,
              taalk_groupname: hotlead.taalkGroupname || null,
              taalk_lead_id: hotlead.taalkLeadId || hotlead.taalkCallId || null,
              taalk_lead_source: hotlead.taalkLeadSource || null,
              priority_score: hotlead.priorityScore || 10
            };

            // Check if exists by taalk_call_id (more reliable identifier)
            const { data: existing } = await supabase
              .from('hotleads')
              .select('id')
              .eq('taalk_lead_id', hotlead.taalkLeadId || hotlead.taalkCallId)
              .maybeSingle();

            if (existing) {
              console.log(`⏭️ Hotlead already exists: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
              continue;
            }

            // Insert new hotlead
            const { error: insertError } = await supabase
              .from('hotleads')
              .insert([insertData]);

            if (insertError) {
              console.error(`❌ Failed to insert ${hotlead.firstName}:`, insertError);
            } else {
              console.log(`✅ Inserted hotlead: ${hotlead.firstName} ${hotlead.lastName} (${hotlead.phone})`);
              totalNew++;
            }
          } catch (hotleadError) {
            console.error(`❌ Error processing hotlead ${hotlead.firstName}:`, hotleadError);
          }
        }

        // Check if we have more pages
        if (result.pagination && result.pagination.page < result.pagination.totalPages) {
          offset += limit;
        } else {
          hasMore = false;
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`🎉 Hotlead sync completed: ${totalNew} new, ${totalUpdated} updated`);
      return { success: true, newCount: totalNew, updateCount: totalUpdated };

    } catch (error) {
      console.error('❌ Error during hotlead sync:', error);
      return { 
        success: false, 
        newCount: 0, 
        updateCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Auto-assign hotleads to agents based on availability and territory
  async assignHotleads(): Promise<void> {
    try {
      console.log('🎯 Starting hotlead assignment process...');

      if (!supabase) {
        console.warn('⚠️ Supabase client not available - skipping hotlead assignment');
        return;
      }

      // Get existing unassigned hotleads - ONLY pending status, prioritize uncontacted first
      // CRITICAL: Exclude TaalkResolve=true leads (frozen leads)
      const { data: unassignedHotleads, error: hotleadsError } = await supabase
        .from('masterlead')
        .select('*')
        .eq('is_hot_lead', true)
        .or('TaalkResolve.is.null,TaalkResolve.eq.false')  // Exclude TaalkResolve=true leads (frozen)
        .or('cn_email.is.null,cn_email.eq.""')
        .or('last_contacted.is.null,cnresolution.eq.pending')
        .order('last_contacted', { ascending: true, nullsFirst: true }) // Uncontacted first
        .order('priority_score', { ascending: false })
        .limit(50); // More hotleads for better matching

      if (hotleadsError || !unassignedHotleads?.length) {
        console.log('No unassigned hotleads found for assignment');
        return;
      }

      console.log(`🔥 Found ${unassignedHotleads.length} unassigned hotleads to assign`);

      // Get available agents with their authorized markets and states
      // CRITICAL: Only assign to agents who completed 55+ second calls in last 5 minutes
      const { data: allAvailableAgents, error: agentsError } = await supabase
        .from('agent_profiles')
        .select('email, first_name, last_name, license_states, authorized_markets, max_hotleads, current_hotlead_count')
        .eq('is_active', true)
        .not('email', 'is', null);

      if (agentsError || !allAvailableAgents?.length) {
        console.log('No available agents found for hotlead assignment');
        return;
      }

      // Filter to only agents who completed calls >= 55 seconds in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const availableAgents: any[] = [];
      for (const agent of allAvailableAgents) {
        // Check if agent has any completed calls >= 55 seconds in agent_dial_metrics
        const { data: recentCalls } = await supabase
          .from('agent_dial_metrics')
          .select('call_duration, event_timestamp')
          .eq('agent_email', agent.email)
          .eq('event_type', 'dial')
          .gte('event_timestamp', fiveMinutesAgo.toISOString())
          .gte('call_duration', 55)
          .limit(1);
        
        if (recentCalls && recentCalls.length > 0) {
          availableAgents.push(agent);
        }
      }

      if (availableAgents.length === 0) {
        console.log(`⚠️ No agents with 55+ second calls in last 5 minutes (found ${allAvailableAgents.length} available agents, but none completed 55s calls)`);
        return;
      }

      console.log(`👥 Found ${availableAgents.length} agents with 55+ second calls (out of ${allAvailableAgents.length} total available agents)`);

      // Production rank: higher rank = higher priority for AO Queue leads
      const agentRanks = new Map<string, ProductionRank>();
      await Promise.all(availableAgents.map(async (agent) => {
        const rank = await getRankTierForEmail(agent.email);
        agentRanks.set(agent.email, rank);
      }));

      // Sort by rank (Platinum first), then by current_hotlead_count (fewest first)
      availableAgents.sort((a, b) => {
        const orderA = getRankOrder(agentRanks.get(a.email) ?? 'bronze');
        const orderB = getRankOrder(agentRanks.get(b.email) ?? 'bronze');
        if (orderB !== orderA) return orderB - orderA;
        return (a.current_hotlead_count ?? 0) - (b.current_hotlead_count ?? 0);
      });

      // Assign existing hotleads to agents based on market/state requirements
      let assignmentCount = 0;
      for (const hotlead of unassignedHotleads) {
        let assignedAgent = null;

        // Find agent that matches market and state requirements (order = rank priority)
        for (const agent of availableAgents) {
          // Check if agent is at capacity (using max_hotleads from agent_profiles)
          if (agent.current_hotlead_count >= agent.max_hotleads) continue;
          
          // CRITICAL: Also check total assigned leads (not just hotlead count) - enforce lead cap
          const { count: totalAssigned } = await supabase
            .from('masterlead')
            .select('*', { count: 'exact', head: true })
            .eq('cn_email', agent.email)
            .eq('dnc', false)
            .not('taalk_market', 'in', '(Plus Lead,Plus Leads,plus lead,plus leads)');
          
          if ((totalAssigned || 0) >= TOTAL_ASSIGNED_LEAD_CAP) {
            console.log(`   ⏭️ Skipping ${agent.email} - already has ${totalAssigned} assigned leads (>= ${TOTAL_ASSIGNED_LEAD_CAP})`);
            continue;
          }

          // Check if agent is authorized for this state
          const licenseStates = agent.license_states || [];
          if (!licenseStates.includes(hotlead.taalk_state)) continue;

          // Check if agent is authorized for this market
          const authorizedMarkets = agent.authorized_markets || [];
          if (!authorizedMarkets.includes(hotlead.taalk_market)) continue;

          assignedAgent = agent;
          break;
        }

        if (!assignedAgent) continue;

        if (!supabase) continue;

        // Assign hotlead to qualified agent
        const { error: updateError } = await supabase
          .from('masterlead')
          .update({
            cn_email: assignedAgent.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', hotlead.id);

        if (!updateError) {
          assignmentCount++;
          console.log(`🔥 Assigned hotlead ${hotlead.first_name} ${hotlead.last_name} (${hotlead.taalk_state}/${hotlead.taalk_market}) to ${assignedAgent.email}`);
        }
      }

      console.log(`🎯 Completed hotlead assignment: ${assignmentCount} existing hotleads assigned`);
    } catch (error) {
      console.error('❌ Error in hotlead assignment:', error);
    }
  }

  // Poll Taalk API for AO Recruit market transfer-lost hotleads and upsert to masterlead
  async syncAoRecruitHotleads(): Promise<{ success: boolean; newCount: number; error?: string }> {
    console.log("🎯 Polling Taalk for AO Recruit transfer-failed calls with AI summaries...");

    try {
      const apiUrl = new URL(`${this.taalkBaseUrl}/calls`);
      apiUrl.searchParams.append('db', this.dbParam);
      apiUrl.searchParams.append('limit', '200');
      apiUrl.searchParams.append('tz', 'America/New_York');
      apiUrl.searchParams.append('date_range', 'today');

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.taalkApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Taalk API error ${response.status}: ${errText}`);
        return { success: false, newCount: 0, error: `API ${response.status}: ${errText}` };
      }

      let apiData: any;
      try {
        apiData = await response.json();
      } catch (e) {
        return { success: false, newCount: 0, error: 'Response is not valid JSON' };
      }

      const allCalls: any[] = apiData.payload || apiData.data || apiData.calls || [];
      console.log(`📞 Taalk returned ${allCalls.length} total calls for today`);

      // Filter to AO Recruit / RMS market calls only
      const recruitCalls = allCalls.filter((call: any) => {
        const campaignName = (call.campaign?.name || call.campaignName || '').toLowerCase();
        const market = (call.params?.Taalk_Market || '').toLowerCase();
        return campaignName.includes('recruit') || campaignName.includes('rms')
          || market.includes('recruit') || market.includes('rms');
      });
      console.log(`🎯 Found ${recruitCalls.length} AO Recruit/RMS calls`);

      // Required criteria:
      // 1) Transfer attempted.
      // 2) Transfer did NOT connect (status not picked/completed).
      // 3) AI summary exists for the call.
      const candidateCalls = recruitCalls.filter((call: any) => {
        const hasTransfer = call.transferred === true || String(call.transferred || "").toLowerCase() === "yes" || !!(call.transferStatus || call.transfer_status);
        if (!hasTransfer) return false;
        const transferStatus = String(call.transferStatus || call.transfer_status || "").toLowerCase();
        const transferConnected = transferStatus === "picked" || transferStatus === "completed";
        return !transferConnected;
      });
      console.log(`🔥 ${candidateCalls.length} AO Recruit transfer-failed call(s) identified before summary check`);

      if (!supabase) {
        console.error('❌ Supabase client not available');
        return { success: false, newCount: 0, error: 'Supabase client not available' };
      }

      let newCount = 0;
      let missingSummaryCount = 0;
      for (const call of candidateCalls) {
        const taalkLeadId = call.leadId || call.lead_id || call._id;
        if (!taalkLeadId) {
          console.warn('⚠️ Skipping call with no lead ID:', call);
          continue;
        }

        const callId = String(call._id || call.id || taalkLeadId || "").trim();
        const aiSummary = await this.fetchCallSummary(callId);
        if (!aiSummary) {
          missingSummaryCount++;
          continue;
        }

        const firstName = call.contact?.firstName || call.firstName || call.params?.firstName || call.name?.split(' ')[0] || 'Unknown';
        const lastName = call.contact?.lastName || call.lastName || call.params?.lastName || call.name?.split(' ').slice(1).join(' ') || 'Unknown';
        const phone = call.phone || call.contact?.phone || call.phoneNumber || '';
        const state = call.state || call.contact?.state || call.lead?.state || call.params?.Taalk_State || null;
        const market = call.campaign?.name || call.campaignName || call.params?.Taalk_Market || 'aorecruit';

        const upsertData = {
          first_name: firstName,
          last_name: lastName,
          phone,
          email: call.contact?.email || call.email || call.params?.Taalk_Email || null,
          city: call.contact?.city || call.city || call.params?.Taalk_City || null,
          state,
          zip: call.contact?.zip || call.zipCode || null,
          market: 'aorecruit',
          cnresolution: 'pending',
          dnc: false,
          updated_at: new Date().toISOString(),
        };

        const cleanPhone = String(phone || "").replace(/\D/g, "");
        const phoneMatch = cleanPhone ? cleanPhone.slice(-10) : "";
        let upsertError: any = null;

        const { data: existingRecruitLead, error: existingError } = await supabase
          .from("masterleadrecruit")
          .select("id, phone")
          .eq("phone", phone)
          .limit(1)
          .maybeSingle();

        if (!existingError && existingRecruitLead?.id) {
          const { error } = await supabase
            .from("masterleadrecruit")
            .update(upsertData)
            .eq("id", existingRecruitLead.id);
          upsertError = error;
        } else if (phoneMatch) {
          const { data: fuzzyMatch, error: fuzzyError } = await supabase
            .from("masterleadrecruit")
            .select("id, phone")
            .ilike("phone", `%${phoneMatch}%`)
            .limit(1)
            .maybeSingle();

          if (!fuzzyError && fuzzyMatch?.id) {
            const { error } = await supabase
              .from("masterleadrecruit")
              .update(upsertData)
              .eq("id", fuzzyMatch.id);
            upsertError = error;
          } else {
            const { error } = await supabase
              .from("masterleadrecruit")
              .insert([upsertData]);
            upsertError = error;
          }
        } else {
          const { error } = await supabase
            .from("masterleadrecruit")
            .insert([upsertData]);
          upsertError = error;
        }

        if (upsertError) {
          console.error(`❌ Upsert failed for ${firstName} ${lastName}:`, upsertError);
        } else {
          newCount++;
          console.log(`✅ Upserted AO Recruit hotlead: ${firstName} ${lastName} (${phone})`);
        }
      }

      console.log(
        `🎯 AO Recruit sync complete: ${newCount} lead(s) upserted, ${missingSummaryCount} skipped (no AI summary)`,
      );
      return { success: true, newCount };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ syncAoRecruitHotleads error:', msg);
      return { success: false, newCount: 0, error: msg };
    }
  }

  // Get sync status
  getSyncStatus(): { inProgress: boolean } {
    return { inProgress: this.syncInProgress };
  }
}

export const hotleadSyncService = new HotleadSyncService();