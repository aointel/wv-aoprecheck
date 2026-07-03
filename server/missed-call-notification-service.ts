import { supabase } from './supabase';
import { sendMissedCallBillingEmail, sendLeadTransferNotification } from './email';

interface MissedCallRecord {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  phone: string;
  lead_name?: string;
  date: string;
  time: string;
  credit_deduction: number;
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationResult {
  success: boolean;
  agent_id: string;
  phone: string;
  notifications_sent: string[];
  errors: string[];
}

export class MissedCallNotificationService {
  
  /**
   * Process all pending missed call notifications
   * This will be called every 15 minutes by the scheduler
   */
  static async processPendingNotifications(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: NotificationResult[];
  }> {
    try {
      console.log('🔔 Starting missed call notification processing...');
      
      // Get all missed calls that haven't had notifications sent yet
      const { data: pendingMissedCalls, error } = await supabase!
        .from('missed_call_notifications')
        .select('*')
        .eq('notification_sent', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pending missed call notifications:', error);
        throw error;
      }

      if (!pendingMissedCalls || pendingMissedCalls.length === 0) {
        console.log('✅ No pending missed call notifications to process');
        return {
          processed: 0,
          successful: 0,
          failed: 0,
          results: []
        };
      }

      console.log(`📋 Found ${pendingMissedCalls.length} pending missed call notifications`);

      const results: NotificationResult[] = [];
      let successful = 0;
      let failed = 0;

      // Process each missed call notification individually
      for (const missedCall of pendingMissedCalls) {
        const result = await this.sendNotificationForMissedCall(missedCall);
        results.push(result);
        
        if (result.success) {
          successful++;
          // Mark notification as sent in database
          await this.markNotificationSent(missedCall.id);
        } else {
          failed++;
        }
      }

      console.log(`✅ Notification processing complete: ${successful} successful, ${failed} failed`);

      return {
        processed: pendingMissedCalls.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('❌ Error in processPendingNotifications:', error);
      throw error;
    }
  }

  /**
   * Send all notification types for a single missed call
   */
  static async sendNotificationForMissedCall(missedCall: MissedCallRecord): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      agent_id: missedCall.agent_id,
      phone: missedCall.phone,
      notifications_sent: [],
      errors: []
    };

    try {
      console.log(`📞 Processing missed call notification for Agent ${missedCall.agent_id}, Phone ${missedCall.phone}`);

      // Prepare notification data
      const notificationData = {
        agentName: missedCall.agent_name,
        missedCallCount: 1, // Each record represents one missed call instance
        billingAmount: missedCall.credit_deduction,
        phone: missedCall.phone,
        leadName: missedCall.lead_name,
        date: new Date(missedCall.created_at).toLocaleDateString()
      };

      const leadTransferData = {
        agentName: missedCall.agent_name,
        phone: missedCall.phone,
        leadName: missedCall.lead_name,
        date: new Date(missedCall.created_at).toLocaleDateString(),
        reason: 'Missed call - automatic transfer to Planet intown box'
      };

      // Send Email Notification
      try {
        await sendMissedCallBillingEmail(missedCall.agent_email, notificationData);
        result.notifications_sent.push('email');
        console.log(`📧 Email notification sent to ${missedCall.agent_email}`);
      } catch (error) {
        const errorMsg = `Email notification failed: ${error.message}`;
        result.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // Send Lead Transfer Notification
      try {
        await sendLeadTransferNotification(missedCall.agent_email, leadTransferData);
        result.notifications_sent.push('lead_transfer_email');
        console.log(`📋 Lead transfer notification sent to ${missedCall.agent_email}`);
      } catch (error) {
        const errorMsg = `Lead transfer notification failed: ${error.message}`;
        result.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // TODO: Add SMS notification when SMS service is ready
      // TODO: Add in-system notification when notification system is ready

      result.success = result.notifications_sent.length > 0;
      
      if (result.success) {
        console.log(`✅ Missed call notification completed for Agent ${missedCall.agent_id}: ${result.notifications_sent.join(', ')}`);
      } else {
        console.error(`❌ All notifications failed for Agent ${missedCall.agent_id}: ${result.errors.join(', ')}`);
      }

      return result;

    } catch (error) {
      result.errors.push(`Unexpected error: ${error.message}`);
      console.error(`❌ Unexpected error processing missed call for Agent ${missedCall.agent_id}:`, error);
      return result;
    }
  }

  /**
   * Mark a missed call notification as sent in the database
   */
  static async markNotificationSent(missedCallId: string): Promise<void> {
    try {
      const { error } = await supabase!
        .from('missed_call_notifications')
        .update({ 
          notification_sent: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', missedCallId);

      if (error) {
        console.error(`❌ Error marking notification as sent for ID ${missedCallId}:`, error);
        throw error;
      }

      console.log(`✅ Marked notification as sent for missed call ID: ${missedCallId}`);
    } catch (error) {
      console.error(`❌ Failed to mark notification as sent for ID ${missedCallId}:`, error);
      throw error;
    }
  }

  /**
   * Create a missed call notification record in the database
   * This will be called when new missed calls are detected from CSV processing
   */
  static async createMissedCallNotification(missedCallData: {
    agent_id: string;
    agent_name: string;
    agent_email: string;
    phone: string;
    lead_name?: string;
    date: string;
    time: string;
    credit_deduction: number;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase!
        .from('missed_call_notifications')
        .insert({
          agent_id: missedCallData.agent_id,
          agent_name: missedCallData.agent_name,
          agent_email: missedCallData.agent_email,
          phone: missedCallData.phone,
          lead_name: missedCallData.lead_name,
          date: missedCallData.date,
          time: missedCallData.time,
          credit_deduction: missedCallData.credit_deduction,
          notification_sent: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error creating missed call notification record:', error);
        throw error;
      }

      console.log(`✅ Created missed call notification record: ${data.id}`);
      return data.id;

    } catch (error) {
      console.error('❌ Failed to create missed call notification record:', error);
      return null;
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(): Promise<{
    total_notifications: number;
    pending_notifications: number;
    sent_notifications: number;
    failed_notifications: number;
  }> {
    try {
      const { data: totalData, error: totalError } = await supabase!
        .from('missed_call_notifications')
        .select('id', { count: 'exact' });

      const { data: pendingData, error: pendingError } = await supabase!
        .from('missed_call_notifications')
        .select('id', { count: 'exact' })
        .eq('notification_sent', false);

      const { data: sentData, error: sentError } = await supabase!
        .from('missed_call_notifications')
        .select('id', { count: 'exact' })
        .eq('notification_sent', true);

      if (totalError || pendingError || sentError) {
        throw new Error('Error fetching notification stats');
      }

      return {
        total_notifications: totalData?.length || 0,
        pending_notifications: pendingData?.length || 0,
        sent_notifications: sentData?.length || 0,
        failed_notifications: 0 // We'll track this separately later
      };

    } catch (error) {
      console.error('❌ Error getting notification stats:', error);
      return {
        total_notifications: 0,
        pending_notifications: 0,
        sent_notifications: 0,
        failed_notifications: 0
      };
    }
  }
}