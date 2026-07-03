"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Lock, Sparkles, ChevronRight, ImagePlus, Loader2 } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

type Rank = "bronze" | "silver" | "gold" | "platinum";

interface TierInfo {
  id: Rank;
  name: string;
  requirements: string;
  advantages: string[];
}

interface RankData {
  rank: Rank;
  inputs: { production: number; plusLeads: number; callScore: number; aoiUsage: number };
  nextTier?: { name: string; requirements: string; progressPct: number };
  tiers: TierInfo[];
}

const RANK_ORDER: Rank[] = ["bronze", "silver", "gold", "platinum"];

const RANK_TEXT_ICON: Record<Rank, string> = {
  bronze: "text-amber-200",
  silver: "text-slate-200",
  gold: "text-amber-200",
  platinum: "text-blue-100",
};

const RANK_GRADIENT: Record<Rank, string> = {
  bronze: "from-amber-600/90 to-amber-900/90 border-amber-500/50 shadow-amber-600/30",
  silver: "from-slate-400/90 to-slate-600/90 border-slate-400/50 shadow-slate-500/30",
  gold: "from-amber-400/90 via-yellow-500/90 to-amber-600/90 border-amber-400/60 shadow-amber-500/40",
  platinum: "from-slate-200/95 via-blue-100/95 to-indigo-200/95 border-blue-300/60 shadow-blue-400/40",
};

const RANK_GLOW: Record<Rank, string> = {
  bronze: "shadow-[0_0_20px_rgba(217,119,6,0.4)] ring-2 ring-amber-400/60",
  silver: "shadow-[0_0_20px_rgba(148,163,184,0.4)] ring-2 ring-slate-300/60",
  gold: "shadow-[0_0_24px_rgba(245,158,11,0.5)] ring-2 ring-amber-300/70",
  platinum: "shadow-[0_0_24px_rgba(147,197,253,0.5)] ring-2 ring-blue-300/70",
};

function TierImage({ rank, isUnlocked, className }: { rank: Rank; isUnlocked: boolean; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const src = `/images/ranks/${rank}.png`;
  if (imgError || !isUnlocked) {
    return (
      <div
        className={cn(
          "rounded-lg flex items-center justify-center shrink-0",
          isUnlocked
            ? rank === "bronze"
              ? "bg-amber-800/80"
              : rank === "silver"
                ? "bg-slate-600/80"
                : rank === "gold"
                  ? "bg-amber-600/80"
                  : "bg-blue-400/80"
            : "bg-slate-700/80",
          className
        )}
      >
        {isUnlocked ? (
          <Award className={cn("w-8 h-8", rank === "platinum" ? "text-blue-100" : "text-white")} />
        ) : (
          <Lock className="w-8 h-8 text-slate-500" />
        )}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={rank}
      className={cn("rounded-lg object-cover shrink-0", className)}
      onError={() => setImgError(true)}
    />
  );
}

export function ProductionRankBadge() {
  const queryClient = useQueryClient();
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [generateMessage, setGenerateMessage] = useState("");

  const { data, isLoading } = useQuery<RankData>({
    queryKey: ["/api/outbound-dialer/rank"],
    queryFn: async () => {
      const res = await fetch("/api/outbound-dialer/rank");
      if (!res.ok) throw new Error("Failed to fetch rank");
      return res.json();
    },
    refetchInterval: 300000, // 5 min
    staleTime: 30000,
  });

  const rank = data?.rank ?? "bronze";
  const tiers = data?.tiers ?? [];
  const nextTier = data?.nextTier;
  const currentIndex = RANK_ORDER.indexOf(rank);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium cursor-help transition-all hover:scale-[1.02]",
            "bg-white/20 text-white hover:bg-white/30",
            RANK_TEXT_ICON[rank]
          )}
          role="button"
          tabIndex={0}
          aria-label={`Production rank: ${rank}. Hover for details.`}
        >
          {isLoading ? (
            <span className="animate-pulse">…</span>
          ) : (
            <>
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap capitalize">{rank}</span>
            </>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="center"
        sideOffset={8}
        className={cn(
          "w-[380px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto p-0 border-2 border-slate-700/80",
          "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950",
          "shadow-2xl shadow-black/50"
        )}
      >
        {/* Battle pass header */}
        <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-gradient-to-b from-slate-900 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-lg text-white tracking-tight">Production Rank</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Higher rank = higher priority on AOI Connects & AO Queue leads.
          </p>
          {nextTier && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Next: <span className="text-white font-medium">{nextTier.name}</span></span>
                <span className="text-amber-400 font-bold">{nextTier.progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${nextTier.progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tier track - battle pass style */}
        <div className="relative px-3 pb-4">
          {/* Vertical connector line (center of tier icons) */}
          <div className="absolute left-[3.25rem] top-4 bottom-4 w-0.5 bg-gradient-to-b from-amber-600/80 via-slate-500/60 to-slate-700/80 rounded-full" />

          {RANK_ORDER.map((tierId, index) => {
            const tier = tiers.find((t) => t.id === tierId) ?? {
              id: tierId,
              name: tierId.charAt(0).toUpperCase() + tierId.slice(1),
              requirements: "",
              advantages: [],
            };
            const isUnlocked = index <= currentIndex;
            const isCurrent = tierId === rank;

            return (
              <div
                key={tierId}
                className={cn(
                  "relative flex gap-4 py-3 px-3 rounded-xl border transition-all",
                  isCurrent
                    ? `bg-gradient-to-r ${RANK_GRADIENT[tierId]} border ${RANK_GLOW[tierId]}`
                    : isUnlocked
                      ? "bg-slate-800/60 border-slate-600/50 hover:bg-slate-800/80"
                      : "bg-slate-800/40 border-slate-700/50 opacity-80"
                )}
              >
                <div className="relative z-10 shrink-0">
                  <TierImage rank={tierId} isUnlocked={isUnlocked} className="w-14 h-14" />
                  {isCurrent && (
                    <div className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                      YOU
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-bold capitalize",
                      isCurrent ? "text-white" : isUnlocked ? "text-slate-200" : "text-slate-500"
                    )}>
                      {tier.name}
                    </span>
                    {isCurrent && <ChevronRight className="w-4 h-4 text-white/80 shrink-0" />}
                  </div>
                  <p className={cn(
                    "mt-0.5 text-[11px] leading-snug",
                    isCurrent ? "text-white/90" : "text-slate-400"
                  )}>
                    {tier.requirements}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {tier.advantages.map((adv, i) => (
                      <li
                        key={i}
                        className={cn(
                          "text-[11px] flex items-start gap-1.5",
                          isCurrent ? "text-amber-100/95" : "text-slate-500"
                        )}
                      >
                        <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
                        <span>{adv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Generate tier images (one-time setup via OpenAI) */}
        <div className="sticky bottom-0 px-3 py-2 border-t border-slate-700/80 bg-slate-900/95">
          <button
            type="button"
            onClick={async () => {
              setGenerateStatus("loading");
              setGenerateMessage("");
              try {
                const res = await fetch("/api/rank/generate-tier-images", { method: "POST" });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setGenerateStatus("error");
                  setGenerateMessage(json.details || json.error || "Request failed");
                  return;
                }
                setGenerateStatus("done");
                setGenerateMessage(json.errors?.length ? `Saved: ${(json.saved || []).join(", ")}. Issues: ${json.errors.join("; ")}` : `Saved: ${(json.saved || []).join(", ")}. Refresh to see images.`);
                queryClient.invalidateQueries({ queryKey: ["/api/outbound-dialer/rank"] });
              } catch (e) {
                setGenerateStatus("error");
                setGenerateMessage(e instanceof Error ? e.message : "Failed");
              }
            }}
            disabled={generateStatus === "loading"}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 text-xs font-medium disabled:opacity-50 transition-colors"
          >
            {generateStatus === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5" />
            )}
            <span>{generateStatus === "loading" ? "Generating…" : "Generate tier images (DALL-E)"}</span>
          </button>
          {(generateStatus === "done" || generateStatus === "error") && generateMessage && (
            <p className={cn("mt-1.5 text-[11px]", generateStatus === "error" ? "text-red-400" : "text-emerald-400")}>
              {generateMessage}
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
