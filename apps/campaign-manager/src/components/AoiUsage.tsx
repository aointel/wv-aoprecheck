import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AgentUsageRow {
  email: string;
  connect_dials: number;
  connect_answered: number;
  connect_booked: number;
  connect_credits_used: number;
  connect_veteran_dials: number;
  connect_globe_dials: number;
  recruit_touches: number;
  recruit_credits_used: number;
  ccpro_credits_used: number;
  ccpro_enabled: boolean;
  inbound_calls: number;
  alp_submitted: number;
  last_seen: string | null;
  connect_conversion_rate: number;
  credits_total_used: number;
  roi_score: number;
}

interface TeamUsageSummary {
  total_connect_dials: number;
  total_connect_booked: number;
  team_connect_conversion: number;
  total_recruit_touches: number;
  total_inbound_calls: number;
  total_alp_submitted: number;
  total_credits_used: number;
  veteran_dials: number;
  globe_dials: number;
  active_agents_today: number;
}

interface CoachingNote {
  id: string;
  note: string;
  manager: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function agentName(email: string) {
  if (!email || !email.includes('@')) return email || '—';
  const parts = email.split('@')[0].split(/[._]/);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null) {
  if (!d) return 'Never';
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 16px',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--fg-dim)',
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ ...CARD, flex: '1 1 100px', minWidth: 90 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--fg)', marginTop: 4, lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Product Adoption Bar ───────────────────────────────────────────────────────
function AdoptionList({ rows }: { rows: AgentUsageRow[] }) {
  const connectUsers = rows.filter(r => r.connect_dials > 0).length;
  const recruitUsers = rows.filter(r => r.recruit_touches > 0).length;
  const ccproUsers = rows.filter(r => r.ccpro_enabled).length;
  const inboundUsers = rows.filter(r => r.inbound_calls > 0).length;
  const total = rows.length || 1;

  const items = [
    { label: '📡 AOI Recruit', count: connectUsers, color: 'var(--primary-fg)' },
    { label: '🔍 AO Recruit', count: recruitUsers, color: 'var(--amber)' },
    { label: '📞 CC Pro', count: ccproUsers, color: 'var(--green)' },
    { label: '📲 AOI Inbound', count: inboundUsers, color: '#ec4899' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(({ label, count, color }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
            <span style={{ color: 'var(--fg)' }}>{label}</span>
            <span style={{ color: 'var(--fg-dim)', fontWeight: 600 }}>{count} agents</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-raised)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${(count / total) * 100}%`,
              background: color,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Market Split ───────────────────────────────────────────────────────────────
function MarketSplit({ summary }: { summary: TeamUsageSummary }) {
  const total = summary.veteran_dials + summary.globe_dials || 1;
  const vetPct = Math.round((summary.veteran_dials / total) * 100);
  const globePct = 100 - vetPct;

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-fg)' }}>
            {summary.veteran_dials.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>🪖 Veteran Market</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--amber)' }}>
            {summary.globe_dials.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>🌐 Globe Market</div>
        </div>
      </div>
      {/* Ratio bar */}
      <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${vetPct}%`, background: 'var(--primary-fg)' }} />
        <div style={{ width: `${globePct}%`, background: 'var(--amber)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--fg-dim)' }}>
        <span>{vetPct}% Veteran</span>
        <span>{globePct}% Globe</span>
      </div>
    </div>
  );
}

// ── Overview Sub-tab ───────────────────────────────────────────────────────────
function OverviewTab({ summary, rows }: { summary: TeamUsageSummary; rows: AgentUsageRow[] }) {
  return (
    <div style={{ overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stat cards row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatCard label="Connect Dials" value={summary.total_connect_dials} />
        <StatCard label="Booked" value={summary.total_connect_booked} color="var(--green)" />
        <StatCard
          label="Conv%"
          value={`${summary.team_connect_conversion}%`}
          color={summary.team_connect_conversion >= 10 ? 'var(--green)' : summary.team_connect_conversion >= 5 ? 'var(--amber)' : 'var(--red)'}
        />
        <StatCard label="Total ALP" value={fmtMoney(summary.total_alp_submitted)} color="var(--green)" />
        <StatCard label="Credits Burned" value={summary.total_credits_used.toLocaleString()} color="var(--amber)" />
        <StatCard label="Active Today" value={summary.active_agents_today} sub="last 24h heartbeat" />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 12 }}>📍 Market Split</div>
          <MarketSplit summary={summary} />
        </div>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 12 }}>🧩 Product Adoption</div>
          <AdoptionList rows={rows} />
        </div>
      </div>

      {/* Additional summary cards */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatCard label="Recruit Touches" value={summary.total_recruit_touches} sub={`last ${30}d`} />
        <StatCard label="Inbound Calls" value={summary.total_inbound_calls} sub="all time" />
        <StatCard
          label="Team ROI"
          value={summary.total_credits_used > 0 ? `${fmtMoney(Math.round(summary.total_alp_submitted / summary.total_credits_used))}/credit` : 'N/A'}
          color="var(--primary-fg)"
        />
      </div>
    </div>
  );
}

// ── Agent Detail Panel ─────────────────────────────────────────────────────────
function AgentDetailPanel({ agent, onClose }: { agent: AgentUsageRow; onClose: () => void }) {
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    setLoadingNotes(true);
    fetch(`/api/call-intelligence/coaching/${encodeURIComponent(agent.email)}`)
      .then(r => r.json())
      .then(d => setNotes(Array.isArray(d) ? d : []))
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  }, [agent.email]);

  const maxCredits = Math.max(
    agent.connect_credits_used,
    agent.recruit_credits_used,
    agent.ccpro_credits_used,
    1,
  );

  const products = [
    { label: 'AOI Recruit', credits: agent.connect_credits_used, color: 'var(--primary-fg)' },
    { label: 'AO Recruit', credits: agent.recruit_credits_used, color: 'var(--amber)' },
    { label: 'CC Pro', credits: agent.ccpro_credits_used, color: 'var(--green)' },
  ];

  return (
    <div style={{
      width: 360, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{agentName(agent.email)}</div>
          <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginTop: 1 }}>
            {agent.email} · Last seen: {fmtDate(agent.last_seen)}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 4, color: 'var(--fg-dim)', cursor: 'pointer', padding: '3px 8px', fontSize: 11,
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Product credits bars */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 10 }}>Credits by Product</div>
          <svg width="100%" height={products.length * 28} style={{ overflow: 'visible', display: 'block' }}>
            {products.map((p, i) => {
              const barW = Math.max((p.credits / maxCredits) * 260, p.credits > 0 ? 4 : 0);
              return (
                <g key={p.label} transform={`translate(0,${i * 28})`}>
                  <text x={0} y={10} fontSize={9} fill="var(--fg-dim)">{p.label}</text>
                  <rect x={0} y={13} width={barW} height={10} rx={3} fill={p.color} opacity={0.8} />
                  <text x={barW + 4} y={22} fontSize={9} fill="var(--fg)">{p.credits.toLocaleString()}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Connect market breakdown */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 10 }}>AOI Recruit dials</div>
          {(() => {
            const maxD = Math.max(agent.connect_veteran_dials, agent.connect_globe_dials, 1);
            return (
              <svg width="100%" height={56} style={{ display: 'block' }}>
                <g>
                  <text x={0} y={10} fontSize={9} fill="var(--fg-dim)">🪖 Veteran</text>
                  <rect x={0} y={13} width={Math.max((agent.connect_veteran_dials / maxD) * 260, agent.connect_veteran_dials > 0 ? 4 : 0)} height={10} rx={3} fill="var(--primary-fg)" opacity={0.8} />
                  <text x={Math.max((agent.connect_veteran_dials / maxD) * 260, agent.connect_veteran_dials > 0 ? 4 : 0) + 4} y={22} fontSize={9} fill="var(--fg)">{agent.connect_veteran_dials}</text>
                </g>
                <g transform="translate(0,28)">
                  <text x={0} y={10} fontSize={9} fill="var(--fg-dim)">🌐 Globe</text>
                  <rect x={0} y={13} width={Math.max((agent.connect_globe_dials / maxD) * 260, agent.connect_globe_dials > 0 ? 4 : 0)} height={10} rx={3} fill="var(--amber)" opacity={0.8} />
                  <text x={Math.max((agent.connect_globe_dials / maxD) * 260, agent.connect_globe_dials > 0 ? 4 : 0) + 4} y={22} fontSize={9} fill="var(--fg)">{agent.connect_globe_dials}</text>
                </g>
              </svg>
            );
          })()}
        </div>

        {/* ALP + stats */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>Revenue & Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'ALP Submitted', value: fmtMoney(agent.alp_submitted), color: agent.alp_submitted > 0 ? 'var(--green)' : 'var(--fg-dim)' },
              { label: 'Total Credits', value: agent.credits_total_used.toLocaleString(), color: 'var(--fg)' },
              { label: 'ROI', value: agent.credits_total_used > 0 ? `${fmtMoney(Math.round(agent.roi_score))}/cr` : 'N/A', color: agent.roi_score >= 50 ? 'var(--green)' : agent.roi_score >= 10 ? 'var(--amber)' : 'var(--red)' },
              { label: 'Conv%', value: `${agent.connect_conversion_rate}%`, color: agent.connect_conversion_rate >= 10 ? 'var(--green)' : 'var(--amber)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '7px 10px', border: '1px solid var(--border)' }}>
                <div style={labelStyle}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Coaching notes */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>Coaching Notes</div>
          {loadingNotes ? (
            <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>Loading...</div>
          ) : notes.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>No coaching notes</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notes.slice(0, 5).map(n => (
                <div key={n.id} style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '6px 8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--primary-fg)' }}>{n.manager}</span>
                    <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{fmtDate(n.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.5 }}>{n.note}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Breakdown Sub-tab ────────────────────────────────────────────────────
type SortKey = 'connect_dials' | 'connect_booked' | 'connect_veteran_dials' | 'connect_globe_dials'
  | 'recruit_touches' | 'inbound_calls' | 'alp_submitted' | 'credits_total_used' | 'roi_score';

function AgentBreakdownTab({ rows }: { rows: AgentUsageRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('connect_dials');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const selectedAgent = sorted.find(r => r.email === selectedEmail) || null;

  function SortTh({ label, sk }: { label: string; sk: SortKey }) {
    const active = sortKey === sk;
    return (
      <th
        onClick={() => handleSort(sk)}
        style={{
          padding: '6px 8px', cursor: 'pointer',
          textAlign: 'center',
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: active ? 'var(--primary-fg)' : 'var(--fg-dim)',
          borderBottom: '1px solid var(--border)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </th>
    );
  }

  function dialColor(n: number) {
    if (n > 10) return 'var(--green)';
    if (n >= 5) return 'var(--amber)';
    return 'var(--fg-dim)';
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'var(--bg-raised)', position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', ...labelStyle, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Agent</th>
              <SortTh label="Connect" sk="connect_dials" />
              <SortTh label="Vet" sk="connect_veteran_dials" />
              <SortTh label="Globe" sk="connect_globe_dials" />
              <SortTh label="Recruit" sk="recruit_touches" />
              <th style={{ padding: '6px 8px', textAlign: 'center', ...labelStyle, borderBottom: '1px solid var(--border)' }}>CCPro</th>
              <SortTh label="Inbound" sk="inbound_calls" />
              <SortTh label="ALP" sk="alp_submitted" />
              <SortTh label="Credits" sk="credits_total_used" />
              <SortTh label="ROI" sk="roi_score" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const isSelected = selectedEmail === row.email;
              const roiColor = row.roi_score >= 50 ? 'var(--green)'
                : row.roi_score >= 10 ? 'var(--amber)'
                : row.credits_total_used > 0 ? 'var(--red)'
                : 'var(--fg-dim)';
              const creditsColor = row.credits_total_used > 100 && row.connect_booked === 0 ? 'var(--red)' : 'var(--fg)';

              return (
                <tr
                  key={row.email}
                  onClick={() => setSelectedEmail(isSelected ? null : row.email)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-soft)' : i % 2 === 0 ? 'transparent' : 'var(--bg-raised)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-raised)'; }}
                >
                  <td style={{ padding: '6px 10px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--fg)', fontSize: 11 }}>{agentName(row.email)}</div>
                    <div style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{row.email.split('@')[0]}</div>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)' }}>{row.connect_dials}</div>
                    <div style={{ fontSize: 9, color: 'var(--fg-dim)' }}>
                      {row.connect_booked} bkd · {row.connect_conversion_rate}%
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: dialColor(row.connect_veteran_dials) }}>
                    {row.connect_veteran_dials || '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: dialColor(row.connect_globe_dials) }}>
                    {row.connect_globe_dials || '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: row.recruit_touches > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                    {row.recruit_touches || '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 13 }}>
                    {row.ccpro_enabled ? <span style={{ color: 'var(--green)' }}>✓</span> : <span style={{ color: 'var(--fg-dim)' }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: row.inbound_calls > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                    {row.inbound_calls || '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: row.alp_submitted > 0 ? 'var(--green)' : 'var(--fg-dim)' }}>
                    {row.alp_submitted > 0 ? fmtMoney(row.alp_submitted) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: creditsColor }}>
                    {row.credits_total_used > 0 ? row.credits_total_used.toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: roiColor }}>
                    {row.credits_total_used > 0
                      ? row.alp_submitted > 0
                        ? `${fmtMoney(Math.round(row.roi_score))}/cr`
                        : <span style={{ color: 'var(--red)' }}>$0</span>
                      : <span style={{ color: 'var(--fg-dim)' }}>N/A</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 12 }}>No usage data found</div>
        )}
      </div>

      {/* Detail panel */}
      {selectedAgent && (
        <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  );
}

// ── ROI Scatter Plot SVG ───────────────────────────────────────────────────────
function RoiScatterPlot({ rows }: { rows: AgentUsageRow[] }) {
  const plotRows = rows.filter(r => r.credits_total_used > 0);
  if (!plotRows.length) return <div style={{ color: 'var(--fg-dim)', fontSize: 11 }}>No data</div>;

  const W = 500, H = 280, PL = 55, PR = 20, PT = 20, PB = 40;
  const cW = W - PL - PR, cH = H - PT - PB;

  const maxX = Math.max(...plotRows.map(r => r.credits_total_used), 1);
  const maxY = Math.max(...plotRows.map(r => r.alp_submitted), 1);

  function cx(v: number) { return PL + (v / maxX) * cW; }
  function cy(v: number) { return PT + cH - (v / maxY) * cH; }

  const xTicks = [0, Math.round(maxX / 3), Math.round((maxX * 2) / 3), maxX];
  const yTicks = [0, Math.round(maxY / 4), Math.round(maxY / 2), Math.round((maxY * 3) / 4), maxY];

  function dotColor(r: AgentUsageRow) {
    if (r.roi_score >= 50) return 'var(--green)';
    if (r.roi_score >= 10) return 'var(--amber)';
    return 'var(--red)';
  }

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', maxWidth: '100%' }}>
      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={cy(t)} y2={cy(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={PL - 5} y={cy(t) + 4} textAnchor="end" fontSize={9} fill="var(--fg-dim)">
            {t > 0 ? `$${(t / 1000).toFixed(0)}k` : '$0'}
          </text>
        </g>
      ))}
      {xTicks.map(t => (
        <g key={t}>
          <line x1={cx(t)} x2={cx(t)} y1={PT} y2={PT + cH} stroke="var(--border)" strokeWidth={1} />
          <text x={cx(t)} y={PT + cH + 14} textAnchor="middle" fontSize={9} fill="var(--fg-dim)">{t}</text>
        </g>
      ))}
      {/* Axis labels */}
      <text x={PL + cW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--fg-dim)">Credits Used</text>
      <text x={14} y={PT + cH / 2} textAnchor="middle" fontSize={10} fill="var(--fg-dim)"
        transform={`rotate(-90, 14, ${PT + cH / 2})`}>ALP Submitted</text>
      {/* Dots */}
      {plotRows.map(r => {
        const x = cx(r.credits_total_used);
        const y = cy(r.alp_submitted);
        const color = dotColor(r);
        const name = agentName(r.email).split(' ')[0];
        return (
          <g key={r.email}>
            <circle cx={x} cy={y} r={7} fill={color} opacity={0.8} stroke="var(--bg)" strokeWidth={1.5} />
            <text x={x} y={y - 11} textAnchor="middle" fontSize={8} fill={color} fontWeight={700}>{name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── ROI Analysis Sub-tab ───────────────────────────────────────────────────────
function RoiTab({ rows }: { rows: AgentUsageRow[] }) {
  const withCredits = rows.filter(r => r.credits_total_used > 0);
  const top10 = [...withCredits]
    .filter(r => r.alp_submitted > 0)
    .sort((a, b) => b.roi_score - a.roi_score)
    .slice(0, 10);

  const bottom5 = [...withCredits]
    .sort((a, b) => {
      // High credits, low ALP
      const scoreA = a.credits_total_used - a.alp_submitted / 100;
      const scoreB = b.credits_total_used - b.alp_submitted / 100;
      return scoreB - scoreA;
    })
    .filter(r => r.roi_score < 10)
    .slice(0, 5);

  const tblStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 11 };
  const thStyle: React.CSSProperties = {
    padding: '6px 10px', textAlign: 'left', ...labelStyle,
    borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)',
  };
  const tdStyle: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Scatter plot */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 12 }}>
          💹 Credits vs ALP — Agent ROI Scatter
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginBottom: 10, display: 'flex', gap: 12 }}>
          <span><span style={{ color: 'var(--green)' }}>●</span> ROI &gt;$50/credit</span>
          <span><span style={{ color: 'var(--amber)' }}>●</span> $10–50/credit</span>
          <span><span style={{ color: 'var(--red)' }}>●</span> &lt;$10/credit</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <RoiScatterPlot rows={rows} />
        </div>
      </div>

      {/* Top 10 ROI */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>
          🏆 Top 10 ROI Performers
        </div>
        {top10.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No agents with ALP data yet</div>
        ) : (
          <table style={tblStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Agent</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Credits Used</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ALP</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ROI ($/credit)</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r, i) => (
                <tr key={r.email} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{agentName(r.email)}</span>
                    <span style={{ fontSize: 9, color: 'var(--fg-dim)', marginLeft: 6 }}>{r.email.split('@')[0]}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--fg)' }}>
                    {r.credits_total_used.toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--green)', fontWeight: 700 }}>
                    {fmtMoney(r.alp_submitted)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>
                    {fmtMoney(Math.round(r.roi_score))}/cr
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom 5 — needs attention */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 10 }}>
          🚨 Needs Attention — High Credit Burn, Low ALP
        </div>
        {bottom5.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>All agents with credits have acceptable ROI</div>
        ) : (
          <table style={tblStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Agent</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Credits Used</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ALP</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ROI</th>
              </tr>
            </thead>
            <tbody>
              {bottom5.map((r, i) => (
                <tr key={r.email} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{agentName(r.email)}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--red)', fontWeight: 700 }}>
                    {r.credits_total_used.toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: r.alp_submitted > 0 ? 'var(--amber)' : 'var(--red)' }}>
                    {r.alp_submitted > 0 ? fmtMoney(r.alp_submitted) : '$0'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--red)', fontWeight: 800 }}>
                    {r.alp_submitted > 0 ? `${fmtMoney(Math.round(r.roi_score))}/cr` : 'No ALP'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main AoiUsage Component ────────────────────────────────────────────────────
export function AoiUsage() {
  const [subTab, setSubTab] = useState<'overview' | 'agents' | 'roi'>('overview');
  const [rows, setRows] = useState<AgentUsageRow[]>([]);
  const [summary, setSummary] = useState<TeamUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        fetch(`/api/usage/breakdown?days=${days}`).then(r => r.json()),
        fetch(`/api/usage/summary?days=${days}`).then(r => r.json()),
      ]);
      setRows(Array.isArray(b) ? b : []);
      setSummary(s && typeof s === 'object' && !s.error ? s : null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const SUB_TABS = [
    { key: 'overview', label: '📡 Overview' },
    { key: 'agents', label: '👥 Agents' },
    { key: 'roi', label: '💰 ROI' },
  ] as const;

  const emptySummary: TeamUsageSummary = {
    total_connect_dials: 0, total_connect_booked: 0, team_connect_conversion: 0,
    total_recruit_touches: 0, total_inbound_calls: 0, total_alp_submitted: 0,
    total_credits_used: 0, veteran_dials: 0, globe_dials: 0, active_agents_today: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)',
        padding: '0 14px',
        flexShrink: 0,
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 0, flex: 1 }}>
          {SUB_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              style={{
                padding: '8px 14px', fontSize: 11,
                fontWeight: subTab === t.key ? 700 : 500,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: subTab === t.key ? 'var(--primary-fg)' : 'var(--fg-dim)',
                borderBottom: subTab === t.key ? '2px solid var(--primary-fg)' : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Days selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={labelStyle}>Range:</span>
          {[7, 14, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '3px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                background: days === d ? 'var(--primary-soft)' : 'transparent',
                color: days === d ? 'var(--primary-fg)' : 'var(--fg-dim)',
                border: days === d ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)',
                fontWeight: days === d ? 700 : 500,
              }}
            >{d}d</button>
          ))}
        </div>

        <button
          onClick={load}
          style={{
            fontSize: 10, padding: '4px 10px', borderRadius: 5,
            background: 'transparent', color: 'var(--fg-dim)',
            border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600,
          }}
        >↺ Refresh</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontSize: 12 }}>
            Loading usage data...
          </div>
        ) : (
          <>
            {subTab === 'overview' && (
              <OverviewTab summary={summary || emptySummary} rows={rows} />
            )}
            {subTab === 'agents' && (
              <AgentBreakdownTab rows={rows} />
            )}
            {subTab === 'roi' && (
              <RoiTab rows={rows} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
