import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Global device variable - exactly like OutboundDialerInterface
let device: any = null;

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

    device = new (window as any).Twilio.Device(token, { debug: true });

    device.on("ready", () => {
      console.log("✅ Twilio device ready");
    });

    device.on("error", (error: any) => {
      console.error("❌ Twilio.Device error:", error);
    });

    return true;
  } catch (err: any) {
    console.error("❌ powerOnWebRTC failed:", err);
    return false;
  }
};

export function WebRTCTestDirect() {
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [status, setStatus] = useState('Not Connected');

  const handlePowerToggle = async () => {
    console.log("🔌 Power button clicked!");
    if (!isPoweredOn) {
      setStatus('Initializing WebRTC...');
      const result = await powerOnWebRTC("agent123");
      if (result) {
        setIsPoweredOn(true);
        setStatus('WebRTC Ready');
      } else {
        setStatus('Power On Failed');
      }
    } else {
      console.log("🔻 Powering down...");
      device?.disconnectAll();
      if (device) {
        device.destroy();
        device = null;
      }
      setIsPoweredOn(false);
      setStatus('Powered Off');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>WebRTC Direct Test (No Auth Required)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Status: {status}</div>
            <div className={`w-4 h-4 rounded-full mx-auto mb-4 ${
              isPoweredOn ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
          
          <Button 
            onClick={handlePowerToggle}
            className={`w-full h-16 text-xl font-bold ${
              isPoweredOn 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPoweredOn ? 'Power Off WebRTC' : 'Power On WebRTC'}
          </Button>

          <div className="bg-gray-50 p-4 rounded text-sm">
            <strong>Expected Console Output:</strong>
            <pre className="mt-2 text-xs">
{`🔌 Power button clicked!
🟢 ENTERED powerOnWebRTC()
🔑 Got token: eyJhbG...
✅ Twilio device ready`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}