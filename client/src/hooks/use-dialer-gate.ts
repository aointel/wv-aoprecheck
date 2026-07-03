/**
 * use-dialer-gate.ts
 * Checks for pending appointment outcomes and blocks dialing if overdue.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface PendingAppointment {
  id: number;
  lead_name: string;
  lead_phone: string;
  lead_state?: string;
  agent_email: string;
  agent_name: string;
  start_time: string;
  outcome: string;
  disposition_source: string;
  zoom_join_url?: string;
  appointment_type?: string;
  status?: string;
  notes?: string;
}

export interface DialerGateResult {
  isBlocked: boolean;
  overdueAppointments: PendingAppointment[];
  softReminder: PendingAppointment[];
  refetch: () => void;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDialerGate(agentEmail: string | null | undefined): DialerGateResult {
  const [pending, setPending] = useState<PendingAppointment[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPending = useCallback(async () => {
    if (!agentEmail) return;
    try {
      const res = await fetch(`/api/appointments/pending-outcomes?agentEmail=${encodeURIComponent(agentEmail)}`);
      if (!res.ok) return;
      const data: PendingAppointment[] = await res.json();
      setPending(Array.isArray(data) ? data : []);
    } catch {
      // silent — don't block the dialer on fetch failure
    }
  }, [agentEmail]);

  useEffect(() => {
    if (!agentEmail) return;
    void fetchPending();
    timerRef.current = setInterval(() => { void fetchPending(); }, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [agentEmail, fetchPending]);

  const now = Date.now();
  const overdueAppointments = pending.filter(a => {
    const startMs = new Date(a.start_time).getTime();
    return now - startMs > 24 * 60 * 60 * 1000;
  });
  const softReminder = pending.filter(a => {
    const startMs = new Date(a.start_time).getTime();
    const ageMs = now - startMs;
    return ageMs > 0 && ageMs <= 24 * 60 * 60 * 1000;
  });

  return {
    isBlocked: overdueAppointments.length > 0,
    overdueAppointments,
    softReminder,
    refetch: fetchPending,
  };
}
