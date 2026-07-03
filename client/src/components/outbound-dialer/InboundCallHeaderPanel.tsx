import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Info, X, CheckCircle, ChevronDown, Clock, Zap, DollarSign, Ban, Wifi, WifiOff, Coffee } from 'lucide-react';
import type { Lead, CallDisposition } from './types';
import { InboundSuccessViewer } from '@/components/inbound/InboundSuccessViewer';
import { PositionTracker } from '@/components/connectnow/PositionTracker';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCreditPurchaseModalOptional } from '@/contexts/CreditPurchaseModalContext';
import { useTaalkVdpMountRef } from '@/contexts/TaalkVdpMountContext';

/** Fuse bar animation: 5s loop (ringing scanner sweep), cosmetic only – never dismisses panel. */
const FUSE_ANIMATION_SECONDS = 5;
const FUSE_ANIMATION_MS = FUSE_ANIMATION_SECONDS * 1000;

export type InboundPanelState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'wrapping';

export interface InboundCallHeaderPanelProps {
  state: InboundPanelState;
  /** When state is 'wrapping', seconds left in wrap (e.g. 30 → 0). */
  wrapSecondsLeft?: number;
  incomingConn?: any;
  lead: Lead | null;
  queuePosition: number;
  /** Market label for queue position placeholder (e.g. "aorecruit"). When set, position is shown in panel when idle. */
  queueMarket?: string;
  /** Total agents in same market for position context. */
  totalInMarket?: number;
  onAnswer: () => void;
  onReject?: () => void;
  onHangup?: () => void;
  answering?: boolean;
  /** Daily stats for D/R/B display inside the pane */
  dailyStats?: { total_dialed?: number; todayDialed?: number; reached?: number; booked?: number } | null;
  /** Call charge in dollars to show on Answer (default 8) */
  charge?: number;
  /** Connection type — drives badge, colors, and charge. Default 'diamond'. */
  connectionType?: 'gold' | 'diamond' | 'recruit';
  /** 'horizontal' = header bar (default); 'vertical' = right sidebar stacked layout, same look/function */
  variant?: 'horizontal' | 'vertical';
  /** When idle: show "Offline" if false, "Waiting…" if true */
  vdpOnline?: boolean;
  /** When set, fuse animation runs from reservation time (5s loop, cosmetic only) */
  reservationCreatedAt?: number;
  /** When true, timer will not call onReject on expiry (user already clicked Answer) */
  answerRequestedRef?: React.MutableRefObject<boolean>;
  /** Optional ref so parent can trigger Success Viewer refetch (e.g. after Demo button). */
  successViewerRefetchRef?: React.MutableRefObject<(() => void) | null>;
  // --- Backup Billing / Never Miss a Call ---
  /** Wallet balance in dollars (for display). If undefined, billing block is hidden. */
  walletBalanceDollars?: number;
  /** Backup billing enabled (use card when wallet runs out). */
  backupBillingEnabled?: boolean;
  /** Loading state for backup billing toggle. */
  backupBillingLoading?: boolean;
  /** Callback when user toggles backup billing. */
  onBackupBillingToggle?: (enabled: boolean) => void;
  /** Saved card display e.g. "Visa •••• 4242". If null and backup enabled, show "Card on file". */
  cardDisplay?: string | null;
  /** Show "Never Miss a Transfer" card when idle. Default true when backup billing props provided. */
  showBackupBillingCard?: boolean;
  /** Billing status for badge: ready | backup_enabled | wallet_only. */
  billingStatus?: 'ready' | 'backup_enabled' | 'wallet_only';
  /** When call is ended or wrapping: callback to clear panel and go back to idle (same as 30s timeout). */
  onCompleteCall?: () => void;
  /** If true and user clicks Complete call without disposition, show a quick nudge (still allow complete). */
  hasDisposition?: boolean;
  selectedDisposition?: CallDisposition | string | null;
  dispositionApplied?: boolean;
  onDispositionSelect?: (disposition: CallDisposition) => void;
  onApplyDisposition?: () => void;
  onFindOutMore?: () => void;
  /** When true, inbound ringer is silenced (persisted). */
  ringerMuted?: boolean;
  /** Toggle ringer mute; when called with true, future and current incoming sound is disabled. */
  onRingerMuteToggle?: (muted: boolean) => void;
  /** When true and ringing: WebRTC Device is off; clicking Accept will turn it on first then connect. */
  webRTCOffForAccept?: boolean;
  /** Current agent availability status for the 3-state pill (online / away / offline). Falls back to vdpOnline when omitted. */
  agentStatus?: AgentStatus;
  /** Callback when the user selects a new status from the pill. */
  onAgentStatusChange?: (status: AgentStatus) => void;
  /** Producer / associate info shown as a compact strip at the bottom */
  producerAssociateId?: string | number | null;
  producerMarket?: string | string[] | null;
  producerStates?: string[] | null;
}

/** Mask phone for inbound preview: show country + area code only (e.g. +1 609 ***-**45). */
function maskPhoneForInbound(phone: string): string {
  const s = (phone || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 10) {
    const lastTwo = digits.slice(-2);
    const areaCode = digits.length >= 10 ? digits.slice(-10, -7) : digits.slice(0, 3);
    const country = digits.length > 10 ? digits.slice(0, -10) : '';
    const prefix = country ? `+${country} ` : '+1 ';
    return `${prefix}${areaCode} ***-**${lastTwo}`;
  }
  if (digits.length >= 3) return `***-**${digits.slice(-2)}`;
  return '***-**XX';
}

// --- Subcomponents ---

/** Ringing scanner bar: continuous left-to-right sweep to signal active listening (not a countdown). */
function FuseBar({ remainingMs: _remainingMs, totalMs: _totalMs }: { remainingMs: number; totalMs: number }) {
  return (
    <div
      className="w-full h-4 rounded-t-[12px] overflow-hidden bg-slate-800/90 rounded-b-none relative"
      aria-hidden
    >
      {/* Base glow track */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: 'linear-gradient(to right, #f97316, #ef4444)' }}
      />
      {/* Sweeping highlight — loops continuously left to right */}
      <div
        className="absolute inset-y-0"
        style={{
          width: '45%',
          background: 'linear-gradient(to right, transparent, rgba(251,191,36,0.6) 30%, rgba(249,115,22,0.9) 55%, rgba(239,68,68,0.7) 75%, transparent)',
          boxShadow: '0 0 18px rgba(249,115,22,0.5)',
          animation: 'scanner-sweep 1.6s ease-in-out infinite',
        }}
      />
      {/* Shine sparkle on leading edge */}
      <div
        className="absolute inset-y-0"
        style={{
          width: '8%',
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.35), transparent)',
          animation: 'scanner-sweep 1.6s ease-in-out infinite',
          animationDelay: '0.05s',
        }}
      />
      <style>{`
        @keyframes scanner-sweep {
          0%   { left: -45%; }
          100% { left: 105%; }
        }
      `}</style>
    </div>
  );
}

/** Calm breathe bar: used when agent is Idle/Offline but a call is ringing. Soft, slow, low-pressure. */
function ChimeBar() {
  return (
    <div
      className="w-full h-4 rounded-t-[12px] overflow-hidden rounded-b-none relative"
      style={{ background: 'rgba(15,15,30,0.95)' }}
      aria-hidden
    >
      {/* Base indigo/violet mist */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: 'linear-gradient(to right, #4f46e5, #7c3aed, #06b6d4)' }}
      />
      {/* Floating orb that breathes slowly */}
      <div
        className="absolute inset-y-0"
        style={{
          left: '15%',
          width: '70%',
          background: 'radial-gradient(ellipse 80% 100% at 50% 50%, rgba(139,92,246,0.55) 0%, rgba(99,102,241,0.3) 45%, transparent 75%)',
          animation: 'chime-breathe 3.2s ease-in-out infinite',
        }}
      />
      {/* Secondary shimmer drift */}
      <div
        className="absolute inset-y-0"
        style={{
          width: '30%',
          background: 'linear-gradient(to right, transparent, rgba(192,132,252,0.25), transparent)',
          animation: 'chime-drift 5.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes chime-breathe {
          0%, 100% { opacity: 0.35; transform: scaleX(0.85); }
          50%       { opacity: 0.9;  transform: scaleX(1.08); }
        }
        @keyframes chime-drift {
          0%   { left: -30%; }
          100% { left: 110%; }
        }
      `}</style>
    </div>
  );
}

/** Connection type badge — Gold ($2), Diamond ($8), or Recruit ($2) */
function ConnectionTypeBadge({ type, charge }: { type: 'gold' | 'diamond' | 'recruit'; charge: number }) {
  const configs = {
    gold: {
      emoji: '🥇',
      label: 'Gold Connection',
      background: 'linear-gradient(135deg, rgba(202,138,4,0.25) 0%, rgba(234,179,8,0.15) 100%)',
      borderColor: 'rgba(234,179,8,0.6)',
      color: '#fde68a',
      textShadow: '0 0 8px rgba(234,179,8,0.5)',
    },
    diamond: {
      emoji: '💎',
      label: 'Diamond Connection',
      background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(139,92,246,0.15) 100%)',
      borderColor: 'rgba(139,92,246,0.5)',
      color: '#c4b5fd',
      textShadow: '0 0 8px rgba(139,92,246,0.4)',
    },
    recruit: {
      emoji: '🎯',
      label: 'Recruit Connection',
      background: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(52,211,153,0.15) 100%)',
      borderColor: 'rgba(52,211,153,0.6)',
      color: '#6ee7b7',
      textShadow: '0 0 8px rgba(52,211,153,0.5)',
    },
  };
  const c = configs[type] || configs.diamond;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-sm font-bold uppercase tracking-wider border"
      style={{
        background: c.background,
        borderColor: c.borderColor,
        color: c.color,
        textShadow: c.textShadow,
      }}
    >
      <span style={{ fontSize: '0.9em' }}>{c.emoji}</span>
      {c.label} · ${charge.toFixed(2)}
    </span>
  );
}

function MarketBadge({ market, disabled }: { market: string; disabled?: boolean }) {
  const label = (market || 'Inbound').toUpperCase();
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-bold uppercase tracking-wider
        ${disabled ? 'bg-white/10 text-white/50' : 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/50'}
      `}
    >
      {label}
    </span>
  );
}

// --- Agent Status Pill ---

type AgentStatus = 'online' | 'away' | 'offline';

const STATUS_OPTIONS: Array<{
  id: AgentStatus;
  label: string;
  activeBg: string;
  activeShadow: string;
  activeGlow: string;
  dot: 'pulse' | 'solid' | 'dim';
  dotColor: string;
}> = [
  {
    id: 'online',
    label: 'Online',
    activeBg: 'linear-gradient(160deg, #059669 0%, #047857 100%)',
    activeShadow: 'inset 0 1px 3px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.25)',
    activeGlow: '0 0 10px rgba(16,185,129,0.45)',
    dot: 'pulse',
    dotColor: '#34d399',
  },
  {
    id: 'away',
    label: 'Idle',
    activeBg: 'linear-gradient(160deg, #d97706 0%, #b45309 100%)',
    activeShadow: 'inset 0 1px 3px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.25)',
    activeGlow: '0 0 10px rgba(245,158,11,0.4)',
    dot: 'solid',
    dotColor: '#fbbf24',
  },
  {
    id: 'offline',
    label: 'Offline',
    activeBg: 'linear-gradient(160deg, #374151 0%, #1f2937 100%)',
    activeShadow: 'inset 0 1px 3px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.3)',
    activeGlow: 'none',
    dot: 'dim',
    dotColor: '#6b7280',
  },
];

function AgentStatusPill({
  status,
  onChange,
  disabled = false,
}: {
  status: AgentStatus;
  onChange?: (s: AgentStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="w-full flex gap-1 p-1 rounded-xl"
      style={{
        background: 'rgba(0,0,0,0.55)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}
      role="group"
      aria-label="Agent availability"
    >
      {STATUS_OPTIONS.map((opt) => {
        const isActive = status === opt.id;
        return (
          <motion.button
            key={opt.id}
            type="button"
            onClick={() => !disabled && onChange?.(opt.id)}
            disabled={disabled && !isActive}
            aria-pressed={isActive}
            className="relative flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-semibold select-none overflow-hidden transition-colors duration-100"
            style={{
              color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
              background: isActive ? opt.activeBg : 'transparent',
              cursor: disabled && !isActive ? 'not-allowed' : 'pointer',
            }}
            animate={{
              boxShadow: isActive
                ? `${opt.activeShadow}, ${opt.activeGlow}`
                : '0 2px 0px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
              y: isActive ? 1 : 0,
            }}
            whileHover={!isActive && !disabled ? { color: 'rgba(255,255,255,0.7)' } : {}}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Status dot */}
            {opt.dot === 'pulse' && isActive ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                  style={{ backgroundColor: opt.dotColor }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: opt.dotColor }}
                />
              </span>
            ) : (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: isActive ? opt.dotColor : 'rgba(255,255,255,0.15)' }}
              />
            )}
            <span className="tracking-wide">{opt.label}</span>
            {/* Active top-edge shine */}
            {isActive && (
              <span
                className="absolute inset-x-0 top-0 h-px pointer-events-none rounded-t-lg"
                style={{ background: 'linear-gradient(to right, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)' }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Session Rewards Panel ─────────────────────────────────────────────────────
// Shows today's Dials / Reached / Booked with XP-style rewards and streak.
// Lives in the bottom-right inbound panel so agents see their progress at a glance.

interface SessionStats {
  total_dialed?: number;
  todayDialed?: number;
  reached?: number;
  booked?: number;
}

function SessionRewardsPanel({ dailyStats }: { dailyStats: SessionStats }) {
  const [retained, setRetained] = useState<{ dials: number; reached: number; booked: number }>({
    dials: 0,
    reached: 0,
    booked: 0,
  });

  useEffect(() => {
    const incoming = {
      dials: Math.max(0, Number(dailyStats?.total_dialed ?? dailyStats?.todayDialed ?? 0) || 0),
      reached: Math.max(0, Number(dailyStats?.reached ?? 0) || 0),
      booked: Math.max(0, Number(dailyStats?.booked ?? 0) || 0),
    };

    setRetained((prev) => {
      const incomingAllZero = incoming.dials === 0 && incoming.reached === 0 && incoming.booked === 0;
      const hadProgress = prev.dials > 0 || prev.reached > 0 || prev.booked > 0;
      if (incomingAllZero && hadProgress) {
        return prev;
      }

      return {
        dials: Math.max(prev.dials, incoming.dials),
        reached: Math.max(prev.reached, incoming.reached),
        booked: Math.max(prev.booked, incoming.booked),
      };
    });
  }, [dailyStats?.total_dialed, dailyStats?.todayDialed, dailyStats?.reached, dailyStats?.booked]);

  const dials = retained.dials;
  const reached = retained.reached;
  const booked = retained.booked;

  const xp = dials * 1 + reached * 5 + booked * 25;

  const tier =
    booked >= 3 ? { label: '🏆 Closer',   color: '#fbbf24', glow: 'rgba(251,191,36,0.3)' } :
    booked >= 1 ? { label: '🎯 On Target', color: '#34d399', glow: 'rgba(52,211,153,0.25)' } :
    reached >= 5 ? { label: '🔥 Dialing',  color: '#f97316', glow: 'rgba(249,115,22,0.25)' } :
    dials >= 10  ? { label: '⚡ Grinding',  color: '#818cf8', glow: 'rgba(129,140,248,0.2)' } :
                   { label: '🌱 Starting',  color: 'rgba(255,255,255,0.5)', glow: 'transparent' };

  const stats = [
    { icon: '📞', label: 'Dials',   value: dials,   pts: dials * 1,    color: '#60a5fa', goal: 50 },
    { icon: '🗣️', label: 'Reached', value: reached, pts: reached * 5,  color: '#fbbf24', goal: 20 },
    { icon: '✅', label: 'Booked',  value: booked,  pts: booked * 25,  color: '#34d399', goal: 5  },
  ];

  return (
    <div style={{
      padding: '12px 14px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(0,0,0,0.45)',
      flexShrink: 0,
    }}>
      {/* Header: tier + XP */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
          background: tier.glow, border: `1px solid ${tier.color}55`,
          color: tier.color, boxShadow: `0 0 10px ${tier.glow}`,
        }}>
          {tier.label}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa', lineHeight: 1 }}>
            {xp.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.06em' }}>XP TODAY</div>
        </div>
      </div>

      {/* 3 tall stat cards in a single row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {stats.map(s => {
          const barW = Math.min(100, (s.value / s.goal) * 100);
          return (
            <div key={s.label} style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${s.value > 0 ? s.color + '44' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10,
              padding: '14px 8px 12px',
              boxShadow: s.value > 0 ? `0 0 14px ${s.color}22` : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              {/* Label row */}
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {s.label}
              </span>
              {/* Big number */}
              <span style={{
                fontSize: 42, fontWeight: 900, lineHeight: 1.1,
                color: s.value > 0 ? s.color : 'rgba(255,255,255,0.15)',
                fontVariantNumeric: 'tabular-nums',
              } as any}>
                {s.value}
              </span>
              {/* XP earned */}
              <span style={{ fontSize: 10, fontWeight: 600, color: s.value > 0 ? '#a78bfa' : 'rgba(255,255,255,0.15)' }}>
                {s.pts > 0 ? `+${s.pts} xp` : '0 xp'}
              </span>
              {/* Progress bar */}
              <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 6 }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${barW}%`,
                  background: s.value > 0 ? s.color : 'transparent',
                  boxShadow: s.value > 0 ? `0 0 8px ${s.color}` : 'none',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>/ {s.goal}</span>
            </div>
          );
        })}
      </div>

      {booked > 0 && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#34d399' }}>
          🎉 {booked} appointment{booked !== 1 ? 's' : ''} set today!
        </div>
      )}
    </div>
  );
}

// --- Main panel ---

export function InboundCallHeaderPanel({
  state,
  wrapSecondsLeft,
  lead,
  queuePosition,
  onAnswer,
  onReject,
  onHangup,
  answering = false,
  dailyStats,
  charge = 8,
  connectionType = 'diamond',
  variant = 'horizontal',
  vdpOnline = true,
  reservationCreatedAt,
  answerRequestedRef,
  successViewerRefetchRef,
  walletBalanceDollars,
  backupBillingEnabled = false,
  backupBillingLoading = false,
  onBackupBillingToggle,
  cardDisplay = null,
  showBackupBillingCard = true,
  billingStatus,
  onCompleteCall,
  hasDisposition = true,
  selectedDisposition,
  dispositionApplied = false,
  onDispositionSelect,
  onApplyDisposition,
  onFindOutMore,
  ringerMuted = false,
  onRingerMuteToggle,
  webRTCOffForAccept = false,
  agentStatus,
  onAgentStatusChange,
  producerAssociateId,
  producerMarket,
  producerStates,
  queueMarket,
  totalInMarket,
}: InboundCallHeaderPanelProps) {
  /** Wired by VDPStatus on /connect so Taalk mounts here — one real #mount-vdp-selector (not a hidden duplicate). */
  const taalkVdpMountRef = useTaalkVdpMountRef();
  const [answerSecondsLeft, setAnswerSecondsLeft] = useState(0);
  const [remainingMs, setRemainingMs] = useState(FUSE_ANIMATION_MS);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [highlightDispositionPrompt, setHighlightDispositionPrompt] = useState(false);
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const deadlineRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<number | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const isRinging = state === 'ringing';
  const isConnecting = state === 'connecting';
  const isIdle = state === 'idle';
  const isConnected = state === 'connected';
  const isEnded = state === 'ended';
  const isWrapping = state === 'wrapping';
  const answerButtonActive = isRinging;
  const hangupButtonActive = isRinging || isConnecting || isConnected;
  const isVertical = variant === 'vertical';

  // Derive status for the pill: prefer explicit agentStatus prop, else derive from vdpOnline
  const derivedAgentStatus: AgentStatus = agentStatus ?? (vdpOnline ? 'online' : 'offline');
  // Pill is disabled (can't change status) while a call is in progress
  const pillDisabled = isRinging || isConnecting || isConnected || isEnded || isWrapping;

  const showBillingBlock =
    walletBalanceDollars !== undefined || onBackupBillingToggle != null;
  const walletLow =
    typeof walletBalanceDollars === 'number' && walletBalanceDollars < (charge || 8);
  const useBackupForThisCall = isRinging && walletLow && backupBillingEnabled;
  const effectiveBillingStatus: 'ready' | 'backup_enabled' | 'wallet_only' =
    billingStatus ??
    (backupBillingEnabled ? 'backup_enabled' : 'wallet_only');

  const [walletLowReminderDismissed, setWalletLowReminderDismissed] = useState(false);
  const showWalletLowReminder =
    isIdle && walletLow && !backupBillingEnabled && onBackupBillingToggle && !walletLowReminderDismissed;
  const creditPurchaseModal = useCreditPurchaseModalOptional();

  useEffect(() => {
    if (!showWalletLowReminder) return;
    const t = setTimeout(() => setWalletLowReminderDismissed(true), 5500);
    return () => clearTimeout(t);
  }, [showWalletLowReminder]);

  useEffect(() => {
    if (!walletLow) setWalletLowReminderDismissed(false);
  }, [walletLow]);

  const market = connectionType === 'recruit' ? 'AO Recruit' : (lead?.taalk_market || (lead as any)?.market || 'Inbound');
  const firstName = String((lead as any)?.first_name ?? '').trim();
  const lastName = String((lead as any)?.last_name ?? '').trim();
  const clientName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    lead?.name?.trim() ||
    'Unknown Caller';

  // Fuse bar: 5s cosmetic pulse from reservation creation. We use a mirrored cycle
  // instead of snapping from 0 -> 100 so the bar stays visually smooth while ringing.
  useEffect(() => {
    if (!isRinging || isConnecting) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      // Leave remainingMs / answerSecondsLeft as-is so the bar freezes where it was when they answered
      return;
    }
    deadlineRef.current =
      typeof reservationCreatedAt === 'number' && reservationCreatedAt > 0
        ? reservationCreatedAt
        : Date.now();
    const tick = () => {
      const connected = stateRef.current === 'connected';
      const answerClicked = answerRequestedRef?.current === true;
      if (connected || answerClicked) {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        return;
      }
      const elapsed = Math.max(0, Date.now() - deadlineRef.current);
      const mirroredCycleMs = FUSE_ANIMATION_MS * 2;
      const cyclePos = elapsed % mirroredCycleMs;
      const left =
        cyclePos <= FUSE_ANIMATION_MS
          ? FUSE_ANIMATION_MS - cyclePos
          : cyclePos - FUSE_ANIMATION_MS;
      setRemainingMs(left);
      setAnswerSecondsLeft(Math.ceil(left / 1000));
    };
    tick();
    tickRef.current = setInterval(tick, 200);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isRinging, onReject, reservationCreatedAt, answerRequestedRef]);

  const critical = isRinging && answerSecondsLeft <= 3 && answerSecondsLeft > 0;

  // Call timer: starts when connected, clears on ended/wrapping/idle
  useEffect(() => {
    if (isConnected) {
      if (!callStartRef.current) callStartRef.current = Date.now();
      callTimerRef.current = setInterval(() => {
        setCallElapsedSeconds(Math.floor((Date.now() - (callStartRef.current ?? Date.now())) / 1000));
      }, 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      if (isIdle || isEnded || isWrapping) { callStartRef.current = null; setCallElapsedSeconds(0); }
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [isConnected, isIdle, isEnded, isWrapping]);

  // Ring audio: ONLY when online. No sound when idle/offline — agents shouldn't be bothered unless they opted in.
  useEffect(() => {
    if (!isRinging) return;
    if (derivedAgentStatus !== 'online') return; // ← Only ring when online
    let stopped = false;
    let audio: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (true) {
      // Online: play Twilio soft-rock hold music — the same music callers hear while waiting
      audio = new Audio('http://twimlets.com/holdmusic?Bucket=com.twilio.music.soft-rock');
      audio.loop = true;
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } if (false) {
      // Disabled: no sound when idle/offline
      const getCtx = (): AudioContext => {
        if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        return audioCtx;
      };
      const chime = () => {
        if (stopped) return;
        const ctx = getCtx();
        const pad = (freq: number, gain: number, duration: number, delayMs: number) => {
          setTimeout(() => {
            if (stopped) return;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, ctx.currentTime);
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.4);
            g.gain.setValueAtTime(gain, ctx.currentTime + duration - 0.8);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            o.start(ctx.currentTime); o.stop(ctx.currentTime + duration + 0.05);
          }, delayMs);
        };
        pad(110, 0.18, 3.5, 0);
        pad(220, 0.12, 3.2, 30);
        pad(330, 0.08, 2.8, 60);
        pad(440, 0.05, 2.4, 90);
        pad(165, 0.06, 3.0, 200);
      };
      chime();
      intervalId = setInterval(chime, 6000);
    }

    return () => {
      stopped = true;
      if (audio) { audio.pause(); audio.src = ''; audio = null; }
      if (intervalId) clearInterval(intervalId);
      audioCtx?.close().catch(() => {});
    };
  }, [isRinging, derivedAgentStatus]);

  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Incoming call glows — hot (online) vs calm (idle/offline)
  const isOnlineRinging = (isRinging || isConnecting) && derivedAgentStatus === 'online';
  const isCalmRinging   = (isRinging || isConnecting) && derivedAgentStatus !== 'online';

  const glowRingingQuiet    = '0 0 24px rgba(249, 115, 22, 0.45), 0 0 48px rgba(239, 68, 68, 0.28), 0 0 72px rgba(220, 38, 38, 0.15), inset 0 0 0 1px rgba(255,255,255,0.1)';
  const glowRingingPeak     = '0 0 32px rgba(249, 115, 22, 0.6), 0 0 64px rgba(239, 68, 68, 0.4), 0 0 96px rgba(220, 38, 38, 0.2), inset 0 0 0 1px rgba(255,255,255,0.12)';
  const glowRingingCritical = '0 0 40px rgba(249, 115, 22, 0.7), 0 0 80px rgba(239, 68, 68, 0.5), 0 0 120px rgba(220, 38, 38, 0.25), inset 0 0 0 1px rgba(255,255,255,0.15)';

  const glowChimeQuiet = '0 0 20px rgba(99,102,241,0.35), 0 0 40px rgba(139,92,246,0.2), 0 0 60px rgba(6,182,212,0.1), inset 0 0 0 1px rgba(255,255,255,0.07)';
  const glowChimePeak  = '0 0 28px rgba(99,102,241,0.5),  0 0 56px rgba(139,92,246,0.3), 0 0 80px rgba(6,182,212,0.15), inset 0 0 0 1px rgba(255,255,255,0.09)';

  // Call live: AO (emerald/cyan) gradient highlight and glow
  const glowConnectedQuiet = '0 0 28px rgba(52, 211, 153, 0.4), 0 0 56px rgba(34, 197, 94, 0.25), 0 0 84px rgba(6, 182, 212, 0.15), inset 0 0 0 1px rgba(255,255,255,0.08)';
  const glowConnectedPeak = '0 0 40px rgba(52, 211, 153, 0.55), 0 0 80px rgba(34, 197, 94, 0.35), 0 0 120px rgba(6, 182, 212, 0.2), inset 0 0 0 1px rgba(255,255,255,0.1)';

  const statusText =
    isWrapping
      ? (typeof wrapSecondsLeft === 'number' ? `Wrapping — ${wrapSecondsLeft}` : 'Wrapping')
      : isEnded
        ? 'Call ended'
        : isIdle
          ? vdpOnline
          ? 'Online: Waiting on call'
          : 'Offline – Select Online to start'
        : isConnecting
          ? 'Connecting…'
          : 'Incoming call';

  const statusBlock = (
    <motion.div
      initial={false}
      animate={{ opacity: isConnected ? 0.85 : isEnded || isWrapping ? 0.9 : 1 }}
      transition={{ duration: 0.35 }}
      className={`flex flex-col justify-center px-3 rounded-xl border border-white/10 shrink-0 ${isVertical ? 'w-full min-h-[48px]' : 'min-w-[160px] max-w-[280px]'}`}
    >
      {isConnected ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-emerald-600 truncate text-base leading-tight">Connected</span>
          <span className="text-emerald-700/80 tabular-nums text-sm font-mono leading-tight">{formatCallTime(callElapsedSeconds)}</span>
        </div>
      ) : isIdle ? (
        <div className="flex items-center gap-2 flex-wrap">
          {vdpOnline && (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
          <span className="font-semibold text-gray-900 truncate text-base leading-tight min-w-0">{statusText}</span>
        </div>
      ) : isRinging || isConnecting ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 truncate text-base leading-tight min-w-0">{statusText}</span>
        </div>
      ) : (
        <span className="font-semibold text-gray-900 truncate text-base leading-tight">{statusText}</span>
      )}
    </motion.div>
  );

  const buttonsBlock = (
    <motion.div
      initial={false}
      animate={{ opacity: isEnded || isWrapping ? 0 : 1 }}
      transition={{ duration: 0.35 }}
      className={`flex items-center gap-2 shrink-0 ${isVertical ? 'w-full' : 'min-w-[200px]'} ${isIdle || isEnded || isWrapping ? 'invisible' : ''}`}
      style={isEnded || isWrapping ? { pointerEvents: 'none' as const } : undefined}
    >
      <button
        type="button"
        onClick={isConnected || isConnecting ? onHangup : onReject}
        disabled={!hangupButtonActive || answering}
        title={isConnected || isConnecting ? 'Hang up' : 'Decline'}
        className={`
          flex items-center justify-center w-14 h-14 rounded-lg font-semibold shrink-0 border border-red-400/50 text-lg
          ${hangupButtonActive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-transparent text-white/40 cursor-not-allowed border-white/10'}
        `}
      >
        <PhoneOff className="w-6 h-6" />
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <button
          type="button"
          onClick={onAnswer}
          disabled={!answerButtonActive || answering}
          title="Answer"
          className={`
            relative overflow-hidden flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg font-bold border border-white/10 text-base
            ${answerButtonActive ? 'bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 text-white shadow-md hover:from-blue-400 hover:via-purple-500 hover:to-blue-600' : 'bg-transparent text-white/25 cursor-not-allowed'}
          `}
        >
          {answerButtonActive && (
            <span
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.22) 45%, transparent 55%)',
                animation: 'button-shimmer 1.8s ease-in-out infinite',
              }}
            />
          )}
          <Phone className="w-7 h-7 shrink-0 relative z-10" />
          <span className={`font-semibold relative z-10 ${!answerButtonActive ? 'opacity-50' : ''}`}>
            Accept Call
          </span>
          {isRinging && webRTCOffForAccept && (
            <span className="text-[10px] text-white/80 text-center w-full mt-0.5 relative z-10 block">
              WebRTC is off — click Accept to turn on and connect
            </span>
          )}
          <style>{`
            @keyframes button-shimmer {
              0%   { left: -35%; }
              100% { left: 110%; }
            }
          `}</style>
        </button>
        {(isConnected || isConnecting) && (
          <span className="text-[10px] text-white/50 text-center">Use the red button to end this call</span>
        )}
      </div>
    </motion.div>
  );

  const handleCompleteClick = () => {
    if (!onCompleteCall) return;
    if (!hasDisposition) {
      setHighlightDispositionPrompt(true);
      setShowCompleteConfirm(true);
      return;
    }
    setHighlightDispositionPrompt(false);
    onCompleteCall();
  };

  const completeCallBlock = (isEnded || isWrapping) && onCompleteCall ? (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className={`flex items-center gap-2 shrink-0 ${isVertical ? 'w-full' : 'min-w-[200px]'}`}
    >
      <button
        type="button"
        onClick={handleCompleteClick}
        title="Clear panel and return to waiting"
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg font-semibold border border-emerald-500/50 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30 transition-colors"
      >
        <CheckCircle className="w-5 h-5 shrink-0" />
        Complete call
      </button>
    </motion.div>
  ) : null;

  const dispositionOptions: Array<{ id: CallDisposition; label: string; icon: typeof Clock }> = [
    { id: 'call_back', label: 'Callback', icon: Clock },
    { id: 'no_answer_vm', label: 'No Answer / Voicemail', icon: PhoneOff },
    { id: 'booked', label: 'Booked', icon: CheckCircle },
    { id: 'instant_presentation', label: 'Instant Presentation', icon: Zap },
    { id: 'sale', label: 'Sale', icon: DollarSign },
    { id: 'not_interested', label: 'Not Interested', icon: X },
    { id: 'do_not_call', label: 'Do Not Call', icon: Ban },
  ];
  const dispositionBlock = (isEnded || isWrapping) && onDispositionSelect ? (
    <div className={`flex flex-col gap-2 shrink-0 ${isVertical ? 'w-full' : 'min-w-[240px]'} ${highlightDispositionPrompt ? 'rounded-xl ring-2 ring-amber-400/80 ring-offset-2 ring-offset-black' : ''}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={`w-full h-10 sm:h-12 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 ${
              selectedDisposition
                ? dispositionApplied
                  ? 'bg-blue-100 border-blue-400 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 border-green-400 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-purple-100 border-purple-300 hover:bg-purple-200 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
            }`}
          >
            {selectedDisposition ? (
              <>
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs font-bold">Disposition</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs font-bold">Select Disposition</span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-56 z-50" sideOffset={5}>
          {dispositionOptions.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onDispositionSelect(option.id)}
              className={`flex items-center gap-2 py-2 text-sm ${
                selectedDisposition === option.id ? 'bg-green-50 dark:bg-green-900/20' : ''
              }`}
            >
              <option.icon className="w-4 h-4" />
              <span className="text-xs sm:text-sm">{option.label}</span>
              {selectedDisposition === option.id && (
                <CheckCircle className="w-4 h-4 ml-auto text-green-600" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selectedDisposition && !dispositionApplied && onApplyDisposition && (
        <Button
          onClick={onApplyDisposition}
          className="w-full h-10 sm:h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-95 shadow-md"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          APPLY DISPOSITION
        </Button>
      )}
      {!dispositionApplied && (
        <span className="text-[10px] text-white/60 text-center">Disposition is required before this inbound panel can fully reset.</span>
      )}
    </div>
  ) : null;

  // Outer glow
  const outerGlowOnlineRing = '0 0 32px rgba(249, 115, 22, 0.5), 0 0 64px rgba(239, 68, 68, 0.3)';
  const outerGlowCalmRing   = '0 0 24px rgba(99, 102, 241, 0.4), 0 0 48px rgba(139, 92, 246, 0.2)';
  const outerGlowConnected  = '0 0 36px rgba(52, 211, 153, 0.5), 0 0 72px rgba(6, 182, 212, 0.3)';

  const showRingingStyle = isRinging || isConnecting;
  const isRecruitRail = connectionType === 'recruit';
  return (
    <motion.div
      className={`rounded-2xl p-[3px] flex flex-col min-h-0 w-full max-w-full ${
        isRecruitRail ? 'flex-none overflow-x-hidden overflow-y-auto' : 'flex-1 overflow-hidden'
      }`}
      initial={false}
      animate={{
        background: isOnlineRinging
          ? 'linear-gradient(to right, #f97316, #ea580c, #dc2626)'
          : isCalmRinging
          ? 'linear-gradient(to right, #4f46e5, #7c3aed, #06b6d4)'
          : isConnected
          ? 'linear-gradient(to right, #10b981, #059669, #06b6d4)'
          : 'linear-gradient(to right, transparent, transparent)',
        boxShadow: isOnlineRinging ? outerGlowOnlineRing
          : isCalmRinging ? outerGlowCalmRing
          : isConnected ? outerGlowConnected
          : 'none',
      }}
      transition={{ duration: 0.35 }}
    >
    <div
      className={`w-full flex flex-col flex-1 min-h-0 bg-black border border-white/10 rounded-2xl ${
        isRecruitRail ? 'overflow-x-hidden overflow-y-visible' : 'overflow-hidden'
      }`}
    >


      {/* Taalk VDP mount — recruit: tall enough to use the dial pad, capped so the column cannot become 100vh; connect: flex growth */}
      <div
        className={
          connectionType === 'recruit'
            ? 'shrink-0 flex flex-col overflow-hidden border-t border-white/10 bg-black isolate [contain:layout] w-full max-w-full'
            : 'flex-1 min-h-0 flex flex-col overflow-hidden border-t border-white/10 bg-black isolate [contain:layout]'
        }
      >
        <div
          ref={(el) => {
            if (taalkVdpMountRef) taalkVdpMountRef.current = el;
          }}
          id="mount-vdp-selector"
          data-taalk-vdp="mount"
          className={
            connectionType === 'recruit'
              ? 'min-h-[360px] h-[min(520px,58dvh)] max-h-[min(560px,70dvh)] w-full max-w-full overflow-hidden shrink-0'
              : 'flex-1 min-h-[400px] w-full max-w-full overflow-hidden'
          }
          style={{ minHeight: connectionType === 'recruit' ? undefined : 400 }}
        />
      </div>

      {/* ── Session Stats / Gamification Panel ── */}
      {dailyStats && isVertical && (
        <SessionRewardsPanel dailyStats={dailyStats} />
      )}

      {/* Recent Connects + live queue — shrink-0 so it is never flex-collapsed; scroll lives on VDPStatus wrapper if needed */}
      <div className="shrink-0 border-t border-white/10 bg-black relative z-20 min-h-[200px]">
        <InboundSuccessViewer
          visibleLines={5}
          pollIntervalMs={8000}
          refetchRef={successViewerRefetchRef}
          slideshowMode={false}
          marketFilter={connectionType === 'recruit' ? 'aorecruit' : undefined}
          recentConnectsOnly={connectionType === 'recruit'}
          queuePosition={isIdle && (connectionType === 'recruit' || vdpOnline) ? queuePosition : undefined}
          queueMarket={queueMarket}
          totalInMarket={totalInMarket}
        />
      </div>

      {/* Confirm Complete call without disposition */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Disposition required</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/80">
            Select a disposition below, then click Apply Disposition before completing this inbound call.
          </p>
          <div className="flex gap-2 pt-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCompleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg border border-white/20 text-white/90 hover:bg-white/10"
            >
              OK
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet low reminder (fades away) - above bottom row when needed */}
      {isVertical && showBillingBlock && (
        <AnimatePresence>
          {showWalletLowReminder && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="shrink-0 px-3 overflow-hidden"
            >
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-amber-200">Wallet low — enable backup so you never miss a transfer.</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { onBackupBillingToggle?.(true); setWalletLowReminderDismissed(true); }}
                    disabled={backupBillingLoading}
                    className="text-[10px] font-medium text-amber-200 hover:text-amber-100 border border-amber-400/50 rounded px-1.5 py-0.5"
                  >
                    Enable
                  </button>
                  <button type="button" onClick={() => setWalletLowReminderDismissed(true)} className="p-0.5 text-white/50 hover:text-white/80" aria-label="Dismiss">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Very bottom: one row — Never miss (slider + modal trigger) | Buy Credits | Credits (far right) */}
      {isVertical && showBillingBlock && (
        <div className="shrink-0 w-full px-3 py-2 border-t border-white/10 bg-black/30 flex flex-wrap items-center gap-2">
          {showBackupBillingCard && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="text-[10px] text-white/60 hover:text-white/90 truncate">
                    Auto bill
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-white text-base">Never Miss a Transfer – Auto Bill</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-white/80">
                    If a transfer comes in and your wallet is low, we&apos;ll automatically refill it by <span className="font-semibold text-white">$25</span> so you never miss a call.
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <span className="text-xs font-medium text-white/90">Enable Backup Billing</span>
                    <Switch
                      checked={backupBillingEnabled}
                      disabled={backupBillingLoading}
                      onCheckedChange={(checked) => onBackupBillingToggle?.(!!checked)}
                    />
                  </div>
                  {(backupBillingEnabled || cardDisplay) && (
                    <p className="text-[11px] text-white/50 pt-1">{cardDisplay || 'Card on file'}</p>
                  )}
                </DialogContent>
              </Dialog>
              <Switch
                checked={backupBillingEnabled}
                disabled={backupBillingLoading}
                onCheckedChange={(checked) => onBackupBillingToggle?.(!!checked)}
                className="shrink-0"
              />
            </div>
          )}
          {creditPurchaseModal ? (
            <button
              type="button"
              onClick={creditPurchaseModal.openCreditPurchaseModal}
              className="text-[10px] font-medium py-1.5 px-2 rounded border border-white/20 text-white/90 hover:bg-white/10 shrink-0"
            >
              Buy Credits
            </button>
          ) : (
            <a href="/dashboard/billing-dashboard" className="text-[10px] font-medium py-1.5 px-2 rounded border border-white/20 text-white/90 hover:bg-white/10 shrink-0 inline-block">
              Buy Credits
            </a>
          )}
          {typeof walletBalanceDollars === 'number' && (
            <span className="text-[10px] text-white/70 shrink-0 ml-auto">
              <span className="text-white/60">Credits </span>
              <span className="font-semibold tabular-nums bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">${walletBalanceDollars.toFixed(0)}</span>
            </span>
          )}
        </div>
      )}

    </div>
    </motion.div>
  );
}
