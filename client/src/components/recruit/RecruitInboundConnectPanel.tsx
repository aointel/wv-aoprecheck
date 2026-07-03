/**
 * RecruitInboundConnectPanel — uses the exact same inbound call panel as /connect (InboundCallHeaderPanel)
 * on the /ao-recruit page. Registers Twilio Device when online, polls TaskRouter pending, accept/reject/hangup
 * via the same APIs as Connect, and renders InboundCallHeaderPanel with connectionType="recruit".
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import VDPStatus from '../connectnow/VDPStatus';
import { InboundCallHeaderPanel, type InboundPanelState } from '../outbound-dialer/InboundCallHeaderPanel';
import type { Lead } from '../outbound-dialer/types';
import { getTwilioTokenEndpoint } from '@/utils/webrtc-endpoints';

const RECRUIT_CHARGE = 5;

type RecruitQueuePoll = { position: number; totalInMarket: number };

interface RecruitInboundConnectPanelProps {
  userEmail: string;
}

function buildLeadFromTaskAttrs(
  taskSid: string,
  rawAttrs: string | Record<string, unknown>
): Lead {
  const attrs = typeof rawAttrs === 'string' ? (rawAttrs ? JSON.parse(rawAttrs) : {}) : (rawAttrs || {}) as Record<string, unknown>;
  const phone = String(attrs.phone_number ?? attrs.phone ?? '').trim();
  const state = String(attrs.state ?? '').trim();
  const market = String(attrs.market ?? 'Inbound').trim() || 'Inbound';
  const leadName = attrs.lead_name ?? attrs.leadName;
  const firstName = attrs.first_name ?? attrs.firstName;
  const lastName = attrs.last_name ?? attrs.lastName;
  const name =
    (typeof leadName === 'string' && leadName.trim()) ||
    [firstName, lastName].filter(Boolean).map(String).join(' ').trim() ||
    (phone ? `Call from ${phone}` : 'Inbound Call');
  const city = String(attrs.city ?? (attrs as any).taalk_city ?? '').trim();
  const lead: Lead = {
    id: String(attrs.lead_id ?? taskSid),
    leadId: String(attrs.lead_id ?? taskSid),
    name,
    phone,
    state,
    market: (attrs.market as string) || market,
    taalk_market: market,
    status: '',
    timestamp: new Date().toISOString(),
    ...(city ? { city } : {}),
  } as Lead;
  if (attrs.taalk_lead_id != null) (lead as any).taalk_lead_id = String(attrs.taalk_lead_id);
  if (attrs.lead_email != null) (lead as any).email = String(attrs.lead_email);
  if (firstName != null) (lead as any).first_name = String(firstName);
  if (lastName != null) (lead as any).last_name = String(lastName);
  return lead;
}

export function RecruitInboundConnectPanel({ userEmail }: RecruitInboundConnectPanelProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<'offline' | 'registering' | 'registered' | 'error'>('offline');
  const [taskRouterPending, setTaskRouterPending] = useState<{
    taskSid: string;
    reservationSid: string;
    taskAttributes: string;
    createdAt?: number;
  } | null>(null);
  const [retainedPending, setRetainedPending] = useState<typeof taskRouterPending>(null);
  const [incomingConn, setIncomingConn] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [answering, setAnswering] = useState(false);
  const [inboundConnecting, setInboundConnecting] = useState(false);
  const [lastPendingPollAt, setLastPendingPollAt] = useState<number | null>(null);
  const deviceRef = useRef<any>(null);
  const lastPendingSidsRef = useRef<{ taskSid: string; reservationSid: string } | null>(null);
  const answerRequestedRef = useRef(false);
  const browserLegAcceptIssuedRef = useRef(false);
  const inboundConnRef = useRef<any>(null);
  const pendingRecruitPhoneRef = useRef<string | null>(null);
  const onInboundDisconnectedRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  // Queue position (same API as connect)
  const { data: queueData } = useQuery<RecruitQueuePoll | null>({
    queryKey: ['/api/call-connector-pro/eligible-for-inbound', userEmail, 'aorecruit'],
    queryFn: async () => {
      const res = await fetch(
        `/api/call-connector-pro/eligible-for-inbound?agentEmail=${encodeURIComponent(userEmail)}`,
        { credentials: 'include', headers: { 'x-user-email': userEmail } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        position: typeof data.myPosition === 'number' ? data.myPosition : 0,
        totalInMarket: typeof data.totalEligible === 'number' ? data.totalEligible : 0,
      };
    },
    enabled: !!userEmail,
    refetchInterval: 10000,
  });
  const queuePosition = queueData?.position ?? 0;
  const queueMarket = 'aorecruit';
  const totalInMarket = queueData?.totalInMarket ?? 0;

  // Credits — same endpoint as HeaderToolbar/VDP (avoids 401 from stricter /api/user/credits)
  const { data: creditData } = useQuery({
    queryKey: ['/api/connectnow/user-credits', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/connectnow/user-credits/${encodeURIComponent(userEmail)}`, {
        credentials: 'include',
      });
      return res.ok ? res.json() : null;
    },
    enabled: !!userEmail,
  });
  const creditsRemaining = (creditData as any)?.credits_remaining ?? (creditData as any)?.creditsRemaining ?? '—';
  const walletBalanceDollars = typeof creditsRemaining === 'number' ? creditsRemaining : undefined;

  // VDP/producer data for panel (same as Connect — producer strip inside InboundCallHeaderPanel)
  const { data: vdpData } = useQuery({
    queryKey: ['/api/vdp/routing', userEmail],
    queryFn: async () => {
      const res = await fetch('/api/vdp/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, context: 'recruit' }),
      });
      return res.ok ? res.json() : null;
    },
    enabled: !!userEmail,
  });

  const clearInboundState = useCallback(() => {
    setTaskRouterPending(null);
    setRetainedPending(null);
    setIncomingConn(null);
    setActiveCall(null);
    setAnswering(false);
    setInboundConnecting(false);
    answerRequestedRef.current = false;
    browserLegAcceptIssuedRef.current = false;
    lastPendingSidsRef.current = null;
    inboundConnRef.current = null;
    pendingRecruitPhoneRef.current = null;
  }, []);

  // Register Twilio Device when going online — same token endpoint and device options as /connect
  const registerDevice = useCallback(async () => {
    if (!userEmail) return;
    try {
      setDeviceStatus('registering');
      const tokenEndpoint = getTwilioTokenEndpoint();
      const tokenRes = await fetch(tokenEndpoint, {
        method: 'GET',
        credentials: 'include',
        headers: { 'x-user-email': userEmail },
      });
      if (!tokenRes.ok) {
        setDeviceStatus('error');
        return;
      }
      const tokenData = await tokenRes.json();
      const token = tokenData?.token ?? tokenData?.accessToken;
      if (!token) {
        setDeviceStatus('error');
        return;
      }
      const TwilioDevice = (window as any).Twilio?.Device;
      if (!TwilioDevice) {
        console.error('❌ Twilio SDK not loaded from CDN');
        setDeviceStatus('error');
        return;
      }
      // Same options as Connect: enableRingingState, closeProtection
      const deviceOptions: Record<string, unknown> = {
        debug: true,
        enableRingingState: true,
        closeProtection: true,
      };
      const device = new TwilioDevice(token, deviceOptions);

      device.on('registered', () => {
        setDeviceStatus('registered');
        // Re-assert TaskRouter same as Connect: worker AvailableInbound with market aorecruit
        fetch('/api/agents/voice-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, market: 'aorecruit' }),
        }).catch(() => {});
      });
      device.on('error', () => setDeviceStatus('error'));
      device.on('unregistered', () => setDeviceStatus('offline'));
      device.on('disconnect', () => {
        if ((window as any).__inboundCallActive && onInboundDisconnectedRef.current) {
          (window as any).__inboundCallActive = false;
          try { onInboundDisconnectedRef.current(); } catch (_) {}
        }
      });

      // Incoming handler: MUST match Connect — only accept, disconnect, cancel (no error/close so we don't treat spurious events as hangup)
      device.on('incoming', (call: any) => {
        const setConnected = () => {
          (window as any).__inboundCallActive = true;
          inboundConnRef.current = call;
          setActiveCall(call);
          setIncomingConn(null);
          setAnswering(false);
          setInboundConnecting(false);
          browserLegAcceptIssuedRef.current = false;
          // Same as Connect: TaskRouter BusyOnCall when call is connected
          fetch('/api/agents/voice-busy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail }),
          }).catch(() => {});
          // Assign this recruit candidate to the agent who just answered (aoglobelife.com email)
          const phone = pendingRecruitPhoneRef.current;
          if (phone && userEmail) {
            pendingRecruitPhoneRef.current = null;
            fetch('/api/recruit/assign-candidate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ agentEmail: userEmail, phone }),
            }).catch(() => {});
          }
        };
        const setDisconnected = () => {
          (window as any).__inboundCallActive = false;
          onInboundDisconnectedRef.current = null;
          setActiveCall(null);
          setIncomingConn(null);
          inboundConnRef.current = null;
          clearInboundState();
          // Same as Connect: Wrap then back to AvailableInbound (aorecruit)
          fetch('/api/agents/voice-wrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail }),
          }).catch(() => {});
          setTimeout(() => {
            fetch('/api/agents/voice-online', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail, market: 'aorecruit' }),
            }).catch(() => {});
          }, 2000);
        };
        onInboundDisconnectedRef.current = setDisconnected;
        call.on?.('accept', setConnected);
        call.on?.('disconnect', setDisconnected);
        call.on?.('cancel', () => {
          setIncomingConn(null);
          setAnswering(false);
        });
        setIncomingConn(call);
        // If agent already clicked Answer (TaskRouter dequeue), accept browser leg only — same as Connect; do NOT call setConnected here (accept event will fire)
        if (answerRequestedRef.current && typeof (call as any).accept === 'function' && !browserLegAcceptIssuedRef.current) {
          try {
            browserLegAcceptIssuedRef.current = true;
            const result = (call as any).accept();
            if (result && typeof result.then === 'function') result.catch(() => { browserLegAcceptIssuedRef.current = false; });
          } catch (_) {
            browserLegAcceptIssuedRef.current = false;
          }
        }
      });

      await device.register();
      deviceRef.current = device;
      (window as any).twilioDevice = device;
    } catch (err) {
      console.error('Recruit WebRTC register error', err);
      setDeviceStatus('error');
    }
  }, [userEmail, clearInboundState]);

  const handleToggle = useCallback(
    async (online: boolean) => {
      setIsOnline(online);
      try {
        if (online) {
          await fetch('/api/agents/voice-online', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, market: 'aorecruit' }),
          });
          await registerDevice();
        } else {
          await fetch('/api/agents/voice-offline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail }),
          });
          if (deviceRef.current) {
            deviceRef.current.unregister();
            deviceRef.current.destroy();
            deviceRef.current = null;
          }
          (window as any).twilioDevice = null;
          setDeviceStatus('offline');
          clearInboundState();
        }
      } catch (err) {
        console.warn('Recruit toggle error', err);
      }
    },
    [userEmail, registerDevice, clearInboundState]
  );

  // Same as Connect: expose so device-level or external code can trigger cleanup if conn.on('disconnect') didn't fire
  useEffect(() => {
    (window as any).__onInboundDisconnected = () => {
      if (onInboundDisconnectedRef.current) {
        try { onInboundDisconnectedRef.current(); } catch (_) {}
      }
    };
    return () => { (window as any).__onInboundDisconnected = null; };
  }, []);

  // Same as Connect: when Answer was clicked but browser leg arrived after — accept it when incomingConn is set
  useEffect(() => {
    if (!incomingConn) return;
    if (!answerRequestedRef.current) return;
    if (browserLegAcceptIssuedRef.current) return;
    const acceptFn = (incomingConn as any).accept;
    if (typeof acceptFn !== 'function') return;
    browserLegAcceptIssuedRef.current = true;
    try {
      const result = acceptFn.call(incomingConn);
      if (result && typeof result.then === 'function') result.catch(() => { browserLegAcceptIssuedRef.current = false; });
    } catch (_) {
      browserLegAcceptIssuedRef.current = false;
    }
  }, [incomingConn, taskRouterPending, retainedPending]);

  // Poll TaskRouter pending when online
  useEffect(() => {
    if (!isOnline || !userEmail) return;
    const poll = async () => {
      try {
        const pendingUrl = `/api/twilio/taskrouter/pending?agentEmail=${encodeURIComponent(userEmail)}`;
        const res = await fetch(pendingUrl, { credentials: 'include' });
        setLastPendingPollAt(Date.now());
        const data = await res.json();
        const pending = data?.pending ?? data?.tasks ?? [];
        const forMe = Array.isArray(pending) ? pending[0] : pending;
        if (forMe?.taskSid && forMe?.reservationSid) {
          const rawAttrs = forMe.taskAttributes ?? forMe.task_attributes ?? '{}';
          const attrs = typeof rawAttrs === 'string' ? (rawAttrs ? JSON.parse(rawAttrs) : {}) : rawAttrs;
          const callerPhone = String(attrs?.phone_number ?? attrs?.phone ?? '').trim();
          if (callerPhone) pendingRecruitPhoneRef.current = callerPhone;
          const snapshot = {
            taskSid: forMe.taskSid,
            reservationSid: forMe.reservationSid,
            taskAttributes: typeof rawAttrs === 'string' ? rawAttrs : JSON.stringify(rawAttrs),
            createdAt: typeof forMe.createdAt === 'number' ? forMe.createdAt : Date.now(),
          };
          lastPendingSidsRef.current = { taskSid: snapshot.taskSid, reservationSid: snapshot.reservationSid };
          setRetainedPending((prev) => (prev?.reservationSid === snapshot.reservationSid ? prev : snapshot));
          setTaskRouterPending((prev) => (prev?.reservationSid === snapshot.reservationSid ? prev : snapshot));
        } else {
          if (!answerRequestedRef.current && !activeCall) {
            setTaskRouterPending(null);
            lastPendingSidsRef.current = null;
            setRetainedPending(null);
          }
        }
      } catch {
        setLastPendingPollAt(Date.now());
      }
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [isOnline, userEmail, activeCall]);

  // Cleanup device on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.unregister();
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, []);

  const activePending = taskRouterPending ?? retainedPending;
  const hasPendingOffer = !!activePending && !answerRequestedRef.current && !activeCall;
  const shouldShowConnected = !!activeCall;

  const inboundPanelState: InboundPanelState = hasPendingOffer || incomingConn
    ? 'ringing'
    : inboundConnecting && !activeCall
      ? 'connecting'
      : shouldShowConnected
        ? 'connected'
        : 'idle';

  const taskAttrsLead: Lead | null = activePending
    ? buildLeadFromTaskAttrs(activePending.taskSid, activePending.taskAttributes)
    : null;
  const inboundPanelLead = taskAttrsLead;

  // Accept flow: same as Connect — POST taskrouter/accept (dequeue), then accept browser leg if already delivered
  const handleAnswer = useCallback(async () => {
    if (answering) return;
    const pending = activePending ?? (lastPendingSidsRef.current ? { taskSid: lastPendingSidsRef.current.taskSid, reservationSid: lastPendingSidsRef.current.reservationSid } : null);
    const sids = pending ? { taskSid: pending.taskSid, reservationSid: pending.reservationSid } : lastPendingSidsRef.current;
    if (!sids?.taskSid || !sids?.reservationSid) {
      if (!incomingConn) {
        toast({ title: 'No call to accept', description: 'Accept is only available when an inbound call is ringing.', variant: 'destructive' });
        return;
      }
    }
    answerRequestedRef.current = true;
    const { taskSid, reservationSid } = sids || {};
    const isDemoCall = reservationSid ? String(reservationSid).startsWith('test-inject-') : false;
    if (taskSid && reservationSid && !isDemoCall) {
      setAnswering(true);
      try {
        const acceptBody = { taskSid, reservationSid, agent_email: (userEmail || '').trim() || undefined, contact_uri: userEmail ? `client:${userEmail}` : undefined };
        const acceptRes = await fetch('/api/twilio/taskrouter/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(acceptBody),
        });
        if (!acceptRes.ok) {
          const errBody = await acceptRes.json().catch(() => ({}));
          toast({ title: 'Accept failed', description: (errBody as any)?.error || String(acceptRes.status), variant: 'destructive' });
          setAnswering(false);
          answerRequestedRef.current = false;
          return;
        }
        setInboundConnecting(true);
        if (incomingConn && typeof (incomingConn as any).accept === 'function' && !browserLegAcceptIssuedRef.current) {
          browserLegAcceptIssuedRef.current = true;
          try {
            const result = (incomingConn as any).accept();
            if (result && typeof result.then === 'function') result.catch(() => { browserLegAcceptIssuedRef.current = false; });
          } catch (_) {
            browserLegAcceptIssuedRef.current = false;
          }
        }
      } catch (err) {
        toast({ title: 'Accept failed', description: (err as Error)?.message, variant: 'destructive' });
        setAnswering(false);
        answerRequestedRef.current = false;
      }
    }
  }, [answering, activePending, incomingConn, userEmail, toast]);

  const handleReject = useCallback(async () => {
    answerRequestedRef.current = false;
    if (incomingConn && typeof (incomingConn as any).reject === 'function') {
      try {
        (incomingConn as any).reject();
      } catch (_) {}
    }
    if (activePending) {
      try {
        await fetch('/api/twilio/taskrouter/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ taskSid: activePending.taskSid, reservationSid: activePending.reservationSid }),
        });
      } catch (_) {}
    }
    clearInboundState();
  }, [activePending, incomingConn, clearInboundState]);

  const handleHangup = useCallback(() => {
    const conn = inboundConnRef.current ?? activeCall ?? incomingConn;
    if (conn && typeof (conn as any).disconnect === 'function') {
      (conn as any).disconnect();
    }
    (window as any).__inboundCallActive = false;
    clearInboundState();
    // Reset TaskRouter: wrap then back to AvailableInbound
    fetch('/api/agents/voice-wrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail }),
    }).catch(() => {});
    setTimeout(() => {
      fetch('/api/agents/voice-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, market: 'aorecruit' }),
      }).catch(() => {});
    }, 2000);
  }, [activeCall, incomingConn, clearInboundState, userEmail]);

  const vdpOnline = isOnline && deviceStatus === 'registered';
  const handleAgentStatusChange = useCallback((status: 'online' | 'away' | 'offline') => {
    if (status === 'offline') handleToggle(false);
    else handleToggle(true);
  }, [handleToggle]);

  return (
    <VDPStatus
      userEmail={userEmail}
      context="recruit"
      compact
      panelVariant="new"
      cardClassName=""
      titleClassName=""
      hideProducerRow={false}
    >
      <div className="space-y-3 min-h-0 w-full max-w-full flex flex-col">
        <InboundCallHeaderPanel
          state={inboundPanelState}
          lead={inboundPanelLead}
          queuePosition={queuePosition}
          queueMarket={queueMarket}
          totalInMarket={totalInMarket}
          onAnswer={handleAnswer}
          onReject={handleReject}
          onHangup={handleHangup}
          answering={answering}
          charge={RECRUIT_CHARGE}
          connectionType="recruit"
          variant="vertical"
          vdpOnline={vdpOnline}
          reservationCreatedAt={activePending?.createdAt}
          answerRequestedRef={answerRequestedRef}
          agentStatus={vdpOnline ? 'online' : 'offline'}
          onAgentStatusChange={handleAgentStatusChange}
          walletBalanceDollars={walletBalanceDollars}
          producerAssociateId={vdpData?.associate_id}
          producerMarket={"aorecruit"}
          producerStates={vdpData?.states}
        />

        {lastPendingPollAt != null && isOnline && (
          <div className="text-[10px] text-muted-foreground" title="Polling for inbound recruit calls">
            Last check {Math.round((Date.now() - lastPendingPollAt) / 1000)}s ago
          </div>
        )}
      </div>
    </VDPStatus>
  );
}
