import { Request, Response } from 'express';
import twilio from 'twilio';
import { localPresenceService } from './local-presence-service.js';
import { TwilioCallLogger } from './twilio-call-logger';
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";

// Helper function to update masterlead last_contacted timestamp
async function updateMasterleadLastContacted(leadPhoneNumber: string, agentEmail?: string) {
  try {
    const cleanPhone = leadPhoneNumber.replace(/\D/g, '');
    const last10 = cleanPhone.slice(-10);
    const { data, error } = await masterleadClient.from('masterlead')
      .update({ last_contacted: new Date().toISOString() })
      .ilike('phone', `%${last10}%`)
      .select('id');
    if (error) throw error;
    const updated = data?.length || 0;
    console.log(`✅ Updated masterlead last_contacted for phone: ${cleanPhone} (rows=${updated})`);
  } catch (error) {
    console.error('❌ Error updating lead last_contacted:', error);
  }
}

// Extract state from phone number area code
function extractStateFromPhoneNumber(phoneNumber: string): string | null {
  // Remove all non-digits
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Get area code (first 3 digits after country code if present)
  let areaCode = '';
  if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
    areaCode = cleanNumber.substring(1, 4);
  } else if (cleanNumber.length === 10) {
    areaCode = cleanNumber.substring(0, 3);
  } else {
    return null;
  }

  // Basic area code to state mapping for common codes
  const areaCodeMap: { [key: string]: string } = {
    '503': 'OR', '971': 'OR', '541': 'OR',
    '206': 'WA', '253': 'WA', '360': 'WA', '425': 'WA', '509': 'WA', '564': 'WA',
    '415': 'CA', '510': 'CA', '650': 'CA', '408': 'CA', '831': 'CA', '925': 'CA',
    '213': 'CA', '323': 'CA', '424': 'CA', '661': 'CA', '818': 'CA', '747': 'CA',
    '832': 'TX', '713': 'TX', '281': 'TX', '409': 'TX', '979': 'TX', '346': 'TX',
    '214': 'TX', '469': 'TX', '972': 'TX', '945': 'TX', '903': 'TX', '430': 'TX',
    '212': 'NY', '347': 'NY', '646': 'NY', '718': 'NY', '917': 'NY', '929': 'NY',
    '518': 'NY', '585': 'NY', '607': 'NY', '631': 'NY', '716': 'NY', '845': 'NY',
    '305': 'FL', '786': 'FL', '954': 'FL', '754': 'FL', '561': 'FL', '728': 'FL',

    // North Carolina (critical for local presence matching)
    '252': 'NC', '336': 'NC', '704': 'NC', '743': 'NC', '828': 'NC', '910': 'NC',
    '919': 'NC', '980': 'NC', '984': 'NC'
  };

  return areaCodeMap[areaCode] || null;
}

export async function twilioDial(req: Request, res: Response) {
  console.log('📞 Dial endpoint called with body:', req.body);
  console.log('📞 Request headers:', req.headers);
  
  const { To, Caller, From } = req.body;
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  
  // Set proper Content-Type for TwiML
  res.set('Content-Type', 'text/xml');
  
  // CRITICAL FIX: If no Caller parameter, this is likely a registration issue
  if (!Caller) {
    console.log('📞 No Caller parameter - returning simple TwiML for registration test');
    twiml.say('Hello from Twilio. Connection test successful.');
    res.send(twiml.toString());
    return;
  }

  // Check if this is a WebRTC client call (Caller starts with 'client:')
  if (Caller && Caller.startsWith('client:')) {
    console.log('📞 CALL CONNECTOR PRO: WebRTC client call detected - initiating outbound call to lead');
    console.log('📞 TwiML request details:', { To, Caller, From });
    
    // For WebRTC calls, use the To parameter (lead phone number) from device.connect({ To: leadPhone })
    const leadPhoneNumber = To || '+15032018470'; // Fallback to test number if no To provided
    console.log('📞 CALL CONNECTOR PRO: Target lead phone number:', leadPhoneNumber);
    
    const bodyLeadState = String(req.body.leadState || req.body.lead_state || '').trim();
    const leadName = String(req.body.leadName || req.body.lead_name || '').trim();
    const leadId = String(req.body.leadId || req.body.lead_id || '').trim();
    const taalkLeadId = String(req.body.taalkLeadId || req.body.taalk_lead_id || '').trim();
    const assignmentId = String(req.body.assignmentId || req.body.assignment_id || '').trim();

    // Extract state from lead phone number or use Oregon as default
    const leadState = bodyLeadState || extractStateFromPhoneNumber(leadPhoneNumber) || 'OR';
    console.log('📞 CALL CONNECTOR PRO: Lead state detected as:', leadState);
    
    // Get local presence number for the lead's state
    const localNumber = localPresenceService.getLocalNumber(leadState, leadPhoneNumber);
    console.log('📞 CALL CONNECTOR PRO: Using local presence number:', localNumber, 'for', leadState, 'lead');
    
    // Create outbound call with Auth Token so recording is not blocked (API keys can restrict recording)
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PRODUCTION_URL } = require("./hardcoded-config");
    
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      
      // Update masterlead last_contacted timestamp before making the call
      let agentEmail = Caller ? Caller.replace('client:', '') : undefined;
      
      // Extract agent email from identity if it's a valid email format
      if (agentEmail && !agentEmail.includes('@')) {
        console.warn(`⚠️ Invalid agent email format (no @): ${agentEmail} - setting to undefined`);
        agentEmail = undefined;
      }
      
      // CRITICAL: If we can't extract agent email, we can't log the call properly
      if (!agentEmail) {
        console.error(`❌ CRITICAL: No agent email found for Call Connector Pro call! Caller: ${Caller}`);
        console.error(`❌ Cannot log call without agent email - call will be attributed to system@aoglobelife.com`);
      }
      
      console.log(`🎯 EXTRACTED AGENT EMAIL FROM CALLER: ${agentEmail || 'MISSING - WILL DEFAULT TO SYSTEM'}`);
      // Defer DB: fire-and-forget, never block TwiML response
      void updateMasterleadLastContacted(leadPhoneNumber, agentEmail);
    }

    // DIRECT DIAL — agent WebRTC calls lead directly using local presence number as caller ID.
    // No conference, no second leg, no callbacks to our server before connection.
    const recordCb = (PRODUCTION_URL || '').replace(/\/$/, '') + '/api/twilio/recording-status';
    const agentEmailEncoded = encodeURIComponent(
      (Caller || '').replace('client:', '').includes('@') ? (Caller || '').replace('client:', '') : 'unknown@aoglobelife.com'
    );
    // Use /api/twilio/dial-action which returns <Hangup/> TwiML immediately.
    // This is critical — when a number is bad/disconnected Twilio fires the action URL
    // and waits for TwiML before dropping the call. Returning 204 (call-status) caused delays.
    const callbackParams = new URLSearchParams({
      agentEmail: (Caller || '').replace('client:', '').includes('@') ? (Caller || '').replace('client:', '') : 'unknown@aoglobelife.com',
      leadPhone: leadPhoneNumber,
      leadState,
      localPresenceFrom: localNumber,
    });
    if (leadName) callbackParams.set('leadName', leadName);
    if (leadId) callbackParams.set('leadId', leadId);
    if (taalkLeadId) callbackParams.set('taalkLeadId', taalkLeadId);
    if (assignmentId) callbackParams.set('assignmentId', assignmentId);
    const callbackQuery = callbackParams.toString();
    const dialActionUrl = (PRODUCTION_URL || '').replace(/\/$/, '') + '/api/twilio/dial-action?' + callbackQuery;
    const statusCallbackUrl = (PRODUCTION_URL || '').replace(/\/$/, '') + '/api/twilio/call-status?' + callbackQuery;

    const dial = twiml.dial({
      callerId: localNumber,        // local presence — same area code as lead
      timeout: 20,                  // 20s ring timeout
      record: 'record-from-answer',
      recordingStatusCallback: recordCb,
      recordingStatusCallbackMethod: 'POST',
      action: dialActionUrl,        // returns <Hangup/> immediately — no more waiting
      method: 'POST',
    });
    dial.number(leadPhoneNumber, {
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'] as any,
    });

    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  // Handle conference connection for two-way calling (record every conference)
  if (conferenceName && participantType === 'agent') {
    console.log(`🎧 Agent WebRTC joining conference: ${conferenceName}`);
    const { PRODUCTION_URL: prodUrl } = require("./hardcoded-config");
    const recordCbAgent = (prodUrl || '').replace(/\/$/, '') + '/api/twilio/recording-status';
    const dial = twiml.dial();
    dial.conference({
      startConferenceOnEnter: false,
      endConferenceOnExit: false,
      beep: 'false',
      maxParticipants: 2,
      record: 'record-from-start',
      recordingStatusCallback: recordCbAgent,
      recordingStatusCallbackMethod: 'POST',
    }, conferenceName);
    
    return res.type('text/xml').send(twiml.toString());
  }

  // Original logic for other calls
  if (!To) {
    console.error('❌ Missing "To" parameter in request body:', req.body);
    return res.status(400).send('Missing "To" parameter');
  }

  console.log('📞 Dial endpoint called - dialing:', To);

  // Defer DB: do not block TwiML response
  void updateMasterleadLastContacted(To);

  // Use local presence for dial caller ID; record every call
  const leadState = extractStateFromPhoneNumber(To) || 'TX';
  const localNumber = localPresenceService.getLocalNumber(leadState, To);
  console.log(`🔍 TWILIO-DIAL: Using local presence number ${localNumber} for ${leadState} caller ID`);
  const { PRODUCTION_URL: prodUrl } = require("./hardcoded-config");
  const recordCb = (prodUrl || '').replace(/\/$/, '') + '/api/twilio/recording-status';
  const { PRODUCTION_URL: prodUrlFallback } = require("./hardcoded-config");
  const dialActionFallback = (prodUrlFallback || '').replace(/\/$/, '') + '/api/twilio/dial-action';
  const dial = twiml.dial({
    callerId: localNumber,
    timeout: 20,
    record: 'record-from-answer',
    recordingStatusCallback: recordCb,
    recordingStatusCallbackMethod: 'POST',
    action: dialActionFallback,
    method: 'POST',
  });
  dial.number(To);

  res.type('text/xml');
  res.send(twiml.toString());
}