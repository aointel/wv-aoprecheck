import { useEffect, useState, useRef } from 'react';

interface IncomingTransfer {
  leadId: string;
  firstName: string;
  lastName: string;
  market: string;
  phone: string;
  state: string;
  agents: string[];
  agentBlasts: Record<string, number>;
  currentRound: string[];
  stage: 'ai_qualifying' | 'queued' | 'ringing' | 'no_agent';
  blasted: boolean;
  time: number;
  pickedUp: boolean;
  answered: boolean;
}

interface MissedTransfer {
  leadName: string;
  leadState: string;
  market: string;
  phone: string;
  missedBy: string[];
  missedAt: string;
  ringCycles?: number;
}

interface LiveQueueData {
  pending: IncomingTransfer[];
  picked: IncomingTransfer[];
  agentMisses: Record<string, number>;
  agentRings: Record<string, number>;
  missedTransfers?: MissedTransfer[];
  total: number;
}

function secs(time: number): number {
  return Math.floor((Date.now() - time) / 1000);
}

export function LiveTransferFeed() {
  const [data, setData] = useState<LiveQueueData | null>(null);
  const [missedFeed, setMissedFeed] = useState<MissedTransfer[]>([]);
  const [flashMissed, setFlashMissed] = useState(false);
  const [, setTick] = useState(0);
  const seenMissedKeys = useRef(new Set<string>());

  // Tick every second for live durations
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Poll live queue every 3s
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/diagnostics/proxy/live-queue');
        if (!r.ok) return;
        const d: LiveQueueData = await r.json();
        setData(d);

        // Accumulate new missed transfers
        if (d.missedTransfers?.length) {
          let hasNew = false;
          setMissedFeed(prev => {
            const next = [...prev];
            for (const m of d.missedTransfers!) {
              const key = `${m.phone}-${m.missedAt}`;
              if (!seenMissedKeys.current.has(key)) {
                seenMissedKeys.current.add(key);
                next.unshift(m);
                hasNew = true;
              }
            }
            return next.slice(0, 20);
          });
          if (hasNew) {
            setFlashMissed(true);
            setTimeout(() => setFlashMissed(false), 3000);
          }
        }
      } catch { /* non-critical */ }
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const aiQualifying = data.pending.filter(t => t.stage === 'ai_qualifying');
  const queued = data.pending.filter(t => t.stage === 'queued');
  const ringing = data.pending.filter(t => t.stage === 'ringing' || t.stage === 'no_agent');
  const connected = data.picked;

  const totalActive = data.pending.length + connected.length;
  if (totalActive === 0 && missedFeed.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{ background: 'hsl(217 33% 10%)' }}>
        <span className="text-sm font-bold text-white">📡 Live Queue</span>
        {data.pending.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            {data.pending.length} active
          </span>
        )}
        {missedFeed.length > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${flashMissed ? 'animate-pulse' : ''}`} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            {missedFeed.length} missed
          </span>
        )}
      </div>

      <div className="divide-y" style={{ maxHeight: 360, overflowY: 'auto' }}>

        {/* Ringing */}
        {ringing.map(t => {
          const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
          const elapsed = secs(t.time);
          const dying = elapsed > 30;
          const urgent = elapsed > 10;
          const roundSet = new Set(t.currentRound ?? []);
          const ringingAgents = t.currentRound ?? [];
          const missedAgents = Object.keys(t.agentBlasts ?? {}).filter(n => !roundSet.has(n));
          return (
            <div key={t.leadId} className={dying ? 'animate-pulse' : ''} style={{
              padding: '8px 12px',
              background: dying ? 'rgba(239,68,68,0.1)' : urgent ? 'rgba(234,179,8,0.05)' : 'transparent',
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">{t.stage === 'no_agent' ? '🚫' : dying ? '💀' : urgent ? '⚠️' : '📲'}</span>
                <span className="text-sm font-bold" style={{ color: dying ? '#f87171' : 'inherit' }}>{name}</span>
                {t.market && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{t.market}</span>}
                {t.state && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{t.state}</span>}
                <span className="flex-1" />
                <span className="text-sm font-bold tabular-nums" style={{ color: dying ? '#f87171' : urgent ? '#f59e0b' : '#10b981' }}>{elapsed}s</span>
              </div>
              {t.stage === 'no_agent' ? (
                <div className="text-xs font-bold text-red-500 animate-pulse">🚫 No agent available</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {ringingAgents.map(agentName => (
                    <div key={agentName} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded" style={{ background: 'rgba(6,182,212,0.1)' }}>
                      <span>📲</span>
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">{agentName}</span>
                    </div>
                  ))}
                  {missedAgents.map(agentName => (
                    <div key={agentName} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <span>👻</span>
                      <span className="font-semibold text-red-500">Missed — {agentName}</span>
                    </div>
                  ))}
                  {ringingAgents.length === 0 && missedAgents.length === 0 && (
                    <div className="text-xs text-cyan-500 animate-pulse px-2">📳 Blasting to agents...</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Queued */}
        {queued.map(t => {
          const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
          const elapsed = secs(t.time);
          return (
            <div key={t.leadId} style={{ padding: '8px 12px', background: elapsed > 30 ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs">⏳</span>
                <span className="text-sm font-medium">{name}</span>
                {t.market && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{t.market}</span>}
                <span className="flex-1" />
                <span className="text-xs font-bold tabular-nums text-amber-500">{elapsed}s</span>
              </div>
            </div>
          );
        })}

        {/* AI Qualifying */}
        {aiQualifying.map(t => {
          const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
          const elapsed = secs(t.time);
          return (
            <div key={t.leadId} style={{ padding: '8px 12px' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs">🤖</span>
                <span className="text-sm font-medium">{name}</span>
                {t.market && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{t.market}</span>}
                <span className="flex-1" />
                <span className="text-xs font-bold tabular-nums text-purple-500">{elapsed}s</span>
              </div>
            </div>
          );
        })}

        {/* Connected */}
        {connected.slice(0, 5).map(t => {
          const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || '?';
          return (
            <div key={t.leadId} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.04)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-500">✅</span>
                <span className="text-xs text-muted-foreground">{name}</span>
                {t.market && <span className="text-[9px] text-muted-foreground">{t.market}</span>}
              </div>
            </div>
          );
        })}

        {/* Missed feed */}
        {missedFeed.length > 0 && (
          <>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${flashMissed ? 'animate-pulse' : ''}`} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
              ❌ Missed ({missedFeed.length})
            </div>
            {missedFeed.map((m, i) => (
              <div key={`${m.phone}-${m.missedAt}`} style={{
                padding: '6px 12px',
                background: i === 0 && flashMissed ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.03)',
              }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{m.leadName || m.phone}</span>
                  {m.leadState && <span className="text-[9px] px-1 rounded bg-red-100 dark:bg-red-900/20 text-red-600">{m.leadState}</span>}
                  {m.market && <span className="text-[9px] text-muted-foreground">{m.market}</span>}
                  <span className="flex-1" />
                  {(m.ringCycles ?? 1) > 1 && <span className="text-[9px] font-bold text-red-500">{m.ringCycles}× blasted</span>}
                  <span className="text-[9px] text-muted-foreground">{new Date(m.missedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {m.missedBy?.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {m.missedBy.map((name, j) => (
                      <div key={j} className="text-[10px] text-red-500 font-semibold pl-1">👻 Missed — {name}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
