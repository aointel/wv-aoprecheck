import type { Express, Request, Response } from 'express';
import { HARDCODED_CONFIG } from './hardcoded-config';

interface ConnectSession {
  agentId: string;
  sessionId: string;
  conferenceName: string;
  conferenceSid: string | null;
  agentCallSid: string | null;
  activeLeadCallSid: string | null;
  leadCallStatus: string;
  agentStatus: string;
  lastEvent: string | null;
  events: Array<{ at: string; eventName: string; payload: any }>;
  createdAt: string;
  updatedAt: string;
}

const connectSessions = new Map<string, ConnectSession>();

function getConnectSession(agentId: string, sessionId: string): ConnectSession {
  const key = `${agentId}:${sessionId}`;
  if (!connectSessions.has(key)) {
    connectSessions.set(key, {
      agentId,
      sessionId,
      conferenceName: `connect-${sessionId}`,
      conferenceSid: null,
      agentCallSid: null,
      activeLeadCallSid: null,
      leadCallStatus: 'idle',
      agentStatus: 'offline',
      lastEvent: null,
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return connectSessions.get(key)!;
}

function addEvent(session: ConnectSession, eventName: string, payload: any) {
  session.lastEvent = eventName;
  session.events.push({ at: new Date().toISOString(), eventName, payload });
  if (session.events.length > 100) session.events = session.events.slice(-100);
  session.updatedAt = new Date().toISOString();
  console.log('[CONNECT_TEST]', eventName, payload);
}

export function handleAgentConferenceJoin(agentId: string, sessionId: string, callSid: string) {
  const session = getConnectSession(agentId, sessionId);
  session.agentCallSid = callSid;
  session.agentStatus = 'connecting';
  addEvent(session, 'AGENT_VOICE_WEBHOOK', { callSid });
}

function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+1${digits}`;
}

export function registerConnectTestRoutes(app: Express, twilioClient: any, BASE_URL: string) {
  // POST /api/connect/dial
  app.post('/api/connect/dial', async (req: Request, res: Response) => {
    try {
      let { agentId, sessionId, phoneNumber } = req.body;
      // Default to test number if not provided
      if (!phoneNumber) phoneNumber = '+15032018470';
      if (!agentId || !sessionId) return res.status(400).json({ ok: false, error: 'agentId and sessionId required' });

      // Normalize to E.164
      const toNumber = normalizeToE164(phoneNumber);
      if (!toNumber.match(/^\+1?\d{10,14}$/)) {
        return res.status(400).json({ ok: false, error: `Invalid phone number: ${phoneNumber} -> ${toNumber}` });
      }

      const session = getConnectSession(agentId, sessionId);
      if (session.activeLeadCallSid) {
        return res.status(409).json({ ok: false, error: 'Lead call already active', callSid: session.activeLeadCallSid });
      }

      // Use local presence: pick from number based on lead's area code/state
      const fallbackFrom = HARDCODED_CONFIG.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || '+19142289324';
      let fromNumber = fallbackFrom;
      try {
        const { localPresenceService } = await import('./local-presence-service');
        const areaCode = toNumber.replace(/\D/g, '').slice(1, 4);
        const areaCodeToState: Record<string, string> = {
          '503': 'OR', '541': 'OR', '971': 'OR',
          '206': 'WA', '253': 'WA', '360': 'WA', '425': 'WA',
          '602': 'AZ', '480': 'AZ', '623': 'AZ',
          '213': 'CA', '310': 'CA', '323': 'CA', '415': 'CA', '619': 'CA', '714': 'CA', '818': 'CA',
          '612': 'MN', '651': 'MN', '763': 'MN',
        };
        const leadState = areaCodeToState[areaCode] || 'OR';
        const localNum = localPresenceService.getLocalNumber(leadState, toNumber);
        if (localNum) fromNumber = localNum;
        console.log(`[CONNECT_TEST] local presence: areaCode=${areaCode} state=${leadState} from=${fromNumber}`);
      } catch (lpErr: any) {
        console.warn('[CONNECT_TEST] local presence unavailable, using default:', lpErr.message);
      }

      // Use hardcoded BASE_URL if BASE_URL not set
      const effectiveBaseUrl = BASE_URL || HARDCODED_CONFIG.PRODUCTION_URL;

      const call = await twilioClient.calls.create({
        to: toNumber,
        from: fromNumber,
        url: `${effectiveBaseUrl}/api/connect/lead-twiml?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`,
        method: 'POST',
        statusCallback: `${effectiveBaseUrl}/api/connect/call-status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      });
      session.activeLeadCallSid = call.sid;
      session.leadCallStatus = 'dialing';
      addEvent(session, 'LEAD_CALL_CREATED', { callSid: call.sid, toNumber, fromNumber });
      return res.json({ ok: true, callSid: call.sid, conferenceName: session.conferenceName, leadCallStatus: session.leadCallStatus, fromNumber });
    } catch (err: any) {
      console.error('[CONNECT_TEST] dial error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // POST /api/connect/lead-twiml
  app.post('/api/connect/lead-twiml', (req: Request, res: Response) => {
    const agentId = String(req.query.agentId || req.body?.agentId || '');
    const sessionId = String(req.query.sessionId || req.body?.sessionId || '');
    const session = getConnectSession(agentId, sessionId);
    addEvent(session, 'LEAD_TWIML_REQUESTED', { agentId, sessionId });
    const effectiveBaseUrl = BASE_URL || HARDCODED_CONFIG.PRODUCTION_URL;
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Dial><Conference startConferenceOnEnter='true' endConferenceOnExit='false' beep='false' statusCallback='${effectiveBaseUrl}/api/connect/lead-conference-status' statusCallbackEvent='join leave' statusCallbackMethod='POST'>${session.conferenceName}</Conference></Dial></Response>`);
  });

  // POST /api/connect/end
  app.post('/api/connect/end', async (req: Request, res: Response) => {
    try {
      const { agentId, sessionId } = req.body;
      const session = getConnectSession(agentId, sessionId);
      if (!session.activeLeadCallSid) {
        return res.json({ ok: true, message: 'No active lead call' });
      }
      const callSid = session.activeLeadCallSid;
      await twilioClient.calls(callSid).update({ status: 'completed' });
      addEvent(session, 'LEAD_CALL_END_REQUESTED', { callSid });
      session.leadCallStatus = 'completed';
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[CONNECT_TEST] end error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // POST /api/connect/power-off
  app.post('/api/connect/power-off', async (req: Request, res: Response) => {
    try {
      const { agentId, sessionId } = req.body;
      const session = getConnectSession(agentId, sessionId);
      if (session.activeLeadCallSid) {
        try { await twilioClient.calls(session.activeLeadCallSid).update({ status: 'completed' }); } catch (e: any) { console.warn('[CONNECT_TEST] could not end lead call:', e.message); }
      }
      if (session.agentCallSid) {
        try { await twilioClient.calls(session.agentCallSid).update({ status: 'completed' }); } catch (e: any) { console.warn('[CONNECT_TEST] could not end agent call:', e.message); }
      }
      session.agentStatus = 'offline';
      session.leadCallStatus = 'idle';
      session.activeLeadCallSid = null;
      session.agentCallSid = null;
      addEvent(session, 'POWER_OFF', {});
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[CONNECT_TEST] power-off error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/connect/status
  app.get('/api/connect/status', (req: Request, res: Response) => {
    const agentId = String(req.query.agentId || '');
    const sessionId = String(req.query.sessionId || '');
    const session = getConnectSession(agentId, sessionId);
    return res.json({
      ok: true,
      agentId: session.agentId,
      sessionId: session.sessionId,
      conferenceName: session.conferenceName,
      conferenceSid: session.conferenceSid,
      agentCallSid: session.agentCallSid,
      activeLeadCallSid: session.activeLeadCallSid,
      agentStatus: session.agentStatus,
      leadCallStatus: session.leadCallStatus,
      lastEvent: session.lastEvent,
      events: session.events.slice(-20),
    });
  });

  // POST /api/connect/call-status
  app.post('/api/connect/call-status', (req: Request, res: Response) => {
    const { CallSid, CallStatus, CallDuration } = req.body;
    let found: ConnectSession | null = null;
    for (const session of connectSessions.values()) {
      if (session.activeLeadCallSid === CallSid) { found = session; break; }
    }
    if (!found) {
      console.log('[CONNECT_TEST] call-status: no matching session for', CallSid, CallStatus);
      return res.sendStatus(200);
    }
    const statusMap: Record<string, string> = {
      initiated: 'dialing', ringing: 'ringing', answered: 'connected', 'in-progress': 'connected',
      completed: 'completed', busy: 'completed', 'no-answer': 'completed', canceled: 'completed', failed: 'failed',
    };
    const mapped = statusMap[CallStatus] || CallStatus;
    found.leadCallStatus = mapped;
    if (['completed', 'failed'].includes(mapped)) found.activeLeadCallSid = null;
    addEvent(found, 'CALL_STATUS_CALLBACK', { CallSid, CallStatus, CallDuration });
    return res.sendStatus(200);
  });

  // POST /api/connect/conference-status
  app.post('/api/connect/conference-status', (req: Request, res: Response) => {
    const { ConferenceSid, ConferenceStatusCallbackEvent, FriendlyName, CallSid } = req.body;
    let found: ConnectSession | null = null;
    for (const session of connectSessions.values()) {
      if (session.conferenceName === FriendlyName) { found = session; break; }
    }
    if (found) {
      if (ConferenceSid) found.conferenceSid = ConferenceSid;
      if (ConferenceStatusCallbackEvent === 'participant-join' && CallSid === found.agentCallSid) found.agentStatus = 'connected';
      if (ConferenceStatusCallbackEvent === 'participant-leave' && CallSid === found.agentCallSid) found.agentStatus = 'disconnected';
      addEvent(found, 'CONFERENCE_STATUS_CALLBACK', { ConferenceSid, ConferenceStatusCallbackEvent, FriendlyName, CallSid });
    } else {
      console.log('[CONNECT_TEST] conference-status: no matching session for conference', FriendlyName);
    }
    return res.sendStatus(200);
  });

  // POST /api/connect/lead-conference-status
  app.post('/api/connect/lead-conference-status', (req: Request, res: Response) => {
    const { FriendlyName } = req.body;
    console.log('[CONNECT_TEST] lead-conference-status:', req.body);
    let found: ConnectSession | null = null;
    for (const session of connectSessions.values()) {
      if (session.conferenceName === FriendlyName) { found = session; break; }
    }
    if (found) addEvent(found, 'LEAD_CONFERENCE_STATUS_CALLBACK', req.body);
    return res.sendStatus(200);
  });

  console.log('[CONNECT_TEST] routes registered');
}

