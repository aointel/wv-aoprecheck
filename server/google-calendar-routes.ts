import express from "express";
import { oauth2, calendar, isGoogleCalendarEnabled } from "./google-oauth";
import { upsertUserTokens, getUserTokens } from "./token-store";

import { supabase } from "./supabase";
import crypto from "crypto";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export const router = express.Router();

// CSRF protection - simplified for better reliability in Replit environment
const csrfTokens = new Map<string, { state: string, timestamp: number, userEmail?: string }>();

// Clean up expired tokens every 10 minutes, keeping tokens for 1 hour
setInterval(() => {
  const now = Date.now();
  const expireTime = 60 * 60 * 1000; // 1 hour (increased timeout)
  
  console.log(`🔧 CSRF token cleanup - checking ${csrfTokens.size} tokens`);
  
  for (const [key, value] of csrfTokens.entries()) {
    if (now - value.timestamp > expireTime) {
      console.log(`🗑️ Cleaning up expired CSRF token: ${key.substring(0, 8)}...`);
      csrfTokens.delete(key);
    }
  }
  
  console.log(`✅ CSRF token cleanup complete - ${csrfTokens.size} tokens remaining`);
}, 10 * 60 * 1000); // Clean every 10 minutes instead of 5

// Feature flag guard middleware - disabled for calendar file creation
const checkEnabled = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Always allow calendar file creation
  next();
};

router.get("/auth-url", (req, res) => {
  try {
    // Generate CSRF token
    const state = crypto.randomBytes(32).toString('hex');
    const userEmail = (req.session as any)?.user?.email;
    
    // Store token data with simplified key (just use state as key)
    const tokenData = { 
      state, 
      timestamp: Date.now(),
      userEmail 
    };
    
    csrfTokens.set(state, tokenData);
    
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });
    
    console.log('🗓️ Generated Google Calendar auth URL with CSRF state:', {
      userEmail,
      stateKey: state.substring(0, 8) + '...' + state.substring(-8),
      stateLength: state.length,
      timestamp: new Date(tokenData.timestamp).toISOString(),
      totalTokensStored: csrfTokens.size
    });
    
    res.json({ 
      success: true,
      authUrl: url 
    });
  } catch (error: any) {
    console.error('❌ Error generating auth URL:', error);
    res.status(500).json({ error: "Failed to generate auth URL: " + error.message });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    
    if (!code) {
      return res.status(400).send("Missing authorization code");
    }
    
    // Enhanced CSRF token verification with debugging
    const tokenData = csrfTokens.get(state);
    
    console.log('🔍 OAuth callback state verification:', {
      stateReceived: state?.substring(0, 8) + '...' + state?.substring(-8),
      tokenFound: !!tokenData,
      availableStates: Array.from(csrfTokens.keys()).map(k => k.substring(0, 8) + '...' + k.substring(-8)),
      tokenDataState: tokenData?.state?.substring(0, 8) + '...' + tokenData?.state?.substring(-8),
      stateMatches: tokenData?.state === state,
      tokensCount: csrfTokens.size
    });
    
    if (!tokenData) {
      console.error('❌ CSRF token not found in memory - generating fresh token or server restart?');
      // Instead of failing, redirect back to setup page with error
      return res.redirect('/dashboard/google-calendar-setup?error=session_expired');
    }
    
    if (tokenData.state !== state) {
      console.error('❌ CSRF token state mismatch');
      return res.redirect('/dashboard/google-calendar-setup?error=invalid_state');
    }
    
    console.log('✅ CSRF token verified successfully for state:', state.substring(0, 8) + '...');
    
    // Clean up used CSRF token
    csrfTokens.delete(state);
    
    const { tokens } = await oauth2.getToken(code);
    
    // Get user ID from session/auth - use actual logged in user
    const userId = (req.session as any)?.user?.email;
    
    // Convert Google tokens to our format
    const googleTokens = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      scope: tokens.scope || undefined,
      token_type: tokens.token_type || undefined,
      expiry_date: tokens.expiry_date || undefined,
    };
    
    await upsertUserTokens(userId, googleTokens);
    
    console.log('✅ Google Calendar OAuth callback successful');
    
    // Send success message to popup parent window
    res.send(`
      <script>
        try {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            tokens: ${JSON.stringify(tokens)}
          }, window.location.origin);
          setTimeout(() => window.close(), 1000);
        } catch (e) {
          console.error('Failed to communicate with parent window:', e);
        }
      </script>
      <h1>✅ Google Calendar Connected Successfully!</h1>
      <p>You can close this window now.</p>
    `);
  } catch (error: any) {
    console.error('❌ OAuth callback error:', error);
    
    // Send error message to popup parent window
    res.status(500).send(`
      <script>
        try {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: '${error.message || 'Authentication failed'}'
          }, window.location.origin);
          setTimeout(() => window.close(), 1000);
        } catch (e) {
          console.error('Failed to communicate with parent window:', e);
        }
      </script>
      <h1>❌ Authentication Failed</h1>
      <p>Error: ${error.message || 'Unknown error occurred'}</p>
      <p>You can close this window.</p>
    `);
  }
});

async function withAuth(userId: string) {
  const tokens = await getUserTokens(userId);
  if (!tokens) {
    throw new Error('Not authenticated with Google Calendar. Please authenticate first.');
  }
  
  oauth2.setCredentials(tokens);
  return calendar();
}

router.get("/events", async (req, res) => {
  try {
    // Get user ID from session/auth - use actual logged in user
    const userId = (req.session as any)?.user?.email;
    
    console.log('🔍 DEBUG: google-calendar-routes events endpoint called with userId:', userId);
    
    const cal = await withAuth(userId);
    const { data } = await cal.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100, // Increased to get more events
    });
    
    console.log('✅ Retrieved', data.items?.length || 0, 'Google Calendar events');
    
    if (!data.items || data.items.length === 0) {
      return res.json({
        success: true,
        message: 'No events found in Google Calendar',
        events: [],
        totalEvents: 0
      });
    }

    // Format events for calendar display (don't create CRM records)
    const formattedEvents = data.items.map(event => ({
      id: `google-${event.id}`,
      title: event.summary || 'Google Calendar Event',
      description: event.description || '',
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      duration: event.start?.dateTime && event.end?.dateTime ? 
        Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / (1000 * 60)) : 60,
      source: 'google_calendar',
      googleEventId: event.id,
      googleEventLink: event.htmlLink,
      attendees: event.attendees || [],
      location: event.location || '',
      isGoogleEvent: true,
      // Don't include CRM-specific fields
      status: 'confirmed',
      agentEmail: userId,
      meetingPlatform: 'google_calendar'
    }));

    console.log('🔍 DEBUG: Sending formatted response with', formattedEvents.length, 'events');
    res.json({
      success: true,
      message: `Successfully fetched ${formattedEvents.length} Google Calendar events for display`,
      events: formattedEvents,
      totalEvents: formattedEvents.length
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching events:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/events/quick", async (req, res) => {
  try {
    // Get user ID from session/auth - use actual logged in user
    const userId = (req.session as any)?.user?.email;
    
    const cal = await withAuth(userId);
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later
    
    const { data } = await cal.events.insert({
      calendarId: "primary",
      requestBody: { 
        summary: "ConnectNow Test Event", 
        description: "Test event created by ConnectNow application",
        start: { dateTime: start.toISOString() }, 
        end: { dateTime: end.toISOString() } 
      },
    });
    
    console.log('✅ Created Google Calendar test event:', data.htmlLink);
    res.json({ 
      success: true,
      created: data.htmlLink,
      eventId: data.id,
      summary: data.summary
    });
  } catch (error: any) {
    console.error('❌ Error creating quick event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create appointment event
router.post("/events/appointment", async (req, res) => {
  try {
    const userId = (req.session as any)?.user?.email;
    const { 
      summary, 
      description, 
      startTime, 
      endTime, 
      attendeeEmail,
      location 
    } = req.body;
    
    if (!summary || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing required fields: summary, startTime, endTime" });
    }
    
    const cal = await withAuth(userId);
    const { data } = await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary,
        description: description || '',
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
        location: location || '',
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours
            { method: 'popup', minutes: 15 }       // 15 minutes
          ],
        },
      },
    });
    
    console.log('✅ Created appointment in Google Calendar:', data.htmlLink);
    
    // If we have an appointmentId, update the database record with sync info
    if (appointmentId) {
      try {
        // Use Supabase instead of direct PostgreSQL
        const { error: updateError } = await supabase
          .from('appointments')
          .update({
            google_calendar_event_id: data.id,
            google_calendar_sync_status: 'synced',
            google_calendar_synced_at: new Date().toISOString(),
            google_calendar_html_link: data.htmlLink,
            google_calendar_sync_error: null
          })
          .eq('id', appointmentId);
        
        if (updateError) {
          console.error('❌ Error updating appointment record in Supabase:', updateError);
        } else {
          console.log('✅ Updated appointment record with Google Calendar sync info');
        }
      } catch (dbError) {
        console.error('❌ Error updating appointment record:', dbError);
      }
    }
    
    res.json({
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
      summary: data.summary,
      startTime: data.start?.dateTime,
      endTime: data.end?.dateTime
    });
  } catch (error: any) {
    console.error('❌ Error creating appointment:', error);
    
    // If we have an appointmentId, update the database record with error info
    if (appointmentId) {
      try {
        // Use Supabase instead of direct PostgreSQL
        const { error: updateError } = await supabase
          .from('appointments')
          .update({
            google_calendar_sync_status: 'failed',
            google_calendar_sync_error: error.message
          })
          .eq('id', appointmentId);
        
        if (updateError) {
          console.error('❌ Error updating appointment record with error in Supabase:', updateError);
        }
      } catch (dbError) {
        console.error('❌ Error updating appointment record with error:', dbError);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Sync appointment (alias for events/appointment for frontend compatibility)
router.post("/sync-appointment", async (req, res) => {
  try {
    const userId = (req.session as any)?.user?.email;
    const { 
      title,
      description, 
      startTime, 
      endTime, 
      attendeeEmail,
      location,
      appointmentId,
      leadName,
      leadPhone,
      leadId
    } = req.body;
    
    console.log('🗓️ Creating appointment and calendar file:', { userId, title, startTime, endTime, appointmentId });
    
    if (!title || !startTime || !endTime) {
      console.log('❌ Missing required fields:', { title, startTime, endTime });
      return res.status(400).json({ error: "Missing required fields: title, startTime, endTime" });
    }
    
    // Save appointment to database first
    const db = pgPool;
    const appointmentData = {
      title: title,
      description: description || '',
      start_time: startTime,
      end_time: endTime,
      agent_email: userId,
      agent_name: 'Agent',
      lead_name: leadName || 'Client',
      lead_phone: leadPhone || '',
      lead_email: attendeeEmail || '',
      lead_id: leadId || appointmentId,
      meeting_platform: 'aoi_intelligence',
      status: 'scheduled',
      google_calendar_sync_status: 'ics_created'
    };
    
    // Use Supabase instead of direct PostgreSQL
    const { data: insertResult, error: insertError } = await supabase
      .from('appointments')
      .insert({
        title: appointmentData.title,
        description: appointmentData.description,
        start_time: appointmentData.start_time,
        end_time: appointmentData.end_time,
        agent_email: appointmentData.agent_email,
        agent_name: appointmentData.agent_name,
        lead_name: appointmentData.lead_name,
        lead_phone: appointmentData.lead_phone,
        lead_email: appointmentData.lead_email,
        lead_id: appointmentData.lead_id,
        meeting_platform: appointmentData.meeting_platform,
        status: appointmentData.status,
        google_calendar_sync_status: appointmentData.google_calendar_sync_status
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Error inserting appointment into Supabase:', insertError);
      throw new Error('Failed to save appointment to database');
    }
    
    const savedAppointmentId = insertResult.id;
    
    // Generate ICS file content
    const startDate = new Date(startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `appointment-${savedAppointmentId}@aointelligence.com`;
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AO Intelligence//ConnectNow//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${title}
DESCRIPTION:${description || 'AO Intelligence Appointment'}
LOCATION:${location || 'Virtual Meeting'}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Appointment reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;
    
    console.log('✅ Appointment saved to database with ID:', savedAppointmentId);
    
    // Set headers for ICS file download
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${savedAppointmentId}.ics"`);
    res.send(icsContent);
  } catch (error: any) {
    console.error('❌ Error syncing appointment:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Check authentication status
router.get("/status", async (req, res) => {
  try {
    const userId = (req.session as any)?.user?.email;
    const tokens = await getUserTokens(userId);
    
    res.json({
      authenticated: !!tokens,
      hasRefreshToken: !!(tokens?.refresh_token),
      enabled: isGoogleCalendarEnabled()
    });
  } catch (error: any) {
    console.error('❌ Error checking status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect Google Calendar
router.post("/disconnect", async (req, res) => {
  try {
    const userId = (req.session as any)?.user?.email;
    // Remove tokens from database (implement removeUserTokens)
    // await removeUserTokens(userId);
    
    console.log('🗓️ Disconnected Google Calendar for user:', userId.slice(0, 8) + '...');
    res.json({ success: true, message: "Google Calendar disconnected" });
  } catch (error: any) {
    console.error('❌ Error disconnecting:', error);
    res.status(500).json({ error: error.message });
  }
});