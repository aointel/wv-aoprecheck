import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Loader2, Shield, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslations } from "@/utils/i18n";
import type { VerificationSession } from "@shared/schema";
import { getDeviceGeolocation, type GeolocationData } from "@/lib/geolocation";

export default function ClientVerification() {
  // Handle both /client-verify/:sessionId and /client-verify-es/:sessionId routes
  const [mEn, pEn] = useRoute("/client-verify/:sessionId");
  const [mEs, pEs] = useRoute("/client-verify-es/:sessionId");
  const match = mEn || mEs;
  const params = mEn ? pEn : pEs;
  const { toast } = useToast();

  const sessionId = params?.sessionId;
  
  // Geolocation state - REQUIRED
  const [geolocation, setGeolocation] = useState<GeolocationData | null>(null);
  const [geolocationLoading, setGeolocationLoading] = useState(true);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [geolocationDenied, setGeolocationDenied] = useState(false);
  
  // Create URLSearchParams for language detection
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);

  // Force geolocation collection on mount (when client opens SMS link)
  // This MUST run immediately when the page loads, not waiting for anything
  useEffect(() => {
    if (!sessionId) {
      console.warn('⚠️ No sessionId available for geolocation collection');
      return;
    }
    
    let mounted = true;
    console.log('📍 Starting geolocation collection for session:', sessionId);
    
    // Request geolocation IMMEDIATELY - use a tiny delay to ensure page is interactive
    // Some browsers need the page to be fully loaded before showing permission prompt
    const timeoutId = setTimeout(() => {
      async function collectGeolocation() {
        console.log('📍 Requesting geolocation permission...');
        setGeolocationLoading(true);
        setGeolocationError(null);
        
        // Check if geolocation is supported
        if (!navigator.geolocation) {
          const error = 'Geolocation is not supported by this browser';
          console.error('❌', error);
          if (mounted) {
            setGeolocationError(error);
            setGeolocationLoading(false);
          }
          return;
        }
      
      try {
        const location = await getDeviceGeolocation({
          timeout: 15000, // 15 seconds
          enableHighAccuracy: true,
          retries: 3,
        });
        
        if (mounted) {
          setGeolocation(location);
          setGeolocationLoading(false);
          console.log('✅ Client geolocation collected:', location);
          
          // Immediately send geolocation to backend with IP capture
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
            
            await fetch(`/api/verification/session/${sessionId}/capture-client-ip`, {
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
            console.log('✅ Client geolocation sent to backend');
          } catch (error) {
            console.error('Failed to send client geolocation:', error);
          }
        }
      } catch (error: any) {
        if (mounted) {
          const isDenied = error.message?.includes('permission denied') || error.message?.includes('denied');
          setGeolocationDenied(isDenied);
          setGeolocationError(error.message || 'Failed to get location');
          setGeolocationLoading(false);
          console.error('❌ Failed to collect client geolocation:', error);
          
          if (isDenied) {
            console.warn('🚩 CLIENT GEOLOCATION DENIED - This will be flagged');
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
              
              await fetch(`/api/verification/session/${sessionId}/capture-client-ip`, {
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
          } else {
            toast({
              title: "Location Required",
              description: error.message || "Please enable location access to continue",
              variant: "destructive",
            });
          }
        }
      }
      } // Close collectGeolocation function
      
      collectGeolocation();
    }, 100); // Small delay to ensure page is interactive (browsers need page to be ready)
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [sessionId, toast]);

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      // Note: IP capture is now handled in the geolocation useEffect below
      // This ensures geolocation is collected first, then IP is captured with geolocation data
      
      const response = await apiRequest("GET", `/api/verification/session/${sessionId}`);
      return response.json() as Promise<VerificationSession>;
    },
    enabled: !!sessionId,
  });

  // Use translations hook with language detection
  const { t, language, isSpanish } = useTranslations(session?.language, urlParams);

  // Disclaimer approval mutation
  const disclaimerMutation = useMutation({
    mutationFn: async () => {
      // Ensure geolocation is available before proceeding
      if (!geolocation) {
        throw new Error('Location is required. Please enable location access and try again.');
      }
      
      // Get public IP
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
      
      const response = await fetch(`/api/verification/session/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: geolocation.latitude,
          longitude: geolocation.longitude,
          accuracy: geolocation.accuracy,
          publicIp: publicIp,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          geolocationDenied: false, // Successfully got location
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Approval failed' }));
        throw new Error(errorData.message || 'Approval failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('client.disclaimerApprovedTitle'),
        description: t('client.disclaimerApprovedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('client.approvalFailed'),
        description: error.message || t('client.approvalFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const handleDisclaimerApproval = () => {
    disclaimerMutation.mutate();
  };

  if (!sessionId || !match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('common.invalidLink')}</h1>
            <p className="text-gray-600">{t('common.invalidLinkDesc')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || geolocationLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {geolocationLoading ? 'Requesting location access...' : t('common.loading')}
          </p>
          {geolocationLoading && (
            <p className="text-sm text-gray-500 mt-2">
              Please allow location access when prompted
            </p>
          )}
        </div>
      </div>
    );
  }
  
  // Allow proceeding even if geolocation failed, but flag it
  // This allows the session to continue but marks it as suspicious
  const handleProceedWithoutLocation = async () => {
    // Get public IP
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
    
    // Send approval with geolocation denied flag
    try {
      const response = await fetch(`/api/verification/session/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: null,
          longitude: null,
          accuracy: null,
          publicIp: publicIp,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          geolocationDenied: true, // FLAG: Geolocation was denied
          geolocationError: geolocationError || 'Location access denied',
        }),
      });
      
      if (response.ok) {
        window.location.reload();
      } else {
        throw new Error('Failed to proceed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to proceed. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Show warning but allow proceeding if geolocation failed
  if (geolocationError || !geolocation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Location Access Required</h1>
            <p className="text-gray-600 mb-4">
              {geolocationError || 'We need your location to proceed with verification. Please enable location access in your browser settings.'}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Proceeding without location will be flagged for review.
              </p>
            </div>
            <div className="space-y-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Retry Location Access
              </Button>
              <Button
                onClick={handleProceedWithoutLocation}
                variant="outline"
                className="w-full"
              >
                Proceed Without Location (Will be flagged)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('common.sessionNotFound')}</h1>
            <p className="text-gray-600">{t('common.sessionNotFoundDesc')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AO</span>
                </div>
                <span className="font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent', 
                  backgroundClip: 'text'
                }}>
                  AO Precheck
                </span>
              </div>
              <div className="hidden md:block h-6 w-px bg-gray-300"></div>
              <span className="hidden md:block text-sm text-gray-600">{t('client.pageTitle')}</span>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-600">
              {isSpanish ? 'Acceso de Cliente' : 'Client Access'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardContent className="p-6 md:p-8">
            <div className="text-center mb-6">
              <Shield className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                AO - Precheck
              </h1>
              <p className="text-gray-600">
                {t('client.hello')} {session.firstName}, {t('client.approvalNeeded')}
              </p>
            </div>

            {/* Simple Approval Section */}
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="text-center">
                  <h4 className="font-medium text-gray-900 mb-4">{t('client.instruction')}</h4>
                  <p className="text-sm text-gray-700">
                    {t('client.action')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {session.clientApprovalStatus === 'approved' ? (
                  <div className="text-center bg-green-50 rounded-lg p-6 border border-green-200">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                    <h4 className="font-medium text-green-700 mb-2">{t('client.disclaimerApproved')}</h4>
                    <p className="text-sm text-green-600">
                      {t('client.approvedThankYou')}
                    </p>
                    {session.clientApprovalTime && (
                      <p className="text-xs text-gray-500 mt-2">
                        {t('client.approvedOn')} {new Date(session.clientApprovalTime).toLocaleString()}
                      </p>
                    )}
                    {session.clientIpAddress && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <p className="text-xs text-gray-500">
                          {isSpanish ? 'Verificación completada desde:' : 'Verification completed from:'} {session.clientCountry}, {session.clientRegion}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {geolocation && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <MapPin className="w-4 h-4 text-green-600 inline mr-2" />
                        <span className="text-sm text-green-700">
                          Location verified: {geolocation.latitude.toFixed(4)}, {geolocation.longitude.toFixed(4)}
                        </span>
                      </div>
                    )}
                    <div className="text-center">
                      <Button
                        onClick={handleDisclaimerApproval}
                        disabled={disclaimerMutation.isPending || !geolocation}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium disabled:opacity-50"
                      >
                        {disclaimerMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            {t('common.processing')}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5 mr-2" />
                            {t('client.button')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}