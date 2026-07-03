// ── Taalk API response types ──

export interface TaalkAgent {
  _id: string;           // MongoDB ObjectId - needed for suspend/unsuspend
  id: number;            // Numeric agent ID
  params: {
    first_name: string;
    last_name: string;
    states: string[];
    market: string;
    campaign: string;
  };
  online: boolean;
  busy: boolean;
  away: boolean;
  suspended?: boolean;
  recentStatus: string;
  recentStatusStartTime: string;
  hasTransferred: boolean;
  currentTask: string | null;
  taskAssignedTime: string | null;
  lastHangupTime: string | null;
  lastHeartbeat: string;
  taskSniff?: {
    serverNumber: string;
    params: {
      'First Name': string;
      'Last Name': string;
      Type: string;
      Market: string;
      Leadid: string;
      State: string;
      Phone: string;
      Taalk_Campaign: string;
      Taalk_Session: string;
    };
  };
  rank?: number;
  report?: { duration: number };
  prevReport?: { duration: number };
}

export interface TaalkCampaign {
  _id: string;
  name: string;
  limitPerHour: number;
  contactCount: number;
  currentTask?: {
    status: number;   // 0=stopped, 1=running, 3=completed
    callMade: number;
    callAnswered: number;
    callMadeWithinHour: number;
  };
  dailyStartTime: string;
  dailyEndTime: string;
  workingDays: number[];
  host: string;
  SMSHost: string;
  agent: string;
}

// ── Internal types ──

export type AgentStatus = 'idle' | 'busy' | 'away' | 'offline' | 'suspended';

export interface NormalizedAgent {
  _id: string;
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  market: string;
  normalizedMarket: string;  // veteran, globe, recruit, etc.
  states: string[];
  ccPro: boolean;       // from customers.CCPRO
  campaign: string;
  status: AgentStatus;
  online: boolean;
  busy: boolean;
  away: boolean;
  suspended: boolean;
  statusSince: string;
  currentTask: string | null;
  taskAssignedTime: string | null;
  lastHangupTime: string | null;
  lastHeartbeat: string;
  rank: number | null;  // Taalk priority rank: 99=top, 75-80=mid, 0=low, null=unset
  callInfo?: {
    leadName: string;
    leadPhone: string;
    leadState: string;
    leadMarket: string;
    leadId: string;
    leadType: string;
    campaignName: string;
    sessionId: string;
    serverNumber: string;
  };
}

export interface NormalizedCampaign {
  _id: string;
  name: string;
  market: string;
  normalizedMarket: string;
  taalkMarket?: string;  // raw market value from Taalk API (params.market or market field)
  state: string;
  limitPerHour: number;
  contactCount: number;
  status: 'running' | 'stopped' | 'completed' | 'unknown';
  callsMade: number;
  callsAnswered: number;
  callsThisHour: number;
  isPerAgent: boolean;
  agentName?: string;
  answerRate: number;
  rateReason?: string;  // e.g. "2 agents in FL", "0 agents → paused", "manual override"
}

export interface AutoAction {
  id: string;
  timestamp: string;
  agentId: number;
  agentName: string;
  action: string;
  detail: string;
  previousState: AgentStatus;
  newState: AgentStatus;
  campaignId?: string;
  campaignName?: string;
  success: boolean;
}

export interface AgentStateMemory {
  agentId: number;
  agentMongoId: string;
  status: AgentStatus;
  campaignId?: string;
  campaignName?: string;
  previousLimitPerHour: number;
  manualOverride: boolean;
  lastUpdated: string;
}

export interface DashboardStats {
  totalOnline: number;
  totalBusy: number;
  totalIdle: number;
  totalAway: number;
  totalSuspended: number;
  totalOffline: number;
  campaignsRunning: number;
  campaignsStopped: number;
  totalDialsThisHour: number;
  totalLeads: number;
  autoManagementEnabled: boolean;
  // New accountability stats
  configuredRate: number;      // sum of limitPerHour across all running campaigns
  avgAnswerRate: number;
  avgIdleTime: number;         // ms
  campaignsThrottled: number;  // campaigns at rate 0 because no agents available
  statesCovered: string[];     // US states with at least one idle agent available
  transferStats: TransferStats;
}

// ── Activity tracking types ──

export interface AgentActivitySummary {
  agentId: number;
  agentName: string;
  callsToday: number;
  lastCallTime: string | null;
  timeSinceLastCall: string | null;
  idleTimeToday: number;  // ms
  currentCallDuration: number | null;  // seconds, null if not on call
}

export interface ActiveCall {
  agentName: string;
  agentId: number;
  market: string;
  leadName: string;
  leadPhone: string;
  leadState: string;
  leadType: string;
  serverNumber: string;
  duration: number;  // seconds
  startedAt: string;
  status: 'active' | 'pending';  // active = busy+currentTask, pending = has taskSniff but not busy
}

export interface TransferStats {
  avgWaitTime: number;    // ms — rolling average of last 50 transfer wait times
  avgCallDuration: number; // ms — rolling average of last 50 call durations
  totalTransfersToday: number;
}

export interface DialingCampaign {
  name: string;
  market: string;
  state: string;
  dialsPerHour: number;
  callsMade: number;
  callsAnswered: number;
  answerRate: number;
  leads: number;
}

// ── Priority Queue types ──

export interface QueuePosition {
  agentId: number;
  agentMongoId: string;
  agentName: string;
  market: string;
  position: number;
  score: number;
  callsToday: number;
  minutesIdle: number;
  taalkRank: number | null;
  suggestedRank: number;
}

// ── Missed transfer (nobody answered, kept visible ~5 min) ──

export interface MissedTransfer {
  leadName: string;
  leadState: string;
  leadType: string;
  market: string;
  phone: string;
  missedBy: string[];   // agent names who saw it ring and didn't answer
  missedAt: string;     // ISO timestamp
  ringCycles?: number;  // how many times the wave blaster fired
}

// ── Completed transfer (recently finished, kept visible ~60s) ──

export interface CompletedTransfer {
  agentName: string;
  agentId: number;
  leadName: string;
  leadState: string;
  leadType: string;
  market: string;
  callDuration: number;   // seconds
  completedAt: string;    // ISO timestamp
  billable: boolean;      // duration > 15s
  revenueEarned: number;  // $8 or $5 depending on market
}

// ── Twilio / WebRTC types ──

export type WebRTCStatus = 'dialing' | 'ringing' | 'on_call' | 'wrap' | 'idle' | 'offline';

export interface MergedAgent extends NormalizedAgent {
  /** Email key used to merge Taalk + Twilio records */
  email: string;
  /** Taalk inbound status (mirrors .status but explicit) */
  taalkStatus: AgentStatus;
  /** Twilio WebRTC outbound status */
  webrtcStatus: WebRTCStatus;
  /** Is this agent on the Taalk RTS (inbound enabled)? */
  inboundEnabled: boolean;
  /** Is this agent non-Offline on Twilio (outbound enabled)? */
  outboundEnabled: boolean;
  /** Twilio activity name (raw) */
  twilioActivity?: string;
  /** When Twilio status last changed */
  twilioStatusSince?: string;
  /** Missed inbound transfers today while inbound was off */
  missedTransfers: number;
  /** Was this agent auto-suspended due to WebRTC call? */
  webrtcSuspended?: boolean;
  /** Hierarchy: MGA name and associate_id */
  mgaName?: string | null;
  mgaId?: number | null;
  /** Hierarchy: RGA name and associate_id */
  rgaName?: string | null;
  rgaId?: number | null;
}

// ── Revenue tracking types ──

export interface RevenueStats {
  revenueToday: number;       // total $ generated today
  connectsToday: number;      // total billable connects today (>15s)
  connectsByMarket: Record<string, { count: number; revenue: number }>;
  revenuePerAgent: Record<string, { connects: number; revenue: number; agentName: string }>;
  avgConnectDuration: number; // seconds, rolling average of billable call durations
  revenuePerHour: number;     // $/hr rate since business hours start (7am PST)
}

export interface SupabaseConnects {
  connects: number;         // billable connects from Supabase (event=END, duration>15s)
  revenue: number;          // estimated revenue ($8 standard, $5 recruit)
  lastPolled: string;       // ISO timestamp of last Supabase poll
}

export interface MarketCapacity {
  market: string;
  idleAgents: number;
  capacity: number;  // idle × 150
}

export interface MergedStats extends DashboardStats {
  outboundActive: number;   // agents on WebRTC (non-offline)
  inboundEnabled: number;   // agents on Taalk RTS
  bothActive: number;       // agents doing both (the goal)
  outboundOnly: number;     // THE SHAME NUMBER
  outboundIdle: number;      // Active heartbeat but not dialing — only outbound, no inbound
  revenue: RevenueStats;    // 💰 THE MONEY
  supabase?: SupabaseConnects; // accurate connects from Supabase vdp_calls
  perMarketCapacity?: MarketCapacity[]; // per-market dial capacity breakdown
}

// ── Leaderboard types ──

export interface LeaderboardEntry {
  agentId: number;
  agentName: string;
  email: string;
  market: string;
  totalCalls: number;
  billableCalls: number;
  revenue: number;
  avgDuration: number;
  lastCallTime: string;
}

// ── Agent Health Check types ──

export interface AgentHealthReport {
  email: string;
  mic: 'ok' | 'blocked' | 'none';
  network: { latency: number; quality: 'good' | 'degraded' | 'bad' };
  browser: { name: string; version: string };
  audio: { input: string; output: string };
  webrtc: 'registered' | 'failed' | 'disconnected';
  credits: number;
  errors: string[];
  uptime: number;
  statesCount: number;
  market: string;
  timestamp: string;
}

export type AgentCommandType = 'force_refresh' | 're_register' | 'test_audio' | 'clear_state' | 'screen_share';

export interface AgentCommand {
  email: string;
  command: AgentCommandType;
  issuedAt: string;
}

export type HealthStatus = 'healthy' | 'warning' | 'error';

export function getHealthStatus(report: AgentHealthReport): HealthStatus {
  // Error conditions
  if (report.mic === 'blocked' || report.mic === 'none') return 'error';
  if (report.webrtc === 'failed') return 'error';
  if (report.credits === 0) return 'error';
  // Warning conditions
  if (report.network?.quality === 'degraded') return 'warning';
  if (report.network?.quality === 'bad') return 'error';
  if (report.credits < 10) return 'warning';
  if (report.webrtc === 'disconnected') return 'warning';
  if (report.errors?.length > 0) return 'warning';
  return 'healthy';
}

// WebSocket message types
export type WSMessageType =
  | 'agents_update'
  | 'campaigns_update'
  | 'stats_update'
  | 'auto_action'
  | 'full_sync'
  | 'activity_summary'
  | 'active_calls'
  | 'dialing_now'
  | 'queue_positions'
  | 'leaderboard_update'
  | 'agent_health_update';

export interface WSMessage {
  type: WSMessageType;
  data: any;
  timestamp: string;
}
