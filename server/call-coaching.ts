/**
 * Call Coaching System
 * Allows managers to listen to live calls and whisper to agents
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config.js';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export interface CoachingSession {
  callSid: string;
  conferenceName: string;
  agentEmail: string;
  managerEmail: string;
  mode: 'listen' | 'whisper' | 'barge'; // listen-only, whisper to agent, or full barge-in
  startedAt: Date;
}

class CallCoachingService {
  private activeSessions: Map<string, CoachingSession> = new Map(); // Key: managerEmail

  /**
   * Join a call as a coach (listen-only mode by default)
   */
  async joinCall(params: {
    callSid: string;
    managerEmail: string;
    managerPhone: string;
    mode?: 'listen' | 'whisper' | 'barge';
  }): Promise<{ success: boolean; coachCallSid?: string; error?: string }> {
    try {
      const { callSid, managerEmail, managerPhone, mode = 'listen' } = params;

      console.log(`🎧 Manager ${managerEmail} joining call ${callSid} in ${mode} mode`);

      // Get the call details to find the conference name
      const call = await client.calls(callSid).fetch();
      
      // Create a call to the manager
      const coachCall = await client.calls.create({
        to: managerPhone,
        from: call.from || '+19142289324', // Use the same number
        record: true,
        recordingStatusCallback: 'https://aoirail-production-baa2.up.railway.app/api/twilio/recording-status',
        recordingStatusCallbackMethod: 'POST',
        twiml: `
          <Response>
            <Say>Connecting you to the call. You are in ${mode} mode.</Say>
            <Dial>
              <Conference 
                beep="false"
                record="record-from-start"
                recordingStatusCallback="https://aoirail-production-baa2.up.railway.app/api/twilio/recording-status"
                recordingStatusCallbackMethod="POST"
                statusCallback="https://aoirail-production-baa2.up.railway.app/api/call-coaching/status"
                statusCallbackEvent="start end join leave"
                coach="${callSid}"
              >
                ${call.sid}
              </Conference>
            </Dial>
          </Response>
        `
      });

      // Store the session
      const session: CoachingSession = {
        callSid,
        conferenceName: call.sid,
        agentEmail: call.from?.replace('client:', '') || 'unknown',
        managerEmail,
        mode,
        startedAt: new Date()
      };

      this.activeSessions.set(managerEmail, session);

      console.log(`✅ Manager joined call ${callSid} as coach: ${coachCall.sid}`);

      return {
        success: true,
        coachCallSid: coachCall.sid
      };

    } catch (error: any) {
      console.error('❌ Failed to join call as coach:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Switch coaching mode (listen → whisper → barge)
   */
  async switchMode(managerEmail: string, newMode: 'listen' | 'whisper' | 'barge'): Promise<boolean> {
    try {
      const session = this.activeSessions.get(managerEmail);
      if (!session) {
        console.log(`⚠️ No active coaching session for ${managerEmail}`);
        return false;
      }

      console.log(`🔄 Switching ${managerEmail} from ${session.mode} to ${newMode}`);

      // Update the conference participant
      const participants = await client
        .conferences(session.conferenceName)
        .participants
        .list();

      // Find the manager's participant
      const managerParticipant = participants.find(p => 
        p.callSid !== session.callSid // Not the agent's call
      );

      if (managerParticipant) {
        // Update participant properties based on mode
        const updateProps: any = {};
        
        if (newMode === 'listen') {
          updateProps.coaching = true;
          updateProps.muted = true;
        } else if (newMode === 'whisper') {
          updateProps.coaching = true;
          updateProps.muted = false;
        } else if (newMode === 'barge') {
          updateProps.coaching = false;
          updateProps.muted = false;
        }

        await client
          .conferences(session.conferenceName)
          .participants(managerParticipant.callSid)
          .update(updateProps);

        session.mode = newMode;
        console.log(`✅ Switched to ${newMode} mode`);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Failed to switch coaching mode:', error);
      return false;
    }
  }

  /**
   * Leave the coaching session
   */
  async leaveCall(managerEmail: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(managerEmail);
      if (!session) {
        return false;
      }

      console.log(`👋 Manager ${managerEmail} leaving call ${session.callSid}`);

      // End the manager's participation
      const participants = await client
        .conferences(session.conferenceName)
        .participants
        .list();

      const managerParticipant = participants.find(p => p.callSid !== session.callSid);

      if (managerParticipant) {
        await client
          .conferences(session.conferenceName)
          .participants(managerParticipant.callSid)
          .update({ hold: false })
          .then(() => 
            client
              .conferences(session.conferenceName)
              .participants(managerParticipant.callSid)
              .remove()
          );
      }

      this.activeSessions.delete(managerEmail);
      console.log(`✅ Manager left call`);
      return true;

    } catch (error) {
      console.error('❌ Failed to leave call:', error);
      return false;
    }
  }

  getActiveSession(managerEmail: string): CoachingSession | undefined {
    return this.activeSessions.get(managerEmail);
  }

  getAllActiveSessions(): CoachingSession[] {
    return Array.from(this.activeSessions.values());
  }
}

export const callCoachingService = new CallCoachingService();

