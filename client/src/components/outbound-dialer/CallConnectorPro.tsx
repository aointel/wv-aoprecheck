import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useCallConnectorHeartbeat } from '@/hooks/use-call-connector-heartbeat';
import { useCallConnectorActivity } from '@/hooks/use-call-connector-activity';
import { apiRequest, segmentedFetch } from '@/lib/queryClient';
import { Calendar, Clock, Video, Phone, MapPin, User, Music, Globe, Bot, Send, Search, Coins, Users, CheckCircle, Loader2, RefreshCw, Flame, Rocket, BookOpen, Monitor } from 'lucide-react';
import AppVolumeControl from '@/components/ui/AppVolumeControl';
import ZoomControl from '@/components/ui/ZoomControl';
// import VDPCallHandler from './VDPCallHandler';
// import VDPController from './VDPController';
import { SimpleAppointmentModal } from '../appointments/SimpleAppointmentModal';
import { AOIMeetModal } from '../modals/AOIMeetModal';
import { useCreditPurchaseModalOptional } from '@/contexts/CreditPurchaseModalContext';
// DISCLAIMER MODAL REMOVED - All users bypass disclaimers
// import { CallConnectorProDisclaimerModal } from '@/components/modals/CallConnectorProDisclaimerModal';
import ActivityGoal from './ActivityGoal';
import { ProductionRankBadge } from './ProductionRankBadge';
import { useAgentDiagnostics } from '@/hooks/use-agent-diagnostics';
import StartupSequence from './StartupSequence';
import { NewUserGuideModal } from '@/components/training/NewUserGuideModal';
import { MarketStatusModal } from '@/components/modals/MarketStatusModal';

/** When tab was hidden longer than this, force refresh leads - prevents dialing reassigned leads */
const STALE_TAB_TTL_MS = 10 * 60 * 1000; // 10 minutes
import { HotleadProgressCounter } from './HotleadProgressCounter';
// DISABLED: import NewLeadsNotification from './NewLeadsNotification';

// Declare global Taalk VDP functions
declare global {
  interface Window {
    TaalkVDP?: {
      open: (agentId: string, params: { states: string[], market?: any, first_name?: string, last_name?: string }) => void;
      close: () => void;
      disconnect: () => void;
    };
    TaalkVDPSettings?: {
      APIKey: string;
      container: string;
      onLoad?: () => void;
      onStatusChange?: (online: boolean) => void;
    };
  }
}

const DEBUG_CCPRO = false;
function debugLog(..._args: unknown[]) {
  if (DEBUG_CCPRO) console.log(..._args);
}

interface VDPData {
  success: boolean;
  customer_id: string;
  associate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  states: string[];
  market: string | string[];
  vdpActive: string;
}

/** Format DOB: Excel serial (e.g. 20771) -> readable date; already date-like strings pass through. */
const formatDob = (raw: string | number | null | undefined): string => {
  if (raw == null || raw === '') return '-';
  const s = String(raw).trim();
  if (!s) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return s;
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n > 0 && n < 100000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return s;
};

// FTC Compliance function for frontend filtering
const isCallPermissibleFrontend = (leadState: string, ftcRestricted?: string): boolean => {
  // Enforce call-window by timezone regardless of ftcrestricted override values.

  if (!leadState) return false; // Block if no state provided

  // FTC timezone mappings
  const stateTimezones: Record<string, string> = {
    // Eastern Time
    'FL': 'America/New_York', 'GA': 'America/New_York', 'SC': 'America/New_York',
    'NC': 'America/New_York', 'VA': 'America/New_York', 'MD': 'America/New_York',
    'DE': 'America/New_York', 'NJ': 'America/New_York', 'NY': 'America/New_York',
    'CT': 'America/New_York', 'RI': 'America/New_York', 'MA': 'America/New_York',
    'VT': 'America/New_York', 'NH': 'America/New_York', 'ME': 'America/New_York',
    'PA': 'America/New_York', 'OH': 'America/New_York', 'WV': 'America/New_York',
    'KY': 'America/New_York', 'TN': 'America/New_York',
    'MI': 'America/Detroit', 'IN': 'America/Indiana/Indianapolis',

    // Central Time
    'AL': 'America/Chicago', 'AR': 'America/Chicago', 'IL': 'America/Chicago',
    'IA': 'America/Chicago', 'KS': 'America/Chicago', 'LA': 'America/Chicago',
    'MN': 'America/Chicago', 'MS': 'America/Chicago', 'MO': 'America/Chicago',
    'NE': 'America/Chicago', 'ND': 'America/Chicago', 'OK': 'America/Chicago',
    'SD': 'America/Chicago', 'TX': 'America/Chicago', 'WI': 'America/Chicago',

    // Mountain Time
    'AZ': 'America/Phoenix', 'CO': 'America/Denver', 'ID': 'America/Denver',
    'MT': 'America/Denver', 'NV': 'America/Denver', 'NM': 'America/Denver',
    'UT': 'America/Denver', 'WY': 'America/Denver',

    // Pacific Time
    'CA': 'America/Los_Angeles', 'OR': 'America/Los_Angeles', 'WA': 'America/Los_Angeles',

    // Alaska & Hawaii
    'AK': 'America/Anchorage', 'HI': 'Pacific/Honolulu'
  };

  const timezone = stateTimezones[leadState.toUpperCase()];
  if (!timezone) return false; // Block if timezone unknown

  try {
    // Get current UTC time, then convert to lead's timezone
    const now = new Date();

    // Create a formatter for the lead's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentTimeInMinutes = hour * 60 + minute;

    // FTC allows 8 AM (480 minutes) to 9 PM (1260 minutes) in LEAD'S timezone
    const isPermissible = currentTimeInMinutes >= 480 && currentTimeInMinutes <= 1260;

    if (!isPermissible) {
      debugLog(`🚫 FRONTEND FTC: ${leadState} not callable at ${hour}:${String(minute).padStart(2, '0')} (${timezone})`);
    } else {
      debugLog(`✅ FRONTEND FTC: ${leadState} callable at ${hour}:${String(minute).padStart(2, '0')} (${timezone}) [ftc=${ftcRestricted ?? 'null'}]`);
    }

    return isPermissible;
  } catch (error) {
    console.error('❌ Frontend FTC error:', error);
    return false; // Fail closed on FTC calculation errors
  }
};

const getLeadStateForFtc = (lead: any): string =>
  String(lead?.state || lead?.taalk_state || '').toUpperCase().trim();

interface Lead {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  state: string;
  market: string;
  email?: string;
  city?: string;
  groupName?: string;
  ftcrestricted?: string; // YES = restrict, NO = allow anytime
  ao_lead_box?: string; // Alternative snake_case field name from API
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

const APPOINTMENT_TYPES = [
  { value: 'consultation', label: 'Initial Consultation', duration: 60, color: 'bg-blue-500' },
  { value: 'follow-up', label: 'Follow-up Call', duration: 30, color: 'bg-green-500' },
  { value: 'presentation', label: 'Product Presentation', duration: 90, color: 'bg-purple-500' },
  { value: 'closing', label: 'Closing Meeting', duration: 120, color: 'bg-orange-500' },
];

const STATE_TZ: Record<string,string> = {CT:'ET',DE:'ET',FL:'ET',GA:'ET',IN:'ET',ME:'ET',MD:'ET',MA:'ET',MI:'ET',NH:'ET',NJ:'ET',NY:'ET',NC:'ET',OH:'ET',PA:'ET',RI:'ET',SC:'ET',VT:'ET',VA:'ET',WV:'ET',AL:'CT',AR:'CT',IL:'CT',IA:'CT',KS:'CT',KY:'CT',LA:'CT',MN:'CT',MS:'CT',MO:'CT',NE:'CT',ND:'CT',OK:'CT',SD:'CT',TN:'CT',TX:'CT',WI:'CT',AZ:'MT',CO:'MT',ID:'MT',MT:'MT',NM:'MT',UT:'MT',WY:'MT',AK:'AKT',CA:'PT',NV:'PT',OR:'PT',WA:'PT',HI:'HT'};

interface SV{clientFirstName:string;agentName:string;state:string;tz:string;spouseName:string;apptDateTime:string}
interface SS{id:number;title:string;critical?:boolean;content:(v:SV)=>React.ReactNode}

const VETERAN_SCRIPT:SS[]=[
  {id:0,title:'1 · Opener',content:({clientFirstName,agentName})=>(
    <div className='space-y-2 text-sm leading-relaxed'>
      <p>Hi <strong className='text-amber-500'>{clientFirstName||'[First Name]'}</strong>, this is <strong className='text-amber-500'>{agentName}</strong> with American Income Life - we work in cooperation with the Veterans organizations nationwide and Protect My Family.</p>
      <p>We are the ones that issue your Veterans burial and will kit that you <strong>requested online</strong> the other day. You remember filling that out? I believe it was through <strong>Facebook</strong>.</p>
      <p>Your kit has <strong className='text-green-500 uppercase'>BEEN PROCESSED</strong> - and it is my job to get you scheduled to issue your <strong>no-cost will kit</strong> and explain your <strong>VA Burial Benefits</strong> you and your family are entitled to.</p>
    </div>
  )},
  {id:1,title:'2 · Zoom Pitch',content:()=>(
    <div className='space-y-3 text-sm'>
      <p>Now the way we go over your benefits is through <strong>ZOOM</strong> - are you familiar with Zoom?</p>
      <div className='grid grid-cols-2 gap-2'>
        <div className='bg-green-500/10 border border-green-500/30 rounded-lg p-2'><p className='font-semibold text-green-500 text-xs mb-1'>YES</p><p className='text-xs'>So Zoom is what doctors and the VA use nowadays - it lets me share my screen and go over documents step by step.</p></div>
        <div className='bg-blue-500/10 border border-blue-500/30 rounded-lg p-2'><p className='font-semibold text-blue-400 text-xs mb-1'>NO</p><p className='text-xs'>No problem! Basically like FaceTime on your computer. Do you have a laptop with a camera or smartphone that gets emails?</p></div>
      </div>
    </div>
  )},
  {id:2,title:'3 · Spouse & Schedule',content:({state,tz,spouseName})=>(
    <div className='space-y-2 text-sm'>
      <div className='bg-amber-500/10 border border-amber-500/40 rounded p-2 text-xs font-semibold text-amber-400'>VERIFY: {state||'??'} = {tz||'??'} timezone - adjust your scheduler!</div>
      <p>These benefits apply to your <strong>spouse</strong> too. Do they have a spouse or significant other? They will <strong>NEED to be there</strong>.</p>
      <p>What is their name? <span className='text-muted-foreground text-xs'>(enter below)</span></p>
      <p>Are you{spouseName? <> and <strong className='text-amber-500'>{spouseName}</strong></> : ' (and spouse)'} retired or still working?</p>
      <p className='font-medium'>Morning / Afternoon / Evening → offer 2 specific times</p>
    </div>
  )},
  {id:3,title:'4 · Collect Info',content:({clientFirstName})=>(
    <div className='space-y-2 text-sm'>
      <p>What is a good <strong>email</strong> for the appointment confirmation and Zoom link? <span className='text-muted-foreground text-xs'>(update in profile)</span></p>
      <p>What is your <strong>date of birth</strong>, <strong className='text-amber-500'>{clientFirstName||'[Name]'}</strong>? And your spouse's?</p>
      <p className='text-xs text-muted-foreground mt-1'>I am going to send you a Zoom link - just click it, it takes you straight to our Virtual Office.</p>
    </div>
  )},
  {id:4,title:'5 · CEMENT',critical:true,content:({agentName,apptDateTime,spouseName})=>(
    <div className='space-y-2 text-sm'>
      <p className='font-bold text-red-500'>Do you have a pen and paper? I will wait.</p>
      <p>Write down: meeting with <strong className='text-amber-500'>{agentName}</strong>, my number is <strong>[your phone]</strong>, on <strong className='text-amber-500'>{apptDateTime||'[Day + Time]'}</strong>.</p>
      <p className='text-xs italic text-muted-foreground'>Have them repeat it back!</p>
      <p className='text-xs'>I work by <strong>appointments only</strong> - reserve an hour per Veteran. Give me a 5-10 min cushion.</p>
      <p className='font-semibold mt-2'>I have you set for <strong className='text-amber-500'>{apptDateTime||'[time]'}</strong> - looking forward to seeing you{spouseName? <> and <strong className='text-amber-500'>{spouseName}</strong></> : ''}!</p>
    </div>
  )},
];

export default function CallConnectorPro() {
  const { authState } = useAuth();
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const isLeaseDialerRoute =
    currentPath.includes('/dashboard/connect/leasedialer') ||
    currentPath === '/dashboard/connect' ||
    currentPath === '/connect';

  // Get current user email
  const currentUserEmail = authState?.user?.email?.toLowerCase();

  // ── AOI Command Diagnostics & Startup Sequence ──
  const { diagnostics } = useAgentDiagnostics(currentUserEmail);
  const [startupComplete, setStartupComplete] = useState(false);

  // 🔥 BYPASS: These emails get FULL ACCESS - BYPASSES ALL CHECKS
  // DISCLAIMER LOGIC REMOVED - All users bypass disclaimers
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
    'patricasantamarina@aoglobelife.com',
    'stephengarnica@aoglobelife.com'
  ];

  const isBypassEmail = currentUserEmail && bypassEmails.includes(currentUserEmail.toLowerCase().trim());

  // Send heartbeat to track active Call Connector Pro usage
  useCallConnectorHeartbeat(true);

  // Track Call Connector Pro activity (dialing, live, idle, etc.)
  const { updateActivity } = useCallConnectorActivity();

  // Check Call Connector Pro access via database (skip for bypass emails)
  const { data: accessData, isLoading: isAccessLoading, error: accessError } = useQuery({
    queryKey: ['/api/call-connector-pro/access-check', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) throw new Error('No user email available');
      // For bypass emails, return immediate access without API call
      const normalizedEmail = currentUserEmail.toLowerCase().trim();
      if (bypassEmails.includes(normalizedEmail)) {
        debugLog(`✅ CCPRO FRONTEND BYPASS: ${currentUserEmail} - FULL ACCESS - NO API CALL`);
        return {
          success: true,
          hasAccess: true,
          hasDismissedPrimer: false,
          source: 'frontend_bypass'
        };
      }
      const response = await fetch(`/api/call-connector-pro/access-check/${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) throw new Error('Failed to check access');
      return response.json();
    },
    enabled: !!currentUserEmail,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1
  });

  // 🔥 CRITICAL: Explicitly check if user has Call Connector Pro access - must be explicitly true, not loading, and not undefined
  const hasCallConnectorProAccess = accessData?.hasAccess === true && !isAccessLoading;

  // Fetch agent's licensed states
  const { data: agentStates } = useQuery<string[]>({
    queryKey: ['/api/agent/licensed-states', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return [];
      const response = await fetch(`/api/agent/licensed-states?email=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.states || [];
    },
    enabled: !!currentUserEmail,
    staleTime: 10 * 60 * 1000 // Cache for 10 minutes
  });

  // Fetch trialone status and today's dialed count
  const { data: agentStatus } = useQuery({
    queryKey: ['/api/debug/agent-live-status', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/debug/agent-live-status?agent_email=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.records?.[0] || null;
    },
    enabled: !!currentUserEmail,
    refetchInterval: 300000, // 5 min
  });

  // Fetch today's dialed count
  const { data: dailyStats } = useQuery({
    queryKey: ['/api/outbound-dialer/daily-stats', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await segmentedFetch(`/api/outbound-dialer/daily-stats?userEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentUserEmail,
    refetchInterval: 60000, // 1 min - agents need to see their stats update as they dial
  });

  // Fetch user credits
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const url = `/api/user/credits?email=${encodeURIComponent(currentUserEmail)}`;
      const response = await fetch(url, { credentials: 'include', headers: { 'x-user-email': currentUserEmail } });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentUserEmail,
    refetchInterval: 300000, // 5 min
  });

  const credits = (creditsData as any)?.credits_remaining || 0;

  const isTrial = agentStatus?.trialone === true;
  const maxTrialLeads = 50;
  const dialedToday = dailyStats?.todayDialed || 0;
  const remainingTrialLeads = isTrial ? Math.max(0, maxTrialLeads - dialedToday) : Infinity;

  // 🔥 BYPASS: Bypass emails NEVER see loading or errors - they always get access
  // Show loading while checking access (skip for bypass emails)
  if (isAccessLoading && !isBypassEmail) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">Checking Access...</h3>
        <p className="text-muted-foreground">
          Verifying Call Connector Pro permissions...
        </p>
      </div>
    );
  }


  debugLog('🚨 CALLCONNECTORPRO COMPONENT IS LOADING!');
  const [status, setStatus] = useState('Not Connected');
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [scriptMode, setScriptMode] = useState(false);
  const [scriptStage, setScriptStage] = useState(0);
  const [spouseName, setSpouseName] = useState('');
  const [apptDateTime, setApptDateTime] = useState('');
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isAOIMeetModalOpen, setIsAOIMeetModalOpen] = useState(false);

  // Queue selector state: hot (AO Queue) or plus only
  const [selectedQueue, setSelectedQueue] = useState<'hot' | 'plus'>(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ccp-selected-lead-pool');
    }
    const saved = localStorage.getItem('ccp-selected-queue');
    return saved === 'plus' ? 'plus' : 'hot';
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Disposition modal state
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);
  const [pendingDispositionLead, setPendingDispositionLead] = useState<any>(null);
  const [isNewUserGuideOpen, setIsNewUserGuideOpen] = useState(false);
  const [isMarketNeedOpen, setIsMarketNeedOpen] = useState(false);
  const [showMarketNeedTooltip, setShowMarketNeedTooltip] = useState(true);

  const creditPurchaseModal = useCreditPurchaseModalOptional();

  // Ready to Launch: from git a321947 - progress animation + webhook
  const [isRequestingLeads, setIsRequestingLeads] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchStatusText, setLaunchStatusText] = useState('Waiting to launch');
  const [launchFoundCount, setLaunchFoundCount] = useState(0);
  const [launchElapsedSec, setLaunchElapsedSec] = useState(0);
  const [launchTargetCount, setLaunchTargetCount] = useState(100);

  // Call state management
  const [callState, setCallState] = useState<'offline' | 'idle' | 'on-call' | 'post-call'>('offline');

  // Whereby + present mode state
  const [wherebyRoom, setWherebyRoom] = useState<{ roomUrl: string; hostRoomUrl: string; joinLink: string } | null>(null);
  const [presentMode, setPresentMode] = useState(false);
  const [wherebyCreating, setWherebyCreating] = useState(false);

  // VDP integration state
  const [vdpData, setVdpData] = useState<VDPData | null>(null);
  const [vdpScriptLoaded, setVdpScriptLoaded] = useState(false);
  const [vdpOnline, setVdpOnline] = useState<boolean>(false); // Track VDP online/offline status

  // Fetch VDP data for agent
  const { data: vdpRoutingData } = useQuery<VDPData>({
    queryKey: ['/api/vdp/routing', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) throw new Error('No user email');
      const response = await fetch('/api/vdp/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail })
      });
      if (!response.ok) throw new Error('Failed to fetch VDP data');
      return response.json();
    },
    enabled: !!currentUserEmail,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 1
  });

  // Store VDP data when fetched
  useEffect(() => {
    if (vdpRoutingData) {
      setVdpData(vdpRoutingData);
      debugLog('✅ VDP data loaded for Call Connector Pro:', vdpRoutingData);
      // Initialize VDP online status from data
      setVdpOnline(vdpRoutingData.vdpActive === 'true' || vdpRoutingData.vdpActive === 'ACTIVE');
    }
  }, [vdpRoutingData]);

  // Listen for VDP status changes (when agent manually turns VDP on/off)
  useEffect(() => {
    const handleVDPStatusChange = (event: CustomEvent) => {
      const { online } = event.detail;
      debugLog('📡 VDP Status Change Detected in Call Connector Pro:', online ? 'ONLINE' : 'OFFLINE');
      setVdpOnline(online);
      // No toast when going offline - Power and Inbound are separate; user can select Online anytime.
    };

    window.addEventListener('taalk-vdp-status', handleVDPStatusChange as EventListener);

    return () => {
      window.removeEventListener('taalk-vdp-status', handleVDPStatusChange as EventListener);
    };
  }, []);

  // VDP control helper functions (defined before useEffect that uses them)
  const enableVDPInbound = React.useCallback(() => {
    if (!vdpData || !window.TaalkVDP) {
      console.warn('⚠️ Cannot enable VDP inbound: VDP data or script not loaded');
      return;
    }

    // Check if VDP is already open to avoid resetting it
    const container = document.getElementById('mount-vdp-selector');
    const existingIframe = container?.querySelector('iframe');
    if (existingIframe && existingIframe.src && existingIframe.src.includes('taalk')) {
      debugLog('✅ VDP already open - skipping duplicate open() call');
      debugLog('   Existing iframe src:', existingIframe.src);
      debugLog('   Existing iframe visible:', existingIframe.offsetWidth > 0 && existingIframe.offsetHeight > 0);
      // Just update state, don't call open() again
      setVdpOnline(true);
      return;
    }

    try {
      const agentId = String(vdpData.associate_id || vdpData.customer_id || currentUserEmail);
      const states = vdpData.states || ['CA', 'TX', 'NC'];
      const marketString = Array.isArray(vdpData.market) ? vdpData.market[0] : vdpData.market;

      debugLog('🚀 Enabling VDP inbound for Call Connector Pro:', { agentId, states, market: marketString });
      window.TaalkVDP.open(agentId, {
        states,
        market: marketString,
        first_name: vdpData.first_name,
        last_name: vdpData.last_name
      });
      setVdpOnline(true); // Update local state
      debugLog('✅ VDP inbound enabled (agent online for inbound calls)');
    } catch (error) {
      console.error('❌ Failed to enable VDP inbound:', error);
    }
  }, [vdpData, currentUserEmail]);

  const disableVDPInbound = React.useCallback(() => {
    if (!window.TaalkVDP) {
      console.warn('⚠️ Cannot disable VDP inbound: TaalkVDP not loaded');
      return;
    }

    try {
      debugLog('🔌 Disabling VDP inbound for Call Connector Pro (agent offline for inbound calls)');
      // Use disconnect() instead of close() - matches VDPStatus behavior
      if (window.TaalkVDP.disconnect) {
        window.TaalkVDP.disconnect();
      } else {
        window.TaalkVDP.close();
      }
      setVdpOnline(false); // Update local state
      debugLog('✅ VDP inbound disabled (agent offline)');
    } catch (error) {
      console.error('❌ Failed to disable VDP inbound:', error);
    }
  }, []);

  // Manage VDP status based on call state and status
  useEffect(() => {
    if (!vdpData || !vdpScriptLoaded || !window.TaalkVDP) return;

    // VDP should be online when:
    // - Agent is idle (powered on, ready to dial) AND status is 'WebRTC Ready'
    // - Agent is dialing/ringing (status is 'Dialing...')
    // VDP should be offline when:
    // - Agent is on-call (status is 'Connected', callState is 'on-call')
    // - Agent is offline (callState is 'offline')
    // - Agent is post-call (waiting for disposition)

    if (callState === 'on-call' && status === 'Connected') {
      // Agent is on a live answered call - disable inbound
      debugLog('🎯 VDP: Call answered, disabling inbound');
      disableVDPInbound();
    } else if (callState === 'idle' && status === 'WebRTC Ready') {
      // Agent is powered on and idle - enable inbound
      debugLog('🎯 VDP: Agent idle and ready, enabling inbound');
      enableVDPInbound();
    } else if (status === 'Dialing...') {
      // Agent is dialing - enable inbound (available while dialing/ringing)
      debugLog('🎯 VDP: Agent dialing, enabling inbound');
      enableVDPInbound();
    } else if (callState === 'offline') {
      // Agent is offline - disable inbound
      debugLog('🎯 VDP: Agent offline, disabling inbound');
      disableVDPInbound();
    }
    // post-call state: Keep VDP offline until agent starts dialing again (handled in startDialing)
  }, [callState, status, vdpData, vdpScriptLoaded, enableVDPInbound, disableVDPInbound]);

  // Load TaalkVDP script
  useEffect(() => {
    if (vdpScriptLoaded || !vdpData) return;

    // Check if script already loaded
    if (window.TaalkVDP) {
      setVdpScriptLoaded(true);
      return;
    }

    // Check if script element exists
    if (document.getElementById('Taalk_VDP_script')) {
      // Script is loading, wait for it
      const checkInterval = setInterval(() => {
        if (window.TaalkVDP) {
          setVdpScriptLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      setTimeout(() => clearInterval(checkInterval), 5000); // Timeout after 5 seconds
      return;
    }

    // Initialize TaalkVDP settings
    if (!window.TaalkVDPSettings) {
      window.TaalkVDPSettings = {
        APIKey: "pub.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay41NDYyOWJkOS03Y2ZkLTQyYTUtYWY2Mi0xMGRmOTkzMmMzY2EiLCJuYW1lIjoiVkRQIEFQSSBLZXkiLCJzY29wZXMiOlsidmRwIl0sImV4cCI6MjA2NTg1MTI5Nn0.z-O2F_W0rkyyq-lhwmwEFt21HFW30tTu9As1-5f8O68",
        container: "#mount-vdp-selector",
        onLoad: function() {
          debugLog('✅ TaalkVDP script loaded for Call Connector Pro');
          setVdpScriptLoaded(true);
        },
        onStatusChange: function(online: boolean) {
          debugLog(`📊 TaalkVDP SDK onStatusChange callback: ${online ? 'ONLINE' : 'OFFLINE'}`);
          // Dispatch event so VDPStatus component can update
          window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online } }));
          // Update local state
          setVdpOnline(online);
        }
      };
    } else {
      // If settings already exist, update onStatusChange to dispatch events
      const originalOnStatusChange = window.TaalkVDPSettings.onStatusChange;
      window.TaalkVDPSettings.onStatusChange = function(online: boolean) {
        debugLog(`📊 TaalkVDP SDK onStatusChange callback (updated): ${online ? 'ONLINE' : 'OFFLINE'}`);
        // Call original callback if it exists
        if (originalOnStatusChange) {
          originalOnStatusChange(online);
        }
        // Dispatch event so VDPStatus component can update
        window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online } }));
        // Update local state
        setVdpOnline(online);
      };
    }

    // Load TaalkVDP script
    const script = document.createElement('script');
    script.defer = true;
    script.id = 'Taalk_VDP_script';
    script.src = 'https://lets.taalk.ai/sdk/vdp_client/michaelmandella';
    document.head.appendChild(script);

    script.onload = () => {
      debugLog('✅ TaalkVDP script loaded successfully for Call Connector Pro');
      setVdpScriptLoaded(true);
    };

    script.onerror = () => {
      console.error('❌ Failed to load TaalkVDP script');
    };
  }, [vdpData, vdpScriptLoaded]);

  // DISCLAIMER LOGIC COMPLETELY REMOVED - All users bypass disclaimers
  useEffect(() => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    setDisclaimerLoading(false);
    localStorage.setItem('call_connector_pro_disclaimer_accepted', 'true');
    debugLog('✅ DISCLAIMER BYPASSED - All disclaimers removed for Call Connector Pro');
  }, []);

  // Debug modal state changes
  useEffect(() => {
    debugLog('🔵 Modal state changed:', isAppointmentModalOpen);
  }, [isAppointmentModalOpen]);
  const [currentLead, setCurrentLead] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dialer');
  const [aiRequest, setAiRequest] = useState('');
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [lastAiExplanation, setLastAiExplanation] = useState('');
  const [appointmentData, setAppointmentData] = useState({
    appointmentType: 'consultation',
    duration: 60,
    selectedDate: new Date().toISOString().split('T')[0],
    selectedTime: '10:00',
    notes: '',
    meetingPlatform: 'AOI Meet'
  });

  // Inbound call state
  const [inboundCall, setInboundCall] = useState<any>(null);
  const [callTakeover, setCallTakeover] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  // Track if actively dialing for optimized polling
  const isActivelyDialingRef = useRef(false);
  // CRITICAL: Track if agent is on a LIVE call - PAUSE all lead refreshes when true
  const isOnLiveCallRef = useRef(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-fetch ALL leads from masterlead database - no market selection needed
  const userEmail = authState?.user?.email;
  const queueDebugEnabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('queueDebug') === '1' ||
      localStorage.getItem('QUEUE_DEBUG') === '1' ||
      (window as any).__QUEUE_DEBUG === true);






  const { data: leadsData, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: [isLeaseDialerRoute ? '/api/leasedialer/sync' : '/api/outbound-dialer/leads', userEmail, selectedQueue],
    queryFn: async () => {
      // ✅ Use apiRequest for auth headers (Supabase JWT + x-user-email + credentials)
      debugLog('🚀 REACT QUERY: Fetching leads for', userEmail);
      const params = new URLSearchParams({ userEmail: String(userEmail || '') });
      if (isLeaseDialerRoute) params.set('queue', selectedQueue === 'plus' ? 'plus' : 'hotlead');
      const url = isLeaseDialerRoute
        ? `/api/leasedialer/sync?${params.toString()}`
        : `/api/outbound-dialer/leads?${params.toString()}`;
      const response = await apiRequest('GET', url, undefined, userEmail);
      const data = await response.json();
      if (isLeaseDialerRoute && data?.mode !== 'leasedialer_v2') {
        throw new Error('Invalid leasedialer response mode');
      }
      debugLog('✅ REACT QUERY: Received data:', data);
      debugLog('📊 REACT QUERY: Leads count:', data.leads?.length || 0);
      debugLog('🔍 REACT QUERY: Sample lead resolutions:', data.leads?.slice(0, 5).map((l: any) => ({ id: l.id, resolution: l.cnresolution, is_hot_lead: l.is_hot_lead })));
      if (queueDebugEnabled) {
        const apiLeads = Array.isArray(data?.leads) ? data.leads : [];
        console.log('🔎 AO QUEUE DEBUG CCPRO: apiLeads (full objects)', apiLeads);
        console.table(
          apiLeads.map((lead: any, index: number) => ({
            idx: index + 1,
            id: lead?.id,
            taalk_lead_id: lead?.taalk_lead_id,
            name: `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim(),
            phone: lead?.phone,
            cn_email: lead?.cn_email,
            cnresolution: lead?.cnresolution,
            taalk_market: lead?.taalk_market,
            market: lead?.market,
            priority_score: lead?.priority_score,
            state: lead?.state,
          }))
        );
      }

      // REMOVED: Auto-assignment notifications - agents must manually request leads
      return data;
    },
    enabled: !!userEmail, // Only enable when we have userEmail
    staleTime: 10000, // ✅ Data is fresh for 10 seconds - matches refetch interval for snappy updates
    gcTime: 300000, // ✅ Cache for 5 minutes - reduces redundant fetches
    refetchOnMount: true, // Always refetch on component mount
    refetchOnWindowFocus: () => !isOnLiveCallRef.current, // ✅ Refetch when returning to tab - SKIP during live call so active lead is never replaced mid-call
    refetchOnReconnect: true, // Refetch when network reconnects
    networkMode: 'online', // ✅ Only refetch when online
    // Poll fast when leads are low, slow when full
    refetchInterval: (query) => {
      if (!userEmail) return false;
      if (isOnLiveCallRef.current) return false;
      const data = query.state.data as any;
      const leadCount = data?.leads?.length ?? 0;
      const needsMore = data?.needsMoreLeads ?? false;
      // If agent has no leads or system flagged needsMore, poll every 5s until leads arrive
      if (needsMore || leadCount === 0) return 5000;
      return 300000; // 5 min when healthy
    },
    refetchIntervalInBackground: false // ✅ Don't refetch when tab is in background - saves resources
  });

  // 🔥 REAL-TIME PRIORITY 99 DETECTION: Check every 30 seconds for super hot leads + display count
  const previousPriority99LeadsRef = useRef<Set<string | number>>(new Set());
  const [priority99Count, setPriority99Count] = useState(0);
  useEffect(() => {
    if (!userEmail) return;

    const checkPriority99Leads = async () => {
      try {
        const response = await apiRequest('GET', `/api/outbound-dialer/check-priority-99?userEmail=${encodeURIComponent(userEmail)}`, undefined, userEmail);
        const data = await response.json();
        const count = Number(data?.count ?? 0);
        setPriority99Count(count);
        const currentPriority99Ids = new Set((data.priority99LeadIds || []).map((id: string | number) => String(id)));
        const previousIds = previousPriority99LeadsRef.current;

        const newPriority99Leads = Array.from(currentPriority99Ids).filter(id => !previousIds.has(id));
        if (newPriority99Leads.length > 0) {
          if (isOnLiveCallRef.current) {
            debugLog(`🔥 PRIORITY 99: ${newPriority99Leads.length} new - deferring queue refresh until call ends (current lead stays)`);
            return;
          }
          debugLog(`🔥 PRIORITY 99: ${newPriority99Leads.length} new super hot leads - refreshing queue (current lead preserved, not replaced)`);
          refetch();
        }
        previousPriority99LeadsRef.current = currentPriority99Ids;
      } catch (error) {
        console.error('❌ Error checking priority 99 leads:', error);
      }
    };

    checkPriority99Leads();
    const interval = setInterval(checkPriority99Leads, 300000); // 5 min
    return () => clearInterval(interval);
  }, [userEmail, refetch]);

  // ⏰ STALE TAB: When returning after tab hidden > 10 min, force refresh leads - prevents dialing reassigned leads
  const tabHiddenAtRef = useRef<number | null>(null);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const setCurrentLeadIndexRef = useRef(setCurrentLeadIndex);
  setCurrentLeadIndexRef.current = setCurrentLeadIndex;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = tabHiddenAtRef.current;
        if (hiddenAt != null && userEmail && !isOnLiveCallRef.current) {
          const hiddenMs = Date.now() - hiddenAt;
          if (hiddenMs > STALE_TAB_TTL_MS) {
            debugLog(`⏰ CCP: Tab was hidden ${Math.round(hiddenMs / 60000)}m - forcing lead refresh to avoid stale reassignments`);
            toastRef.current?.({
              title: 'Refreshing leads',
              description: `You were away ${Math.round(hiddenMs / 60000)} minutes. Refreshing to avoid calling reassigned leads.`,
            });
            setCurrentLeadIndexRef.current(0); // Reset to top of queue with fresh leads
            // Clear server cache so we get fresh DB data
            fetch(`/api/admin/force-refresh-leads/${encodeURIComponent(userEmail)}`, { method: 'POST' }).catch(() => {});
            queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/leads', userEmail] });
            refetchRef.current();
          }
        }
        tabHiddenAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userEmail, queryClient, setCurrentLeadIndex]);

  // Extract leads and metadata from response
  const rawLeads = leadsData?.leads || [];
  const needsMoreLeads = leadsData?.needsMoreLeads || false;
  const webhookSent = leadsData?.webhookSent || false;

  // DISABLED: Track previous lead count for new leads notification
  // const previousLeadCountRef = useRef(0);
  // const hasBeenDismissedRef = useRef(false);
  // const dismissedAtCountRef = useRef(0);
  // const [showNewLeadsNotification, setShowNewLeadsNotification] = useState(false);

  // DISABLED: Detect new leads when count increases
  // useEffect(() => {
  //   const currentCount = rawLeads.length;
  //   const previousCount = previousLeadCountRef.current;
  //
  //   // Only show notification if:
  //   // 1. Leads increased
  //   // 2. We had leads before (not initial load)
  //   // 3. Either not dismissed yet OR leads have increased beyond when it was dismissed
  //   const hasNewLeads = currentCount > previousCount && previousCount > 0;
  //   const isNewIncrease = !hasBeenDismissedRef.current || currentCount > dismissedAtCountRef.current;
  //
  //   if (hasNewLeads && isNewIncrease) {
  //     setShowNewLeadsNotification(true);
  //     hasBeenDismissedRef.current = false; // Reset dismissed flag for new notification
  //   }
  //
  //   // Update ref after a delay to allow notification to show
  //   const timer = setTimeout(() => {
  //     previousLeadCountRef.current = currentCount;
  //   }, 100);
  //
  //   return () => clearTimeout(timer);
  // }, [rawLeads.length]);

  // REMOVED: Lead validation timer - not needed and encourages cheating
  // Queue should only change when agent explicitly requests leads or completes calls

  // Force double refresh on initial page load
  const hasInitialRefetchedRef = useRef(false);
  useEffect(() => {
    if (!userEmail || hasInitialRefetchedRef.current || isLoading) return;
    if (leadsData && !hasInitialRefetchedRef.current) {
      debugLog('🔄 Double refresh on initial load');
      hasInitialRefetchedRef.current = true;
      setTimeout(() => {
        refetch();
        setTimeout(() => refetch(), 1000);
      }, 500);
    }
  }, [leadsData, userEmail, isLoading, refetch]);

  const isLeadHotlead = (lead: any) =>
    lead?.is_hot_lead === true || lead?.is_hot_lead === 'true' || lead?.is_hot_lead === 1 ||
    lead?.isHotLead === true || lead?.isHotLead === 'true' ||
    lead?.source_table === 'hotleads' ||
    (lead?.taalk_market || '').toLowerCase().includes('hot lead') ||
    (lead?.market || '').toLowerCase().includes('hot lead');

  // Filter leads by selected queue: hot (AO Queue) or plus only
  const getLeadsForQueue = (queue: 'hot' | 'plus') => {
    const normalizedUserEmail = String(userEmail || '').toLowerCase().trim();
    return rawLeads.filter((lead: any) => {
      const resolution = String(lead.cnresolution ?? '').toLowerCase().trim();
      const isNullResolution = lead.cnresolution == null || resolution === '' || resolution === 'null';
      const taalkMarket = (lead.taalk_market || '').toLowerCase();
      const market = (lead.market || '').toLowerCase();
      const leadEmail = String(lead.cn_email || '').toLowerCase().trim();
      const isOwnedByUser = leadEmail !== '' && leadEmail === normalizedUserEmail;
      if (!isOwnedByUser) return false;
      if (queue === 'hot') {
        const isPlusLead = taalkMarket.includes('plus') || market.includes('plus');
        if (isPlusLead) return false;
        if (!isLeadHotlead(lead)) return false;
        return resolution === 'pending';
      }
      if (queue === 'plus') {
        const isPlusLead = taalkMarket.includes('plus') || market.includes('plus');
        return isPlusLead && (resolution === 'pending' || isNullResolution);
      }
      return false;
    });
  };

  const baseQueueLeads = getLeadsForQueue(selectedQueue);
  // Priority-99 first so they are the *following* lead (next in line). Current lead is preserved by ID and never replaced.
  const queueLeads =
    selectedQueue === 'hot'
      ? [...baseQueueLeads].sort((a: any, b: any) => {
          const pa = Number(a.priority_score) || 0;
          const pb = Number(b.priority_score) || 0;
          if (pb !== pa) return pb - pa;
          const aDate = a.assigned_date || a.created_at || '';
          const bDate = b.assigned_date || b.created_at || '';
          return bDate.localeCompare(aDate) || (b.id || 0) - (a.id || 0);
        }).slice(0, 50)
      : baseQueueLeads;

  // Enforce FTC visibility gate in queue itself (not just at dial time).
  const ftcQueueLeads = queueLeads.filter((lead: any) => {
    const stateForFtc = getLeadStateForFtc(lead);
    const isCompliant = isCallPermissibleFrontend(stateForFtc, lead.ftcrestricted);
    if (!isCompliant) {
      debugLog(`🚫 FTC QUEUE FILTER: Hiding lead ${lead?.id || lead?.taalk_lead_id} (${stateForFtc || 'UNKNOWN'})`);
    }
    return isCompliant;
  });

  // Apply search filter (preserves order)
  const filteredLeads = searchQuery.trim()
    ? ftcQueueLeads.filter((lead: any) => {
        const query = searchQuery.toLowerCase();
        return (
          lead.name?.toLowerCase().includes(query) ||
          lead.phone?.includes(query) ||
          lead.id?.toString().includes(query) ||
          lead.taalk_lead_id?.toString().includes(query)
        );
      })
    : ftcQueueLeads;

  const leads = [...filteredLeads];
  const leaseQueueSynced = isLeaseDialerRoute && leadsData?.success === true && rawLeads.length > 0;
  const leaseQueueSyncing = isLeaseDialerRoute && (isLoading || isFetching || isRequestingLeads) && !leaseQueueSynced;
  const leaseQueueBadgeLabel = leaseQueueSynced ? 'Synced' : leaseQueueSyncing ? 'Syncing' : 'Pending';
  const leaseQueueBadgeClass = leaseQueueSynced
    ? 'bg-emerald-500'
    : leaseQueueSyncing
      ? 'bg-orange-500 animate-pulse'
      : 'bg-slate-500';

  // REMOVED: Auto-assignment feature - agents must manually request leads
  // This prevents interrupting agents who are actively calling

  // Debug logs - FORCE IMMEDIATE LOGGING
  debugLog('🚨 CALLCONNECTORPRO COMPONENT RENDERED!');
  debugLog('🔍 REACT STATE: Total leads:', leads.length);
  debugLog('🔍 REACT STATE: Is loading:', isLoading);
  debugLog('🔍 REACT STATE: Error:', error);
  debugLog('🔍 REACT STATE: User email:', userEmail);


  // Store lead ID we're viewing - used to preserve on queue refresh (e.g. priority 99)
  const leadIdToPreserveRef = useRef<string | number | null>(null);

  // CRITICAL: When leads array changes (e.g. refetch from priority 99), preserve the active lead on screen
  useEffect(() => {
    if (leads.length === 0 || inboundCall) return;
    const storedId = leadIdToPreserveRef.current;
    if (storedId == null) return;
    const idx = leads.findIndex((l: any) =>
      String(l?.id) === String(storedId) || String(l?.taalk_lead_id) === String(storedId)
    );
    if (idx >= 0 && idx !== currentLeadIndex) {
      setCurrentLeadIndex(idx);
    }
  }, [leads]);

  // REMOVED: FTC auto-navigation - no auto-jumping to "first compliant" lead. Queue order is strict; agent chooses. Badge still shows Outside Hours when applicable.

  // Update current lead when leads change or VDP call is active
  // CRITICAL: When leads array refreshes (e.g. priority-99 refetch), resolve by stored ID first so we never show a different lead
  useEffect(() => {
    if (inboundCall) {
      leadIdToPreserveRef.current = null;
      setCurrentLead({
        id: inboundCall.callSid,
        name: inboundCall.leadName,
        phone: inboundCall.callerNumber,
        state: inboundCall.leadState || 'CO',
        city: inboundCall.leadCity || 'Wellington',
        market: 'Globe Market',
        email: '', // VDP calls don't have email
        groupName: 'AO Intelligence Call',
        isVDPCall: true, // Flag to identify VDP calls
        leadId: inboundCall.callSid,
        taalk_lead_id: inboundCall.callSid.replace('VDP_', '').split('_')[0] // Extract lead ID from VDP call SID
      });
      return;
    }
    if (!leads || leads.length === 0) {
      leadIdToPreserveRef.current = null;
      setCurrentLead(null);
      return;
    }
    const storedId = leadIdToPreserveRef.current;
    let index = currentLeadIndex >= leads.length ? 0 : currentLeadIndex;
    if (storedId != null) {
      const foundIdx = leads.findIndex((l: any) =>
        String(l?.id) === String(storedId) || String(l?.taalk_lead_id) === String(storedId)
      );
      if (foundIdx >= 0) index = foundIdx;
      if (foundIdx >= 0 && foundIdx !== currentLeadIndex) setCurrentLeadIndex(foundIdx);
    }
    const newLead = leads[index];
    leadIdToPreserveRef.current = newLead?.id ?? newLead?.taalk_lead_id ?? null;
    setCurrentLead(newLead);
  }, [leads, currentLeadIndex, inboundCall, selectedQueue]);

  // Navigation functions with FTC compliance filtering
  const nextLead = () => {
    let nextIndex = currentLeadIndex + 1;

    // Skip to next FTC-compliant lead
    while (nextIndex < leads.length) {
      const lead = leads[nextIndex];
      if (lead && isCallPermissibleFrontend(getLeadStateForFtc(lead), lead.ftcrestricted)) {
        setCurrentLeadIndex(nextIndex);
        debugLog(`✅ FRONTEND FTC: Advanced to compliant lead ${lead.name} (${getLeadStateForFtc(lead)})`);
        return;
      } else {
        debugLog(`🚫 FRONTEND FTC: Skipping non-compliant lead ${lead?.name} (${getLeadStateForFtc(lead)})`);
        nextIndex++;
      }
    }

    // If no compliant leads found ahead, stay at current position
    toast({
      title: "No More Callable Leads",
      description: "No FTC-compliant leads available ahead",
      variant: "destructive"
    });
  };

  const previousLead = () => {
    let prevIndex = currentLeadIndex - 1;

    // Skip to previous FTC-compliant lead
    while (prevIndex >= 0) {
      const lead = leads[prevIndex];
      if (lead && isCallPermissibleFrontend(getLeadStateForFtc(lead), lead.ftcrestricted)) {
        setCurrentLeadIndex(prevIndex);
        debugLog(`✅ FRONTEND FTC: Moved back to compliant lead ${lead.name} (${getLeadStateForFtc(lead)})`);
        return;
      } else {
        debugLog(`🚫 FRONTEND FTC: Skipping non-compliant lead ${lead?.name} (${getLeadStateForFtc(lead)})`);
        prevIndex--;
      }
    }

    // If no compliant leads found behind, stay at current position
    toast({
      title: "No Previous Callable Leads",
      description: "No FTC-compliant leads available behind current position",
      variant: "destructive"
    });
  };

  // Schedule appointment function
  const scheduleAppointment = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    debugLog('🔵 Schedule Appointment clicked - currentLead:', currentLead);
    if (currentLead) {
      debugLog('🔵 Opening appointment modal...');
      setIsAppointmentModalOpen(true);
      debugLog('🔵 Modal state set to true');
    } else {
      debugLog('❌ No current lead available');
      toast({
        title: "No Lead Selected",
        description: "Please select a lead first",
        variant: "destructive"
      });
    }
  };

  // AI Lead Organization
  const organizeMutation = useMutation({
    mutationFn: async (request: { userEmail: string; organizationRequest: string }) => {
      debugLog(`🤖 AI REQUEST: "${request.organizationRequest}" for ${request.userEmail}`);
      return apiRequest('POST', '/api/outbound-dialer/organize-leads', request);
    },
    onSuccess: (data: any) => {
      debugLog(`✅ AI ORGANIZATION SUCCESS: ${data.explanation}`);
      setLastAiExplanation(data.explanation);
      setIsOrganizing(false);

      // Update leads with AI-organized order
      refetch();

      toast({
        title: "Leads Organized!",
        description: data.explanation,
        duration: 5000
      });

      // Switch back to dialer tab to see results
      setActiveTab('dialer');
    },
    onError: (error: any) => {
      console.error('❌ AI Organization Error:', error);
      setIsOrganizing(false);
      toast({
        title: "Organization Failed",
        description: "Could not organize leads with AI. Please try again.",
        variant: "destructive"
      });
    }
  });

  const organizeLeadsWithAI = async () => {
    if (!aiRequest.trim() || !authState?.user?.email) return;

    setIsOrganizing(true);
    organizeMutation.mutate({
      userEmail: authState.user.email,
      organizationRequest: aiRequest.trim()
    });
  };

  // WebRTC functions
  const powerOn = async () => {
    debugLog('🔌 Powering on WebRTC...');
    setStatus('WebRTC Ready');

    // CRITICAL: Update agent_live_call_status in Supabase when CCPro goes online
    if (authState?.user?.email) {
      try {
        await fetch('/agent/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_email: authState.user.email,
            status: 'ready'
          })
        });
        debugLog(`✅ CCPro ONLINE: Updated agent_live_call_status for ${authState.user.email}`);
      } catch (error) {
        console.error('❌ Failed to update agent_live_call_status:', error);
      }
    }

    // 🎯 VDP INTEGRATION: Enable inbound calls when powering on
    enableVDPInbound();

    toast({
      title: "WebRTC Ready",
      description: "Ready to make calls",
    });
  };

  // Single Primary CTA Handler - CLEAR STATE DEFINITIONS
  const handlePrimaryAction = async () => {
    // State 1: OFFLINE -> Go Online
    // VDP CONTROLS POWER: Enable VDP instead of manually powering on
    if (callState === 'offline') {
      debugLog('🟢 Action: Enable VDP (VDP will auto-power on Call Connector Pro)');
      await enableVDPInbound();
      // Call state will update automatically when VDP goes online and powers on CCPro
      return;
    }

    // State 2: IDLE -> Start Calling
    if (callState === 'idle') {
      if (!currentLead) {
        toast({
          title: "No Lead Selected",
          description: "Please wait for a lead to be assigned",
          variant: "destructive"
        });
        return;
      }
      debugLog('📞 Action: Start Dialing');
      await startDialing();
      return;
    }

    // State 3: ON-CALL -> End Call
    if (callState === 'on-call') {
      debugLog('🔴 Action: End Call');
      // CRITICAL: Update status FIRST, then callState will sync via useEffect
      setStatus('WebRTC Ready');
      // Also set callState directly to prevent race condition
      setCallState('post-call');
      // Show disposition modal
      if (currentLead) {
        setPendingDispositionLead(currentLead);
        setIsDispositionModalOpen(true);
      }
      return;
    }

    // State 4: POST-CALL -> Should not be clickable (handled by disposition modal)
    if (callState === 'post-call') {
      console.warn('⚠️ Primary action clicked in post-call state - this should not happen');
      // Allow reset to idle if clicked
      setCallState('idle');
      return;
    }
  };

  // Ready to Launch - one deterministic Ignite pathway (queue job + status stream)
  const handleReadyToLaunch = async () => {
    if (!userEmail || isRequestingLeads) return;
    setIsRequestingLeads(true);
    setLaunchProgress(5);
    setLaunchStatusText('Starting queue build...');
    setLaunchFoundCount(0);
    setLaunchElapsedSec(0);
    setLaunchTargetCount(100);

    try {
      // Single entry point: ignite queue job
      const res = await apiRequest('POST', '/api/leads/ignite', { agentEmail: userEmail }, userEmail);
      const data = await res.json();
      debugLog('ignite response:', data);
      if (!res.ok) {
        throw new Error(String(data?.error || data?.details || `Ignite request failed (${res.status})`));
      }
      const initialProgress = Number(data?.progress ?? 10);
      if (Number.isFinite(initialProgress)) {
        setLaunchProgress(Math.max(5, Math.min(95, initialProgress)));
      } else {
        setLaunchProgress(10);
      }
      const initialTarget = Number(data?.targetCount ?? 100);
      if (Number.isFinite(initialTarget) && initialTarget > 0) setLaunchTargetCount(initialTarget);
      const initialLeadCount = Number(data?.leadCount ?? 0);
      if (Number.isFinite(initialLeadCount) && initialLeadCount >= 0) setLaunchFoundCount(initialLeadCount);

      const rawStatusUrl = String(data?.statusUrl || "").trim();
      const statusUrl = rawStatusUrl
        ? (rawStatusUrl.endsWith('/status') ? rawStatusUrl : `${rawStatusUrl}/status`)
        : (data?.jobId ? `/api/leads/ignite/${data.jobId}/status` : '');
      if (!statusUrl) {
        throw new Error('Ignite did not return a status URL');
      }

      const startedAt = Date.now();
      const maxWaitMs = 120_000;
      const pollStatus = async () => {
        const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
        setLaunchElapsedSec(elapsedSec);
        if (Date.now() - startedAt > maxWaitMs) {
          setIsRequestingLeads(false);
          setLaunchProgress(0);
          setLaunchStatusText('Queue build still running. Refreshing queue now...');
          await refetch();
          const latestData = queryClient.getQueryData(['/api/outbound-dialer/leads', userEmail]) as any;
          const latestLeadCount = latestData?.leads?.length ?? 0;
          setLaunchFoundCount((prev) => Math.max(prev, latestLeadCount));
          toast({ title: 'Queue request still processing', description: `${latestLeadCount} leads visible so far.`, duration: 5000 });
          return;
        }

        const statusRes = await apiRequest('GET', statusUrl, undefined, userEmail);
        const statusData = await statusRes.json();
        if (!statusRes.ok) {
          throw new Error(String(statusData?.error || statusData?.details || `Status polling failed (${statusRes.status})`));
        }
        const progress = Number(statusData?.progress ?? 0);
        if (Number.isFinite(progress)) setLaunchProgress(Math.max(5, Math.min(100, progress)));
        const stage = String(statusData?.stage || 'Building queue').trim();
        const leadCount = Number(statusData?.leadCount ?? 0);
        if (Number.isFinite(leadCount) && leadCount >= 0) setLaunchFoundCount(leadCount);
        const targetCount = Number(statusData?.targetCount ?? launchTargetCount);
        if (Number.isFinite(targetCount) && targetCount > 0) setLaunchTargetCount(targetCount);
        setLaunchStatusText(`${stage} - ${Number.isFinite(leadCount) ? leadCount : 0} leads found so far.`);

        await refetch();
        const queueSnapshot = queryClient.getQueryData(['/api/outbound-dialer/leads', userEmail]) as any;
        const visibleLeads = queueSnapshot?.leads?.length ?? 0;
        setLaunchFoundCount((prev) => Math.max(prev, visibleLeads));

        const status = String(statusData?.status || '').toLowerCase();
        if (status === 'ready') {
          if (visibleLeads <= 0) {
            // Job is marked ready, but queue has not materialized yet on this client.
            // Keep polling briefly instead of announcing a false ready state.
            setLaunchStatusText('Lead pack marked ready. Waiting for pending leads to appear...');
            setTimeout(() => {
              void pollStatus();
            }, 1200);
            return;
          }
          setLaunchProgress(100);
          setIsRequestingLeads(false);
          setLaunchStatusText(`Queue ready - ${visibleLeads} pending leads available.`);
          setTimeout(() => setLaunchProgress(0), 800);
          toast({ title: `✅ ${visibleLeads} leads loaded!`, description: 'Your queue is ready.', duration: 4000 });
          return;
        }
        if (status === 'failed') {
          const reason = String(statusData?.error || 'Lead pack build failed');
          throw new Error(reason);
        }

        setTimeout(() => {
          void pollStatus();
        }, 1200);
      };

      void pollStatus();
    } catch (e) {
      setIsRequestingLeads(false);
      setLaunchProgress(0);
      setLaunchStatusText('Lead request failed');
      const msg = e instanceof Error ? e.message : 'Could not send request';
      toast({ title: 'Launch failed', variant: 'destructive', description: msg });
    }
  };

  const startDialing = async () => {
    if (!currentLead) return;

    // REMOVED: VDP status check - outbound calls work independently of VDP status
    // VDP can be online or offline, outbound dialing should always work when powered on

    // CRITICAL FTC COMPLIANCE CHECK - Block non-compliant calls
    const stateForFtc = getLeadStateForFtc(currentLead);
    if (!isCallPermissibleFrontend(stateForFtc, currentLead.ftcrestricted)) {
      debugLog(`🚫 FRONTEND FTC: BLOCKING CALL to ${currentLead.name} (${stateForFtc}) - outside calling hours`);
      toast({
        title: "Call Blocked - FTC Violation",
        description: `Cannot call ${stateForFtc || 'unknown-state'} leads outside 8 AM - 9 PM (their timezone)`,
        variant: "destructive"
      });
      return;
    }

    debugLog(`📞 FTC COMPLIANT: Starting call to ${currentLead.name} (${stateForFtc})`);
    setStatus('Dialing...');

    // 🎯 VDP INTEGRATION: Re-enable inbound while the call is ringing (agent available for inbound during ring)
    enableVDPInbound();

    const callStartedAt = Date.now();

    // Small delay to let VDP/Taalk route the call before disabling inbound.
    setTimeout(() => {
      setStatus('Connected');
      setCallState('on-call');

      // Auto-create Whereby room when call connects
      (async () => {
        try {
          setWherebyCreating(true);
          const resp = await fetch('/api/whereby/create-meeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentEmail: currentUserEmail,
              leadName: currentLead?.name || 'Guest',
              leadId: currentLead?.id || '',
            }),
          });
          const data = await resp.json();
          if (data.success && data.roomUrl) {
            setWherebyRoom({ roomUrl: data.roomUrl, hostRoomUrl: data.hostRoomUrl || data.roomUrl, joinLink: data.roomUrl });
          }
        } catch (e) {
          console.error('Whereby room creation failed:', e);
        } finally {
          setWherebyCreating(false);
        }
      })();

      // 🎯 VDP INTEGRATION: Disable inbound when call is answered/connected (agent is busy)
      disableVDPInbound();

      toast({
        title: "Dialing...",
        description: `Calling ${currentLead.name}`,
      });
    }, 500);
  };

  // Handle disposition selection
  const handleDisposition = async (disposition: 'no-answer' | 'voicemail' | 'spoke' | 'booked') => {
    if (!pendingDispositionLead) return;

    // Use numeric id for masterlead; taalk_lead_id for hot/Taalk leads (server tries both)
    const leadId = pendingDispositionLead.id ?? pendingDispositionLead.taalk_lead_id;
    if (!leadId) {
      console.error('Cannot save disposition: lead has no id or taalk_lead_id', pendingDispositionLead);
      toast({ title: 'Error', description: 'Lead ID missing - cannot save disposition', variant: 'destructive' });
      return;
    }

    const dispositionPayload = {
      leadId,
      taalk_lead_id: pendingDispositionLead.taalk_lead_id,
      phone: pendingDispositionLead.phone,
      disposition,
      agentEmail: userEmail
    };

    // Close modal and reset state
    setIsDispositionModalOpen(false);
    setPendingDispositionLead(null);
    setCallState('idle');
    setStatus('WebRTC Ready');
    setWherebyRoom(null);
    setPresentMode(false);

    // Auto-queue next call
    if (leads.length > 0) {
      const nextIndex = (currentLeadIndex + 1) % leads.length;
      setCurrentLeadIndex(nextIndex);
    }

    // Do not block the next dial on disposition persistence.
    // Retry quietly in the background to avoid breaking agent flow.
    void (async () => {
      const maxAttempts = 3;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const response = await segmentedFetch('/api/outbound-dialer/disposition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dispositionPayload)
          });

          if (response.ok) {
            toast({ title: 'Disposition Saved', description: `Lead marked as ${disposition}` });
            return;
          }

          const errData = await response.json().catch(() => ({}));
          console.warn(`Disposition save attempt ${attempt}/${maxAttempts} failed`, errData);
        } catch (error) {
          console.warn(`Disposition save attempt ${attempt}/${maxAttempts} errored`, error);
        }

        if (attempt < maxAttempts) {
          const backoffMs = attempt * 750;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }

      console.error('Disposition save failed after retries', {
        leadId: dispositionPayload.leadId,
        disposition: dispositionPayload.disposition,
      });
    })();
  };

  // Get primary button label and style - CLEAR STATE DEFINITIONS
  const getPrimaryButtonConfig = () => {
    // Ensure button state matches callState exactly
    switch (callState) {
      case 'offline':
        return {
          label: 'Go Online',
          className: 'bg-green-600 hover:bg-green-700 text-white',
          disabled: false
        };
      case 'idle':
        // Power and Inbound are separate - do not block Start Calling on vdpOnline
        return {
          label: 'Start Calling',
          className: 'bg-green-600 hover:bg-green-700 text-white',
          disabled: !currentLead || !hasCallableLeads
        };
      case 'on-call':
        // CRITICAL: Only show "End Call" if status is actually Connected or Dialing
        if (status === 'Connected' || status === 'Dialing...') {
          return {
            label: 'End Call',
            className: 'bg-red-600 hover:bg-red-700 text-white',
            disabled: false
          };
        } else {
          // Status mismatch - button shouldn't show on-call state
          console.warn('⚠️ Button state mismatch: callState=on-call but status is not Connected/Dialing');
          return {
            label: 'Start Calling',
            className: 'bg-green-600 hover:bg-green-700 text-white',
            disabled: !currentLead || !hasCallableLeads
          };
        }
      case 'post-call':
        return {
          label: 'Next Call',
          className: 'bg-blue-600 hover:bg-blue-700 text-white',
          disabled: false
        };
      default:
        // Fallback to safe state
        console.warn(`⚠️ Unknown callState: ${callState} - defaulting to idle`);
        return {
          label: 'Go Online',
          className: 'bg-green-600 hover:bg-green-700 text-white',
          disabled: false
        };
    }
  };

  // Backward compatibility: callableHotleads for hot leads only
  const callableHotleads = getLeadsForQueue('hot');
  debugLog('🔍 REACT STATE: Callable hotleads:', callableHotleads.length);
  const totalLeads = rawLeads.length;
  const callableLeads = isTrial ? remainingTrialLeads : Math.min(totalLeads, 50);
  const maxLeadsForBar = 50; // Max leads to show in energy bar

  // 🔥 POWER STATE: Only ready if there are CALLABLE leads for current queue
  const hasCallableLeads = leads.length > 0;
  const isReady = status === 'WebRTC Ready' && hasCallableLeads;
  const canDial = isReady && hasCallableLeads;

  // Auto-bind to first lead in queue when idle (index 0 only - no auto-selecting by compliance)
  useEffect(() => {
    if (callState === 'idle' && leads.length > 0 && !currentLead) {
      setCurrentLeadIndex(0);
    }
  }, [callState, leads, currentLead]);

  // Reset script state when lead changes
  useEffect(()=>{setScriptStage(0);setSpouseName('');setApptDateTime('');},[currentLeadIndex]);

  // Update call state based on status - CLEAR STATE DEFINITIONS
  // CRITICAL: This ensures button states are always in sync with actual call status
  useEffect(() => {
    // State 1: OFFLINE - WebRTC not connected
    if (status === 'Not Connected') {
      if (callState !== 'offline') {
        debugLog('📴 State change: OFFLINE (WebRTC not connected)');
        setCallState('offline');
      }
      return;
    }

    // State 2: IDLE - WebRTC ready, no active call, may or may not have lead
    if (status === 'WebRTC Ready') {
      // If we were on-call but status changed to WebRTC Ready, call ended (client hung up)
      if (callState === 'on-call') {
        debugLog('📞 Call ended unexpectedly - status changed to WebRTC Ready while on-call');
        setCallState('post-call');
        // Show disposition modal if we have a current lead
        if (currentLead) {
          setPendingDispositionLead(currentLead);
          setIsDispositionModalOpen(true);
        }
        return;
      }
      // Normal idle state
      if (callState !== 'idle' && callState !== 'post-call') {
        debugLog('✅ State change: IDLE (WebRTC ready, no active call)');
        setCallState('idle');
      }
      return;
    }

    // State 3: ON-CALL - Actively dialing or connected
    if (status === 'Connected' || status === 'Dialing...') {
      if (callState !== 'on-call') {
        debugLog(`📞 State change: ON-CALL (status: ${status})`);
        setCallState('on-call');
      }
      return;
    }

    // Fallback: If status is something unexpected but we're on-call, reset
    if (callState === 'on-call' && status !== 'Connected' && status !== 'Dialing...') {
      console.warn(`⚠️ Unexpected status "${status}" while on-call - resetting to idle`);
      setCallState('idle');
      setStatus('WebRTC Ready');
    }
  }, [status, currentLead, callState]);

  useEffect(() => {
    localStorage.setItem('ccp-selected-queue', selectedQueue);
  }, [selectedQueue]);

  const handleQueueSwitch = (queue: 'hot' | 'plus') => {
    if (callState === 'on-call') {
      toast({
        title: "Cannot Switch Queue",
        description: "Please end your current call before switching queues",
        variant: "destructive"
      });
      return;
    }
    setCurrentLead(null);
    setCurrentLeadIndex(0);
    setSelectedQueue(queue);
  };

  // 🔥 TRACK ACTIVE DIALING: Update ref for optimized polling
  useEffect(() => {
    isActivelyDialingRef.current = isReady && currentLead !== null;
  }, [isReady, currentLead]);

  // CRITICAL: Track when agent is on a LIVE call - PAUSE all lead refreshes (refetch, validate, priority 99)
  useEffect(() => {
    isOnLiveCallRef.current = callState === 'on-call';
  }, [callState]);

  // 🔥 AUTO-POWER OFF: If powered on but no callable leads, turn off
  useEffect(() => {
    if (status === 'WebRTC Ready' && !hasCallableLeads) {
      debugLog('🔌 AUTO-POWER OFF: No callable leads available');
      setStatus('Not Connected');

      // Update presence to offline
      if (authState?.user?.email) {
        fetch('/agent/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_email: authState.user.email,
            status: 'offline'
          })
        }).catch(err => console.error('❌ Failed to update presence:', err));
      }

      toast({
        title: "Power Off",
        description: "No callable leads available. Power automatically turned off.",
        variant: "destructive"
      });
    }
  }, [status, hasCallableLeads, authState?.user?.email]);

  // 🔥 SAFETY CHECK: Detect stuck 'on-call' state and auto-recover
  // This prevents the button from staying stuck in "End Call" when call actually ended
  useEffect(() => {
    if (callState === 'on-call') {
      // If we're in 'on-call' state but status is not 'Connected' or 'Dialing...',
      // we're stuck - reset to idle
      if (status !== 'Connected' && status !== 'Dialing...') {
        console.warn(`⚠️ STUCK STATE DETECTED: callState='on-call' but status='${status}' - auto-recovering`);
        setCallState('idle');
        setStatus('WebRTC Ready');
        toast({
          title: "Call Ended",
          description: "The call ended. Ready for next call.",
          variant: "default"
        });
        return;
      }

      // Safety timeout: If we're on-call for more than 2 hours, something is wrong
      const safetyTimeout = setTimeout(() => {
        console.warn('⚠️ SAFETY TIMEOUT: On-call state persisted for >2 hours - auto-recovering');
        setCallState('idle');
        setStatus('WebRTC Ready');
        toast({
          title: "Call State Reset",
          description: "Call state has been automatically reset after extended period.",
          variant: "default"
        });
      }, 2 * 60 * 60 * 1000); // 2 hours

      return () => clearTimeout(safetyTimeout);
    }
  }, [callState, status]);

  // Show loading while checking disclaimer
  if (disclaimerLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Block access if disclaimer not accepted
  if (!disclaimerAccepted) {
    return (
      <div className="space-y-6 p-6">
        <div className="w-full border border-red-300 dark:border-red-700 rounded-lg overflow-hidden bg-red-50 dark:bg-red-950/20 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center justify-center text-center p-8">
            <Phone className="h-16 w-16 text-red-600 dark:text-red-400 mb-4" />
            <h3 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2">
              Disclaimer Required
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 max-w-md mb-4">
              You must accept the Call Connector Pro disclaimer before accessing the outbound dialer.
            </p>
            <Button
              onClick={() => setShowDisclaimer(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              Review Disclaimer
            </Button>
          </div>
        </div>

        {/* Show disclaimer modal */}
        <CallConnectorProDisclaimerModal
          isOpen={showDisclaimer}
          userEmail={currentUserEmail}
          onAccept={() => {
            debugLog('✅ Call Connector Pro disclaimer accepted');
            setShowDisclaimer(false);
            localStorage.setItem('call_connector_pro_disclaimer_accepted', 'true');
            setDisclaimerAccepted(true);
          }}
          onDecline={() => {
            setShowDisclaimer(false);
            toast({
              title: 'Disclaimer Required',
              description: 'You must accept the Call Connector Pro disclaimer to use the outbound dialer.',
              variant: 'destructive',
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Conference Test Link - temp dev link */}
      <div style={{ background: '#fef9c3', border: '1px solid #f59e0b', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
        <a href="/conference-test" style={{ color: '#b45309', fontWeight: 700, fontSize: 13 }}>⚡ Open Conference Test Page</a>
      </div>
      {/* AO Intel Startup Diagnostic Sequence – runs before dialer loads */}
      {!startupComplete && currentUserEmail && (
        <StartupSequence
          userEmail={currentUserEmail}
          onComplete={() => setStartupComplete(true)}
        />
      )}

      {/* VDP Call Handler - Shows calls requiring disposition */}
      {/* {authState?.user?.email && (
        <VDPCallHandler agentEmail={authState.user.email} />
      )} */}

      {/* VDP Controller for automatic offline switching */}
      {/* {authState?.user?.email && (
        <VDPController
          agentEmail={authState.user.email}
          agentId={authState.user.email.split('@')[0] || 'producer'}
          states={['NC', 'CA']}
          onStatusChange={(online: any) => {
            debugLog(`VDP Status: ${online ? 'ONLINE' : 'OFFLINE'}`);
          }}
        />
      )} */}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h1 className="text-xl font-bold flex-shrink-0">Call Connector Pro</h1>

          {/* Queue Selector - Center */}
          <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
              <button
                onClick={() => handleQueueSwitch('hot')}
                disabled={callState === 'on-call'}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  selectedQueue === 'hot'
                    ? 'bg-white text-orange-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                } ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Flame className="w-3.5 h-3.5 shrink-0" />
                AO Queue
                <span className={`absolute -bottom-3 -right-1 text-white text-xs font-bold rounded-full min-h-5 px-1.5 flex items-center justify-center ${isLeaseDialerRoute ? leaseQueueBadgeClass : 'bg-orange-500 min-w-5'}`}>
                  {isLeaseDialerRoute ? leaseQueueBadgeLabel : getLeadsForQueue('hot').length}
                </span>
              </button>
              <button
                onClick={() => handleQueueSwitch('plus')}
                disabled={callState === 'on-call'}
                className={`px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  selectedQueue === 'plus'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                } ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                🟢 Plus Leads
              </button>
              <button
                type="button"
                onClick={() => setIsNewUserGuideOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all bg-white/20 text-white hover:bg-white/30"
                title="Open New User Guide"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                Guide
              </button>
              {/* Market Need */}
              <div className='relative'>
                <button
                  onClick={() => { setIsMarketNeedOpen(true); setShowMarketNeedTooltip(false); }}
                  className='relative flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white/20 text-white hover:bg-white/30 transition-all border border-white/20 shrink-0 animate-[market-need-glow_2s_ease-in-out_infinite]'
                  title='Market Need - where to get licensed'
                  style={{ boxShadow: '0 0 8px 2px rgba(251,191,36,0.5)' }}
                >
                  📍 Market Need
                </button>
                {showMarketNeedTooltip && (
                  <div className='absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-2 rounded-lg shadow-lg whitespace-nowrap pointer-events-none animate-bounce'>
                    Need to know where to get licensed? Click here!
                    <div className='absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-400 rotate-45' />
                  </div>
                )}
              </div>
              {/* Active Hot Leads: priority-99 count assigned today (not queue position - so it doesn't confuse with current lead) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-white/20 text-white cursor-help">
                    <Flame
                      key={priority99Count}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 animate-[hotlead-flame-pop_0.5s_ease-out]"
                      aria-hidden
                    />
                    <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                      Super hot assigned: <span
                        key={priority99Count}
                        className="inline-block tabular-nums font-bold text-orange-200 animate-[hotlead-flame-pop_0.5s_ease-out]"
                      >
                        {priority99Count}
                      </span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  Number of priority hot leads assigned to you today. Your current lead above is unchanged when this updates.
                </TooltipContent>
              </Tooltip>
              <ProductionRankBadge />
              {/* Dial / Reach / Booked - today's stats */}
              <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-white/20 shrink-0 text-xs">
                <div className="flex flex-col items-center px-2.5 py-1 bg-blue-900/50">
                  <span className="tabular-nums font-black text-blue-200 text-base leading-none">{(dailyStats?.total_dialed ?? dailyStats?.todayDialed) ?? 0}</span>
                  <span className="text-[9px] font-semibold text-blue-300/70 uppercase tracking-wide">Dials</span>
                </div>
                <div className="w-px h-full bg-white/10" />
                <div className="flex flex-col items-center px-2.5 py-1 bg-amber-900/40">
                  <span className="tabular-nums font-black text-amber-200 text-base leading-none">{dailyStats?.reached ?? 0}</span>
                  <span className="text-[9px] font-semibold text-amber-300/70 uppercase tracking-wide">Reached</span>
                </div>
                <div className="w-px h-full bg-white/10" />
                <div className="flex flex-col items-center px-2.5 py-1 bg-emerald-900/50">
                  <span className="tabular-nums font-black text-emerald-300 text-base leading-none">{dailyStats?.booked ?? 0}</span>
                  <span className="text-[9px] font-semibold text-emerald-300/70 uppercase tracking-wide">Booked</span>
                </div>
              </div>
          </div>

          {/* Script Mode Toggle */}
          <button onClick={()=>{setScriptMode(s=>!s);setScriptStage(0);setSpouseName('');setApptDateTime('');}} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${scriptMode?'bg-purple-600 border-purple-400 text-white':'bg-white/20 border-white/30 text-white hover:bg-white/30'}`}><BookOpen className='w-3.5 h-3.5' />Script {scriptMode?'ON':'OFF'}</button>

          {/* Present Mode - triggers full-screen OutboundDialerInterface overlay, not local panel */}
          {callState === 'on-call' && !document.getElementById('aoi-present-portal') && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('aoi-present-open'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <Monitor className='w-3.5 h-3.5' />
              Present
            </button>
          )}

          {/* Credits Display and Buy Button - Top Right */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
              <Coins className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">
                {credits.toLocaleString()} credits
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={creditPurchaseModal ? () => creditPurchaseModal.openCreditPurchaseModal() : undefined}
              className="h-8 px-3 text-xs bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white"
              asChild={!creditPurchaseModal}
            >
              {creditPurchaseModal ? (
                <span>Buy Credits</span>
              ) : (
                <a href="/dashboard/billing-dashboard">Buy Credits</a>
              )}
            </Button>
          </div>
        </div>

        {/* Search Input - Top Right */}
        <div className="flex-shrink-0">
          <div className={`relative transition-all ${isSearchFocused ? 'w-64' : 'w-40'}`}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/80" />
            <Input
              type="text"
              placeholder="Search leads (name, phone, ID)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              disabled={callState === 'on-call'}
              className="pl-9 pr-3 bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 focus:border-white/50 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Volume Control and Zoom Control */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-white/80 flex items-center gap-4">
            <span>🎵 Hold Music Volume Control</span>
            <span className="text-white/60">⌨️ ↑/↓: ±5% | M: Mute</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">Volume:</span>
              <AppVolumeControl className="text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">Zoom:</span>
              <ZoomControl className="text-white" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (userEmail) {
                  fetch(`/api/admin/force-refresh-leads/${encodeURIComponent(userEmail)}`, { method: 'POST' }).catch(() => {});
                  queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/leads', userEmail] });
                  refetch();
                } else {
                  window.location.reload();
                }
              }}
              className="h-8 w-8 p-0 bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white"
              title="Refresh leads"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Lead Status Banner */}
      {(needsMoreLeads || leads.length === 0) ? (
        <Card className="border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent shrink-0"></div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {leads.length === 0 ? '⬇️ Downloading Your Leads...' : '🔄 Refreshing Lead Queue...'}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {leads.length === 0
                      ? 'Please wait - do not refresh. Leads matching your markets are being assigned now. Usually takes 10-20 seconds.'
                      : `Topping up your queue (${leads.length} loaded). Should be ready in ~10 seconds.`}
                  </p>
                  <div className="mt-2 h-1.5 w-full bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: leads.length === 0 ? '55%' : `${Math.min(95, (leads.length / 50) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="border-blue-400 text-blue-700 dark:text-blue-300 shrink-0 text-xs">
                {leads.length === 0 ? '~10-20s' : `${leads.length} / 50`}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : leads.length > 0 && leads.length < 15 ? (
        <Card className="border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-yellow-500 animate-pulse shrink-0"></div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">Running low</span> - {leads.length} leads left. Downloading more automatically, do not refresh.
                </p>
              </div>
              <Badge variant="outline" className="border-yellow-400 text-yellow-700 shrink-0">{leads.length} left</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* AO Queue: Ready to Launch for hot leads; Plus loads automatically */}

      {/* Tabs removed - showing dialer content directly for more space */}
      <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lead Information - Simplified */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Current Lead
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scriptMode&&currentLead?(()=>{
                  const agentName=(currentUserEmail||'').split('@')[0].replace(/\./g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase());
                  const clientFirstName=(currentLead.name||'').split(' ')[0];
                  const tz=STATE_TZ[(currentLead.state||'').toUpperCase()]||currentLead.state||'';
                  const vars:SV={clientFirstName,agentName,state:currentLead.state||'',tz,spouseName,apptDateTime};
                  const stage=VETERAN_SCRIPT[scriptStage];
                  return(
                    <div className='space-y-3'>
                      <div className='flex items-center gap-1'>
                        {VETERAN_SCRIPT.map((s,i)=>(
                          <button key={s.id} onClick={()=>setScriptStage(i)} title={s.title} className={'flex-1 h-1.5 rounded-full transition-all '+(i===scriptStage?(s.critical?'bg-red-500':'bg-purple-500'):i<scriptStage?'bg-purple-300 dark:bg-purple-700':'bg-gray-200 dark:bg-gray-700')} />
                        ))}
                      </div>
                      <div className={'text-xs font-semibold uppercase tracking-wide '+(stage.critical?'text-red-500':'text-purple-500')}>{stage.title}</div>
                      <div className={'rounded-lg p-3 '+(stage.critical?'bg-red-500/10 border border-red-500/20':'bg-muted/50')}>{stage.content(vars)}</div>
                      {scriptStage>=2&&(
                        <div className='grid grid-cols-2 gap-2'>
                          <div><label className='text-xs text-muted-foreground'>Spouse name</label><input value={spouseName} onChange={e=>setSpouseName(e.target.value)} placeholder='Enter name' className='w-full mt-0.5 px-2 py-1 text-xs rounded border border-input bg-background' /></div>
                          <div><label className='text-xs text-muted-foreground'>Appt day/time</label><input value={apptDateTime} onChange={e=>setApptDateTime(e.target.value)} placeholder='e.g. Thu 3pm ET' className='w-full mt-0.5 px-2 py-1 text-xs rounded border border-input bg-background' /></div>
                        </div>
                      )}
                      <div className='flex gap-2'>
                        <button onClick={()=>setScriptStage(s=>Math.max(0,s-1))} disabled={scriptStage===0} className='flex-1 py-1.5 rounded text-xs font-medium border border-input bg-background hover:bg-muted disabled:opacity-30'>Back</button>
                        {scriptStage<VETERAN_SCRIPT.length-1
                          ?<button onClick={()=>setScriptStage(s=>s+1)} className='flex-1 py-1.5 rounded text-xs font-medium bg-purple-600 text-white hover:bg-purple-700'>Next</button>
                          :<button onClick={()=>{setScriptMode(false);setScriptStage(0);setSpouseName('');setApptDateTime('');}} className='flex-1 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700'>Done</button>
                        }
                      </div>
                    </div>
                  );
                })():(
                isLoading ? (
                  <div className="text-center py-4 text-gray-500">Loading leads...</div>
                ) : currentLead ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">{currentLead.name}</div>
                      {isCallPermissibleFrontend(getLeadStateForFtc(currentLead), currentLead.ftcrestricted) ? (
                        <Badge className="bg-green-600 text-white">FTC Compliant</Badge>
                      ) : (
                        <Badge variant="destructive">Outside Hours</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        <span>{currentLead.phone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{currentLead.state}</span>
                      </div>
                    </div>
                    {currentLead.market && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Market: {currentLead.market}
                      </div>
                    )}
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Date of Birth: {formatDob(currentLead.date_of_birth ?? currentLead.dateOfBirth)}
                    </div>
                  </div>
                ) : (
                  // Instructional messaging based on lead availability
                  leads.length > 0 ? (
                    <div className="text-center py-8 px-4">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Next lead ready - click 'Start Calling'
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        You have leads ready to call
                      </p>
                    </div>
                  ) : selectedQueue === 'hot' ? (
                    <div
                      className="relative rounded-xl overflow-hidden min-h-[280px] flex flex-col items-center justify-center"
                      style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #f5f3ff 55%, #eff6ff 100%)' }}
                    >
                      {/* Subtle dot grid */}
                      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                      {/* Radial hotspot glow */}
                      <div
                        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
                        style={{
                          background: 'radial-gradient(ellipse 70% 50% at 50% 80%, rgba(249,115,22,0.12) 0%, transparent 70%)',
                          opacity: (isRequestingLeads || isLoading) ? 1 : 0.5,
                        }}
                      />

                      {/* ── IDLE STATE ── */}
                      {!isRequestingLeads && !isLoading && (
                        <div className="relative z-10 flex flex-col items-center gap-3 py-6 px-6">
                          {/* Rocket on launch pad */}
                          <div className="relative flex flex-col items-center">
                            <div style={{ animation: 'ccp-rocket-idle 3s ease-in-out infinite' }}>
                              <Rocket
                                className="h-14 w-14 text-orange-500"
                                style={{ filter: 'drop-shadow(0 0 14px rgba(249,115,22,0.55)) drop-shadow(0 0 28px rgba(239,68,68,0.2))' }}
                              />
                            </div>
                            {/* Platform glow */}
                            <div
                              className="w-20 h-1 rounded-full mt-1"
                              style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.5), transparent)' }}
                            />
                            <div
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-4 rounded-full"
                              style={{ background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.35) 0%, transparent 70%)', filter: 'blur(4px)' }}
                            />
                          </div>

                          {/* Labels */}
                          <div className="text-center">
                            <div className="text-[9px] font-black tracking-[0.28em] uppercase mb-1 text-orange-400">AO Queue</div>
                            <p className="text-base font-black tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                              {isLeaseDialerRoute ? (leaseQueueSyncing ? 'Syncing Queue' : 'Queue Pending') : 'Ready to Launch'}
                            </p>
                            <p className="text-xs mt-1 leading-relaxed max-w-[200px] mx-auto text-slate-500">
                              {isLeaseDialerRoute
                                ? 'Queue sync starts automatically. Hold tight while we connect your queue.'
                                : 'Request your hot leads and arm the dialer.'}
                            </p>
                          </div>

                          {!isLeaseDialerRoute && (
                            <button
                              onClick={handleReadyToLaunch}
                              disabled={isLoading || isRequestingLeads}
                              className="relative overflow-hidden flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white text-sm mt-1"
                              style={{
                                background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                                boxShadow: '0 0 20px rgba(249,115,22,0.4), 0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.13)',
                              }}
                            >
                              <span
                                className="absolute inset-y-0 pointer-events-none"
                                style={{
                                  width: '55%',
                                  background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.16) 45%, transparent 55%)',
                                  animation: 'ccp-btn-shimmer 2.4s ease-in-out infinite',
                                }}
                              />
                              <Rocket className="w-4 h-4 relative z-10" />
                              <span className="relative z-10 tracking-wide">Sync Queue</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── LAUNCHING / LOADING STATE ── */}
                      {(isRequestingLeads || isLoading) && (
                        <div className="relative z-10 flex flex-col items-center w-full px-5 py-5 gap-4">
                          {/* Ascending rocket + exhaust */}
                          <div className="relative flex flex-col items-center" style={{ height: 80 }}>
                            <div style={{ animation: 'ccp-rocket-ascend 1.8s ease-in-out infinite' }}>
                              <Rocket
                                className="h-10 w-10 text-orange-500"
                                style={{ filter: 'drop-shadow(0 0 12px rgba(249,115,22,0.7))' }}
                              />
                            </div>
                            {/* Exhaust plume */}
                            <div className="flex flex-col items-center mt-0.5" style={{ gap: 3 }}>
                              {[
                                { w: 7,  h: 5,  color: 'rgba(253,224,71,0.95)', blur: 1, delay: '0s' },
                                { w: 11, h: 7,  color: 'rgba(251,146,60,0.8)',  blur: 2, delay: '0.08s' },
                                { w: 9,  h: 5,  color: 'rgba(239,68,68,0.6)',   blur: 3, delay: '0.16s' },
                                { w: 6,  h: 4,  color: 'rgba(185,28,28,0.35)',  blur: 5, delay: '0.24s' },
                              ].map((p, i) => (
                                <div
                                  key={i}
                                  className="rounded-full"
                                  style={{
                                    width: p.w, height: p.h,
                                    background: p.color,
                                    filter: `blur(${p.blur}px)`,
                                    animation: `ccp-exhaust 0.45s ease-in-out ${p.delay} infinite alternate`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Mission checklist */}
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
                                  <div
                                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 border transition-all duration-500"
                                    style={{
                                      background:  done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.6)',
                                      borderColor: done ? '#6ee7b7' : active ? '#fb923c' : '#e2e8f0',
                                      boxShadow:   done ? '0 0 6px rgba(52,211,153,0.3)' : active ? '0 0 6px rgba(249,115,22,0.3)' : 'none',
                                    }}
                                  >
                                    {done   && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                                    {active && <Loader2 className="w-2.5 h-2.5 text-orange-500 animate-spin" />}
                                  </div>
                                  <span
                                    className="text-xs font-medium transition-colors duration-500 flex-1"
                                    style={{ color: done ? '#059669' : active ? '#374151' : '#94a3b8' }}
                                  >
                                    {step.label}
                                  </span>
                                  {done && (
                                    <span className="text-[9px] font-black tracking-widest text-emerald-500">✓</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="w-full max-w-[230px] rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2 shadow-sm">
                            <p className="text-[11px] font-semibold text-slate-700">{launchStatusText}</p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Queue Sync</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ${leaseQueueBadgeClass}`}>
                                {leaseQueueBadgeLabel}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-400">
                              Elapsed: {launchElapsedSec}s
                            </div>
                          </div>
                        </div>
                      )}

                      <style>{`
                        @keyframes ccp-btn-shimmer {
                          0%   { left: -55%; }
                          100% { left: 120%; }
                        }
                        @keyframes ccp-rocket-idle {
                          0%, 100% { transform: translateY(0px) rotate(0deg); }
                          50%       { transform: translateY(-4px) rotate(1deg); }
                        }
                        @keyframes ccp-rocket-ascend {
                          0%, 100% { transform: translateY(0px); }
                          50%       { transform: translateY(-7px); }
                        }
                        @keyframes ccp-exhaust {
                          0%   { transform: scaleX(0.8) scaleY(0.85); opacity: 0.55; }
                          100% { transform: scaleX(1.2) scaleY(1.15); opacity: 1; }
                        }
                      `}</style>
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No leads in this queue right now
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {isLeaseDialerRoute
                          ? 'Queue sync starts automatically. No manual sync action is required.'
                          : 'Leads load automatically when assigned. Use Ready to Launch to request leads.'}
                      </p>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>

            {/* Call Controls and Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Call Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Single Primary CTA Button - not disabled by inbound; Power and Inbound are separate */}
                <Button
                  onClick={handlePrimaryAction}
                  disabled={getPrimaryButtonConfig().disabled || (callState === 'offline' && !hasCallableLeads)}
                  size="lg"
                  className={`w-full text-lg font-bold py-6 ${getPrimaryButtonConfig().className} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {getPrimaryButtonConfig().label}
                </Button>

                {/* Secondary stats - reduced visual dominance */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className={`text-2xl font-semibold ${leaseQueueSynced ? 'text-emerald-600 dark:text-emerald-400' : leaseQueueSyncing ? 'text-orange-500 animate-pulse' : 'text-gray-700 dark:text-gray-300'}`}>
                      {isLeaseDialerRoute ? leaseQueueBadgeLabel : leads.length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{isLeaseDialerRoute ? 'Queue' : 'Leads'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300">-</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Reached</div>
                  </div>
                </div>

                {/* Hidden secondary actions - only show contextually if needed */}
                {callState === 'post-call' && (
                  <div className="pt-2 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Redial same lead
                        setCallState('idle');
                        setStatus('WebRTC Ready');
                      }}
                      className="w-full text-gray-600"
                    >
                      Redial Same Lead
                    </Button>
                  </div>
                )}






                {/* Activity Goal - Replaces Lead Navigation */}
                <div className="pt-2">
                  <ActivityGoal />
                </div>

                {/* Hotlead Progress Counter */}
                <div className="pt-2">
                  <HotleadProgressCounter
                    agentEmail={authState?.user?.email || ''}
                  />
                </div>

                {/* Hot Leads Jump Button - Show if hotleads exist at positions 0-2 */}
                {leads.length > 0 && leads.slice(0, 3).some((lead: any) =>
                  lead.is_hot_lead === true || lead.is_hot_lead === 'true' || lead.is_hot_lead === 1 || lead.isHotLead === true || lead.isHotLead === 'true' || lead.isHotLead === 1 || lead.source_table === 'hotleads'
                ) && currentLeadIndex > 2 && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        // Jump to first hotlead position
                        const hotLeadIndex = leads.findIndex((lead: any) =>
                          lead.is_hot_lead === true || lead.is_hot_lead === 'true' || lead.is_hot_lead === 1 || lead.isHotLead === true || lead.isHotLead === 'true' || lead.isHotLead === 1 || lead.source_table === 'hotleads'
                        );
                        if (hotLeadIndex !== -1) {
                          // Use the same logic as the Previous/Next buttons which call their handlers
                          // We need to trigger the jump by simulating multiple previous lead clicks
                          let clicksNeeded = currentLeadIndex - hotLeadIndex;
                          const jumpToHotlead = () => {
                            if (clicksNeeded > 0) {
                              previousLead();
                              clicksNeeded--;
                              if (clicksNeeded > 0) {
                                setTimeout(jumpToHotlead, 50); // Small delay between jumps
                              }
                            }
                          };
                          jumpToHotlead();
                        }
                      }}
                      variant="default"
                      size="sm"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium"
                    >
                      🔥 Jump to Hot Leads
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        {/* All other tabs (Appointments, Meet Alex, Callbacks, Call History) removed */}
      </div>

      {/* Whereby + HPPRO Presentation Panel */}
      {false && presentMode && callState === 'on-call' && (
        <div className='rounded-xl border border-border overflow-hidden bg-background'>
          {/* Header bar */}
          <div className='flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border'>
            <span className='text-sm font-semibold flex items-center gap-2'>
              <Monitor className='w-4 h-4 text-amber-500' />
              AOI Present
            </span>
            <div className='flex items-center gap-2'>
              {wherebyRoom && (
                <button
                  onClick={async () => {
                    if (!currentLead?.phone) return;
                    await fetch('/api/support/send-sms', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: currentLead.phone,
                        body: `Your producer has invited you to a virtual meeting. Click to join: ${wherebyRoom.joinLink}`,
                      }),
                    }).catch(() => {});
                    toast({ title: 'Meeting link sent!', description: `Sent to ${currentLead.phone}` });
                  }}
                  className='flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700'
                >
                  <Send className='w-3 h-3' />
                  Send Link to Client
                </button>
              )}
              <button onClick={() => setPresentMode(false)} className='text-muted-foreground hover:text-foreground text-xs px-2'>✕</button>
            </div>
          </div>

          {/* Two-panel layout */}
          <div className='grid grid-cols-2 gap-0' style={{ height: '600px' }}>
            {/* Left: Whereby (agent video call) */}
            <div className='border-r border-border flex flex-col'>
              <div className='px-3 py-1.5 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground flex items-center gap-1'>
                <Video className='w-3 h-3' /> Video Call
                {wherebyCreating && <span className='ml-1 text-xs text-muted-foreground animate-pulse'>Creating room...</span>}
              </div>
              {wherebyRoom ? (
                <iframe
                  src={wherebyRoom.hostRoomUrl + '?background=off&skipMediaPermissionPrompt=off&displayName=' + encodeURIComponent(currentUserEmail?.split('@')[0] || 'Agent')}
                  allow='camera; microphone; fullscreen; display-capture; autoplay'
                  className='flex-1 w-full border-0'
                  style={{ minHeight: 0 }}
                />
              ) : (
                <div className='flex-1 flex items-center justify-center text-sm text-muted-foreground'>
                  {wherebyCreating ? 'Setting up video room...' : 'Video room unavailable'}
                </div>
              )}
            </div>

            {/* Right: HPPRO presentation */}
            <div className='flex flex-col'>
              <div className='px-3 py-1.5 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground flex items-center gap-1'>
                <BookOpen className='w-3 h-3' /> HPPRO Presentation
              </div>
              <iframe
                src='/api/hppro/#/StartPresentation'
                className='flex-1 w-full border-0'
                style={{ minHeight: 0 }}
                allow='camera; microphone; fullscreen'
                title='HPPRO presentation'
              />
            </div>
          </div>
        </div>
      )}

      {/* Appointment Booking Modal */}
      <NewUserGuideModal
        isOpen={isNewUserGuideOpen}
        onClose={() => setIsNewUserGuideOpen(false)}
      />

      {/* Appointment Booking Modal */}
      <SimpleAppointmentModal
        lead={{
          id: currentLead?.id || '',
          firstName: currentLead?.first_name ?? currentLead?.name?.split(' ')[0] ?? 'Unknown',
          lastName: currentLead?.last_name ?? currentLead?.name?.split(' ').slice(1).join(' ') ?? 'Lead',
          phone: currentLead?.phone || '',
          email: currentLead?.email || '',
          state: currentLead?.state || '',
          city: currentLead?.city || '',
          market: currentLead?.market || ''
        }}
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          debugLog('🔵 Modal onClose called - preventing automatic close');
          setIsAppointmentModalOpen(false);
        }}
        onBookingComplete={async () => {
          setIsAppointmentModalOpen(false);
          setActiveTab('dialer');
          // 🔥 IMMEDIATE REFETCH: Remove booked lead from queue immediately
          debugLog('🔄 Appointment booked - immediately refetching leads to remove booked lead');
          await refetch();
          // Also clear server cache to ensure fresh data
          if (userEmail) {
            try {
              await fetch(`/api/admin/force-refresh-leads/${encodeURIComponent(userEmail)}`, { method: 'POST' });
            } catch (error) {
              console.error('Failed to clear cache:', error);
            }
          }
        }}
        userEmail={authState?.user?.email || ''}
      />

      {/* AOI Meet Modal */}
      <AOIMeetModal
        isOpen={isAOIMeetModalOpen}
        onClose={() => setIsAOIMeetModalOpen(false)}
        agentName={authState?.user?.email?.split('@')[0] || 'producer'}
        producerPhone={authState?.user?.phone || ''}
        lead={currentLead ? {
          firstName: currentLead.first_name ?? currentLead.name?.split(' ')[0] ?? 'Unknown',
          lastName: currentLead.last_name ?? currentLead.name?.split(' ').slice(1).join(' ') ?? 'Lead',
          phone: currentLead.phone || ''
        } : undefined}
      />

      {/* DISABLED: New Leads Notification */}
      {/* {showNewLeadsNotification && (
        <NewLeadsNotification
          previousLeadCount={previousLeadCountRef.current}
          currentLeadCount={rawLeads.length > previousLeadCountRef.current ? rawLeads.length : previousLeadCountRef.current + Math.floor(Math.random() * 20) + 1}
          onDismiss={() => {
            setShowNewLeadsNotification(false);
            // Mark as dismissed and record the count when dismissed
            hasBeenDismissedRef.current = true;
            dismissedAtCountRef.current = rawLeads.length;
            // Reset ref after dismissing
            previousLeadCountRef.current = rawLeads.length;
          }}
        />
      )} */}

      {/* Disposition Modal - Blocking modal after every call */}
      <Dialog open={isDispositionModalOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Log This Call</DialogTitle>
            {pendingDispositionLead && (
              <p className="text-center text-sm text-muted-foreground pt-1">
                {pendingDispositionLead.first_name || pendingDispositionLead.firstName || ''} {pendingDispositionLead.last_name || pendingDispositionLead.lastName || ''} · {pendingDispositionLead.state || pendingDispositionLead.taalk_state || ''}
              </p>
            )}
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Button
              onClick={() => handleDisposition('no-answer')}
              className="h-16 flex flex-col gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-600"
              size="lg"
              variant="outline"
            >
              <span className="text-xl">📵</span>
              <span className="text-xs font-semibold">No Answer</span>
            </Button>
            <Button
              onClick={() => handleDisposition('voicemail')}
              className="h-16 flex flex-col gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-600"
              size="lg"
              variant="outline"
            >
              <span className="text-xl">📬</span>
              <span className="text-xs font-semibold">Voicemail</span>
            </Button>
            <Button
              onClick={() => handleDisposition('spoke')}
              className="h-16 flex flex-col gap-1 bg-blue-600 hover:bg-blue-700 text-white col-span-1"
              size="lg"
            >
              <span className="text-xl">💬</span>
              <span className="text-xs font-semibold">Spoke to Client</span>
            </Button>
            <Button
              onClick={() => handleDisposition('booked')}
              className="h-16 flex flex-col gap-1 bg-green-600 hover:bg-green-700 text-white col-span-1"
              size="lg"
            >
              <span className="text-xl">✅</span>
              <span className="text-xs font-semibold">Booked!</span>
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground pt-2">Select a result to continue dialing</p>
        </DialogContent>
      </Dialog>

      {/* Credit Purchase Modal - global via CreditPurchaseModalProvider */}

      {/* DISCLAIMER MODAL REMOVED - All users bypass disclaimers */}
      <MarketStatusModal isOpen={isMarketNeedOpen} onClose={() => setIsMarketNeedOpen(false)} />
    </div>
  );
}