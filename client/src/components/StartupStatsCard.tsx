import { useState, useEffect, useRef } from 'react';
import { Crown, TrendingUp, Zap, X } from 'lucide-react';
import { useLocation } from 'wouter';

interface MyStats {
  agent: { name: string | null; email: string; market: any };
  today: { connects: number; alp: number };
  week: { connects: number; alp: number; eligible: number; avgDurSeconds: number };
}

function flatMarket(m: any): string {
  if (!m) return '';
  if (Array.isArray(m)) return m.filter(Boolean)[0] || '';
  if (typeof m === 'string') {
    try { const p = JSON.parse(m); return Array.isArray(p) ? p[0] : m; } catch { return m; }
  }
  return '';
}

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now() + delay;
    const animate = (now: number) => {
      const elapsed = Math.max(0, now - start);
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay]);
  return val;
}

function StatBlock({ label, value, prefix = '', suffix = '', color, delay }: {
  label: string; value: number; prefix?: string; suffix?: string; color: string; delay: number;
}) {
  const count = useCountUp(value, 1000, delay);
  const fmt = prefix === '$'
    ? count >= 1000 ? `$${(count / 1000).toFixed(1)}k` : `$${count}`
    : `${prefix}${count}${suffix}`;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-5xl font-black tabular-nums leading-none tracking-tight ${color}`}
        style={{ textShadow: '0 0 40px currentColor' }}>
        {fmt}
      </span>
      <span className="text-xs font-black uppercase tracking-[0.25em] text-white/40">{label}</span>
    </div>
  );
}

interface Props {
  userEmail: string;
}

export function StartupStatsCard({ userEmail }: Props) {
  const [location] = useLocation();
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Keep Connect usable: this full-screen card can steal all clicks during dialer/form workflows.
    if (location.startsWith('/connect') || location.startsWith('/dashboard/connect')) {
      return;
    }

    const key = `stats_card_shown_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;

    fetch(`/api/agent/my-stats?email=${encodeURIComponent(userEmail)}`)
      .then(r => r.json())
      .then((data: MyStats) => {
        // Only show if they have actual activity
        if (!data.agent?.name) return;
        setStats(data);
        sessionStorage.setItem(key, '1');
        // Small delay so the rest of the app loads first
        setTimeout(() => {
          setShow(true);
          requestAnimationFrame(() => setVisible(true));
        }, 800);
        timerRef.current = setTimeout(() => dismiss(), 7000);
      })
      .catch(() => {});

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [userEmail, location]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => { setShow(false); setDismissed(true); }, 500);
  };

  if (!show || dismissed || !stats) return null;

  const name = stats.agent.name || userEmail;
  const parts = name.trim().split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  const market = flatMarket(stats.agent.market);
  const weekNum = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer"
      style={{
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(12px)',
        transition: 'opacity 0.5s ease',
        opacity: visible ? 1 : 0,
      }}
      onClick={dismiss}
    >
      {/* Dismiss hint */}
      <button
        className="absolute top-6 right-6 text-white/30 hover:text-white/60 transition-colors"
        onClick={e => { e.stopPropagation(); dismiss(); }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Card */}
      <div
        className="relative w-full max-w-lg mx-4 overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, rgb(10,14,30) 0%, rgb(20,20,50) 50%, rgb(10,14,30) 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 0 80px rgba(99,102,241,0.2), 0 0 160px rgba(99,102,241,0.08)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
          transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top glare */}
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)' }} />

        {/* Background grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Glow orb */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgb(99,102,241), transparent 70%)', filter: 'blur(40px)' }} />

        <div className="relative px-8 pt-8 pb-6 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.8))' }} />
              <span className="text-[10px] font-black tracking-[0.3em] uppercase text-amber-400/80">Week {weekNum} Report</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider border"
                style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)', color: 'rgba(147,197,253,0.9)' }}>
                AOI
              </span>
              {market && (
                <span className="text-[10px] font-bold text-indigo-400">{market}</span>
              )}
            </div>
          </div>

          {/* Agent Name */}
          <div className="text-center -mt-2">
            <div className="text-white/40 text-xs font-black tracking-[0.4em] uppercase mb-1">Now Entering</div>
            <div className="text-white text-4xl font-black tracking-tight leading-none uppercase"
              style={{ textShadow: '0 0 60px rgba(99,102,241,0.6)' }}>
              {firstName}
            </div>
            {lastName && (
              <div className="text-indigo-300 text-5xl font-black tracking-tight leading-none uppercase"
                style={{ textShadow: '0 0 60px rgba(99,102,241,0.8)' }}>
                {lastName}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6))' }} />
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(270deg, transparent, rgba(99,102,241,0.6))' }} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <StatBlock label="Connects" value={stats.week.connects} color="text-emerald-300" delay={200} />
            <StatBlock label="Platform ALP" value={stats.week.alp} prefix="$" color="text-amber-300" delay={400} />
            <StatBlock label="Eligible" value={stats.week.eligible} color="text-purple-300" delay={600} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">AO Intelligence</span>
            </div>
            <span className="text-[10px] text-white/20 font-medium">tap to dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}
