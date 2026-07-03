import React from "react";
import { useState, useMemo, useEffect, useRef } from 'react';
import type { NormalizedAgent, AgentStatus, AgentActivitySummary, QueuePosition, MergedAgent, MergedStats, AgentHealthReport, HealthStatus } from '../../shared/types';
import { getHealthStatus } from '../../shared/types';
import { durationSince, formatPhone, groupBy } from '../utils';
import { api, authFetch } from '../hooks/useApi';
import { AgentDetailPanel } from './AgentDetailPanel';

// ── CCPro roster entry (from /api/ccpro-roster) ───────────────────────────────
interface CcProRosterEntry {
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  market: string;
  mgaName: string | null;
  rgaName: string | null;
  ccPro: boolean;
}

function useCcProRoster() {
  const [roster, setRoster] = useState<CcProRosterEntry[]>([]);
  useEffect(() => {
    const load = () =>
      fetch('/api/ccpro-roster')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.roster) setRoster(d.roster); })
        .catch(() => {});
    load();
    const iv = setInterval(load, 5 * 60 * 1000); // refresh every 5 minutes
    return () => clearInterval(iv);
  }, []);
  return roster;
}

// ── Real-time D/R/B/I per agent from agent_daily_stats ────────────────────────
interface AgentDailyStat { agent_email: string; dials: number; reached: number; booked: number; instants: number; }

function useTeamDailyStats() {
  const [stats, setStats] = useState<Record<string, AgentDailyStat>>({});
  useEffect(() => {
    const load = () =>
      authFetch(`/api/agent-daily-stats/team?_ts=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.agents) return;
          const map: Record<string, AgentDailyStat> = {};
          for (const a of d.agents) {
            const key = String(a.agent_email || '').toLowerCase();
            if (!key) continue;
            map[key] = {
              ...a,
              dials: Number(a.dials || 0),
            };
          }
          setStats(map);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);
  return stats;
}

export type AgentTier = 'elite' | 'active' | 'low' | 'ghost';
export interface AgentScore { tier: AgentTier; score: number; pickRate: number; blasts: number; suggestedRank: number; }

const TIER_CFG: Record<AgentTier, { icon: string; label: string; fg: string; bg: string }> = {
  elite:  { icon: '⭐', label: 'Elite',  fg: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  active: { icon: '✅', label: 'Active', fg: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  low:    { icon: '⬇️', label: 'Low',   fg: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  ghost:  { icon: '👻', label: 'Ghost', fg: '#a78bfa', bg: 'rgba(139,92,246,0.15)' },
};

interface Props {
  agents: NormalizedAgent[];
  mergedAgents: MergedAgent[];
  activitySummary: AgentActivitySummary[];
  queuePositions: QueuePosition[];
  stats: MergedStats;
  agentHealth: AgentHealthReport[];
  credits: Record<string, number>;
  creditsByAssociateId: Record<string, number>;
  agentScores?: Record<string, AgentScore>;
  readOnly?: boolean;
}

type SortKey = 'status' | 'name' | 'market' | 'mga' | 'timeInStatus' | 'activity' | 'lastCall' | 'callsToday' | 'reached' | 'booked' | 'instants' | 'idleTime' | 'rank' | 'queue' | 'inbound' | 'pendingLeads' | 'outbound' | 'missed' | 'credits';
type SortDir = 'asc' | 'desc';
type DrbStats = { d: number; r: number; b: number; i: number };

const STATUS_ORDER: Record<AgentStatus, number> = { busy: 0, idle: 1, away: 2, suspended: 3, offline: 4 };
const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string; dot: string; rowTint: string }> = {
  busy:      { label: 'Online',    color: 'var(--red)',   bg: 'var(--red-soft)',   dot: 'var(--red)',   rowTint: 'var(--row-busy)' },
  idle:      { label: 'Available',  color: 'var(--green)', bg: 'var(--green-soft)', dot: 'var(--green)', rowTint: 'var(--row-idle)' },
  away:      { label: 'Away',       color: 'var(--amber)', bg: 'var(--amber-soft)', dot: 'var(--amber)', rowTint: 'var(--row-away)' },
  suspended: { label: 'Suspended',  color: 'var(--gray)',  bg: 'var(--gray-soft)',  dot: 'var(--gray)',  rowTint: 'var(--row-suspended)' },
  offline:   { label: 'Offline',    color: 'var(--fg-dim)',bg: 'var(--gray-soft)',  dot: 'var(--fg-dim)',rowTint: 'var(--row-offline)' },
};

const MARKET_COLORS: Record<string, string> = {
  'Veteran': '#10b981', 'Globe': '#3b82f6', 'AO Recruit': '#8b5cf6',
  'Will Kit': '#f59e0b', 'Womens Benefit': '#ec4899', 'Plus': '#06b6d4', 'Union': '#f97316',
};
const MARKET_ORDER = ['AO Recruit', 'Globe', 'Veteran', 'Will Kit', 'Womens Benefit', 'Plus', 'Union'];

function parseEmailName(email: string): string {
  if (!email) return 'Unknown';
  const prefix = email.split('@')[0];
  const dotSplit = prefix.split(/[._]/);
  if (dotSplit.length >= 2) {
    return dotSplit.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }
  const clean = prefix.toLowerCase();
  for (let i = 3; i <= Math.min(8, clean.length - 2); i++) {
    const first = clean.slice(0, i);
    const last = clean.slice(i);
    if (first.length >= 2 && last.length >= 2 && /^[a-z]+$/.test(first) && /^[a-z]+$/.test(last)) {
      return (first.charAt(0).toUpperCase() + first.slice(1)) + ' ' + (last.charAt(0).toUpperCase() + last.slice(1));
    }
  }
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function getDisplayName(agent: MergedAgent): string {
  if (agent.fullName && agent.fullName !== '?' && agent.fullName.trim() !== '') {
    return agent.fullName;
  }
  return parseEmailName(agent.email);
}

function isWebRTCOnly(agent: MergedAgent): boolean {
  return !agent.inboundEnabled;
}

function getEffectiveStatus(agent: MergedAgent): AgentStatus {
  if (agent.inboundEnabled) return agent.status;
  if (agent.webrtcStatus === 'on_call') return 'busy';
  if (agent.webrtcStatus === 'wrap') return 'busy';
  if (agent.webrtcStatus === 'idle') return 'idle';
  if (agent.webrtcStatus === 'dialing' || agent.webrtcStatus === 'ringing') return 'busy';
  return 'offline';
}

function timeInStatusMs(agent: MergedAgent): number {
  if (agent.inboundEnabled) {
    if (agent.status === 'busy' && agent.taskAssignedTime) {
      return Date.now() - new Date(agent.taskAssignedTime).getTime();
    }
    const ref = agent.lastHangupTime || agent.statusSince;
    const ms = ref ? Date.now() - new Date(ref).getTime() : 0;
    return Math.min(ms, 4 * 60 * 60 * 1000);
  }
  const ref = agent.twilioStatusSince || agent.statusSince;
  const ms = ref ? Date.now() - new Date(ref).getTime() : 0;
  return Math.min(ms, 10 * 60 * 1000);
}

function activityText(agent: MergedAgent): { text: string; color: string } {
  const statusAge = agent.twilioStatusSince ? Date.now() - new Date(agent.twilioStatusSince).getTime() : Infinity;
  const freshOnCall = agent.webrtcStatus === 'on_call' && statusAge < 10 * 60 * 1000;

  if (agent.inboundEnabled) {
    if (freshOnCall) return { text: 'Live Call', color: 'var(--green)' };
    if (agent.webrtcStatus === 'dialing') return { text: 'Dialing', color: 'var(--cyan, #06b6d4)' };
    if (agent.webrtcStatus === 'ringing') return { text: 'Ringing', color: 'var(--cyan, #06b6d4)' };
    if (agent.status === 'busy' && agent.callInfo) {
      const ci = agent.callInfo;
      return { text: `TAALK: ${ci.leadName || 'Unknown'}${ci.leadState ? `, ${ci.leadState}` : ''}${ci.leadType ? ` (${ci.leadType})` : ''}`, color: 'var(--red)' };
    }
    if (agent.status === 'busy') return { text: 'On Taalk transfer', color: 'var(--red)' };
    if (agent.status === 'idle') return { text: 'Waiting for transfers', color: 'var(--fg-dim)' };
    if (agent.status === 'away') return { text: 'Away', color: 'var(--amber)' };
    if (agent.status === 'suspended') return { text: 'Suspended', color: 'var(--gray)' };
    return { text: 'Offline', color: 'var(--fg-dim)' };
  }
  if (freshOnCall) return { text: 'Live Call', color: 'var(--green)' };
  if (agent.webrtcStatus === 'dialing') return { text: 'Dialing', color: 'var(--cyan, #06b6d4)' };
  if (agent.webrtcStatus === 'ringing') return { text: 'Ringing', color: 'var(--cyan, #06b6d4)' };
  if (agent.webrtcStatus === 'wrap') return { text: 'Wrapping up...', color: 'var(--orange, #f97316)' };
  if (agent.webrtcStatus === 'idle') return { text: 'Idle (outbound only)', color: 'var(--fg-dim)' };
  return { text: 'Offline', color: 'var(--fg-dim)' };
}

function timeFlag(agent: MergedAgent): 'warning' | 'danger' | null {
  const mins = timeInStatusMs(agent) / 60000;
  const effectiveStatus = getEffectiveStatus(agent);
  if (effectiveStatus === 'away' && mins > 30) return 'danger';
  if (effectiveStatus === 'away' && mins > 15) return 'warning';
  if (effectiveStatus === 'idle' && mins > 60) return 'warning';
  return null;
}

function fmtIdleTime(ms: number): string {
  if (ms <= 0) return '0m';
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function aoiCommandRank(
  agent: MergedAgent,
  queue: QueuePosition | undefined,
  agentScore: AgentScore | undefined,
  isStarred: boolean,
): number | null {
  if (isStarred) return 99;
  if (queue != null && typeof queue.suggestedRank === 'number') return queue.suggestedRank;
  if (agentScore != null && typeof agentScore.suggestedRank === 'number') return agentScore.suggestedRank;
  if (agent.rank != null && typeof agent.rank === 'number') return agent.rank;
  return null;
}

function reactorScoreForAgent(a: MergedAgent, agentScores: Record<string, AgentScore> | undefined): AgentScore | undefined {
  if (!agentScores) return undefined;
  if (a.email) {
    const byEmail = agentScores[a.email.toLowerCase()];
    if (byEmail) return byEmail;
  }
  return agentScores[String(a.id)];
}

function webrtcLabel(status: string | undefined, outboundEnabled: boolean | undefined): { text: string; color: string; pulse: boolean } {
  if (status === 'on_call') return { text: 'Live Call', color: 'var(--green)', pulse: false };
  if (status === 'dialing' || status === 'ringing') return { text: 'Dialing', color: 'var(--cyan, #06b6d4)', pulse: false };
  return { text: 'OFF', color: 'var(--fg-dim)', pulse: false };
}

const ACTIVE_WINDOW_MS = 20 * 60 * 1000;
/** Is this agent active? Online on Taalk, on a CCPro call, or had activity in last 20 min */
const isAgentActive = (
  a: MergedAgent,
  now: number = Date.now(),
  drbByEmail?: Record<string, { d: number; r: number; b: number; i: number }>,
): boolean => {
  const isRecruit = (a.normalizedMarket || a.market || '').toLowerCase().includes('recruit');
  const hasDials = !!drbByEmail && (drbByEmail[String(a.email || '').toLowerCase().trim()]?.d ?? 0) > 0;
  // AO Recruit agents use a different system — show them if they have any dials today
  if (isRecruit && hasDials) return true;
  return (
    a.online ||
    a.inboundEnabled ||
    a.busy ||
    a.outboundEnabled ||
    (!!a.webrtcStatus && a.webrtcStatus !== 'offline' && a.webrtcStatus !== 'idle') ||
    (!!a.lastHangupTime && now - new Date(a.lastHangupTime).getTime() < ACTIVE_WINDOW_MS) ||
    (!!a.lastHeartbeat && now - new Date(a.lastHeartbeat).getTime() < ACTIVE_WINDOW_MS) ||
    (!!a.twilioStatusSince && now - new Date(a.twilioStatusSince).getTime() < ACTIVE_WINDOW_MS) ||
    hasDials
  );
};

/** Normalize name to Title Case; treat "0", "null", empty as empty string */
const normalizeName = (name: string | null | undefined): string => {
  if (!name) return '';
  const t = name.trim();
  if (!t || t === '0' || t.toLowerCase() === 'null') return '';
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};

/** Determine the RGA key for an agent */
const getRgaKey = (a: MergedAgent): string => {
  const rga = normalizeName(a.rgaName);
  const mga = normalizeName(a.mgaName);
  return rga || mga || normalizeName(a.fullName) || 'Unassigned';
};

/** Determine the MGA key for an agent */
const getMgaKey = (a: MergedAgent): string => {
  const mga = normalizeName(a.mgaName);
  return mga || normalizeName(a.fullName) || 'Unassigned';
};

export function AgentTable({ agents, mergedAgents, activitySummary, queuePositions, stats, agentHealth, credits, creditsByAssociateId, agentScores = {}, readOnly = false }: Props) {
  const ccProRoster = useCcProRoster();
  const [offlineAgents, setOfflineAgents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [mgaFilter, setMgaFilter] = useState<string>('all');
  const [starred, setStarred] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('aoi_starred_agents') || '[]')); } catch { return new Set(); }
  });

  const toggleStar = (agentId: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
      localStorage.setItem('aoi_starred_agents', JSON.stringify([...next]));
      fetch('/api/agents/star', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, starred: next.has(agentId) }) }).catch(() => {});
      return next;
    });
  };

  // Two-level expand state: RGA rows and MGA rows (keyed as `${rgaKey}::${mgaKey}`)
  const [expandedRga, setExpandedRga] = useState<Set<string>>(new Set());
  const rgaInitialized = useRef(false);
  // MGA rows are static (no collapse) — expandedMga no longer used

  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [, setTick] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<MergedAgent | null>(null);
  const [drbByEmail, setDrbByEmail] = useState<Record<string, DrbStats>>({});
  const [drbLoaded, setDrbLoaded] = useState(false);
  const [pendingByEmail, setPendingByEmail] = useState<Record<string, number>>({});
  const [callablePlusByEmail, setCallablePlusByEmail] = useState<Record<string, number>>({});
  const pendingZeroStreakRef = useRef<Record<string, number>>({});

  const taalkIds = useMemo(() => new Set(agents.map(a => a.id)), [agents]);

  const healthMap = useMemo(() => {
    const m = new Map<string, AgentHealthReport>();
    for (const r of agentHealth) m.set(r.email.toLowerCase(), r);
    return m;
  }, [agentHealth]);

  const activityMap = useMemo(() => {
    const m = new Map<number, AgentActivitySummary>();
    for (const a of activitySummary) m.set(a.agentId, a);
    return m;
  }, [activitySummary]);

  const queueMap = useMemo(() => {
    const m = new Map<number, QueuePosition>();
    for (const q of queuePositions) m.set(q.agentId, q);
    return m;
  }, [queuePositions]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  React.useEffect(() => {
    fetch('/api/agents/offline').then(r => r.json()).then(d => setOfflineAgents(d.offline || [])).catch(() => {});
  }, []);

  const marketOptions = useMemo(() =>
    [...new Set(mergedAgents.map(a => a.normalizedMarket))].filter(Boolean).sort(),
    [mergedAgents]
  );

  const mgaOptions = useMemo(() => {
    return [...new Set(mergedAgents.map(a => getMgaKey(a)).filter(Boolean))].sort();
  }, [mergedAgents]);

  // Filters applied to determine WHICH agents are "visible" in current filter context
  const filtered = useMemo(() => {
    let result: any[];
    if (search && search.length >= 2) {
      const q = search.toLowerCase();
      const allFromMerged = mergedAgents.filter(a =>
        a.fullName?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) ||
        String(a.id).includes(q) || a.normalizedMarket?.toLowerCase().includes(q)
      );
      const offlineMatches = offlineAgents.filter((a: any) =>
        a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) ||
        String(a.id).includes(q) || a.market?.toLowerCase().includes(q)
      ).map((a: any) => ({
        ...a, _id: a.id || a.email, id: a.id || 0, firstName: a.name?.split(' ')[0] || '',
        lastName: a.name?.split(' ').slice(1).join(' ') || '', fullName: a.name || a.email,
        normalizedMarket: a.market || 'Unknown', status: 'offline' as const,
        online: false, busy: false, away: false, suspended: false,
        statusSince: '', currentTask: null, taskAssignedTime: null,
        lastHangupTime: a.lastHeartbeat || null, lastHeartbeat: a.lastHeartbeat || '',
        rank: null, campaign: '', states: a.states || [],
        email: a.email, taalkStatus: 'offline' as const,
        webrtcStatus: 'offline' as any, inboundEnabled: false, outboundEnabled: false,
        twilioActivity: undefined, twilioStatusSince: undefined,
        missedTransfers: 0, webrtcSuspended: false, callInfo: undefined,
      }));
      result = [...allFromMerged, ...offlineMatches];
    } else {
      result = mergedAgents;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'offline') {
        result = offlineAgents.map((a: any) => ({
          ...a, _id: a.id || a.email, id: a.id || 0, firstName: a.name?.split(' ')[0] || '',
          lastName: a.name?.split(' ').slice(1).join(' ') || '', fullName: a.name || a.email,
          normalizedMarket: a.market || 'Unknown', status: 'offline' as const,
          online: false, busy: false, away: false, suspended: false,
          statusSince: '', currentTask: null, taskAssignedTime: null,
          lastHangupTime: a.lastHeartbeat || null, lastHeartbeat: a.lastHeartbeat || '',
          rank: null, campaign: '', states: a.states || [],
          email: a.email, taalkStatus: 'offline' as const,
          webrtcStatus: 'offline' as any, inboundEnabled: false, outboundEnabled: false,
          twilioActivity: undefined, twilioStatusSince: undefined,
          missedTransfers: 0, webrtcSuspended: false, callInfo: undefined,
        })) as any;
      } else {
        result = result.filter(a => {
          if (statusFilter === 'ob_idle') return !a.inboundEnabled && getEffectiveStatus(a) === 'idle';
          if (statusFilter === 'idle') return a.inboundEnabled && getEffectiveStatus(a) === 'idle';
          if (statusFilter === 'busy') return true;
          return getEffectiveStatus(a) === statusFilter;
        });
      }
    }
    if (marketFilter !== 'all') result = result.filter(a => a.normalizedMarket === marketFilter);
    if (mgaFilter !== 'all') result = result.filter(a => getMgaKey(a) === mgaFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => {
        const displayName = getDisplayName(a);
        return displayName.toLowerCase().includes(q) ||
          a.normalizedMarket.toLowerCase().includes(q) ||
          a.states?.some(s => s.toLowerCase().includes(q)) ||
          String(a.id).includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.callInfo?.leadName?.toLowerCase().includes(q);
      });
    }
    return result;
  }, [mergedAgents, offlineAgents, statusFilter, marketFilter, mgaFilter, search]);

  const filteredEmails = useMemo(
    () => [...new Set(filtered.map((a) => String(a.email || '').toLowerCase().trim()).filter((e) => e.includes('@')))].sort(),
    [filtered],
  );

  // Fetch DRB for ALL merged agents — not just filtered ones (avoids chicken-and-egg deadlock)
  useEffect(() => {
    const poll = () => {
      fetch(`/api/agents/drb?_ts=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.drb && typeof d.drb === 'object') {
            setDrbByEmail(d.drb as Record<string, DrbStats>);
            setDrbLoaded(true);
          }
        })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (filteredEmails.length === 0) return;
    const EMAIL_BATCH_SIZE = 75;
    const emailBatches: string[][] = [];
    for (let i = 0; i < filteredEmails.length; i += EMAIL_BATCH_SIZE) {
      emailBatches.push(filteredEmails.slice(i, i + EMAIL_BATCH_SIZE));
    }
    const poll = () => {
      Promise.all(
        emailBatches.map((batch) => {
          const emailsParam = encodeURIComponent(batch.join(','));
          return fetch(`/api/agents/pending-leads?emails=${emailsParam}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
        }),
      )
        .then((responses) => {
          const incoming: Record<string, number> = {};
          const incomingPlus: Record<string, number> = {};
          for (const d of responses) {
            if (!d?.pending || typeof d.pending !== 'object') continue;
            Object.assign(incoming, d.pending as Record<string, number>);
            if (d?.callablePlus && typeof d.callablePlus === 'object') {
              Object.assign(incomingPlus, d.callablePlus as Record<string, number>);
            }
          }
          if (Object.keys(incoming).length === 0) return;
          setCallablePlusByEmail((prev) => ({ ...prev, ...incomingPlus }));
          setPendingByEmail((prev) => {
            const next: Record<string, number> = { ...prev };
            const streaks = pendingZeroStreakRef.current;
            for (const [emailRaw, valueRaw] of Object.entries(incoming)) {
              const email = String(emailRaw || '').toLowerCase().trim();
              if (!email) continue;
              const nextCount = Number(valueRaw ?? 0) || 0;
              const prevCount = Number(prev[email] ?? 0) || 0;
              if (nextCount === 0 && prevCount > 0) {
                const streak = (streaks[email] || 0) + 1;
                streaks[email] = streak;
                if (streak < 3) continue;
              } else {
                streaks[email] = 0;
              }
              next[email] = nextCount;
            }
            return next;
          });
        })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 10_000);
    return () => clearInterval(iv);
  }, [filteredEmails]);

  const sortFn = (a: MergedAgent, b: MergedAgent): number => {
    let cmp = 0;
    const aAct = activityMap.get(a.id), bAct = activityMap.get(b.id);
    const aQ = queueMap.get(a.id), bQ = queueMap.get(b.id);
    switch (sortKey) {
      case 'status': {
        const aEff = getEffectiveStatus(a), bEff = getEffectiveStatus(b);
        cmp = (STATUS_ORDER[aEff] ?? 5) - (STATUS_ORDER[bEff] ?? 5);
        if (cmp === 0) cmp = timeInStatusMs(b) - timeInStatusMs(a);
        break;
      }
      case 'name': cmp = getDisplayName(a).localeCompare(getDisplayName(b)); break;
      case 'market': cmp = a.normalizedMarket.localeCompare(b.normalizedMarket); break;
      case 'mga': cmp = (a.mgaName ?? '').localeCompare(b.mgaName ?? ''); break;
      case 'timeInStatus': cmp = timeInStatusMs(b) - timeInStatusMs(a); break;
      case 'activity': cmp = activityText(a).text.localeCompare(activityText(b).text); break;
      case 'lastCall': cmp = (bAct?.lastCallTime ? new Date(bAct.lastCallTime).getTime() : 0) - (aAct?.lastCallTime ? new Date(aAct.lastCallTime).getTime() : 0); break;
      case 'callsToday': cmp = (bAct?.callsToday ?? 0) - (aAct?.callsToday ?? 0); break;
      case 'reached': {
        const aR = drbByEmail[String(a.email || '').toLowerCase().trim()]?.r ?? 0;
        const bR = drbByEmail[String(b.email || '').toLowerCase().trim()]?.r ?? 0;
        cmp = bR - aR;
        break;
      }
      case 'booked': {
        const aB = drbByEmail[String(a.email || '').toLowerCase().trim()]?.b ?? 0;
        const bB = drbByEmail[String(b.email || '').toLowerCase().trim()]?.b ?? 0;
        cmp = bB - aB;
        break;
      }
      case 'instants': {
        const aI = drbByEmail[String(a.email || '').toLowerCase().trim()]?.i ?? 0;
        const bI = drbByEmail[String(b.email || '').toLowerCase().trim()]?.i ?? 0;
        cmp = bI - aI;
        break;
      }
      case 'idleTime': cmp = (bAct?.idleTimeToday ?? 0) - (aAct?.idleTimeToday ?? 0); break;
      case 'rank': {
        const aR = aoiCommandRank(a, queueMap.get(a.id), reactorScoreForAgent(a, agentScores), starred.has(String(a.id))) ?? -1;
        const bR = aoiCommandRank(b, queueMap.get(b.id), reactorScoreForAgent(b, agentScores), starred.has(String(b.id))) ?? -1;
        cmp = bR - aR;
        break;
      }
      case 'queue': cmp = (aQ?.position ?? 999) - (bQ?.position ?? 999); break;
      case 'inbound': cmp = (a.inboundEnabled ? 1 : 0) - (b.inboundEnabled ? 1 : 0); break;
      case 'pendingLeads': {
        const aPending = pendingByEmail[String(a.email || '').toLowerCase().trim()] ?? 0;
        const bPending = pendingByEmail[String(b.email || '').toLowerCase().trim()] ?? 0;
        cmp = bPending - aPending;
        break;
      }
      case 'outbound': {
        const order: Record<string, number> = { on_call: 0, dialing: 0.5, ringing: 0.5, wrap: 0.8, idle: 1, available: 1, offline: 2 };
        cmp = (order[a.webrtcStatus ?? 'offline'] ?? 2) - (order[b.webrtcStatus ?? 'offline'] ?? 2);
        break;
      }
      case 'missed': cmp = (b.missedTransfers ?? 0) - (a.missedTransfers ?? 0); break;
      case 'credits': cmp = (creditsByAssociateId[String(b.id)] ?? credits[b.email?.toLowerCase()] ?? -1) - (creditsByAssociateId[String(a.id)] ?? credits[a.email?.toLowerCase()] ?? -1); break;
      default: {
        const aEff = getEffectiveStatus(a), bEff = getEffectiveStatus(b);
        cmp = (STATUS_ORDER[aEff] ?? 5) - (STATUS_ORDER[bEff] ?? 5);
      }
    }
    return sortDir === 'desc' ? -cmp : cmp;
  };

  // Agent sort within MGA: market order then sortFn
  const agentSortFn = (a: MergedAgent, b: MergedAgent): number => {
    const aIdx = MARKET_ORDER.indexOf(a.normalizedMarket);
    const bIdx = MARKET_ORDER.indexOf(b.normalizedMarket);
    const aN = aIdx === -1 ? MARKET_ORDER.length : aIdx;
    const bN = bIdx === -1 ? MARKET_ORDER.length : bIdx;
    if (aN !== bN) return aN - bN;
    return sortFn(a, b);
  };

  // ── Build two-level hierarchy: RGA → MGA → Agents ─────────────────────────
  // Use ALL mergedAgents for grouping (so nobody is hidden from the tree).
  // The "filtered" set determines which agents are shown WITHIN expanded MGA groups
  // when filters are active — but the group structure is always from all agents.

  const filteredEmailSet = useMemo(() => new Set(filtered.map(a => String(a.email || '').toLowerCase())), [filtered]);

  // Group ALL mergedAgents into RGA → MGA structure
  const rgaGroups = useMemo(() => {
    type MgaGroup = { mgaKey: string; agents: MergedAgent[] };
    type RgaGroup = { rgaKey: string; mgaGroups: Record<string, MgaGroup>; totalAgents: number };
    const rgas: Record<string, RgaGroup> = {};

    for (const a of mergedAgents) {
      const rgaKey = getRgaKey(a);
      const mgaKey = getMgaKey(a);

      if (!rgas[rgaKey]) rgas[rgaKey] = { rgaKey, mgaGroups: {}, totalAgents: 0 };
      if (!rgas[rgaKey].mgaGroups[mgaKey]) rgas[rgaKey].mgaGroups[mgaKey] = { mgaKey, agents: [] };
      rgas[rgaKey].mgaGroups[mgaKey].agents.push(a);
      rgas[rgaKey].totalAgents++;
    }
    return rgas;
  }, [mergedAgents]);

  // Sorted RGA keys by total agent count desc
  const sortedRgaKeys = useMemo(() => {
    const activeCount = (rgaKey: string) => {
      const agents = Object.values(rgaGroups[rgaKey].mgaGroups).flatMap(g => g.agents);
      return agents.filter(a => isAgentActive(a, Date.now(), drbByEmail)).length;
    };
    return Object.keys(rgaGroups).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return activeCount(b) - activeCount(a);
    });
  }, [rgaGroups]);

  // All RGAs start collapsed — user expands manually

  // ── N/Total denominator per MGA: union of CCPro roster + any live online/inbound agent ──
  // Total = deduplicated set of:
  //   (a) All ccPro=true emails in the roster for this MGA (offline subscribers still count)
  //   (b) Any mergedAgent that is online or inboundEnabled for this MGA (access even if not ccPro)
  const ccProByMga = useMemo(() => {
    // Build per-MGA sets of unique emails
    const sets: Record<string, Set<string>> = {};

    // Side (a): CCPro roster entries
    for (const entry of ccProRoster) {
      const key = normalizeName(entry.mgaName) || normalizeName(entry.fullName) || 'Unassigned';
      if (!sets[key]) sets[key] = new Set();
      sets[key].add(entry.email.toLowerCase());
    }

    // Side (b): Live mergedAgents that are online or inboundEnabled
    for (const a of mergedAgents) {
      if (!a.online && !a.inboundEnabled) continue;
      const key = getMgaKey(a);
      if (!sets[key]) sets[key] = new Set();
      if (a.email) sets[key].add(a.email.toLowerCase());
    }

    // Convert to counts
    const counts: Record<string, number> = {};
    for (const [key, s] of Object.entries(sets)) counts[key] = s.size;
    return counts;
  }, [ccProRoster, mergedAgents]);
  // -- CCPro total per RGA (for the /Total denominator on RGA rows) --
  // DRB totals per RGA/MGA keyed from full roster — includes agents not in mergedAgents
  const { drbByRga, drbByMga: drbByMgaRoster } = useMemo(() => {
    const byRga: Record<string, { d: number; r: number; b: number; i: number }> = {};
    const byMga: Record<string, { d: number; r: number; b: number; i: number }> = {};
    const addDrb = (map: Record<string, { d: number; r: number; b: number; i: number }>, key: string, email: string) => {
      const drb = drbByEmail[email.toLowerCase().trim()];
      if (!drb) return;
      if (!map[key]) map[key] = { d: 0, r: 0, b: 0, i: 0 };
      map[key].d += drb.d ?? 0;
      map[key].r += drb.r ?? 0;
      map[key].b += drb.b ?? 0;
      map[key].i += drb.i ?? 0;
    };
    // From CCPro roster
    for (const entry of ccProRoster) {
      const rgaKey = normalizeName(entry.rgaName) || normalizeName(entry.mgaName) || normalizeName(entry.fullName) || 'Unassigned';
      const mgaKey = normalizeName(entry.mgaName) || normalizeName(entry.fullName) || 'Unassigned';
      addDrb(byRga, rgaKey, entry.email);
      addDrb(byMga, mgaKey, entry.email);
    }
    // Also from mergedAgents (in case not in roster)
    for (const a of mergedAgents) {
      if (!a.email) continue;
      const rgaKey = getRgaKey(a);
      const mgaKey = getMgaKey(a);
      addDrb(byRga, rgaKey, a.email);
      addDrb(byMga, mgaKey, a.email);
    }
    return { drbByRga: byRga, drbByMga: byMga };
  }, [ccProRoster, mergedAgents, drbByEmail]);

  const ccProByRga = useMemo(() => {
    const sets: Record<string, Set<string>> = {};
    for (const entry of ccProRoster) {
      const rgaKey = normalizeName(entry.rgaName) || normalizeName(entry.mgaName) || normalizeName(entry.fullName) || 'Unassigned';
      if (!sets[rgaKey]) sets[rgaKey] = new Set();
      sets[rgaKey].add(entry.email.toLowerCase());
    }
    for (const a of mergedAgents) {
      if (!a.online && !a.inboundEnabled) continue;
      const rgaKey = getRgaKey(a);
      if (!sets[rgaKey]) sets[rgaKey] = new Set();
      if (a.email) sets[rgaKey].add(a.email.toLowerCase());
    }
    const counts: Record<string, number> = {};
    for (const [key, s] of Object.entries(sets)) counts[key] = s.size;
    return counts;
  }, [ccProRoster, mergedAgents]);

  // Flat filtered list for table render.
  // Base list is the active filter result; then apply visibility rules and stable market ordering.
  const flatAgents = useMemo(() => {
    const hasDrbData = Object.keys(drbByEmail).length > 0;
    const marketRank = (marketRaw: string | undefined): number => {
      const market = String(marketRaw || '');
      const idx = MARKET_ORDER.indexOf(market);
      return idx === -1 ? MARKET_ORDER.length : idx;
    };

    return filtered
      .filter(a => {
        const email = String(a.email || '').toLowerCase().trim();
        const dials = drbByEmail[email]?.d ?? 0;
        const isRecruit = String(a.normalizedMarket || a.market || '').toLowerCase().includes('recruit');

        // Keep AO Recruit visibility aligned with header stats and active heuristics.
        // Previously this required only a.online===true, which caused false "No matches"
        // when recruit agents were active via inbound/outbound/DRB but not Taalk-online.
        if (isRecruit) {
          return (
            a.online === true ||
            a.inboundEnabled ||
            a.outboundEnabled ||
            isAgentActive(a, Date.now(), drbByEmail) ||
            dials > 0
          );
        }

        // Show all agents while DRB is still loading, then tighten with activity checks.
        if (!hasDrbData) return a.inboundEnabled || a.online || a.busy;
        return a.inboundEnabled || a.outboundEnabled || isAgentActive(a, Date.now(), drbByEmail) || dials > 0;
      })
      .sort((a, b) => {
        const marketDelta = marketRank(a.normalizedMarket) - marketRank(b.normalizedMarket);
        if (marketDelta !== 0) return marketDelta;
        const aEmail = String(a.email || '').toLowerCase().trim();
        const bEmail = String(b.email || '').toLowerCase().trim();
        if (a.inboundEnabled && !b.inboundEnabled) return -1;
        if (!a.inboundEnabled && b.inboundEnabled) return 1;
        return (drbByEmail[bEmail]?.d ?? 0) - (drbByEmail[aEmail]?.d ?? 0);
      });
  }, [filtered, drbByEmail]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortInd = (key: SortKey) => sortKey !== key ? null : <span className="ml-1 text-[8px] opacity-60">{sortDir === 'asc' ? '▲' : '▼'}</span>;

  const columns: { key: SortKey; label: string; width?: number }[] = [
    { key: 'status', label: 'Status', width: 90 },
    { key: 'name', label: 'Agent' },
    { key: 'callsToday', label: 'Dials', width: 68 },
    { key: 'reached', label: 'Reached', width: 68 },
    { key: 'booked', label: 'Booked', width: 68 },
    { key: 'instants', label: 'Inst', width: 60 },
    { key: 'inbound', label: 'Inbound', width: 65 },
    { key: 'pendingLeads', label: 'Pending', width: 70 },
    { key: 'outbound', label: 'Dial', width: 80 },
    { key: 'market', label: 'Market', width: 75 },
    { key: 'mga', label: 'Exec Producer', width: 110 },
    { key: 'timeInStatus', label: 'Time', width: 70 },
    { key: 'activity', label: 'Activity' },
    { key: 'idleTime', label: 'Idle', width: 60 },
    { key: 'credits', label: 'Credits', width: 60 },
  ];
  const totalCols = columns.length + 1;

  const totalAgentCount = mergedAgents.length;

  const thBase: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 10, padding: '6px 8px',
    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    color: 'var(--fg-dim)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-bright)',
  };

  // Check if any filter is active (affects what we show in expanded MGA groups)
  const hasActiveFilter = statusFilter !== 'all' || marketFilter !== 'all' || mgaFilter !== 'all' || !!search;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2" style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-muted)' }}>Agents</span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--fg-dim)' }}>{flatAgents.length}/{totalAgentCount}</span>
        <div className="flex-1" />
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ width: 160, fontSize: 11, padding: '4px 8px' }} />
        <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)} className="select">
          <option value="all">All Markets</option>
          {marketOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {mgaOptions.length > 0 && (
          <select value={mgaFilter} onChange={e => setMgaFilter(e.target.value)} className="select">
            <option value="all">All MGAs</option>
            {mgaOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <div className="flex gap-0.5">
          {(['all', 'busy', 'idle', 'away', 'ob_idle', 'offline'] as const).map(f => {
            const isA = statusFilter === f;
            const cfg = f === 'all' ? { color: 'var(--fg-muted)', bg: 'var(--primary-soft)' } : f === 'ob_idle' ? { color: 'var(--amber)', bg: 'var(--amber-soft)' } : f === 'offline' ? { color: 'var(--fg-dim)', bg: 'var(--gray-soft)' } : { color: STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.color ?? 'var(--fg-dim)', bg: STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.bg ?? 'transparent' };
            return <button key={f} onClick={() => setStatusFilter(f)} className="text-[10px] px-2 py-1 rounded font-medium" style={{ color: isA ? cfg.color : 'var(--fg-dim)', background: isA ? cfg.bg : 'transparent' }}>{f === 'all' ? 'All' : f === 'ob_idle' ? 'Idle' : f === 'offline' ? 'Offline' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.label ?? f}</button>;
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(c => <th key={c.key} onClick={() => handleSort(c.key)} style={{ ...thBase, width: c.width }}>{c.label}{sortInd(c.key)}</th>)}
              {!readOnly && <th style={{ ...thBase, textAlign: 'right', width: 70 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {flatAgents.map(a => (
              <AgentRow
                key={a.id || a.email}
                agent={a}
                activity={activityMap.get(a.id)}
                isTaalkAgent={taalkIds.has(a.id)}
                healthReport={healthMap.get(a.email?.toLowerCase())}
                agentCredits={creditsByAssociateId[String(a.id)] ?? credits[a.email?.toLowerCase()] ?? null}
                isStarred={starred.has(String(a.id))}
                onToggleStar={() => toggleStar(String(a.id))}
                onSelect={() => setSelectedAgent(a)}
                agentScore={reactorScoreForAgent(a, agentScores)}
                readOnly={readOnly}
                drb={drbByEmail[String(a.email || '').toLowerCase().trim()] || { d: 0, r: 0, b: 0, i: 0 }}
                pendingCount={pendingByEmail[String(a.email || '').toLowerCase().trim()] ?? 0}
                callablePlusCount={callablePlusByEmail[String(a.email || '').toLowerCase().trim()] ?? 0}
                indent={0}
              />
            ))}
            {flatAgents.length === 0 && (
              <tr><td colSpan={totalCols} style={{ textAlign: 'center', padding: 48, color: 'var(--fg-dim)' }}>{mergedAgents.length === 0 ? 'Connecting…' : 'No matches'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedAgent && (
        <>
          <div
            onClick={() => setSelectedAgent(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }}
          />
          <AgentDetailPanel
            agent={selectedAgent}
            healthReport={healthMap.get(selectedAgent.email?.toLowerCase()) ?? null}
            onClose={() => setSelectedAgent(null)}
          />
        </>
      )}
    </div>
  );
}

// ── MarketGroup kept for compatibility (unused as primary) ─────────────────────
function MarketGroup({ market, color, agents, activityMap, queueMap, taalkIds, healthMap, credits, creditsByAssociateId, starred, toggleStar, counts, isCollapsed, onToggle, colCount, onSelectAgent, agentScores, readOnly, drbByEmail, pendingByEmail, callablePlusByEmail }: {
  market: string; color: string; agents: MergedAgent[];
  activityMap: Map<number, AgentActivitySummary>; queueMap: Map<number, QueuePosition>;
  taalkIds: Set<number>; healthMap: Map<string, AgentHealthReport>;
  credits: Record<string, number>; creditsByAssociateId: Record<string, number>;
  starred: Set<string>; toggleStar: (id: string) => void;
  counts: { busy: number; idle: number; away: number; total: number };
  isCollapsed: boolean; onToggle: () => void; colCount: number;
  onSelectAgent: (agent: MergedAgent) => void;
  agentScores?: Record<string, AgentScore>;
  readOnly?: boolean;
  drbByEmail: Record<string, DrbStats>;
  pendingByEmail: Record<string, number>;
  callablePlusByEmail: Record<string, number>;
}) {
  return (
    <>
      <tr onClick={onToggle} style={{ background: 'linear-gradient(to right, var(--bg-surface), var(--bg-raised))', cursor: 'pointer', userSelect: 'none' }}>
        <td colSpan={colCount} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'var(--fg-dim)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
            <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.03em' }}>{market}</span>
            <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{counts.total}</span>
            {counts.busy > 0 && <span className="badge" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>{counts.busy} on transfer</span>}
            {counts.idle > 0 && <span className="badge" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>{counts.idle} available</span>}
            {counts.away > 0 && <span className="badge" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>{counts.away} away</span>}
          </div>
        </td>
      </tr>
      {!isCollapsed && agents.map(a => <AgentRow key={a.id || a.email} agent={a} activity={activityMap.get(a.id)} isTaalkAgent={taalkIds.has(a.id)} healthReport={healthMap.get(a.email?.toLowerCase())} agentCredits={creditsByAssociateId[String(a.id)] ?? credits[a.email?.toLowerCase()] ?? null} isStarred={starred.has(String(a.id))} onToggleStar={() => toggleStar(String(a.id))} onSelect={() => onSelectAgent(a)} agentScore={reactorScoreForAgent(a, agentScores)} readOnly={readOnly} drb={drbByEmail[String(a.email || '').toLowerCase().trim()] || { d: 0, r: 0, b: 0, i: 0 }} pendingCount={pendingByEmail[String(a.email || '').toLowerCase().trim()] ?? 0} callablePlusCount={callablePlusByEmail[String(a.email || '').toLowerCase().trim()] ?? 0} indent={0} />)}
    </>
  );
}

function AgentRow({ agent, activity, isTaalkAgent, healthReport, agentCredits, isStarred, onToggleStar, onSelect, agentScore, readOnly, drb, pendingCount, callablePlusCount, indent = 0 }: {
  agent: MergedAgent; activity?: AgentActivitySummary; isTaalkAgent: boolean; healthReport?: AgentHealthReport;
  agentCredits: number | null; isStarred: boolean; onToggleStar: () => void; onSelect: () => void;
  agentScore?: AgentScore; readOnly?: boolean; drb: DrbStats; pendingCount: number; callablePlusCount: number; indent?: number;
}) {
  const [loading, setLoading] = useState(false);
  const webrtcOnly = !agent.inboundEnabled;
  const effectiveStatus = getEffectiveStatus(agent);
  const hasDialsToday = (drb.d ?? 0) > 0;
  const cfg = (webrtcOnly && effectiveStatus === 'idle')
    ? { label: 'Idle', color: 'var(--amber)', bg: 'var(--amber-soft)', dot: 'var(--amber)', rowTint: 'var(--row-away)' }
    : (webrtcOnly && effectiveStatus === 'busy' && agent.webrtcStatus === 'dialing')
    ? { label: 'Active', color: 'var(--cyan, #06b6d4)', bg: 'rgba(6,182,212,0.1)', dot: 'var(--cyan, #06b6d4)', rowTint: 'rgba(6,182,212,0.05)' }
    : (webrtcOnly && effectiveStatus === 'busy' && agent.webrtcStatus === 'on_call')
    ? { label: 'Live Call', color: 'var(--green)', bg: 'var(--green-soft)', dot: 'var(--green)', rowTint: 'var(--row-idle)' }
    : hasDialsToday
    ? { label: 'Active', color: 'var(--cyan, #06b6d4)', bg: 'rgba(6,182,212,0.1)', dot: 'var(--cyan, #06b6d4)', rowTint: 'rgba(6,182,212,0.05)' }
    : STATUS_CONFIG[effectiveStatus];
  const isSus = agent.suspended || agent.status === 'suspended';
  const flag = timeFlag(agent);
  const actBase = activityText(agent);
  const act = hasDialsToday && (actBase.text === 'Offline' || actBase.text === 'Idle (outbound only)' || actBase.text === 'Waiting for transfers')
    ? { text: `Active (${drb.d} dials)`, color: 'var(--cyan, #06b6d4)' }
    : actBase;
  const idleMs = activity?.idleTimeToday ?? 0;
  const displayName = getDisplayName(agent);

  const handleToggle = async () => {
    if (webrtcOnly) return;
    setLoading(true);
    try { if (isSus) await api.unsuspendAgent(agent._id); else await api.suspendAgent(agent._id); } catch {} setLoading(false);
  };

  const _taskMs = agent.taskAssignedTime ? Date.now() - new Date(agent.taskAssignedTime).getTime() : Infinity;
  const _hangupMs = agent.lastHangupTime ? Date.now() - new Date(agent.lastHangupTime).getTime() : Infinity;
  const _statusMs = agent.statusSince ? Date.now() - new Date(agent.statusSince).getTime() : Infinity;
  const timeStr = webrtcOnly
    ? '—'
    : agent.status === 'busy' && agent.taskAssignedTime && _taskMs < 2 * 60 * 60 * 1000
      ? durationSince(agent.taskAssignedTime)
      : agent.lastHangupTime && _hangupMs < 12 * 60 * 60 * 1000
        ? durationSince(agent.lastHangupTime)
        : _statusMs < 12 * 60 * 60 * 1000
          ? durationSince(agent.statusSince!)
          : '—';

  const indentPx = indent === 0 ? 8 : indent === 1 ? 40 : 8;
  const cs: React.CSSProperties = { padding: '4px 8px', fontSize: 11, borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' };

  const isOutboundOnlyWarning = agent.outboundEnabled && !agent.inboundEnabled;
  const rowBg = isOutboundOnlyWarning ? 'rgba(239, 68, 68, 0.08)' : cfg.rowTint;
  const wrtc = webrtcLabel(agent.webrtcStatus, agent.outboundEnabled);

  return (
    <tr onClick={onSelect} style={{ cursor: "pointer", background: rowBg, opacity: isSus ? 0.5 : 1 }}
      onMouseEnter={e => { if (!isSus) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}>

      {/* Status */}
      <td style={cs}>
        <div className="flex items-center gap-1.5">
          <span className={`dot ${effectiveStatus === 'busy' ? 'pulse-ring' : ''}`} style={{ background: cfg.dot, width: 7, height: 7 }} />
          <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontSize: 9 }}>{cfg.label}</span>
        </div>
      </td>

      {/* Name */}
      <td style={{ ...cs, fontWeight: 600, color: isSus ? 'var(--fg-dim)' : 'var(--fg)', textDecoration: isSus ? 'line-through' : 'none', cursor: 'pointer', paddingLeft: indentPx }} onClick={onSelect}>
        {(() => {
          const hs = healthReport ? getHealthStatus(healthReport) : null;
          const hDot = hs === 'healthy' ? '🟢' : hs === 'warning' ? '🟡' : hs === 'error' ? '🔴' : null;
          return hDot ? <span style={{ fontSize: 7, marginRight: 4 }} title={`Health: ${hs}`}>{hDot}</span> : null;
        })()}
        {displayName}
        {agentScore && (() => {
          const tcfg = TIER_CFG[agentScore.tier];
          return (
            <span title={`${tcfg.label} · Pick: ${(agentScore.pickRate * 100).toFixed(0)}% · ${agentScore.blasts} blasts · Score: ${agentScore.score}`}
              style={{ marginLeft: 5, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: tcfg.bg, color: tcfg.fg, fontWeight: 700 }}>
              {tcfg.icon}
            </span>
          );
        })()}
        {agent.webrtcSuspended && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--purple, #a78bfa)' }} title="Auto-suspended for WebRTC call">⏸ WR</span>}
        {healthReport?.browser?.name && !['electron', 'unknown'].includes(healthReport.browser.name.toLowerCase()) && (
          <span style={{ marginLeft: 4, fontSize: 8, padding: '1px 3px', borderRadius: 3, background: 'rgba(234,179,8,0.15)', color: 'var(--amber)' }} title={`Using ${healthReport.browser.name} — not Electron app`}>🌐 {healthReport.browser.name}</span>
        )}
        {(healthReport as any)?.wsConnectivity === 'blocked' && (
          <span style={{ marginLeft: 4, fontSize: 8, padding: '1px 3px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }} title="Firewall/VPN blocking Twilio WebSocket — agent cannot receive calls">🧱 FW</span>
        )}
        {(healthReport as any)?.tokenExpiresIn != null && (healthReport as any).tokenExpiresIn < 300 && (
          <span style={{ marginLeft: 4, fontSize: 8, padding: '1px 3px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }} title={`Twilio token expires in ${(healthReport as any).tokenExpiresIn}s — device may disconnect`}>⏰ TOKEN</span>
        )}
      </td>

      {/* Dials */}
      <td style={{ ...cs, textAlign: 'center' }}>
        <span
          className="tabular-nums"
          style={{ color: (drb.d ?? 0) > 0 ? 'var(--drb-table-fg)' : 'var(--drb-table-zero-fg)', fontWeight: 800, fontSize: 12 }}
          title="Dials"
        >
          {drb.d ?? 0}
        </span>
      </td>

      {/* Reached */}
      <td style={{ ...cs, textAlign: 'center' }}>
        <span
          className="tabular-nums"
          style={{ color: (drb.r ?? 0) > 0 ? 'var(--drb-table-fg)' : 'var(--drb-table-zero-fg)', fontWeight: 800, fontSize: 12 }}
          title="Reached"
        >
          {drb.r ?? 0}
        </span>
      </td>

      {/* Booked */}
      <td style={{ ...cs, textAlign: 'center' }}>
        <span
          className="tabular-nums"
          style={{ color: (drb.b ?? 0) > 0 ? 'var(--drb-table-fg)' : 'var(--drb-table-zero-fg)', fontWeight: 800, fontSize: 12 }}
          title="Booked"
        >
          {drb.b ?? 0}
        </span>
      </td>

      {/* Instants */}
      <td style={{ ...cs, textAlign: 'center' }}>
        <span
          className="tabular-nums"
          style={{ color: (drb.i ?? 0) > 0 ? 'var(--drb-table-fg)' : 'var(--drb-table-zero-fg)', fontWeight: 800, fontSize: 12 }}
          title="Instant calls (10m+ not booked/instant_presentation in masterlead)"
        >
          {drb.i ?? 0}
        </span>
      </td>

      {/* Inbound */}
      <td style={{ ...cs, textAlign: 'center' }}>
        {agent.inboundEnabled ? (
          <span style={{ color: 'var(--green)', fontSize: 10, fontWeight: 600 }}>ON</span>
        ) : (
          <span style={{ color: 'var(--red)', fontSize: 10, fontWeight: 600 }}>OFF</span>
        )}
      </td>

      {/* Pending leased leads */}
      <td style={{ ...cs, textAlign: 'center' }}>
        <span className="tabular-nums" style={{
          color: pendingCount > 0 ? 'var(--fg-muted)' : 'var(--fg-dim)',
          fontWeight: 700, fontSize: 10,
        }} title={`Pending leased leads: ${pendingCount} / 100${callablePlusCount > 0 ? ` | Callable plus: ${callablePlusCount}` : ''}`}>
          {pendingCount}/100
        </span>
      </td>

      {/* Outbound (WebRTC) */}
      <td style={cs}>
        <div className="flex items-center gap-1.5">
          {agent.outboundEnabled && wrtc.text !== '—' && (
            <span className={`dot ${wrtc.pulse ? 'pulse-ring' : ''}`} style={{ background: wrtc.color, width: 6, height: 6, flexShrink: 0 }} />
          )}
          <span className="badge" style={{
            background: agent.outboundEnabled
              ? wrtc.text === 'On Call' ? 'rgba(16,185,129,0.15)'
              : wrtc.text === 'Dialing' ? 'rgba(6,182,212,0.15)'
              : wrtc.text === 'Ringing' ? 'rgba(245,158,11,0.15)'
              : wrtc.text === 'Wrap' ? 'rgba(249,115,22,0.15)'
              : 'var(--gray-soft)'
            : 'var(--gray-soft)',
            color: wrtc.color, fontSize: 9,
          }}>
            {wrtc.text}
          </span>
        </div>
      </td>

      {/* Market */}
      <td style={{ ...cs, fontSize: 10, color: MARKET_COLORS[agent.normalizedMarket] ?? 'var(--primary-fg)' }}>{agent.normalizedMarket || 'Unknown'}</td>

      {/* Exec Producer (MGA) */}
      <td style={{ ...cs, fontSize: 10, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ color: agent.mgaName ? 'var(--fg-muted)' : 'var(--fg-dim)' }} title={agent.mgaName ?? undefined}>
          {agent.mgaName || '—'}
        </span>
      </td>

      {/* Time */}
      <td style={cs}>
        <span className="tabular-nums" style={{ fontWeight: 600, fontSize: 11, color: flag === 'danger' ? 'var(--red)' : flag === 'warning' ? 'var(--amber)' : 'var(--fg-muted)' }}>
          {timeStr}
        </span>
        {flag && <span style={{ marginLeft: 3, fontSize: 9 }}>{flag === 'danger' ? '🔴' : '🟡'}</span>}
      </td>

      {/* Activity */}
      <td style={{ ...cs, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ color: act.color, fontSize: 10 }}>{act.text}</span>
        {agent.status === 'busy' && agent.callInfo?.leadPhone && <span style={{ color: 'var(--fg-dim)', fontSize: 9, marginLeft: 4 }}>{formatPhone(agent.callInfo.leadPhone)}</span>}
      </td>

      {/* Idle Today */}
      <td style={cs}>
        {webrtcOnly ? (
          <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>—</span>
        ) : (
          <span className="tabular-nums" style={{ color: idleMs > 3600000 ? 'var(--red)' : idleMs > 1800000 ? 'var(--amber)' : 'var(--fg-dim)', fontSize: 10 }}>{fmtIdleTime(idleMs)}</span>
        )}
      </td>

      {/* Credits */}
      <td style={{ ...cs, textAlign: 'center' }}>
        <span className="tabular-nums" style={{
          color: (agentCredits ?? 0) <= 0 ? 'var(--red)' : (agentCredits ?? 0) < 10 ? 'var(--amber)' : 'var(--fg-muted)',
          fontWeight: (agentCredits ?? 0) <= 0 ? 800 : 400,
          fontSize: (agentCredits ?? 0) <= 0 ? 12 : 11,
        }}>
          {agentCredits ?? 0}
        </span>
      </td>

      {/* Actions */}
      {!readOnly && <td style={{ ...cs, textAlign: 'right' }}>
        <div className="flex items-center gap-1 justify-end">
          <button onClick={(e) => { e.stopPropagation(); onToggleStar(); }} className="action-btn" style={{
            background: isStarred ? 'rgba(234,179,8,0.15)' : 'transparent',
            color: isStarred ? '#eab308' : 'var(--fg-dim)',
            border: isStarred ? '1px solid rgba(234,179,8,0.3)' : '1px solid var(--border)',
            fontSize: 14, padding: '2px 6px',
          }} title={isStarred ? 'Remove max rank' : 'Set max rank (999)'}>{isStarred ? '⭐' : '☆'}</button>
          {!agent.inboundEnabled && (
            <button onClick={async (e) => { e.stopPropagation(); setLoading(true); try { await fetch('/api/vdp/force-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: String(agent.id), states: agent.states || [], market: agent.normalizedMarket, first_name: agent.firstName, last_name: agent.lastName }) }); } catch {} setLoading(false); }} disabled={loading} className="action-btn" style={{
              background: 'rgba(59,130,246,0.1)', color: 'var(--primary-fg, #3b82f6)',
              border: '1px solid rgba(59,130,246,0.2)',
            }}>{loading ? '…' : 'Go Online'}</button>
          )}
          {agent.inboundEnabled && (
            <button onClick={async (e) => { e.stopPropagation(); setLoading(true); try { await fetch('/api/vdp/force-offline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: String(agent.id) }) }); } catch {} setLoading(false); }} disabled={loading} className="action-btn" style={{
              background: 'var(--amber-soft, rgba(245,158,11,0.1))', color: 'var(--amber, #f59e0b)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>{loading ? '…' : 'Go Offline'}</button>
          )}
          {isTaalkAgent && (
            <button onClick={handleToggle} disabled={loading} className="action-btn" style={{
              background: isSus ? 'var(--green-soft)' : 'var(--red-soft)',
              color: isSus ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${isSus ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>{loading ? '…' : isSus ? 'Resume' : 'Suspend'}</button>
          )}
        </div>
      </td>}
    </tr>
  );
}
