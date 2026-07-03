// AI Verification Call Service for Taalk Integration
import { HARDCODED_CONFIG } from './hardcoded-config';

interface VerificationCallData {
  sessionId: string;
  clientName: string;
  clientPhone: string;
  spouseName?: string | null;
  city: string;
  state: string;
  premium: string;
  verificationMethod: string;
  agentPhone: string;
}

interface TaalkCallRequest {
  phoneNumber: string;
  campaignId: string;
  aiScript: string;
  verificationData: any;
  callbackUrl: string;
}

class AIVerificationService {
  private taalkApiKey: string;
  private taalkBaseUrl: string;
  private verificationCampaignId: string;

  constructor() {
    this.taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    this.taalkBaseUrl = "https://api.taalk.ai/api";
    this.verificationCampaignId = "6747819a86c131c2cb203719"; // AO Precheck verification campaign
  }

  // Generate real person verification instructions for agent
  generateVerificationInstructions(data: VerificationCallData): string {
    // Ensure proper spacing in client name
    const formattedClientName = data.clientName.trim();
    
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "aoirail-production-baa2.up.railway.app";
    
    return `AGENT VERIFICATION CALL INSTRUCTIONS:

Client: ${formattedClientName}
Phone: ${data.clientPhone}
Session: ${data.sessionId}

VERIFICATION LINKS:
Agent Verify: https://${devDomain}/agent-verification?session=${data.sessionId}
Client Verify: https://${devDomain}/client-verification?session=${data.sessionId}

VERIFICATION CHECKLIST:
1. Call client at ${data.clientPhone}
2. Identify yourself as their insurance agent
3. Explain this is a verification call for their policy
4. Ask client to put phone on speaker
5. Verify the following information:

   ✓ Full Name: "${data.clientName}"
   ${data.spouseName ? `✓ Spouse Name: "${data.spouseName}"` : ''}
   ✓ Location: "${data.city}, ${data.state}"
   ✓ Premium Amount: "${data.premium}"

6. Take screenshot during call showing both you and client
7. Complete verification in system

IMPORTANT: Keep client on speaker phone throughout verification process.
    `.trim();
  }

  // Generate AI conversation prompts for verification
  generateAIPrompts(data: VerificationCallData): any {
    // Ensure proper formatting of names
    const formattedClientName = data.clientName.trim();
    const formattedSpouseName = data.spouseName ? data.spouseName.trim() : 'N/A';
    
    return {
      systemPrompt: `You are an AI insurance verification agent for AO Precheck. Your job is to verify client information over the phone in a professional, friendly manner. 

VERIFICATION DATA:
- Client Name: ${formattedClientName}
- Spouse Name: ${formattedSpouseName}
- Location: ${data.city}, ${data.state}
- Premium: ${data.premium}
- Session ID: ${data.sessionId}

INSTRUCTIONS:
1. Greet the client professionally
2. Explain this is a verification call for their insurance policy
3. Ask them to confirm each piece of information
4. Listen for "yes", "correct", "that's right" or similar confirmations
5. If they say "no" or information is wrong, note the discrepancy
6. At the end, thank them and explain next steps
7. Keep responses concise and professional
8. If they have questions, direct them to contact their agent

IMPORTANT: This call is being conducted over speaker phone with the agent present.`,

      verificationQuestions: [
        {
          question: `Can you please confirm your full name is ${formattedClientName}?`,
          expectedAnswer: formattedClientName,
          field: 'clientName'
        },
        ...(data.spouseName ? [{
          question: `Can you confirm your spouse's name is ${formattedSpouseName}?`,
          expectedAnswer: formattedSpouseName,
          field: 'spouseName'
        }] : []),
        {
          question: `Can you confirm you are located in ${data.city}, ${data.state}?`,
          expectedAnswer: `${data.city}, ${data.state}`,
          field: 'location'
        },
        {
          question: `Can you confirm your current premium amount is ${data.premium}?`,
          expectedAnswer: data.premium,
          field: 'premium'
        }
      ],

      closingScript: `Thank you for completing the verification process. Your information has been confirmed. Your agent will now take a screenshot to complete the verification documentation. Please remain on the line for just a moment while they complete this final step.`
    };
  }

  // Initiate live verification call through Taalk
  async initiateVerificationCall(data: VerificationCallData): Promise<{success: boolean, callId?: string, error?: string, instructions?: string}> {
    try {
      // Ensure proper formatting of names
      const formattedClientName = data.clientName.trim();
      const formattedSpouseName = data.spouseName ? data.spouseName.trim() : null;
      
      console.log('Initiating live verification call via Taalk:', {
        phone: data.clientPhone,
        sessionId: data.sessionId,
        clientName: formattedClientName
      });

      // Use the actual client's phone number for verification call
      const clientPhoneNumber = this.formatPhoneNumber(data.clientPhone);
      
      const callRequest = {
        phoneNumber: clientPhoneNumber,
        sessionId: data.sessionId,
        clientName: formattedClientName,
        clientPhone: data.clientPhone,
        agentPhone: data.agentPhone,
        campaignId: this.verificationCampaignId,
        callType: 'client_verification',
        verificationData: {
          name: formattedClientName,
          spouse: formattedSpouseName !== 'N/A' ? formattedSpouseName : null,
          location: `${data.city}, ${data.state}`,
          premium: data.premium,
          clientPhone: data.clientPhone
        }
      };

      // Make actual API call to Taalk to initiate live call to client's actual phone number
      const response = await fetch(`${this.taalkBaseUrl}/campaign2s/${this.verificationCampaignId}/trigger?db=michaelmandella`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.taalkApiKey}`
        },
        body: JSON.stringify({
          phone: clientPhoneNumber,
          campaignId: this.verificationCampaignId,
          contact: {
            firstName: formattedClientName.split(' ')[0] || "Client",
            lastName: formattedClientName.split(' ').slice(1).join(' ') || "Client",
            phone: clientPhoneNumber
          },
          customData: {
            sessionId: data.sessionId,
            clientName: formattedClientName,
            clientPhone: data.clientPhone,
            spouseName: formattedSpouseName,
            location: `${data.city}, ${data.state}`,
            premium: data.premium,
            verificationMethod: data.verificationMethod,
            agentPhone: data.agentPhone,
            callType: 'live_verification'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Taalk live call failed:', response.status, errorText);
        return { success: false, error: `Taalk API error: ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      console.log('Live verification call initiated to +15032018470:', result);

      return { 
        success: true, 
        callId: result.callId || result.id || `LIVE-${Date.now()}`,
        instructions: `Live call initiated to +15032018470 for ${formattedClientName} verification`
      };

    } catch (error: any) {
      console.error('Error initiating AI verification call:', error);
      return { success: false, error: error.message };
    }
  }

  // Format phone number for Taalk API
  private formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    return phone.startsWith('+') ? phone : `+1${digits}`;
  }

  // Process call completion callback from Taalk
  async processCallCallback(callbackData: any): Promise<{success: boolean, verificationResult?: any}> {
    try {
      console.log('Processing AI verification call callback:', callbackData);

      const { sessionId, callStatus, verificationResults, transcript, callId } = callbackData;

      // Parse verification results
      const verificationSuccess = callStatus === 'completed' && verificationResults?.allVerified === true;
      
      return {
        success: true,
        verificationResult: {
          sessionId,
          callId,
          status: callStatus,
          verified: verificationSuccess,
          results: verificationResults,
          transcript: transcript,
          completedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error processing call callback:', error);
      return { success: false };
    }
  }
}

export const aiVerificationService = new AIVerificationService();
