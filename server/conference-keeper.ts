// Use fetch API instead of Twilio SDK to avoid require() issues
import { HARDCODED_CONFIG } from './hardcoded-config';

const accountSid = HARDCODED_CONFIG.TWILIO_ACCOUNT_SID;
const authToken = HARDCODED_CONFIG.TWILIO_AUTH_TOKEN; // Use AUTH_TOKEN for API calls, not API_SECRET
const twilioPhone = HARDCODED_CONFIG.TWILIO_PHONE_NUMBER;

// Helper to make Twilio API calls directly
async function makeTwilioCall(twiml: string, to: string, from: string) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      Twiml: twiml,
      To: to,
      From: from,
    }),
  });

  if (!response.ok) {
    throw new Error(`Twilio API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function endTwilioCall(callSid: string) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      Status: 'completed',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to end call: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

class ConferenceKeeper {
  private keeperCallSid: string | null = null;
  private isActive = false;
  private conferenceName = 'AO-Verification-Live';

  // Create a persistent background call to keep conference alive
  async startConferenceKeeper() {
    if (this.isActive) {
      console.log('Conference keeper already active');
      return;
    }

    try {
      console.log('Starting conference keeper to maintain persistent conference...');

      // Create a background call that joins the conference and stays there
      const currentDomain = 'policy-verify-mmandella.replit.app';
      const protocol = 'https';

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="86400">
    <Conference 
      statusCallbackEvent="start join leave"
      statusCallback="${protocol}://${currentDomain}/api/twilio/conference-status"
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      beep="false"
      muted="true">${this.conferenceName}</Conference>
  </Dial>
</Response>`;

      // Use a client identifier for the background conference keeper
      const call = await makeTwilioCall(twiml, 'client:conference-keeper', twilioPhone!);

      this.keeperCallSid = call.sid;
      this.isActive = true;

      console.log(`Conference keeper started with call SID: ${call.sid}`);
      console.log('Conference is now persistent and ready for incoming calls');

    } catch (error) {
      console.error('Failed to start conference keeper:', error);
    }
  }

  // Stop the conference keeper
  async stopConferenceKeeper() {
    if (!this.isActive || !this.keeperCallSid) {
      console.log('Conference keeper not active');
      return;
    }

    try {
      await endTwilioCall(this.keeperCallSid);
      this.keeperCallSid = null;
      this.isActive = false;
      console.log('Conference keeper stopped');
    } catch (error) {
      console.error('Failed to stop conference keeper:', error);
    }
  }

  // Check if keeper is active
  isKeeperActive(): boolean {
    return this.isActive;
  }

  // Get conference status
  getStatus() {
    return {
      active: this.isActive,
      callSid: this.keeperCallSid,
      conferenceName: this.conferenceName
    };
  }
}

export const conferenceKeeper = new ConferenceKeeper();