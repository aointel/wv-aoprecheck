"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { X, Trophy, Sparkles, ChevronRight, CheckCircle, Star, Gem, Crown, Award, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
// CCProRank type defined locally

type CCProRankType = "gold" | "platinum" | "diamond" | "blue-diamond";

interface TierInfo {
  id: CCProRankType;
  name: string;
  threshold: number;
  description: string;
  advantages: string[];
}

interface CCProRankData {
  rank: CCProRankType;
  weeklyALP: number;
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

const RANK_ORDER: CCProRankType[] = ["gold", "platinum", "diamond", "blue-diamond"];

const RANK_COLORS: Record<CCProRankType, { text: string; gradient: string; glow: string; bg: string; borderWidth: string; animation: string }> = {
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

function HexagonalBadge({ rank, className, size = "w-24 h-24" }: { rank: CCProRankType; className?: string; size?: string }) {
  const colors = RANK_COLORS[rank];
  const iconSize = "w-full h-full";
  
  // Map rank to icon component
  let IconComponent: React.ComponentType<{ className?: string }>;
  let additionalEffects = "";
  
  switch (rank) {
    case 'gold':
      IconComponent = Shield;
      // Basic gold, no extra effects
      break;
    case 'platinum':
      IconComponent = Shield;
      // Silvery with shine effects
      additionalEffects = "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite]";
      break;
    case 'diamond':
      IconComponent = Gem;
      // Regular diamond with pulse
      break;
    case 'blue-diamond':
      IconComponent = Gem;
      // Shinier, bluer with more effects
      additionalEffects = "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-blue-300/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-blue-400/20 after:animate-pulse";
      break;
  }
  
  return (
    <div className={cn(
      "rounded-lg flex items-center justify-center shrink-0 relative",
      `bg-gradient-to-br ${colors.gradient}`,
      colors.glow,
      colors.borderWidth,
      colors.animation,
      "p-2 shadow-lg",
      additionalEffects,
      size,
      className
    )}>
      <IconComponent className={cn(iconSize, "text-white relative z-10")} />
    </div>
  );
}

export default function RankBattlePass() {
  const { authState } = useAuth();
  const userEmail = authState?.user?.email;
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<CCProRankData>({
    queryKey: ["/api/ccpro/rank", userEmail],
    queryFn: async () => {
      if (!userEmail) {
        throw new Error("No user email");
      }
      const res = await fetch(`/api/ccpro/rank?agentEmail=${encodeURIComponent(userEmail)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch CCPro rank: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!userEmail,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading rank data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Failed to load rank data</div>
      </div>
    );
  }

  const { rank, weeklyALP, progressToNext, nextTier, currentTier, allTiers } = data;
  const colors = RANK_COLORS[rank];
  const currentIndex = RANK_ORDER.indexOf(rank);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Trophy className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold">AO Intel Rank System</h1>
              <p className="text-sm text-slate-400">Your production journey</p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/connect")}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Current Rank Display */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-6 mb-6">
            <HexagonalBadge rank={rank} size="w-32 h-32" />
            <div className="text-left">
              <h2 className={cn("text-4xl font-bold mb-2", colors.text)}>
                {currentTier.name}
              </h2>
              <p className="text-xl text-slate-300 mb-1">
                Weekly ALP: <span className={cn("font-bold", colors.text)}>${weeklyALP.toLocaleString()}</span>
              </p>
              <p className="text-sm text-slate-400">{currentTier.description}</p>
            </div>
          </div>

          {/* Progress to Next Tier */}
          {nextTier && (
            <div className="max-w-2xl mx-auto bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-lg font-semibold text-slate-300">
                    Progress to <span className={cn("font-bold", RANK_COLORS[nextTier.name.toLowerCase().replace(' ', '-') as CCProRankType]?.text || "text-slate-200")}>{nextTier.name}</span>
                  </span>
                  <p className="text-sm text-slate-400 mt-1">
                    ${(nextTier.threshold - weeklyALP).toLocaleString()} more needed
                  </p>
                </div>
                <span className={cn("text-3xl font-bold", colors.text)}>
                  {progressToNext}%
                </span>
              </div>
              <div className="w-full h-4 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    `bg-gradient-to-r ${colors.gradient}`
                  )}
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Horizontal Battle Pass - All Tiers */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            Rank Progression
          </h3>
          <div className="flex items-start gap-6 overflow-x-auto pb-4">
            {allTiers.map((tier, index) => {
              const isCurrent = tier.id === rank;
              const isUnlocked = currentIndex >= index;
              const isNext = index === currentIndex + 1;
              const tierColors = RANK_COLORS[tier.id];
              const progressToThisTier = index === currentIndex + 1 ? progressToNext : (isUnlocked ? 100 : 0);

              return (
                <div
                  key={tier.id}
                  className={cn(
                    "flex flex-col items-center gap-4 p-6 rounded-xl transition-all cursor-pointer group min-w-[200px] shrink-0",
                    "hover:scale-105 hover:shadow-2xl",
                    isCurrent
                      ? `bg-gradient-to-b ${tierColors.gradient} border-2 ${tierColors.glow} shadow-2xl`
                      : isUnlocked
                      ? "bg-slate-800/60 border-2 border-slate-600/50 hover:border-slate-500/70"
                      : "bg-slate-900/60 border-2 border-slate-800/40 opacity-70 hover:opacity-90"
                  )}
                >
                  <div className="relative">
                    <HexagonalBadge 
                      rank={tier.id} 
                      size="w-28 h-28"
                      className={!isUnlocked ? "opacity-50 grayscale" : ""}
                    />
                    {isCurrent && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {isNext && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full border-2 border-slate-900 animate-pulse flex items-center justify-center">
                        <span className="text-xs text-white font-bold">→</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center w-full">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className={cn(
                        "text-xl font-bold",
                        isCurrent ? "text-white" : isUnlocked ? "text-slate-200" : "text-slate-500"
                      )}>
                        {tier.name}
                      </span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-semibold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm font-medium mb-3",
                      isCurrent ? "text-white/80" : isUnlocked ? "text-slate-400" : "text-slate-600"
                    )}>
                      ${tier.threshold.toLocaleString()}+ weekly ALP
                    </p>
                    {isNext && (
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
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

        {/* Tier Benefits */}
        <div className="bg-slate-800/30 rounded-xl p-8 border border-slate-700/50">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
            {currentTier.name} Tier Benefits
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {currentTier.advantages.map((advantage, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 text-sm text-slate-200 bg-slate-800/50 hover:bg-slate-800/70 rounded-lg p-4 transition-colors cursor-default group"
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  rank === 'gold' ? "bg-amber-500/20 group-hover:bg-amber-500/30" :
                  rank === 'platinum' ? "bg-slate-500/20 group-hover:bg-slate-500/30" :
                  rank === 'diamond' ? "bg-purple-500/20 group-hover:bg-purple-500/30" :
                  "bg-blue-500/20 group-hover:bg-blue-500/30"
                )}>
                  <ChevronRight className={cn(
                    "w-4 h-4",
                    rank === 'gold' ? "text-amber-400" :
                    rank === 'platinum' ? "text-slate-300" :
                    rank === 'diamond' ? "text-purple-400" :
                    "text-blue-400"
                  )} />
                </div>
                <span className="flex-1 leading-relaxed">{advantage}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
