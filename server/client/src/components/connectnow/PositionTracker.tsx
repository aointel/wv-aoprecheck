/**
 * PositionTracker — animated queue position display.
 * Shows agent's rank with escalating intensity as they approach #1.
 * Used on both /connect and /aorecruit inbound panels.
 */
import React, { useEffect, useState, useRef } from 'react';

interface PositionTrackerProps {
  position: number;
  market?: string;
  totalInMarket?: number;
}

function getTier(pos: number) {
  if (pos <= 0) return 'offline';
  if (pos === 1) return 'first';
  if (pos === 2) return 'second';
  if (pos <= 5) return 'hot';
  if (pos <= 10) return 'warm';
  return 'cool';
}

const tierStyles: Record<string, {
  bg: string; text: string; glow: string; ring: string; pulse: string; label: string;
}> = {
  first: {
    bg: 'bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-500',
    text: 'text-white',
    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.8),0_0_80px_rgba(251,191,36,0.4)]',
    ring: 'ring-4 ring-amber-300/80',
    pulse: 'animate-pulse',
    label: "YOU'RE UP",
  },
  second: {
    bg: 'bg-gradient-to-br from-red-500 via-orange-500 to-red-600',
    text: 'text-white',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.7),0_0_60px_rgba(239,68,68,0.3)]',
    ring: 'ring-3 ring-red-400/70',
    pulse: 'animate-pulse',
    label: 'NEXT UP',
  },
  hot: {
    bg: 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600',
    text: 'text-white',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.6)]',
    ring: 'ring-2 ring-orange-400/60',
    pulse: '',
    label: 'ALMOST THERE',
  },
  warm: {
    bg: 'bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600',
    text: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(147,51,234,0.5)]',
    ring: 'ring-2 ring-purple-400/50',
    pulse: '',
    label: 'CLIMBING',
  },
  cool: {
    bg: 'bg-gradient-to-br from-slate-500 via-blue-500 to-slate-600',
    text: 'text-white',
    glow: 'shadow-[0_0_8px_rgba(100,116,139,0.3)]',
    ring: 'ring-1 ring-slate-400/30',
    pulse: '',
    label: 'IN QUEUE',
  },
  offline: {
    bg: 'bg-slate-200 dark:bg-slate-800',
    text: 'text-slate-400',
    glow: '',
    ring: '',
    pulse: '',
    label: 'OFFLINE',
  },
};

export function PositionTracker({ position, market, totalInMarket }: PositionTrackerProps) {
  const [displayPos, setDisplayPos] = useState(position);
  const [animating, setAnimating] = useState(false);
  const prevPos = useRef(position);

  useEffect(() => {
    if (position !== prevPos.current) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayPos(position);
        setAnimating(false);
      }, 300);
      prevPos.current = position;
      return () => clearTimeout(timer);
    }
  }, [position]);

  const tier = getTier(displayPos);
  const s = tierStyles[tier];
  const isLive = displayPos > 0;

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      {/* Main position circle */}
      <div className="relative">
        {/* Outer glow ring */}
        {isLive && tier !== 'cool' && (
          <div className={`absolute inset-0 rounded-full ${s.bg} opacity-20 blur-xl scale-150 ${s.pulse}`} />
        )}
        
        {/* Position number */}
        <div className={`
          relative z-10 flex items-center justify-center
          w-24 h-24 rounded-full
          ${s.bg} ${s.text} ${s.glow} ${s.ring}
          transition-all duration-500 ease-out
          ${animating ? 'scale-75 opacity-50' : 'scale-100 opacity-100'}
          ${tier === 'first' ? 'scale-110' : ''}
        `}>
          {isLive ? (
            <div className="flex flex-col items-center">
              <span className={`
                font-black tabular-nums leading-none
                ${displayPos <= 5 ? 'text-4xl' : displayPos <= 10 ? 'text-3xl' : 'text-2xl'}
              `}>
                {displayPos}
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold">—</span>
          )}
        </div>

        {/* Crown for #1 */}
        {tier === 'first' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
            👑
          </div>
        )}

        {/* Fire for #2 */}
        {tier === 'second' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl">
            🔥
          </div>
        )}

        {/* Lightning for #3-5 */}
        {tier === 'hot' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg">
            ⚡
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <div className={`
          text-[10px] font-black tracking-[0.2em] uppercase
          ${tier === 'first' ? 'text-amber-500' : 
            tier === 'second' ? 'text-red-500' :
            tier === 'hot' ? 'text-orange-500' :
            tier === 'warm' ? 'text-purple-500' :
            tier === 'cool' ? 'text-blue-500' : 'text-slate-400'}
        `}>
          {s.label}
        </div>
        
        {isLive && totalInMarket && totalInMarket > 1 && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {displayPos === 1 ? 'Next call is yours' : `${displayPos - 1} ahead of you`}
          </div>
        )}

        {market && (
          <div className={`
            text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full inline-block
            ${market.toLowerCase().includes('veteran') ? 'bg-green-100 text-green-700' :
              market.toLowerCase().includes('globe') ? 'bg-blue-100 text-blue-700' :
              market.toLowerCase().includes('recruit') ? 'bg-purple-100 text-purple-700' :
              'bg-slate-100 text-slate-600'}
          `}>
            {market}
          </div>
        )}
      </div>

      {/* Progress bar — fills as position improves */}
      {isLive && totalInMarket && totalInMarket > 1 && (
        <div className="w-full max-w-[120px] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${s.bg}`}
            style={{ width: `${Math.max(5, ((totalInMarket - displayPos + 1) / totalInMarket) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
