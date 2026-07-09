
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Video, Smartphone, ArrowLeft, CheckCircle, Clock, Camera, Upload, ArrowRight, QrCode, Link, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import QRCode from "qrcode";
import { QRCodeDisplay } from "./qr-code-display";
import { TaalkCallInterface } from "./taalk-call-interface";
import { LiveCallInterface } from "./live-call-interface";
import { HumanCallInterface } from "./human-call-interface";
// SimplifiedVerification removed - phone verification now uses same SMS interface as Zoom

type VerificationMethod = "phone" | "whatsapp" | "zoom" | "facetime";

interface UnifiedVerificationProps {
  sessionId: string;
  method: VerificationMethod;
  clientName: string;
  onBack: () => void;
  onContinue: () => void;
  onSkipStep3?: () => void;
  language?: 'en' | 'es';
  /** Flat layout inside AO Precheck workflow panel */
  embedded?: boolean;
}

export function UnifiedVerification({ sessionId, method, clientName, onBack, onContinue, onSkipStep3, language, embedded = false }: UnifiedVerificationProps) {
  const [producerQrCodeUrl, setproducerQrCodeUrl] = useState<string>("");
  const [clientQrCodeUrl, setClientQrCodeUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch session data to get language if not provided
  const { data: sessionData } = useQuery({
    queryKey: [`/api/verification/session/${sessionId}`],
    enabled: !!sessionId
  });

  // Use language prop or session data, default to English
  const currentLanguage = language || (sessionData as any)?.language || 'en';

  // Use aoprecheck host for QR/links (SMS body uses VERIFICATION_BASE_URL server-side).
  const verificationHost =
    (typeof window !== 'undefined' && window.location.hostname.includes('aoprecheck'))
      ? window.location.origin
      : 'https://aoprecheck-production.up.railway.app';

  // Generate producer verification URL for QR code (for producer mobile access)
  const producerVerificationUrl = sessionId 
    ? `${verificationHost}/agent-verify${currentLanguage === 'es' ? '-es' : ''}/${sessionId}`
    : '';
  
  // Generate CLIENT verification URL for QR code (for client mobile access)  
  const clientVerificationUrl = sessionId
    ? `${verificationHost}/client-verify${currentLanguage === 'es' ? '-es' : ''}/${sessionId}`
    : '';

  useEffect(() => {
    const initializeStep2 = async () => {
      try {
        // Generate both producer and Client QR codes only if URLs are valid
        if (producerVerificationUrl && clientVerificationUrl) {
          const producerQrUrl = await QRCode.toDataURL(producerVerificationUrl, { width: 256 });
          const clientQrUrl = await QRCode.toDataURL(clientVerificationUrl, { width: 256 });
          setproducerQrCodeUrl(producerQrUrl);
          setClientQrCodeUrl(clientQrUrl);
        }

        // CRITICAL: ALWAYS send SMS to both client and producer for ALL verification methods (Zoom, phone, whatsapp, facetime)
        // Prefer /api/verification/.../send-sms — it is allowlisted under SECTION=precheck.
        // /api/step2-webhook was missing from the precheck allowlist and 404'd in production.
        console.log(`📱 Sending SMS to both client and producer for session ${sessionId} (method: ${method})...`);
        try {
          await apiRequest('POST', `/api/verification/session/${sessionId}/send-sms`);
          console.log('✅ SMS sent via /api/verification/session/.../send-sms');
        } catch (sendSmsErr) {
          console.warn('send-sms failed, falling back to step2-webhook', sendSmsErr);
          await apiRequest('POST', `/api/step2-webhook/${sessionId}`);
          console.log('✅ SMS sent via step2-webhook fallback');
        }

      } catch (error) {
        console.error('❌ Error initializing Step 2 and sending SMS:', error);
      }
    };

    initializeStep2();
  }, [producerVerificationUrl, clientVerificationUrl, sessionId, method]); // Include method in dependencies

  // Poll for session status with cache busting
  const { data: session } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/verification/session/${sessionId}?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      return response.json();
    },
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
    staleTime: 0, // Never consider data stale
    gcTime: 0, // Don't cache (updated property name)
  });

  // Poll for Taalk call status when in Step 3
  const { data: callStatus } = useQuery({
    queryKey: ['/api/verification/session', sessionId, 'call-status'],
    queryFn: async () => {
      const response = await fetch(`/api/verification/session/${sessionId}/call-status`);
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds
    enabled: !!sessionId, // Only poll when sessionId exists
  });

  // Send SMS to client mutation
  const smsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/verification/session/${sessionId}/send-sms`);
    },
    onSuccess: () => {
      toast({
        title: "SMS sent to client",
        description: "Client verification link sent",
      });
    },
    onError: (error) => {
      toast({
        title: "SMS delivery blocked",
        description: "SMS blocked",
        variant: "destructive",
      });
    },
  });

  // Send SMS to producer mutation  
  const producerSmsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/verification/session/${sessionId}/send-producer-sms`);
    },
    onSuccess: () => {
      toast({
        title: "SMS sent to producer",
        description: "producer verification link sent to your phone",
      });
    },
    onError: (error) => {
      toast({
        title: "producer SMS failed",
        description: "Could not send producer SMS",
        variant: "destructive",
      });
    },
  });

  // Start Taalk verification call mutation
  const startCallMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀🚀🚀 START VERIFICATION BUTTON PRESSED! Session:', sessionId);
      
      // CRITICAL: Block verification call without client approval
      if (!hasClientApproval) {
        throw new Error("Cannot proceed with verification until client hits 'I Agree and Approve'");
      }
      
      // Route to correct endpoint based on verification method
      const verificationMethod = session?.verificationMethod || method;
      let endpoint;
      
      if (verificationMethod === 'zoom') {
        endpoint = '/api/verification/initiate-zoom-call';
      } else if (verificationMethod === 'phone') {
        endpoint = '/api/verification/initiate-conference-call';
      } else {
        // Default to conference call for other methods
        endpoint = '/api/verification/initiate-conference-call';
      }
      
      console.log(`🎯 Routing ${verificationMethod} verification to: ${endpoint}`);

      // EXACT same contract as verification-workflow startVerificationCall (working path).
      // apiRequest already JSON.stringifies — do NOT wrap in { body: JSON.stringify(...) }.
      return await apiRequest('POST', endpoint, {
        sessionId: sessionId,
        clientInfo: {
          firstName: session?.firstName,
          lastName: session?.lastName,
          phone: session?.phone,
          spouseName: session?.spouseName,
          city: session?.city,
          state: session?.state,
          premium: session?.premium,
          achDrawDate: session?.achDrawDate,
          achDrawDateShort: session?.achDrawDateShort,
          zoomRoomId: session?.zoomRoomId,
          zoomPassword: session?.zoomPassword || '1',
        },
        agentPhone:
          session?.agentPhone ||
          session?.producerPhone ||
          undefined,
        zoomRoomId: session?.zoomRoomId,
        zoomPassword: session?.zoomPassword || '1',
        verificationMethod: verificationMethod,
      });
    },
    onSuccess: (data) => {
      console.log('✅ Frontend: Verification API call successful:', data);
      toast({
        title: "Verification call initiated",
        description: `Call started successfully`,
      });
    },
    onError: (error) => {
      console.error('❌ Frontend: Verification API call failed:', error);
      toast({
        title: "Failed to start verification call",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    },
  });

  // Upload screenshot mutation (different endpoints for Zoom vs other methods)
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('screenshot', file);
      
      // Use the same S3 upload endpoint for all methods
      return await apiRequest('POST', `/api/verification/session/${sessionId}/screenshot`, {
        body: formData
      });
    },
    onSuccess: () => {
      const description = method === 'zoom' 
        ? "Screenshot uploaded successfully! Zoom verification initiated with Taalk."
        : "Verification step completed.";
        
      toast({
        title: "Screenshot uploaded successfully!",
        description,
      });
      // CRITICAL: Invalidate ALL session queries to force refetch with updated screenshot data
      queryClient.invalidateQueries({ queryKey: ['/api/verification/session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/verification/session'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['/api/verification/session', sessionId] });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: "Upload failed",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      setUploading(true);
      uploadMutation.mutate(selectedFile);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(producerVerificationUrl);
      toast({
        title: "Link copied!",
        description: "Link copied",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Copy manually",
        variant: "destructive",
      });
    }
  };

  // Client SMS handler
  const clientSmsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/step2-webhook/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to send client SMS');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Client SMS sent",
        description: "Verification link sent to client successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/verification/session', sessionId] });
    },
    onError: () => {
      toast({
        title: "SMS failed",
        description: "Failed to send client SMS",
        variant: "destructive",
      });
    }
  });

  const handleClientSms = () => {
    clientSmsMutation.mutate();
  };

  const handleproducerSms = () => {
    producerSmsMutation.mutate();
  };

  const isClientSmsLoading = clientSmsMutation.isPending;
  const isproducerSmsLoading = producerSmsMutation.isPending;

  // CRITICAL: Check ALL possible screenshot fields - screenshotPath, screenshot_url, screenshot_path
  // The screenshot might be stored in any of these fields depending on upload method
  const hasScreenshot = Boolean(
    session?.screenshotPath || 
    session?.screenshot_url || 
    session?.screenshot_path
  );
  const hasClientApproval = session?.clientApprovalStatus === 'approved';
  
  // Calculate completion count for step 2 (producer screenshot + client approval)
  const completedRequirements = (hasScreenshot ? 1 : 0) + (hasClientApproval ? 1 : 0);

  const methodLabel = method === 'zoom' ? 'Zoom' : method.charAt(0).toUpperCase() + method.slice(1);
  const stepTitle = embedded
    ? `${methodLabel} screenshot & SMS`
    : method === 'zoom'
      ? 'Zoom AI Verification Process'
      : `${methodLabel} Verification Process`;

  return (
    <Card className={embedded ? "border-0 shadow-none bg-transparent precheck-unified-verification" : "bg-white rounded-xl shadow-lg border border-gray-200"}>
      <CardContent className={embedded ? "p-0" : "p-8 md:p-10"}>
        {!embedded ? (
        <div className="mb-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-8 py-4 rounded-2xl shadow-lg mb-4">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold">AO Precheck</h1>
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div className="mb-5">
          <h2 className="text-lg font-extrabold tracking-tight text-[#0f1729]">{stepTitle}</h2>
          <p className="text-sm text-[#56607a] mt-1">
            Upload your screenshot, confirm SMS delivery, then continue to the verification call.
          </p>
        </div>
        )}

        {/* Verification instructions and screenshot upload - Show for ALL methods (Zoom, Phone, WhatsApp, FaceTime) */}
        {method === 'zoom' || method === 'phone' || method === 'whatsapp' || method === 'facetime' ? (
          <div className={embedded ? "space-y-5" : "space-y-6"}>
            <div className={embedded ? "rounded-xl border border-[#e7eaf0] bg-[#fbfcfd] p-4 md:p-5" : "bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6"}>
              {!embedded && (
              <div className="flex items-center justify-center mb-4">
                {method === 'zoom' ? (
                  <Video className="w-6 h-6 text-blue-600 mr-3" />
                ) : (
                  <Phone className="w-6 h-6 text-blue-600 mr-3" />
                )}
                <h3 className="text-xl font-semibold text-gray-900">{stepTitle}</h3>
              </div>
              )}
              
              <div className={embedded ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-4 text-left max-w-2xl mx-auto"}>
                <div className={embedded ? "rounded-[11px] border border-[#e7eaf0] bg-white p-4 border-l-4 border-l-violet-500" : "bg-white rounded-lg p-4 border-l-4 border-blue-500"}>
                  <h4 className={`font-semibold mb-2 ${embedded ? "text-sm text-[#0f1729]" : "text-gray-900"}`}>
                    {currentLanguage === 'es' ? 'Paso 1: Subir Captura de Pantalla' : 'Step 1: Upload Screenshot'}
                  </h4>
                  <p className={embedded ? "text-xs text-[#56607a] leading-relaxed" : "text-gray-700"}>
                    {currentLanguage === 'es' 
                      ? 'Toma una captura de pantalla con tu dispositivo móvil y súbela para iniciar el proceso de verificación.'
                      : 'Take a screenshot using your mobile device and upload it to initiate the verification process.'
                    }
                  </p>
                </div>
                
                <div className={embedded ? "rounded-[11px] border border-[#e7eaf0] bg-white p-4 border-l-4 border-l-emerald-500" : "bg-white rounded-lg p-4 border-l-4 border-green-500"}>
                  <h4 className={`font-semibold mb-2 ${embedded ? "text-sm text-[#0f1729]" : "text-gray-900"}`}>
                    {currentLanguage === 'es' ? 'Paso 2: Verificación por SMS' : 'Step 2: SMS Verification'}
                  </h4>
                  <p className={embedded ? "text-xs text-[#56607a] leading-relaxed" : "text-gray-700"}>
                    {currentLanguage === 'es'
                      ? 'Después de subir la captura de pantalla, recibirás un enlace por SMS para completar la verificación.'
                      : "After screenshot upload, you'll receive an SMS link to complete verification."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Screenshot Upload Section - For Zoom and Phone verification */}
            <div className={embedded ? "rounded-xl border border-[#e7eaf0] bg-white p-4 md:p-5" : "bg-gray-50 rounded-lg p-6"}>
              <div className="flex items-center mb-3">
                <Camera className={`w-5 h-5 mr-2 ${embedded ? "text-violet-600" : "text-gray-600"}`} />
                <h3 className={`font-semibold ${embedded ? "text-sm text-[#0f1729]" : "font-medium text-gray-900"}`}>Upload Screenshot</h3>
              </div>

              {hasScreenshot ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-600 font-medium">Screenshot uploaded successfully!</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {method === 'zoom' ? 'Zoom verification initiated' : `${method.charAt(0).toUpperCase() + method.slice(1)} verification initiated`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center ${embedded ? "border-[#d8dce6] bg-[#fbfcfd] hover:border-violet-400" : "border-gray-300"}`}>
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${embedded ? "text-[#8b94a7]" : "text-gray-400"}`} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="zoom-file-input"
                    />
                    <label 
                      htmlFor="zoom-file-input" 
                      className={`cursor-pointer font-semibold text-sm ${embedded ? "text-[#7c2fce] hover:text-violet-700" : "text-blue-600 hover:text-blue-800 font-medium"}`}
                    >
                      Click to select screenshot
                    </label>
                    <p className={`text-xs mt-1 ${embedded ? "text-[#8b94a7]" : "text-gray-500"}`}>PNG, JPG up to 10MB</p>
                  </div>

                  {selectedFile && (
                    <div className={`flex items-center justify-between rounded-lg p-3 border ${embedded ? "bg-[#fbfcfd] border-[#e7eaf0]" : "bg-white"}`}>
                      <span className={`text-sm truncate mr-2 ${embedded ? "text-[#56607a]" : "text-gray-700"}`}>{selectedFile.name}</span>
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        size="sm"
                        className={embedded ? "bg-gradient-to-r from-violet-600 to-indigo-500 hover:brightness-105 text-white shrink-0" : "bg-blue-600 hover:bg-blue-700 text-white"}
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* SMS Status Section - Always show, regardless of screenshot status */}
              <div className={`mt-5 rounded-xl p-4 ${embedded ? "border border-[#e7eaf0] bg-[#fbfcfd]" : "bg-gray-50 rounded-lg"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`text-xs font-bold uppercase tracking-wide ${embedded ? "text-[#8b94a7]" : "text-gray-600 font-semibold"}`}>SMS Status</div>
                </div>
                
                {/* Client SMS Status */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    {session?.smsVerificationSent ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-[#aeb6c6] shrink-0" />
                    )}
                    <span className={`text-xs truncate ${session?.smsVerificationSent ? 'text-emerald-700' : embedded ? 'text-[#8b94a7]' : 'text-gray-500'}`}>
                      Client SMS {session?.smsVerificationSent ? 'sent' : 'pending'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleClientSms()}
                    className={`text-xs text-white px-2.5 py-1 rounded-[8px] shrink-0 transition-colors ${embedded ? "bg-emerald-600 hover:bg-emerald-700" : "bg-green-600 hover:bg-green-700"}`}
                    disabled={isClientSmsLoading}
                  >
                    {isClientSmsLoading ? 'Sending...' : 'Resend'}
                  </button>
                </div>

                {/* producer SMS Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    {session?.producerSmsSid ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-[#aeb6c6] shrink-0" />
                    )}
                    <span className={`text-xs truncate ${session?.producerSmsSid ? 'text-emerald-700' : embedded ? 'text-[#8b94a7]' : 'text-gray-500'}`}>
                      Producer SMS {session?.producerSmsSid ? 'sent' : 'pending'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleproducerSms()}
                    className={`text-xs text-white px-2.5 py-1 rounded-[8px] shrink-0 transition-colors ${embedded ? "bg-gradient-to-r from-violet-600 to-indigo-500 hover:brightness-105" : "bg-blue-600 hover:bg-blue-700"}`}
                    disabled={isproducerSmsLoading}
                  >
                    {isproducerSmsLoading ? 'Sending...' : 'Resend'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: QR Code & Link for non-Zoom methods */}
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center mb-3">
                  <QrCode className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="font-medium text-gray-900">Client Verification Access</h3>
                </div>

                {clientQrCodeUrl && (
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img src={clientQrCodeUrl} alt="Client Verification QR Code" className="w-48 h-48" />
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-2">Client verification link (for client access):</p>
                  <div className="bg-white border rounded-lg p-3 text-sm font-mono break-all">
                    {clientVerificationUrl.replace('aoirail-production.up.railway.app', '7bca9330-8d56-4d64-a5d4-a459b57b16a3-00-2imcowqw6vcjz.aoirail-production.up.railway.app')}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigator.clipboard.writeText(clientVerificationUrl)}
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Copy Client Link
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => smsMutation.mutate()}
                      disabled={smsMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      title="Sends CLIENT approval link to client phone via SMS"
                    >
                      {smsMutation.isPending ? 'Sending...' : 'SMS Client'}
                    </Button>
                  </div>
                  
                  {/* producer verification section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">producer verification link (for your mobile access):</p>
                    <div className="bg-white border rounded-lg p-3 text-sm font-mono break-all mb-2">
                      {producerVerificationUrl}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigator.clipboard.writeText(producerVerificationUrl)}
                      >
                        <Link className="w-4 h-4 mr-2" />
                        Copy producer Link
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => producerSmsMutation.mutate()}
                        disabled={producerSmsMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        title="Sends producer verification link to your phone via SMS"
                      >
                        {producerSmsMutation.isPending ? 'Sending...' : 'SMS producer'}
                      </Button>
                    </div>
                  </div>
              </div>
            </div>

            {/* Status indicators */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                {hasClientApproval ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
                <span className={`text-sm ${hasClientApproval ? 'text-green-600' : 'text-gray-500'}`}>
                  1. Client disclaimer approved
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {hasScreenshot ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
                <span className={`text-sm ${hasScreenshot ? 'text-green-600' : 'text-gray-500'}`}>
                  2. Screenshot uploaded
                </span>
              </div>

              {/* SMS Status Section */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="text-xs text-gray-600 mb-2 font-semibold">SMS Status:</div>
                
                {/* Client SMS Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {session?.smsVerificationSent ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-xs ${session?.smsVerificationSent ? 'text-green-600' : 'text-gray-500'}`}>
                      Client SMS {session?.smsVerificationSent ? 'sent' : 'pending'}
                    </span>
                    {session?.clientSmsSid && (
                      <span className="text-xs text-gray-400">
                        ({session.clientSmsSid})
                      </span>
                    )}
                  </div>
                  <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded">
                    Auto-sent
                  </span>
                </div>

                {/* producer SMS Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {session?.producerSmsSid ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-xs ${session?.producerSmsSid ? 'text-green-600' : 'text-gray-500'}`}>
                      producer SMS {session?.producerSmsSid ? 'sent' : 'pending'}
                    </span>
                    {session?.producerSmsSid && (
                      <span className="text-xs text-gray-400">
                        ({session.producerSmsSid})
                      </span>
                    )}
                  </div>
                  <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded">
                    Auto-sent
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Screenshot Upload */}
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <Camera className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="font-medium text-gray-900">Upload Screenshot</h3>
              </div>

              {hasScreenshot ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-600 font-medium">Screenshot uploaded successfully!</p>
                  <p className="text-sm text-gray-600 mt-1">SMS sent to client automatically</p>
                  
                  {/* Verification Call Buttons */}
                  <div className="mt-6 space-y-3">
                    <Button 
                      onClick={() => startCallMutation.mutate()}
                      disabled={startCallMutation.isPending || !hasClientApproval}
                      className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {startCallMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Starting Verification...
                        </>
                      ) : (
                        <>
                          🚀 Start Verification
                        </>
                      )}
                    </Button>
                    
                    {callStatus?.taalkCallId && (
                      <Button 
                        onClick={() => startCallMutation.mutate()}
                        disabled={startCallMutation.isPending || !hasClientApproval}
                        variant="outline"
                        className="w-full"
                      >
                        {startCallMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          <>
                            🔄 Retry Verification
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="screenshot-upload"
                    />
                    <label
                      htmlFor="screenshot-upload"
                      className="cursor-pointer text-sm text-gray-600 hover:text-gray-900"
                    >
                      Click to select screenshot
                    </label>
                    {selectedFile && (
                      <p className="text-sm text-blue-600 mt-2">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {selectedFile && (
                    <Button 
                      onClick={handleUpload} 
                      disabled={uploading || uploadMutation.isPending}
                      className="w-full"
                    >
                      {uploading || uploadMutation.isPending ? 'Uploading...' : 'Upload Screenshot'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Navigation */}
        <div className={`flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-6 pt-5 border-t ${embedded ? "border-[#eef1f5]" : "mt-8 pt-6 border-gray-200"}`}>
          <Button
            variant="outline"
            onClick={onBack}
            className={embedded ? "border-[#e7eaf0] text-[#56607a] hover:border-violet-500 hover:text-[#7c2fce] sm:min-w-[120px]" : undefined}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {onSkipStep3 && (
              <Button 
                variant="outline"
                onClick={onSkipStep3}
                className={embedded ? "border-[#e7eaf0] text-[#56607a] hover:border-violet-500 hover:text-[#7c2fce]" : "border-2 border-dashed border-muted-foreground"}
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            
            <Button 
              onClick={onContinue}
              disabled={!hasScreenshot || !hasClientApproval}
              className={
                embedded
                  ? (hasScreenshot && hasClientApproval)
                    ? "bg-gradient-to-r from-violet-600 to-indigo-500 hover:brightness-105 text-white"
                    : "bg-[#eef1f5] text-[#8b94a7] hover:bg-[#eef1f5] cursor-not-allowed"
                  : (hasScreenshot && hasClientApproval) ? 'bg-green-600 hover:bg-green-700' : ''
              }
            >
              {(hasScreenshot && hasClientApproval) ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Proceed to Call Verification
                </>
              ) : (
                <>
                  Proceed to Call ({completedRequirements}/2 complete)
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

