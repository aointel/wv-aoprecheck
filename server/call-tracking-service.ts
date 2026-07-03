import { db } from './db';
import { outboundCalls, callCenterEvents, agentMetrics } from '@shared/schema';
import type { 
  InsertOutboundCall, 
  OutboundCall, 
  InsertCallCenterEvent, 
  CallCenterEvent,
  InsertAgentMetrics,
  AgentMetrics 
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export class CallTrackingService {
  // Create a new outbound call record
  async createOutboundCall(callData: InsertOutboundCall): Promise<OutboundCall> {
    console.log('📞 Creating outbound call record:', callData.twilioCallSid);
    
    const [call] = await db
      .insert(outboundCalls)
      .values({
        ...callData,
        startTime: new Date(),
      })
      .returning();
    
    // Log the call start event
    await this.logCallEvent({
      eventType: 'call_started',
      callId: call.id,
      twilioCallSid: call.twilioCallSid,
      agentEmail: call.agentEmail,
      eventData: {
        leadName: call.leadName,
        leadPhone: call.leadPhone,
        localPresenceNumber: call.localPresenceNumber,
      },
    });
    
    console.log('✅ Outbound call record created:', call.id);
    return call;
  }

  // Update call status and timing
  async updateCallStatus(
    twilioCallSid: string, 
    updates: Partial<OutboundCall>
  ): Promise<OutboundCall | null> {
    console.log('🔄 Updating call status:', twilioCallSid, updates.callStatus);
    
    const [call] = await db
      .update(outboundCalls)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(outboundCalls.twilioCallSid, twilioCallSid))
      .returning();
    
    if (call && updates.callStatus) {
      // Log status change event
      await this.logCallEvent({
        eventType: `call_${updates.callStatus}`,
        callId: call.id,
        twilioCallSid: call.twilioCallSid,
        agentEmail: call.agentEmail,
        eventData: updates,
      });
    }
    
    return call || null;
  }

  // Set call disposition
  async setCallDisposition(
    twilioCallSid: string,
    disposition: string,
    notes?: string,
    appointmentDate?: Date
  ): Promise<OutboundCall | null> {
    console.log('📋 Setting call disposition:', twilioCallSid, disposition);
    
    const updates: Partial<OutboundCall> = {
      callDisposition: disposition,
      notes,
      appointmentScheduled: disposition === 'appointment',
      appointmentDate,
    };
    
    const [call] = await db
      .update(outboundCalls)
      .set(updates)
      .where(eq(outboundCalls.twilioCallSid, twilioCallSid))
      .returning();
    
    if (call) {
      await this.logCallEvent({
        eventType: 'disposition_set',
        callId: call.id,
        twilioCallSid: call.twilioCallSid,
        agentEmail: call.agentEmail,
        eventData: { disposition, notes, appointmentDate },
      });
    }
    
    return call || null;
  }

  // Log call center events
  async logCallEvent(eventData: InsertCallCenterEvent): Promise<CallCenterEvent> {
    const [event] = await db
      .insert(callCenterEvents)
      .values(eventData)
      .returning();
    
    return event;
  }

  // Get active calls for an agent
  async getActiveCalls(agentEmail: string): Promise<OutboundCall[]> {
    return await db
      .select()
      .from(outboundCalls)
      .where(
        and(
          eq(outboundCalls.agentEmail, agentEmail),
          eq(outboundCalls.callStatus, 'in-progress')
        )
      )
      .orderBy(desc(outboundCalls.startTime));
  }

  // Get call history with pagination
  async getCallHistory(
    agentEmail?: string,
    limit: number = 50,
    offset: number = 0,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<OutboundCall[]> {
    const conditions = [];
    
    if (agentEmail) {
      conditions.push(eq(outboundCalls.agentEmail, agentEmail));
    }
    
    if (dateFrom) {
      conditions.push(gte(outboundCalls.startTime, dateFrom));
    }
    
    if (dateTo) {
      conditions.push(lte(outboundCalls.startTime, dateTo));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return await db
      .select()
      .from(outboundCalls)
      .where(whereClause)
      .orderBy(desc(outboundCalls.startTime))
      .limit(limit)
      .offset(offset);
  }

  // Get call center dashboard stats
  async getDashboardStats(agentEmail?: string, dateFrom?: Date, dateTo?: Date) {
    const conditions = [];
    
    if (agentEmail) {
      conditions.push(eq(outboundCalls.agentEmail, agentEmail));
    }
    
    if (dateFrom) {
      conditions.push(gte(outboundCalls.startTime, dateFrom));
    }
    
    if (dateTo) {
      conditions.push(lte(outboundCalls.startTime, dateTo));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get overall stats
    const [stats] = await db
      .select({
        totalCalls: sql<number>`COUNT(*)::int`,
        completedCalls: sql<number>`COUNT(CASE WHEN call_status = 'completed' THEN 1 END)::int`,
        totalConnects: sql<number>`COUNT(CASE WHEN call_status = 'completed' AND duration > 30 THEN 1 END)::int`,
        totalAppointments: sql<number>`COUNT(CASE WHEN appointment_scheduled = true THEN 1 END)::int`,
        averageDuration: sql<number>`AVG(duration)::int`,
        totalTalkTime: sql<number>`SUM(duration)::int`,
      })
      .from(outboundCalls)
      .where(whereClause);
    
    // Calculate rates
    const connectRate = stats.totalCalls > 0 
      ? ((stats.totalConnects / stats.totalCalls) * 100).toFixed(2)
      : '0.00';
    
    const appointmentRate = stats.totalConnects > 0 
      ? ((stats.totalAppointments / stats.totalConnects) * 100).toFixed(2)
      : '0.00';
    
    return {
      ...stats,
      connectRate: parseFloat(connectRate),
      appointmentRate: parseFloat(appointmentRate),
    };
  }

  // Update or create daily agent metrics
  async updateAgentMetrics(agentEmail: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const stats = await this.getDashboardStats(agentEmail, startOfDay, endOfDay);
    
    const metricsData: InsertAgentMetrics = {
      agentEmail,
      date: startOfDay,
      totalCalls: stats.totalCalls,
      totalConnects: stats.totalConnects,
      totalAppointments: stats.totalAppointments,
      connectRate: stats.connectRate.toString(),
      appointmentRate: stats.appointmentRate.toString(),
      totalTalkTime: stats.totalTalkTime,
      averageCallDuration: stats.averageDuration.toString(),
      averageCallQuality: '0.00', // Will be calculated from call quality ratings
    };
    
    // Upsert metrics (update if exists, insert if not)
    await db
      .insert(agentMetrics)
      .values(metricsData)
      .onConflictDoUpdate({
        target: [agentMetrics.agentEmail, agentMetrics.date],
        set: metricsData,
      });
    
    console.log('📊 Agent metrics updated for:', agentEmail, date.toDateString());
  }

  // Get agent performance metrics
  async getAgentMetrics(
    agentEmail: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<AgentMetrics[]> {
    return await db
      .select()
      .from(agentMetrics)
      .where(
        and(
          eq(agentMetrics.agentEmail, agentEmail),
          gte(agentMetrics.date, dateFrom),
          lte(agentMetrics.date, dateTo)
        )
      )
      .orderBy(desc(agentMetrics.date));
  }

  // Get real-time call center overview
  async getCallCenterOverview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    // Active calls count
    const [activeCalls] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(outboundCalls)
      .where(eq(outboundCalls.callStatus, 'in-progress'));
    
    // Today's stats
    const todayStats = await this.getDashboardStats(undefined, todayStart, now);
    
    // Agent stats for today
    const agentStats = await db
      .select({
        agentEmail: outboundCalls.agentEmail,
        agentName: outboundCalls.agentName,
        totalCalls: sql<number>`COUNT(*)::int`,
        totalConnects: sql<number>`COUNT(CASE WHEN call_status = 'completed' AND duration > 30 THEN 1 END)::int`,
        totalAppointments: sql<number>`COUNT(CASE WHEN appointment_scheduled = true THEN 1 END)::int`,
        totalTalkTime: sql<number>`SUM(duration)::int`,
      })
      .from(outboundCalls)
      .where(gte(outboundCalls.startTime, todayStart))
      .groupBy(outboundCalls.agentEmail, outboundCalls.agentName)
      .orderBy(desc(sql`COUNT(*)`));
    
    return {
      activeCalls: activeCalls.count,
      todayStats,
      agentStats,
    };
  }
}

export const callTrackingService = new CallTrackingService();