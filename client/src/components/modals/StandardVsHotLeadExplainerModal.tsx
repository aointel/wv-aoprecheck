'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown, Flame, Layers, ArrowRight, Video, Play, Pause, Sparkles, Box } from 'lucide-react';

export const EXPLAINER_LOCALSTORAGE_KEY = 'ccpro_standard_hotlead_explainer_seen';

const CCPRO_VIDEO_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/micahel_s%20Video%20-%20Dec%2013%2C%202025-VEED.mp4';

/** Seconds user must stay on video slide (countdown) before advancing. */
const VIDEO_WATCH_SECONDS = 50;

export interface StandardVsHotLeadExplainerModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

interface TextSlide {
  id: string;
  title: string;
  subtitle: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

const TEXT_SLIDES: TextSlide[] = [
  {
    id: 'intro',
    title: 'Standard AO Queue vs Hot Lead Queue',
    subtitle: 'Choose the right queue for you',
    content: (
      <div className="rounded-xl border-2 border-blue-200/80 dark:border-blue-800/80 bg-gradient-to-br from-blue-50/80 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/20 p-6 shadow-sm">
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          In Call Connector Pro, you can switch between two lead queues: <strong className="text-gray-900 dark:text-white">Standard AO Queue</strong> and <strong className="text-gray-900 dark:text-white">Hot Lead Queue</strong>.
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          This short overview explains the differences so you can use the right queue for your workflow.
        </p>
      </div>
    ),
  },
  {
    id: 'standard',
    title: 'Standard AO Queue',
    subtitle: 'Traditional AO leads',
    icon: Layers,
    content: (
      <div className="space-y-4 text-left">
        <ul className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">1</span>
            <span>Receive <strong className="text-gray-900 dark:text-white">Standard AO Queue</strong> leads from the main AO queue</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">2</span>
            <span><strong className="text-gray-900 dark:text-white">No AOI online status required</strong> — dial without being online with AO Intel</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">3</span>
            <span>Best when you want to work at your own pace or aren’t taking inbound</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">4</span>
            <span>Same lead source and crediting as standard AO instant lead-out</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'hotlead',
    title: 'Hot Lead Queue',
    subtitle: 'AI-curated hot leads',
    icon: Flame,
    content: (
      <div className="space-y-4 text-left">
        <ul className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 text-sm font-semibold">1</span>
            <span><strong className="text-gray-900 dark:text-white">AI-curated hot leads</strong> — warmer, higher-intent leads and recent interactions</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 text-sm font-semibold">2</span>
            <span>When you’re <strong className="text-gray-900 dark:text-white">online with AO Intel</strong>, you get exclusive access to this queue</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 text-sm font-semibold">3</span>
            <span>Best for producers who are live on AO Intel and ready for higher-intent leads</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 text-sm font-semibold">4</span>
            <span>Same crediting and transfer process as Standard; different lead source</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'compare',
    title: 'Quick comparison',
    subtitle: 'Choose before you dial',
    content: (
      <div className="space-y-4 text-left">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 p-5 shadow-sm">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <Layers className="h-5 w-5" /> Standard AO Queue
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">No online required • Standard AO leads • Dial anytime</p>
          </div>
          <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20 p-5 shadow-sm">
            <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
              <Flame className="h-5 w-5" /> Hot Lead Queue
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">Online with AO Intel • AI hot leads • Warmer, higher-intent</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Switch between Standard and Hot Lead any time using the toggle in Call Connector Pro.
        </p>
      </div>
    ),
  },
  {
    id: 'coming-soon',
    title: 'Coming soon',
    subtitle: 'Plus Lead Access & My Leads',
    icon: Sparkles,
    content: (
      <div className="space-y-6 text-left">
        <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 p-5 shadow-sm">
          <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Coming Soon: Plus Lead Access
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Plus Lead access is on the way. Stay tuned.
          </p>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 p-5 shadow-sm">
          <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-2">
            <Box className="h-5 w-5" /> My Leads
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Sync your Planet lead boxes to Call Connector Pro! Your lists, your way — all in one place.
          </p>
        </div>
      </div>
    ),
  },
];

const TOTAL_SLIDES = 1 + TEXT_SLIDES.length; // video + text slides

export function StandardVsHotLeadExplainerModal({
  isOpen,
  onComplete,
  onClose,
}: StandardVsHotLeadExplainerModalProps) {
  const [slide, setSlide] = useState(0);
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(VIDEO_WATCH_SECONDS);
  const [slideScrolledToBottom, setSlideScrolledToBottom] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isVideoSlide = slide === 0;
  const isFirst = slide === 0;
  const isLast = slide === TOTAL_SLIDES - 1;
  const textSlide = slide > 0 ? TEXT_SLIDES[slide - 1] : null;
  const Icon = textSlide?.icon;

  const timerDone = secondsRemaining <= 0;
  const timerProgress = Math.min(100, ((VIDEO_WATCH_SECONDS - secondsRemaining) / VIDEO_WATCH_SECONDS) * 100);
  const canAdvanceFromVideo = videoStarted && timerDone;
  const canAdvanceFromTextSlide = slideScrolledToBottom;
  const nextDisabled = (isVideoSlide && !canAdvanceFromVideo) || (!isVideoSlide && !canAdvanceFromTextSlide);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const checkScrollPosition = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isVideoSlide) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setSlideScrolledToBottom(true);
      return;
    }
    const remaining = scrollHeight - scrollTop - clientHeight;
    setSlideScrolledToBottom(remaining <= 50);
  }, [isVideoSlide]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isOpen || !isVideoSlide) return;
    const handlePlay = () => {
      setVideoStarted(true);
      setVideoPaused(false);
    };
    const handlePause = () => setVideoPaused(true);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isOpen, isVideoSlide]);

  useEffect(() => {
    if (!isOpen || !isVideoSlide || !videoStarted) return;
    const id = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, isVideoSlide, videoStarted]);

  useEffect(() => {
    if (isOpen) {
      setSlide(0);
      setVideoStarted(false);
      setVideoPaused(true);
      setSecondsRemaining(VIDEO_WATCH_SECONDS);
      setSlideScrolledToBottom(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSlideScrolledToBottom(false);
    const t = setTimeout(checkScrollPosition, 50);
    const t2 = setTimeout(checkScrollPosition, 300);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [slide, isOpen, checkScrollPosition]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setTimeout(checkScrollPosition, 100);
    setTimeout(checkScrollPosition, 600);
  }, [checkScrollPosition]);

  useEffect(() => {
    if (!isOpen || isVideoSlide) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const onResize = () => checkScrollPosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, isVideoSlide, checkScrollPosition]);

  const goNext = useCallback(() => {
    if (nextDisabled) return;
    if (isLast) {
      try {
        localStorage.setItem(EXPLAINER_LOCALSTORAGE_KEY, 'true');
      } catch (_) {}
      onComplete();
    } else {
      setSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
    }
  }, [isLast, nextDisabled, onComplete]);

  const goPrev = useCallback(() => {
    if (isFirst && onClose) {
      onClose();
    } else {
      setSlide((s) => Math.max(s - 1, 0));
    }
  }, [isFirst, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && !nextDisabled) goNext();
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'Escape' && onClose) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 z-[9998]"
        onKeyDown={handleKeyDown}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (onClose) {
            onClose();
            e.preventDefault();
          }
        }}
      >
        {/* Primer-style gradient header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 px-6 py-5 text-white flex-shrink-0 shadow-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
              {isVideoSlide ? (
                <>
                  <Video className="w-8 h-8" />
                  Try Call Connector Pro
                </>
              ) : (
                <>
                  {Icon && <Icon className="w-8 h-8" />}
                  {textSlide?.title}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-blue-100 mt-1">
              {isVideoSlide
                ? 'Watch this quick video to learn about Call Connector Pro'
                : textSlide?.subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0 p-6"
          onScroll={checkScrollPosition}
        >
          {isVideoSlide ? (
            <div className="space-y-4">
              <div className="bg-black rounded-xl overflow-hidden relative aspect-video shadow-xl ring-1 ring-black/20">
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain cursor-pointer"
                  playsInline
                  preload="auto"
                  onError={(e) => console.error('Video failed to load:', e)}
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (videoPaused) v.play().catch(() => {});
                    else v.pause();
                  }}
                >
                  <source src={CCPRO_VIDEO_URL} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                {!videoStarted && (
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-blue-600/85 to-purple-600/85 flex items-center justify-center cursor-pointer hover:from-blue-700/90 hover:to-purple-700/90 transition-all z-10"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        if (videoRef.current) {
                          await videoRef.current.play();
                          setVideoStarted(true);
                        }
                      } catch (err) {
                        console.error('Error playing video:', err);
                      }
                    }}
                  >
                    <div className="text-center text-white">
                      <Play className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-xl font-semibold">Click to start the video</p>
                      <p className="text-sm mt-2 text-blue-100">Learn about Call Connector Pro</p>
                    </div>
                  </div>
                )}
                {videoStarted && (
                  <>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-900/80 pointer-events-none">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 transition-all duration-300 rounded-r"
                        style={{ width: `${timerProgress}%` }}
                      />
                    </div>
                    <div
                      className="absolute top-2 right-2 flex items-center gap-2 rounded-xl border border-white/20 bg-gradient-to-r from-blue-600/90 to-purple-600/90 px-3 py-2 text-white text-sm shadow-lg backdrop-blur-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={videoPaused ? 'Play' : 'Pause'}
                        className="hover:bg-white/20 rounded p-1"
                        onClick={() => {
                          const v = videoRef.current;
                          if (!v) return;
                          if (videoPaused) v.play().catch(() => {});
                          else v.pause();
                        }}
                      >
                        {videoPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                      </button>
                      <span className="tabular-nums">
                        {timerDone ? '0:00 · continue' : `${formatTime(secondsRemaining)} left`}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {nextDisabled && videoStarted && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                    {timerDone ? 'You can continue' : `Wait ${formatTime(secondsRemaining)} to continue`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-w-2xl">{textSlide?.content}</div>
              {!slideScrolledToBottom && (
                <div className="rounded-xl border-2 border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 shadow-sm">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-3 flex items-center justify-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    Scroll to the bottom of this slide to continue
                  </p>
                  <Button
                    type="button"
                    onClick={scrollToBottom}
                    size="sm"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-sm"
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Scroll to bottom
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Slide dots */}
        <div className="flex items-center justify-center gap-2.5 py-4 flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => {
            const skipBlocked = nextDisabled && i > slide;
            return (
              <button
                key={i}
                type="button"
                aria-label={skipBlocked ? `Complete this slide to continue` : `Go to slide ${i + 1}`}
                onClick={() => !skipBlocked && setSlide(i)}
                disabled={skipBlocked}
                className={`h-2.5 rounded-full transition-all ${
                  i === slide
                    ? 'w-7 bg-gradient-to-r from-blue-600 to-purple-600 shadow-sm'
                    : 'w-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                } ${skipBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
              />
            );
          })}
        </div>

        <DialogFooter className="flex-row justify-between px-6 pb-6 pt-4 flex-shrink-0 border-t-0 gap-4">
          <Button
            variant="outline"
            onClick={goPrev}
            size="lg"
            className="border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {isFirst ? 'Close' : 'Previous'}
          </Button>
          <Button
            onClick={goNext}
            disabled={nextDisabled}
            size="lg"
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none shadow-md"
          >
            {isLast ? (
              <>
                Continue to disclaimer
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>

        <p className="text-center text-xs text-muted-foreground pb-4 flex-shrink-0">
          Slide {slide + 1} of {TOTAL_SLIDES} · ← → to navigate
        </p>
      </DialogContent>
    </Dialog>
  );
}
