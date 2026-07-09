import type { Request, Response } from 'express';
import { storage } from './storage';
import { localPresenceService } from './local-presence-service';

interface TaalkCallRequest {
  sessionId: string;
  clientPhone?: string;
  clientName?: string;
  verificationMethod?: string;
  premium?: number;
  location?: string;
  clientCountry?: string;
  clientRegion?: string;
  clientCity?: string;
  associateId?: number; // 🎯 Add associate_id to interface
}

export async function initiateTaalkCall(req: Request, res: Response) {
  try {
    const {
      sessionId,
      clientPhone,
      clientName,
      verificationMethod,
      premium,
      location,
      clientCountry,
      clientRegion,
      clientCity,
      associateId: requestAssociateId,
    }: TaalkCallRequest = req.body;

    // Get the logged-in agent's email for proper call attribution
    const agentEmail = (req as any).user?.email || 'unknown@aoglobelife.com';
    console.log('🔍 AGENT ATTRIBUTION: Taalk call initiated by:', agentEmail);
    
    // 🚨 CRITICAL: CHECK CREDITS BEFORE ALLOWING CALL
    const { supabaseAdmin } = await import('./supabase');
    const { data: creditsData } = await supabaseAdmin
      .from('user_credits')
      .select('credits_remaining')
      .eq('email', agentEmail)
      .maybeSingle();
    
    const creditsRemaining = creditsData?.credits_remaining || 0;
    
    if (creditsRemaining < 0) {
      console.log(`🚫 CALL BLOCKED: ${agentEmail} has ${creditsRemaining} credits (NEGATIVE - ANY negative is blocked)`);
      return res.status(403).json({
        error: 'Insufficient credits',
        creditsRemaining,
        message: 'Your account has insufficient credits. Please add credits to continue making calls.'
      });
    }
    
    console.log(`✅ Credit check passed: ${agentEmail} has ${creditsRemaining} credits`);
    
    // 🚨 CRITICAL: GET ASSOCIATE_ID FROM MULTIPLE SOURCES WITH PRIORITY
    let associateId = requestAssociateId || session?.associateId || null;
    
    if (associateId) {
      console.log(`🎯 TAALK HANDLER - Using associate_id: ${associateId} for ${agentEmail} (source: ${requestAssociateId ? 'request' : 'session'})`);
    } else {
      // Fallback: lookup associate_id from Supabase if not in session
      try {
        const { supabaseAdmin } = await import('./supabase');
        const normalizedEmail = agentEmail.trim().toLowerCase();
        
        const { data: customerData, error: lookupError } = await supabaseAdmin
          .from('customers')
          .select('associate_id, company_email, email')
          .or(`company_email.ilike.${normalizedEmail},email.ilike.${normalizedEmail}`)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lookupError) {
          console.error(`❌ TAALK HANDLER - Failed to lookup associate_id for ${agentEmail}:`, lookupError);
          return res.status(400).json({
            error: 'Agent not found',
            details: `Cannot make verification call - no associate_id found for ${agentEmail}`
          });
        }
        
        associateId = customerData?.associate_id;
        console.log(`🔄 TAALK HANDLER - Looked up associate_id: ${associateId} for ${agentEmail}`);
        
        if (!associateId) {
          console.error(`❌ TAALK HANDLER - No associate_id for ${agentEmail} - cannot proceed`);
          return res.status(400).json({
            error: 'Invalid agent profile',
            details: `Agent ${agentEmail} has no associate_id - cannot make verification calls`
          });
        }
      } catch (error) {
        console.error('❌ TAALK HANDLER - Error looking up associate_id:', error);
        return res.status(500).json({
          error: 'Database error',
          details: 'Failed to verify agent credentials'
        });
      }
    }

    if (!clientPhone) {
      return res.status(400).json({ 
        error: 'Client phone number is required',
        details: 'Missing clientPhone in request body'
      });
    }

    // Get session to check language and client approval
    const session = await storage.getVerificationSession(sessionId);
    
    // CRITICAL: Block verification call without client approval
    if (!session || session.clientApprovalStatus !== 'approved') {
      console.error('🚫 VERIFICATION BLOCKED: Client has not approved verification disclaimer');
      return res.status(403).json({ 
        error: 'Client approval required',
        details: 'Cannot proceed with verification until client hits "I Agree and Approve"',
        clientApprovalStatus: session?.clientApprovalStatus || 'not_found'
      });
    }
    
    console.log('✅ CLIENT APPROVAL VERIFIED: Proceeding with verification call');
    
    // Get agent profile for agent data
    const agentProfile = await storage.getAgentProfile();
    
    // Get agent data from session data (saved from Agent Setup modal) - validate against placeholder strings
    const isValidAgentFirstName = session?.agentFirstName && 
                                  session.agentFirstName.toLowerCase() !== 'agent' && 
                                  session.agentFirstName.toLowerCase() !== 'agentfirstname' &&
                                  session.agentFirstName.trim().length > 0;
    
    const isValidAgentLastName = session?.agentLastName && 
                                session.agentLastName.toLowerCase() !== 'name' && 
                                session.agentLastName.toLowerCase() !== 'agentlastname' &&
                                session.agentLastName.trim().length > 0;
    
    const agentFirstName = isValidAgentFirstName ? session.agentFirstName : (agentProfile?.firstName || 'Agent');
    const agentLastName = isValidAgentLastName ? session.agentLastName : (agentProfile?.lastName || 'Name');
    const agentPhone = session?.agentPhone || agentProfile?.phone || '';
    const zoomRoomId = session?.zoomRoomId || agentProfile?.zoomId || '123456789';
    const zoomPassword = session?.zoomPassword || agentProfile?.zoomPassword || '1';

    console.log('📋 AGENT NAME DEBUGGING:', {
      sessionAgentFirstName: session?.agentFirstName,
      sessionAgentLastName: session?.agentLastName,
      profileFirstName: agentProfile?.firstName,
      profileLastName: agentProfile?.lastName,
      finalAgentFirstName: agentFirstName,
      finalAgentLastName: agentLastName,
      sessionIdDebug: sessionId
    });
    
    console.log('🔧 AGENT DATA DEBUG:', {
      sessionAgentPhone: session?.agentPhone,
      profileAgentPhone: agentProfile?.phone,
      finalAgentPhone: agentPhone,
      sessionZoomRoomId: session?.zoomRoomId,
      profileZoomId: agentProfile?.zoomId,
      finalZoomRoomId: zoomRoomId,
      sessionZoomPassword: session?.zoomPassword,
      finalZoomPassword: zoomPassword,
      sessionId: sessionId
    });
    
    // Split client name
    const [firstName, lastName] = (clientName || '').split(' ');
    
    // Use different agent/persona IDs based on verification language and country
    const TAALK_AGENT_ID_ENGLISH_US = '68a5ff0fc8f1520e59acf3e6';
    const TAALK_PERSONA_ID_ENGLISH_CANADA = '6939bec41bac8ebe2572f833'; // Canada English persona
    const TAALK_AGENT_ID_SPANISH = '66461a241e0b08270180af7a'; // Same for US and Canada Spanish
    
    // Determine if this is a Canada session
    const isCanada = clientCountry?.toLowerCase() === 'canada' || clientCountry?.toLowerCase() === 'can';
    const isSpanish = session?.language === 'es';
    
    // Select agent/persona ID based on country and language
    let TAALK_AGENT_ID: string;
    if (isSpanish) {
      // Spanish: same agent for US and Canada
      TAALK_AGENT_ID = TAALK_AGENT_ID_SPANISH;
    } else {
      // English: use Canada persona for Canada, US agent for US
      TAALK_AGENT_ID = isCanada ? TAALK_PERSONA_ID_ENGLISH_CANADA : TAALK_AGENT_ID_ENGLISH_US;
    }
    
    console.log('🌐 LANGUAGE & COUNTRY ROUTING:', {
      sessionLanguage: session?.language,
      clientCountry: clientCountry,
      isCanada: isCanada,
      isSpanish: isSpanish,
      selectedAgentId: TAALK_AGENT_ID,
      personaType: isCanada && !isSpanish ? 'Canada English Persona' : isSpanish ? 'Spanish Agent' : 'US English Agent'
    });
    
    // Get local presence number based on client's region/state
    const clientState = clientRegion || 'TX'; // Use clientRegion or default to TX
    const localNumber = localPresenceService.getLocalNumber(clientState);
    console.log(`🔍 TAALK: Using local presence number ${localNumber} for ${clientState} client: ${clientName}`);
    
    // Set up Taalk API configuration
    const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    const taalkCampaignId = "6747819a86c131c2cb203719"; // WORKING Campaign ID for verification calls
    
    // Prepare Taalk API call parameters in correct format for campaign2s endpoint
    const taalkParams = {
      append: [{
        phone: localNumber, // Use local presence number instead of hardcoded 605
        firstName: agentFirstName,
        lastName: agentLastName
      }],
      // Include all script variables as custom fields - exact same as zoom track
      Taalk_AgentFirstName: agentFirstName,
      Taalk_AgentLastName: agentLastName,
      Taalk_AgentPhone: agentPhone,
      Taalk_ZoomId: zoomRoomId || '',
      Taalk_ZoomPassword: zoomPassword || '1',
      
      // Client fields from session
      Taalk_MemberFirstName: firstName || '',
      Taalk_PMemberFirstName: firstName || '', // Primary member same as first name
      Taalk_ClientName: clientName || '',
      Taalk_ClientPhone: clientPhone || '',
      Taalk_MonthlyPremium: premium?.toString() || '',
      Taalk_Location: location || '',
      Taalk_ClientCountry: clientCountry || '',
      Taalk_ClientRegion: clientRegion || '',
      Taalk_ClientCity: clientCity || '',
      
      // Session metadata
      Taalk_SessionId: sessionId,
      Taalk_VerificationMethod: verificationMethod || '',
      Taalk_CallTimestamp: new Date().toISOString(),
      Taalk_CompanyName: 'Globe Life AIL Division',
    };

    // ALWAYS use the dedicated Zoom conference number 2532158782 (Seattle) for ALL verification calls
    let phoneNumber = `2532158782,,${zoomRoomId}#,,#,,${zoomPassword}#`;
    console.log('🔄 VERIFICATION CALL - ALWAYS using Seattle 253 number:', phoneNumber);
    
    console.log('📞 VERIFICATION CALL ROUTING:', {
      agentPhone: agentPhone,
      clientPhone: clientPhone,
      callingNumber: phoneNumber,
      verificationMethod: verificationMethod,
      message: 'Agent gets verification call, client info in script data'
    });

    console.log('🔥 Taalk call initiated:', {
      verificationMethod: verificationMethod,
      callingNumber: phoneNumber, // Shows formatted ZOOM number or default agent line
      clientDataFor: clientPhone, // Client data for script variables
      agent: TAALK_AGENT_ID,
      campaign: taalkCampaignId,
      sessionId: sessionId,
      endpoint: 'https://api.taalk.ai/api/call?db=michaelmandella'
    });

    console.log('🔍 TAALK WEBHOOK DATA BEING SENT - EXACT SAME AS ZOOM TRACK:', {
      agentFirstName: agentFirstName,
      agentLastName: agentLastName,
      Taalk_AgentFirstName: agentFirstName,
      Taalk_AgentLastName: agentLastName,
      separateFields: 'Using agent setup data exactly like zoom track'
    });

    // Make direct call request to Taalk API for immediate calling using exact API spec
    const callParams = {
      name: clientName || 'Verification Client', 
      phone: phoneNumber, // Use formatted phone number for ZOOM or default for other methods
      agent: TAALK_AGENT_ID, // Agent ID (Spanish or English based on session language)
      retryMethod: 0,
      webhookUrl: process.env.VERIFICATION_BASE_URL
        ? `${process.env.VERIFICATION_BASE_URL}/api/taalk/webhook`
        : `https://aoprecheck-production.up.railway.app/api/taalk/webhook`, // Taalk completion webhook
      params: {
        // All script variables exactly as specified - use agent setup data exactly like zoom track
        Taalk_AgentFirstName: agentFirstName,
        Taalk_AgentLastName: agentLastName,
        Taalk_AgentPhone: agentPhone,
        Taalk_ZoomId: zoomRoomId || '123456789', // From session data
        Taalk_ZoomPassword: zoomPassword || '1', // From session data
        Taalk_MemberFirstName: firstName || '',
        Taalk_MemberFiirstName: firstName || '', // Script typo version
        Taalk_MemberPhone: clientPhone || '', // Client contact number
        Taalk_PMemberFirstName: firstName || '',
        MemberFirstName: firstName || '', // Used in script without Taalk_ prefix
        Taalk_ClientName: clientName || '',
        Taalk_ClientPhone: clientPhone || '',
        Taalk_MonthlyPremium: premium?.toString() || '',
        Taalk_ALP: premium?.toString() || '', // Script uses {Taalk_ALP} for monthly amount
        Taalk_ACHdrawdate: session?.achDrawDate || '', // Full ACH draw date
        Taalk_ACHdrawdateshort: session?.achDrawDateShort || '', // Short ACH draw date
        Taalk_Location: location || '',
        Taalk_ClientCountry: clientCountry || '',
        Taalk_ClientRegion: clientRegion || '',
        Taalk_ClientCity: clientCity || '',
        Taalk_SessionId: sessionId, // This will be passed to webhook
        Taalk_VerificationMethod: verificationMethod || '',
        Taalk_CallTimestamp: new Date().toISOString(),
        Taalk_CompanyName: 'Globe Life AIL Division',
        Taalk_AgentEmail: agentEmail, // ✅ ADD AGENT EMAIL FOR PROPER ATTRIBUTION
        Taalk_AssociateId: associateId?.toString() || '', // 🎯 CRITICAL: PASS ASSOCIATE_ID FOR PROPER AGENT IDENTIFICATION
      }
    };
    
    console.log('🚀 EXACT TAALK API PAYLOAD BEING SENT:');
    console.log('Endpoint:', `https://api.taalk.ai/api/call?db=michaelmandella`);
    console.log('Method:', 'POST');
    console.log('Headers:', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${taalkApiKey.substring(0, 20)}...`
    });
    console.log('PAYLOAD:', JSON.stringify(callParams, null, 2));
    
    const taalkResponse = await fetch(`https://api.taalk.ai/api/call?db=michaelmandella`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${taalkApiKey}`,
      },
      body: JSON.stringify(callParams)
    });

    if (!taalkResponse.ok) {
      const errorData = await taalkResponse.text();
      console.error('❌ Taalk API error:', errorData);
      return res.status(500).json({ 
        error: 'Failed to initiate call via Taalk',
        details: errorData,
        taalkStatus: taalkResponse.status
      });
    }

    const taalkResult = await taalkResponse.json();
    console.log('✅ Taalk call initiated successfully:', taalkResult);

    // Store call initiation details for tracking
    const callInitiatedAt = new Date().toISOString();
    
    // Update session with call details
    const updatedSession = await storage.getVerificationSession(sessionId);
    if (updatedSession) {
      const taalkCallId = taalkResult.id || taalkResult.call_id || `taalk_${Date.now()}`;
      console.log('Taalk call initiated:', {
        callId: taalkCallId,
        status: 'initiated',
        initiatedAt: callInitiatedAt,
        sessionId: sessionId
      });
      
      await storage.updateVerificationSession(sessionId, {
        taalkCallId: taalkCallId,
        taalkCallStatus: 'initiated',
        taalkCallInitiatedAt: callInitiatedAt,
        taalkCallData: JSON.stringify(taalkResult)
      });
      console.log(`✅ Updated session ${sessionId} with Taalk call initiation data`);
    }

    res.json({
      success: true,
      message: 'Call initiated successfully',
      taalkResponse: taalkResult,
      callId: taalkResult.id || taalkResult.call_id,
      sessionId: sessionId,
      clientPhone: clientPhone,
      initiatedAt: callInitiatedAt
    });

  } catch (error) {
    console.error('❌ Error initiating Taalk call:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}