import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useMarketNeed } from '@/hooks/use-market-need';

const NIPR_FEES: Record<string, string> = {
  CA: '$188', NJ: '$150', IL: '$215', FL: '$50',  PA: '$55',
  IN: '$40',  NV: '$195', SC: '$25',  KY: '$40',  MI: '$10',
  TX: '$50',  WI: '$75',  DC: '$100', VA: '$15',  CT: '$140',
};

const STATE_SVGS: Record<string, { vb: string; d: string }> = {
  CA: { vb:'0 0 143 329', d:'M10,0 L95,12 L105,28 L115,45 L130,62 L143,85 L138,110 L130,135 L125,165 L118,195 L110,225 L100,255 L88,280 L75,300 L60,315 L45,329 L30,318 L18,300 L8,278 L0,255 L5,230 L12,205 L8,180 L15,155 L10,130 L18,105 L12,80 L5,55 L0,30 Z' },
  NJ: { vb:'0 0 68 118', d:'M35,0 L55,5 L68,18 L65,35 L60,52 L58,70 L52,88 L44,102 L35,115 L25,118 L15,110 L8,95 L5,78 L10,62 L8,45 L12,28 L20,12 Z' },
  IL: { vb:'0 0 108 232', d:'M50,0 L75,5 L92,18 L100,35 L108,55 L105,78 L100,100 L105,122 L100,145 L95,168 L88,188 L78,205 L65,220 L52,232 L40,225 L28,210 L18,192 L10,172 L5,150 L8,128 L5,105 L8,82 L5,60 L10,40 L18,22 L32,8 Z' },
  FL: { vb:'0 0 175 245', d:'M0,0 L110,0 L125,15 L138,35 L148,58 L155,82 L160,108 L158,135 L152,160 L142,182 L128,200 L112,215 L95,228 L78,238 L62,245 L48,240 L35,228 L25,212 L18,195 L12,175 L8,155 L5,132 L2,108 L0,82 Z' },
  PA: { vb:'0 0 278 128', d:'M0,18 L8,5 L40,0 L80,2 L120,0 L160,2 L200,0 L240,2 L270,5 L278,22 L275,45 L278,68 L272,90 L265,108 L255,122 L240,128 L200,125 L160,128 L120,125 L80,128 L40,125 L10,120 L2,105 L5,85 L0,65 Z' },
  IN: { vb:'0 0 115 215', d:'M25,0 L80,0 L95,12 L108,28 L115,48 L112,72 L115,95 L110,118 L108,142 L102,162 L92,180 L80,198 L65,212 L50,215 L35,208 L22,192 L12,172 L5,150 L2,128 L5,105 L2,82 L5,58 L8,35 L15,15 Z' },
  NV: { vb:'0 0 155 268', d:'M55,0 L100,0 L115,12 L128,28 L138,48 L148,70 L155,95 L150,120 L142,145 L132,168 L118,188 L102,205 L85,218 L70,228 L55,238 L40,245 L25,235 L12,220 L5,200 L0,178 L5,155 L2,130 L8,105 L5,80 L12,58 L22,38 L35,20 Z' },
  SC: { vb:'0 0 218 148', d:'M0,20 L18,8 L40,2 L65,0 L92,5 L120,8 L148,5 L175,10 L200,18 L215,30 L218,48 L210,65 L195,80 L175,95 L152,108 L128,118 L102,125 L75,130 L50,128 L28,120 L10,105 L2,88 L0,68 Z' },
  KY: { vb:'0 0 272 125', d:'M0,28 L20,12 L48,5 L80,2 L115,5 L150,2 L185,5 L215,2 L245,8 L268,20 L272,38 L265,55 L255,70 L238,82 L218,92 L195,100 L170,105 L145,108 L118,105 L92,108 L68,105 L45,98 L25,88 L10,72 L2,55 Z' },
  MI: { vb:'0 0 185 208', d:'M60,0 L85,5 L105,18 L120,35 L130,55 L128,75 L122,92 L132,105 L145,118 L155,132 L158,148 L150,162 L138,172 L122,178 L105,182 L88,185 L72,188 L58,192 L45,200 L32,208 L20,200 L10,185 L5,168 L8,150 L15,132 L22,115 L28,98 L25,80 L30,62 L38,45 L48,28 Z' },
  TX: { vb:'0 0 318 295', d:'M5,0 L175,0 L185,8 L192,22 L200,38 L208,55 L215,72 L222,90 L228,108 L232,128 L235,148 L238,168 L235,188 L228,205 L218,220 L205,232 L190,242 L175,250 L158,258 L140,265 L122,272 L105,278 L88,283 L72,288 L55,292 L38,295 L22,290 L8,278 L0,262 L5,245 L2,228 L5,210 L2,192 L8,175 L5,158 L8,140 L2,122 L5,105 L2,88 L5,70 L2,52 L8,35 L5,18 Z' },
  WI: { vb:'0 0 162 188', d:'M55,0 L80,5 L102,15 L120,28 L135,45 L145,62 L152,80 L155,100 L150,118 L142,135 L130,150 L115,162 L98,172 L80,180 L62,185 L45,188 L30,182 L18,170 L8,155 L2,138 L0,120 L5,102 L2,85 L8,68 L15,52 L25,38 L38,25 Z' },
  DC: { vb:'0 0 60 60', d:'M30,2 L58,30 L30,58 L2,30 Z' },
  VA: { vb:'0 0 285 138', d:'M0,22 L18,8 L42,2 L70,5 L100,2 L132,5 L162,2 L192,5 L220,2 L248,8 L270,18 L282,32 L285,50 L278,68 L265,82 L248,95 L228,105 L205,115 L182,122 L158,128 L132,132 L105,135 L78,138 L52,132 L28,120 L10,105 L2,88 Z' },
  CT: { vb:'0 0 162 88', d:'M0,12 L15,4 L38,0 L65,2 L95,0 L125,2 L148,5 L162,18 L158,35 L162,52 L155,68 L142,80 L125,88 L95,85 L65,88 L38,85 L12,80 L0,65 Z' },
};

function getBorderClass(rank: number) {
  if (rank === 1) return 'border-yellow-400 shadow-[0_0_14px_3px_rgba(234,179,8,0.55)]';
  if (rank === 2) return 'border-slate-400 shadow-[0_0_8px_2px_rgba(148,163,184,0.4)]';
  if (rank === 3) return 'border-amber-600 shadow-[0_0_8px_2px_rgba(180,83,9,0.35)]';
  return 'border-slate-200 dark:border-slate-700';
}

function buildNiprStateUrl(stateName: string) {
  const slug = String(stateName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://nipr.com/licensing-center/state-requirements/${slug}-non-resident-licensing-individual`;
}

export function MarketNeedModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data } = useMarketNeed();
  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className='max-w-4xl w-full p-0 overflow-hidden flex flex-col max-h-[88vh]'>
        <div className='px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
          <DialogHeader>
            <DialogTitle className='text-xl font-bold'>📍 Market Need</DialogTitle>
            <DialogDescription className='text-sm text-slate-500 dark:text-slate-400 mt-1'>
              Where agents are needed most right now — get licensed &amp; claim your territory before someone else does.
            </DialogDescription>
          </DialogHeader>
          <div className='mt-3 flex items-center gap-2 text-xs flex-wrap'>
            <span className='bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400'>Focused states: IL, NJ, SC</span>
            <span className='bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400'>📊 Lead demand ÷ agent supply</span>
          </div>
        </div>
        <div className='overflow-y-auto flex-1 px-5 py-4'>
          <div className='grid grid-cols-3 gap-3'>
            {data.map(entry => {
              const fee = NIPR_FEES[entry.state] ?? '—';
              const svg = STATE_SVGS[entry.state];
              const heatPct = Math.min(Math.round((entry.opportunityScore / 55) * 100), 100);
              return (
                <div key={entry.state} className={`relative rounded-xl border-2 p-3 bg-white dark:bg-slate-900 flex flex-col gap-2 ${getBorderClass(entry.rank)}`}>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <p className='font-bold text-sm leading-tight text-slate-900 dark:text-white'>{entry.stateName}</p>
                      <p className='text-xs font-mono text-slate-400'>{entry.state}</p>
                    </div>
                    {svg && (
                      <svg viewBox={svg.vb} className='w-10 h-8 text-slate-300 dark:text-slate-600 shrink-0' fill='currentColor' aria-hidden>
                        <path d={svg.d} />
                      </svg>
                    )}
                  </div>
                  <div className='w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden'>
                    <div className='h-full rounded-full' style={{ width: `${heatPct}%`, background: 'linear-gradient(to right,#3b82f6,#f97316,#ef4444)' }} />
                  </div>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>License Cost: <span className='font-bold text-slate-800 dark:text-slate-200'>{fee}</span></p>
                  <a href={buildNiprStateUrl(entry.stateName)} target='_blank' rel='noopener noreferrer' className='mt-auto w-full text-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2 py-1.5 transition-colors'>
                    Get Licensed!
                  </a>
                </div>
              );
            })}
          </div>
        </div>
        <div className='px-6 py-3 border-t border-slate-200 dark:border-slate-700 shrink-0'>
          <p className='text-xs text-slate-400 dark:text-slate-500 text-center'>
            Company need is subject to change, consult your manager first. License fees may vary.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
