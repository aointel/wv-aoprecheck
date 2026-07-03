import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Video, Copy, Check } from 'lucide-react';
import { setStoredQueue, getStored } from '@/hooks/use-help-queue-status';

function formatAppointmentTimer(slotStart: string | null): string | null {
  if (!slotStart) return null;
  const start = new Date(slotStart);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins > 0) {
    if (diffMins < 60) return `Your appointment is in ${diffMins} minute${diffMins === 1 ? '' : 's'}`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `Your appointment is in ${h}h ${m}m`;
  }
  if (diffMins > -60) return 'Your appointment is in progress';
  return `Your appointment was at ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function HelpQueuePage() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(search);
  const bookingId = params.get('booking');

  const [queueEntry, setQueueEntry] = useState<{
    id: number;
    position: number;
    status: string;
    zoomLink: string | null;
    zoom_link?: string | null;
    userEmail?: string;
    slot_start?: string | null;
    slot_end?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [appointmentText, setAppointmentText] = useState<string | null>(null);

  useEffect(() => {
    const s = queueEntry?.slot_start ?? null;
    if (!s) {
      setAppointmentText(null);
      return;
    }
    const update = () => setAppointmentText(formatAppointmentTimer(s));
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [queueEntry?.slot_start]);

  // Poll for queue status when we have an entry
  useEffect(() => {
    if (!queueEntry?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/help/queue/status?queueId=${queueEntry.id}`);
        if (res.ok) {
          const data = await res.json();
          setQueueEntry((p) => (p ? { ...p, ...data } : null));
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [queueEntry?.id]);

  const autoJoin = useCallback(async () => {
    if (!bookingId) return;
    const bid = parseInt(bookingId, 10);
    if (isNaN(bid)) {
      setError('Invalid booking ID');
      setLoading(false);
      return;
    }
    const stored = getStored();
    if (stored?.bookingId === bid && stored?.queueId) {
      try {
        const res = await fetch(`/api/help/queue/status?queueId=${stored.queueId}`);
        if (res.ok) {
          const data = await res.json();
          setQueueEntry({
            id: data.id,
            position: data.position,
            status: data.status,
            zoomLink: data.zoomLink ?? data.zoom_link,
            slot_start: data.slot_start,
            slot_end: data.slot_end,
          });
        } else {
          setError('Could not load queue status');
        }
      } catch (e) {
        setError('Failed to load queue status');
      }
      setLoading(false);
      return;
    }
    try {
      const bookingRes = await fetch(`/api/help/bookings/${bid}`);
      if (!bookingRes.ok) {
        setError('Booking not found');
        setLoading(false);
        return;
      }
      const booking = await bookingRes.json();
      const { user_email, name } = booking;
      const joinRes = await fetch('/api/help/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bid, name, email: user_email }),
      });
      if (!joinRes.ok) {
        const err = await joinRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to join queue');
      }
      const data = await joinRes.json();
      setQueueEntry({
        id: data.id,
        position: data.position,
        status: data.status,
        zoomLink: data.zoomLink ?? data.zoom_link,
        userEmail: data.userEmail,
        slot_start: booking.slot_start,
        slot_end: booking.slot_end,
      });
      setStoredQueue({ queueId: data.id, bookingId: bid });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join queue');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) autoJoin();
  }, [bookingId, autoJoin]);

  const copyZoomLink = () => {
    const link = queueEntry?.zoomLink ?? queueEntry?.zoom_link;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!bookingId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center mb-4">
              No booking ID. Please start from the help page and schedule a slot first.
            </p>
            <Link href="/help">
              <Button className="w-full">Go to Get Help</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-slate-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Joining the queue...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !queueEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-slate-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-destructive text-center mb-4">{error ?? 'Could not join queue'}</p>
            <Link href="/help">
              <Button className="w-full">Back to Get Help</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReady = queueEntry.status === 'in_session' && (queueEntry.zoomLink ?? queueEntry.zoom_link);
  const zoomLink = queueEntry.zoomLink ?? queueEntry.zoom_link;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-slate-900">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isReady ? (
              <>
                <Video className="w-5 h-5 text-green-600" />
                It&apos;s your turn!
              </>
            ) : (
              <>You&apos;re in line</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {appointmentText && (
            <p className="text-sm text-muted-foreground text-center">{appointmentText}</p>
          )}
          {isReady ? (
            <>
              <p className="text-muted-foreground">
                Join the support session with the link below.
              </p>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <a href={zoomLink!} target="_blank" rel="noopener noreferrer">
                    <Video className="w-4 h-4 mr-2" />
                    Join Zoom
                  </a>
                </Button>
                <Button variant="outline" size="icon" onClick={copyZoomLink}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-center">
                Position: #{queueEntry?.position ?? '—'}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                When it&apos;s your turn, you&apos;ll see a Zoom link in the banner at the bottom of the screen. You can browse the site — your queue status will follow you.
              </p>
            </>
          )}
          <div className="pt-4 flex flex-col gap-2">
            <Link href="/connect">
              <Button variant="default" className="w-full">
                Continue to app
              </Button>
            </Link>
            <Link href="/help">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to help
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
