import { useState, useEffect } from 'react';

const STORAGE_KEY = 'help_queue_active';

export interface StoredQueueEntry {
  queueId: number;
  bookingId: number;
}

export interface UpcomingBooking {
  id: number;
  slot_start: string;
  slot_end: string;
}

export function getStored(): StoredQueueEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQueueEntry;
    return parsed?.queueId ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredQueue(entry: StoredQueueEntry) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export function clearStoredQueue() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

const ACK_PREFIX = 'help_queue_acknowledged_';
export function markAcknowledged(queueId: number) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${ACK_PREFIX}${queueId}`, '1');
  window.dispatchEvent(new CustomEvent('help-queue-acknowledged', { detail: { queueId } }));
}
export function isAcknowledged(queueId: number | undefined): boolean {
  if (typeof window === 'undefined' || !queueId) return false;
  return sessionStorage.getItem(`${ACK_PREFIX}${queueId}`) === '1';
}

export interface QueueStatus {
  position: number;
  status: string;
  zoomLink: string | null;
  slot_start?: string | null;
  slot_end?: string | null;
}

export function useHelpQueueStatus(userEmail?: string | null) {
  const [stored, setStored] = useState<StoredQueueEntry | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [upcomingBooking, setUpcomingBooking] = useState<UpcomingBooking | null>(null);

  useEffect(() => {
    setStored(getStored());
    const handleStorage = () => setStored(getStored());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // When user is logged in but not in queue, fetch their upcoming support booking
  useEffect(() => {
    if (!userEmail || stored?.queueId) {
      setUpcomingBooking(null);
      return;
    }
    const fetchUpcoming = async () => {
      try {
        const res = await fetch(`/api/help/bookings/upcoming?email=${encodeURIComponent(userEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setUpcomingBooking(data);
        }
      } catch {
        setUpcomingBooking(null);
      }
    };
    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60000);
    return () => clearInterval(interval);
  }, [userEmail, stored?.queueId]);

  useEffect(() => {
    if (!stored?.queueId) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/help/queue/status?queueId=${stored.queueId}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          if (data.status === 'completed' || data.status === 'abandoned') {
            if (stored?.queueId) sessionStorage.removeItem(`${ACK_PREFIX}${stored.queueId}`);
            clearStoredQueue();
            setStored(null);
            setStatus(null);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [stored?.queueId]);

  const [ackVersion, setAckVersion] = useState(0);
  useEffect(() => {
    const handler = () => setAckVersion((v) => v + 1);
    window.addEventListener('help-queue-acknowledged', handler);
    return () => window.removeEventListener('help-queue-acknowledged', handler);
  }, []);

  const hasQueue = !!stored;
  const hasUpcomingBooking = !!upcomingBooking && !hasQueue;
  const hasScheduledSupport = hasQueue || hasUpcomingBooking;
  const isReady = status?.status === 'in_session' && !!status?.zoomLink;
  const acknowledged = stored?.queueId ? isAcknowledged(stored.queueId) : false;

  return {
    hasQueue,
    hasUpcomingBooking,
    hasScheduledSupport,
    stored,
    status,
    upcomingBooking,
    isReady,
    acknowledged,
    position: status?.position ?? null,
    zoomLink: status?.zoomLink ?? null,
    bookingId: stored?.bookingId ?? upcomingBooking?.id ?? null,
    slotStart: status?.slot_start ?? upcomingBooking?.slot_start ?? null,
  };
}
