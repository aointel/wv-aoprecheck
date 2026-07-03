import { Router } from 'express';
import { WHEREBY_API_KEY, HARDCODED_CONFIG } from './hardcoded-config';
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import twilio from 'twilio';

const router = Router();

// Store active meetings for waiting room redirects
const activeMeetings = new Map(); // agentName -> { roomUrl, hostRoomUrl, created }

// Create proper waiting room with locked mode using Whereby Embedded API
// 🔥 CRITICAL: FOR VERIFICATION SESSIONS - ALWAYS CREATE NEW UNIQUE MEETING!
// Each verification session gets its OWN unique Whereby meeting - NO REUSE, NO DUPLICATES!
router.post('/create-meeting', async (req, res) => {
  try {
    const { agentEmail, leadName, leadId, scheduledTime, roomName, meetingId, sessionId } = req.body;
    
    // 🔥 CRITICAL: ALWAYS CREATE NEW MEETING - NO REUSE LOGIC AT ALL!
    // Each call to this endpoint creates a BRAND NEW unique Whereby meeting
    // Verification sessions are SEPARATE from AO Meet - they need unique meetings!
    console.log('🎥 VERIFICATION SESSION: Creating NEW UNIQUE Whereby meeting');
    console.log(`🔥 CRITICAL: Agent: ${agentEmail}, SessionId: ${sessionId || 'N/A'}`);
    console.log('🔥 NO REUSE - Each verification session gets its own unique meeting!');

    // Create proper locked room with Whereby API for real waiting room functionality
    const requestBody = {
      isLocked: false, // Allow host to enter immediately without knocking
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      fields: ['hostRoomUrl'] // Essential for host controls to admit/reject participants
      // Removed recording - not available on all Whereby plans
    };
    
    // ALWAYS use the Whereby API to create real meetings with proper waiting rooms
    // NO REUSE - EVERY CALL CREATES A NEW MEETING
    
    console.log('🎥 Creating NEW Whereby meeting via API (NO REUSE):', {
      agentEmail,
      sessionId: sessionId || 'N/A',
      timestamp: Date.now()
    });
    console.log('📋 Request payload:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://api.whereby.dev/v1/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHEREBY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Whereby API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        requestBody: requestBody
      });
      throw new Error(`Whereby API error: ${response.status} - ${errorText}`);
    }

    const meeting = await response.json();
    
    // Extract meeting ID from room URL
    const url = new URL(meeting.roomUrl);
    const extractedMeetingId = url.pathname.substring(1);
    
    console.log('✅ VERIFICATION SESSION: NEW UNIQUE Whereby meeting created:', {
      roomUrl: meeting.roomUrl,
      hostRoomUrl: meeting.hostRoomUrl,
      meetingId: extractedMeetingId,
      agentEmail: agentEmail,
      sessionId: sessionId || 'N/A',
      timestamp: Date.now()
    });
    
    // 🔥 CRITICAL: DO NOT STORE IN activeMeetings MAP - We don't want reuse!
    // Each verification session gets a completely new meeting - no tracking for reuse
    
    console.log(`✅ NEW UNIQUE Whereby meeting created for verification session - Meeting ID: ${extractedMeetingId}, Agent: ${agentEmail}`);

    // 🔥 NEW: Log presentation to presentation_log table (telemetry only)
    if (leadId && agentEmail) {
      try {
        const { logPresentationStarted } = await import('./presentation-log-tracker');
        
        // Fetch lead data to get taalk_market and determine isPlusLead
        const { data: leadData } = await masterleadClient.from('masterlead')
          .select('id, taalk_market')
          .eq('id', leadId)
          .maybeSingle();
        
        if (leadData) {
          const taalkMarket = leadData.taalk_market || null;
          const isPlusLead = taalkMarket && (
            taalkMarket.toLowerCase() === 'plus lead' || 
            taalkMarket.toLowerCase() === 'plus leads'
          );
          
          await logPresentationStarted(supabaseAdmin, {
            leadId: leadData.id,
            agentEmail: agentEmail,
            taalkMarket: taalkMarket,
            isPlusLead: isPlusLead,
            meetingId: extractedMeetingId,
            source: 'meet',
          });
          console.log(`✅ Presentation logged to presentation_log: lead ${leadId} by ${agentEmail}`);
        }
      } catch (presentationLogError) {
        console.warn('⚠️ Presentation log tracking failed (non-critical):', presentationLogError);
      }
    }

    // Determine if this user should get host access
    const isHost = agentEmail === 'chrislafond@aoglobelife.com' || agentEmail === 'cnsysop@aoglobelife.com';
    console.log(`🎥 Agent ${agentEmail} is ${isHost ? 'HOST' : 'PARTICIPANT'}`);

    res.json({
      success: true,
      meetingId: extractedMeetingId,     // Use extracted meeting ID
      roomUrl: meeting.roomUrl,           // Clients land in waiting room
      hostRoomUrl: meeting.hostRoomUrl,   // Host can admit clients
      viewerRoomUrl: meeting.roomUrl,
      isHost: isHost                      // Flag for frontend to decide which URL to use
    });
    
  } catch (error) {
    console.error('❌ Whereby locked room creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create waiting room',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get meeting for client redirect (if needed)
router.get('/rooms/:agentName', (req, res) => {
  const { agentName } = req.params;
  const meeting = activeMeetings.get(agentName);
  
  if (meeting) {
    res.json({
      success: true,
      roomUrl: meeting.roomUrl,
      agentName
    });
  } else {
    // Always provide the agent's persistent room URL
    const agentRoomUrl = `https://aoi.whereby.com/${agentName}`;
    res.json({
      success: true,
      roomUrl: agentRoomUrl,
      agentName
    });
  }
});

// Send SMS invite via Twilio
router.post('/send-sms', async (req, res) => {
  const { phoneNumber, leadName, agentName, meetingUrl } = req.body;
  
  if (!phoneNumber || !meetingUrl) {
    return res.status(400).json({ success: false, error: 'Missing required fields: phoneNumber, meetingUrl' });
  }

  try {
    // Normalize phone to E.164
    const digits = String(phoneNumber).replace(/\D/g, '');
    const to = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : `+${digits}`;
    
    const name = (leadName || 'there').trim();
    const agent = (agentName || 'your agent').trim();
    const body = `Hi ${name}, ${agent} has invited you to a video meeting. Click to join: ${meetingUrl}`;

    const client = twilio(HARDCODED_CONFIG.TWILIO_ACCOUNT_SID, HARDCODED_CONFIG.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({
      body,
      from: HARDCODED_CONFIG.TWILIO_PHONE_NUMBER,
      to,
    });

    console.log('✅ SMS sent via Twilio:', msg.sid, 'to', to);
    res.json({ success: true, message: 'SMS sent', sid: msg.sid, to });
  } catch (error) {
    console.error('❌ SMS failed:', error);
    res.status(500).json({ success: false, error: 'Failed to send SMS', details: error instanceof Error ? error.message : String(error) });
  }
});

// Send meeting email invite — uses Zapier webhook which can trigger email via Zapier
router.post('/send-meeting-email', async (req, res) => {
  const { to, leadName, agentName, meetingUrl } = req.body;

  if (!to || !meetingUrl) {
    return res.status(400).json({ success: false, error: 'Missing required fields: to, meetingUrl' });
  }

  try {
    // Route through Zapier webhook (handles email delivery)
    const zapierWebhookUrl = 'https://hooks.zapier.com/hooks/catch/2467580/u6o3xar/';
    const name = (leadName || 'there').trim();
    const agent = (agentName || 'your agent').trim();

    const payload = {
      email: to,
      leadName: name,
      agentName: agent,
      meetingUrl,
      subject: `${agent} has invited you to a video meeting`,
      message: `Hi ${name},\n\n${agent} has invited you to join a video meeting.\n\nClick here to join: ${meetingUrl}\n\nSee you there!`,
      type: 'email',
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Zapier webhook failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.text();
    console.log('✅ Email webhook triggered:', result, 'to', to);
    res.json({ success: true, message: 'Email invite sent', to });
  } catch (error) {
    console.error('❌ Email webhook failed:', error);
    res.status(500).json({ success: false, error: 'Failed to send email', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;