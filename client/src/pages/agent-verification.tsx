import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, Camera, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslations } from "@/utils/i18n";
import type { VerificationSession } from "@shared/schema";
import { getDeviceGeolocation, type GeolocationData } from "@/lib/geolocation";

export default function producerVerification() {
  // Handle both /agent-verify/:sessionId and /agent-verify-es/:sessionId routes
  const [mEn, pEn] = useRoute("/agent-verify/:sessionId");
  const [mEs, pEs] = useRoute("/agent-verify-es/:sessionId");
  const match = mEn || mEs;
  const params = mEn ? pEn : pEs;
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const sessionId = params?.sessionId;
  
  // Geolocation state - REQUIRED for agents
  const [agentGeolocation, setAgentGeolocation] = useState<GeolocationData | null>(null);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [geolocationDenied, setGeolocationDenied] = useState(false);
  
  // Create URLSearchParams for language detection
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  
  // Force geolocation collection on mount (when agent opens SMS link)
  useEffect(() => {
    let mounted = true;
    
    async function collectGeolocation() {
      setGeolocationLoading(true);
      setGeolocationError(null);
      
      try {
        const location = await getDeviceGeolocation({
          timeout: 15000, // 15 seconds
          enableHighAccuracy: true,
          retries: 3,
        });
        
        if (mounted) {
          setAgentGeolocation(location);
          setGeolocationLoading(false);
          console.log('✅ Agent geolocation collected:', location);
          
          // Immediately send geolocation to backend
          try {
            let publicIp = null;
            try {
              const ipResponse = await fetch('https://api.ipify.org?format=json', {
                signal: AbortSignal.timeout(5000)
              });
              if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                publicIp = ipData.ip;
              }
            } catch (ipError) {
              console.warn('Could not detect public IP:', ipError);
            }
            
            await fetch(`/api/verification/session/${sessionId}/capture-agent-ip`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                publicIp,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                geolocationDenied: false,
              })
            });
            console.log('✅ Agent geolocation sent to backend');
          } catch (error) {
            console.error('Failed to send agent geolocation:', error);
          }
        }
      } catch (error: any) {
        if (mounted) {
          const isDenied = error.message?.includes('permission denied') || error.message?.includes('denied');
          setGeolocationDenied(isDenied);
          setGeolocationError(error.message || 'Failed to get location');
          setGeolocationLoading(false);
          console.error('❌ Failed to collect agent geolocation:', error);
          
          if (isDenied) {
            console.warn('🚩 AGENT GEOLOCATION DENIED - This will be flagged');
            // Still send IP capture with denial flag
            try {
              let publicIp = null;
              try {
                const ipResponse = await fetch('https://api.ipify.org?format=json', {
                  signal: AbortSignal.timeout(5000)
                });
                if (ipResponse.ok) {
                  const ipData = await ipResponse.json();
                  publicIp = ipData.ip;
                }
              } catch (ipError) {
                console.warn('Could not detect public IP:', ipError);
              }
              
              await fetch(`/api/verification/session/${sessionId}/capture-agent-ip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  publicIp,
                  latitude: null,
                  longitude: null,
                  accuracy: null,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  geolocationDenied: true,
                  geolocationError: error.message,
                })
              });
            } catch (sendError) {
              console.error('Failed to send geolocation denial:', sendError);
            }
          }
        }
      }
    }
    
    if (sessionId) {
      collectGeolocation();
    }
    
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      // First, try to get the agent's public IP for accurate tracking
      let publicIp = null;
      try {
        // Use ipify to get the real public IP (bypasses proxy issues)
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          publicIp = ipData.ip;
          console.log('Detected agent public IP:', publicIp);
        }
      } catch (ipError) {
        console.warn('Could not detect agent public IP:', ipError);
      }

      // Note: IP capture is now handled in the geolocation useEffect above
      // This ensures geolocation is collected first, then IP is captured with geolocation data

      const response = await apiRequest("GET", `/api/verification/session/${sessionId}`);
      return response.json() as Promise<VerificationSession>;
    },
    enabled: !!sessionId,
  });

  // Use translations hook with language detection
  const { t, language, isSpanish } = useTranslations(session?.language || undefined, urlParams);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('screenshot', file);
      formData.append('sessionId', sessionId!);
      
      const response = await fetch(`/api/verification/session/${sessionId}/screenshot`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (response: any) => {
      toast({
        title: t('producer.uploadSuccess'),
        description: t('producer.uploadSuccessDesc'),
      });
      setUploadedFile(null); // Reset for next upload
      // Invalidate session query to refetch with new screenshot
      queryClient.invalidateQueries({ queryKey: ['/api/verification/session', sessionId] });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({
        title: t('producer.uploadFailed'),
        description: t('producer.uploadFailedDesc'),
        variant: "destructive",
      });
      setUploadedFile(null); // Reset on error
    },
  });

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      // Auto-upload immediately when file is selected
      uploadMutation.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('producer.loadingSession')}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('producer.sessionNotFoundTitle')}</h1>
            <p className="text-gray-600">{t('producer.sessionNotFoundDesc')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <Camera className="w-12 h-12 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {session.verificationMethod === 'phone' 
                  ? 'Upload Phone Call Screenshot' 
                  : session.verificationMethod === 'whatsapp'
                  ? 'Upload WhatsApp Call Screenshot'
                  : session.verificationMethod === 'facetime'
                  ? 'Upload FaceTime Call Screenshot'
                  : t('producer.uploadTitle')}
              </h1>
              <p className="text-lg text-gray-600 mb-2">
                {session.verificationMethod === 'phone'
                  ? 'Take a screenshot of your phone call screen showing the active call with the client and upload it here'
                  : session.verificationMethod === 'whatsapp'
                  ? 'Take a screenshot of your WhatsApp video call showing both you and the client and upload it here'
                  : session.verificationMethod === 'facetime'
                  ? 'Take a screenshot of your FaceTime call showing both you and the client and upload it here'
                  : t('producer.uploadSubtitle')}
              </p>
              <div className="bg-gray-100 rounded-lg p-3 mt-4">
                <p className="text-sm text-gray-700">
                  <strong>{t('producer.clientLabel')}</strong> {session.firstName} {session.lastName} | 
                  <strong> {t('producer.methodLabel')}</strong> {(session.verificationMethod || 'zoom').toUpperCase()}
                </p>
              </div>
            </div>

            {/* File Upload Area - Mobile Optimized for Camera + Gallery */}
            <div className="mb-6">
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 hover:border-blue-500 transition-colors bg-blue-50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="camera-input"
                  data-testid="input-screenshot"
                />
                <label htmlFor="camera-input" className="cursor-pointer block">
                  <div className="text-center">
                    {uploadedFile ? (
                      <div className="flex items-center justify-center space-x-2 text-green-600">
                        <CheckCircle className="w-8 h-8" />
                        <div>
                          <p className="font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-gray-500">{t('producer.fileSelected')}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Camera className="w-20 h-20 text-blue-600 mx-auto mb-4" />
                        <p className="text-2xl font-bold text-gray-900 mb-3">
                          📸 {t('producer.tapToUpload')}
                        </p>
                        <p className="text-base text-gray-600 mb-4">
                          Take a photo with your camera or choose from gallery
                        </p>
                        <div className="bg-white border-2 border-blue-400 rounded-lg p-4 mt-4 shadow-sm">
                          <p className="text-sm text-blue-900 font-semibold mb-1">
                            ✓ Camera & Gallery Supported
                          </p>
                          <p className="text-xs text-gray-600">
                            Tap anywhere to choose
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Upload Status */}
            {uploadMutation.isPending && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">{t('producer.uploading')}</p>
              </div>
            )}

            {/* Success Message */}
            {uploadMutation.isSuccess && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <p className="font-medium">{t('producer.uploadSuccess')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
