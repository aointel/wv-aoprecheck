import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET } from './hardcoded-config';

// Fixed 605 number for Taalk integration
const WEBRTC_PHONE_NUMBER = '+16052500834'; // The 605 number Taalk will call

// Agent phone mappings - all route to the 605 number
const AGENT_PHONE_NUMBERS = {
  'default': WEBRTC_PHONE_NUMBER,
  'webrtc': WEBRTC_PHONE_NUMBER,
  'taalk': WEBRTC_PHONE_NUMBER, // Specifically for Taalk calls
};

export interface PhoneBridgeSession {
  sessionId: string;
  agentSocket?: WebSocket;
  callSid?: string;
  callStatus: 'idle' | 'ringing' | 'connected' | 'completed';
  startTime?: Date;
  phoneNumber: string;
}

export class WebRTCPhoneBridge {
  private wss: WebSocketServer;
  private bridgeSessions = new Map<string, PhoneBridgeSession>();
  private twilioClient: twilio.Twilio;

  constructor(server: Server) {
    // Initialize Twilio for receiving calls using API Keys instead of Auth Token
    this.twilioClient = twilio(
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { accountSid: TWILIO_ACCOUNT_SID }
    );

    // WebSocket server for browser connections
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/phone-bridge',
      verifyClient: (info) => {
        console.log('Phone bridge WebSocket connection:', info.origin);
        return true;
      }
    });

    this.wss.on('connection', (ws, request) => {
      console.log('Agent connected to phone bridge');
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('Invalid phone bridge message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Agent disconnected from phone bridge');
        this.handleAgentDisconnection(ws);
      });
    });
  }

  private handleWebSocketMessage(ws: WebSocket, message: any) {
    const { type, sessionId, data } = message;

    switch (type) {
      case 'register_agent':
        this.registerAgent(ws, sessionId, data.phoneNumber);
        break;
      case 'answer_call':
        this.answerIncomingCall(sessionId);
        break;
      case 'end_call':
        this.endCall(sessionId);
        break;
      default:
        console.log('Unknown phone bridge message:', type);
    }
  }

  private registerAgent(ws: WebSocket, sessionId: string, phoneNumber?: string) {
    const assignedPhone = phoneNumber || AGENT_PHONE_NUMBERS.default;
    
    const session: PhoneBridgeSession = {
      sessionId,
      agentSocket: ws,
      callStatus: 'idle',
      phoneNumber: assignedPhone
    };
    
    this.bridgeSessions.set(sessionId, session);
    
    console.log(`Agent registered for session ${sessionId} with phone ${assignedPhone}`);
    
    // Send confirmation to agent
    ws.send(JSON.stringify({
      type: 'registration_success',
      sessionId,
      phoneNumber: assignedPhone,
      message: `Registered. Taalk can call ${assignedPhone} to reach you.`
    }));
  }

  private answerIncomingCall(sessionId: string) {
    const session = this.bridgeSessions.get(sessionId);
    if (!session || !session.agentSocket) return;

    session.callStatus = 'connected';
    session.startTime = new Date();

    // Notify agent that call is now active
    session.agentSocket.send(JSON.stringify({
      type: 'call_connected',
      sessionId,
      message: 'Call connected. You can now speak with the caller.',
      startTime: session.startTime
    }));

    console.log(`Call connected for session ${sessionId}`);
  }

  private endCall(sessionId: string) {
    const session = this.bridgeSessions.get(sessionId);
    if (!session) return;

    session.callStatus = 'completed';
    
    if (session.agentSocket) {
      session.agentSocket.send(JSON.stringify({
        type: 'call_ended',
        sessionId,
        message: 'Call has been ended.',
        clearNotifications: true
      }));
    }

    console.log(`Call ended for session ${sessionId}`);
  }

  private handleAgentDisconnection(ws: WebSocket) {
    // Find and clean up the session
    for (const [sessionId, session] of this.bridgeSessions) {
      if (session.agentSocket === ws) {
        session.agentSocket = undefined;
        if (session.callStatus === 'connected') {
          this.endCall(sessionId);
        }
        break;
      }
    }
  }

  // Called when Taalk calls the assigned phone number
  public handleIncomingCall(phoneNumber: string, callSid: string): string | null {
    // Find session by phone number
    for (const [sessionId, session] of this.bridgeSessions) {
      if (session.phoneNumber === phoneNumber) {
        session.callSid = callSid;
        session.callStatus = 'ringing';
        
        // Notify agent of incoming call
        if (session.agentSocket) {
          session.agentSocket.send(JSON.stringify({
            type: 'incoming_call',
            sessionId,
            callSid,
            phoneNumber,
            message: 'Incoming call. Click to answer.',
            timestamp: Date.now(),
            autoExpire: 30000 // Auto-clear after 30 seconds
          }));
          
          // Auto-clear notification after 30 seconds if not answered
          setTimeout(() => {
            if (session.callStatus === 'ringing' && session.agentSocket) {
              session.agentSocket.send(JSON.stringify({
                type: 'call_timeout',
                sessionId,
                message: 'Call timeout - notification cleared',
                clearNotifications: true
              }));
            }
          }, 30000);
        }
        
        console.log(`Incoming call to ${phoneNumber} for session ${sessionId}`);
        return sessionId;
      }
    }
    
    console.log(`No session found for phone number ${phoneNumber}`);
    return null;
  }

  public getSessionPhone(sessionId: string): string | null {
    const session = this.bridgeSessions.get(sessionId);
    return session?.phoneNumber || null;
  }

  public getActiveSessions(): string[] {
    return Array.from(this.bridgeSessions.keys());
  }

  // Find active session for a phone number (for inbound call routing)
  public getActiveSessionForPhone(phoneNumber: string): string | null {
    for (const [sessionId, session] of this.bridgeSessions) {
      if (session.phoneNumber === phoneNumber && session.callStatus !== 'completed') {
        return sessionId;
      }
    }
    return null;
  }

  // Notify WebRTC client about incoming call
  public notifyIncomingCall(sessionId: string, callData: { callSid: string, from: string, to: string }) {
    const session = this.bridgeSessions.get(sessionId);
    if (!session || !session.agentSocket) {
      console.log(`No active WebRTC session found for ${sessionId}`);
      return;
    }

    session.callSid = callData.callSid;
    session.callStatus = 'ringing';

    // Notify the WebRTC client
    session.agentSocket.send(JSON.stringify({
      type: 'incoming_call',
      sessionId,
      callSid: callData.callSid,
      from: callData.from,
      to: callData.to,
      message: `Incoming call from ${callData.from}. Click to answer.`
    }));

    console.log(`Notified WebRTC client ${sessionId} of incoming call ${callData.callSid}`);
  }
}