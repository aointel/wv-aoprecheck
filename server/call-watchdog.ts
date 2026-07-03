interface ActiveCall {
  leadId: string;
  associateId: string;
  timeoutId: NodeJS.Timeout;
  startTime: number;
}

interface WebhookPayload {
  associate_id: string;
  taalk_lead_id: string;
}

class CallWatchdog {
  private activeCalls = new Map<string, ActiveCall>();
  private leadStatuses = new Map<string, string>();
  private firedCalls = new Set<string>();
  private readonly TIMEOUT_MS = 50000; // 50 seconds
  private readonly WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/';

  startTimer(callKey: string, leadId: string, associateId: string): void {
    console.log(`[CallWatchdog] Starting 50s timer for call ${callKey}, lead ${leadId}, associate ${associateId}`);
    
    // Cancel existing timer if any
    this.endTimer(callKey);

    const timeoutId = setTimeout(() => {
      this.handleTimeout(callKey);
    }, this.TIMEOUT_MS);

    this.activeCalls.set(callKey, {
      leadId,
      associateId,
      timeoutId,
      startTime: Date.now()
    });

    // Set initial lead status as pending
    this.leadStatuses.set(leadId, 'pending');
  }

  endTimer(callKey: string): void {
    const activeCall = this.activeCalls.get(callKey);
    if (activeCall) {
      console.log(`[CallWatchdog] Ending timer for call ${callKey}`);
      clearTimeout(activeCall.timeoutId);
      this.activeCalls.delete(callKey);
      
      // Clean up memory: remove from fired calls and lead statuses if no other active calls reference this lead
      this.firedCalls.delete(callKey);
      const { leadId } = activeCall;
      const hasOtherActiveCalls = Array.from(this.activeCalls.values()).some(call => call.leadId === leadId);
      if (!hasOtherActiveCalls) {
        this.leadStatuses.delete(leadId);
        console.log(`[CallWatchdog] Cleaned up lead status for ${leadId}`);
      }
    }
  }

  updateLeadStatus(leadId: string, status: string): void {
    // Only update if status is truthy and valid - prevent setting empty/undefined status
    if (!status || status.trim() === '') {
      console.log(`[CallWatchdog] Ignoring empty/invalid status for lead ${leadId}`);
      return;
    }
    
    console.log(`[CallWatchdog] Updating lead ${leadId} status to ${status}`);
    this.leadStatuses.set(leadId, status);
  }

  private async handleTimeout(callKey: string): Promise<void> {
    const activeCall = this.activeCalls.get(callKey);
    if (!activeCall) {
      console.log(`[CallWatchdog] Call ${callKey} no longer active at timeout`);
      return;
    }

    const { leadId, associateId } = activeCall;
    const leadStatus = this.leadStatuses.get(leadId);

    // Check if call is still active and lead is still pending
    if (leadStatus !== 'pending') {
      console.log(`[CallWatchdog] Lead ${leadId} no longer pending (status: ${leadStatus}), skipping webhook`);
      this.activeCalls.delete(callKey);
      return;
    }

    // Check if we already fired for this call
    if (this.firedCalls.has(callKey)) {
      console.log(`[CallWatchdog] Webhook already fired for call ${callKey}, skipping`);
      this.activeCalls.delete(callKey);
      return;
    }

    console.log(`[CallWatchdog] 50 seconds elapsed for call ${callKey}, firing webhook`);

    try {
      const payload: WebhookPayload = {
        associate_id: associateId,
        taalk_lead_id: leadId
      };

      const response = await fetch(this.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`[CallWatchdog] Webhook fired successfully for call ${callKey}`);
        this.firedCalls.add(callKey);
      } else {
        console.error(`[CallWatchdog] Webhook failed for call ${callKey}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error(`[CallWatchdog] Error firing webhook for call ${callKey}:`, error);
    }

    // Clean up memory after timeout handling
    this.activeCalls.delete(callKey);
    this.firedCalls.delete(callKey);  // Clean up fired tracking after use
    
    // Clean up lead status if no other active calls reference this lead
    const hasOtherActiveCalls = Array.from(this.activeCalls.values()).some(call => call.leadId === leadId);
    if (!hasOtherActiveCalls) {
      this.leadStatuses.delete(leadId);
      console.log(`[CallWatchdog] Cleaned up lead status for ${leadId} after timeout`);
    }
  }

  // Debug method to check active calls
  getActiveCallsCount(): number {
    return this.activeCalls.size;
  }

  // Debug method to get call info
  getCallInfo(callKey: string): ActiveCall | undefined {
    return this.activeCalls.get(callKey);
  }
}

// Export singleton instance
export const callWatchdog = new CallWatchdog();