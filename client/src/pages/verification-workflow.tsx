import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play } from "lucide-react";
import { ClientForm } from "@/components/verification/client-form";
import { UnifiedVerification } from "@/components/verification/unified-verification";
import { ConferenceCallStep } from "@/components/verification/conference-call-step";
import { Completion } from "@/components/verification/completion";
import { VerificationProgress } from "@/components/verification/verification-progress";
import { ZoomVerificationStep } from "@/components/verification/zoom-verification-step";
import { EnterpriseCertificate } from "@/components/verification/enterprise-certificate";
import { producerProfile } from "@/components/agent/agent-profile";
import { TrackSelection } from "@/components/verification/track-selection";
import { MethodSelection } from "@/components/verification/method-selection";
import { RegionTrackSelection, type RegionTrack } from "@/components/verification/region-track-selection";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { VerificationSession, ClientInfo } from "@shared/schema";
import { Video, Clock, Phone, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { useDemo } from "@/contexts/DemoContext";
import { isAoPrecheckStandalone } from "@/lib/aoprecheck-standalone";


type VerificationStep = 0 | 1 | 2 | 3 | 4 | 5;
type VerificationMethod = 'zoom' | 'phone' | 'whatsapp' | 'facetime';
type VerificationTrack = 'zoom' | 'conference' | 'aoi-meet';
type SessionType = 'demo' | 'live';

interface VerificationWorkflowProps {
  onComplete?: () => void;
  standalone?: boolean;
}

export default function VerificationWorkflow({ onComplete, standalone: standaloneProp }: VerificationWorkflowProps = {}) {
  // Check for pre-filled client data from URL params (from AO Meet appointments)
  const urlParams = new URLSearchParams(window.location.search);
  const clientDataParam = urlParams.get('client');
  const skipToStep = urlParams.get('skipTo');
  
  // Start at step 0 (region track selection) by default
  const [currentStep, setCurrentStep] = useState<VerificationStep>(skipToStep ? parseInt(skipToStep) as VerificationStep : 0);
  const [selectedRegionTrack, setSelectedRegionTrack] = useState<RegionTrack | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<VerificationTrack | null>(skipToStep ? 'zoom' : null);
  const { isDemoMode, demoProduct } = useDemo();
  const isPrecheckDemo = isDemoMode && demoProduct === 'precheck';
  const standaloneUi = standaloneProp ?? isAoPrecheckStandalone();
  const [sessionType, setSessionType] = useState<SessionType>(isPrecheckDemo ? 'demo' : 'live'); // Set to demo if in precheck demo mode
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [uploadedScreenshot, setUploadedScreenshot] = useState<File | null>(null);
  const [showproducerProfile, setShowproducerProfile] = useState(false);
  const [callStatus, setCallStatus] = useState<'pending' | 'active' | 'completed' | 'failed'>('pending');
  const [callProgress, setCallProgress] = useState<string>('Initializing call...');
  // Timer removed - agent manually completes call
  const [prefilledClientData, setPrefilledClientData] = useState<any>(null);
  const { toast } = useToast();
  
  // Parse pre-filled client data on mount
  useEffect(() => {
    if (clientDataParam) {
      try {
        const clientData = JSON.parse(decodeURIComponent(clientDataParam));
        setPrefilledClientData(clientData);
        console.log('📋 Pre-filled client data from appointment:', clientData);
        
        // Don't auto-create session yet - let the form handle it with pre-filled data
      } catch (error) {
        console.error('Failed to parse client data:', error);
      }
    }
  }, [clientDataParam, skipToStep]);

  const totalSteps = 5;
  // Progress calculation: step 0 = 0%, step 1 = 20%, step 2 = 40%, step 3 = 60%, step 4 = 80%, step 5 = 100%
  // Step 0 = Region selection, Step 1 = Method selection, Step 2 = Client Info, Step 3 = SMS, Step 4 = Call, Step 5 = Certificate
  const progress = currentStep === 0 ? 0 : (currentStep / totalSteps) * 100;

  const workflowStepNav = [
    { step: 1 as VerificationStep, label: "Method", fullLabel: "Step 1: Method" },
    { step: 2 as VerificationStep, label: "Client Info", fullLabel: "Step 2: Client Info" },
    { step: 3 as VerificationStep, label: "SMS Info", fullLabel: "Step 3: SMS Info" },
    { step: 4 as VerificationStep, label: "Start Call", fullLabel: "Step 4: Start Call" },
    { step: 5 as VerificationStep, label: "Certificate", fullLabel: "Step 5: Certificate" },
  ];

  const goToStep = (step: VerificationStep) => {
    if (!verificationSession && step > 1) {
      toast({
        title: "No Active Session",
        description: "Please start a verification session first.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(step);
  };

  const goToCertificateStep = () => {
    if (verificationSession) {
      const isCallCompleted =
        verificationSession.taalkCallStatus === "completed" ||
        verificationSession.status === "completed" ||
        (verificationSession.taalkCallDuration && verificationSession.taalkCallDuration > 0);
      if (!isCallCompleted) {
        toast({
          title: "Call Required",
          description: "Please complete the verification call before viewing the certificate.",
          variant: "destructive",
        });
        return;
      }
    }
    goToStep(5);
  };

  const isStepNavDisabled = (step: VerificationStep) => {
    if (currentStep === step) return true;
    if (step === 4 || step === 5) return !verificationSession;
    return false;
  };

  const handleStepNavClick = (step: VerificationStep) => {
    if (step === 5) {
      goToCertificateStep();
      return;
    }
    goToStep(step);
  };

  const handleMethodSelect = (method: VerificationMethod) => {
    setSelectedMethod(method);
    // Map method to track: zoom -> 'zoom', phone/whatsapp/facetime -> 'conference'
    if (method === 'zoom') {
      setSelectedTrack('zoom');
    } else {
      setSelectedTrack('conference');
    }
  };

  const handleRegionTrackSelect = (region: RegionTrack) => {
    setSelectedRegionTrack(region);
    setCurrentStep(1); // Move to track/method selection
  };

  const handleMethodContinue = () => {
    if (selectedMethod) {
      setCurrentStep(2); // Move to client form
    }
  };

  const handleTrackSelect = (track: VerificationTrack, method?: string, selectedSessionType?: SessionType) => {
    // Don't allow selection of coming soon tracks
    if (track === 'aoi-meet') {
      return;
    }
    setSelectedTrack(track);
    if (selectedSessionType) {
      setSessionType(selectedSessionType);
    }
    setCurrentStep(1);
  };

  const handleClientInfoSubmit = async (session: VerificationSession) => {
    setVerificationSession(session);
    setCurrentStep(3); // Move to verification step (step 2 is the form, step 3 is verification)
    
    // Let unified-verification component handle SMS sending to avoid duplicates
    toast({
      title: "Session created",
      description: "Proceeding to verification step...",
    });
  };


  const handleScreenshotUpload = async (file: File) => {
    if (!verificationSession) return;
    
    setUploadedScreenshot(file);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('screenshot', file);
      
      // Upload screenshot to server
      const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/screenshot`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        // Update session with the new data from server
        setVerificationSession(result.session);
        toast({
          title: "Screenshot uploaded successfully!",
          description: "Your screenshot has been saved and SMS sent to client.",
        });
      } else {
        throw new Error('Failed to upload screenshot');
      }
    } catch (error) {
      console.error('Screenshot upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload screenshot. Please try again.",
        variant: "destructive"
      });
    }
  };

  const refreshSession = async () => {
    if (!verificationSession) return;
    
    try {
      const response = await fetch(`/api/verification/session/${verificationSession.sessionId}`);
      if (response.ok) {
        const updatedSession = await response.json();
        setVerificationSession(updatedSession);
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  const handleVerificationComplete = () => {
    toast({
      title: "Verification completed",
      description: "The policy verification has been successfully completed.",
    });
  };

  const startNewVerification = () => {
    if (standaloneUi) {
      onComplete?.();
      return;
    }
    setCurrentStep(1);
    setVerificationSession(null);
    setUploadedScreenshot(null);
    setCallStatus('pending');
    setCallProgress('Initializing call...');
    toast({
      title: "Ready for new verification",
      description: "Starting a new verification session.",
    });
  };

  // Poll verification session for call status when on Step 3 (only to detect if call is active, not for auto-completion)
  useEffect(() => {
    if (currentStep === 3 && verificationSession?.verificationMethod === 'zoom' && callStatus !== 'completed' && callStatus !== 'failed') {
      const pollInterval = setInterval(async () => {
        try {
          // Poll verification session call status endpoint
          const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/call-status`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            
            // Only update status if call failed (agent manually completes successful calls)
            if (data.status === 'failed') {
              setCallStatus('failed');
              setCallProgress('Verification call failed. Please try again.');
              clearInterval(pollInterval);
            } else if (data.isCallActive && callStatus === 'pending') {
              // Update to active when call starts
              setCallStatus('active');
              setCallProgress(data.progress || 'Verification in progress...');
            }
          }
        } catch (error) {
          // Silent fail - polling is non-critical
          console.error('Failed to poll call status:', error);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(pollInterval);
    }
  }, [currentStep, verificationSession, callStatus]);

  // Timer removed - agent will manually complete the call

  // Production verification call handler - uses existing session
  const startVerificationCall = async () => {
    if (!verificationSession) {
      toast({
        title: "No Session",
        description: "Cannot start verification without an active session.",
        variant: "destructive"
      });
      return;
    }

    // Prevent duplicate calls for same session
    if (verificationSession.taalkCallId) {
      toast({
        title: "Call Already Started",
        description: "A verification call has already been initiated for this session.",
        variant: "destructive"
      });
      return;
    }

    setCallStatus('pending');
    setCallProgress('Initiating verification call...');

    try {
      // Use existing verification session - no need to create a new one
      console.log('Initiating verification call for existing session:', verificationSession.sessionId);
      
      // Route to correct endpoint based on TRACK (not method)
      // ZOOM track uses zoom-call endpoint, CONFERENCE track uses conference-call endpoint
      let endpoint;
      
      if (selectedTrack === 'zoom') {
        endpoint = '/api/verification/initiate-zoom-call';
      } else {
        // Conference track (phone/whatsapp/facetime) uses conference-call endpoint
        endpoint = '/api/verification/initiate-conference-call';
      }
      
      console.log(`🎯 Routing ${selectedTrack} track verification to: ${endpoint}`);
      
      // Payload structure for both zoom and conference calls
      const callPayload = {
        sessionId: verificationSession.sessionId,
        clientInfo: {
          firstName: verificationSession.firstName,
          lastName: verificationSession.lastName,
          phone: verificationSession.phone,
          spouseName: verificationSession.spouseName,
          city: verificationSession.city,
          state: verificationSession.state,
          premium: verificationSession.premium,
          achDrawDate: verificationSession.achDrawDate,
          achDrawDateShort: verificationSession.achDrawDateShort
        },
        agentPhone: verificationSession.producerPhone || verificationSession.agentPhone
      };

      const callResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callPayload)
      });

      const result = await callResponse.json();
      
      if (callResponse.ok && result.success) {
        setCallStatus('active');
        setCallProgress('Verification call in progress...');
        
        // Update session with call details
        if (result.callId || result.taalkCallId) {
          setVerificationSession(prev => prev ? { 
            ...prev, 
            taalkCallId: result.taalkCallId || result.callId 
          } : null);
        }
        
        toast({
          title: "Verification Call Started",
          description: `Call initiated successfully. Call ID: ${result.callId}`,
        });
      } else {
        throw new Error(result.message || 'Failed to start verification call');
      }
    } catch (error) {
      setCallStatus('failed');
      setCallProgress('Failed to initialize verification call');
      
      toast({
        title: "Call Failed",
        description: `Unable to start verification call: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className={standaloneUi ? 'precheck-workflow-inner' : `${isPrecheckDemo ? 'min-h-0' : 'min-h-screen'} bg-gray-50`}>
      {/* Main Content */}
      <main className={standaloneUi ? 'max-w-none mx-0 px-0' : `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${isPrecheckDemo ? 'py-4' : 'py-8'}`}>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className={`flex items-center justify-between text-sm font-medium mb-2 ${standaloneUi ? 'text-[#56607a]' : 'text-gray-600'}`}>
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className={`w-full rounded-full h-2 ${standaloneUi ? 'bg-[#eef1f5]' : 'bg-gray-200'}`}>
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${standaloneUi ? 'bg-gradient-to-r from-violet-600 to-indigo-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>



        {/* Step navigation */}
        {standaloneUi ? (
          <div className="mb-6 space-y-3 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {workflowStepNav.map(({ step, label }) => {
                const active = currentStep === step;
                const disabled = active || ((step === 4 || step === 5) && !verificationSession);
                return (
                  <button
                    key={step}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleStepNavClick(step)}
                    className={`min-w-0 rounded-[11px] border px-2 py-2.5 text-center text-xs font-semibold leading-tight transition-colors sm:text-[13px] ${
                      active
                        ? "border-violet-500 bg-[#f4eafe] text-[#7c2fce]"
                        : disabled
                          ? "border-[#eef1f5] bg-[#fbfcfd] text-[#aeb6c6] cursor-not-allowed"
                          : "border-[#e7eaf0] bg-white text-[#56607a] hover:border-violet-400 hover:text-[#7c2fce]"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#8b94a7] sm:text-[11px]">
                      Step {step}
                    </span>
                    <span className="mt-0.5 block truncate">{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#eef1f5] pt-3">
              <Button
                variant="outline"
                onClick={() => goToStep(Math.max(0, currentStep - 1) as VerificationStep)}
                disabled={currentStep <= (selectedRegionTrack ? 1 : 0)}
                size="sm"
                className="flex-1 sm:flex-none min-w-0 border-[#e7eaf0] text-[#56607a] hover:border-violet-500 hover:text-[#7c2fce]"
              >
                ← Previous
              </Button>
              <span className="hidden sm:inline text-xs font-medium text-[#8b94a7] whitespace-nowrap px-2">
                Step {currentStep} of {totalSteps}
              </span>
              <Button
                variant="outline"
                onClick={() => goToStep(Math.min(5, currentStep + 1) as VerificationStep)}
                disabled={currentStep >= 5}
                size="sm"
                className="flex-1 sm:flex-none min-w-0 border-[#e7eaf0] text-[#56607a] hover:border-violet-500 hover:text-[#7c2fce]"
              >
                Next →
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap justify-center gap-2">
              {workflowStepNav.map(({ step, fullLabel }) => (
                <Button
                  key={step}
                  variant="outline"
                  onClick={() => handleStepNavClick(step)}
                  disabled={isStepNavDisabled(step)}
                  className="px-4 sm:px-6"
                >
                  {fullLabel}
                </Button>
              ))}
            </div>
            <div className="mb-6 flex justify-center gap-2">
              <Button
                variant="ghost"
                onClick={() => goToStep(Math.max(1, currentStep - 1) as VerificationStep)}
                disabled={currentStep === 1}
                size="sm"
              >
                ← Previous
              </Button>
              <Button
                variant="ghost"
                onClick={() => goToStep(Math.min(4, currentStep + 1) as VerificationStep)}
                disabled={currentStep === 4}
                size="sm"
              >
                Next →
              </Button>
            </div>
          </>
        )}

        {/* Step Content */}
        {/* Step 0: Method Selection - Choose phone or zoom */}
        {/* Step 0: Region Track Selection */}
        {currentStep === 0 && (
          <RegionTrackSelection onRegionSelect={handleRegionTrackSelect} />
        )}

        {/* Step 1: Track/Method Selection - Choose zoom, phone, whatsapp, etc. */}
        {currentStep === 1 && selectedRegionTrack && (
          <div className="space-y-6">
            {/* Watch AO Precheck Guide Button */}
            <Card>
              <CardContent className="p-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="lg" className="w-full md:w-auto">
                      <Play className="w-5 h-5 mr-2" />
                      Watch AO Precheck Guide
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>AO Precheck Guide</DialogTitle>
                    </DialogHeader>
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full max-w-4xl aspect-video">
                        <video
                          controls
                          className="w-full h-full rounded-lg shadow-lg object-contain"
                        >
                          <source
                            src="https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/ao_intelligence_-_how_to_do_a_precheck_call%20(1080p).mp4"
                            type="video/mp4"
                          />
                          <p className="text-center text-muted-foreground mt-4">
                            Your browser does not support the video tag. Please update your browser to view the AO Precheck Guide.
                          </p>
                        </video>
                      </div>
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Learn how to use AO Precheck verification system
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
            
            <MethodSelection
              selectedMethod={selectedMethod}
              onMethodSelect={handleMethodSelect}
              onBack={() => goToStep(0)}
              onContinue={handleMethodContinue}
            />
          </div>
        )}

        {/* Step 2: AO Precheck - Client Information Collection */}
        {currentStep === 2 && selectedTrack && (
          <ClientForm 
            onSubmit={handleClientInfoSubmit}
            hideZoomSelection={selectedTrack !== 'zoom'}
            selectedTrack={selectedTrack}
            sessionType={sessionType}
            prefilledData={prefilledClientData ? { ...prefilledClientData, is_demo: isPrecheckDemo } : undefined}
            defaultMethod={selectedMethod || 'zoom'}
            regionTrack={selectedRegionTrack || 'us'}
            embedded={standaloneUi}
          />
        )}

        {/* Step 3: SMS Screen - ALWAYS show after client info, before call */}
        {/* This step sends SMS to client and agent, then allows proceeding to call */}
        {currentStep === 3 && verificationSession && (
          <UnifiedVerification
            sessionId={verificationSession.sessionId}
            method={verificationSession.verificationMethod as VerificationMethod}
            clientName={`${verificationSession.firstName} ${verificationSession.lastName}`}
            onBack={() => goToStep(2)}
            embedded={standaloneUi}
            onContinue={() => {
              // After SMS is sent and confirmed, proceed to call step (Step 4)
              goToStep(4);
            }}
            onSkipStep3={() => {
              // Skip to call step (Step 4) - the verification call is the last step
              goToStep(4);
            }}
          />
        )}

        {/* Step 4: Verification Call - Shows call interface, then proceed to certificate (Step 5) */}
        {currentStep === 4 && verificationSession && selectedTrack === 'zoom' && (
          (() => {
            // Check if call is completed - if yes, show certificate; if no, show call interface
            const isCallCompleted = callStatus === 'completed' ||
                                   verificationSession.taalkCallStatus === 'completed' || 
                                   verificationSession.status === 'completed' ||
                                   (verificationSession.taalkCallDuration && verificationSession.taalkCallDuration > 0);
            
            // If call is completed, go to certificate step (Step 5)
            if (isCallCompleted) {
              return (
                <EnterpriseCertificate
                  session={verificationSession}
                  onStartNew={startNewVerification}
                  onBack={() => goToStep(4)}
                  onComplete={onComplete}
                />
              );
            }
            
            // Call is NOT completed - show call interface (this is the LAST step - the call)
            if (verificationSession.verificationMethod === 'zoom') {
              return (
            <div className="w-full max-w-4xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {verificationSession?.language === 'es' ? 'Paso 3: Completar Llamada de Verificación' : 'Step 3: Complete Verification Call'}
                </h1>
                <p className="text-gray-600">
                  {verificationSession?.language === 'es' 
                    ? 'Inicie la llamada de verificación para que el cliente complete su proceso de verificación.'
                    : 'Start the verification call for the client to complete their verification process.'}
                </p>
              </div>

              {/* Call Initiation Section - MOVED TO TOP */}
              {callStatus === 'pending' && (
                <Card className="w-full mb-6">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="mb-4">
                        <Phone className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {verificationSession?.language === 'es' 
                            ? 'Listo para Iniciar Llamada de Verificación'
                            : 'Ready to Start Verification Call'}
                        </h3>
                        {verificationSession?.taalkCallId && (
                          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              {verificationSession?.language === 'es' 
                                ? 'Ya se ha iniciado una llamada para esta sesión. Use "Reiniciar Verificación" para iniciar una nueva llamada.'
                                : 'A call has already been initiated for this session. Use "Restart Verification" to start a new call.'}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-x-3">
                        <Button 
                          onClick={startVerificationCall}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          size="lg"
                          disabled={!!verificationSession?.taalkCallId}
                        >
                          🚀 {verificationSession?.language === 'es' ? 'Iniciar Llamada de Verificación' : 'Start Verification Call'}
                        </Button>
                        {verificationSession?.taalkCallId && (
                          <Button 
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/reset-call`, {
                                  method: 'POST'
                                });
                                if (response.ok) {
                                  // Refresh session data
                                  const sessionResponse = await fetch(`/api/verification/session/${verificationSession.sessionId}`);
                                  const sessionData = await sessionResponse.json();
                                  setVerificationSession(sessionData);
                                  toast({
                                    title: verificationSession?.language === 'es' ? "Sesión Reiniciada" : "Session Reset",
                                    description: verificationSession?.language === 'es' 
                                      ? "Ahora puede iniciar una nueva llamada de verificación."
                                      : "You can now start a new verification call.",
                                  });
                                } else {
                                  throw new Error('Failed to reset session');
                                }
                              } catch (error) {
                                toast({
                                  title: verificationSession?.language === 'es' ? "Error al Reiniciar" : "Reset Failed",
                                  description: verificationSession?.language === 'es' 
                                    ? "No se pudo reiniciar la sesión de verificación."
                                    : "Unable to reset verification session.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                            size="lg"
                          >
                            🔄 {verificationSession?.language === 'es' ? 'Reiniciar Verificación' : 'Restart Verification'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Zoom Track Instructions - In Accordion */}
              {verificationSession.verificationMethod === 'zoom' && (
                <Card className="w-full mb-6">
                  <CardContent className="p-6">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="instructions">
                        <AccordionTrigger className="text-lg font-semibold">
                          {verificationSession.language === 'es' ? 'Ver Instrucciones de Verificación' : 'View Verification Instructions'}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 text-left max-w-3xl mx-auto pt-4">
                            <div className="bg-white rounded-lg p-5 border-l-4 border-blue-500">
                              <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                                {verificationSession.language === 'es' ? 'Paso 1 — Preparar al Cliente' : 'Step 1 — Prepare the Customer'}
                              </h4>
                              <p className="text-gray-700 mb-2">
                                {verificationSession.language === 'es' ? 'Antes de comenzar, dígale al cliente:' : 'Before starting, tell the customer:'}
                              </p>
                              <p className="text-gray-800 font-medium italic mb-2">
                                {verificationSession.language === 'es' 
                                  ? '"Voy a traer un asistente virtual a la llamada. Por favor responda con sí o no siempre que sea posible."'
                                  : '"I\'m going to bring a virtual assistant onto the call. Please answer with yes or no whenever possible."'}
                              </p>
                              <p className="text-gray-700">
                                {verificationSession.language === 'es' 
                                  ? 'Confirme que entienden y están listos antes de continuar.'
                                  : 'Confirm they understand and are ready before moving on.'}
                              </p>
                            </div>
                            
                            <div className="bg-white rounded-lg p-5 border-l-4 border-green-500">
                              <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                                {verificationSession.language === 'es' ? 'Paso 2 — Iniciar Llamada de Verificación' : 'Step 2 — Start Verification Call'}
                              </h4>
                              <p className="text-gray-700">
                                {verificationSession.language === 'es' 
                                  ? 'Cuando esté listo para comenzar, haga clic en "Iniciar Llamada de Verificación".'
                                  : 'When you\'re ready to begin, click "Start Verification Call."'}
                              </p>
                              <p className="text-gray-700 mt-2">
                                {verificationSession.language === 'es' 
                                  ? 'AO Intelligence intentará unirse a su reunión de Zoom como participante.'
                                  : 'AO Intelligence will then attempt to join your Zoom meeting as a participant.'}
                              </p>
                            </div>
                            
                            <div className="bg-white rounded-lg p-5 border-l-4 border-purple-500">
                              <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                                {verificationSession.language === 'es' ? 'Paso 3 — Admitir el Asistente Virtual en Zoom' : 'Step 3 — Admit the Virtual Assistant Into Zoom'}
                              </h4>
                              <p className="text-gray-700 mb-2">
                                {verificationSession.language === 'es' ? 'Después de iniciar la verificación:' : 'After starting the verification:'}
                              </p>
                              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'AO Intelligence aparecerá en la sala de espera de Zoom.'
                                    : 'AO Intelligence will appear in the Zoom waiting room.'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'DEBE admitir manualmente al asistente virtual por razones de seguridad.'
                                    : 'You MUST manually admit the virtual assistant for security reasons.'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'Una vez admitido, AO Intelligence se conectará automáticamente y comenzará el proceso.'
                                    : 'Once admitted, AO Intelligence will automatically connect and begin the process.'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'No necesita invitarlo ni interactuar con él más.'
                                    : 'You do not need to invite it or interact with it further.'}
                                </li>
                              </ul>
                            </div>
                            
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                              <h4 className="font-semibold text-yellow-900 mb-3">
                                {verificationSession.language === 'es' ? 'Requisitos Importantes' : 'Important Requirements'}
                              </h4>
                              <p className="text-yellow-800 mb-2">
                                {verificationSession.language === 'es' 
                                  ? 'Para asegurar que el asistente virtual pueda unirse:'
                                  : 'To ensure the virtual assistant can join:'}
                              </p>
                              <p className="text-yellow-800 font-medium mb-2">
                                {verificationSession.language === 'es' 
                                  ? 'Su reunión de Zoom debe permitir participantes por teléfono/audio'
                                  : 'Your Zoom meeting must allow phone/audio participants'}
                              </p>
                              <p className="text-yellow-800 text-sm mb-3">
                                {verificationSession.language === 'es' 
                                  ? '(Si el audio o la telefonía está deshabilitado, el asistente no puede conectarse.)'
                                  : '(If audio or telephony is disabled, the assistant cannot connect.)'}
                              </p>
                              <p className="text-yellow-800 mb-2">
                                {verificationSession.language === 'es' 
                                  ? 'Si el asistente no puede unirse, el problema suele ser:'
                                  : 'If the assistant cannot join, the issue is usually:'}
                              </p>
                              <ul className="list-disc list-inside text-yellow-800 space-y-1 ml-2">
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? '❌ Contraseña de reunión de Zoom incorrecta'
                                    : '❌ Incorrect Zoom meeting password'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? '❌ Audio/telefonía deshabilitado'
                                    : '❌ Audio/telephony disabled'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? '❌ Admisión a la sala de espera no concedida'
                                    : '❌ Waiting room admission not granted'}
                                </li>
                              </ul>
                              <p className="text-yellow-800 mt-3 font-medium">
                                {verificationSession.language === 'es' 
                                  ? 'Una vez admitido exitosamente, AO Intelligence procederá automáticamente.'
                                  : 'Once admitted successfully, AO Intelligence will proceed automatically.'}
                              </p>
                            </div>
                            
                            <div className="bg-white rounded-lg p-5 border-l-4 border-indigo-500">
                              <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                                {verificationSession.language === 'es' ? 'Paso 4 — El Proceso de Verificación Comienza Automáticamente' : 'Step 4 — Verification Process Begins Automatically'}
                              </h4>
                              <p className="text-gray-700 mb-2">
                                {verificationSession.language === 'es' 
                                  ? 'Después de que AO Intelligence sea admitido en la reunión:'
                                  : 'After AO Intelligence is admitted into the meeting:'}
                              </p>
                              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'El asistente virtual comenzará automáticamente la secuencia de llamada de verificación.'
                                    : 'The virtual assistant will automatically begin the verification call sequence.'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'Verá indicaciones en pantalla y escuchará instrucciones mientras el sistema lo guía a través del proceso.'
                                    : 'You will see on-screen prompts and hear instructions as the system walks you through the process.'}
                                </li>
                                <li>
                                  {verificationSession.language === 'es' 
                                    ? 'Siga las indicaciones del asistente hasta que se completen todas las preguntas.'
                                    : 'Follow the assistant\'s cues until all questions are completed.'}
                                </li>
                              </ul>
                            </div>
                            
                            <div className="bg-white rounded-lg p-5 border-l-4 border-green-500">
                              <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                                {verificationSession.language === 'es' ? 'Paso 5 — La Verificación Está Completa' : 'Step 5 — Verification is Complete'}
                              </h4>
                              <p className="text-gray-700">
                                {verificationSession.language === 'es' 
                                  ? 'Una vez que el Asistente Virtual termine el guión y se hayan recopilado todas las respuestas requeridas, la verificación está completa.'
                                  : 'Once the Virtual Assistant finishes the script and all required answers have been collected, the verification is complete.'}
                              </p>
                              <p className="text-gray-700 mt-2 font-medium">
                                {verificationSession.language === 'es' 
                                  ? 'No se necesitan más pasos.'
                                  : 'No further steps are needed.'}
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              )}

              {/* Call Status Tracking - Shows each stage of the verification call */}
              {(callStatus === 'active' || callStatus === 'completed' || callStatus === 'failed') && (
                <Card className="w-full mb-6">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {verificationSession?.language === 'es' ? 'Estado de la Llamada de Verificación' : 'Verification Call Status'}
                        </h3>
                        <Badge 
                          variant={
                            callStatus === 'completed' ? 'default' : 
                            callStatus === 'failed' ? 'destructive' : 
                            'secondary'
                          }
                          className={
                            callStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            callStatus === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }
                        >
                          {callStatus === 'completed' && <CheckCircle className="w-4 h-4 mr-1" />}
                          {callStatus === 'failed' && <AlertCircle className="w-4 h-4 mr-1" />}
                          {callStatus === 'active' && <Clock className="w-4 h-4 mr-1" />}
                          {callStatus.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`w-3 h-3 rounded-full ${
                            callStatus === 'active' || callStatus === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                          <span className="text-sm font-medium">
                            {verificationSession?.language === 'es' ? 'Progreso de la Llamada' : 'Call Progress'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{callProgress}</p>
                      </div>
                      
                      {callStatus === 'completed' && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">
                              {verificationSession?.language === 'es' ? '¡Verificación Completa!' : 'Verification Complete!'}
                            </span>
                          </div>
                          <p className="text-sm text-green-700 mt-1">
                            {verificationSession?.language === 'es' 
                              ? 'La llamada de verificación se ha completado exitosamente. Ahora puede proceder a generar el certificado.'
                              : 'The verification call has been completed successfully. You can now proceed to generate the certificate.'}
                          </p>
                        </div>
                      )}
                      
                      {callStatus === 'failed' && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <span className="font-medium text-red-800">
                              {verificationSession?.language === 'es' ? 'Llamada Fallida' : 'Call Failed'}
                            </span>
                          </div>
                          <p className="text-sm text-red-700 mt-1 mb-3">
                            {verificationSession?.language === 'es' 
                              ? 'La llamada de verificación encontró un problema. Por favor intente nuevamente o contacte soporte si el problema persiste.'
                              : 'The verification call encountered an issue. Please try again or contact support if the problem persists.'}
                          </p>
                          <Button 
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/reset-call`, {
                                  method: 'POST'
                                });
                                if (response.ok) {
                                  setCallStatus('pending');
                                  toast({
                                    title: "Ready to Retry",
                                    description: "You can now start a new verification call.",
                                  });
                                } else {
                                  throw new Error('Failed to reset session');
                                }
                              } catch (error) {
                                toast({
                                  title: "Reset Failed",
                                  description: "Unable to reset verification session.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            size="sm"
                          >
                            🔄 {verificationSession?.language === 'es' ? 'Reintentar Llamada de Verificación' : 'Retry Verification Call'}
                          </Button>
                        </div>
                      )}

                      {/* Manual Complete Call button - appears when call is active */}
                      {callStatus === 'active' && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <Button 
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/verification/session/${verificationSession.sessionId}/complete-call`, { method: 'POST' });
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({}));
                                  throw new Error(err?.message || err?.error || 'Failed to mark call completed');
                                }
                                setCallStatus('completed');
                                setCallProgress(verificationSession?.language === 'es' 
                                  ? 'Llamada completada manualmente'
                                  : 'Call completed manually');
                                toast({
                                  title: verificationSession?.language === 'es' ? "Llamada Completada" : "Call Completed",
                                  description: verificationSession?.language === 'es' 
                                    ? "Puede proceder al siguiente paso para generar el certificado."
                                    : "You can now proceed to the next step to generate the certificate.",
                                });
                                try {
                                  const sessionRes = await fetch(`/api/verification/session/${verificationSession.sessionId}`);
                                  if (sessionRes.ok) {
                                    const updated = await sessionRes.json();
                                    setVerificationSession(updated);
                                  }
                                } catch {
                                  /* session refresh best-effort */
                                }
                                goToStep(5);
                              } catch (e: any) {
                                toast({
                                  title: "Error",
                                  description: e?.message || "Could not complete the call.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="lg"
                          >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            {verificationSession?.language === 'es' 
                              ? 'Completar Llamada cuando el Asistente Virtual Termine'
                              : 'Complete Call when Virtual Agent is Finished'}
                          </Button>
                        </div>
                      )}
                      
                      {/* Retry button for completed calls */}
                      {callStatus === 'completed' && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <Button 
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/reset-call`, {
                                  method: 'POST'
                                });
                                if (response.ok) {
                                  setCallStatus('pending');
                                  toast({
                                    title: verificationSession?.language === 'es' ? "Sesión Reiniciada" : "Session Reset",
                                    description: verificationSession?.language === 'es' 
                                      ? "Ahora puede iniciar una nueva llamada de verificación."
                                      : "You can now start a new verification call.",
                                  });
                                } else {
                                  throw new Error('Failed to reset session');
                                }
                              } catch (error) {
                                toast({
                                  title: verificationSession?.language === 'es' ? "Error al Reiniciar" : "Reset Failed",
                                  description: verificationSession?.language === 'es' 
                                    ? "No se pudo reiniciar la sesión de verificación."
                                    : "Unable to reset verification session.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                            size="sm"
                          >
                            🔄 {verificationSession?.language === 'es' ? 'Iniciar Nueva Llamada de Verificación' : 'Start New Verification Call'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center mt-6">
                <Button variant="outline" onClick={() => goToStep(3)}>
                  ← {verificationSession?.language === 'es' ? 'Volver a SMS' : 'Back to SMS'}
                </Button>
                {callStatus === 'completed' ? (
                  <Button 
                    onClick={() => {
                      // After call completes, go to certificate step (Step 5)
                      fetch(`/api/verification/session/${verificationSession.sessionId}`)
                        .then(res => res.json())
                        .then(updatedSession => {
                          setVerificationSession(updatedSession);
                          goToStep(5);
                        })
                        .catch(err => console.error('Failed to refresh session:', err));
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {verificationSession?.language === 'es' ? 'Ver Certificado →' : 'View Certificate →'}
                  </Button>
                ) : callStatus === 'failed' ? (
                  <Button 
                    onClick={() => {
                      setCallStatus('pending');
                      setCallProgress(verificationSession?.language === 'es' ? 'Iniciando llamada...' : 'Initializing call...');
                    }}
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {verificationSession?.language === 'es' ? 'Reintentar Llamada' : 'Retry Call'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => goToStep(4)}
                    variant="outline"
                    disabled
                    className="opacity-50"
                  >
                    {verificationSession?.language === 'es' ? 'Esperando Finalización...' : 'Waiting for Completion...'}
                  </Button>
                )}
              </div>
            </div>
              );
            }
            
            // Default fallback - show verification progress
            return (
            <VerificationProgress
              sessionId={verificationSession.sessionId}
              onComplete={() => {
                handleVerificationComplete();
                goToStep(5);
              }}
              onBack={() => goToStep(3)}
            />
            );
          })()
        )}

        {/* Step 4: Conference Call - AFTER SMS screen (Step 3) */}
        {currentStep === 4 && verificationSession && selectedTrack === 'conference' && (
          <ConferenceCallStep
            session={verificationSession}
            onCallComplete={() => {
              // Complete-call API already called by button; refresh session and redirect to AO Precheck
              fetch(`/api/verification/session/${verificationSession.sessionId}`)
                .then(res => {
                  if (!res.ok) throw new Error(res.statusText || 'Failed to fetch session');
                  return res.json();
                })
                .then(updatedSession => {
                  setVerificationSession(updatedSession);
                  if (updatedSession.callCompleted || updatedSession.taalkCallStatus === 'completed' || 
                      updatedSession.status === 'completed' ||
                      (updatedSession.taalkCallDuration && updatedSession.taalkCallDuration > 0)) {
                    onComplete?.();
                  } else {
                    goToStep(5);
                  }
                })
                .catch(err => {
                  console.error('Failed to check call status:', err);
                  toast({
                    title: "Error",
                    description: err?.message || "Unable to verify call status. Redirecting to AO Precheck.",
                    variant: "destructive"
                  });
                  onComplete?.();
                });
            }}
            onBack={() => goToStep(3)}
            language={verificationSession.language || 'en'}
          />
        )}


        {/* Step 5: Zoom certificate */}
        {currentStep === 5 && verificationSession && selectedTrack === 'zoom' && (
          <EnterpriseCertificate
            session={verificationSession}
            onStartNew={startNewVerification}
            onBack={() => goToStep(4)}
            onComplete={onComplete}
          />
        )}

        {/* Step 5: Conference Completion (Certificate) */}
        {currentStep === 5 && verificationSession && selectedTrack === 'conference' && (
          (() => {
            // Only show certificate if call is actually completed
            const isCallCompleted = verificationSession.taalkCallStatus === 'completed' || 
                                   verificationSession.status === 'completed' ||
                                   (verificationSession.taalkCallDuration && verificationSession.taalkCallDuration > 0);
            
            if (!isCallCompleted) {
              // Show message and redirect button if call isn't completed
              return (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Clock className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Verification Call Required</h2>
                    <p className="text-gray-600 mb-4">Please complete the verification call before viewing the certificate.</p>
                    <Button onClick={() => {
                      toast({
                        title: "Call Required",
                        description: "Please complete the verification call first.",
                        variant: "destructive"
                      });
                      goToStep(4);
                    }}>Go to Call Step</Button>
                  </CardContent>
                </Card>
              );
            }
            
            return (
              <EnterpriseCertificate
                session={verificationSession}
                onStartNew={startNewVerification}
                onBack={() => goToStep(4)}
                onComplete={onComplete}
              />
            );
          })()
        )}

        {/* Legacy Step 5 for backward compatibility - Certificate */}
        {currentStep === 5 && verificationSession && !selectedTrack && (
          <EnterpriseCertificate
            session={verificationSession}
            onStartNew={startNewVerification}
            onBack={() => goToStep(4)}
            onComplete={onComplete}
          />
        )}
      </main>

      {/* Producer Profile Modal */}
      {showproducerProfile && (
        <producerProfile onClose={() => setShowproducerProfile(false)} />
      )}
    </div>
  );
}
