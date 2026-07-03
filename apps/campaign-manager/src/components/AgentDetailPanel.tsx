import { useState, useEffect } from 'react';
import type { MergedAgent, AgentHealthReport, AgentCommandType } from '../../shared/types';
import { getHealthStatus } from '../../shared/types';
import { api } from '../hooks/useApi';
import { authFetch } from '../hooks/useApi';
import { ScorecardModal, type CallRecord as IntelligenceCallRecord, type Scorecard } from './CallIntelligence';

interface Props {
  agent: MergedAgent;
  healthReport: AgentHealthReport | null;
  onClose: () => void;
}

interface AgentCallLogRecord extends IntelligenceCallRecord {
  twilio_call_sid: string;
  parent_call_sid?: string | null;
  from_number: string;
  twilio_from_number?: string;
  to_number: string;
  call_status: string;
  call_direction: string;
  recording_url?: string;
  taalk_lead_id?: string | null;
  lead_id?: string | null;
  associate_id?: string | number | null;
  result: string;
  result_key?: string;
  result_label?: string;
  lead_name?: string;
  score?: string | null;
  score_total?: number | null;
  has_scorecard?: boolean;
}

function timeSince(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function fmtPhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  if (!value) return '—';
  if (digits.length !== 10) return value || '—';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'var(--green)';
    case 'B': return 'var(--primary-fg)';
    case 'C': return 'var(--amber)';
    case 'D': return 'var(--orange, #f97316)';
    case 'F': return 'var(--red)';
    default: return 'var(--fg-dim)';
  }
}

function gradeColorSoft(grade: string): string {
  switch (grade) {
    case 'A': return 'var(--green-soft)';
    case 'B': return 'var(--primary-soft)';
    case 'C': return 'var(--amber-soft)';
    case 'D': return 'rgba(249,115,22,0.12)';
    case 'F': return 'var(--red-soft)';
    default: return 'var(--bg-raised)';
  }
}

function fmtUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

const COMMAND_CONFIG: { command: AgentCommandType; label: string; icon: string; color: string; bg: string }[] = [
  { command: 'force_refresh', label: 'Force Refresh', icon: '🔄', color: 'var(--primary-fg)', bg: 'var(--primary-soft)' },
  { command: 're_register', label: 'Re-Register', icon: '📡', color: 'var(--amber)', bg: 'var(--amber-soft)' },
  { command: 'test_audio', label: 'Test Audio', icon: '🔊', color: 'var(--green)', bg: 'var(--green-soft)' },
  { command: 'clear_state', label: 'Clear State', icon: '🗑️', color: 'var(--red)', bg: 'var(--red-soft)' },
  { command: 'screen_share', label: 'Screen Share', icon: '🖥️', color: 'var(--cyan, #06b6d4)', bg: 'rgba(6,182,212,0.12)' },
];

export function AgentDetailPanel({ agent, healthReport, onClose }: Props) {
  const [sending, setSending] = useState<string | null>(null);
  const [sentCommands, setSentCommands] = useState<string[]>([]);

  const [callStats, setCallStats] = useState<{ avg_grade: string; conversion_rate: number; total_calls: number; calls_this_week: number } | null>(null);
  const [callRecords, setCallRecords] = useState<{ id: string; call_date: string; duration_seconds: number; outcome_grade: string; converted: boolean; ai_summary: string; cnresolution: string }[]>([]);
  const [callLoading, setCallLoading] = useState(true);
  const [callError, setCallError] = useState(false);
  const [callLog, setCallLog] = useState<AgentCallLogRecord[]>([]);
  const [callLogLoading, setCallLogLoading] = useState(true);
  const [callLogError, setCallLogError] = useState(false);
  const [selectedCallTypes, setSelectedCallTypes] = useState<Set<string>>(() => new Set(['all']));
  const [scoringCall, setScoringCall] = useState<AgentCallLogRecord | null>(null);
  const [existingScorecard, setExistingScorecard] = useState<Scorecard | null>(null);

  useEffect(() => {
    setCallLoading(true);
    setCallError(false);
    Promise.all([
      fetch(`/api/call-intelligence/stats/${encodeURIComponent(agent.email)}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`/api/call-intelligence/agent/${encodeURIComponent(agent.email)}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ])
      .then(([stats, records]) => {
        setCallStats(stats);
        setCallRecords(Array.isArray(records) ? records : []);
      })
      .catch(() => setCallError(true))
      .finally(() => setCallLoading(false));
  }, [agent.email]);

  useEffect(() => {
    setCallLogLoading(true);
    setCallLogError(false);
    authFetch(`/api/agents/${encodeURIComponent(agent.email)}/call-log?limit=300`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setCallLog(Array.isArray(d?.calls) ? d.calls : []))
      .catch(() => setCallLogError(true))
      .finally(() => setCallLogLoading(false));
  }, [agent.email]);

  const sendCommand = async (command: AgentCommandType) => {
    setSending(command);
    try {
      await fetch('/api/agent-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agent.email, command }),
      });
      setSentCommands(prev => [...prev, command]);
      setTimeout(() => setSentCommands(prev => prev.filter(c => c !== command)), 3000);
    } catch (err) {
      console.error('Failed to send command:', err);
    }
    setSending(null);
  };

  const dispositionLabelByKey = new Map<string, string>();
  for (const call of callLog) {
    const key = String(call.result_key || call.cnresolution || 'pending').toLowerCase();
    const label = String(call.result_label || call.result || key).replace(/_/g, ' ');
    dispositionLabelByKey.set(key, label);
  }
  const callTypeOptions = ['all', ...Array.from(dispositionLabelByKey.keys()).sort()];
  const toggleCallType = (type: string) => {
    setSelectedCallTypes(prev => {
      if (type === 'all') return new Set(['all']);
      const next = new Set(prev);
      next.delete('all');
      if (next.has(type)) next.delete(type);
      else next.add(type);
      if (next.size === 0) next.add('all');
      return next;
    });
  };
  const visibleCallLog = callLog.filter(c => selectedCallTypes.has('all') || selectedCallTypes.has(String(c.result_key || c.cnresolution || 'pending').toLowerCase()));
  const openScorecard = async (call: AgentCallLogRecord) => {
    const callId = call.vdp_call_id || call.id;
    try {
      const r = await authFetch(`/api/call-intelligence/scorecard/${encodeURIComponent(callId)}`);
      setExistingScorecard(r.ok ? await r.json() : null);
    } catch {
      setExistingScorecard(null);
    }
    setScoringCall(call);
  };
  const saveScorecardLocally = (callId: string, data: Omit<Scorecard, 'filled_at'>) => {
    const total = Object.values(data.scores).filter(Boolean).length;
    setCallLog(prev => prev.map(call =>
      (call.vdp_call_id || call.id) === callId
        ? {
            ...call,
            score: `${total}/6`,
            score_total: total,
            has_scorecard: true,
            outcome_grade: total >= 5 ? 'A' : total >= 4 ? 'B' : total >= 3 ? 'C' : total >= 2 ? 'D' : 'F',
          }
        : call,
    ));
  };

  const healthStatus = healthReport ? getHealthStatus(healthReport) : null;
  const healthColor = healthStatus === 'healthy' ? 'var(--green)' : healthStatus === 'warning' ? 'var(--amber)' : healthStatus === 'error' ? 'var(--red)' : 'var(--fg-dim)';
  const healthDot = healthStatus === 'healthy' ? '🟢' : healthStatus === 'warning' ? '🟡' : healthStatus === 'error' ? '🔴' : '⚪';

  const sectionStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--fg-dim)',
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--fg)',
    fontWeight: 500,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(920px, 92vw)',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-bright)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-bright)',
        background: 'var(--bg-raised)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
            {agent.fullName && agent.fullName !== '?' ? agent.fullName : agent.email.split('@')[0]}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>{agent.email}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'var(--gray-soft)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--fg-dim)',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: 12,
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Health Overview */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Health Status</div>
          {healthReport ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{healthDot}</span>
              <span style={{ ...valueStyle, color: healthColor, fontWeight: 700 }}>
                {healthStatus === 'healthy' ? 'All Systems Go' : healthStatus === 'warning' ? 'Warnings Detected' : 'Issues Found'}
              </span>
              <span style={{ fontSize: 9, color: 'var(--fg-dim)', marginLeft: 'auto' }}>
                {timeSince(healthReport.timestamp)}
              </span>
            </div>
          ) : (
            <div style={{ ...valueStyle, color: 'var(--fg-dim)' }}>No health report received</div>
          )}
          {agent.id > 0 && (
            <a
              href={`https://lets.taalk.ai/console/vdp_operators/vdp_agents?db=michaelmandella&searchBy=${agent.id}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 10, color: 'var(--primary-fg)', marginTop: 6, display: 'inline-block', textDecoration: 'underline' }}
            >
              View in Taalk VDP →
            </a>
          )}
        </div>

        {/* Licensed States */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Licensed States{agent.ccPro ? ' · CC Pro ✓' : ''}</div>
          {agent.states && agent.states.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {agent.states.map(s => (
                <span key={s} style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px',
                  borderRadius: 3, background: 'var(--primary-soft)', color: 'var(--primary-fg)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}>{s}</span>
              ))}
            </div>
          ) : (
            <div style={{ ...valueStyle, color: 'var(--fg-dim)' }}>No states on record</div>
          )}
        </div>

        {healthReport && (
          <>
            {/* Mic & Audio */}
            <div style={sectionStyle}>
              <div style={labelStyle}>Audio</div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Microphone</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: healthReport.mic === 'ok' ? 'var(--green)' : 'var(--red)',
                }}>
                  {healthReport.mic === 'ok' ? '✓ Working' : healthReport.mic === 'blocked' ? '✕ Blocked' : '✕ None'}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Input Device</span>
                <span style={{ fontSize: 11, color: 'var(--fg)' }}>{healthReport.audio?.input ?? "Unknown"}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Output Device</span>
                <span style={{ fontSize: 11, color: 'var(--fg)' }}>{healthReport.audio?.output ?? "Unknown"}</span>
              </div>
            </div>

            {/* Network */}
            {healthReport.network && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Network</div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Latency</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: healthReport.network.latency < 100 ? 'var(--green)' : healthReport.network.latency < 200 ? 'var(--amber)' : 'var(--red)',
                }}>
                  {healthReport.network.latency}ms
                </span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Quality</span>
                <span className="badge" style={{
                  fontSize: 9, fontWeight: 600,
                  background: healthReport.network.quality === 'good' ? 'var(--green-soft)' : healthReport.network.quality === 'degraded' ? 'var(--amber-soft)' : 'var(--red-soft)',
                  color: healthReport.network.quality === 'good' ? 'var(--green)' : healthReport.network.quality === 'degraded' ? 'var(--amber)' : 'var(--red)',
                }}>
                  {healthReport.network.quality.toUpperCase()}
                </span>
              </div>
            </div>
            )}

            {/* Browser & WebRTC */}
            <div style={sectionStyle}>
              <div style={labelStyle}>System</div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Browser</span>
                <span style={{ fontSize: 11, color: 'var(--fg)' }}>{healthReport.browser?.name ?? "Unknown"} {healthReport.browser?.version ?? ""}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>WebRTC</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: healthReport.webrtc === 'registered' ? 'var(--green)' : healthReport.webrtc === 'disconnected' ? 'var(--amber)' : 'var(--red)',
                }}>
                  {healthReport.webrtc === 'registered' ? '✓ Registered' : healthReport.webrtc === 'disconnected' ? '⚠ Disconnected' : '✕ Failed'}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Credits</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: healthReport.credits === 0 ? 'var(--red)' : healthReport.credits < 10 ? 'var(--amber)' : 'var(--green)',
                }}>
                  {healthReport.credits}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>States Licensed</span>
                <span style={{ fontSize: 11, color: 'var(--fg)' }}>{healthReport.statesCount}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Market</span>
                <span style={{ fontSize: 11, color: 'var(--fg)' }}>{healthReport.market}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Uptime</span>
                <span style={{ fontSize: 11, color: 'var(--fg)' }}>{fmtUptime(healthReport.uptime)}</span>
              </div>
            </div>

            {/* Errors */}
            {healthReport.errors?.length > 0 && (
              <div style={sectionStyle}>
                <div style={labelStyle}>Errors ({healthReport.errors.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {healthReport.errors.map((err, i) => (
                    <div key={i} style={{
                      fontSize: 10,
                      color: 'var(--red)',
                      background: 'var(--red-soft)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                    }}>
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Real-time Twilio Call Log */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={labelStyle}>Call Log</div>
            <button
              onClick={() => {
                setCallLogLoading(true);
                authFetch(`/api/agents/${encodeURIComponent(agent.email)}/call-log?limit=300`)
                  .then(r => { if (!r.ok) throw new Error(); return r.json(); })
                  .then(d => setCallLog(Array.isArray(d?.calls) ? d.calls : []))
                  .catch(() => setCallLogError(true))
                  .finally(() => setCallLogLoading(false));
              }}
              style={{ fontSize: 9, color: 'var(--primary-fg)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              refresh
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '6px 0 8px' }}>
            {callTypeOptions.map(type => {
              const selected = selectedCallTypes.has(type);
              return (
                <label
                  key={type}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    color: selected ? 'var(--primary-fg)' : 'var(--fg-dim)',
                    background: selected ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '2px 7px',
                    cursor: 'pointer',
                    textTransform: type === 'all' ? 'none' : 'capitalize',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleCallType(type)}
                    style={{ width: 10, height: 10 }}
                  />
                  {type === 'all' ? 'All' : dispositionLabelByKey.get(type) || type.replace(/_/g, ' ')}
                </label>
              );
            })}
          </div>
          {callLogLoading ? (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Loading Twilio calls...</div>
          ) : callLogError ? (
            <div style={{ fontSize: 11, color: 'var(--red)' }}>Could not load call log</div>
          ) : visibleCallLog.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No calls match this filter</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 820, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {['Time', 'Taalk', 'Local', 'From', 'To', 'Result', 'Dur', 'Score', 'Rec'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          fontSize: 8,
                          color: 'var(--fg-dim)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          textAlign: 'left',
                          padding: '4px 5px',
                          borderBottom: '1px solid var(--border)',
                          width: i === 0 ? 92 : i === 1 ? 88 : i === 2 ? 64 : i === 3 ? 118 : i === 4 ? 112 : i === 5 ? 112 : i >= 6 ? 54 : undefined,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleCallLog.map(call => {
                    const fromLabel = call.from_number ? fmtPhone(call.from_number) : 'not captured';
                    return (
                      <tr
                        key={call.id}
                        onClick={() => openScorecard(call)}
                        title={call.from_number ? 'Click to score this call' : `Twilio client leg captured as ${call.twilio_from_number || 'client leg'}; local presence leg was not stored`}
                        style={{ cursor: 'pointer', background: 'var(--bg-raised)' }}
                      >
                        <td style={{ fontSize: 9, color: 'var(--fg)', padding: '5px', borderBottom: '1px solid var(--border)' }}>{fmtDateTime(call.call_date)}</td>
                        <td style={{ fontSize: 9, color: 'var(--fg)', padding: '5px', borderBottom: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{call.taalk_lead_id || '—'}</td>
                        <td style={{ fontSize: 9, color: 'var(--fg)', padding: '5px', borderBottom: '1px solid var(--border)' }}>{call.lead_id || '—'}</td>
                        <td style={{ fontSize: 9, color: call.from_number ? 'var(--fg)' : 'var(--amber)', padding: '5px', borderBottom: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fromLabel}</td>
                        <td style={{ fontSize: 9, color: 'var(--fg)', padding: '5px', borderBottom: '1px solid var(--border)' }}>{fmtPhone(call.to_number)}</td>
                        <td style={{ fontSize: 9, color: 'var(--fg)', padding: '5px', borderBottom: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{call.result_label || call.result || '—'}</td>
                        <td style={{ fontSize: 9, color: 'var(--fg-dim)', padding: '5px', borderBottom: '1px solid var(--border)' }}>{fmtDuration(call.duration_seconds || 0)}</td>
                        <td style={{ fontSize: 9, padding: '5px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: gradeColor(call.outcome_grade || '—'), background: gradeColorSoft(call.outcome_grade || '—'), borderRadius: 4, padding: '1px 4px', fontWeight: 800 }}>
                            {call.score || call.outcome_grade || '—'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()} style={{ fontSize: 9, padding: '5px', borderBottom: '1px solid var(--border)' }}>
                          {call.recording_url ? <audio controls src={call.recording_url} style={{ width: 58, height: 24 }} /> : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Call Intelligence */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Call Intelligence</div>
          {callLoading ? (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '4px 0' }}>Loading scores...</div>
          ) : callError || !callStats ? (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '4px 0' }}>No call scores yet</div>
          ) : callStats.total_calls === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '4px 0' }}>No scored calls yet</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    background: gradeColorSoft(callStats.avg_grade),
                    color: gradeColor(callStats.avg_grade),
                    padding: '2px 8px', borderRadius: 4,
                  }}>{callStats.avg_grade}</span>
                  <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>Avg Grade</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                    {Math.round(callStats.conversion_rate * 100)}%
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>Conversion</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                    {callStats.calls_this_week}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>This Week</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {callRecords.slice(0, 5).map(call => (
                  <div key={call.id} style={{
                    background: 'var(--bg-raised)',
                    borderRadius: 5,
                    padding: '6px 8px',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--fg-dim)', minWidth: 44 }}>
                        {fmtShortDate(call.call_date)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
                        {fmtDuration(call.duration_seconds)}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        background: gradeColorSoft(call.outcome_grade),
                        color: gradeColor(call.outcome_grade),
                        padding: '1px 5px', borderRadius: 3,
                      }}>{call.outcome_grade}</span>
                      <span style={{ fontSize: 11, marginLeft: 'auto', color: call.converted ? 'var(--green)' : 'var(--fg-dim)' }}>
                        {call.converted ? '✓' : '✕'}
                      </span>
                    </div>
                    {call.ai_summary && (
                      <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginTop: 3, lineHeight: 1.4 }}>
                        {call.ai_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Remote Actions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {COMMAND_CONFIG.map(({ command, label, icon, color, bg }) => {
              const isSending = sending === command;
              const wasSent = sentCommands.includes(command);
              return (
                <button
                  key={command}
                  onClick={() => sendCommand(command)}
                  disabled={isSending}
                  style={{
                    background: wasSent ? 'var(--green-soft)' : bg,
                    color: wasSent ? 'var(--green)' : color,
                    border: `1px solid ${wasSent ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: isSending ? 'wait' : 'pointer',
                    opacity: isSending ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {wasSent ? '✓' : icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {scoringCall && (
        <ScorecardModal
          call={scoringCall}
          existing={existingScorecard}
          onSave={saveScorecardLocally}
          onClose={() => setScoringCall(null)}
        />
      )}
    </div>
  );
}
