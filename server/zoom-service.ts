import axios from 'axios';

interface ZoomMeetingRequest {
  topic: string;
  start_time: string;
  duration: number;
  timezone: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    watermark?: boolean;
    use_pmi?: boolean;
    approval_type?: number;
    audio?: string;
    auto_recording?: string;
    waiting_room?: boolean;
  };
}

interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  host_id: string;
  topic: string;
  start_time: string;
  duration: number;
  timezone: string;
  join_url: string;
  password: string;
  agenda?: string;
  settings: any;
}

export class ZoomService {
  private accessToken: string;
  private baseUrl = 'https://api.zoom.us/v2';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async createMeeting(meetingData: ZoomMeetingRequest): Promise<ZoomMeetingResponse> {
    try {
      console.log('🎥 Creating Zoom meeting:', meetingData.topic);
      
      const response = await axios.post(
        `${this.baseUrl}/users/me/meetings`,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Zoom meeting created:', { 
        id: response.data.id, 
        join_url: response.data.join_url 
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Zoom meeting creation failed:', error);
      throw new Error('Failed to create Zoom meeting');
    }
  }

  async updateMeeting(meetingId: string, meetingData: Partial<ZoomMeetingRequest>): Promise<void> {
    try {
      console.log('🔄 Updating Zoom meeting:', meetingId);
      
      await axios.patch(
        `${this.baseUrl}/meetings/${meetingId}`,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Zoom meeting updated:', meetingId);
    } catch (error) {
      console.error('❌ Zoom meeting update failed:', error);
      throw new Error('Failed to update Zoom meeting');
    }
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting Zoom meeting:', meetingId);
      
      await axios.delete(`${this.baseUrl}/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      console.log('✅ Zoom meeting deleted:', meetingId);
    } catch (error) {
      console.error('❌ Zoom meeting deletion failed:', error);
      throw new Error('Failed to delete Zoom meeting');
    }
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('❌ Failed to get Zoom meeting:', error);
      throw new Error('Failed to retrieve Zoom meeting');
    }
  }

  async getUpcomingMeetings(pageSize: number = 30): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/users/me/meetings`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        params: {
          type: 'upcoming',
          page_size: pageSize,
        },
      });

      return response.data.meetings || [];
    } catch (error) {
      console.error('❌ Failed to get upcoming Zoom meetings:', error);
      throw new Error('Failed to retrieve upcoming meetings');
    }
  }

  static generateAuthUrl(clientId: string, redirectUri: string): string {
    const scopes = 'meeting:write meeting:read user:read';
    const state = `zoom_auth_${Date.now()}`;
    
    return `https://zoom.us/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}`;
  }

  static async getTokens(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    try {
      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error) {
      console.error('❌ Zoom token exchange failed:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }
}

export default ZoomService;