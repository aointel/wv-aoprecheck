import { db } from './db';
import { callUsageTracking, videoMeetingTracking, userCredits } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface CallStartData {
  userId: string;
  userEmail: string;
  callType: 'voice' | 'video' | 'conference';
  callId: string;
  leadPhone?: string;
  leadName?: string;
  platform: 'twilio' | 'whereby' | 'aoi-meet' | 'zoom';
  metadata?: Record<string, any>;
}

export interface VideoMeetingStartData {
  userId: string;
  userEmail: string;
  meetingId: string;
  meetingType: 'whereby' | 'zoom' | 'aoi-meet';
  roomUrl?: string;
  hostRoomUrl?: string;
  leadName?: string;
  leadPhone?: string;
  metadata?: Record<string, any>;
}

export class BillingService {
  private static readonly BILLING_RATE_PER_MINUTE = 0.0167; // $1/hour = ~$0.0167/minute

  /**
   * Start tracking a voice/video call
   */
  static async startCallTracking(data: CallStartData): Promise<string> {
    try {
      const [record] = await db.insert(callUsageTracking).values({
        userId: data.userId,
        userEmail: data.userEmail,
        callType: data.callType,
        callId: data.callId,
        leadPhone: data.leadPhone,
        leadName: data.leadName,
        startTime: new Date(),
        platform: data.platform,
        metadata: data.metadata || {},
        billingRate: this.BILLING_RATE_PER_MINUTE.toString(),
      }).returning({ id: callUsageTracking.id });

      console.log(`📞 Started call tracking for ${data.userEmail}: ${record.id}`);
      return record.id;
    } catch (error) {
      console.error('❌ Failed to start call tracking:', error);
      throw error;
    }
  }

  /**
   * Start tracking a video meeting
   */
  static async startVideoMeetingTracking(data: VideoMeetingStartData): Promise<string> {
    try {
      const [record] = await db.insert(videoMeetingTracking).values({
        userId: data.userId,
        userEmail: data.userEmail,
        meetingId: data.meetingId,
        meetingType: data.meetingType,
        roomUrl: data.roomUrl,
        hostRoomUrl: data.hostRoomUrl,
        leadName: data.leadName,
        leadPhone: data.leadPhone,
        startTime: new Date(),
        metadata: data.metadata || {},
        billingRate: this.BILLING_RATE_PER_MINUTE.toString(),
      }).returning({ id: videoMeetingTracking.id });

      console.log(`🎥 Started video meeting tracking for ${data.userEmail}: ${record.id}`);
      return record.id;
    } catch (error) {
      console.error('❌ Failed to start video meeting tracking:', error);
      throw error;
    }
  }

  /**
   * End call tracking and calculate billing
   */
  static async endCallTracking(callTrackingId: string): Promise<void> {
    try {
      const endTime = new Date();
      
      // Get the call record
      const [callRecord] = await db
        .select()
        .from(callUsageTracking)
        .where(eq(callUsageTracking.id, callTrackingId))
        .limit(1);

      if (!callRecord) {
        console.warn(`⚠️ Call tracking record not found: ${callTrackingId}`);
        return;
      }

      // Calculate duration and billing
      const durationMs = endTime.getTime() - callRecord.startTime.getTime();
      const durationSeconds = Math.floor(durationMs / 1000);
      const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to nearest minute
      const totalCost = durationMinutes * this.BILLING_RATE_PER_MINUTE;
      const creditsCharged = Math.ceil(totalCost * 60); // Convert to credits (assuming 1 credit = 1 minute at $1/hour)

      // Update the call record
      await db
        .update(callUsageTracking)
        .set({
          endTime,
          durationSeconds,
          durationMinutes: durationMinutes.toString(),
          creditsCharged: creditsCharged.toString(),
          totalCost: totalCost.toString(),
          billingStatus: 'pending',
        })
        .where(eq(callUsageTracking.id, callTrackingId));

      // Charge credits from user account
      await this.chargeCredits(callRecord.userEmail, creditsCharged);

      console.log(`📞 Ended call tracking for ${callRecord.userEmail}: ${durationMinutes} minutes, ${creditsCharged} credits charged`);
    } catch (error) {
      console.error('❌ Failed to end call tracking:', error);
      throw error;
    }
  }

  /**
   * End video meeting tracking and calculate billing
   */
  static async endVideoMeetingTracking(meetingTrackingId: string): Promise<void> {
    try {
      const endTime = new Date();
      
      // Get the meeting record
      const [meetingRecord] = await db
        .select()
        .from(videoMeetingTracking)
        .where(eq(videoMeetingTracking.id, meetingTrackingId))
        .limit(1);

      if (!meetingRecord) {
        console.warn(`⚠️ Video meeting tracking record not found: ${meetingTrackingId}`);
        return;
      }

      // Calculate duration and billing
      const durationMs = endTime.getTime() - meetingRecord.startTime.getTime();
      const durationSeconds = Math.floor(durationMs / 1000);
      const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to nearest minute
      const totalCost = durationMinutes * this.BILLING_RATE_PER_MINUTE;
      const creditsCharged = Math.ceil(totalCost * 60); // Convert to credits

      // Update the meeting record
      await db
        .update(videoMeetingTracking)
        .set({
          endTime,
          durationSeconds,
          durationMinutes: durationMinutes.toString(),
          creditsCharged: creditsCharged.toString(),
          totalCost: totalCost.toString(),
          billingStatus: 'pending',
        })
        .where(eq(videoMeetingTracking.id, meetingTrackingId));

      // Charge credits from user account
      await this.chargeCredits(meetingRecord.userEmail, creditsCharged);

      console.log(`🎥 Ended video meeting tracking for ${meetingRecord.userEmail}: ${durationMinutes} minutes, ${creditsCharged} credits charged`);
    } catch (error) {
      console.error('❌ Failed to end video meeting tracking:', error);
      throw error;
    }
  }

  /**
   * Charge credits from user account
   */
  static async chargeCredits(userEmail: string, creditsToCharge: number): Promise<void> {
    try {
      // Update user credits (Supabase userCredits table structure)
      await db
        .update(userCredits)
        .set({
          creditsUsed: sql`COALESCE(${userCredits.creditsUsed}, 0) + ${creditsToCharge}`,
          creditsRemaining: sql`GREATEST(COALESCE(${userCredits.creditsRemaining}, 0) - ${creditsToCharge}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.email, userEmail));

      console.log(`💳 Charged ${creditsToCharge} credits from ${userEmail}`);
    } catch (error) {
      console.error('❌ Failed to charge credits:', error);
      throw error;
    }
  }

  /**
   * Get user's usage statistics
   */
  static async getUserUsageStats(userEmail: string): Promise<{
    totalCallMinutes: number;
    totalVideoMinutes: number;
    totalCreditsUsed: number;
    totalCost: number;
    currentMonth: {
      callMinutes: number;
      videoMinutes: number;
      creditsUsed: number;
      cost: number;
    };
  }> {
    try {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      // Get call usage stats
      const [callStats] = await db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(${callUsageTracking.durationMinutes}::numeric), 0)`,
          totalCredits: sql<number>`COALESCE(SUM(${callUsageTracking.creditsCharged}::numeric), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${callUsageTracking.totalCost}::numeric), 0)`,
          monthlyMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${callUsageTracking.createdAt} >= ${currentMonth} THEN ${callUsageTracking.durationMinutes}::numeric ELSE 0 END), 0)`,
          monthlyCredits: sql<number>`COALESCE(SUM(CASE WHEN ${callUsageTracking.createdAt} >= ${currentMonth} THEN ${callUsageTracking.creditsCharged}::numeric ELSE 0 END), 0)`,
          monthlyCost: sql<number>`COALESCE(SUM(CASE WHEN ${callUsageTracking.createdAt} >= ${currentMonth} THEN ${callUsageTracking.totalCost}::numeric ELSE 0 END), 0)`,
        })
        .from(callUsageTracking)
        .where(eq(callUsageTracking.userEmail, userEmail));

      // Get video usage stats
      const [videoStats] = await db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(${videoMeetingTracking.durationMinutes}::numeric), 0)`,
          totalCredits: sql<number>`COALESCE(SUM(${videoMeetingTracking.creditsCharged}::numeric), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${videoMeetingTracking.totalCost}::numeric), 0)`,
          monthlyMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${videoMeetingTracking.createdAt} >= ${currentMonth} THEN ${videoMeetingTracking.durationMinutes}::numeric ELSE 0 END), 0)`,
          monthlyCredits: sql<number>`COALESCE(SUM(CASE WHEN ${videoMeetingTracking.createdAt} >= ${currentMonth} THEN ${videoMeetingTracking.creditsCharged}::numeric ELSE 0 END), 0)`,
          monthlyCost: sql<number>`COALESCE(SUM(CASE WHEN ${videoMeetingTracking.createdAt} >= ${currentMonth} THEN ${videoMeetingTracking.totalCost}::numeric ELSE 0 END), 0)`,
        })
        .from(videoMeetingTracking)
        .where(eq(videoMeetingTracking.userEmail, userEmail));

      return {
        totalCallMinutes: callStats?.totalMinutes || 0,
        totalVideoMinutes: videoStats?.totalMinutes || 0,
        totalCreditsUsed: (callStats?.totalCredits || 0) + (videoStats?.totalCredits || 0),
        totalCost: (callStats?.totalCost || 0) + (videoStats?.totalCost || 0),
        currentMonth: {
          callMinutes: callStats?.monthlyMinutes || 0,
          videoMinutes: videoStats?.monthlyMinutes || 0,
          creditsUsed: (callStats?.monthlyCredits || 0) + (videoStats?.monthlyCredits || 0),
          cost: (callStats?.monthlyCost || 0) + (videoStats?.monthlyCost || 0),
        },
      };
    } catch (error) {
      console.error('❌ Failed to get user usage stats:', error);
      throw error;
    }
  }

  /**
   * Webhook helper for Twilio call events
   */
  static async handleTwilioCallWebhook(callSid: string, event: string, userEmail: string): Promise<void> {
    try {
      if (event === 'call-started' || event === 'in-progress') {
        // Find if we have a tracking record for this call
        const [existingRecord] = await db
          .select()
          .from(callUsageTracking)
          .where(eq(callUsageTracking.callId, callSid))
          .limit(1);

        if (!existingRecord) {
          // Create new tracking record
          await this.startCallTracking({
            userId: userEmail, // In this case, using email as userId
            userEmail,
            callType: 'voice',
            callId: callSid,
            platform: 'twilio',
          });
        }
      } else if (event === 'completed' || event === 'failed' || event === 'no-answer') {
        // End tracking for this call
        const [existingRecord] = await db
          .select()
          .from(callUsageTracking)
          .where(eq(callUsageTracking.callId, callSid))
          .limit(1);

        if (existingRecord) {
          await this.endCallTracking(existingRecord.id);
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle Twilio call webhook:', error);
    }
  }

  /**
   * Generate AO Connect billing report
   */
  static async generateConnectReport(): Promise<string> {
    const { supabase } = await import('./supabase');
    
    try {
      // Fetch data with real lookups using associate_id
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('email, aoi_connect_credits_used, credits_remaining, associate_id')
        .gt('aoi_connect_credits_used', 0);

      if (creditsError) {
        console.error('❌ Error fetching credits:', creditsError);
        throw creditsError;
      }

      // Get agent names from customers table using associate_id
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name');

      if (customerError) {
        console.error('❌ Error fetching customer data:', customerError);
      }

      // Create lookup map for agent names
      const agentNameMap = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentNameMap.set(customer.associate_id, `${customer.first_name} ${customer.last_name}`);
        }
      });

      // Generate CSV with real agent names
      const csvHeader = 'Email,Agent Name,Associate ID,AO Connect Credits Used,Credits Remaining,Billing Amount,Date\n';
      const csvRows = creditsData?.map(row => {
        const agentName = agentNameMap.get(row.associate_id) || 'Unknown Agent';
        const billingAmount = (row.aoi_connect_credits_used * 0.10).toFixed(2);
        const today = new Date().toISOString().split('T')[0];
        
        return `"${row.email}","${agentName}","${row.associate_id || 'N/A'}","${row.aoi_connect_credits_used}","${row.credits_remaining}","$${billingAmount}","${today}"`;
      }).join('\n') || '';

      console.log('🔥 Generating AO Connect billing report...');
      console.log('✅ AO Connect report generated successfully');
      
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating Connect report:', error);
      throw error;
    }
  }

  /**
   * Generate AO Plus billing report
   */
  static async generatePlusReport(): Promise<string> {
    const { supabase } = await import('./supabase');
    
    try {
      const { data: creditsData, error } = await supabase
        .from('user_credits')
        .select('email, aoi_plus_credits_used, credits_remaining, associate_id')
        .gt('aoi_plus_credits_used', 0);

      if (error) throw error;

      const { data: customerData } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name');

      const agentNameMap = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentNameMap.set(customer.associate_id, `${customer.first_name} ${customer.last_name}`);
        }
      });

      const csvHeader = 'Email,Agent Name,Associate ID,AO Plus Credits Used,Credits Remaining,Billing Amount,Date\n';
      const csvRows = creditsData?.map(row => {
        const agentName = agentNameMap.get(row.associate_id) || 'Unknown Agent';
        const billingAmount = (row.aoi_plus_credits_used * 0.10).toFixed(2);
        const today = new Date().toISOString().split('T')[0];
        
        return `"${row.email}","${agentName}","${row.associate_id || 'N/A'}","${row.aoi_plus_credits_used}","${row.credits_remaining}","$${billingAmount}","${today}"`;
      }).join('\n') || '';

      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating Plus report:', error);
      throw error;
    }
  }

  /**
   * Generate AO Precheck billing report
   */
  static async generatePrecheckReport(): Promise<string> {
    const { supabase } = await import('./supabase');
    
    try {
      const { data: creditsData, error } = await supabase
        .from('user_credits')
        .select('email, aoi_precheck_credits_used, credits_remaining, associate_id')
        .gt('aoi_precheck_credits_used', 0);

      if (error) throw error;

      const { data: customerData } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name');

      const agentNameMap = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentNameMap.set(customer.associate_id, `${customer.first_name} ${customer.last_name}`);
        }
      });

      const csvHeader = 'Email,Agent Name,Associate ID,AO Precheck Credits Used,Credits Remaining,Billing Amount,Date\n';
      const csvRows = creditsData?.map(row => {
        const agentName = agentNameMap.get(row.associate_id) || 'Unknown Agent';
        const billingAmount = (row.aoi_precheck_credits_used * 0.10).toFixed(2);
        const today = new Date().toISOString().split('T')[0];
        
        return `"${row.email}","${agentName}","${row.associate_id || 'N/A'}","${row.aoi_precheck_credits_used}","${row.credits_remaining}","$${billingAmount}","${today}"`;
      }).join('\n') || '';

      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating Precheck report:', error);
      throw error;
    }
  }

  /**
   * Generate AO Recruit billing report
   */
  static async generateRecruitReport(): Promise<string> {
    const { supabase } = await import('./supabase');
    
    try {
      const { data: creditsData, error } = await supabase
        .from('user_credits')
        .select('email, aoi_recruit_credits_used, credits_remaining, associate_id')
        .gt('aoi_recruit_credits_used', 0);

      if (error) throw error;

      const { data: customerData } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name');

      const agentNameMap = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentNameMap.set(customer.associate_id, `${customer.first_name} ${customer.last_name}`);
        }
      });

      const csvHeader = 'Email,Agent Name,Associate ID,AO Recruit Credits Used,Credits Remaining,Billing Amount,Date\n';
      const csvRows = creditsData?.map(row => {
        const agentName = agentNameMap.get(row.associate_id) || 'Unknown Agent';
        const billingAmount = (row.aoi_recruit_credits_used * 0.10).toFixed(2);
        const today = new Date().toISOString().split('T')[0];
        
        return `"${row.email}","${agentName}","${row.associate_id || 'N/A'}","${row.aoi_recruit_credits_used}","${row.credits_remaining}","$${billingAmount}","${today}"`;
      }).join('\n') || '';

      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating Recruit report:', error);
      throw error;
    }
  }

  /**
   * Generate Verification calls billing report
   */
  static async generateVerificationReport(): Promise<string> {
    try {
      // Mock verification data for now
      const csvHeader = 'Email,Agent Name,Associate ID,Verification Calls,Credits Used,Billing Amount,Date\n';
      const today = new Date().toISOString().split('T')[0];
      const csvRows = `"demo@aoglobelife.com","Demo Agent","1000","5","5","$0.50","${today}"`;
      
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating Verification report:', error);
      throw error;
    }
  }

  /**
   * Generate Other services billing report
   */
  static async generateOtherServicesReport(): Promise<string> {
    try {
      // Mock other services data for now
      const csvHeader = 'Email,Agent Name,Associate ID,Other Services,Credits Used,Billing Amount,Date\n';
      const today = new Date().toISOString().split('T')[0];
      const csvRows = `"demo@aoglobelife.com","Demo Agent","1000","3","3","$0.30","${today}"`;
      
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating Other Services report:', error);
      throw error;
    }
  }

  /**
   * Generate MGA billing report
   */
  static async generateMGAReport(): Promise<string> {
    const { supabase } = await import('./supabase');
    
    try {
      // Get all credits data with associate_id
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('email, aoi_connect_credits_used, aoi_plus_credits_used, aoi_precheck_credits_used, aoi_recruit_credits_used, credits_remaining, associate_id');

      if (creditsError) throw creditsError;

      // Get customer data for agent names and team assignments
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, agent_name');

      if (customerError) throw customerError;

      // Create lookup maps
      const agentMap = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentMap.set(customer.associate_id, {
            name: `${customer.first_name} ${customer.last_name}`,
            team: customer.agent_name || 'Unassigned'
          });
        }
      });

      // Process credits data by MGA team
      const mgaTeams = new Map();
      
      creditsData?.forEach(credit => {
        const agent = agentMap.get(credit.associate_id) || { name: 'Unknown Agent', team: 'Unassigned' };
        const totalCreditsUsed = (credit.aoi_connect_credits_used || 0) + (credit.aoi_plus_credits_used || 0) + (credit.aoi_precheck_credits_used || 0) + (credit.aoi_recruit_credits_used || 0);
        const totalCharges = totalCreditsUsed * 0.10;

        if (!mgaTeams.has(agent.team)) {
          mgaTeams.set(agent.team, []);
        }

        mgaTeams.get(agent.team).push({
          email: credit.email,
          agentName: agent.name,
          associateId: credit.associate_id || 'N/A',
          totalCreditsUsed,
          creditsRemaining: credit.credits_remaining || 0,
          totalCharges
        });
      });

      // Generate CSV
      const csvHeader = 'MGA Team,Agent Name,Email,Associate ID,Total Credits Used,Credits Remaining,Total Charges,Date\n';
      const today = new Date().toISOString().split('T')[0];
      
      let csvRows = '';
      mgaTeams.forEach((agents, mgaTeam) => {
        agents.forEach(agent => {
          csvRows += `"${mgaTeam}","${agent.agentName}","${agent.email}","${agent.associateId}","${agent.totalCreditsUsed}","${agent.creditsRemaining}","$${agent.totalCharges.toFixed(2)}","${today}"\n`;
        });
      });

      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating MGA report:', error);
      throw error;
    }
  }

  /**
   * Generate billing summary report
   */
  static async generateBillingSummary(): Promise<string> {
    const { supabase } = await import('./supabase');
    
    try {
      const { data: creditsData, error } = await supabase
        .from('user_credits')
        .select('email, aoi_connect_credits_used, aoi_plus_credits_used, aoi_precheck_credits_used, aoi_recruit_credits_used, credits_remaining, associate_id');

      if (error) throw error;

      const { data: customerData } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name');

      const agentNameMap = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentNameMap.set(customer.associate_id, `${customer.first_name} ${customer.last_name}`);
        }
      });

      const csvHeader = 'Email,Agent Name,Associate ID,Connect Credits,Plus Credits,Precheck Credits,Recruit Credits,Total Credits Used,Credits Remaining,Total Charges,Date\n';
      const today = new Date().toISOString().split('T')[0];
      
      const csvRows = creditsData?.map(row => {
        const agentName = agentNameMap.get(row.associate_id) || 'Unknown Agent';
        const totalCreditsUsed = (row.aoi_connect_credits_used || 0) + (row.aoi_plus_credits_used || 0) + (row.aoi_precheck_credits_used || 0) + (row.aoi_recruit_credits_used || 0);
        const totalCharges = (totalCreditsUsed * 0.10).toFixed(2);
        
        return `"${row.email}","${agentName}","${row.associate_id || 'N/A'}","${row.aoi_connect_credits_used || 0}","${row.aoi_plus_credits_used || 0}","${row.aoi_precheck_credits_used || 0}","${row.aoi_recruit_credits_used || 0}","${totalCreditsUsed}","${row.credits_remaining || 0}","$${totalCharges}","${today}"`;
      }).join('\n') || '';

      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating billing summary:', error);
      throw error;
    }
  }
}