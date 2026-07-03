/**
 * VDP Heartbeat Manager — force agents online on Taalk by sending heartbeats
 * to the VDP Heroku backend every 2.5s.
 *
 * Flow:
 * 1. POST /api/vdp/launch/{agentId}/{sessionId}?t={apiKey}&params={json} → creates session
 * 2. POST /api/vdp/agents/{agentId}/{sessionId}/heartbeat → {"online":true,"busy":false} every 2.5s
 */

const VDP_BASE = 'https://vdp-michaelmandella-042502fe80b6.herokuapp.com';
const VDP_API_KEY = 'pub.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay41NDYyOWJkOS03Y2ZkLTQyYTUtYWY2Mi0xMGRmOTkzMmMzY2EiLCJuYW1lIjoiVkRQIEFQSSBLZXkiLCJzY29wZXMiOlsidmRwIl0sImV4cCI6MjA2NTg1MTI5Nn0.z-O2F_W0rkyyq-lhwmwEFt21HFW30tTu9As1-5f8O68';
const HEARTBEAT_INTERVAL_MS = 2500;

interface ManagedAgent {
  agentId: string;
  sessionId: string;
  params: { states: string[]; market?: string; first_name?: string; last_name?: string };
  interval: ReturnType<typeof setInterval> | null;
  lastHeartbeat: number;
  online: boolean;
  error: string | null;
}

class VDPHeartbeatManager {
  private agents = new Map<string, ManagedAgent>(); // agentId → ManagedAgent

  /** Launch a VDP session and start heartbeating to keep agent online.
   *  WARNING: This replaces any existing VDP session — only use for offline agents! */
  async forceOnline(agentId: string, params: ManagedAgent['params']): Promise<{ success: boolean; error?: string }> {
    // Normalize market: "Globe" → "Globe Market" so Taalk sees the correct value
    if (params.market === 'Globe') params = { ...params, market: 'Globe Market' };

    // Stop existing session if any
    this.forceOffline(agentId);

    // Use a deterministic session ID so we can always heartbeat the same session
    // even across restarts. Heroku rejects heartbeats from a different session ID.
    const sessionId = `aoi-cmd-${agentId}`;

    try {
      // Step 1: Launch session on VDP backend
      const launchUrl = `${VDP_BASE}/api/vdp/launch/${encodeURIComponent(agentId)}/${encodeURIComponent(sessionId)}?t=${encodeURIComponent(VDP_API_KEY)}&params=${encodeURIComponent(JSON.stringify(params))}`;
      const launchRes = await fetch(launchUrl, { redirect: 'manual' });
      // 302 redirect = success, 412 = already online (fine, just heartbeat)
      if (launchRes.status !== 302 && launchRes.status !== 200 && launchRes.status !== 412) {
        const text = await launchRes.text().catch(() => '');
        return { success: false, error: `Launch failed: ${launchRes.status} ${text.slice(0, 100)}` };
      }

      // Step 2: Send first heartbeat
      // On 412 (already online), the agent has an existing session with our deterministic ID.
      // Just start heartbeating — it will keep them alive.
      const hbOk = await this.sendHeartbeat(agentId, sessionId);
      if (!hbOk && launchRes.status !== 412) {
        return { success: false, error: 'First heartbeat failed' };
      }

      // Step 3: Start heartbeat interval
      const agent: ManagedAgent = {
        agentId,
        sessionId,
        params,
        interval: null,
        lastHeartbeat: Date.now(),
        online: true,
        error: null,
      };

      agent.interval = setInterval(async () => {
        const ok = await this.sendHeartbeat(agentId, sessionId);
        if (ok) {
          agent.lastHeartbeat = Date.now();
          agent.error = null;
        } else {
          agent.error = 'Heartbeat failed';
          console.error(`[VDP-HB] Heartbeat failed for agent ${agentId}`);
        }
      }, HEARTBEAT_INTERVAL_MS);

      this.agents.set(agentId, agent);
      console.log(`[VDP-HB] Agent ${agentId} forced ONLINE (session: ${sessionId})`);
      return { success: true };

    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /** Stop heartbeating — agent will go offline after Taalk's timeout (~10s) */
  forceOffline(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    if (agent.interval) clearInterval(agent.interval);
    agent.online = false;
    this.agents.delete(agentId);

    // Send one offline heartbeat
    this.sendHeartbeat(agentId, agent.sessionId, false).catch(() => {});

    console.log(`[VDP-HB] Agent ${agentId} forced OFFLINE`);
    return true;
  }

  /** Send a single heartbeat */
  private async sendHeartbeat(agentId: string, sessionId: string, online = true): Promise<boolean> {
    try {
      const url = `${VDP_BASE}/api/vdp/agents/${encodeURIComponent(agentId)}/${encodeURIComponent(sessionId)}/heartbeat?t=${encodeURIComponent(VDP_API_KEY)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online, busy: false }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Get status of all managed agents */
  getStatus(): { agentId: string; sessionId: string; online: boolean; lastHeartbeat: number; error: string | null }[] {
    return [...this.agents.values()].map(a => ({
      agentId: a.agentId,
      sessionId: a.sessionId,
      online: a.online,
      lastHeartbeat: a.lastHeartbeat,
      error: a.error,
    }));
  }

  /** Check if an agent is being managed */
  isManaged(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /** Stop all heartbeats (cleanup) */
  stopAll() {
    for (const [id] of this.agents) {
      this.forceOffline(id);
    }
  }
}

export const vdpHeartbeat = new VDPHeartbeatManager();
