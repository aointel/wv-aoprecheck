import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../hooks/useApi';
import { AoiUsage } from './AoiUsage';
import { Funnel } from './Funnel';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeaderboardRow {
  agent_email: string;
  points: number;
  badge: 'bronze' | 'silver' | 'gold' | 'platinum';
  streak_days: number;
  calls_this_week: number;
  calls_total: number;
  conversion_rate: number;
  avg_grade: string;
  trend: 'up' | 'down' | 'flat';
}

interface Alert {
  agent_email: string;
  alert_type: string;
  message: string;
  severity: 'warning' | 'critical';
}

interface MatrixRow {
  agent_email: string;
  calls_this_week: number;
  conversion_rate: number;
  avg_grade_num: number;
}

interface TrendPoint {
  week_label: string;
  conversion_rate: number;
  total_calls: number;
  avg_grade_num: number;
}

interface Digest {
  top_performer: string;
  most_improved: string;
  needs_coaching: string[];
  team_conversion_rate: number;
  team_calls_this_week: number;
  week_over_week_change: number;
}

export interface CallRecord {
  id: string;
  vdp_call_id?: string;
  call_date: string;
  duration_seconds: number;
  outcome_grade: string;
  converted: boolean;
  ai_summary: string;
  cnresolution: string;
  flags: string[];
}

interface CoachingNote {
  id: string;
  note: string;
  manager: string;
  created_at: string;
  call_id?: string;
}

export interface Scorecard {
  scores: {
    intro: boolean;
    identified_need: boolean;
    explained_benefits: boolean;
    handled_objection: boolean;
    set_next_step: boolean;
    stayed_professional: boolean;
  };
  manager_notes: string;
  filled_by: string;
  filled_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function agentName(email: string) {
  const parts = email.split('@')[0].split(/[._]/);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function gradeColor(g: string) {
  switch (g) {
    case 'A': return 'var(--green)';
    case 'B': return 'var(--primary-fg)';
    case 'C': return 'var(--amber)';
    case 'D': return '#f97316';
    case 'F': return 'var(--red)';
    default: return 'var(--fg-dim)';
  }
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTime(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(s: number) {
  const total = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

const BADGE_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎',
};

const AGENT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6'];

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)',
};

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 16px',
};

// ── GradeBadge ────────────────────────────────────────────────────────────────
function GradeBadge({ grade }: { grade: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700,
      padding: '1px 6px', borderRadius: 4,
      background: `${gradeColor(grade)}22`,
      color: gradeColor(grade),
      border: `1px solid ${gradeColor(grade)}44`,
      minWidth: 20, textAlign: 'center',
    }}>{grade || '—'}</span>
  );
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = 'var(--primary-fg)' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const w = 80, h = 30, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}
    </svg>
  );
}

// ── Conv Ring Gauge ────────────────────────────────────────────────────────────
function ConvRingGauge({ pct }: { pct: number }) {
  const r = 16, size = 40;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--primary-fg)" strokeWidth={4}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--fg)" fontWeight={700}>
        {pct}
      </text>
    </svg>
  );
}

// ── Scatter Plot (Volume vs Quality) ─────────────────────────────────────────
function ScatterPlot({ matrix }: { matrix: MatrixRow[] }) {
  if (!matrix.length) return <div style={{ color: 'var(--fg-dim)', fontSize: 11 }}>No data</div>;
  const W = 340, H = 220, PL = 40, PR = 10, PT = 10, PB = 35;
  const cW = W - PL - PR, cH = H - PT - PB;

  const maxX = Math.max(...matrix.map(r => r.calls_this_week), 1);
  const maxY = Math.max(...matrix.map(r => r.conversion_rate), 1);

  function cx(v: number) { return PL + (v / maxX) * cW; }
  function cy(v: number) { return PT + cH - (v / maxY) * cH; }

  const xTicks = [0, Math.round(maxX / 2), maxX];
  const yTicks = [0, Math.round(maxY / 2), maxY];

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {/* Grid */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={cy(t)} y2={cy(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={PL - 4} y={cy(t) + 4} textAnchor="end" fontSize={9} fill="var(--fg-dim)">{t}%</text>
        </g>
      ))}
      {xTicks.map(t => (
        <g key={t}>
          <line x1={cx(t)} x2={cx(t)} y1={PT} y2={PT + cH} stroke="var(--border)" strokeWidth={1} />
          <text x={cx(t)} y={PT + cH + 14} textAnchor="middle" fontSize={9} fill="var(--fg-dim)">{t}</text>
        </g>
      ))}
      {/* Axis labels */}
      <text x={PL + cW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="var(--fg-dim)">Calls This Week</text>
      <text x={10} y={PT + cH / 2} textAnchor="middle" fontSize={9} fill="var(--fg-dim)"
        transform={`rotate(-90, 10, ${PT + cH / 2})`}>Conv%</text>
      {/* Dots */}
      {matrix.map((r, i) => {
        const x = cx(r.calls_this_week);
        const y = cy(r.conversion_rate);
        const color = AGENT_COLORS[i % AGENT_COLORS.length];
        return (
          <g key={r.agent_email}>
            <circle cx={x} cy={y} r={7} fill={color} opacity={0.85} />
            <text x={x} y={y - 10} textAnchor="middle" fontSize={9} fill="var(--fg)" fontWeight={600}>
              {agentName(r.agent_email).split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Multi-Agent Trend Line Chart ──────────────────────────────────────────────
function TrendChart({ trends }: { trends: Record<string, TrendPoint[]> }) {
  const emails = Object.keys(trends);
  if (!emails.length) return <div style={{ color: 'var(--fg-dim)', fontSize: 11 }}>No trend data</div>;

  const W = 340, H = 180, PL = 35, PR = 10, PT = 10, PB = 30;
  const cW = W - PL - PR, cH = H - PT - PB;
  const maxY = Math.max(...emails.flatMap(e => trends[e].map(p => p.conversion_rate)), 1);
  const numWeeks = Math.max(...emails.map(e => trends[e].length), 1);

  function cx(i: number) { return PL + (i / (numWeeks - 1)) * cW; }
  function cy(v: number) { return PT + cH - (v / maxY) * cH; }

  const yTicks = [0, Math.round(maxY / 2), maxY];

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={cy(t)} y2={cy(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={PL - 4} y={cy(t) + 4} textAnchor="end" fontSize={9} fill="var(--fg-dim)">{t}%</text>
        </g>
      ))}
      {emails.map((email, ei) => {
        const pts = trends[email];
        if (!pts.length) return null;
        const color = AGENT_COLORS[ei % AGENT_COLORS.length];
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.conversion_rate)}`).join(' ');
        return (
          <g key={email}>
            <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={cx(i)} cy={cy(p.conversion_rate)} r={3} fill={color} />
            ))}
          </g>
        );
      })}
      {/* X labels */}
      {(trends[emails[0]] || []).map((p, i) => (
        <text key={i} x={cx(i)} y={PT + cH + 14} textAnchor="middle" fontSize={9} fill="var(--fg-dim)">
          {p.week_label}
        </text>
      ))}
      {/* Legend */}
      {emails.map((email, ei) => (
        <g key={email} transform={`translate(${PL + ei * 65}, ${H - 6})`}>
          <circle cx={5} cy={0} r={4} fill={AGENT_COLORS[ei % AGENT_COLORS.length]} />
          <text x={12} y={4} fontSize={8} fill="var(--fg-dim)">{agentName(email).split(' ')[0]}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Scorecard Modal ───────────────────────────────────────────────────────────
const SCORECARD_QUESTIONS = [
  { key: 'intro', label: 'Delivered warm intro (name + company + greeting)' },
  { key: 'identified_need', label: 'Asked discovery questions before pitching' },
  { key: 'explained_benefits', label: 'Bridged prospect situation to specific benefits' },
  { key: 'handled_objection', label: 'Handled objection with correct response' },
  { key: 'set_next_step', label: 'Set clear next step / appointment' },
  { key: 'stayed_professional', label: 'Stayed professional throughout the call' },
];

export function ScorecardModal({
  call,
  existing,
  onSave,
  onClose,
}: {
  call: CallRecord;
  existing: Scorecard | null;
  onSave: (callId: string, data: Omit<Scorecard, 'filled_at'>) => void;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<Record<string, boolean>>(
    existing?.scores || Object.fromEntries(SCORECARD_QUESTIONS.map(q => [q.key, false]))
  );
  const [managerNotes, setManagerNotes] = useState(existing?.manager_notes || '');
  const [filledBy, setFilledBy] = useState(() => existing?.filled_by || (() => { try { return localStorage.getItem('aoi_manager_name') || ''; } catch { return ''; } })());
  const [saving, setSaving] = useState(false);

  const callId = call.vdp_call_id || call.id;
  const passed = Object.values(scores).filter(Boolean).length;

  const handleSave = async () => {
    if (!filledBy.trim()) return;
    setSaving(true);
    try {
      try { localStorage.setItem('aoi_manager_name', filledBy); } catch {}
      await authFetch(`/api/call-intelligence/scorecard/${encodeURIComponent(callId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores, manager_notes: managerNotes, filled_by: filledBy }),
      });
      onSave(callId, { scores: scores as Scorecard['scores'], manager_notes: managerNotes, filled_by: filledBy });
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 480, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>📋 Call Scorecard</div>
            <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>
              {fmtTime(call.call_date)} · {fmtDuration(call.duration_seconds)} · {call.cnresolution}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--fg-dim)', cursor: 'pointer', padding: '3px 8px', fontSize: 11,
          }}>✕</button>
        </div>

        {call.ai_summary && (
          <div style={{
            fontSize: 10, color: 'var(--fg-dim)', lineHeight: 1.55, fontStyle: 'italic',
            marginBottom: 10,
            background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px',
            border: '1px solid var(--border)',
          }}>{call.ai_summary}</div>
        )}
        {call.flags && call.flags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {call.flags.map((flag, fi) => (
              <span key={fi} style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}>{flag}</span>
            ))}
          </div>
        )}

        {/* Score bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          background: 'var(--bg-raised)', borderRadius: 6, padding: '8px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: passed >= 5 ? 'var(--green)' : passed >= 3 ? 'var(--amber)' : 'var(--red)' }}>
            {passed}/{SCORECARD_QUESTIONS.length}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-surface)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${(passed / SCORECARD_QUESTIONS.length) * 100}%`,
                background: passed >= 5 ? 'var(--green)' : passed >= 3 ? 'var(--amber)' : 'var(--red)',
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginTop: 3 }}>criteria met</div>
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {SCORECARD_QUESTIONS.map(q => (
            <label key={q.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: scores[q.key] ? 'rgba(34,197,94,0.08)' : 'var(--bg-raised)',
              border: `1px solid ${scores[q.key] ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
              borderRadius: 6, padding: '8px 12px',
              transition: 'all 0.15s',
              boxShadow: scores[q.key] ? '0 0 0 2px rgba(34,197,94,0.18)' : 'none',
            }}>
              <input
                type="checkbox"
                checked={!!scores[q.key]}
                onChange={e => setScores(s => ({ ...s, [q.key]: e.target.checked }))}
                style={{ width: 14, height: 14, accentColor: 'var(--green)', flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, color: scores[q.key] ? 'var(--fg)' : 'var(--fg-dim)' }}>{q.label}</span>
            </label>
          ))}
        </div>

        {/* Manager notes */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelStyle, marginBottom: 5 }}>Manager Notes</div>
          <textarea
            value={managerNotes}
            onChange={e => setManagerNotes(e.target.value)}
            placeholder="Add coaching notes for this call..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '6px 10px', color: 'var(--fg)', fontSize: 11, outline: 'none',
            }}
          />
        </div>

        {/* Filled by */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 5 }}>Your Name</div>
          <input
            value={filledBy}
            onChange={e => setFilledBy(e.target.value)}
            placeholder="Manager name..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '5px 10px', color: 'var(--fg)', fontSize: 11, outline: 'none',
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !filledBy.trim()}
          style={{
            width: '100%', padding: '8px', borderRadius: 6,
            background: filledBy.trim() ? 'var(--primary-soft)' : 'var(--bg-raised)',
            color: filledBy.trim() ? 'var(--primary-fg)' : 'var(--fg-dim)',
            border: '1px solid rgba(99,102,241,0.3)',
            fontWeight: 700, fontSize: 12, cursor: filledBy.trim() ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Saving...' : '✓ Save Scorecard'}
        </button>
      </div>
    </div>
  );
}

// ── Agent Drawer (slide-over) ─────────────────────────────────────────────────
function AgentDrawer({
  email,
  leaderboard,
  alerts,
  onClose,
}: {
  email: string;
  leaderboard: LeaderboardRow[];
  alerts: Alert[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'coaching'>('overview');
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoringCall, setScoringCall] = useState<CallRecord | null>(null);
  const [existingScorecard, setExistingScorecard] = useState<Scorecard | null>(null);
  const [callFilter, setCallFilter] = useState<'all' | 'converted' | 'not_converted' | 'flagged'>('all');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteManager, setNoteManager] = useState(() => {
    try { return localStorage.getItem('aoi_manager_name') || ''; } catch { return ''; }
  });
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const row = leaderboard.find(r => r.agent_email === email);
  const agentAlerts = alerts.filter(a => a.agent_email === email);
  const isLowGrade = row && (row.avg_grade === 'D' || row.avg_grade === 'F');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      authFetch(`/api/call-intelligence/agent/${encodeURIComponent(email)}?limit=20`).then(r => r.json()),
      authFetch(`/api/call-intelligence/coaching/${encodeURIComponent(email)}`).then(r => r.json()),
      authFetch(`/api/call-intelligence/trend/${encodeURIComponent(email)}`).then(r => r.json()),
    ]).then(([c, n, t]) => {
      setCalls(Array.isArray(c) ? c : []);
      setNotes(Array.isArray(n) ? n : []);
      setTrend(Array.isArray(t) ? t : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [email]);

  const openScorecard = async (call: CallRecord) => {
    const cid = call.vdp_call_id || call.id;
    try {
      const r = await authFetch(`/api/call-intelligence/scorecard/${encodeURIComponent(cid)}`);
      if (r.ok) setExistingScorecard(await r.json());
      else setExistingScorecard(null);
    } catch { setExistingScorecard(null); }
    setScoringCall(call);
  };

  const submitNote = async () => {
    if (!noteText.trim() || !noteManager.trim()) return;
    setNoteSubmitting(true);
    try {
      try { localStorage.setItem('aoi_manager_name', noteManager); } catch {}
      const r = await authFetch(`/api/call-intelligence/coaching/${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText, manager: noteManager }),
      });
      if (r.ok) {
        const newNote = await r.json();
        setNotes(n => [newNote, ...n]);
        setNoteText('');
      }
    } finally { setNoteSubmitting(false); }
  };

  const filteredCalls = calls.filter(c => {
    if (callFilter === 'converted') return c.converted;
    if (callFilter === 'not_converted') return !c.converted;
    if (callFilter === 'flagged') return c.flags && c.flags.length > 0;
    return true;
  });

  return (
    <>
      <style>{`@keyframes aoi-flicker{0%,100%{opacity:1}50%{opacity:0.35}}.aoi-streak-flame{animation:aoi-flicker 0.75s ease-in-out infinite;display:inline-block;}@keyframes aoi-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}.aoi-drawer{animation:aoi-slide-in 0.25s ease forwards;}`}</style>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)' }} />
      {/* Drawer panel */}
      <div className="aoi-drawer" style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 460,
        zIndex: 1000, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-raised)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {row ? BADGE_EMOJI[row.badge] : ''} {agentName(email)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{email}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--fg-dim)', cursor: 'pointer', padding: '3px 8px', fontSize: 11,
          }}>✕</button>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0 }}>
          {(['overview', 'calls', 'coaching'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: '8px 0', fontSize: 11,
              fontWeight: activeTab === t ? 700 : 500,
              color: activeTab === t ? 'var(--primary-fg)' : 'var(--fg-dim)',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeTab === t ? 'var(--primary-fg)' : 'transparent'}`,
              cursor: 'pointer',
            }}>
              {t === 'overview' ? 'Overview' : t === 'calls' ? 'Calls' : 'Coaching'}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ── */}
        {activeTab === 'overview' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isLowGrade && (
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                color: 'var(--red)', fontSize: 11, fontWeight: 600,
              }}>⚠️ Needs Coaching — schedule a 1:1</div>
            )}
            {row && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ ...CARD, flex: '1 1 70px', padding: '8px 10px' }}>
                  <div style={labelStyle}>Points</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>{row.points.toLocaleString()}</div>
                </div>
                <div style={{ ...CARD, flex: '1 1 70px', padding: '8px 10px' }}>
                  <div style={labelStyle}>Streak</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: row.streak_days > 0 ? 'var(--amber)' : 'var(--fg)', marginTop: 2 }}>
                    {row.streak_days >= 3
                      ? <><span className="aoi-streak-flame">🔥</span>{row.streak_days}d</>
                      : `🔥${row.streak_days}d`
                    }
                  </div>
                </div>
                <div style={{ ...CARD, flex: '1 1 70px', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={labelStyle}>Conv%</div>
                  <ConvRingGauge pct={row.conversion_rate} />
                </div>
                <div style={{ ...CARD, flex: '1 1 70px', padding: '8px 10px', borderLeft: `4px solid ${gradeColor(row.avg_grade)}` }}>
                  <div style={labelStyle}>Avg Grade</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}><GradeBadge grade={row.avg_grade} /></div>
                </div>
              </div>
            )}
            {trend.length > 0 && (
              <div style={{ ...CARD }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>4-Week Trend</div>
                <Sparkline data={trend.map(t => t.conversion_rate)} color="var(--primary-fg)" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  {trend.map(t => <span key={t.week_label} style={{ fontSize: 8, color: 'var(--fg-dim)' }}>{t.week_label}</span>)}
                </div>
              </div>
            )}
            {agentAlerts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {agentAlerts.map((a, i) => (
                  <div key={i} style={{
                    padding: '6px 10px', borderRadius: 5, fontSize: 10,
                    background: a.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    color: a.severity === 'critical' ? 'var(--red)' : 'var(--amber)',
                  }}>{a.severity === 'critical' ? '🚨' : '⚠️'} {a.message}</div>
                ))}
              </div>
            )}
            {loading && <div style={{ fontSize: 11, color: 'var(--fg-dim)', textAlign: 'center' }}>Loading...</div>}
          </div>
        )}

        {/* ── Tab: Calls ── */}
        {activeTab === 'calls' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
              {(['all', 'converted', 'not_converted', 'flagged'] as const).map(f => (
                <button key={f} onClick={() => setCallFilter(f)} style={{
                  padding: '3px 9px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  background: callFilter === f ? 'var(--primary-soft)' : 'var(--bg-raised)',
                  color: callFilter === f ? 'var(--primary-fg)' : 'var(--fg-dim)',
                  border: `1px solid ${callFilter === f ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                }}>
                  {f === 'all' ? 'All' : f === 'converted' ? 'Converted' : f === 'not_converted' ? 'Not Converted' : 'Flagged'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {loading ? (
                <div style={{ fontSize: 11, color: 'var(--fg-dim)', textAlign: 'center' }}>Loading...</div>
              ) : filteredCalls.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No calls found</div>
              ) : filteredCalls.map(call => {
                const isExpanded = expandedCall === call.id;
                return (
                  <div key={call.id} style={{
                    background: 'var(--bg-raised)', borderRadius: 6,
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${gradeColor(call.outcome_grade)}`,
                    overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 9, color: 'var(--fg-dim)', flex: 1 }}>{fmtDate(call.call_date)}</span>
                      <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{fmtDuration(call.duration_seconds)}</span>
                      <GradeBadge grade={call.outcome_grade} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: call.converted ? 'var(--green)' : 'var(--fg-dim)' }}>
                        {call.converted ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border)' }}>
                        {call.ai_summary && (
                          <div style={{
                            fontSize: 10, color: 'var(--fg-dim)', lineHeight: 1.55, fontStyle: 'italic',
                            marginTop: 8, marginBottom: 8,
                            background: 'var(--bg-surface)', borderRadius: 4, padding: '6px 8px',
                            border: '1px solid var(--border)',
                          }}>{call.ai_summary}</div>
                        )}
                        {call.flags && call.flags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {call.flags.map((flag, fi) => (
                              <span key={fi} style={{
                                fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 600,
                                background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
                                border: '1px solid rgba(239,68,68,0.3)',
                              }}>{flag}</span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); openScorecard(call); }}
                          style={{
                            fontSize: 10, padding: '3px 9px', borderRadius: 4,
                            background: 'var(--primary-soft)', color: 'var(--primary-fg)',
                            border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', fontWeight: 600,
                          }}
                        >📋 Scorecard</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Coaching ── */}
        {activeTab === 'coaching' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Notes timeline scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Coaching Notes</div>
              {notes.length === 0 ? (
                <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>No coaching notes yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {notes.map(n => (
                    <div key={n.id} style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 5, padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--primary-fg)' }}>{n.manager}</span>
                        <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{fmtDate(n.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.5 }}>{n.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Add-note form pinned to bottom */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0 }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add coaching note..."
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'none',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '5px 8px', color: 'var(--fg)', fontSize: 10,
                  outline: 'none', marginBottom: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={noteManager}
                  onChange={e => setNoteManager(e.target.value)}
                  placeholder="Your name"
                  style={{
                    flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '4px 8px', color: 'var(--fg)', fontSize: 10, outline: 'none',
                  }}
                />
                <button
                  onClick={submitNote}
                  disabled={noteSubmitting || !noteText.trim() || !noteManager.trim()}
                  style={{
                    padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                    background: noteText.trim() && noteManager.trim() ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: noteText.trim() && noteManager.trim() ? 'var(--primary-fg)' : 'var(--fg-dim)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    cursor: noteSubmitting ? 'default' : 'pointer',
                  }}
                >{noteSubmitting ? '...' : 'Add'}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {scoringCall && (
        <ScorecardModal
          call={scoringCall}
          existing={existingScorecard}
          onSave={() => {}}
          onClose={() => setScoringCall(null)}
        />
      )}
    </>
  );
}

// ── Coaching Notes Panel ──────────────────────────────────────────────────────
function CoachingNotesPanel({ email, notes, onNotesChange }: {
  email: string;
  notes: CoachingNote[];
  onNotesChange: (notes: CoachingNote[]) => void;
}) {
  const [noteText, setNoteText] = useState('');
  const [manager, setManager] = useState(() => { try { return localStorage.getItem('aoi_manager_name') || ''; } catch { return ''; } });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!noteText.trim() || !manager.trim()) return;
    setSubmitting(true);
    try {
      const r = await authFetch(`/api/call-intelligence/coaching/${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText, manager }),
      });
      if (r.ok) {
        const newNote = await r.json();
        onNotesChange([newNote, ...notes]);
        setNoteText('');
        try { localStorage.setItem('aoi_manager_name', manager); } catch { /* noop */ }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>Coaching Notes</div>

      {/* Add note form */}
      <div style={{ ...CARD, marginBottom: 10, padding: '10px 12px' }}>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Add coaching note..."
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'none',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '5px 8px', color: 'var(--fg)', fontSize: 10,
            outline: 'none', marginBottom: 6,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={manager}
            onChange={e => setManager(e.target.value)}
            placeholder="Your name"
            style={{
              flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '4px 8px', color: 'var(--fg)', fontSize: 10, outline: 'none',
            }}
          />
          <button
            onClick={submit}
            disabled={submitting || !noteText.trim() || !manager.trim()}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
              background: noteText.trim() && manager.trim() ? 'var(--primary-soft)' : 'var(--bg-raised)',
              color: noteText.trim() && manager.trim() ? 'var(--primary-fg)' : 'var(--fg-dim)',
              border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer',
            }}
          >Add</button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--fg-dim)' }}>No coaching notes yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {notes.map(n => (
            <div key={n.id} style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '7px 10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--primary-fg)' }}>{n.manager}</span>
                <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>{fmtDate(n.created_at)}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.5 }}>{n.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Leaderboard ────────────────────────────────────────────────────────
function LeaderboardTab({ leaderboard, alerts, loading, selectedAgent, onSelectAgent, onClosePanel }: {
  leaderboard: LeaderboardRow[];
  alerts: Alert[];
  loading: boolean;
  selectedAgent: string | null;
  onSelectAgent: (email: string) => void;
  onClosePanel: () => void;
}) {
  const colWidths = ['42px', '220px', '58px', '84px', '74px', '82px', '68px', '60px', '58px'];
  return (
    <>
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Alerts banner */}
        {alerts.length > 0 && (
          <div style={{
            padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5,
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            {alerts.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', borderRadius: 6,
                background: a.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}>
                <span style={{ fontSize: 11 }}>{a.severity === 'critical' ? '🚨' : '⚠️'}</span>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: a.severity === 'critical' ? 'var(--red)' : 'var(--amber)',
                  }}>{agentName(a.agent_email)}: </span>
                  <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{a.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--fg-dim)', fontSize: 12, textAlign: 'center' }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', minWidth: 760, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
              <colgroup>
                {colWidths.map((w, idx) => (
                  <col key={idx} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', position: 'sticky', top: 0 }}>
                  {['#', 'Agent', 'Badge', 'Points', 'Streak', 'Calls/Wk', 'Conv%', 'Grade', 'Trend'].map(h => (
                    <th key={h} style={{
                      padding: '6px 10px', textAlign: h === 'Agent' ? 'left' : 'center',
                      ...labelStyle, borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr
                    key={row.agent_email}
                    onClick={() => onSelectAgent(row.agent_email)}
                    style={{
                      cursor: 'pointer',
                      background: selectedAgent === row.agent_email ? 'var(--primary-soft)' : i % 2 === 0 ? 'transparent' : 'var(--bg-raised)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => { if (selectedAgent !== row.agent_email) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, rgba(255,255,255,0.04))'; }}
                    onMouseLeave={e => { if (selectedAgent !== row.agent_email) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-raised)'; }}
                  >
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--fg-dim)', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '7px 10px', minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--fg)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={agentName(row.agent_email)}
                      >
                        {agentName(row.agent_email)}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: 'var(--fg-dim)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={row.agent_email}
                      >
                        {row.agent_email}
                      </div>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 16 }}>{BADGE_EMOJI[row.badge]}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--fg)' }}>{row.points.toLocaleString()}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: row.streak_days > 0 ? 'var(--amber)' : 'var(--fg-dim)' }}>
                      {row.streak_days > 0 ? `🔥${row.streak_days}` : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--fg)' }}>{row.calls_this_week}</td>
                    <td style={{
                      padding: '7px 10px', textAlign: 'center', fontWeight: 700,
                      color: row.conversion_rate >= 20 ? 'var(--green)' : row.conversion_rate >= 10 ? 'var(--amber)' : 'var(--red)',
                    }}>{row.conversion_rate}%</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}><GradeBadge grade={row.avg_grade} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 14,
                      color: row.trend === 'up' ? 'var(--green)' : row.trend === 'down' ? 'var(--red)' : 'var(--fg-dim)' }}>
                      {row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '→'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>

    {selectedAgent && (
      <AgentDrawer
        email={selectedAgent}
        leaderboard={leaderboard}
        alerts={alerts}
        onClose={onClosePanel}
      />
    )}
    </>
  );
}

// ── Tab 2: Analytics ──────────────────────────────────────────────────────────
function AnalyticsTab({ digest, leaderboard, loading, selectedAgent, onSelectAgent }: {
  digest: Digest | null;
  leaderboard: LeaderboardRow[];
  loading: boolean;
  selectedAgent: string | null;
  onSelectAgent: (email: string) => void;
}) {
  const [trends, setTrends] = useState<Record<string, TrendPoint[]>>({});
  const [trendsLoading, setTrendsLoading] = useState(false);

  useEffect(() => {
    const emails = leaderboard.map(r => r.agent_email);
    if (!emails.length) return;
    setTrendsLoading(true);
    Promise.all(
      emails.map(email =>
        authFetch(`/api/call-intelligence/trend/${encodeURIComponent(email)}`).then(r => r.json()).then(t => ({ email, t }))
      )
    ).then(results => {
      const m: Record<string, TrendPoint[]> = {};
      for (const { email, t } of results) if (Array.isArray(t)) m[email] = t;
      setTrends(m);
    }).catch(() => {}).finally(() => setTrendsLoading(false));
  }, [leaderboard]);

  if (loading) return <div style={{ padding: 24, color: 'var(--fg-dim)', fontSize: 12, textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Digest card */}
      {digest && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 10 }}>📊 Weekly Digest</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            {[
              { label: 'Team Conv%', value: `${digest.team_conversion_rate}%`, color: 'var(--fg)' },
              { label: 'Calls This Week', value: digest.team_calls_this_week.toString(), color: 'var(--fg)' },
              {
                label: 'WoW Change',
                value: `${digest.week_over_week_change >= 0 ? '+' : ''}${digest.week_over_week_change}%`,
                color: digest.week_over_week_change >= 0 ? 'var(--green)' : 'var(--red)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...CARD, flex: '1 1 80px', padding: '8px 12px' }}>
                <div style={labelStyle}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {digest.top_performer && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ ...labelStyle, color: 'var(--green)' }}>🏆 Top Performer </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{agentName(digest.top_performer)}</span>
              </div>
            )}
            {digest.most_improved && (
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ ...labelStyle, color: 'var(--primary-fg)' }}>📈 Most Improved </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-fg)' }}>{agentName(digest.most_improved)}</span>
              </div>
            )}
            {digest.needs_coaching.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ ...labelStyle, color: 'var(--red)' }}>🎯 Needs Coaching </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>
                  {digest.needs_coaching.map(agentName).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent selector (shared with coaching card) */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>🎯 Agent Selector (drives coaching card)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
          {leaderboard.map((row) => (
            <button
              key={row.agent_email}
              onClick={() => onSelectAgent(row.agent_email)}
              style={{
                textAlign: 'left',
                padding: '7px 9px',
                borderRadius: 6,
                cursor: 'pointer',
                border: `1px solid ${selectedAgent === row.agent_email ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                background: selectedAgent === row.agent_email ? 'var(--primary-soft)' : 'var(--bg-raised)',
                color: selectedAgent === row.agent_email ? 'var(--primary-fg)' : 'var(--fg)',
                fontSize: 11,
                fontWeight: selectedAgent === row.agent_email ? 700 : 500,
              }}
            >
              {agentName(row.agent_email)} <span style={{ color: 'var(--fg-dim)', fontWeight: 500 }}>({row.conversion_rate}% conv)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trend lines */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)', marginBottom: 10 }}>📈 4-Week Conversion Trends</div>
        {trendsLoading ? (
          <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Loading trends...</div>
        ) : (
          <TrendChart trends={trends} />
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Coaching ───────────────────────────────────────────────────────────
function CoachingTab({ leaderboard, alerts, loading, selectedAgent }: {
  leaderboard: LeaderboardRow[];
  alerts: Alert[];
  loading: boolean;
  selectedAgent: string | null;
}) {
  const [agentCalls, setAgentCalls] = useState<CallRecord[]>([]);
  const [agentNotes, setAgentNotes] = useState<CoachingNote[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [scoringCall, setScoringCall] = useState<CallRecord | null>(null);
  const [existingScorecard, setExistingScorecard] = useState<Scorecard | null>(null);

  useEffect(() => {
    if (!selectedAgent) return;
    setAgentLoading(true);
    Promise.all([
      authFetch(`/api/call-intelligence/agent/${encodeURIComponent(selectedAgent)}?limit=10`).then(r => r.json()),
      authFetch(`/api/call-intelligence/coaching/${encodeURIComponent(selectedAgent)}`).then(r => r.json()),
    ])
      .then(([calls, notes]) => {
        setAgentCalls(Array.isArray(calls) ? calls : []);
        setAgentNotes(Array.isArray(notes) ? notes : []);
      })
      .catch(() => {})
      .finally(() => setAgentLoading(false));
  }, [selectedAgent]);

  const openScorecard = async (call: CallRecord) => {
    const cid = call.vdp_call_id || call.id;
    try {
      const r = await authFetch(`/api/call-intelligence/scorecard/${encodeURIComponent(cid)}`);
      if (r.ok) setExistingScorecard(await r.json());
      else setExistingScorecard(null);
    } catch { setExistingScorecard(null); }
    setScoringCall(call);
  };

  const agentAlertMap: Record<string, Alert[]> = {};
  for (const a of alerts) {
    if (!agentAlertMap[a.agent_email]) agentAlertMap[a.agent_email] = [];
    agentAlertMap[a.agent_email].push(a);
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedAgent ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontSize: 12 }}>
            Select an agent above to load coaching
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Agent stats header */}
            {(() => {
              const row = leaderboard.find(r => r.agent_email === selectedAgent);
              if (!row) return null;
              return (
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-raised)', display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>
                      {BADGE_EMOJI[row.badge]} {agentName(selectedAgent)}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginTop: 2 }}>
                      {row.calls_total} total calls · {row.conversion_rate}% conv · {row.points.toLocaleString()} pts
                    </div>
                  </div>
                  <GradeBadge grade={row.avg_grade} />
                </div>
              );
            })()}

            {/* Alert badges for this agent */}
            {(agentAlertMap[selectedAgent] || []).length > 0 && (
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(agentAlertMap[selectedAgent] || []).map((a, i) => (
                  <div key={i} style={{
                    padding: '5px 10px', borderRadius: 5, fontSize: 10,
                    background: a.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    color: a.severity === 'critical' ? 'var(--red)' : 'var(--amber)',
                  }}>
                    {a.severity === 'critical' ? '🚨' : '⚠️'} {a.message}
                  </div>
                ))}
              </div>
            )}

            {/* Coaching notes */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <CoachingNotesPanel
                email={selectedAgent}
                notes={agentNotes}
                onNotesChange={setAgentNotes}
              />
            </div>

            {/* Recent calls with score buttons */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Recent Calls</div>
              {agentLoading ? (
                <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Loading...</div>
              ) : agentCalls.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No calls found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {agentCalls.map(call => (
                    <div key={call.id} style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: 'var(--fg-dim)', flex: 1 }}>{fmtTime(call.call_date)}</span>
                        <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{fmtDuration(call.duration_seconds)}</span>
                        <GradeBadge grade={call.outcome_grade} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: call.converted ? 'var(--green)' : 'var(--fg-dim)' }}>
                          {call.converted ? '✓ Appt' : '✕'}
                        </span>
                        <button
                          onClick={() => openScorecard(call)}
                          style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            background: 'var(--primary-soft)', color: 'var(--primary-fg)',
                            border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', fontWeight: 600,
                          }}
                        >📋 Score</button>
                      </div>
                      {call.cnresolution && (
                        <div style={{ fontSize: 9, color: 'var(--fg-dim)' }}>
                          Resolution: <span style={{ color: 'var(--fg)' }}>{call.cnresolution}</span>
                        </div>
                      )}
                      {call.ai_summary && (
                        <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginTop: 3, fontStyle: 'italic', lineHeight: 1.5 }}>
                          {call.ai_summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {scoringCall && (
        <ScorecardModal
          call={scoringCall}
          existing={existingScorecard}
          onSave={() => {}}
          onClose={() => setScoringCall(null)}
        />
      )}
    </div>
  );
}

// ── Tab 4: Playbook ───────────────────────────────────────────────────────────
function PlaybookTab() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Framework */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', marginBottom: 12 }}>
            🗺️ THE 5-STEP CALL FRAMEWORK
          </div>
          {[
            {
              num: 1, title: 'Warm Intro', time: '0-30s',
              content: '"Hi [name], this is [agent] with Globe Life / AOI. How are you today?" — never launch into pitch without greeting',
            },
            {
              num: 2, title: 'Discovery', time: '30s-2m',
              content: '"Quick question — do you currently have any life/supplemental coverage?" + "How old are you / do you have dependents?"',
            },
            {
              num: 3, title: 'Benefit Bridge', time: '2-4m',
              content: 'Tie their situation to specific benefits. "With Globe Life, there\'s no medical exam, coverage starts day 1..."',
            },
            {
              num: 4, title: 'Handle Objection', time: 'if raised',
              content: 'See objection guide below',
            },
            {
              num: 5, title: 'Close / Next Step', time: 'last 60s',
              content: '"I\'d love to set up 15 minutes with a local rep to go over your options — does [time] work?"',
            },
          ].map(step => (
            <div key={step.num} style={{
              display: 'flex', gap: 12, marginBottom: 10, padding: '10px 12px',
              background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--primary-soft)', color: 'var(--primary-fg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13,
              }}>{step.num}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{step.title}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: 'var(--bg-surface)', color: 'var(--fg-dim)', border: '1px solid var(--border)',
                  }}>{step.time}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {step.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Objections */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', marginBottom: 12 }}>
            💬 TOP 5 OBJECTIONS
          </div>
          {[
            {
              objection: '"I already have coverage"',
              response: '"That\'s great! This is actually supplemental — it fills the gaps your current plan may not cover, like [specific benefit]."',
            },
            {
              objection: '"I can\'t afford it"',
              response: '"I understand — our plans start as low as $X/month, less than a cup of coffee a day. Can I show you the options?"',
            },
            {
              objection: '"Not interested"',
              response: '"I totally get it — can I ask, is it the timing, or is there something specific that concerns you?" (probe before giving up)',
            },
            {
              objection: '"Send me information"',
              response: '"Absolutely — and while I have you, let me confirm the best number..." (get callback commitment)',
            },
            {
              objection: '"I need to talk to my spouse"',
              response: '"Of course! Would it be easier if I called when you\'re both available?"',
            },
          ].map((item, i) => (
            <div key={i} style={{
              marginBottom: 8, padding: '10px 12px',
              background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>
                {item.objection}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.6 }}>
                → {item.response}
              </div>
            </div>
          ))}
        </div>

        {/* Do / Don't */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', marginBottom: 12 }}>
            ✅ DO / ❌ DON'T
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>✅ DO</div>
              {[
                'Use their name 2-3x',
                'Ask questions before pitching',
                'Mirror their pace',
                'Confirm next steps verbally',
              ].map(item => (
                <div key={item} style={{ fontSize: 11, color: 'var(--fg-dim)', marginBottom: 5, lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>❌ DON'T</div>
              {[
                'Rush the intro',
                'Pitch without discovering needs',
                'Accept "not interested" without probing',
                'End without a clear next step',
              ].map(item => (
                <div key={item} style={{ fontSize: 11, color: 'var(--fg-dim)', marginBottom: 5, lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CallIntelligence() {
  const loadData = useCallback(async () => {}, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Unified header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)',
        padding: '0 14px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }} />
        </div>
        <button
          onClick={loadData}
          style={{
            fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5,
            background: 'transparent', color: 'var(--fg-dim)',
            border: '1px solid var(--border)', cursor: 'pointer',
          }}
        >↺ Refresh</button>
      </div>

      {/* Full-width AOI Activity — right panel is built into Funnel */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Funnel />
      </div>
    </div>
  );
}
