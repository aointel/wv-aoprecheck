"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Sparkles, ChevronRight, Loader2, Star, Gem, Crown, Trophy, CheckCircle, Shield } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { segmentedFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

type CCProRank = "gold" | "platinum" | "diamond" | "blue-diamond";

interface TierInfo {
  id: CCProRank;
  name: string;
  threshold: number;
  description: string;
  advantages: string[];
}

interface CCProRankData {
  rank: CCProRank;
  weeklyALP: number;
  rolling21DayALP?: number;
  averageWeeklyALP?: number;
  leadMix?: Record<string, number>;
  calculatedAt?: string;
  progressToNext: number;
  nextTier?: {
    name: string;
    threshold: number;
    description: string;
    progressPct: number;
  };
  currentTier: TierInfo;
  allTiers: TierInfo[];
}

const RANK_ORDER: CCProRank[] = ["gold", "platinum", "diamond", "blue-diamond"];

const RANK_COLORS: Record<CCProRank, { text: string; gradient: string; glow: string; bg: string; borderWidth: string; animation: string }> = {
  gold: {
    text: "text-amber-200",
    gradient: "from-amber-400 via-yellow-500 to-amber-600",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.4)]",
    bg: "bg-amber-600/80",
    borderWidth: "border-2",
    animation: "",
  },
  platinum: {
    text: "text-slate-200",
    gradient: "from-slate-300 via-slate-400 to-slate-500",
    glow: "shadow-[0_0_16px_rgba(148,163,184,0.5)] ring-1 ring-slate-300/50",
    bg: "bg-slate-600/80",
    borderWidth: "border-2",
    animation: "",
  },
  diamond: {
    text: "text-cyan-200",
    gradient: "from-purple-400 via-indigo-500 to-purple-600",
    glow: "shadow-[0_0_20px_rgba(147,51,234,0.6)] ring-2 ring-purple-300/70",
    bg: "bg-cyan-600/80",
    borderWidth: "border-2",
    animation: "animate-pulse",
  },
  "blue-diamond": {
    text: "text-blue-200",
    gradient: "from-blue-400 via-indigo-500 to-blue-600",
    glow: "shadow-[0_0_28px_rgba(59,130,246,0.8)] ring-2 ring-blue-300/90",
    bg: "bg-blue-700/80",
    borderWidth: "border-3",
    animation: "animate-pulse",
  },
};

const RANK_CHIP_STYLES: Record<CCProRank, {
  accent: string;
  border: string;
  glow: string;
  iconBg: string;
  label: string;
}> = {
  gold: {
    accent: "from-amber-300 via-yellow-400 to-orange-500",
    border: "border-amber-300/45",
    glow: "shadow-[0_0_22px_rgba(245,158,11,0.22)]",
    iconBg: "bg-amber-400/15",
    label: "text-amber-100",
  },
  platinum: {
    accent: "from-slate-100 via-cyan-200 to-slate-500",
    border: "border-cyan-100/35",
    glow: "shadow-[0_0_22px_rgba(148,163,184,0.22)]",
    iconBg: "bg-cyan-100/10",
    label: "text-slate-100",
  },
  diamond: {
    accent: "from-fuchsia-300 via-violet-400 to-indigo-500",
    border: "border-violet-300/45",
    glow: "shadow-[0_0_26px_rgba(139,92,246,0.28)]",
    iconBg: "bg-violet-400/14",
    label: "text-violet-100",
  },
  "blue-diamond": {
    accent: "from-cyan-300 via-blue-400 to-indigo-500",
    border: "border-cyan-300/55",
    glow: "shadow-[0_0_30px_rgba(34,211,238,0.34)]",
    iconBg: "bg-cyan-300/14",
    label: "text-cyan-100",
  },
};

function BadgeIcon({ rank, className }: { rank: CCProRank; className?: string }) {
  const chip = RANK_CHIP_STYLES[rank];
  const label: Record<CCProRank, string> = {
    gold: "G",
    platinum: "P",
    diamond: "D",
    "blue-diamond": "BD",
  };

  return (
    <span
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-[28%] border bg-slate-950/95 font-black leading-none",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-90",
        "after:absolute after:inset-[18%] after:rounded-[24%] after:border after:border-white/15 after:bg-white/[0.03]",
        chip.border,
        chip.glow,
        className,
      )}
    >
      <span className={cn("absolute inset-0 bg-gradient-to-br", chip.accent)} />
      <span className="absolute inset-[3px] rounded-[24%] bg-slate-950/90" />
      <span className={cn("relative z-10 tracking-[-0.08em]", chip.label)}>
        {label[rank]}
      </span>
    </span>
  );
}

export function CCProRankBadge() {
  const { authState } = useAuth();
  const userEmail = authState?.user?.email;
  const [, setLocation] = useLocation();
  
  const { data, isLoading, error } = useQuery<CCProRankData>({
    queryKey: ["/api/ccpro/rank", userEmail],
    queryFn: async () => {
      if (!userEmail) {
        throw new Error("No user email");
      }
      const res = await fetch(`/api/ccpro/rank?agentEmail=${encodeURIComponent(userEmail)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ CCPro rank API error:", res.status, errorText);
        throw new Error(`Failed to fetch CCPro rank: ${res.status}`);
      }
      const result = await res.json();
      console.log("✅ CCPro rank data:", result);
      return result;
    },
    enabled: !!userEmail,
    refetchInterval: 60000, // 1 min — rank doesn't change that fast
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
  });

  const { data: dailyStats } = useQuery<{ total_dialed?: number; todayDialed?: number; reached?: number; booked?: number }>({
    queryKey: ["/api/outbound-dialer/daily-stats", userEmail],
    queryFn: async () => {
      if (!userEmail) return {};
      const res = await segmentedFetch(`/api/outbound-dialer/daily-stats?userEmail=${encodeURIComponent(userEmail)}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!userEmail,
    refetchInterval: 10000, // 10s — matches dialer, shows fresh counts
    staleTime: 5000,
  });

  // Default to Gold if no data or error
  const defaultRank: CCProRank = "gold";
  const defaultTier = {
    id: defaultRank,
    name: "Gold",
    threshold: 0,
    description: "The foundation of excellence. You've entered the ranks of dedicated producers, ready to build your legacy in the industry.",
    advantages: ["Access to Call Connector Pro", "Priority support and resources", "Foundation for growth"],
  };
  const defaultChip = RANK_CHIP_STYLES[defaultRank];

  // Show loading only briefly, then show default
  if (isLoading && !data) {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-full p-[1px] cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03]",
              "bg-gradient-to-r",
              defaultChip.accent,
              defaultChip.glow
            )}
            aria-label="Rank badge loading"
          >
            <span className={cn(
              "relative flex items-center gap-2 rounded-full border bg-slate-950/88 px-2.5 py-1.5 backdrop-blur-xl",
              defaultChip.border,
            )}>
              <span className={cn("absolute inset-x-2 top-0 h-px bg-gradient-to-r opacity-80", defaultChip.accent)} />
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-white/10", defaultChip.iconBg)}>
                <BadgeIcon rank={defaultRank} className="h-3.5 w-3.5 shrink-0" />
              </span>
              <span className={cn("text-[11px] font-black leading-none tracking-wide whitespace-nowrap", defaultChip.label)}>
                {defaultTier.name}
              </span>
              <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.75)]" />
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-96 p-0 overflow-hidden border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/70 backdrop-blur-xl">
          <div className={cn("h-1 w-full bg-gradient-to-r", defaultChip.accent)} />
          <div className="p-6 space-y-4 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_28%)]">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
              <div className={cn("relative rounded-2xl bg-gradient-to-br p-[2px]", defaultChip.accent)}>
                <div className="rounded-[14px] bg-slate-950 flex items-center justify-center p-3 ring-1 ring-white/10">
                  <BadgeIcon rank={defaultRank} className="w-10 h-10" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">AO Queue Rank</p>
                <h3 className={cn("text-2xl font-black tracking-tight", defaultChip.label)}>{defaultTier.name}</h3>
                <p className="text-sm text-slate-300">Loading...</p>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Use data if available, otherwise use default
  const rankData = data || {
    rank: defaultRank,
    weeklyALP: 0,
    rolling21DayALP: 0,
    averageWeeklyALP: 0,
    leadMix: { tier1: 10, tier2: 50, tier3: 40 },
    progressToNext: 0,
    currentTier: defaultTier,
    allTiers: [
      defaultTier,
      { id: "platinum" as CCProRank, name: "Platinum", threshold: 1000, description: "", advantages: [] },
      { id: "diamond" as CCProRank, name: "Diamond", threshold: 2000, description: "", advantages: [] },
      { id: "blue-diamond" as CCProRank, name: "Blue Diamond", threshold: 5000, description: "", advantages: [] },
    ],
  };

  const { rank, weeklyALP, rolling21DayALP, averageWeeklyALP, leadMix, progressToNext, nextTier, currentTier, allTiers } = rankData;
  const colors = RANK_COLORS[rank];
  const chip = RANK_CHIP_STYLES[rank];
  const currentIndex = RANK_ORDER.indexOf(rank);
  const displayWeeklyALP = averageWeeklyALP ?? weeklyALP;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className={cn(
            "group relative shrink-0 overflow-hidden rounded-full p-[1px] cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03]",
            "bg-gradient-to-r",
            chip.accent,
            chip.glow
          )}
          aria-label="Rank badge"
        >
          <span className={cn(
            "relative flex items-center gap-2 rounded-full border bg-slate-950/88 px-2.5 py-1.5 backdrop-blur-xl",
            chip.border,
          )}>
            <span className={cn("absolute inset-x-2 top-0 h-px bg-gradient-to-r opacity-80", chip.accent)} />
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-white/10", chip.iconBg)}>
              <BadgeIcon rank={rank} className="h-3.5 w-3.5 shrink-0" />
            </span>
            <span className={cn("text-[11px] font-black leading-none tracking-wide whitespace-nowrap", chip.label)}>
              {currentTier.name}
            </span>
            <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.75)]" />
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[600px] p-0 overflow-hidden border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/70 backdrop-blur-xl">
        <div className={cn("h-1 w-full bg-gradient-to-r", chip.accent)} />
        <div className="p-6 space-y-4 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_28%)]">
          {/* Current Rank Header - Shield + name left; production ALP top right with gradient bar under it */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-4">
              <div className={cn("relative rounded-2xl bg-gradient-to-br p-[2px]", chip.accent, rank === 'blue-diamond' && "animate-pulse")}>
                <div className="rounded-[14px] bg-slate-950 flex items-center justify-center p-3 ring-1 ring-white/10">
                  <BadgeIcon rank={rank} className="w-12 h-12" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">AO Queue Rank</p>
                <h3 className={cn("text-3xl font-black tracking-tight", chip.label)}>{currentTier.name}</h3>
              </div>
            </div>
            {/* Weekly average ALP - top right, larger, with gradient bar under it */}
            <div className="text-right shrink-0 min-w-[140px]">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                Weekly Avg ALP
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                ${displayWeeklyALP.toLocaleString()}
              </p>
              {nextTier && (
                <div className="mt-2 w-full">
                  <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 rounded-full bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700"
                      )}
                      style={{ width: `${Math.min(100, progressToNext)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {progressToNext}% to {nextTier.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm">
            <div className="text-slate-400 text-xs uppercase tracking-wide">21-Day ALP</div>
            <div className="text-white font-bold tabular-nums">${(rolling21DayALP ?? 0).toLocaleString()}</div>
          </div>

          {/* Dial / Reach / Booked tracked - above progress */}
          <div className="flex items-center gap-6 py-3 px-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Today</span>
            <div className="flex gap-6">
              <div>
                <span className="text-slate-500 text-xs block">Dial</span>
                <span className="text-lg font-bold text-blue-300 tabular-nums">
                  {(dailyStats?.total_dialed ?? dailyStats?.todayDialed) ?? 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Reach</span>
                <span className="text-lg font-bold text-amber-300 tabular-nums">
                  {dailyStats?.reached ?? 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Booked</span>
                <span className="text-lg font-bold text-emerald-300 tabular-nums">
                  {dailyStats?.booked ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Progress to Next Tier - text only (bar is in header) */}
          {nextTier && (
            <div className="text-sm text-slate-400">
              <span className="text-slate-300">Progress to {nextTier.name}:</span>{" "}
              <span className="font-medium text-white">${(nextTier.threshold - displayWeeklyALP).toLocaleString()} more weekly avg ALP needed</span>
            </div>
          )}

          {/* Horizontal Battle Pass - Tiers */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Rank Progression
            </h4>
            <div className="flex items-start gap-2 overflow-x-auto pb-2">
              {allTiers.map((tier, index) => {
                const isCurrent = tier.id === rank;
                const isUnlocked = currentIndex >= index;
                const isNext = index === currentIndex + 1;
                const tierColors = RANK_COLORS[tier.id as CCProRank];
                const progressToThisTier = index === currentIndex + 1 ? progressToNext : (isUnlocked ? 100 : 0);
                
                return (
                  <div
                    key={tier.id}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg transition-all cursor-pointer group min-w-[120px] shrink-0",
                      "hover:scale-105 hover:shadow-lg",
                      isCurrent
                        ? "bg-slate-800/80 border-2 border-slate-600 shadow-lg"
                        : isUnlocked
                        ? "bg-slate-800/60 border-2 border-slate-600/50 hover:border-slate-500/70"
                        : "bg-slate-900/60 border-2 border-slate-800/40 opacity-70 hover:opacity-90"
                    )}
                  >
                    <div className={cn(
                      "relative",
                      tier.id === 'blue-diamond' && isUnlocked && "animate-pulse"
                    )}>
                      {isCurrent ? (
                        <div className="p-[2px] rounded-lg bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700">
                          <div className="rounded-[6px] bg-slate-800 flex items-center justify-center p-1.5">
                            <Shield className="w-12 h-12 text-slate-300" />
                          </div>
                        </div>
                      ) : (
                        <div className={cn(
                          "relative",
                          isUnlocked && "ring-2 ring-slate-500/50 rounded-lg"
                        )}>
                          <BadgeIcon 
                            rank={tier.id as CCProRank} 
                            className={cn(
                              "w-14 h-14",
                              tier.id === 'blue-diamond' && isUnlocked && "drop-shadow-[0_0_15px_rgba(59,130,246,0.7)]"
                            )} 
                          />
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center z-20">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {isNext && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full border-2 border-slate-900 animate-pulse flex items-center justify-center z-20">
                          <span className="text-[10px] text-white font-bold">→</span>
                        </div>
                      )}
                    </div>
                    <div className="text-center w-full">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className={cn(
                          "text-sm font-bold",
                          isCurrent ? "text-white" : isUnlocked ? "text-slate-200" : "text-slate-500"
                        )}>
                          {tier.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-xs font-medium",
                        isCurrent ? "text-white/80" : isUnlocked ? "text-slate-400" : "text-slate-600"
                      )}>
                        ${tier.threshold.toLocaleString()}+
                      </p>
                      {isNext && (
                        <div className="mt-2 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-500 rounded-full",
                              `bg-gradient-to-r ${colors.gradient}`
                            )}
                            style={{ width: `${progressToThisTier}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </HoverCardContent>
    </HoverCard>
  );
}






