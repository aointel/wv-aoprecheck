import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../hooks/useApi';

export interface AgentStats { total_calls: number; avg_grade: string | null; conversion_rate: number; calls_this_week: number; }
interface LeaderboardRow { agent_email: string; points: number; badge: string; streak_days: number; calls_this_week: number; calls_total: number; conversion_rate: number; avg_grade: string; trend: 'up' | 'down' | 'flat'; }
export interface CallRecord { id: string; vdp_call_id: string; call_date: string; duration_seconds: number; outcome_grade: string; converted: boolean; ai_summary: string; cnresolution: string; flags: string[]; ai_raw?: string | Record<string, unknown>; }
interface TrendPoint { week_label: string; conversion_rate: number; total_calls: number; avg_grade_num: number; }
export interface CoachingNote { id: string; note: string; manager: string; created_at: string; call_id?: string; }
export interface Scorecard {
  scores: Record<string, boolean>;
  manager_notes: string;
  filled_by: string;
  filled_at: string;
  // New optional fields for veteran appointment-setting calls
  ai_score?: number;
  human_score?: number;
  ai_flags?: string[];
  human_flags?: string[];
  talk_ratio_ai?: number;
  talk_ratio_human?: number;
  talk_ratio_client?: number;
  chapters?: { hook?: boolean; qualify?: boolean; bridge?: boolean; objection?: boolean; close?: boolean };
  outcome_type?: 'live_transfer' | 'appointment_set' | 'callback_no_date' | 'not_interested';
}
interface AoiScore { show_rate_score: number; close_rate_score: number; alp_score: number; call_grade_score: number; trend_score: number; total: number; grade: string; }

const CHAPTERS = ['Intro', 'Discovery', 'Objections', 'Pricing', 'Next Steps', 'Close'];
const APPT_CHAPTERS = ['Hook', 'Qualify', 'Bridge', 'Objection', 'Close'];
const APPT_CHAPTER_KEYS: (keyof NonNullable<Scorecard['chapters']>)[] = ['hook', 'qualify', 'bridge', 'objection', 'close'];
const APPT_CHAPTER_DESCS: Record<string, string> = {
  Hook: 'Stated reason for call clearly and grabbed attention in first 30s',
  Qualify: 'Confirmed veteran status and eligibility before pitching',
  Bridge: 'Attempted Connect (live presentation) before defaulting to appointment',
  Objection: 'Responded to pushback — didn\'t accept "no" without a rebuttal',
  Close: 'Secured hard commitment — specific date/time or live transfer now',
};
const SCORE_KEYS = ['intro', 'identified_need', 'explained_benefits', 'handled_objection', 'set_next_step', 'stayed_professional'];
const PAUL_EMAIL = 'paulvanaelst@aoglobelife.com';
const PAUL_ASSOC_ID = '229923';

function gradeColor(g: string) { if (g === 'A') return 'var(--green)'; if (g === 'B') return 'var(--primary-fg)'; if (g === 'C') return 'var(--amber)'; if (g === 'D') return '#f97316'; if (g === 'F') return 'var(--red)'; return 'var(--fg-dim)'; }
function gradeSoft(g: string) { if (g === 'A') return 'var(--green-soft)'; if (g === 'B') return 'var(--primary-soft)'; if (g === 'C') return 'var(--amber-soft)'; if (g === 'D') return 'rgba(249,115,22,0.12)'; if (g === 'F') return 'var(--red-soft)'; return 'var(--bg-raised)'; }
function gradeLeftBorderColor(g: string) { if (g === 'A') return '#4ade80'; if (g === 'B') return '#6366f1'; if (g === 'C') return '#fbbf24'; if (g === 'D') return '#f97316'; if (g === 'F') return '#f87171'; return 'var(--border)'; }
function fmtDate(d: string) { if (!d) return '--'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function fmtDuration(s: number) {
  const total = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}
function agentDisplayName(email: string) { const parts = email.split('@')[0].split(/[._]/); return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '); }

function GradeBadge({ grade }: { grade: string }) {
  return <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: gradeSoft(grade), color: gradeColor(grade), border: `1px solid ${gradeColor(grade)}33` }}>{grade || '--'}</span>;
}

function SectionCard({ title, right, children }: { title: string; right?: any; children: any }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-raised)', padding: 12, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)' }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--fg)', lineHeight: 1.1 }}>{value}</div>
      {!!sub && <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

function TalkRatioBar({ scorecard }: { scorecard: Scorecard }) {
  const hasNew = scorecard.talk_ratio_ai !== undefined || scorecard.talk_ratio_human !== undefined || scorecard.talk_ratio_client !== undefined;
  if (hasNew) {
    const ai = scorecard.talk_ratio_ai ?? 0;
    const human = scorecard.talk_ratio_human ?? 0;
    const client = scorecard.talk_ratio_client ?? 0;
    const total = Math.max(1, ai + human + client);
    const aiPct = Math.round((ai / total) * 100);
    const humanPct = Math.round((human / total) * 100);
    const clientPct = 100 - aiPct - humanPct;
    const segments = [
      { label: 'AI Agent', pct: aiPct, color: 'rgba(99,102,241,0.75)' },
      { label: 'Human Agent', pct: humanPct, color: 'rgba(34,197,94,0.75)' },
      { label: 'Client', pct: clientPct, color: 'rgba(251,191,36,0.75)' },
    ];
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-dim)', marginBottom: 6 }}>Talk Ratio</div>
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
          {segments.map(s => s.pct > 0 && (
            <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', minWidth: s.pct > 8 ? 0 : undefined, overflow: 'hidden' }}>
              {s.pct > 8 ? `${s.pct}%` : ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
          {segments.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{s.label} {s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // fallback: 2-way split (agent vs client)
  const agentPct = 45;
  const clientPct2 = 55;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-dim)', marginBottom: 6 }}>Talk Ratio</div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        <div style={{ width: `${agentPct}%`, background: 'rgba(167,139,250,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{agentPct}%</div>
        <div style={{ width: `${clientPct2}%`, background: 'rgba(96,165,250,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{clientPct2}%</div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(167,139,250,0.75)' }} /><span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Agent {agentPct}%</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(96,165,250,0.65)' }} /><span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Client {clientPct2}%</span></div>
      </div>
    </div>
  );
}

// Shared audio context passed from FakeCallPlayer down to ConversationTracks
interface AudioCtx { audioRef: React.RefObject<HTMLAudioElement>; currentTime: number; duration: number; recordingUrl: string | null; }

function FakeCallPlayer({ call, scorecard, onAudioCtx }: { call: CallRecord; scorecard: Scorecard; onAudioCtx?: (ctx: AudioCtx) => void }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(call.duration_seconds || 0);

  // Extract recording_url from ai_raw if present
  const recordingUrl: string | null = React.useMemo(() => {
    try {
      const raw = typeof (call as any).ai_raw === 'string'
        ? JSON.parse((call as any).ai_raw)
        : (call as any).ai_raw;
      return raw?.recording_url || null;
    } catch { return null; }
  }, [(call as any).ai_raw]);

  // Expose audio context to parent so ConversationTracks can seek
  React.useEffect(() => {
    if (onAudioCtx) onAudioCtx({ audioRef, currentTime, duration: Math.max(1, duration), recordingUrl });
  }, [currentTime, duration, recordingUrl]);

  const total = Math.max(1, duration || call.duration_seconds || 1);
  const progressPct = Math.min(100, (currentTime / total) * 100);
  const bars = [10, 16, 12, 20, 14, 18, 26, 22, 15, 28, 24, 12, 18, 13, 17, 21, 29, 25, 14, 11];

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };
  const seek = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || total, a.currentTime + delta));
  };
  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    a.currentTime = pct * (a.duration || total);
  };

  return (
    <SectionCard title="Call Player" right={<span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{fmtDuration(Math.floor(currentTime))} / {fmtDuration(total)}</span>}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 10 }}>
        {recordingUrl && (
          <audio
            ref={audioRef}
            src={recordingUrl}
            onTimeUpdate={e => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
            onEnded={() => setPlaying(false)}
            style={{ display: 'none' }}
          />
        )}
        {/* Waveform bars */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, minmax(0,1fr))`, gap: 3, alignItems: 'end', height: 56, marginBottom: 10 }}>
          {bars.map((h, i) => <div key={i} style={{ height: `${h * 1.6}px`, borderRadius: 4, background: i < Math.round((progressPct / 100) * bars.length) ? 'rgba(139,92,246,0.9)' : 'rgba(139,92,246,0.28)' }} />)}
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => seek(-15)} style={{ border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-raised)', color: 'var(--fg)', padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>-15s</button>
          <button onClick={togglePlay} disabled={!recordingUrl} style={{ border: '1px solid rgba(99,102,241,0.4)', borderRadius: 999, background: playing ? 'var(--primary-fg)' : 'var(--primary-soft)', color: playing ? '#fff' : 'var(--primary-fg)', padding: '5px 16px', fontSize: 12, fontWeight: 800, cursor: recordingUrl ? 'pointer' : 'default', opacity: recordingUrl ? 1 : 0.5 }}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={() => seek(15)} style={{ border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-raised)', color: 'var(--fg)', padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>+15s</button>
        </div>
        {/* Progress bar — clickable */}
        <div onClick={handleSeekClick} style={{ height: 8, borderRadius: 999, background: 'var(--bg-raised)', overflow: 'hidden', cursor: recordingUrl ? 'pointer' : 'default' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, rgba(139,92,246,0.95), rgba(96,165,250,0.9))', transition: 'width 0.5s linear' }} />
        </div>
        {!recordingUrl && <div style={{ fontSize: 10, color: 'var(--fg-dim)', textAlign: 'center', marginTop: 6 }}>No recording available</div>}
        <TalkRatioBar scorecard={scorecard} />
      </div>
    </SectionCard>
  );
}

const NUM_BARS = 80; // resolution — will downsample to fewer visible bars

function buildSpeakerBars(segments: { speaker: string; start: number; end: number; text: string }[], speaker: string, totalDur: number, numBars: number): number[] {
  const bars = new Array(numBars).fill(0);
  if (!segments?.length || totalDur <= 0) return bars;
  const barDur = totalDur / numBars;
  segments.filter(s => s.speaker === speaker).forEach(seg => {
    const startBar = Math.floor(seg.start / barDur);
    const endBar = Math.min(numBars - 1, Math.ceil(seg.end / barDur));
    // Amplitude varies naturally within the speaking segment using word count
    const words = (seg.text || '').trim().split(/\s+/).length;
    const baseAmp = Math.min(95, 35 + words * 3.5);
    for (let i = startBar; i <= endBar; i++) {
      // Natural variation — simulate voice energy peaks
      const pos = (i - startBar) / Math.max(1, endBar - startBar);
      const envelope = Math.sin(pos * Math.PI); // rises and falls within segment
      const noise = 0.75 + 0.25 * Math.sin(i * 7.3 + seg.start);
      bars[i] = Math.max(bars[i], baseAmp * envelope * noise);
    }
  });
  // Light smoothing only — keep silence gaps as 0
  for (let i = 1; i < numBars - 1; i++) {
    if (bars[i] > 0 || bars[i-1] > 0 || bars[i+1] > 0) {
      bars[i] = bars[i-1] * 0.15 + bars[i] * 0.7 + bars[i+1] * 0.15;
    }
  }
  return bars;
}

function ConversationTracks({ call, scorecard, audioCtx }: { call: CallRecord; scorecard: Scorecard; audioCtx?: AudioCtx }) {
  const totalDur = Math.max(1, audioCtx?.duration || call.duration_seconds || 1);
  const playedPct = Math.min(100, ((audioCtx?.currentTime || 0) / totalDur) * 100);
  const numBars = NUM_BARS;

  // Parse segments from ai_raw
  const segments: { speaker: string; start: number; end: number; text: string }[] = React.useMemo(() => {
    try {
      const raw = typeof (call as any).ai_raw === 'string' ? JSON.parse((call as any).ai_raw) : ((call as any).ai_raw || {});
      return Array.isArray(raw?.segments) ? raw.segments : [];
    } catch { return []; }
  }, [(call as any).ai_raw]);

  // Build per-speaker bars from segment timestamps
  const aiBars    = React.useMemo(() => buildSpeakerBars(segments, 'AI', totalDur, numBars), [segments, totalDur]);
  const humanBars = React.useMemo(() => buildSpeakerBars(segments, 'HUMAN_AGENT', totalDur, numBars), [segments, totalDur]);
  const clientBars= React.useMemo(() => buildSpeakerBars(segments, 'CLIENT', totalDur, numBars), [segments, totalDur]);

  // If no segment data at all (no ai_raw), use sparse synthetic fallback
  // but only for the whole track — silence gaps within real data stay silent
  const sparseDemo = (seed: number[], speakPct: number) =>
    new Array(numBars).fill(0).map((_, i) => (Math.sin(i * 2.1 + seed[i % seed.length]) > (1 - speakPct * 2)) ? seed[i % seed.length] : 0);
  const hasSegments = segments.length > 0;
  const aiFinal    = hasSegments ? aiBars    : sparseDemo([22,35,18,42,28,38,15,45,30,25], 0.25);
  const humanFinal = hasSegments ? humanBars : sparseDemo([38,18,42,12,35,28,45,20,32,15], 0.45);
  const clientFinal= hasSegments ? clientBars: sparseDemo([28,40,15,38,22,42,18,35,25,40], 0.30);

  const seekToBar = (barIndex: number) => {
    const a = audioCtx?.audioRef?.current;
    if (!a) return;
    a.currentTime = (barIndex / numBars) * totalDur;
  };

  const hasAppt = !!scorecard.chapters;
  const apptChapterColors = ['rgba(99,102,241,0.85)', 'rgba(34,197,94,0.85)', 'rgba(251,191,36,0.85)', 'rgba(239,68,68,0.8)', 'rgba(16,185,129,0.85)'];

  const containerRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);

  const seekFromEvent = (clientX: number) => {
    const el = containerRef.current;
    if (!el || !audioCtx?.audioRef?.current) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audioCtx.audioRef.current.currentTime = pct * totalDur;
  };

  const lanes = [
    { label: 'AI',    data: aiFinal,    color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)'  },
    { label: 'Agent', data: humanFinal, color: '#4ade80', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)'   },
    { label: 'Client',data: clientFinal,color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)'  },
  ];

  const TRACK_H = 28; // height of each track row in px

  return (
    <SectionCard title="Conversation Tracks" right={
      <span style={{ fontSize: 12, color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDuration(Math.floor(audioCtx?.currentTime || 0))} / {fmtDuration(Math.floor(totalDur))}
      </span>
    }>
      {/* Timeline container — all rows share the same horizontal space */}
      <div
        ref={containerRef}
        style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}
        onClick={(e) => seekFromEvent(e.clientX)}
        onMouseDown={(e) => { isDragging.current = true; seekFromEvent(e.clientX); }}
        onMouseMove={(e) => { if (isDragging.current) seekFromEvent(e.clientX); }}
        onMouseUp={() => { isDragging.current = false; }}
        onMouseLeave={() => { isDragging.current = false; }}
      >
        {/* Shared playhead — sits above all rows, spans full height */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: `${playedPct}%`,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.95)', flexShrink: 0 }} />
          <div style={{ width: 2, flex: 1, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 4px rgba(255,255,255,0.6)' }} />
        </div>

        {/* Each speaker row */}
        {lanes.map(({ label, data, color, bg, border }) => {
          // Convert raw amplitude data into activity segments for this track
          // Group consecutive active bars into contiguous blocks
          const VISIBLE = 80;
          const downsampled = Array.from({ length: VISIBLE }, (_, i) => {
            const start = Math.floor((i / VISIBLE) * data.length);
            const end = Math.floor(((i + 1) / VISIBLE) * data.length);
            const slice = data.slice(start, end);
            return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
          });

          // Build contiguous activity blocks from the downsampled data
          const blocks: { startPct: number; widthPct: number; amp: number }[] = [];
          let inBlock = false;
          let blockStart = 0;
          let blockAmp = 0;
          for (let i = 0; i <= VISIBLE; i++) {
            const active = i < VISIBLE && downsampled[i] > 4;
            if (active && !inBlock) { inBlock = true; blockStart = i; blockAmp = downsampled[i]; }
            else if (active && inBlock) { blockAmp = Math.max(blockAmp, downsampled[i]); }
            else if (!active && inBlock) {
              blocks.push({ startPct: (blockStart / VISIBLE) * 100, widthPct: ((i - blockStart) / VISIBLE) * 100, amp: blockAmp });
              inBlock = false; blockAmp = 0;
            }
          }

          const isPast = (startPct: number) => startPct < playedPct;

          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {/* Label */}
              <div style={{ width: 36, fontSize: 10, fontWeight: 700, color, textAlign: 'right', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              {/* Track row */}
              <div style={{
                flex: 1,
                height: TRACK_H,
                borderRadius: 6,
                background: bg,
                border: `1px solid ${border}`,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Played overlay — slight tint on past region */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: `${playedPct}%`, height: '100%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                {/* Activity blocks */}
                {blocks.map((b, bi) => {
                  const past = b.startPct + b.widthPct / 2 < playedPct;
                  const barH = Math.max(8, Math.round((b.amp / 100) * (TRACK_H - 6)));
                  return (
                    <div key={bi} style={{
                      position: 'absolute',
                      left: `${b.startPct}%`,
                      width: `${Math.max(0.8, b.widthPct)}%`,
                      height: barH,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      borderRadius: 3,
                      background: past ? color : color.replace(')', ', 0.45)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(#', 'rgba('),
                      opacity: past ? 1 : 0.5,
                    }} />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 6, textAlign: 'center', paddingLeft: 44 }}>Drag or click to seek</div>
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
      {/* Chapter timeline — markers at real timestamps derived from segments */}
      {(() => {
        // Detect approximate timestamps for each chapter by scanning segment content
        const chapterTimestamps: Record<string, number | null> = {
          Hook: null, Qualify: null, Bridge: null, Objection: null, Close: null
        };

        if (segments.length) {
          for (const seg of segments) {
            const t = seg.text?.toLowerCase() || '';
            const start = seg.start;
            const isHuman = seg.speaker === 'HUMAN_AGENT';
            const isClient = seg.speaker === 'CLIENT';
            // Hook: human agent's first words
            if (!chapterTimestamps.Hook && isHuman) chapterTimestamps.Hook = start;
            // Qualify: human confirms veteran/branch
            if (!chapterTimestamps.Qualify && isHuman && (t.includes('veteran') || t.includes('branch') || t.includes('served') || t.includes('service'))) chapterTimestamps.Qualify = start;
            // Bridge: human tries to connect/present
            if (!chapterTimestamps.Bridge && isHuman && (t.includes('representative') || t.includes('issue') || t.includes('virtually') || t.includes('phone') || t.includes('connect') || t.includes('specialist'))) chapterTimestamps.Bridge = start;
            // Objection: client pushes back (detected on client turn)
            if (!chapterTimestamps.Objection && (isClient || isHuman) && (t.includes('government') || t.includes('not interested') || t.includes('charge') || t.includes('cost') || t.includes("don't") || t.includes('ai?'))) chapterTimestamps.Objection = start;
            // Close: human secures commitment
            if (!chapterTimestamps.Close && isHuman && (t.includes('tomorrow') || t.includes("o'clock") || t.includes('schedule') || t.includes('works') || t.includes('call you') || t.includes('afternoon') || t.includes('morning'))) chapterTimestamps.Close = start;
          }
        }

        // Fallback evenly spaced if no segments
        APPT_CHAPTERS.forEach((ch, i) => {
          if (chapterTimestamps[ch] === null) chapterTimestamps[ch] = (i / (APPT_CHAPTERS.length - 1)) * totalDur;
        });

        const colors = ['#818cf8', '#4ade80', '#fb923c', '#f87171', '#34d399'];

        return (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-dim)', marginBottom: 6 }}>Call Stages</div>
            {/* Timeline bar with chapter markers */}
            <div style={{ position: 'relative', height: 28, paddingLeft: 44 }}>
              {/* Track background */}
              <div style={{ position: 'absolute', left: 44, right: 0, top: 10, height: 8, borderRadius: 4, background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                {/* Filled portion */}
                <div style={{ width: `${playedPct}%`, height: '100%', background: 'rgba(255,255,255,0.12)', borderRadius: 4 }} />
              </div>
              {/* Chapter markers */}
              {APPT_CHAPTERS.map((ch, i) => {
                const key = APPT_CHAPTER_KEYS[i];
                const ts = chapterTimestamps[ch] ?? 0;
                const pct = Math.min(98, (ts / totalDur) * 100);
                const passed = scorecard.chapters?.[key] ?? false;
                const color = colors[i];
                return (
                  <div key={ch} style={{
                    position: 'absolute',
                    left: `calc(44px + ${pct}%)`,
                    top: 0,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}>
                    {/* Diamond marker on the track */}
                    <div style={{
                      width: 10, height: 10,
                      background: passed ? color : 'var(--bg-raised)',
                      border: `2px solid ${color}`,
                      borderRadius: 2,
                      transform: 'rotate(45deg)',
                      marginTop: 5,
                    }} />
                    {/* Label below */}
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: passed ? color : 'var(--fg-dim)',
                      marginTop: 6, whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}>{ch}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </SectionCard>
  );
}

function RollingLineChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) {
    return <div style={{ fontSize: 12, color: 'var(--fg-dim)', padding: '8px 0' }}>No trend data yet.</div>;
  }
  const chartW = 560;
  const chartH = 130;
  const padX = 18;
  const padY = 16;
  const vals = points.map(p => p.conversion_rate);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(1, maxV - minV);
  const px = (i: number) => padX + (i / Math.max(1, points.length - 1)) * (chartW - padX * 2);
  const py = (v: number) => chartH - padY - ((v - minV) / range) * (chartH - padY * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.conversion_rate).toFixed(1)}`).join(' ');
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 10, overflowX: 'auto' }}>
      <svg width={chartW} height={chartH} style={{ display: 'block', minWidth: chartW }}>
        {[0, 1, 2, 3].map(i => {
          const y = padY + (i / 3) * (chartH - padY * 2);
          return <line key={i} x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="var(--border)" strokeWidth={0.8} />;
        })}
        <path d={d} fill="none" stroke="rgba(139,92,246,0.95)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.week_label + i}>
            <circle cx={px(i)} cy={py(p.conversion_rate)} r={4} fill="rgba(139,92,246,0.95)" />
            <circle cx={px(i)} cy={py(p.conversion_rate)} r={7} fill="rgba(139,92,246,0.2)" />
            <text x={px(i)} y={chartH - 2} textAnchor="middle" fontSize={11} fill="var(--fg-dim)">{p.week_label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome?: Scorecard['outcome_type'] }) {
  if (!outcome) return null;
  const cfg: Record<NonNullable<Scorecard['outcome_type']>, { icon: string; label: string; bg: string; color: string; border: string }> = {
    live_transfer:    { icon: '🔥', label: 'Connect',             bg: 'rgba(34,197,94,0.15)',   color: '#22c55e',  border: 'rgba(34,197,94,0.4)'   },
    appointment_set:  { icon: '📅', label: 'Appointment Set',     bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6',  border: 'rgba(59,130,246,0.35)' },
    callback_no_date: { icon: '🔔', label: 'Callback Scheduled',  bg: 'rgba(251,191,36,0.12)', color: '#fbbf24',  border: 'rgba(251,191,36,0.35)' },
    not_interested:   { icon: '✗',  label: 'Not Interested',      bg: 'rgba(239,68,68,0.12)',  color: '#f87171',  border: 'rgba(239,68,68,0.35)'  },
  };
  const c = cfg[outcome];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, marginBottom: 10 }}>
      <span style={{ fontSize: 18 }}>{c.icon}</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: c.color, letterSpacing: '0.02em' }}>{c.label}</span>
    </div>
  );
}

export function ScorecardView({ scorecard, call, agentEmail, stats, notes }: { scorecard: Scorecard; call: CallRecord; agentEmail: string; stats: AgentStats | null; notes: CoachingNote[]; }) {
  const hasNew = scorecard.ai_score !== undefined || scorecard.human_score !== undefined || scorecard.chapters !== undefined;

  // Legacy path derived data
  const passed = Object.values(scorecard.scores).filter(Boolean).length;
  const pct = Math.round((passed / SCORE_KEYS.length) * 100);
  const chapterScores = CHAPTERS.map((c, i) => ({ chapter: c, score: scorecard.scores[SCORE_KEYS[i]] ? 4 : 2, evidence: scorecard.scores[SCORE_KEYS[i]] ? 'Clear execution captured.' : 'Needs stronger structure.' }));
  const priorities = chapterScores.filter(c => c.score <= 2).slice(0, 3);
  const hasManagerContent = !!scorecard.manager_notes || notes.length > 0;

  // New path data
  const humanScore = scorecard.human_score ?? Math.round(pct * 1.1);
  const humanFlags = scorecard.human_flags ?? [];


  const humanChecks = [
    { label: 'Took over smoothly after transfer',        passed: scorecard.scores['intro'] ?? false },
    { label: 'Attempted Connect before defaulting to appointment', passed: scorecard.scores['explained_benefits'] ?? false },
    { label: 'Got hard commitment (specific date/time)', passed: scorecard.scores['set_next_step'] ?? false },
  ];

  const humanTalkPct = scorecard.talk_ratio_human;

  const [audioCtx, setAudioCtx] = useState<AudioCtx | undefined>(undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <OutcomeBadge outcome={scorecard.outcome_type} />
      <FakeCallPlayer call={call} scorecard={scorecard} onAudioCtx={setAudioCtx} />
      <ConversationTracks call={call} scorecard={scorecard} audioCtx={audioCtx} />

      {hasNew ? (
        <>
          {/* Human Agent Performance */}
          <SectionCard
            title="Human Agent"
            right={
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e', fontSize: 13, fontWeight: 900 }}>
                {humanScore}
              </span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {humanChecks.map(({ label, passed: ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: ok ? '#22c55e' : '#f87171', flexShrink: 0 }}>{ok ? '✓' : '✗'}</span>
                  <span style={{ fontSize: 13, color: ok ? 'var(--fg)' : 'var(--fg-dim)' }}>{label}</span>
                </div>
              ))}
              {humanTalkPct !== undefined && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginBottom: 4 }}>Human Talk%</div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-raised)', overflow: 'hidden' }}>
                    <div style={{ width: `${humanTalkPct}%`, height: '100%', background: 'rgba(34,197,94,0.75)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2, fontWeight: 700 }}>{humanTalkPct}%</div>
                </div>
              )}
              {humanFlags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                  {humanFlags.map(f => (
                    <span key={f} style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>{f}</span>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Coaching Actions — split */}
          <SectionCard title="Coaching Actions" right={<span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Priority first</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {humanFlags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#22c55e', marginBottom: 6 }}>Human Coaching</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {humanFlags.map((f, i) => (
                      <div key={f} style={{ borderLeft: '3px solid rgba(34,197,94,0.6)', paddingLeft: 10, paddingTop: 6, paddingBottom: 6, paddingRight: 10, borderRadius: '0 8px 8px 0', background: 'rgba(34,197,94,0.05)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{i + 1}. {f}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginTop: 2 }}>Coach rep on this pattern before next session.</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {humanFlags.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--green)' }}>No flags detected. Focus on consistency and maintaining tempo.</div>
              )}
              {!!scorecard.manager_notes && <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 10, fontSize: 12, color: 'var(--fg)' }}>{scorecard.manager_notes}</div>}
              {!!notes.length && <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Latest coaching note: {notes[0].note}</div>}
              <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Agent conversion baseline: {stats?.conversion_rate ?? 0}%</div>
            </div>
          </SectionCard>
        </>
      ) : (
        <>
          {/* Call Evaluation — 5 appointment-setting criteria */}
          <SectionCard title="Call Evaluation" right={<span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{pct}% passed</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {APPT_CHAPTERS.map((ch, i) => {
                const key = APPT_CHAPTER_KEYS[i];
                const passed = scorecard.scores[SCORE_KEYS[i]] ?? scorecard.chapters?.[key] ?? false;
                const desc = APPT_CHAPTER_DESCS[ch] || '';
                return (
                  <div key={ch} style={{ border: `1px solid ${passed ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`, borderRadius: 10, background: passed ? 'rgba(34,197,94,0.05)' : 'var(--bg-surface)', padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{passed ? '✅' : '❌'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)' }}>{ch}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
          <SectionCard title="Coaching Actions" right={<span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Priority first</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {priorities.length === 0 ? <div style={{ fontSize: 13, color: 'var(--green)' }}>No high-risk chapter found. Focus on consistency.</div> : priorities.map((p, i) => (
                <div key={p.chapter} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)' }}>{i + 1}. Improve {p.chapter}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginTop: 3 }}>Target next call: +2 points in this chapter.</div>
                </div>
              ))}
              {!!scorecard.manager_notes && <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 10, fontSize: 12, color: 'var(--fg)' }}>{scorecard.manager_notes}</div>}
              {!!notes.length && <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Latest coaching note: {notes[0].note}</div>}
              {!hasManagerContent && !!call.ai_summary && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 10, fontSize: 12, color: 'var(--fg-dim)', fontStyle: 'italic' }}>{call.ai_summary}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Agent conversion baseline: {stats?.conversion_rate ?? 0}%</div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function CoachingBreakdown({ reps, selectedEmail, onSelect }: { reps: LeaderboardRow[]; selectedEmail: string; onSelect: (email: string) => void; }) {
  const selected = reps.find(r => r.agent_email === selectedEmail) || reps[0];
  const metrics = [
    { label: 'Calls Listened', value: selected?.calls_total || 0 },
    { label: 'Calls Attended', value: Math.round((selected?.calls_total || 0) * 0.64) },
    { label: 'Calls with Feedback', value: Math.round((selected?.calls_total || 0) * 0.28) },
    { label: 'Calls with Comments', value: Math.round((selected?.calls_total || 0) * 0.33) },
    { label: 'Calls with Scorecard', value: Math.round((selected?.calls_total || 0) * 0.22) },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: 10, minHeight: 0 }}>
      <SectionCard title="Team Coaching Activity">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reps.slice(0, 8).map(r => (
            <button key={r.agent_email} onClick={() => onSelect(r.agent_email)} style={{ textAlign: 'left', border: `1px solid ${r.agent_email === selectedEmail ? 'var(--primary-fg)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px', background: r.agent_email === selectedEmail ? 'var(--primary-soft)' : 'var(--bg-surface)', color: 'var(--fg)', cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentDisplayName(r.agent_email)}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{r.calls_total} calls listened</div>
            </button>
          ))}
        </div>
      </SectionCard>
      <SectionCard title={`${agentDisplayName(selected?.agent_email || selectedEmail)} Coaching Matrix`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          {metrics.map(m => <MetricTile key={m.label} label={m.label} value={String(m.value)} />)}
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(5, 1fr)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: 8, fontSize: 12, fontWeight: 800, color: 'var(--fg)' }}>Rep</div>
            {CHAPTERS.slice(0, 5).map(h => <div key={h} style={{ padding: 8, fontSize: 12, fontWeight: 800, color: 'var(--fg-dim)' }}>{h}</div>)}
          </div>
          {reps.slice(0, 6).map((r, idx) => (
            <div key={r.agent_email} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(5, 1fr)', borderBottom: idx < 5 ? '1px solid var(--border)' : 'none', background: idx % 2 ? 'var(--bg-surface)' : 'var(--bg-raised)' }}>
              <div style={{ padding: 8, fontSize: 12, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentDisplayName(r.agent_email)}</div>
              {[0, 1, 2, 3, 4].map(n => <div key={n} style={{ padding: 8, fontSize: 12, color: 'var(--fg-dim)' }}>{2 + ((idx + n) % 4)}/5</div>)}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export function MyScore({ email: propEmail, callSegment, recruitPipeline, onCallClick, selectedCallId: selectedCallIdProp, onCallSelect, onCallDataReady }: { email?: string; callSegment?: 'sales' | 'recruit'; recruitPipeline?: { firstInterview: number; virtualOverview: number; groupFinal: number; hired: number }; onCallClick?: (call: any) => void; selectedCallId?: string | null; onCallSelect?: (callId: string | null) => void; onCallDataReady?: (call: CallRecord | null, scorecard: Scorecard | null, notes: CoachingNote[], stats: AgentStats | null) => void; } = {}) {
  const isEmbeddedDemo = !!propEmail;
  const [selectedEmail, setSelectedEmail] = useState(propEmail || '');
  const [customEmail, setCustomEmail] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [myRow, setMyRow] = useState<LeaderboardRow | null>(null);
  const [myStats, setMyStats] = useState<AgentStats | null>(null);
  const [myCalls, setMyCalls] = useState<CallRecord[]>([]);
  const [myTrend, setMyTrend] = useState<TrendPoint[]>([]);
  const [coachingNotes, setCoachingNotes] = useState<CoachingNote[]>([]);
  const [scorecards, setScorecards] = useState<Record<string, Scorecard>>({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ booked: true, sold: true, not_int: true, other: true, flagged: false });
  const [internalCallId, setInternalCallId] = useState<string | null>(null);
  const selectedCallId = selectedCallIdProp !== undefined ? selectedCallIdProp : internalCallId;
  const setSelectedCallId = (id: string | null) => {
    if (onCallSelect) onCallSelect(id);
    else setInternalCallId(id);
  };
  const [aoiScore, setAoiScore] = useState<AoiScore | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'coaching'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteManager, setNewNoteManager] = useState(() => { try { return localStorage.getItem('aoi_manager_name') || ''; } catch { return ''; } });

  const DEMO_SCORECARD: Scorecard = {
    scores: { intro: true, identified_need: true, explained_benefits: true, handled_objection: false, set_next_step: true, stayed_professional: true },
    manager_notes: 'Strong opening and value framing. Coach objection looping and ask for explicit next step.',
    filled_by: 'Manager',
    filled_at: new Date().toISOString(),
  };

  useEffect(() => { authFetch('/api/call-intelligence/leaderboard').then(r => r.json()).then(d => setLeaderboard(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  useEffect(() => {
    if (!isEmbeddedDemo || !propEmail) return;
    setSelectedEmail(propEmail);
    setMyRow({ agent_email: propEmail, points: 2410, badge: 'gold', streak_days: 4, calls_this_week: 18, calls_total: 142, conversion_rate: 22, avg_grade: 'B', trend: 'up' });
    setMyStats({ total_calls: 142, avg_grade: 'B', conversion_rate: 22, calls_this_week: 18 });
    // Demo: load real calls stored under Dianka Blash
    const demoEmail = 'diankablash@aoglobelife.com';
    setSelectedEmail(demoEmail);
    loadAgent(demoEmail);
    return;

    const SUPABASE_BASE = 'https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/call-recordings';
    const demoCalls: CallRecord[] = [
      {
        id: 'real-1', vdp_call_id: 'a74832b8-d92b-43f0-b089-87ed7d1d6335',
        call_date: new Date().toISOString(), duration_seconds: 309,
        outcome_grade: 'B', converted: true, cnresolution: 'appointment_set',
        ai_summary: 'Kennedy took over from AI. Harry (Air Force) engaged about cremation preferences and wife\'s VA aid & attendance benefits. Appointment set but Connect not attempted.',
        flags: ['no_connect_attempt'],
        ai_raw: JSON.stringify({ recording_url: `${SUPABASE_BASE}/a74832b8-d92b-43f0-b089-87ed7d1d6335.mp3`, human_agent_name: 'Kennedy', client_name: 'Harry', outcome_type: 'appointment_set', human_score: 90, human_flags: ['Did not attempt Connect — went straight to scheduling'], talk_ratio_human: 48, talk_ratio_ai: 11, talk_ratio_client: 41, chapters: { hook: true, qualify: true, bridge: false, objection: true, close: true } })
      },
      {
        id: 'real-2', vdp_call_id: 'cb187116-e7e8-4139-832d-75450e0e3d30',
        call_date: new Date(Date.now() - 3600_000).toISOString(), duration_seconds: 253,
        outcome_grade: 'B', converted: true, cnresolution: 'appointment_set',
        ai_summary: 'Kennedy booked John Alfred (Air Force) for a 10am appointment. Client had hearing issues. Clean call but no Connect attempt. 10am tomorrow confirmed.',
        flags: ['no_connect_attempt'],
        ai_raw: JSON.stringify({ recording_url: `${SUPABASE_BASE}/cb187116-e7e8-4139-832d-75450e0e3d30.mp3`, human_agent_name: 'Kennedy', client_name: 'John Alfred', outcome_type: 'appointment_set', human_score: 85, human_flags: [], talk_ratio_human: 50, talk_ratio_ai: 16, talk_ratio_client: 26, chapters: { hook: true, qualify: true, bridge: false, objection: false, close: true } })
      },
      {
        id: 'real-3', vdp_call_id: '4e9d9eb0-7639-4cf7-b284-b4991bc2f5da',
        call_date: new Date(Date.now() - 7200_000).toISOString(), duration_seconds: 207,
        outcome_grade: 'C', converted: false, cnresolution: 'not_interested',
        ai_summary: 'Martin Austin lost James (Navy) when he said "if you\'re not associated with the government, I want no parts of it." Martin accepted the rejection without a rebuttal. Winnable call.',
        flags: ['no_government_rebuttal', 'call_lost'],
        ai_raw: JSON.stringify({ recording_url: `${SUPABASE_BASE}/4e9d9eb0-7639-4cf7-b284-b4991bc2f5da.mp3`, human_agent_name: 'Martin Austin', client_name: 'James', outcome_type: 'not_interested', human_score: 80, human_flags: ['No rebuttal to "not associated with government" objection — accepted rejection immediately'], talk_ratio_human: 31, talk_ratio_ai: 28, talk_ratio_client: 18, chapters: { hook: true, qualify: false, bridge: true, objection: false, close: false } })
      },
      {
        id: 'real-4', vdp_call_id: 'c8821267-835c-47ea-bd0d-faa41dda9eda',
        call_date: new Date(Date.now() - 10800_000).toISOString(), duration_seconds: 222,
        outcome_grade: 'B', converted: true, cnresolution: 'in_progress',
        ai_summary: 'Sean had Perry Foster (Army 11B) fully engaged — wife in rehab, zero objections, ready to go. Perry asked "are we doing this over the phone?" — green light for Connect. Sean punted to a 6pm callback instead.',
        flags: ['missed_connect', 'hot_prospect'],
        ai_raw: JSON.stringify({ recording_url: `${SUPABASE_BASE}/c8821267-835c-47ea-bd0d-faa41dda9eda.mp3`, human_agent_name: 'Sean', client_name: 'Perry Foster', outcome_type: 'callback_no_date', human_score: 90, human_flags: ['Perry asked to proceed on the call — missed Connect opportunity, scheduled callback instead'], talk_ratio_human: 44, talk_ratio_ai: 17, talk_ratio_client: 72, chapters: { hook: true, qualify: true, bridge: false, objection: false, close: true } })
      },
    ];
    setMyCalls(demoCalls);
    setMyTrend([{ week_label: 'W1', conversion_rate: 14, total_calls: 20, avg_grade_num: 2.7 }, { week_label: 'W2', conversion_rate: 18, total_calls: 24, avg_grade_num: 3.0 }, { week_label: 'W3', conversion_rate: 20, total_calls: 21, avg_grade_num: 3.1 }, { week_label: 'W4', conversion_rate: 22, total_calls: 18, avg_grade_num: 3.2 }]);
    setCoachingNotes([
      { id: 'n1', note: 'All agents: try Connect before defaulting to appointment. Ask "I have a specialist available right now — can I connect you?" first.', manager: 'Manager', created_at: new Date().toISOString() },
      { id: 'n2', note: 'Martin: when client asks "is this the VA/government?" use: "We work with veteran organizations like VFW and American Legion to make sure you get benefits you\'ve already earned — at no cost to you."', manager: 'Manager', created_at: new Date(Date.now() - 86400_000).toISOString() },
    ]);
    const realScorecards: Record<string, Scorecard> = {};
    demoCalls.forEach(c => {
      const raw = typeof c.ai_raw === 'string' ? JSON.parse(c.ai_raw) : (c.ai_raw || {}) as Record<string, unknown>;
      realScorecards[c.vdp_call_id] = {
        scores: {
          intro: (raw.chapters as Record<string,boolean>)?.hook ?? false,
          identified_need: (raw.chapters as Record<string,boolean>)?.qualify ?? false,
          explained_benefits: (raw.chapters as Record<string,boolean>)?.bridge ?? false,
          handled_objection: (raw.chapters as Record<string,boolean>)?.objection ?? false,
          set_next_step: (raw.chapters as Record<string,boolean>)?.close ?? false,
          stayed_professional: true,
        },
        manager_notes: '',
        filled_by: 'AI Auto-Score',
        filled_at: new Date().toISOString(),
        human_score: raw.human_score as number,
        human_flags: raw.human_flags as string[],
        talk_ratio_ai: raw.talk_ratio_ai as number,
        talk_ratio_human: raw.talk_ratio_human as number,
        talk_ratio_client: raw.talk_ratio_client as number,
        chapters: raw.chapters as Scorecard['chapters'],
        outcome_type: raw.outcome_type as Scorecard['outcome_type'],
      };
    });
    setScorecards(realScorecards);
    setAoiScore({ show_rate_score: 14, close_rate_score: 20, alp_score: 15, call_grade_score: 16, trend_score: 7, total: 72, grade: 'B' });
  }, [isEmbeddedDemo, propEmail]);

  const loadAgent = useCallback(async (email: string) => {
    if (!email) return;
    // Allow demo mode to load real data from Supabase for dianka
    if (isEmbeddedDemo && email !== 'diankablash@aoglobelife.com') return;
    setLoading(true);
    setMyRow(null); setMyStats(null); setMyCalls([]); setMyTrend([]); setCoachingNotes([]); setInternalCallId(null); if (onCallSelect) onCallSelect(null);
    const segQ = callSegment === 'recruit' || callSegment === 'sales' ? `segment=${callSegment}` : '';
    try {
      const [lb, stats, calls, trend, notes] = await Promise.all([
        authFetch('/api/call-intelligence/leaderboard').then(r => r.json()),
        authFetch(`/api/call-intelligence/stats/${encodeURIComponent(email)}${segQ ? `?${segQ}` : ''}`).then(r => r.json()),
        authFetch(`/api/call-intelligence/agent/${encodeURIComponent(email)}?limit=20${segQ ? `&${segQ}` : ''}`).then(r => r.json()),
        authFetch(`/api/call-intelligence/trend/${encodeURIComponent(email)}${segQ ? `?${segQ}` : ''}`).then(r => r.json()),
        authFetch(`/api/call-intelligence/coaching/${encodeURIComponent(email)}`).then(r => r.json()),
      ]);
      const lbRows: LeaderboardRow[] = Array.isArray(lb) ? lb : [];
      setLeaderboard(lbRows);
      setMyRow(lbRows.find(r => r.agent_email === email) || null);
      setMyStats(stats);
      setMyCalls(Array.isArray(calls) ? calls : []);
      setMyTrend(Array.isArray(trend) ? trend : []);
      setCoachingNotes(Array.isArray(notes) ? notes.reverse() : []);
      const callIds = (Array.isArray(calls) ? calls : []).map((c: any) => c.vdp_call_id).filter(Boolean);
      const scMap: Record<string, Scorecard> = {};
      await Promise.all(callIds.slice(0, 10).map(async (id: string) => {
        const r = await authFetch(`/api/call-intelligence/scorecard/${encodeURIComponent(id)}`);
        if (r.ok) {
          const sc = await r.json();
          if (sc?.scores) scMap[id] = sc;
        }
      }));
      setScorecards(scMap);
    } catch (e) {
      console.error('loadAgent error', e);
    } finally {
      setLoading(false);
    }
  }, [isEmbeddedDemo, callSegment, onCallSelect]);

  useEffect(() => { if (propEmail) { setSelectedEmail(propEmail); loadAgent(propEmail); } }, [propEmail, loadAgent]);
  useEffect(() => {
    if (!selectedEmail || (isEmbeddedDemo && selectedEmail !== 'diankablash@aoglobelife.com')) return;
    fetch(`/api/funnel/agent-score/${encodeURIComponent(selectedEmail)}`).then(r => r.ok ? r.json() : null).then(d => { if (d?.total !== undefined) setAoiScore(d); }).catch(() => {});
  }, [selectedEmail, isEmbeddedDemo]);

  const submitNote = async () => {
    if (!newNoteText.trim() || !selectedEmail) return;
    const manager = newNoteManager.trim() || 'Manager';
    try {
      const res = await authFetch(`/api/call-intelligence/coaching/${encodeURIComponent(selectedEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNoteText.trim(), manager }),
      });
      if (res.ok) {
        const newNote: CoachingNote = { id: Date.now().toString(), note: newNoteText.trim(), manager, created_at: new Date().toISOString() };
        setCoachingNotes(prev => [newNote, ...prev]);
        setNewNoteText('');
        try { localStorage.setItem('aoi_manager_name', manager); } catch {}
      }
    } catch (e) {
      console.error('submitNote error', e);
    }
  };

  const filteredCalls = myCalls.filter(call => {
    const res = call.cnresolution;
    let pass = false;
    if (res === 'appointment_set' || res === 'booked') pass = filters.booked;
    else if (res === 'sold') pass = filters.sold;
    else if (res === 'not_interested') pass = filters.not_int;
    else pass = filters.other;
    if (!pass) return false;
    if (filters.flagged && !(call.flags && call.flags.length > 0)) return false;
    return true;
  });

  const selectedCall = myCalls.find(c => c.vdp_call_id === selectedCallId) || null;
  const selectedScorecard = selectedCall ? (scorecards[selectedCall.vdp_call_id] || DEMO_SCORECARD) : null;

  useEffect(() => {
    if (!onCallDataReady) return;
    const call = myCalls.find(c => c.vdp_call_id === selectedCallId) || null;
    if (!selectedCallId || !call) { onCallDataReady(null, null, [], null); return; }
    const scorecard = scorecards[selectedCallId] || DEMO_SCORECARD;
    onCallDataReady(call, scorecard, coachingNotes, myStats);
  }, [selectedCallId]); // eslint-disable-line react-hooks/exhaustive-deps
  const isPaulProfile = selectedEmail.toLowerCase() === PAUL_EMAIL;
  const paulCustomers = [
    { name: 'Paul Van Aelst', market: 'Agent', stage: 'Primary Profile', alp: '--', nextStep: `Associate ID ${PAUL_ASSOC_ID}` },
    { name: 'Maria Ellis', market: 'Veteran', stage: 'Booked', alp: '$2,100', nextStep: 'Apr 4 - 10:30 AM' },
    { name: 'Thomas Ward', market: 'Globe', stage: 'Presentation', alp: '$1,250', nextStep: 'Apr 5 - 2:00 PM' },
    { name: 'Angela Green', market: 'Veteran', stage: 'Sold', alp: '$3,480', nextStep: 'Policy docs pending' },
    { name: 'David Moore', market: 'Globe', stage: 'Follow-up', alp: '$980', nextStep: 'Callback requested' },
    { name: 'Rachel Kent', market: 'Veteran', stage: 'Not Interested', alp: '$0', nextStep: 'Recycle in 30 days' },
  ];

  const showRatePct = aoiScore ? Math.round((aoiScore.show_rate_score / 20) * 100) : 0;
  const closeRatePct = aoiScore ? Math.round((aoiScore.close_rate_score / 30) * 100) : 0;
  const callGrade = myStats?.avg_grade || '--';
  const momentumScore = aoiScore ? Math.min(10, Math.max(0, aoiScore.trend_score)) : 0;

  const TAB_LABELS: Record<'overview' | 'calls' | 'coaching', string> = { overview: 'Overview', calls: 'Calls', coaching: 'Coaching' };

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {!propEmail && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg)' }}>My Score</span>
          <select value={selectedEmail} onChange={e => { setSelectedEmail(e.target.value); loadAgent(e.target.value); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--fg)', fontSize: 12 }}>
            <option value="">Pick an agent</option>
            {leaderboard.map(r => <option key={r.agent_email} value={r.agent_email}>{agentDisplayName(r.agent_email)}</option>)}
          </select>
          <input value={customEmail} onChange={e => setCustomEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customEmail) { setSelectedEmail(customEmail); loadAgent(customEmail); } }} placeholder="email + Enter" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--fg)', fontSize: 12, width: 180, outline: 'none' }} />
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!selectedEmail && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--fg-dim)', fontSize: 12 }}>{propEmail ? 'Loading...' : 'Select an agent to view details'}</div>}
        {selectedEmail && loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--fg-dim)', fontSize: 12 }}>Loading...</div>}
        {selectedEmail && !loading && (
          <div style={{ height: '100%', display: 'flex', minHeight: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)' }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Agent Workflow — always visible */}
              <SectionCard title="Agent Workflow">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--fg)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentDisplayName(selectedEmail)}</div>
                    <div style={{ fontSize: 13, color: 'var(--fg-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedEmail}</div>
                  </div>
                  {aoiScore && <MetricTile label="AOI Score" value={`${aoiScore.total}`} sub={`Grade ${aoiScore.grade}`} />}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
                  <div style={{ paddingRight: 10, marginRight: 2, borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(16,185,129,0.85)', marginBottom: 3 }}>Score</div>
                    <div style={{ fontWeight: 800, color: 'var(--fg)' }}>{myStats?.avg_grade || '--'}</div>
                  </div>
                  <div style={{ paddingRight: 10, marginRight: 2, borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(59,130,246,0.85)', marginBottom: 3 }}>Call Connector Pro</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span><span style={{ color: 'var(--fg-dim)' }}>D </span><span style={{ fontWeight: 700 }}>{myRow?.calls_this_week ?? '--'}</span></span>
                      <span><span style={{ color: 'var(--fg-dim)' }}>Bk </span><span style={{ fontWeight: 700 }}>{myStats ? `${myStats.conversion_rate.toFixed(0)}%` : '--'}</span></span>
                    </div>
                  </div>
                  {recruitPipeline != null && (
                    <div style={{ paddingRight: 10, marginRight: 2, borderRight: '1px solid var(--border)', minWidth: 0, flex: '1 1 140px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(139,92,246,0.9)', marginBottom: 3 }}>Recruit pipeline</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 11 }}>
                        <span><span style={{ color: 'var(--fg-dim)' }}>1st </span><span style={{ fontWeight: 700 }}>{recruitPipeline.firstInterview ?? '—'}</span></span>
                        <span><span style={{ color: 'var(--fg-dim)' }}>VO </span><span style={{ fontWeight: 700 }}>{recruitPipeline.virtualOverview ?? '—'}</span></span>
                        <span><span style={{ color: 'var(--fg-dim)' }}>GF </span><span style={{ fontWeight: 700 }}>{recruitPipeline.groupFinal ?? '—'}</span></span>
                        <span><span style={{ color: 'var(--fg-dim)' }}>Hired </span><span style={{ fontWeight: 700 }}>{recruitPipeline.hired ?? '—'}</span></span>
                      </div>
                    </div>
                  )}
                  {callSegment !== 'recruit' && (
                  <div style={{ paddingRight: 10, marginRight: 2, borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(16,185,129,0.85)', marginBottom: 3 }}>Sales & Revenue</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span><span style={{ color: 'var(--fg-dim)' }}>Sales </span><span style={{ fontWeight: 700, color: 'var(--green)' }}>{myRow?.calls_total ?? '--'}</span></span>
                      <span><span style={{ color: 'var(--fg-dim)' }}>ALP </span><span style={{ fontWeight: 700 }}>{myRow?.points ? `${Math.round(myRow.points / 1000)}K` : '--'}</span></span>
                      <span><span style={{ color: 'var(--fg-dim)' }}>HO </span><span style={{ fontWeight: 700 }}>{myRow?.streak_days ?? '--'}</span></span>
                    </div>
                  </div>
                  )}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(251,191,36,0.95)', marginBottom: 3 }}>Usage</div>
                    <div style={{ fontWeight: 700, color: 'rgba(251,191,36,0.95)' }}>{myRow?.points ?? '--'}</div>
                  </div>
                </div>
                {aoiScore && (aoiScore.grade === 'D' || aoiScore.grade === 'F') && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#f87171' }}>
                    ⚠️ Needs Coaching — grade {aoiScore.grade} agent, schedule a 1:1
                  </div>
                )}
              </SectionCard>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)', marginBottom: 10, flexShrink: 0 }}>
                {(['overview', 'calls', 'coaching'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '8px 18px',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: activeTab === tab ? 'var(--primary-fg)' : 'var(--fg-dim)',
                      borderBottom: activeTab === tab ? '2px solid var(--primary-fg)' : '2px solid transparent',
                    }}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <>
                  {isPaulProfile && (
                    <>
                      <SectionCard title="Agent Profile">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                          <MetricTile label="Agent" value="Paul Van Aelst" sub={PAUL_EMAIL} />
                          <MetricTile label="Associate ID" value={PAUL_ASSOC_ID} />
                          <MetricTile label="Market Focus" value="Veteran + Globe" />
                          <MetricTile label="Priority" value="Protect Close Rate" sub="Objection handling and next-step consistency" />
                        </div>
                      </SectionCard>
                      <SectionCard title="Customer Table" right={<span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{paulCustomers.length} customers</span>}>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.8fr 1.2fr', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: 'var(--fg-dim)' }}>Customer</div>
                            <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: 'var(--fg-dim)' }}>Market</div>
                            <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: 'var(--fg-dim)' }}>Stage</div>
                            <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: 'var(--fg-dim)' }}>ALP</div>
                            <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: 'var(--fg-dim)' }}>Next Step</div>
                          </div>
                          {paulCustomers.map((c, i) => (
                            <div key={`${c.name}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.8fr 1.2fr', borderBottom: i < paulCustomers.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 ? 'var(--bg-surface)' : 'var(--bg-raised)' }}>
                              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg-dim)' }}>{c.market}</div>
                              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg)' }}>{c.stage}</div>
                              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg)' }}>{c.alp}</div>
                              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nextStep}</div>
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    </>
                  )}
                  <SectionCard title="Performance Tiles">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                      {/* Show Rate */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: '10px 12px', minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Show Rate</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--fg)', lineHeight: 1.1 }}>{aoiScore ? `${showRatePct}%` : '--'}</div>
                        <div style={{ height: 4, borderRadius: 2, marginTop: 6, background: 'var(--bg-raised)', overflow: 'hidden' }}>
                          <div style={{ width: `${showRatePct}%`, height: '100%', background: 'linear-gradient(90deg, #f87171, var(--green))', borderRadius: 2 }} />
                        </div>
                      </div>
                      {/* Close Rate */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: '10px 12px', minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Close Rate</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--fg)', lineHeight: 1.1 }}>{aoiScore ? `${closeRatePct}%` : '--'}</div>
                        <div style={{ height: 4, borderRadius: 2, marginTop: 6, background: 'var(--bg-raised)', overflow: 'hidden' }}>
                          <div style={{ width: `${closeRatePct}%`, height: '100%', background: 'linear-gradient(90deg, #f87171, var(--green))', borderRadius: 2 }} />
                        </div>
                      </div>
                      {/* ALP */}
                      <MetricTile label="ALP" value={aoiScore ? `${Math.round((aoiScore.alp_score / 20) * 100)}%` : '--'} />
                      {/* Call Grade */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: gradeSoft(callGrade), padding: '10px 12px', minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Call Grade</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: gradeColor(callGrade), lineHeight: 1.1 }}>{callGrade}</div>
                      </div>
                      {/* Momentum */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: '10px 12px', minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Momentum</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--fg)', lineHeight: 1.1 }}>{aoiScore ? `${momentumScore}/10` : '--'}</div>
                        <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
                          {Array.from({ length: 10 }, (_, i) => (
                            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < momentumScore ? 'var(--primary-fg)' : 'var(--border)' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="Conversion Trend">
                    <RollingLineChart points={myTrend.slice(-4)} />
                  </SectionCard>
                </>
              )}

              {/* Calls tab */}
              {activeTab === 'calls' && (
                <SectionCard title="Recent Calls" right={<span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Select call to open detail</span>}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[
                      { key: 'booked' as const, label: 'Booked' },
                      { key: 'sold' as const, label: 'Sold' },
                      { key: 'not_int' as const, label: 'Not Int.' },
                      { key: 'other' as const, label: 'Other' },
                      { key: 'flagged' as const, label: 'Flagged' },
                    ].map(f => (
                      <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--fg-dim)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filters[f.key]} onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.checked }))} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredCalls.map(call => (
                      <button
                        key={call.id}
                        onClick={() => { setSelectedCallId(call.vdp_call_id === selectedCallId ? null : call.vdp_call_id); onCallClick?.(call); }}
                        style={{
                          border: `1px solid ${selectedCallId === call.vdp_call_id ? 'var(--primary-fg)' : 'var(--border)'}`,
                          borderLeft: `3px solid ${gradeLeftBorderColor(call.outcome_grade)}`,
                          borderRadius: 10,
                          background: selectedCallId === call.vdp_call_id ? 'var(--primary-soft)' : 'var(--bg-surface)',
                          textAlign: 'left',
                          color: 'var(--fg)',
                          padding: '10px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{call.cnresolution?.replace(/_/g, ' ') || 'Unknown'}</span>
                            <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{fmtDate(call.call_date)} &middot; {fmtDuration(call.duration_seconds)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <GradeBadge grade={call.outcome_grade} />
                            <span style={{ fontSize: 11, fontWeight: 800, color: call.converted ? 'var(--green)' : 'var(--amber)' }}>{call.converted ? (call.cnresolution === 'sold' ? '✓ Sold' : '🔥 Connect') : '✕ No Connect'}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Coaching tab */}
              {activeTab === 'coaching' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {coachingNotes.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--fg-dim)', padding: '8px 0' }}>No coaching notes yet.</div>
                    )}
                    {coachingNotes.map(note => (
                      <div key={note.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-raised)', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-fg)' }}>{note.manager}</span>
                          <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{fmtDate(note.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>{note.note}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '10px 0', zIndex: 1 }}>
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      placeholder="Add coaching note..."
                      style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: 12, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={newNoteManager}
                        onChange={e => setNewNoteManager(e.target.value)}
                        placeholder="Your name"
                        style={{ flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: 12, padding: '5px 8px' }}
                      />
                      <button
                        onClick={submitNote}
                        style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-fg)', borderRadius: 6, color: 'var(--primary-fg)', fontSize: 12, fontWeight: 700, padding: '5px 14px', cursor: 'pointer' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
