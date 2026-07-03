import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CallContextType {
  openCallModal: (phoneNumber?: string, clientName?: string) => void;
  isCallActive: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

declare global {
  interface Window {
    Twilio: any;
    Device: any;
  }
}

interface CallProviderProps {
  children: React.ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'calling' | 'incoming'>('idle');
  const [callTime, setCallTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callerInfo, setCallerInfo] = useState<{from: string, name?: string} | null>(null);
  
  const { toast } = useToast();
  const callTimerRef = useRef<NodeJS.Timeout>();
  const deviceRef = useRef<any>(null);
  const isInitializingRef = useRef(false);

  // Do not auto-initialize on mount. CCPro has its own WebRTC lifecycle
  // on /connect, and eager global init can interfere with registration.
  useEffect(() => {
    console.log('⏭️ Global WebRTC auto-init disabled; initialize on-demand only');
    
    // Cleanup: Remove beforeunload listener on unmount
    return () => {
      const cleanup = (window as any).__globalWebRTCCleanup;
      if (cleanup) {
        window.removeEventListener('beforeunload', cleanup);
        (window as any).__globalWebRTCCleanup = null;
      }
    };
  }, []);

  // Call timer
  useEffect(() => {
    if (callStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallTime(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (callStatus === 'idle') {
        setCallTime(0);
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus]);

  const initializeWebRTC = async () => {
    try {
      // Prevent multiple initializations
      if (isWebRTCReady || deviceRef.current) {
        console.log('⏭️ Global WebRTC already initialized, skipping');
        return;
      }
      if (isInitializingRef.current) {
        console.log('⏭️ Global WebRTC initialization already in progress, skipping');
        return;
      }
      
      // CRITICAL: Don't initialize on /connect route - CCPro handles its own WebRTC
      if (window.location.pathname === '/connect' || window.location.pathname.startsWith('/connect/')) {
        console.log('⏭️ Skipping Global WebRTC init on /connect route (CCPro handles its own)');
        return;
      }
      
      // Check if CCPro device already exists - don't conflict
      if ((window as any).twilioDevice) {
        console.log('⏭️ CCPro device already exists, skipping Global WebRTC init to avoid conflicts');
        return;
      }
      
      isInitializingRef.current = true;

      console.log('🔌 Initializing Global WebRTC Call System...');

      // Load Twilio SDK if not already loaded
      if (!window.Twilio) {
        await loadTwilioSDK();
      }

      // Get user email from localStorage
      let userEmail: string | null = null;
      try {
        const storedUser = localStorage.getItem('current_producer');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email;
          console.log('🔑 Global WebRTC: Using email from localStorage:', userEmail);
        }
      } catch (storageError) {
        console.warn('⚠️ Global WebRTC: Could not get user from localStorage:', storageError);
      }

      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }

      // Use the working WebRTC token endpoint from routes.ts
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      
      // CRITICAL: Include x-user-email header so server can verify user
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }

      // Get correct endpoint based on platform
      const { getTwilioTokenEndpoint, isElectron } = await import('../../utils/webrtc-endpoints');
      const tokenEndpoint = getTwilioTokenEndpoint();
      if (isElectron()) {
        headers['x-desktop-app'] = 'true';
      }

      const response = await fetch(tokenEndpoint, {
        method: 'GET',
        credentials: 'include', // CRITICAL: Always send cookies
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get WebRTC token:', errorText);
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Global WebRTC token received:', data);
      
      // Support both possible token field names
      const finalToken = data.token || data.accessToken;
      if (!finalToken) {
        throw new Error('No access token received from server');
      }

      // Setup Twilio Device
      const device = new window.Twilio.Device(finalToken, {
        codecPreferences: ['opus', 'pcmu'],
        allowIncomingWhileBusy: true,
        debug: true,
        enableRingingState: true
      });

      device.on('ready', () => {
        console.log('✅ Global WebRTC Device ready');
        setIsWebRTCReady(true);
        toast({
          title: "Call System Ready",
          description: "Global calling system is now active"
        });
      });
      
      device.on('registered', () => {
        console.log('✅ Global WebRTC Device registered (waiting for ready state)');
      });

      device.on('error', (error: any) => {
        console.error('❌ Global WebRTC error:', error);
        toast({
          title: "Call System Error",
          description: error.message,
          variant: "destructive"
        });
      });

      device.on('incoming', (call: any) => {
        console.log('📞 Incoming call received globally');
        
        // Extract caller information
        const from = call.parameters.From || 'Unknown';
        const customParams = call.customParameters || {};
        const callerName = customParams.CallerName || customParams.ClientName || '';
        
        setIncomingCall(call);
        setCallerInfo({ from, name: callerName });
        setCallStatus('incoming');
        setIsModalOpen(true);

        // Setup call event handlers
        call.on('accept', () => {
          console.log('✅ Incoming call accepted');
          setCallStatus('connected');
          setCurrentCall(call);
          setIncomingCall(null);
          toast({
            title: "Call Connected",
            description: `Connected to ${callerName || from}`
          });
        });

        call.on('disconnect', () => {
          console.log('📴 Incoming call disconnected');
          setCallStatus('idle');
          setCurrentCall(null);
          setIncomingCall(null);
          setCallerInfo(null);
        });

        call.on('cancel', () => {
          console.log('📴 Incoming call cancelled');
          setCallStatus('idle');
          setIncomingCall(null);
          setCallerInfo(null);
          toast({
            title: "Call Missed",
            description: "Incoming call was cancelled"
          });
        });

        // Auto-open modal for incoming call
        toast({
          title: "Incoming Call",
          description: `Call from ${callerName || from}`,
          duration: 10000
        });
      });

      await device.register();
      deviceRef.current = device;
      // Store in window.twilioDevice for access
      (window as any).twilioDevice = device;
      
      // CRITICAL: Add cleanup on page unload to prevent stale device state
      const handleBeforeUnload = () => {
        try {
          const globalDevice = deviceRef.current || (window as any).twilioDevice;
          if (globalDevice && typeof globalDevice.destroy === 'function') {
            console.log('🧹 [GLOBAL CLEANUP] Destroying WebRTC device on page unload');
            try {
              if (typeof globalDevice.disconnectAll === 'function') {
                globalDevice.disconnectAll();
              }
              if (typeof globalDevice.unregister === 'function' && 
                  (globalDevice.state === 'registered' || globalDevice.state === 'ready')) {
                globalDevice.unregister();
              }
              globalDevice.destroy();
            } catch (e) {
              console.warn('⚠️ [GLOBAL CLEANUP] Error destroying device:', e);
            }
            (window as any).twilioDevice = null;
            deviceRef.current = null;
          }
        } catch (e) {
          console.warn('⚠️ [GLOBAL CLEANUP] Error:', e);
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Store cleanup function for removal on unmount
      (window as any).__globalWebRTCCleanup = handleBeforeUnload;
      
      console.log('✅ Global WebRTC Device stored in window.twilioDevice');

    } catch (error) {
      console.error('Failed to initialize Global WebRTC:', error);
      toast({
        title: "Call System Error",
        description: "Failed to initialize global calling system",
        variant: "destructive"
      });
    } finally {
      isInitializingRef.current = false;
    }
  };

  const loadTwilioSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.Twilio) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.twilio.com/js/voice/releases/2.12.2/twilio.min.js';
      script.onload = () => {
        console.log('✅ Twilio SDK loaded globally');
        setTimeout(() => {
          if (window.Twilio) {
            resolve();
          } else {
            reject(new Error('Twilio SDK failed to initialize'));
          }
        }, 200);
      };
      script.onerror = () => reject(new Error('Failed to load Twilio SDK'));
      document.head.appendChild(script);
    });
  };

  const openCallModal = (initialNumber = '', initialName = '') => {
    setPhoneNumber(initialNumber);
    setClientName(initialName);
    setIsModalOpen(true);
    if (!isWebRTCReady && !deviceRef.current) {
      void initializeWebRTC();
    }
  };

  const startCall = async () => {
    if (!deviceRef.current || !isWebRTCReady) {
      void initializeWebRTC();
      toast({
        title: "Call System Not Ready",
        description: "Initializing call system. Try again in a moment.",
        variant: "destructive"
      });
      return;
    }

    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to call",
        variant: "destructive"
      });
      return;
    }

    try {
      setCallStatus('calling');
      console.log(`📞 Starting global call to ${phoneNumber}`);

      const call = await deviceRef.current.connect({
        params: {
          To: phoneNumber,
          From: '+16052500834',
          ClientName: clientName || 'ConnectNow Call'
        }
      });

      setCurrentCall(call);

      call.on('accept', () => {
        console.log('✅ Outgoing call accepted');
        setCallStatus('connected');
        toast({
          title: "Call Connected",
          description: `Connected to ${clientName || phoneNumber}`
        });
      });

      call.on('disconnect', () => {
        console.log('📴 Outgoing call disconnected');
        setCallStatus('idle');
        setCurrentCall(null);
        toast({
          title: "Call Ended",
          description: "The call has been disconnected"
        });
      });

      call.on('error', (error: any) => {
        console.error('❌ Outgoing call error:', error);
        setCallStatus('idle');
        setCurrentCall(null);
        toast({
          title: "Call Failed",
          description: error.message,
          variant: "destructive"
        });
      });

    } catch (error: any) {
      console.error('Failed to start global call:', error);
      setCallStatus('idle');
      toast({
        title: "Call Failed",
        description: error.message || "Failed to initiate call",
        variant: "destructive"
      });
    }
  };

  const acceptIncomingCall = () => {
    if (incomingCall) {
      incomingCall.accept();
    }
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      incomingCall.reject();
      setCallStatus('idle');
      setIncomingCall(null);
      setCallerInfo(null);
      toast({
        title: "Call Rejected",
        description: "Incoming call was declined"
      });
    }
  };

  const endCall = () => {
    if (currentCall) {
      currentCall.disconnect();
    }
    if (incomingCall) {
      incomingCall.reject();
    }
    setCallStatus('idle');
    setCurrentCall(null);
    setIncomingCall(null);
    setCallerInfo(null);
  };

  const toggleMute = () => {
    if (currentCall) {
      const newMuteState = !isMuted;
      currentCall.mute(newMuteState);
      setIsMuted(newMuteState);
      toast({
        title: newMuteState ? "Microphone Muted" : "Microphone Unmuted",
        description: newMuteState ? "Your microphone is now muted" : "Your microphone is now active"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (callStatus === 'connected' || callStatus === 'calling') {
      toast({
        title: "Call In Progress",
        description: "Please end the call before closing",
        variant: "destructive"
      });
      return;
    }
    if (callStatus === 'incoming') {
      rejectIncomingCall();
    }
    setIsModalOpen(false);
  };

  const contextValue: CallContextType = {
    openCallModal,
    isCallActive: callStatus !== 'idle'
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
      
      {/* Global Call Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md border-0 shadow-sm bg-white">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-medium text-foreground">
              {callStatus === 'incoming' ? 'Incoming Call' : 'ConnectNow Call'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Incoming Call */}
            {callStatus === 'incoming' && callerInfo && (
              <div className="space-y-4">
                <div className="text-center space-y-3">
                  <div className="text-lg font-medium">
                    {callerInfo.name || 'Unknown Caller'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {callerInfo.from}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Incoming call...
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={rejectIncomingCall}
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <PhoneOff className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                  <Button
                    onClick={acceptIncomingCall}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                </div>
              </div>
            )}

            {/* Outgoing Call Form */}
            {callStatus === 'idle' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName" className="text-sm font-medium">Client Name (Optional)</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Enter client name"
                    className="border-gray-200 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    type="tel"
                    className="border-gray-200 focus:border-blue-500"
                  />
                </div>

                <Button 
                  onClick={startCall} 
                  disabled={!isWebRTCReady}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {isWebRTCReady ? 'Start Call' : 'Initializing...'}
                </Button>

                {!isWebRTCReady && (
                  <p className="text-sm text-muted-foreground text-center">
                    Setting up call system...
                  </p>
                )}
              </div>
            )}

            {/* Call In Progress */}
            {(callStatus === 'calling' || callStatus === 'connected') && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="text-lg font-medium">
                    {clientName || phoneNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {callStatus === 'calling' ? 'Calling...' : 'Connected'}
                  </div>
                  {callStatus === 'connected' && (
                    <div className="text-xl font-mono font-medium text-green-600">
                      {formatTime(callTime)}
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-3 pt-4">
                  {callStatus === 'connected' && (
                    <Button
                      onClick={toggleMute}
                      variant="outline"
                      className={isMuted ? 'border-red-200 text-red-700 bg-red-50' : 'border-gray-200'}
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}

                  <Button
                    onClick={endCall}
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <PhoneOff className="h-4 w-4 mr-2" />
                    End Call
                  </Button>
                </div>
              </div>
            )}

            {/* WebRTC Status */}
            <div className="text-xs text-center text-muted-foreground">
              Call System: {isWebRTCReady ? 'Ready' : 'Initializing'}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CallContext.Provider>
  );
}