import { useState, useEffect, useMemo, useCallback } from 'react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  pageBg:    'var(--bg)',
  surface:   'var(--bg-surface)',
  surface2:  'var(--bg-soft)',
  border:    'var(--border)',
  borderMid: 'var(--border-bright)',

  textPrimary:   'var(--fg)',
  textSecondary: 'var(--fg-muted)',
  textMuted:     'var(--fg-dim)',
  textDim:       'var(--fg-dim)',

  blue:      '#3B82F6',
  blueDim:   'color-mix(in srgb, #3B82F6 12%, transparent)',
  blueGlow:  'color-mix(in srgb, #3B82F6 18%, transparent)',

  emerald:     '#10B981',
  emeraldDim:  'color-mix(in srgb, #10B981 12%, transparent)',

  amber:     '#F59E0B',
  amberDim:  'color-mix(in srgb, #F59E0B 12%, transparent)',

  red:       '#EF4444',
  redDim:    'color-mix(in srgb, #EF4444 12%, transparent)',

  purple:    '#8B5CF6',
  purpleDim: 'color-mix(in srgb, #8B5CF6 12%, transparent)',
};

const MONO = "'DM Mono', 'Courier New', monospace";
const SANS = "system-ui, -apple-system, sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayRow {
  date: string;
  dayName: string;
  dials: number;
  reached: number;
  booked: number;
  instants: number;
  sales: number;
  alp: number;
  plus?: number;
  presentations?: number;
  declared_sales?: number;
  declared_alp?: number;
}
interface AlpData { marketAlp: number; nonMarketAlp: number; plusLeadAlp: number; totalAlp: number; sales: number; alpPer100: number; }
interface DeclaredData { presentations: number; sales: number; alp: number; }
interface AgentRow {
  email: string; fullName: string; mgaName?: string | null; rgaName?: string | null;
  totals: { dials: number; reached: number; booked: number; instants: number };
  days: DayRow[];
  declared?: DeclaredData | null;
  alp?: AlpData | null;
}
interface WeeklyData {
  weekStart: string; weekEnd: string;
  agents: AgentRow[];
  totals: {
    dials: number;
    reached: number;
    booked: number;
    instants: number;
    activeAgents: number;
    presentations?: number;
    declaredSales?: number;
    declaredAlp?: number;
    marketAlp?: number;
    nonMarketAlp?: number;
    plusLeadAlp?: number;
    totalAlp?: number;
    totalSales?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safePct = (n: number, d: number, dec = 1) => (!d ? '—' : ((n / d) * 100).toFixed(dec) + '%');
const fmtDate = (s: string) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12).toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
const fmtWeek = (ws: string, we: string) => ws ? `${fmtDate(ws)} – ${fmtDate(we||ws)}` : '';
const fmtWeekday = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { weekday: 'short' });
};
const toLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const addDaysToDateKey = (dateKey: string, days: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() + days);
  return toLocalDateKey(dt);
};
const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const isUnknownMgaLabel = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'unknown mga' || normalized === 'unknown';
};
const toTitle = (s: string) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const splitMergedName = (input: string): string => {
  const compact = String(input || '').trim();
  if (!compact || /\s/.test(compact) || compact.length < 8) return compact;
  const lower = compact.toLowerCase();
  const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
  let bestIdx = -1;
  let bestScore = -1;
  for (let i = 3; i <= lower.length - 3; i++) {
    const prev = lower[i - 1];
    const curr = lower[i];
    // Prefer a boundary that ends a vowel-heavy first name and starts a consonant.
    let score = 0;
    if (vowels.has(prev) && !vowels.has(curr)) score += 2;
    if (!vowels.has(prev) && vowels.has(curr)) score += 1;
    const left = lower.slice(0, i);
    const right = lower.slice(i);
    if (left.length >= 3 && right.length >= 3) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestIdx <= 0) return compact;
  return `${compact.slice(0, bestIdx)} ${compact.slice(bestIdx)}`.trim();
};
const formatAgentName = (fullName: string | undefined, email: string) => {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (normalized.includes(' ')) return toTitle(normalized);
  const local = String(email || '').split('@')[0] || normalized;
  if (!local) return 'Unknown';
  if (/[._-]/.test(local)) return toTitle(local.replace(/[._-]+/g, ' '));
  const fallback = normalized || local;
  return toTitle(splitMergedName(fallback));
};

function getRateColor(rate: number, good: number, ok: number): string {
  return rate >= good ? C.emerald : rate >= ok ? C.amber : C.red;
}

// ─── Pulse animation via injected style ──────────────────────────────────────
const globalStyle = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
    50% { opacity: 0.7; box-shadow: 0 0 0 5px rgba(16,185,129,0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .analytics-row:hover td { background-color: rgba(59,130,246,0.04) !important; }
  .analytics-day-row:hover td { background-color: rgba(59,130,246,0.03) !important; }
`;

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ flex: 1, minWidth: 100, height: 80, borderRadius: 8, background: `linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-soft) 50%, var(--bg-surface) 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
  );
}

// ─── Funnel Card ─────────────────────────────────────────────────────────────
function FunnelCard({
  label, value, sub, subColor, accentColor, isFirst,
}: {
  label: string; value: string | number; sub?: string; subColor?: string;
  accentColor: string; isFirst?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
      {!isFirst && (
        <div style={{ color: C.textDim, fontSize: 16, margin: '0 4px', flexShrink: 0, fontFamily: MONO }}>›</div>
      )}
      <div style={{
        flex: 1, minWidth: 0,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: '12px 14px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 3, right: 0, height: 1, background: `linear-gradient(to right, ${accentColor}30, transparent)` }} />
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textMuted, fontFamily: SANS, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: C.textPrimary, lineHeight: 1, fontFamily: MONO }}>{value}</div>
        {sub && (
          <div style={{ fontSize: 11, fontWeight: 500, color: subColor || C.textMuted, marginTop: 5, fontFamily: MONO }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Number Badge ─────────────────────────────────────────────────────────────
function Num({ v, color }: { v: string | number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 4,
      background: 'var(--glass-bg)',
      border: `1px solid ${C.border}`,
      color: color || C.textSecondary,
      fontFamily: MONO,
      fontWeight: 500,
      fontSize: 12,
    }}>{v}</span>
  );
}

function DashboardMetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div
      style={{
        minWidth: 150,
        flex: 1,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: C.textPrimary, fontFamily: MONO }}>{value}</div>
      {helper ? <div style={{ marginTop: 3, fontSize: 10, color: C.textMuted }}>{helper}</div> : null}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Analytics() {
  const [activeTab, setActiveTab] = useState<'sales' | 'recruiting'>('sales');
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mgaFilter, setMgaFilter] = useState('all');
  const [rgaFilter, setRgaFilter] = useState('all');

  // Production week: Wednesday – Tuesday (ALP report week_ending = Tuesday)
  const weekStart = useMemo(() => {
    const d = new Date(); const day = d.getDay(); // 0=Sun,1=Mon,...,3=Wed
    // Days since last Wednesday: Wed=0, Thu=1, Fri=2, Sat=3, Sun=4, Mon=5, Tue=6
    const daysSinceWed = (day + 4) % 7;
    const wed = new Date(d);
    wed.setDate(d.getDate() - daysSinceWed + weekOffset * 7);
    return toLocalDateKey(wed);
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    // Tuesday = Wednesday + 6
    return addDaysToDateKey(weekStart, 6);
  }, [weekStart]);

  useEffect(() => {
    if (activeTab !== 'sales') return;
    setLoading(true); setData(null); setExpandedEmail(null); setError(null);
    fetch(`/api/analytics/weekly?weekStart=${weekStart}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          throw new Error(`HTTP ${r.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
        }
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch((err: any) => { setError(err?.message || 'Failed to load analytics'); setLoading(false); });
  }, [weekStart, activeTab]);

  const totals = data?.totals ?? { dials: 0, reached: 0, booked: 0, instants: 0, activeAgents: 0 };
  const contactRate = totals.dials ? totals.reached / totals.dials : 0;
  const bookingRate = totals.reached ? totals.booked / totals.reached : 0;

  const nn = (s: string | null | undefined) => s ? s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '';

  const rgaOptions = useMemo(() => {
    if (!data?.agents) return [];
    return [...new Set(data.agents.map(a => nn(a.rgaName)).filter(Boolean))].sort();
  }, [data]);

  const mgaOptions = useMemo(() => {
    if (!data?.agents) return [];
    return [...new Set(data.agents.map(a => nn(a.mgaName)).filter(Boolean))].sort();
  }, [data]);

  const agents = useMemo(() => {
    if (!data?.agents) return [];
    const normalizedRgaFilter = rgaFilter !== 'all' ? nn(rgaFilter) : 'all';
    const rgaLinkedMga = new Set<string>();
    if (normalizedRgaFilter !== 'all') {
      for (const row of data.agents) {
        const rowRga = nn(row.rgaName);
        const rowMga = nn(row.mgaName);
        if (rowRga === normalizedRgaFilter && rowMga) {
          rgaLinkedMga.add(rowMga);
        }
      }
    }
    let list = [...data.agents].filter(a => {
      const agentName = nn(a.fullName || a.email?.split('@')[0]?.replace(/[._]/g, ' ') || '');
      if (search && !((a.fullName || '').toLowerCase().includes(search.toLowerCase()) || (a.email || '').toLowerCase().includes(search.toLowerCase()))) return false;
      const agentRga = nn(a.rgaName);
      const agentMga = nn(a.mgaName);
      if (normalizedRgaFilter !== 'all') {
        const linkedByMga = !!agentMga && rgaLinkedMga.has(agentMga);
        const linkedByName = agentName === normalizedRgaFilter;
        if (agentRga !== normalizedRgaFilter && !linkedByMga && !linkedByName) return false;
      }
      // Include manager's own stats when filtering by their MGA name.
      // Some manager rows don't carry their own name in mga_name, so we
      // also match their normalized full name against the selected MGA.
      if (mgaFilter !== 'all' && nn(a.mgaName) !== mgaFilter && agentName !== mgaFilter) return false;
      return true;
    });
    return list.sort((a, b) => {
      const ar = nn(a.rgaName) || 'ZZZ';
      const br = nn(b.rgaName) || 'ZZZ';
      const rgaCmp = compareText(ar, br);
      if (rgaCmp !== 0) return rgaCmp;
      const am = nn(a.mgaName) || 'ZZZ';
      const bm = nn(b.mgaName) || 'ZZZ';
      const mgaCmp = compareText(am, bm);
      if (mgaCmp !== 0) return mgaCmp;
      return compareText(a.fullName || a.email, b.fullName || b.email);
    });
  }, [data, search, mgaFilter, rgaFilter]);

  const dashboard = useMemo(() => {
    const count = agents.length;
    if (!count) {
      return {
        avgDials: 0,
        avgReached: 0,
        avgBooked: 0,
        topDials: [] as AgentRow[],
        topReached: [] as AgentRow[],
        topBooked: [] as AgentRow[],
      };
    }
    const topDials = [...agents].sort((a, b) => b.totals.dials - a.totals.dials).slice(0, 3);
    const topReached = [...agents].sort((a, b) => b.totals.reached - a.totals.reached).slice(0, 3);
    const topBooked = [...agents].sort((a, b) => b.totals.booked - a.totals.booked).slice(0, 3);
    return {
      avgDials: Math.round(agents.reduce((sum, a) => sum + a.totals.dials, 0) / count),
      avgReached: Math.round(agents.reduce((sum, a) => sum + a.totals.reached, 0) / count),
      avgBooked: Math.round(agents.reduce((sum, a) => sum + a.totals.booked, 0) / count),
      topDials,
      topReached,
      topBooked,
    };
  }, [agents]);

  const reportGroups = useMemo(() => {
    const grouped = new Map<string, AgentRow[]>();
    for (const agent of agents) {
      const key = nn(agent.mgaName) || nn(agent.rgaName) || 'Unknown MGA';
      const list = grouped.get(key) || [];
      list.push(agent);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries())
      .map(([mgaName, groupAgents]) => ({
        mgaName,
        groupAgents,
        totals: {
          dials: groupAgents.reduce((sum, row) => sum + row.totals.dials, 0),
          reached: groupAgents.reduce((sum, row) => sum + row.totals.reached, 0),
          booked: groupAgents.reduce((sum, row) => sum + row.totals.booked, 0),
          instants: groupAgents.reduce((sum, row) => sum + row.totals.instants, 0),
        },
      }))
      .sort((a, b) => {
        const aUnknown = isUnknownMgaLabel(a.mgaName);
        const bUnknown = isUnknownMgaLabel(b.mgaName);
        if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
        if (b.totals.dials !== a.totals.dials) return b.totals.dials - a.totals.dials;
        return compareText(a.mgaName, b.mgaName);
      });
  }, [agents]);

  const handleDownloadReport = useCallback(async () => {
    if (!reportGroups.length || downloadingReport) return;
    setDownloadingReport(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

      const allAgents = reportGroups.flatMap((group) => group.groupAgents);
      const overall = {
        dials: allAgents.reduce((sum, row) => sum + row.totals.dials, 0),
        reached: allAgents.reduce((sum, row) => sum + row.totals.reached, 0),
      };
      const activeOverallAgents = allAgents.filter((row) => row.totals.dials > 0).length;

      doc.setFontSize(16);
      doc.text('Analytics Agency Report - All Teams', 40, 42);
      doc.setFontSize(10);
      doc.text(`Week: ${fmtWeek(weekStart, weekEnd)} • Agencies: ${reportGroups.length} • Agents: ${activeOverallAgents}/${allAgents.length}`, 40, 60);

      autoTable(doc, {
        startY: 76,
        theme: 'grid',
        styles: { fontSize: 9 },
        head: [['Team Dials', 'Team Reached', 'Contact %', 'Avg Dials / Agent']],
        body: [[
          overall.dials.toLocaleString(),
          overall.reached.toLocaleString(),
          safePct(overall.reached, overall.dials),
          activeOverallAgents ? Math.round(overall.dials / activeOverallAgents).toLocaleString() : '0',
        ]],
      });

      const agencySummaryRows = reportGroups.map((group, idx) => [
        String(idx + 1),
        group.mgaName,
        group.groupAgents.length.toLocaleString(),
        group.groupAgents.filter((row) => row.totals.dials > 0).length.toLocaleString(),
        group.totals.dials.toLocaleString(),
        group.totals.reached.toLocaleString(),
        safePct(group.totals.reached, group.totals.dials),
      ]);
      autoTable(doc, {
        startY: ((doc as any).lastAutoTable?.finalY || 76) + 16,
        theme: 'striped',
        styles: { fontSize: 8 },
          head: [['Rank', 'Agency (MGA)', 'Total Agents', 'Active Agents', 'Dials', 'Reached', 'Contact %']],
        body: agencySummaryRows,
      });

      for (const { mgaName, groupAgents, totals } of reportGroups) {
        doc.addPage();
        const activeGroupAgents = groupAgents.filter((row) => row.totals.dials > 0).length;

        doc.setFontSize(16);
        doc.text(`MGA Agency Report - ${mgaName}`, 40, 42);
        doc.setFontSize(10);
        doc.text(`Week: ${fmtWeek(weekStart, weekEnd)} • Agents: ${activeGroupAgents}/${groupAgents.length}`, 40, 60);

        autoTable(doc, {
          startY: 76,
          theme: 'grid',
          styles: { fontSize: 9 },
          head: [['Team Dials', 'Team Reached', 'Contact %']],
          body: [[
            totals.dials.toLocaleString(),
            totals.reached.toLocaleString(),
            safePct(totals.reached, totals.dials),
          ]],
        });

        const totalsRows = groupAgents.map((agent) => [
          agent.rgaName || '—',
          formatAgentName(agent.fullName, agent.email),
          agent.totals.dials.toLocaleString(),
          agent.totals.reached.toLocaleString(),
          safePct(agent.totals.reached, agent.totals.dials),
        ]);

        autoTable(doc, {
          startY: ((doc as any).lastAutoTable?.finalY || 76) + 16,
          theme: 'striped',
          styles: { fontSize: 8 },
          head: [['RGA', 'Agent', 'Dials', 'Reached', 'Contact %']],
          body: totalsRows,
        });
      }

      doc.save(`aoi-command-mga-eod-${weekStart}.pdf`);
    } catch (err) {
      console.error('Failed to download MGA report', err);
    } finally {
      setDownloadingReport(false);
    }
  }, [downloadingReport, reportGroups, weekStart, weekEnd]);

  // ── Sticky header row heights
  const ROW1_TOP = 0;
  const ROW2_TOP = 28;

  // ── Cell base styles
  const TH1: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: SANS,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: ROW1_TOP,
    zIndex: 3,
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    textAlign: 'center',
  };
  const TH2: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: SANS,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: ROW2_TOP,
    zIndex: 2,
    background: C.surface,
    borderBottom: `1px solid ${C.borderMid}`,
    textAlign: 'right',
    color: C.textMuted,
  };
  const TH2L: React.CSSProperties = { ...TH2, textAlign: 'left' };
  const TD: React.CSSProperties = {
    padding: '9px 10px',
    fontSize: 12,
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    textAlign: 'right',
    verticalAlign: 'middle',
    fontFamily: MONO,
  };
  const TDL: React.CSSProperties = { ...TD, textAlign: 'left', fontFamily: SANS };

  return (
    <div style={{ background: C.pageBg, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: SANS, color: C.textPrimary }}>
      <style>{globalStyle}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--analytics-header-bg)',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 10 }}>
          {/* Left: branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: C.emerald,
              flexShrink: 0,
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textPrimary, lineHeight: 1, fontFamily: SANS }}>
                Performance Dashboard
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3, letterSpacing: '0.06em' }}>
                Sales Intelligence Platform
              </div>
            </div>
          </div>

          {/* Right: tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--glass-bg)', borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
            {(['sales', 'recruiting'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  background: activeTab === t ? C.blue : 'none',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 14px',
                  fontSize: 11,
                  fontWeight: activeTab === t ? 700 : 500,
                  color: activeTab === t ? '#fff' : C.textMuted,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s',
                  fontFamily: SANS,
                }}
              >
                {t === 'sales' ? 'Sales' : 'Recruiting'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recruiting placeholder ──────────────────────────────────────────── */}
      {activeTab === 'recruiting' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 36, opacity: 0.3 }}>🚧</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recruiting Analytics</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Coming soon</div>
        </div>
      )}

      {/* ── Sales view ──────────────────────────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {error && !loading && (
            <div style={{ margin: '12px 20px 0', padding: '10px 12px', borderRadius: 8, background: C.redDim, border: `1px solid ${C.red}`, color: C.red, fontSize: 12 }}>
              Analytics failed to load: {error}
            </div>
          )}

          {/* Funnel strip */}
          <div style={{ padding: '12px 20px', flexShrink: 0, background: 'var(--glass-bg)', borderBottom: `1px solid ${C.border}` }}>
            {loading ? (
              <div style={{ display: 'flex', gap: 6, height: 72, alignItems: 'stretch' }}>
                {[...Array(7)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
                <FunnelCard isFirst accentColor={C.blue}
                  label="Dials" value={totals.dials.toLocaleString()}
                  sub={totals.activeAgents ? `${Math.round(totals.dials / totals.activeAgents)}/agent` : undefined}
                  subColor={C.textMuted}
                />
                <FunnelCard accentColor={C.amber}
                  label="Reached" value={totals.reached.toLocaleString()}
                  sub={safePct(totals.reached, totals.dials) + ' contact'}
                  subColor={getRateColor(contactRate * 100, 6, 3)}
                />
                <FunnelCard accentColor={C.emerald}
                  label="Booked" value={totals.booked.toLocaleString()}
                  sub={safePct(totals.booked, totals.reached) + ' booking'}
                  subColor={getRateColor(bookingRate * 100, 25, 15)}
                />
                <FunnelCard accentColor={C.purple}
                  label="Instants" value={totals.instants.toLocaleString()}
                  sub={safePct(totals.instants, totals.booked) + ' of booked'}
                  subColor={C.purple}
                />
                <FunnelCard accentColor={C.blue}
                  label="Active Agents" value={totals.activeAgents}
                  subColor={C.textMuted}
                />
              </div>
            )}
          </div>

          <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DashboardMetricCard label="Avg Dials / Agent" value={dashboard.avgDials.toLocaleString()} />
            <DashboardMetricCard label="Avg Reached / Agent" value={dashboard.avgReached.toLocaleString()} />
            <DashboardMetricCard label="Avg Booked / Agent" value={dashboard.avgBooked.toLocaleString()} />
          </div>

          <div style={{ padding: '10px 20px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[
              { title: 'Top Dials', rows: dashboard.topDials, val: (a: AgentRow) => a.totals.dials.toLocaleString() },
              { title: 'Top Reached', rows: dashboard.topReached, val: (a: AgentRow) => a.totals.reached.toLocaleString() },
              { title: 'Top Booked', rows: dashboard.topBooked, val: (a: AgentRow) => a.totals.booked.toLocaleString() },
            ].map((section) => (
              <div key={section.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, marginBottom: 8 }}>{section.title}</div>
                {section.rows.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.textDim }}>No data yet</div>
                ) : (
                  section.rows.map((agent) => (
                    <div key={`${section.title}-${agent.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 11, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {formatAgentName(agent.fullName, agent.email)}
                      </span>
                      <span style={{ fontSize: 12, color: C.textPrimary, fontFamily: MONO }}>{section.val(agent)}</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          {/* Table area */}
          <div style={{ flex: 1, overflow: 'auto', background: C.pageBg }}>

            {/* Controls bar */}
            <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 20 }}>
              {/* Week nav */}
              <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: 'var(--bg-surface)', border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: C.textSecondary, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, fontFamily: MONO, letterSpacing: '-0.01em', minWidth: 140, textAlign: 'center' }}>{fmtWeek(weekStart, weekEnd)}</span>
              <button onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0} style={{ background: 'var(--bg-surface)', border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer', color: weekOffset >= 0 ? C.textDim : C.textSecondary, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: weekOffset >= 0 ? 0.35 : 1 }}>›</button>

              <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

              {/* Search */}
              <div style={{ position: 'relative', flex: 1, maxWidth: 220 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textDim, fontSize: 12, pointerEvents: 'none' }}>⌕</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents…" style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, color: C.textPrimary, outline: 'none', fontFamily: SANS, boxSizing: 'border-box' }} />
              </div>

              {/* AO Recruit filter */}
              <select value={rgaFilter} onChange={e => setRgaFilter(e.target.value)} style={{ padding: '6px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.textSecondary, cursor: 'pointer', fontFamily: SANS, outline: 'none' }}>
                <option value="all">All RGA</option>
                {rgaOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              {/* Exec Producer (MGA) filter */}
              <select value={mgaFilter} onChange={e => setMgaFilter(e.target.value)} style={{ padding: '6px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.textSecondary, cursor: 'pointer', fontFamily: SANS, outline: 'none' }}>
                <option value="all">All Exec Producers</option>
                {mgaOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <span style={{ fontSize: 11, color: C.textDim, fontFamily: MONO, marginLeft: 4 }}>{agents.length} agents</span>
              <button
                type="button"
                onClick={() => { void handleDownloadReport(); }}
                disabled={downloadingReport || agents.length === 0}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: downloadingReport ? C.surface2 : C.blueDim,
                  color: C.textPrimary,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: downloadingReport || agents.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: downloadingReport || agents.length === 0 ? 0.5 : 1,
                }}
              >
                {downloadingReport ? 'Generating...' : 'rDownlaod Report'}
              </button>
            </div>

            {/* Empty state */}
            {agents.length === 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 8 }}>
                <div style={{ fontSize: 32, opacity: 0.25 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>No data this week</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>Stats accumulate as agents dial. History starts Apr 20.</div>
              </div>
            )}

            {/* Main table */}
            {(agents.length > 0 || loading) && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  {/* Row 1 — section spans */}
                  <tr>
                    <th colSpan={3} style={{ ...TH1, textAlign: 'left', color: C.textDim }} />
                    <th colSpan={3} style={{ ...TH1, background: C.surface, color: C.blue, borderBottom: `2px solid ${C.blue}` }}>
                      Activity
                    </th>
                    <th colSpan={1} style={{ ...TH1, background: C.surface, color: C.purple, borderBottom: `2px solid ${C.purple}` }}>
                      Instant
                    </th>
                    <th colSpan={2} style={{ ...TH1, background: C.surface, color: C.emerald, borderBottom: `2px solid ${C.emerald}` }}>
                      Stats
                    </th>
                    <th style={{ ...TH1 }} />
                  </tr>
                  {/* Row 2 — column names */}
                  <tr>
                    <th style={{ ...TH2L, color: C.textDim }}>RGA</th>
                    <th style={{ ...TH2L, color: C.textDim }}>MGA</th>
                    <th style={{ ...TH2L, color: C.textSecondary }}>Agent</th>
                    <th style={{ ...TH2, background: C.surface2, color: C.blue }}>Dials</th>
                    <th style={{ ...TH2, background: C.surface2, color: C.textMuted }}>Reached</th>
                    <th style={{ ...TH2, background: C.surface2, color: C.textMuted }}>Booked</th>
                    <th style={{ ...TH2, background: C.surface2, color: C.purple }}>Instants</th>
                    <th style={{ ...TH2, background: C.surface2, color: C.emerald }}>Contact%</th>
                    <th style={{ ...TH2, background: C.surface2, color: C.emerald }}>Booking%</th>
                    <th style={{ ...TH2, width: 28, color: C.textDim }}>▾</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent, idx) => {
                    const exp = expandedEmail === agent.email;
                    const cr = agent.totals.dials ? agent.totals.reached / agent.totals.dials : 0;
                    const br = agent.totals.reached ? agent.totals.booked / agent.totals.reached : 0;
                    const rowBg = exp ? C.blueGlow : idx % 2 === 0 ? C.surface : C.surface2;

                    return (
                      <>
                        {/* Agent row */}
                        <tr
                          key={agent.email}
                          className="analytics-row"
                          onClick={() => setExpandedEmail(exp ? null : agent.email)}
                          style={{ background: rowBg, cursor: 'pointer', borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s' }}
                        >
                          <td style={{ ...TDL, color: C.textDim, fontSize: 10, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.rgaName || '—'}</td>
                          <td style={{ ...TDL, color: C.textDim, fontSize: 10, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.mgaName || '—'}</td>
                          <td style={{ ...TDL, fontWeight: 600, color: C.textPrimary, fontSize: 12 }}>{formatAgentName(agent.fullName, agent.email)}</td>
                          {/* Activity */}
                          <td style={{ ...TD, background: C.blueDim }}>
                            <Num v={agent.totals.dials.toLocaleString()} color={C.blue} />
                          </td>
                          <td style={{ ...TD, background: C.blueDim }}>
                            <Num v={agent.totals.reached.toLocaleString()} color={C.textSecondary} />
                          </td>
                          <td style={{ ...TD, background: C.blueDim }}>
                            <Num v={agent.totals.booked.toLocaleString()} color={C.textSecondary} />
                          </td>
                          {/* Presentation */}
                          <td style={{ ...TD, background: C.purpleDim }}>
                            <Num v={agent.totals.instants ?? 0} color={C.purple} />
                          </td>
                          {/* Stats */}
                          <td style={{ ...TD, background: C.emeraldDim, fontWeight: 600, color: cr >= 0.06 ? C.emerald : cr >= 0.03 ? C.amber : cr > 0 ? C.red : C.textDim }}>
                            {safePct(agent.totals.reached, agent.totals.dials)}
                          </td>
                          <td style={{ ...TD, background: C.emeraldDim, fontWeight: 600, color: br >= 0.25 ? C.emerald : br >= 0.15 ? C.amber : br > 0 ? C.red : C.textDim }}>
                            {safePct(agent.totals.booked, agent.totals.reached)}
                          </td>
                          <td style={{ ...TD, color: C.textDim, fontSize: 10, textAlign: 'center' }}>
                            {exp ? '▲' : '▼'}
                          </td>
                        </tr>

                        {/* Expanded day rows */}
                        {exp && agent.days.map(day => {
                          const dim = day.dials === 0;
                          return (
                            <tr
                              key={`${agent.email}-${day.date}`}
                              className="analytics-day-row"
                              style={{ background: 'var(--glass-bg)', borderBottom: `1px solid ${C.border}` }}
                            >
                              <td style={{ ...TD, color: C.textDim }} />
                              <td style={{ ...TD, color: C.textDim }} />
                              <td style={{ ...TDL, paddingLeft: 32 }}>
                                <span style={{ fontWeight: 600, color: C.textSecondary, fontSize: 11 }}>{fmtWeekday(day.date)}</span>
                                <span style={{ color: C.textDim, marginLeft: 8, fontSize: 10, fontFamily: MONO }}>{fmtDate(day.date)}</span>
                              </td>
                              <td style={{ ...TD, background: C.blueDim, color: dim ? C.textDim : C.blue }}>
                                {dim ? '—' : day.dials}
                              </td>
                              <td style={{ ...TD, background: C.blueDim, color: dim ? C.textDim : C.textSecondary }}>
                                {dim ? '—' : day.reached}
                              </td>
                              <td style={{ ...TD, background: C.blueDim, color: dim ? C.textDim : C.textSecondary }}>
                                {dim ? '—' : day.booked}
                              </td>
                              <td style={{ ...TD, background: C.purpleDim, color: dim ? C.textDim : C.purple }}>
                                {dim || !day.instants ? '—' : day.instants}
                              </td>
                              <td style={{ ...TD, background: C.emeraldDim, color: C.textDim }}>—</td>
                              <td style={{ ...TD, background: C.emeraldDim, color: C.textDim }}>—</td>
                              <td style={{ ...TD }} />
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
