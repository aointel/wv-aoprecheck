import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WebRTCCallProps {
  sessionId: string;
  clientName: string;
  onCallComplete: () => void;
}

export function WebRTCCall({ sessionId, clientName, onCallComplete }: WebRTCCallProps) {
  const [callStatus, setCallStatus] = useState<'waiting' | 'ringing' | 'connected' | 'ended' | 'calling' | 'ready' | 'idle'>('waiting');
  const [callDuration, setCallDuration] = useState(0);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const { toast } = useToast();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Poll for active calls every 2 seconds
    const pollForCalls = setInterval(async () => {
      try {
        const response = await fetch(`/api/call-status`);
        if (response.ok) {
          const data = await response.json();
          console.log('Call status response:', data);
          
          if (data.callActive && callStatus === 'waiting') {
            setCallStatus('connected');
            startCallTimer();
            toast({
              title: "Call Connected",
              description: "Incoming call detected - conference active",
            });
          } else if (!data.callActive && callStatus === 'connected') {
            setCallStatus('waiting');
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
              callTimerRef.current = null;
            }
            setCallDuration(0);
            toast({
              title: "Call Ended",
              description: "Conference call completed",
            });
          }
        }
      } catch (error) {
        console.warn('Call status polling error:', error);
      }
    }, 2000);

    return () => {
      clearInterval(pollForCalls);
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus, sessionId]);

  const startCall = async () => {
    try {
      setCallStatus('calling');
      
      // Connect to phone bridge WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/phone-bridge`;
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        // Register this agent session with Twilio phone number
        socket.send(JSON.stringify({
          type: 'register_agent',
          sessionId,
          data: { phoneNumber: 'auto' } // Use default Twilio number
        }));
      };
      
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'registration_success':
            // Create conference room for this session
            fetch('/api/conference/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            }).then(response => response.json())
            .then(data => {
              if (data.success) {
                toast({
                  title: "Conference Ready",
                  description: `Taalk can call +16052500834 to join your verification conference.`,
                });
                setCallStatus('ready');
              }
            });
            break;
            
          case 'incoming_call':
            setCallStatus('connected');
            startCallTimer();
            
            toast({
              title: "Call Connected",
              description: `Taalk caller joined conference. Auto-connected to verification call.`,
            });
            
            // Auto-join agent to conference room
            const conferenceName = `AO-Verification-${sessionId}`;
            const conferenceWindow = window.open(`/api/conference/join/${conferenceName}?identity=agent`, '_blank');
            
            // Focus the conference window
            if (conferenceWindow) {
              conferenceWindow.focus();
            }
            break;
            
          case 'call_connected':
            setCallStatus('connected');
            startCallTimer();
            toast({
              title: "Call Connected",
              description: "You're now connected. Say 'Hey Alex' to begin verification.",
            });
            break;
            
          case 'call_ended':
            setCallStatus('idle');
            toast({
              title: "Call Ended",
              description: "The call has been disconnected.",
            });
            break;
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to phone bridge.",
          variant: "destructive"
        });
        setCallStatus('idle');
      };
      
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: "Call Failed",
        description: "Unable to establish phone bridge connection.",
        variant: "destructive"
      });
      setCallStatus('idle');
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    
    setCallStatus('ended');
    setCallDuration(0);
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicrophoneEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    setSpeakerEnabled(!speakerEnabled);
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

  const handleMarkComplete = () => {
    endCall();
    onCallComplete();
    toast({
      title: "Verification Complete",
      description: "Call ended and verification marked as complete.",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Phone className="w-5 h-5" />
          Auto-Answer System
        </CardTitle>
        <p className="text-sm text-gray-600">Phone: +16052500834</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Call Status */}
        <div className="text-center">
          {callStatus === 'waiting' && (
            <div className="space-y-2">
              <Badge variant="outline" className="animate-pulse">Waiting for Call...</Badge>
              <p className="text-sm text-gray-500">System ready to auto-answer</p>
            </div>
          )}
          {callStatus === 'ringing' && (
            <Badge variant="outline" className="animate-pulse">Incoming Call...</Badge>
          )}
          {callStatus === 'connected' && (
            <div className="space-y-2">
              <Badge variant="default" className="bg-green-500">Call Active</Badge>
              <p className="text-lg font-mono">{formatDuration(callDuration)}</p>
            </div>
          )}
          {callStatus === 'ended' && (
            <Badge variant="destructive">Call Ended</Badge>
          )}
        </div>

        {/* Waiting State */}
        {callStatus === 'waiting' && (
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <h4 className="font-semibold text-blue-900 mb-2">Ready for Calls</h4>
            <p className="text-sm text-blue-800">
              Taalk can call <strong>+16052500834</strong> anytime.<br/>
              Calls will be answered automatically.
            </p>
          </div>
        )}

        {/* Connected State */}
        {callStatus === 'connected' && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <h4 className="font-semibold text-green-900 mb-2">Call Active</h4>
              <p className="text-sm text-green-800">
                Both parties connected automatically.<br/>
                Say <strong>"Hey Alex"</strong> to activate AI verification
              </p>
            </div>
            
            <Button 
              onClick={handleMarkComplete}
              className="w-full bg-green-500 hover:bg-green-600"
              size="lg"
            >
              Complete Verification
            </Button>
          </div>
        )}

        {callStatus === 'ended' && (
          <Button 
            onClick={onCallComplete}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            Verification Complete
          </Button>
        )}
      </CardContent>
    </Card>
  );
}