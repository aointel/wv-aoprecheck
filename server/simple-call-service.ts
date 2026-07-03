// Simple call service that sends webhook data immediately
// This bypasses Twilio for testing webhook integration

export interface SimpleCallData {
  sessionId: string;
  clientName: string;
  clientPhone: string;
  spouseName?: string | null;
  city: string;
  state: string;
  premium: string;
  verificationMethod: string;
}

export class SimpleCallService {
  async initiateVerificationCall(data: SimpleCallData): Promise<{ success: boolean; callSid?: string; error?: string }> {
    try {
      console.log('Initiating simple call simulation to +15032018470:', data);

      // Generate a mock call SID for tracking
      const mockCallSid = `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Simulate successful call initiation
      return {
        success: true,
        callSid: mockCallSid
      };

    } catch (error) {
      console.error('Simple call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getCallStatus(callSid: string): Promise<{ status: string; duration?: number }> {
    // Simulate call status - in real implementation this would check actual call
    return {
      status: 'completed',
      duration: 45
    };
  }
}

export const simpleCallService = new SimpleCallService();