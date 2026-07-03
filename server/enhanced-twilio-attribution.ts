// Enhanced Twilio Call Attribution System
// Embeds agent email in every outbound call for perfect tracking

import twilio from 'twilio';

interface CallOptions {
  to: string;
  from: string;
  agentEmail: string;
  agentIdentity?: string;
  callSource?: string;
  url?: string;
  twiml?: string;
}

export class EnhancedTwilioAttribution {
  private client: any;
  
  constructor() {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = require("./hardcoded-config");
    
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
  }
  
  // Create outbound call with embedded agent email tracking
  async createTrackedCall(options: CallOptions) {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }
    
    const baseUrl = 'https://aoirail-production-baa2.up.railway.app';
    
    console.log(`📞 ENHANCED ATTRIBUTION: Creating call for ${options.agentEmail}`);
    
    // Extract state from phone if available
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
    const callParams: any = {
      from: options.from,
      to: options.to,
      record: true,
      recordingStatusCallback: `${baseUrl}/api/twilio/recording-status`,
      recordingStatusCallbackMethod: 'POST',
      statusCallback: `${baseUrl}/api/twilio/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      // EMBED AGENT EMAIL AND METADATA FOR PERFECT TRACKING
      metadata: {
        agent_email: options.agentEmail,
        agent_identity: options.agentIdentity || options.agentEmail,
        call_source: options.callSource || 'enhanced_attribution',
        tracking_purpose: 'agent_attribution',
        timestamp: new Date().toISOString()
      }
    };
    
    // Add URL or TwiML based on what's provided
    if (options.url) {
      callParams.url = options.url;
      callParams.method = 'POST';
    } else if (options.twiml) {
      callParams.twiml = options.twiml;
    } else {
      // Default TwiML for connection
      callParams.url = `${baseUrl}/api/twilio/conference-connect?agentEmail=${encodeURIComponent(options.agentEmail)}`;
      callParams.method = 'POST';
    }
    
    try {
      const call = await this.client.calls.create(callParams);
      
      console.log(`✅ ENHANCED ATTRIBUTION: Call created with agent tracking`);
      console.log(`   Agent: ${options.agentEmail}`);
      console.log(`   Call SID: ${call.sid}`);
      console.log(`   From: ${options.from} To: ${options.to}`);
      
      return {
        sid: call.sid,
        status: call.status,
        agentEmail: options.agentEmail,
        metadata: callParams.metadata
      };
      
    } catch (error) {
      console.error('❌ ENHANCED ATTRIBUTION: Call creation failed:', error);
      throw error;
    }
  }
  
  // Extract agent email from call metadata
  static extractAgentFromCall(call: any): string | null {
    // Check metadata first (new method)
    if (call.metadata && call.metadata.agent_email) {
      return call.metadata.agent_email;
    }
    
    // Fallback to phone number mapping (existing method)
    const fromNumber = call.from;
    
    if (fromNumber === '+16052500834' || fromNumber === '+19142289324') {
      return 'davidfulfer@aoglobelife.com';
    } else if (fromNumber && fromNumber.includes('+1605')) {
      return 'davidfulfer@aoglobelife.com';
    } else if (fromNumber && fromNumber.includes('+1')) {
      return 'kingsleyibeh@aoglobelife.com';
    }
    
    return null;
  }
}

export const enhancedTwilioAttribution = new EnhancedTwilioAttribution();
