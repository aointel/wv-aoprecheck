import React, { useEffect, useState, useRef } from 'react';
// Card components removed - using div layout to match Call Connector Pro
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

import { useToast } from '@/hooks/use-toast';
import { AccountPausedModal } from '@/components/modals/AccountPausedModal';
import { 
  MdCall, 
  MdWifi,
  MdSettings,
  MdWarning,
  MdAdd,
  MdStar
} from 'react-icons/md';
import { FaWifi, FaFire, FaRocket } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';

// Declare global Taalk VDP functions
declare global {
  interface Window {
    TaalkVDP?: {
      open: (agentId: string, params: { states: string[] }) => void;
      close: () => void;
      disconnect: () => void;
      connect: () => void;
      updateParams: (params: { states: string[] }) => void;
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
}

export default function VDPStatus({ 
  userEmail, 
  user, 
  context,
  title = "Taalk VDP",
  description = "",
  cardClassName = "",
  titleClassName = "text-lg font-semibold"
}: VDPStatusProps) {
  const [vdpData, setVdpData] = useState<VDPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vdpOnline, setVdpOnline] = useState(false);
  const [vdpInitialized, setVdpInitialized] = useState(false);
  const [showAccountPausedModal, setShowAccountPausedModal] = useState(false);
  const [taalkLoaded, setTaalkLoaded] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected' | 'wrap'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  
  // Connection type controls
  const [enableAll, setEnableAll] = useState(false);
  const [connectEnabled, setConnectEnabled] = useState(false);
  const [recruitEnabled, setRecruitEnabled] = useState(false);
  const [plusEnabled, setPlusEnabled] = useState(false);

  const { toast } = useToast();

  // Fetch VDP data from API
  const { data: creditData } = useQuery({
    queryKey: ['/api/user/credits'],
  });

  const creditsRemaining = (creditData as any)?.credits_remaining;
  
  // Debug: Force console log to track credit values
  console.log('🔍 VDP Credits Debug:', {
    creditData: creditData,
    creditsRemaining: creditsRemaining,
    type: typeof creditsRemaining,
    isUndefined: creditsRemaining === undefined,
    actualValue: creditsRemaining
  });
  const dailyConnections = 12;
  const weeklyConnections = 48;
  const connectionsToday = 8;
  
  // Check if account should be paused due to low credits - only check when data is loaded AND credits are actually 0 or less
  const isAccountPaused = creditData && creditsRemaining !== undefined && Number(creditsRemaining) <= 0;
  
  // Debug logging for credit issue
  console.log('🔍 VDP Credit Check:', {
    creditData: !!creditData,
    creditsRemaining,
    creditsRemainingNumber: Number(creditsRemaining),
    isAccountPaused,
    condition1: !!creditData,
    condition2: creditsRemaining !== undefined,
    condition3: Number(creditsRemaining) <= 0
  });

  // Initialize Taalk VDP on component mount
  useEffect(() => {
    // Only pause and show modal if account is actually paused (0 credits or less)
    if (isAccountPaused && creditsRemaining !== undefined && Number(creditsRemaining) <= 0) {
      console.log('🚫 Account paused - credits:', creditsRemaining);
      setLoading(false);
      setVdpOnline(false);
      setVdpInitialized(false);
      setShowAccountPausedModal(true);
      return;
    }

    // Load Taalk VDP SDK if not already loaded
    if (!window.TaalkVDP && !document.getElementById('Taalk_VDP_script')) {
      console.log('🔍 VDPStatus: Loading Taalk VDP script');
      if (!window.TaalkVDPSettings) {
        (window as any).TaalkVDPSettings = {
          APIKey: "pub.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay41NDYyOWJkOS03Y2ZkLTQyYTUtYWY2Mi0xMGRmOTkzMmMzY2EiLCJuYW1lIjoiVkRQIEFQSSBLZXkiLCJzY29wZXMiOlsidmRwIl0sImV4cCI6MjA2NTg1MTI5Nn0.z-O2F_W0rkyyq-lhwmwEFt21HFW30tTu9As1-5f8O68",
          container: "#mount-vdp-selector",
          onLoad: function() {
            console.log('✅ VDPStatus: TaalkVDP script loaded');
          },
          onStatusChange: function(online: boolean) {
            console.log('📡 VDPStatus: onStatusChange:', online);
            window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online } }));
          }
        };
      }
      const script = document.createElement('script');
      script.defer = true;
      script.id = 'Taalk_VDP_script';
      script.src = 'https://lets.taalk.ai/sdk/vdp_client/michaelmandella';
      document.head.appendChild(script);
    }

    // Wait for Taalk VDP to load
    const checkTaalkVDP = () => {
      if (window.TaalkVDP) {
        console.log('🔌 Taalk VDP is ready');
        setTaalkLoaded(true);
        setVdpInitialized(true);
        setLoading(false);
        
        // Fetch user VDP data and initialize
        fetchUserVDPData();
      } else {
        console.log('⏳ Waiting for Taalk VDP to load...');
        setTimeout(checkTaalkVDP, 1000);
      }
    };

    // Listen for Taalk VDP status changes (custom event from SDK via CallConnectorPro)
    const handleVDPStatusChange = (event: CustomEvent) => {
      const online = event.detail?.online;
      console.log('📡 Taalk VDP Status changed:', online ? 'ONLINE' : 'OFFLINE');
      setVdpOnline(!!online);
    };

    // Listen for ALL postMessages from VDP iframe — detect call events
    const handleVDPMessage = (event: MessageEvent) => {
      if (!event.data?.action) return;
      console.log('📡 VDP postMessage:', JSON.stringify(event.data));
      switch (event.data.action) {
        case 'vdp_status_change':
          setVdpOnline(!!event.data.online);
          if (!event.data.online && callState === 'connected') {
            setCallState('wrap');
            setTimeout(() => setCallState('idle'), 10000); // Auto-clear wrap after 10s
          }
          break;
        case 'call_started':
        case 'call_ringing':
        case 'incoming_call':
          setCallState('ringing');
          fetch('/api/agents/voice-busy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail }) }).catch(() => {});
          window.dispatchEvent(new CustomEvent('vdp-call-state', { detail: { state: 'ringing' } }));
          break;
        case 'call_connected':
        case 'call_answered':
          setCallState('connected');
          window.dispatchEvent(new CustomEvent('vdp-call-state', { detail: { state: 'busy' } }));
          break;
        case 'call_ended':
        case 'call_completed':
          setCallState('wrap');
          setTimeout(() => setCallState('idle'), 10000);
          fetch('/api/agents/voice-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail }) }).catch(() => {});
          window.dispatchEvent(new CustomEvent('vdp-call-state', { detail: { state: 'available' } }));
          break;
      }
    };

    // Mute VDP audio — kill ring sounds so they don't interfere with CCPRO
    const muteVDPAudio = () => {
      const mount = document.getElementById('mount-vdp-selector');
      if (!mount) return;
      mount.querySelectorAll('audio, video').forEach((el) => { (el as HTMLMediaElement).muted = true; (el as HTMLMediaElement).volume = 0; });
      try { mount.querySelectorAll('iframe').forEach((iframe) => { iframe.contentDocument?.querySelectorAll('audio, video').forEach((el) => { (el as HTMLMediaElement).muted = true; }); }); } catch (_) {}
    };
    const muteInterval = setInterval(muteVDPAudio, 2000);

    // CCPRO coordination — disconnect VDP during outbound calls
    const handleCCPROStart = () => { if (window.TaalkVDP) { console.log('📞 CCPRO call started — VDP disconnect'); window.TaalkVDP.disconnect(); } };
    const handleCCPROEnd = () => {
      if (window.TaalkVDP && vdpData) {
        console.log('📞 CCPRO call ended — VDP reconnect');
        const agentId = String(vdpData.associate_id || vdpData.customer_id || userEmail);
        window.TaalkVDP.open(agentId, { states: vdpData.states || [], market: vdpData.market, company_email: vdpData.email, associate_id: vdpData.associate_id });
        setVdpOnline(true);
      }
    };

    // Poll for admin-triggered reconnects (e.g. market fix push)
    const reconnectPoll = userEmail ? setInterval(async () => {
      try {
        const r = await fetch(`/api/vdp/needs-reconnect?email=${encodeURIComponent(userEmail)}`);
        const data = await r.json();
        if (data.reconnect) {
          console.log('🔄 Admin reconnect triggered — re-fetching VDP config');
          fetchUserVDPData();
        }
      } catch (_) {}
    }, 30_000) : null;

    if (userEmail) {
      checkTaalkVDP();
      window.addEventListener('taalk-vdp-status', handleVDPStatusChange as EventListener);
      window.addEventListener('message', handleVDPMessage);
      window.addEventListener('ccpro-call-start', handleCCPROStart);
      window.addEventListener('ccpro-call-end', handleCCPROEnd);
    }

    return () => {
      clearInterval(muteInterval);
      if (reconnectPoll) clearInterval(reconnectPoll);
      window.removeEventListener('taalk-vdp-status', handleVDPStatusChange as EventListener);
      window.removeEventListener('message', handleVDPMessage);
      window.removeEventListener('ccpro-call-start', handleCCPROStart);
      window.removeEventListener('ccpro-call-end', handleCCPROEnd);
    };
  }, [userEmail, isAccountPaused]);

  // Fetch user VDP routing data  
  const fetchUserVDPData = async () => {
    try {
      console.log('🔍 Fetching VDP data for:', userEmail);
      
      const response = await fetch('/api/vdp/routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: userEmail,
          context: context // This will trigger AORECRUIT hardcode when context="recruit"
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ VDP Data Loaded Successfully:', data);
        console.log('✅ Associate ID:', data.associate_id, 'States:', data.states?.length);
        setVdpData(data);
        setError(null);
        setVdpOnline(data.vdpActive === 'true' || data.vdpActive === 'ACTIVE');
        
        // Force auto-connect — always open VDP regardless of vdpActive status
        if (window.TaalkVDP) {
          const agentId = String(data.associate_id || data.customer_id || userEmail);
          const states = data.states || ['CA', 'TX', 'NC'];
          
          console.log('🚀 Auto-connecting to Taalk VDP with:', { agentId, states, market: data.market });
          window.TaalkVDP.open(agentId, { 
            states,
            market: data.market,
            company_email: data.email,
            associate_id: data.associate_id
          });
          setVdpOnline(true);
        }
      } else {
        console.error('❌ Failed to fetch VDP data:', response.status);
        setError(`Failed to load VDP data (${response.status})`);
      }
    } catch (error) {
      console.error('❌ VDP routing fetch error:', error);
      setError('Failed to load VDP configuration');
    }
  };

  // Show account paused modal when credits drop to 0 or below
  useEffect(() => {
    if (isAccountPaused && vdpInitialized && creditsRemaining !== undefined && Number(creditsRemaining) <= 0) {
      console.log('🚫 Showing paused modal - credits dropped to:', creditsRemaining);
      setVdpOnline(false);
      setShowAccountPausedModal(true);
    }
  }, [isAccountPaused, vdpInitialized, creditsRemaining]);



  const handleVDPToggle = async (checked: boolean) => {
    // Prevent toggling if account is paused (0 credits or less)
    if (isAccountPaused && creditsRemaining !== undefined && Number(creditsRemaining) <= 0) {
      console.log('🚫 Toggle blocked - account paused with credits:', creditsRemaining);
      setShowAccountPausedModal(true);
      return;
    }

    if (!window.TaalkVDP) {
      toast({
        title: 'VDP Not Ready',
        description: 'Taalk VDP is not loaded yet. Please wait and try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setVdpOnline(checked);
      
      if (checked) {
        // Connect to Taalk VDP
        if (vdpData) {
          const agentId = String(vdpData.associate_id || vdpData.customer_id || userEmail);
          const states = vdpData.states || ['CA', 'TX', 'NC'];
          
          console.log('🚀 Manually connecting to Taalk VDP:', { agentId, states, market: vdpData.market });
          window.TaalkVDP.open(agentId, { 
            states,
            market: vdpData.market,
            company_email: vdpData.email,
            associate_id: vdpData.associate_id
          });
        }
      } else {
        // Disconnect from Taalk VDP
        console.log('🔌 Disconnecting from Taalk VDP');
        window.TaalkVDP.disconnect();
      }

      // Update status in backend
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

      toast({
        title: checked ? 'VDP Connected' : 'VDP Disconnected',
        description: checked 
          ? 'You are now connected to the Taalk Voice Dialer Platform'
          : 'You have been disconnected from VDP',
      });
    } catch (error) {
      // Revert on error
      setVdpOnline(!checked);
      toast({
        title: 'Connection Error',
        description: 'Failed to update VDP connection status',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading VDP status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Professional Header - Matching Call Connector Pro */}
      <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">AO Intelligence</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <div className={`w-2 h-2 rounded-full ${vdpOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium">
                {vdpOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">


        {/* Agent Information Display */}
        {vdpData ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Agent ID:</span>
                <span className="text-sm font-bold text-purple-600">{vdpData.associate_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Market:</span>
                <Badge className={context === 'recruit' ? 'bg-purple-600 text-white text-xs' : 'bg-green-600 text-white text-xs'}>
                  {Array.isArray(vdpData.market) ? vdpData.market.join(', ') : vdpData.market || 'N/A'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">States Licensed:</span>
                <span className="text-sm font-bold text-green-600">
                  {vdpData.states ? `${vdpData.states.length} states` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">AO Intelligence Status:</span>
                <Badge variant={(vdpData.vdpActive === 'true' || vdpData.vdpActive === 'ACTIVE') ? 'default' : 'secondary'} className="text-xs">
                  {(vdpData.vdpActive === 'true' || vdpData.vdpActive === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>
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
                  console.log('🔄 Manual fetch triggered');
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
        )}

        {/* VDP Online/Offline Toggle + Call Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <FaWifi className={`h-4 w-4 ${vdpOnline ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium">{vdpOnline ? 'Online' : 'Offline'}</span>
            </div>
            <Switch
              checked={vdpOnline}
              onCheckedChange={handleVDPToggle}
            />
          </div>
          
          {/* Call Status Pill */}
          {callState !== 'idle' && (
            <div className={`text-center py-2 rounded-lg text-sm font-bold ${
              callState === 'ringing' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
              callState === 'connected' ? 'bg-green-100 text-green-800' :
              callState === 'wrap' ? 'bg-orange-100 text-orange-800' : ''
            }`}>
              {callState === 'ringing' ? '📞 INCOMING CALL' :
               callState === 'connected' ? '🔊 ON CALL' :
               callState === 'wrap' ? '📝 WRAP UP' : ''}
            </div>
          )}
          
          {/* Mute Button */}
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              const mount = document.getElementById('mount-vdp-selector');
              if (mount) {
                mount.querySelectorAll('audio, video').forEach((el) => {
                  (el as HTMLMediaElement).muted = !isMuted;
                  (el as HTMLMediaElement).volume = isMuted ? 1 : 0;
                });
              }
            }}
            className={`w-full py-2 rounded-lg text-sm font-medium border ${
              isMuted ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {isMuted ? '🔇 Unmute VDP' : '🔊 Mute VDP'}
          </button>
        </div>

        {/* Queue Stats - only show when connected */}
        {vdpOnline && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-bold text-blue-600">#1</div>
                <div className="text-xs text-muted-foreground">Queue</div>
              </div>
              <div>
                <div className="text-sm font-bold text-green-600">24</div>
                <div className="text-xs text-muted-foreground">Agents</div>
              </div>
              <div>
                <div className="text-sm font-bold text-orange-600">&lt; 1m</div>
                <div className="text-xs text-muted-foreground">Wait</div>
              </div>
            </div>
          </div>
        )}







        {/* ConnectNow outbound dialer iframe container */}
        <div id="mount-vdp-selector" data-taalk-vdp="mount" className={`w-full h-[600px] rounded-lg overflow-hidden bg-white ${
          callState === 'ringing' ? 'border-4 border-green-400 animate-pulse shadow-lg shadow-green-400/50' :
          callState === 'connected' ? 'border-2 border-green-500' :
          'border border-gray-200 dark:border-gray-700'
        }`}>
          {!taalkLoaded && (
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
              <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-500"></div>
            </div>
          )}
        </div>



        {/* Account Paused Message - only show when actually paused (0 credits or less) */}
        {isAccountPaused && creditsRemaining !== undefined && Number(creditsRemaining) <= 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <MdWarning className="h-4 w-4" />
              <span className="text-xs font-medium">Account Paused - Add Credits ({creditsRemaining} remaining)</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !isAccountPaused && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Account Paused Modal - only show when credits are actually 0 or less */}
      <AccountPausedModal
        isOpen={showAccountPausedModal && creditsRemaining !== undefined && Number(creditsRemaining) <= 0}
        onClose={() => setShowAccountPausedModal(false)}
        creditsRemaining={creditsRemaining || 0}
      />
    </div>
  );
}