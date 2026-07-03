import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Volume2, CheckCircle, RotateCcw, ArrowLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { VerificationSession } from "@shared/schema";

declare global {
  interface Window {
    Twilio: any;
    twilioDevice: any;
  }
}

interface VerificationProgressProps {
  sessionId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function VerificationProgress({ sessionId, onComplete, onBack }: VerificationProgressProps) {
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [deviceReady, setDeviceReady] = useState<boolean>(false);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [callStatus, setCallStatus] = useState<string>('ready');
  const [twilioDevice, setTwilioDevice] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [verificationProgress, setVerificationProgress] = useState<number>(0);
  const [showCompletionButton, setShowCompletionButton] = useState<boolean>(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/verification/session/${sessionId}`);
        if (response.ok) {
          const sessionData = await response.json();
          setSession(sessionData);
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      }
    };

    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    const initializeTwilio = async () => {
      try {
        if (!window.Twilio) {
          const script = document.createElement('script');
          script.src = 'https://media.twiliocdn.com/sdk/js/client/v1.13/twilio.min.js';
          script.async = false;
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        // Get correct endpoint based on platform
        const { getTwilioTokenEndpoint, isElectron } = await import('../../utils/webrtc-endpoints');
        const tokenEndpoint = getTwilioTokenEndpoint();
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (isElectron()) {
          headers['x-desktop-app'] = 'true';
        }

        const res = await fetch(tokenEndpoint, {
          credentials: 'include', // CRITICAL: Send session cookies for Electron
          headers
        });
        const data = await res.json();

        const device = new window.Twilio.Device(data.token, {
          logLevel: 0,
          answerOnBridge: true,
          allowIncomingWhileBusy: true
        });

        device.on('ready', () => {
          setDeviceReady(true);
          setTwilioDevice(device);
          window.twilioDevice = device;
        });

        device.on('connect', () => {
          setCallActive(true);
          setCallStatus('active');
          
          // Start 3-minute call timer
          const callStartTime = Date.now();
          (window as any).callStartTime = callStartTime;
          
          // Monitor call duration - complete after 2.4 minutes (144 seconds)
          const durationMonitor = setInterval(() => {
            const elapsed = (Date.now() - callStartTime) / 1000;
            const progressPercent = Math.min(Math.floor((elapsed / 144) * 100), 100);
            setVerificationProgress(progressPercent);
            
            // Complete verification after 2.4 minutes
            if (elapsed >= 144) {
              clearInterval(durationMonitor);
              setVerificationProgress(100);
              setShowCompletionButton(true);
              setCallStatus('verification_complete');
            }
          }, 1000); // Update every second
          
          (window as any).durationMonitor = durationMonitor;
        });

        device.on('disconnect', () => {
          setCallActive(false);
          setCallStatus('ready');
          
          // Clean up timers
          if ((window as any).durationMonitor) {
            clearInterval((window as any).durationMonitor);
          }
          if ((window as any).verificationProgressInterval) {
            clearInterval((window as any).verificationProgressInterval);
          }
        });

      } catch (error) {
        console.error('Twilio setup failed:', error);
      }
    };

    initializeTwilio();
  }, []);

  const startVerificationCall = async () => {
    if (!twilioDevice || !deviceReady) return;

    setCallStatus('calling');
    setVerificationProgress(0);

    try {
      // Get public IP for accurate tracking (bypasses proxy issues)
      let publicIp = null;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(5000)
        });
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          publicIp = ipData.ip;
          console.log('Agent public IP detected:', publicIp);
        }
      } catch (ipError) {
        console.warn('Could not detect agent public IP:', ipError);
      }

      // Capture AGENT IP address and location data
      await fetch(`/api/verification/session/${sessionId}/capture-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicIp })
      });

      if (session) {
        await fetch('/api/taalk/initiate-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            clientPhone: session.phone,
            clientName: `${session.firstName} ${session.lastName}`,
            verificationMethod: session.verificationMethod,
            premium: session.premium,
            location: `${session.city}, ${session.state}`,
            clientCountry: session.clientCountry,
            clientRegion: session.clientRegion,
            clientCity: session.clientCity,
          }),
        });
      }

      await twilioDevice.connect({
        conferenceName: 'AO-Verification-Live'
      });

      // Start progress simulation during active call
      const progressInterval = setInterval(() => {
        setVerificationProgress(prev => {
          if (prev < 75) {
            return prev + 1; // Slow progress to 75%
          }
          return prev; // Stop at 75% until call completes
        });
      }, 2000); // Update every 2 seconds

      // Store interval reference for cleanup
      (window as any).verificationProgressInterval = progressInterval;

    } catch (error) {
      console.error('Call failed:', error);
      setCallStatus('failed');
    }
  };

  const completeVerification = () => {
    if (twilioDevice && callActive) {
      twilioDevice.disconnectAll();
    }
    onComplete();
  };

  const restartCall = async () => {
    try {
      // Step 1: Disconnect current call/conference
      if (twilioDevice && callActive) {
        twilioDevice.disconnectAll();
        setCallActive(false);
      }
      
      // Step 2: Reset call status
      setCallStatus('calling');
      
      // Step 3: Clear conference by calling disconnect endpoint
      await fetch('/api/twilio/disconnect-all-participants', { method: 'POST' });
      
      // Step 4: Reconnect WebRTC device
      await twilioDevice.connect({
        conferenceName: 'AO-Verification-Live'
      });
      
      // Step 5: Resend Taalk API call
      if (session) {
        await fetch('/api/taalk/initiate-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            clientPhone: session.phone,
            clientName: `${session.firstName} ${session.lastName}`,
            verificationMethod: session.verificationMethod,
            premium: session.premium,
            location: `${session.city}, ${session.state}`,
            clientCountry: session.clientCountry,
            clientRegion: session.clientRegion,
            clientCity: session.clientCity,
          }),
        });
      }
      
      console.log('Call restart completed successfully');
      
    } catch (error) {
      console.error('Call restart failed:', error);
      setCallStatus('failed');
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      // Test WebRTC connection
      const res = await fetch('/api/twilio/access-token', {
        credentials: 'include' // CRITICAL: Send session cookies for Electron
      });
      if (res.ok) {
        console.log('WebRTC connection test passed');
      }
      
      // Test Taalk connection (non-blocking)
      if (session) {
        await fetch('/api/taalk/initiate-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'TEST-CONNECTION',
            clientPhone: '(000) 000-0000',
            clientName: 'Connection Test',
            verificationMethod: 'test',
            premium: '$0',
            location: 'Test, Test',
          }),
        }).catch(() => console.log('Taalk test failed (expected)'));
      }
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setTestingConnection(false);
    }
  };

  if (!session) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Step 3: Verification Call</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Instructions */}
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-bold text-red-900 mb-3 text-lg">🚨 CRITICAL Setup Instructions</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded border-l-4 border-green-500">
                <h4 className="font-semibold text-green-800 mb-1">✅ Step 1: Use Speakerphone Only</h4>
                <p className="text-sm text-gray-700">Do NOT use a headset or AirPods. You must use your phone's speakerphone for this to work.</p>
              </div>
              
              <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                <h4 className="font-semibold text-blue-800 mb-1">✅ Step 2: Max Out Your Computer Audio</h4>
                <p className="text-sm text-gray-700">Turn your computer speakers to full volume. Make sure sound is clear and loud.</p>
              </div>
              
              <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                <h4 className="font-semibold text-purple-800 mb-1">✅ Step 3: Correct Placement Instructions</h4>
                <p className="text-sm text-gray-700">Place your phone's microphone right next to your computer speakers — this ensures the phone picks up the AI verifier's voice clearly.</p>
                <p className="text-sm text-gray-700 mt-1">Ensure your computer microphone is near your phone's speaker — so when the client speaks via WhatsApp, the verifier can hear their responses through your computer mic.</p>
              </div>
              
              <div className="bg-white p-3 rounded border-l-4 border-orange-500">
                <h4 className="font-semibold text-orange-800 mb-1">🔗 How It Works:</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>• The client is connected to you via WhatsApp.</p>
                  <p>• The verifier speaks through your computer to your phone.</p>
                  <p>• Your phone carries that audio to the client over WhatsApp.</p>
                  <p>• The client responds, and the verifier listens via your computer mic.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Call Interface */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Verification Call Interface</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Call Duration Monitor */}
              {callStatus === 'active' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-sm text-blue-700">
                    Call monitoring: Duration tracking active
                  </div>
                </div>
              )}

              {/* Verification Progress Bar */}
              {(callStatus === 'active' || callStatus === 'verification_complete') && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            {callStatus === 'verification_complete' ? 'Verification Complete' : 
                             'Verification in progress...'}
                          </span>
                        </div>
                        <span className="text-xs text-blue-700">{verificationProgress}%</span>
                      </div>
                      
                      <div className="relative">
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${verificationProgress}%` }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full animate-pulse" />
                      </div>
                      
                      {callStatus === 'verification_complete' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700 font-medium">
                              ✅ Call completed successfully
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="text-center space-y-4">
                {callStatus === 'ready' && (
                  <div className="space-y-4">
                    <Button 
                      onClick={startVerificationCall}
                      disabled={!deviceReady}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-xl font-semibold"
                      size="lg"
                    >
                      <Phone className="w-8 h-8 mr-4" />
                      Start Verification
                    </Button>
                    
                    <Button 
                      onClick={onBack}
                      variant="outline"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 py-3"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Screenshot
                    </Button>
                  </div>
                )}

                {callStatus === 'calling' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <p className="text-yellow-800 font-medium text-lg">Connecting...</p>
                  </div>
                )}

                {callStatus === 'active' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <p className="text-blue-800 font-medium text-lg mb-2">Call Active</p>
                      <p className="text-blue-700">Verification call in progress...</p>
                      <p className="text-xs text-blue-600 mt-2">⏳ Verification in progress</p>
                    </div>
                    
                    <Button 
                      onClick={restartCall}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 py-4 text-lg"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Restart Call
                    </Button>
                  </div>
                )}

                {callStatus === 'failed' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                      <p className="text-red-800 font-medium text-lg">Connection failed</p>
                    </div>
                    
                    <Button 
                      onClick={startVerificationCall}
                      disabled={!deviceReady}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg"
                    >
                      <Phone className="w-5 h-5 mr-2" />
                      Retry Connection
                    </Button>
                  </div>
                )}

                {showCompletionButton && callStatus === 'verification_complete' && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <p className="text-green-800 font-medium text-lg mb-2">✅ Verification Complete</p>
                      <p className="text-green-700">Call completed successfully - Ready to finish</p>
                    </div>
                    
                    <Button 
                      onClick={completeVerification}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-xl font-semibold"
                      size="lg"
                    >
                      <CheckCircle className="w-8 h-8 mr-4" />
                      Complete Verification
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-center">
                <button 
                  onClick={testConnection}
                  disabled={testingConnection || !deviceReady}
                  className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}