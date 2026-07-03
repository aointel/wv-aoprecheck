import { pool } from './db';

export class SimpleBillingService {
  private static readonly BILLING_RATE_PER_MINUTE = 0.10; // $0.10 per minute

  // Start call tracking
  static async startCallTracking(params: {
    userId: string;
    userEmail: string;
    callType: 'voice' | 'video' | 'conference';
    callId: string;
    leadPhone?: string;
    leadName?: string;
    platform?: string;
  }): Promise<string> {
    const trackingId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await pool.query(`
        INSERT INTO call_usage_logs (
          tracking_id, user_id, user_email, call_type, call_id, 
          lead_phone, lead_name, platform
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        trackingId,
        params.userId,
        params.userEmail,
        params.callType,
        params.callId,
        params.leadPhone || null,
        params.leadName || null,
        params.platform || 'twilio'
      ]);

      console.log(`📞 Started call tracking: ${trackingId} for ${params.userEmail}`);
      return trackingId;
    } catch (error) {
      console.error('❌ Failed to start call tracking:', error);
      throw new Error('Failed to start call tracking');
    }
  }

  // End call tracking
  static async endCallTracking(trackingId: string): Promise<void> {
    try {
      const result = await pool.query(`
        UPDATE call_usage_logs 
        SET 
          end_time = CURRENT_TIMESTAMP,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)),
          duration_minutes = CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60),
          cost = CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60) * $1,
          credits_used = CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60),
          updated_at = CURRENT_TIMESTAMP
        WHERE tracking_id = $2
        RETURNING user_email, duration_minutes, cost
      `, [this.BILLING_RATE_PER_MINUTE, trackingId]);

      if (result.rows.length > 0) {
        const { user_email, duration_minutes, cost } = result.rows[0];
        
        // Log billing transaction
        await pool.query(`
          INSERT INTO billing_transactions (
            user_email, transaction_type, amount, credits_involved, 
            description, tracking_id
          ) VALUES ($1, 'charge', $2, $3, $4, $5)
        `, [
          user_email,
          cost,
          duration_minutes,
          `Call usage: ${duration_minutes} minutes`,
          trackingId
        ]);

        console.log(`📞 Ended call tracking: ${trackingId} - ${duration_minutes} minutes, $${cost}`);
      }
    } catch (error) {
      console.error('❌ Failed to end call tracking:', error);
      throw new Error('Failed to end call tracking');
    }
  }

  // Start video meeting tracking
  static async startVideoMeetingTracking(params: {
    userId: string;
    userEmail: string;
    meetingId: string;
    meetingType: 'whereby' | 'zoom' | 'aoi-meet';
    roomUrl?: string;
    hostRoomUrl?: string;
    leadName?: string;
    leadPhone?: string;
  }): Promise<string> {
    const trackingId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await pool.query(`
        INSERT INTO video_usage_logs (
          tracking_id, user_id, user_email, meeting_id, meeting_type,
          room_url, host_room_url, lead_name, lead_phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        trackingId,
        params.userId,
        params.userEmail,
        params.meetingId,
        params.meetingType,
        params.roomUrl || null,
        params.hostRoomUrl || null,
        params.leadName || null,
        params.leadPhone || null
      ]);

      console.log(`🎥 Started video tracking: ${trackingId} for ${params.userEmail}`);
      return trackingId;
    } catch (error) {
      console.error('❌ Failed to start video tracking:', error);
      throw new Error('Failed to start video meeting tracking');
    }
  }

  // End video meeting tracking
  static async endVideoMeetingTracking(trackingId: string): Promise<void> {
    try {
      const result = await pool.query(`
        UPDATE video_usage_logs 
        SET 
          end_time = CURRENT_TIMESTAMP,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)),
          duration_minutes = CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60),
          cost = CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60) * $1,
          credits_used = CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60),
          updated_at = CURRENT_TIMESTAMP
        WHERE tracking_id = $2
        RETURNING user_email, duration_minutes, cost
      `, [this.BILLING_RATE_PER_MINUTE, trackingId]);

      if (result.rows.length > 0) {
        const { user_email, duration_minutes, cost } = result.rows[0];
        
        // Log billing transaction
        await pool.query(`
          INSERT INTO billing_transactions (
            user_email, transaction_type, amount, credits_involved, 
            description, tracking_id
          ) VALUES ($1, 'charge', $2, $3, $4, $5)
        `, [
          user_email,
          cost,
          duration_minutes,
          `Video meeting: ${duration_minutes} minutes`,
          trackingId
        ]);

        console.log(`🎥 Ended video tracking: ${trackingId} - ${duration_minutes} minutes, $${cost}`);
      }
    } catch (error) {
      console.error('❌ Failed to end video tracking:', error);
      throw new Error('Failed to end video meeting tracking');
    }
  }

  // Get user usage statistics
  static async getUserUsageStats(userEmail: string): Promise<{
    currentMonth: {
      callMinutes: number;
      videoMinutes: number;
      creditsUsed: number;
      cost: number;
    };
    allTime: {
      totalCalls: number;
      totalVideoMeetings: number;
      totalMinutes: number;
      totalCost: number;
    };
  }> {
    try {
      // Current month stats
      const currentMonthResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN c.duration_minutes IS NOT NULL THEN c.duration_minutes ELSE 0 END), 0) as call_minutes,
          COALESCE(SUM(CASE WHEN v.duration_minutes IS NOT NULL THEN v.duration_minutes ELSE 0 END), 0) as video_minutes,
          COALESCE(SUM(CASE WHEN c.credits_used IS NOT NULL THEN c.credits_used ELSE 0 END), 0) + 
          COALESCE(SUM(CASE WHEN v.credits_used IS NOT NULL THEN v.credits_used ELSE 0 END), 0) as total_credits,
          COALESCE(SUM(CASE WHEN c.cost IS NOT NULL THEN c.cost ELSE 0 END), 0) + 
          COALESCE(SUM(CASE WHEN v.cost IS NOT NULL THEN v.cost ELSE 0 END), 0) as total_cost
        FROM (SELECT 1) dummy
        LEFT JOIN call_usage_logs c ON c.user_email = $1 
          AND DATE_TRUNC('month', c.start_time) = DATE_TRUNC('month', CURRENT_DATE)
          AND c.end_time IS NOT NULL
        LEFT JOIN video_usage_logs v ON v.user_email = $1 
          AND DATE_TRUNC('month', v.start_time) = DATE_TRUNC('month', CURRENT_DATE)
          AND v.end_time IS NOT NULL
      `, [userEmail]);

      // All time stats
      const allTimeResult = await pool.query(`
        SELECT 
          COALESCE(COUNT(DISTINCT c.id), 0) as total_calls,
          COALESCE(COUNT(DISTINCT v.id), 0) as total_video_meetings,
          COALESCE(SUM(CASE WHEN c.duration_minutes IS NOT NULL THEN c.duration_minutes ELSE 0 END), 0) + 
          COALESCE(SUM(CASE WHEN v.duration_minutes IS NOT NULL THEN v.duration_minutes ELSE 0 END), 0) as total_minutes,
          COALESCE(SUM(CASE WHEN c.cost IS NOT NULL THEN c.cost ELSE 0 END), 0) + 
          COALESCE(SUM(CASE WHEN v.cost IS NOT NULL THEN v.cost ELSE 0 END), 0) as total_cost
        FROM (SELECT 1) dummy
        LEFT JOIN call_usage_logs c ON c.user_email = $1 AND c.end_time IS NOT NULL
        LEFT JOIN video_usage_logs v ON v.user_email = $1 AND v.end_time IS NOT NULL
      `, [userEmail]);

      const currentMonth = currentMonthResult.rows[0];
      const allTime = allTimeResult.rows[0];

      return {
        currentMonth: {
          callMinutes: parseInt(currentMonth.call_minutes) || 0,
          videoMinutes: parseInt(currentMonth.video_minutes) || 0,
          creditsUsed: parseInt(currentMonth.total_credits) || 0,
          cost: parseFloat(currentMonth.total_cost) || 0,
        },
        allTime: {
          totalCalls: parseInt(allTime.total_calls) || 0,
          totalVideoMeetings: parseInt(allTime.total_video_meetings) || 0,
          totalMinutes: parseInt(allTime.total_minutes) || 0,
          totalCost: parseFloat(allTime.total_cost) || 0,
        }
      };
    } catch (error) {
      console.error('❌ Failed to get usage stats:', error);
      throw new Error('Failed to fetch usage statistics');
    }
  }

  // Handle Twilio webhook for call status updates
  static async handleTwilioCallWebhook(callSid: string, callStatus: string, userEmail: string): Promise<void> {
    try {
      if (callStatus === 'completed') {
        // Try to find and end any active call tracking for this user
        const result = await pool.query(`
          SELECT tracking_id FROM call_usage_logs 
          WHERE user_email = $1 AND end_time IS NULL 
          ORDER BY start_time DESC LIMIT 1
        `, [userEmail]);

        if (result.rows.length > 0) {
          await this.endCallTracking(result.rows[0].tracking_id);
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle Twilio webhook:', error);
    }
  }
}