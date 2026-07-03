import { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { MergedAgent, AgentActivitySummary, QueuePosition } from '../../shared/types';
import { durationSince, timeAgo } from '../utils';
import type { AgentScore } from './AgentTable';

const MARKET_MAP: Record<string, string> = {
  globe:   'Globe',
  veteran: 'Veteran',
  recruit: 'AO Recruit',
};

const MARKET_COLORS: Record<string, string> = {
  Globe:       '#3b82f6',
  Veteran:     '#10b981',
  'AO Recruit': '#8b5cf6',
};

const TIER_CFG = {
  elite:  { icon: '⭐', fg: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  active: { icon: '✅', fg: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  low:    { icon: '⬇️', fg: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  ghost:  { icon: '👻', fg: '#a78bfa', bg: 'rgba(139,92,246,0.15)' },
} as const;

type AgentStatus = 'busy' | 'idle' | 'away' | 'suspended' | 'offline';
const STATUS_ORDER: Record<AgentStatus, number> = { busy: 0, idle: 1, away: 2, suspended: 3, offline: 4 };
const STATUS_CFG: Record<AgentStatus, { label: string; color: string; bg: string; dot: string }> = {
  busy:      { label: 'On Transfer', color: 'var(--red)',    bg: 'var(--red-soft)',   dot: 'var(--red)' },
  idle:      { label: 'Available',   color: 'var(--green)',  bg: 'var(--green-soft)', dot: 'var(--green)' },
  away:      { label: 'Away',        color: 'var(--amber)',  bg: 'var(--amber-soft)', dot: 'var(--amber)' },
  suspended: { label: 'Suspended',   color: 'var(--gray)',   bg: 'var(--gray-soft)',  dot: 'var(--gray)' },
  offline:   { label: 'Offline',     color: 'var(--fg-dim)', bg: 'var(--gray-soft)',  dot: 'var(--fg-dim)' },
};

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

function fmtIdle(ms: number) {
  if (ms <= 0) return '0m';
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function useClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setT(new Date()), 1000); return () => clearInterval(iv); }, []);
  return t;
}

export function DisplayBoard({ slug }: { slug: string }) {
  const data = useWebSocket();
  const [scores, setScores] = useState<Record<string, AgentScore>>({});
  const [, tick] = useState(0);
  const clock = useClock();
  const market = MARKET_MAP[slug.toLowerCase()] ?? slug;
  const color = MARKET_COLORS[market] ?? '#6366f1';

  useEffect(() => {
    const poll = () => fetch('/api/reactor/state').then(r => r.json()).then(d => { if (d?.agentScores) setScores(d.agentScores); }).catch(() => {});
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { const iv = setInterval(() => tick(n => n + 1), 5000); return () => clearInterval(iv); }, []);

  const actMap = useMemo(() => { const m = new Map<number, AgentActivitySummary>(); for (const a of data.activitySummary) m.set(a.agentId, a); return m; }, [data.activitySummary]);
  const qMap   = useMemo(() => { const m = new Map<number, QueuePosition>();        for (const q of data.queuePositions) m.set(q.agentId, q); return m; }, [data.queuePositions]);

  const agents = useMemo(() =>
    data.mergedAgents
      .filter(a => a.normalizedMarket?.toLowerCase() === market.toLowerCase())
      .sort((a, b) => (STATUS_ORDER[effectiveStatus(a)] ?? 5) - (STATUS_ORDER[effectiveStatus(b)] ?? 5) || displayName(a).localeCompare(displayName(b))),
    [data.mergedAgents, market]
  );

  const counts = useMemo(() => {
    let busy = 0, idle = 0, away = 0;
    for (const a of agents) { const s = effectiveStatus(a); if (s === 'busy') busy++; else if (s === 'idle') idle++; else if (s === 'away') away++; }
    return { busy, idle, away };
  }, [agents]);

  const cs = { padding: '6px 10px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' as const };
  const th = { padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--fg-dim)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-bright)', textAlign: 'left' as const };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to right, hsl(215 28% 22%), hsl(217 33% 17%))', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '0.02em' }}>
              {market === 'AO Recruit' ? 'AOI Recruit' : `AOI ${market}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 1 }}>Live Agent Board</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>🔴 {counts.busy} On Transfer</span>
            <span style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 11, fontWeight: 700 }}>🟢 {counts.idle} Available</span>
            {counts.away > 0 && <span style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 11, fontWeight: 700 }}>🟡 {counts.away} Away</span>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--fg)' }}>
              {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: 10, color: data.connected ? 'var(--green)' : 'var(--red)', marginTop: 1 }}>{data.connected ? '● Live' : '○ Offline'}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 40 }}>#</th>
              <th style={{ ...th, width: 110 }}>Status</th>
              <th style={th}>Agent</th>
              <th style={{ ...th, width: 70, textAlign: 'center' }}>Inbound</th>
              <th style={{ ...th, width: 80 }}>Outbound</th>
              <th style={{ ...th, width: 55, textAlign: 'center' }}>Missed</th>
              <th style={{ ...th, width: 70, textAlign: 'center' }}>Time</th>
              <th style={th}>Activity</th>
              <th style={{ ...th, width: 80 }}>Last Xfer</th>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Xfers</th>
              <th style={{ ...th, width: 60 }}>Idle</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>
                {data.connected ? `No active ${market} agents` : 'Connecting…'}
              </td></tr>
            )}
            {agents.map(agent => {
              const es = effectiveStatus(agent);
              const cfg = STATUS_CFG[es];
              const webrtcOnly = !agent.inboundEnabled;
              const act = actMap.get(agent.id);
              const queue = qMap.get(agent.id);
              const score = scores[agent.email?.toLowerCase()];
              const name = displayName(agent);
              const callsToday = act?.callsToday ?? 0;
              const idleMs = act?.idleTimeToday ?? 0;
              const lastCall = act?.lastCallTime || agent.lastHangupTime;
              const missed = agent.missedTransfers ?? 0;
              const isSus = agent.suspended || agent.status === 'suspended';
              const _tMs = agent.taskAssignedTime ? Date.now() - new Date(agent.taskAssignedTime).getTime() : Infinity;
              const _hMs = agent.lastHangupTime ? Date.now() - new Date(agent.lastHangupTime).getTime() : Infinity;
              const _sMs = agent.statusSince ? Date.now() - new Date(agent.statusSince).getTime() : Infinity;
              const timeStr = webrtcOnly ? '—' : (agent.status === 'busy' && agent.taskAssignedTime && _tMs < 2*60*60*1000) ? durationSince(agent.taskAssignedTime) : (agent.lastHangupTime && _hMs < 12*60*60*1000) ? durationSince(agent.lastHangupTime) : (_sMs < 12*60*60*1000 ? durationSince(agent.statusSince!) : '—');
              const statusAgeMs = agent.twilioStatusSince ? Date.now() - new Date(agent.twilioStatusSince).getTime() : Infinity;
              const freshCall = agent.webrtcStatus === 'on_call' && statusAgeMs < 30 * 60 * 1000;
              const actText = agent.inboundEnabled
                ? freshCall ? { text: 'Live Call', color: 'var(--green)' }
                : agent.webrtcStatus === 'dialing' ? { text: 'Dialing', color: '#06b6d4' }
                : agent.webrtcStatus === 'ringing' ? { text: 'Ringing', color: '#06b6d4' }
                : agent.status === 'busy' && agent.callInfo ? { text: `${agent.callInfo.leadName || 'Unknown'}${agent.callInfo.leadState ? `, ${agent.callInfo.leadState}` : ''}`, color: 'var(--red)' }
                : agent.status === 'busy' ? { text: 'On transfer', color: 'var(--red)' }
                : agent.status === 'idle' ? { text: 'Waiting for transfers', color: 'var(--fg-dim)' }
                : agent.status === 'away' ? { text: 'Away', color: 'var(--amber)' }
                : { text: 'Offline', color: 'var(--fg-dim)' }
                : freshCall ? { text: 'Live Call', color: 'var(--green)' }
                : agent.webrtcStatus === 'dialing' ? { text: 'Dialing', color: '#06b6d4' }
                : agent.webrtcStatus === 'wrap' ? { text: 'Wrapping up', color: '#f97316' }
                : { text: 'Offline', color: 'var(--fg-dim)' };
              const rowBg = es === 'busy' ? 'var(--row-busy)' : es === 'idle' ? 'var(--row-idle)' : es === 'away' ? 'var(--row-away)' : 'transparent';

              return (
                <tr key={agent.id || agent.email} style={{ background: rowBg, opacity: isSus ? 0.5 : 1 }}>
                  <td style={{ ...cs, textAlign: 'center' }}>
                    {queue ? <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: queue.position === 1 ? 'rgba(234,179,8,0.2)' : queue.position <= 3 ? 'var(--primary-soft)' : 'var(--gray-soft)', color: queue.position === 1 ? '#eab308' : queue.position <= 3 ? 'var(--primary-fg)' : 'var(--fg-dim)' }}>#{queue.position}</span> : <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>—</span>}
                  </td>
                  <td style={cs}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 600 }}>{cfg.label}</span>
                    </div>
                  </td>
                  <td style={{ ...cs, fontWeight: 600, color: 'var(--fg)' }}>
                    {name}
                    {score && (() => { const tc = TIER_CFG[score.tier]; return <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: tc.bg, color: tc.fg, fontWeight: 700 }} title={`${score.tier} · Pick: ${(score.pickRate * 100).toFixed(0)}% · ${score.blasts} blasts`}>{tc.icon}</span>; })()}
                  </td>
                  <td style={{ ...cs, textAlign: 'center' }}>
                    <span style={{ color: agent.inboundEnabled ? 'var(--green)' : 'var(--red)', fontSize: 11, fontWeight: 700 }}>{agent.inboundEnabled ? 'ON' : 'OFF'}</span>
                  </td>
                  <td style={cs}>
                    {agent.outboundEnabled
                      ? <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: agent.webrtcStatus === 'on_call' ? 'rgba(16,185,129,0.15)' : agent.webrtcStatus === 'dialing' ? 'rgba(6,182,212,0.15)' : 'var(--gray-soft)', color: agent.webrtcStatus === 'on_call' ? 'var(--green)' : agent.webrtcStatus === 'dialing' ? '#06b6d4' : 'var(--fg-dim)' }}>{agent.webrtcStatus === 'on_call' ? 'Live Call' : agent.webrtcStatus === 'dialing' ? 'Dialing' : 'Idle'}</span>
                      : <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>—</span>}
                  </td>
                  <td style={{ ...cs, textAlign: 'center' }}>
                    <span style={{ color: missed > 0 ? 'var(--red)' : 'var(--fg-dim)', fontWeight: missed > 0 ? 800 : 400, fontSize: missed > 0 ? 13 : 11 }}>{missed > 0 ? missed : '—'}</span>
                  </td>
                  <td style={{ ...cs, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{timeStr}</span>
                  </td>
                  <td style={{ ...cs, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: actText.color, fontSize: 11 }}>{actText.text}</span>
                  </td>
                  <td style={cs}>
                    {webrtcOnly ? <span style={{ color: 'var(--fg-dim)' }}>—</span>
                      : <span style={{ color: lastCall && Date.now() - new Date(lastCall).getTime() > 3600000 ? 'var(--red)' : 'var(--fg-muted)', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{lastCall ? timeAgo(lastCall) : '—'}</span>}
                  </td>
                  <td style={{ ...cs, textAlign: 'center' }}>
                    {webrtcOnly ? <span style={{ color: 'var(--fg-dim)' }}>—</span>
                      : <span style={{ color: callsToday > 0 ? 'var(--fg)' : 'var(--fg-dim)', fontWeight: callsToday > 0 ? 700 : 400, fontSize: 12 }}>{callsToday}</span>}
                  </td>
                  <td style={cs}>
                    {webrtcOnly ? <span style={{ color: 'var(--fg-dim)' }}>—</span>
                      : <span style={{ color: idleMs > 3600000 ? 'var(--red)' : idleMs > 1800000 ? 'var(--amber)' : 'var(--fg-dim)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtIdle(idleMs)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
