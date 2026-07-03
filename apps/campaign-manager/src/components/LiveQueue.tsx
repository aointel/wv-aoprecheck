import { useState, useEffect, useMemo, useRef } from 'react';
import type { NormalizedAgent, ActiveCall, CompletedTransfer, DialingCampaign, MergedStats, MissedTransfer } from '../../shared/types';
import { durationSince } from '../utils';

interface Props {
  agents: NormalizedAgent[];
  activeCalls: ActiveCall[];
  completedTransfers: CompletedTransfer[];
  missedTransfers: MissedTransfer[];
  dialingCampaigns: DialingCampaign[];
  stats: MergedStats;
  marketFilter?: string; // when set, only show transfers for this market
}

type TransferStage = 'ai_qualifying' | 'queued' | 'ringing' | 'no_agent';

interface IncomingTransfer {
  leadId: string;
  firstName: string;
  lastName: string;
  market: string;
  phone: string;
  state: string;
  agents: string[];
  agentBlasts: Record<string, number>; // name → how many times blasted total
  currentRound: string[];              // names of agents in the CURRENT blast round
  stage: TransferStage;
  blasted: boolean; // legacy: true = ringing
  time: number;
  pickedUp: boolean;
}

export function LiveQueue({ agents, activeCalls, completedTransfers, missedTransfers, dialingCampaigns, stats, marketFilter }: Props) {
  const mkt = marketFilter?.toLowerCase();
  const [, setTick] = useState(0);
  const [incoming, setIncoming] = useState<IncomingTransfer[]>([]);
  const [pickedUp, setPickedUp] = useState<IncomingTransfer[]>([]);
  const [agentMisses, setAgentMisses] = useState<Record<string, number>>({});
  const [missedFeed, setMissedFeed] = useState<MissedTransfer[]>([]);
  const seenMissedKeys = useRef(new Set<string>());
  const [flashMissed, setFlashMissed] = useState(false);

  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    const poll = () => fetch('/api/transfers/incoming').then(r => r.json()).then(d => {
      const filter = (arr: IncomingTransfer[]) =>
        mkt ? arr.filter(t => t.market?.toLowerCase() === mkt) : arr;
      setIncoming(filter(d.pending ?? []));
      setPickedUp(filter(d.picked ?? []));
      setAgentMisses(d.agentMisses ?? {});
    }).catch(() => {});
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [mkt]);

  useEffect(() => {
    if (!missedTransfers?.length) return;
    let hasNew = false;
    const filtered = missedTransfers;
    setMissedFeed(prev => {
      const next = [...prev];
      for (const m of filtered) {
        const key = `${m.phone}-${m.missedAt}`;
        if (!seenMissedKeys.current.has(key)) {
          seenMissedKeys.current.add(key);
          next.unshift(m);
          hasNew = true;
        }
      }
      return next.slice(0, 30);
    });
    if (hasNew) {
      setFlashMissed(true);
      setTimeout(() => setFlashMissed(false), 3000);
    }
  }, [missedTransfers]);

  const agentNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of agents) { if (a.id) m[String(a.id)] = a.fullName; }
    return m;
  }, [agents]);

  const aiQualifying  = incoming.filter(t => t.stage === 'ai_qualifying');
  const queued        = incoming.filter(t => t.stage === 'queued');
  const transferred   = incoming.filter(t => t.stage === 'ringing' || t.stage === 'no_agent');
  const connected = activeCalls.filter(c => c.status === 'active');
  const completed = completedTransfers;

  const sectionStyle: React.CSSProperties = { borderBottom: '2px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 80, maxHeight: 260, overflow: 'hidden' };
  const headerStyle = (bg: string): React.CSSProperties => ({ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: bg, flexShrink: 0 });
  const bodyStyle: React.CSSProperties = { overflowY: 'auto', flex: 1 };
  const emptyStyle: React.CSSProperties = { padding: '16px', textAlign: 'center' as const, color: 'var(--fg-dim)', fontSize: 11 };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── 🤖 AI QUALIFYING ── */}
      <div style={sectionStyle}>
        <div style={headerStyle('rgba(139,92,246,0.06)')}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>🤖</span>
            <span className="text-[12px] font-black uppercase" style={{ color: 'var(--purple, #a78bfa)' }}>AI Qualifying</span>
            <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--purple, #a78bfa)' }}>{aiQualifying.length}</span>
          </div>
        </div>
        <div style={bodyStyle}>
          {aiQualifying.length === 0 ? (
            <div style={emptyStyle}>No active AI conversations</div>
          ) : (
            aiQualifying.map(t => {
              const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
              const secs = Math.floor((Date.now() - t.time) / 1000);
              return (
                <div key={t.leadId} className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--row-border)' }}>
                  <span className="text-[12px] font-bold" style={{ color: 'var(--fg)' }}>{name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)' }}>{t.market}</span>
                  <span className="flex-1" />
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--purple, #a78bfa)' }}>{secs}s</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── ⏳ QUEUED ── */}
      <div style={sectionStyle}>
        <div style={headerStyle('rgba(234,179,8,0.06)')}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>⏳</span>
            <span className="text-[12px] font-black uppercase" style={{ color: 'var(--amber, #f59e0b)' }}>Queued</span>
            <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--amber, #f59e0b)' }}>{queued.length}</span>
          </div>
        </div>
        <div style={bodyStyle}>
          {queued.length === 0 ? (
            <div style={emptyStyle}>No leads in queue</div>
          ) : (
            queued.map(t => {
              const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
              const secs = Math.floor((Date.now() - t.time) / 1000);
              // After 20s in queue with no blast → pulsing no-agent warning
              const noAgentSignal = secs >= 20;
              const critical = secs >= 45;
              return (
                <div key={t.leadId} className={critical ? 'animate-pulse' : ''} style={{
                  padding: '8px 16px', borderBottom: '1px solid var(--row-border)',
                  background: critical ? 'rgba(239,68,68,0.08)' : noAgentSignal ? 'rgba(234,179,8,0.05)' : 'transparent',
                }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold" style={{ color: critical ? 'var(--red)' : 'var(--fg)' }}>{name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)' }}>{t.market}</span>
                    <span className="flex-1" />
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: critical ? 'var(--red)' : noAgentSignal ? 'var(--amber, #f59e0b)' : 'var(--amber, #f59e0b)' }}>{secs}s</span>
                  </div>
                  {noAgentSignal && (
                    <div className="flex items-center gap-1 mt-1" style={{ color: critical ? 'var(--red)' : 'rgba(234,179,8,0.9)' }}>
                      <span style={{ fontSize: 10 }} className="animate-pulse">🚫</span>
                      <span className="text-[10px] font-bold animate-pulse">
                        {critical ? 'NO AGENT — call dying' : 'No agent available'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 📲 RINGING ── */}
      <div style={sectionStyle}>
        <div style={headerStyle(transferred.some(t => Date.now() - t.time > 10000) ? 'rgba(239,68,68,0.08)' : 'rgba(6,182,212,0.06)')}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }} className={transferred.length > 0 ? 'animate-pulse' : ''}>📲</span>
            <span className="text-[12px] font-black uppercase" style={{ color: transferred.some(t => Date.now() - t.time > 10000) ? 'var(--red)' : 'var(--cyan, #06b6d4)' }}>Ringing</span>
            <span className="text-[14px] font-black tabular-nums" style={{ color: transferred.some(t => Date.now() - t.time > 10000) ? 'var(--red)' : 'var(--cyan, #06b6d4)' }}>{transferred.length}</span>
          </div>
        </div>
        <div style={bodyStyle}>
          {transferred.length === 0 ? (
            <div style={emptyStyle}>No pending transfers</div>
          ) : (
            transferred.map(t => {
            const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
            const secs = Math.floor((Date.now() - t.time) / 1000);
            const dying = secs > 30;
            const urgent = secs > 10;
            return (
              <div key={t.leadId} className={dying ? 'animate-pulse' : ''} style={{
                padding: '8px 16px', borderBottom: '1px solid var(--row-border)',
                background: dying ? 'rgba(239,68,68,0.1)' : urgent ? 'rgba(234,179,8,0.06)' : 'transparent',
              }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13 }}>{dying ? '💀' : urgent ? '⚠️' : '📱'}</span>
                  <span className="text-[13px] font-bold" style={{ color: dying ? 'var(--red)' : 'var(--fg)' }}>{name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)' }}>{t.market}</span>
                  <span className="flex-1" />
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: dying ? 'var(--red)' : urgent ? 'var(--amber)' : 'var(--green)' }}>{secs}s</span>
                </div>
                {/* WHO IS RINGING / NO AGENT */}
                <div className="flex flex-col gap-1 mt-1.5">
                  {t.stage === 'no_agent' ? (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded animate-pulse" style={{ background: 'rgba(239,68,68,0.15)' }}>
                      <span style={{ fontSize: 15 }}>🚫</span>
                      <span className="text-[13px] font-black" style={{ color: 'var(--red)' }}>No Agent Found</span>
                      {t.state && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--red)' }}>{t.state}</span>}
                    </div>
                  ) : Object.keys(t.agentBlasts ?? {}).length === 0 ? (
                    <div className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: 'rgba(6,182,212,0.1)' }}>
                      <span style={{ fontSize: 14 }} className="animate-pulse">📳</span>
                      <span className="text-[12px] font-bold" style={{ color: 'var(--cyan, #06b6d4)' }}>Blasting to agents...</span>
                    </div>
                  ) : (() => {
                    const round = new Set(t.currentRound ?? []);
                    // All unique names: currently ringing first, then missed
                    const ringing = (t.currentRound ?? []).filter(n => n);
                    const missed = Object.keys(t.agentBlasts ?? {}).filter(n => !round.has(n));
                    return [...ringing.map(name => ({ name, isMissed: false })), ...missed.map(name => ({ name, isMissed: true }))].map(({ name, isMissed }) => (
                      <div key={name} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{
                        background: isMissed ? 'rgba(239,68,68,0.18)' : 'rgba(6,182,212,0.1)',
                        border: isMissed ? '1px solid rgba(239,68,68,0.35)' : 'none',
                      }}>
                        <span style={{ fontSize: 15 }}>{isMissed ? '👻' : '📲'}</span>
                        <span className="text-[13px] font-black" style={{ color: isMissed ? 'var(--red)' : 'var(--cyan, #06b6d4)' }}>
                          {isMissed ? `Missed - ${name}` : name}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
                {dying && <div className="text-[10px] font-black mt-1.5" style={{ color: 'var(--red)' }}>📞 Pick up the phone!</div>}
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* ── ❌ MISSED ── */}
      {missedFeed.length > 0 && (
        <div style={{ ...sectionStyle, borderBottom: '2px solid rgba(239,68,68,0.4)' }}>
          <div style={headerStyle(flashMissed ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)')}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14 }} className={flashMissed ? 'animate-pulse' : ''}>❌</span>
              <span className={`text-[12px] font-black uppercase ${flashMissed ? 'animate-pulse' : ''}`} style={{ color: 'var(--red)' }}>Missed</span>
              <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--red)' }}>{missedFeed.length}</span>
            </div>
          </div>
          <div style={bodyStyle}>
          {missedFeed.map((m, i) => (
            <div key={`${m.phone}-${m.missedAt}`} className="px-4 py-2" style={{
              borderBottom: '1px solid var(--row-border)',
              background: i === 0 && flashMissed ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.04)',
            }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold" style={{ color: 'var(--fg)' }}>
                  {m.leadName || m.phone}
                </span>
                {m.leadState && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }}>
                    {m.leadState}
                  </span>
                )}
                {m.market && m.market !== m.leadState && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)' }}>
                    {m.market}
                  </span>
                )}
                <span className="flex-1" />
                {(m.ringCycles ?? 1) > 1 && (
                  <span className="text-[9px] font-bold" style={{ color: 'var(--red)' }}>
                    {m.ringCycles}× blasted
                  </span>
                )}
                <span className="text-[9px]" style={{ color: 'var(--fg-dim)' }}>
                  {new Date(m.missedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {m.missedBy?.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-1">
                  {m.missedBy.map((name, j) => (
                    <div key={j} className="flex items-center gap-1">
                      <span style={{ fontSize: 9, color: 'var(--red)' }}>•</span>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--red)' }}>
                        👻 Missed - {name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ── 📞 CONNECTED ── */}
      <div style={sectionStyle}>
        <div style={headerStyle('rgba(16,185,129,0.06)')}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>📞</span>
            <span className="text-[12px] font-black uppercase" style={{ color: 'var(--green)' }}>Connected</span>
            <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--green)' }}>{connected.length + pickedUp.length}</span>
          </div>
        </div>
        <div style={bodyStyle}>
        {connected.length === 0 && pickedUp.length === 0 ? (
          <div style={emptyStyle}>No live calls</div>
        ) : (<>
          {connected.map(c => (
            <div key={c.agentId} className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--row-border)' }}>
              <span className="text-[12px] font-bold" style={{ color: 'var(--fg)' }}>{c.leadName}</span>
              {c.leadState && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)' }}>{c.leadState}</span>}
              <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>→ {c.agentName}</span>
              <span className="flex-1" />
              <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--green)' }}>{durationSince(c.startedAt)}</span>
            </div>
          ))}
          {pickedUp.slice(0, 5).map(t => {
            const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
            return (
              <div key={t.leadId} className="px-4 py-1.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--row-border)' }}>
                <span className="text-[10px]" style={{ color: 'var(--green)' }}>✅</span>
                <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>{name}</span>
                <span className="text-[9px]" style={{ color: 'var(--fg-dim)' }}>{t.market}</span>
              </div>
            );
          })}
        </>)}
        </div>
      </div>

      {/* ── 💰 COMPLETED ── */}
      <div style={{ ...sectionStyle, flex: 1, maxHeight: 'none' }}>
        <div style={headerStyle('transparent')}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>💰</span>
            <span className="text-[12px] font-black uppercase" style={{ color: 'var(--fg-dim)' }}>Completed</span>
            <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--fg-dim)' }}>{completed.length}</span>
          </div>
        </div>
        <div style={bodyStyle}>
        {completed.length === 0 ? (
          <div style={emptyStyle}>No recent completions</div>
        ) : (
          completed.map((ct, i) => {
            const dur = ct.callDuration > 0 ? `${Math.floor(ct.callDuration / 60)}:${String(ct.callDuration % 60).padStart(2, '0')}` : '—';
            return (
              <div key={`${ct.agentId}-${i}`} className="px-4 py-1 flex items-center gap-2" style={{
                borderBottom: '1px solid var(--row-border)',
                background: ct.billable ? 'rgba(34,197,94,0.04)' : 'transparent',
                opacity: ct.billable ? 1 : 0.6,
              }}>
                {ct.billable ? <span style={{ fontSize: 9 }}>💰</span> : <span style={{ fontSize: 9 }}>❌</span>}
                <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>{ct.leadName}</span>
                <span className="text-[9px]" style={{ color: 'var(--fg-dim)' }}>{dur}</span>
                <span className="text-[9px]" style={{ color: 'var(--fg-dim)' }}>→ {ct.agentName}</span>
                {ct.billable && <span className="text-[9px] font-bold" style={{ color: 'var(--green)' }}>+${ct.revenueEarned}</span>}
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
