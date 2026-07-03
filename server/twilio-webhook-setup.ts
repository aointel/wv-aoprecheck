import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } from './hardcoded-config';

const INBOUND_NUMBERS_LAST10 = ['6096048379', '6095473687'] as const;
// Dev branch: all webhooks point to baa2.
const DEV_BASE = WEBHOOK_BASE_URL;
const PROD_BASE = WEBHOOK_BASE_URL;

export class TwilioWebhookSetup {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  /** Returns true if number (e.g. +16096048379) is a dedicated inbound number. */
  private isInboundNumber(phoneNumber: string): boolean {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    return (INBOUND_NUMBERS_LAST10 as readonly string[]).includes(digits.slice(-10));
  }

  /**
   * Configure webhooks for all phone numbers.
   * Gold inbound numbers (8379, 3687) always point to the dedicated /incomingcall webhook.
   */
  async setupWebhook() {
    try {
      console.log('🔍 Finding available phone numbers from Twilio account...');
      const allNumbers = await this.client.incomingPhoneNumbers.list({ limit: 10 });

      if (allNumbers.length === 0) {
        throw new Error('No phone numbers available in this Twilio account');
      }

      // 1) Ensure ALL inbound numbers point to the dedicated /incomingcall webhook
      const inboundNumbers = allNumbers.filter((n) => this.isInboundNumber(n.phoneNumber || ''));
      for (const inbound of inboundNumbers) {
        const devVoiceUrl = `${DEV_BASE}/incomingcall`;
        const devStatusCallback = `${DEV_BASE}/api/twilio/call-status`;
        await this.client.incomingPhoneNumbers(inbound.sid).update({
          voiceUrl: devVoiceUrl,
          voiceMethod: 'POST',
          statusCallback: devStatusCallback,
          statusCallbackMethod: 'POST',
          voiceApplicationSid: '',
        });
        console.log(`✅ Inbound number ${inbound.phoneNumber} -> dedicated inbound webhook (${devVoiceUrl}) — TwiML App cleared`);
      }

      // 2) Point first *non-inbound* number to production (for outbound / TwiML app behavior)
      const targetNumber = allNumbers.find((n) => !this.isInboundNumber(n.phoneNumber || ''));
      if (!targetNumber) {
        console.log('📱 Only inbound number(s) in list — no number set to production.');
        return { success: true, phoneNumbers: inboundNumbers.map((n) => n.phoneNumber), webhookUrl: DEV_BASE + '/incomingcall', message: `Inbound only; ${inboundNumbers.length} number(s) pointed at /incomingcall.` };
      }

      const phoneNumber = targetNumber.phoneNumber;
      const webhookUrl = `${PROD_BASE}/webhook/webrtc`;
      const statusCallback = `${PROD_BASE}/api/twilio/call-status`;

      console.log(`📱 Configuring non-inbound number: ${phoneNumber} -> production`);
      const updatedNumber = await this.client.incomingPhoneNumbers(targetNumber.sid).update({
        voiceUrl: webhookUrl,
        voiceMethod: 'POST',
        statusCallback,
        statusCallbackMethod: 'POST',
      });

      console.log(`✅ Webhook configured: ${phoneNumber} -> ${updatedNumber.voiceUrl}`);
      return {
        success: true,
        phoneNumber,
        webhookUrl: updatedNumber.voiceUrl,
        statusCallback: updatedNumber.statusCallback,
        sid: targetNumber.sid,
      };
    } catch (apiError: any) {
      console.error('Twilio API error:', apiError);
      if (apiError?.status === 401 || apiError?.code === 20003) {
        return {
          success: false,
          requiresManualSetup: true,
          webhookUrl: PROD_BASE + '/webhook/webrtc',
          instructions: 'Set webhook in Twilio Console',
        };
      }
      throw apiError;
    }
  }

  // Get current webhook configuration
  async getWebhookConfig() {
    try {
      const phoneNumber = '+16052500834';
      
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber
      });

      if (phoneNumbers.length === 0) {
        return { error: `Phone number ${phoneNumber} not found` };
      }

      const config = phoneNumbers[0];
      return {
        phoneNumber: config.phoneNumber,
        voiceUrl: config.voiceUrl,
        voiceMethod: config.voiceMethod,
        statusCallback: config.statusCallback,
        statusCallbackMethod: config.statusCallbackMethod
      };

    } catch (error) {
      console.error('Failed to get webhook config:', error);
      throw error;
    }
  }
}

export const twilioWebhookSetup = new TwilioWebhookSetup();