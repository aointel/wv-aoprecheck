// Taalk API SMS service for campaign-based messaging

interface TaalkContact {
  phone: string;
  firstName: string;
  lastName: string;
}

interface TaalkCampaignRequest {
  append?: TaalkContact[];
  update?: Record<string, TaalkContact>;
  remove?: string[];
  shuffle?: boolean;
}

class TaalkService {
  private apiKey: string | undefined;
  private baseUrl: string | undefined;
  private phoneNumber: string | undefined;
  private clientUrl: string | undefined;
  private agentUrl: string | undefined;
  private campaignId: string = '6747819a86c131c2cb203719'; // AO Precheck verification campaign

  constructor() {
    this.apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    this.baseUrl = "https://api.taalk.ai/api";
    this.phoneNumber = "+17044442221";
    this.clientUrl = "https://7bca9330-8d56-4d64-a5d4-a459b57b16a3-00-2imcowqw6vcjz.picard.replit.dev/client-verify";
    this.agentUrl = "https://7bca9330-8d56-4d64-a5d4-a459b57b16a3-00-2imcowqw6vcjz.picard.replit.dev/agent-verify";
  }

  private isConfigured(): boolean {
    return !!(this.apiKey && this.baseUrl && this.phoneNumber && this.clientUrl && this.agentUrl);
  }

  async addContactToCampaign(phone: string, firstName: string, lastName: string, sessionId?: string, clientName?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Taalk not configured, skipping contact addition');
      return false;
    }

    try {
      const contact: TaalkContact = {
        phone: this.formatPhoneForTaalk(phone),
        firstName: firstName || 'Client',
        lastName: lastName || 'Verification'
      };

      const requestBody: any = {
        append: [contact]
      };

      // Add client verification message if sessionId and clientName are provided
      if (sessionId && clientName) {
        const clientLink = `${this.clientUrl}/${sessionId}`;
        requestBody.message = `AO Precheck Verification for ${clientName}. Please visit: ${clientLink} to approve verification before your call. This is for your use only.`;
      }

      const response = await fetch(`${this.baseUrl}/campaign2s/${this.campaignId}/contacts?db=michaelmandella`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to add contact to Taalk campaign:', response.status, errorText);
        console.error('Request URL:', `${this.baseUrl}/campaign2s/${this.campaignId}/contacts?db=michaelmandella`);
        console.error('Headers:', { 'Authorization': 'Bearer [REDACTED]', 'Content-Type': 'application/json' });
        console.error('Request body:', JSON.stringify(requestBody));
        return false;
      }

      const responseText = await response.text();
      console.log('Taalk API Response Status:', response.status);
      console.log('Taalk Request URL:', `${this.baseUrl}/campaign2s/${this.campaignId}/contacts?db=michaelmandella`);
      console.log('Taalk API Response:', responseText.substring(0, 500));
      
      try {
        const result = JSON.parse(responseText);
        console.log('Successfully added contact to Taalk campaign:', contact.phone);
        console.log('Taalk response:', result);
        return true;
      } catch (parseError) {
        console.error('Failed to parse Taalk response as JSON');
        console.error('Response was:', responseText.substring(0, 200));
        return false;
      }

    } catch (error) {
      console.error('Error adding contact to Taalk campaign:', error);
      return false;
    }
  }

  async sendVerificationSMS(phone: string, sessionId: string, clientName: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Taalk not configured, skipping SMS send');
      return false;
    }

    try {
      // Extract first and last name from clientName
      const nameParts = clientName.trim().split(' ');
      const firstName = nameParts[0] || 'Client';
      const lastName = nameParts.slice(1).join(' ') || 'Verification';

      // Add contact to campaign with verification message (this will trigger SMS if campaign is active)
      const success = await this.addContactToCampaign(phone, firstName, lastName, sessionId, clientName);
      
      if (success) {
        console.log(`Taalk SMS initiated for ${clientName} at ${phone}`);
        console.log(`Contact added to campaign: ${this.campaignId}`);
      }

      return success;

    } catch (error) {
      console.error('Failed to send Taalk SMS:', error);
      return false;
    }
  }

  private formatPhoneForTaalk(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Ensure E.164 format: +15032018470
    if (digits.length === 10) {
      const formatted = `+1${digits}`;
      console.log(`Phone formatting: "${phoneNumber}" -> "${formatted}"`);
      return formatted;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      const formatted = `+${digits}`;
      console.log(`Phone formatting: "${phoneNumber}" -> "${formatted}"`);
      return formatted;
    }
    
    // Return with + prefix if not already there
    const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+1${digits}`;
    console.log(`Phone formatting: "${phoneNumber}" -> "${formatted}"`);
    return formatted;
  }

  // Set custom campaign ID if needed
  setCampaignId(campaignId: string): void {
    this.campaignId = campaignId;
  }

  // Get current configuration status
  getStatus(): { configured: boolean; campaignId: string; clientUrl?: string; agentUrl?: string } {
    return {
      configured: this.isConfigured(),
      campaignId: this.campaignId,
      clientUrl: this.clientUrl,
      agentUrl: this.agentUrl
    };
  }

  // Get the agent URL for QR codes and agent mobile access
  getAgentUrl(sessionId: string): string {
    return `${this.agentUrl}/${sessionId}`;
  }

  // Get the client URL for SMS messages
  getClientUrl(sessionId: string): string {
    return `${this.clientUrl}/${sessionId}`;
  }
}

export const taalkService = new TaalkService();