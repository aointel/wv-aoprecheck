"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Phone, TrendingUp, Users, DollarSign, Play } from "lucide-react";

const VIDEO_URL = import.meta.env.VITE_INBOUND_EXPLAINER_VIDEO_URL || "";

interface InboundTransfersExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export function InboundTransfersExplainerModal({
  isOpen,
  onClose,
  userEmail,
}: InboundTransfersExplainerModalProps) {
  const { data: stats } = useQuery({
    queryKey: ["/api/inbound-transfers/stats"],
    queryFn: async () => {
      const res = await fetch("/api/inbound-transfers/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: opportunity } = useQuery({
    queryKey: ["/api/inbound-transfers/my-opportunity", userEmail],
    queryFn: async () => {
      const res = await fetch(
        `/api/inbound-transfers/my-opportunity?email=${encodeURIComponent(userEmail || "")}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch opportunity");
      return res.json();
    },
    enabled: isOpen && !!userEmail,
  });

  const inboundCalls = stats?.inboundCalls ?? 0;
  const transfersCompleted = stats?.transfersCompleted ?? 0;
  const agentsPaid = stats?.agentsPaid ?? 0;
  const estimatedCommission = stats?.estimatedCommissionGenerated ?? 0;
  const avgOpportunities = opportunity?.avgInboundCallsPerDay ?? 0;
  const marketsEnabled = opportunity?.marketsEnabled ?? [];
  const estimatedPerDay = opportunity?.estimatedCommissionPerDay ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Phone className="h-5 w-5" />
            Inbound Transfers
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Live clients ready to buy. Our AI agents speak with incoming clients and connect them to licensed specialists when they are ready. If you enable inbound transfers, you can receive these live opportunities.
          </p>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <p className="font-semibold text-foreground">Last 24 Hours</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 text-blue-500" />
                Inbound Calls: <span className="font-semibold text-foreground">{inboundCalls}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Transfers Completed: <span className="font-semibold text-foreground">{transfersCompleted}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4 text-amber-500" />
                Agents Paid: <span className="font-semibold text-foreground">{agentsPaid}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4 text-green-500" />
                Est. Commission: <span className="font-semibold text-foreground">${estimatedCommission.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {VIDEO_URL && (
            <div className="rounded-lg overflow-hidden border aspect-video bg-muted/30">
              <iframe
                title="Inbound transfers explainer"
                src={VIDEO_URL}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {!VIDEO_URL && (
            <div className="rounded-lg border bg-muted/30 aspect-video flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Play className="w-5 h-5" />
              Explainer video (60–90 sec) can be embedded here via VITE_INBOUND_EXPLAINER_VIDEO_URL
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={onClose} className="w-full">
              Start Receiving Live Transfers
            </Button>
            <p className="text-muted-foreground text-xs text-center">
              Average opportunities in your markets today: <span className="font-medium text-foreground">{avgOpportunities}</span>
            </p>
          </div>

          {marketsEnabled.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Your Potential</p>
              <p>Markets: {marketsEnabled.slice(0, 5).join(", ")}{marketsEnabled.length > 5 ? "…" : ""}</p>
              <p>Avg inbound calls/day: {avgOpportunities}</p>
              <p>Est. commission opportunity: ${estimatedPerDay.toFixed(0)}/day</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
