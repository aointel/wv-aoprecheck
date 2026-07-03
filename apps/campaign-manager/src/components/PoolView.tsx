import { useState, useEffect, useCallback } from 'react';

interface PoolRow { market: string; state: string; ready: number; claimed: number; }
interface LowBucket { queue: string; market: string; state: string; ready: number; }
interface AgentBuffer { agent_email: string; queued: number; active: number; }
interface Overall { status: string; count: number; }

interface PoolData {
  ok: boolean;
  checkedAt: string;
  overall: Overall[];
  byMarket: PoolRow[];
  lowBuckets: LowBucket[];
  agentBuffers: AgentBuffer[];
  error?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function PoolView() {
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketFilter, setMarketFilter] = useState('');
  const [tab, setTab] = useState<'market' | 'agents' | 'low'>('market');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/reactor/pool-health')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const cell: React.CSSProperties = { padding: '5px 10px', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const hcell: React.CSSProperties = { padding: '4px 10px', fontSize: 10, fontWeight: 600, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--fg-dim)', fontSize: 12 }}>
      Loading pool data...
    </div>
  );

  if (!data || !data.ok) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#f87171', fontSize: 12 }}>
      {data?.error || 'Pool data unavailable — data service may be down'}
    </div>
  );

  const readyTotal = data.overall.find(r => r.status === 'ready')?.count ?? 0;
  const claimedTotal = data.overall.find(r => r.status === 'claimed')?.count ?? 0;
  const expiredTotal = data.overall.find(r => r.status === 'expired')?.count ?? 0;

  const markets = [...new Set(data.byMarket.map(r => r.market))].sort();
  const filtered = marketFilter
    ? data.byMarket.filter(r => r.market === marketFilter)
    : data.byMarket;

  const agentsBelow25 = data.agentBuffers.filter(a => a.queued < 25).length;
  const agentsEmpty = data.agentBuffers.filter(a => a.queued === 0 && a.active === 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>🔥 Lead Pool Health</div>
          <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 2 }}>
            Updated {timeAgo(data.checkedAt)} · Shows leasedialer eligible pool by market/state/agent
          </div>
        </div>
        <button onClick={load} style={{ padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{readyTotal.toLocaleString()}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', opacity: 0.8 }}>Ready to Assign</div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308' }}>{claimedTotal.toLocaleString()}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#eab308', opacity: 0.8 }}>Claimed in Buffers</div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.2)' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#94a3b8' }}>{expiredTotal.toLocaleString()}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', opacity: 0.8 }}>Expired / Cleaned</div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: agentsBelow25 > 10 ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.1)', border: `1px solid ${agentsBelow25 > 10 ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.2)'}` }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: agentsBelow25 > 10 ? '#eab308' : '#22c55e' }}>{agentsBelow25}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: agentsBelow25 > 10 ? '#eab308' : '#22c55e', opacity: 0.8 }}>Agents Below 25 Leads</div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: agentsEmpty > 5 ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${agentsEmpty > 5 ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.2)'}` }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: agentsEmpty > 5 ? '#f87171' : '#94a3b8' }}>{agentsEmpty}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: agentsEmpty > 5 ? '#f87171' : '#94a3b8', opacity: 0.8 }}>Agents With No Leads</div>
        </div>
      </div>

      {/* Low bucket alert */}
      {data.lowBuckets.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#eab308', marginBottom: 6 }}>
            ⚠ {data.lowBuckets.length} bucket{data.lowBuckets.length !== 1 ? 's' : ''} below 50 ready leads
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.lowBuckets.map(b => (
              <span key={`${b.market}-${b.state}`} style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: b.ready < 10 ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                color: b.ready < 10 ? '#f87171' : '#eab308',
              }}>
                {b.market}/{b.state}: {b.ready}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
        {([
          { key: 'market', label: 'By Market / State' },
          { key: 'agents', label: `Agent Buffers (${data.agentBuffers.length})` },
          { key: 'low', label: `⚠ Low Buckets (${data.lowBuckets.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none',
            background: tab === t.key ? 'var(--primary-soft)' : 'transparent',
            color: tab === t.key ? 'var(--primary-fg)' : 'var(--fg-dim)',
            cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab: Market/State */}
      {tab === 'market' && (
        <div>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Filter:</span>
            <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--fg)' }}>
              <option value="">All markets</option>
              {markets.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {marketFilter && <button onClick={() => setMarketFilter('')} style={{ fontSize: 10, color: 'var(--fg-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ clear</button>}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>
                <tr>
                  {['Market', 'State', 'Ready', 'Claimed', 'Total'].map(h => <th key={h} style={hcell}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const total = r.ready + r.claimed;
                  const readyPct = total > 0 ? r.ready / total : 0;
                  return (
                    <tr key={`${r.market}-${r.state}`}>
                      <td style={cell}>{r.market}</td>
                      <td style={{ ...cell, fontWeight: 700, color: 'var(--primary-fg)' }}>{r.state}</td>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: 700, color: r.ready < 10 ? '#f87171' : r.ready < 50 ? '#eab308' : '#22c55e' }}>
                        {r.ready}
                      </td>
                      <td style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>{r.claimed}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${readyPct * 100}%`, height: '100%', background: r.ready < 50 ? '#eab308' : '#22c55e', borderRadius: 2 }} />
                          </div>
                          <span style={{ color: 'var(--fg-dim)' }}>{total}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Agent Buffers */}
      {tab === 'agents' && (
        <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>
              <tr>
                {['Agent', 'Queued', 'Active', 'Status'].map(h => <th key={h} style={hcell}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.agentBuffers.map(a => {
                const total = a.queued + a.active;
                const statusColor = total === 0 ? '#94a3b8' : a.queued < 40 ? '#f87171' : a.queued < 80 ? '#eab308' : '#22c55e';
                const statusLabel = total === 0 ? 'No leads' : a.queued < 40 ? 'Low' : a.queued < 80 ? 'Refilling' : 'Healthy';
                return (
                  <tr key={a.agent_email}>
                    <td style={{ ...cell, fontWeight: 600 }}>{a.agent_email.split('@')[0]}</td>
                    <td style={{ ...cell, textAlign: 'center', fontWeight: 700, color: statusColor }}>
                      {a.queued}/100
                    </td>
                    <td style={{ ...cell, textAlign: 'center', color: a.active > 0 ? 'var(--primary-fg)' : 'var(--fg-dim)' }}>
                      {a.active > 0 ? '📞 On call' : '—'}
                    </td>
                    <td style={cell}>
                      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: `${statusColor}20`, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {data.agentBuffers.length === 0 && (
                <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: 'var(--fg-dim)' }}>No active agent buffers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Low Buckets */}
      {tab === 'low' && (
        <div style={{ overflowX: 'auto' }}>
          {data.lowBuckets.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#22c55e', fontSize: 12 }}>
              ✅ All buckets have 50+ ready leads
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>{['Market', 'State', 'Ready', 'Urgency'].map(h => <th key={h} style={hcell}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.lowBuckets.sort((a, b) => a.ready - b.ready).map(b => (
                  <tr key={`${b.market}-${b.state}`}>
                    <td style={cell}>{b.market}</td>
                    <td style={{ ...cell, fontWeight: 700, color: 'var(--primary-fg)' }}>{b.state}</td>
                    <td style={{ ...cell, textAlign: 'center', fontWeight: 800, color: b.ready < 10 ? '#f87171' : '#eab308' }}>{b.ready}</td>
                    <td style={cell}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: b.ready < 10 ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                        color: b.ready < 10 ? '#f87171' : '#eab308',
                      }}>
                        {b.ready < 10 ? '🔴 Critical' : '🟡 Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
