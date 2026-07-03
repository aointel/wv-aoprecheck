// 🎯 BULLETPROOF CALL TRACKING SERVICE
// Single source of truth for all call tracking

import { db } from './db';
import { callTracker, type InsertCallTracker, type CallTracker } from '../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

export type CallProgress = 'not_initiated' | 'initiated' | 'connected' | 'in_progress' | 'complete';
export type CallOutcome = 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail';
export type VerificationResult = 'passed' | 'failed' | 'incomplete';

export class BulletproofCallTracker {
  
  // 🚀 CREATE NEW CALL SESSION
  static async createCallSession(sessionData: {
    sessionId: string;
    agentEmail: string;
    leadPhone: string;
    leadName: string;
    zoomRoomId?: string;
  }): Promise<CallTracker> {
    try {
      const [newCall] = await db.insert(callTracker).values({
        sessionId: sessionData.sessionId,
        agentEmail: sessionData.agentEmail,
        leadPhone: sessionData.leadPhone,
        leadName: sessionData.leadName,
        zoomRoomId: sessionData.zoomRoomId,
        callProgress: 'not_initiated',
        retryCount: 0,
      }).returning();
      
      console.log(`📞 CALL TRACKER: Created session ${sessionData.sessionId}`);
      return newCall;
    } catch (error) {
      console.error('❌ CALL TRACKER: Failed to create session:', error);
      throw error;
    }
  }

  // 🎯 UPDATE CALL PROGRESS - ATOMIC UPDATES
  static async updateProgress(
    sessionId: string, 
    progress: CallProgress, 
    additionalData?: Partial<CallTracker>
  ): Promise<CallTracker | null> {
    try {
      const updateData: any = {
        callProgress: progress,
        updatedAt: new Date(),
        ...additionalData
      };

      // Add timestamp based on progress
      const now = new Date();
      switch (progress) {
        case 'initiated':
          updateData.initiatedAt = now;
          break;
        case 'connected':
          updateData.connectedAt = now;
          break;
        case 'in_progress':
          updateData.inProgressAt = now;
          break;
        case 'complete':
          updateData.completedAt = now;
          break;
      }

      const [updatedCall] = await db
        .update(callTracker)
        .set(updateData)
        .where(eq(callTracker.sessionId, sessionId))
        .returning();

      if (updatedCall) {
        console.log(`🔄 CALL TRACKER: Updated ${sessionId} to ${progress}`);
        return updatedCall;
      } else {
        console.warn(`⚠️ CALL TRACKER: Session ${sessionId} not found for update`);
        return null;
      }
    } catch (error) {
      console.error(`❌ CALL TRACKER: Failed to update ${sessionId}:`, error);
      return null;
    }
  }

  // 🔍 GET CALL STATUS
  static async getCallStatus(sessionId: string): Promise<CallTracker | null> {
    try {
      const [call] = await db
        .select()
        .from(callTracker)
        .where(eq(callTracker.sessionId, sessionId));

      return call || null;
    } catch (error) {
      console.error(`❌ CALL TRACKER: Failed to get status for ${sessionId}:`, error);
      return null;
    }
  }

  // 🎯 ADD EXTERNAL SYSTEM IDS - Taalk, Twilio, etc.
  static async addExternalId(
    sessionId: string,
    system: 'taalk' | 'twilio',
    externalId: string
  ): Promise<boolean> {
    try {
      const updateField = system === 'taalk' ? 'taalkCallId' : 'twilioCallSid';
      
      await db
        .update(callTracker)
        .set({ [updateField]: externalId, updatedAt: new Date() })
        .where(eq(callTracker.sessionId, sessionId));

      console.log(`🔗 CALL TRACKER: Added ${system} ID ${externalId} to ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`❌ CALL TRACKER: Failed to add ${system} ID:`, error);
      return false;
    }
  }

  // 🚨 LOG ERROR - Fail-safe error tracking
  static async logError(sessionId: string, error: string): Promise<boolean> {
    try {
      await db
        .update(callTracker)
        .set({ 
          lastError: error, 
          retryCount: sql`retry_count + 1`,
          updatedAt: new Date()
        })
        .where(eq(callTracker.sessionId, sessionId));

      console.log(`🚨 CALL TRACKER: Logged error for ${sessionId}: ${error}`);
      return true;
    } catch (err) {
      console.error(`❌ CALL TRACKER: Failed to log error:`, err);
      return false;
    }
  }

  // 🏁 COMPLETE CALL - Final outcome
  static async completeCall(
    sessionId: string,
    outcome: CallOutcome,
    verificationResult?: VerificationResult,
    appointmentBooked?: boolean
  ): Promise<CallTracker | null> {
    try {
      const [completedCall] = await db
        .update(callTracker)
        .set({
          callProgress: 'complete',
          callOutcome: outcome,
          verificationResult,
          appointmentBooked: appointmentBooked || false,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(callTracker.sessionId, sessionId))
        .returning();

      if (completedCall) {
        console.log(`🏁 CALL TRACKER: Completed ${sessionId} with outcome: ${outcome}`);
      }
      
      return completedCall;
    } catch (error) {
      console.error(`❌ CALL TRACKER: Failed to complete call ${sessionId}:`, error);
      return null;
    }
  }

  // 📊 GET AGENT CALL HISTORY
  static async getAgentCalls(agentEmail: string, limit: number = 50): Promise<CallTracker[]> {
    try {
      const calls = await db
        .select()
        .from(callTracker)
        .where(eq(callTracker.agentEmail, agentEmail))
        .orderBy(desc(callTracker.createdAt))
        .limit(limit);

      return calls;
    } catch (error) {
      console.error(`❌ CALL TRACKER: Failed to get agent calls:`, error);
      return [];
    }
  }

  // 🎯 WEBHOOK HANDLER - Real-time updates from external systems
  static async handleWebhook(source: 'taalk' | 'twilio', payload: any): Promise<boolean> {
    try {
      console.log(`📡 CALL TRACKER: Received ${source} webhook:`, payload);

      if (source === 'taalk') {
        return await this.handleTaalkWebhook(payload);
      } else if (source === 'twilio') {
        return await this.handleTwilioWebhook(payload);
      }

      return false;
    } catch (error) {
      console.error(`❌ CALL TRACKER: Webhook handler failed:`, error);
      return false;
    }
  }

  // 🔄 TAALK WEBHOOK HANDLER
  private static async handleTaalkWebhook(payload: any): Promise<boolean> {
    try {
      const { callId, status, sessionId } = payload;

      if (!sessionId) return false;

      // Map Taalk status to our call progress
      let progress: CallProgress = 'initiated';
      let outcome: CallOutcome | undefined;

      switch (status) {
        case 'answered':
        case 'connected':
          progress = 'connected';
          break;
        case 'in-progress':
        case 'active':
        case 'ongoing':
          progress = 'in_progress';
          break;
        case 'completed':
        case 'finished':
          progress = 'complete';
          outcome = 'answered';
          break;
        case 'failed':
        case 'busy':
        case 'no-answer':
          progress = 'complete';
          outcome = status as CallOutcome;
          break;
      }

      // Update call progress
      const updateData: any = { callProgress: progress };
      if (outcome) updateData.callOutcome = outcome;
      if (callId) updateData.taalkCallId = callId;

      await this.updateProgress(sessionId, progress, updateData);
      return true;
    } catch (error) {
      console.error('❌ CALL TRACKER: Taalk webhook failed:', error);
      return false;
    }
  }

  // 📞 TWILIO WEBHOOK HANDLER  
  private static async handleTwilioWebhook(payload: any): Promise<boolean> {
    try {
      const { CallSid, CallStatus } = payload;

      // Find call by Twilio SID
      const [call] = await db
        .select()
        .from(callTracker)
        .where(eq(callTracker.twilioCallSid, CallSid));

      if (!call) return false;

      // Map Twilio status to our progress
      let progress: CallProgress = call.callProgress as CallProgress;
      let outcome: CallOutcome | undefined;

      switch (CallStatus) {
        case 'in-progress':
          progress = 'connected';
          break;
        case 'completed':
          progress = 'complete';
          outcome = 'answered';
          break;
        case 'busy':
          progress = 'complete';
          outcome = 'busy';
          break;
        case 'no-answer':
          progress = 'complete';
          outcome = 'no_answer';
          break;
        case 'failed':
          progress = 'complete';
          outcome = 'failed';
          break;
      }

      await this.updateProgress(call.sessionId, progress, { callOutcome: outcome });
      return true;
    } catch (error) {
      console.error('❌ CALL TRACKER: Twilio webhook failed:', error);
      return false;
    }
  }
}

// Export instance for use throughout the app
export const callTracker_service = BulletproofCallTracker;