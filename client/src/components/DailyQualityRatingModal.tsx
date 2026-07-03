import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Zap, Wifi, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  getPacificYmd,
  getQualityRatingLocalStorageKey,
} from '@/lib/quality-rating-prompt';
import { supabase } from '@/lib/supabase';

interface DailyQualityRatingModalProps {
  isOpen: boolean;
  userEmail: string;
  currentPath: string;
  onClose: () => void;
}

const RATING_CATEGORIES = [
  {
    key: 'connectionQuality' as const,
    label: 'Call Quality',
    hint: 'Were your calls clear? Any drops, echo, or audio issues?',
    icon: Wifi,
    iconColor: 'text-blue-500',
  },
  {
    key: 'applicationSpeed' as const,
    label: 'App Speed',
    hint: 'Did everything feel snappy? Screens, clicks, the dialer?',
    icon: Zap,
    iconColor: 'text-purple-500',
  },
  {
    key: 'platformSatisfaction' as const,
    label: 'Overall Experience',
    hint: 'How was your day on ConnectNow overall?',
    icon: ThumbsUp,
    iconColor: 'text-blue-500',
  },
] as const;

type RatingKey = (typeof RATING_CATEGORIES)[number]['key'];

function StarRow({
  label,
  hint,
  icon: Icon,
  iconColor,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  icon: React.ElementType;
  iconColor: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/60 via-purple-50/40 to-blue-50/60 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-blue-950/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 p-2 shrink-0">
          <Icon className="h-4 w-4 text-white" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{hint}</p>
          <div
            className="flex gap-1 mt-3"
            role="group"
            aria-label={`${label} rating`}
            onMouseLeave={() => setHovered(null)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${label}: ${n} star${n === 1 ? '' : 's'}`}
                aria-pressed={value === n}
                className={cn(
                  'rounded-md p-0.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                  display != null && n <= display
                    ? 'text-amber-500 scale-110'
                    : 'text-gray-300 dark:text-gray-600 hover:text-amber-400 hover:scale-110',
                )}
                onClick={() => onChange(n)}
                onMouseEnter={() => setHovered(n)}
              >
                <Star
                  className={cn(
                    'h-7 w-7 sm:h-8 sm:w-8 transition-all duration-150',
                    display != null && n <= display && 'fill-current drop-shadow-sm',
                  )}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          {value != null && (
            <p className="text-xs font-medium mt-1.5 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
              {value === 1 ? 'Poor' : value === 2 ? 'Fair' : value === 3 ? 'Good' : value === 4 ? 'Great' : 'Excellent'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DailyQualityRatingModal({
  isOpen,
  userEmail,
  currentPath,
  onClose,
}: DailyQualityRatingModalProps) {
  const { toast } = useToast();
  const closedAfterSubmitRef = useRef(false);

  const [ratings, setRatings] = useState<Record<RatingKey, number | null>>({
    connectionQuality: null,
    applicationSpeed: null,
    platformSatisfaction: null,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setRating = (key: RatingKey) => (n: number) =>
    setRatings((prev) => ({ ...prev, [key]: n }));

  const markHandled = (value: 'skipped' | 'submitted') => {
    const ymd = getPacificYmd();
    localStorage.setItem(getQualityRatingLocalStorageKey(userEmail, ymd), value);
  };

  const resetForm = () => {
    setRatings({ connectionQuality: null, applicationSpeed: null, platformSatisfaction: null });
    setComment('');
  };

  const handleSkip = () => {
    markHandled('skipped');
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const { connectionQuality, applicationSpeed, platformSatisfaction } = ratings;
    if (connectionQuality == null || applicationSpeed == null || platformSatisfaction == null) {
      toast({
        title: 'Rate all three',
        description: 'Please give 1–5 stars for all three categories before submitting.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
        }
      } catch {
        /* optional */
      }

      const res = await fetch('/api/quality-rating/daily', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          connectionQuality,
          applicationSpeed,
          platformSatisfaction,
          comment: comment.trim().slice(0, 2000),
          path: currentPath.split('?')[0]?.slice(0, 500) || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.details || data?.error || data?.hint || `Request failed (${res.status})`,
        );
      }

      markHandled('submitted');
      closedAfterSubmitRef.current = true;
      resetForm();
      onClose();
      toast({
        title: 'Got it — thanks! 🙌',
        description:
          data?.persisted === false
            ? 'Saved locally and will sync when your connection is back.'
            : 'Your feedback helps us keep ConnectNow running smoothly.',
      });
    } catch (e: unknown) {
      toast({
        title: 'Could not save rating',
        description: e instanceof Error ? e.message : 'Try again later.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const allRated = Object.values(ratings).every((v) => v != null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        if (closedAfterSubmitRef.current) {
          closedAfterSubmitRef.current = false;
          return;
        }
        if (!submitting) handleSkip();
      }}
    >
      <DialogContent
        className="z-[100] sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 shadow-2xl rounded-2xl"
        overlayClassName="z-[100]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (!submitting) handleSkip();
        }}
      >
        {/* Header gradient bar */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-t-2xl px-6 pt-6 pb-5">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <div className="rounded-lg bg-white/20 p-1.5">
                <Star className="h-4 w-4 text-white fill-white" strokeWidth={1.5} />
              </div>
              How was your day?
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-sm mt-1 text-left">
              Takes 10 seconds. Your feedback directly shapes how we improve the platform.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3 bg-white dark:bg-gray-950 rounded-b-2xl">
          {RATING_CATEGORIES.map((cat) => (
            <StarRow
              key={cat.key}
              label={cat.label}
              hint={cat.hint}
              icon={cat.icon}
              iconColor={cat.iconColor}
              value={ratings[cat.key]}
              onChange={setRating(cat.key)}
            />
          ))}

          <div className="pt-1">
            <Textarea
              placeholder="Anything else? Bugs, audio issues, slowness — anything about the app. (Not for lead feedback.)"
              value={comment}
              onChange={(ev) => setComment(ev.target.value)}
              rows={3}
              maxLength={2000}
              className="resize-none text-sm border-blue-100 dark:border-blue-900/40 focus-visible:ring-purple-500 rounded-xl bg-blue-50/30 dark:bg-blue-950/10"
            />
            {comment.length > 1800 && (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {2000 - comment.length} characters remaining
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={submitting}
              className="text-muted-foreground hover:text-foreground"
            >
              Maybe later
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !allRated}
              className={cn(
                'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white shadow-lg transition-all duration-200',
                allRated && 'hover:scale-[1.02] hover:shadow-xl',
              )}
            >
              {submitting ? 'Saving…' : 'Send Feedback'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
