import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Twilio: any;
    twilioDevice: any;
  }
}

const WebRtcTest = () => {
  const [status, setStatus] = useState<string>('🔄 Loading Twilio SDK...');
  const [deviceReady, setDeviceReady] = useState<boolean>(false);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [twilioDevice, setTwilioDevice] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [deviceStatus, setDeviceStatus] = useState('Initializing...');

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const loadAndInit = async () => {
      // Check if Twilio SDK is already loaded
      if (window.Twilio) {
        console.log('🔄 Twilio SDK already loaded, initializing device...');
        await initializeTwilioDevice();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://media.twiliocdn.com/sdk/js/client/v1.13/twilio.min.js';
      script.async = false;

      script.onload = async () => {
        addLog('✅ Twilio SDK loaded successfully');
        await initializeTwilioDevice();
      };

      script.onerror = (error) => {
        addLog('❌ Failed to load Twilio SDK');
        setDeviceStatus('SDK Load Failed');
        console.error('Twilio SDK load error:', error);
      };

      document.head.appendChild(script);
    };

    const initializeTwilioDevice = async () => {
      try {
        setStatus('🔄 Getting access token...');

        const res = await fetch('/api/twilio/access-token');
        if (!res.ok) {
          throw new Error(`Token request failed: ${res.status}`);
        }

        const { token, identity } = await res.json();
        console.log('🎫 Token received for identity:', identity);

        setStatus('🔄 Initializing Twilio device...');

        const device = new window.Twilio.Device(token, { 
          debug: true,
          enableRingingState: true,
          closeProtection: true
        });

        device.on('ready', () => {
          addLog('✅ Twilio Device is ready for calls');
          setStatus('✅ Device Ready - Can make calls');
          setDeviceStatus('Ready');
          setDeviceReady(true);
        });

        device.on('error', (err: any) => {
          addLog(`❌ Device error: ${err.message}`);
          setStatus(`❌ Device Error: ${err.message}`);
          setDeviceStatus('Error');
          setDeviceReady(false);
        });

        device.on('connect', (conn: any) => {
          addLog('📞 Call connected to conference');
          setStatus('📞 Call Connected');
          setConnectionStatus('Connected');
          setCallActive(true);
        });

        device.on('disconnect', (conn: any) => {
          addLog('📞 Call disconnected');
          setStatus('📞 Call Ended');
          setConnectionStatus('Disconnected');
          setCallActive(false);
        });

        device.on('incoming', (conn: any) => {
          addLog('📲 Incoming call detected - auto accepting');
          setStatus('📲 Incoming Call');
          conn.accept();
        });

        device.on('cancel', () => {
          addLog('📞 Call cancelled');
          setStatus('🚫 Call Cancelled');
          setConnectionStatus('Disconnected');
          setCallActive(false);
        });

        // Make device globally accessible for debugging
        window.twilioDevice = device;
        addLog('🔧 Device ready and accessible as window.twilioDevice');
        setTwilioDevice(device);

        console.log('🎯 Twilio Device fully initialized and ready');

      } catch (error: any) {
        addLog(`❌ Device initialization error: ${error}`);
        setStatus(`❌ Init Failed: ${error?.message || 'Unknown error'}`);
        setDeviceStatus('Failed');
        setDeviceReady(false);
      }
    };

    loadAndInit();

    // Cleanup on unmount
    return () => {
      if ((window as any).twilioDevice) {
        try {
          (window as any).twilioDevice.destroy();
          console.log('🧹 Twilio device cleaned up');
        } catch (e) {
          console.warn('⚠️ Device cleanup warning:', e);
        }
      }
    };
  }, []);

  const disconnectCall = () => {
    try {
      const device = twilioDevice || (window as any).twilioDevice;

      if (device && device.activeConnection) {
        addLog('📴 Disconnecting from conference...');
        setStatus('📴 Disconnecting...');
        device.activeConnection.disconnect();
        setConnectionStatus('Disconnected');
      } else {
        addLog('⚠️ No active connection to disconnect');
        setStatus('⚠️ No active call');
        setConnectionStatus('Disconnected');
        setCallActive(false);
      }
    } catch (error) {
      addLog(`❌ Disconnect error: ${error}`);
      setStatus('❌ Disconnect failed');
      console.error('Disconnect error:', error);
    }
  };

  const connectToConference = async () => {
    try {
      const device = twilioDevice || (window as any).twilioDevice;

      if (!device) {
        addLog('❌ Device not initialized');
        setStatus('❌ Device not initialized');
        return;
      }

      if (!deviceReady) {
        addLog('❌ Device not ready - wait for ready status');
        setStatus('❌ Device not ready - wait for ready status');
        return;
      }

      if (callActive) {
        addLog('⚠️ Call already active');
        setStatus('⚠️ Call already active');
        return;
      }

      addLog('🔗 Connecting to AO-Verification-Live conference...');
      setStatus('🔄 Connecting to conference...');
      setConnectionStatus('Connecting...');

      // First, trigger Taalk API call to initiate client call
      addLog('📞 Triggering Taalk call to client...');
      try {
        const taalkResponse = await fetch('/api/taalk/initiate-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: 'webrtc-test-' + Date.now(),
            clientPhone: '(503) 201-8470', // Test phone number
            clientName: 'Test Client',
            verificationMethod: 'phone',
            premium: 150,
            location: 'Portland, OR',
            clientCountry: 'United States',
            clientRegion: 'Oregon',
            clientCity: 'Portland'
          })
        });

        if (taalkResponse.ok) {
          const taalkResult = await taalkResponse.json();
          addLog('✅ Taalk call initiated successfully');
          console.log('Taalk response:', taalkResult);
        } else {
          addLog('⚠️ Taalk call failed, continuing with WebRTC only');
          console.error('Taalk call failed:', await taalkResponse.text());
        }
      } catch (taalkError) {
        addLog('⚠️ Taalk call error, continuing with WebRTC only');
        console.error('Taalk error:', taalkError);
      }

      // Make outbound call to join conference
      const connection = device.connect({
        conference: 'AO-Verification-Live',
        identity: 'WebRTC-Agent'
      });

      connection.on('accept', () => {
        addLog('✅ Successfully joined conference');
        setStatus('✅ Joined Conference - Audio Active');
        setConnectionStatus('Connected');
        setCallActive(true);
      });

      connection.on('error', (err: any) => {
        addLog(`❌ Connection error: ${err.message}`);
        setStatus(`❌ Connection Error: ${err.message}`);
        setConnectionStatus('Error');
        setCallActive(false);
      });

    } catch (error: any) {
      addLog(`❌ Conference connection failed: ${error}`);
      setStatus(`❌ Connection Failed: ${error?.message || 'Unknown error'}`);
      setConnectionStatus('Failed');
      console.error('Conference connection failed:', error);
    }
  };

  const testDeviceStatus = () => {
    if (window.twilioDevice) {
      const status = window.twilioDevice.status();
      addLog(`📊 Device status: ${status}`);
    } else {
      addLog('❌ No device available');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🎧 WebRTC + Taalk Integration Test</CardTitle>
            <div className="flex gap-4 flex-wrap">
              <div className={`px-3 py-1 rounded text-sm font-medium ${
                status === 'Ready' ? 'bg-green-100 text-green-800' :
                status.includes('Failed') || status.includes('Error') ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                WebRTC: {status}
              </div>
              <div className={`px-3 py-1 rounded text-sm font-medium ${
                connectionStatus === 'Connected' ? 'bg-green-100 text-green-800' :
                connectionStatus === 'Connecting...' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                Conference: {connectionStatus}
              </div>
              <div className="px-3 py-1 rounded text-sm font-medium bg-purple-100 text-purple-800">
                Taalk: Integrated
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {!callActive ? (
                <Button 
                  onClick={connectToConference}
                  disabled={!deviceReady}
                  className="bg-green-600 hover:bg-green-700"
                >
                  📞 Connect to Conference
                </Button>
              ) : (
                <Button 
                  onClick={disconnectCall}
                  variant="destructive"
                >
                  🔌 Disconnect
                </Button>
              )}
              <Button 
                onClick={testDeviceStatus}
                variant="outline"
              >
                📊 Check Device Status
              </Button>
            </div>

            <div className="p-4 bg-black text-green-400 rounded font-mono text-sm h-64 overflow-y-auto">
              <div className="text-green-300 mb-2">WebRTC Console Logs:</div>
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
              {logs.length === 0 && <div className="text-gray-500">Waiting for logs...</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📋 Test Information & Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Voice Endpoint:</strong> /voice</div>
              <div><strong>Conference Room:</strong> AO-Verification-Live</div>
              <div><strong>Twilio Phone:</strong> +16052500834</div>
              <div><strong>Taalk Integration:</strong> Triggers client call automatically</div>
              <div><strong>Test Flow:</strong> Click "Connect to Conference" → Taalk calls client → Both join same conference</div>

              <div className="mt-4 p-3 bg-gray-100 rounded">
                <strong>🔧 Debug Console Commands:</strong>
                <div className="mt-2 font-mono text-xs space-y-1">
                  <div>Check if SDK loaded: <code>typeof Twilio</code></div>
                  <div>Check device: <code>twilioDevice.status()</code></div>
                  <div>Connect to conference: <code>twilioDevice.connect(&#123; To: 'conference', Room: 'AO-Verification-Live' &#125;);</code></div>
                  <div>Simple connect: <code>twilioDevice.connect();</code></div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded">
                <strong>🎯 Twilio Console Check:</strong>
                <div className="text-xs mt-1">
                  Go to: <a href="https://www.twilio.com/console/voice/rooms" target="_blank" className="text-blue-600 underline">Twilio Console → Voice → Conferences</a>
                </div>
                <div className="text-xs mt-1">
                  Look for "AO-Verification-Live" and verify 2 participants:
                </div>
                <div className="text-xs ml-2">
                  ✅ Client: WebRTC-Agent-XXXX<br/>
                  ✅ Phone Number leg
                </div>
              </div>

              <div className="mt-4 p-3 bg-red-50 rounded">
                <strong>🚨 SDK Version Notes:</strong>
                <div className="text-xs mt-1">
                  Using Twilio Client SDK v1.13 - audio controls like setInputVolume() are not available.
                  For advanced audio controls, use Twilio Voice SDK v2+ instead.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebRtcTest;