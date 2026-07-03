import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, CheckCircle, AlertCircle, Clock, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HumanCallInterfaceProps {
  session: any;
  onCallComplete: () => void;
}

export function HumanCallInterface({ session, onCallComplete }: HumanCallInterfaceProps) {
  const [callStarted, setCallStarted] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const { toast } = useToast();

  const clientName = `${session.firstName} ${session.lastName}`;
  const clientPhone = session.phone;
  const verificationItems = [
    { label: "Full Name", value: clientName, verified: false },
    ...(session.spouseName ? [{ label: "Spouse Name", value: session.spouseName, verified: false }] : []),
    { label: "Location", value: `${session.city}, ${session.state}`, verified: false },
    { label: "Premium Amount", value: session.premium, verified: false }
  ];

  const copyPhone = () => {
    navigator.clipboard.writeText(clientPhone);
    toast({ title: "Phone number copied to clipboard" });
  };

  const startCall = async () => {
    // CRITICAL: Block verification call without client approval
    if (session.clientApprovalStatus !== 'approved') {
      toast({
        title: "Client Approval Required",
        description: "Cannot proceed with verification until client hits 'I Agree and Approve'",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setCallStarted(true);
      setCallInProgress(true);

      // Notify system that human call is starting
      const response = await fetch(`/api/verification/session/${session.sessionId}/start-human-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerPhone: "+15032018470", // TODO: Get from Producer Profile
          callType: "human_verification"
        })
      });

      if (response.ok) {
        toast({ 
          title: "Call initiated", 
          description: "Follow the verification checklist below" 
        });
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      toast({ 
        title: "Error", 
        description: "Failed to initiate call",
        variant: "destructive" 
      });
    }
  };

  const completeVerification = async () => {
    try {
      const response = await fetch(`/api/verification/session/${session.sessionId}/complete-human-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: true,
          callDuration: "5:30", // Could track actual duration
          verificationMethod: "human_call"
        })
      });

      if (response.ok) {
        setVerificationComplete(true);
        setCallInProgress(false);
        toast({ 
          title: "Verification complete", 
          description: "Human verification call completed successfully" 
        });
        onCallComplete();
      }
    } catch (error) {
      console.error('Failed to complete verification:', error);
      toast({ 
        title: "Error", 
        description: "Failed to complete verification",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Call Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Human Verification Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold">{clientName}</p>
              <div className="flex items-center gap-2">
                <p className="text-gray-600">{clientPhone}</p>
                <Button variant="outline" size="sm" onClick={copyPhone}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Badge variant={callInProgress ? "default" : verificationComplete ? "secondary" : "outline"}>
              {verificationComplete ? (
                <><CheckCircle className="w-4 h-4 mr-1" /> Complete</>
              ) : callInProgress ? (
                <><Clock className="w-4 h-4 mr-1" /> In Progress</>
              ) : (
                <><AlertCircle className="w-4 h-4 mr-1" /> Ready</>
              )}
            </Badge>
          </div>

          {!callStarted ? (
            <Button onClick={startCall} className="w-full">
              <Phone className="w-4 h-4 mr-2" />
              Start Verification Call
            </Button>
          ) : verificationComplete ? (
            <div className="text-center text-green-600 font-semibold">
              ✓ Verification Call Completed Successfully
            </div>
          ) : (
            <Button onClick={completeVerification} className="w-full bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Call as Complete
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Verification Checklist */}
      {callStarted && !verificationComplete && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">Call Instructions:</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Call client at {clientPhone}</li>
                <li>Identify yourself as their insurance producer</li>
                <li>Explain this is a verification call for their policy</li>
                <li><strong>Ask client to put phone on speaker</strong></li>
                <li>Verify each item below with verbal confirmation</li>
                <li>Take screenshot during call showing both you and client</li>
                <li>Click "Mark Call as Complete" when finished</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Information to Verify:</h4>
              {verificationItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{item.label}:</span>
                    <span className="ml-2 text-gray-700">"{item.value}"</span>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Keep the client on speaker phone throughout the entire verification process. 
                This ensures proper documentation and compliance with verification requirements.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}