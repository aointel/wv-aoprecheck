"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";

const ROTATE_MS = 4000;

interface TransferItem {
  market: string;
  state: string;
  agentName: string;
  commission: number;
}

interface InboundTransfersMarqueeProps {
  onFindOutMore: () => void;
}

export function InboundTransfersMarquee({ onFindOutMore }: InboundTransfersMarqueeProps) {
  const [index, setIndex] = useState(0);

  const { data } = useQuery({
    queryKey: ["/api/inbound-transfers/recent"],
    queryFn: async () => {
      const res = await fetch("/api/inbound-transfers/recent");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 60 * 1000,
  });

  const items: TransferItem[] = data?.items ?? [];

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [items.length]);

  const current = items.length ? items[index] : null;

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 max-w-md text-xs">
      <span className="text-white/90 font-medium whitespace-nowrap shrink-0">
        INBOUND TRANSFER
      </span>
      {current ? (
        <span className="text-white font-semibold truncate min-w-0">
          {current.market} {current.state} → {current.agentName} · Est. ${current.commission}
        </span>
      ) : (
        <span className="text-white/70">No recent transfers</span>
      )}
      <button
        type="button"
        onClick={onFindOutMore}
        className="shrink-0 text-white/90 hover:text-white underline font-medium flex items-center gap-1"
      >
        <Info className="w-3 h-3" />
        Find out more
      </button>
    </div>
  );
}
