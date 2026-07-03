/**
 * Agent Availability Tracker
 * Manages persistent tracking of agent availability in Supabase
 */

import { supabaseAdmin } from './supabase';

export interface AgentStatusUpdate {
  agentId: string;
  agentEmail: string;
  agentName: string;
  newStatus: 'online' | 'calling' | 'offline';
  trackingDate?: string; // YYYY-MM-DD format, defaults to today
}

export interface AgentDailySummary {
  agentId: string;
  agentEmail: string;
  agentName: string;
  trackingDate: string;
  currentStatus: string;
  totalAvailableTime: number;
  totalCallingTime: number;
  totalOfflineTime: number;
  formattedAvailableTime: string;
  formattedCallingTime: string;
  formattedOfflineTime: string;
}

class AgentAvailabilityTracker {
  private static instance: AgentAvailabilityTracker;
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): AgentAvailabilityTracker {
    if (!AgentAvailabilityTracker.instance) {
      AgentAvailabilityTracker.instance = new AgentAvailabilityTracker();
    }
    return AgentAvailabilityTracker.instance;
  }

  /**
   * Update agent status and track time
   */
  async updateAgentStatus(update: AgentStatusUpdate): Promise<void> {
    try {
      const trackingDate = update.trackingDate || new Date().toISOString().split('T')[0];
      const now = new Date();
      
      // console.log(`📊 Updating agent status: ${update.agentName} (${update.agentId}) -> ${update.newStatus}`);
      
      // Get or create tracking record
      let { data: existingRecord, error: fetchError } = await supabaseAdmin
        .from('agent_availability_tracking')
        .select('*')
        .eq('agent_id', update.agentId)
        .eq('tracking_date', trackingDate)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error fetching existing record:', fetchError);
        throw fetchError;
      }

      if (!existingRecord) {
        // Create new record
        const { data: newRecord, error: createError } = await supabaseAdmin
          .from('agent_availability_tracking')
          .insert({
            agent_id: update.agentId,
            agent_email: update.agentEmail,
            agent_name: update.agentName,
            tracking_date: trackingDate,
            current_status: update.newStatus,
            status_changed_at: now,
            last_activity: now,
            current_session_start: update.newStatus === 'online' ? now : null
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating new record:', createError);
          throw createError;
        }

        console.log(`✅ Created new tracking record for ${update.agentName}`);
        return;
      }

      // Update existing record
      // Calculate time spent in previous status
      const previousStatusTime = existingRecord.status_changed_at 
        ? Math.floor((now.getTime() - new Date(existingRecord.status_changed_at).getTime()) / 1000)
        : 0;
      
      // Add time to appropriate category based on PREVIOUS status (before this update)
      let updates: any = {
        current_status: update.newStatus,
        previous_status: existingRecord.current_status,
        status_changed_at: now,
        last_activity: now
      };

      // Accumulate time for the status the agent was in BEFORE this change
      if (existingRecord.current_status === 'online' && previousStatusTime > 0) {
        updates.total_available_time = (existingRecord.total_available_time || 0) + previousStatusTime;
        console.log(`📊 Accumulated ${previousStatusTime}s (${Math.round(previousStatusTime/60)}min) online time for ${update.agentEmail}`);
      } else if (existingRecord.current_status === 'calling' && previousStatusTime > 0) {
        updates.total_calling_time = (existingRecord.total_calling_time || 0) + previousStatusTime;
      } else if (existingRecord.current_status === 'offline' && previousStatusTime > 0) {
        updates.total_offline_time = (existingRecord.total_offline_time || 0) + previousStatusTime;
      }

      // If agent is coming online, start new session
      if (update.newStatus === 'online') {
        updates.current_session_start = now;
      } else {
        // Clear session start when going offline/calling
        updates.current_session_start = null;
      }

      const { error: updateError } = await supabaseAdmin
        .from('agent_availability_tracking')
        .update(updates)
        .eq('id', existingRecord.id);

      if (updateError) {
        console.error('❌ Error updating record:', updateError);
        throw updateError;
      }

      // Only log status changes for online/calling agents (not offline spam)
      if (update.newStatus !== 'offline') {
        console.log(`✅ Agent status updated: ${update.agentName} is now ${update.newStatus}`);
      }
    } catch (error) {
      console.error('❌ Failed to update agent status:', error);
      throw error;
    }
  }

  /**
   * Get daily summary for an agent
   */
  async getAgentDailySummary(agentId: string, trackingDate?: string): Promise<AgentDailySummary | null> {
    try {
      const date = trackingDate || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('agent_availability_tracking')
        .select('*')
        .eq('agent_id', agentId)
        .eq('tracking_date', date)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found - return null
          return null;
        }
        console.error('❌ Error getting agent daily summary:', error);
        return null;
      }

      return {
        agentId: data.agent_id,
        agentEmail: data.agent_email,
        agentName: data.agent_name,
        trackingDate: data.tracking_date,
        currentStatus: data.current_status,
        totalAvailableTime: data.total_available_time || 0,
        totalCallingTime: data.total_calling_time || 0,
        totalOfflineTime: data.total_offline_time || 0,
        formattedAvailableTime: this.formatTime(data.total_available_time || 0),
        formattedCallingTime: this.formatTime(data.total_calling_time || 0),
        formattedOfflineTime: this.formatTime(data.total_offline_time || 0)
      };
    } catch (error) {
      console.error('❌ Failed to get agent daily summary:', error);
      return null;
    }
  }

  /**
   * Get all agents' daily summaries for a specific date
   */
  async getAllAgentsDailySummary(trackingDate?: string): Promise<AgentDailySummary[]> {
    try {
      const date = trackingDate || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('agent_availability_tracking')
        .select(`
          agent_id,
          agent_email,
          agent_name,
          tracking_date,
          current_status,
          total_available_time,
          total_calling_time,
          total_offline_time
        `)
        .eq('tracking_date', date)
        .order('total_available_time', { ascending: false });

      if (error) {
        console.error('❌ Error getting all agents daily summary:', error);
        return [];
      }

      return data?.map(record => ({
        agentId: record.agent_id,
        agentEmail: record.agent_email,
        agentName: record.agent_name,
        trackingDate: record.tracking_date,
        currentStatus: record.current_status,
        totalAvailableTime: record.total_available_time,
        totalCallingTime: record.total_calling_time,
        totalOfflineTime: record.total_offline_time,
        formattedAvailableTime: this.formatTime(record.total_available_time),
        formattedCallingTime: this.formatTime(record.total_calling_time),
        formattedOfflineTime: this.formatTime(record.total_offline_time)
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get all agents daily summary:', error);
      return [];
    }
  }

  /**
   * Get daily usage for a date range (for viewing daily breakdown over time)
   */
  async getDailyUsageForDateRange(
    startDate: string, 
    endDate: string, 
    agentEmail?: string
  ): Promise<Array<AgentDailySummary & { date: string }>> {
    try {
      let query = supabaseAdmin
        .from('agent_availability_tracking')
        .select(`
          agent_id,
          agent_email,
          agent_name,
          tracking_date,
          current_status,
          total_available_time,
          total_calling_time,
          total_offline_time
        `)
        .gte('tracking_date', startDate)
        .lte('tracking_date', endDate)
        .order('tracking_date', { ascending: true })
        .order('total_available_time', { ascending: false });

      if (agentEmail) {
        query = query.eq('agent_email', agentEmail.toLowerCase());
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error getting daily usage for date range:', error);
        return [];
      }

      return data?.map(record => ({
        agentId: record.agent_id,
        agentEmail: record.agent_email,
        agentName: record.agent_name,
        trackingDate: record.tracking_date,
        date: record.tracking_date, // Alias for convenience
        currentStatus: record.current_status,
        totalAvailableTime: record.total_available_time || 0,
        totalCallingTime: record.total_calling_time || 0,
        totalOfflineTime: record.total_offline_time || 0,
        formattedAvailableTime: this.formatTime(record.total_available_time || 0),
        formattedCallingTime: this.formatTime(record.total_calling_time || 0),
        formattedOfflineTime: this.formatTime(record.total_offline_time || 0)
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get daily usage for date range:', error);
      return [];
    }
  }

  /**
   * Format seconds into HH:MM:SS format
   */
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Start the tracker with cleanup scheduling
   */
  start(): void {
    console.log('🚀 Starting Agent Availability Tracker...');
    
    // Schedule daily cleanup at 2 AM
    this.scheduleCleanup();
    
    console.log('✅ Agent Availability Tracker started');
  }

  /**
   * Schedule cleanup of old records
   */
  private scheduleCleanup(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2 AM tomorrow
    
    const msUntilCleanup = tomorrow.getTime() - now.getTime();
    
    setTimeout(async () => {
      await this.cleanupOldRecords();
      // Schedule next cleanup
      this.scheduleCleanup();
    }, msUntilCleanup);
    
    console.log(`🧹 Cleanup scheduled for ${tomorrow.toISOString()}`);
  }

  /**
   * Clean up old records (keep last 30 days)
   */
  async cleanupOldRecords(): Promise<void> {
    try {
      console.log('🧹 Cleaning up old availability records...');
      
      const { data, error } = await supabaseAdmin.rpc('cleanup_old_availability_records');
      
      if (error) {
        console.error('❌ Error cleaning up old records:', error);
        return;
      }
      
      console.log(`✅ Cleaned up ${data || 0} old availability records`);
    } catch (error) {
      console.error('❌ Failed to cleanup old records:', error);
    }
  }

  /**
   * Stop the tracker
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearTimeout(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('🛑 Agent Availability Tracker stopped');
  }
}

export const agentAvailabilityTracker = AgentAvailabilityTracker.getInstance();
