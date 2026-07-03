import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { VerificationSession } from "@shared/schema";

const clientTranslations = {
  en: {
    invalidLink: "Invalid Client Link",
    invalidLinkDesc: "This client verification link is invalid or has expired.",
    sessionNotFound: "Session Not Found",
    sessionNotFoundDesc: "Could not find your verification session.",
    loading: "Loading client verification...",
    hello: "Hello",
    approvalNeeded: "Your agent needs your approval to continue with your policy verification.",
    policyDetails: "Your Policy Details",
    name: "Name:",
    phone: "Phone:",
    location: "Location:",
    monthlyPremium: "Monthly Premium:",
    verificationMethod: "Verification Method:",
    disclaimer: "📋 Verification Disclaimer",
    disclaimerText: "By approving this disclaimer, you confirm that:",
    disclaimerPoints: [
      "You are the policy holder mentioned above",
      "You authorize your agent to verify your policy details",
      "You understand this verification is for compliance purposes",
      "You agree to participate in the scheduled verification call",
      "Your information will be handled securely and confidentially"
    ],
    disclaimerNote: "Your agent will proceed with verification once you approve this disclaimer.",
    disclaimerApproved: "✅ Disclaimer Approved",
    approvedThankYou: "Thank you for approving the disclaimer. Your agent can proceed with verification.",
    approvedOn: "Approved on",
    approveDisclaimer: "Approve Verification Disclaimer",
    processing: "Processing...",
    approveNote: "By clicking \"Approve\", you agree to the terms mentioned above",
    securedBy: "Secured by AO Precheck • Secure Verification",
    approvalFailed: "Approval failed",
    disclaimerApproved_title: "Disclaimer approved",
    approvalFailedDesc: "Failed to approve disclaimer",
    disclaimerApprovedDesc: "Thank you for approving the verification disclaimer.",
    instruction: "Ready to Proceed",
    action: "Click approve to continue with verification.",
    button: "I Agree and Approve"
  },
  es: {
    invalidLink: "Enlace de Cliente Inválido",
    invalidLinkDesc: "Este enlace de verificación de cliente no es válido o ha expirado.",
    sessionNotFound: "Sesión No Encontrada",
    sessionNotFoundDesc: "No se pudo encontrar su sesión de verificación.",
    loading: "Cargando verificación del cliente...",
    hello: "Hola",
    approvalNeeded: "Su agente necesita su aprobación para continuar con la verificación de su póliza.",
    policyDetails: "Detalles de su Póliza",
    name: "Nombre:",
    phone: "Teléfono:",
    location: "Ubicación:",
    monthlyPremium: "Prima Mensual:",
    verificationMethod: "Método de Verificación:",
    disclaimer: "📋 Aviso Legal de Verificación",
    disclaimerText: "Al aprobar este aviso legal, usted confirma que:",
    disclaimerPoints: [
      "Usted es el titular de la póliza mencionada arriba",
      "Autoriza a su agente a verificar los detalles de su póliza",
      "Comprende que esta verificación es para propósitos de cumplimiento",
      "Acepta participar en la llamada de verificación programada",
      "Su información será manejada de manera segura y confidencial"
    ],
    disclaimerNote: "Su agente procederá con la verificación una vez que apruebe este aviso.",
    disclaimerApproved: "✅ Aviso Legal Aprobado",
    approvedThankYou: "Gracias por aprobar el aviso legal. Su agente puede proceder con la verificación.",
    approvedOn: "Aprobado el",
    approveDisclaimer: "Aprobar Aviso Legal de Verificación",
    processing: "Procesando...",
    approveNote: "Al hacer clic en \"Aprobar\", usted acepta los términos mencionados arriba",
    securedBy: "Protegido por AO Precheck • Verificación Segura",
    approvalFailed: "Aprobación falló",
    disclaimerApproved_title: "Aviso legal aprobado",
    approvalFailedDesc: "No se pudo aprobar el aviso legal",
    disclaimerApprovedDesc: "Gracias por aprobar el aviso legal de verificación.",
    instruction: "Listo para Proceder",
    action: "Haga clic en aprobar para continuar con la verificación.",
    button: "Acepto y Apruebo"
  }
};

export default function ClientVerification() {
  const [match, params] = useRoute("/client-verify/:sessionId");
  const { toast } = useToast();

  const sessionId = params?.sessionId;

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      // First, capture the client's IP address automatically when they visit
      try {
        await fetch(`/api/verification/session/${sessionId}/capture-client-ip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('Client IP captured successfully');
      } catch (error) {
        console.warn('Failed to capture client IP:', error);
      }

      const response = await apiRequest("GET", `/api/verification/session/${sessionId}`);
      return response.json() as Promise<VerificationSession>;
    },
    enabled: !!sessionId,
  });

  // Get language from session, default to English
  const language = (session?.language || 'en') as 'en' | 'es';
  const t = clientTranslations[language];

  // Disclaimer approval mutation
  const disclaimerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/verification/session/${sessionId}/approve`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Approval failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t.disclaimerApproved_title,
        description: t.disclaimerApprovedDesc,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.approvalFailed,
        description: error.message || t.approvalFailedDesc,
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
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t.invalidLink}</h1>
            <p className="text-gray-600">{t.invalidLinkDesc}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t.sessionNotFound}</h1>
            <p className="text-gray-600">{t.sessionNotFoundDesc}</p>
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
              <span className="hidden md:block text-sm text-gray-600">Client Verification</span>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-600">
              Client Access
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
                {t.hello} {session.firstName}, {t.approvalNeeded}
              </p>
            </div>

            {/* Simple Approval Section */}
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="text-center">
                  <h4 className="font-medium text-gray-900 mb-4">{t.instruction || "Ready to Proceed"}</h4>
                  <p className="text-sm text-gray-700">
                    {t.action || "Click approve to continue with verification."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {session.clientApprovalStatus === 'approved' ? (
                  <div className="text-center bg-green-50 rounded-lg p-6 border border-green-200">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                    <h4 className="font-medium text-green-700 mb-2">{t.disclaimerApproved}</h4>
                    <p className="text-sm text-green-600">
                      {t.approvedThankYou}
                    </p>
                    {session.clientApprovalTime && (
                      <p className="text-xs text-gray-500 mt-2">
                        {t.approvedOn} {new Date(session.clientApprovalTime).toLocaleString()}
                      </p>
                    )}
                    {session.clientIpAddress && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <p className="text-xs text-gray-500">
                          Verification completed from: {session.clientCountry}, {session.clientRegion}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <Button
                      onClick={handleDisclaimerApproval}
                      disabled={disclaimerMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium"
                    >
                      {disclaimerMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          {t.button}
                        </>
                      )}
                    </Button>
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