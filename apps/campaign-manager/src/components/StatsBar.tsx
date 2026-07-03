import { useState, useEffect } from 'react';
import type { MergedStats } from '../../shared/types';

interface Props {
  stats: MergedStats;
  connected: boolean;
  teamDrb?: { d: number; r: number; b: number; i: number };
}

type AlpMonth = { month: string; year: number; alp: number };

function fmtAlp(n: number) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'K';
  return '$' + n.toLocaleString();
}

export function StatsBar({ stats, connected, teamDrb }: Props) {
  const [incoming, setIncoming] = useState<{ pending: any[]; picked: any[]; agentMisses: Record<string, number> }>({ pending: [], picked: [], agentMisses: {} });
  const [alpMonths, setAlpMonths] = useState<AlpMonth[]>([]);

  useEffect(() => {
    const poll = () => fetch('/api/transfers/incoming').then(r => r.json()).then(d => setIncoming(d)).catch(() => {});
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const poll = () => fetch('/api/alp/monthly').then(r => r.json()).then(d => { if (d.months) setAlpMonths(d.months); }).catch(() => {});
    poll();
    const iv = setInterval(poll, 15 * 60_000);
    return () => clearInterval(iv);
  }, []);

  const supa = stats.supabase;
  const connects = supa ? supa.connects : (stats.revenue?.connectsToday ?? 0);
  const revenue = supa ? supa.revenue : (stats.revenue?.revenueToday ?? 0);
  const revenuePerHr = stats.revenue?.revenuePerHour ?? 0;
  const unanswered = incoming.pending?.length ?? 0;
  const answered = incoming.picked?.length ?? 0;
  const totalIncoming = unanswered + answered;
  const answerRate = totalIncoming > 0 ? Math.round((answered / totalIncoming) * 100) : 0;
  const missers = Object.keys(incoming.agentMisses || {}).length;

  const alarmLevel = unanswered >= 3 ? 'critical' : unanswered >= 1 ? 'warning' : 'ok';

  return (
    <div className="flex-shrink-0" style={{
      background: alarmLevel === 'critical'
        ? 'linear-gradient(to right, rgba(239,68,68,0.15), var(--bg-raised))'
        : alarmLevel === 'warning'
          ? 'linear-gradient(to right, rgba(234,179,8,0.1), var(--bg-raised))'
          : 'var(--bg-raised)',
      borderBottom: '1px solid var(--border)',
      animation: alarmLevel === 'critical' ? 'pulse 2s infinite' : undefined,
    }}>
      {/* Row 1: Revenue + Answer Rate + Agents */}
      <div className="flex items-center justify-between px-5 py-1.5">
        <div className="flex items-center gap-6">
          {/* Revenue */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[24px] font-black tabular-nums" style={{
              color: revenue > 0 ? '#22c55e' : 'var(--fg-dim)',
              textShadow: revenue > 0 ? '0 0 12px rgba(34,197,94,0.3)' : 'none',
            }}>
              ${revenue.toLocaleString()}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>today</span>
            {revenuePerHr > 0 && (
              <span className="text-[11px] font-semibold" style={{ color: 'var(--green)' }}>${revenuePerHr.toFixed(0)}/hr</span>
            )}
          </div>

          <div className="w-px h-8" style={{ background: 'var(--border)' }} />

          {/* Connects */}
          <div className="flex items-baseline gap-1">
            <span className="text-[20px] font-black tabular-nums" style={{ color: connects > 0 ? 'var(--green)' : 'var(--fg-dim)' }}>
              {connects}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>connects</span>
          </div>

          <div className="w-px h-8" style={{ background: 'var(--border)' }} />

          {/* Answer Rate — THE KPI */}
          <div className="flex items-baseline gap-1">
            <span className="text-[20px] font-black tabular-nums" style={{
              color: answerRate >= 80 ? 'var(--green)' : answerRate >= 50 ? 'var(--amber)' : 'var(--red)',
            }}>
              {answerRate}%
            </span>
            <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>answer rate</span>
          </div>

          <div className="w-px h-8" style={{ background: 'var(--border)' }} />

          {/* Unanswered — ALARM */}
          <div className="flex items-baseline gap-1">
            <span className="text-[20px] font-black tabular-nums" style={{
              color: unanswered === 0 ? 'var(--green)' : unanswered >= 3 ? 'var(--red)' : 'var(--amber)',
              animation: unanswered >= 3 ? 'pulse 1s infinite' : undefined,
            }}>
              {unanswered}
            </span>
            <span className="text-[10px]" style={{ color: unanswered > 0 ? 'var(--red)' : 'var(--fg-dim)' }}>
              {unanswered === 0 ? 'unanswered' : unanswered === 1 ? 'DYING' : 'CALLS DYING'}
            </span>
          </div>

          {/* D/R/B/I Team Totals */}
          {teamDrb && (
            <>
              <div className="w-px h-8" style={{ background: 'var(--border)' }} />
              <div className="flex items-baseline gap-1">
                <span className="text-[20px] font-black tabular-nums" style={{ color: '#93c5fd' }}>
                  {teamDrb.d}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>Dials</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[20px] font-black tabular-nums" style={{ color: '#fcd34d' }}>
                  {teamDrb.r}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>Reached</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[20px] font-black tabular-nums" style={{ color: '#6ee7b7' }}>
                  {teamDrb.b}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>Booked</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[20px] font-black tabular-nums" style={{ color: '#c4b5fd' }}>
                  {teamDrb.i}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>Instants</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* ALP — left of agent counts */}
          {alpMonths.length > 0 && (
            <>
              <div className="flex items-center gap-5">
                <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(148,163,184,0.4)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.15em' }}>AOI ALP</span>
                {alpMonths.map(m => (
                  <div key={`${m.month}-${m.year}`} className="flex flex-col items-center">
                    <span className="text-[11px] font-semibold" style={{ color: 'rgba(148,163,184,0.55)', marginBottom: 1 }}>{m.month}</span>
                    <span style={{
                      fontSize: 36,
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                      background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>{fmtAlp(m.alp)}</span>
                  </div>
                ))}
              </div>
              <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
            </>
          )}

          {/* Agent counts */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--green)' }}>{stats.totalIdle}</div>
              <div className="text-[8px] uppercase" style={{ color: 'var(--fg-dim)' }}>Available</div>
            </div>
            <div className="text-center">
              <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--red)' }}>{stats.totalBusy}</div>
              <div className="text-[8px] uppercase" style={{ color: 'var(--fg-dim)' }}>On Call</div>
            </div>
            <div className="text-center">
              <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--fg-muted)' }}>{stats.totalOnline}</div>
              <div className="text-[8px] uppercase" style={{ color: 'var(--fg-dim)' }}>Online</div>
            </div>
            {missers > 0 && (
              <div className="text-center">
                <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--red)' }}>{missers}</div>
                <div className="text-[8px] uppercase" style={{ color: 'var(--red)' }}>Missing</div>
              </div>
            )}
          </div>

          {/* Dial rate */}
          <div className="text-center">
            <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--cyan, #06b6d4)' }}>
              {stats.configuredRate.toLocaleString()}
            </div>
            <div className="text-[8px] uppercase" style={{ color: 'var(--fg-dim)' }}>Dials/hr</div>
          </div>

          {/* Status dot */}
          <div className="flex items-center gap-1">
            <div className="dot" style={{ background: connected ? 'var(--green)' : 'var(--red)', width: 6, height: 6 }} />
            <span className="text-[9px]" style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
