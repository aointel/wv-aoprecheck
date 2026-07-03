import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, Mic, MicOff, PhoneCall } from 'lucide-react';

// @ts-ignore
declare global {
  interface Window {
    Device: any;
    Twilio: any;
  }
}

export default function SimpleCallPage() {
  const [callStatus, setCallStatus] = useState<'waiting' | 'connected' | 'webrtc-connected'>('waiting');
  const [callDuration, setCallDuration] = useState(0);
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [device, setDevice] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Initialize WebRTC device
    initializeWebRTC();
    
    // Call polling disabled - was causing constant refreshes
    // const pollForCalls = setInterval(async () => {
    //   try {
    //     const response = await fetch('/api/call-status');
    //     if (response.ok) {
    //       const data = await response.json();
    //       
    //       if (data.callActive && callStatus === 'waiting') {
    //         setCallStatus('connected');
    //         startCallTimer();
    //       } else if (!data.callActive && callStatus === 'connected') {
    //         setCallStatus('waiting');
    //         if (callTimerRef.current) {
    //           clearInterval(callTimerRef.current);
    //           callTimerRef.current = null;
    //         }
    //         setCallDuration(0);
    //       }
    //     }
    //   } catch (error) {
    //     console.warn('Call polling error:', error);
    //   }
    // }, 2000);

    return () => {
      // Cleanup timers and connections
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (connection) {
        connection.disconnect();
      }
    };
  }, [callStatus]);

  const initializeWebRTC = async () => {
    try {
      // Load newer Twilio Voice SDK
      if (!window.Device) {
        const script = document.createElement('script');
        script.src = 'https://sdk.twilio.com/js/voice/releases/2.12.2/twilio.min.js';
        script.onload = () => {
          console.log('Twilio Voice SDK loaded');
          // Wait for SDK to fully initialize
          setTimeout(() => {
            if (window.Twilio && window.Twilio.Device) {
              console.log('Twilio.Device available');
              setupDevice();
            } else {
              console.error('Twilio SDK loaded but Twilio.Device not found');
            }
          }, 200);
        };
        script.onerror = (error) => {
          console.error('Failed to load Twilio SDK:', error);
        };
        document.head.appendChild(script);
      } else {
        setupDevice();
      }
    } catch (error) {
      console.error('WebRTC initialization failed:', error);
    }
  };

  const setupDevice = async () => {
    try {
      console.log('Setting up WebRTC device');
      console.log('window.Twilio:', window.Twilio);
      console.log('window.Twilio.Device:', window.Twilio?.Device);
      
      if (!window.Twilio || !window.Twilio.Device) {
        console.error('Twilio.Device not available');
        return;
      }
      
      const response = await fetch('/api/twilio/access-token', {
        credentials: 'include' // CRITICAL: Send session cookies for Electron
      });
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }
      
      const { token } = await response.json();
      console.log('Access token received, length:', token?.length);
      
      // Use the newer Device constructor with token directly
      const newDevice = new window.Twilio.Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        fakeLocalDTMF: true,
        enableRingingState: true,
        allowIncomingWhileBusy: true
      });

      newDevice.ready(() => {
        console.log('WebRTC Device ready');
        setIsWebRTCReady(true);
        // Play setup sound (doop doop doop)
        playSetupSound();
      });

      newDevice.error((error: any) => {
        console.error('Device error:', error);
      });

      newDevice.connect((conn: any) => {
        console.log('WebRTC call connected');
        setConnection(conn);
        setCallStatus('webrtc-connected');
        startCallTimer();
      });

      newDevice.disconnect(() => {
        console.log('WebRTC call disconnected');
        setConnection(null);
        setCallStatus('waiting');
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        setCallDuration(0);
      });

      setDevice(newDevice);
      
    } catch (error) {
      console.error('Device setup failed:', error);
    }
  };

  const playSetupSound = () => {
    // Create audio context for setup sound (doop doop doop)
    const audioContext = new AudioContext();
    const playTone = (frequency: number, duration: number, delay: number) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      }, delay);
    };
    
    // Play doop doop doop
    playTone(800, 0.2, 0);
    playTone(600, 0.2, 300);
    playTone(800, 0.2, 600);
  };

  const joinConference = () => {
    if (device && isWebRTCReady) {
      try {
        // Make outgoing call to conference via WebRTC
        const conn = device.connect();
        setConnection(conn);
      } catch (error) {
        console.error('Failed to join conference:', error);
      }
    }
  };

  const leaveConference = () => {
    if (connection) {
      connection.disconnect();
    }
  };

  const toggleMute = () => {
    if (connection) {
      connection.mute(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <PhoneCall className="w-5 h-5" />
            WebRTC Conference System
          </CardTitle>
          <p className="text-sm text-gray-600">Conference: AO-Verification-Live</p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* WebRTC Status */}
          <div className="text-center">
            {!isWebRTCReady ? (
              <div className="space-y-2">
                <Badge variant="outline" className="animate-pulse">Initializing WebRTC...</Badge>
                <p className="text-sm text-gray-500">Loading audio system</p>
              </div>
            ) : callStatus === 'webrtc-connected' ? (
              <div className="space-y-2">
                <Badge variant="default" className="bg-green-500">WebRTC Connected</Badge>
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  <p className="text-lg font-mono">{formatDuration(callDuration)}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="default" className="bg-blue-500">WebRTC Ready</Badge>
                <p className="text-sm text-gray-500">Ready to join conference</p>
              </div>
            )}
          </div>

          {/* WebRTC Controls */}
          <div className="flex gap-2 justify-center">
            {callStatus === 'webrtc-connected' ? (
              <>
                <Button 
                  onClick={leaveConference}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Leave Conference
                </Button>
                <Button 
                  onClick={toggleMute}
                  variant={isMuted ? "destructive" : "outline"}
                  size="icon"
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </>
            ) : (
              <Button 
                onClick={joinConference}
                disabled={!isWebRTCReady}
                className="flex items-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                Join Conference
              </Button>
            )}
          </div>

          {/* Phone Status */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-700 mb-2 text-center">Phone Auto-Answer Status</h4>
            <div className="text-center">
              {callStatus === 'connected' ? (
                <div className="space-y-2">
                  <Badge variant="default" className="bg-orange-500">Phone Call Active</Badge>
                  <p className="text-sm text-gray-600">Someone called +16052500834</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline">Waiting for Phone Calls</Badge>
                  <p className="text-sm text-gray-600">+16052500834 ready to auto-answer</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <h4 className="font-semibold text-blue-900 mb-2">How It Works</h4>
            <p className="text-sm text-blue-800">
              • Click "Join Conference" to connect via WebRTC<br/>
              • Or call <strong>+16052500834</strong> from any phone<br/>
              • Both join the same live conference room
            </p>
          </div>

          <audio ref={audioRef} autoPlay muted={false} />
        </CardContent>
      </Card>
    </div>
  );
}