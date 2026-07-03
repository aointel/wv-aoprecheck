import { MdPerson } from 'react-icons/md';
import { DialerState } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ExternalLink, Globe, Clock, RotateCcw, User, CheckCircle, Loader2, Phone, Play, Rocket, Bot } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useDemo } from '@/contexts/DemoContext';
import type { Lead, PlanOption, SubscriptionPlan } from './types';
import { SubscriptionUpgradeModal } from '@/components/stripe/SubscriptionUpgradeModal';
import { CallConnectorProDisclaimerModal } from '@/components/modals/CallConnectorProDisclaimerModal';
import { apiRequest } from '@/lib/queryClient';

interface LeadDisplayProps {
  state: DialerState;
  callDurationSeconds?: number;
  isStarterPlan?: boolean;
  upgradePlan?: PlanOption;
  onUpgrade?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  activeQueueTab?: 'hotlead' | 'plus' | 'aointel'; // Track which queue is active
  onRefetchLeads?: () => Promise<any>; // Called to poll for leads after Ready to Launch
  onIgniteQueue?: (agentEmail: string) => Promise<{
    jobId?: string;
    status?: string;
    progress?: number;
    stage?: string;
    leadCount?: number;
    targetCount?: number;
    statusUrl?: string;
    message?: string;
    assigned?: number;
    webhookSent?: boolean;
    webhookResponse?: any;
  } | void>;
  displayLeadCount?: number; // Explicit active-queue count from parent
  /** When set, show only the lead card (no header/timer). Used for inbound call modal. */
  compact?: boolean;
  /** When set with compact, use this lead and render as Current Lead (AO Intel inbound style). */
  forceLead?: Lead | null;
  stages?: Array<{ id: number; name: string; displayName?: string }>;
  onStageChange?: (candidateId: number, newStageId: number) => void;
}

export default function LeadDisplay({
  state,
  callDurationSeconds = 0,
  isStarterPlan = false,
  upgradePlan,
  onUpgrade,
  onUndo,
  canUndo = false,
  activeQueueTab = 'hotlead',
  onRefetchLeads,
  onIgniteQueue,
  displayLeadCount,
  compact = false,
  forceLead,
  stages = [],
  onStageChange,
}: LeadDisplayProps) {
  const { availableLeads, currentLeadIndex, dialingStatus, vdpCallStatus, callStatus, viewedLead, webRTCConferenceActive, inboundCallLead } = state;
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const isLeaseDialerRoute =
    currentPath.includes('/dashboard/connect/leasedialer') ||
    currentPath === '/dashboard/connect' ||
    currentPath === '/connect';
  const effectiveLeadCount = Number.isFinite(displayLeadCount as number)
    ? Number(displayLeadCount)
    : availableLeads.length;
  const { authState } = useAuth();
  const currentUserEmail = authState?.user?.email?.toLowerCase();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isDemoMode, demoProduct } = useDemo();
  const isCCPDemo = isDemoMode && demoProduct === 'callconnector';
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isRequestingLeads, setIsRequestingLeads] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [igniteStageText, setIgniteStageText] = useState('Waiting for queue builder...');
  const [igniteLeadCount, setIgniteLeadCount] = useState(0);
  const [igniteTargetCount, setIgniteTargetCount] = useState(100);
  const [leaseSyncStatus, setLeaseSyncStatus] = useState<{ title: string; message: string } | null>(null);
  const leaseQueueSynced = isLeaseDialerRoute && availableLeads.length > 0;
  const leaseQueueSyncing = isLeaseDialerRoute && isRequestingLeads && !leaseQueueSynced;
  const leaseQueueStatusLabel = leaseQueueSynced ? 'Synced' : leaseQueueSyncing ? 'Syncing' : 'Pending';
  const leaseQueueStatusClass = leaseQueueSynced
    ? 'bg-emerald-500 text-white'
    : leaseQueueSyncing
      ? 'bg-orange-500 text-white animate-pulse'
      : 'bg-slate-500 text-white';
  const videoRef = useRef<HTMLVideoElement>(null);
  const webhookFiredRef = useRef<Set<string>>(new Set()); // Track which leads already had webhook fired
  const launchProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const availableLeadCountRef = useRef<number>(Array.isArray(availableLeads) ? availableLeads.length : 0);
  const leaseAutoSyncLastAttemptRef = useRef<number>(0);

  useEffect(() => {
    const nextCount = Array.isArray(availableLeads) ? availableLeads.length : 0;
    availableLeadCountRef.current = nextCount;
    if (isRequestingLeads) {
      setIgniteLeadCount((prev) => Math.max(prev, nextCount));
    }
    if (nextCount > 0) {
      setLeaseSyncStatus(null);
    }
  }, [availableLeads, isRequestingLeads]);

  const triggerQueueSync = useCallback(async () => {
    const userEmail = currentUserEmail ?? authState?.user?.email?.toLowerCase();
    if (!userEmail) {
      toast({ title: 'Cannot request leads', variant: 'destructive', description: 'Sign in to request leads.' });
      return;
    }
    if (!onRefetchLeads) return;

    setIsRequestingLeads(true);
    setLaunchProgress(0);
    setIgniteStageText('Queue request accepted. Building your lead pack...');
    setIgniteLeadCount(0);
    setIgniteTargetCount(100);
    if (launchProgressIntervalRef.current) {
      clearInterval(launchProgressIntervalRef.current);
      launchProgressIntervalRef.current = null;
    }

    const progressInterval = setInterval(() => {
      setLaunchProgress((prev) => (prev >= 90 ? prev : prev + 10));
    }, 250);
    launchProgressIntervalRef.current = progressInterval;

    try {
      if (isLeaseDialerRoute) {
        setIgniteStageText('Signaling online and syncing lease queue...');
        try {
          await apiRequest(
            'POST',
            '/api/leads/signal-online-and-request',
            { agentEmail: userEmail, status: 'available', queue: 'hotlead' },
            userEmail,
          );
        } catch (signalError) {
          console.warn('signal-online-and-request failed; continuing with queue fetch', signalError);
        }
        const result = await onRefetchLeads();
        setIgniteLeadCount((prev) => Math.max(prev, availableLeadCountRef.current));
        const hasLeaseLead = availableLeadCountRef.current > 0;
        if (hasLeaseLead) {
          setLaunchProgress(100);
          setIgniteStageText('Lease queue connected');
          setLeaseSyncStatus(null);
        } else {
          const reason = String(result?.reason || '').toUpperCase();
          if (reason === 'SUBSCRIPTION_PENDING') {
            setLaunchProgress(30);
            setIgniteStageText('Checking subscription status...');
            setLeaseSyncStatus(null);
            setTimeout(() => {
              setIsRequestingLeads(false);
              setLaunchProgress(0);
              setIgniteLeadCount(0);
            }, 700);
            return;
          }
          const title =
            result?.statusTitle ||
            (reason === 'SUBSCRIPTION_INACTIVE'
              ? 'Subscription inactive'
              : reason === 'MISSING_ROUTING_PROFILE'
                ? 'Routing profile missing'
                : reason === 'OUTSIDE_CALLING_HOURS'
                  ? 'Lead outside calling hours'
                  : 'No eligible leads right now');
          const message =
            result?.statusMessage ||
            result?.message ||
            (reason === 'SUBSCRIPTION_INACTIVE'
              ? 'Your Call Connector Pro subscription is not active. Reactivate to sync leads.'
              : reason === 'MISSING_ROUTING_PROFILE'
                ? 'Your market/state routing profile is not synced yet. Check that your customer record has market and states.'
                : reason === 'OUTSIDE_CALLING_HOURS'
                  ? 'A lead was found, but it is outside the allowed local calling window right now.'
                  : 'No queued lead is available for your market/state filters right now.');
          setLaunchProgress(45);
          setIgniteStageText(message);
          setLeaseSyncStatus({ title, message });
        }
        setTimeout(() => {
          setIsRequestingLeads(false);
          setLaunchProgress(0);
          setIgniteStageText('Waiting for queue builder...');
          setIgniteLeadCount(0);
        }, 700);
        return;
      }

      const data = onIgniteQueue
        ? (await onIgniteQueue(userEmail)) || {}
        : await (async () => {
            const res = await apiRequest('POST', '/api/leads/request-leads', { agentEmail: userEmail }, userEmail);
            return res.json();
          })();

      const statusUrl = typeof data.statusUrl === 'string' ? data.statusUrl : '';
      const hasQueuedProgress = !!data.jobId && statusUrl.startsWith('/api/leads/ignite/');
      if (hasQueuedProgress) {
        if (launchProgressIntervalRef.current) {
          clearInterval(launchProgressIntervalRef.current);
          launchProgressIntervalRef.current = null;
        }
        let attempts = 0;
        const maxAttempts = 40; // ~60s at 1.5s poll

        const pollStatus = async () => {
          attempts += 1;
          try {
            const statusRes = await apiRequest('GET', statusUrl, undefined, userEmail);
            const statusData = await statusRes.json();
            const progressValue = Number(statusData?.progress ?? 0);
            if (Number.isFinite(progressValue)) {
              setLaunchProgress(Math.max(0, Math.min(100, progressValue)));
            }
            const stageText = String(statusData?.stage || '').trim();
            if (stageText) setIgniteStageText(stageText);
            const targetCount = Number(statusData?.targetCount ?? 100);
            if (Number.isFinite(targetCount) && targetCount > 0) {
              setIgniteTargetCount(targetCount);
            }
            const serviceLeadCount = Number(statusData?.leadCount ?? NaN);
            if (Number.isFinite(serviceLeadCount) && serviceLeadCount >= 0) {
              setIgniteLeadCount((prev) => Math.max(prev, serviceLeadCount));
            }
            const status = String(statusData?.status || '').toLowerCase();

            if (attempts === 1 || attempts % 2 === 0) {
              await onRefetchLeads();
              setIgniteLeadCount((prev) => Math.max(prev, availableLeadCountRef.current));
            }

            if (status === 'ready') {
              await onRefetchLeads();
              setLaunchProgress(100);
              setIgniteStageText('Lead pack ready');
              setIgniteLeadCount((prev) => Math.max(prev, availableLeadCountRef.current));
              setTimeout(() => {
                setIsRequestingLeads(false);
                setLaunchProgress(0);
                setIgniteStageText('Waiting for queue builder...');
                setIgniteLeadCount(0);
              }, 900);
              return;
            }
            if (status === 'failed') {
              setIsRequestingLeads(false);
              setLaunchProgress(0);
              setIgniteStageText('Queue build failed');
              return;
            }
          } catch {
            setIsRequestingLeads(false);
            setLaunchProgress(0);
            setIgniteStageText('Queue build failed');
            return;
          }

          if (attempts >= maxAttempts) {
            await onRefetchLeads();
            setLaunchProgress(100);
            setIgniteLeadCount((prev) => Math.max(prev, availableLeadCountRef.current));
            setTimeout(() => {
              setIsRequestingLeads(false);
              setLaunchProgress(0);
              setIgniteStageText('Waiting for queue builder...');
              setIgniteLeadCount(0);
            }, 900);
            return;
          }
          setTimeout(() => {
            void pollStatus();
          }, 1500);
        };

        void pollStatus();
        return;
      }

      setLaunchProgress(90);
      if (launchProgressIntervalRef.current) {
        clearInterval(launchProgressIntervalRef.current);
        launchProgressIntervalRef.current = null;
      }
      await onRefetchLeads();
      setLaunchProgress(100);
      setIgniteLeadCount((prev) => Math.max(prev, availableLeadCountRef.current));
      setTimeout(() => {
        setIsRequestingLeads(false);
        setLaunchProgress(0);
        setIgniteStageText('Waiting for queue builder...');
        setIgniteLeadCount(0);
      }, 1000);
    } catch {
      if (launchProgressIntervalRef.current) {
        clearInterval(launchProgressIntervalRef.current);
        launchProgressIntervalRef.current = null;
      }
      setIsRequestingLeads(false);
      setLaunchProgress(0);
      setIgniteStageText('Queue build failed');
      if (isLeaseDialerRoute) {
        setLeaseSyncStatus({
          title: 'Queue sync failed',
          message: 'The leasedialer sync request failed. Try reloading; if it continues, check service/API health.',
        });
      }
    }
  }, [authState?.user?.email, currentUserEmail, isLeaseDialerRoute, onIgniteQueue, onRefetchLeads, toast]);

  // 🔥 BYPASS: These emails get FULL ACCESS - BYPASSES ALL CHECKS
  const bypassEmails = [
    'richiealtig@aoglobelife.com',
    'coopertyler@aoglobelife.com',
    'jacobnavarre@aoglobelife.com',
    'kaylar@aoglobelife.com',
    'ryancarrion@aoglobelife.com',
    'makelaoutlawalexander@aoglobelife.com',
    'langjames@aoglobelife.com',
    'vernawillbur@aoglobelife.com',
    'nicolasmahaffy@aoglobelife.com',
    'karamikovar@aoglobelife.com',
    'demarcusporter@aoglobelife.com',
    'patricasantamarina@aoglobelife.com'
  ];
  
  const isBypassEmail = currentUserEmail && bypassEmails.includes(currentUserEmail.toLowerCase().trim());

  // Check Call Connector Pro access - users need to subscribe to get access
  const { data: accessData, isLoading: isAccessLoading } = useQuery({
    queryKey: ['/api/call-connector-pro/access-check', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return { hasAccess: false };
      // For bypass emails, return immediate access without API call
      if (isBypassEmail) {
        console.log(`✅ LEADDISPLAY BYPASS: ${currentUserEmail} - FULL ACCESS - NO API CALL`);
        return {
          success: true,
          hasAccess: true,
          hasDismissedPrimer: false,
          source: 'frontend_bypass'
        };
      }
      const response = await fetch(`/api/call-connector-pro/access-check/${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) {
        console.log(`❌ [LeadDisplay] Access check failed for ${currentUserEmail}: ${response.status}`);
        return { hasAccess: false };
      }
      const data = await response.json();
      return data;
    },
    enabled: !!currentUserEmail,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1
  });

  // Explicitly check if user has Call Connector Pro access
  const hasCallConnectorProAccess = accessData?.hasAccess === true && !isAccessLoading;

  useEffect(() => {
    const shouldAutoSyncLeaseQueue =
      isLeaseDialerRoute &&
      activeQueueTab === 'hotlead' &&
      !isCCPDemo &&
      availableLeads.length === 0 &&
      !isRequestingLeads &&
      !leaseSyncStatus;

    if (!shouldAutoSyncLeaseQueue) return;
    const now = Date.now();
    if (now - leaseAutoSyncLastAttemptRef.current < 8000) return;
    leaseAutoSyncLastAttemptRef.current = now;
    void triggerQueueSync();
  }, [
    activeQueueTab,
    availableLeads.length,
    hasCallConnectorProAccess,
    isCCPDemo,
    isLeaseDialerRoute,
    isRequestingLeads,
    leaseSyncStatus,
    triggerQueueSync,
  ]);

  // Check if user is Globe Market agent - fetch from user profile
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['/api/user/profile', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/user/profile?email=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentUserEmail,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Check if user has Globe Market in their market
  const isGlobeMarket = useMemo(() => {
    if (!userProfile) return false;
    
    // Market from customers table can be string, JSONB array, or null
    const market = userProfile.market;
    const markets = userProfile.markets || [];
    
    // Handle market field - can be string, array, or JSONB array
    let marketArray: string[] = [];
    if (market) {
      if (typeof market === 'string') {
        // Try to parse as JSON if it looks like JSON
        try {
          const parsed = JSON.parse(market);
          if (Array.isArray(parsed)) {
            marketArray = parsed.map((m: any) => String(m).toLowerCase());
          } else {
            marketArray = [market.toLowerCase()];
          }
        } catch {
          // Not JSON, treat as string
          marketArray = [market.toLowerCase()];
        }
      } else if (Array.isArray(market)) {
        marketArray = market.map((m: any) => String(m).toLowerCase());
      }
    }
    
    // Also check markets array from agent_profiles
    const marketsArray = Array.isArray(markets) ? markets.map((m: any) => String(m).toLowerCase()) : [];
    
    // Combine both sources
    const allMarkets = [...marketArray, ...marketsArray];
    
    // Check if any market contains "globe"
    const isGlobe = allMarkets.some((m: string) => m.includes('globe'));
    return isGlobe;
  }, [userProfile]);

  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>('professional');
  
  // Disclaimer state - must be accepted before subscription modal
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [disclaimerLoading, setDisclaimerLoading] = useState(true);
  
  // Check disclaimer status on mount
  useEffect(() => {
    if (!currentUserEmail || isBypassEmail) {
      setDisclaimerAccepted(true); // Bypass emails don't need disclaimer
      setDisclaimerLoading(false);
      return;
    }
    
    // FIRST: Check localStorage - if accepted, trust it and skip API call
    const cachedAccepted = localStorage.getItem('call_connector_pro_disclaimer_accepted') === 'true';
    if (cachedAccepted) {
      console.log('✅ Call Connector Pro disclaimer accepted (from localStorage cache)');
      setDisclaimerAccepted(true);
      setShowDisclaimer(false);
      setDisclaimerLoading(false);
      return; // Don't make API call if localStorage says accepted
    }
    
    // ONLY if localStorage says NOT accepted, check API
    const checkDisclaimer = async () => {
      try {
        const response = await fetch(`/api/disclaimers/check-status?userEmail=${encodeURIComponent(currentUserEmail)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.callConnectorProAccepted) {
            setDisclaimerAccepted(true);
            setShowDisclaimer(false);
            localStorage.setItem('call_connector_pro_disclaimer_accepted', 'true');
            console.log('✅ Call Connector Pro disclaimer already accepted (from API)');
          } else {
            // API says NOT accepted - show disclaimer
            setDisclaimerAccepted(false);
            console.log('⚠️ Call Connector Pro disclaimer not accepted');
          }
        } else {
          // API failed - show disclaimer to be safe
          setDisclaimerAccepted(false);
          console.log('⚠️ API failed - showing disclaimer for safety');
        }
      } catch (error) {
        console.error('Error checking Call Connector Pro disclaimer status:', error);
        // API error - show disclaimer to be safe
        setDisclaimerAccepted(false);
        console.log('⚠️ API error - showing disclaimer for safety');
      }
      setDisclaimerLoading(false);
    };
    
    checkDisclaimer();
  }, [currentUserEmail, isBypassEmail]);

  // Plan options for Call Connector Pro
  const planOptions: PlanOption[] = [
    {
      plan: 'professional',
      label: 'Professional',
      price: '$64.99',
      priceSuffix: '/month',
      tagline: 'Unlock unlimited outbound dialing with the Professional plan',
      cardClass: 'border-2 border-blue-500 shadow-xl scale-[1.02]',
      gradientClass: 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30',
      bodyClass: 'bg-white/80 backdrop-blur',
      buttonClass:
        'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white',
      icon: <Phone className="h-5 w-5 text-blue-600" />,
      benefits: [
        'Unlimited outbound minutes',
        'Local Presence EVERY STATE.. Take your activity to the next level!',
        'Advanced call analytics & reporting',
        'Priority support response',
        'Unlimited dialing',
      ],
      ctaLabel: 'Upgrade Now',
      topBanner: 'Recommended',
    },
  ];

  const handleSignup = () => {
    console.log('🔵 [LeadDisplay] handleSignup called', {
      currentUserEmail,
      disclaimerAccepted,
      isBypassEmail,
      isSubscriptionModalOpen
    });
    
    if (!currentUserEmail) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe",
        variant: "destructive"
      });
      return;
    }
    
    // 🚨 CRITICAL: Check disclaimer BEFORE opening subscription modal
    if (!disclaimerAccepted && !isBypassEmail) {
      console.log('⚠️ Disclaimer not accepted - showing disclaimer modal first');
      setShowDisclaimer(true);
      return;
    }
    
    // Disclaimer accepted (or bypass), proceed to subscription modal
    console.log('✅ Opening subscription modal');
    setSelectedPlanForUpgrade('professional');
    setSubscriptionModalOpen(true);
    console.log('✅ Subscription modal state set to true');
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    handleSignup();
  };
  
  // Handle disclaimer acceptance - then open subscription modal
  const handleDisclaimerAccept = () => {
    console.log('✅ Call Connector Pro disclaimer accepted');
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    localStorage.setItem('call_connector_pro_disclaimer_accepted', 'true');
    
    // Now open the subscription modal
    setSelectedPlanForUpgrade('professional');
    setSubscriptionModalOpen(true);
  };
  
  // Live call timer
  const [callTimer, setCallTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Start/stop timer based on call status
  useEffect(() => {
    const isCallActive = callStatus === 'connected' || callStatus === 'connected_direct' || dialingStatus === 'connected';
    
    if (isCallActive && !timerActive) {
      setTimerActive(true);
      setCallTimer(0);
    } else if (!isCallActive && timerActive) {
      setTimerActive(false);
    }
  }, [callStatus, dialingStatus, timerActive]);

  // Increment timer every second
  useEffect(() => {
    if (!timerActive) return;

    const interval = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive]);

  // Format timer as MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer color based on duration
  const getTimerColor = (seconds: number) => {
    if (seconds < 30) return 'text-green-600';
    if (seconds < 60) return 'text-blue-600';
    if (seconds < 120) return 'text-purple-600';
    return 'text-orange-600';
  };
  
  // Get current lead - forceLead (inbound modal), then viewedLead, VDP call, queue lead.
  const currentLead: any = (() => {
    if (forceLead) {
      return forceLead;
    }
    if (viewedLead) {
      return viewedLead;
    }
    // VDP call if active
    if (vdpCallStatus?.hasVDPCall && vdpCallStatus.vdpCall) {
      const vdpCall = vdpCallStatus.vdpCall;
      // Extract comprehensive VDP data from notes field
      // Format: "VDP Call - Associate: 1253 - Market: Globe Market - Lead: 18056186 - Email: client@example.com - Group: GROUP123 - Address: 123 Main St"
      let leadId = '';
      let market = 'VDP Call';
      let associateId = '';
      let clientEmail = '';
      let groupCode = '';
      let address = '';
      
      if (vdpCall.notes) {
        const leadMatch = vdpCall.notes.match(/Lead: (\w+)/);
        const marketMatch = vdpCall.notes.match(/Market: ([^-]+?) -/);
        const associateMatch = vdpCall.notes.match(/Associate: (\w+)/);
        const emailMatch = vdpCall.notes.match(/Email: ([^-]+?) -/);
        const groupMatch = vdpCall.notes.match(/Group: ([^-]+?) -/);
        const addressMatch = vdpCall.notes.match(/Address: (.+)$/);
        
        if (leadMatch) leadId = leadMatch[1];
        if (marketMatch) market = marketMatch[1].trim();
        if (associateMatch) associateId = associateMatch[1];
        if (emailMatch) clientEmail = emailMatch[1].trim();
        if (groupMatch) groupCode = groupMatch[1].trim();
        if (addressMatch) address = addressMatch[1].trim();
      }
      
      return {
        id: vdpCall.callSid,
        leadId: leadId,
        associateId: associateId,
        name: vdpCall.leadName,
        phone: vdpCall.callerNumber,
        email: clientEmail !== 'N/A' ? clientEmail : '',
        state: vdpCall.leadState || '',
        city: vdpCall.leadCity || '',
        address: address !== 'N/A' ? address : '',
        market: market,
        taalk_market: market,
        groupCode: groupCode !== 'N/A' ? groupCode : '',
        status: 'vdp_active',
        cnresolution: 'vdp_active',
        corevt: 'VDP Call Active',
        isVDPCall: true
      };
    }
    
    // Third: regular queue lead (inbound call lead is never shown here — only in the modal)
    return availableLeads[currentLeadIndex] || null;
  })();
  const currentLeadDisplayName =
    currentLead
      ? (currentLead.name || `${currentLead.first_name || ''} ${currentLead.last_name || ''}`.trim() || 'Unknown')
      : '';

  const isInboundCall = !!forceLead; // When forceLead (inbound modal), use AO Intel inbound card style
  const isRecruitLead =
    String(currentLead?.market || currentLead?.taalk_market || '').toLowerCase().includes('recruit') ||
    currentLead?.source_table === 'recruit_candidates' ||
    currentLead?.source_table === 'masterrecruit';
  const recruitSourceLabel =
    currentLead?.source_table ||
    currentLead?.taalk_groupname ||
    currentLead?.groupName ||
    'recruit_candidates';
  const recruitCurrentStageId = Number(currentLead?.current_stage_id ?? currentLead?.currentStageId ?? 0) || 0;
  const recruitCurrentStage = stages.find((s) => s.id === recruitCurrentStageId);
  const recruitCandidateId = Number(currentLead?.candidateId ?? currentLead?.id ?? 0) || 0;
  const aiSummaryText: string = String(currentLead?.ai_summary || currentLead?.aiSummary || '').trim();
  const aiNotesText: string = String(currentLead?.ai_notes || '').trim();
  const appointmentNotesText: string = String(currentLead?.appointment_notes || currentLead?.appointmentNotes || '').trim();
  const aiSummarySections = useMemo(() => {
    if (!aiSummaryText) return [] as Array<{ label: string; content: string; color: string }>;

    const sections: Array<{ label: string; content: string; color: string }> = [];
    try {
      const trimmed = aiSummaryText.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const jsonData = JSON.parse(trimmed);
        const pushSection = (labelRaw: unknown, contentRaw: unknown) => {
          const label = String(labelRaw || '').trim();
          const content = String(contentRaw || '').trim();
          if (!label || !content) return;
          const labelLower = label.toLowerCase();
          let color = 'purple';
          if (labelLower.includes('recap') || labelLower.includes('summary of key topics')) color = 'blue';
          else if (labelLower.includes('next steps') || labelLower.includes('steps')) color = 'green';
          else if (labelLower.includes('background') || labelLower.includes('goals')) color = 'yellow';
          else if (labelLower.includes('screening') || labelLower.includes('status')) color = 'indigo';
          else if (labelLower.includes('sentiment') || labelLower.includes('rate')) color = 'pink';
          sections.push({ label, content, color });
        };

        if (Array.isArray(jsonData)) {
          jsonData.forEach((item: any) => {
            if (item && typeof item === 'object') {
              if ('key' in item && 'value' in item) {
                pushSection(item.key, item.value);
              } else {
                Object.entries(item).forEach(([k, v]) => pushSection(k, v));
              }
            }
          });
        } else if (jsonData && typeof jsonData === 'object') {
          Object.entries(jsonData).forEach(([k, v]) => pushSection(k, v));
        }
      }
    } catch {
      // Fall back to plain summary below
    }

    if (sections.length === 0) {
      sections.push({ label: 'Summary', content: aiSummaryText, color: 'purple' });
    }
    return sections;
  }, [aiSummaryText]);

  const getMarketLabel = (lead: any): string => {
    if (!lead) {
      return 'Inbound Lead';
    }
    const market =
      lead?.taalk_market ||
      lead?.market ||
      lead?.marketDescription ||
      lead?.market_label ||
      lead?.marketName ||
      lead?.market_group;
    const code =
      lead?.taalk_group_code ||
      lead?.groupCode ||
      lead?.group_code ||
      lead?.market_code ||
      lead?.marketGroup;

    const marketText = market ? String(market).trim() : '';
    const codeText = code ? String(code).trim() : '';

    if (marketText && codeText) {
      if (marketText.toLowerCase().includes(codeText.toLowerCase())) {
        return marketText;
      }
      return `${marketText} - ${codeText}`;
    }

    if (marketText) {
      return marketText;
    }

    if (codeText) {
      return codeText;
    }

    return 'Inbound Lead';
  };

  /** Format DOB: Excel serial (e.g. 20771) -> readable date; already date-like strings pass through. */
  const formatDob = (raw: string | number | null | undefined): string => {
    if (raw == null || raw === '') return '—';
    const s = String(raw).trim();
    if (!s) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return s;
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n > 0 && n < 100000) {
      const d = new Date((n - 25569) * 86400 * 1000);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return s;
  };

  const getSecretKey = (lead: any): string => {
    const rawValue =
      lead?.taalk_secretkey ??
      lead?.taalk_secretKey ??
      lead?.Taalk_secretkey ??
      lead?.Taalk_secretKey ??
      lead?.secretKey ??
      lead?.secret_key ??
      '';
    const normalized = String(rawValue ?? '').trim();
    return normalized || 'N/A';
  };
  
  // Check if lead is a hot lead - check is_hot_lead field from database
  const isHotLead = (lead: any) => {
    // Hot leads are determined by is_hot_lead field, NOT by market
    const result = lead?.is_hot_lead === true || lead?.is_hot_lead === 'true' || lead?.is_hot_lead === 1 || // Primary check - snake_case from database
           lead?.isHotLead === true || lead?.isHotLead === 'true' || lead?.isHotLead === 1 || // Fallback camelCase
           lead?.source_table === 'hotleads'; // Direct indicator from hotleads table
    return result;
  };

  // Always reveal phone/ID (no timer) - it's their leads
  const shouldReveal = Boolean(currentLead);
  const isCurrentLeadHotLead = currentLead && isHotLead(currentLead);
  
  useEffect(() => {
    // Do not send Planet/ALTIG webhooks on phone reveal. That destination is
    // reserved for booked/Meet outcomes only.
  }, [shouldReveal, isCurrentLeadHotLead, currentLead?.id, authState?.profile]);
  
  // Check if lead is priority 99 (super hot/fiery)
  const isPriority99 = (lead: any) => {
    const priority = lead?.priority_score || lead?.priority || 0;
    // Handle both string and number comparisons
    return Number(priority) === 99;
  };
  
  // Debug logging (commented out to reduce noise)
  // console.log('🔍 FULL LEAD OBJECT:', lead);
  // console.log('🔍 LEAD DEBUG:', { 
  //   name: lead?.name, 
  //   market: lead?.market, 
  //   taalk_market: lead?.taalk_market, 
  //   isHotLead: isHotLead(lead),
  //   priority99: isPriority99(lead),
  //   taalk_lead_id: lead?.taalk_lead_id,
  //   taalk_secretkey: lead?.taalk_secretkey,
  //   secretKey: lead?.secretKey,
  //   leadId: lead?.leadId,
  //   id: lead?.id,
  //   allKeys: Object.keys(lead || {})
  // });
  
  // Always show phone numbers - no hiding logic needed
  const shouldShowPhoneNumber = (lead: any) => true;

  // Debug logging removed - Status field now properly mapped

  const hasActiveVdpCall = Boolean(vdpCallStatus?.hasVDPCall && vdpCallStatus.vdpCall);

  if (!currentLead) {
    // 🔥 PLUS LEADS & AOINTEL: Never show "Ready to Launch" for Plus Leads or AOIntel queues - they should just show up automatically
    const isPlusLeadsQueue = activeQueueTab === 'plus';
    const isAOIntelQueue = activeQueueTab === 'aointel';
    
    // For Plus Leads queue, show a simple message instead of "Ready to Launch"
    if (isPlusLeadsQueue && availableLeads.length === 0) {
      return (
        <Card className="h-full">
          <CardContent className="p-6">
            <div className="text-center py-8 px-4">
              <div className="inline-block mb-6">
                <User className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Plus Leads Available
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Plus leads assigned to you will appear here automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // For AOIntel queue, show a simple message - AOIntel calls come in live via WebSocket
    if (isAOIntelQueue && availableLeads.length === 0) {
      return (
        <Card className="h-full">
          <CardContent className="p-6">
            <div className="text-center py-8 px-4">
              <div className="inline-block mb-6">
                <Globe className="h-16 w-16 text-blue-500/70 dark:text-blue-400/70 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Waiting for AOIntel Calls
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AOIntel inbound calls will appear here automatically when they come in.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // 🎭 DEMO MODE: Never show "Ready to Launch" in demo mode - demo lead should already be loaded
    if (isCCPDemo && availableLeads.length === 0) {
      return (
        <Card className="h-full">
          <CardContent className="p-6">
            <div className="text-center py-8 px-4">
              <div className="inline-block mb-6">
                <Loader2 className="h-16 w-16 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Loading Demo Lead...
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait while we load your demo lead.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // AO Queue (Hot Leads): Ready to Launch button - fetch hot leads when agent is ready
    const isHotleadsQueue = activeQueueTab === 'hotlead';
    if (isLeaseDialerRoute && !isAccessLoading && !hasCallConnectorProAccess && availableLeads.length === 0 && !isCCPDemo) {
      return (
        <Card className="h-full">
          <CardContent className="p-6">
            <div className="text-center py-8 px-4">
              <div className="inline-block mb-6">
                <User className="h-16 w-16 text-amber-500 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Subscription inactive
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                Your Call Connector Pro subscription is not active, so leasedialer sync is paused. Reactivate to start receiving leads again.
              </p>
              <Button className="mt-5" onClick={handleUpgrade}>
                Reactivate Call Connector Pro
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (hasCallConnectorProAccess && isHotleadsQueue && availableLeads.length === 0 && !isCCPDemo) {
      return (
        <Card className="h-full">
          <CardContent className="p-0 overflow-hidden rounded-xl">
            <div
              className="relative min-h-[260px] flex flex-col items-center justify-center rounded-xl overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #f5f3ff 55%, #eff6ff 100%)' }}
            >
              {/* Subtle dot grid */}
              <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              {/* Radial floor glow */}
              <div className="absolute inset-0 pointer-events-none transition-opacity duration-700" style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 90%, rgba(249,115,22,0.12) 0%, transparent 70%)', opacity: isRequestingLeads ? 1 : 0.5 }} />

              {/* ── IDLE ── */}
              {!isRequestingLeads && (
                <div className="relative z-10 flex flex-col items-center gap-3 py-6 px-6">
                  <div className="relative flex flex-col items-center">
                    <div style={{ animation: 'ld-rocket-idle 3s ease-in-out infinite' }}>
                      <Rocket className="h-14 w-14 text-orange-500" style={{ filter: 'drop-shadow(0 0 10px rgba(249,115,22,0.4))' }} />
                    </div>
                    <div className="w-20 h-px mt-1" style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.4), transparent)' }} />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-3 rounded-full" style={{ background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.2) 0%, transparent 70%)', filter: 'blur(3px)' }} />
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] font-black tracking-[0.28em] uppercase mb-1 text-orange-400">AO Queue</div>
                    <p className="text-base font-black tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                      {isLeaseDialerRoute
                        ? (leaseSyncStatus?.title || (leaseQueueSyncing ? 'Syncing Queue...' : 'Queue Pending'))
                        : 'Ready to Launch'}
                    </p>
                    {isLeaseDialerRoute && (
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${leaseQueueStatusClass}`}>
                          Queue: {leaseQueueStatusLabel}
                        </span>
                        <button
                          onClick={triggerQueueSync}
                          disabled={isRequestingLeads}
                          className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-md animate-pulse disabled:opacity-60 disabled:cursor-not-allowed disabled:animate-none"
                          title="Force online signal and request lead sync now"
                        >
                          Request Lead Sync
                        </button>
                      </div>
                    )}
                    <p className="text-xs mt-1 leading-relaxed max-w-[220px] mx-auto text-slate-500">
                      {isLeaseDialerRoute
                        ? (leaseSyncStatus?.message || 'Queue sync starts automatically. Hold tight while we connect your queue.')
                        : 'Request your hot leads and arm the dialer.'}
                    </p>
                  </div>
                  <button
                    onClick={triggerQueueSync}
                    disabled={isRequestingLeads}
                    className="relative overflow-hidden flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white text-sm mt-1 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(249,115,22,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}
                  >
                    <span className="absolute inset-y-0 pointer-events-none" style={{ width: '55%', background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.18) 45%, transparent 55%)', animation: 'ld-shimmer 2.4s ease-in-out infinite' }} />
                    <Rocket className="w-4 h-4 relative z-10" />
                    <span className="relative z-10 tracking-wide">
                      {isLeaseDialerRoute ? 'Request Lead Sync' : 'Sync Queue'}
                    </span>
                  </button>
                </div>
              )}

              {/* ── LAUNCHING ── */}
              {isRequestingLeads && (
                <div className="relative z-10 flex flex-col items-center w-full px-5 py-5 gap-4">
                  <div className="relative flex flex-col items-center" style={{ height: 76 }}>
                    <div style={{ animation: 'ld-rocket-ascend 1.8s ease-in-out infinite' }}>
                      <Rocket className="h-9 w-9 text-orange-500" style={{ filter: 'drop-shadow(0 0 12px rgba(249,115,22,0.7))' }} />
                    </div>
                    <div className="flex flex-col items-center mt-0.5" style={{ gap: 3 }}>
                      {[
                        { w: 7,  h: 5, color: 'rgba(253,224,71,0.9)',  blur: 1, delay: '0s'    },
                        { w: 11, h: 7, color: 'rgba(251,146,60,0.75)', blur: 2, delay: '0.08s' },
                        { w: 9,  h: 5, color: 'rgba(239,68,68,0.5)',   blur: 3, delay: '0.16s' },
                        { w: 6,  h: 4, color: 'rgba(185,28,28,0.25)',  blur: 5, delay: '0.24s' },
                      ].map((p, i) => (
                        <div key={i} className="rounded-full" style={{ width: p.w, height: p.h, background: p.color, filter: `blur(${p.blur}px)`, animation: `ld-exhaust 0.45s ease-in-out ${p.delay} infinite alternate` }} />
                      ))}
                    </div>
                  </div>
                  <div className="w-full max-w-[230px] flex flex-col" style={{ gap: 10 }}>
                    {[
                      { label: 'Connecting to AO Intel', threshold: 0  },
                      { label: 'Requesting hot leads',   threshold: 30 },
                      { label: 'Assigning to queue',     threshold: 60 },
                      { label: 'Launching Call Connector Pro', threshold: 90 },
                    ].map((step, i) => {
                      const done   = launchProgress >= step.threshold + 28;
                      const active = launchProgress >= step.threshold && !done;
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 border transition-all duration-500" style={{ background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.6)', borderColor: done ? '#6ee7b7' : active ? '#fb923c' : '#e2e8f0', boxShadow: done ? '0 0 6px rgba(52,211,153,0.3)' : active ? '0 0 6px rgba(249,115,22,0.3)' : 'none' }}>
                            {done   && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                            {active && <Loader2 className="w-2.5 h-2.5 text-orange-500 animate-spin" />}
                          </div>
                          <span className="text-xs font-medium flex-1 transition-colors duration-500" style={{ color: done ? '#059669' : active ? '#374151' : '#94a3b8' }}>{step.label}</span>
                          {done && <span className="text-[9px] font-black tracking-widest text-emerald-500">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full max-w-[250px] rounded-lg border border-orange-200/80 bg-white/70 px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <span>Queue Sync</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${leaseQueueStatusClass}`}>
                        {leaseQueueStatusLabel}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                        style={{ width: `${Math.max(2, Math.min(100, (igniteLeadCount / Math.max(1, igniteTargetCount)) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] leading-tight text-slate-600">{igniteStageText}</p>
                    {availableLeads.slice(0, 3).length > 0 && (
                      <div className="mt-2 border-t border-slate-200/80 pt-2 text-[10px] text-slate-700">
                        {availableLeads.slice(0, 3).map((lead: any, idx) => (
                          <div key={`${lead?.id || lead?.taalk_lead_id || idx}`} className="truncate">
                            {(lead?.name || 'Lead')} - {lead?.state || lead?.taalk_state || '--'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <style>{`
                @keyframes ld-shimmer       { 0% { left: -55%; } 100% { left: 120%; } }
                @keyframes ld-rocket-idle   { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-4px) rotate(1deg); } }
                @keyframes ld-rocket-ascend { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-7px); } }
                @keyframes ld-exhaust       { 0% { transform: scaleX(0.8) scaleY(0.85); opacity: 0.55; } 100% { transform: scaleX(1.2) scaleY(1.15); opacity: 1; } }
              `}</style>
            </div>
          </CardContent>
        </Card>
      );
    }

    // No leads: show message that leads load automatically from My Leads (no Load / Ready to Launch button)
    if (hasCallConnectorProAccess && availableLeads.length === 0 && !isPlusLeadsQueue && !isAOIntelQueue && !isCCPDemo) {
      return (
        <Card className="h-full">
          <CardContent className="p-6">
            <div className="text-center py-8 px-4">
              <div className="inline-block mb-6">
                <User className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No leads in this queue right now
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Leads load automatically from your My Leads queue. Choose a box (In Town, Road Trip, List Lead Pool, Lapse Lead Pool) or wait for new leads to be assigned.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Non-PRO users see the old message
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <MdPerson className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No lead selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isLeaseDialerRoute
                ? 'Queue synced - select a lead to start calling'
                : effectiveLeadCount > 0
                  ? `${effectiveLeadCount} leads loaded - select one to start calling`
                  : 'Ready to start calling'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const leadDisplayContent = (
    <Card className="h-full">
      <CardContent className="space-y-2 p-3">
        {/* Live Call Timer — only shown when active */}
        {timerActive && (
          <div className={`flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-300 ${getTimerColor(callTimer)} font-mono font-bold animate-pulse`}>
            <Clock className="w-4 h-4" />
            <span className="text-lg">{formatTimer(callTimer)}</span>
          </div>
        )}
        {(() => {
        /* Lead card block - reused for compact (inbound modal) */
        const leadCardBlock = (
        <>
        {/* Inbound: blue diamond border + dark blue glow. Outbound: gradient or plain. */}
        <div className={`relative rounded-lg ${
          isInboundCall
            ? 'inbound-blue-diamond-border-wrap'
            : (callStatus === 'calling' || callStatus === 'connected' || callStatus === 'calling_direct' || callStatus === 'connected_direct' || dialingStatus === 'dialing' || dialingStatus === 'connected')
              ? 'p-[3px] bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 animate-gradient-x'
              : ''
        }`}>
          
        {/* Lead Card - Inbound = AO Intel style, VDP = blue, Priority 99 = fiery, else default */}
        <div className={`relative ${
          isInboundCall
            ? 'bg-gradient-to-br from-blue-50 via-purple-50/80 to-blue-50 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border-0 inbound-blue-diamond'
            : currentLead && 'isVDPCall' in currentLead && currentLead.isVDPCall
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 shadow-blue-200/50' 
              : isHotLead(currentLead) && isPriority99(currentLead)
                ? 'bg-gradient-to-br from-orange-200 via-red-100 to-orange-300 dark:from-orange-900/60 dark:via-red-900/60 dark:to-orange-900/60 border-2 border-orange-500 shadow-orange-500/50' 
                : isHotLead(currentLead)
                  ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        } ${
          !isInboundCall && (callStatus === 'calling' || callStatus === 'connected' || callStatus === 'calling_direct' || callStatus === 'connected_direct' || dialingStatus === 'dialing' || dialingStatus === 'connected')
            ? 'border-0'
            : ''
        } rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden`}>
          
          {/* Fire Animation for Priority 99 Hot Leads Only - More Fiery */}
          {isHotLead(currentLead) && isPriority99(currentLead) && (
            <>
              {/* Ember Particles - More intense for priority 99 */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="ember ember-1"></div>
                <div className="ember ember-2"></div>
                <div className="ember ember-3"></div>
                <div className="ember ember-4"></div>
                <div className="ember ember-5"></div>
                <div className="ember ember-6"></div>
                <div className="ember ember-7"></div>
                <div className="ember ember-8"></div>
              </div>
              
              {/* Fiery Pulsing Border - More intense for priority 99 */}
              <div className="absolute inset-0 border-2 border-orange-500 rounded-lg animate-pulse opacity-60"></div>
              <div className="absolute inset-0 border border-red-500 rounded-lg animate-pulse opacity-40"></div>
            </>
          )}
          {/* Header - compact style with reduced padding */}
          <div className={`relative z-10 p-3 ${isHotLead(currentLead) ? 'drop-shadow-sm' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br from-blue-500 to-purple-600`}>
                    {currentLeadDisplayName.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold text-base ${
                    currentLead && 'isVDPCall' in currentLead && currentLead.isVDPCall
                      ? 'text-blue-700 dark:text-blue-300 font-bold' 
                      : 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent'
                  }`}>
                    {currentLeadDisplayName}
                  </h4>
                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {currentLead.phone}
                    </span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs" title="Postgres masterlead.id">
                      ML #{currentLead.id ?? '—'}
                    </span>
                    {(currentLead as any).taalk_lead_id && (
                      <span className="font-mono bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded text-xs text-muted-foreground" title="AO Lead ID">
                        AO Lead ID {(currentLead as any).taalk_lead_id}
                      </span>
                    )}
                    {currentLead.groupCode && (
                      <span className="font-mono bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs">
                        {currentLead.groupCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Top-right actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {isLeaseDialerRoute && (
                  <Button
                    onClick={triggerQueueSync}
                    disabled={isRequestingLeads}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    size="sm"
                    title="Force online signal and request lead sync now"
                  >
                    {isRequestingLeads ? 'Syncing...' : 'Request Lead Sync'}
                  </Button>
                )}
                {isRecruitLead ? (
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:via-indigo-600 hover:to-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                        size="sm"
                      >
                        <Bot className="w-4 h-4 mr-2" />
                        AI Summary
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-[420px] p-4 z-[9999] shadow-2xl" side="left" align="start" sideOffset={12}>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Bot className="w-4 h-4 text-purple-600" />
                          <h3 className="font-bold text-base">AI Summary</h3>
                        </div>
                        {aiSummarySections.length > 0 ? (
                          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                            {aiSummarySections.map((section, idx) => {
                              const colorClasses: Record<string, string> = {
                                blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
                                green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                                yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                                indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
                                pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800',
                                purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
                              };
                              return (
                                <div key={idx} className={`p-3 rounded border ${colorClasses[section.color] || colorClasses.purple}`}>
                                  <p className="text-xs font-semibold mb-1">{section.label}</p>
                                  <p className="text-xs text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{section.content}</p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No AI summary available.</p>
                        )}
                        {aiNotesText && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 mb-1">AI Notes</p>
                            <p className="text-xs whitespace-pre-wrap">{aiNotesText}</p>
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <Button
                    onClick={() => {
                      const leadId = currentLead.taalk_lead_id || currentLead.lead_id || currentLead.leadId || currentLead.id;
                      console.log('View in Planet clicked - Lead ID (Taalk preferred):', leadId);
                      // Open Planet ALTIG in new tab
                      window.open(`https://m.planetaltig.com/Lead/InboxDetail?LeadId=${leadId}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                    size="sm"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
            
            
            {/* Market and Location - compact display */}
            <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {getMarketLabel(currentLead)}
              </span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {currentLead.taalk_city || currentLead.city ? 
                  `${currentLead.taalk_city || currentLead.city}, ${currentLead.taalk_state || currentLead.state}` : 
                  currentLead.taalk_state || currentLead.state
                }
              </span>
              {!isRecruitLead && (
                <span className="text-muted-foreground">
                  DOB: {formatDob(currentLead.date_of_birth ?? currentLead.dateOfBirth)}
                </span>
              )}
            </div>
          </div>
          
          {/* Expanded Details - Ultra compact version */}
          <div className={`relative z-10 p-2 bg-white dark:bg-gray-800 border-t ${isHotLead(currentLead) ? 'drop-shadow-sm' : ''}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {/* Contact & Lead Info */}
              <div className="space-y-2">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg">
                  <label className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1 block">Contact Information</label>
                  <div className="space-y-1">
                    <div>
                      <span className="text-xs text-muted-foreground">Name:</span>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        {currentLead.first_name && currentLead.last_name 
                          ? `${currentLead.first_name} ${currentLead.last_name}`
                          : currentLead.name || 'N/A'
                        }
                      </p>
                    </div>
                    {!isRecruitLead && currentLead.id != null && currentLead.id !== '' && (
                      <div>
                        <span className="text-xs text-muted-foreground">Masterlead (DB) ID:</span>
                        <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{String(currentLead.id)}</p>
                      </div>
                    )}
                    {!isRecruitLead && !!(currentLead as any).taalk_lead_id && (
                      <div>
                        <span className="text-xs text-muted-foreground">AO Lead ID:</span>
                        <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-muted-foreground">{String((currentLead as any).taalk_lead_id)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">Phone:</span>
                      <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                        {currentLead.phone}
                      </p>
                    </div>
                    {!isRecruitLead && (
                      <div>
                        <span className="text-xs text-muted-foreground">Date of Birth:</span>
                        <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                          {formatDob(currentLead.date_of_birth ?? currentLead.dateOfBirth)}
                        </p>
                      </div>
                    )}
                    {(currentLead.taalk_email || currentLead.email) && (
                      <div>
                        <span className="text-xs text-muted-foreground">Email:</span>
                        <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-blue-600 dark:text-blue-400">
                          {currentLead.taalk_email || currentLead.email}
                        </p>
                      </div>
                    )}
                    {currentLead.isVDPCall && currentLead.associateId && (
                      <div>
                        <span className="text-xs text-muted-foreground">Associate ID:</span>
                        <p className="text-sm font-mono bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded font-bold">
                          {currentLead.associateId}
                        </p>
                      </div>
                    )}
                    {(currentLead.taalk_address || currentLead.address) && (
                      <div>
                        <span className="text-xs text-muted-foreground">Address:</span>
                        <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-gray-600 dark:text-gray-400">
                          {currentLead.taalk_address || currentLead.address}
                        </p>
                      </div>
                    )}
                    {isRecruitLead && stages.length > 0 && recruitCandidateId > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">Stage:</span>
                        <Select
                          value={recruitCurrentStageId > 0 ? String(recruitCurrentStageId) : undefined}
                          onValueChange={(v) => {
                            const stageId = parseInt(v, 10);
                            if (!Number.isFinite(stageId) || stageId <= 0) return;
                            if (onStageChange) onStageChange(recruitCandidateId, stageId);
                          }}
                        >
                          <SelectTrigger className="h-8 mt-1 bg-white dark:bg-gray-800">
                            <SelectValue placeholder={recruitCurrentStage?.name || 'Select stage'} />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.displayName || s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Combined Relationship & Market & Location */}
              <div className="space-y-2">
                <div className="bg-gradient-to-br from-purple-50 to-green-50 dark:from-purple-950/30 dark:to-green-950/30 p-2 rounded-lg">
                  <div className={isRecruitLead ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-4"}>
                    {!isRecruitLead && (
                      <div>
                        <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1 block">Relationship</label>
                        <div className="space-y-1">
                          <div>
                            <span className="text-xs text-muted-foreground">Beneficiary:</span>
                            <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                              {currentLead.taalk_beneficiary || currentLead.beneficiary || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Relationship:</span>
                            <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                              {currentLead.taalk_relationship || currentLead.relationship || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Referred By:</span>
                            <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                              {currentLead.taalk_reffered || currentLead.referredBy || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Sponsor Org:</span>
                            <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                              {currentLead.taalk_sponsor_org || currentLead.sponsorOrg || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1 block">Market & Location</label>
                      <div className="space-y-1">
                        <div>
                          <span className="text-xs text-muted-foreground">Market:</span>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                            {currentLead.taalk_market || currentLead.market || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">{isRecruitLead ? 'Source:' : 'Group Name:'}</span>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                            {isRecruitLead ? recruitSourceLabel : (currentLead.taalk_groupname || currentLead.groupName || 'N/A')}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Group Code:</span>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                            {currentLead.taalk_group_code || currentLead.groupCode || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Location:</span>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                            {currentLead.taalk_city || currentLead.city || 'N/A'}, {currentLead.taalk_state || currentLead.state || 'N/A'}
                          </p>
                        </div>
                        {!isRecruitLead && (
                          <div>
                            <span className="text-xs text-muted-foreground">Secret Key:</span>
                            <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-gray-600 dark:text-gray-400">
                              {getSecretKey(currentLead)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Notes Section - Compact */}
            {currentLead.notes && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 border">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{currentLead.notes}</p>
              </div>
            )}
            {aiSummarySections.length > 0 && !isRecruitLead && (
              <div className="mt-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1">AI Summary</p>
                <div className="space-y-2">
                  {aiSummarySections.map((section, idx) => {
                    const colorClasses: Record<string, string> = {
                      blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
                      green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                      yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                      indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
                      pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800',
                      purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
                    };
                    return (
                      <div key={idx} className={`p-2 rounded border ${colorClasses[section.color] || colorClasses.purple}`}>
                        <p className="text-[11px] font-semibold mb-1">{section.label}</p>
                        <p className="text-xs text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{section.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {aiNotesText && !isRecruitLead && (
              <div className="mt-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg p-2 border border-sky-200 dark:border-sky-800">
                <p className="text-xs font-medium text-sky-700 dark:text-sky-300 uppercase tracking-wide mb-1">AI Notes</p>
                <p className="text-xs text-sky-900 dark:text-sky-100 whitespace-pre-wrap">{aiNotesText}</p>
              </div>
            )}
            {appointmentNotesText && !isRecruitLead && (
              <div className="mt-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Appointment Notes</p>
                <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{appointmentNotesText}</p>
              </div>
            )}
          </div>
        </div>
        </div> {/* Close animated gradient border wrapper */}
        </>
        );
        return leadCardBlock;
        })()}
      </CardContent>
    </Card>
  );
  
  if (compact && currentLead) {
    const leadCardBlock = (
      <>
        <div className={`relative rounded-lg ${isInboundCall ? 'inbound-blue-diamond-border-wrap' : (callStatus === 'calling' || callStatus === 'connected' || callStatus === 'calling_direct' || callStatus === 'connected_direct' || dialingStatus === 'dialing' || dialingStatus === 'connected') ? 'p-[3px] bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 animate-gradient-x' : ''}`}>
          <div className={`relative ${isInboundCall ? 'bg-gradient-to-br from-blue-50 via-purple-50/80 to-blue-50 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border-0 inbound-blue-diamond' : currentLead && 'isVDPCall' in currentLead && currentLead.isVDPCall ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 shadow-blue-200/50' : isHotLead(currentLead) && isPriority99(currentLead) ? 'bg-gradient-to-br from-orange-200 via-red-100 to-orange-300 dark:from-orange-900/60 dark:via-red-900/60 dark:to-orange-900/60 border-2 border-orange-500 shadow-orange-500/50' : isHotLead(currentLead) ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-lg shadow-sm overflow-hidden`}>
            {/* Header */}
            <div className="relative z-10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br from-blue-500 to-purple-600">
                    {currentLeadDisplayName.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-base bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">{currentLeadDisplayName}</h4>
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                      <span className="font-mono">{currentLead.phone}</span>
                      <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs" title="Postgres masterlead.id">ML #{currentLead.id ?? '—'}</span>
                      {(currentLead as any).taalk_lead_id && (
                        <span className="font-mono bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded text-xs text-muted-foreground" title="AO Lead ID">AO Lead ID {(currentLead as any).taalk_lead_id}</span>
                      )}
                      {currentLead.groupCode && <span className="font-mono bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs">{currentLead.groupCode}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {isLeaseDialerRoute && (
                    <Button
                      onClick={triggerQueueSync}
                      disabled={isRequestingLeads}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                      size="sm"
                      title="Force online signal and request lead sync now"
                    >
                      {isRequestingLeads ? 'Syncing...' : 'Request Lead Sync'}
                    </Button>
                  )}
                  {isRecruitLead ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Button className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:via-indigo-600 hover:to-blue-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg" size="sm">
                          <Bot className="w-4 h-4 mr-2" />
                          AI Summary
                        </Button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-[420px] p-4 z-[9999] shadow-2xl" side="left" align="start" sideOffset={12}>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 border-b pb-2">
                            <Bot className="w-4 h-4 text-purple-600" />
                            <h3 className="font-bold text-base">AI Summary</h3>
                          </div>
                          {aiSummarySections.length > 0 ? (
                            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                              {aiSummarySections.map((section, idx) => {
                                const colorClasses: Record<string, string> = {
                                  blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
                                  green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                                  yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                                  indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
                                  pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800',
                                  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
                                };
                                return (
                                  <div key={idx} className={`p-3 rounded border ${colorClasses[section.color] || colorClasses.purple}`}>
                                    <p className="text-xs font-semibold mb-1">{section.label}</p>
                                    <p className="text-xs text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{section.content}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No AI summary available.</p>
                          )}
                          {aiNotesText && (
                            <div className="pt-2 border-t">
                              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 mb-1">AI Notes</p>
                              <p className="text-xs whitespace-pre-wrap">{aiNotesText}</p>
                            </div>
                          )}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <Button onClick={() => { const leadId = currentLead.taalk_lead_id || currentLead.leadId || currentLead.lead_id || currentLead.id; if (leadId) window.open(`https://m.planetaltig.com/Lead/InboxDetail?LeadId=${leadId}`, '_blank'); }} className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg" size="sm"><Globe className="w-4 h-4 mr-2" /><ExternalLink className="w-3 h-3 ml-1" /></Button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{getMarketLabel(currentLead)}</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{currentLead.taalk_city || currentLead.city ? `${currentLead.taalk_city || currentLead.city}, ${currentLead.taalk_state || currentLead.state}` : currentLead.taalk_state || currentLead.state}</span>
                {!isRecruitLead && <span className="text-muted-foreground">DOB: {formatDob(currentLead.date_of_birth ?? currentLead.dateOfBirth)}</span>}
              </div>
            </div>
            {/* Expanded details - compact grid */}
            <div className="relative z-10 p-2 bg-white dark:bg-gray-800 border-t">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="space-y-2">
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg">
                    <label className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1 block">Contact Information</label>
                    <div className="space-y-1">
                      <div><span className="text-xs text-muted-foreground">Name:</span><p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{currentLead.first_name && currentLead.last_name ? `${currentLead.first_name} ${currentLead.last_name}` : currentLead.name || 'N/A'}</p></div>
                      {!isRecruitLead && currentLead.id != null && currentLead.id !== '' && <div><span className="text-xs text-muted-foreground">Masterlead (DB) ID:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{String(currentLead.id)}</p></div>}
                      {!isRecruitLead && !!(currentLead as any).taalk_lead_id && <div><span className="text-xs text-muted-foreground">AO Lead ID:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-muted-foreground">{String((currentLead as any).taalk_lead_id)}</p></div>}
                      <div><span className="text-xs text-muted-foreground">Phone:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{currentLead.phone}</p></div>
                      {!isRecruitLead && <div><span className="text-xs text-muted-foreground">Date of Birth:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{formatDob(currentLead.date_of_birth ?? currentLead.dateOfBirth)}</p></div>}
                      {!isRecruitLead && <div><span className="text-xs text-muted-foreground">Secret Key:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-gray-600 dark:text-gray-400">{getSecretKey(currentLead)}</p></div>}
                      {(currentLead.taalk_email || currentLead.email) && <div><span className="text-xs text-muted-foreground">Email:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-blue-600 dark:text-blue-400">{currentLead.taalk_email || currentLead.email}</p></div>}
                      {(currentLead.taalk_address || currentLead.address) && <div><span className="text-xs text-muted-foreground">Address:</span><p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{currentLead.taalk_address || currentLead.address}</p></div>}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="bg-gradient-to-br from-purple-50 to-green-50 dark:from-purple-950/30 dark:to-green-950/30 p-2 rounded-lg">
                    <div className={isRecruitLead ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-4"}>
                      {!isRecruitLead && <div>
                        <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1 block">Relationship</label>
                        <div className="space-y-1">
                          <div><span className="text-xs text-muted-foreground">Beneficiary:</span><p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.taalk_beneficiary || currentLead.beneficiary || 'N/A'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Relationship:</span><p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.taalk_relationship || currentLead.relationship || 'N/A'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Referred By:</span><p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.taalk_reffered || currentLead.referredBy || 'N/A'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Sponsor Org:</span><p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.taalk_sponsor_org || currentLead.sponsorOrg || 'N/A'}</p></div>
                        </div>
                      </div>}
                      <div>
                        <label className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1 block">Market & Location</label>
                        <div className="space-y-1">
                          <div><span className="text-xs text-muted-foreground">Market:</span><p className="text-sm font-semibold text-green-800 dark:text-green-200">{currentLead.taalk_market || currentLead.market || 'N/A'}</p></div>
                          <div><span className="text-xs text-muted-foreground">{isRecruitLead ? 'Source:' : 'Group Name:'}</span><p className="text-sm font-semibold text-green-800 dark:text-green-200">{isRecruitLead ? recruitSourceLabel : (currentLead.taalk_groupname || currentLead.groupName || 'N/A')}</p></div>
                          <div><span className="text-xs text-muted-foreground">Location:</span><p className="text-sm font-semibold text-green-800 dark:text-green-200">{currentLead.taalk_city || currentLead.city || 'N/A'}, {currentLead.taalk_state || currentLead.state || 'N/A'}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {currentLead.notes && <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 border"><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p><p className="text-xs text-gray-700 dark:text-gray-300">{currentLead.notes}</p></div>}
              {aiSummarySections.length > 0 && !isRecruitLead && <div className="mt-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800"><p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1">AI Summary</p><div className="space-y-2">{aiSummarySections.map((section, idx) => { const colorClasses: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800', green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800', yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800', indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800', pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800', purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' }; return (<div key={idx} className={`p-2 rounded border ${colorClasses[section.color] || colorClasses.purple}`}><p className="text-[11px] font-semibold mb-1">{section.label}</p><p className="text-xs text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{section.content}</p></div>); })}</div></div>}
              {aiNotesText && !isRecruitLead && <div className="mt-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg p-2 border border-sky-200 dark:border-sky-800"><p className="text-xs font-medium text-sky-700 dark:text-sky-300 uppercase tracking-wide mb-1">AI Notes</p><p className="text-xs text-sky-900 dark:text-sky-100 whitespace-pre-wrap">{aiNotesText}</p></div>}
              {appointmentNotesText && !isRecruitLead && <div className="mt-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200 dark:border-amber-800"><p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Appointment Notes</p><p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{appointmentNotesText}</p></div>}
            </div>
          </div>
        </div>
      </>
    );
    return <div className="p-0 max-w-full">{leadCardBlock}</div>;
  }
  
  return (
    <>
      {leadDisplayContent}
      
      {/* Disclaimer Modal - Must be accepted before subscription */}
      <CallConnectorProDisclaimerModal
        isOpen={showDisclaimer && !disclaimerAccepted && !disclaimerLoading}
        userEmail={currentUserEmail}
        onAccept={handleDisclaimerAccept}
        onDecline={() => {
          setShowDisclaimer(false);
          toast({
            title: 'Disclaimer Required',
            description: 'You must accept the terms and conditions to subscribe to Call Connector Pro.',
            variant: 'default',
          });
        }}
      />
      
      {/* Subscription Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => {
          setSubscriptionModalOpen(false);
          setSelectedPlanForUpgrade(null);
        }}
        planOptions={planOptions}
        currentPlan={undefined}
        initialPlan={selectedPlanForUpgrade}
        userEmail={currentUserEmail}
        onCompleted={(subscription) => {
          console.log('✅ Subscription completed:', subscription);
          setSubscriptionModalOpen(false);
          setSelectedPlanForUpgrade(null);
          queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription/status'] });
          queryClient.invalidateQueries({ queryKey: ['/api/call-connector-pro/access-check', currentUserEmail] });
          toast({
            title: 'Subscription Updated',
            description: 'Professional plan is now active.',
          });
        }}
      />
    </>
  );
}