"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Flame, Zap } from "lucide-react";

const STORAGE_KEY = "ao-queue-announcement-2025-02";

export function getAOQueueAnnouncementDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "dismissed";
}

export function setAOQueueAnnouncementDismissed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "dismissed");
}

interface AOQueueAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AOQueueAnnouncementModal({ isOpen, onClose }: AOQueueAnnouncementModalProps) {
  const handleGotIt = () => {
    setAOQueueAnnouncementDismissed();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleGotIt()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-blue-950/40 to-purple-950/40 dark:from-slate-950 dark:via-blue-950/60 dark:to-purple-950/60">
        {/* Subtle gradient mesh background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(251,146,60,0.08),transparent)] pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          <DialogHeader className="space-y-4">
            {/* Icon row */}
            <div className="flex justify-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <Rocket className="w-7 h-7 text-white" />
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Flame className="w-7 h-7 text-white" />
              </div>
            </div>

            <DialogTitle className="text-2xl sm:text-3xl font-bold text-center bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent tracking-tight">
              AO Queue is back!
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <p className="text-slate-200 dark:text-slate-300 text-center leading-relaxed">
              Select <span className="font-semibold text-white">AO Queue</span> and choose{" "}
              <span className="font-semibold text-blue-300">Standard</span> to receive standard AO Queue leads.
            </p>
            <div className="flex items-center justify-center gap-2 text-amber-400/90">
              <Zap className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium text-center">
                Use <span className="font-bold text-amber-300">Hot Lead</span> for AOI Curated Hot Leads.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleGotIt}
              className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 hover:from-orange-600 hover:via-orange-700 hover:to-red-700 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-200 hover:scale-[1.02]"
            >
              Got it — let&apos;s go
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
