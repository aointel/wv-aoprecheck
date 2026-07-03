import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Download, User, MapPin, Phone, DollarSign, Calendar, FileText, Shield, Clock } from "lucide-react";
import type { VerificationSession } from "@shared/schema";

interface EnterpriseCertificateProps {
  session: VerificationSession;
  onStartNew: () => void;
  onBack: () => void;
  onComplete?: () => void;
}

export function EnterpriseCertificate({ session, onStartNew, onBack, onComplete }: EnterpriseCertificateProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [certificateId, setCertificateId] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const callDuration = session.taalkCallDuration || 0;
  const isVerificationComplete =
    session.taalkCallStatus === 'completed' ||
    session.status === 'completed' ||
    session.status === 'verification_completed';
  const callNotStarted = session.taalkCallId && !session.taalkCallStatus && (!callDuration || callDuration === 0);
  const isPending = !isVerificationComplete || callNotStarted;

  useEffect(() => {
    const timestamp = Date.now().toString(36);
    const sessionHash = session.sessionId?.slice(-5) || 'XXXXX';
    setCertificateId(`AO-CERT-${timestamp}-${sessionHash}`.toUpperCase());
  }, [session.sessionId]);

  // Return to precheck dashboard after verification completes
  useEffect(() => {
    if (!onComplete || !isVerificationComplete) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete, isVerificationComplete]);


  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' PST';
  };

  const handleDownloadCertificate = async () => {
    setIsDownloading(true);
    try {
      // Generate production PDF certificate through backend API
      const response = await fetch('/api/verification/generate-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          certificateId,
          clientInfo: {
            firstName: session.firstName,
            lastName: session.lastName,
            spouseName: session.spouseName,
            phone: session.phone,
            city: session.city,
            state: session.state,
            premium: session.premium
          },
          verificationDetails: {
            method: session.verificationMethod?.toUpperCase(),
            status: 'COMPLETED',
            timestamp: formatTimestamp(currentTime),
            duration: callDuration
          }
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AO-Certificate-${session.sessionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Certificate Downloaded",
          description: "Your verification certificate has been downloaded successfully.",
        });
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to generate certificate');
      }
    } catch (error) {
      console.error('Certificate generation failed:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to generate certificate. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const clientName = session.spouseName 
    ? `${session.firstName} ${session.lastName} & ${session.spouseName}`
    : `${session.firstName} ${session.lastName}`;

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds === 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Success Header */}
      <Card className={`bg-gradient-to-br ${isPending ? 'from-yellow-50 via-amber-50 to-orange-50 border-2 border-yellow-200' : 'from-green-50 via-blue-50 to-indigo-50 border-2 border-green-200'} shadow-xl`}>
        <CardContent className="p-10">
          <div className="text-center">
            <div className="flex justify-center items-center mb-6">
              <div className={`w-20 h-20 bg-gradient-to-br ${isPending ? 'from-yellow-500 to-orange-600' : 'from-green-500 to-blue-600'} rounded-full flex items-center justify-center shadow-2xl`}>
                {isPending ? (
                  <Clock className="text-white w-12 h-12" />
                ) : (
                  <CheckCircle className="text-white w-12 h-12" />
                )}
              </div>
            </div>
            
            <h1 className="text-5xl font-bold text-gray-900 mb-3">
              {isPending ? 'Verification Submitted' : 'Verification Complete'}
            </h1>
            <p className="text-xl text-gray-700">
              {isPending 
                ? 'The policy verification has been submitted and is pending review.'
                : 'The policy verification has been successfully completed and submitted.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Warning if call not completed */}
      {isPending && (
        <Card className="bg-yellow-50 border-2 border-yellow-300 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Verification Call Required
                </h3>
                <p className="text-yellow-800">
                  {callNotStarted 
                    ? "The verification call has not been started yet. Please go back to Step 3 and start the verification call first."
                    : "The verification call has not been completed yet. Please complete the verification call before the verification can be marked as complete."}
                  {callDuration === 0 && !callNotStarted && " Call Duration: N/A - No call has been made."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Results */}
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Verification Results</h2>
            </div>
            
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-lg border ${isVerificationComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <span className="text-base font-semibold text-gray-700">Precheck Status</span>
                <div className={`flex items-center ${isVerificationComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                  <span className="font-bold">
                    {isVerificationComplete ? 'COMPLETED' : (session.status?.toUpperCase() || 'PENDING')}
                  </span>
                </div>
              </div>
              
              <div className={`flex items-center justify-between p-4 rounded-lg border ${isVerificationComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <span className="text-base font-semibold text-gray-700">Client Verified</span>
                <div className={`flex items-center ${isVerificationComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                  <span className="font-bold">
                    {isVerificationComplete ? 'VERIFIED' : 'PENDING REVIEW'}
                  </span>
                </div>
              </div>
              
              <div className={`flex items-center justify-between p-4 rounded-lg border ${isVerificationComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <span className="text-base font-semibold text-gray-700">Compliance</span>
                <div className={`flex items-center ${isVerificationComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                  <span className="font-bold">
                    {isVerificationComplete ? 'COMPLIANT' : 'PENDING REVIEW'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Information */}
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Client Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold text-gray-900 mb-1">{clientName}</p>
                <div className="flex items-center gap-2 text-gray-600 mt-2">
                  <MapPin className="w-4 h-4" />
                  <span>{session.city}, {session.state}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 mt-2">
                  <Phone className="w-4 h-4" />
                  <span>{session.phone}</span>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Premium</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">${session.premium}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Details */}
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Session Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Session ID</span>
              </div>
              <p className="text-base font-mono text-gray-900 break-all">{session.sessionId}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Timestamp</span>
              </div>
              <p className="text-base text-gray-900">{formatTimestamp(currentTime)}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Call Duration</span>
              </div>
              <p className="text-base font-bold text-gray-900">{formatDuration(callDuration)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={handleDownloadCertificate}
              disabled={isDownloading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg flex items-center gap-3 shadow-lg"
              size="lg"
            >
              <Download className="w-6 h-6" />
              {isDownloading ? 'Generating PDF...' : 'Download Certificate (PDF)'}
            </Button>
            
            {onComplete ? (
              <Button 
                onClick={onComplete}
                variant="outline"
                className="px-8 py-6 text-lg flex items-center gap-3 border-2"
                size="lg"
              >
                <CheckCircle className="w-6 h-6" />
                Return to Precheck
              </Button>
            ) : (
              <Button 
                onClick={onStartNew}
                variant="outline"
                className="px-8 py-6 text-lg flex items-center gap-3 border-2"
                size="lg"
              >
                <CheckCircle className="w-6 h-6" />
                New Verification
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
