import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface CallSession {
  sessionId: string;
  agentSocket?: WebSocket;
  clientSocket?: WebSocket;
  callStatus: 'waiting' | 'ringing' | 'connected' | 'completed';
  startTime?: Date;
  endTime?: Date;
}

export class WebRTCCallService {
  private wss: WebSocketServer;
  private callSessions = new Map<string, CallSession>();
  private accountSid: string;
  private apiKeySid: string;
  private apiKeySecret: string;
  private twimlAppSid: string;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/calls',
      verifyClient: (info) => {
        console.log('WebSocket connection attempt:', info.origin);
        return true;
      }
    });

    this.wss.on('connection', (ws, request) => {
      console.log('WebSocket connected for calls');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleWebSocketMessage(ws: WebSocket, message: any) {
    const { type, sessionId, data } = message;

    switch (type) {
      case 'join_call':
        this.joinCall(ws, sessionId, data.role);
        break;
      case 'offer':
      case 'answer':
      case 'ice_candidate':
        this.relaySignaling(sessionId, message, ws);
        break;
      case 'start_call':
        this.startCall(sessionId);
        break;
      case 'end_call':
        this.endCall(sessionId);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  private joinCall(ws: WebSocket, sessionId: string, role: 'agent' | 'client') {
    let session = this.callSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        callStatus: 'waiting'
      };
      this.callSessions.set(sessionId, session);
    }

    if (role === 'agent') {
      session.agentSocket = ws;
      console.log(`Agent joined call session: ${sessionId}`);
    } else {
      session.clientSocket = ws;
      console.log(`Client joined call session: ${sessionId}`);
    }

    // Notify about the join
    this.broadcastToSession(sessionId, {
      type: 'user_joined',
      role,
      sessionId
    });

    // If both are connected, start the signaling process
    if (session.agentSocket && session.clientSocket) {
      session.callStatus = 'ringing';
      this.broadcastToSession(sessionId, {
        type: 'call_ready',
        sessionId
      });
    }

    // Send current session state to the joining user
    ws.send(JSON.stringify({
      type: 'session_state',
      sessionId,
      callStatus: session.callStatus,
      connectedUsers: {
        agent: !!session.agentSocket,
        client: !!session.clientSocket
      }
    }));
  }

  private relaySignaling(sessionId: string, message: any, sender: WebSocket) {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    // Send to the other participant
    const targetSocket = sender === session.agentSocket 
      ? session.clientSocket 
      : session.agentSocket;

    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
      targetSocket.send(JSON.stringify(message));
    }
  }

  private startCall(sessionId: string) {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    session.callStatus = 'connected';
    session.startTime = new Date();

    this.broadcastToSession(sessionId, {
      type: 'call_started',
      sessionId,
      startTime: session.startTime
    });

    console.log(`Call started for session: ${sessionId}`);
  }

  private endCall(sessionId: string) {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    session.callStatus = 'completed';
    session.endTime = new Date();

    this.broadcastToSession(sessionId, {
      type: 'call_ended',
      sessionId,
      endTime: session.endTime,
      duration: session.startTime ? 
        Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000) : 0
    });

    console.log(`Call ended for session: ${sessionId}`);

    // Clean up after a delay
    setTimeout(() => {
      this.callSessions.delete(sessionId);
    }, 30000);
  }

  private broadcastToSession(sessionId: string, message: any) {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    [session.agentSocket, session.clientSocket].forEach(socket => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  }

  private handleDisconnection(ws: WebSocket) {
    // Find and clean up the session
    for (const [sessionId, session] of this.callSessions) {
      if (session.agentSocket === ws || session.clientSocket === ws) {
        if (session.agentSocket === ws) {
          session.agentSocket = undefined;
        }
        if (session.clientSocket === ws) {
          session.clientSocket = undefined;
        }

        // If no one is connected, clean up
        if (!session.agentSocket && !session.clientSocket) {
          this.callSessions.delete(sessionId);
        } else {
          // Notify remaining participant
          this.broadcastToSession(sessionId, {
            type: 'user_disconnected',
            sessionId
          });
        }
        break;
      }
    }
  }

  public getCallStatus(sessionId: string): CallSession | undefined {
    return this.callSessions.get(sessionId);
  }

  public getActiveCalls(): string[] {
    return Array.from(this.callSessions.keys());
  }

  async generateAccessToken(identity: string): Promise<string> {
    console.log(`🎫 Generating access token for identity: ${identity}`);

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      this.accountSid,
      this.apiKeySid,
      this.apiKeySecret,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlAppSid,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    const jwt = token.toJwt();
    console.log(`🎫 Generated Twilio access token for ${identity}`);
    return jwt;
  }
}
