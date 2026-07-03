"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Trophy, Activity, Zap, Crown, Shield, Gem, Sparkles, User, Users } from "lucide-react";

export interface InboundSuccessEvent {
  id: string;
  agentName: string;
  market: string;
  state: string;
  city?: string;
  source?: string;
  connectedAt: string;
  durationSeconds?: number;
  badge?: string;
  eligible?: boolean;
  alpAmount?: number;
}

interface InboundSuccessViewerProps {
  visibleLines?: number;
  pollIntervalMs?: number;
  refetchRef?: React.MutableRefObject<(() => void) | null>;
  slideshowMode?: boolean;
  slideDurationSec?: number;
  /** When set, only events for this market are fetched (e.g. "aorecruit" for AO Recruit panel). */
  marketFilter?: string;
  /** When true, only show Recent Connects (no My Stats / Production / Activity tabs). Used for AO Recruit. */
  recentConnectsOnly?: boolean;
  /** Inbound queue rank (from eligible-for-inbound / POS APIs). */
  queuePosition?: number;
  queueMarket?: string;
  totalInMarket?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sportName(full: string): string {
  const s = String(full || "").trim();
  if (!s) return "Agent";
  const parts = s.split(/\s+/);
  if (parts.length === 1) return s.slice(0, 7);
  return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1].slice(0, 5)}`;
}

function shortMarket(market: string): string {
  const m = String(market || "").trim();
  if (/globe/i.test(m)) return "Globe";
  if (/veteran/i.test(m)) return "Veteran";
  if (/recruit|aorecruit/i.test(m)) return "AO Recruit";
  if (/inbound/i.test(m)) return "Inbound";
  return m.split(/\s+/)[0].slice(0, 8);
}

/** True only for AO Recruit lane — excludes Veteran, Globe, generic inbound, etc. */
function isAoRecruitQueueMarket(raw: string | undefined | null): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  if (/veteran/i.test(s)) return false;
  if (/globe/i.test(s)) return false;
  const m = s.toLowerCase();
  if (/aorecruit/i.test(m)) return true;
  if (m === "recruit") return true;
  if (/\bao[\s_-]*recruit\b/i.test(s)) return true;
  return false;
}

/** When `marketFilter` is aorecruit, restrict live queue + panel rows to that lane only. */
function liveItemMatchesMarketFilter(filter: string | undefined, itemMarket: string | undefined | null): boolean {
  if (!filter || !String(filter).trim()) return true;
  const f = String(filter).trim().toLowerCase();
  if (f === "aorecruit" || f === "ao recruit") {
    return isAoRecruitQueueMarket(itemMarket ?? undefined);
  }
  const m = String(itemMarket ?? "").trim().toLowerCase();
  return m.includes(f);
}

function formatTimeAgo(iso: string | undefined): string {
  if (!iso) return "—";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 30) return "LIVE";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

function formatDuration(sec?: number): string {
  if (!sec) return "";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60 > 0 ? (sec % 60) + "s" : ""}`;
}

type BadgeTier = {
  Icon: React.ElementType;
  iconCls: string;
  wrapCls: string;
  glow: string;
  label: string;
};

const BADGE_CFG: Record<string, BadgeTier> = {
  gold: {
    Icon: Crown,
    iconCls: "text-amber-300",
    wrapCls: "bg-amber-500/20 border-amber-400/50",
    glow: "drop-shadow(0 0 3px rgba(251,191,36,0.8))",
    label: "Gold",
  },
  platinum: {
    Icon: Shield,
    iconCls: "text-slate-200",
    wrapCls: "bg-slate-400/20 border-slate-300/40",
    glow: "drop-shadow(0 0 3px rgba(203,213,225,0.7))",
    label: "Platinum",
  },
  diamond: {
    Icon: Gem,
    iconCls: "text-purple-300",
    wrapCls: "bg-purple-500/20 border-purple-400/50",
    glow: "drop-shadow(0 0 4px rgba(168,85,247,0.85))",
    label: "Diamond",
  },
  "blue-diamond": {
    Icon: Sparkles,
    iconCls: "text-cyan-300",
    wrapCls: "bg-cyan-500/20 border-cyan-400/50",
    glow: "drop-shadow(0 0 4px rgba(34,211,238,0.9)) drop-shadow(0 0 8px rgba(99,102,241,0.5))",
    label: "Blue Diamond",
  },
};

function RankBadge({ badge }: { badge?: string }) {
  if (!badge) return null;
  const cfg = BADGE_CFG[badge.toLowerCase()];
  if (!cfg) return null;
  const { Icon, iconCls, wrapCls, glow, label } = cfg;
  return (
    <span
      title={label}
      className={`shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded border ${wrapCls}`}
    >
      <Icon
        className={`w-2.5 h-2.5 ${iconCls}`}
        style={{ filter: glow }}
      />
    </span>
  );
}

function AlpBadge({ amount }: { amount?: number }) {
  if (!amount) return null;
  return (
    <span className="shrink-0 px-1.5 py-px rounded text-[9px] font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 leading-tight">
      ${amount.toLocaleString()} ALP
    </span>
  );
}

function AoiBadge() {
  return (
    <span className="shrink-0 px-1 py-px rounded text-[8px] font-black tracking-wider border bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-blue-500/40 text-blue-300 leading-tight uppercase">
      AOI
    </span>
  );
}

// ─── Demo data ─────────────────────────────────────────────────────────────────

interface ProductionEntry {
  rank: number;
  name: string;
  badge?: string;
  alp: number;
  isUser?: boolean;
}

interface ActivityEntry {
  rank: number;
  name: string;
  badge?: string;
  dials: number;
  reach: number;
  booked: number;
  connects: number;
  isUser?: boolean;
}

const DEMO_PRODUCTION: ProductionEntry[] = [
  { rank: 1, name: "T. Mason",   badge: "blue-diamond", alp: 14820 },
  { rank: 2, name: "C. Rivera",  badge: "diamond",      alp: 11340 },
  { rank: 3, name: "J. Hartley", badge: "platinum",     alp: 8760  },
  { rank: 4, name: "M. Brooks",  badge: "gold",         alp: 6290  },
  { rank: 7, name: "You",        badge: "gold",         alp: 3410, isUser: true },
];

const DEMO_ACTIVITY: ActivityEntry[] = [
  { rank: 1, name: "T. Mason",   badge: "blue-diamond", dials: 94, reach: 31, booked: 8, connects: 11 },
  { rank: 2, name: "C. Rivera",  badge: "diamond",      dials: 87, reach: 28, booked: 6, connects: 9  },
  { rank: 3, name: "J. Hartley", badge: "platinum",     dials: 76, reach: 22, booked: 5, connects: 7  },
  { rank: 4, name: "M. Brooks",  badge: "gold",         dials: 71, reach: 19, booked: 4, connects: 6  },
  { rank: 9, name: "You",        badge: "gold",         dials: 43, reach: 11, booked: 2, connects: 3, isUser: true },
];

// ─── SlamCard ─────────────────────────────────────────────────────────────────

function SlamCard({ event, onDone }: { event: InboundSuccessEvent; onDone: () => void }) {
  const isLive = (Date.now() - new Date(event.connectedAt).getTime()) < 30000;
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [event.id]);

  return (
    <motion.div
      key={`slam-${event.id}`}
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className="relative w-full rounded-lg overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(6,182,212,0.12) 100%)",
        border: "1px solid rgba(16,185,129,0.35)",
        boxShadow: "0 0 24px rgba(16,185,129,0.2)",
      }}
    >
      <motion.div
        className="absolute inset-0 bg-emerald-400/20 pointer-events-none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      />
      <div className="px-3 py-2.5 flex items-center gap-2">
        <motion.div
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 20 }}
          className="shrink-0 text-[10px] font-black tracking-widest text-emerald-400 uppercase"
        >
          CONNECT
        </motion.div>
        <span className="text-white/30 shrink-0">·</span>
        <span className="font-black text-white text-sm tracking-tight truncate shrink">
          {sportName(event.agentName)}
        </span>
        <AoiBadge />
        <span className="text-white/60 font-semibold text-xs shrink-0">{shortMarket(event.market || "Inbound")}</span>
        <RankBadge badge={event.badge} />
        <AlpBadge amount={event.alpAmount} />
        {event.eligible && (
          <span className="shrink-0 px-1.5 py-px rounded text-[9px] font-bold border bg-amber-500/20 text-amber-300 border-amber-500/40 leading-tight">eligible</span>
        )}
        <span className="ml-auto shrink-0">
          <span className={`text-[10px] font-semibold tabular-nums ${isLive ? "text-emerald-400 animate-pulse" : "text-white/40"}`}>
            {formatTimeAgo(event.connectedAt)}
          </span>
        </span>
      </div>
    </motion.div>
  );
}

// ─── ConnectStatCard ──────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  const colors = [
    "linear-gradient(135deg,#6366f1,#a855f7)",
    "linear-gradient(135deg,#06b6d4,#3b82f6)",
    "linear-gradient(135deg,#10b981,#06b6d4)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#ec4899,#8b5cf6)",
    "linear-gradient(135deg,#f97316,#eab308)",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function ConnectStatCard({ event, onClose }: { event: InboundSuccessEvent; onClose: () => void }) {
  const isLive = (Date.now() - new Date(event.connectedAt).getTime()) < 30000;
  const initials = (event.agentName || "?").split(/\s+/).map((p) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
  const badgeCfg = event.badge ? BADGE_CFG[event.badge.toLowerCase()] : null;

  const stats: { label: string; value: string; accent?: string }[] = [
    { label: "Market",   value: event.market  || "—" },
    { label: "Location", value: [event.city, event.state].filter(Boolean).join(", ") || (event.state || "—") },
    { label: "Time",     value: formatTimeAgo(event.connectedAt), accent: isLive ? "text-emerald-400" : undefined },
    ...(event.durationSeconds ? [{ label: "Duration", value: formatDuration(event.durationSeconds) }] : []),
    ...(event.source ? [{ label: "Source", value: event.source }] : []),
    ...(event.alpAmount ? [{ label: "ALP", value: `$${event.alpAmount.toLocaleString()}`, accent: "text-emerald-300" }] : []),
    ...(event.eligible ? [{ label: "Status", value: "Eligible", accent: "text-amber-300" }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="relative rounded-lg overflow-hidden mb-1"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(99,102,241,0.1) 100%)",
        border: "1px solid rgba(16,185,129,0.25)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      }}
    >
      {/* Dismiss */}
      <button
        onClick={onClose}
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/70 transition-colors z-10 text-xs font-black"
      >
        ✕
      </button>

      <div className="px-3 pt-2.5 pb-2.5 flex items-start gap-3">
        {/* Portrait */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm select-none shadow-lg"
            style={{ background: avatarColor(event.agentName || "?") }}
          >
            {initials}
          </div>
          {badgeCfg && (
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded border ${badgeCfg.wrapCls}`}>
              <badgeCfg.Icon className={`w-3 h-3 ${badgeCfg.iconCls}`} style={{ filter: badgeCfg.glow }} />
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="font-black text-white text-sm tracking-tight truncate">{event.agentName || "—"}</span>
            {isLive && (
              <span className="shrink-0 px-1.5 py-px rounded text-[8px] font-black border bg-emerald-500/20 text-emerald-400 border-emerald-500/40 tracking-widest animate-pulse uppercase">Live</span>
            )}
            <AoiBadge />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-wider leading-none mb-0.5">{s.label}</p>
                <p className={`text-[11px] font-semibold leading-tight truncate ${s.accent ?? "text-white/80"}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── TickerRow ────────────────────────────────────────────────────────────────

function TickerRow({ event, isNewest, isSelected, onSelect }: { event: InboundSuccessEvent; isNewest: boolean; isSelected: boolean; onSelect: () => void }) {
  const isLive = (Date.now() - new Date(event.connectedAt).getTime()) < 30000;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 26 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onClick={onSelect}
      className={`flex items-center gap-1.5 text-[11px] px-1.5 rounded shrink-0 cursor-pointer transition-colors ${isSelected ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" : isNewest ? "bg-emerald-500/8 hover:bg-white/5" : "hover:bg-white/5"}`}
      style={{ height: 26, minHeight: 26 }}
    >
      <RankBadge badge={event.badge} />
      <span className="font-bold text-white shrink-0 tabular-nums" style={{ minWidth: 54 }}>
        {sportName(event.agentName)}
      </span>
      <AoiBadge />
      <span className="text-white/50 truncate shrink">{shortMarket(event.market || "Inbound")}</span>
      <span className="text-white/30 shrink-0">·</span>
      <span className="text-white/50 shrink-0">{(event.state || "—").trim()}</span>
      {event.durationSeconds ? (
        <>
          <span className="text-white/20 shrink-0">·</span>
          <span className="text-white/40 shrink-0 tabular-nums">{formatDuration(event.durationSeconds)}</span>
        </>
      ) : null}
      <AlpBadge amount={event.alpAmount} />
      {event.eligible && (
        <span className="shrink-0 px-1 py-px rounded text-[9px] font-bold border bg-amber-500/20 text-amber-300 border-amber-500/40 leading-tight">eligible</span>
      )}
      <span className={`ml-auto shrink-0 tabular-nums text-[10px] ${isLive ? "text-emerald-400 font-semibold animate-pulse" : "text-white/30"}`}>
        {formatTimeAgo(event.connectedAt)}
      </span>
    </motion.div>
  );
}

// ─── Production leaderboard row ────────────────────────────────────────────────

// Grid columns: 20px rank | 30px badge | 1fr name | auto AOI | 72px ALP | 26px label
const PROD_GRID = "20px 30px 1fr auto 72px 26px";

function ProductionRow({ entry, index }: { entry: ProductionEntry; index: number }) {
  const rankColor = entry.rank === 1 ? "text-amber-400" : entry.rank === 2 ? "text-slate-300" : entry.rank === 3 ? "text-amber-600" : "text-white/40";
  return (
    <motion.div
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 340, damping: 26 }}
      className={`grid items-center gap-x-1.5 text-[11px] px-1.5 py-1 rounded ${
        entry.isUser ? "bg-blue-500/15 border border-blue-500/25" : entry.rank <= 3 ? "bg-white/4" : ""
      }`}
      style={{ gridTemplateColumns: PROD_GRID }}
    >
      <span className={`text-right font-black text-[10px] tabular-nums ${entry.isUser ? "text-blue-400" : rankColor}`}>
        #{entry.rank}
      </span>
      <span><RankBadge badge={entry.badge} /></span>
      <span className={`font-bold truncate ${entry.isUser ? "text-blue-300" : "text-white"}`}>
        {entry.name}
      </span>
      <AoiBadge />
      <span className={`text-right font-black tabular-nums text-sm ${entry.isUser ? "text-blue-300" : entry.rank === 1 ? "text-amber-300" : "text-emerald-300"}`}>
        ${entry.alp.toLocaleString()}
      </span>
      <span className={`text-[9px] font-black tracking-wider ${entry.isUser ? "text-blue-400" : "text-white/30"}`}>
        {entry.isUser ? "YOU" : "ALP"}
      </span>
    </motion.div>
  );
}

// ─── Activity leaderboard row ──────────────────────────────────────────────────

// Grid columns: 20px rank | 30px badge | 1fr name | 28px D | 28px R | 28px B | 28px C | 26px YOU
const ACT_GRID = "20px 30px 1fr 28px 28px 28px 28px 26px";

function ActivityRow({ entry, index }: { entry: ActivityEntry; index: number }) {
  const rankColor = entry.rank === 1 ? "text-amber-400" : entry.rank === 2 ? "text-slate-300" : entry.rank === 3 ? "text-amber-600" : "text-white/40";
  return (
    <motion.div
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 340, damping: 26 }}
      className={`grid items-center gap-x-1 text-[10px] px-1.5 py-1 rounded ${
        entry.isUser ? "bg-blue-500/15 border border-blue-500/25" : entry.rank <= 3 ? "bg-white/4" : ""
      }`}
      style={{ gridTemplateColumns: ACT_GRID }}
    >
      <span className={`text-right font-black text-[10px] tabular-nums ${entry.isUser ? "text-blue-400" : rankColor}`}>
        #{entry.rank}
      </span>
      <span><RankBadge badge={entry.badge} /></span>
      <span className={`font-bold truncate ${entry.isUser ? "text-blue-300" : "text-white"}`}>
        {entry.name}
      </span>
      <span className="text-center font-black tabular-nums text-white/70">{entry.dials}</span>
      <span className="text-center font-black tabular-nums text-blue-300">{entry.reach}</span>
      <span className="text-center font-black tabular-nums text-purple-300">{entry.booked}</span>
      <span className="text-center font-black tabular-nums text-emerald-300">{entry.connects}</span>
      <span className={`text-[9px] font-black tracking-wider ${entry.isUser ? "text-blue-400" : "text-white/0"}`}>
        {entry.isUser ? "YOU" : "·"}
      </span>
    </motion.div>
  );
}



// ─── Baseball card (My Stats page) ────────────────────────────────────────────

interface MyStats {
  agentName: string;
  market: string;
  badge?: string;
  avatarUrl?: string | null;
  today: { connects: number; alp: number; eligible: number; avgDuration: number | null };
  week:  { connects: number; alp: number; eligible?: number; avgDuration?: number | null };
  recent: Array<{ connectedAt: string; market: string; state: string; city?: string; durationSeconds?: number; alpAmount?: number; eligible?: boolean }>;
}

const DEMO_STATS: MyStats = {
  agentName:  "Tyler Menge",
  market:     "Veteran",
  badge:      "gold",
  today:      { connects: 3, alp: 4200, eligible: 2, avgDuration: 374 },
  week:       { connects: 11, alp: 13800, eligible: 8, avgDuration: 374 },
  recent: [
    { connectedAt: new Date(Date.now() - 9 * 60000).toISOString(),    market: "Veteran",  state: "ID", durationSeconds: 414, alpAmount: 2100, eligible: true  },
    { connectedAt: new Date(Date.now() - 71 * 60000).toISOString(),   market: "Veteran",  state: "ID", durationSeconds: 308                                   },
    { connectedAt: new Date(Date.now() - 183 * 60000).toISOString(),  market: "Veteran",  state: "WA", durationSeconds: 401, alpAmount: 2100, eligible: true  },
    { connectedAt: new Date(Date.now() - 5 * 3600000).toISOString(),  market: "Medicare", state: "OR", durationSeconds: 290                                   },
  ],
};

function StatBox({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-2 rounded-lg border border-white/10"
         style={{ background: "rgba(255,255,255,0.04)" }}>
      <span className={`text-lg font-black tabular-nums leading-none ${accent}`}>{value}</span>
      <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function MyStatsCard({ agentEmail, externalStats }: { agentEmail: string | null; externalStats?: MyStats | null }) {
  const [stats, setStats] = useState<MyStats | null>(externalStats ?? null);
  const [loading, setLoading] = useState(!externalStats);
  const isDemo = !stats;

  // Sync when external stats arrive (from the consolidated panel-data fetch)
  useEffect(() => {
    if (externalStats) { setStats(externalStats); setLoading(false); }
  }, [externalStats]);

  const display = stats ?? DEMO_STATS;
  const name = display.agentName;
  const initials = name.split(/\s+/).map(p => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
  const badgeCfg = display.badge ? BADGE_CFG[display.badge.toLowerCase()] : null;
  const accentGrad = avatarColor(name);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative mx-1 mb-1 rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(30,27,75,0.9) 0%, rgba(15,23,42,0.95) 60%, rgba(6,18,42,1) 100%)",
        border: "1px solid rgba(99,102,241,0.25)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Top shimmer line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(to right, transparent, rgba(99,102,241,0.6), rgba(139,92,246,0.6), transparent)" }} />

      {/* Background glow behind avatar */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${accentGrad.includes('#6366f1') ? 'rgba(99,102,241,0.18)' : 'rgba(6,182,212,0.14)'} 0%, transparent 70%)`, filter: 'blur(12px)' }} />

      <div className="relative z-10 px-3 pt-3 pb-2.5 flex flex-col gap-2.5">

        {/* ── Portrait + identity ── */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {/* Outer ring — only shown when no photo */}
            {!display.avatarUrl && (
              <div className="absolute inset-0 rounded-2xl" style={{ background: accentGrad, padding: 2, borderRadius: 16 }}>
                <div className="w-full h-full rounded-2xl" style={{ background: "#0f172a" }} />
              </div>
            )}
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg select-none shadow-xl overflow-hidden"
              style={{ background: display.avatarUrl ? 'transparent' : accentGrad }}
            >
              {display.avatarUrl
                ? <img src={display.avatarUrl} alt={name} className="w-full h-full object-cover rounded-2xl" />
                : initials}
            </div>
            {badgeCfg && (
              <span className={`absolute -bottom-1.5 -right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-lg border-2 border-slate-900 ${badgeCfg.wrapCls} shadow-lg`}>
                <badgeCfg.Icon className={`w-3.5 h-3.5 ${badgeCfg.iconCls}`} style={{ filter: badgeCfg.glow }} />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-white text-sm leading-tight tracking-tight">{name}</span>
              {isDemo && <span className="text-[8px] font-black px-1 py-px rounded bg-white/10 text-white/30 tracking-widest uppercase">demo</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold text-indigo-300">{display.market}</span>
              <span className="text-white/20">·</span>
              <AoiBadge />
            </div>
            {agentEmail && <p className="text-[9px] text-white/25 font-mono mt-0.5 truncate">{agentEmail}</p>}
          </div>
        </div>

        {/* ── This Week label (ALP is rolling 30d from platform_sales AOI/CCPRO) ── */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: "rgba(99,102,241,0.2)" }} />
          <span className="text-[8px] font-black tracking-[0.2em] uppercase text-indigo-400/60">This Week</span>
          <div className="flex-1 h-px" style={{ background: "rgba(99,102,241,0.2)" }} />
        </div>

        {/* ── 4-stat grid (week) ── */}
        <div className="grid grid-cols-4 gap-1.5">
          <StatBox value={String(display.week.connects)}                                                               label="Connects" accent="text-emerald-300" />
          <StatBox value={display.week.alp ? `$${(display.week.alp/1000).toFixed(1)}k` : "$0"}                       label="ALP 30d"  accent="text-amber-300" />
          <StatBox value={String(display.week.eligible ?? display.today.eligible)}                                      label="Eligible" accent="text-purple-300" />
          <StatBox value={(display.week.avgDuration ?? display.today.avgDuration) ? `${Math.floor((display.week.avgDuration ?? display.today.avgDuration)!/60)}m` : "—"} label="Avg Dur" accent="text-cyan-300" />
        </div>

        {/* ── Today summary ── */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.18em]">Today</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-white/40 font-semibold tabular-nums">{display.today.connects} connects</span>
            {display.today.alp > 0 && <span className="text-amber-300/70 font-bold tabular-nums">${display.today.alp.toLocaleString()}</span>}
          </div>
        </div>

        {/* ── Recent connects ── */}
        <div className="flex flex-col gap-px">
          {display.recent.slice(0, 4).map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded-md"
                 style={{ background: i === 0 ? "rgba(16,185,129,0.07)" : "transparent" }}>
              {i === 0 && <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0 animate-pulse" />}
              {i !== 0 && <div className="w-1 h-1 rounded-full bg-white/15 shrink-0" />}
              <span className="text-white/25 tabular-nums shrink-0 w-7 text-right">{formatTimeAgo(r.connectedAt)}</span>
              <span className="text-white/50 truncate shrink font-medium">{r.market || "—"}</span>
              <span className="text-white/25 shrink-0">{r.state || "—"}</span>
              {r.durationSeconds ? <span className="text-white/25 tabular-nums shrink-0">{formatDuration(r.durationSeconds)}</span> : null}
              {r.alpAmount ? <span className="text-emerald-300/80 shrink-0 font-bold ml-auto">${r.alpAmount.toLocaleString()}</span> : <span className="ml-auto" />}
              {r.eligible ? <span className="text-amber-300/80 shrink-0 text-[9px] font-black">✓</span> : null}
            </div>
          ))}
        </div>

      </div>

      {/* Bottom shimmer */}
      <div className="h-px w-full" style={{ background: "linear-gradient(to right, transparent, rgba(99,102,241,0.2), transparent)" }} />
    </motion.div>
  );
}

// ─── Page header title ─────────────────────────────────────────────────────────

const PAGE_CONFIG = [
  { key: "connects",   label: "Live Queue",        icon: Activity, accent: "text-cyan-400",    bar: "from-purple-500 to-cyan-500", durationMultiplier: 1 },
  { key: "mycard",     label: "My Stats",         icon: User,     accent: "text-blue-400",    bar: "from-blue-500 to-indigo-500", durationMultiplier: 1 },
  // Queue Position slide removed — live position now shown in the header POS tile
];

const PAGE_ROTATE_MS = 20000;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "60%" : "-60%", opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? "-60%" : "60%", opacity: 0, scale: 0.97 }),
};

// ─── Live Queue Row ────────────────────────────────────────────────────────────

type QueueStage = 'ai_qualifying' | 'queued' | 'ringing' | 'no_agent' | 'connected';

interface QueueItem {
  leadId: string;
  firstName: string;
  lastName: string;
  market: string;
  state: string;
  stage: QueueStage;
  agentBlasts: Record<string, number>;
  currentRound: string[];
  time: number;
  seenAt: number;
}

interface MissedTransferItem {
  leadName: string;
  leadState: string;
  market: string;
  phone: string;
  missedBy: string[];
  missedAt: string;
  ringCycles?: number;
}

function QueueRow({ item }: { item: QueueItem }) {
  const ageSecs = Math.floor((Date.now() - (item.time || item.seenAt)) / 1000);
  const ageLabel = ageSecs < 60 ? `${ageSecs}s` : `${Math.floor(ageSecs / 60)}m`;

  const stageIcon   = item.stage === 'connected' ? '✅' : item.stage === 'no_agent' ? '🚫' : item.stage === 'ringing' ? '📲' : item.stage === 'queued' ? '⏳' : '🤖';
  const stageColor  = item.stage === 'connected' ? 'text-emerald-400' : item.stage === 'no_agent' ? 'text-red-400' : item.stage === 'ringing' ? 'text-cyan-400' : item.stage === 'queued' ? 'text-amber-400' : 'text-purple-400';
  const isNoAgent   = item.stage === 'no_agent';
  const isConnected = item.stage === 'connected';
  const isRinging   = item.stage === 'ringing';
  const name        = [item.firstName, item.lastName].filter(Boolean).join(' ') || '?';

  const roundSet      = new Set(item.currentRound ?? []);
  const ringingAgents = item.currentRound ?? [];
  const missedAgents  = Object.keys(item.agentBlasts ?? {}).filter(n => !roundSet.has(n));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 'auto' }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex flex-col gap-0.5 text-[11px] px-1.5 py-1 rounded shrink-0 ${isNoAgent ? 'bg-red-500/8' : isConnected ? 'bg-emerald-500/10' : isRinging ? 'bg-cyan-500/5' : 'bg-white/3'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[11px]">{stageIcon}</span>
        <span className={`font-bold shrink-0 tabular-nums ${stageColor}`} style={{ minWidth: 54 }}>
          {name.split(' ')[0].slice(0, 6)}{name.includes(' ') ? ` ${name.split(' ').slice(-1)[0][0]}.` : ''}
        </span>
        <span className={`truncate shrink ${isNoAgent ? 'text-red-400/60' : 'text-white/40'}`}>{shortMarket(item.market || '')}</span>
        <span className="text-white/20 shrink-0">·</span>
        <span className={`shrink-0 ${isNoAgent ? 'text-red-400/70' : 'text-white/40'}`}>{item.state || '—'}</span>
        {isNoAgent && <span className="text-red-400/80 shrink-0 text-[9px] font-bold">NO AGENT</span>}
        {isConnected && <span className="text-emerald-400/80 shrink-0 text-[9px] font-bold">CONNECTED</span>}
        <span className={`ml-auto shrink-0 tabular-nums text-[10px] ${isNoAgent ? 'text-red-400/60 animate-pulse' : isConnected ? 'text-emerald-400/50' : 'text-white/25'}`}>{ageLabel}</span>
      </div>
      {isRinging && (
        <div className="flex flex-col gap-0.5 pl-4">
          {ringingAgents.map(a => (
            <span key={a} className="text-[10px] text-cyan-400 font-semibold">📲 {a.split(' ')[0]}</span>
          ))}
          {missedAgents.map(a => (
            <span key={a} className="text-[10px] text-red-400 font-semibold">👻 {a.split(' ')[0]}</span>
          ))}
          {ringingAgents.length === 0 && missedAgents.length === 0 && (
            <span className="text-[10px] text-cyan-400/50 animate-pulse">blasting...</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const DEFAULT_POLL_MS = 5000;
const FETCH_LIMIT = 15;

export function InboundSuccessViewer({
  pollIntervalMs = DEFAULT_POLL_MS,
  refetchRef,
  marketFilter,
  recentConnectsOnly: connectsOnly,
  queuePosition,
  queueMarket,
  totalInMarket,
}: InboundSuccessViewerProps) {
  const [events, setEvents] = useState<InboundSuccessEvent[]>([]);
  const [slamEvent, setSlamEvent] = useState<InboundSuccessEvent | null>(null);
  const [slamDone, setSlamDone] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [titleFlash, setTitleFlash] = useState(false);
  const [selectedConnect, setSelectedConnect] = useState<InboundSuccessEvent | null>(null);
  const [agentEmail, setAgentEmail] = useState<string | null>(null);
  const [panelStats, setPanelStats] = useState<MyStats | null>(null);

  // Resolve current user's email once for the baseball card
  useEffect(() => {
    (async () => {
      try {
        if (supabase?.auth?.getSession) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) { setAgentEmail(session.user.email.toLowerCase()); return; }
        }
      } catch (_) {}
      // Fallback: localStorage
      try {
        const stored = localStorage.getItem('agent_email') || localStorage.getItem('agentEmail') || localStorage.getItem('userEmail');
        if (stored) { setAgentEmail(stored.toLowerCase().trim()); return; }
        const producer = localStorage.getItem('current_producer');
        if (producer) {
          const p = JSON.parse(producer);
          const e = p?.email || p?.company_email;
          if (e) setAgentEmail(e.toLowerCase().trim());
        }
      } catch (_) {}
    })();
  }, []);

  // ── Live transfer queue feed ──
  const [queueFeed, setQueueFeed] = useState<QueueItem[]>([]);
  const [connectedCalls, setConnectedCalls] = useState<QueueItem[]>([]);
  const [missedFeed, setMissedFeed] = useState<MissedTransferItem[]>([]);
  const [stageCounts, setStageCounts] = useState({ ai: 0, queued: 0, ringing: 0, no_agent: 0 });
  const seenMissedKeys = useRef(new Set<string>());
  useEffect(() => {
    setQueueFeed([]);
    setConnectedCalls([]);
    setMissedFeed([]);
    seenMissedKeys.current.clear();
    setStageCounts({ ai: 0, queued: 0, ringing: 0, no_agent: 0 });
  }, [marketFilter]);
  useEffect(() => {
    const marketField = (t: any) => t?.market ?? t?.taalk_market ?? t?.taalkMarket ?? '';
    const poll = () =>
      fetch('/api/diagnostics/proxy/live-queue')
        .then(r => r.json())
        .then((d: { pending?: any[]; picked?: any[]; missedTransfers?: any[] }) => {
          const now = Date.now();
          const pendingRaw = d.pending ?? [];
          const pickedRaw = d.picked ?? [];
          const pending = pendingRaw.filter((t: any) => liveItemMatchesMarketFilter(marketFilter, marketField(t)));
          const picked = pickedRaw.filter((t: any) => liveItemMatchesMarketFilter(marketFilter, marketField(t)));

          // Update live counts from filtered pending only (AO Recruit rail)
          setStageCounts({
            ai:       pending.filter((t: any) => t.stage === 'ai_qualifying').length,
            queued:   pending.filter((t: any) => t.stage === 'queued').length,
            ringing:  pending.filter((t: any) => t.stage === 'ringing').length,
            no_agent: pending.filter((t: any) => t.stage === 'no_agent').length,
          });

          // Live snapshot of pending — replace entirely each poll so ringing agents stay current
          setQueueFeed(pending.map((t: any) => ({ ...t, currentRound: t.currentRound ?? [], seenAt: now })));

          // Sync connected calls live (same market filter)
          setConnectedCalls(prev => {
            const pickedIds = new Set(picked.map((t: any) => t.leadId));
            const still = prev.filter(x => pickedIds.has(x.leadId));
            const stillIds = new Set(still.map(x => x.leadId));
            const newPicked = picked
              .filter((t: any) => !stillIds.has(t.leadId))
              .map((t: any) => ({ ...t, stage: 'connected' as QueueStage, currentRound: [], seenAt: now }));
            return [...still, ...newPicked];
          });

          // Accumulate missed transfers (filter by market when rail is AO Recruit)
          if (d.missedTransfers?.length) {
            const missedIn = d.missedTransfers.filter((m: any) =>
              liveItemMatchesMarketFilter(marketFilter, m?.market)
            );
            if (missedIn.length) {
              setMissedFeed(prev => {
                const next = [...prev];
                for (const m of missedIn) {
                  const key = `${m.phone}-${m.missedAt}`;
                  if (!seenMissedKeys.current.has(key)) {
                    seenMissedKeys.current.add(key);
                    next.unshift(m);
                  }
                }
                return next.slice(0, 10);
              });
            }
          }
        })
        .catch(() => {});
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [marketFilter]);

  const previousIdsRef = useRef<Set<string>>(new Set());
  const previousSignatureRef = useRef<string>("");
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const pauseAutoRef = useRef(false);

  const goToPage = useCallback((next: number, direction = 1) => {
    setDir(direction);
    setPageIndex(next);
    setTitleFlash(true);
    setTimeout(() => setTitleFlash(false), 600);
  }, []);

  const advancePage = useCallback(() => {
    if (pauseAutoRef.current) return;
    const availablePages = PAGE_CONFIG;
    const nextIndex = (pageIndex + 1) % availablePages.length;
    goToPage(nextIndex, 1);
  }, [pageIndex, goToPage, queuePosition]);

  // Auto-rotate with variable duration based on page
  useEffect(() => {
    const availablePages = PAGE_CONFIG;
    const currentPage = availablePages[pageIndex] ?? availablePages[0];
    const durationMultiplier = currentPage?.durationMultiplier ?? 1;
    const duration = PAGE_ROTATE_MS * durationMultiplier;
    const t = setInterval(advancePage, duration);
    return () => clearInterval(t);
  }, [advancePage, pageIndex, queuePosition]);

  const fetchSuccesses = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      try {
        if (supabase?.auth?.getSession) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        }
      } catch (_) {}
      const params = new URLSearchParams({ limit: String(FETCH_LIMIT), _t: String(Date.now()) });
      if (marketFilter) params.set('market', marketFilter);
      if (agentEmail) params.set('email', agentEmail);
      const res = await fetch(`/api/agent/panel-data?${params.toString()}`, {
        credentials: "include", headers, cache: "no-store",
      });
      if (!res.ok) return;
      let data: { events?: unknown[]; stats?: MyStats } = {};
      try { data = await res.json(); } catch (_) { return; }
      if (data?.stats?.agentName) setPanelStats(data.stats);
      const raw = data?.events;
      const list: InboundSuccessEvent[] = (
        Array.isArray(raw)
          ? raw.filter((e): e is InboundSuccessEvent => e != null && typeof e === "object")
          : []
      ).filter((e) => liveItemMatchesMarketFilter(marketFilter, e.market));
      const signature = list.map((e) => `${e.id}:${e.connectedAt}`).join("|");
      if (signature === previousSignatureRef.current) return;
      previousSignatureRef.current = signature;
      const prev = previousIdsRef.current;
      const newest = list.find((e) => e?.id != null && !prev.has(String(e.id)));
      if (newest && prev.size > 0) {
        setSlamDone(false);
        setSlamEvent(newest);
      }
      previousIdsRef.current = new Set(list.map((e) => String(e.id)));
      setEvents(list);
    } catch (_) {}
  }, [marketFilter, agentEmail]);

  fetchRef.current = fetchSuccesses;

  useEffect(() => {
    fetchSuccesses();
    const interval = setInterval(() => fetchRef.current(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchSuccesses, pollIntervalMs]);

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel("recent-connects-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "twilio_call_logs" }, () => fetchRef.current())
      .subscribe(() => {});
    return () => { if (supabase) supabase.removeChannel(ch); };
  }, []);

  if (refetchRef) refetchRef.current = fetchSuccesses;

  // Filter pages based on availability (queue only if queuePosition provided)
  const availablePages = PAGE_CONFIG;
  const effectivePageIndex = Math.min(pageIndex, availablePages.length - 1);
  const page = availablePages[effectivePageIndex];
  const PageIcon = page.icon;

  // Adjust page index if queue was removed and we're past the available pages
  useEffect(() => {
    const availablePages = PAGE_CONFIG;
    if (pageIndex >= availablePages.length) {
      setPageIndex(0);
    }
  }, [pageIndex, queuePosition]);

  // Both connectsOnly and full mode now render the same live queue panel
  const showPosRow =
    queueMarket != null &&
    queueMarket !== '' &&
    typeof queuePosition === 'number';

  return (
    <div className="shrink-0 w-full border-t border-white/10 bg-black/40 flex flex-col overflow-hidden min-h-[200px] h-[min(280px,36dvh)] max-h-[min(360px,45dvh)]">

      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 flex-wrap">
        <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
        <span className="text-[10px] font-black tracking-widest uppercase text-cyan-400 shrink-0">Live Queue</span>
        <span className="text-[10px] text-purple-400 font-bold shrink-0">🤖 {stageCounts.ai}</span>
        <span className="text-[10px] text-amber-400 font-bold shrink-0">⏳ {stageCounts.queued}</span>
        <span className="text-[10px] text-cyan-400 font-bold shrink-0">📲 {stageCounts.ringing}</span>
        <span className="text-[10px] text-red-400 font-bold shrink-0">🚫 {stageCounts.no_agent}</span>
        {connectedCalls.length > 0 && (
          <span className="text-[10px] text-emerald-400 font-bold shrink-0">✅ {connectedCalls.length}</span>
        )}
      </div>

      {showPosRow && (
        <div className="flex items-center gap-2 px-3 pb-1.5 flex-wrap min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-white/45 shrink-0">Your rank</span>
          <span className="text-[11px] font-black tabular-nums text-amber-300">
            {queuePosition > 0 ? `#${queuePosition}` : '—'}
            {totalInMarket != null && totalInMarket > 0 && queuePosition > 0 ? (
              <span className="text-white/35 font-semibold text-[10px]"> / {totalInMarket}</span>
            ) : null}
          </span>
          <span className="text-[9px] text-purple-300/80 truncate max-w-[100px]" title={queueMarket}>
            {queueMarket}
          </span>
        </div>
      )}

      <div className="h-px bg-gradient-to-r from-purple-500 to-cyan-500 mx-3 mb-1.5 rounded-full" />

      {/* scrollable active feed */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2">
        <div className="flex flex-col gap-0.5">
          {queueFeed.length === 0 && missedFeed.length === 0 ? (
            <p className="text-[11px] text-white/40 italic px-1.5 pt-1">Queue activity will appear here live.</p>
          ) : (
            <AnimatePresence initial={false}>
              {queueFeed.map(item => <QueueRow key={item.leadId} item={item} />)}
            </AnimatePresence>
          )}
          {/* Missed transfer feed */}
          {missedFeed.length > 0 && (
            <>
              <div className="text-[9px] font-bold uppercase tracking-wider text-red-400/70 px-1.5 pt-1">❌ Missed</div>
              {missedFeed.map(m => (
                <div key={`${m.phone}-${m.missedAt}`} className="flex flex-col gap-0.5 px-1.5 py-0.5 rounded bg-red-500/5">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-bold text-red-400/80">{m.leadName || m.phone}</span>
                    {m.leadState && <span className="text-[9px] text-red-400/50">{m.leadState}</span>}
                    {m.market && <span className="text-[9px] text-white/30">{shortMarket(m.market)}</span>}
                    {(m.ringCycles ?? 1) > 1 && <span className="text-[9px] text-red-400 font-bold ml-auto">{m.ringCycles}×</span>}
                    <span className="text-[9px] text-white/25 ml-auto">{new Date(m.missedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {m.missedBy?.map((n, i) => (
                    <span key={i} className="text-[10px] text-red-400/70 pl-2">👻 {n.split(' ')[0]}</span>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* connected calls — pinned at bottom, never scroll away */}
      {connectedCalls.length > 0 && (
        <div className="shrink-0 border-t border-emerald-500/20 px-2 pb-1 pt-0.5 flex flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {connectedCalls.map(item => <QueueRow key={`${item.leadId}-connected`} item={item} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
