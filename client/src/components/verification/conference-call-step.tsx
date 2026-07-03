import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Phone, PhoneCall, PhoneOff, Clock, CheckCircle, AlertCircle, Mic, MicOff, Camera, Upload, X, Video, MessageCircle } from "lucide-react";
import type { VerificationSession } from "@shared/schema";

interface ConferenceCallStepProps {
  session: VerificationSession;
  onCallComplete: () => void;
  onBack: () => void;
  language?: 'en' | 'es';
}

type CallStatus = 'idle' | 'initiating' | 'ringing' | 'answered' | 'in_progress' | 'completed' | 'failed';

export function ConferenceCallStep({ session, onCallComplete, onBack, language = 'en' }: ConferenceCallStepProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  // Timer removed - agent manually completes call
  const [isMuted, setIsMuted] = useState(false);
  const [callProgress, setCallProgress] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<string>('');
  const [isScreenshotRequired, setIsScreenshotRequired] = useState(true);
  const { toast } = useToast();
  const isSpanish = language === 'es';

  // Timer removed - agent will manually complete the call

  // Poll for call status updates (only to detect failures, agent manually completes successful calls)
  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'completed' || callStatus === 'failed') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/verification/session/${session.sessionId}/call-status`);
        const data = await response.json();
        
        // Only update status if call failed (agent manually completes successful calls)
        if (data.status === 'failed') {
          setCallStatus('failed');
          setCallProgress(isSpanish ? 'Llamada fallida' : 'Call failed');
          clearInterval(pollInterval);
          toast({
            title: isSpanish ? 'Llamada fallida' : 'Call Failed',
            description: isSpanish 
              ? 'Hubo un problema con la llamada. Intente nuevamente.'
              : 'There was a problem with the call. Please try again.',
            variant: "destructive"
          });
        } else if (data.isCallActive && (callStatus === 'ringing' || callStatus === 'initiating')) {
          // Update to in_progress when call becomes active
          setCallStatus('in_progress');
          setCallProgress(data.progress || (isSpanish ? 'Llamada en progreso...' : 'Call in progress...'));
        }
      } catch (error) {
        // Silent fail - polling is non-critical
        console.error('Error polling call status:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [session.sessionId, callStatus, toast, isSpanish]);

  const handleInitiateCall = async () => {
    try {
      setCallStatus('initiating');
      setCallProgress(isSpanish ? 'Iniciando llamada...' : 'Initiating call...');
      
      const response = await fetch('/api/verification/initiate-conference-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          clientInfo: {
            firstName: session.firstName,
            lastName: session.lastName,
            phone: session.phone,
            city: session.city,
            state: session.state,
            premium: session.premium
          },
          producerPhone: session.producerPhone
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }

      const data = await response.json();
      
      if (data.success) {
        setCallStatus('ringing');
        setCallProgress(isSpanish ? 'Llamando a su teléfono...' : 'Calling your phone...');
        
        toast({
          title: isSpanish ? 'Llamada iniciada' : 'Call Initiated',
          description: isSpanish 
            ? 'El bot está llamando a su teléfono. Por favor responda.'
            : 'The bot is calling your phone. Please answer.',
        });
      } else {
        throw new Error(data.error || 'Failed to initiate call');
      }
    } catch (error) {
      setCallStatus('failed');
      setCallProgress(isSpanish ? 'Error al iniciar llamada' : 'Error initiating call');
      
      toast({
        title: isSpanish ? 'Error' : 'Error',
        description: isSpanish 
          ? 'No se pudo iniciar la llamada. Intente nuevamente.'
          : 'Could not initiate call. Please try again.',
        variant: "destructive"
      });
    }
  };

  const handleEndCall = async () => {
    try {
      const response = await fetch('/api/verification/end-conference-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          callId: session.taalkCallId
        }),
      });

      if (response.ok) {
        setCallStatus('completed');
        setCallProgress(isSpanish ? 'Llamada finalizada' : 'Call ended');
        
        toast({
          title: isSpanish ? 'Llamada finalizada' : 'Call Ended',
          description: isSpanish 
            ? 'La llamada ha sido finalizada correctamente'
            : 'The call has been ended successfully',
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    // In a real implementation, this would control the microphone
  };

  const handleScreenshotUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: isSpanish ? 'Archivo muy grande' : 'File Too Large',
          description: isSpanish 
            ? 'El archivo debe ser menor a 10MB'
            : 'File must be smaller than 10MB',
          variant: "destructive"
        });
        return;
      }
      
      setScreenshot(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setScreenshotPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  const handleSkipScreenshot = () => {
    if (!skipReason) {
      toast({
        title: isSpanish ? 'Razón requerida' : 'Reason Required',
        description: isSpanish 
          ? 'Por favor seleccione una razón para omitir la captura'
          : 'Please select a reason for skipping the screenshot',
        variant: "destructive"
      });
      return;
    }
    setIsScreenshotRequired(false);
    toast({
      title: isSpanish ? 'Captura omitida' : 'Screenshot Skipped',
      description: isSpanish 
        ? `Razón: ${skipReason}`
        : `Reason: ${skipReason}`,
    });
  };

  // Duration display removed - agent manually completes call

  const getStatusIcon = () => {
    switch (callStatus) {
      case 'idle':
        return <Phone className="w-6 h-6 text-gray-500" />;
      case 'initiating':
      case 'ringing':
        return <PhoneCall className="w-6 h-6 text-blue-500 animate-pulse" />;
      case 'answered':
      case 'in_progress':
        return <PhoneCall className="w-6 h-6 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Phone className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'idle':
        return isSpanish ? 'Listo para llamar' : 'Ready to call';
      case 'initiating':
        return isSpanish ? 'Iniciando...' : 'Initiating...';
      case 'ringing':
        return isSpanish ? 'Llamando...' : 'Ringing...';
      case 'answered':
        return isSpanish ? 'Conectado' : 'Connected';
      case 'in_progress':
        return isSpanish ? 'En progreso' : 'In Progress';
      case 'completed':
        return isSpanish ? 'Completado' : 'Completed';
      case 'failed':
        return isSpanish ? 'Fallido' : 'Failed';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'idle':
        return 'bg-gray-100 text-gray-800';
      case 'initiating':
      case 'ringing':
        return 'bg-blue-100 text-blue-800';
      case 'answered':
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isSpanish ? 'Paso 3: Llamada de Verificación' : 'Step 3: Verification Call'}
        </h1>
        <p className="text-gray-600">
          {isSpanish 
            ? `Inicie la llamada de verificación para que el cliente complete su proceso de verificación.`
            : `Start the verification call for the client to complete their verification process.`}
        </p>
      </div>

      <div className="space-y-6">
          {/* Start Call Button - At the Top (Same as Zoom Track) */}
          {callStatus === 'idle' && (
            <Card className="w-full mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {isSpanish ? 'Iniciar Llamada de Verificación' : 'Start Verification Call'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {isSpanish 
                        ? 'Cuando esté listo, haga clic en el botón para iniciar la llamada de verificación.'
                        : 'When you\'re ready, click the button to start the verification call.'
                      }
                    </p>
                  </div>
                  <div className="space-x-3">
                    <Button
                      onClick={handleInitiateCall}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      🚀 {isSpanish ? 'Iniciar Llamada de Verificación' : 'Start Verification Call'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conference Call Instructions - In Accordion (Same as Zoom Track) */}
          <Card className="w-full mb-6">
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="instructions">
                  <AccordionTrigger className="text-lg font-semibold">
                    {isSpanish ? 'Ver Instrucciones de Verificación' : 'View Verification Instructions'}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 text-left max-w-3xl mx-auto pt-4">
                      <div className="bg-white rounded-lg p-5 border-l-4 border-blue-500">
                        <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                          {isSpanish ? 'Paso 1 — Preparar al Cliente' : 'Step 1 — Prepare the Customer'}
                        </h4>
                        <p className="text-gray-700 mb-2">
                          {isSpanish ? 'Dígale al cliente:' : 'Tell the customer:'}
                        </p>
                        <p className="text-gray-800 font-medium italic mb-2">
                          {isSpanish 
                            ? '"Voy a traer un asistente virtual a la llamada. Por favor responda con sí o no siempre que sea posible."'
                            : '"I\'m going to bring a virtual assistant onto the call. Please answer with yes or no whenever possible."'}
                        </p>
                        <p className="text-gray-700">
                          {isSpanish 
                            ? 'Confirme que entienden antes de continuar.'
                            : 'Confirm they understand before continuing.'}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-5 border-l-4 border-green-500">
                        <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                          {isSpanish ? 'Paso 2 — Llame al Cliente Primero' : 'Step 2 — Call the Customer First'}
                        </h4>
                        <p className="text-gray-700 mb-2">
                          {isSpanish 
                            ? 'Use su teléfono celular para llamar al cliente directamente usando una llamada telefónica normal.'
                            : 'Use your cell phone to call the customer directly using a normal phone call.'}
                        </p>
                        <p className="text-gray-800 font-semibold text-red-700 mt-2">
                          {isSpanish 
                            ? 'Importante: NO use FaceTime o WhatsApp. Estas aplicaciones no pueden fusionar llamadas. Debe estar en una llamada telefónica activa y regular con el cliente antes de iniciar la verificación.'
                            : 'Important: Do NOT use FaceTime or WhatsApp. These apps cannot merge calls. You must already be on an active, regular phone call with the customer before starting the verification.'}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-5 border-l-4 border-purple-500">
                        <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                          {isSpanish ? 'Paso 3 — Cuando Esté Listo para Fusionar' : 'Step 3 — When You Are Ready to Merge'}
                        </h4>
                        <p className="text-gray-700 mb-2">
                          {isSpanish 
                            ? 'Una vez que esté en una llamada en vivo con el cliente y listo para traer al Asistente Virtual a la línea, toque "Iniciar Llamada" en la parte superior de esta página.'
                            : 'Once you are on a live call with the customer, and ready to bring the Virtual Assistant onto the line, tap "Start Call" at the top of this page.'}
                        </p>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                        <h4 className="font-semibold text-yellow-900 mb-3">
                          {isSpanish ? 'Paso 4 — Fusionar el Asistente Virtual' : 'Step 4 — Merge the Virtual Assistant'}
                        </h4>
                        <p className="text-yellow-800 mb-2">
                          {isSpanish 
                            ? 'Después de tocar "Iniciar Llamada", el Asistente Virtual llamará a su teléfono. Haga lo siguiente:'
                            : 'After tapping "Start Call," the Virtual Assistant will call your phone. Do the following:'}
                        </p>
                        <ul className="list-disc list-inside text-yellow-800 space-y-1 ml-2">
                          <li>
                            {isSpanish 
                              ? 'Responda la llamada del Asistente Virtual.'
                              : 'Answer the Virtual Assistant\'s call.'}
                          </li>
                          <li>
                            {isSpanish 
                              ? 'Use la función de fusión de tres vías / conferencia de su teléfono para combinar: Usted, El cliente, El Asistente Virtual.'
                              : 'Use your phone\'s three-way merge / conference feature to combine: You, The customer, The Virtual Assistant.'}
                          </li>
                        </ul>
                        <p className="text-yellow-800 font-semibold mt-3">
                          {isSpanish 
                            ? 'NO OMITA ESTE PASO. Si las llamadas no se fusionan, la verificación fallará.'
                            : 'DO NOT SKIP THIS STEP. If the calls are not merged, the verification will fail.'}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-5 border-l-4 border-indigo-500">
                        <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                          {isSpanish ? 'Paso 5 — Completar la Verificación' : 'Step 5 — Complete the Verification'}
                        </h4>
                        <p className="text-gray-700 mb-2">
                          {isSpanish 
                            ? 'Una vez que todas las partes estén fusionadas, siga las indicaciones del Asistente Virtual hasta que la verificación guionizada esté completa.'
                            : 'Once all parties are merged, follow the Virtual Assistant\'s prompts until the scripted verification is complete.'}
                        </p>
                        <p className="text-gray-700 mt-2">
                          {isSpanish 
                            ? 'La llamada será grabada para fines de verificación.'
                            : 'The call will be recorded for verification purposes.'}
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Call Status Tracking - Shows each stage of the verification call (Same as Zoom Track) */}
          {(callStatus === 'initiating' || callStatus === 'ringing' || callStatus === 'answered' || callStatus === 'in_progress' || callStatus === 'completed' || callStatus === 'failed') && (
            <Card className="w-full mb-6">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isSpanish ? 'Estado de la Llamada de Verificación' : 'Verification Call Status'}
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
                      {(callStatus === 'initiating' || callStatus === 'ringing' || callStatus === 'answered' || callStatus === 'in_progress') && <Clock className="w-4 h-4 mr-1" />}
                      {callStatus.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-4">
                    <div className="flex justify-center">
                      {getStatusIcon()}
                    </div>
                    <div className="space-y-2">
                      <Badge className={`text-lg px-4 py-2 ${getStatusColor()}`}>
                        {getStatusText()}
                      </Badge>
                      {callProgress && (
                        <p className="text-gray-600 text-center">{callProgress}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete Call Button - Same placement as Zoom Track */}
          {(callStatus === 'answered' || callStatus === 'in_progress') && (
            <Card className="w-full mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/verification/session/${session.sessionId}/complete-call`, { method: 'POST' });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({}));
                          throw new Error(err?.message || err?.error || 'Failed to mark call completed');
                        }
                        setCallStatus('completed');
                        setCallProgress(isSpanish ? 'Llamada completada por el agente.' : 'Call completed by agent.');
                        toast({
                          title: isSpanish ? "Llamada Completada" : "Call Completed",
                          description: isSpanish
                            ? "La llamada de verificación ha sido marcada como completada por el agente."
                            : "The verification call has been marked as completed by the agent.",
                        });
                        onCallComplete();
                      } catch (e: any) {
                        toast({
                          title: isSpanish ? "Error" : "Error",
                          description: e?.message || (isSpanish ? "No se pudo completar la llamada." : "Could not complete the call."),
                          variant: "destructive",
                        });
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg flex items-center gap-2 shadow-lg"
                    size="lg"
                  >
                    <CheckCircle className="w-6 h-6" />
                    {isSpanish ? 'Completar Llamada cuando el Asistente Virtual Termine' : 'Complete Call when Virtual Agent is Finished'}
                  </Button>
                  
                  <div className="flex space-x-2 justify-center">
                    <Button
                      onClick={handleToggleMute}
                      variant={isMuted ? "destructive" : "outline"}
                      size="lg"
                    >
                      {isMuted ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
                      {isMuted 
                        ? (isSpanish ? 'Desactivar Silencio' : 'Unmute')
                        : (isSpanish ? 'Silenciar' : 'Mute')
                      }
                    </Button>
                    
                    <Button
                      onClick={handleEndCall}
                      variant="destructive"
                      size="lg"
                    >
                      <PhoneOff className="w-5 h-5 mr-2" />
                      {isSpanish ? 'Finalizar Llamada' : 'End Call'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Retry Button for Failed Calls */}
          {callStatus === 'failed' && (
            <Card className="w-full mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Button
                    onClick={handleInitiateCall}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg flex items-center gap-2 shadow-lg"
                    size="lg"
                  >
                    <PhoneCall className="w-6 h-6" />
                    {isSpanish ? 'Reintentar Llamada' : 'Retry Call'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Continue Button for Completed Calls */}
          {callStatus === 'completed' && (
            <Card className="w-full mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Button
                    onClick={onCallComplete}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg flex items-center gap-2 shadow-lg"
                    size="lg"
                    disabled={isScreenshotRequired && !screenshot && !skipReason}
                  >
                    <CheckCircle className="w-6 h-6" />
                    {isSpanish ? 'Continuar' : 'Continue'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Screenshot Section - Only show when call is in progress or completed */}
          {(callStatus === 'in_progress' || callStatus === 'completed') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3 flex items-center space-x-2">
                <Camera className="w-5 h-5" />
                <span>
                  {isSpanish ? 'Captura de Pantalla Requerida' : 'Screenshot Required'}
                </span>
              </h4>
              
              <div className="text-blue-700 text-sm mb-4">
                <p>
                  {isSpanish 
                    ? 'Tome una captura de pantalla de su llamada activa (FaceTime, WhatsApp, o llamada telefónica)'
                    : 'Take a screenshot of your active call (FaceTime, WhatsApp, or phone call)'
                  }
                </p>
              </div>

              {!screenshot ? (
                <div className="space-y-4">
                  {/* Upload Screenshot */}
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="screenshot-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-blue-500" />
                        <p className="mb-2 text-sm text-blue-500">
                          <span className="font-semibold">
                            {isSpanish ? 'Haga clic para subir' : 'Click to upload'}
                          </span>
                        </p>
                        <p className="text-xs text-blue-500">
                          {isSpanish ? 'PNG, JPG o JPEG (MAX. 10MB)' : 'PNG, JPG or JPEG (MAX. 10MB)'}
                        </p>
                      </div>
                      <input 
                        id="screenshot-upload" 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleScreenshotUpload}
                      />
                    </label>
                  </div>

                  {/* Skip Screenshot Option */}
                  <div className="border-t border-blue-200 pt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        {isSpanish ? '¿No puede tomar una captura?' : "Can't take a screenshot?"}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <Select value={skipReason} onValueChange={setSkipReason}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={isSpanish ? 'Seleccione una razón' : 'Select a reason'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client-not-on-video">
                            {isSpanish ? 'Cliente no está en video' : 'Client not on video'}
                          </SelectItem>
                          <SelectItem value="technical-issue">
                            {isSpanish ? 'Problema técnico' : 'Technical issue'}
                          </SelectItem>
                          <SelectItem value="client-refused">
                            {isSpanish ? 'Cliente se negó' : 'Client refused'}
                          </SelectItem>
                          <SelectItem value="call-quality-poor">
                            {isSpanish ? 'Calidad de llamada pobre' : 'Poor call quality'}
                          </SelectItem>
                          <SelectItem value="other">
                            {isSpanish ? 'Otra razón' : 'Other reason'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleSkipScreenshot}
                        variant="outline"
                        size="sm"
                        disabled={!skipReason}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Screenshot Preview */}
                  <div className="relative">
                    <img
                      src={screenshotPreview || ''}
                      alt="Screenshot preview"
                      className="w-full max-w-md mx-auto rounded-lg border border-gray-300"
                    />
                    <Button
                      onClick={handleRemoveScreenshot}
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-green-700 font-medium">
                      {isSpanish ? 'Captura subida correctamente' : 'Screenshot uploaded successfully'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={callStatus === 'in_progress'}
            >
              {isSpanish ? 'Atrás' : 'Back'}
            </Button>
            
            <div className="text-sm text-gray-500">
              {isSpanish 
                ? 'Complete la llamada para continuar'
                : 'Complete the call to continue'
              }
            </div>
          </div>
      </div>
    </div>
  );
}
