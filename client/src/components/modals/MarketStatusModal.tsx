import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useMarketStatus, MarketStateData } from '@/hooks/use-market-status';

// NIPR hardcoded fees per state (Life / Health)
const NIPR_FEES: Record<string, { life: string; health: string }> = {
  TX: { life: '$50',  health: '$50'  },
  FL: { life: '$50',  health: '$50'  },
  GA: { life: '$115', health: '$115' },
  NC: { life: '$75',  health: '$75'  },
  OH: { life: '$75',  health: '$75'  },
  TN: { life: '$50',  health: '$50'  },
  AZ: { life: '$60',  health: '$60'  },
  MI: { life: '$50',  health: '$50'  },
  IL: { life: '$50',  health: '$50'  },
  VA: { life: '$65',  health: '$65'  },
};

function getRankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 7) return '🔥';
  return '⚡';
}

function getOpportunityLabel(score: number): { label: string; color: string } {
  if (score > 500) return { label: 'WIDE OPEN',  color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40' };
  if (score > 200) return { label: 'GOLD RUSH',  color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40' };
  if (score > 100) return { label: 'UNTAPPED',   color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40' };
  if (score > 50)  return { label: 'HOT',        color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40' };
  return               { label: 'WARM',       color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800' };
}

// Heat bar: blue → orange → red based on normalized score (0-100)
function HeatBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="relative w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(to right, #3b82f6, #f97316, #ef4444)`,
        }}
      />
    </div>
  );
}

function StateCard({ entry, maxScore, isTop }: { entry: MarketStateData; maxScore: number; isTop: boolean }) {
  const fees = NIPR_FEES[entry.state] ?? { life: '~$50', health: '~$50' };
  const opp = getOpportunityLabel(entry.opportunityScore);
  const badge = getRankBadge(entry.rank);
  const ratio = Math.round(entry.leads / Math.max(entry.agents, 1));

  return (
    <div
      className={[
        'rounded-xl border p-4 flex flex-col gap-3 transition-all',
        isTop
          ? 'border-yellow-400 dark:border-yellow-500 shadow-[0_0_12px_2px_rgba(234,179,8,0.35)] animate-pulse'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
        'bg-white dark:bg-slate-900',
      ].join(' ')}
    >
      {/* Top row: rank badge + state + opportunity label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none select-none">{badge}</span>
          <div>
            <p className="font-bold text-base leading-tight text-slate-900 dark:text-slate-100">
              {entry.stateName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{entry.state}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${opp.color}`}>
          {opp.label}
        </span>
      </div>

      {/* Heat bar */}
      <HeatBar score={entry.opportunityScore} maxScore={maxScore} />

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold">
          1 agent per <span className="text-slate-800 dark:text-slate-200">{ratio.toLocaleString()}</span> leads
        </span>
        <span className="tabular-nums">
          {entry.agents} agent{entry.agents !== 1 ? 's' : ''} · {entry.leads.toLocaleString()} leads
        </span>
      </div>

      {/* License fees + CTA */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
          <p>Life license: <span className="font-semibold text-slate-700 dark:text-slate-300">{fees.life}</span></p>
          <p>Health license: <span className="font-semibold text-slate-700 dark:text-slate-300">{fees.health}</span></p>
        </div>
        <a
          href="https://nipr.com/licensing/apply"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 transition-colors whitespace-nowrap shadow"
        >
          Claim This Territory →
        </a>
      </div>
    </div>
  );
}

interface MarketStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarketStatusModal({ isOpen, onClose }: MarketStatusModalProps) {
  const { data, isLoading } = useMarketStatus();
  const maxScore = data.length > 0 ? Math.max(...data.map(d => d.opportunityScore)) : 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl w-full p-0 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Sticky header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <span className="text-2xl">📍</span>
              Market Status
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Where agents are needed most right now — get licensed &amp; claim your territory before someone else does.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
              🏆 Top 10 opportunity states
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
              📊 Lead demand ÷ agent supply
            </span>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading market data…</div>
          ) : (
            data.map((entry) => (
              <StateCard
                key={entry.state}
                entry={entry}
                maxScore={maxScore}
                isTop={entry.rank === 1}
              />
            ))
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Opportunity score = leads ÷ active agents. License fees are NIPR estimates and may vary.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
