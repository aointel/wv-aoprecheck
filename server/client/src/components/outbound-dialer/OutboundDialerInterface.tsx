import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiTarget, FiTrendingUp, FiClock, FiZap, FiMic } from 'react-icons/fi';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { callTrackingClient } from '@/lib/call-tracking-client';
// Global device variable - exactly like TestCall pattern
let device: any = null;
let activeCall: any = null;
let currentPSTNCallSid: string | null = null;

const powerOnWebRTC = async (identity = "agent123") => {
  console.log("🟢 ENTERED powerOnWebRTC()");
  try {
    const res = await fetch(`/api/token?identity=${identity}`);
    const token = await res.text();

    if (!token || token.length < 100 || token.includes("message")) {
      throw new Error("Received invalid token");
    }

    console.log("🔑 Got token:", token.slice(0, 40), "...");

    if (typeof (window as any).Twilio === "undefined") {
      throw new Error("Twilio SDK not loaded");
    }

    console.log("🚀 Creating Twilio Device...");
    device = new (window as any).Twilio.Device(token, { debug: true });

    device.on("ready", () => {
      console.log("✅ Twilio device ready - SESSION ESTABLISHED");
    });

    device.on("error", (error: any) => {
      console.error("❌ Twilio.Device error:", error);
    });

    device.on("connect", () => {
      console.log("📞 WebRTC connected");
    });

    device.on("disconnect", () => {
      console.log("🔌 WebRTC disconnected");
    });

    device.on("registering", () => {
      console.log("📡 Registering with Twilio servers...");
    });

    device.on("registered", () => {
      console.log("✅ Successfully registered with Twilio servers");
    });

    device.on("unregistered", () => {
      console.log("❌ Unregistered from Twilio servers");
    });

    device.on("cancel", () => {
      console.log("🚫 Call was cancelled");
    });

    device.on("incoming", (conn: any) => {
      console.log("📞 Incoming call received");
    });

    // CRITICAL: Actually register the device to establish session
    console.log("📡 Calling device.register() to establish session...");
    
    try {
      device.register();
    } catch (registerError) {
      console.error("❌ Registration failed immediately:", registerError);
    }

    // Check status multiple times to see what's happening
    setTimeout(() => {
      const status = device?.status?.() || 'unknown';
      console.log("📊 Device status after 2 seconds:", status);
      if (status !== 'ready') {
        console.log("⚠️ Device not ready, checking network connectivity...");
        
        // Check if we can reach Twilio
        fetch('https://chunderw-vpc-gll.twilio.com/v1/heartbeat', { mode: 'no-cors' })
          .then(() => console.log("✅ Can reach Twilio servers"))
          .catch(err => console.log("❌ Cannot reach Twilio servers:", err));
      }
    }, 2000);

    setTimeout(() => {
      const status = device?.status?.() || 'unknown';
      console.log("📊 Device status after 5 seconds:", status);
      if (status !== 'ready') {
        console.log("❌ WebRTC session failed to establish - possible firewall/network issue");
      }
    }, 5000);

    return true;
  } catch (err: any) {
    console.error("❌ powerOnWebRTC failed:", err);
    return false;
  }
};

// Function will be defined inside component to access state

// Import Call Connector Pro components
import { DialerState, Lead, CallDisposition } from './types';
import LeadDisplay from './LeadDisplay';
import CallControls from './CallControls';
// Call Disposition component removed per user request
import CallTrackers from './CallTrackers';
import { LeadProgressTracker } from './LeadProgressTracker';
import { LocalPresenceDisplay } from './LocalPresenceDisplay';
import { MarketSelector } from './MarketSelector';
import SimpleDialerTest from '../test/SimpleDialerTest';


const DEMO_USER_ID = 1;

export function OutboundDialerInterface() {
  console.log('🎯 Call Connector Pro interface rendering...');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const [status, setStatus] = useState('Not Connected');
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  
  // Core dialer state matching Call Connector Pro
  const [dialerState, setDialerState] = useState<DialerState>({
    webRTCConferenceActive: false,
    powered: false, // Initialize powered state
    campaignActive: false,
    dialingStatus: 'idle',
    currentCall: null,
    callNotes: '',
    selectedDisposition: '',
    availableLeads: [],
    currentLeadIndex: 0,
    callStatus: 'idle',
    callDuration: 0,
    customerCallStatus: { hasCustomer: false, hasPendingCall: false },
    vdpCallStatus: {
      hasVDPCall: false,
      vdpCall: null,
      countdownValue: 0,
      countdownActive: false
    },
    isMuted: false
  });

  // Market selection state - No hardcoded markets, requires manual selection
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  




  // Query for real daily stats from database
  const { data: dailyStats } = useQuery({
    queryKey: ['/api/outbound-dialer/daily-stats'],
    queryFn: async () => {
      const response = await fetch('/api/outbound-dialer/daily-stats');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Auto-load leads when component mounts and user is authenticated
  useEffect(() => {
    if (authState?.user?.email) {
      console.log('🚀 Auto-loading leads on component mount for:', authState.user.email);
      loadLeadsFromAPI();
      
      // Reset any stuck state - CRITICAL: Reset power state on mount
      console.log('🔄 Resetting power state on component mount');
      setDialerState(prev => ({
        ...prev,
        currentCall: null,
        dialingStatus: 'idle',
        callStatus: 'idle',
        webRTCConferenceActive: false,
        powered: false
      }));
      setIsPoweredOn(false);
      
      // Clear any stale device
      if (device) {
        console.log('🧹 Clearing stale device on mount');
        device.destroy();
        device = null;
      }
    } else {
      console.log('⏳ Waiting for user authentication before loading leads');
    }
  }, [authState?.user?.email]); // Load when user becomes authenticated

  // Load leads from API endpoint with market filtering
  const loadLeadsFromAPI = async () => {
    try {
      console.log('🔍 Loading leads from API...');
      console.log('🎯 Selected markets for filtering:', selectedMarkets);
      
      // Use POST request with JSON body (API expects POST)
      const userEmail = authState?.user?.email;
      if (!userEmail) {
        console.error('❌ NO USER EMAIL - User not authenticated');
        toast({
          title: 'Authentication Error',
          description: 'Please log in to load leads',
          variant: 'destructive'
        });
        return;
      }
      
      const requestBody = {
        userEmail: userEmail,
        selectedMarkets: ['Veteran'] // Default to Veteran market
      };
      
      console.log('🔍 Loading leads for user:', userEmail);
      
      const response = await fetch('/api/outbound-dialer/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      
      if (data.success && data.leads) {
        console.log(`✅ Loaded ${data.leads.length} leads from API`);
        
        // Convert API leads to internal format - use server-provided name field
        const convertedLeads: Lead[] = data.leads.map((lead: any) => ({
          id: lead.id,
          name: lead.name, // Use server-formatted name directly
          phone: lead.phone,
          leadId: lead.leadId, // Use server-provided leadId 
          market: lead.market || 'Veteran',
          state: lead.state || 'Unknown',
          city: lead.city || '',
          email: lead.email || '',
          status: lead.status || 'pending',
          timestamp: lead.timestamp || new Date().toISOString(),
          call_count: lead.call_attempts || 0,
          groupCode: lead.groupCode || 'N/A'
        }));
        
        setDialerState(prev => ({
          ...prev,
          availableLeads: convertedLeads,
          currentLeadIndex: convertedLeads.length > 0 ? 0 : prev.currentLeadIndex
        }));
        
        // Always show success toast when leads are loaded
        console.log(`🎯 LEADS LOADED SUCCESSFULLY: ${convertedLeads.length} leads converted and set in state`);
        toast({
          title: 'Leads Loaded Successfully',
          description: `Ready to dial ${convertedLeads.length} leads`
        });
        
        // Force a UI refresh to ensure leads display properly
        setTimeout(() => {
          console.log(`🔄 UI REFRESH: Current state has ${convertedLeads.length} leads`);
        }, 100);
      } else {
        console.log('No leads found or API error:', data.message);
        setDialerState(prev => ({
          ...prev,
          availableLeads: []
        }));
      }
    } catch (error) {
      console.error('Error loading leads:', error);
      toast({
        title: 'Error Loading Leads',
        description: 'Failed to load leads from database',
        variant: 'destructive'
      });
    }
  };

  // CSV Import functionality removed per user request

  // Remove duplicate useEffect - leads loading already handled above

  // Call timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (dialerState.dialingStatus === 'connected') {
      interval = setInterval(() => {
        setDialerState(prev => ({ 
          ...prev, 
          callDuration: prev.callDuration + 1 
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [dialerState.dialingStatus]);

  // Call lead mutation removed - using direct TestCall pattern instead



  // Guard dialLead() from broken state
  async function dialLead() {
    console.log('🚀 dialLead called - checking device and lead state');
    
    // Guard: Check WebRTC device readiness
    if (!device || device.status() !== 'ready') {
      const errorMsg = 'WebRTC device not ready';
      console.error('❌', errorMsg);
      toast({
        title: 'Device Not Ready',
        description: 'Click POWER ON first to initialize WebRTC',
        variant: 'destructive'
      });
      throw new Error(errorMsg);
    }
    
    // Guard: Check for valid lead
    const lead = dialerState?.availableLeads?.[0];
    if (!lead || !lead.phone) {
      const errorMsg = 'No valid lead available';
      console.error('❌', errorMsg);
      toast({
        title: 'No Lead Available',
        description: 'Please load leads before dialing',
        variant: 'destructive'
      });
      throw new Error(errorMsg);
    }
    
    const conferenceName = `ConnectNow-${Date.now()}`;
    console.log('🚀 DIALING using conf:', conferenceName);
    console.log('📞 Calling lead:', lead.name, lead.phone);
    
    try {
      // Agent connects to conference via WebRTC first
      const conn = device.connect({ conference: conferenceName });
      
      conn.on('accept', async () => {
        console.log('✅ Agent WebRTC connected to conference');
        
        // Then dial lead via PSTN to same conference
        const response = await fetch('/api/dial-lead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadPhone: lead.phone,
            leadName: lead.name,
            conference: conferenceName
          })
        });
        
        const result = await response.json();
        console.log('📞 Lead PSTN call result:', result);
        
        if (result.success) {
          setDialerState(prev => ({ 
            ...prev, 
            dialingStatus: 'connected',
            isConnected: true
          }));
          setStatus(`Connected to ${lead.name}`);
          // Notify VDP to disconnect during live call
          window.dispatchEvent(new Event('ccpro-call-start'));
        }
      });
      
      conn.on('disconnect', () => {
        console.log('❌ WebRTC call disconnected');
        setDialerState(prev => ({ 
          ...prev, 
          dialingStatus: 'idle',
          isConnected: false
        }));
        setStatus('Call ended');
        // Notify VDP to reconnect
        window.dispatchEvent(new Event('ccpro-call-end'));
      });
      
    } catch (error) {
      console.error('❌ Dial failed:', error);
      toast({
        title: 'Call Failed',
        description: 'Failed to connect to lead',
        variant: 'destructive'
      });
      throw error;
    }
  }



  const disconnectWebRTCDevice = () => {
    if (device) {
      device.destroy();
      device = null;
    }
    setDialerState(prev => ({ ...prev, webRTCConferenceActive: false }));
  };

  // Power button handler - simplified for Call Connector Pro with debouncing
  const [isPowerToggling, setIsPowerToggling] = useState(false);
  
  // START DIALING - Initialize WebRTC AND dial the lead
  const testSimpleCall = async (lead: Lead) => {
    try {
      console.log(`📞 START DIALING: Initializing WebRTC and calling ${lead.name} at ${lead.phone}`);
      
      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'dialing',
        currentCall: lead
      }));
      
      toast({
        title: 'Initializing Call System',
        description: `Setting up WebRTC and calling ${lead.name}...`
      });
      
      // Step 1: Initialize WebRTC Device (from test-call logic)
      console.log('🔌 Step 1: Initializing WebRTC device...');
      setStatus('Fetching token...');
      
      const res = await fetch('/api/twilio/token');
      const { token } = await res.json();
      console.log('✅ Token received:', token?.slice(0, 50) + '...');

      const Device = (window as any).Twilio?.Device;
      if (!Device) {
        throw new Error('Twilio SDK not loaded');
      }

      console.log('🚀 Creating Twilio Device...');
      device = new Device(token, { debug: true });
      (window as any).twilioDevice = device;
      
      // Set up device events BEFORE registering
      device.on('connect', (connection) => {
        console.log('🔌 WebRTC CONNECTED:', connection);
      });
      
      device.on('disconnect', (connection) => {
        console.log('🔌 WebRTC DISCONNECTED:', connection);
      });
      
      device.on('error', (error) => {
        console.error('❌ WebRTC ERROR:', error);
      });
      
      device.on('ready', async () => {
        console.log('📞 Device ready - agent joins conference FIRST');
        setStatus('Creating conference...');
        
        // Generate unique conference name
        const agentId = authState?.user?.email?.split('@')[0] || 'agent';
        const uniqueConferenceName = `ConnectNow-${agentId}-${Date.now()}`;
        console.log(`🎧 Agent joining conference: ${uniqueConferenceName}`);
        
        // Step 1: Agent joins conference FIRST via WebRTC (no To parameter = uses TwiML app)
        const connection = await device.connect({
          params: {
            conferenceName: uniqueConferenceName,
            participantType: 'agent'
          }
        });
        
        console.log('✅ Agent WebRTC connected to conference');
        (window as any).twilioConnection = connection;
        
        // Step 2: Call lead to join same conference
        const response = await fetch('/api/simple-outbound/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadPhone: lead.phone,
            leadName: lead.name,
            agentEmail: authState?.user?.email,
            conferenceName: uniqueConferenceName
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`✅ Lead call initiated to join conference - CallSID: ${result.callSid}`);
          
          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'connected',
            currentCall: lead
          }));
          
          toast({
            title: 'Two-Way Call Connected!',
            description: `You are now connected with ${lead.name}`
          });
          
          connection.on('disconnect', () => {
            console.log('🔌 Agent disconnected from call');
            setDialerState(prev => ({
              ...prev,
              dialingStatus: 'idle',
              currentCall: null
            }));
          });
        } else {
          throw new Error(result.error || 'Lead call failed');
        }
      });
      
      device.on('error', (err: any) => {
        console.error('❌ Device Error:', err);
        setStatus(`WebRTC Error: ${err.message}`);
        throw new Error(`WebRTC Error: ${err.message}`);
      });
      
      device.on('registered', async () => {
        console.log('🎯 Device registered successfully - BYPASSING WEBRTC FOR DIRECT CALLING');
        setStatus('Device Ready - Starting Direct Call');
        clearTimeout(registrationTimeout);
        
        // SIMPLE WORKING APPROACH: Just call the lead directly
        console.log('📞 Making simple outbound call to lead...');
        
        try {
          const response = await fetch('/api/simple-outbound/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadPhone: lead.phone,
              leadName: lead.name,
              agentEmail: authState?.user?.email
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            console.log(`✅ Call initiated - CallSID: ${result.callSid}`);
            
            setDialerState(prev => ({
              ...prev,
              dialingStatus: 'connected',
              currentCall: lead,
              callStatus: 'connected'
            }));
            
            toast({
              title: 'Call Connected!',
              description: `Calling ${lead.name} at ${lead.phone}`
            });
            
            // Store call for disconnect
            (window as any).currentCallSid = result.callSid;
            
          } else {
            throw new Error(result.error || 'Call failed');
          }
          
        } catch (error) {
          console.error('❌ Call failed:', error);
          toast({
            title: 'Call Failed',
            description: error instanceof Error ? error.message : 'Call failed to connect',
            variant: 'destructive'
          });
          
          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'error',
            callStatus: 'failed'
          }));
        }
      });

      device.on('unregistered', () => {
        console.log('📴 Device unregistered');
        setStatus('Device Unregistered');
      });

      // Add registration timeout
      const registrationTimeout = setTimeout(() => {
        console.error('⏰ Registration timeout after 15 seconds');
        setStatus('Registration timeout - check network/firewall');
      }, 15000);

      console.log('📡 Registering WebRTC device...');
      setStatus('Registering WebRTC device...');
      
      // Clear timeout when ready event fires
      device.on('ready', () => {
        clearTimeout(registrationTimeout);
      });
      
      device.register();
      
    } catch (error) {
      console.error('❌ START DIALING failed:', error);
      
      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'idle',
        currentCall: null
      }));
      
      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Failed to start call',
        variant: 'destructive'
      });
    }
  };

  const handlePowerToggle = async () => {
    console.log("🔌 Power button clicked!");
    if (!isPoweredOn) {
      const result = await powerOnWebRTC("agent123");
      if (result) {
        setIsPoweredOn(true);
        setDialerState(prev => ({ 
          ...prev, 
          webRTCConferenceActive: true, 
          powered: true
        }));
        toast({
          title: 'WebRTC ready',
          description: 'Device powered on successfully'
        });
      } else {
        toast({
          title: 'Failed to power on',
          description: 'WebRTC initialization failed',
          variant: 'destructive'
        });
      }
    } else {
      console.log("🔻 Powering down...");
      device?.disconnectAll();
      if (device) {
        device.destroy();
        device = null;
      }
      setIsPoweredOn(false);
      setDialerState(prev => ({ 
        ...prev, 
        webRTCConferenceActive: false, 
        powered: false
      }));
      toast({
        title: 'Powered down',
        description: 'WebRTC device disconnected'
      });
    }
  };

  // Start call handler - Step 3E implementation
  const handleStartCall = async () => {
    const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
    if (!currentLead) {
      toast({
        title: 'No Lead Selected',
        description: 'Please select a lead to call',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      console.log('🎯 START DIALING clicked - using Step 3 conference flow');
      
      // Step 1: Connect agent to conference via WebRTC
      dialLead();
      
      // Step 2: Dial the lead via REST API to join same conference
      await fetch("/api/dial-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadPhone: currentLead.phone,
          conference: "conf_agent123"
        })
      });
      
      setDialerState((prev) => ({
        ...prev,
        callStatus: 'calling',
        dialingStatus: 'dialing',
        currentCall: currentLead
      }));
      
      toast({
        title: 'Starting Call',
        description: `Connecting to ${currentLead.name}...`
      });
      
    } catch (error) {
      console.error('❌ Start call failed:', error);
      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };

  // END CALL - destroy call but KEEP POWER ON
  const handleEndCall = async () => {
    try {
      console.log('💥 END CALL - ending call but keeping panel powered...');
      
      // 1. Destroy WebRTC device
      if (device) {
        device.destroy();
        device = null;
        activeCall = null;
        console.log('✅ Device destroyed');
      }

      // 2. Reset call state but KEEP POWER ON
      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'idle',
        // Keep webRTCConferenceActive: true - PANEL STAYS POWERED!
        // Keep powered: true - POWER BUTTON STAYS ON!
        currentCall: null,
        callStatus: 'idle',
        callDuration: 0
      }));

      toast({
        title: 'Call Ended - Panel Still Powered',
        description: 'Ready to dial again'
      });
    } catch (error) {
      console.error('❌ End call failed:', error);
    }
  };

  // Toggle mute handler with proper WebRTC control
  const handleToggleMute = () => {
    try {
      const call = (window as any).currentCall;
      if (call && typeof call.mute === 'function') {
        const newMutedState = !dialerState.isMuted;
        call.mute(newMutedState);
        console.log(`🎤 Microphone ${newMutedState ? 'muted' : 'unmuted'} via WebRTC`);
        
        setDialerState((prev) => ({
          ...prev,
          isMuted: newMutedState
        }));

        toast({
          title: newMutedState ? 'Muted' : 'Unmuted',
          description: newMutedState ? 'Leads cannot hear you' : 'You can talk to leads'
        });
      } else {
        console.log('⚠️ No active WebRTC call to control microphone');
        toast({
          title: 'No Audio Connection',
          description: 'Power on the dialer first to control microphone',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Error toggling mute:', error);
    }
  };

  // Skip lead handler
  const handleSkipLead = () => {
    // Play "next lead" sound notification (higher pitch two-tone)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (frequency: number, duration: number, delay: number) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };
      
      // Play two higher-pitch tones: "beep boop" (next lead sound)
      playTone(660, 0.15, 0);    // Higher pitch first beep
      playTone(550, 0.15, 200);  // Lower pitch second boop
    } catch (error) {
      console.log('Could not play next lead sound:', error);
    }

    const nextIndex = (dialerState.currentLeadIndex + 1) % dialerState.availableLeads.length;
    setDialerState((prev) => ({
      ...prev,
      currentLeadIndex: nextIndex,
      dialingStatus: 'idle',
      currentCall: null,
      callDuration: 0
    }));

    toast({
      title: 'Lead Skipped',
      description: 'Moving to next lead'
    });
  };

  // Handle call disposition change
  const handleDispositionChange = (disposition: CallDisposition) => {
    setDialerState((prev) => ({
      ...prev,
      selectedDisposition: disposition
    }));

    toast({
      title: 'Disposition Selected',
      description: `Call marked as: ${disposition.replace('_', ' ')}`
    });
  };

  // Handle call notes change
  const handleNotesChange = (notes: string) => {
    setDialerState((prev) => ({
      ...prev,
      callNotes: notes
    }));
  };

  // Handle pause dialing
  const handlePauseDialing = () => {
    setDialerState((prev) => ({
      ...prev,
      campaignActive: false,
      dialingStatus: 'ready'
    }));

    toast({
      title: 'Dialing Paused',
      description: 'Campaign paused - click Start Dialing to resume'
    });
  };

  // Handle start dialing - automatically calls first lead
  const handleStartDialing = async () => {
    const { availableLeads } = dialerState;
    
    if (availableLeads.length === 0) {
      toast({
        title: 'No Leads Available',
        description: 'Please load leads before starting dialing',
        variant: 'destructive'
      });
      return;
    }

    if (!dialerState.webRTCConferenceActive) {
      toast({
        title: 'System Offline',
        description: 'Please power on Call Connector Pro first',
        variant: 'destructive'
      });
      return;
    }

    const firstLead = availableLeads[0];
    
    setDialerState((prev) => ({
      ...prev,
      campaignActive: false, // Keep false to prevent wrong button behavior
      dialingStatus: 'dialing',
      currentLeadIndex: 0,
      callStatus: 'initiating'
    }));

    toast({
      title: 'Campaign Started',
      description: `Auto-dialing first lead: ${firstLead.name}`
    });

    // Use new WebRTC + PSTN conference approach
    dialLead();
  };

  // Call a specific lead - DIRECT WebRTC call (no conferences)
  const handleCallLead = async (lead: Lead) => {
    try {
      console.log('📞 DIRECT CALL: Agent WebRTC calling lead directly');
      console.log('📞 Calling lead:', lead.name, lead.phone);
      
      setDialerState((prev) => ({
        ...prev,
        dialingStatus: 'dialing',
        currentCall: lead,
        callStatus: 'connecting_direct'
      }));

      const device = (window as any).twilioDevice;
      if (!device) {
        throw new Error('WebRTC device not initialized. Please power on first.');
      }

      // Check for existing connections
      const existingConnection = (window as any).twilioConnection;
      if (existingConnection) {
        const connectionStatus = existingConnection.status();
        if (connectionStatus === 'open' || connectionStatus === 'connecting') {
          throw new Error('Call already in progress. End current call first.');
        } else {
          existingConnection.disconnect();
          (window as any).twilioConnection = null;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // DIRECT CALL: Agent WebRTC device calls lead's phone number directly
      console.log('📞 Making DIRECT WebRTC call to lead phone number...');
      const connection = await device.connect({
        params: { 
          To: lead.phone.replace(/\D/g, ''), // Clean phone number
          leadName: lead.name,
          leadState: lead.state || 'Unknown'
        }
      });

      // Store connection globally for call management
      (window as any).twilioConnection = connection;
      
      setDialerState((prev) => ({
        ...prev,
        callStatus: 'calling_direct'
      }));

      // Listen for connection events
      connection.on('accept', () => {
        console.log('✅ Direct call connected - agent can hear and talk to lead');
        setDialerState((prev) => ({
          ...prev,
          callStatus: 'connected_direct'
        }));
        toast({
          title: 'Call Connected',
          description: 'You are now directly connected to the lead'
        });
      });

      connection.on('disconnect', () => {
        console.log('📴 Direct call ended');
        setDialerState((prev) => ({
          ...prev,
          callStatus: 'idle',
          dialingStatus: 'idle',
          currentCall: null
        }));
        (window as any).twilioConnection = null;
      });

      console.log('✅ Direct WebRTC call initiated');

      toast({
        title: 'Calling Lead',
        description: 'Direct connection in progress...'
      });
      console.log('📞 STEP 2: Making outbound call to lead and merging into conference...');
      
      setDialerState((prev) => ({
        ...prev,
        callStatus: 'dialing_lead',
        dialingStatus: 'dialing'
      }));

      // START SEARCH FOR CALL MUSIC while waiting for client to answer
      console.log('🎵 Starting search for call music while waiting for client...');
      let searchMusicInterval: NodeJS.Timeout;
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        let oscillatorNodes: OscillatorNode[] = [];
        
        // Create gentle search music pattern
        const startSearchMusic = () => {
          const frequencies = [220, 246.94, 261.63, 293.66]; // A3, B3, C4, D4
          let currentNote = 0;
          
          const playNote = () => {
            // Clean up previous oscillators
            oscillatorNodes.forEach(osc => {
              try { osc.stop(); } catch (e) {}
            });
            oscillatorNodes = [];
            
            // Create new oscillator for current note
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequencies[currentNote], audioContext.currentTime);
            oscillator.type = 'sine';
            
            // Gentle volume for background music
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.8);
            
            oscillatorNodes.push(oscillator);
            currentNote = (currentNote + 1) % frequencies.length;
          };
          
          // Start with first note immediately
          playNote();
          
          // Continue playing notes every 1 second
          searchMusicInterval = setInterval(playNote, 1000);
        };
        
        startSearchMusic();
        
        // Store cleanup function globally
        (window as any).stopSearchMusic = () => {
          if (searchMusicInterval) {
            clearInterval(searchMusicInterval);
          }
          oscillatorNodes.forEach(osc => {
            try { osc.stop(); } catch (e) {}
          });
          oscillatorNodes = [];
          console.log('🎵 Search music stopped');
        };
        
        toast({
          title: 'Searching for Client',
          description: 'Playing search music while connecting...'
        });
        
      } catch (audioError) {
        console.log('🎵 Search music not available:', audioError);
      }

      const callResponse = await fetch('/api/outbound-dialer/call-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadPhone: lead.phone,
          leadName: lead.name,
          leadState: lead.state,
          conferenceName: 'Call-Connector-Pro-Conference'
        })
      });

      if (!callResponse.ok) {
        throw new Error('Failed to initiate outbound call to lead');
      }

      const callResult = await callResponse.json();
      console.log('📞 Outbound call result:', callResult);

      // STOP SEARCH MUSIC when call connects
      if ((window as any).stopSearchMusic) {
        (window as any).stopSearchMusic();
      }

      setDialerState((prev) => ({
        ...prev,
        callStatus: 'connected',
        dialingStatus: 'connected',
        currentCall: lead
      }));

      toast({
        title: 'Call Connected',
        description: `Outbound call to ${lead.name} merged into conference`
      });
      
    } catch (error) {
      console.error('❌ Call failed:', error);
      
      // STOP SEARCH MUSIC on call failure
      if ((window as any).stopSearchMusic) {
        (window as any).stopSearchMusic();
      }
      
      setDialerState((prev) => ({
        ...prev,
        dialingStatus: 'idle',
        callStatus: 'idle',
        currentCall: null
      }));

      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate call',
        variant: 'destructive'
      });
    }
  };

  // Complete Call Handler - DESTROY EVERYTHING
  const handleCompleteCall = async () => {
    try {
      console.log('✅ Complete Call: DESTROYING EVERYTHING...');
      
      // 1. Destroy WebRTC device
      if (device) {
        device.destroy();
        device = null;
        activeCall = null;
        console.log('✅ Device destroyed');
      }
      
      // 2. Reset all state
      setDialerState(prev => ({ 
        ...prev, 
        dialingStatus: 'idle',
        webRTCConferenceActive: false,
        powered: false 
      }));
      
      toast({
        title: 'Call Completed - Everything Destroyed',
        description: 'Ready for next call'
      });
      
    } catch (error) {
      console.error('❌ Error in Complete Call:', error);
      toast({
        title: 'Complete Call Failed',
        description: 'Failed to complete call',
        variant: 'destructive'
      });
    }
  };

  // Dial Next Lead Handler - DESTROY EVERYTHING AND START FRESH
  const handleDialNextLead = async () => {
    try {
      console.log('📞 Dial Next Lead: DESTROYING EVERYTHING AND STARTING FRESH...');
      
      // 1. Destroy current WebRTC device
      if (device) {
        device.destroy();
        device = null;
        activeCall = null;
        console.log('✅ Device destroyed');
      }
      
      // 2. Move to next lead
      const nextIndex = (dialerState.currentLeadIndex + 1) % dialerState.availableLeads.length;
      setDialerState(prev => ({ 
        ...prev, 
        currentLeadIndex: nextIndex,
        dialingStatus: 'idle',
        webRTCConferenceActive: false,
        powered: false
      }));
      
      // 3. Auto-power on and call next lead (fresh everything)
      const nextLead = dialerState.availableLeads[nextIndex];
      if (nextLead) {
        // Power on first (just opens panel)
        setDialerState(prev => ({ 
          ...prev, 
          webRTCConferenceActive: true,
          powered: true 
        }));
        
        // Then start fresh call after brief delay
        setTimeout(() => {
          handleCallLead(nextLead);
        }, 500);
      }
      
      toast({
        title: 'Fresh Start for Next Lead',
        description: 'Everything destroyed, starting fresh call'
      });
      
    } catch (error) {
      console.error('❌ Failed to dial next lead:', error);
      toast({
        title: 'Dial Next Failed',
        description: 'Failed to move to next lead',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = () => {
    switch (dialerState.dialingStatus) {
      case 'connected': return 'bg-green-500';
      case 'dialing': return 'bg-yellow-500';
      case 'paused': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Professional Header - Matching Reference */}
      <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Call Connector Pro</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <div className={`w-2 h-2 rounded-full ${dialerState.webRTCConferenceActive ? 'bg-green-400' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium">
                {dialerState.webRTCConferenceActive ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            {/* Live Call Status */}
            {dialerState.dialingStatus === 'connected' && (
              <div className="flex items-center gap-2 bg-green-500/20 rounded-full px-3 py-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium">LIVE CALL</span>
              </div>
            )}
            <Button 
              onClick={handleToggleMute}
              variant="secondary"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white border-0"
            >
              <FiMic className="w-4 h-4 mr-1" />
              {dialerState.isMuted ? 'Unmute' : 'Mute'}
            </Button>
            <Button 
              onClick={async () => {
                console.log('🔌 Power button clicked!');
                await handlePowerToggle();
              }}
              variant="secondary"
              size="sm"
              className={`border-0 transition-all duration-300 ${
                isPoweredOn 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              disabled={false}
            >
              <FiZap className="w-4 h-4 mr-1" />
              {isPoweredOn ? 'Power Off' : 'Power On'}
            </Button>
          </div>
        </div>
      </div>

      {/* Call Trackers - Dialed, Reached, Booked */}
      <CallTrackers 
        dialedCount={dailyStats?.total_dialed || 0}
        reachedCount={dailyStats?.reached || 0}
        bookedCount={dailyStats?.booked || 0}
      />

      {/* Top Row: Lead Display and Lead Queue side by side - More room for lead info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Lead Display - Expanded (2/3 columns) */}
        <div className="lg:col-span-2">
          <LeadDisplay 
            state={dialerState} 
          />
        </div>
        
        {/* Lead Progress & Queue - Narrower (1/3 column) */}
        <div className="lg:col-span-1 space-y-4">
          {/* Market Selection Interface */}
          <MarketSelector 
            selectedMarkets={selectedMarkets}
            onMarketsChange={setSelectedMarkets}
            agentEmail={authState?.user?.email}
          />
          
          {/* Hidden per user request - Direct lead import no longer needed */}
          {/* <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Direct Lead Import</h3>
                <Button 
                  onClick={triggerFileUpload}
                  disabled={isImporting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FiUpload className="w-4 h-4 mr-2" />
                  {isImporting ? 'Importing...' : 'Import CSV File'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Import leads directly from CSV file to bypass API
                </p>
              </div>
            </CardContent>
          </Card> */}
          
          {/* Lead Progress Tracker */}
          <LeadProgressTracker state={dialerState} />
          
          {/* Hidden per user request - LocalPresenceDisplay */}
          {/* <LocalPresenceDisplay /> */}
        </div>
      </div>

      {/* Call Controls - Full Width */}
      <div className="w-full">
        <CallControls
          state={dialerState}
          onStartCall={() => dialLead()}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          onSkipLead={handleSkipLead}
          onPowerToggle={handlePowerToggle}
          onDispositionSelect={() => {}} // Call disposition removed
          onPauseDialing={handlePauseDialing}
          onStartDialing={handleStartDialing}
          onCompleteCall={handleCompleteCall}
          onDialNextLead={handleDialNextLead}
        />
      </div>







      {/* Debug Test Component - Exact copy of TestCall */}
      <SimpleDialerTest />

    </div>
  );
}

export default OutboundDialerInterface;