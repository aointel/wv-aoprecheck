import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle, ChevronLeft, ChevronRight, GraduationCap, X } from "lucide-react";

export interface WalkthroughStep {
  title: string;
  description: string;
  bullets?: string[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  videoUrl?: string;
  videoPoster?: string;
}

interface PageWalkthroughProps {
  storageKey: string;
  steps: WalkthroughStep[];
  autoOpenDelayMs?: number;
  triggerLabel?: string;
  triggerClassName?: string;
  showTrigger?: boolean;
  onComplete?: () => void;
}

export function PageWalkthrough({
  storageKey,
  steps,
  autoOpenDelayMs = 600,
  triggerLabel = "Show walkthrough",
  triggerClassName,
  showTrigger = true,
  onComplete,
}: PageWalkthroughProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStoredStatus, setHasStoredStatus] = useState(false);

  const totalSteps = useMemo(() => steps.length, [steps]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "completed" || stored === "dismissed") {
      setHasStoredStatus(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setCurrentStep(0);
      setOpen(true);
    }, autoOpenDelayMs);
    return () => window.clearTimeout(timer);
  }, [storageKey, autoOpenDelayMs]);

  const persistStatus = (status: "completed" | "dismissed") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, status);
    }
    setHasStoredStatus(true);
    if (status === "completed") {
      onComplete?.();
    }
  };

  const handleClose = (status: "completed" | "dismissed") => {
    persistStatus(status);
    setOpen(false);
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((step) => step + 1);
    } else {
      handleClose("completed");
    }
  };

  const handlePrev = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleManualClose = () => {
    handleClose("dismissed");
  };

  const current = steps[currentStep];
  const progressValue = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return (
    <>
      {showTrigger && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "inline-flex items-center gap-2 border-blue-200/60 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-200 dark:hover:bg-blue-900/40",
            triggerClassName
          )}
          onClick={() => {
            setCurrentStep(0);
            setOpen(true);
          }}
        >
          <GraduationCap className="h-4 w-4" />
          {triggerLabel}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => (!next ? handleManualClose() : setOpen(true))}>
        <DialogContent className="max-w-3xl overflow-hidden border-none p-0 shadow-2xl">
          <div className="relative bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(168,85,247,0.2),_transparent_60%)]" />

            <div className="relative flex items-start justify-between px-6 pt-6">
              <div className="text-xs uppercase tracking-[0.35em] text-blue-200/70">
                Step {currentStep + 1} of {totalSteps}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleManualClose}
                className="h-9 w-9 text-blue-200 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative grid gap-0 md:grid-cols-[1.2fr_1fr]">
              <div className="space-y-6 px-6 pb-8 pt-4 md:px-10 md:pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <GraduationCap className="h-5 w-5 text-blue-200" />
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">{current.title}</h2>
                </div>
                <p className="text-base leading-relaxed text-blue-100/90">{current.description}</p>

                {current.bullets && current.bullets.length > 0 && (
                  <ul className="space-y-3 text-sm text-blue-100/90">
                    {current.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-300" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {current.ctaLabel && current.onCtaClick && (
                  <Button
                    size="sm"
                    className="bg-white/15 text-white hover:bg-white/25"
                    onClick={() => current.onCtaClick?.()}
                  >
                    {current.ctaLabel}
                  </Button>
                )}

                <div className="space-y-3">
                  <Progress value={progressValue} className="h-2 bg-white/10" />
                  <div className="text-xs text-blue-200/80">
                    {currentStep + 1 === totalSteps
                      ? "Finish the tour to mark this walkthrough as complete."
                      : "Keep advancing to unlock the next tips."}
                  </div>
                </div>
              </div>

              {current.videoUrl ? (
                <div className="relative flex items-center justify-center bg-white/5 px-6 pb-8 pt-6 md:px-6">
                  <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                    <video
                      controls
                      playsInline
                      poster={current.videoPoster}
                      className="aspect-video h-full w-full bg-black object-cover"
                    >
                      <source src={current.videoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              ) : (
                <div className="hidden items-center justify-center bg-white/5 md:flex">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
                    <GraduationCap className="h-10 w-10 text-blue-200" />
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex flex-col gap-3 border-t border-white/10 bg-slate-950/85 px-6 py-4 text-sm text-blue-100/80 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle
                  className={cn("h-4 w-4", currentStep + 1 === totalSteps ? "text-emerald-400" : "text-blue-300")}
                />
                <span>
                  {currentStep + 1 === totalSteps
                    ? "Finish to mark this walkthrough as complete."
                    : "You can revisit this tour anytime from the walkthrough button."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualClose}
                  className="text-blue-200 hover:bg-white/10 hover:text-white"
                >
                  Skip
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentStep === 0}
                    onClick={handlePrev}
                    className="border-white/20 text-blue-200 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleNext}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-400 hover:to-purple-500"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

