/**
 * Twilio Task Route Service
 * Centralizes inbound/outbound routing status and unified agent presence.
 * Exposes getTaskRouteStatus() and getAgentPresence() for APIs and routing.
 */

const MAX_RECENT = 50;

export interface RouteEvent {
  at: string;
  caller: string;
  called: string;
  decision: string;
  agentsRung?: string[];
  error?: string;
}

export interface StatusEvent {
  at: string;
  callSid: string;
  status: string;
  duration?: number;
  owner?: string;
}

export interface TaskRouteStatus {
  healthy: boolean;
  recentRoutes: RouteEvent[];
  recentStatusEvents: StatusEvent[];
}

export type AgentPresenceState = 'offline' | 'online' | 'available' | 'dialing' | 'ringing' | 'on_call';

export interface AgentPresence {
  agentEmail: string;
  state: AgentPresenceState;
  /** True when agent can receive 609 inbound (idle, or dialing/ringing outbound — not yet connected). */
  availableForInbound?: boolean;
  callSid?: string;
  phoneNumber?: string;
  direction?: 'inbound' | 'outbound';
  duration?: number;
  activity?: string;
  lastHeartbeat?: string;
}

// In-memory ring buffers for recent events
const recentRoutes: RouteEvent[] = [];
const recentStatusEvents: StatusEvent[] = [];

function pushRecent<T>(arr: T[], item: T, max: number): void {
  arr.unshift(item);
  if (arr.length > max) arr.length = max;
}

export function pushRouteEvent(event: Omit<RouteEvent, 'at'>): void {
  pushRecent(recentRoutes, { ...event, at: new Date().toISOString() }, MAX_RECENT);
}

export function pushStatusEvent(event: Omit<StatusEvent, 'at'>): void {
  pushRecent(recentStatusEvents, { ...event, at: new Date().toISOString() }, MAX_RECENT);
}

export function getTaskRouteStatus(): TaskRouteStatus {
  return {
    healthy: true,
    recentRoutes: [...recentRoutes],
    recentStatusEvents: [...recentStatusEvents],
  };
}

export interface AgentPresenceScope {
  emails?: string[];
}

/**
 * Unified agent presence: merge twilioCallsPoller, callConnectorTracker, and agent_live_call_status.
 * Returns one state per agent: offline | online | available | dialing | ringing | on_call.
 */
/**
 * Presence uses only: in-memory heartbeats (Call Connector Pro when Device is open) and Twilio active calls.
 * No Supabase. Twilio has no API for "who has open Device session" so we use server-side heartbeat.
 */
export async function getAgentPresence(scope?: AgentPresenceScope): Promise<AgentPresence[]> {
  const { callConnectorTracker } = await import('./call-connector-tracker');
  const { twilioCallsPoller } = await import('./twilio-calls-poller.js');

  const twilioCalls = twilioCallsPoller.getAllActiveCalls() || [];
  const ccpActivities = callConnectorTracker.getAllAgentActivities();
  const ccpActiveCalls = await callConnectorTracker.getActiveCalls();

  const agentEmails = new Set<string>();
  twilioCalls.forEach((c: { agentEmail: string }) => agentEmails.add((c.agentEmail || '').toLowerCase().trim()));
  ccpActivities.forEach((a: { agentEmail: string }) => agentEmails.add((a.agentEmail || '').toLowerCase().trim()));
  ccpActiveCalls.forEach((c: { agentEmail: string }) => agentEmails.add((c.agentEmail || '').toLowerCase().trim()));
  callConnectorTracker.getActiveAgents().forEach((a: { agentEmail: string }) => agentEmails.add((a.agentEmail || '').toLowerCase().trim()));

  // Who is on a *connected* call (exclude ringing/dialing so dialing agents still count as available for inbound)
  const inCallEmails = new Set<string>();
  twilioCalls
    .filter((c: { status?: string }) => (c.status || '').toLowerCase() !== 'ringing')
    .forEach((c: { agentEmail: string }) => inCallEmails.add((c.agentEmail || '').toLowerCase().trim()));
  ccpActiveCalls.filter((c: { status?: string }) => c.status === 'answered').forEach((c: { agentEmail: string }) => inCallEmails.add((c.agentEmail || '').toLowerCase().trim()));

  const filterEmails = scope?.emails?.map((e) => e.toLowerCase().trim()).filter(Boolean);
  const result: AgentPresence[] = [];

  for (const email of agentEmails) {
    if (filterEmails && filterEmails.length > 0 && !filterEmails.includes(email)) continue;

    const twilioCall = twilioCalls.find((c: { agentEmail: string }) => (c.agentEmail || '').toLowerCase().trim() === email);
    const activity = ccpActivities.find((a: { agentEmail: string }) => (a.agentEmail || '').toLowerCase().trim() === email);
    const ccpCall = ccpActiveCalls.find((c: { agentEmail: string }) => (c.agentEmail || '').toLowerCase().trim() === email);
    const hasHeartbeat = callConnectorTracker.isAgentActive(email);
    const inCall = inCallEmails.has(email);

    let state: AgentPresenceState = 'offline';
    let callSid: string | undefined;
    let phoneNumber: string | undefined;
    let direction: 'inbound' | 'outbound' | undefined;
    let duration: number | undefined;
    let activityLabel: string | undefined;

    if (twilioCall) {
      callSid = (twilioCall as { callSid?: string }).callSid;
      phoneNumber = (twilioCall as { phoneNumber?: string }).phoneNumber;
      direction = (twilioCall as { direction?: 'inbound' | 'outbound' }).direction;
      duration = (twilioCall as { duration?: number }).duration;
      const status = (twilioCall as { status?: string }).status || '';
      if (status === 'ringing') state = 'ringing';
      else state = 'on_call';
    }

    if (activity) {
      activityLabel = activity.activity;
      if (state === 'offline' || state === 'ringing') {
        if (activity.activity === 'live' || activity.activity === 'wrapping_up') state = 'on_call';
        else if (activity.activity === 'ringing') state = 'ringing';
        else if (activity.activity === 'dialing') state = 'dialing';
        else if (activity.activity === 'idle') {
          if (state === 'offline' && hasHeartbeat) state = 'available';
        }
      }
    }

    if (ccpCall) {
      const ccpStatus = (ccpCall as { status?: string }).status;
      if (!callSid) callSid = (ccpCall as { callSid?: string }).callSid;
      if (!phoneNumber) phoneNumber = (ccpCall as { leadPhone?: string }).leadPhone;
      if (state === 'offline' || state === 'available') {
        if (ccpStatus === 'answered') state = 'on_call';
        else if (ccpStatus === 'ringing') state = 'ringing';
        else if (ccpStatus === 'dialing') state = 'dialing';
      }
    }

    if (inCallDb && state !== 'on_call' && state !== 'ringing' && state !== 'dialing') state = 'on_call';

    if (state === 'offline' && hasHeartbeat) state = 'available';

    // Dialing/ringing agents are still available for inbound 609; only on_call is not.
    const availableForInbound = hasHeartbeat && state !== 'on_call';

    let lastHeartbeat: string | undefined;
    const hb = callConnectorTracker.getAgentLastHeartbeat(email);
    if (hb) lastHeartbeat = hb.toISOString();

    result.push({
      agentEmail: email,
      state,
      availableForInbound,
      callSid,
      phoneNumber,
      direction,
      duration,
      activity: activityLabel,
      lastHeartbeat,
    });
  }

  result.sort((a, b) => a.agentEmail.localeCompare(b.agentEmail));
  return result;
}
