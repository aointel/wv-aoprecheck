import { google } from 'googleapis';

// Google Calendar API setup - HARDCODED WORKING CREDENTIALS
const GOOGLE_CLIENT_ID = '207338471615-r3un5a11gfn4khm0ki7r8h0vp7e42ima.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'AP415df22db91ee77801dacc5a8a81937f';
const GOOGLE_REDIRECT_URI = 'https://ca4492cadbbe.ngrok-free.app/auth/google/callback';

// Helper function to get OAuth2 client (simplified pattern from working example)
export function getOAuthClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

// Helper function to get Calendar client
export function getCalendar(auth: any) {
  return google.calendar({ version: 'v3', auth });
}

export class GoogleCalendarService {
  private oauth2Client: any;
  private calendar: any;

  constructor() {
    this.oauth2Client = getOAuthClient();
    this.calendar = getCalendar(this.oauth2Client);
  }

  // Generate Google OAuth URL for user authentication
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokens(authCode: string) {
    try {
      console.log('GoogleCalendarService: Attempting to exchange auth code for tokens...');
      
      // Use the correct method for exchanging auth code for tokens
      const { tokens } = await this.oauth2Client.getToken(authCode);
      console.log('GoogleCalendarService: Successfully received tokens from Google');
      
      if (!tokens || !tokens.access_token) {
        console.error('GoogleCalendarService: No valid access token received');
        throw new Error('No access token received from Google');
      }
      
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('GoogleCalendarService: Error getting Google tokens:', error);
      console.error('GoogleCalendarService: Auth code provided:', authCode?.substring(0, 10) + '...');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Google Calendar authentication failed: ${errorMessage}`);
    }
  }

  // Set user tokens for authenticated requests
  setTokens(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Create appointment in Google Calendar
  async createEvent(appointmentData: {
    summary: string;
    description: string;
    startTime: string;
    endTime: string;
    attendeeEmail?: string;
    location?: string;
  }) {
    try {
      const event = {
        summary: appointmentData.summary,
        description: appointmentData.description,
        location: appointmentData.location || 'ConnectNow Virtual Meeting Room',
        start: {
          dateTime: appointmentData.startTime,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: appointmentData.endTime,
          timeZone: 'America/New_York',
        },
        attendees: appointmentData.attendeeEmail ? [
          { email: appointmentData.attendeeEmail }
        ] : [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours
            { method: 'popup', minutes: 30 }, // 30 minutes
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all',
      });

      return response.data;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw error;
    }
  }

  // Get upcoming events from Google Calendar
  async getUpcomingEvents(maxResults: number = 10) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      throw error;
    }
  }

  // List events within a date range for calendar display
  async listEvents(startDate: Date, endDate: Date) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100, // Limit to prevent overwhelming response
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching Google Calendar events for date range:', error);
      throw error;
    }
  }

  // Update an existing event
  async updateEvent(eventId: string, updates: any) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates,
        sendUpdates: 'all',
      });

      return response.data;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw error;
    }
  }

  // Delete an event
  async deleteEvent(eventId: string) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw error;
    }
  }

  // Sync ConnectNow appointments with Google Calendar
  async syncAppointments(appointments: any[], userTokens: any) {
    this.setTokens(userTokens);
    const results = [];

    for (const appointment of appointments) {
      try {
        const meetingLink = `https://aoirail-production-baa2.up.railway.app/video-meeting?room=${encodeURIComponent(`lead-${appointment.leadId}`)}&agentName=Client&leadName=${encodeURIComponent(appointment.leadName)}`;
        
        const eventData = {
          summary: `AO Intelligence - ${appointment.leadName}`,
          description: `ConnectNow Appointment\n\nClient: ${appointment.leadName}\nPhone: ${appointment.leadPhone}\n\nJoin Meeting: ${meetingLink}`,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          attendeeEmail: appointment.leadEmail,
          location: 'ConnectNow Virtual Meeting Room'
        };

        const googleEvent = await this.createEvent(eventData);
        results.push({
          appointmentId: appointment.id,
          googleEventId: googleEvent.id,
          success: true
        });
      } catch (error) {
        results.push({
          appointmentId: appointment.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    return results;
  }
}

export const googleCalendarService = new GoogleCalendarService();
