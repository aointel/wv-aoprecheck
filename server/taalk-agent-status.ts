/**
 * Taalk Agent Status Sync
 * Notifies Taalk TaskRouter about agent availability status changes
 */

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const TAALK_DB = 'michaelmandella';
const TAALK_API_BASE = 'https://api.taalk.ai/api';

export type AgentStatus = 'online' | 'offline' | 'busy' | 'wrap';

/**
 * Notify Taalk about agent status change
 * This allows Taalk TaskRouter to know when agents are available for inbound calls
 */
export async function notifyTaalkAgentStatus(
  agentEmail: string,
  status: AgentStatus,
  metadata?: {
    associateId?: number;
    market?: string;
    states?: string[];
  }
): Promise<boolean> {
  try {
    // Try multiple possible endpoints - Taalk may have different endpoints for agent status
    const endpoints = [
      // Option 1: Agent status endpoint (if it exists)
      `${TAALK_API_BASE}/agent/status?db=${TAALK_DB}`,
      // Option 2: Webhook-style endpoint
      `${TAALK_API_BASE}/webhook/agent-status?db=${TAALK_DB}`,
      // Option 3: TaskRouter agent update endpoint
      `${TAALK_API_BASE}/taskrouter/agent?db=${TAALK_DB}`,
    ];

    const payload = {
      agent: agentEmail,
      agent_email: agentEmail,
      status: status,
      timestamp: new Date().toISOString(),
      ...(metadata?.associateId && { associate_id: metadata.associateId }),
      ...(metadata?.market && { market: metadata.market }),
      ...(metadata?.states && { states: metadata.states }),
    };

    // Try each endpoint until one succeeds
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TAALK_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          console.log(`✅ Taalk agent status updated: ${agentEmail} → ${status} (endpoint: ${endpoint})`);
          return true;
        } else if (response.status !== 404) {
          // If it's not 404, log the error but try next endpoint
          const errorText = await response.text();
          console.warn(`⚠️ Taalk agent status endpoint returned ${response.status}: ${errorText}`);
        }
      } catch (error) {
        // Continue to next endpoint on network errors
        console.warn(`⚠️ Taalk agent status endpoint failed (${endpoint}):`, error);
      }
    }

    // If all endpoints failed, try the inbound webhook URL pattern (reverse webhook)
    // The user provided: https://api.taalk.ai/api/call_in?company=michaelmandella&t=...
    // We'll try a similar pattern for agent status
    try {
      const webhookEndpoint = `https://api.taalk.ai/api/agent_status?company=${TAALK_DB}`;
      const webhookResponse = await fetch(webhookEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (webhookResponse.ok) {
        console.log(`✅ Taalk agent status updated via webhook: ${agentEmail} → ${status}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️ Taalk agent status webhook failed:`, error);
    }

    console.warn(`⚠️ Could not update Taalk agent status for ${agentEmail} - no working endpoint found`);
    return false;
  } catch (error) {
    console.error(`❌ Failed to notify Taalk about agent status change:`, error);
    return false;
  }
}

/**
 * Helper to map our TaskRouter activity to Taalk status
 */
export function mapTaskRouterActivityToTaalkStatus(activity: string): AgentStatus {
  const normalized = activity.toLowerCase();
  if (normalized.includes('offline')) return 'offline';
  if (normalized.includes('busy') || normalized.includes('call')) return 'busy';
  if (normalized.includes('wrap')) return 'wrap';
  if (normalized.includes('available')) return 'online';
  return 'offline'; // default
}
