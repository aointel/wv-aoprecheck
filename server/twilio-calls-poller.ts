/**
 * Twilio Active Calls Poller
 * Polls Twilio API directly for active calls instead of relying on webhooks
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config.js';

interface ActiveCall {
  callSid: string;
  agentEmail: string;
  phoneNumber: string;
  status: string;
  direction: 'inbound' | 'outbound';
  startedAt: Date;
  duration: number;
}

class TwilioCallsPoller {
  private client: twilio.Twilio;
  private activeCalls: Map<string, ActiveCall> = new Map(); // Key: agentEmail
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('📡 Twilio Calls Poller initialized');
    this.startPolling();
  }

  private startPolling() {
    // Poll every 5 seconds
    this.pollInterval = setInterval(() => {
      this.pollActiveCalls();
    }, 5000);

    // Poll immediately on startup
    this.pollActiveCalls();
  }

  private async pollActiveCalls() {
    try {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      
      // Get all calls that started in the last 30 seconds OR are currently in progress
      const calls = await this.client.calls.list({
        status: 'in-progress',
        limit: 100
      });

      // Also get ringing calls
      const ringingCalls = await this.client.calls.list({
        status: 'ringing',
        limit: 100
      });

      const allActiveCalls = [...calls, ...ringingCalls];

      // Clear old calls
      this.activeCalls.clear();

      // Process active calls
      for (const call of allActiveCalls) {
        // Extract agent email from "client:email@domain.com" format
        let agentEmail: string | null = null;
        
        if (call.from && call.from.startsWith('client:')) {
          agentEmail = call.from.replace('client:', '');
        } else if (call.to && call.to.startsWith('client:')) {
          agentEmail = call.to.replace('client:', '');
        }

        if (!agentEmail) continue;

        // Get the phone number (the side that's NOT "client:")
        let phoneNumber = 'Unknown';
        if (call.to && !call.to.startsWith('client:')) {
          phoneNumber = call.to;
        } else if (call.from && !call.from.startsWith('client:')) {
          phoneNumber = call.from;
        }

        // Calculate call age in seconds
        const callAge = call.startTime ? Math.floor((Date.now() - new Date(call.startTime).getTime()) / 1000) : 0;
        
        // Determine call status: if call is <30 seconds old and not answered, show as "ringing"
        let callStatus = call.status || 'unknown';
        if (callAge < 30 && (callStatus === 'in-progress' || callStatus === 'initiated' || callStatus === 'ringing')) {
          callStatus = 'ringing'; // Show as "dialing/ringing" for first 30 seconds
        }

        const activeCall: ActiveCall = {
          callSid: call.sid,
          agentEmail,
          phoneNumber,
          status: callStatus,
          direction: call.direction?.includes('inbound') ? 'inbound' : 'outbound',
          startedAt: call.startTime ? new Date(call.startTime) : new Date(),
          duration: call.duration || callAge // Use actual duration or calculated age
        };

        this.activeCalls.set(agentEmail, activeCall);
      }

      if (allActiveCalls.length > 0) {
        console.log(`📞 Twilio Poller: Found ${allActiveCalls.length} active calls`);
      }

    } catch (error) {
      console.error('❌ Twilio poller error:', error);
    }
  }

  getActiveCallForAgent(agentEmail: string): ActiveCall | undefined {
    return this.activeCalls.get(agentEmail);
  }

  getAllActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const twilioCallsPoller = new TwilioCallsPoller();

