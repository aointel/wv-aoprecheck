import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Video, Phone, Shield, Clock } from "lucide-react";
import { ZoomDisclaimerModal } from "@/components/modals/ZoomDisclaimerModal";

interface ZoomVerificationStepProps {
  session: any;
  onComplete: () => void;
  onNext: () => void;
}

export const ZoomVerificationStep: React.FC<ZoomVerificationStepProps> = ({
  session,
  onComplete,
  onNext
}) => {
  const [zoomRoomId, setZoomRoomId] = useState(session?.zoomRoomId || '');
  const [zoomPassword, setZoomPassword] = useState(session?.zoomPassword || '1');
  const [isJoining, setIsJoining] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleJoinZoom = () => {
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = () => {
    setShowDisclaimer(false);
    setIsJoining(true);
    
    // Construct Zoom meeting URL
    const zoomUrl = `https://zoom.us/j/${zoomRoomId}?pwd=${zoomPassword}`;
    
    // Open Zoom meeting in new window
    window.open(zoomUrl, '_blank');
    
    // Mark as complete after a delay
    setTimeout(() => {
      setIsJoining(false);
      onComplete();
    }, 3000);
  };

  const generateZoomRoom = async () => {
    try {
      const response = await fetch('/api/zoom/create-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session?.sessionId,
          topic: `Verification Call - ${session?.firstName} ${session?.lastName}`
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setZoomRoomId(data.meetingId);
        setZoomPassword(data.password || '1');
      }
    } catch (error) {
      console.error('Failed to create Zoom meeting:', error);
    }
  };

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-6 w-6 text-blue-600" />
            Zoom Verification Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Secure Video Verification
            </h3>
            <p className="text-blue-800 text-sm">
              Join a secure Zoom meeting to complete your policy verification with a licensed agent.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zoomRoomId">Meeting ID</Label>
              <Input
                id="zoomRoomId"
                value={zoomRoomId}
                onChange={(e) => setZoomRoomId(e.target.value)}
                placeholder="Enter Zoom Meeting ID"
              />
            </div>
            <div>
              <Label htmlFor="zoomPassword">Meeting Password</Label>
              <Input
                id="zoomPassword"
                value={zoomPassword}
                onChange={(e) => setZoomPassword(e.target.value)}
                placeholder="Meeting password"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={generateZoomRoom}
              className="flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              Generate New Meeting
            </Button>
          </div>

          {zoomRoomId && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Meeting Ready</h4>
              <div className="space-y-2 text-sm text-green-800">
                <p><strong>Meeting ID:</strong> {zoomRoomId}</p>
                <p><strong>Password:</strong> {zoomPassword}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Estimated time: 5-10 minutes
            </Badge>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onNext}>
                Skip for Now
              </Button>
              <Button 
                onClick={handleJoinZoom}
                disabled={!zoomRoomId || isJoining}
                className="flex items-center gap-2"
              >
                {isJoining ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Joining...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Join Meeting
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ZoomDisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        onAccept={handleDisclaimerAccept}
      />
    </>
  );
};

export default ZoomVerificationStep;