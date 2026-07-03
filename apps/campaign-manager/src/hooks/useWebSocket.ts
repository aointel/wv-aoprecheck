import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  WSMessage, NormalizedAgent, NormalizedCampaign, DashboardStats, AutoAction,
  AgentActivitySummary, ActiveCall, DialingCampaign, CompletedTransfer, MissedTransfer, QueuePosition,
  TransferStats, MergedAgent, MergedStats, RevenueStats, AgentHealthReport,
} from '../../shared/types';

export interface AppData {
  agents: NormalizedAgent[];
  mergedAgents: MergedAgent[];
  campaigns: NormalizedCampaign[];
  stats: MergedStats;
  actionLog: AutoAction[];
  activitySummary: AgentActivitySummary[];
  activeCalls: ActiveCall[];
  completedTransfers: CompletedTransfer[];
  missedTransfers: MissedTransfer[];
  dialingCampaigns: DialingCampaign[];
  queuePositions: QueuePosition[];
  agentHealth: AgentHealthReport[];
  connected: boolean;
}

const EMPTY_TRANSFER_STATS: TransferStats = { avgWaitTime: 0, avgCallDuration: 0, totalTransfersToday: 0 };

const EMPTY_REVENUE_STATS: RevenueStats = {
  revenueToday: 0, connectsToday: 0, connectsByMarket: {},
  revenuePerAgent: {}, avgConnectDuration: 0, revenuePerHour: 0,
};

const DEFAULT_STATS: MergedStats = {
  totalOnline: 0, totalBusy: 0, totalIdle: 0, totalAway: 0,
  totalSuspended: 0, totalOffline: 0,
  campaignsRunning: 0, campaignsStopped: 0,
  totalDialsThisHour: 0, totalLeads: 0,
  autoManagementEnabled: true,
  configuredRate: 0, avgAnswerRate: 0, avgIdleTime: 0,
  campaignsThrottled: 0, statesCovered: [],
  transferStats: EMPTY_TRANSFER_STATS,
  outboundActive: 0, inboundEnabled: 0, bothActive: 0, outboundOnly: 0, outboundIdle: 0,
  revenue: EMPTY_REVENUE_STATS,
};

export function useWebSocket(): AppData {
  const [agents, setAgents] = useState<NormalizedAgent[]>([]);
  const [mergedAgents, setMergedAgents] = useState<MergedAgent[]>([]);
  const [campaigns, setCampaigns] = useState<NormalizedCampaign[]>([]);
  const [stats, setStats] = useState<MergedStats>(DEFAULT_STATS);
  const [actionLog, setActionLog] = useState<AutoAction[]>([]);
  const [activitySummary, setActivitySummary] = useState<AgentActivitySummary[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [completedTransfers, setCompletedTransfers] = useState<CompletedTransfer[]>([]);
  const [missedTransfers, setMissedTransfers] = useState<MissedTransfer[]>([]);
  const [dialingCampaigns, setDialingCampaigns] = useState<DialingCampaign[]>([]);
  const [queuePositions, setQueuePositions] = useState<QueuePosition[]>([]);
  const [agentHealth, setAgentHealth] = useState<AgentHealthReport[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onopen = () => { setConnected(true); };
    ws.onclose = () => { setConnected(false); reconnectTimer.current = setTimeout(connect, 3000); };
    ws.onerror = () => { ws.close(); };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'full_sync':
            setAgents(msg.data.agents ?? []);
            setMergedAgents(msg.data.mergedAgents ?? []);
            setCampaigns(msg.data.campaigns ?? []);
            setStats(msg.data.stats ?? DEFAULT_STATS);
            setActionLog(msg.data.actionLog ?? []);
            setActivitySummary(msg.data.activitySummary ?? []);
            setActiveCalls(msg.data.activeCalls ?? []);
            setCompletedTransfers(msg.data.completedTransfers ?? []);
            setMissedTransfers(msg.data.missedTransfers ?? []);
            setDialingCampaigns(msg.data.dialingCampaigns ?? []);
            setQueuePositions(msg.data.queuePositions ?? []);
            setAgentHealth(msg.data.agentHealth ?? []);
            break;
          case 'agents_update':
            setAgents(msg.data.agents ?? []);
            if (msg.data.mergedAgents) setMergedAgents(msg.data.mergedAgents);
            if (msg.data.stats) setStats(msg.data.stats);
            break;
          case 'campaigns_update':
            setCampaigns(msg.data.campaigns ?? []);
            if (msg.data.stats) setStats(msg.data.stats);
            break;
          case 'stats_update': setStats(msg.data); break;
          case 'auto_action':
            setActionLog(prev => [...(msg.data as AutoAction[]), ...prev].slice(0, 200));
            break;
          case 'activity_summary': setActivitySummary(msg.data as AgentActivitySummary[]); break;
          case 'active_calls':
            setActiveCalls(msg.data.activeCalls ?? msg.data ?? []);
            if (msg.data.completedTransfers) setCompletedTransfers(msg.data.completedTransfers);
            if (msg.data.missedTransfers) setMissedTransfers(msg.data.missedTransfers);
            break;
          case 'dialing_now': setDialingCampaigns(msg.data as DialingCampaign[]); break;
          case 'queue_positions': setQueuePositions(msg.data as QueuePosition[]); break;
          case 'agent_health_update': setAgentHealth(msg.data as AgentHealthReport[]); break;
        }
      } catch (err) { console.error('[WS] Parse error:', err); }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
  }, [connect]);

  return { agents, mergedAgents, campaigns, stats, actionLog, activitySummary, activeCalls, completedTransfers, missedTransfers, dialingCampaigns, queuePositions, agentHealth, connected };
}
