import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../hooks/useApi';
import { MyScore, ScorecardView, CallRecord, Scorecard, CoachingNote, AgentStats } from './MyScore';

// ?? Types ??????????????????????????????????????????????????????????????????????
interface FunnelRow {
  associate_id: string;
  agent_name: string;
  email: string;
  market: string;
  aoi_inbound: number;
  aoi_ib_ring: number;
  connect_dials: number;
  connect_reached: number;
  connect_booked: number;
  connect_book_pct: number;
  dials: number;
  booked: number;
  book_rate: number;
  recruit_first_interview: number;
  recruit_virtual_overview: number;
  recruit_group_final: number;
  recruit_hired: number;
  recruit_pipeline_total: number;
  /** HPPRO presentation rows in window */
  presentations: number;
  sales: number;
  close_rate: number;
  alp: number;
  alp_per_pres: number;
  ho_submits: number;
  ho_alp: number;
  credits_used?: number;
  aoi_score?: number;
  aoi_grade?: string;
}

interface FunnelSummary {
  total_dials: number;
  total_booked: number;
  book_rate: number;
  total_presentations: number;
  total_recruit_first_interview?: number;
  total_recruit_virtual_overview?: number;
  total_recruit_group_final?: number;
  total_recruit_hired?: number;
  total_sales: number;
  close_rate: number;
  total_alp: number;
  total_ho_submits: number;
  total_ho_alp: number;
  agent_count: number;
}

interface WeeklyComparison {
  metric: string;
  this_week: number;
  last_week: number;
  change_pct: number | null;
  trend: 'up' | 'down' | 'flat';
}

interface PresentationRow {
  presentation_id: number;
  create_date: string;
  presentation_type: string;
  member_state: string;
  alp: string | number;
  what_happened: string;
  is_form_submitted: string;
}

interface ScoredCall {
  id: string;
  call_date: string;
  duration_seconds: number;
  outcome_grade: string;
  converted: boolean;
  cnresolution: string;
  ai_summary: string;
}

interface AoiScore {
  total: number;
  show_rate_score: number;
  close_rate_score: number;
  alp_score: number;
  call_grade_score: number;
  trend_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

type SortKey =
  | keyof FunnelRow
  | 'avg_alp'
  | 'aoi_ib'
  | 'missed_count'
  | 'ans_pct'
  | 'show_rate'
  | 'plus_leads';
type DayOption = 30 | 60 | 90 | 0;

// ?? Helpers ??????????????????????????????????????????????????????????????????
function fmt$(n: number) {
  if (!n && n !== 0) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtK(n: number) {
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return fmt$(n);
}

function fmtPct(n: number) {
  return n.toFixed(1) + '%';
}

function fmtDate(s: string) {
  if (!s) return '?';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function closeColor(rate: number) {
  if (rate >= 20) return 'var(--green)';
  if (rate >= 10) return 'var(--amber)';
  return 'var(--red)';
}

function convColor(pct: number) {
  if (pct > 30) return 'var(--green)';
  if (pct >= 15) return 'var(--amber)';
  return 'var(--red)';
}

/** Matches server `isRecruitSegmentMarket` for funnel table rows (primary_market / customer market). */
function funnelRowIsRecruitSegment(row: FunnelRow): boolean {
  if (row.market === 'AO Recruit') return true;
  const raw = String(row.market || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  const compact = raw.replace(/\s/g, '');
  if (compact.includes('aorecruit')) return true;
  if (raw.includes('ao recruit')) return true;
  if (raw === 'recruit') return true;
  if (raw === 'rms' || raw.startsWith('rms ') || raw.endsWith(' rms') || raw.includes(' rms') || raw === 'ao rms') return true;
  if (raw.includes('ao rms')) return true;
  return false;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)',
};

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
};

function marketColor(mkt: string) {
  const m = (mkt || '').toUpperCase();
  if (m.includes('VET')) return { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa', border: 'rgba(59,130,246,0.3)' };
  if (m.includes('GLOBE')) return { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80', border: 'rgba(34,197,94,0.3)' };
  if (m.includes('CUB')) return { bg: 'rgba(168,85,247,0.15)', fg: '#c084fc', border: 'rgba(168,85,247,0.3)' };
  return { bg: 'rgba(107,114,128,0.15)', fg: '#9ca3af', border: 'rgba(107,114,128,0.3)' };
}

function aoiGradeColor(grade: string): { bg: string; fg: string; border: string } {
  switch (grade) {
    case 'A': return { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80', border: 'rgba(34,197,94,0.4)' };
    case 'B': return { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa', border: 'rgba(59,130,246,0.4)' };
    case 'C': return { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24', border: 'rgba(245,158,11,0.4)' };
    case 'D': return { bg: 'rgba(249,115,22,0.15)', fg: '#fb923c', border: 'rgba(249,115,22,0.4)' };
    default:  return { bg: 'rgba(239,68,68,0.15)', fg: '#f87171', border: 'rgba(239,68,68,0.4)' };
  }
}

// ?? Skeleton ??????????????????????????????????????????????????????????????????
function Skeleton({ w, h }: { w: number | string; h: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: 'var(--bg-raised)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

// ?? Section Divider ???????????????????????????????????????????????????????????
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      background: 'var(--bg-raised)',
      flexShrink: 0,
    }}>
      <span style={{ ...labelStyle, fontSize: 8, letterSpacing: '0.12em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

// ?? SECTION 1: Robinhood-style Weekly Metrics Strip ???????????????????????????
const METRIC_DEFS = [
  { key: 'dials',         label: 'Dials',           col: 'dials',         fmt: (v: number) => v.toLocaleString(),  group: 'blue',   groupLabel: 'Call Connector Pro' },
  { key: 'booked',        label: 'Reached',         col: 'booked',        fmt: (v: number) => v.toLocaleString(),  group: 'blue',   groupLabel: null },
  { key: 'book_rate',     label: 'AOI Booked',      col: 'book_rate',     fmt: (v: number) => fmtPct(v),           group: 'blue',   groupLabel: null },
  { key: 'recruit_first_interview', label: '1st Interview',     col: 'recruit_first_interview',     fmt: (v: number) => v.toLocaleString(), group: 'purple', groupLabel: 'Recruit pipeline' },
  { key: 'recruit_virtual_overview', label: 'Virtual Overview', col: 'recruit_virtual_overview',    fmt: (v: number) => v.toLocaleString(), group: 'purple', groupLabel: null },
  { key: 'recruit_group_final', label: 'Group Final',           col: 'recruit_group_final',         fmt: (v: number) => v.toLocaleString(), group: 'purple', groupLabel: null },
  { key: 'recruit_hired', label: 'Hired',           col: 'recruit_hired', fmt: (v: number) => v.toLocaleString(), group: 'purple', groupLabel: null },
  { key: 'sales',         label: 'Sales',           col: 'sales',         fmt: (v: number) => v.toLocaleString(),  group: 'green',  groupLabel: 'Sales & Revenue' },
  { key: 'close_rate',    label: 'Close %',         col: 'close_rate',    fmt: (v: number) => fmtPct(v),           group: 'green',  groupLabel: null },
  { key: 'alp',           label: 'ALP',             col: 'alp',           fmt: (v: number) => fmtK(v),             group: 'green',  groupLabel: null },
] as const;

const GROUP_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.35)',   label: 'rgba(59,130,246,0.9)' },
  purple: { bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.35)',   label: 'rgba(139,92,246,0.9)' },
  green:  { bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.35)',   label: 'rgba(16,185,129,0.9)' },
};

function WeeklyStrip({
  data,
  loading,
  activeMetric,
  onMetricClick,
}: {
  data: WeeklyComparison[];
  loading: boolean;
  activeMetric: string | null;
  onMetricClick: (key: string) => void;
}) {
  const dataMap = new Map(data.map(d => [d.metric, d]));

  const groups = [
    { key: 'blue',   label: 'Call Connector Pro', metrics: METRIC_DEFS.filter(d => d.group === 'blue')   },
    { key: 'purple', label: 'Recruit pipeline', metrics: METRIC_DEFS.filter(d => d.group === 'purple') },
    { key: 'green',  label: 'Sales & Revenue',  metrics: METRIC_DEFS.filter(d => d.group === 'green')  },
  ] as const;

  return (
    <div style={{
      background: 'var(--bg-raised)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 14px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
        {groups.map((grp) => {
          const gc = GROUP_COLORS[grp.key];
          return (
            <div key={grp.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: gc.label, paddingLeft: 2 }}>
                {grp.label}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {grp.metrics.map(def => {
                  const comp = dataMap.get(def.key);
                  const isActive = activeMetric === def.col;
                  const trendColor = !comp ? 'var(--fg-dim)'
                    : comp.trend === 'up' ? 'var(--green)'
                    : comp.trend === 'down' ? 'var(--red)'
                    : 'var(--fg-dim)';
                  const trendArrow = !comp ? '' : comp.trend === 'up' ? '?' : comp.trend === 'down' ? '?' : '?';
                  const changePct = comp?.change_pct;
                  return (
                    <div
                      key={def.key}
                      onClick={() => onMetricClick(def.col)}
                      style={{
                        width: 88,
                        background: isActive ? gc.bg : 'var(--bg-surface)',
                        border: `1px solid ${isActive ? gc.border : 'var(--border)'}`,
                        borderTop: `2px solid ${isActive ? gc.border : gc.bg}`,
                        borderRadius: 6,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {def.label}
                      </div>
                      {loading || !comp ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <Skeleton w={48} h={16} />
                          <Skeleton w={64} h={9} />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)', lineHeight: 1 }}>
                            {def.fmt(comp.this_week)}
                          </div>
                          <div style={{ fontSize: 9, color: trendColor, marginTop: 3 }}>
                            {trendArrow}{changePct != null ? ` ${changePct > 0 ? '+' : ''}${Math.abs(changePct).toFixed(0)}%` : ' new'}
                            <span style={{ color: 'var(--fg-dim)', fontSize: 8, marginLeft: 3 }}>wk</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ?? SECTION 2: Team Funnel Flow SVG ??????????????????????????????????????????
function TeamFunnelFlow({ summary }: { summary: FunnelSummary | null }) {
  if (!summary) return null;

  const stages = [
    { label: 'Dials', value: summary.total_dials },
    { label: 'Booked', value: summary.total_booked },
    { label: 'Pipeline', value: summary.total_presentations },
    { label: 'Sales', value: summary.total_sales },
    { label: 'ALP', value: summary.total_alp, isAlp: true },
  ];

  const SVG_W = 580, SVG_H = 80;
  const BOX_W = 84, BOX_H = 46;
  const ARROW_W = 36;
  const totalW = stages.length * BOX_W + (stages.length - 1) * ARROW_W;
  const startX = (SVG_W - totalW) / 2;
  const boxY = (SVG_H - BOX_H) / 2;

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ ...labelStyle }}>Team Funnel Flow</span>
        <span style={{ fontSize: 9, color: 'var(--fg-dim)', fontWeight: 600 }}>This Week</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block', minWidth: SVG_W }}>
          {stages.map((stage, i) => {
            const x = startX + i * (BOX_W + ARROW_W);
            const prevStage = stages[i - 1];
            const convPct = prevStage && prevStage.value > 0
              ? (stage.value / prevStage.value) * 100
              : null;
            const color = convPct !== null ? convColor(convPct) : 'var(--primary-fg)';

            return (
              <g key={stage.label}>
                <rect
                  x={x} y={boxY} width={BOX_W} height={BOX_H} rx={6}
                  fill={`${convPct !== null ? (convPct > 30 ? '#22c55e' : convPct >= 15 ? '#f59e0b' : '#ef4444') : '#6366f1'}18`}
                  stroke={convPct !== null ? (convPct > 30 ? '#22c55e' : convPct >= 15 ? '#f59e0b' : '#ef4444') : '#6366f1'}
                  strokeWidth={1.5}
                />
                <text x={x + BOX_W / 2} y={boxY + 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--fg)">
                  {stage.isAlp ? fmtK(stage.value) : stage.value.toLocaleString()}
                </text>
                <text x={x + BOX_W / 2} y={boxY + 32} textAnchor="middle" fontSize={9} fill="var(--fg-dim)">{stage.label}</text>
                {i > 0 && (
                  <g>
                    <line x1={x - ARROW_W + 2} y1={SVG_H / 2} x2={x - 2} y2={SVG_H / 2} stroke={color} strokeWidth={1.5} />
                    <polygon points={`${x - 2},${SVG_H / 2 - 3} ${x - 2},${SVG_H / 2 + 3} ${x + 2},${SVG_H / 2}`} fill={color} />
                    {convPct !== null && (
                      <text x={x - ARROW_W / 2} y={SVG_H / 2 - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
                        {convPct.toFixed(0)}%
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ?? SECTION 3: SVG Agent Funnel ???????????????????????????????????????????????
function AgentFunnelDiagram({ row }: { row: FunnelRow }) {
  const W = 620, H = 100;
  const steps = [
    { label: 'Offers', value: row.connect_dials, color: '#6366f1', fmt: (n: number) => n.toLocaleString() },
    { label: 'Reached', value: row.connect_reached, color: '#8b5cf6', fmt: (n: number) => n.toLocaleString() },
    { label: 'Booked', value: row.booked, color: '#22c55e', fmt: (n: number) => n.toLocaleString() },
    { label: 'HPPRO Pres', value: row.presentations, color: '#f59e0b', fmt: (n: number) => n.toLocaleString() },
    { label: 'Sales', value: row.sales, color: '#ec4899', fmt: (n: number) => n.toLocaleString() },
    { label: 'ALP', value: row.alp, color: '#10b981', fmt: (n: number) => fmt$(n) },
  ];
  const stepW = W / steps.length;
  const boxH = 38;
  const boxTop = (H - boxH) / 2;

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}>
      {steps.map((step, i) => {
        const x = i * stepW;
        const nextStep = steps[i + 1];
        const dropPct = nextStep && step.value > 0 ? Math.round((nextStep.value / step.value) * 100) : null;
        return (
          <g key={step.label}>
            <rect x={x + 4} y={boxTop} width={stepW - 8} height={boxH} rx={5}
              fill={`${step.color}22`} stroke={step.color} strokeWidth={1.5} />
            <text x={x + stepW / 2} y={boxTop + 15} textAnchor="middle" fontSize={13} fontWeight={700} fill={step.color}>
              {step.fmt(step.value)}
            </text>
            <text x={x + stepW / 2} y={boxTop + 30} textAnchor="middle" fontSize={10} fill="var(--fg-dim)">
              {step.label}
            </text>
            {dropPct !== null && (
              <g>
                <line x1={x + stepW - 6} y1={H / 2} x2={x + stepW + 4} y2={H / 2} stroke="var(--border)" strokeWidth={1.5} />
                <polygon points={`${x + stepW + 4},${H / 2 - 3} ${x + stepW + 4},${H / 2 + 3} ${x + stepW + 8},${H / 2}`} fill="var(--fg-dim)" />
                <text x={x + stepW + 1} y={H / 2 - 6} textAnchor="middle" fontSize={8} fill="var(--fg-dim)">{dropPct}%</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ?? AOI Score Bar Component ???????????????????????????????????????????????????
function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(score / max, 1) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--fg)', fontWeight: 700 }}>{Math.round(score)}<span style={{ color: 'var(--fg-dim)', fontWeight: 400 }}>/{max}</span></span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-raised)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct * 100}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

function getWeakestInsight(score: AoiScore): string {
  const components = [
    { label: 'Show Rate', score: score.show_rate_score, max: 20, insight: 'Focus on increasing dials-to-presentation ratio.' },
    { label: 'Close Rate', score: score.close_rate_score, max: 30, insight: 'Work on closing techniques ? target 60%+ close rate.' },
    { label: 'ALP Quality', score: score.alp_score, max: 20, insight: 'Pursue higher-value sales to increase ALP per recruit in pipeline.' },
    { label: 'Call Grade', score: score.call_grade_score, max: 20, insight: 'Improve call quality ? focus on longer, converted calls.' },
    { label: 'Momentum', score: score.trend_score, max: 10, insight: 'Activity is declining ? re-energize and build momentum.' },
  ];
  const weakest = components.reduce((a, b) => (a.score / a.max) < (b.score / b.max) ? a : b);
  return weakest.insight;
}

// ?? Demo Calls & AOI Radar Chart ?????????????????????????????????????????????
const DEMO_CALLS = [
  { id: 'demo-1', date: 'Mar 31', duration: '4m 12s', grade: 'A', converted: true,  resolution: 'appointment_set', summary: 'Strong call ? agent identified coverage gap and set appointment. Veteran market, TX.' },
  { id: 'demo-2', date: 'Mar 31', duration: '1m 45s', grade: 'D', converted: false, resolution: 'not_interested',  summary: 'Short engagement, prospect declined before benefits were explained.' },
  { id: 'demo-3', date: 'Mar 30', duration: '6m 03s', grade: 'A', converted: true,  resolution: 'sold',             summary: 'Excellent call ? agent closed a sale after handling price objection effectively.' },
  { id: 'demo-4', date: 'Mar 30', duration: '0m 18s', grade: 'F', converted: false, resolution: 'no_answer',        summary: 'No answer.' },
  { id: 'demo-5', date: 'Mar 29', duration: '2m 55s', grade: 'C', converted: false, resolution: 'in_progress',      summary: 'Warm engagement ? prospect requested callback, showed genuine interest in Globe Life.' },
];

function AoiRadarChart({
  aoiScore,
  gradeColors,
}: {
  aoiScore: AoiScore;
  gradeColors: { bg: string; fg: string; border: string };
}) {
  const cx = 100, cy = 105, r = 65;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const axes = [
    { label: 'Show Rate',   score: aoiScore.show_rate_score,  max: 20, angle: 270 },
    { label: 'Close Rate',  score: aoiScore.close_rate_score, max: 30, angle: 342 },
    { label: 'ALP Quality', score: aoiScore.alp_score,        max: 20, angle: 54  },
    { label: 'Call Grade',  score: aoiScore.call_grade_score, max: 20, angle: 126 },
    { label: 'Momentum',    score: aoiScore.trend_score,      max: 10, angle: 198 },
  ];

  const pt = (angle: number, dist: number) => ({
    x: cx + dist * Math.cos(toRad(angle)),
    y: cy + dist * Math.sin(toRad(angle)),
  });

  const polyPoints = (frac: number) =>
    axes.map(a => { const p = pt(a.angle, r * frac); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');

  const scorePolyPoints = axes.map(a => {
    const frac = a.max > 0 ? Math.min(a.score / a.max, 1) : 0;
    const p = pt(a.angle, r * frac);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const getAnchor = (angle: number): 'middle' | 'start' | 'end' => {
    const x = Math.cos(toRad(angle));
    if (x > 0.3) return 'start';
    if (x < -0.3) return 'end';
    return 'middle';
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, overflow: 'visible' }}>
      <svg width={200} height={210} viewBox="0 0 200 210" style={{ overflow: 'visible' }}>
        {/* Grid pentagons */}
        {[0.25, 0.5, 0.75, 1.0].map((frac, i) => (
          <polygon key={i} points={polyPoints(frac)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        ))}
        {/* Axis lines */}
        {axes.map((a, i) => {
          const op = pt(a.angle, r);
          return <line key={i} x1={cx} y1={cy} x2={op.x.toFixed(1)} y2={op.y.toFixed(1)} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />;
        })}
        {/* Score polygon */}
        <polygon points={scorePolyPoints} fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" strokeWidth={2} />
        {/* Axis labels */}
        {axes.map((a, i) => {
          const lp = pt(a.angle, r + 18);
          const anchor = getAnchor(a.angle);
          return (
            <g key={i}>
              <text x={lp.x.toFixed(1)} y={(lp.y - 4).toFixed(1)} textAnchor={anchor} fontSize={8} fill="rgba(255,255,255,0.5)" fontWeight={600}>{a.label}</text>
              <text x={lp.x.toFixed(1)} y={(lp.y + 8).toFixed(1)} textAnchor={anchor} fontSize={8} fill="rgba(255,255,255,0.8)" fontWeight={700}>{Math.round(a.score)}/{a.max}</text>
            </g>
          );
        })}
        {/* Center: total + grade */}
        <text x={cx} y={cy - 7} textAnchor="middle" fontSize={22} fontWeight={900} fill={gradeColors.fg}>{aoiScore.total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize={12} fontWeight={800} fill={gradeColors.fg}>{aoiScore.grade}</text>
      </svg>
    </div>
  );
}

// ?? Unified Agent Detail Panel ????????????????????????????????????????????????
function AgentDetail({
  row,
  onClose,
  embedded = false,
  onCallSelect,
}: {
  row: FunnelRow;
  onClose: () => void;
  embedded?: boolean;
  onCallSelect?: (data: { callId: string; scorecard: any; summary: string; grade: string; date: string; duration: string }) => void;
}) {
  const [panelVisible, setPanelVisible] = useState(false);

  // Score tab state
  const [aoiScore, setAoiScore] = useState<AoiScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // Calls tab state
  const [calls, setCalls] = useState<ScoredCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [scorecards, setScorecards] = useState<Record<string, any>>({});

  const loadScorecard = (callId: string) => {
    if (!callId || scorecards[callId] !== undefined) return;
    setScorecards(p => ({ ...p, [callId]: null })); // mark loading
    fetch(`/api/call-intelligence/scorecard/${encodeURIComponent(callId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setScorecards(p => ({ ...p, [callId]: d || null })))
      .catch(() => setScorecards(p => ({ ...p, [callId]: null })));
  };

  const SC_QUESTIONS = [
    { key: 'intro',               label: 'Intro' },
    { key: 'identified_need',     label: 'Identified Need' },
    { key: 'explained_benefits',  label: 'Benefits' },
    { key: 'handled_objection',   label: 'Objection' },
    { key: 'set_next_step',       label: 'Next Step' },
    { key: 'stayed_professional', label: 'Professional' },
  ];
  const [callFilters, setCallFilters] = useState({ appointments: true, presentations: true, sales: true, not_interested: true });
  const toggleFilter = (key: keyof typeof callFilters) => setCallFilters(p => ({ ...p, [key]: !p[key] }));

  // Tab state
  const [activeTab, setActiveTab] = useState<'score' | 'calls' | 'coaching'>('score');
  const [callFilter, setCallFilter] = useState<'all' | 'converted' | 'not_converted' | 'flagged'>('all');

  // Coaching tab state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [managerName, setManagerName] = useState(() => localStorage.getItem('aoi_manager_name') || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPanelVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Load score tab data
  useEffect(() => {
    if (!row.email) return;
    setScoreLoading(true);
    fetch(`/api/funnel/agent-score/${encodeURIComponent(row.email)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => { if (d && !d.error) setAoiScore(d); })
      .catch(() => {})
      .finally(() => setScoreLoading(false));
  }, [row.email]);

  // Load calls on mount
  useEffect(() => {
    if (!row.email) return;
    setCallsLoading(true);
    fetch(`/api/call-intelligence/agent/${encodeURIComponent(row.email)}?limit=15`)
      .then(r => r.ok ? r.json() : [])
      .then((d: any) => setCalls(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setCallsLoading(false));
  }, [row.email]);

  // Load coaching on mount
  useEffect(() => {
    if (!row.email) return;
    setCoachingLoading(true);
    Promise.all([
      fetch('/api/call-intelligence/alerts').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/call-intelligence/coaching/${encodeURIComponent(row.email)}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([alertsData, notesData]) => {
      setAlerts((Array.isArray(alertsData) ? alertsData : []).filter((a: any) => a.agent_email === row.email));
      setNotes(Array.isArray(notesData) ? notesData : []);
    }).finally(() => setCoachingLoading(false));
  }, [row.email]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !managerName.trim() || !row.email) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/call-intelligence/coaching/${encodeURIComponent(row.email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim(), manager: managerName.trim() }),
      });
      if (r.ok) {
        const entry = await r.json();
        setNotes(prev => [entry, ...prev]);
        setNoteText('');
        localStorage.setItem('aoi_manager_name', managerName.trim());
      }
    } catch {}
    setSubmitting(false);
  };

  const mktStyle = marketColor(row.market);
  const gradeForDisplay = aoiScore?.grade || row.aoi_grade || '?';
  const gradeColors = aoiGradeColor(gradeForDisplay);

  return (
    <div style={embedded ? {
      display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%',
      background: 'var(--bg-surface)',
    } : {
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 420,
      maxWidth: 'calc(100vw - 12px)',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-bright)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      zIndex: 80,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.35)',
      transform: panelVisible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 220ms ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 0', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>{row.agent_name}</span>
              <span style={{
                fontSize: 18, fontWeight: 900, padding: '2px 10px', borderRadius: 6,
                background: gradeColors.bg, color: gradeColors.fg, border: `1px solid ${gradeColors.border}`,
                letterSpacing: '0.02em',
              }}>{gradeForDisplay}</span>
              {row.market && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                  background: mktStyle.bg, color: mktStyle.fg, border: `1px solid ${mktStyle.border}`,
                }}>{row.market.toUpperCase()}</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
              ID: {row.associate_id}
              {row.email && <span style={{ marginLeft: 8 }}>{row.email}</span>}
            </div>
          </div>
          {!embedded && (
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--fg-dim)', cursor: 'pointer', padding: '4px 9px', fontSize: 13,
              }}
            >?</button>
          )}
        </div>      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0 }}>
        {(['score', 'calls', 'coaching'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: activeTab === tab ? 'var(--primary-fg)' : 'var(--fg-dim)',
              borderBottom: activeTab === tab ? '2px solid var(--primary-fg)' : '2px solid transparent',
            }}
          >
            {tab === 'score' ? 'Score' : tab === 'calls' ? 'Calls' : 'Coaching'}
          </button>
        ))}
      </div>

      {/* Tab content wrapper */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ?? Score Tab ?? */}
        {activeTab === 'score' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {/* Coaching warning banner */}
            {aoiScore && (aoiScore.grade === 'D' || aoiScore.grade === 'F') && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 6, padding: '8px 12px', marginBottom: 12,
                fontSize: 11, color: '#f87171',
              }}>
                ?? Needs Coaching ??? schedule a 1:1 with this agent
              </div>
            )}
            {scoreLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton w="100%" h={210} />
                {[...Array(5)].map((_, i) => <Skeleton key={i} w="100%" h={28} />)}
              </div>
            ) : aoiScore ? (
              <>
                <AoiRadarChart aoiScore={aoiScore} gradeColors={gradeColors} />
                <ScoreBar label="Show Rate" score={aoiScore.show_rate_score} max={20} color={aoiScore.show_rate_score >= 14 ? '#4ade80' : aoiScore.show_rate_score >= 8 ? '#fbbf24' : '#f87171'} />
                <ScoreBar label="Close Rate" score={aoiScore.close_rate_score} max={30} color={aoiScore.close_rate_score >= 21 ? '#4ade80' : aoiScore.close_rate_score >= 12 ? '#fbbf24' : '#f87171'} />
                <ScoreBar label="ALP Quality" score={aoiScore.alp_score} max={20} color={aoiScore.alp_score >= 14 ? '#4ade80' : aoiScore.alp_score >= 8 ? '#fbbf24' : '#f87171'} />
                <ScoreBar label="Call Grade" score={aoiScore.call_grade_score} max={20} color={aoiScore.call_grade_score >= 16 ? '#4ade80' : aoiScore.call_grade_score >= 10 ? '#fbbf24' : '#f87171'} />
                <ScoreBar label="Momentum" score={aoiScore.trend_score} max={10} color={aoiScore.trend_score >= 8 ? '#4ade80' : aoiScore.trend_score >= 5 ? '#fbbf24' : '#f87171'} />
                <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-raised)', borderRadius: 8, border: `1px solid ${gradeColors.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: gradeColors.fg, lineHeight: 1 }}>{aoiScore.total}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>/ 100</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: gradeColors.fg }}>Grade {aoiScore.grade}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 2 }}>AOI Performance Score</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>?? Coaching Insight</div>
                  <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>{getWeakestInsight(aoiScore)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 14 }}>
                  {[
                    { label: 'Close%', value: fmtPct(row.close_rate), color: closeColor(row.close_rate) },
                    { label: 'ALP', value: fmt$(row.alp), color: 'var(--fg)' },
                    { label: '$/Pres', value: fmt$(row.alp_per_pres), color: 'var(--fg)' },
                  ].map(s => (
                    <div key={s.label} style={{ ...CARD, padding: '6px 10px' }}>
                      <div style={labelStyle}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--fg-dim)', textAlign: 'center', padding: 24 }}>
                {row.email ? 'No score data available' : 'No email on file ??? cannot compute AOI Score'}
              </div>
            )}
          </div>
        )}

        {/* ?? Calls Tab ?? */}
        {activeTab === 'calls' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
              {!callsLoading && calls.length === 0 && (
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', alignSelf: 'center' }}>Demo</span>
              )}
              {(['all', 'converted', 'not_converted', 'flagged'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCallFilter(f)}
                  style={{
                    padding: '3px 10px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                    cursor: 'pointer',
                    background: callFilter === f ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: callFilter === f ? 'var(--primary-fg)' : 'var(--fg-dim)',
                    border: callFilter === f ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'converted' ? 'Converted' : f === 'not_converted' ? 'Not Converted' : 'Flagged'}
                </button>
              ))}
            </div>
            {callsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...Array(6)].map((_, i) => <Skeleton key={i} w="100%" h={38} />)}
              </div>
            ) : calls.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {DEMO_CALLS.filter(c => {
                  if (callFilter === 'converted') return c.converted === true;
                  if (callFilter === 'not_converted') return c.converted === false;
                  if (callFilter === 'flagged') return false;
                  return true;
                }).map(c => {
                  const gc = aoiGradeColor(c.grade);
                  const gradeLeftColor: Record<string, string> = { A: '#4ade80', B: '#6366f1', C: '#fbbf24', D: '#f97316', F: '#f87171' };
                  const isExpanded = expandedCall === c.id;
                  return (
                    <div
                      key={c.id}
                      style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderLeft: `3px solid ${gradeLeftColor[c.grade] || '#6366f1'}`, borderRadius: 6, padding: '7px 9px', cursor: 'pointer' }}
                      onClick={() => setExpandedCall(isExpanded ? null : c.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                        <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>{c.date}</span>
                        <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>{c.duration}</span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700, background: gc.bg, color: gc.fg, border: `1px solid ${gc.border}`, flexShrink: 0 }}>{c.grade}</span>
                        <span style={{ fontWeight: 700, fontSize: 11, flexShrink: 0, color: c.converted ? 'var(--green)' : 'var(--fg-dim)' }}>{c.converted ? '?' : '?'}</span>
                        <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.resolution}</span>
                        <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>{isExpanded ? '?' : '?'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>{c.summary}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {calls.filter(c => {
                  if (callFilter === 'converted') return c.converted === true;
                  if (callFilter === 'not_converted') return c.converted === false;
                  if (callFilter === 'flagged') return !!(c as any).flags?.length;
                  return true;
                }).map(c => {
                  const gc = aoiGradeColor(c.outcome_grade || 'F');
                  const gradeLeftColor: Record<string, string> = { A: '#4ade80', B: '#6366f1', C: '#fbbf24', D: '#f97316', F: '#f87171' };
                  const isExpanded = expandedCall === c.id;
                  const flags: string[] = (c as any).flags || [];
                  return (
                    <div
                      key={c.id}
                      style={{
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderLeft: `3px solid ${gradeLeftColor[c.outcome_grade || 'F'] || '#6366f1'}`,
                        borderRadius: 6, padding: '7px 9px', cursor: 'pointer',
                      }}
                      onClick={() => {
                        const next = isExpanded ? null : c.id;
                        setExpandedCall(next);
                        if (next && (c as any).vdp_call_id) {
                          loadScorecard((c as any).vdp_call_id);
                          if (onCallSelect) {
                            fetch(`/api/call-intelligence/scorecard/${encodeURIComponent((c as any).vdp_call_id)}`)
                              .then(r => r.ok ? r.json() : null)
                              .then(sc => onCallSelect({
                                callId: (c as any).vdp_call_id,
                                scorecard: sc,
                                summary: c.ai_summary || '',
                                grade: c.outcome_grade || '?',
                                date: fmtDate(c.call_date),
                                duration: c.duration_seconds ? `${Math.floor(c.duration_seconds/60)}m ${c.duration_seconds%60}s` : '?',
                              })).catch(() => {});
                          }
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                        <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>{fmtDate(c.call_date)}</span>
                        <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>
                          {c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : '?'}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700, background: gc.bg, color: gc.fg, border: `1px solid ${gc.border}`, flexShrink: 0 }}>{c.outcome_grade || '?'}</span>
                        <span style={{ fontWeight: 700, fontSize: 11, flexShrink: 0, color: c.converted ? 'var(--green)' : 'var(--fg-dim)' }}>{c.converted ? '?' : '?'}</span>
                        <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cnresolution || ''}</span>
                        <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>{isExpanded ? '?' : '?'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
                          {(c as any).vdp_call_id && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-dim)', marginBottom: 5 }}>Scorecard</div>
                              {scorecards[(c as any).vdp_call_id] === undefined ? (
                                <div style={{ fontSize: 9, color: 'var(--fg-dim)' }}>Loading...</div>
                              ) : scorecards[(c as any).vdp_call_id] === null ? (
                                <div style={{ fontSize: 9, color: 'var(--fg-dim)' }}>Not scored</div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {SC_QUESTIONS.map(q => {
                                    const passed = scorecards[(c as any).vdp_call_id!]?.scores?.[q.key];
                                    return (
                                      <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                                        <span style={{ color: passed ? 'var(--green)' : 'var(--red)', fontWeight: 700, flexShrink: 0 }}>{passed ? '?' : '?'}</span>
                                        <span style={{ color: passed ? 'var(--fg)' : 'var(--fg-dim)' }}>{q.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {c.ai_summary && (
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>{c.ai_summary}</p>
                          )}
                          {flags.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {flags.map((flag, fi) => (
                                <span key={fi} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{flag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ?? Coaching Tab ?? */}
        {activeTab === 'coaching' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Notes list - scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', paddingBottom: 8 }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Auto Alerts</div>
              {coachingLoading ? (
                <Skeleton w="100%" h={40} />
              ) : alerts.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--green)', padding: '8px 10px', background: 'rgba(34,197,94,0.08)', borderRadius: 5, border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16 }}>
                  ? No active alerts for this agent
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
                  {alerts.map((a, i) => {
                    const isCritical = a.severity === 'critical';
                    return (
                      <div key={i} style={{ padding: '7px 10px', borderRadius: 5, fontSize: 11, background: isCritical ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, color: isCritical ? '#f87171' : '#fbbf24' }}>
                        <span style={{ fontWeight: 700 }}>{isCritical ? '??' : '??'} {a.alert_type?.replace(/_/g, ' ').toUpperCase()}: </span>
                        {a.message}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ ...labelStyle, marginBottom: 8 }}>Coaching Notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {coachingLoading ? (
                  [...Array(3)].map((_, i) => <Skeleton key={i} w="100%" h={54} />)
                ) : notes.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No coaching notes yet</div>
                ) : notes.map((n: any) => (
                  <div key={n.id} style={{ background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border)', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-fg)' }}>{n.manager}</span>
                      <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{fmtDate(n.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>{n.note}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Add note form - pinned to bottom */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--bg-raised)' }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Add Note</div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Coaching note..."
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--fg)', fontSize: 12, padding: '7px 9px', fontFamily: 'inherit', marginBottom: 8 }}
              />
              <input
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Manager name"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--fg)', fontSize: 12, padding: '6px 9px', fontFamily: 'inherit', marginBottom: 8 }}
              />
              <button
                onClick={handleAddNote}
                disabled={submitting || !noteText.trim() || !managerName.trim()}
                style={{ width: '100%', padding: '8px', fontSize: 12, fontWeight: 700, background: 'var(--primary-soft)', color: 'var(--primary-fg)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 5, cursor: submitting ? 'wait' : 'pointer', opacity: (!noteText.trim() || !managerName.trim()) ? 0.5 : 1 }}
              >{submitting ? 'Saving...' : 'Save Note'}</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


// ?? SECTION 3: Agent Table ????????????????????????????????????????????????????
const GROUP_A = 'rgba(59,130,246,0.05)';
const GROUP_B = 'rgba(139,92,246,0.05)';
const GROUP_C = 'rgba(16,185,129,0.05)';
const GROUP_PRE = 'rgba(14,165,233,0.06)';

const GROUP_D = 'rgba(251,191,36,0.07)'; // amber ? Usage

function agentHasActivitySales(row: FunnelRow): boolean {
  return (
    (row.connect_dials ?? 0) > 0 ||
    (row.connect_reached ?? 0) > 0 ||
    (row.aoi_inbound ?? 0) > 0 ||
    (row.presentations ?? 0) > 0 ||
    (row.sales ?? 0) > 0 ||
    (row.alp ?? 0) > 0 ||
    (row.ho_submits ?? 0) > 0
  );
}

function agentHasActivityRecruit(row: FunnelRow): boolean {
  const pipe = row.recruit_pipeline_total ?? row.presentations ?? 0;
  return (
    pipe > 0 ||
    (row.connect_dials ?? 0) > 0 ||
    (row.connect_reached ?? 0) > 0 ||
    (row.aoi_inbound ?? 0) > 0
  );
}

function hpproShowPct(row: FunnelRow): number {
  const b = row.booked ?? 0;
  const p = row.presentations ?? 0;
  if (b <= 0) return 0;
  return Math.min(100, Math.round((p / b) * 1000) / 10);
}

function hpproPlusLeads(row: FunnelRow): number {
  return Math.max(0, (row.presentations ?? 0) - (row.sales ?? 0));
}

type ColDef = { key: SortKey; label: string; align?: 'right' | 'left' | 'center'; width: number; group?: string; groupBorder?: boolean; groupEnd?: boolean };

const COLS_BASE: ColDef[] = [
  { key: 'agent_name',    label: 'Agent',       align: 'left',   width: 160 },
  { key: 'aoi_grade',     label: 'AOI',         align: 'center', width: 40 },
  { key: 'aoi_ib',        label: 'AOI IB',      align: 'right',  width: 60,  group: GROUP_PRE, groupBorder: true },
  { key: 'missed_count',  label: 'Missed',      align: 'right',  width: 52,  group: GROUP_PRE },
  { key: 'ans_pct',       label: 'ANS %',       align: 'right',  width: 52,  group: GROUP_PRE, groupEnd: true },
  { key: 'dials',         label: 'Dials',       align: 'right',  width: 52,  group: GROUP_A, groupBorder: true },
  { key: 'booked',        label: 'Reached',     align: 'right',  width: 58,  group: GROUP_A },
  { key: 'book_rate',     label: 'Booked',      align: 'right',  width: 52,  group: GROUP_A, groupEnd: true },
];

const COLS_RECRUIT_PIPELINE: ColDef[] = [
  { key: 'recruit_first_interview', label: '1st Int', align: 'right', width: 48, group: GROUP_B, groupBorder: true },
  { key: 'recruit_virtual_overview', label: 'Virt. Ov.', align: 'right', width: 52, group: GROUP_B },
  { key: 'recruit_group_final', label: 'Grp Final', align: 'right', width: 52, group: GROUP_B },
  { key: 'recruit_hired', label: 'Hired',       align: 'right',  width: 48,  group: GROUP_B, groupEnd: true },
];

const COLS_HPPRO: ColDef[] = [
  { key: 'presentations', label: 'Pres',        align: 'right',  width: 44,  group: GROUP_B, groupBorder: true },
  { key: 'show_rate',     label: 'Show %',      align: 'right',  width: 52,  group: GROUP_B },
  { key: 'plus_leads',    label: 'Plus Leads',  align: 'right',  width: 64,  group: GROUP_B, groupEnd: true },
];

const COLS_SALES_REV: ColDef[] = [
  { key: 'sales',         label: 'Sales',       align: 'right',  width: 46,  group: GROUP_C, groupBorder: true },
  { key: 'close_rate',    label: 'Close %',     align: 'right',  width: 58,  group: GROUP_C },
  { key: 'alp',           label: 'ALP',         align: 'right',  width: 76,  group: GROUP_C },
  { key: 'avg_alp',       label: 'AVG ALP',     align: 'right',  width: 76,  group: GROUP_C, groupEnd: true },
];

const COLS_CREDITS: ColDef[] = [
  { key: 'aoi_score',     label: 'Credits',     align: 'right',  width: 58,  group: GROUP_D, groupBorder: true, groupEnd: true },
];

function colsForTrackerSegment(seg: 'sales' | 'recruit'): ColDef[] {
  if (seg === 'sales') return [...COLS_BASE, ...COLS_HPPRO, ...COLS_SALES_REV, ...COLS_CREDITS];
  return [...COLS_BASE, ...COLS_RECRUIT_PIPELINE, ...COLS_CREDITS];
}

function AgentTable({
  rows,
  selectedId,
  onSelect,
  highlightCol,
  trackerSegment,
}: {
  rows: FunnelRow[];
  selectedId: string | null;
  onSelect: (row: FunnelRow) => void;
  highlightCol: string | null;
  trackerSegment: 'sales' | 'recruit';
}) {
  const COLS = colsForTrackerSegment(trackerSegment);
  const [sortKey, setSortKey] = useState<SortKey>('presentations');
  const [sortAsc, setSortAsc] = useState(false);

  /** Same row ordering on both tabs — split only by “any” funnel touch; dimming is tab-specific below. */
  const anyFunnelActivity = (row: FunnelRow) =>
    agentHasActivitySales(row) || agentHasActivityRecruit(row);
  const active = rows.filter(anyFunnelActivity);
  const inactive = rows.filter((r) => !anyFunnelActivity(r));
  const dimForTab = trackerSegment === 'sales' ? agentHasActivitySales : agentHasActivityRecruit;

  useEffect(() => {
    setSortKey(trackerSegment === 'sales' ? 'presentations' : 'recruit_pipeline_total');
    setSortAsc(false);
  }, [trackerSegment]);

  const valueForSort = (row: FunnelRow, key: SortKey): number | string => {
    if (key === 'aoi_ib') return row.aoi_inbound ?? 0;
    if (key === 'missed_count') return Math.max(0, row.aoi_ib_ring - row.aoi_inbound);
    if (key === 'ans_pct') {
      return row.aoi_ib_ring > 0 ? (row.aoi_inbound / row.aoi_ib_ring) * 100 : 0;
    }
    if (key === 'dials') return row.connect_dials;
    if (key === 'booked') return row.connect_reached;
    if (key === 'book_rate') return row.book_rate;
    if (key === 'close_rate') return row.close_rate;
    if (key === 'show_rate') return hpproShowPct(row);
    if (key === 'plus_leads') return hpproPlusLeads(row);
    if (key === 'avg_alp') return row.alp_per_pres;
    if (key === 'aoi_grade') return row.aoi_score || 0;
    return (row as any)[key] ?? 0;
  };

  const sort = (arr: FunnelRow[]) =>
    [...arr].sort((a, b) => {
      const av = valueForSort(a, sortKey), bv = valueForSort(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number')
        return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const sorted = [...sort(active), ...sort(inactive)];

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: 'max-content', tableLayout: 'fixed' }}>
        <colgroup>
          {COLS.map(col => <col key={col.key} style={{ width: col.width }} />)}
        </colgroup>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          {/* Group header row */}
          <tr style={{ background: 'var(--bg-raised)' }}>
            <th style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--fg-dim)', borderBottom: '1px solid var(--border)' }} />
            <th style={{ padding: '5px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(16,185,129,0.8)', borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.05)' }}>Score</th>
            <th colSpan={3} style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(14,165,233,0.9)', background: GROUP_PRE, borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(14,165,233,0.3)', borderRight: '3px solid rgba(255,255,255,0.14)' }}>Call AOI Activity</th>
            <th colSpan={3} style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(59,130,246,0.8)', background: GROUP_A, borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(59,130,246,0.3)', borderRight: '3px solid rgba(255,255,255,0.14)' }}>Call Connector Pro</th>
            {trackerSegment === 'recruit' ? (
              <th colSpan={4} style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.8)', background: GROUP_B, borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(139,92,246,0.3)', borderRight: '3px solid rgba(255,255,255,0.14)' }}>Recruit pipeline</th>
            ) : (
              <>
                <th colSpan={3} style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.8)', background: GROUP_B, borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(139,92,246,0.3)', borderRight: '3px solid rgba(255,255,255,0.14)' }}>HPPRO</th>
                <th colSpan={4} style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(16,185,129,0.8)', background: GROUP_C, borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(16,185,129,0.3)', borderRight: '3px solid rgba(255,255,255,0.14)' }}>Sales &amp; Revenue</th>
              </>
            )}
            <th colSpan={1} style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.9)', background: GROUP_D, borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(251,191,36,0.3)', borderRight: '3px solid rgba(255,255,255,0.14)' }}>Usage</th>
          </tr>
          {/* Column header row */}
          <tr style={{ background: 'var(--bg-raised)' }}>
            {COLS.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  padding: '5px 7px',
                  textAlign: col.key === 'agent_name' ? 'left' : 'center',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                  borderBottom: '2px solid var(--border)',
                  borderRight: col.groupEnd ? '2px solid var(--border)' : col.group ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  borderLeft: col.groupBorder ? `2px solid ${col.group?.replace('0.07', '0.4').replace('0.05', '0.4')}` : undefined,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  color: sortKey === col.key ? 'var(--primary-fg)' : 'var(--fg-dim)',
                  background: col.group || 'var(--bg-raised)',
                  verticalAlign: 'bottom',
                }}
              >
                {col.label}{sortKey === col.key ? (sortAsc ? ' ?' : ' ?') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isSelected = row.associate_id === selectedId;
            const isDim = !dimForTab(row);
            const grade = row.aoi_grade || '';
            const gc = grade ? aoiGradeColor(grade) : null;
            return (
              <tr
                key={row.associate_id}
                onClick={() => onSelect(row)}
                style={{
                  cursor: 'pointer',
                  opacity: isDim ? 0.5 : 1,
                  background: isSelected
                    ? 'var(--primary-soft)'
                    : i % 2 === 0 ? 'transparent' : 'var(--bg-raised)',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={e => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-raised)';
                }}
              >
                {/* Agent */}
                <td style={{ padding: '5px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                  <span style={{ fontWeight: 600, color: 'var(--fg)', fontSize: 12 }}>{row.agent_name}</span>
                </td>
                {/* AOI Grade badge */}
                <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                  {gc ? (
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 800,
                      padding: '1px 5px', borderRadius: 4,
                      background: gc.bg, color: gc.fg, border: `1px solid ${gc.border}`,
                    }}>{grade}</span>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>?</span>
                  )}
                </td>
                {/* Call AOI — vdp_calls PICK_UP (AOI IB market) */}
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_PRE, borderLeft: '2px solid rgba(14,165,233,0.25)', borderRight: '1px solid rgba(255,255,255,0.06)', color: row.aoi_inbound > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                  {row.aoi_inbound > 0 ? row.aoi_inbound.toLocaleString() : '—'}
                </td>
                {/* AOI IB: ring events minus IB PICK_UP (vdp_calls) */}
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_PRE, borderRight: '1px solid rgba(255,255,255,0.06)', color: row.aoi_ib_ring > 0 ? (Math.max(0, row.aoi_ib_ring - row.aoi_inbound) > 0 ? 'var(--red)' : 'var(--fg-dim)') : 'var(--fg-dim)' }}>
                  {row.aoi_ib_ring > 0 ? Math.max(0, row.aoi_ib_ring - row.aoi_inbound).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_PRE, borderRight: '3px solid rgba(255,255,255,0.14)', color: row.aoi_ib_ring > 0 ? convColor((row.aoi_inbound / row.aoi_ib_ring) * 100) : 'var(--fg-dim)' }}>
                  {row.aoi_ib_ring > 0 ? fmtPct((row.aoi_inbound / row.aoi_ib_ring) * 100) : '—'}
                </td>
                {/* Call Connector Pro — Twilio dials / reach / book % */}
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_A, borderLeft: '2px solid rgba(59,130,246,0.25)', borderRight: '1px solid rgba(255,255,255,0.06)', color: row.connect_dials > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                  {row.connect_dials > 0 ? row.connect_dials.toLocaleString() : '—'}
                </td>
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_A, borderRight: '1px solid rgba(255,255,255,0.06)', color: row.connect_reached > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                  {row.connect_reached > 0 ? row.connect_reached.toLocaleString() : '—'}
                </td>
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_A, borderRight: '3px solid rgba(255,255,255,0.14)', color: row.connect_reached > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                  {row.connect_reached > 0 ? fmtPct(row.book_rate) : '—'}
                </td>
                {trackerSegment === 'recruit' ? (
                  <>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 600, background: GROUP_B, borderLeft: '2px solid rgba(139,92,246,0.25)', borderRight: '1px solid rgba(255,255,255,0.06)', color: (row.recruit_first_interview ?? 0) > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                      {(row.recruit_first_interview ?? 0) > 0 ? (row.recruit_first_interview ?? 0).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 600, background: GROUP_B, borderRight: '1px solid rgba(255,255,255,0.06)', color: (row.recruit_virtual_overview ?? 0) > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                      {(row.recruit_virtual_overview ?? 0) > 0 ? (row.recruit_virtual_overview ?? 0).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 600, background: GROUP_B, borderRight: '1px solid rgba(255,255,255,0.06)', color: (row.recruit_group_final ?? 0) > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                      {(row.recruit_group_final ?? 0) > 0 ? (row.recruit_group_final ?? 0).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 600, background: GROUP_B, borderRight: '3px solid rgba(255,255,255,0.14)', color: (row.recruit_hired ?? 0) > 0 ? 'var(--green)' : 'var(--fg-dim)' }}>
                      {(row.recruit_hired ?? 0) > 0 ? (row.recruit_hired ?? 0).toLocaleString() : '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 600, background: GROUP_B, borderLeft: '2px solid rgba(139,92,246,0.25)', borderRight: '1px solid rgba(255,255,255,0.06)', color: (row.presentations ?? 0) > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                      {(row.presentations ?? 0) > 0 ? (row.presentations ?? 0).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_B, borderRight: '1px solid rgba(255,255,255,0.06)', color: (row.booked ?? 0) > 0 && (row.presentations ?? 0) > 0 ? convColor(hpproShowPct(row)) : 'var(--fg-dim)' }}>
                      {(row.booked ?? 0) > 0 && (row.presentations ?? 0) > 0 ? fmtPct(hpproShowPct(row)) : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_B, borderRight: '3px solid rgba(255,255,255,0.14)', color: hpproPlusLeads(row) > 0 ? 'var(--amber)' : 'var(--fg-dim)' }}>
                      {(row.presentations ?? 0) > 0 ? hpproPlusLeads(row).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_C, borderLeft: '2px solid rgba(16,185,129,0.25)', borderRight: '1px solid rgba(255,255,255,0.06)', color: row.sales > 0 ? 'var(--green)' : 'var(--fg-dim)', fontWeight: row.sales > 0 ? 600 : 400 }}>
                      {row.sales > 0 ? row.sales.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 700, background: GROUP_C, borderRight: '1px solid rgba(255,255,255,0.06)', color: (row.presentations ?? 0) > 0 ? closeColor(row.close_rate) : 'var(--fg-dim)' }}>
                      {(row.presentations ?? 0) > 0 ? fmtPct(row.close_rate) : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_C, borderRight: '1px solid rgba(255,255,255,0.06)', color: row.alp > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                      {row.alp > 0 ? fmt$(row.alp) : '—'}
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_C, borderRight: '3px solid rgba(255,255,255,0.14)', color: row.alp_per_pres > 0 ? 'var(--fg)' : 'var(--fg-dim)' }}>
                      {row.alp_per_pres > 0 ? fmt$(row.alp_per_pres) : '—'}
                    </td>
                  </>
                )}
                {/* Credits (Usage) — AOI connect credits from user_credits */}
                <td style={{ padding: '3px 5px', textAlign: 'right', background: GROUP_D, borderLeft: '2px solid rgba(251,191,36,0.25)', borderRight: '3px solid rgba(255,255,255,0.14)', color: 'rgba(251,191,36,0.9)' }}>
                  {row.credits_used != null && row.credits_used > 0
                    ? row.credits_used.toLocaleString()
                    : row.credits_used === 0
                      ? '0'
                      : '—'}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 11 }}>
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ?? Main AOI Activity view (funnel table + analyzer) ??????????????????????????
export function Funnel() {
  const TABLE_PANEL_WIDTH = 980;
  const [days, setDays] = useState<DayOption>(30);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyComparison[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<FunnelRow | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [callExamData, setCallExamData] = useState<{ call: CallRecord; scorecard: Scorecard | null; notes: CoachingNote[]; agentEmail: string; stats: AgentStats | null } | null>(null);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [ciLeaderboard, setCiLeaderboard] = useState<Array<{ agent_email: string }>>([]);
  const [trackerSegment, setTrackerSegment] = useState<'sales' | 'recruit'>('sales');

  const filteredTableRows = useMemo(
    () =>
      rows.filter((r) =>
        trackerSegment === 'recruit' ? funnelRowIsRecruitSegment(r) : !funnelRowIsRecruitSegment(r),
      ),
    [rows, trackerSegment],
  );

  const normalizeKey = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

  const inferEmailForRow = (row: FunnelRow): string => {
    if (row.email) return row.email;
    const agentNorm = normalizeKey(row.agent_name);
    if (!agentNorm) return '';
    // Strong match: "johnsmith" <-> "john.smith@..."
    const strong = ciLeaderboard.find((r) => normalizeKey(r.agent_email.split('@')[0]) === agentNorm);
    if (strong?.agent_email) return strong.agent_email;
    // Weak match fallback
    const weak = ciLeaderboard.find((r) => normalizeKey(r.agent_email.split('@')[0]).includes(agentNorm) || agentNorm.includes(normalizeKey(r.agent_email.split('@')[0])));
    return weak?.agent_email || '';
  };

  const loadWeekly = useCallback(async () => {
    setLoadingWeekly(true);
    try {
      const data = await authFetch('/api/funnel/weekly-comparison').then(r => r.json());
      if (!data?.error && Array.isArray(data)) setWeeklyData(data);
    } catch {
      // silent
    } finally {
      setLoadingWeekly(false);
    }
  }, []);

  const loadTable = useCallback(async (d: DayOption, dr: { start: string; end: string } | null = null) => {
    setLoadingTable(true);
    setError(null);
    try {
      const params = dr
        ? `startDate=${dr.start}&endDate=${dr.end}`
        : `days=${d}`;
      const [rowData, sumData] = await Promise.all([
        authFetch(`/api/funnel?${params}`).then(r => r.json()),
        authFetch(`/api/funnel/summary?${params}`).then(r => r.json()),
      ]);
      if (rowData?.error) throw new Error(rowData.error);
      setRows(Array.isArray(rowData) ? rowData : []);
      setSummary(sumData?.error ? null : sumData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingTable(false);
    }
  }, []);

  // Load AOI scores batch and merge into rows
  const loadAoiScores = useCallback(async (currentRows: FunnelRow[]) => {
    try {
      const scoresData: Record<string, { grade: string; total: number }> = await authFetch('/api/funnel/scores').then(r => r.json());
      if (!scoresData || typeof scoresData !== 'object') return;
      setRows(prev => prev.map(r => {
        const s = r.email ? scoresData[r.email] : undefined;
        if (!s) return r;
        return { ...r, aoi_grade: s.grade, aoi_score: s.total };
      }));
      // Also update selected row if open
      if (selectedRow?.email) {
        const s = scoresData[selectedRow.email];
        if (s) setSelectedRow(prev => prev ? { ...prev, aoi_grade: s.grade, aoi_score: s.total } : null);
      }
    } catch {
      // silent ? non-critical
    }
  }, [selectedRow?.email]);

  useEffect(() => {
    loadWeekly();
  }, [loadWeekly]);

  useEffect(() => {
    authFetch('/api/call-intelligence/leaderboard')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setCiLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => setCiLeaderboard([]));
  }, []);

  useEffect(() => {
    loadTable(days, dateRange);
  }, [days, dateRange, loadTable]);

  // Load AOI scores after rows are available
  useEffect(() => {
    if (rows.length > 0) {
      loadAoiScores(rows);
    }
  }, [rows.length]); // intentionally just rows.length to avoid re-triggering

  useEffect(() => {
    if (!rows.length || !ciLeaderboard.length) return;
    setRows((prev) => prev.map((r) => (r.email ? r : { ...r, email: inferEmailForRow(r) })));
  }, [ciLeaderboard.length, rows.length]);

  useEffect(() => {
    if (!filteredTableRows.length) {
      setSelectedRow(null);
      return;
    }
    setSelectedRow((prev) => {
      if (prev && filteredTableRows.some((r) => r.associate_id === prev.associate_id)) return prev;
      return filteredTableRows[0];
    });
  }, [filteredTableRows]);

  const handleSelectRow = (row: FunnelRow) => {
    setSelectedRow(row);
    setSelectedCallId(null);
    setCallExamData(null);
  };

  const handleTrackerSegmentChange = (seg: 'sales' | 'recruit') => {
    setTrackerSegment(seg);
    setSelectedCallId(null);
    setCallExamData(null);
    setActiveMetric(null);
  };

  const handleMetricClick = (col: string) => {
    setActiveMetric(prev => prev === col ? null : col);
  };

  const DAY_OPTIONS: { label: string; value: DayOption }[] = [
    { label: '30d', value: 30 },
    { label: '60d', value: 60 },
    { label: '90d', value: 90 },
    { label: 'All', value: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ?? Header bar ?? */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', flex: 1 }}>
          AOI Activity
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            <span style={{ ...labelStyle, marginRight: 4, alignSelf: 'center' }}>Track:</span>
            {(['sales', 'recruit'] as const).map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => handleTrackerSegmentChange(seg)}
                style={{
                  padding: '3px 9px', fontSize: 10, fontWeight: 600, borderRadius: 4,
                  background: trackerSegment === seg ? 'var(--primary-soft)' : 'var(--bg-surface)',
                  color: trackerSegment === seg ? 'var(--primary-fg)' : 'var(--fg-dim)',
                  border: `1px solid ${trackerSegment === seg ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {seg}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ ...labelStyle, alignSelf: 'center' }}>Window:</span>
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setDays(opt.value); setDateRange(null); }}
                style={{
                  padding: '3px 9px', fontSize: 10, fontWeight: 600, borderRadius: 4,
                  background: !dateRange && days === opt.value ? 'var(--primary-soft)' : 'var(--bg-surface)',
                  color: !dateRange && days === opt.value ? 'var(--primary-fg)' : 'var(--fg-dim)',
                  border: `1px solid ${!dateRange && days === opt.value ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >{opt.label}</button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--fg-dim)', fontWeight: 600 }}>or</span>
              <input
                type="date"
                value={dateRange?.start || ''}
                onChange={e => {
                  const start = e.target.value;
                  if (start) setDateRange(dr => ({ start, end: dr?.end || start }));
                }}
                style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--bg-surface)', border: `1px solid ${dateRange ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  color: 'var(--fg)', cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>→</span>
              <input
                type="date"
                value={dateRange?.end || ''}
                onChange={e => {
                  const end = e.target.value;
                  if (end) setDateRange(dr => ({ start: dr?.start || end, end }));
                }}
                style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--bg-surface)', border: `1px solid ${dateRange ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  color: 'var(--fg)', cursor: 'pointer',
                }}
              />
              {dateRange && (
                <button
                  onClick={() => setDateRange(null)}
                  style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
                    border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 600,
                  }}
                >✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main split: Table left, Panel right */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: Agent Table — scrolls horizontally, fills remaining space */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SectionDivider label={`Agents · ${filteredTableRows.length}${summary ? ` (all markets ${summary.agent_count})` : ''}`} />
          {error ? (
            <div style={{ padding: 24, color: 'var(--red)', fontSize: 11, textAlign: 'center' }}>{error}</div>
          ) : loadingTable ? (
            <div style={{ padding: 24, color: 'var(--fg-dim)', fontSize: 12, textAlign: 'center' }}>Loading?</div>
          ) : (
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <AgentTable
                trackerSegment={trackerSegment}
                rows={filteredTableRows}
                selectedId={selectedRow?.associate_id ?? null}
                onSelect={handleSelectRow}
                highlightCol={activeMetric}
              />
            </div>
          )}
        </div>

        {/* Middle: Call Examination — slides in when a call is selected */}
        <div style={{
          width: callExamData ? 480 : 0,
          flexShrink: 0,
          borderLeft: callExamData ? '1px solid var(--border)' : 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--bg-surface)',
          transition: 'width 220ms ease',
        }}>
          {callExamData && (
            <>
              <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)' }}>Call Examination</div>
                <button onClick={() => { setSelectedCallId(null); setCallExamData(null); }} style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)', color: 'var(--fg-dim)', cursor: 'pointer', padding: '3px 9px', fontSize: 12 }}>Close</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 10 }}>
                {callExamData.scorecard
                  ? <ScorecardView scorecard={callExamData.scorecard} call={callExamData.call} agentEmail={callExamData.agentEmail} stats={callExamData.stats} notes={callExamData.notes} />
                  : <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>No manager scorecard found for this call.</div>}
              </div>
            </>
          )}
        </div>

        {/* Right: Agent Stats — always visible */}
        <div style={{
          width: 480, flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--bg-surface)',
        }}>
          {selectedRow ? (
            <MyScore
              email={selectedRow.email || (selectedRow.agent_name ? selectedRow.agent_name.toLowerCase().replace(/\s+/g, '') + '@aoglobelife.com' : '')}
              callSegment={trackerSegment}
              recruitPipeline={trackerSegment === 'recruit' ? {
                firstInterview: selectedRow.recruit_first_interview ?? 0,
                virtualOverview: selectedRow.recruit_virtual_overview ?? 0,
                groupFinal: selectedRow.recruit_group_final ?? 0,
                hired: selectedRow.recruit_hired ?? 0,
              } : undefined}
              selectedCallId={selectedCallId}
              onCallSelect={setSelectedCallId}
              onCallDataReady={(call, sc, notes, stats) => {
                if (call) setCallExamData({ call, scorecard: sc, notes, agentEmail: selectedRow.email, stats });
                else setCallExamData(null);
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--fg-dim)' }}>
              <div style={{ fontSize: 24 }}>??</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Select an agent</div>
              <div style={{ fontSize: 10 }}>Score ? Calls ? Coaching</div>
            </div>
          )}
        </div>
      </div>      {/* Skeleton CSS */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        textarea, input { outline: none; }
        textarea:focus, input:focus { border-color: rgba(99,102,241,0.5) !important; }
      `}</style>
    </div>
  );
}


