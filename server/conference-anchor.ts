// No imports needed - using built-in fetch
import { HARDCODED_CONFIG } from './hardcoded-config';

/**
 * Conference Anchor Service
 * Keeps a persistent participant in the conference to prevent it from ending
 * when the first caller hangs up
 */

class ConferenceAnchor {
  private anchored = false;
  private anchorCallSid: string | null = null;
  private readonly conferenceName = 'AO-Verification-Live';
  private readonly twilioAccountSid = HARDCODED_CONFIG.TWILIO_ACCOUNT_SID;
  private readonly twilioAuthToken = HARDCODED_CONFIG.TWILIO_AUTH_TOKEN; // Use AUTH_TOKEN for API calls
  private readonly twilioPhoneNumber = HARDCODED_CONFIG.TWILIO_PHONE_NUMBER;

  async createAnchorCall(): Promise<void> {
    if (this.anchored) {
      console.log('Conference anchor already active');
      return;
    }

    try {
      // Create a persistent call that joins the conference and stays there
      const currentDomain = 'policy-verify-mmandella.replit.app';
      const anchorUrl = `https://${currentDomain}/api/twilio/anchor-twiml`;
      
      const formData = new URLSearchParams();
      formData.append('Url', anchorUrl);
      formData.append('To', this.twilioPhoneNumber || '');
      formData.append('From', this.twilioPhoneNumber || '');
      formData.append('Method', 'POST');

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      });

      const result = await response.json() as any;

      if (result.sid) {
        this.anchorCallSid = result.sid;
        this.anchored = true;
        console.log(`✅ Conference anchor created: ${this.anchorCallSid}`);
      } else {
        console.error('❌ Failed to create anchor call:', result);
      }

    } catch (error) {
      console.error('❌ Error creating conference anchor:', error);
    }
  }

  async destroyAnchor(): Promise<void> {
    if (!this.anchored || !this.anchorCallSid) {
      return;
    }

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Calls/${this.anchorCallSid}.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'Status': 'completed'
        })
      });

      console.log(`🔥 Conference anchor destroyed: ${this.anchorCallSid}`);
      this.anchored = false;
      this.anchorCallSid = null;

    } catch (error) {
      console.error('❌ Error destroying anchor:', error);
    }
  }

  getStatus() {
    return {
      anchored: this.anchored,
      anchorCallSid: this.anchorCallSid,
      conferenceName: this.conferenceName
    };
  }
}

export const conferenceAnchor = new ConferenceAnchor();