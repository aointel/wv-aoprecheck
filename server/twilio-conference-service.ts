import twilio from 'twilio';
import { PRODUCTION_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config';

export class TwilioConferenceService {
  private client: twilio.Twilio | null = null;

  constructor() {
    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('⚠️ Missing Twilio credentials for conference service - running in demo mode');
      return;
    }

    this.client = twilio(accountSid, authToken);
  }

  // Create a conference room for verification call
  async createConference(sessionId: string): Promise<{ conferenceName: string, conferenceUrl: string }> {
    const conferenceName = `AO-Verification-${sessionId}`;
    
    if (!this.client) {
      console.log('🔄 Demo mode: Conference room simulated:', conferenceName);
    } else {
      console.log(`Conference room prepared: ${conferenceName}`);
    }

    return {
      conferenceName,
      conferenceUrl: `${this.getBaseUrl()}/api/conference/join/${conferenceName}`
    };
  }

  // Add WebRTC agent to conference
  async addAgentToConference(conferenceName: string, agentIdentity: string): Promise<string> {
    try {
      // Create TwiML to connect WebRTC client to conference (record every call)
      const recordCb = `${this.getBaseUrl()}/api/twilio/recording-status`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference 
      statusCallbackEvent="start join leave end"
      statusCallback="${this.getBaseUrl()}/api/conference/participant-status"
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      record="record-from-start"
      recordingStatusCallback="${recordCb}"
      recordingStatusCallbackMethod="POST"
    >${conferenceName}</Conference>
  </Dial>
</Response>`;

      if (!this.client) {
        console.log(`🔄 Demo mode: Agent ${agentIdentity} simulated joining conference ${conferenceName}`);
      } else {
        console.log(`Agent ${agentIdentity} joining conference ${conferenceName}`);
      }
      return twiml;

    } catch (error) {
      console.error('Failed to add agent to conference:', error);
      throw new Error('Failed to add agent to conference');
    }
  }

  // Add incoming caller to conference
  async addCallerToConference(conferenceName: string, callerNumber: string): Promise<string> {
    try {
      // Create TwiML to connect incoming caller to conference
      const recordCb = `${this.getBaseUrl()}/api/twilio/recording-status`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to AO Precheck verification agent.</Say>
  <Pause length="1"/>
  <Dial>
    <Conference 
      statusCallbackEvent="start join leave end"
      statusCallback="${this.getBaseUrl()}/api/conference/participant-status"
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
      startConferenceOnEnter="false"
      endConferenceOnExit="true"
      record="record-from-start"
      recordingStatusCallback="${recordCb}"
      recordingStatusCallbackMethod="POST"
    >${conferenceName}</Conference>
  </Dial>
  <Say voice="alice">The agent is not available. Please try again later.</Say>
</Response>`;

      console.log(`Caller ${callerNumber} joining conference ${conferenceName}`);
      return twiml;

    } catch (error) {
      console.error('Failed to add caller to conference:', error);
      throw new Error('Failed to add caller to conference');
    }
  }

  // Get conference participants (simplified - no API calls)
  async getConferenceParticipants(conferenceName: string): Promise<any[]> {
    console.log(`Getting participants for conference: ${conferenceName}`);
    // Return empty array - participants tracked via status callbacks
    return [];
  }

  // End conference (simplified - conferences end automatically)
  async endConference(conferenceName: string): Promise<boolean> {
    console.log(`Conference ${conferenceName} will end when all participants leave`);
    return true;
  }

  private getBaseUrl(): string {
    return PRODUCTION_URL;
  }
}

export const twilioConferenceService = new TwilioConferenceService();