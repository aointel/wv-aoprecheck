import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Phone, Shield, CheckCircle, Clock, AlertCircle, Camera, Upload, X } from "lucide-react";

interface ConferenceMobileVerificationProps {
  sessionId: string;
  clientName: string;
  onVerificationComplete: () => void;
  onBack: () => void;
  language?: 'en' | 'es';
}

export function ConferenceMobileVerification({ 
  sessionId, 
  clientName, 
  onVerificationComplete, 
  onBack,
  language = 'en' 
}: ConferenceMobileVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<string>('');
  const [isScreenshotRequired, setIsScreenshotRequired] = useState(true);
  const { toast } = useToast();
  const isSpanish = language === 'es';

  const maxAttempts = 3;

  // Countdown timer
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  const handleSendCode = async () => {
    try {
      setIsVerifying(true);
      
      // Simulate sending SMS
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIsCodeSent(true);
      setTimeRemaining(300); // 5 minutes
      
      toast({
        title: isSpanish ? 'Código enviado' : 'Code Sent',
        description: isSpanish 
          ? 'Se ha enviado un código de verificación a su teléfono'
          : 'A verification code has been sent to your phone',
      });
    } catch (error) {
      toast({
        title: isSpanish ? 'Error' : 'Error',
        description: isSpanish 
          ? 'No se pudo enviar el código. Intente nuevamente.'
          : 'Could not send code. Please try again.',
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
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

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: isSpanish ? 'Código requerido' : 'Code Required',
        description: isSpanish 
          ? 'Por favor ingrese el código de verificación'
          : 'Please enter the verification code',
        variant: "destructive"
      });
      return;
    }

    if (attempts >= maxAttempts) {
      toast({
        title: isSpanish ? 'Demasiados intentos' : 'Too Many Attempts',
        description: isSpanish 
          ? 'Ha excedido el número máximo de intentos. Solicite un nuevo código.'
          : 'You have exceeded the maximum number of attempts. Please request a new code.',
        variant: "destructive"
      });
      return;
    }

    // Check screenshot requirement
    if (isScreenshotRequired && !screenshot) {
      toast({
        title: isSpanish ? 'Captura requerida' : 'Screenshot Required',
        description: isSpanish 
          ? 'Por favor tome una captura de la llamada activa o seleccione una razón para omitir'
          : 'Please take a screenshot of the active call or select a reason to skip',
        variant: "destructive"
      });
      return;
    }

    try {
      setIsVerifying(true);
      
      // Simulate verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, accept any 6-digit code
      if (verificationCode.length === 6) {
        toast({
          title: isSpanish ? 'Verificación exitosa' : 'Verification Successful',
          description: isSpanish 
            ? 'Su teléfono ha sido verificado correctamente'
            : 'Your phone has been successfully verified',
        });
        
        onVerificationComplete();
      } else {
        throw new Error('Invalid code');
      }
    } catch (error) {
      setAttempts(prev => prev + 1);
      toast({
        title: isSpanish ? 'Código inválido' : 'Invalid Code',
        description: isSpanish 
          ? `Código incorrecto. Intentos restantes: ${maxAttempts - attempts - 1}`
          : `Incorrect code. Attempts remaining: ${maxAttempts - attempts - 1}`,
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = () => {
    setVerificationCode('');
    setAttempts(0);
    handleSendCode();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-green-600" />
            <span>
              {isSpanish ? 'Paso 2: Verificación Móvil (Llamada de Conferencia)' : 'Step 2: Mobile Verification (Conference Call)'}
            </span>
          </CardTitle>
          <p className="text-gray-600">
            {isSpanish 
              ? `Verifique su teléfono para ${clientName}`
              : `Verify your phone for ${clientName}`
            }
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Conference Call Specific Instructions */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2 flex items-center space-x-2">
              <Phone className="w-4 h-4" />
              <span>
                {isSpanish ? 'Instrucciones de Llamada de Conferencia' : 'Conference Call Instructions'}
              </span>
            </h4>
            <div className="text-green-700 text-sm space-y-2">
              <p>
                {isSpanish 
                  ? '1. Verifique su teléfono móvil para recibir el código de verificación'
                  : '1. Verify your mobile phone to receive the verification code'
                }
              </p>
              <p>
                {isSpanish 
                  ? '2. Una vez verificado, el bot llamará a su teléfono para iniciar la verificación'
                  : '2. Once verified, the bot will call your phone to start the verification'
                }
              </p>
              <p>
                {isSpanish 
                  ? '3. Responda la llamada y siga las instrucciones del bot'
                  : '3. Answer the call and follow the bot\'s instructions'
                }
              </p>
            </div>
          </div>

          {/* Phone Verification */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              {isSpanish ? 'Verificación de Teléfono' : 'Phone Verification'}
            </h3>
            
            {!isCodeSent ? (
              <div className="text-center space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800">
                    {isSpanish 
                      ? 'Haga clic en "Enviar Código" para recibir un código de verificación en su teléfono'
                      : 'Click "Send Code" to receive a verification code on your phone'
                    }
                  </p>
                </div>
                
                <Button
                  onClick={handleSendCode}
                  disabled={isVerifying}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isVerifying 
                    ? (isSpanish ? 'Enviando...' : 'Sending...')
                    : (isSpanish ? 'Enviar Código de Verificación' : 'Send Verification Code')
                  }
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">
                      {isSpanish ? 'Código enviado' : 'Code Sent'}
                    </span>
                  </div>
                  <p className="text-green-700 text-sm">
                    {isSpanish 
                      ? 'Ingrese el código de 6 dígitos que recibió en su teléfono'
                      : 'Enter the 6-digit code you received on your phone'
                    }
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="verificationCode">
                      {isSpanish ? 'Código de Verificación' : 'Verification Code'}
                    </Label>
                    <Input
                      id="verificationCode"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={isSpanish ? '123456' : '123456'}
                      maxLength={6}
                      className="text-center text-lg tracking-widest"
                    />
                  </div>

                  {timeRemaining > 0 && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        {isSpanish 
                          ? `Código expira en ${formatTime(timeRemaining)}`
                          : `Code expires in ${formatTime(timeRemaining)}`
                        }
                      </span>
                    </div>
                  )}

                  {attempts > 0 && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-orange-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        {isSpanish 
                          ? `Intentos: ${attempts}/${maxAttempts}`
                          : `Attempts: ${attempts}/${maxAttempts}`
                        }
                      </span>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleVerifyCode}
                      disabled={isVerifying || verificationCode.length !== 6}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isVerifying 
                        ? (isSpanish ? 'Verificando...' : 'Verifying...')
                        : (isSpanish ? 'Verificar Código' : 'Verify Code')
                      }
                    </Button>
                    
                    <Button
                      onClick={handleResendCode}
                      disabled={timeRemaining > 0}
                      variant="outline"
                    >
                      {isSpanish ? 'Reenviar' : 'Resend'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={onBack}
            >
              {isSpanish ? 'Atrás' : 'Back'}
            </Button>
            
            {isCodeSent && (
              <div className="text-sm text-gray-500">
                {isSpanish 
                  ? 'Complete la verificación para continuar'
                  : 'Complete verification to continue'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
