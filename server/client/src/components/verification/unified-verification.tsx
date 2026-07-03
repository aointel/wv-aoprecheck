import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Video, Smartphone, ArrowLeft, CheckCircle, Clock, Camera, Upload, ArrowRight, QrCode, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import QRCode from "qrcode";
import { QRCodeDisplay } from "./qr-code-display";
import { TaalkCallInterface } from "./taalk-call-interface";
import { LiveCallInterface } from "./live-call-interface";
import { HumanCallInterface } from "./human-call-interface";
import { SimplifiedVerification } from "./simplified-verification";

type VerificationMethod = "phone" | "whatsapp" | "zoom" | "facetime";

interface UnifiedVerificationProps {
  sessionId: string;
  method: VerificationMethod;
  clientName: string;
  onBack: () => void;
  onContinue: () => void;
}

export function UnifiedVerification({ sessionId, method, clientName, onBack, onContinue }: UnifiedVerificationProps) {
  const [agentQrCodeUrl, setAgentQrCodeUrl] = useState<string>("");
  const [clientQrCodeUrl, setClientQrCodeUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate AGENT verification URL for QR code (for agent mobile access)
  const agentVerificationUrl = `https://${window.location.host}/agent-verify/${sessionId}`;
  
  // Generate CLIENT verification URL for QR code (for client mobile access)
  const clientVerificationUrl = `https://${window.location.host}/client-verify/${sessionId}`;

  useEffect(() => {
    const initializeStep2 = async () => {
      try {
        // Generate both Agent and Client QR codes
        const agentQrUrl = await QRCode.toDataURL(agentVerificationUrl, { width: 256 });
        const clientQrUrl = await QRCode.toDataURL(clientVerificationUrl, { width: 256 });
        setAgentQrCodeUrl(agentQrUrl);
        setClientQrCodeUrl(clientQrUrl);

        // Send Step 2 webhook ONCE when component first mounts
        console.log('Triggering Step 2 webhook for session:', sessionId);
        await apiRequest('POST', `/api/step2-webhook/${sessionId}`);
        console.log('Step 2 webhook sent successfully');

      } catch (error) {
        console.error('Error initializing Step 2:', error);
      }
    };

    initializeStep2();
  }, [agentVerificationUrl, clientVerificationUrl, sessionId]); // Only runs once when component mounts

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

  // Send SMS to client mutation
  const smsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/verification/session/${sessionId}/send-sms`);
    },
    onSuccess: () => {
      toast({
        title: "SMS attempt completed",
        description: "If SMS is blocked by carriers, copy the link to share manually via WhatsApp, email, or phone.",
      });
    },
    onError: (error) => {
      toast({
        title: "SMS delivery blocked",
        description: "Carrier blocked the message. Use the copy link button to share manually.",
        variant: "destructive",
      });
    },
  });

  // Upload screenshot mutation (different endpoints for Zoom vs other methods)
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('screenshot', file);
      
      if (method === 'zoom') {
        // For Zoom: use dedicated endpoint that triggers Taalk webhook
        formData.append('sessionId', sessionId);
        return await apiRequest('POST', '/api/zoom-verification/upload-screenshot', {
          body: formData
        });
      } else {
        // For other methods: use regular verification endpoint
        return await apiRequest('POST', `/api/verification/session/${sessionId}/screenshot`, {
          body: formData
        });
      }
    },
    onSuccess: () => {
      const description = method === 'zoom' 
        ? "Screenshot uploaded successfully! Zoom verification initiated with Taalk."
        : "Verification step completed.";
        
      toast({
        title: "Screenshot uploaded successfully!",
        description,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/verification/session', sessionId] });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: "Please try uploading the screenshot again.",
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
      await navigator.clipboard.writeText(agentVerificationUrl);
      toast({
        title: "Link copied!",
        description: "Verification link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const hasScreenshot = session?.screenshotPath;
  const hasClientApproval = session?.clientApprovalStatus === 'approved';

  // Render verification interface based on method
  const renderVerificationInterface = () => {
    switch (method) {
      case 'phone':
        return (
          <SimplifiedVerification
            session={session}
            onComplete={() => {
              console.log('Verification completed, continuing to next step');
              onContinue();
            }}
          />
        );
      case 'zoom':
      case 'whatsapp':
      case 'facetime':
        return null; // Render inline below instead of separate component
      default:
        return <div>Unsupported verification method</div>;
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-lg border border-gray-200">
      <CardContent className="p-8 md:p-10">
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

        {/* Zoom-specific instructions and screenshot upload */}
        {method === 'zoom' ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">Zoom AI Verification Process</h3>
              </div>
              
              <div className="space-y-4 text-left max-w-2xl mx-auto">
                <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Step 1: Upload Screenshot</h4>
                  <p className="text-gray-700">Take a screenshot using your mobile device and upload it to initiate the verification process.</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Step 2: AO Intelligence Joins Automatically</h4>
                  <p className="text-gray-700">After screenshot upload, AO Intelligence will automatically join your Zoom meeting.</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Step 3: Start verification call</h4>
                  <p className="text-gray-700">The verification assistant will automatically begin the call process once connected.</p>
                </div>
              </div>
            </div>

            {/* Screenshot Upload Section for Zoom */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <Camera className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="font-medium text-gray-900">Upload Screenshot</h3>
              </div>

              {hasScreenshot ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-600 font-medium">Screenshot uploaded successfully!</p>
                  <p className="text-sm text-gray-600 mt-1">Zoom verification initiated</p>
                  <div className="mt-6">
                    <Button 
                      onClick={onContinue}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 text-lg"
                    >
                      Continue to Verification
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
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
                      ref={(input) => {
                        if (input) {
                          input.onchange = handleFileSelect;
                        }
                      }}
                      className="hidden"
                      id="zoom-file-input"
                    />
                    <label 
                      htmlFor="zoom-file-input" 
                      className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Click to select screenshot
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <span className="text-sm text-gray-700">{selectedFile.name}</span>
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
                    {clientVerificationUrl}
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
              </div>
            </div>

            {/* Status indicators */}
            <div className="space-y-2">
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

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2 text-sm">Verification workflow:</h4>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Share verification link with {clientName} (SMS, WhatsApp, email, or verbally)</li>
                <li>Client opens link and approves disclaimer first</li>
                <li>Start your {method} call with client</li>
                <li>Take screenshot showing both participants</li>
                <li>Upload screenshot using this mobile interface</li>
              </ol>
            </div>

            {/* SMS Alternative Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> If SMS doesn't work due to carrier blocking, copy the link and share it via WhatsApp, email, or read it to {clientName} over the phone.
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button 
            onClick={onContinue}
            disabled={!hasScreenshot || !hasClientApproval}
            className={(hasScreenshot && hasClientApproval) ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {(hasScreenshot && hasClientApproval) ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Proceed to Call Verification
              </>
            ) : (
              <>
                Proceed to Call ({hasClientApproval ? '1' : '0'}/2 complete)
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}