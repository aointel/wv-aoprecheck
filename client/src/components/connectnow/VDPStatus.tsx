import React, { useEffect, useState, useRef, useCallback } from 'react';
// Card components removed - using div layout to match Call Connector Pro
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useToast } from '@/hooks/use-toast';
import { ConnectionHealthMonitor } from '@/components/ConnectionHealthMonitor';
import { LowCreditsReminderModal } from '@/components/modals/LowCreditsReminderModal';
// DISCLAIMER MODAL REMOVED - All users bypass disclaimers
// import { MissedCallDisclaimerModal } from '@/components/modals/MissedCallDisclaimerModal';
import { LowCreditsBlockModal } from '@/components/modals/LowCreditsBlockModal';
import { PricingHoverCard } from '@/components/pricing/PricingHoverCard';
import { useDemo } from '@/contexts/DemoContext';
import { useCreditPurchaseModalOptional } from '@/contexts/CreditPurchaseModalContext';
import { TaalkVdpMountRefContext } from '@/contexts/TaalkVdpMountContext';
import { PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DemoGuideModal } from './DemoGuideModal';
import { DemoCertificationModal } from './DemoCertificationModal';
import { MicrophonePermissionRecoveryModal } from '@/components/MicrophonePermissionRecoveryModal';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { 
  MdCall, 
  MdWifi,
  MdSettings,
  MdWarning,
  MdAdd,
  MdStar
} from 'react-icons/md';
import { FaWifi, FaFire, FaRocket } from 'react-icons/fa';
import { InboundSuccessViewer } from '@/components/inbound/InboundSuccessViewer';

const DEBUG_VDP = false;
function debugLog(...args: unknown[]) {
  if (DEBUG_VDP) console.log(...args);
}

/**
 * Prefer InboundCallHeaderPanel ref; else first *visible* Taalk mount.
 * Avoids hidden duplicate `#mount-vdp-selector` (e.g. VDPController display:none).
 */
function pickConnectTaalkMount(refEl: HTMLDivElement | null): HTMLElement | null {
  if (refEl?.isConnected) {
    const st = window.getComputedStyle(refEl);
    if (st.display !== 'none' && st.visibility !== 'hidden') {
      return refEl;
    }
  }
  const candidates = document.querySelectorAll('[data-taalk-vdp="mount"]');
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i] as HTMLElement;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) return el;
  }
  return refEl?.isConnected ? refEl : null;
}

/** When false: never block VDP load/toggle by credits or disclaimer-on-toggle (product: always allow VDP). */
const VDP_CREDIT_BLOCKERS_ENABLED = false;

// Helper function to detect Mac
const isMac = () => {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac/.test(navigator.userAgent);
};

// Helper function to detect broken microphone permission (Mac-specific)
// Checks for NotAllowedError or empty device labels (TCC corruption)
const detectBrokenMicrophonePermission = async (): Promise<boolean> => {
  if (!isMac()) return false;

  try {
    // Try to get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    // Check if device labels are empty (indicates TCC corruption)
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const hasEmptyLabels = audioInputs.some(device => !device.label || device.label === '');

    if (hasEmptyLabels) {
      console.warn('⚠️ Mac: Microphone devices have empty labels - TCC permission may be corrupted');
      return true;
    }

    return false;
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.warn('⚠️ Mac: Microphone permission denied - may be broken or corrupted');
      return true;
    }
    return false;
  }
};

// Helper function to request microphone permission explicitly (critical for Mac Electron)
// Returns { success: boolean; error?: string; needsRecovery?: boolean }
// On Mac Electron, we need to request system permission via IPC first, then getUserMedia
const requestMicrophonePermission = async (): Promise<{ success: boolean; error?: string; needsRecovery?: boolean }> => {
  try {
    debugLog('🎤 Requesting microphone permission for VDP...');
    
    // 🍎 MAC ELECTRON: Request system-level permission via IPC first
    if (isMac() && (window as any).electronAPI?.requestMicrophonePermission) {
      debugLog('🍎 Mac Electron detected - requesting system microphone permission via IPC...');
      try {
        const electronResult = await (window as any).electronAPI.requestMicrophonePermission();
        debugLog('🍎 Mac Electron IPC result:', electronResult);
        if (!electronResult.success && !electronResult.alreadyGranted) {
          return { 
            success: false,
            needsRecovery: true,
            error: electronResult.error || 'System microphone permission denied. Please allow in System Preferences > Security & Privacy > Microphone.' 
          };
        }
        debugLog('✅ Mac Electron: System microphone permission granted');
      } catch (electronError: any) {
        console.error('❌ Mac Electron: IPC permission request failed:', electronError);
        // Continue to try getUserMedia anyway
      }
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('❌ getUserMedia not supported');
      return { success: false, error: 'Microphone access not supported in this browser' };
    }

    // Request microphone access explicitly (Electron permission handler will grant it)
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false 
    });
    
    // Keep stream active for VDP iframe - it needs active permission
    debugLog('✅ Microphone permission granted for VDP');
    
    // 🍎 MAC-SPECIFIC: Check for broken permission (empty device labels)
    const isBroken = await detectBrokenMicrophonePermission();
    if (isBroken) {
      stream.getTracks().forEach(track => track.stop());
      return { success: false, needsRecovery: true, error: 'Microphone permission appears to be corrupted. Please reset permissions.' };
    }
    
    // Store stream globally so VDP iframe can use it
    (window as any).__vdpMicrophoneStream = stream;
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Microphone permission denied for VDP:', error);
    
    let errorMessage = 'Microphone access denied';
    let needsRecovery = false;
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.error('🚫 Microphone access denied by user');
      needsRecovery = isMac(); // Mac needs recovery flow
      if (isMac()) {
        errorMessage = 'Microphone permission denied. Please allow microphone access in System Preferences > Security & Privacy > Microphone, then refresh the page.';
        console.error('💡 Mac users: Please allow microphone access in System Settings > Privacy & Security > Microphone, then refresh the page');
      } else {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      }
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone and try again.';
      console.error('❌ No microphone found');
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Microphone is being used by another application. Please close other apps using the microphone and try again.';
      console.error('❌ Microphone is being used by another application');
    }
    
    return { success: false, error: errorMessage, needsRecovery };
  }
};

// Declare global Taalk VDP functions
declare global {
  interface Window {
    TaalkVDP?: {
      open: (agentId: string, params: { states: string[], market?: any, first_name?: string, last_name?: string }) => void;
      close: () => void;
      disconnect: () => void;
      connect: () => void;
      updateParams: (params: { states: string[] }) => void;
      // Sound control methods (may not exist, but we'll try to use them if available)
      muteSound?: (muted: boolean) => void;
      setVolume?: (volume: number) => void;
      disableSound?: () => void;
      enableSound?: () => void;
    };
  }
}

interface VDPData {
  success: boolean;
  customer_id: string;
  associate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  states: string[];
  market: string;
  vdpActive: string;
  credits_remaining?: number;
  credits_used?: number;
}

interface VDPStatusProps {
  userEmail: string;
  user?: any;
  context?: string;
  title?: string;
  description?: string;
  cardClassName?: string;
  titleClassName?: string;
  onVDPStatusChange?: (online: boolean) => void;
  showHowItWorks?: boolean;
  hideProducerRow?: boolean; // Producer row moved to CallControls top
  compact?: boolean; // Compact mode for right sidebar - smaller spacing, VDP fills available space
  /** Caller info / inbound panel to show in place of the Taalk iframe UI */
  children?: React.ReactNode;
  /** When provided, show a Demo button in the header to simulate an incoming call */
  onDemoIncoming?: () => void;
  /** When true, disable the Demo button (e.g. while injecting) */
  demoInjecting?: boolean;
  /** Select which visible VDP panel to show. */
  panelVariant?: 'new' | 'legacy';
  /** When true, start in Online state on load (e.g. /connect) and call voice-online so TaskRouter has them available. */
  defaultOnline?: boolean;
  /** When true, incoming ringer is muted. */
  ringerMuted?: boolean;
  /** Toggle incoming ringer mute. */
  onRingerMuteToggle?: (muted: boolean) => void;
}

export default function VDPStatus({ 
  userEmail, 
  user, 
  context,
  title = "Taalk VDP",
  description = "",
  cardClassName = "",
  titleClassName = "text-lg font-semibold",
  onVDPStatusChange,
  showHowItWorks = true,
  hideProducerRow = false,
  compact = false,
  children,
  onDemoIncoming,
  demoInjecting = false,
  panelVariant = 'new',
  defaultOnline = false,
  ringerMuted = false,
  onRingerMuteToggle,
}: VDPStatusProps) {
  const [vdpData, setVdpData] = useState<VDPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vdpOnline, setVdpOnline] = useState(defaultOnline);
  const [vdpInitialized, setVdpInitialized] = useState(false);
  const [failedRequests, setFailedRequests] = useState(0);
  const [taalkLoaded, setTaalkLoaded] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [vdpSoundMuted, setVdpSoundMuted] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('taalk_vdp_sound_muted') === 'true';
    }
    return false;
  });
  
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [isStartingDemo, setIsStartingDemo] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);
  const [showCertification, setShowCertification] = useState(false);
  const [demoCallStarted, setDemoCallStarted] = useState(false);
  const [showMicRecoveryModal, setShowMicRecoveryModal] = useState(false);
  
  /** Filled by InboundCallHeaderPanel via TaalkVdpMountRefContext — must match open() target (not a hidden duplicate #mount-vdp-selector). */
  const connectInboundMountRef = useRef<HTMLDivElement | null>(null);
  const localVdpContainerRef = useRef<HTMLDivElement | null>(null);
  /** AO Recruit: local mount only. Connect uses connectInboundMountRef (provided to children). */
  const vdpContainerRef = localVdpContainerRef;
  // Track whether the user has manually clicked the toggle. Once true, DB polling cannot override vdpOnline.
  const userManuallyToggledRef = useRef(false);
  /** Single retry loop when TaalkVDP.open runs before external script defines window.TaalkVDP */
  const taalkSdkRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** One-shot heal after SDK loads if open() ran before iframe appeared (post-startup diagnostic). */
  const taalkOpenHealRef = useRef(false);
  useEffect(() => {
    taalkOpenHealRef.current = false;
  }, [userEmail]);

  useEffect(
    () => () => {
      if (taalkSdkRetryIntervalRef.current) {
        clearInterval(taalkSdkRetryIntervalRef.current);
        taalkSdkRetryIntervalRef.current = null;
      }
    },
    [],
  );

  // Connection type controls
  const [enableAll, setEnableAll] = useState(false);
  const [connectEnabled, setConnectEnabled] = useState(false);
  const [recruitEnabled, setRecruitEnabled] = useState(false);
  const [plusEnabled, setPlusEnabled] = useState(false);
  
  // VDP Boost feature - ONLY for cnsysop@aoglobelife.com
  const [boostActive, setBoostActive] = useState(false);
  const [boostExpiresAt, setBoostExpiresAt] = useState<Date | null>(null);
  const [boostTimeRemaining, setBoostTimeRemaining] = useState<number>(0);
  const [activatingBoost, setActivatingBoost] = useState(false);
  const isSysop = userEmail?.toLowerCase() === 'cnsysop@aoglobelife.com';
  const showLegacyPanel = panelVariant === 'legacy';

  const { toast } = useToast();
  const { isDemoMode, demoProduct, exitDemoMode } = useDemo();
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const creditPurchaseModal = useCreditPurchaseModalOptional();
  const isAointelDemo = isDemoMode && demoProduct === 'aointel';
  const isRecruitDemo = isDemoMode && demoProduct === 'recruit';
  const isAnyDemo = isAointelDemo || isRecruitDemo;

  // Get user credits (skip in demo mode)
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', userEmail],
    queryFn: async () => {
      if (!userEmail || isAnyDemo) return null;
      const headers: HeadersInit = {};
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      const response = await fetch('/api/user/credits', { headers });
      if (!response.ok) {
        console.error('❌ Failed to fetch credits:', response.status);
        return null;
      }
      return response.json();
    },
    enabled: !isAnyDemo && !!userEmail,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const creditsRemaining = (creditsData as any)?.credits_remaining ?? (creditsData as any)?.creditsRemaining ?? 0;
  
  // Debug logging for credits - ALWAYS log for sysop
  useEffect(() => {
    if (isSysop) {
      debugLog('💰 Credits data for boost:', { 
        creditsData, 
        creditsRemaining, 
        userEmail,
        rawCreditsRemaining: (creditsData as any)?.credits_remaining,
        rawCreditsRemainingAlt: (creditsData as any)?.creditsRemaining,
        hasCreditsData: !!creditsData
      });
    }
  }, [creditsData, creditsRemaining, isSysop, userEmail]);
  // AO Recruit: context/title only (same as before — no path, no extra logic).
  const isRecruitingContext = context === 'recruit' || context === 'aorecruit' || title === 'AO Recruit VDP';
  // AO Recruit: never treat as low-credit / blocked for VDP UI (no credit gating on this surface).
  const hasLowCredits =
    VDP_CREDIT_BLOCKERS_ENABLED && !isRecruitingContext && creditsRemaining <= -2;
  // Check boost status (only for sysop)
  const { data: boostStatus } = useQuery({
    queryKey: ['/api/vdp/boost/status', userEmail],
    queryFn: async () => {
      if (!isSysop) return { active: false, available: false };
      const headers: HeadersInit = {};
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      const response = await fetch('/api/vdp/boost/status', { headers });
      if (!response.ok) return { active: false, available: false };
      return response.json();
    },
    enabled: isSysop && !isAnyDemo,
    refetchInterval: 1000, // Check every second for timer updates
  });
  
  // Update boost state from query
  useEffect(() => {
    if (boostStatus) {
      setBoostActive(boostStatus.active || false);
      if (boostStatus.expiresAt) {
        setBoostExpiresAt(new Date(boostStatus.expiresAt));
      } else {
        setBoostExpiresAt(null);
      }
    }
  }, [boostStatus]);
  
  // Calculate time remaining
  useEffect(() => {
    if (!boostActive || !boostExpiresAt) {
      setBoostTimeRemaining(0);
      return;
    }
    
    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(boostExpiresAt);
      const remaining = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
      setBoostTimeRemaining(remaining);
      
      if (remaining <= 0) {
        setBoostActive(false);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [boostActive, boostExpiresAt]);
  
  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };
  
  // Activate boost
  const handleActivateBoost = async () => {
    debugLog('🚀 Boost button clicked!', { isSysop, userEmail, creditsRemaining });
    
    if (!isSysop) {
      console.warn('⚠️ Not sysop, boost activation blocked');
      return;
    }
    
      if (creditsRemaining < 25) {
        console.warn('⚠️ Insufficient credits for boost:', creditsRemaining);
        toast({
          title: 'Insufficient Credits',
          description: `You need at least 25 credits to activate boost. Current: ${creditsRemaining} credits`,
          variant: 'destructive',
        });
        return;
      }
    
    setActivatingBoost(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      
      debugLog('📤 Sending boost activation request...', { headers, userEmail });
      
      const response = await fetch('/api/vdp/boost/activate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: userEmail }),
      });
      
      debugLog('📥 Boost activation response:', { status: response.status, ok: response.ok });
      
      const data = await response.json();
      debugLog('📥 Boost activation data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate boost');
      }
      
      if (data.alreadyActive) {
        toast({
          title: 'Boost Already Active',
          description: `Boost is already active until ${new Date(data.expiresAt).toLocaleTimeString()}`,
        });
      } else {
        toast({
          title: 'Boost Activated! 🚀',
          description: `Max priority enabled for 1 hour. Cost: $25.00`,
        });
        // Refetch boost status
        queryClient.invalidateQueries({ queryKey: ['/api/vdp/boost/status', userEmail] });
        queryClient.invalidateQueries({ queryKey: ['/api/user/credits'] });
      }
    } catch (error: any) {
      console.error('❌ Error activating boost:', error);
      toast({
        title: 'Boost Activation Failed',
        description: error.message || 'Failed to activate boost. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setActivatingBoost(false);
    }
  };

  // Credit checking removed - everyone using electron app
  const dailyConnections = 12;
  const weeklyConnections = 48;
  const connectionsToday = 8;

  // DISCLAIMER LOGIC COMPLETELY REMOVED - All users bypass disclaimers for /connect
  useEffect(() => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    localStorage.setItem('vdp_missed_call_disclaimer_accepted', 'true');
    debugLog('✅ DISCLAIMER BYPASSED - All disclaimers removed for /connect VDP');
    // Don't set loading to false here - let the VDP loading logic handle it
  }, []);

  // Initialize Taalk VDP on component mount - BUT ONLY AFTER DISCLAIMER IS ACCEPTED AND CREDITS ARE SUFFICIENT
  // 🍎 MAC-SPECIFIC: Request microphone permission IMMEDIATELY on component mount
  useEffect(() => {
    if (isMac()) {
      debugLog('🍎 Mac detected - requesting microphone permission immediately on VDP component mount...');
      requestMicrophonePermission().then((result) => {
        if (result.success) {
          debugLog('✅ Mac: Microphone permission granted for VDP on app load');
        } else {
          console.error('❌ Mac: Failed to get microphone permission for VDP on app load:', result.error);
        }
      }).catch((error) => {
        console.error('❌ Mac: Error requesting microphone permission for VDP on app load:', error);
      });
    }
  }, []); // Run once on mount

  useEffect(() => {
    // DISCLAIMER LOGIC REMOVED - All users bypass disclaimers for /connect
    // Only check credits (disclaimer check removed)
    if (VDP_CREDIT_BLOCKERS_ENABLED && !isAnyDemo && !isRecruitingContext) {
      if (hasLowCredits) {
        debugLog('⚠️ Insufficient credits - blocking VDP initialization');
        setLoading(false);
        return;
      }
    }
    
    // Taalk VDP script loads in separate effect for all contexts (loads from customers table)
    setVdpInitialized(true);
    setLoading(false);
    if (userEmail) fetchUserVDPData();

    const handleVDPStatusChange = (event: CustomEvent) => {
      const { online } = event.detail;
      setVdpOnline(online);
      if (onVDPStatusChange) onVDPStatusChange(online);
    };
    window.addEventListener('taalk-vdp-status', handleVDPStatusChange as EventListener);
    return () => window.removeEventListener('taalk-vdp-status', handleVDPStatusChange as EventListener);
  }, [userEmail, showDisclaimer, hasLowCredits, disclaimerAccepted, isAnyDemo, isRecruitingContext]);

  // For the new inbound panel, TaskRouter availability must come from the real Twilio Device registration path.
  // Do not mark voice-online from this tile alone or agents can look callable while the browser leg is unreachable.
  useEffect(() => {
    if (!defaultOnline || !userEmail || !userEmail.includes('@')) return;
    setVdpOnline(true);
    window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online: true } }));
    if (panelVariant !== 'new') {
      // Legacy/other contexts still use the direct TaskRouter toggle behavior.
      fetch('https://aoirail-connect-production.up.railway.app/api/agents/voice-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-taskrouter-proxy': '1' },
        body: JSON.stringify({ email: userEmail }),
      }).then((r) => { if (!r.ok) console.warn('[TaskRouter] voice-online (defaultOnline) failed:', r.status); })
        .catch((e) => console.warn('[TaskRouter] voice-online (defaultOnline) error:', e));
    }
  }, [defaultOnline, userEmail, panelVariant]);

  // Load Taalk VDP script for ALL contexts (loads from customers table via /api/vdp/routing)
  useEffect(() => {
    if (!userEmail) {
      console.log('⏳ VDPStatus: Waiting for userEmail before loading VDP script');
      return;
    }
    
    console.log('🔍 VDPStatus: Loading Taalk VDP script (loads from customers table)');

    // Always set/overwrite container so we mount in #mount-vdp-selector
    const vdpContainer = '#mount-vdp-selector';
    
    if (!window.TaalkVDPSettings) {
      window.TaalkVDPSettings = {
        APIKey: "pub.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay41NDYyOWJkOS03Y2ZkLTQyYTUtYWY2Mi0xMGRmOTkzMmMzY2EiLCJuYW1lIjoiVkRQIEFQSSBLZXkiLCJzY29wZXMiOlsidmRwIl0sImV4cCI6MjA2NTg1MTI5Nn0.z-O2F_W0rkyyq-lhwmwEFt21HFW30tTu9As1-5f8O68",
        container: vdpContainer,
        onLoad: function() {
          console.log('✅ VDPStatus: TaalkVDP script loaded (onLoad callback)');
          setTaalkLoaded(true);
          // Don't call connect() here - wait for open() to be called first
        },
        onStatusChange: function(online: boolean) {
          console.log('🔄 TaalkVDP onStatusChange:', online);
          setVdpOnline(online);
          window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online } }));
          if (onVDPStatusChange) onVDPStatusChange(online);
        }
      };
    } else {
      (window as any).TaalkVDPSettings.container = vdpContainer;
      // Ensure onStatusChange is set even if settings already exist
      (window as any).TaalkVDPSettings.onStatusChange = function(online: boolean) {
        console.log('🔄 TaalkVDP onStatusChange callback fired:', online);
        console.log('🔄 VDPStatus: Setting vdpOnline to', online);
        setVdpOnline(online);
        window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online } }));
        if (onVDPStatusChange) onVDPStatusChange(online);
      };
    }

    if (window.TaalkVDP) {
      setTaalkLoaded(true);
      return;
    }
    if (document.getElementById('Taalk_VDP_script')) {
      const check = setInterval(() => {
        if (window.TaalkVDP) {
          setTaalkLoaded(true);
          clearInterval(check);
        }
      }, 100);
      const t = setTimeout(() => clearInterval(check), 5000);
      return () => { clearInterval(check); clearTimeout(t); };
    }

    const script = document.createElement('script');
    script.defer = true;
    script.id = 'Taalk_VDP_script';
    script.src = 'https://lets.taalk.ai/sdk/vdp_client/michaelmandella';
    script.onload = () => {
      console.log('✅ VDPStatus: TaalkVDP script loaded (onload event)');
      setTaalkLoaded(true);
      // Don't call connect() here - wait for open() to be called first
    };
    script.onerror = () => console.error('❌ Failed to load TaalkVDP script');
    document.head.appendChild(script);
    return () => { /* leave script in DOM so Taalk stays available */ };
  }, [userEmail]);

  // Control Taalk VDP sound - handles both audio elements and browser notifications
  useEffect(() => {
    if (!taalkLoaded || !vdpOnline) return;

    const vdpContainer =
      pickConnectTaalkMount(connectInboundMountRef.current) ||
      document.getElementById('mount-vdp-selector');
    if (!vdpContainer) return;

    // Function to mute/unmute all audio elements in VDP container
    const controlVDPAudio = (muted: boolean) => {
      // Method 1: Find and control all <audio> elements in VDP container
      const audioElements = vdpContainer.querySelectorAll('audio');
      audioElements.forEach((audio: HTMLAudioElement) => {
        audio.muted = muted;
        if (muted) {
          audio.pause();
        }
      });

      // Method 2: Try to use TaalkVDP sound control methods if they exist
      if ((window as any).TaalkVDP) {
        const vdp = (window as any).TaalkVDP;
        if (muted) {
          if (vdp.muteSound) vdp.muteSound(true);
          if (vdp.disableSound) vdp.disableSound();
        } else {
          if (vdp.muteSound) vdp.muteSound(false);
          if (vdp.enableSound) vdp.enableSound();
        }
      }

      // Method 3: Control AudioContext if VDP uses Web Audio API
      try {
        const audioContexts = (window as any).__taalkAudioContexts || [];
        audioContexts.forEach((ctx: AudioContext) => {
          if (muted) {
            ctx.suspend();
          } else {
            ctx.resume();
          }
        });
      } catch (e) {
        // AudioContext control failed, ignore
      }

      // Method 4: Intercept browser notifications (if VDP uses Notification API)
      // Store original Notification constructor
      if (muted && typeof Notification !== 'undefined') {
        // Override Notification to prevent sound
        const OriginalNotification = window.Notification;
        (window as any).__taalkOriginalNotification = OriginalNotification;
        
        // Create silent notification wrapper
        (window as any).Notification = class SilentNotification extends OriginalNotification {
          constructor(title: string, options?: NotificationOptions) {
            // Create notification without sound
            super(title, { ...options, silent: true });
          }
        };
      } else if (!muted && (window as any).__taalkOriginalNotification) {
        // Restore original Notification
        (window as any).Notification = (window as any).__taalkOriginalNotification;
        delete (window as any).__taalkOriginalNotification;
      }

      console.log(`🔊 Taalk VDP sound ${muted ? 'muted' : 'unmuted'}`);
    };

    // Apply current mute state
    controlVDPAudio(vdpSoundMuted);

    // Watch for new audio elements being added to VDP container
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            // Check if it's an audio element or contains audio elements
            if (element.tagName === 'AUDIO') {
              (element as HTMLAudioElement).muted = vdpSoundMuted;
            }
            const audioElements = element.querySelectorAll('audio');
            audioElements.forEach((audio: HTMLAudioElement) => {
              audio.muted = vdpSoundMuted;
            });
          }
        });
      });
    });

    observer.observe(vdpContainer, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      // Restore original Notification on cleanup
      if ((window as any).__taalkOriginalNotification) {
        (window as any).Notification = (window as any).__taalkOriginalNotification;
        delete (window as any).__taalkOriginalNotification;
      }
    };
  }, [taalkLoaded, vdpOnline, vdpSoundMuted]);

  // Handle VDP sound mute toggle
  const handleVdpSoundToggle = useCallback((muted: boolean) => {
    setVdpSoundMuted(muted);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('taalk_vdp_sound_muted', muted ? 'true' : 'false');
    }
  }, []);

  // Fetch user VDP routing data  
  const fetchUserVDPData = async () => {
    console.log('🔍 VDPStatus: fetchUserVDPData called', { userEmail, context, isRecruitingContext });
    
    if (!userEmail) {
      console.error('❌ VDPStatus: Cannot fetch VDP data: userEmail is missing');
      setError('User email is required to load VDP data');
      return;
    }
    
    // BYPASS: These emails skip all disclaimer and credit checks
    const bypassEmails = ['morgangorham@aoglobelife.com', 'patricasantamarina@aoglobelife.com'];
    const isBypassEmail = userEmail && bypassEmails.includes(userEmail.toLowerCase().trim());
    
    // DISCLAIMER LOGIC REMOVED - All users bypass disclaimers
    // Only check credits (disclaimer check removed)
    if (VDP_CREDIT_BLOCKERS_ENABLED && !isAnyDemo && !isRecruitingContext && !isBypassEmail) {
      if (hasLowCredits) {
        console.warn('⚠️ VDPStatus: Insufficient credits - blocking VDP data fetch');
        setError(`Insufficient credits (${creditsRemaining}). Please add credits to continue.`);
        setLoading(false);
        return;
      }
    }
    
    try {
      console.log('🔍 VDPStatus: Fetching VDP data for:', userEmail, 'Context:', context, isAnyDemo ? 'DEMO MODE' : '');
      
      const response = await fetch('/api/vdp/routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: userEmail,
          context: context, // This will trigger AORECRUIT hardcode when context="recruit"
          demo: isAnyDemo // Pass demo flag to API
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ VDPStatus: VDP Data Loaded Successfully:', data);
        console.log('✅ VDPStatus: Associate ID:', data.associate_id, 'States:', data.states?.length, 'Market:', data.market);
        setVdpData(data);
        setError(null);
        // Don't set vdpOnline from database - let it be set by events from OutboundDialerInterface
        // Only set initial state if no event has been received yet
        // setVdpOnline(data.vdpActive === 'true' || data.vdpActive === 'ACTIVE');
        
        // Helper function to open VDP interface
        const openVDPInterface = (vdpData: VDPData) => {
          const agentId = String(vdpData.associate_id || vdpData.customer_id || userEmail);
          const states = vdpData.states || ['CA', 'TX', 'NC'];
          
          // Extract market string from array if needed
          // Normalize "Globe" → "Globe Market" so Taalk VDP gets the correct market label
          const rawMarket = Array.isArray(vdpData.market) ? vdpData.market[0] : vdpData.market;
          const marketString = rawMarket === 'Globe' ? 'Globe Market' : rawMarket;
          
          console.log('🚀 VDPStatus: Opening Taalk VDP interface with:', { agentId, states, market: marketString });
          const mountContainer = pickConnectTaalkMount(connectInboundMountRef.current);
          
          // Check parent container visibility
          const parentContainer = mountContainer?.closest('.w-full.border.rounded-lg');
          const parentStyle = parentContainer ? window.getComputedStyle(parentContainer) : null;
          
          console.log('🔍 VDPStatus: Mount container check:', { 
            found: !!mountContainer, 
            id: mountContainer?.id, 
            visible: mountContainer ? window.getComputedStyle(mountContainer).display !== 'none' : false,
            opacity: mountContainer ? window.getComputedStyle(mountContainer).opacity : 'N/A',
            hasChildren: !!children,
            contextRef: !!connectInboundMountRef.current,
            containerSelector: mountContainer ? `#${mountContainer.id}` : 'NOT FOUND',
            parentContainerFound: !!parentContainer,
            parentDisplay: parentStyle?.display,
            parentVisibility: parentStyle?.visibility,
            parentOpacity: parentStyle?.opacity,
            // Debug visibility flags
            isRecruitingContext,
            hasLowCredits,
            showLegacyPanel,
            creditsRemaining
          });
          
          if (!mountContainer) {
            console.error('❌ VDPStatus: Mount container not found! Cannot open VDP.');
            setError('VDP container not found. Please refresh the page.');
            return;
          }
          
          try {
            if (!window.TaalkVDP) {
              if (taalkSdkRetryIntervalRef.current) {
                console.warn('⚠️ VDPStatus: Taalk SDK retry already in progress');
                return;
              }
              console.warn('⚠️ VDPStatus: TaalkVDP not ready — retrying until SDK loads');
              let ticks = 0;
              const maxTicks = 100; // 25s @ 250ms
              taalkSdkRetryIntervalRef.current = setInterval(() => {
                ticks++;
                if (window.TaalkVDP) {
                  if (taalkSdkRetryIntervalRef.current) {
                    clearInterval(taalkSdkRetryIntervalRef.current);
                    taalkSdkRetryIntervalRef.current = null;
                  }
                  openVDPInterface(vdpData);
                } else if (ticks >= maxTicks) {
                  if (taalkSdkRetryIntervalRef.current) {
                    clearInterval(taalkSdkRetryIntervalRef.current);
                    taalkSdkRetryIntervalRef.current = null;
                  }
                  console.error('❌ VDPStatus: TaalkVDP never loaded');
                  setError('Taalk VDP script did not load. Check your network and refresh.');
                }
              }, 250);
              return;
            }
            
            // Verify container is actually visible and in DOM
            const containerStyle = window.getComputedStyle(mountContainer);
            if (containerStyle.display === 'none' || containerStyle.visibility === 'hidden') {
              console.warn('⚠️ VDPStatus: Container exists but is hidden!', {
                display: containerStyle.display,
                visibility: containerStyle.visibility,
                opacity: containerStyle.opacity
              });
            }
            
            // CRITICAL: Update TaalkVDPSettings.container right before open() to ensure SDK uses correct container
            const containerSelector = `#${mountContainer.id}`;
            if (window.TaalkVDPSettings) {
              (window as any).TaalkVDPSettings.container = containerSelector;
              console.log('🔧 VDPStatus: Updated TaalkVDPSettings.container to:', containerSelector);
            }
            
            // Ensure container has dimensions (Taalk SDK needs this)
            const hasDimensions = mountContainer.offsetWidth > 0 && mountContainer.offsetHeight > 0;
            console.log('📐 VDPStatus: Container dimensions:', {
              width: mountContainer.offsetWidth,
              height: mountContainer.offsetHeight,
              hasDimensions,
              containerSelector
            });
            
            if (!hasDimensions) {
              console.warn('⚠️ VDPStatus: Container has no dimensions - waiting for layout...');
              // Wait for next frame to ensure layout is complete
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  console.log('✅ VDPStatus: Calling TaalkVDP.open() after layout (delayed)');
                  window.TaalkVDP.open(agentId, { 
                    states,
                    market: marketString,
                    first_name: vdpData.first_name,
                    last_name: vdpData.last_name
                  });
                  console.log('✅ VDPStatus: TaalkVDP.open() called successfully (delayed)');
                });
              });
              return;
            }
            
            console.log('✅ VDPStatus: Calling TaalkVDP.open() with container:', mountContainer.id);
            
            // Verify SDK is actually ready
            if (typeof window.TaalkVDP.open !== 'function') {
              console.error('❌ VDPStatus: TaalkVDP.open is not a function!', {
                TaalkVDP: typeof window.TaalkVDP,
                open: typeof window.TaalkVDP.open,
                TaalkVDPKeys: Object.keys(window.TaalkVDP || {})
              });
              setError('Taalk SDK not properly loaded. Please refresh the page.');
              return;
            }
            
            try {
              const openResult = window.TaalkVDP.open(agentId, { 
                states,
                market: marketString,
                first_name: vdpData.first_name,
                last_name: vdpData.last_name
              });
              console.log('✅ VDPStatus: TaalkVDP.open() called successfully', { 
                result: openResult,
                containerId: mountContainer.id,
                containerSelector: containerSelector,
                settingsContainer: window.TaalkVDPSettings?.container
              });
            } catch (openError) {
              console.error('❌ VDPStatus: TaalkVDP.open() threw an error:', openError);
              setError(`Failed to open VDP: ${openError instanceof Error ? openError.message : String(openError)}`);
              return;
            }
            
            // Monitor container to detect if it's being cleared
            const initialContainerHTML = mountContainer.innerHTML;
            console.log('📋 VDPStatus: Container initial state:', {
              hasContent: initialContainerHTML.length > 0,
              contentLength: initialContainerHTML.length,
              containerId: mountContainer.id
            });
            
            // Watch for container mutations (clearing, etc.)
            const mutationObserver = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                  const removedIframe = Array.from(mutation.removedNodes).find((node) => 
                    node.nodeName === 'IFRAME' || (node as Element)?.querySelector?.('iframe')
                  );
                  if (removedIframe) {
                    console.warn('⚠️ VDPStatus: Iframe was removed from container!', {
                      removedNode: removedIframe,
                      containerHTML: mountContainer.innerHTML.substring(0, 100)
                    });
                  }
                }
                if (mutation.type === 'childList' && mutation.target === mountContainer && mountContainer.innerHTML === '') {
                  console.warn('⚠️ VDPStatus: Container was cleared!', {
                    containerId: mountContainer.id,
                    stack: new Error().stack
                  });
                }
              });
            });
            
            mutationObserver.observe(mountContainer, {
              childList: true,
              subtree: true,
              attributes: false
            });
            
            // Clean up observer after 10 seconds
            setTimeout(() => mutationObserver.disconnect(), 10000);
            
            // Wait and check if iframe mounted - Taalk should create iframe in container
            setTimeout(() => {
              const iframe = mountContainer.querySelector('iframe');
              const allIframes = document.querySelectorAll('iframe');
              const currentContainerHTML = mountContainer.innerHTML;
              const wasCleared = initialContainerHTML.length > 0 && currentContainerHTML.length === 0;
              
              console.log('🔍 VDPStatus: After open() - iframe check:', {
                containerId: mountContainer.id,
                iframeFound: !!iframe,
                iframeSrc: iframe?.src,
                iframeInContainer: mountContainer.contains(iframe),
                totalIframesOnPage: allIframes.length,
                containerVisible: window.getComputedStyle(mountContainer).display !== 'none',
                containerOpacity: window.getComputedStyle(mountContainer).opacity,
                containerWasCleared: wasCleared,
                containerHTMLLength: currentContainerHTML.length,
                allIframeSrcs: Array.from(allIframes).map(ifr => ({ src: ifr.src, parentId: ifr.parentElement?.id }))
              });
              
              if (wasCleared) {
                console.warn('⚠️ VDPStatus: Container was cleared after open()! Something is blocking the mount.');
                setError('VDP container was cleared. Check for conflicting code that clears the container.');
              } else if (iframe) {
                console.log('✅ VDPStatus: Iframe found in container - waiting for onStatusChange callback');
                // Don't set vdpOnline here - let onStatusChange callback handle it
              } else {
                console.warn('⚠️ VDPStatus: Iframe not found after open() - Taalk may still be loading');
                // Check again after a longer delay
                setTimeout(() => {
                  const retryIframe = mountContainer.querySelector('iframe');
                  const retryContainerHTML = mountContainer.innerHTML;
                  if (retryIframe) {
                    console.log('✅ VDPStatus: Iframe found on retry');
                  } else {
                    console.error('❌ VDPStatus: Iframe still not found after 3 seconds - Taalk may have failed to mount', {
                      containerHTML: retryContainerHTML.substring(0, 200),
                      containerStillExists: !!mountContainer.parentElement,
                      containerDisplay: window.getComputedStyle(mountContainer).display
                    });
                  }
                }, 2000);
              }
            }, 1000);
          } catch (error) {
            console.error('❌ Failed to open VDP interface:', error);
            setError('Failed to open VDP interface. Please refresh the page.');
          }
        };
        
        // Same Taalk open path for /connect and AO Recruit. Only difference is API `context` → forced aorecruit market.
        console.log('🚀 VDPStatus: Opening Taalk VDP (unified path)', { context: context || 'connect-default' });
        if (!data.associate_id) {
          setError(`Inbound panel: Missing associate_id. Please contact support. (Email: ${userEmail})`);
        }

        const tryOpen = (attempt = 1) => {
          const container = pickConnectTaalkMount(connectInboundMountRef.current);
          if (!container) {
            if (attempt < 20) {
              console.log(`⏳ VDPStatus: Taalk mount not ready, retrying (${attempt}/20)...`);
              setTimeout(() => tryOpen(attempt + 1), 100);
              return;
            }
            console.warn('⚠️ VDPStatus: Mount not found after retries — calling open() anyway');
          }

          openVDPInterface(data);
        };

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tryOpen();
          });
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to fetch VDP data:', response.status, errorData);
        
        // CRITICAL: Show detailed error message to user
        let errorMessage = `Failed to load VDP data (${response.status}): ${errorData.error || errorData.message || 'Unknown error'}`;
        
        // If it's a credit issue, show a more specific message
        if (errorData.error === 'VDP_BLOCKED_INSUFFICIENT_CREDITS') {
          errorMessage = `VDP access denied: Insufficient credits (${errorData.creditsRemaining || 0} remaining). Please add credits to continue.`;
        } else if (response.status === 400) {
          // 400 errors are usually missing associate_id or fake associate_id
          if (errorData.error?.includes('associate_id')) {
            errorMessage = `VDP cannot load: ${errorData.error}. Please contact support to fix your account configuration.`;
          } else {
            errorMessage = `VDP configuration error: ${errorData.error || errorData.message || 'Invalid request'}. Please contact support.`;
          }
        } else if (response.status === 404) {
          // Agent has no VDP configuration — silently skip, no error shown
          console.log(`ℹ️ VDPStatus: No VDP config for ${userEmail} — VDP not enabled for this agent`);
          setLoading(false);
          return;
        }
        
        setError(errorMessage);
        setLoading(false);
        
        // Also show toast notification for visibility
        toast({
          title: 'VDP Loading Failed',
          description: errorMessage,
          variant: 'destructive',
          duration: 10000
        });
      }
    } catch (error) {
      console.error('❌ VDP routing fetch error:', error);
      setError('Failed to load VDP configuration');
      setLoading(false);
    }
  };

  // After Taalk SDK loads: if Connect embeds the panel but no iframe yet, re-run fetch/open once (handles open-before-SDK races).
  useEffect(() => {
    if (!children || !taalkLoaded || !vdpData) return;
    const mount = connectInboundMountRef.current;
    if (!mount?.isConnected) return;
    if (mount.querySelector('iframe')) return;
    if (taalkOpenHealRef.current) return;
    const tid = window.setTimeout(() => {
      const m = connectInboundMountRef.current;
      if (!m?.querySelector('iframe')) {
        taalkOpenHealRef.current = true;
        console.log('🔁 VDPStatus: Heal — re-fetch routing / open Taalk (SDK ready, no iframe in panel mount)');
        void fetchUserVDPData();
      }
    }, 500);
    return () => clearTimeout(tid);
  }, [taalkLoaded, vdpData, children]); // eslint-disable-line react-hooks/exhaustive-deps -- fetchUserVDPData one-shot heal

  // Show account paused modal when credits drop to 0 or below - but only if user hasn't dismissed it



  // Function to handle starting demo call
  const handleStartDemoCall = async () => {
    if (!vdpOnline) {
      toast({
        title: 'VDP Not Online',
        description: 'Please set VDP to ONLINE before starting the demo.',
        variant: 'destructive',
      });
      return;
    }

    setIsStartingDemo(true);
    try {
      const demoType = demoProduct === 'recruit' ? 'recruit' : 'aointel';
      
      // Build headers with authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Supabase JWT token for authentication
      try {
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
            debugLog('🔑 Demo Call: Including Supabase JWT token');
          }
        }
      } catch (authError) {
        debugLog('⚠️ Demo Call: Could not get Supabase session:', authError);
      }

      // Add user email header if available
      if (authState?.user?.email) {
        headers['x-user-email'] = authState.user.email;
        debugLog('🔑 Demo Call: Including user email:', authState.user.email);
      }

      const response = await fetch('/api/demo/start-demo-call', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for session-based auth fallback
        body: JSON.stringify({ demoType }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setDemoCallStarted(true);
        // Set global flag for AORecruit to check
        (window as any).__vdpDemoCallStarted = true;
        toast({
          title: 'Demo Call Started',
          description: `Demo call initiated successfully. You will receive a call on ${authState.profile?.phone || 'your registered phone'}. After completing the demo, please certify your experience.`,
          duration: 5000,
        });
      } else {
        throw new Error(data.error || 'Failed to start demo call');
      }
    } catch (error: any) {
      console.error('❌ Failed to start demo call:', error);
      toast({
        title: 'Demo Call Failed',
        description: error.message || 'Failed to start demo call. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsStartingDemo(false);
    }
  };

  // Handle demo completion and certification
  const handleExitDemo = () => {
    if (demoCallStarted) {
      // Show certification modal before exiting
      setShowCertification(true);
    } else {
      // Just exit if demo wasn't started
      exitDemoMode();
      if ((window as any).__demoExitHandler) {
        (window as any).__demoExitHandler();
      } else {
        window.location.href = '/onboarding';
      }
    }
  };

  const handleCertify = () => {
    setShowCertification(false);
    setDemoCallStarted(false);
    (window as any).__vdpDemoCallStarted = false;
    exitDemoMode();
    toast({
      title: 'Demo Certified',
      description: 'Thank you for completing the demo certification.',
      duration: 3000,
    });
    if ((window as any).__demoExitHandler) {
      (window as any).__demoExitHandler();
    } else {
      window.location.href = '/onboarding';
    }
  };

  // Notify parent of VDP status changes
  useEffect(() => {
    if (onVDPStatusChange) {
      onVDPStatusChange(vdpOnline);
    }
  }, [vdpOnline, onVDPStatusChange]);

  // Cleanup: Track VDP available end on component unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (vdpOnline && userEmail) {
        // Send VDP available end event (using sendBeacon for reliability)
        const sessionId = authState?.session?.id || `session-${Date.now()}`;
        const data = JSON.stringify({
          agentEmail: userEmail,
          sessionId: sessionId
        });
        
        // Use sendBeacon for page unload (more reliable than fetch)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/usage/vdp-available-end', new Blob([data], { type: 'application/json' }));
        } else {
          // Fallback to fetch with keepalive
          fetch('/api/usage/vdp-available-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(err => console.warn('Failed to track VDP end on unload:', err));
        }
      }
    };

    // Add beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function: send end event if VDP is still ON when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (vdpOnline && userEmail) {
        const sessionId = authState?.session?.id || `session-${Date.now()}`;
        // Use sendBeacon if available, otherwise fetch with keepalive
        const data = JSON.stringify({
          agentEmail: userEmail,
          sessionId: sessionId
        });
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/usage/vdp-available-end', new Blob([data], { type: 'application/json' }));
        } else {
          fetch('/api/usage/vdp-available-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(err => console.warn('Failed to track VDP end on unmount:', err));
        }
      }
    };
  }, [vdpOnline, userEmail, authState?.session?.id]);

  const handleVDPToggle = async (checked: boolean) => {
    debugLog('🔄 VDP Toggle clicked:', checked, 'Context:', context, 'isRecruitingContext:', isRecruitingContext);
    // Mark that the user has manually interacted — DB polling must not override after this.
    userManuallyToggledRef.current = true;

    // Update UI and call TaskRouter directly — don't rely on ODI ref sync (race condition).
    setVdpOnline(checked);
    window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online: checked } }));
    if (userEmail && userEmail.includes('@') && panelVariant !== 'new') {
      if (checked) {
        // Direct to baa2 with proxy header — bypasses production's 30s Twilio hang
        fetch('https://aoirail-connect-production.up.railway.app/api/agents/voice-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-taskrouter-proxy': '1' },
          body: JSON.stringify({ email: userEmail }),
        }).then((r) => { if (!r.ok) console.warn('[TaskRouter] voice-online failed:', r.status); })
          .catch((e) => console.warn('[TaskRouter] voice-online error:', e));
      } else {
        fetch('https://aoirail-connect-production.up.railway.app/api/agents/voice-offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-taskrouter-proxy': '1' },
          body: JSON.stringify({ email: userEmail }),
        }).catch((e) => console.warn('[TaskRouter] voice-offline error:', e));
      }
    }

    // 🍎 MAC-SPECIFIC: Request microphone permission BEFORE connecting VDP (/connect only — not AO Recruit)
    if (checked && isMac() && !isRecruitingContext) {
      debugLog('🍎 Mac detected - requesting microphone permission before connecting VDP...');
      const micResult = await requestMicrophonePermission();
      if (!micResult.success) {
        // Show recovery modal if permission is broken
        if (micResult.needsRecovery) {
          setShowMicRecoveryModal(true);
        } else {
          toast({
            title: 'Microphone Permission Required',
            description: micResult.error || 'Please allow microphone access to connect VDP.',
            variant: 'destructive',
            duration: 8000
          });
        }
        // Revert: user not really online (no mic)
        setVdpOnline(false);
        window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online: false } }));
        return; // Stop here if permission denied
      }
      debugLog('✅ Mac: Microphone permission granted, proceeding with VDP connection');
    }

    // When turning OFF: no disclaimer/credit checks, just disconnect
    if (checked && !isRecruitingContext) {
      // BYPASS: These emails skip all disclaimer and credit checks
      const bypassEmails = ['morgangorham@aoglobelife.com', 'patricasantamarina@aoglobelife.com'];
      const isBypassEmail = userEmail && bypassEmails.includes(userEmail.toLowerCase().trim());

      // DEMO/BYPASS: Skip credit checks for demo mode and bypass emails (same as /connect policy)
      if (VDP_CREDIT_BLOCKERS_ENABLED && !isAnyDemo && !isBypassEmail) {
        const disclaimerAcceptedInStorage = localStorage.getItem('vdp_missed_call_disclaimer_accepted');
        debugLog('🔍 Disclaimer check - storage:', disclaimerAcceptedInStorage, 'state:', disclaimerAccepted);

        if (!disclaimerAcceptedInStorage || !disclaimerAccepted) {
          debugLog('⚠️ Disclaimer not accepted - showing disclaimer modal');
          setPendingToggle(checked);
          setShowDisclaimer(true);
          return;
        }

        if (hasLowCredits) {
          debugLog('⚠️ Low credits detected:', creditsRemaining);
          toast({
            title: 'Insufficient Credits',
            description: 'Your account balance is too low. Please purchase credits to continue using ConnectNow.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    debugLog('✅ All checks passed, proceeding with inbound Online/Offline toggle');

    try {
      // Taalk open/close is driven by the same fetch + openVDPInterface path as /connect (not a recruit-only toggle open).

      // Backend status (optional; TaskRouter already updated at top of handler)
      const response = await fetch('/api/vdp/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          status: checked ? 'active' : 'inactive'
        }),
      });

      if (!response.ok) {
        console.warn('Failed to update backend VDP status');
      }

      // Track usage: VDP available start/end
      const sessionId = authState?.session?.id || `session-${Date.now()}`;
      try {
        if (checked) {
          // VDP turned ON - track available start
          await fetch('/api/usage/vdp-available-start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agentEmail: userEmail,
              sessionId: sessionId
            }),
          });
        } else {
          // VDP turned OFF - track available end
          await fetch('/api/usage/vdp-available-end', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agentEmail: userEmail,
              sessionId: sessionId
            }),
          });
        }
      } catch (usageError) {
        console.warn('⚠️ Failed to track VDP usage (non-blocking):', usageError);
      }

      toast({
        title: checked ? 'Inbound On' : 'Inbound Off',
        description: checked ? 'You are now available for inbound calls' : 'You are no longer available for inbound calls',
      });
    } catch (error) {
      if (checked) {
        console.warn('Backend/VDP status or usage update failed after inbound toggle dispatch:', error);
        toast({
          title: 'Inbound On',
          description: 'You are available for inbound calls. A background update failed.',
          variant: 'default',
        });
      } else {
        console.warn('Offline: backend update failed (non-blocking)', error);
      }
    }
  };

  // Check if disclaimer has been accepted
  // DISCLAIMER MODAL REMOVED - shouldShowModal always false
  const shouldShowModal = false; // Always false - disclaimers removed
  const shouldShowCreditsModal = hasLowCredits && disclaimerAccepted;

  // Never hide InboundCallHeaderPanel + Taalk mount behind this spinner — fetchUserVDPData would run with no #mount-vdp-selector (e.g. after startup diagnostic).
  if (loading && !hasLowCredits && !children) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading VDP status...</p>
        </div>
      </div>
    );
  }

  // AO Recruit must NOT early-return here: that path rendered a duplicate #mount-vdp-selector (white box),
  // dropped {children} (InboundCallHeaderPanel + live queue), and Taalk's getElementById hit the wrong node.
  // Recruit uses the same tree as /connect below — producer row + black inbound card + context ref mount.

  return (
    <TaalkVdpMountRefContext.Provider value={connectInboundMountRef}>
    <div className={`flex flex-col min-h-0 ${compact ? 'flex-1 space-y-2' : 'space-y-6'}`}>
      {/* 🎭 DEMO MODE Banner - ALWAYS AT TOP */}
      {isAnyDemo && (
        <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 p-4 text-white border-2 border-yellow-400 shadow-lg -mt-6 -mx-6 mb-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <div>
                <h3 className="text-lg font-bold">DEMO MODE - {demoProduct === 'recruit' ? 'AO Recruit' : 'AO Intelligence'}</h3>
                <p className="text-sm text-yellow-100">
                  {(isAointelDemo || isRecruitDemo)
                    ? 'Wait for VDP to load, then Start Demo. Note: This may take 60-90 seconds to connect.' 
                    : 'This is a training demo. No real calls will be made.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {vdpOnline && (
                <Button
                  onClick={handleStartDemoCall}
                  disabled={isStartingDemo}
                  className="bg-green-600 hover:bg-green-700 text-white border-0 disabled:opacity-50"
                >
                  {isStartingDemo ? 'Starting...' : 'Start Demo Call'}
                </Button>
              )}
              <Button
                onClick={handleExitDemo}
                variant="outline"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                Exit Demo
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Demo Guide Modal */}
      {isAnyDemo && (
        <DemoGuideModal
          isOpen={showDemoGuide}
          onClose={() => setShowDemoGuide(false)}
          onComplete={() => {
            // Guide completed - user can now interact with the demo interface
            setShowDemoGuide(false);
          }}
          agentPhoneNumber={authState.profile?.phone}
          demoType={demoProduct === 'recruit' ? 'recruit' : 'aointel'}
        />
      )}

      {/* Demo Certification Modal */}
      {isAnyDemo && (
        <DemoCertificationModal
          isOpen={showCertification}
          onCertify={handleCertify}
          onCancel={() => {
            setShowCertification(false);
            // User canceled certification, still allow exit
            exitDemoMode();
            if ((window as any).__demoExitHandler) {
              (window as any).__demoExitHandler();
            } else {
              window.location.href = '/onboarding';
            }
          }}
          demoType={demoProduct === 'recruit' ? 'recruit' : 'aointel'}
        />
      )}

      {/* 🍎 MAC ELECTRON: Microphone Permission Recovery Modal */}
      {showMicRecoveryModal && (
        <MicrophonePermissionRecoveryModal
          open={showMicRecoveryModal}
          onOpenChange={setShowMicRecoveryModal}
        />
      )}

      {/* Boost Button REMOVED per user request */}
      
      <div className={`flex flex-col min-h-0 ${compact ? 'flex-1 space-y-2' : 'space-y-3'}`}>

        {/* Producer row moved to CallControls top when hideProducerRow */}
        {!hideProducerRow && (
          vdpData ? (
            <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
              <div className="flex items-center gap-3 text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-bold text-purple-600 cursor-help" title="Producer ID">
                        {vdpData.associate_id}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Producer ID</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">•</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className={`${isRecruitingContext ? 'bg-purple-600 text-white text-xs' : 'bg-green-600 text-white text-xs'} cursor-help`} title="Market">
                        {Array.isArray(vdpData.market) ? vdpData.market.join(', ') : vdpData.market || 'N/A'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Market</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">•</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-bold text-green-600 cursor-help">
                        {vdpData.states ? `${vdpData.states.length} states` : 'N/A'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <div className="p-2">
                        <p className="font-semibold mb-2">Licensed States:</p>
                        <div className="flex flex-wrap gap-1">
                          {vdpData.states && vdpData.states.length > 0 ? (
                            vdpData.states.map(state => (
                              <Badge key={state} variant="secondary" className="text-xs">
                                {state}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No states configured</span>
                          )}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                {loading ? '🔄 Loading VDP data...' : 
                 error ? `❌ Error: ${error}` : 
                 '⚠️ No VDP data available - click Refresh'}
              </div>
              {!loading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    fetchUserVDPData();
                  }}
                  className="mt-2 text-xs h-8"
                >
                  🔄 Load VDP Data
                </Button>
              )}
            </div>
          )
        )}

        {/* VDP Connection section removed per user request */}






        {/* Inbound panel: Online/Offline + caller info (replaces legacy Taalk iframe). AO Recruit: always show so Taalk VDP can mount. */}
        {/* CRITICAL: Always show container when children are provided (InboundCallHeaderPanel) because mount point is inside children */}
        <div
          className={`w-full max-w-full border rounded-lg flex flex-col bg-black ${
            boostActive
              ? 'border-purple-400 border-2 ring-2 ring-purple-300 ring-opacity-50'
              : 'border-white/10'
          } ${
            compact ? 'flex-1 min-h-0 overflow-hidden' : 'min-h-[800px] overflow-hidden'
          }`}
          style={{
            // Always show if: recruiting context, OR has children (mount point is inside), OR no low credits/legacy panel
            // Always show if: recruiting context, OR has children (mount point is inside), OR no low credits/legacy panel
            display: (!!children || (!hasLowCredits && !showLegacyPanel)) ? 'flex' : 'none',
            ...(boostActive
              ? { boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }
              : {}),
          }}
        >
          {/* Body: With InboundCallHeaderPanel as children, min-h-0 so Taalk + live queue stack; recruit scrolls on outer card — do not clip queue here */}
          <div
            className={`flex-1 min-h-0 flex flex-col overflow-hidden ${children ? 'min-h-0' : 'min-h-[800px]'}`}
          >
            {/* Only render mount container if no children (no context ref) - otherwise InboundCallHeaderPanel has the real mount */}
            {!children && (
              <div 
                id="mount-vdp-selector" 
                data-taalk-vdp="mount" 
                ref={(el) => { localVdpContainerRef.current = el; }}
                className="flex-1 w-full min-h-[600px]"
                style={{ minHeight: 600 }}
              />
            )}
            {/* Render children if provided (InboundCallHeaderPanel) */}
            {children && (
              <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden relative z-10">
                {children}
              </div>
            )}
          </div>
        </div>

        {/* InboundSuccessViewer slider is rendered by InboundCallHeaderPanel (passed as children) — not duplicated here */}

        {/* Loading state when VDP script not yet loaded — never show for recruit; Taalk mount stays visible so old VDP can load */}
        {!taalkLoaded && disclaimerAccepted && !hasLowCredits && !showLegacyPanel && (
          <div className="w-full min-h-[800px] border rounded-lg flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-gray-200 dark:border-gray-700">
            <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-500" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading VDP...</p>
          </div>
        )}
        
        {/* Show blocked message if disclaimer not accepted — never for recruit; load old VDP with no questions */}
        {!disclaimerAccepted && (
          <div className="w-full h-[600px] border border-red-300 dark:border-red-700 rounded-lg overflow-hidden bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center text-center p-8">
              <PhoneOff className="h-16 w-16 text-red-600 dark:text-red-400 mb-4" />
              <h3 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2">
                Disclaimer Required
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 max-w-md mb-4">
                You must accept the missed call billing disclaimer before accessing ConnectNow.
              </p>
              <Button
                onClick={() => setShowDisclaimer(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                Review Disclaimer
              </Button>
            </div>
          </div>
        )}
        
        {/* Show blocked message if credits insufficient — never for recruit */}
        {disclaimerAccepted && hasLowCredits && (
          <div className="w-full h-[600px] border border-orange-300 dark:border-orange-700 rounded-lg overflow-hidden bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center text-center p-8">
              <PhoneOff className="h-16 w-16 text-orange-600 dark:text-orange-400 mb-4" />
              <h3 className="text-xl font-semibold text-orange-700 dark:text-orange-300 mb-2">
                Insufficient Credits
              </h3>
              <p className="text-sm text-orange-600 dark:text-orange-400 max-w-md mb-4">
                Your account balance is too low to access ConnectNow. You currently have {creditsRemaining} credits. Please purchase credits to continue.
              </p>
              <Button
                onClick={creditPurchaseModal ? () => creditPurchaseModal.openCreditPurchaseModal() : undefined}
                asChild={!creditPurchaseModal}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creditPurchaseModal ? <span>Buy Credits</span> : <a href="/dashboard/billing-dashboard">Buy Credits</a>}
              </Button>
            </div>
          </div>
        )}




        {/* Connection Health Monitor - Show when there are connection issues */}
        {(error || failedRequests > 2) && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
            <ConnectionHealthMonitor 
              email={userEmail} 
              showMinimal={true}
              autoCheck={true}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Low Credits Warning Modal - Shows over VDP component */}
      <LowCreditsReminderModal />

      {/* Low Credits Block Modal - Blocks VDP if credits < 50 */}
      <LowCreditsBlockModal
        isOpen={shouldShowCreditsModal}
        creditsRemaining={creditsRemaining}
      />

      {/* DISCLAIMER MODAL REMOVED - All users bypass disclaimers for /connect */}
    </div>
    </TaalkVdpMountRefContext.Provider>
  );
}