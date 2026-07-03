import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClientForm } from "@/components/verification/client-form";
import { UnifiedVerification } from "@/components/verification/unified-verification";
import { VerificationProgress } from "@/components/verification/verification-progress";
import { ZoomVerificationStep } from "@/components/verification/zoom-verification-step";
import { EnterpriseCertificate } from "@/components/verification/enterprise-certificate";
import { producerProfile } from "@/components/agent/agent-profile";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { VerificationSession, ClientInfo } from "@shared/schema";
import { Video, Clock, Phone, CheckCircle, AlertCircle, Shield } from "lucide-react";

type VerificationStep = 1 | 2 | 3 | 4;
type VerificationMethod = 'zoom' | 'phone' | 'whatsapp' | 'facetime';

export default function VerificationWorkflowES() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>(1);
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [uploadedScreenshot, setUploadedScreenshot] = useState<File | null>(null);
  const [showproducerProfile, setShowproducerProfile] = useState(false);
  const [callStatus, setCallStatus] = useState<'pending' | 'active' | 'completed' | 'failed'>('pending');
  const [callProgress, setCallProgress] = useState<string>('Inicializando llamada...');
  const [callDuration, setCallDuration] = useState<number>(0);
  const { toast } = useToast();

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const goToStep = (step: VerificationStep) => {
    if (!verificationSession && step > 1) {
      toast({
        title: "Sin Sesión Activa",
        description: "Por favor, inicia una sesión de verificación primero.",
        variant: "destructive"
      });
      return;
    }
    setCurrentStep(step);
  };

  const handleClientInfoSubmit = async (session: VerificationSession) => {
    setVerificationSession(session);
    setCurrentStep(2);
    
    toast({
      title: "Sesión creada",
      description: "Procediendo al paso de verificación...",
    });
  };

  const handleScreenshotUpload = (file: File) => {
    setUploadedScreenshot(file);
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

  const startVerificationCall = async () => {
    if (!verificationSession) return;

    try {
      setCallStatus('active');
      setCallProgress('Iniciando llamada de verificación...');

      const response = await fetch('/api/taalk/initiate-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: verificationSession.sessionId,
          clientPhone: verificationSession.phone,
          clientName: `${verificationSession.firstName} ${verificationSession.lastName}`,
          verificationMethod: verificationSession.verificationMethod,
          premium: parseFloat(verificationSession.premium),
          location: `${verificationSession.city}, ${verificationSession.state}`,
        }),
      });

      if (response.ok) {
        const callData = await response.json();
        setCallProgress('Llamada iniciada exitosamente');
        
        toast({
          title: "🚀 Llamada de Verificación Iniciada",
          description: "La llamada de verificación ha comenzado. El producere recibirá la llamada pronto.",
        });

        await refreshSession();
      } else {
        throw new Error('Failed to start verification call');
      }
    } catch (error) {
      console.error('Error starting verification call:', error);
      setCallStatus('failed');
      setCallProgress('Error al iniciar la llamada');
      
      toast({
        title: "Error de Llamada",
        description: "No se pudo iniciar la llamada de verificación. Por favor, inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  const markCallCompleted = async () => {
    if (!verificationSession) return;

    try {
      const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/complete-verification`, {
        method: 'POST',
      });

      if (response.ok) {
        setCallStatus('completed');
        setCallProgress('Verificación completada');
        setCurrentStep(4);
        
        toast({
          title: "Verificación Completada",
          description: "La llamada de verificación se ha completado exitosamente.",
        });

        await refreshSession();
      }
    } catch (error) {
      console.error('Error marking call as completed:', error);
      toast({
        title: "Error",
        description: "No se pudo marcar la llamada como completada.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-8 py-4 rounded-2xl shadow-lg mb-4">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
              <Shield className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold">Flujo de Verificación AO</h1>
              <p className="text-blue-100 text-sm">Proceso de Verificación de Pólizas</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <ProgressBar 
            progress={progress} 
            className="h-3 bg-gray-200 rounded-full overflow-hidden"
            />
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span className={currentStep >= 1 ? "text-blue-600 font-medium" : ""}>
              Paso 1: Información del Cliente
            </span>
            <span className={currentStep >= 2 ? "text-blue-600 font-medium" : ""}>
              Paso 2: Verificación
            </span>
            <span className={currentStep >= 3 ? "text-blue-600 font-medium" : ""}>
              Paso 3: Llamada
            </span>
            <span className={currentStep >= 4 ? "text-blue-600 font-medium" : ""}>
              Paso 4: Certificado
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mb-6">
          <Button
            onClick={() => goToStep((currentStep - 1) as VerificationStep)}
            disabled={currentStep === 1}
            variant="outline"
            size="sm"
          >
            ← Anterior
          </Button>
          <div className="flex space-x-2">
            <Button
              onClick={() => setShowproducerProfile(true)}
              variant="outline"
              size="sm"
            >
              Configuración de producere
            </Button>
          </div>
          <Button
            onClick={() => goToStep((currentStep + 1) as VerificationStep)}
            disabled={currentStep === totalSteps}
            variant="outline"
            size="sm"
          >
            Siguiente →
          </Button>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <ClientForm onSubmit={handleClientInfoSubmit} />
        )}

        {currentStep === 2 && verificationSession && (
          <UnifiedVerification
            sessionId={verificationSession.sessionId}
            method={verificationSession.verificationMethod as VerificationMethod}
            clientName={`${verificationSession.firstName} ${verificationSession.lastName}`}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
            onSkipStep3={() => goToStep(3)}
            language="es"
          />
        )}

        {currentStep === 3 && verificationSession && (
          verificationSession.verificationMethod === 'zoom' ? (
            <div className="w-full max-w-4xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Paso 3: Completar Llamada de Verificación
                </h1>
                <p className="text-gray-600">
                  Inicia la llamada de verificación para que el cliente complete su proceso de verificación.
                </p>
                
                {/* Zoom-specific Steps 2 & 3 - Only show after SMS verification is completed */}
                {verificationSession.verificationMethod === 'zoom' && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mt-4">
                    <div className="space-y-4 text-left max-w-2xl mx-auto">
                      <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Paso 2: AO Intelligence se Une Automáticamente
                        </h4>
                        <p className="text-gray-700">
                          Después de completar la verificación por SMS, AO Intelligence se unirá automáticamente a tu reunión de Zoom.
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Paso 3: Iniciar llamada de verificación
                        </h4>
                        <p className="text-gray-700">
                          El asistente de verificación comenzará automáticamente el proceso de llamada una vez conectado.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Call Initiation Section */}
              {callStatus === 'pending' && (
                <Card className="w-full mb-6">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="mb-4">
                        <Phone className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Listo para Iniciar Llamada de Verificación
                        </h3>
                        {verificationSession?.taalkCallId && (
                          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              Ya se ha iniciado una llamada para esta sesión. Usa "Reiniciar Verificación" para iniciar una nueva llamada.
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
                          🚀 Iniciar Llamada de Verificación
                        </Button>
                        {verificationSession?.taalkCallId && (
                          <Button 
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/verification/session/${verificationSession.sessionId}/reset-call`, {
                                  method: 'POST'
                                });
                                if (response.ok) {
                                  const sessionResponse = await fetch(`/api/verification/session/${verificationSession.sessionId}`);
                                  const sessionData = await sessionResponse.json();
                                  setVerificationSession(sessionData);
                                  toast({
                                    title: "Sesión Reiniciada",
                                    description: "Ahora puedes iniciar una nueva llamada de verificación.",
                                  });
                                } else {
                                  throw new Error('Failed to reset session');
                                }
                              } catch (error) {
                                toast({
                                  title: "Error al Reiniciar",
                                  description: "No se pudo reiniciar la sesión de verificación.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                            size="lg"
                          >
                            🔄 Reiniciar Verificación
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {callStatus === 'active' && (
                <VerificationProgress
                  sessionId={verificationSession.sessionId}
                  onCallCompleted={markCallCompleted}
                />
              )}

              {callStatus === 'completed' && (
                <div className="text-center py-8 bg-green-50 rounded-lg">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-800 mb-2">¡Verificación Completada!</h3>
                  <p className="text-green-600 mb-4">
                    La llamada de verificación se ha completado exitosamente. Puedes proceder a generar el certificado.
                  </p>
                  <Button
                    onClick={() => goToStep(4)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    Proceder al Certificado
                  </Button>
                </div>
              )}

              {callStatus === 'failed' && (
                <div className="text-center py-8 bg-red-50 rounded-lg">
                  <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-red-800 mb-2">Error en la Llamada</h3>
                  <p className="text-red-600 mb-4">
                    Hubo un error al iniciar la llamada de verificación. Por favor, inténtalo de nuevo.
                  </p>
                  <Button
                    onClick={() => setCallStatus('pending')}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    size="lg"
                  >
                    Reintentar
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ZoomVerificationStep
              session={verificationSession}
              onComplete={() => goToStep(4)}
            />
          )
        )}

        {currentStep === 4 && verificationSession && (
          <EnterpriseCertificate
            session={verificationSession}
          />
        )}

        {/* Producer Profile Modal */}
        {showproducerProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Configuración de producere</h3>
                <Button
                  onClick={() => setShowproducerProfile(false)}
                  variant="outline"
                  size="sm"
                >
                  ✕
                </Button>
              </div>
              <producerProfile onClose={() => setShowproducerProfile(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}