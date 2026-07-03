import twilio from 'twilio';
import { TwilioCallLogger } from './twilio-call-logger';
import { formatToE164 } from './phone-utils';
import { localPresenceService } from './local-presence-service';
import { 
  TWILIO_ACCOUNT_SID, 
  TWILIO_AUTH_TOKEN, 
  TWILIO_PHONE_NUMBER,
  PRODUCTION_URL,
} from './hardcoded-config';

const PRODUCTION_BASE_URL = PRODUCTION_URL;

const accountSid = TWILIO_ACCOUNT_SID;
const authToken = TWILIO_AUTH_TOKEN;
const twilioPhone = TWILIO_PHONE_NUMBER;

export interface CallData {
  sessionId: string;
  clientName: string;
  clientPhone: string;
  spouseName?: string | null;
  city: string;
  state: string;
  premium: string;
  verificationMethod: string;
}

export class TwilioCallService {
  private client: twilio.Twilio | null = null;
  private twilioPhoneNumber: string = '';

  constructor() {
    console.log('Twilio credentials check:', {
      accountSid: accountSid ? `${accountSid.substring(0, 10)}...` : 'MISSING',
      authToken: authToken ? `${authToken.substring(0, 10)}...` : 'MISSING',
      twilioPhone: twilioPhone || 'MISSING'
    });

    if (!accountSid || !authToken || !twilioPhone) {
      console.warn('⚠️ Missing Twilio credentials - running in demo mode');
      console.warn('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER for full functionality');
      // Don't throw error, allow server to start in demo mode
      return;
    }

    // Format Twilio phone number to E.164
    this.twilioPhoneNumber = formatToE164(twilioPhone);
    
    this.client = twilio(accountSid, authToken);
  }

  async initiateVerificationCall(data: CallData, agentEmail?: string): Promise<{ success: boolean; callSid?: string; error?: string }> {
    try {
      if (!this.client) {
        console.log('🔄 Demo mode: Simulating call to +15032018470:', data);
        return {
          success: true,
          callSid: `DEMO-${Date.now()}`
        };
      }
      console.log('Initiating Twilio call to verification number +15032018470:', data);

      const verificationNumber = '+15032018470';

      // Create TwiML for the call with client information
      const twimlUrl = await this.createTwimlUrl(data);

      // Use local presence for verification calls
      const localNumber = localPresenceService.getLocalNumber(data.state || 'TX');
      console.log(`🔍 CALL-SERVICE: Using local presence number ${localNumber} for ${data.state || 'TX'} verification call`);

      // Make the call using Twilio
      const call = await this.client.calls.create({
        to: verificationNumber,
        from: localNumber,
        url: twimlUrl,
        method: 'GET',
        record: true,
        recordingStatusCallback: `${PRODUCTION_BASE_URL}/api/twilio/recording-status`,
        recordingStatusCallbackMethod: 'POST',
        statusCallback: `${PRODUCTION_BASE_URL}/api/twilio/call-status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        // CRITICAL: Include agent email in metadata for attribution
        metadata: {
          agent_email: agentEmail || 'unknown@aoglobelife.com',
          call_source: 'verification_call',
          client_name: data.clientName,
          client_phone: data.clientPhone,
          verification_method: data.verificationMethod,
          tracking_purpose: 'agent_attribution'
        }
      });

      console.log('Twilio call initiated successfully:', call.sid);

      // LOG CALL WITH PROPER ATTRIBUTION IMMEDIATELY
      await TwilioCallLogger.logCall({
        twilioCallSid: call.sid,
        direction: 'outbound',
        fromNumber: localNumber,
        toNumber: verificationNumber,
        status: call.status,
        ownerEmail: agentEmail || 'unknown@aoglobelife.com',
        agentIdentity: agentEmail,
        callStartedAt: new Date().toISOString(),
        callSource: 'verification_call',
        metadata: {
          agent_email: agentEmail,
          call_source: 'verification_call',
          client_name: data.clientName,
          client_phone: data.clientPhone,
          verification_method: data.verificationMethod
        }
      });

      return {
        success: true,
        callSid: call.sid
      };

    } catch (error) {
      console.error('Twilio call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async createTwimlUrl(data: CallData): Promise<string> {
    // Use Replit domain for production or create inline TwiML
    const baseUrl = process.env.REPLIT_DEV_DOMAIN ? 
      `https://${process.env.REPLIT_DEV_DOMAIN}` : 
      'https://your-replit-app.replit.app';
    return `${baseUrl}/api/twilio/twiml?sessionId=${data.sessionId}&clientName=${encodeURIComponent(data.clientName)}&clientPhone=${encodeURIComponent(data.clientPhone)}`;
  }

  async createCall(options: { to: string; from: string; twiml: string; agentEmail?: string; agentIdentity?: string; ownerEmail?: string; leadState?: string }): Promise<{ sid: string; status: string }> {
    try {
      if (!this.client) {
        console.log('🔄 Demo mode: Simulating call to', options.to);
        return {
          sid: `DEMO-${Date.now()}`,
          status: 'initiated'
        };
      }

      console.log('Creating Twilio call:', options.to);

      // Extract state from phone if not provided
      const extractStateFromPhone = (phone: string): string | null => {
        const clean = phone.replace(/\D/g, '');
        let areaCode = '';
        if (clean.length === 11 && clean.startsWith('1')) areaCode = clean.substring(1, 4);
        else if (clean.length === 10) areaCode = clean.substring(0, 3);
        else return null;
        const areaCodeMap: { [key: string]: string } = {
          '503': 'OR', '971': 'OR', '541': 'OR', '206': 'WA', '253': 'WA', '360': 'WA', '425': 'WA', '509': 'WA', '564': 'WA',
          '415': 'CA', '510': 'CA', '650': 'CA', '408': 'CA', '831': 'CA', '925': 'CA', '213': 'CA', '323': 'CA', '424': 'CA', '661': 'CA', '818': 'CA', '747': 'CA',
          '832': 'TX', '713': 'TX', '281': 'TX', '409': 'TX', '979': 'TX', '346': 'TX', '214': 'TX', '469': 'TX', '972': 'TX', '945': 'TX', '903': 'TX', '430': 'TX',
          '212': 'NY', '347': 'NY', '646': 'NY', '718': 'NY', '917': 'NY', '929': 'NY', '518': 'NY', '585': 'NY', '607': 'NY', '631': 'NY', '716': 'NY', '845': 'NY',
          '305': 'FL', '786': 'FL', '954': 'FL', '754': 'FL', '561': 'FL', '728': 'FL'
        };
        return areaCodeMap[areaCode] || null;
      };
      const call = await this.client.calls.create({
        to: options.to,
        from: options.from,
        twiml: options.twiml,
        record: true,
        recordingStatusCallback: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : PRODUCTION_BASE_URL}/api/twilio/recording-status`,
        recordingStatusCallbackMethod: 'POST',
        statusCallback: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : PRODUCTION_BASE_URL}/api/twilio/call-status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        // EMBED AGENT EMAIL FOR TRACKING
        metadata: {
          agent_email: options.agentEmail || 'unknown',
          agent_identity: options.agentIdentity || 'unknown',
          call_source: 'twilio_call_service',
          tracking_purpose: 'agent_attribution'
        }
      });

      console.log('Twilio call created successfully:', call.sid);
      
      // LOG EVERY CALL TO SUPABASE WITH OWNER ATTRIBUTION
      await TwilioCallLogger.logCall({
        twilioCallSid: call.sid,
        direction: 'outbound',
        fromNumber: options.from,
        toNumber: options.to,
        status: call.status,
        ownerEmail: options.ownerEmail || options.agentEmail || 'unknown',
        agentIdentity: options.agentIdentity,
        callStartedAt: new Date().toISOString(),
        callSource: 'twilio_call_service',
        metadata: {
          agent_email: options.agentEmail,
          agent_identity: options.agentIdentity
        }
      });

      return {
        sid: call.sid,
        status: call.status
      };

    } catch (error) {
      console.error('Twilio call creation failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  async getCallStatus(callSid: string): Promise<{ status: string; duration?: number }> {
    try {
      if (!this.client) {
        return { status: 'demo' };
      }
      const call = await this.client.calls(callSid).fetch();
      return {
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : undefined
      };
    } catch (error) {
      console.error('Failed to get call status:', error);
      return { status: 'unknown' };
    }
  }
}

export const twilioCallService = new TwilioCallService();
