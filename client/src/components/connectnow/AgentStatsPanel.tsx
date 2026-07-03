import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

interface MyStats {
  agent: { name: string | null; email: string; associateId: string | null; mga: string | null; market: any };
  today: { connects: number; eligible: number; alp: number; avgDurSeconds: number };
  week: { connects: number; eligible: number; alp: number; avgDurSeconds: number };
  recent: Array<{ id: number; time: string; leadName: string | null; market: string | null; alp: number | null; hasSale: boolean }>;
}

function fmtAlp(n: number) {
  if (!n) return null;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtDur(s: number) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m${sec}s` : `${m}m`;
}

function initials(name: string | null) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function flatMarket(m: any): string {
  if (!m) return '';
  if (Array.isArray(m)) return m.filter(Boolean)[0] || '';
  if (typeof m === 'string') {
    try { const p = JSON.parse(m); return Array.isArray(p) ? p[0] : m; } catch { return m; }
  }
  return '';
}

interface Props {
  userEmail: string;
}

export function AgentStatsPanel({ userEmail }: Props) {
  const { data, isLoading } = useQuery<MyStats>({
    queryKey: ['/api/agent/my-stats', userEmail],
    queryFn: async () => {
      const r = await fetch(`/api/agent/my-stats?email=${encodeURIComponent(userEmail)}`);
      if (!r.ok) throw new Error('Failed to fetch stats');
      return r.json();
    },
    refetchInterval: 60000,
    enabled: !!userEmail,
  });

  if (isLoading || !data) {
    return (
      <div className="px-3 py-4 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const { agent, today, week, recent } = data;
  const market = flatMarket(agent.market);
  const ini = initials(agent.name);
  const todayAlpFmt = fmtAlp(today.alp);
  const weekAlpFmt = fmtAlp(week.alp);
  const avgDurFmt = fmtDur(today.avgDurSeconds);

  return (
    <div className="relative z-10 px-3 pt-3 pb-2.5 flex flex-col gap-2.5">
      {/* Agent Header */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgb(99,102,241), rgb(168,85,247))', padding: 2, borderRadius: 16 }}>
            <div className="w-full h-full rounded-2xl" style={{ background: 'rgb(15,23,42)' }} />
          </div>
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg select-none shadow-xl"
            style={{ background: 'linear-gradient(135deg, rgb(99,102,241), rgb(168,85,247))' }}>
            {ini}
          </div>
          <span className="absolute -bottom-1.5 -right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-lg border-2 border-slate-900 bg-amber-500/20 border-amber-400/50 shadow-lg">
            <Crown className="w-3.5 h-3.5 text-amber-300" style={{ filter: 'drop-shadow(rgba(251,191,36,0.8) 0px 0px 3px)' }} />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black text-white text-sm leading-tight tracking-tight">{agent.name || userEmail}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {market && <span className="text-[10px] font-bold text-indigo-300">{market}</span>}
            {market && <span className="text-white/20">·</span>}
            <span className="shrink-0 px-1 py-px rounded text-[8px] font-black tracking-wider border bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-blue-500/40 text-blue-300 leading-tight uppercase">AOI</span>
          </div>
        </div>
      </div>

      {/* Today divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.2)' }} />
        <span className="text-[8px] font-black tracking-[0.2em] uppercase text-indigo-400/60">Today</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.2)' }} />
      </div>

      {/* Today stats grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { val: String(today.connects), label: 'Connects', color: 'text-emerald-300' },
          { val: todayAlpFmt || '—', label: 'ALP', color: 'text-amber-300' },
          { val: String(today.eligible), label: 'Eligible', color: 'text-purple-300' },
          { val: avgDurFmt || '—', label: 'Avg Dur', color: 'text-cyan-300' },
        ].map(({ val, label, color }) => (
          <div key={label} className="flex flex-col items-center justify-center py-2 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className={`text-lg font-black tabular-nums leading-none ${color}`}>{val}</span>
            <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* This week row */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.18em]">This week</span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-white/40 font-semibold tabular-nums">{week.connects} connects</span>
          {weekAlpFmt && <span className="text-amber-300/70 font-bold tabular-nums">{weekAlpFmt}</span>}
        </div>
      </div>

      {/* Recent connects list */}
      {recent.length > 0 && (
        <div className="flex flex-col gap-px">
          {recent.slice(0, 5).map((c, i) => {
            const ago = (() => {
              try { return formatDistanceToNowStrict(new Date(c.time), { addSuffix: false }); } catch { return ''; }
            })();
            const isFirst = i === 0;
            return (
              <div key={c.id} className="flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded-md"
                style={{ background: isFirst ? 'rgba(16,185,129,0.07)' : 'transparent' }}>
                <div className={`w-1 h-1 rounded-full shrink-0 ${isFirst ? 'bg-emerald-400 animate-pulse' : 'bg-white/15'}`} />
                <span className="text-white/25 tabular-nums shrink-0 w-7 text-right">{ago}</span>
                <span className="text-white/50 truncate shrink font-medium">{c.market || 'Connect'}</span>
                {c.alp ? (
                  <>
                    <span className="text-emerald-300/80 shrink-0 font-bold ml-auto">{fmtAlp(c.alp)}</span>
                    <span className="text-amber-300/80 shrink-0 text-[9px] font-black">✓</span>
                  </>
                ) : (
                  <span className="ml-auto" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
