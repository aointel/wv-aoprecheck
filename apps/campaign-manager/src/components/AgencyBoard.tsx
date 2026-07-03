import { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { LiveQueue } from './LiveQueue';
import { AgentTable } from './AgentTable';
import type { AgentScore } from './AgentTable';
import type { MergedAgent } from '../../shared/types';

const MARKET_MAP: Record<string, string> = {
  globe:      'Globe',
  veteran:    'Veteran',
  vet:        'Veteran',
  recruit:    'AO Recruit',
  aorecruit:  'AO Recruit',
  aor:        'AO Recruit',
  rms:        'AO Recruit',
  willkit:    'Will Kit',
  womens:     'Womens Benefit',
  plus:       'Plus',
  union:      'Union',
};

const MARKET_COLORS: Record<string, string> = {
  Globe:            '#3b82f6',
  Veteran:          '#10b981',
  'AO Recruit':     '#8b5cf6',
  'Will Kit':       '#f59e0b',
  'Womens Benefit': '#ec4899',
  Plus:             '#06b6d4',
  Union:            '#f97316',
};

type AgentStatus = 'busy' | 'idle' | 'away' | 'suspended' | 'offline';
const STATUS_ORDER: Record<AgentStatus, number> = { busy: 0, idle: 1, away: 2, suspended: 3, offline: 4 };

function effectiveStatus(a: MergedAgent): AgentStatus {
  if (a.inboundEnabled) return a.status;
  if (a.webrtcStatus === 'on_call' || a.webrtcStatus === 'dialing' || a.webrtcStatus === 'ringing' || a.webrtcStatus === 'wrap') return 'busy';
  if (a.webrtcStatus === 'idle') return 'idle';
  return 'offline';
}

function displayName(a: MergedAgent): string {
  if (a.fullName && a.fullName !== '?' && a.fullName.trim()) return a.fullName;
  const p = (a.email || '').split('@')[0];
  const parts = p.split(/[._]/);
  if (parts.length >= 2) return parts.map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join(' ');
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setT(new Date()), 1000); return () => clearInterval(iv); }, []);
  return t;
}


export function AgencyBoard({ slug }: { slug: string }) {
  const data = useWebSocket();
  const [, tick] = useState(0);
  const clock = useClock();
  const market = MARKET_MAP[slug.toLowerCase()] ?? slug;
  const color = MARKET_COLORS[market] ?? '#6366f1';
  const [mgaFilter, setMgaFilter] = useState<string>('');
  const [rgaFilter, setRgaFilter] = useState<string>('');
  const [agentScores, setAgentScores] = useState<Record<string, AgentScore>>({});
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [creditsByAssociateId, setCreditsByAssociateId] = useState<Record<string, number>>({});

  useEffect(() => { const iv = setInterval(() => tick(n => n + 1), 5000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const poll = () => fetch('/api/reactor/state').then(r => r.json()).then(d => { if (d?.agentScores) setAgentScores(d.agentScores); }).catch(() => {});
    poll(); const iv = setInterval(poll, 60_000); return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const poll = () => fetch('/api/credits').then(r => r.json()).then(d => { setCredits(d.credits ?? {}); setCreditsByAssociateId(d.byAssociateId ?? {}); }).catch(() => {});
    poll(); const iv = setInterval(poll, 300_000); return () => clearInterval(iv);
  }, []);

  // All agents in this market (unfiltered by MGA/RGA) — used to build dropdown options
  const marketAgents = useMemo(() =>
    data.mergedAgents.filter((a) => {
      if (a.normalizedMarket?.toLowerCase() !== market.toLowerCase()) return false;
      // AO Recruit board rule: only show agents currently online on Taalk.
      if (market.toLowerCase() === 'ao recruit') return a.online === true;
      return true;
    }),
    [data.mergedAgents, market]
  );

  // Available MGAs for this market
  const mgaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of marketAgents) { if (a.mgaName) set.add(a.mgaName); }
    return [...set].sort();
  }, [marketAgents]);

  // Available RGAs for selected MGA (or all RGAs if no MGA selected)
  const rgaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of marketAgents) {
      if (mgaFilter && a.mgaName !== mgaFilter) continue;
      if (a.rgaName) set.add(a.rgaName);
    }
    return [...set].sort();
  }, [marketAgents, mgaFilter]);

  // When MGA changes, reset RGA filter if it no longer applies
  useEffect(() => {
    if (rgaFilter && !rgaOptions.includes(rgaFilter)) setRgaFilter('');
  }, [mgaFilter, rgaOptions, rgaFilter]);

  // Final filtered agents
  const agents = useMemo(() =>
    marketAgents
      .filter(a => {
        if (mgaFilter && a.mgaName !== mgaFilter) return false;
        if (rgaFilter && a.rgaName !== rgaFilter) return false;
        return true;
      })
      .sort((a, b) => (STATUS_ORDER[effectiveStatus(a)] ?? 5) - (STATUS_ORDER[effectiveStatus(b)] ?? 5) || displayName(a).localeCompare(displayName(b))),
    [marketAgents, mgaFilter, rgaFilter]
  );

  const counts = useMemo(() => {
    let busy = 0, idle = 0;
    for (const a of agents) { const s = effectiveStatus(a); if (s === 'busy') busy++; else if (s === 'idle') idle++; }
    return { busy, idle, total: agents.filter(a => effectiveStatus(a) !== 'offline' && effectiveStatus(a) !== 'suspended').length };
  }, [agents]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to right, hsl(215 28% 22%), hsl(217 33% 17%))', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '0.02em' }}>
              {`AOI ${market}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 1 }}>Agency Live Board</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* MGA/RGA Filters */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {mgaOptions.length > 0 && (
              <select
                value={mgaFilter}
                onChange={e => setMgaFilter(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: mgaFilter ? 'var(--fg)' : 'var(--fg-dim)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, cursor: 'pointer' }}
              >
                <option value=''>All MGAs</option>
                {mgaOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            {rgaOptions.length > 0 && (
              <select
                value={rgaFilter}
                onChange={e => setRgaFilter(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: rgaFilter ? 'var(--fg)' : 'var(--fg-dim)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, cursor: 'pointer' }}
              >
                <option value=''>All RGAs</option>
                {rgaOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            {(mgaFilter || rgaFilter) && (
              <button onClick={() => { setMgaFilter(''); setRgaFilter(''); }} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, cursor: 'pointer' }}>✕ Clear</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ padding: '5px 14px', borderRadius: 8, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>🔴 {counts.busy} On Transfer</span>
            <span style={{ padding: '5px 14px', borderRadius: 8, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>🟢 {counts.idle} Available</span>
            <span style={{ padding: '5px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 12, fontWeight: 700 }}>👥 {counts.total} Active</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--fg)' }}>
              {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: 10, color: data.connected ? 'var(--green)' : 'var(--red)', marginTop: 1 }}>{data.connected ? '● Live' : '○ Offline'}</div>
          </div>
        </div>
      </div>

      {/* Body: agent table + leaderboard */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Agent Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <AgentTable
            agents={data.agents.filter((a) => {
              if (a.normalizedMarket?.toLowerCase() !== market.toLowerCase()) return false;
              if (market.toLowerCase() === 'ao recruit') return a.online === true;
              return true;
            })}
            mergedAgents={agents}
            activitySummary={data.activitySummary}
            queuePositions={data.queuePositions}
            stats={data.stats}
            agentHealth={data.agentHealth}
            credits={credits}
            creditsByAssociateId={creditsByAssociateId}
            agentScores={agentScores}
            readOnly
          />
        </div>

        {/* Right Panel — same LiveQueue as main dashboard, filtered to this market */}
        <div style={{ width: 420, borderLeft: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LiveQueue
            agents={data.agents}
            activeCalls={data.activeCalls.filter(c => c.market?.toLowerCase() === market.toLowerCase())}
            completedTransfers={data.completedTransfers.filter(c => c.market?.toLowerCase() === market.toLowerCase())}
            missedTransfers={data.missedTransfers.filter(m => m.market?.toLowerCase() === market.toLowerCase())}
            dialingCampaigns={data.dialingCampaigns.filter(c => c.market?.toLowerCase() === market.toLowerCase())}
            stats={data.stats}
            marketFilter={market}
          />
        </div>
      </div>
    </div>
  );
}
