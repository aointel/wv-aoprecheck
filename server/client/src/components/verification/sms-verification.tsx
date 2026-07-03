import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { VerificationSession } from "@shared/schema";

interface SMSVerificationProps {
  session: VerificationSession;
  onRefresh: () => void;
  onBack?: () => void;
  onContinue?: () => void;
}

export function SMSVerification({ session, onRefresh, onBack, onContinue }: SMSVerificationProps) {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendSMS = async () => {
    setIsSending(true);
    try {
      const response = await fetch(`/api/verification/session/${session.sessionId}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          phone: session.phone,
        }),
      });

      if (response.ok) {
        toast({
          title: "SMS Sent Successfully",
          description: `Verification disclaimer sent to ${session.phone}`,
        });
        onRefresh();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Send SMS",
          description: error.message || "Please check your Twilio configuration",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send SMS verification",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getApprovalStatusBadge = () => {
    switch (session.clientApprovalStatus) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Agreed</Badge>;
      case 'denied':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Not Completed</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Client SMS
        </CardTitle>
        <CardDescription>
          Send verification link to {session.firstName} {session.lastName} at {session.phone}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Requirements Status */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900 mb-3">Required for Verification:</h4>
          
          <div className="flex items-center justify-between">
            <span className="flex items-center">
              {session.screenshotPath ? (
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-600 mr-2" />
              )}
              Screenshot Upload
            </span>
            {session.screenshotPath ? (
              <Badge className="bg-green-100 text-green-800">Complete</Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center">
              {session.clientApprovalStatus === 'approved' ? (
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-600 mr-2" />
              )}
              Client Approval
            </span>
            {getApprovalStatusBadge()}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>SMS Status:</span>
          {session.smsVerificationSent ? (
            <Badge className="bg-blue-100 text-blue-800">Sent</Badge>
          ) : (
            <Badge variant="secondary">Not Sent</Badge>
          )}
        </div>

        {session.clientApprovalTime && (
          <div className="text-sm text-gray-600">
            Completed: {new Date(session.clientApprovalTime).toLocaleString()}
          </div>
        )}

        {session.clientIpAddress && (
          <div className="text-xs bg-gray-50 p-3 rounded border">
            <div className="font-medium text-gray-700 mb-2">📍 Client Location & IP Data</div>
            <div className="space-y-1 text-gray-600">
              <div><strong>IP Address:</strong> {session.clientIpAddress}</div>
              {session.clientCountry && (
                <div><strong>Location:</strong> {session.clientCity ? `${session.clientCity}, ` : ''}{session.clientRegion ? `${session.clientRegion}, ` : ''}{session.clientCountry}</div>
              )}
              {session.clientLatitude && session.clientLongitude && (
                <div><strong>Coordinates:</strong> {parseFloat(session.clientLatitude).toFixed(4)}, {parseFloat(session.clientLongitude).toFixed(4)}</div>
              )}
              {session.clientTimezone && (
                <div><strong>Timezone:</strong> {session.clientTimezone}</div>
              )}
              {session.clientIsp && (
                <div><strong>ISP:</strong> {session.clientIsp}</div>
              )}
              {session.clientApprovalTime && (
                <div><strong>Approved:</strong> {new Date(session.clientApprovalTime).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button 
            onClick={handleSendSMS} 
            disabled={isSending}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending SMS...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                {session.smsVerificationSent ? 'Resend SMS' : 'Send SMS'}
              </>
            )}
          </Button>
          
          {session.smsVerificationSent && (
            <p className="text-xs text-gray-500 text-center">
              Client not responding? You can resend the SMS above.
            </p>
          )}
        </div>

        {session.smsVerificationSent && session.clientApprovalStatus === 'pending' && (
          <div className="text-center text-sm text-gray-600">
            Waiting for client approval...
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          {onContinue && (
            <div className="ml-auto">
              <Button 
                onClick={onContinue}
                disabled={!session.screenshotPath || session.clientApprovalStatus !== 'approved'}
              >
                Continue to Verification
              </Button>
              {(!session.screenshotPath || session.clientApprovalStatus !== 'approved') && (
                <p className="text-xs text-red-600 mt-1 text-right">
                  Both screenshot and client disclaimer required
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}