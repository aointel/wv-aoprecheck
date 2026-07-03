/**
 * Server-side state store.
 * Polls Taalk API, tracks agent activity, manages priority queue,
 * tracks transfer lifecycle (pending → active → completed).
 */

import type {
  NormalizedAgent, NormalizedCampaign, DashboardStats, WSMessage,
  AgentActivitySummary, ActiveCall, DialingCampaign, TransferStats,
  CompletedTransfer, MissedTransfer, QueuePosition, MergedAgent, MergedStats, WebRTCStatus,
  RevenueStats, SupabaseConnects, MarketCapacity, LeaderboardEntry,
  AgentHealthReport, AgentCommand,
} from '../shared/types.js';
import { normalizeAgent, normalizeCampaign, normalizeMarket, isAoRecruitCampaignName } from './normalize.js';
import { AutoCampaignManager } from './auto-manager.js';
import { calculateQueuePositions } from './priority-queue.js';
import * as taalk from './taalk-client.js';
import * as twilio from './twilio-client.js';
import { autoVDPManager } from './auto-vdp-manager.js';
import { WebSocket } from 'ws';
import { persistHealth } from './health-persist.js';

function fmtDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function todayPST(): string {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
}

function timeSinceStr(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

/** Sanitize MGA/RGA names � treat "0", "null", empty as null */
function sanitizeHierarchyName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '0' || t.toLowerCase() === 'null') return null;
  return toTitleCase(t);
}

function toTitleCase(input: string): string {
  return String(input || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function parseCustomerMarket(raw: unknown): string {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const normalized = normalizeMarket(String(item || ''));
      if (normalized && normalized !== 'Unknown') return normalized;
    }
    return 'Unknown';
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 'Unknown';
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        return parseCustomerMarket(JSON.parse(trimmed));
      } catch {
        // fall through to direct normalize
      }
    }
    return normalizeMarket(trimmed);
  }
  return 'Unknown';
}

function choosePreferredMarket(primaryRaw: unknown, fallbackRaw: unknown): string {
  const primary = normalizeMarket(String(primaryRaw || ''));
  if (primary && primary !== 'Unknown') return primary;
  const fallback = normalizeMarket(String(fallbackRaw || ''));
  if (fallback && fallback !== 'Unknown') return fallback;
  return primary || fallback || 'Unknown';
}

function fallbackNameFromEmail(email: string): { firstName: string; lastName: string; fullName: string } {
  const local = String(email || '').split('@')[0] || '';
  const parts = local.split(/[._]+/).filter(Boolean);
  const firstName = toTitleCase(parts[0] || local);
  const lastName = toTitleCase(parts.slice(1).join(' '));
  const fullName = `${firstName} ${lastName}`.trim() || local;
  return { firstName, lastName, fullName };
}

const EMPTY_TRANSFER_STATS: TransferStats = { avgWaitTime: 0, avgCallDuration: 0, totalTransfersToday: 0 };
const EMPTY_REVENUE_STATS: RevenueStats = {
  revenueToday: 0, connectsToday: 0, connectsByMarket: {},
  revenuePerAgent: {}, avgConnectDuration: 0, revenuePerHour: 0,
};

/** $8 for standard connects, $5 for recruiting (AO Recruit) */
function getConnectRate(market: string): number {
  const lower = (market || '').toLowerCase().trim();
  if (lower === 'ao recruit' || lower === 'aorecruit' || lower === 'recruit') return 5;
  return 8;
}

/** Business hours start at 7am PST — for $/hr calculation */
function hoursSinceBusinessStart(): number {
  const now = new Date();
  // Get current PST time
  const pstStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
  const [, timePart] = pstStr.split(', ');
  const [hours, minutes] = (timePart || '0:0').split(':').map(Number);
  const currentHour = hours + minutes / 60;
  const businessStart = 7; // 7 AM PST
  const elapsed = currentHour - businessStart;
  return Math.max(elapsed, 0.1); // minimum 0.1 to avoid div/0
}

// ── Supabase config — billing_transactions as source of truth for connects ──
const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
// Must be the JWT service role key (eyJ...) for raw PostgREST fetch — the sb_secret_ format is rejected
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

function todayPSTMidnightISO(): string {
  // billing_transactions.transaction_date is stored in UTC.
  // Agents work in PST/PDT — "today" means midnight Pacific, not UTC midnight.
  // PST = UTC-8, PDT = UTC-7 (DST: 2nd Sun Mar → 1st Sun Nov)
  const pstDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // "YYYY-MM-DD"
  const [y, mo, da] = pstDateStr.split('-').map(Number);
  // Compute DST boundaries for this year
  const dstStart = new Date(y, 2, 8); // March 8 or later (find 2nd Sunday)
  while (dstStart.getDay() !== 0) dstStart.setDate(dstStart.getDate() + 1);
  const dstEnd = new Date(y, 10, 1); // November 1 or later (find 1st Sunday)
  while (dstEnd.getDay() !== 0) dstEnd.setDate(dstEnd.getDate() + 1);
  const today = new Date(y, mo - 1, da);
  const offsetHours = (today >= dstStart && today < dstEnd) ? 7 : 8; // PDT=7, PST=8
  return `${pstDateStr}T${String(offsetHours).padStart(2, '0')}:00:00.000Z`;
}

interface BillingConnectRow {
  agent_email: string;
  agent_name: string;
  agent_associate_id: number | null;
  amount_usd: number;
  metadata: { market?: string } | null;
  transaction_date: string;
}

async function fetchBillingConnects(): Promise<BillingConnectRow[]> {
  const dateGte = todayPSTMidnightISO();
  const url = `${SUPA_URL}/rest/v1/billing_transactions?select=agent_email,agent_name,agent_associate_id,amount_usd,metadata,transaction_date&transaction_type=eq.connect&transaction_date=gte.${encodeURIComponent(dateGte)}&order=transaction_date.desc&limit=2000`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase billing_transactions ${res.status}: ${text}`);
  }

  return res.json() as Promise<BillingConnectRow[]>;
}

// ── Debounce on_call: only promote to "Live Call" after 25s continuous ──
const ON_CALL_DEBOUNCE_MS = 25_000;

class AppState {
  agents: NormalizedAgent[] = [];
  allAgents: NormalizedAgent[] = [];

  // Track when each agent first entered on_call (email → timestamp)
  private onCallSince = new Map<string, number>();
  campaigns: NormalizedCampaign[] = [];
  stats: MergedStats = {
    totalOnline: 0, totalBusy: 0, totalIdle: 0, totalAway: 0,
    totalSuspended: 0, totalOffline: 0,
    campaignsRunning: 0, campaignsStopped: 0,
    totalDialsThisHour: 0, totalLeads: 0,
    autoManagementEnabled: true,
    configuredRate: 0, avgAnswerRate: 0, avgIdleTime: 0,
    campaignsThrottled: 0, statesCovered: [],
    transferStats: EMPTY_TRANSFER_STATS,
    outboundActive: 0, inboundEnabled: 0, bothActive: 0, outboundOnly: 0,
    revenue: EMPTY_REVENUE_STATS,
  };
  lastRTSPoll = 0;
  lastRosterPoll = 0;
  lastCampaignPoll = 0;
  lastTwilioPoll = 0;

  autoManager = new AutoCampaignManager();
  wsClients = new Set<WebSocket>();

  // ── Twilio workers (latest poll) ──
  twilioWorkers: twilio.TwilioWorker[] = [];
  twilioActiveCalls = new Set<string>(); // emails of agents currently on a live Twilio call

  // ── AOIrail production data (polled every 15s) ──
  aoirailActiveAgents = new Set<string>(); // emails from eligibleRingGroup
  aoirailOnCall = new Set<string>();       // emails from onCall array
  lastAoirailPoll = 0;
  private pollInFlight = new Set<string>();

  // ── Twilio call log agents today — anyone with a call in twilio_call_logs today ──
  twilioCallAgentsToday = new Set<string>(); // emails
  lastTwilioCallLogPoll = 0;

  async pollTwilioCallLogsToday() {
    if (this.pollInFlight.has('twilio-call-logs')) return;
    this.pollInFlight.add('twilio-call-logs');
    try {
      // Use agent_daily_stats as the source of truth for who dialed today — it's complete
      const ptDay = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      const AOIRAIL_DATA = 'https://aoirail-data-production.up.railway.app';
      const res = await fetch(`${AOIRAIL_DATA}/api/agent-daily-stats/team`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data?.agents) return;
      this.twilioCallAgentsToday.clear();
      for (const a of data.agents) {
        const email = String(a.agent_email || '').toLowerCase().trim();
        const dials = Number(a.dials) || 0;
        if (email && dials > 0) this.twilioCallAgentsToday.add(email);
      }
      this.lastTwilioCallLogPoll = Date.now();
      console.log(`[DailyStats] ${this.twilioCallAgentsToday.size} agents with dials today`);
    } catch { /* non-blocking */ }
    finally {
      this.pollInFlight.delete('twilio-call-logs');
    }
  }

  // ── Merged agent view ──
  mergedAgents: MergedAgent[] = [];

  // ── CCPro roster: all ccPro=true customers (for denomination only, NOT injected into mergedAgents) ──
  ccProRoster = new Map<string, {
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    market: string;
    mgaName: string | null;
    rgaName: string | null;
    ccPro: boolean;
  }>();

  // ── Persistent hierarchy cache: once resolved, never lost across polls ──
  // Only updated when a new non-null value is found. Survives process lifetime.
  private hierarchyCache = new Map<string, { mgaName: string; rgaName: string | null; resolvedAt: number }>();

  private applyHierarchyCache(email: string, mgaName: string | null | undefined, rgaName: string | null | undefined): { mgaName: string | null; rgaName: string | null } {
    const key = email.toLowerCase().trim();
    const existing = this.hierarchyCache.get(key);
    const newMga = mgaName ? sanitizeHierarchyName(String(mgaName)) : null;
    const newRga = rgaName ? sanitizeHierarchyName(String(rgaName)) : null;
    if (newMga) {
      // Update cache with fresh data
      this.hierarchyCache.set(key, { mgaName: newMga, rgaName: newRga ?? existing?.rgaName ?? null, resolvedAt: Date.now() });
      return { mgaName: newMga, rgaName: newRga ?? existing?.rgaName ?? null };
    }
    if (existing) {
      // Use cached value — don't overwrite with null
      return { mgaName: existing.mgaName, rgaName: newRga ?? existing.rgaName ?? null };
    }
    return { mgaName: null, rgaName: newRga ?? null };
  }

  // ── Missed transfers tracking (email → count today) ──
  missedTransfers = new Map<string, number>();

  // ── Track which agents were auto-suspended for WebRTC ──
  webrtcSuspendedAgents = new Set<string>(); // emails

  // ── WebRTC presence webhook (push from AOIrail client) ──
  webhookPresence = new Map<string, any>();
  pushPresence = new Map<string, {
    status: 'available' | 'on_call' | 'offline' | 'dialing' | 'ringing',
    callDirection?: 'outbound' | 'inbound',
    market?: string,
    states?: string[],
    name?: string,
    leadName?: string,
    leadPhone?: string,
    leadState?: string,
    leadId?: string,
    updatedAt: number,
  }>();

  /** Store a webhook presence update; delete on "offline"; prune stale entries */
  updateWebhookPresence(identity: string, data: {
    status: 'available' | 'on_call' | 'offline' | 'dialing' | 'ringing',
    callDirection?: 'outbound' | 'inbound',
    market?: string,
    states?: string[],
    name?: string,
    leadName?: string,
    leadPhone?: string,
    leadState?: string,
    leadId?: string,
  }) {
    const email = identity.toLowerCase();
    if (data.status === 'offline') {
      this.webhookPresence.delete(email);
    } else {
      // Preserve lead details from a previous on_call entry if the new push doesn't include them
      const prev = this.pushPresence.get(email);
      const merged = { ...data, updatedAt: Date.now() };
      if (prev && data.status === 'on_call') {
        if (!merged.leadName && prev.leadName) merged.leadName = prev.leadName;
        if (!merged.leadPhone && prev.leadPhone) merged.leadPhone = prev.leadPhone;
        if (!merged.leadState && prev.leadState) merged.leadState = prev.leadState;
        if (!merged.leadId && prev.leadId) merged.leadId = prev.leadId;
      }
      this.pushPresence.set(email, merged);
    }
    // Prune stale entries — dialing/ringing expire after 45s, others after 5 min
    const now = Date.now();
    for (const [key, entry] of this.webhookPresence) {
      const isTransient = entry.status === 'dialing' || entry.status === 'ringing';
      const isActive = entry.status === 'on_call';
      const maxAge = isTransient ? 60_000 : isActive ? 60_000 : 5 * 60 * 1000;
      // dialing/ringing: 60s, on_call: 60s (must outlast poll intervals), idle: 5min
      if (now - entry.updatedAt > maxAge) this.webhookPresence.delete(key);
    }
    // Rebuild merged view so it's immediately visible
    this.buildMergedAgents();
    this.computeStats();
    this.broadcast({
      type: 'agents_update',
      data: { agents: this.agents, mergedAgents: this.mergedAgents, stats: this.stats },
      timestamp: new Date().toISOString(),
    });
  }

  // ── Supabase connects ──
  supabaseConnects: SupabaseConnects = { connects: 0, revenue: 0, lastPolled: '' };
  lastSupabasePoll = 0;

  // ── Leaderboard ──
  leaderboard: LeaderboardEntry[] = [];

  // ── Agent Health Reports (expire after 60s) ──
  private agentHealth = new Map<string, AgentHealthReport & { _expiry: number }>();
  private agentCommandQueue = new Map<string, AgentCommand[]>();

  setAgentHealth(report: AgentHealthReport) {
    const email = report.email.toLowerCase();
    this.agentHealth.set(email, { ...report, _expiry: Date.now() + 300_000 });
    // Prune expired entries
    const now = Date.now();
    for (const [key, val] of this.agentHealth) {
      if (now > val._expiry) this.agentHealth.delete(key);
    }
    // Persist to DB (fire-and-forget — survives Railway restarts)
    persistHealth(report).catch(() => {});
    // Broadcast health update to all dashboard clients
    this.broadcast({
      type: 'agent_health_update',
      data: this.getAllAgentHealth(),
      timestamp: new Date().toISOString(),
    });
  }

  loadHealthFromDB(reports: AgentHealthReport[]) {
    const now = Date.now();
    for (const report of reports) {
      const email = report.email.toLowerCase();
      if (!this.agentHealth.has(email)) {
        // Use a short TTL so it's replaced quickly when agents re-send live data
        this.agentHealth.set(email, { ...report, _expiry: now + 120_000 });
      }
    }
  }

  getAgentHealth(email: string): AgentHealthReport | null {
    const entry = this.agentHealth.get(email.toLowerCase());
    if (!entry) return null;
    if (Date.now() > entry._expiry) {
      this.agentHealth.delete(email.toLowerCase());
      return null;
    }
    const { _expiry, ...report } = entry;
    return report;
  }

  getAllAgentHealth(): AgentHealthReport[] {
    const now = Date.now();
    const results: AgentHealthReport[] = [];
    for (const [key, entry] of this.agentHealth) {
      if (now > entry._expiry) {
        this.agentHealth.delete(key);
        continue;
      }
      const { _expiry, ...report } = entry;
      results.push(report);
    }
    return results;
  }

  pushAgentCommand(cmd: AgentCommand) {
    const email = cmd.email.toLowerCase();
    const queue = this.agentCommandQueue.get(email) ?? [];
    queue.push(cmd);
    this.agentCommandQueue.set(email, queue);
  }

  popAgentCommands(email: string): AgentCommand[] {
    const key = email.toLowerCase();
    const commands = this.agentCommandQueue.get(key) ?? [];
    this.agentCommandQueue.delete(key);
    return commands;
  }

  // ── Activity tracking (reset at midnight PST) ──
  agentCallsToday = new Map<number, number>();
  agentIdleAccumulator = new Map<number, number>();
  lastSeenTask = new Map<number, string | null>();
  lastSeenBusy = new Map<number, boolean>();
  lastCallEndTime = new Map<number, string>();
  lastIdleCheckTime = new Map<number, number>();
  private _lastResetDate = todayPST();

  // ── Transfer wait time tracking (rolling window of last 50) ──
  private transferWaitTimes: number[] = [];   // ms from taskAssigned to busy=true
  private transferCallDurations: number[] = []; // ms from taskAssigned to hangup
  private totalTransfersToday = 0;

  // ── Completed transfers (kept for 60 seconds) ──
  private completedTransfers: (CompletedTransfer & { _expiry: number })[] = [];

  // ── Missed transfers (kept for 5 minutes) ──
  private missedTransferEvents: (MissedTransfer & { _expiry: number })[] = [];

  // ── Last callInfo snapshot per agent (to build completed transfer details) ──
  private lastCallInfo = new Map<number, { leadName: string; leadState: string; leadType: string; market: string; taskAssignedTime: string }>();

  // ── Revenue tracking ──
  private revenueToday = 0;
  private connectsToday = 0;
  private connectsByMarket = new Map<string, { count: number; revenue: number }>();
  private revenuePerAgent = new Map<string, { connects: number; revenue: number; agentName: string }>();
  private billableCallDurations: number[] = []; // seconds, for rolling avg

  // ── Priority queue ──
  private _queuePositions: QueuePosition[] = [];

  broadcast(msg: WSMessage) {
    const payload = JSON.stringify(msg);
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  private checkMidnightReset() {
    const today = todayPST();
    if (today !== this._lastResetDate) {
      console.log(`[Activity] Midnight reset (${this._lastResetDate} → ${today})`);
      this.agentCallsToday.clear();
      this.agentIdleAccumulator.clear();
      this.lastSeenTask.clear();
      this.lastSeenBusy.clear();
      this.lastCallEndTime.clear();
      this.lastIdleCheckTime.clear();
      this.transferWaitTimes = [];
      this.transferCallDurations = [];
      this.totalTransfersToday = 0;
      this.completedTransfers = [];
      this.lastCallInfo.clear();
      this.missedTransfers.clear();
      this.revenueToday = 0;
      this.connectsToday = 0;
      this.connectsByMarket.clear();
      this.revenuePerAgent.clear();
      this.billableCallDurations = [];
      this._lastResetDate = today;
    }
  }

  // ── Track agent activity changes ──
  private trackActivity(agents: NormalizedAgent[]) {
    this.checkMidnightReset();
    const now = Date.now();

    // Expire old completed transfers
    this.completedTransfers = this.completedTransfers.filter(ct => ct._expiry > now);

    for (const agent of agents) {
      const prevTask = this.lastSeenTask.get(agent.id);
      const prevBusy = this.lastSeenBusy.get(agent.id) ?? false;
      const currentTask = agent.currentTask;

      // ── Detect new task assignment (Taalk transfer received) ──
      if (currentTask && currentTask !== prevTask) {
        this.totalTransfersToday++;

        // Snapshot callInfo for completed transfer display later
        if (agent.callInfo && agent.taskAssignedTime) {
          this.lastCallInfo.set(agent.id, {
            leadName: agent.callInfo.leadName,
            leadState: agent.callInfo.leadState,
            leadType: agent.callInfo.leadType,
            market: agent.normalizedMarket,
            taskAssignedTime: agent.taskAssignedTime,
          });
        }

        const leadInfo = agent.callInfo
          ? `${agent.callInfo.leadName}, ${agent.callInfo.leadState} (${agent.callInfo.leadType || agent.callInfo.campaignName})`
          : 'transfer';
        this.autoManager.logActivityEvent(
          agent.id, agent.fullName, 'TRANSFER_RECEIVED',
          `${agent.fullName} received Taalk transfer: ${leadInfo}`,
        );
        this.lastIdleCheckTime.set(agent.id, now);
      }

      // ── Detect agent went busy (picked up the transfer) ──
      if (agent.busy && !prevBusy && currentTask && agent.taskAssignedTime) {
        // Count actual pickup — not task assignment (which fires even for missed calls)
        const prev = this.agentCallsToday.get(agent.id) ?? 0;
        this.agentCallsToday.set(agent.id, prev + 1);

        const waitMs = now - new Date(agent.taskAssignedTime).getTime();
        if (waitMs > 0 && waitMs < 600000) { // sanity: < 10 min
          this.transferWaitTimes.push(waitMs);
          if (this.transferWaitTimes.length > 50) this.transferWaitTimes.shift();
        }
      }

      // ── Detect call ended (had task, now doesn't) ──
      if (prevTask && !currentTask && agent.online) {
        this.lastCallEndTime.set(agent.id, new Date().toISOString());

        // Calculate call duration for the rolling average
        const snapshot = this.lastCallInfo.get(agent.id);
        const assignedTime = snapshot?.taskAssignedTime || agent.taskAssignedTime;
        const hangupTime = agent.lastHangupTime || agent.statusSince;
        let callDurMs = 0;
        if (assignedTime) {
          callDurMs = new Date(hangupTime).getTime() - new Date(assignedTime).getTime();
          if (callDurMs > 0 && callDurMs < 3600000) {
            this.transferCallDurations.push(callDurMs);
            if (this.transferCallDurations.length > 50) this.transferCallDurations.shift();
          }
        }

        const callDurSecs = callDurMs > 0 ? Math.floor(callDurMs / 1000) : 0;
        const isBillable = callDurSecs > 15;
        const market = snapshot?.market || agent.normalizedMarket;
        const rate = getConnectRate(market);
        const revenueEarned = isBillable ? rate : 0;

        // ── Revenue tracking for billable connects ──
        if (isBillable) {
          this.revenueToday += revenueEarned;
          this.connectsToday++;
          this.billableCallDurations.push(callDurSecs);

          // Per-market
          const mkt = market || 'Unknown';
          const mktEntry = this.connectsByMarket.get(mkt) ?? { count: 0, revenue: 0 };
          mktEntry.count++;
          mktEntry.revenue += revenueEarned;
          this.connectsByMarket.set(mkt, mktEntry);

          // Per-agent
          const agentKey = String(agent.id);
          const agentEntry = this.revenuePerAgent.get(agentKey) ?? { connects: 0, revenue: 0, agentName: agent.fullName };
          agentEntry.connects++;
          agentEntry.revenue += revenueEarned;
          agentEntry.agentName = agent.fullName;
          this.revenuePerAgent.set(agentKey, agentEntry);
        }

        // Build completed transfer entry (visible for 60s)
        if (snapshot) {
          this.completedTransfers.push({
            agentName: agent.fullName,
            agentId: agent.id,
            leadName: snapshot.leadName,
            leadState: snapshot.leadState,
            leadType: snapshot.leadType,
            market,
            callDuration: callDurSecs,
            completedAt: new Date().toISOString(),
            billable: isBillable,
            revenueEarned,
            _expiry: now + 60000, // keep for 60 seconds
          });
          this.lastCallInfo.delete(agent.id);
        }

        const revenueNote = isBillable ? ` 💰 +$${revenueEarned}` : ' (not billable, <15s)';
        this.autoManager.logActivityEvent(
          agent.id, agent.fullName, 'CALL_COMPLETED',
          `${agent.fullName} completed call${callDurMs > 0 ? `, duration ${fmtDuration(callDurMs)}` : ''}${revenueNote}`,
        );
        this.lastIdleCheckTime.set(agent.id, now);
      }

      // ── Detect went away ──
      if (agent.away && agent.online && !agent.suspended) {
        const prevAgent = this.agents.find(a => a.id === agent.id);
        if (prevAgent && !prevAgent.away) {
          this.autoManager.logActivityEvent(
            agent.id, agent.fullName, 'WENT_AWAY',
            `${agent.fullName} went AWAY`,
          );
        }
      }

      // ── Accumulate idle time ──
      if (agent.online && !agent.busy && !agent.away && !agent.suspended) {
        const lastCheck = this.lastIdleCheckTime.get(agent.id);
        if (lastCheck) {
          const elapsed = now - lastCheck;
          if (elapsed > 0 && elapsed < 60000) {
            const prevIdle = this.agentIdleAccumulator.get(agent.id) ?? 0;
            this.agentIdleAccumulator.set(agent.id, prevIdle + elapsed);
          }
        }
        this.lastIdleCheckTime.set(agent.id, now);

        const idleMs = this.agentIdleAccumulator.get(agent.id) ?? 0;
        const idleMins = idleMs / 60000;
        const prevIdleMs = idleMs - (now - (this.lastIdleCheckTime.get(agent.id) ?? now));
        const prevMins = prevIdleMs / 60000;
        if (idleMins >= 30 && Math.floor(idleMins / 30) > Math.floor(Math.max(prevMins, 0) / 30)) {
          this.autoManager.logActivityEvent(
            agent.id, agent.fullName, 'IDLE_WARNING',
            `⚠️ ${agent.fullName} idle ${Math.floor(idleMins)}min, no transfers received`,
          );
        }
      } else {
        this.lastIdleCheckTime.set(agent.id, now);
      }

      this.lastSeenTask.set(agent.id, currentTask);
      this.lastSeenBusy.set(agent.id, agent.busy);
    }
  }

  // ── Transfer stats (rolling averages) ──
  getTransferStats(): TransferStats {
    const avgWait = this.transferWaitTimes.length > 0
      ? this.transferWaitTimes.reduce((s, v) => s + v, 0) / this.transferWaitTimes.length
      : 0;
    const avgDur = this.transferCallDurations.length > 0
      ? this.transferCallDurations.reduce((s, v) => s + v, 0) / this.transferCallDurations.length
      : 0;
    return {
      avgWaitTime: Math.round(avgWait),
      avgCallDuration: Math.round(avgDur),
      totalTransfersToday: this.totalTransfersToday,
    };
  }

  // ── Revenue stats ──
  getRevenueStats(): RevenueStats {
    const avgDur = this.billableCallDurations.length > 0
      ? Math.round(this.billableCallDurations.reduce((s, v) => s + v, 0) / this.billableCallDurations.length)
      : 0;
    const hours = hoursSinceBusinessStart();
    return {
      revenueToday: this.revenueToday,
      connectsToday: this.connectsToday,
      connectsByMarket: Object.fromEntries(this.connectsByMarket),
      revenuePerAgent: Object.fromEntries(this.revenuePerAgent),
      avgConnectDuration: avgDur,
      revenuePerHour: Math.round(this.revenueToday / hours * 100) / 100,
    };
  }

  // ── Activity summary ──
  getActivitySummary(): AgentActivitySummary[] {
    return this.agents.filter(a => a.online).map(agent => {
      const callsToday = this.agentCallsToday.get(agent.id) ?? 0;
      const lastCallTime = this.lastCallEndTime.get(agent.id) ?? agent.lastHangupTime;
      const idleTimeToday = this.agentIdleAccumulator.get(agent.id) ?? 0;
      let currentCallDuration: number | null = null;
      if (agent.busy && agent.taskAssignedTime) {
        currentCallDuration = Math.floor((Date.now() - new Date(agent.taskAssignedTime).getTime()) / 1000);
      }
      return {
        agentId: agent.id, agentName: agent.fullName, callsToday,
        lastCallTime: lastCallTime || null,
        timeSinceLastCall: timeSinceStr(lastCallTime || null),
        idleTimeToday, currentCallDuration,
      };
    });
  }

  // ── Active calls: PENDING (has task but not busy) + ACTIVE (busy + task) ──
  getActiveCalls(): ActiveCall[] {
    const now = Date.now();
    const calls: ActiveCall[] = [];
    const taalkAgentEmails = new Set<string>();

    for (const agent of this.agents) {
      if (!agent.currentTask || !agent.callInfo) continue;

      const duration = agent.taskAssignedTime
        ? Math.floor((now - new Date(agent.taskAssignedTime).getTime()) / 1000)
        : 0;

      const status: ActiveCall['status'] = agent.busy ? 'active' : 'pending';

      if (agent.email) taalkAgentEmails.add(agent.email.toLowerCase());

      calls.push({
        agentName: agent.fullName,
        agentId: agent.id,
        market: agent.normalizedMarket,
        leadName: agent.callInfo.leadName || 'Unknown',
        leadPhone: agent.callInfo.leadPhone || '',
        leadState: agent.callInfo.leadState || '',
        leadType: agent.callInfo.leadType || agent.callInfo.campaignName || '',
        serverNumber: agent.callInfo.serverNumber || '',
        duration,
        startedAt: agent.taskAssignedTime || agent.statusSince,
        status,
      });
    }

    // Inject CCP outbound live calls from pushPresence not already shown via Taalk
    for (const [email, pp] of this.pushPresence) {
      if (pp.status !== 'on_call') continue;
      if (taalkAgentEmails.has(email)) continue; // already shown via Taalk
      if (now - pp.updatedAt > 45_000) continue; // stale
      if (!pp.leadName && !pp.leadPhone) continue; // no lead info to show

      const mergedAgent = this.mergedAgents.find(m => m.email === email);
      const duration = Math.floor((now - pp.updatedAt) / 1000);

      calls.push({
        agentName: pp.name || mergedAgent?.fullName || email.split('@')[0],
        agentId: mergedAgent?.id ?? 0,
        market: pp.market || mergedAgent?.normalizedMarket || '',
        leadName: pp.leadName || 'Unknown',
        leadPhone: pp.leadPhone || '',
        leadState: pp.leadState || '',
        leadType: 'CCP Outbound',
        serverNumber: '',
        duration,
        startedAt: new Date(pp.updatedAt).toISOString(),
        status: 'active',
      });
    }

    // Sort: pending first (dying calls), then active by duration desc
    calls.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return b.duration - a.duration;
    });

    return calls;
  }

  // ── Completed transfers (kept 60s) ──
  getCompletedTransfers(): CompletedTransfer[] {
    return this.completedTransfers.map(({ _expiry, ...ct }) => ct);
  }

  // ── Missed transfers (kept 5 min) ──
  recordMissedTransfer(event: MissedTransfer) {
    // Merge into existing entry for same phone within last 3 minutes
    const existing = this.missedTransferEvents.find(e =>
      e.phone === event.phone && (Date.now() - new Date(e.missedAt).getTime()) < 3 * 60_000
    );
    if (existing) {
      // Merge new missedBy agents in, avoid dups
      for (const name of event.missedBy) {
        if (!existing.missedBy.includes(name)) existing.missedBy.push(name);
      }
      existing.ringCycles = (existing.ringCycles ?? 1) + 1;
      return;
    }
    this.missedTransferEvents.unshift({ ...event, ringCycles: 1, _expiry: Date.now() + 5 * 60 * 1000 });
    this.missedTransferEvents = this.missedTransferEvents.filter(e => e._expiry > Date.now()).slice(0, 50);
  }

  getMissedTransfers(): MissedTransfer[] {
    const now = Date.now();
    return this.missedTransferEvents
      .filter(e => e._expiry > now)
      .map(({ _expiry, ...e }) => e);
  }

  // ── Dialing campaigns ──
  getDialingCampaigns(): DialingCampaign[] {
    return this.campaigns
      .filter(c => (c.callsThisHour > 0 || c.status === 'running') && c.limitPerHour > 0)
      .map(c => ({
        name: c.name, market: c.normalizedMarket, state: c.state,
        dialsPerHour: c.limitPerHour, callsMade: c.callsMade,
        callsAnswered: c.callsAnswered, answerRate: c.answerRate, leads: c.contactCount,
      }))
      .sort((a, b) => b.dialsPerHour - a.dialsPerHour);
  }

  // ── Queue positions ──
  getQueuePositions(): QueuePosition[] {
    return this._queuePositions;
  }

  // ── Build email from Taalk agent name ──
  private buildEmailFromAgent(agent: NormalizedAgent): string {
    const first = (agent.firstName || '').toLowerCase().replace(/\s+/g, '');
    const last = (agent.lastName || '').toLowerCase().replace(/\s+/g, '');
    return `${first}${last}@aoglobelife.com`;
  }

  // ── Merge Taalk + Twilio into unified agent list ──
  buildMergedAgents(): MergedAgent[] {
    // Build Twilio lookup by email (friendlyName is email)
    const twilioByEmail = new Map<string, twilio.TwilioWorker>();
    for (const w of this.twilioWorkers) {
      twilioByEmail.set(w.friendlyName.toLowerCase(), w);
    }

    // Build set of Taalk emails for detecting Twilio-only agents
    const taalkEmails = new Set<string>();

    const merged: MergedAgent[] = [];

    // Merge Taalk agents with their Twilio counterparts
    for (const agent of this.agents) {
      const email = this.buildEmailFromAgent(agent);
      taalkEmails.add(email);
      const tw = twilioByEmail.get(email);
      // Twilio worker activity is unreliable (gets stuck for hours) — default to 'idle', let pushPresence override
      const webrtcStatus: WebRTCStatus = 'idle';

      const cust = this.customersMap.get(email);
      const hier = this.hierarchyMap.get(email) || this.hierarchyMap.get(cust?.companyEmail || '');
      const customerMarket = cust?.market && cust.market !== 'Unknown' ? cust.market : null;
      const taalkMarket = agent.normalizedMarket || agent.market || '';
      const mergedMarket = choosePreferredMarket(taalkMarket, customerMarket);
      merged.push({
        ...agent,
        email,
        firstName: cust?.firstName || agent.firstName,
        lastName: cust?.lastName || agent.lastName,
        fullName: cust?.fullName || agent.fullName,
        market: mergedMarket,
        normalizedMarket: mergedMarket,
        states: (cust?.states?.length ? cust.states : agent.states) ?? [],
        ccPro: cust?.ccPro ?? false,
        taalkStatus: agent.status,
        webrtcStatus,
        inboundEnabled: agent.online && !agent.suspended,
        outboundEnabled: false, // pushPresence will set this correctly
        twilioActivity: tw?.activityName,
        twilioStatusSince: undefined, // don't use stale Twilio timestamps
        missedTransfers: this.missedTransfers.get(email) ?? 0,
        webrtcSuspended: this.webrtcSuspendedAgents.has(email),
        mgaName: hier?.mgaName ?? cust?.mgaName ?? null,
        mgaId: hier?.mgaId ?? null,
        rgaName: hier?.rgaName ?? cust?.rgaName ?? null,
        rgaId: hier?.rgaId ?? null,
      });
    }

    // Also check allAgents for agents that may be on Twilio but not on Taalk RTS
    for (const agent of this.allAgents) {
      const email = this.buildEmailFromAgent(agent);
      if (taalkEmails.has(email)) continue; // Already merged from RTS
      taalkEmails.add(email);
      const tw = twilioByEmail.get(email);
      if (!tw) continue; // Not on Twilio either — skip
      // Don't use Twilio worker activity — it gets stuck. Skip entirely unless they have pushPresence.
      if (!this.pushPresence.has(email)) continue;

      const cust2 = this.customersMap.get(email);
      const hier2 = this.hierarchyMap.get(email) || this.hierarchyMap.get(cust2?.companyEmail || '');
      const customerMarket2 = cust2?.market && cust2.market !== 'Unknown' ? cust2.market : null;
      const taalkMarket2 = agent.normalizedMarket || agent.market || '';
      const mergedMarket2 = choosePreferredMarket(taalkMarket2, customerMarket2);
      merged.push({
        ...agent,
        email,
        firstName: cust2?.firstName || agent.firstName,
        lastName: cust2?.lastName || agent.lastName,
        fullName: cust2?.fullName || agent.fullName,
        market: mergedMarket2,
        normalizedMarket: mergedMarket2,
        states: (cust2?.states?.length ? cust2.states : agent.states) ?? [],
        ccPro: cust2?.ccPro ?? false,
        taalkStatus: 'offline',
        webrtcStatus: 'idle' as WebRTCStatus,
        inboundEnabled: false,
        outboundEnabled: false, // pushPresence will set this
        twilioActivity: tw.activityName,
        twilioStatusSince: undefined,
        missedTransfers: this.missedTransfers.get(email) ?? 0,
        webrtcSuspended: false,
        mgaName: hier2?.mgaName ?? cust2?.mgaName ?? null,
        mgaId: hier2?.mgaId ?? null,
        rgaName: hier2?.rgaName ?? cust2?.rgaName ?? null,
        rgaId: hier2?.rgaId ?? null,
      });
    }

    // Only add agents who are in AOIrail (active heartbeat) and not already in Taalk
    for (const [email, tw] of twilioByEmail) {
      if (taalkEmails.has(email)) continue;
      if (!this.aoirailActiveAgents.has(email)) continue; // Skip if not in AOIrail
      const webrtcStatus: WebRTCStatus = twilio.mapActivityToStatus(tw.activityName);
      if (webrtcStatus === 'offline') continue;

      // Parse name/market from customers first, then Twilio attributes, then email
      const attrs = tw.attributes || {};
      const cust3 = this.customersMap.get(email);
      const fallback3 = fallbackNameFromEmail(email);
      const firstName = cust3?.firstName || toTitleCase(String(attrs.first_name || '').trim()) || fallback3.firstName;
      const lastName = cust3?.lastName || toTitleCase(String(attrs.last_name || '').trim()) || fallback3.lastName;
      const fullName = cust3?.fullName || `${firstName} ${lastName}`.trim() || fallback3.fullName;

      // Build a synthetic NormalizedAgent base for the MergedAgent
      const market = cust3?.market && cust3.market !== 'Unknown'
        ? cust3.market
        : normalizeMarket(attrs.market || attrs.markets?.[0] || '');
      const states: string[] = Array.isArray(attrs.states) ? attrs.states : [];

      merged.push({
        _id: tw.sid,
        id: 0, // No Taalk numeric ID
        firstName,
        lastName,
        fullName,
        market,
        normalizedMarket: market,
        states,
        campaign: '',
        status: 'offline' as const,
        online: false,
        busy: false,
        away: false,
        suspended: false,
        statusSince: tw.dateStatusChanged || new Date().toISOString(),
        currentTask: null,
        taskAssignedTime: null,
        lastHangupTime: null,
        lastHeartbeat: '',
        rank: null,
        email,
        taalkStatus: 'offline' as const,
        webrtcStatus,
        inboundEnabled: false,
        outboundEnabled: webrtcStatus === 'dialing' || webrtcStatus === 'ringing' || webrtcStatus === 'on_call',
        twilioActivity: tw.activityName,
        twilioStatusSince: tw.dateStatusChanged,
        missedTransfers: this.missedTransfers.get(email) ?? 0,
        webrtcSuspended: false,
        mgaName: this.hierarchyMap.get(email)?.mgaName ?? cust3?.mgaName ?? null,
        mgaId: this.hierarchyMap.get(email)?.mgaId ?? null,
        rgaName: this.hierarchyMap.get(email)?.rgaName ?? cust3?.rgaName ?? null,
        rgaId: this.hierarchyMap.get(email)?.rgaId ?? null,
      });
    }

    // ── Apply AOIrail production data (polled, more accurate than Twilio for outbound) ──
    // A fresh AOIrail heartbeat means the CCPro browser is active. Do not hide
    // these agents just because Taalk RTS has zero online agents.
    for (const ma of merged) {
      const isActive = ma.webrtcStatus === 'dialing' || ma.webrtcStatus === 'ringing' || ma.webrtcStatus === 'on_call';
      const hasAoirailHeartbeat = this.aoirailActiveAgents.has(ma.email);
      ma.outboundEnabled = isActive || hasAoirailHeartbeat;
      if (hasAoirailHeartbeat && (!ma.lastHeartbeat || ma.lastHeartbeat === '')) {
        ma.lastHeartbeat = new Date().toISOString();
      }
    }

    // Also create entries for AOIrail-tracked agents not yet in merged list
    const mergedEmailsPreWebhook = new Set(merged.map(m => m.email));
    for (const email of this.aoirailActiveAgents) {
      if (mergedEmailsPreWebhook.has(email)) continue;
      const isOnCall = this.aoirailOnCall.has(email);
      const cust4 = this.customersMap.get(email);
      const fallback4 = fallbackNameFromEmail(email);
      const firstName = cust4?.firstName || fallback4.firstName;
      const lastName = cust4?.lastName || fallback4.lastName;
      const fullName = cust4?.fullName || fallback4.fullName;
      const market4 = cust4?.market && cust4.market !== 'Unknown' ? cust4.market : 'Unknown';
      merged.push({
        _id: `aoirail-${email}`,
        id: 0,
        firstName,
        lastName,
        fullName,
        market: market4,
        normalizedMarket: market4,
        states: cust4?.states || [],
        campaign: '',
        status: 'offline' as const,
        online: false,
        busy: false,
        away: false,
        suspended: false,
        statusSince: new Date().toISOString(),
        currentTask: null,
        taskAssignedTime: null,
        lastHangupTime: null,
        lastHeartbeat: new Date().toISOString(),
        rank: null,
        email,
        taalkStatus: 'offline' as const,
        webrtcStatus: 'idle' as WebRTCStatus,
        inboundEnabled: false,
        outboundEnabled: true,
        twilioActivity: undefined,
        twilioStatusSince: undefined,
        missedTransfers: this.missedTransfers.get(email) ?? 0,
        webrtcSuspended: false,
        ccPro: cust4?.ccPro ?? false,
        mgaName: this.hierarchyMap.get(email)?.mgaName ?? cust4?.mgaName ?? null,
        mgaId: this.hierarchyMap.get(email)?.mgaId ?? null,
        rgaName: this.hierarchyMap.get(email)?.rgaName ?? cust4?.rgaName ?? null,
        rgaId: this.hierarchyMap.get(email)?.rgaId ?? null,
      });
    }

    // ── Merge webhook presence (real-time push from AOIrail WebRTC client) ──
    // Webhook takes PRIORITY over both Twilio and AOIrail polling (push > poll)
    const mergedEmails = new Set(merged.map(m => m.email));
    for (const [email, wp] of this.webhookPresence) {
      // Map webhook status to WebRTCStatus type
      const mappedStatus: WebRTCStatus =
        wp.status === 'available' ? 'idle' :
        wp.status === 'on_call' ? 'dialing' :
        wp.status === 'dialing' ? 'dialing' :
        wp.status === 'ringing' ? 'dialing' :
        'offline';

      const existing = merged.find(m => m.email === email);
      if (existing) {
        // Override webrtcStatus — webhook is more granular. Reset timer on state change.
        if (existing.webrtcStatus !== mappedStatus) existing.twilioStatusSince = new Date(wp.updatedAt).toISOString();
        existing.webrtcStatus = mappedStatus;
        const isActive = mappedStatus === 'dialing' || mappedStatus === 'on_call';
        existing.outboundEnabled = isActive;
      } else if (mappedStatus !== 'offline') {
        // Create synthetic agent from webhook data
        const cust5 = this.customersMap.get(email);
        const hier5 = this.hierarchyMap.get(email) || this.hierarchyMap.get(cust5?.companyEmail || '');
        const fallback5 = fallbackNameFromEmail(email);
        const webhookName = toTitleCase(String(wp.name || '').trim());
        const firstName = cust5?.firstName || (webhookName ? webhookName.split(/\s+/)[0] : fallback5.firstName);
        const lastName = cust5?.lastName || (webhookName ? webhookName.split(/\s+/).slice(1).join(' ') : fallback5.lastName);
        const fullName = cust5?.fullName || webhookName || fallback5.fullName;
        const webhookMarket = normalizeMarket(wp.market || '');
        const market5 = choosePreferredMarket(webhookMarket, cust5?.market || '');
        merged.push({
          _id: `webhook-${email}`,
          id: 0,
          firstName,
          lastName,
          fullName,
          market: market5,
          normalizedMarket: market5,
          states: (cust5?.states?.length ? cust5.states : (wp.states || [])),
          campaign: '',
          status: 'offline' as const,
          online: false,
          busy: false,
          away: false,
          suspended: false,
          statusSince: new Date().toISOString(),
          currentTask: null,
          taskAssignedTime: null,
          lastHangupTime: null,
          lastHeartbeat: '',
          rank: null,
          email,
          taalkStatus: 'offline' as const,
          webrtcStatus: mappedStatus,
          inboundEnabled: false,
          outboundEnabled: mappedStatus === 'dialing' || mappedStatus === 'on_call',
          twilioActivity: undefined,
          twilioStatusSince: undefined,
          missedTransfers: this.missedTransfers.get(email) ?? 0,
          webrtcSuspended: false,
          ccPro: cust5?.ccPro ?? false,
          mgaName: hier5?.mgaName ?? cust5?.mgaName ?? null,
          mgaId: hier5?.mgaId ?? null,
          rgaName: hier5?.rgaName ?? cust5?.rgaName ?? null,
          rgaId: hier5?.rgaId ?? null,
        });
      }
    }

    // Merge push presence (direct POST from AOIrail — real-time, never cleared by poll)
    for (const [email, pp] of this.pushPresence) {
      // Expire push entries after 45s (must outlast poll intervals to avoid flicker)
      if (Date.now() - pp.updatedAt > 45_000) { this.pushPresence.delete(email); continue; }
      const mappedStatus: any = pp.status === 'on_call' ? 'on_call' : pp.status === 'dialing' ? 'dialing' : pp.status === 'ringing' ? 'dialing' : pp.status === 'available' ? 'idle' : 'idle';
      const existing = merged.find(m => m.email === email);
      if (existing && mappedStatus !== 'idle') {
        existing.webrtcStatus = mappedStatus;
        existing.outboundEnabled = mappedStatus === 'dialing' || mappedStatus === 'on_call';
        // Use push presence timestamp as twilioStatusSince so time display is accurate
        existing.twilioStatusSince = new Date(pp.updatedAt).toISOString();
      }
    }

    // ── Debounce on_call → only show after 25s continuous ──
    const now2 = Date.now();
    for (const ma of merged) {
      if (ma.webrtcStatus === 'on_call') {
        const since = this.onCallSince.get(ma.email);
        if (!since) {
          // First time seeing on_call — start the clock, show as dialing for now
          this.onCallSince.set(ma.email, now2);
          ma.webrtcStatus = 'dialing' as any;
        } else if (now2 - since < ON_CALL_DEBOUNCE_MS) {
          // Under 25s — still dialing
          ma.webrtcStatus = 'dialing' as any;
        }
        // else: over 25s — keep on_call (real live call)
      } else {
        // Not on_call — clear the tracker
        this.onCallSince.delete(ma.email);
      }
    }

    // Ground truth: Twilio active calls override webrtcStatus
    for (const ma of merged) {
      if (this.twilioActiveCalls.has(ma.email)) {
        if (ma.webrtcStatus !== 'on_call') ma.webrtcStatus = 'on_call' as any;
        ma.outboundEnabled = true;
      }
    }

    // ── Inject agents from Supabase twilio_call_logs today not already in merged ──
    // Must happen BEFORE prevMap so injected agents get timestamp preservation on subsequent builds
    const mergedEmailsForTwilio = new Set(merged.map(m => m.email.toLowerCase()));
    for (const email of this.twilioCallAgentsToday) {
      if (mergedEmailsForTwilio.has(email)) continue;
      const cust = this.customersMap.get(email);
      const fallback = fallbackNameFromEmail(email);
      const firstName = cust?.firstName || fallback.firstName;
      const lastName = cust?.lastName || fallback.lastName;
      const fullName = cust?.fullName || fallback.fullName;
      const market = cust?.market && cust.market !== 'Unknown' ? cust.market : 'Unknown';
      const cached = this.applyHierarchyCache(email, cust?.mgaName, cust?.rgaName);
      merged.push({
        _id: `twilio-log-${email}`,
        id: 0, firstName, lastName, fullName, market, normalizedMarket: market,
        states: cust?.states || [], campaign: '',
        status: 'offline' as const, online: false, busy: false, away: false, suspended: false,
        statusSince: new Date().toISOString(), currentTask: null, taskAssignedTime: null,
        lastHangupTime: null, lastHeartbeat: '', rank: null, email,
        ccPro: cust?.ccPro ?? false,
        taalkStatus: 'offline' as const, webrtcStatus: 'offline' as WebRTCStatus,
        inboundEnabled: false, outboundEnabled: false,
        twilioActivity: undefined, twilioStatusSince: undefined,
        missedTransfers: 0, webrtcSuspended: false,
        mgaName: cached.mgaName, mgaId: null, rgaName: cached.rgaName, rgaId: null,
      });
      mergedEmailsForTwilio.add(email);
    }

    // Preserve timestamps: if webrtcStatus didn't change from last poll, keep the old timestamp
    // Cap: never show a timer older than 8 hours (Twilio can have stale BusyOnCall for months)
    const MAX_STATUS_AGE_MS = 8 * 60 * 60 * 1000;
    const prevMap = new Map(this.mergedAgents.map(m => [m.email, m]));
    for (const ma of merged) {
      const prev = prevMap.get(ma.email);
      // Once known, keep stable profile metadata through transient upstream gaps.
      // hierarchyCache ensures this survives for the full process lifetime, not just the previous poll.
      const cached = this.applyHierarchyCache(ma.email, ma.mgaName, ma.rgaName);
      ma.mgaName = cached.mgaName;
      ma.rgaName = cached.rgaName;
      if ((!ma.market || ma.market === 'Unknown') && prev?.market && prev.market !== 'Unknown') {
        ma.market = prev.market;
        ma.normalizedMarket = prev.normalizedMarket || prev.market;
      }
      if (prev && prev.webrtcStatus === ma.webrtcStatus && prev.twilioStatusSince) {
        ma.twilioStatusSince = prev.twilioStatusSince;
      } else if (!ma.twilioStatusSince && ma.webrtcStatus !== 'offline' && ma.webrtcStatus !== 'idle') {
        ma.twilioStatusSince = new Date().toISOString();
      }
      // Cap stale timestamps — if older than 8h, reset to now
      if (ma.twilioStatusSince && (Date.now() - new Date(ma.twilioStatusSince).getTime() > MAX_STATUS_AGE_MS)) {
        ma.twilioStatusSince = new Date().toISOString();
      }
    }
    // ── Sanitize sentinel mga/rga values ("0", "null") on all merged agents ──
    const SENTINEL_VALUES = new Set(['0', 'null', 'none', 'n/a', '']);
    const sanitizeName = (v: string | null | undefined): string | null => {
      if (!v) return null;
      const t = v.trim();
      return SENTINEL_VALUES.has(t.toLowerCase()) ? null : toTitleCase(t) || null;
    };
    for (const ma of merged) {
      if (ma.mgaName && SENTINEL_VALUES.has(ma.mgaName.trim().toLowerCase())) ma.mgaName = null;
      if (ma.rgaName && SENTINEL_VALUES.has(ma.rgaName.trim().toLowerCase())) ma.rgaName = null;
    }

    // -- Inject synthetic offline entry for each unique MGA name that has no own agent row --
    // This ensures MGA group headers appear even if the MGA person is not in Taalk/Twilio today.
    const mergedEmailsFinal = new Set(merged.map(m => m.email.toLowerCase()));
    const mergedNameSet = new Set(merged.map(m => toTitleCase((m.fullName || '').trim())).filter(Boolean));
    const seenSyntheticMgas = new Set<string>();
    for (const [, custMga] of this.customersMap) {
      const mgaRaw = sanitizeName(custMga.mgaName);
      if (!mgaRaw) continue;
      if (seenSyntheticMgas.has(mgaRaw)) continue;
      seenSyntheticMgas.add(mgaRaw);
      // Skip if there is already a merged agent whose fullName matches this MGA name
      if (mergedNameSet.has(mgaRaw)) continue;
      // Find the MGA person's own customer record by matching fullName
      let mgaEmail = '';
      let mgaCustRecord: typeof custMga | undefined;
      for (const [em, cr] of this.customersMap) {
        if (!cr.companyEmail || cr.companyEmail.toLowerCase() !== em) continue;
        if (toTitleCase((cr.fullName || '').trim()) === mgaRaw) {
          mgaEmail = em;
          mgaCustRecord = cr;
          break;
        }
      }
      if (!mgaEmail || mergedEmailsFinal.has(mgaEmail)) continue;
      const fb = fallbackNameFromEmail(mgaEmail);
      const cachedMga = this.applyHierarchyCache(mgaEmail, mgaRaw, sanitizeName(mgaCustRecord?.rgaName));
      merged.push({
        _id: `offline-mga-${mgaEmail}`,
        id: 0,
        firstName: mgaCustRecord?.firstName || fb.firstName,
        lastName: mgaCustRecord?.lastName || fb.lastName,
        fullName: mgaRaw,
        market: mgaCustRecord?.market && mgaCustRecord.market !== 'Unknown' ? mgaCustRecord.market : 'Unknown',
        normalizedMarket: mgaCustRecord?.market && mgaCustRecord.market !== 'Unknown' ? mgaCustRecord.market : 'Unknown',
        states: mgaCustRecord?.states || [],
        campaign: '',
        status: 'offline' as const,
        online: false,
        busy: false,
        away: false,
        suspended: false,
        statusSince: new Date().toISOString(),
        currentTask: null,
        taskAssignedTime: null,
        lastHangupTime: null,
        lastHeartbeat: '',
        rank: null,
        email: mgaEmail,
        ccPro: mgaCustRecord?.ccPro ?? true,
        taalkStatus: 'offline' as const,
        webrtcStatus: 'offline' as WebRTCStatus,
        inboundEnabled: false,
        outboundEnabled: false,
        twilioActivity: undefined,
        twilioStatusSince: undefined,
        missedTransfers: 0,
        webrtcSuspended: false,
        mgaName: mgaRaw, // They ARE their own MGA
        mgaId: null,
        rgaName: cachedMga.rgaName,
        rgaId: null,
      });
      mergedEmailsFinal.add(mgaEmail);
    }

    this.mergedAgents = merged;
    return merged;
  }

  // ── Track missed transfers ──
  // Called after each Taalk transfer completes. Increments missed count for
  // agents licensed in the transfer's state who are outbound-only (not on Taalk).
  trackMissedTransfer(transferState: string) {
    if (!transferState) return;
    const st = transferState.toUpperCase().trim();

    for (const ma of this.mergedAgents) {
      // Agent is outbound-active but NOT on inbound
      if (ma.outboundEnabled && !ma.inboundEnabled) {
        // Check if they're licensed for this state
        if (ma.states.some(s => s.toUpperCase().trim() === st)) {
          const prev = this.missedTransfers.get(ma.email) ?? 0;
          this.missedTransfers.set(ma.email, prev + 1);
        }
      }
    }
  }

  // ── Get merged agents ──
  getMergedAgents(): MergedAgent[] {
    return this.mergedAgents;
  }

  getHierarchyForEmail(email: string): { mgaName: string | null; mgaId: number | null; rgaName: string | null; rgaId: number | null } | null {
    const key = String(email || '').toLowerCase().trim();
    if (!key) return null;
    return this.hierarchyMap.get(key) ?? null;
  }

  getCustomerForEmail(email: string): {
    companyEmail: string;
    market: string;
    mgaName: string | null;
    rgaName: string | null;
    states: string[];
    firstName: string;
    lastName: string;
    fullName: string;
  } | null {
    const key = String(email || '').toLowerCase().trim();
    if (!key) return null;
    const rec = this.customersMap.get(key);
    if (!rec) return null;
    // Also check hierarchy map for RGA
    const hier = this.hierarchyMap.get(key);
    return {
      companyEmail: rec.companyEmail,
      market: rec.market,
      mgaName: rec.mgaName || hier?.mgaName || null,
      rgaName: (rec as any).rgaName || hier?.rgaName || null,
      states: rec.states,
      firstName: rec.firstName,
      lastName: rec.lastName,
      fullName: rec.fullName,
    };
  }

  getScopedAgentEmailsForViewer(email: string): Set<string> | null {
    const viewerEmail = String(email || '').toLowerCase().trim();
    if (!viewerEmail) return new Set<string>();
    if (viewerEmail === 'cnsysop@aoglobelife.com' || viewerEmail === 'robhay@aoglobelife.com') return null; // null = unrestricted

    const viewerHierarchy = this.getHierarchyForEmail(viewerEmail);
    const viewerMga = viewerHierarchy?.mgaName ? String(viewerHierarchy.mgaName).trim().toLowerCase() : '';
    const scoped = new Set<string>([viewerEmail]);

    if (!viewerMga) return scoped;

    for (const [agentEmail, hier] of this.hierarchyMap.entries()) {
      const agentMga = hier?.mgaName ? String(hier.mgaName).trim().toLowerCase() : '';
      if (agentMga && agentMga === viewerMga) scoped.add(agentEmail);
    }

    return scoped;
  }

  // ── Poll Twilio ──
  async pollTwilio() {
    if (this.pollInFlight.has('twilio')) return;
    this.pollInFlight.add('twilio');
    try {
      // Auto-clean stale BusyOnCall workers (>5 min stuck)
      const cleaned = await twilio.cleanStaleBusyWorkers();
      if (cleaned > 0) console.log(`[Twilio] Cleaned ${cleaned} stale BusyOnCall workers`);

      this.twilioWorkers = await twilio.fetchAllWorkers();
      
      // Poll active Twilio calls for ground-truth on-call status
      const activeTwilioCalls = await twilio.fetchActiveCalls().catch(() => []);
      const onCallEmails = new Set(activeTwilioCalls.filter(c => c.email).map(c => c.email));
      this.twilioActiveCalls = onCallEmails;
      
      this.lastTwilioPoll = Date.now();

      // Rebuild merged view
      this.buildMergedAgents();

      // Cross-system orchestration
      const crossActions = await this.autoManager.processCrossSystemUpdates(this.mergedAgents, this.webrtcSuspendedAgents);

      // Auto-manage Taalk VDP based on outbound activity
      await autoVDPManager.processUpdate(
        this.mergedAgents, this.agentCredits,
        (email, agentId) => this.getAgentCredits(email, agentId),
      ).catch(e => console.error('[AutoVDP]', e));

      // Recompute stats with merged data
      this.computeStats();

      // Broadcast merged data
      this.broadcast({
        type: 'agents_update',
        data: { agents: this.agents, mergedAgents: this.mergedAgents, stats: this.stats },
        timestamp: new Date().toISOString(),
      });

      if (crossActions.length > 0) {
        this.broadcast({ type: 'auto_action', data: crossActions, timestamp: new Date().toISOString() });
      }

      console.log(`[Twilio] Polled ${this.twilioWorkers.length} workers (${this.twilioWorkers.filter(w => twilio.mapActivityToStatus(w.activityName) !== 'offline').length} active)`);
    } catch (err) {
      console.error('[Twilio poll error]', err);
    } finally {
      this.pollInFlight.delete('twilio');
    }
  }

  // ── Poll RTS ──
  async pollRTS() {
    if (this.pollInFlight.has('rts')) return;
    this.pollInFlight.add('rts');
    try {
      const raw = await taalk.fetchRTS();
      const newAgents = raw.map(normalizeAgent);

      // Track missed transfers before updating agents
      // (detect new transfers that just completed by comparing tasks)
      for (const agent of newAgents) {
        const prevTask = this.lastSeenTask.get(agent.id);
        if (agent.currentTask && agent.currentTask !== prevTask && agent.callInfo?.leadState) {
          // New transfer received — track missed for outbound-only agents
          this.trackMissedTransfer(agent.callInfo.leadState);
        }
      }

      this.trackActivity(newAgents);
      this.agents = newAgents;

      // Rebuild merged view with latest Taalk data
      this.buildMergedAgents();

      // Priority queue
      this._queuePositions = calculateQueuePositions(
        this.agents, this.agentCallsToday,
        this.agentIdleAccumulator, this.lastCallEndTime,
        (agentId) => {
          const agent = this.agents.find(a => a.id === agentId);
          if (!agent) return null;
          const email = this.buildEmailFromAgent(agent);
          return this.getAgentCredits(email, agentId);
        },
      );

      // Sync ranks to Taalk — only after credits have been loaded at least once
      if (this.lastCreditsPoll > 0) {
        // Demote agents who missed calls — check incoming transfers
        this.demoteMissedAgents();
        // Taalk rank is written only by reactor (agent-scorer). Old syncRanksToTaalk used
        // priority-queue's Math.max(90 - i, 1), which slammed most agents to rank 1 every poll.
        // Auto-throttle campaigns if calls aren't being answered
        this.autoThrottleCampaigns().catch(() => {});
      }

      // Suspend online agents with 0 credits — only after credits loaded
      if (this.lastCreditsPoll > 0) {
        this.suspendZeroCreditAgents().catch(() => {});
      }

      // Sync queue positions to Supabase — only after credits loaded
      if (this.lastCreditsPoll > 0) {
        this.syncQueueToSupabase(this._queuePositions).catch(() => {});
      }

      this.computeStats();

      const actions = await this.autoManager.processAgentUpdates(this.agents);
      const rateActions = await this.autoManager.optimizeCampaignRates(this.agents, this.campaigns);
      actions.push(...rateActions);

      this.computeStats();
      this.lastRTSPoll = Date.now();

      const activeCalls = this.getActiveCalls();
      const dialingCampaigns = this.getDialingCampaigns();

      this.broadcast({ type: 'agents_update', data: { agents: this.agents, mergedAgents: this.mergedAgents, stats: this.stats }, timestamp: new Date().toISOString() });
      this.broadcast({ type: 'activity_summary', data: this.getActivitySummary(), timestamp: new Date().toISOString() });
      this.broadcast({ type: 'active_calls', data: { activeCalls, completedTransfers: this.getCompletedTransfers(), missedTransfers: this.getMissedTransfers() }, timestamp: new Date().toISOString() });
      this.broadcast({ type: 'dialing_now', data: dialingCampaigns, timestamp: new Date().toISOString() });
      this.broadcast({ type: 'queue_positions', data: this._queuePositions, timestamp: new Date().toISOString() });

      if (actions.length > 0) {
        this.broadcast({ type: 'auto_action', data: actions, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      console.error('[RTS poll error]', err);
    } finally {
      this.pollInFlight.delete('rts');
    }
  }

  async pollRoster() {
    try {
      const raw = await taalk.fetchAllAgents();
      this.allAgents = raw.map(normalizeAgent);
      this.lastRosterPoll = Date.now();
    } catch (err) { console.error('[Roster poll error]', err); }
  }

  async pollCampaigns() {
    if (this.pollInFlight.has('campaigns')) return;
    this.pollInFlight.add('campaigns');
    try {
      const raw = await taalk.fetchAllCampaigns();
      this.campaigns = raw.map(normalizeCampaign);
      this.autoManager.updateCampaignMap(this.campaigns);
      this.computeStats();
      this.lastCampaignPoll = Date.now();
      this.broadcast({ type: 'campaigns_update', data: { campaigns: this.campaigns, stats: this.stats }, timestamp: new Date().toISOString() });
    } catch (err) { console.error('[Campaign poll error]', err); }
    finally { this.pollInFlight.delete('campaigns'); }
  }

  computeStats() {
    const online = this.agents.filter(a => a.online && !a.suspended);
    const runningCampaigns = this.campaigns.filter(c => c.status === 'running');
    const configuredRate = runningCampaigns.reduce((s, c) => s + c.limitPerHour, 0);
    const campaignsWithCalls = runningCampaigns.filter(c => c.callsMade > 0);
    const avgAnswerRate = campaignsWithCalls.length > 0
      ? Math.round(campaignsWithCalls.reduce((s, c) => s + c.answerRate, 0) / campaignsWithCalls.length * 10) / 10 : 0;

    const idleAgents = online.filter(a => !a.busy && !a.away);
    let avgIdleTime = 0;
    if (idleAgents.length > 0) {
      let totalIdle = 0;
      for (const a of idleAgents) totalIdle += this.agentIdleAccumulator.get(a.id) ?? 0;
      avgIdleTime = totalIdle / idleAgents.length;
    }

    const statesSet = new Set<string>();
    for (const agent of idleAgents) for (const st of agent.states) statesSet.add(st.toUpperCase().trim());

    // Per-market capacity breakdown
    const idleByMkt = new Map<string, number>();
    for (const a of idleAgents) {
      const mkt = a.normalizedMarket || 'Unknown';
      idleByMkt.set(mkt, (idleByMkt.get(mkt) ?? 0) + 1);
    }
    const perMarketCapacity: MarketCapacity[] = [...idleByMkt.entries()]
      .map(([market, cnt]) => ({ market, idleAgents: cnt, capacity: cnt * 150 }))
      .sort((a, b) => b.capacity - a.capacity);

    // Twilio / merged stats
    const outboundActive = this.mergedAgents.filter(a => a.outboundEnabled).length;
    const inboundEnabled = this.mergedAgents.filter(a => a.inboundEnabled).length;
    const bothActive = this.mergedAgents.filter(a => a.inboundEnabled && a.outboundEnabled).length;
    const outboundOnly = this.mergedAgents.filter(a => a.outboundEnabled && !a.inboundEnabled).length;
    const outboundIdle = this.mergedAgents.filter(a => a.outboundEnabled && a.webrtcStatus === 'idle' && this.aoirailActiveAgents.has(a.email)).length;

    this.stats = {
      totalOnline: online.length,
      totalBusy: online.filter(a => a.busy).length,
      totalIdle: idleAgents.length,
      totalAway: online.filter(a => a.away).length,
      totalSuspended: this.agents.filter(a => a.suspended).length + this.allAgents.filter(a => a.suspended && !this.agents.find(o => o.id === a.id)).length,
      totalOffline: this.allAgents.length - online.length,
      campaignsRunning: runningCampaigns.length,
      campaignsStopped: this.campaigns.filter(c => c.status === 'stopped').length,
      totalDialsThisHour: this.campaigns.reduce((s, c) => s + c.callsThisHour, 0),
      totalLeads: this.campaigns.reduce((s, c) => s + c.contactCount, 0),
      autoManagementEnabled: this.autoManager.enabled,
      configuredRate, avgAnswerRate, avgIdleTime,
      campaignsThrottled: this.autoManager.getThrottledCount(),
      statesCovered: [...statesSet].sort(),
      transferStats: this.getTransferStats(),
      outboundActive,
      inboundEnabled,
      bothActive,
      outboundOnly,
      outboundIdle,
      revenue: this.getRevenueStats(),
      supabase: this.supabaseConnects.lastPolled ? this.supabaseConnects : undefined,
      perMarketCapacity,
    };
  }

  // ── Build leaderboard from billing_transactions connect rows ──
  private buildLeaderboard(rows: BillingConnectRow[]): LeaderboardEntry[] {
    // Build associate_id → Taalk numeric id lookup from roster (for agentId field)
    const emailToId = new Map<string, number>();
    for (const agent of [...this.allAgents, ...this.agents]) {
      const email = `${(agent.firstName || '').toLowerCase().replace(/\s+/g, '')}${(agent.lastName || '').toLowerCase().replace(/\s+/g, '')}@aoglobelife.com`;
      emailToId.set(email, agent.id);
      if (agent.normalizedMarket) emailToId.set(email + '__market', agent.id); // reuse map for market fallback
    }
    const emailToMarket = new Map<string, string>();
    for (const agent of [...this.allAgents, ...this.agents]) {
      const email = `${(agent.firstName || '').toLowerCase().replace(/\s+/g, '')}${(agent.lastName || '').toLowerCase().replace(/\s+/g, '')}@aoglobelife.com`;
      if (agent.normalizedMarket) emailToMarket.set(email, agent.normalizedMarket);
    }

    // Group by agent_email — each row is already a billable connect (billing_transactions only has duration>15s connects)
    const agentMap = new Map<string, {
      agentId: number;
      agentName: string;
      market: string;
      billableCalls: number;
      revenue: number;
      lastCallTime: string;
    }>();

    for (const row of rows) {
      const email = (row.agent_email || '').toLowerCase().trim();
      if (!email) continue;

      let entry = agentMap.get(email);
      if (!entry) {
        const market = row.metadata?.market || emailToMarket.get(email) || 'Unknown';
        entry = {
          agentId: row.agent_associate_id ?? emailToId.get(email) ?? 0,
          agentName: row.agent_name || email.split('@')[0],
          market,
          billableCalls: 0,
          revenue: 0,
          lastCallTime: '',
        };
        agentMap.set(email, entry);
      }

      entry.billableCalls++;
      entry.revenue += row.amount_usd ?? 8;
      // rows ordered transaction_date desc — first seen per agent = latest call
      if (!entry.lastCallTime && row.transaction_date) {
        entry.lastCallTime = row.transaction_date;
      }
      if (!entry.market && row.metadata?.market) entry.market = row.metadata.market;
    }

    const leaderboard: LeaderboardEntry[] = [];

    for (const [email, data] of agentMap) {
      leaderboard.push({
        agentId: data.agentId,
        agentName: data.agentName,
        email,
        market: data.market,
        totalCalls: data.billableCalls,   // billing_transactions only has billable connects
        billableCalls: data.billableCalls,
        revenue: data.revenue,
        avgDuration: 0,  // billing_transactions doesn't store duration
        lastCallTime: data.lastCallTime,
      });
    }

    leaderboard.sort((a, b) => b.revenue - a.revenue || b.billableCalls - a.billableCalls);
    return leaderboard;
  }

  // ── Get leaderboard ──
  getLeaderboard(): LeaderboardEntry[] {
    return this.leaderboard;
  }

  // ── Poll Supabase for accurate billable connects + leaderboard ──
  async pollSupabase() {
    if (this.pollInFlight.has('supabase')) return;
    this.pollInFlight.add('supabase');
    try {
      const rows = await fetchBillingConnects();

      const connects = rows.length;
      const revenue = rows.reduce((sum, r) => sum + (r.amount_usd ?? 8), 0);
      this.supabaseConnects = {
        connects,
        revenue,
        lastPolled: new Date().toISOString(),
      };
      this.lastSupabasePoll = Date.now();

      // Build leaderboard
      this.leaderboard = this.buildLeaderboard(rows);

      // Update stats and broadcast
      this.computeStats();
      this.broadcast({
        type: 'stats_update',
        data: this.stats,
        timestamp: new Date().toISOString(),
      });
      this.broadcast({
        type: 'leaderboard_update',
        data: this.leaderboard,
        timestamp: new Date().toISOString(),
      });

      console.log(`[Supabase] Billable connects today: ${connects} (~$${revenue}), Leaderboard: ${this.leaderboard.length} agents`);
    } catch (err) {
      console.error('[Supabase poll error]', err);
    } finally {
      this.pollInFlight.delete('supabase');
    }
  }

  // ── Customers: licensed states + CCPRO + market + names ──
  private customersMap = new Map<string, {
    companyEmail: string;
    states: string[];
    ccPro: boolean;
    market: string;
    firstName: string;
    lastName: string;
    fullName: string;
    mgaName: string | null;
    rgaName: string | null;
  }>();

  async pollCustomers() {
    try {
      const nextCustomersMap = new Map<string, {
        companyEmail: string;
        states: string[];
        ccPro: boolean;
        market: string;
        firstName: string;
        lastName: string;
        fullName: string;
        mgaName: string | null;
        rgaName: string | null;
      }>();
      const uniqueCompanies = new Set<string>();

      let offset = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const url = `${SUPA_URL}/rest/v1/customers?select=company_email,personal_email,states,CCPRO,market,agent_name,first_name,last_name,mga,rga&limit=${PAGE_SIZE}&offset=${offset}`;
        const res = await fetch(url, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } });
        if (!res.ok) throw new Error(`customers ${res.status}`);
        const rows: {
          company_email: string | null;
          personal_email: string | null;
          states: string[] | null;
          CCPRO: boolean | null;
          market: unknown;
          agent_name: string | null;
          first_name: string | null;
          last_name: string | null;
          mga: string | null;
          rga: string | null;
        }[] = await res.json();

        for (const r of rows) {
          const companyEmail = String(r.company_email || '').toLowerCase().trim();
          const personalEmail = String(r.personal_email || '').toLowerCase().trim();
          const canonical = companyEmail || personalEmail;
          if (!canonical || !canonical.includes('@')) continue;

          const fallback = fallbackNameFromEmail(canonical);
          const firstName = toTitleCase(String(r.first_name || '').trim()) || fallback.firstName;
          const lastName = toTitleCase(String(r.last_name || '').trim()) || fallback.lastName;
          const fullNameFromParts = `${firstName} ${lastName}`.trim();
          const fullNameFromAgentName = toTitleCase(String(r.agent_name || '').trim());
          // Prefer first/last composition over agent_name because some source rows
          // contain collapsed values like "avilajohn" in agent_name.
          const fullName = fullNameFromParts || fullNameFromAgentName || fallback.fullName;
          const record = {
            companyEmail: companyEmail || canonical,
            states: Array.isArray(r.states) ? r.states : [],
            ccPro: !!r.CCPRO,
            market: parseCustomerMarket(r.market),
            firstName,
            lastName,
            fullName,
            mgaName: sanitizeHierarchyName(r.mga),
            rgaName: sanitizeHierarchyName(r.rga),
          };

          if (companyEmail && companyEmail.includes('@')) {
            nextCustomersMap.set(companyEmail, record);
            uniqueCompanies.add(companyEmail);
          }
          if (personalEmail && personalEmail.includes('@')) {
            nextCustomersMap.set(personalEmail, record);
          }
        }

        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
        if (offset > 50000) break;
      }
      // Atomic swap avoids transient empty cache during pagination refresh.
      this.customersMap = nextCustomersMap;

      // ── Populate ccProRoster (company-email-keyed, ccPro=true only) ──
      // Stored separately — NOT injected into mergedAgents. Used only for the N/Total denominator.
      const nextRoster = new Map<string, {
        email: string; fullName: string; firstName: string; lastName: string;
        market: string; mgaName: string | null; rgaName: string | null; ccPro: boolean;
      }>();
      for (const [email, cust] of nextCustomersMap) {
        if (!cust.ccPro) continue;
        if (!email.includes('@')) continue;
        // Only index by company email to avoid double-counting personal email aliases
        if (email !== cust.companyEmail.toLowerCase()) continue;
        nextRoster.set(email, {
          email,
          fullName: cust.fullName,
          firstName: cust.firstName,
          lastName: cust.lastName,
          market: cust.market,
          mgaName: cust.mgaName,
          rgaName: cust.rgaName,
          ccPro: true,
        });
      }
      this.ccProRoster = nextRoster;

      console.log(`[Customers] Loaded ${uniqueCompanies.size} customer records (${this.customersMap.size} email aliases incl personal/company); CCPro roster: ${this.ccProRoster.size}`);
    } catch (err) {
      console.error('[Customers poll error]', err);
    }
  }

  // ── Agent hierarchy (MGA/RGA) from Supabase agent_hierarchy ──
  private hierarchyMap = new Map<string, { mgaName: string | null; mgaId: number | null; rgaName: string | null; rgaId: number | null }>();

  async pollHierarchy() {
    try {
      const url = `${SUPA_URL}/rest/v1/agent_hierarchy?select=agent_email,mga_name,mga_associate_id,rga_name,rga_associate_id&limit=5000`;
      const res = await fetch(url, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } });
      if (!res.ok) throw new Error(`agent_hierarchy ${res.status}`);
      const rows: { agent_email: string; mga_name: string | null; mga_associate_id: number | null; rga_name: string | null; rga_associate_id: number | null }[] = await res.json();
      this.hierarchyMap.clear();
      for (const r of rows) {
        if (!r.agent_email) continue;
        this.hierarchyMap.set(r.agent_email.toLowerCase().trim(), {
          mgaName: r.mga_name ?? null,
          mgaId: r.mga_associate_id ?? null,
          rgaName: r.rga_name ?? null,
          rgaId: r.rga_associate_id ?? null,
        });
      }

      // Fallback source: producerlist carries MGA/RGA for many agents missing in agent_hierarchy.
      let producerOffset = 0;
      const PRODUCER_PAGE = 1000;
      while (true) {
        const producerUrl = `${SUPA_URL}/rest/v1/producerlist?select=company_email,personal_email,mga,rga&limit=${PRODUCER_PAGE}&offset=${producerOffset}`;
        const producerRes = await fetch(producerUrl, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } });
        if (!producerRes.ok) throw new Error(`producerlist ${producerRes.status}`);
        const producerRows: Array<{ company_email: string | null; personal_email: string | null; mga: string | null; rga: string | null }> = await producerRes.json();

        for (const p of producerRows) {
          const company = String(p.company_email || '').toLowerCase().trim();
          const personal = String(p.personal_email || '').toLowerCase().trim();
          const aliases = [company, personal].filter((e) => e.includes('@'));
          if (aliases.length === 0) continue;
          for (const email of aliases) {
            const prev = this.hierarchyMap.get(email);
            const nextMga = prev?.mgaName ?? (toTitleCase(String(p.mga || '').trim()) || null);
            const nextRga = prev?.rgaName ?? (toTitleCase(String(p.rga || '').trim()) || null);
            this.hierarchyMap.set(email, {
              mgaName: nextMga,
              mgaId: prev?.mgaId ?? null,
              rgaName: nextRga,
              rgaId: prev?.rgaId ?? null,
            });
          }
        }

        if (producerRows.length < PRODUCER_PAGE) break;
        producerOffset += PRODUCER_PAGE;
        if (producerOffset > 50000) break;
      }

      console.log(`[Hierarchy] Loaded ${this.hierarchyMap.size} agent records`);
    } catch (err) {
      console.error('[Hierarchy poll error]', err);
    }
  }

  // ── Poll AOIrail production for real-time WebRTC agent status ──
  async pollAoirail() {
    if (this.pollInFlight.has('aoirail')) return;
    this.pollInFlight.add('aoirail');
    try {
      const res = await fetch('https://aoirail-production.up.railway.app/api/call-connector-pro/eligible-for-inbound', {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`AOIrail ${res.status}`);
      const data = await res.json() as {
        queueLength: number;
        eligibleRingGroup: { email: string; lastHeartbeat: string }[];
        onCall: string[];
      };

      this.aoirailActiveAgents.clear();
      // Only use eligibleRingGroup for "outboundEnabled" — NOT onCall for status
      for (const agent of data.eligibleRingGroup || []) {
        this.aoirailActiveAgents.add(agent.email.toLowerCase());
      }
      // Also add onCall agents to active set (they have WebRTC sessions)
      for (const email of data.onCall || []) {
        this.aoirailActiveAgents.add(email.toLowerCase());
      }

      // Removed — push webhook is the only source for dialing/live status

      this.lastAoirailPoll = Date.now();

      // Rebuild merged view with fresh AOIrail data
      this.buildMergedAgents();
      this.computeStats();
      this.broadcast({
        type: 'agents_update',
        data: { agents: this.agents, mergedAgents: this.mergedAgents, stats: this.stats },
        timestamp: new Date().toISOString(),
      });

      console.log(`[AOIrail] Active: ${this.aoirailActiveAgents.size}, On call: ${this.aoirailOnCall.size}`);
    } catch (err) {
      console.error('[AOIrail poll error]', err);
    } finally {
      this.pollInFlight.delete('aoirail');
    }
  }

  async startPolling() {
    console.log('⚡ Starting Taalk + Twilio + AOIrail + Supabase API polling...');
    this.hierarchyCache.clear(); // clear stale cached names on restart

    // Reset ALL Twilio workers to AvailableInbound on server start — clean slate
    console.log('[Startup] Resetting all BusyOnCall workers...');
    const cleaned = await twilio.cleanStaleBusyWorkers(0).catch(() => 0); // threshold=0 means ALL
    console.log(`[Startup] Reset ${cleaned} workers`);

    // All initial polls run in parallel so startup is fast regardless of slow APIs
    // hierarchy + customers first (needed for mergedAgents), then everything else in parallel
    await Promise.all([
      this.pollHierarchy().catch(e => console.error('[startup] hierarchy:', e.message)),
      this.pollCustomers().catch(e => console.error('[startup] customers:', e.message)),
    ]);
    await Promise.all([
      this.pollCampaigns().catch(e => console.error('[startup] campaigns:', e.message)),
      this.pollRTS().catch(e => console.error('[startup] RTS:', e.message)),
      this.pollRoster().catch(e => console.error('[startup] roster:', e.message)),
      this.pollTwilio().catch(e => console.error('[startup] twilio:', e.message)),
      this.pollAoirail().catch(e => console.error('[startup] aoirail:', e.message)),
      this.pollSupabase().catch(e => console.error('[startup] supabase:', e.message)),
      this.pollCredits().catch(e => console.error('[startup] credits:', e.message)),
    ]);

    // Recalculate queue + sync ranks NOW that credits are loaded
    if (this.agents.length > 0 && this.lastCreditsPoll > 0) {
      this._queuePositions = calculateQueuePositions(
        this.agents, this.agentCallsToday,
        this.agentIdleAccumulator, this.lastCallEndTime,
        (agentId) => {
          const agent = this.agents.find(a => a.id === agentId);
          if (!agent) return null;
          const email = this.buildEmailFromAgent(agent);
          return this.getAgentCredits(email, agentId);
        },
      );
      console.log(`[Startup] Recalculated ${this._queuePositions.length} queue positions (Taalk ranks: reactor only)`);
    }

    // Booked lead webhook ownership is centralized in AOIrail server/routes.ts
    // (sendPlanetBookedWebhookOnce + webhook_sent_at claim). Keep campaign-manager
    // read-only for booked metrics so this service can never double-send to Zapier.
    if (process.env.CAMPAIGN_MANAGER_BOOKED_WEBHOOK_ENABLED === 'true') {
      console.warn('[Booked] watcher requested but hard-disabled here to prevent duplicate Planet/Zapier sends');
    } else {
      console.log('[Booked] watcher disabled in campaign-manager (AOIrail is single sender)');
    }

    // Incoming transfers — Zapier webhook is the live source now, no Supabase polling needed

    // Support tickets — sync Twilio messages to Neon DB
    const { syncTwilioMessages } = await import('./support-tickets.js');
    await syncTwilioMessages().catch(e => console.error('[startup] support:', e));
    setInterval(() => syncTwilioMessages().catch(() => {}), 120_000); // sync every 120s
    setInterval(() => this.pollRTS().catch(() => {}), 90_000);
    setInterval(() => this.pollCampaigns().catch(() => {}), 180_000);
    setInterval(() => this.pollRoster().catch(() => {}), 600_000);
    setInterval(() => this.pollTwilio().catch(() => {}), 30_000);
    setInterval(() => this.pollAoirail().catch(() => {}), 30_000);
    setInterval(() => this.pollSupabase().catch(() => {}), 60_000); // Supabase: 60s (be gentle)
    setInterval(() => this.pollHierarchy().catch(() => {}), 600_000); // Hierarchy: 10min
    setInterval(() => this.pollCustomers().catch(() => {}), 600_000); // Customers states/CCPRO: 10min
    setInterval(() => this.pollCredits().catch(() => {}), 300_000); // Credits: 5min
    await this.pollTwilioCallLogsToday().catch(() => {}); // Twilio call log agents on startup
    setInterval(() => this.pollTwilioCallLogsToday().catch(() => {}), 120_000); // refresh every 120s
    console.log('✅ Polling started — RTS: 90s, Twilio: 30s, AOIrail: 30s, Campaigns: 180s, Roster: 600s, Supabase: 60s');
  }

  // ── Incoming transfer polling (fallback for real-time webhook) ──
  async pollIncomingTransfers() {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const res = await fetch(`${SUPA_URL}/rest/v1/vdp_calls_BLASTPICK?select=event,agent,leadid,firstName,lastName,market,phone,time&order=time.desc&limit=100&time=gte.${fiveMinAgo}`, {
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
      });
      if (!res.ok) return;
      const rows: any[] = await res.json();

      // Forward to the in-memory transfer queue via internal route handler
      for (const r of rows) {
        const lid = String(r.leadid || '');
        if (!lid) continue;
        // Use the same in-memory map that the webhook endpoint uses
        // Access via the router's handler directly — just import and call
      }

      // Build the map directly here
      const transfers = (globalThis as any).__incomingTransfers as Map<string, any> | undefined;
      if (!transfers) return;

      for (const r of rows) {
        const lid = String(r.leadid || '');
        if (!lid) continue;
        if (r.event === 'BLASTER') {
          const existing = transfers.get(lid);
          if (existing) {
            if (!existing.agents.includes(String(r.agent))) existing.agents.push(String(r.agent));
          } else {
            transfers.set(lid, { leadId: lid, firstName: r.firstName || '', lastName: r.lastName || '', market: r.market || '', phone: r.phone || '', agents: [String(r.agent)], time: new Date(r.time).getTime(), pickedUp: false });
          }
        } else if (r.event === 'PICK_UP') {
          const existing = transfers.get(lid);
          if (existing) existing.pickedUp = true;
        }
      }

      // Prune old
      const cutoff = Date.now() - 5 * 60 * 1000;
      for (const [k, v] of transfers) {
        if (v.time < cutoff) transfers.delete(k);
      }
    } catch { /* non-fatal */ }
  }

  // ── Infraction system: progressive penalties for missing calls ──
  private agentInfractions = new Map<string, { misses1h: number; missesDaily: number; suspendedUntil: number; lastMissTime: number; lastResetHour: number; lastResetDay: string }>();
  private demotedAgents = new Set<number>();

  private getInfraction(agentId: string) {
    if (!this.agentInfractions.has(agentId)) {
      this.agentInfractions.set(agentId, { misses1h: 0, missesDaily: 0, suspendedUntil: 0, lastMissTime: 0, lastResetHour: 0, lastResetDay: '' });
    }
    const inf = this.agentInfractions.get(agentId)!;
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    // Reset hourly counter if >1hr since last miss
    if (now - inf.lastMissTime > 3600000) inf.misses1h = 0;
    // Reset daily counter at midnight
    if (inf.lastResetDay !== today) { inf.missesDaily = 0; inf.lastResetDay = today; }
    return inf;
  }

  demoteMissedAgents() {
    const transfers = (globalThis as any).__incomingTransfers as Map<string, any> | undefined;
    if (!transfers) return;
    const now = Date.now();

    // Build miss count per agent from current window
    const agentMisses = new Map<string, number>();
    for (const t of transfers.values()) {
      if (!t.pickedUp) {
        for (const a of t.agents) {
          agentMisses.set(a, (agentMisses.get(a) || 0) + 1);
        }
      }
    }

    for (const [agentIdStr, windowMisses] of agentMisses) {
      const agentId = parseInt(agentIdStr, 10);
      if (isNaN(agentId) || agentId <= 0) continue;
      const inf = this.getInfraction(agentIdStr);
      const agent = this.agents.find(a => a.id === agentId);
      const name = agent?.fullName || agentIdStr;

      // Track new misses (only count increases)
      if (windowMisses > inf.misses1h) {
        const newMisses = windowMisses - inf.misses1h;
        inf.misses1h = windowMisses;
        inf.missesDaily += newMisses;
        inf.lastMissTime = now;
      }

      // Always demote rank on any miss — but NEVER demote starred agents
      if (inf.misses1h >= 1 && !this.demotedAgents.has(agentId) && !this.starredAgents.has(String(agentId))) {
        this.demotedAgents.add(agentId);
        const qp = this._queuePositions.find(q => q.agentId === agentId);
        if (qp) { qp.suggestedRank = 0; qp.score = 0; }
        console.log(`[Infraction] ${name}: rank → 0 (${inf.misses1h} miss in 1h)`);
      }

      // Progressive suspension
      if (inf.missesDaily >= 10 && inf.suspendedUntil < now) {
        // 10+ daily → rest of day (suspend until midnight PST)
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 999);
        inf.suspendedUntil = midnight.getTime();
        if (agent) taalk.suspendAgent(agent._id).catch(() => {});
        console.log(`[Infraction] ${name}: SUSPENDED REST OF DAY (${inf.missesDaily} daily misses)`);
      } else if (inf.misses1h >= 5 && inf.suspendedUntil < now) {
        // 5+ hourly → 1 hour suspension
        inf.suspendedUntil = now + 3600000;
        if (agent) taalk.suspendAgent(agent._id).catch(() => {});
        console.log(`[Infraction] ${name}: SUSPENDED 1 HOUR (${inf.misses1h} misses in 1h)`);
      } else if (inf.misses1h >= 3 && inf.suspendedUntil < now) {
        // 3+ hourly → 15 min suspension
        inf.suspendedUntil = now + 900000;
        if (agent) taalk.suspendAgent(agent._id).catch(() => {});
        console.log(`[Infraction] ${name}: SUSPENDED 15 MIN (${inf.misses1h} misses in 1h)`);
      }
    }

    // Un-demote + unsuspend agents who answered a call
    for (const t of transfers.values()) {
      if (t.pickedUp) {
        for (const a of t.agents) {
          const agentId = parseInt(a, 10);
          if (this.demotedAgents.has(agentId)) {
            this.demotedAgents.delete(agentId);
            const inf = this.getInfraction(a);
            inf.misses1h = 0; // Reset hourly on pickup
            const agent = this.agents.find(ag => ag.id === agentId);
            console.log(`[Infraction] ${agent?.fullName || a}: RESTORED — answered a call`);
          }
        }
      }
    }

    // Auto-unsuspend when suspension expires
    for (const [agentIdStr, inf] of this.agentInfractions) {
      if (inf.suspendedUntil > 0 && inf.suspendedUntil < now) {
        inf.suspendedUntil = 0;
        const agentId = parseInt(agentIdStr, 10);
        const agent = this.agents.find(a => a.id === agentId);
        if (agent && agent.suspended) {
          taalk.unsuspendAgent(agent._id).catch(() => {});
          console.log(`[Infraction] ${agent.fullName}: suspension expired, unsuspended`);
        }
      }
    }
  }

  // ── Auto-throttle campaigns PER MARKET based on answer rates ──
  private lastThrottleCheck = 0;
  private campaignBaseRates = new Map<string, number>(); // campaign id → original rate (before we touched it)

  async autoThrottleCampaigns() {
    if (Date.now() - this.lastThrottleCheck < 60_000) return;
    this.lastThrottleCheck = Date.now();

    const transfers = (globalThis as any).__incomingTransfers as Map<string, any> | undefined;
    if (!transfers || transfers.size === 0) return;

    // Build per-market stats from incoming transfers
    const marketStats = new Map<string, { total: number; missed: number; picked: number }>();
    for (const t of transfers.values()) {
      const mkt = (t.market || 'Unknown').toLowerCase();
      if (!marketStats.has(mkt)) marketStats.set(mkt, { total: 0, missed: 0, picked: 0 });
      const s = marketStats.get(mkt)!;
      s.total++;
      if (t.pickedUp) s.picked++; else s.missed++;
    }

    // Count idle agents per market
    const idleByMarket = new Map<string, number>();
    for (const a of this.agents) {
      if (a.online && !a.busy && !a.away && !a.suspended) {
        const mkt = (a.normalizedMarket || 'Unknown').toLowerCase();
        idleByMarket.set(mkt, (idleByMarket.get(mkt) || 0) + 1);
      }
    }

    // Adjust each campaign based on its market's performance
    for (const camp of this.campaigns) {
      if (camp.status !== 'running' || camp.limitPerHour <= 0) continue;
      if (isAoRecruitCampaignName(camp.name || '')) continue;

      const mkt = (camp.normalizedMarket || 'Unknown').toLowerCase();
      const stats = marketStats.get(mkt);
      const idle = idleByMarket.get(mkt) || 0;

      // Store original rate first time we see it
      if (!this.campaignBaseRates.has(camp._id)) {
        this.campaignBaseRates.set(camp._id, camp.limitPerHour);
      }
      const baseRate = this.campaignBaseRates.get(camp._id) || camp.limitPerHour;

      if (!stats) continue; // No transfer data for this market yet

      const missRate = stats.total > 0 ? stats.missed / stats.total : 0;

      // Target: dial rate scales with idle agents who can actually answer
      // Base: ~100 dials/hr per idle agent (adjusted by answer rate)
      // If answer rate is 20%, only 1 in 5 dials becomes a transfer
      // So 100 dials/hr × 20% = 20 transfers/hr per idle agent = manageable
      const answerRate = stats.total > 5 ? (stats.picked / stats.total) : 0.2; // default 20% if not enough data
      const targetDialsPerAgent = Math.round(100 * Math.max(answerRate, 0.1)); // scale with answer rate, min 10
      const targetRate = Math.max(idle * targetDialsPerAgent, 30); // at least 30/hr even with 0 idle (keeps pipeline warm)

      let newRate = camp.limitPerHour;

      if (idle === 0) {
        // No agents → minimum rate just to keep leads warm
        newRate = 30;
        console.log(`[Throttle] ${mkt}: 0 idle agents → ${camp.name} ${camp.limitPerHour}→${newRate}/hr (holding pattern)`);
      } else if (missRate > 0.5) {
        // High miss rate → cut toward target
        newRate = Math.max(Math.floor(camp.limitPerHour * 0.7), targetRate, 30);
        console.log(`[Throttle] ${mkt}: miss=${(missRate * 100).toFixed(0)}% idle=${idle} target=${targetRate} → ${camp.name} ${camp.limitPerHour}→${newRate}/hr`);
      } else if (Math.abs(camp.limitPerHour - targetRate) > 20) {
        // Drift toward target rate
        if (camp.limitPerHour > targetRate) {
          newRate = Math.max(camp.limitPerHour - Math.floor((camp.limitPerHour - targetRate) * 0.3), targetRate);
        } else {
          newRate = Math.min(camp.limitPerHour + Math.floor((targetRate - camp.limitPerHour) * 0.3), targetRate, baseRate);
        }
        if (newRate !== camp.limitPerHour) {
          console.log(`[Throttle] ${mkt}: idle=${idle} answer=${(answerRate * 100).toFixed(0)}% target=${targetRate} → ${camp.name} ${camp.limitPerHour}→${newRate}/hr`);
        }
      }

      if (newRate !== camp.limitPerHour) {
        try {
          await taalk.updateCampaignRate(camp._id, newRate);
          await new Promise(r => setTimeout(r, 300)); // rate limit
        } catch { /* non-fatal */ }
      }
    }
  }

  // ── Starred agents (max rank override from admin) ──
  starredAgents = new Set<string>(['126619']); // Gavin Thomas = always starred

  // ── Agent Credits (from Supabase user_credits, keyed by associate_id via customers table) ──
  agentCredits = new Map<string, number>(); // email → credits
  agentCreditsByAssociateId = new Map<string, number>(); // associate_id → credits
  associateIdToEmail = new Map<string, string>(); // associate_id → company_email (from customers)
  associateIdToName = new Map<string, string>();  // associate_id → agent_name (from customers)
  lastCreditsPoll = 0;

  async pollCredits() {
    try {
      // Step 1: Fetch customers table — associate_id → company_email + agent_name mapping
      const emailMap = new Map<string, string>(); // associate_id → company_email
      const nameMap = new Map<string, string>();  // associate_id → agent_name
      let offset = 0;
      while (true) {
        const url = `${SUPA_URL}/rest/v1/customers?select=associate_id,company_email,agent_name&associate_id=not.is.null&limit=1000&offset=${offset}`;
        const res = await fetch(url, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } });
        if (!res.ok) break;
        const rows: { associate_id: number | string; company_email: string | null; agent_name: string | null }[] = await res.json();
        for (const r of rows) {
          if (r.associate_id) {
            const sid = String(r.associate_id);
            if (r.company_email) emailMap.set(sid, r.company_email.toLowerCase());
            if (r.agent_name) nameMap.set(sid, r.agent_name.trim());
          }
        }
        if (rows.length < 1000) break;
        offset += 1000;
        if (offset > 20000) break;
      }
      this.associateIdToEmail = emailMap;
      this.associateIdToName = nameMap;

      // Step 2: Fetch user_credits — email → credits_remaining
      const all = new Map<string, number>();
      offset = 0;
      while (true) {
        const url = `${SUPA_URL}/rest/v1/user_credits?select=email,credits_remaining&limit=1000&offset=${offset}`;
        const res = await fetch(url, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } });
        if (!res.ok) break;
        const rows: { email: string; credits_remaining: number }[] = await res.json();
        for (const r of rows) {
          if (r.email) all.set(r.email.toLowerCase(), r.credits_remaining ?? 0);
        }
        if (rows.length < 1000) break;
        offset += 1000;
        if (offset > 50000) break;
      }
      this.agentCredits = all;

      // Step 3: Build associate_id → credits lookup using the chain
      this.agentCreditsByAssociateId.clear();
      for (const [assocId, email] of this.associateIdToEmail) {
        const credits = this.agentCredits.get(email);
        if (credits !== undefined) {
          this.agentCreditsByAssociateId.set(assocId, credits);
        }
      }

      this.lastCreditsPoll = Date.now();
      console.log(`[Credits] ${this.agentCredits.size} credit records, ${this.associateIdToEmail.size} customers, ${this.agentCreditsByAssociateId.size} matched by associate_id`);
    } catch (err) {
      console.error('[Credits poll error]', err);
    }
  }

  // ── Sync queue positions to Supabase ──
  private lastQueueSync = 0;

  async syncQueueToSupabase(positions: QueuePosition[]) {
    // Only sync every 30s to avoid hammering Supabase
    if (Date.now() - this.lastQueueSync < 30_000) return;
    this.lastQueueSync = Date.now();

    if (positions.length === 0) return;

    const totalEligible = positions.length;
    const rows = positions.map(q => {
      const agent = this.agents.find(a => a.id === q.agentId);
      const email = agent ? this.buildEmailFromAgent(agent) : '';
      return {
        agent_email: email,
        position: q.position,
        total_eligible: totalEligible,
      };
    }).filter(r => r.agent_email);

    try {
      // Upsert to agent_que_position (the table AOIrail reads from)
      const res = await fetch(`${SUPA_URL}/rest/v1/agent_que_position`, {
        method: 'POST',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Queue→Supabase] ${res.status}: ${text.slice(0, 100)}`);
      }
    } catch (err) {
      console.error('[Queue→Supabase]', err);
    }
  }

  /** Suspend online Taalk agents who have 0 credits OR are on a live outbound call */
  private suspendedForCredits = new Set<number>();
  private suspendedForLiveCall = new Set<number>();

  async suspendZeroCreditAgents() {
    for (const agent of this.agents) {
      if (!agent.online || agent.suspended) continue;
      // AO Recruit agents don't use credits — skip credit enforcement
      if (agent.normalizedMarket === 'AO Recruit') continue;
      const email = this.buildEmailFromAgent(agent);
      const credits = this.getAgentCredits(email, agent.id);

      // Rule: 0 credits = suspend
      if (credits !== null && credits <= 0 && !this.suspendedForCredits.has(agent.id)) {
        try {
          await taalk.suspendAgent(agent._id);
          this.suspendedForCredits.add(agent.id);
          console.log(`[Credits] Suspended ${agent.fullName} (${agent.id}) — 0 credits`);
        } catch { /* non-fatal */ }
      }
      // Unsuspend if they now have credits and we suspended them for credits
      if (credits !== null && credits >= 8 && this.suspendedForCredits.has(agent.id)) {
        try {
          await taalk.unsuspendAgent(agent._id);
          this.suspendedForCredits.delete(agent.id);
          console.log(`[Credits] Unsuspended ${agent.fullName} (${agent.id}) — now has ${credits} credits`);
        } catch { /* non-fatal */ }
      }

      // Rule: on a live outbound call = suspend on Taalk (can't take inbound while talking)
      const merged = this.mergedAgents.find(m => m.id === agent.id);
      const isOnLiveCall = merged && merged.webrtcStatus === 'on_call';

      if (isOnLiveCall && !this.suspendedForLiveCall.has(agent.id) && !this.suspendedForCredits.has(agent.id)) {
        try {
          await taalk.suspendAgent(agent._id);
          this.suspendedForLiveCall.add(agent.id);
          console.log(`[LiveCall] Suspended ${agent.fullName} (${agent.id}) — on outbound call`);
        } catch { /* non-fatal */ }
      }
      // Unsuspend when call ends
      if (!isOnLiveCall && this.suspendedForLiveCall.has(agent.id)) {
        try {
          await taalk.unsuspendAgent(agent._id);
          this.suspendedForLiveCall.delete(agent.id);
          console.log(`[LiveCall] Unsuspended ${agent.fullName} (${agent.id}) — call ended`);
        } catch { /* non-fatal */ }
      }
    }
  }

  /** Get credits for an agent — tries associate_id first, then direct email match */
  getAgentCredits(email: string, agentId?: number): number | null {
    // Best: look up by associate_id → customers.company_email → user_credits
    if (agentId && agentId > 0) {
      const byAssoc = this.agentCreditsByAssociateId.get(String(agentId));
      if (byAssoc !== undefined) return byAssoc;
    }
    // Fallback: direct email match
    const direct = this.agentCredits.get(email.toLowerCase());
    if (direct !== undefined) return direct;
    return null;
  }

  /** Missed-transfer demotion: reactor sets Taalk rank to 0 while this set contains the agent. */
  isMissDemoted(agentId: number): boolean {
    return this.demotedAgents.has(agentId);
  }
  // ── Booked Lead Watcher: poll agent_dial_metrics for new booked, fire Zapier webhook ──
  private lastBookedCheck = '';
  private sentBookedIds = new Set<string>();

  async pollBookedLeads() {
    if (String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || '').toLowerCase() !== 'true') {
      return;
    }
    try {
      const since = this.lastBookedCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const url = `${SUPA_URL}/rest/v1/agent_dial_metrics?select=id,agent_email,lead_id,lead_phone,lead_name,lead_state,disposition,event_timestamp,source&disposition=eq.booked&event_timestamp=gte.${encodeURIComponent(since)}&order=event_timestamp.desc&limit=20`;
      const res = await fetch(url, {
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
      });
      if (!res.ok) return;
      const rows: any[] = await res.json();

      for (const r of rows) {
        const rowId = String(r.id);
        if (this.sentBookedIds.has(rowId)) continue;

        // Resolve associate_id from agent email
        const email = (r.agent_email || '').toLowerCase();
        // Look up associate_id from customers
        let associateId: string | null = null;
        try {
          const custRes = await fetch(`${SUPA_URL}/rest/v1/customers?select=associate_id&company_email=eq.${encodeURIComponent(email)}&limit=1`, {
            headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
          });
          if (custRes.ok) {
            const custs: any[] = await custRes.json();
            if (custs[0]?.associate_id) associateId = String(custs[0].associate_id);
          }
        } catch {}

        if (!associateId) {
          console.log(`[Booked] Skipping ${r.lead_name} — no associate_id for ${email}`);
          continue;
        }

        // Fire Zapier webhook
        const payload = {
          lead_id: r.lead_id || r.lead_phone || '',
          associate_id: associateId,
          disposition: 'booked',
          agent_email: email,
          lead_name: r.lead_name || '',
          source: r.source || 'booked_watcher',
        };

        try {
          const zapRes = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (zapRes.ok) {
            this.sentBookedIds.add(rowId);
            console.log(`[Booked] ✅ Sent to Zapier: ${r.lead_name} → ${email} (associate=${associateId})`);
          }
        } catch {}
      }

      this.lastBookedCheck = new Date().toISOString();
      // Keep sent IDs manageable
      if (this.sentBookedIds.size > 1000) {
        const arr = [...this.sentBookedIds];
        this.sentBookedIds = new Set(arr.slice(-500));
      }
    } catch (err) {
      console.error('[Booked watcher]', err);
    }
  }
}

export const appState = new AppState();
