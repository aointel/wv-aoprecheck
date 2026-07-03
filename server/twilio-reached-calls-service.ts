/**
 * Twilio Reached Calls Service
 * Pulls "reached" Twilio calls (outbound only)
 * Inbound = Taalk transfers (handled by call-analytics-scheduler)
 * Outbound = Twilio calls from twilio_call_logs
 */

import { supabaseAdmin } from './supabase';

export interface ReachedCall {
  twilio_call_sid: string;
  call_direction: 'outbound'; // Only outbound for Twilio calls
  from_number: string | null;
  to_number: string | null;
  call_status: string;
  call_duration: number;
  owner_email: string | null;
  agent_identity: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  parent_call_sid: string | null;
  call_source: string | null;
  metadata: any;
}

export class TwilioReachedCallsService {
  /**
   * Get all reached outbound Twilio calls (answered/completed with duration >= 50s)
   * Note: Inbound calls are Taalk transfers, handled separately by call-analytics-scheduler
   */
  static async getReachedCalls(
    startDate?: Date,
    endDate?: Date,
    agentEmail?: string
  ): Promise<{
    outbound: ReachedCall[];
    stats: {
      total_outbound: number;
    };
  }> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }

    // Default to last 7 days if no date range provided
    const dateStart = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateEnd = endDate || new Date();

    console.log(`🔍 Fetching reached calls from ${dateStart.toISOString()} to ${dateEnd.toISOString()}`);

    // Build query for reached OUTBOUND calls only
    // Reached = duration >= 50 seconds AND status IN ('answered', 'completed') AND direction = 'outbound'
    let query = supabaseAdmin
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', dateStart.toISOString())
      .lt('call_started_at', dateEnd.toISOString())
      .eq('call_direction', 'outbound')
      .gte('call_duration', 50)
      .in('call_status', ['answered', 'completed']);

    // Filter by agent if provided
    if (agentEmail) {
      query = query.eq('owner_email', agentEmail);
    }

    const { data: allReachedCalls, error } = await query;

    if (error) {
      console.error('❌ Error fetching reached calls:', error);
      throw new Error(`Failed to fetch reached calls: ${error.message}`);
    }

    if (!allReachedCalls || allReachedCalls.length === 0) {
      console.log('📊 No reached outbound calls found');
      return {
        outbound: [],
        stats: {
          total_outbound: 0
        }
      };
    }

    console.log(`📊 Found ${allReachedCalls.length} reached outbound calls`);

    // Process all outbound calls
    const outboundCalls: ReachedCall[] = allReachedCalls.map(call => ({
      twilio_call_sid: call.twilio_call_sid,
      call_direction: 'outbound' as const,
      from_number: call.from_number,
      to_number: call.to_number,
      call_status: call.call_status,
      call_duration: call.call_duration || 0,
      owner_email: call.owner_email,
      agent_identity: call.agent_identity,
      call_started_at: call.call_started_at,
      call_ended_at: call.call_ended_at,
      parent_call_sid: call.parent_call_sid,
      call_source: call.call_source,
      metadata: typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata || {}
    }));

    return {
      outbound: outboundCalls,
      stats: {
        total_outbound: outboundCalls.length
      }
    };
  }

  /**
   * Get reached outbound calls for a specific agent
   */
  static async getAgentReachedCalls(
    agentEmail: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    outbound: ReachedCall[];
    stats: {
      total_outbound: number;
    };
  }> {
    return this.getReachedCalls(startDate, endDate, agentEmail);
  }

  /**
   * Get all reached outbound calls with pagination
   */
  static async getReachedCallsPaginated(
    page: number = 1,
    limit: number = 100,
    startDate?: Date,
    endDate?: Date,
    agentEmail?: string
  ): Promise<{
    calls: ReachedCall[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const allCalls = await this.getReachedCalls(startDate, endDate, agentEmail);

    // Sort by call_started_at descending (most recent first)
    const sortedCalls = [...allCalls.outbound].sort((a, b) => {
      const dateA = a.call_started_at ? new Date(a.call_started_at).getTime() : 0;
      const dateB = b.call_started_at ? new Date(b.call_started_at).getTime() : 0;
      return dateB - dateA;
    });

    // Paginate
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedCalls = sortedCalls.slice(startIdx, endIdx);

    return {
      calls: paginatedCalls,
      pagination: {
        page,
        limit,
        total: sortedCalls.length,
        totalPages: Math.ceil(sortedCalls.length / limit)
      }
    };
  }
}
