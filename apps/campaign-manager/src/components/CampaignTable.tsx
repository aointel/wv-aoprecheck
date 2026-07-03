import { useState, useMemo } from 'react';
import type { NormalizedCampaign } from '../../shared/types';
import { api } from '../hooks/useApi';

interface Props {
  campaigns: NormalizedCampaign[];
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  running:   { bg: 'var(--green-soft)', fg: 'var(--green)' },
  stopped:   { bg: 'var(--red-soft)',   fg: 'var(--red)' },
  completed: { bg: 'var(--gray-soft)',  fg: 'var(--fg-dim)' },
  unknown:   { bg: 'var(--gray-soft)',  fg: 'var(--fg-dim)' },
};

export function CampaignTable({ campaigns }: Props) {
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkLoading, setBulkLoading] = useState(false);

  const markets = useMemo(() => [...new Set(campaigns.map(c => c.normalizedMarket))].sort(), [campaigns]);

  const filtered = useMemo(() => {
    let r = campaigns;
    if (marketFilter !== 'all') r = r.filter(c => c.normalizedMarket === marketFilter);
    if (statusFilter !== 'all') r = r.filter(c => c.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(c => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q));
    }
    return r.sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1;
      if (b.status === 'running' && a.status !== 'running') return 1;
      return b.contactCount - a.contactCount;
    });
  }, [campaigns, marketFilter, statusFilter, search]);

  const handleBulkPause = async () => { setBulkLoading(true); try { await api.bulkPause(); } catch {} setBulkLoading(false); };
  const handleBulkResume = async () => { setBulkLoading(true); try { await api.bulkResume(); } catch {} setBulkLoading(false); };

  const cellStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid var(--row-border)',
  };
  const thStyle: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 10,
    padding: '7px 10px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', textAlign: 'left',
    color: 'var(--fg-dim)', background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border-bright)',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2"
        style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-muted)' }}>
          Campaigns
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--fg-dim)' }}>
          {filtered.length} of {campaigns.length}
        </span>

        <div className="flex-1" />

        <input
          type="text" placeholder="Search campaigns…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="input" style={{ width: 180, fontSize: 11, padding: '4px 8px' }}
        />

        <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)} className="select">
          <option value="all">All Markets</option>
          {markets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select">
          <option value="all">All Status</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="completed">Completed</option>
        </select>

        <div className="flex gap-1.5">
          <button onClick={handleBulkPause} disabled={bulkLoading}
            className="action-btn" style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {bulkLoading ? '…' : '⏸ Pause All'}
          </button>
          <button onClick={handleBulkResume} disabled={bulkLoading}
            className="action-btn" style={{ background: 'var(--green-soft)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }}>
            {bulkLoading ? '…' : '▶ Resume All'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Campaign</th>
              <th style={thStyle}>Market</th>
              <th style={thStyle}>State</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dial Rate</th>
              <th style={thStyle}>Rate Reason</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Leads</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Calls Made</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Answered</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 140 }}>Controls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <CampaignRow key={c._id} campaign={c} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 48, color: 'var(--fg-dim)' }}>
                  {campaigns.length === 0 ? 'Loading campaigns…' : 'No campaigns match filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignRow({ campaign: c }: { campaign: NormalizedCampaign }) {
  const [rateInput, setRateInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sc = STATUS_STYLE[c.status] ?? STATUS_STYLE.unknown;

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (c.status === 'running') await api.pauseCampaign(c._id);
      else await api.resumeCampaign(c._id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSetRate = async () => {
    const rate = parseInt(rateInput, 10);
    if (isNaN(rate) || rate < 0) return;
    setLoading(true);
    try { await api.setCampaignRate(c._id, rate); setRateInput(''); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const cellStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid var(--row-border)',
  };

  return (
    <tr
      style={{ transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--fg)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {c.name}
        {c.isPerAgent && c.agentName && (
          <span style={{ color: 'var(--fg-dim)', fontSize: 10, marginLeft: 6 }}>({c.agentName})</span>
        )}
      </td>
      <td style={{ ...cellStyle, color: 'var(--primary-fg)' }}>{c.taalkMarket || c.normalizedMarket}</td>
      <td style={{ ...cellStyle, color: 'var(--fg-muted)' }}>{c.state !== 'ALL' ? c.state : '—'}</td>
      <td style={cellStyle}>
        <span className="badge" style={{ background: sc.bg, color: sc.fg }}>{c.status.toUpperCase()}</span>
      </td>
      <td style={{ ...cellStyle, textAlign: 'right', color: c.limitPerHour === 0 ? 'var(--red)' : 'var(--cyan)' }} className="tabular-nums">
        {c.limitPerHour}/hr
      </td>
      <td style={{ ...cellStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {c.rateReason ? (
          <span className="text-[10px]" style={{
            color: c.rateReason.includes('paused') || c.rateReason.includes('0 agents')
              ? 'var(--red)'
              : c.rateReason.includes('Manual') ? 'var(--amber)' : 'var(--fg-dim)',
          }} title={c.rateReason}>
            {c.rateReason}
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>—</span>
        )}
      </td>
      <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--fg-muted)' }} className="tabular-nums">
        {c.contactCount.toLocaleString()}
      </td>
      <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--fg-muted)' }} className="tabular-nums">
        {c.callsMade.toLocaleString()}
      </td>
      <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--fg-muted)' }} className="tabular-nums">
        {c.callsAnswered.toLocaleString()} ({c.answerRate}%)
      </td>
      <td style={{ ...cellStyle, textAlign: 'right' }}>
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={handleToggle}
            disabled={loading}
            className="action-btn"
            style={{
              background: c.status === 'running' ? 'var(--red-soft)' : 'var(--green-soft)',
              color: c.status === 'running' ? 'var(--red)' : 'var(--green)',
              border: `1px solid ${c.status === 'running' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}
          >
            {loading ? '…' : c.status === 'running' ? 'Pause' : 'Resume'}
          </button>
          <input
            type="number" placeholder="Rate" min={0}
            value={rateInput} onChange={e => setRateInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSetRate()}
            className="input tabular-nums"
            style={{ width: 50, padding: '2px 4px', fontSize: 10, textAlign: 'right' }}
          />
        </div>
      </td>
    </tr>
  );
}
