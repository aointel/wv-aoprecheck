import twilio from 'twilio';
import { 
  TWILIO_ACCOUNT_SID, 
  TWILIO_AUTH_TOKEN, 
  TWILIO_API_KEY, 
  TWILIO_API_SECRET, 
  TWILIO_TWIML_APP_SID,
  PRODUCTION_URL,
} from './hardcoded-config';

export class WebRTCPhoneService {
  private client: twilio.Twilio | null = null;
  private webrtcPhoneNumber: string;

  constructor() {
    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('⚠️ Missing Twilio credentials for WebRTC - running in demo mode');
      this.webrtcPhoneNumber = '+16052500834';
      return;
    }

    this.client = twilio(accountSid, authToken);
    // Use the 605 number specifically for Taalk calls  
    this.webrtcPhoneNumber = '+16052500834'; // Fixed 605 number for Taalk integration
  }

  // Configure webhook URL for incoming calls to WebRTC number
  async configureWebRTCNumber(webhookUrl: string) {
    try {
      if (!this.client) {
        console.log('🔄 Demo mode: WebRTC number configuration skipped');
        return true;
      }
      
      console.log(`Configuring WebRTC number ${this.webrtcPhoneNumber} with webhook: ${webhookUrl}`);
      
      // Get the phone number resource
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({
        phoneNumber: this.webrtcPhoneNumber
      });

      if (phoneNumbers.length > 0) {
        const phoneNumberSid = phoneNumbers[0].sid;
        
        // Update the phone number to use our WebRTC webhook
        await this.client.incomingPhoneNumbers(phoneNumberSid).update({
          voiceUrl: `${webhookUrl}/api/webrtc/incoming-call`,
          voiceMethod: 'POST',
          statusCallback: `${webhookUrl}/api/webrtc/call-status`,
          statusCallbackMethod: 'POST'
        });

        console.log(`WebRTC number ${this.webrtcPhoneNumber} configured successfully`);
        return true;
      } else {
        console.error(`Phone number ${this.webrtcPhoneNumber} not found in Twilio account`);
        return false;
      }
    } catch (error) {
      console.error('Failed to configure WebRTC phone number:', error);
      return false;
    }
  }

  getWebRTCNumber(): string {
    return this.webrtcPhoneNumber;
  }

  // Create TwiML response for incoming calls to WebRTC
  createIncomingCallTwiML(sessionId?: string): string {
    if (sessionId) {
      const conferenceName = `AO-Verification-${sessionId}`;
      const recordCb = `${this.getBaseUrl()}/api/twilio/recording-status`;
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting to verification agent.</Say>
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
  <Say voice="alice">Agent is not available. Please try again later.</Say>
</Response>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">No verification session is currently active. Please contact your agent to start a new session.</Say>
  <Hangup/>
</Response>`;
    }
  }

  private getBaseUrl(): string {
    return PRODUCTION_URL;
  }

  // Generate access token for WebRTC client
  async generateAccessToken(identity: string): Promise<string> {
    try {
      if (!this.client) {
        console.log('🔄 Demo mode: Generating mock access token');
        return `DEMO_WEBRTC_TOKEN_${Date.now()}_${identity}`;
      }
      
      const accountSid = TWILIO_ACCOUNT_SID;
      const apiKey = TWILIO_API_KEY;
      const apiSecret = TWILIO_API_SECRET;
      
      // If no API key/secret, create a simple capability token
      if (!apiKey || !apiSecret) {
        console.log('Using Twilio Client Capability token (legacy mode)');
        const capability = new twilio.jwt.ClientCapability({
          accountSid,
          authToken: TWILIO_AUTH_TOKEN,
        });

        // Allow incoming connections
        capability.addScope(new twilio.jwt.ClientCapability.IncomingClientScope(identity));
        
        // Allow outgoing connections with TwiML app
        capability.addScope(new twilio.jwt.ClientCapability.OutgoingClientScope({
          applicationSid: TWILIO_TWIML_APP_SID || 'AP6134b55047b045b9bf89c5b9c2c6b94e'
        }));

        const token = capability.toJwt();
        console.log(`Generated capability token for identity: ${identity}`);
        return token;
      }

      // Use Access Token for newer SDKs
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: TWILIO_TWIML_APP_SID || 'AP6134b55047b045b9bf89c5b9c2c6b94e',
        incomingAllow: true,
      });

      const token = new AccessToken(accountSid, apiKey, apiSecret, {
        identity: identity,
        ttl: 3600
      });
      
      token.addGrant(voiceGrant);
      
      console.log(`Generated access token for identity: ${identity}`);
      return token.toJwt();

    } catch (error) {
      console.error('Failed to generate access token:', error);
      throw new Error('Access token generation failed');
    }
  }
}

export const webrtcPhoneService = new WebRTCPhoneService();