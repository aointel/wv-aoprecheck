/**
 * Inbound queue delivery state: tracks which agent we're ringing for each call
 * so the status callback can move to bottom and ring next (3s sequential ring).
 */

export interface InboundDeliveryContext {
  callSid: string;
  conferenceName: string;
  from: string;
  to: string;
  leadMarket: string;
  leadState: string;
  agentEmail: string;
  answered: boolean;
}

// Key: Twilio CallSid of the outbound call to the agent (client:email). Value: delivery context.
const deliveryByAgentCallSid: Map<string, InboundDeliveryContext> = new Map();

// Agents currently being rung (so we don't assign them to another call).
const agentsCurrentlyRinging: Set<string> = new Set();

export function registerDelivery(agentRingCallSid: string, ctx: Omit<InboundDeliveryContext, 'answered'>): void {
  deliveryByAgentCallSid.set(agentRingCallSid, { ...ctx, answered: false });
  agentsCurrentlyRinging.add(ctx.agentEmail.toLowerCase().trim());
  console.log(`📞 Inbound delivery: registered agent ring ${agentRingCallSid} for call ${ctx.callSid} → ${ctx.agentEmail}`);
}

export function getDeliveryContext(agentRingCallSid: string): InboundDeliveryContext | undefined {
  return deliveryByAgentCallSid.get(agentRingCallSid);
}

export function markAnswered(agentRingCallSid: string): void {
  const ctx = deliveryByAgentCallSid.get(agentRingCallSid);
  if (ctx) ctx.answered = true;
}

export function removeDelivery(agentRingCallSid: string): InboundDeliveryContext | undefined {
  const ctx = deliveryByAgentCallSid.get(agentRingCallSid);
  deliveryByAgentCallSid.delete(agentRingCallSid);
  if (ctx) agentsCurrentlyRinging.delete(ctx.agentEmail.toLowerCase().trim());
  return ctx;
}

export function getAgentsCurrentlyRinging(): Set<string> {
  return new Set(agentsCurrentlyRinging);
}

export function wasAnswered(agentRingCallSid: string): boolean {
  const ctx = deliveryByAgentCallSid.get(agentRingCallSid);
  return !!ctx?.answered;
}
