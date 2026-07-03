import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CallInterfaceProps {
  session: any;
  onCallComplete: () => void;
}

// Declare Twilio Device types
declare global {
  interface Window {
    Twilio: any;
  }
}

export function CallInterface({ session, onCallComplete }: CallInterfaceProps) {
  const [deviceStatus, setDeviceStatus] = useState<'loading' | 'ready' | 'connecting' | 'connected' | 'error'>('loading');
  const [callStatus, setCallStatus] = useState<'waiting' | 'connecting' | 'connected' | 'completed'>('waiting');
  const [muted, setMuted] = useState(false);
  const [device, setDevice] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const { toast } = useToast();

  // Load Twilio SDK and initialize device
  useEffect(() => {
    const loadTwilioSDK = () => {
      if (window.Twilio) {
        initializeTwilioDevice();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.twilio.com/js/client/releases/1.14.1/twilio.min.js';
      script.onload = initializeTwilioDevice;
      script.onerror = () => {
        console.error('Failed to load Twilio SDK');
        setDeviceStatus('error');
      };
      document.head.appendChild(script);
    };

    const initializeTwilioDevice = async () => {
      try {
        console.log('🔑 Initializing Twilio Device...');

        // Get correct endpoint based on platform
        const { getTwilioTokenEndpoint, isElectron } = await import('../../utils/webrtc-endpoints');
        const tokenEndpoint = getTwilioTokenEndpoint();
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (isElectron()) {
          headers['x-desktop-app'] = 'true';
        }

        // Get access token from server
        const tokenResponse = await fetch(tokenEndpoint, {
          credentials: 'include', // CRITICAL: Send session cookies for Electron
          headers
        });
        if (!tokenResponse.ok) throw new Error('Failed to get access token');

        const { token, identity } = await tokenResponse.json();
        console.log('✅ Got access token for identity:', identity);

        // Initialize Twilio Device
        const twilioDevice = new window.Twilio.Device(token, {
          debug: true,
          closeProtection: true
        });

        // Set up device event handlers
        twilioDevice.on('ready', () => {
          console.log('✅ Twilio Device ready');
          setDeviceStatus('ready');
          setDevice(twilioDevice);
        });

        twilioDevice.on('error', (error: any) => {
          console.error('❌ Twilio Device error:', error);
          setDeviceStatus('error');
        });

        twilioDevice.on('connect', (conn: any) => {
          console.log('📞 Call connected:', conn.parameters);
          setConnection(conn);
          setCallStatus('connected');
          setCallStartTime(Date.now());

          // Set up connection event handlers
          conn.on('disconnect', () => {
            console.log('📞 Call disconnected');
            setCallStatus('completed');
            setConnection(null);
            setCallStartTime(null);
          });
        });

        twilioDevice.on('disconnect', () => {
          console.log('📞 Device disconnected');
          setCallStatus('waiting');
          setConnection(null);
          setCallStartTime(null);
        });

      } catch (error) {
        console.error('Failed to initialize Twilio Device:', error);
        setDeviceStatus('error');
      }
    };

    loadTwilioSDK();

    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected' && callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus, callStartTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startVerification = async () => {
    if (!device || deviceStatus !== 'ready') {
      toast({ title: "Device not ready", variant: "destructive" });
      return;
    }

    try {
      setCallStatus('connecting');
      setDeviceStatus('connecting');

      console.log('🔗 Connecting to AO-Verification-Live conference...');

      // Connect to the same conference room that phone calls join
      const params = {
        conference: 'AO-Verification-Live'
      };

      const conn = await device.connect(params);
      console.log('✅ WebRTC connected to conference');

      toast({ title: "Connected to verification conference" });

    } catch (error) {
      console.error('❌ Connection failed:', error);
      setCallStatus('waiting');
      setDeviceStatus('ready');
    }
  };

  const toggleMute = () => {
    if (connection) {
      const newMutedState = !muted;
      connection.mute(newMutedState);
      setMuted(newMutedState);
      toast({ title: newMutedState ? "Microphone muted" : "Microphone unmuted" });
    }
  };

  const endCall = () => {
    if (device) {
      device.disconnectAll();
    }
    setCallStatus('completed');
    onCallComplete();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call Verification Section
        </CardTitle>
        <CardDescription>
          Click "Start Verification" to connect to the conference. Calls to +16052500834 will auto-join.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* WebRTC Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">WebRTC Conference</h3>
            <Badge variant={deviceStatus === 'ready' ? "default" : deviceStatus === 'error' ? "destructive" : "secondary"}>
              {deviceStatus === 'loading' && "Loading..."}
              {deviceStatus === 'ready' && "Ready"}
              {deviceStatus === 'connecting' && "Connecting..."}
              {deviceStatus === 'connected' && "Connected"}
              {deviceStatus === 'error' && "Error"}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            Browser microphone & speakers connection
          </p>
        </div>

        {/* Main Action Button */}
        <div className="space-y-4">
          {deviceStatus === 'ready' && callStatus === 'waiting' && (
            <Button onClick={startVerification} className="w-full bg-green-600 hover:bg-green-700 text-lg py-3">
              <PhoneCall className="h-5 w-5 mr-2" />
              Start Verification
            </Button>
          )}

          {callStatus === 'connecting' && (
            <div className="text-center py-4">
              <div className="animate-pulse text-blue-600 mb-2">Connecting to conference...</div>
              <Button variant="destructive" onClick={endCall}>
                <PhoneOff className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}

          {callStatus === 'connected' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-green-800 font-medium mb-1">✅ Connected to Conference</div>
                <div className="text-green-600 text-sm">Duration: {formatDuration(callDuration)}</div>
                <div className="text-green-600 text-sm mt-1">AI verification assistant ready</div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={toggleMute} className="flex-1">
                  {muted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {muted ? "Unmute" : "Mute"}
                </Button>
                <Button variant="destructive" onClick={endCall} className="flex-1">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              </div>
            </div>
          )}

          {callStatus === 'completed' && (
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-gray-600 mb-2">Verification completed</div>
              <div className="text-sm text-gray-500">Duration: {formatDuration(callDuration)}</div>
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">Auto-Answer System</span>
            <Badge variant="outline">Phone: +16052500834</Badge>
          </div>
          <div className="text-sm text-blue-700">
            {callStatus === 'connected' ? (
              <span className="text-green-700">🎙️ Conference active - Ready for calls</span>
            ) : (
              <span>⏳ Waiting for producer to join conference...</span>
            )}
          </div>
          <div className="text-xs text-blue-600">
            Taalk can call +16052500834 anytime. Calls will be answered automatically.
          </div>
        </div>

        {deviceStatus === 'error' && (
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-red-800 font-medium mb-1">Connection Error</div>
            <div className="text-red-600 text-sm">Failed to initialize WebRTC. Please refresh the page.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}