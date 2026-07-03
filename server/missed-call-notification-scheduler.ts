import { supabase } from './supabase';
import { sendMissedCallBillingEmail, sendLeadTransferNotification } from './email';

interface MissedCallRecord {
  id: string;
  agent_id: string;
  phone_number: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  lead_name?: string;
  notification_sent?: boolean;
  created_at: string;
}

interface AgentInfo {
  name: string;
  email: string;
  mga: string;
}

class MissedCallNotificationScheduler {
  private lastCheckTime: Date = new Date();
  private isRunning: boolean = false;

  constructor() {
    console.log('🔔 Missed Call Notification Scheduler initialized');
  }

  // Start the scheduler to run every 15 minutes
  start() {
    console.log('🔔 Starting missed call notification scheduler (every 15 minutes)');
    
    // Run immediately on start
    this.checkForNewMissedCalls();
    
    // Then run every 15 minutes
    setInterval(() => {
      this.checkForNewMissedCalls();
    }, 15 * 60 * 1000); // 15 minutes in milliseconds
  }

  // Main function to check for new missed calls and send notifications
  async checkForNewMissedCalls() {
    if (this.isRunning) {
      console.log('🔔 Notification check already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔔 Checking for new missed calls to notify...');

    try {
      // Get missed calls since last check that haven't been notified
      const newMissedCalls = await this.getNewMissedCalls();
      
      if (newMissedCalls.length === 0) {
        console.log('🔔 No new missed calls found');
        this.isRunning = false;
        return;
      }

      console.log(`🔔 Found ${newMissedCalls.length} new missed calls to process`);

      // Get agent information for all involved agents
      const agentIds = [...new Set(newMissedCalls.map(call => call.agent_id))];
      const agentInfo = await this.getAgentInformation(agentIds);

      // Send notification for each missed call
      for (const missedCall of newMissedCalls) {
        await this.sendMissedCallNotification(missedCall, agentInfo);
      }

      this.lastCheckTime = new Date();
      console.log(`✅ Processed ${newMissedCalls.length} missed call notifications`);

    } catch (error) {
      console.error('❌ Error checking for missed calls:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Query Supabase for new missed calls since last check
  private async getNewMissedCalls(): Promise<MissedCallRecord[]> {
    if (!supabase) {
      console.error('❌ Supabase not available for missed call notifications');
      return [];
    }

    try {
      // Query for missed calls from twilio_call_logs (column is call_status, not status)
      const { data, error } = await supabase
        .from('twilio_call_logs')
        .select('*')
        .eq('call_status', 'no-answer')
        .gte('created_at', this.lastCheckTime.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error querying missed calls:', error);
        return [];
      }

      return (data || []).map(record => ({
        id: record.id,
        agent_id: record.agent_id || record.associate_id,
        phone_number: record.to_number || record.phone_number,
        call_date: new Date(record.created_at).toLocaleDateString(),
        call_time: new Date(record.created_at).toLocaleTimeString(),
        duration_seconds: record.duration || 0,
        lead_name: record.lead_name,
        notification_sent: record.notification_sent,
        created_at: record.created_at
      }));

    } catch (error) {
      console.error('❌ Error fetching missed calls from Supabase:', error);
      return [];
    }
  }

  // Get agent information from customers table
  private async getAgentInformation(agentIds: string[]): Promise<Map<string, AgentInfo>> {
    const agentMap = new Map<string, AgentInfo>();

    if (!supabase || agentIds.length === 0) {
      return agentMap;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, company_email, mga')
        .in('associate_id', agentIds.map(id => parseInt(id)));

      if (error) {
        console.error('❌ Error fetching agent information:', error);
        return agentMap;
      }

      data?.forEach(agent => {
        if (agent.associate_id) {
          agentMap.set(agent.associate_id.toString(), {
            name: `${agent.first_name} ${agent.last_name}`,
            email: agent.company_email || 'unknown@example.com',
            mga: agent.mga || 'Unassigned MGA'
          });
        }
      });

      console.log(`📊 Found information for ${agentMap.size} agents`);
      return agentMap;

    } catch (error) {
      console.error('❌ Error fetching agent information:', error);
      return agentMap;
    }
  }

  // Send notification for individual missed call
  private async sendMissedCallNotification(missedCall: MissedCallRecord, agentInfo: Map<string, AgentInfo>) {
    const agent = agentInfo.get(missedCall.agent_id);
    
    if (!agent) {
      console.warn(`⚠️ No agent information found for ID: ${missedCall.agent_id}`);
      return;
    }

    try {
      console.log(`📧 Sending missed call notification to ${agent.name} (${agent.email}) for ${missedCall.phone_number}`);

      // Prepare notification data
      const notificationData = {
        agentName: agent.name,
        missedCallCount: 1, // Each notification is for one missed call
        billingAmount: 4.00, // $4.00 per missed call
        phone: missedCall.phone_number,
        leadName: missedCall.lead_name,
        date: `${missedCall.call_date} at ${missedCall.call_time}`
      };

      // Send email notification
      await sendMissedCallBillingEmail(agent.email, notificationData);

      // Send lead transfer notification
      await sendLeadTransferNotification(agent.email, {
        agentName: agent.name,
        phone: missedCall.phone_number,
        leadName: missedCall.lead_name,
        date: notificationData.date,
        reason: 'Missed Call - Automatic Transfer'
      });

      // Mark as notified in database
      await this.markAsNotified(missedCall.id);

      console.log(`✅ Notification sent successfully for missed call ${missedCall.id}`);

    } catch (error) {
      console.error(`❌ Error sending notification for missed call ${missedCall.id}:`, error);
    }
  }

  // Mark missed call as notified to prevent duplicates
  private async markAsNotified(missedCallId: string) {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('twilio_call_logs')
        .update({ notification_sent: true })
        .eq('id', missedCallId);

      if (error) {
        console.error('❌ Error marking call as notified:', error);
      }
    } catch (error) {
      console.error('❌ Error updating notification status:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualCheck() {
    console.log('🔔 Manual missed call notification check triggered');
    await this.checkForNewMissedCalls();
  }

  // Get status of scheduler
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      nextCheckIn: Math.max(0, Math.ceil((15 * 60 * 1000 - (Date.now() - this.lastCheckTime.getTime())) / 1000))
    };
  }
}

// Export singleton instance
export const missedCallNotificationScheduler = new MissedCallNotificationScheduler();