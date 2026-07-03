import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from './hardcoded-config';

const accountSid = TWILIO_ACCOUNT_SID;
const authToken = TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = TWILIO_PHONE_NUMBER;

class SMSService {
  private client: twilio.Twilio | null = null;

  constructor() {
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendVerificationSMS(phone: string, sessionId: string, clientName: string): Promise<boolean> {
    if (!this.client || !twilioPhoneNumber) {
      console.warn('Twilio not configured, skipping SMS send');
      return false;
    }

    // Format phone number to E.164 format
    const formattedPhone = this.formatToE164(phone);
    console.log(`Phone formatting: "${phone}" -> "${formattedPhone}"`);

    try {
      // Alternative message for carrier delivery issues
      const message = `Hi ${clientName}, your agent is completing verification. Please contact them directly. AO Precheck`;

      const result = await this.client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: formattedPhone,
      });

      console.log('SMS sent successfully:', result.sid);
      console.log('SMS status:', result.status);
      console.log('SMS from:', result.from);
      console.log('SMS to:', result.to);
      return true;
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      if (error.code === 21266) {
        console.error('ERROR: Cannot send SMS to the same number that is sending. Use a different client phone number.');
      }
      if (error.code === 21608) {
        console.error('ERROR: Trial account can only send to verified numbers. Verify the phone number in Twilio Console.');
      }
      return false;
    }
  }

  // Format phone number to E.164 format (+1XXXXXXXXXX)
  private formatToE164(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle US phone numbers
    if (digits.length === 10) {
      // Add US country code (+1)
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // Already has country code
      return `+${digits}`;
    }
    
    // Return as-is if already formatted or international
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    // Fallback - assume US number if 10 digits
    return `+1${digits}`;
  }

  // Send appointment invite via SMS
  async sendAppointmentInvite(
    phone: string, 
    clientName: string, 
    meetingLink: string, 
    appointmentTime: Date,
    agentName?: string,
    agentEmail?: string
  ): Promise<boolean> {
    if (!this.client || !twilioPhoneNumber) {
      console.warn('Twilio not configured, skipping SMS send');
      return false;
    }

    const formattedPhone = this.formatToE164(phone);
    console.log(`Sending appointment invite to: "${phone}" -> "${formattedPhone}"`);

    try {
      const timeStr = appointmentTime.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Filter out "undefined undefined" or empty agentName, fallback to agentEmail if available
      let cleanAgentName = agentName && agentName.trim() && !agentName.includes('undefined') ? agentName.trim() : null;
      if (!cleanAgentName && agentEmail) {
        cleanAgentName = agentEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
      }
      const message = `Hi ${clientName}, your virtual appointment${cleanAgentName ? ` with ${cleanAgentName}` : ''} is scheduled for ${timeStr}. Join here: ${meetingLink}`;

      const result = await this.client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: formattedPhone,
      });

      console.log('Appointment invite SMS sent successfully:', result.sid);
      return true;
    } catch (error: any) {
      console.error('Failed to send appointment invite SMS:', error);
      return false;
    }
  }

  // Generic SMS sending method
  async sendSMS(phone: string, message: string): Promise<boolean> {
    if (!this.client || !twilioPhoneNumber) {
      console.warn('Twilio not configured, skipping SMS send');
      return false;
    }

    const formattedPhone = this.formatToE164(phone);
    console.log(`Sending SMS to: "${phone}" -> "${formattedPhone}"`);

    try {
      const result = await this.client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: formattedPhone,
      });

      console.log('SMS sent successfully:', result.sid);
      return true;
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      return false;
    }
  }

  generateVerificationCode(): string {
    // Generate a 6-digit numeric verification code instead of random alphanumeric
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const smsService = new SMSService();
export default smsService;