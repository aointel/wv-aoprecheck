
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mic, MicOff, PhoneCall, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimplifiedVerificationProps {
  session: any;
  onComplete: () => void;
}

export function SimplifiedVerification({ session, onComplete }: SimplifiedVerificationProps) {
  const [verificationStatus, setVerificationStatus] = useState<'ready' | 'connecting' | 'active' | 'completed'>('ready');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [device, setDevice] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  const { toast } = useToast();
  
  const timerRef = useRef<NodeJS.Timeout>();
  const deviceRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  const startVerification = async () => {
    try {
      setVerificationStatus('connecting');
      
      // Load Twilio SDK and setup WebRTC
      const script = document.createElement('script');
      script.src = 'https://sdk.twilio.com/js/client/releases/1.14.1/twilio.min.js';
      script.onload = async () => {
        try {
          // Get access token
          const tokenResponse = await fetch('/api/twilio/webrtc-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'agent-verification' })
          });
          
          const tokenData = await tokenResponse.json();
          
          // Setup Twilio Device
          const twilioDevice = new (window as any).Twilio.Device(tokenData.token);
          deviceRef.current = twilioDevice;
          setDevice(twilioDevice);

          twilioDevice.ready(() => {
            console.log('✅ WebRTC Device ready');
            
            // Auto-connect to conference
            const conn = twilioDevice.connect();
            setConnection(conn);
            
            conn.accept(() => {
              console.log('✅ Connected to verification conference');
              setVerificationStatus('active');
              startTimer();
              
              toast({
                title: "Verification Active",
                description: "You're now connected and ready to receive calls",
              });
            });

            conn.disconnect(() => {
              console.log('Call disconnected');
              setVerificationStatus('completed');
              stopTimer();
              onComplete();
            });
          });

          twilioDevice.error((error: any) => {
            console.error('Device error:', error);
            toast({
              title: "Connection Error",
              description: "Failed to connect to verification system",
              variant: "destructive"
            });
            setVerificationStatus('ready');
          });

        } catch (error) {
          console.error('WebRTC setup failed:', error);
          setVerificationStatus('ready');
        }
      };
      
      document.head.appendChild(script);
      
    } catch (error) {
      console.error('Failed to start verification:', error);
      setVerificationStatus('ready');
      toast({
        title: "Error",
        description: "Failed to start verification system",
        variant: "destructive"
      });
    }
  };

  const endVerification = () => {
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

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusInfo = () => {
    switch (verificationStatus) {
      case 'ready':
        return { color: 'secondary', text: 'Ready to Start', icon: Phone };
      case 'connecting':
        return { color: 'default', text: 'Connecting...', icon: Clock };
      case 'active':
        return { color: 'default', text: 'Verification Active', icon: CheckCircle };
      case 'completed':
        return { color: 'secondary', text: 'Completed', icon: CheckCircle };
      default:
        return { color: 'secondary', text: 'Ready', icon: Phone };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5" />
              Live Verification System
            </span>
            <Badge variant={statusInfo.color as any}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {statusInfo.text}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Client Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Client Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Name:</strong> {session.firstName} {session.lastName}</p>
                <p><strong>Phone:</strong> {session.phone}</p>
              </div>
              <div>
                <p><strong>Location:</strong> {session.city}, {session.state}</p>
                <p><strong>Premium:</strong> {session.premium}</p>
              </div>
            </div>
          </div>

          {/* Status Display */}
          {verificationStatus === 'ready' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Ready to Start Verification</h3>
              <p className="text-gray-600 mb-6">
                Click the button below to join the verification conference and start receiving calls
              </p>
              <Button onClick={startVerification} size="lg" className="px-8">
                <PhoneCall className="w-4 h-4 mr-2" />
                Start Verification
              </Button>
            </div>
          )}

          {verificationStatus === 'connecting' && (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
              <h3 className="text-xl font-semibold mb-2">Connecting to Conference</h3>
              <p className="text-gray-600">Setting up your verification system...</p>
            </div>
          )}

          {verificationStatus === 'active' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <h3 className="text-lg font-semibold text-green-800">Verification Active!</h3>
                <p className="text-green-600">Ready to receive calls at +16052500834</p>
                <p className="text-sm text-green-600 mt-1">Call Duration: {formatDuration(callDuration)}</p>
              </div>

              <div className="flex justify-center space-x-4">
                <Button
                  onClick={toggleMute}
                  variant={isMuted ? "destructive" : "outline"}
                  size="lg"
                >
                  {isMuted ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                
                <Button onClick={endVerification} variant="destructive" size="lg">
                  <Phone className="w-4 h-4 mr-2" />
                  End Verification
                </Button>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">System Status</h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>✅ WebRTC Conference: Connected</p>
                  <p>✅ Auto-Answer: Active on +16052500834</p>
                  <p>✅ AI Assistant: Ready for activation</p>
                  <p>✅ Ready to receive verification calls</p>
                </div>
              </div>
            </div>
          )}

          {verificationStatus === 'completed' && (
            <div className="text-center py-8 bg-green-50 rounded-lg">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-xl font-semibold text-green-800 mb-2">Verification Complete!</h3>
              <p className="text-green-600">Call duration: {formatDuration(callDuration)}</p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
