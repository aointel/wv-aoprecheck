import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, CheckCircle, AlertCircle, Clock, PhoneCall, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LiveCallInterfaceProps {
  session: any;
  onCallComplete: () => void;
}

export function LiveCallInterface({ session, onCallComplete }: LiveCallInterfaceProps) {
  const [callStatus, setCallStatus] = useState<'ready' | 'initiating' | 'calling' | 'connected' | 'completed' | 'failed'>('ready');
  const [callId, setCallId] = useState<string>('');
  const { toast } = useToast();

  const clientName = `${session.firstName} ${session.lastName}`;
  const clientPhone = session.phone;
  const verificationNumber = "+15032018470";

  const initiateCall = async () => {
    try {
      setCallStatus('initiating');
      
      console.log('Initiating live call to verification number:', verificationNumber);
      
      const response = await fetch(`/api/verification/session/${session.sessionId}/start-live-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPhone: verificationNumber
        })
      });

      if (response.ok) {
        const result = await response.json();
        setCallId(result.callId);
        setCallStatus('calling');
        
        toast({ 
          title: "Twilio call initiated", 
          description: `Calling ${verificationNumber} via Twilio for ${clientName} verification` 
        });

        // Simulate call progression for demo
        setTimeout(() => {
          setCallStatus('connected');
          toast({ 
            title: "Call connected", 
            description: "Agent line connected - proceed with client verification" 
          });
        }, 3000);
      } else {
        const error = await response.json();
        setCallStatus('failed');
        toast({ 
          title: "Call failed", 
          description: error.message || "Failed to initiate call",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
      setCallStatus('failed');
      toast({ 
        title: "Error", 
        description: "Failed to initiate verification call",
        variant: "destructive" 
      });
    }
  };

  const completeVerification = async () => {
    try {
      setCallStatus('completed');
      
      const response = await fetch(`/api/verification/session/${session.sessionId}/complete-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: true,
          callId,
          completedAt: new Date().toISOString(),
          verificationNumber
        })
      });

      if (response.ok) {
        toast({ 
          title: "Verification complete", 
          description: "Live verification call completed successfully" 
        });
        onCallComplete();
      }
    } catch (error) {
      console.error('Failed to complete verification:', error);
    }
  };

  const getStatusInfo = () => {
    switch (callStatus) {
      case 'ready':
        return { color: 'secondary', text: 'Ready to Call', icon: Phone };
      case 'initiating':
        return { color: 'default', text: 'Initiating Call...', icon: Clock };
      case 'calling':
        return { color: 'default', text: 'Calling Agent Line...', icon: PhoneCall };
      case 'connected':
        return { color: 'default', text: 'Agent Connected', icon: Volume2 };
      case 'completed':
        return { color: 'secondary', text: 'Verification Complete', icon: CheckCircle };
      case 'failed':
        return { color: 'destructive', text: 'Call Failed', icon: AlertCircle };
      default:
        return { color: 'secondary', text: 'Unknown', icon: AlertCircle };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Live Verification Call System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold">{clientName}</p>
              <p className="text-gray-600">Client: {clientPhone}</p>
              <p className="text-sm text-blue-600">Agent Line: {verificationNumber}</p>
              {callId && <p className="text-sm text-gray-500">Call ID: {callId}</p>}
            </div>
            <Badge variant={statusInfo.color as any}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {statusInfo.text}
            </Badge>
          </div>

          {/* Client Information Panel */}
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg mb-4">
            <div>
              <h4 className="font-semibold mb-2">Client Information</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Name:</strong> {clientName}</p>
                <p><strong>Phone:</strong> {clientPhone}</p>
                {session.spouseName && <p><strong>Spouse:</strong> {session.spouseName}</p>}
                <p><strong>Location:</strong> {session.city}, {session.state}</p>
                <p><strong>Premium:</strong> {session.premium}</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Call Process</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p>1. System calls {verificationNumber}</p>
                <p>2. Agent receives call with client data</p>
                <p>3. Agent calls client at {clientPhone}</p>
                <p>4. Conduct verification on speaker phone</p>
                <p>5. Take screenshot and complete process</p>
              </div>
            </div>
          </div>

          {/* Call Controls */}
          {callStatus === 'ready' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">Ready to Start Live Call</h4>
                </div>
                <p className="text-sm text-blue-700">
                  Click below to initiate a live Twilio call to the verification line. The agent will receive 
                  the call with all client information and can then proceed to call the client for verification.
                </p>
              </div>
              <Button onClick={initiateCall} className="w-full" size="lg">
                <PhoneCall className="w-4 h-4 mr-2" />
                Call {verificationNumber} via Twilio
              </Button>
            </div>
          )}

          {callStatus === 'initiating' && (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p className="text-lg font-medium">Initiating live call...</p>
              <p className="text-sm text-gray-600">Connecting to verification line {verificationNumber}</p>
            </div>
          )}

          {callStatus === 'calling' && (
            <div className="text-center py-8 bg-orange-50 rounded-lg">
              <PhoneCall className="w-8 h-8 mx-auto mb-2 text-orange-600 animate-pulse" />
              <p className="text-lg font-medium text-orange-800">Twilio calling {verificationNumber}...</p>
              <p className="text-sm text-orange-600">Agent will receive Twilio call for {clientName} verification</p>
              <p className="text-xs text-orange-500 mt-2">Call ID: {callId}</p>
            </div>
          )}

          {callStatus === 'connected' && (
            <div className="space-y-4">
              <div className="text-center py-6 bg-green-50 rounded-lg">
                <Volume2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-lg font-medium text-green-800">Agent Line Connected!</p>
                <p className="text-sm text-green-600">Now call client {clientName} at {clientPhone}</p>
              </div>
              
              <div className="p-4 bg-white border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Verification Instructions:</h4>
                <div className="space-y-2 text-sm text-green-700">
                  <p>• Call {clientName} at {clientPhone}</p>
                  <p>• Ask client to put phone on speaker</p>
                  <p>• Verify name: "{clientName}"</p>
                  {session.spouseName && <p>• Verify spouse: "{session.spouseName}"</p>}
                  <p>• Verify location: "{session.city}, {session.state}"</p>
                  <p>• Verify premium: "{session.premium}"</p>
                  <p>• Take screenshot showing both parties</p>
                  <p>• Click "Complete Verification" when done</p>
                </div>
              </div>
              
              <Button 
                onClick={completeVerification}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Live Verification
              </Button>
            </div>
          )}

          {callStatus === 'completed' && (
            <div className="text-center py-8 bg-green-50 rounded-lg">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-xl font-semibold text-green-800 mb-2">Verification Complete!</h3>
              <p className="text-green-600">Live verification call completed successfully</p>
              <p className="text-sm text-green-500 mt-2">Call ID: {callId}</p>
            </div>
          )}

          {callStatus === 'failed' && (
            <div className="text-center py-8 bg-red-50 rounded-lg">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
              <p className="text-lg font-medium text-red-800">Call Failed</p>
              <p className="text-sm text-red-600">Unable to connect to verification line</p>
              <Button 
                onClick={initiateCall} 
                className="mt-4"
                variant="outline"
              >
                <Phone className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}