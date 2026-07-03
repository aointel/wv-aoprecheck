import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Video, X, Wrench } from 'lucide-react';
import { useHelpQueueStatus, setStoredQueue } from '@/hooks/use-help-queue-status';
import { useAuth } from '@/hooks/use-auth';

export { setStoredQueue };
export type { StoredQueueEntry } from '@/hooks/use-help-queue-status';

export function formatAppointmentCountdown(slotStart: string | null): string | null {
  if (!slotStart) return null;
  const start = new Date(slotStart);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  if (diffMs > 0) {
    const totalSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m ${secs}s`;
  }
  if (diffMs > -60 * 60 * 1000) return 'AOI Support session in progress';
  return null;
}

export default function HelpQueueStatusBanner() {
  const { authState } = useAuth();
  const { hasQueue, hasUpcomingBooking, hasScheduledSupport, stored, status, isReady, acknowledged, zoomLink, position, bookingId, slotStart } = useHelpQueueStatus(authState?.user?.email);
  const [dismissed, setDismissed] = useState(false);
  const [appointmentText, setAppointmentText] = useState<string | null>(null);
  const chromeLoginUrl = 'https://aoirail-connect-production.up.railway.app/login';

  useEffect(() => {
    if (!slotStart) {
      setAppointmentText(null);
      return;
    }
    const update = () => setAppointmentText(formatAppointmentCountdown(slotStart));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [slotStart]);

  useEffect(() => {
    // When it's their turn, show banner even if they had dismissed the waiting state
    if (isReady) setDismissed(false);
  }, [isReady]);

  // Show for: in queue (and not dismissed/acknowledged) OR upcoming booking not yet joined
  if (!hasScheduledSupport || dismissed || (isReady && acknowledged)) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-lg shadow-lg border p-3 flex items-center gap-3 ${
        isReady
          ? 'bg-green-50 dark:bg-green-950/80 border-green-200 dark:border-green-800'
          : 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800'
      }`}
    >
      <Wrench className={`w-5 h-5 shrink-0 ${isReady ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded hover:bg-black/10"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        {isReady ? (
          <>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              AOI Support — It&apos;s your turn!
            </p>
            {appointmentText && (
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5 font-mono">{appointmentText}</p>
            )}
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Lead load issue? Use{' '}
              <a href={chromeLoginUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                the Chrome link
              </a>.
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" asChild>
                <a href={zoomLink!} target="_blank" rel="noopener noreferrer">
                  <Video className="w-4 h-4 mr-1" />
                  Join Zoom
                </a>
              </Button>
              <Link href={`/help/queue?booking=${bookingId}`}>
                <Button variant="outline" size="sm">View</Button>
              </Link>
            </div>
          </>
        ) : hasUpcomingBooking ? (
          <>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              AOI Support — Scheduled
            </p>
            {appointmentText && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 font-mono">{appointmentText}</p>
            )}
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Lead load issue? Use{' '}
              <a href={chromeLoginUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                the Chrome link
              </a>.
            </p>
            <Link href={`/help/queue?booking=${bookingId}`}>
              <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 dark:text-blue-400">
                Join queue when ready
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              AOI Support — Queue #{position ?? '…'}
            </p>
            {appointmentText && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 font-mono">{appointmentText}</p>
            )}
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Lead load issue? Use{' '}
              <a href={chromeLoginUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                the Chrome link
              </a>.
            </p>
            <Link href={`/help/queue?booking=${bookingId}`}>
              <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 dark:text-blue-400">
                View queue status
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
