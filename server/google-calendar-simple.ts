import { google } from 'googleapis';

// Simple Google Calendar integration following the working pattern  
const CLIENT_ID = '207338471615-skdt0vvt7emcjnobcn2e2o77vur3mc8t.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://aoirail-production-baa2.up.railway.app/auth/google/callback';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Simple OAuth2 client following your example pattern
const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// In-memory token storage (for demo - replace with DB per user in production)
let STORED_TOKENS: any = null;

export class SimpleGoogleCalendarService {
  // Generate auth URL
  getAuthUrl(): string {
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });
  }

  // Handle OAuth callback
  async handleCallback(authCode: string) {
    try {
      const { tokens } = await oauth2.getToken(authCode);
      STORED_TOKENS = tokens;
      oauth2.setCredentials(tokens);
      return { success: true, tokens };
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  }

  // Get Calendar instance
  private getCalendar() {
    if (!STORED_TOKENS) {
      throw new Error('Not authenticated. Complete OAuth flow first.');
    }
    oauth2.setCredentials(STORED_TOKENS);
    return google.calendar({ version: 'v3', auth: oauth2 });
  }

  // List upcoming events
  async getEvents(maxResults: number = 10) {
    try {
      const calendar = this.getCalendar();
      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return data.items || [];
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Create a quick event
  async createEvent(eventData: {
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendeeEmail?: string;
  }) {
    try {
      const calendar = this.getCalendar();
      const { data } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: eventData.summary,
          description: eventData.description || '',
          start: { dateTime: eventData.startTime },
          end: { dateTime: eventData.endTime },
          attendees: eventData.attendeeEmail ? [{ email: eventData.attendeeEmail }] : [],
        },
      });
      return data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!STORED_TOKENS;
  }

  // Set tokens (for existing user tokens)
  setTokens(tokens: any) {
    STORED_TOKENS = tokens;
    oauth2.setCredentials(tokens);
  }

  // Clear stored tokens (for disconnecting)
  clearTokens() {
    STORED_TOKENS = null;
    oauth2.setCredentials({});
  }
}

export const simpleGoogleCalendarService = new SimpleGoogleCalendarService();
