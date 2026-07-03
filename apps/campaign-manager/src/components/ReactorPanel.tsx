import React, { useState, useEffect, useCallback } from 'react';

interface AgentScore {
  email: string;
  tier: 'elite' | 'active' | 'low' | 'ghost';
  score: number;
  pickRate: number;
  blasts: number;
  alpLast30: number;
  suggestedRank: number;
  wasOnlineLast24h: boolean;
}

interface DialPlan {
  campaignId: string;
  campaignName: string;
  state: string;
  currentRate: number;
  targetRate: number;
  agentsCovering: number;
  dialsPerTransfer: number;
  reason: string;
  shouldUpdate: boolean;
}

interface GhostRecord {
  email: string;
  ghostSince: string;
  smsSent: boolean;
  recovered: boolean;
}

interface ReactorState {
  lastRun: string | null;
  running: boolean;
  rankUpdates: number;
  rateUpdates: number;
  errors: string[];
  ghosts: GhostRecord[];
  dialPlans: DialPlan[];
  agentScores: Record<string, AgentScore>;
}

interface LeadFlowBucket {
  market: string;
  state: string;
  callable_leased: number;
  callable_plus: number;
  available?: number;
  leased?: number;
  remaining?: number;
  queued: number;
  active: number;
  dormant_queued: number;
  dials_60m: number;
  active_agents_60m: number;
  utilization_ratio: number;
  pressure_score: number;
  recommended_weight: number;
}

interface LeadFlowResponse {
  generatedAt: string;
  overall: {
    callable_leased: number;
    callable_plus: number;
    available?: number;
    leased?: number;
    remaining?: number;
    queued: number;
    active: number;
    dormant_queued: number;
    dials_60m: number;
    active_agents_60m: number;
  };
  byMarket: Array<{
    market: string;
    callable_leased: number;
    callable_plus: number;
    available?: number;
    leased?: number;
    remaining?: number;
    queued: number;
    active: number;
    dormant_queued: number;
    dials_60m: number;
  }>;
  byBucket: LeadFlowBucket[];
}

const TIER_CFG = {
  elite:  { label: 'Elite',  bg: 'rgba(234,179,8,0.18)',  fg: '#eab308', icon: '⭐' },
  active: { label: 'Active', bg: 'rgba(34,197,94,0.15)',  fg: '#22c55e', icon: '✅' },
  low:    { label: 'Low',    bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8', icon: '⬇️' },
  ghost:  { label: 'Ghost',  bg: 'rgba(139,92,246,0.18)', fg: '#a78bfa', icon: '👻' },
};

type DisplayTier = 'active' | 'low' | 'ghost';

function toDisplayTier(tier: AgentScore['tier']): DisplayTier {
  // Reactor UI no longer exposes an "Elite" badge; treat it as Active.
  if (tier === 'elite') return 'active';
  return tier;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function marketBucketLabel(market: string): 'Veteran' | 'Globe Market' | null {
  const m = String(market || '').toLowerCase();
  if (m.includes('veteran')) return 'Veteran';
  if (m.includes('globe')) return 'Globe Market';
  return null;
}

export function ReactorPanel() {
  const [state, setState] = useState<ReactorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'utilization' | 'overview' | 'agents' | 'ghosts' | 'flow' | 'pool'>('utilization');
  const [poolData, setPoolData] = useState<any>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<LeadFlowResponse | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const fetchState = () => {
    fetch('/api/reactor/state')
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          const message = String(body?.error || `Reactor request failed (${r.status})`);
          throw new Error(message);
        }
        return body;
      })
      .then(d => {
        setState(d);
        setLoadError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        setState(null);
        setLoadError(String(err?.message || 'Failed to load Reactor state'));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 15_000);
    return () => clearInterval(iv);
  }, []);

  const fetchPool = useCallback(() => {
    if (tab !== 'pool' && tab !== 'utilization') return;
    setPoolLoading(true);
    setPoolError(null);
    fetch('/api/reactor/pool-health')
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(String(body?.error || `Pool request failed (${r.status})`));
        return {
          overall: Array.isArray(body?.overall) ? body.overall : [],
          byMarket: Array.isArray(body?.byMarket) ? body.byMarket : [],
          lowBuckets: Array.isArray(body?.lowBuckets) ? body.lowBuckets : [],
          agentBuffers: Array.isArray(body?.agentBuffers) ? body.agentBuffers : [],
          checkedAt: body?.checkedAt ?? null,
        };
      })
      .then((d) => {
        setPoolData(d);
        setPoolLoading(false);
      })
      .catch((err: any) => {
        setPoolData(null);
        setPoolError(String(err?.message || 'Pool data unavailable'));
        setPoolLoading(false);
      });
  }, [tab]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  const fetchFlow = useCallback(() => {
    if (tab !== 'flow' && tab !== 'utilization') return;
    setFlowLoading(true);
    setFlowError(null);
    fetch('/api/reactor/lead-flow')
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(String(body?.error || `Flow request failed (${r.status})`));
        if (!body || typeof body !== 'object') throw new Error('Flow payload malformed');
        return {
          generatedAt: String(body.generatedAt || new Date().toISOString()),
          overall: {
            callable_leased: Number(body?.overall?.callable_leased || 0),
            callable_plus: Number(body?.overall?.callable_plus || 0),
            queued: Number(body?.overall?.queued || 0),
            active: Number(body?.overall?.active || 0),
            available: Number(body?.overall?.available ?? body?.overall?.callable_leased ?? 0),
            leased: Number(body?.overall?.leased ?? (Number(body?.overall?.queued || 0) + Number(body?.overall?.active || 0))),
            remaining: Number(body?.overall?.remaining ?? 0),
            dormant_queued: Number(body?.overall?.dormant_queued || 0),
            dials_60m: Number(body?.overall?.dials_60m || 0),
            active_agents_60m: Number(body?.overall?.active_agents_60m || 0),
          },
          byMarket: Array.isArray(body?.byMarket) ? body.byMarket : [],
          byBucket: Array.isArray(body?.byBucket) ? body.byBucket : [],
        } as LeadFlowResponse;
      })
      .then((d) => {
        setFlowData(d);
        setFlowLoading(false);
      })
      .catch((err: any) => {
        setFlowData(null);
        setFlowError(String(err?.message || 'Flow data unavailable'));
        setFlowLoading(false);
      });
  }, [tab]);

  useEffect(() => { fetchFlow(); }, [fetchFlow]);

  const runNow = async () => {
    setTriggering(true);
    await fetch('/api/reactor/run-now', { method: 'POST' }).catch(() => {});
    setTimeout(() => { fetchState(); setTriggering(false); }, 3000);
  };

  const cell: React.CSSProperties = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid var(--border)', color: 'var(--fg)', whiteSpace: 'nowrap' };
  const hcell: React.CSSProperties = { padding: '5px 10px', fontSize: 10, fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' };

  if (loading) return <div style={{ padding: 32, color: 'var(--fg-dim)', fontSize: 12 }}>Loading reactor...</div>;
  if (!state || !state.agentScores) {
    return (
      <div style={{ padding: 32, color: 'var(--fg-dim)', fontSize: 12 }}>
        Reactor unavailable{loadError ? `: ${loadError}` : ''}
      </div>
    );
  }

  const scores = Object.values(state.agentScores);
  const tierCounts: Record<DisplayTier, number> = { active: 0, low: 0, ghost: 0 };
  for (const s of scores) {
    const displayTier = toDisplayTier(s.tier);
    tierCounts[displayTier] = (tierCounts[displayTier] ?? 0) + 1;
  }

  const plansNeedUpdate = state.dialPlans.filter(p => p.shouldUpdate);
  const totalAgentsCovering = [...new Map(state.dialPlans.map(p => [p.state, p.agentsCovering])).values()].reduce((a, b) => a + b, 0);
  const globeBuckets = (flowData?.byBucket || [])
    .filter((row) => marketBucketLabel(row.market) === 'Globe Market')
    .sort((a, b) => {
      const pressureDiff = Number(b.pressure_score || 0) - Number(a.pressure_score || 0);
      if (pressureDiff !== 0) return pressureDiff;
      return Number(b.callable_leased || 0) - Number(a.callable_leased || 0);
    });
  const globeOverall = globeBuckets.reduce(
    (acc, row) => {
      acc.callable_leased += Number(row.callable_leased || 0);
      acc.callable_plus += Number(row.callable_plus || 0);
      acc.queued += Number(row.queued || 0);
      acc.active += Number(row.active || 0);
      acc.available += Number(row.available ?? row.callable_leased ?? 0);
      acc.leased += Number(row.leased ?? (Number(row.queued || 0) + Number(row.active || 0)));
      acc.remaining += Number(row.remaining || 0);
      acc.dormant_queued += Number(row.dormant_queued || 0);
      acc.dials_60m += Number(row.dials_60m || 0);
      return acc;
    },
    { callable_leased: 0, callable_plus: 0, queued: 0, active: 0, available: 0, leased: 0, remaining: 0, dormant_queued: 0, dials_60m: 0 },
  );

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚛️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Reactor Control</div>
            <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
              Last run: {timeAgo(state.lastRun)} · {state.rankUpdates} rank updates · {state.rateUpdates} rate updates
              {state.running && <span style={{ marginLeft: 6, color: '#22c55e' }}>● running</span>}
            </div>
          </div>
        </div>
        <button
          onClick={runNow}
          disabled={triggering || state.running}
          style={{
            padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
            background: triggering ? 'var(--gray-soft)' : 'rgba(99,102,241,0.2)',
            color: triggering ? 'var(--fg-dim)' : '#818cf8',
            cursor: triggering ? 'default' : 'pointer',
          }}
        >
          {triggering ? 'Running…' : 'Run Now'}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {(Object.entries(tierCounts) as [DisplayTier, number][]).map(([tier, count]) => {
          const cfg = TIER_CFG[tier];
          return (
            <div key={tier} style={{ padding: '10px 14px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.fg}30` }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{cfg.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: cfg.fg }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: cfg.fg, opacity: 0.8 }}>{cfg.label} agents</div>
            </div>
          );
        })}
      </div>

      {/* Errors */}
      {state.errors.length > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', fontSize: 11, color: '#dc2626' }}>
          {state.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['utilization', 'overview', 'agents', 'ghosts', 'flow', 'pool'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none',
            background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent',
            color: tab === t ? 'var(--fg)' : 'var(--fg-muted)',
            cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {t}{t === 'ghosts' && state.ghosts.length > 0 ? ` (${state.ghosts.length})` : ''}
          </button>
        ))}
      </div>

      {/* Tab: Utilization (single-page view) */}
      {tab === 'utilization' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>
              Globe Market Utilization
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={fetchFlow} style={{ padding: '4px 10px', fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--fg)', cursor: 'pointer' }}>
                Refresh Flow
              </button>
              <button onClick={fetchPool} style={{ padding: '4px 10px', fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--fg)', cursor: 'pointer' }}>
                Refresh Pool
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#06b6d4' }}>{Number(globeOverall.callable_leased || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--fg)' }}>Callable (Globe)</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#7c3aed' }}>{Number(globeOverall.queued || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--fg)' }}>Assigned (Globe)</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#ca8a04' }}>
                {Number(globeOverall.remaining || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg)' }}>Available (Globe)</div>
            </div>
          </div>

          {(flowLoading || poolLoading) && (
            <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--fg)' }}>
              Loading utilization data...
            </div>
          )}

          {!flowLoading && flowData && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-raised)' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>
                Globe Market ({globeBuckets.length} buckets)
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['State', 'Callable', 'Assigned', 'Available', 'Util', 'Pressure', 'Weight'].map(h => (
                        <th key={h} style={{ ...hcell, position: 'sticky', top: 0, background: 'var(--bg-raised)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globeBuckets.map((row) => (
                      <tr key={`globe-${row.state}`}>
                        <td style={{ ...cell, fontWeight: 700 }}>{row.state}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>{Number(row.callable_leased || 0).toLocaleString()}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>{Number(row.queued || 0).toLocaleString()}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>{Number(row.remaining || 0).toLocaleString()}</td>
                        <td style={{ ...cell, textAlign: 'center', color: row.utilization_ratio >= 0.5 ? '#16a34a' : row.utilization_ratio >= 0.2 ? '#ca8a04' : '#dc2626', fontWeight: 700 }}>
                          {pct(Number(row.utilization_ratio || 0))}
                        </td>
                        <td style={{ ...cell, textAlign: 'center', color: row.pressure_score > 0 ? '#dc2626' : 'var(--fg)' }}>{Number(row.pressure_score || 0).toFixed(1)}</td>
                        <td style={{ ...cell, textAlign: 'center', color: '#4338ca', fontWeight: 700 }}>{Number(row.recommended_weight || 0).toFixed(1)}</td>
                      </tr>
                    ))}
                    {globeBuckets.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ ...cell, textAlign: 'center', color: 'var(--fg-muted)' }}>
                          No globe buckets returned by flow endpoint.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!flowLoading && !flowData && (
            <div style={{ padding: 12, borderRadius: 8, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.10)', color: '#b45309', fontSize: 11 }}>
              Flow data unavailable{flowError ? `: ${flowError}` : ''}
            </div>
          )}

          {!poolLoading && poolData && Array.isArray(poolData.lowBuckets) && poolData.lowBuckets.length > 0 && (
            <div style={{ padding: 12, borderRadius: 8, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>Low Pool Buckets (&lt; 50 ready)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {poolData.lowBuckets.slice(0, 20).map((b: any) => (
                  <span key={`${b.market}-${b.state}`} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.18)', color: '#92400e' }}>
                    {b.market} {b.state}: {b.ready}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Overview — dial plans */}
      {tab === 'overview' && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--fg-dim)' }}>
            AO Recruit distribution plan across licensed state buckets · {plansNeedUpdate.length} bucket{plansNeedUpdate.length !== 1 ? 's' : ''} pending adjustment
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Source', 'State', 'Agents', 'Dials/Transfer', 'Current', 'Target', 'Status', 'Reason'].map(h => (
                  <th key={h} style={hcell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.dialPlans.length === 0 && (
                <tr><td colSpan={8} style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>No recruit distribution buckets loaded yet</td></tr>
              )}
              {state.dialPlans.map(p => {
                const delta = p.targetRate - p.currentRate;
                const deltaColor = delta > 20 ? '#22c55e' : delta < -20 ? '#f87171' : 'var(--fg-dim)';
                return (
                  <tr key={p.campaignId}>
                    <td style={{ ...cell, fontWeight: 600 }}>{p.campaignName.slice(0, 30)}</td>
                    <td style={{ ...cell, fontWeight: 700, color: 'var(--primary-fg)' }}>{p.state || '—'}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{p.agentsCovering}</td>
                    <td style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>{p.dialsPerTransfer || '—'}</td>
                    <td style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>{p.currentRate}</td>
                    <td style={{ ...cell, textAlign: 'center', fontWeight: 700, color: deltaColor }}>{p.targetRate}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      {p.shouldUpdate
                        ? <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#eab308', fontSize: 10 }}>Update</span>
                        : <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 10 }}>OK</span>
                      }
                    </td>
                    <td style={{ ...cell, color: 'var(--fg-dim)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Agents */}
      {tab === 'agents' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Agent', 'Tier', 'Score', 'Pick Rate', 'Blasts', 'ALP (30d)', 'Suggested Rank'].map(h => (
                  <th key={h} style={hcell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scores.sort((a, b) => b.score - a.score).map(s => {
                const tcfg = TIER_CFG[toDisplayTier(s.tier)];
                return (
                  <tr key={s.email}>
                    <td style={{ ...cell, fontWeight: 600 }}>{s.email.split('@')[0]}</td>
                    <td style={cell}>
                      <span style={{ padding: '2px 7px', borderRadius: 4, background: tcfg.bg, color: tcfg.fg, fontSize: 10, fontWeight: 700 }}>
                        {tcfg.icon} {tcfg.label}
                      </span>
                    </td>
                    <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{s.score}</td>
                    <td style={{ ...cell, textAlign: 'center', color: s.pickRate >= 0.5 ? '#22c55e' : s.pickRate >= 0.2 ? '#eab308' : '#f87171' }}>
                      {pct(s.pickRate)}
                    </td>
                    <td style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>{s.blasts}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{s.alpLast30 > 0 ? s.alpLast30 : '—'}</td>
                    <td style={{ ...cell, textAlign: 'center', fontWeight: 700, color: s.suggestedRank >= 99 ? '#eab308' : s.suggestedRank >= 80 ? '#22c55e' : s.suggestedRank >= 50 ? '#94a3b8' : '#f87171' }}>
                      {s.suggestedRank}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Flow */}
      {tab === 'flow' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
              Market/state lead flow + utilization from data service source tables
            </div>
            <button onClick={fetchFlow} style={{ padding: '3px 10px', fontSize: 10, borderRadius: 4, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
          {flowLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 11 }}>Loading flow data...</div>}
          {!flowLoading && flowData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
                Updated: {timeAgo(flowData.generatedAt)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Callable', value: flowData.overall.callable_leased, color: '#06b6d4' },
                  { label: 'Callable Plus', value: flowData.overall.callable_plus, color: '#06b6d4' },
                  { label: 'Assigned / Available', value: `${flowData.overall.queued}/${flowData.overall.remaining ?? 0}`, color: '#818cf8' },
                ].map((card) => (
                  <div key={card.label} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-raised)', border: `1px solid ${card.color}40` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>
                      {typeof card.value === 'number' ? Number(card.value).toLocaleString() : card.value}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-dim)' }}>{card.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Market', 'State', 'Callable', 'Assigned', 'Available', 'Util', 'Pressure', 'Weight'].map(h => (
                        <th key={h} style={{ ...hcell, position: 'sticky', top: 0, background: 'var(--bg)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(flowData.byBucket || []).map((row) => (
                      <tr key={`${row.market}-${row.state}`}>
                        <td style={cell}>{row.market}</td>
                        <td style={{ ...cell, fontWeight: 700, color: 'var(--primary-fg)' }}>{row.state}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>{Number(row.callable_leased || 0).toLocaleString()}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>{Number(row.queued || 0).toLocaleString()}</td>
                        <td style={{ ...cell, textAlign: 'center' }}>{Number(row.remaining || 0).toLocaleString()}</td>
                        <td style={{ ...cell, textAlign: 'center', color: row.utilization_ratio >= 0.5 ? '#22c55e' : row.utilization_ratio >= 0.2 ? '#eab308' : '#f87171' }}>
                          {pct(Number(row.utilization_ratio || 0))}
                        </td>
                        <td style={{ ...cell, textAlign: 'center', color: row.pressure_score > 0 ? '#f87171' : 'var(--fg-dim)' }}>
                          {Number(row.pressure_score || 0).toFixed(1)}
                        </td>
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 700, color: row.recommended_weight > 0 ? '#818cf8' : 'var(--fg-dim)' }}>
                          {Number(row.recommended_weight || 0).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!flowLoading && !flowData && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 11 }}>
              Flow data unavailable{flowError ? `: ${flowError}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Tab: Pool */}
      {tab === 'pool' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
              Lead pool health by market &amp; state — updated on tab open
            </div>
            <button onClick={fetchPool} style={{ padding: '3px 10px', fontSize: 10, borderRadius: 4, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
          {poolLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 11 }}>Loading pool data...</div>}
          {!poolLoading && poolData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Overall summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(poolData.overall || []).map((row: any) => {
                  const cfg: Record<string, { bg: string; fg: string }> = {
                    ready:   { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e' },
                    claimed: { bg: 'rgba(234,179,8,0.15)',   fg: '#eab308' },
                    expired: { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8' },
                  };
                  const c = cfg[row.status] || { bg: 'var(--gray-soft)', fg: 'var(--fg)' };
                  return (
                    <div key={row.status} style={{ padding: '10px 14px', borderRadius: 8, background: c.bg, border: `1px solid ${c.fg}30` }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c.fg }}>{row.count.toLocaleString()}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: c.fg, opacity: 0.8, textTransform: 'capitalize' }}>{row.status}</div>
                    </div>
                  );
                })}
              </div>

              {/* Low buckets warning */}
              {(poolData.lowBuckets || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#eab308', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ⚠ Buckets below 50 ready leads
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          {['Market', 'State', 'Ready'].map(h => <th key={h} style={hcell}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {(poolData.lowBuckets || []).map((b: any) => (
                          <tr key={`${b.market}-${b.state}`}>
                            <td style={cell}>{b.market}</td>
                            <td style={{ ...cell, fontWeight: 700, color: 'var(--primary-fg)' }}>{b.state}</td>
                            <td style={{ ...cell, textAlign: 'center', color: b.ready < 10 ? '#f87171' : '#eab308', fontWeight: 700 }}>{b.ready}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* By market breakdown */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Pool by market / state
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {['Market', 'State', 'Ready', 'Claimed'].map(h => <th key={h} style={{ ...hcell, position: 'sticky', top: 0, background: 'var(--bg)' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(poolData.byMarket || []).map((b: any) => (
                        <tr key={`${b.market}-${b.state}`}>
                          <td style={cell}>{b.market}</td>
                          <td style={{ ...cell, fontWeight: 700, color: 'var(--primary-fg)' }}>{b.state}</td>
                          <td style={{ ...cell, textAlign: 'center', color: b.ready < 50 ? '#eab308' : '#22c55e', fontWeight: 600 }}>{b.ready}</td>
                          <td style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>{b.claimed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agent buffer sizes */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Agent buffers (top 50)
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {['Agent', 'Queued', 'Active'].map(h => <th key={h} style={{ ...hcell, position: 'sticky', top: 0, background: 'var(--bg)' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(poolData.agentBuffers || []).map((a: any) => (
                        <tr key={a.agent_email}>
                          <td style={{ ...cell, fontWeight: 600 }}>{a.agent_email.split('@')[0]}</td>
                          <td style={{ ...cell, textAlign: 'center', color: a.queued < 25 ? '#eab308' : '#22c55e', fontWeight: 700 }}>{a.queued}</td>
                          <td style={{ ...cell, textAlign: 'center', color: a.active > 0 ? 'var(--primary-fg)' : 'var(--fg-dim)' }}>{a.active}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {!poolLoading && !poolData && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 11 }}>
              Pool data unavailable{poolError ? `: ${poolError}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Tab: Ghosts */}
      {tab === 'ghosts' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>{['Agent', 'Ghost Since', 'SMS Sent', 'Status'].map(h => <th key={h} style={hcell}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {state.ghosts.length === 0 && (
                <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>No ghost agents 🎉</td></tr>
              )}
              {state.ghosts.map(g => (
                <tr key={g.email}>
                  <td style={{ ...cell, fontWeight: 600 }}>👻 {g.email.split('@')[0]}</td>
                  <td style={{ ...cell, color: 'var(--fg-dim)' }}>{timeAgo(g.ghostSince)}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{g.smsSent ? '✅' : '—'}</td>
                  <td style={cell}>
                    {g.recovered
                      ? <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 10 }}>Recovered</span>
                      : <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10 }}>Active Ghost</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
