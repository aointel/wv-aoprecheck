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

export default function ClientVerificationSpanish() {
  const [match, params] = useRoute("/client-verify-es/:sessionId");
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

  // Disclaimer approval mutation
  const disclaimerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/verification/session/${sessionId}/approve`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Aprobación falló');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Aviso legal aprobado",
        description: "Gracias por aprobar el aviso legal de verificación.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Aprobación falló",
        description: error.message || "No se pudo aprobar el aviso legal",
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
            <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace de Cliente Inválido</h1>
            <p className="text-gray-600">Este enlace de verificación de cliente no es válido o ha expirado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando verificación del cliente...</p>
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
            <h1 className="text-xl font-bold text-gray-900 mb-2">Sesión No Encontrada</h1>
            <p className="text-gray-600">No se pudo encontrar su sesión de verificación.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AO Precheck</h1>
          <p className="text-lg text-gray-600">Verificación de Póliza de Seguro</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            {/* Client Info */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Hola {session.firstName} {session.lastName}
              </h2>
              <p className="text-gray-600">
                Su agente necesita su aprobación para continuar con la verificación de su póliza.
              </p>
            </div>

            {/* Policy Details */}
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-4">Detalles de su Póliza</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Nombre:</span>
                  <span className="font-medium text-blue-900">
                    {session.firstName} {session.lastName}
                    {session.spouseName && ` y ${session.spouseName}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Teléfono:</span>
                  <span className="font-medium text-blue-900">{session.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Ubicación:</span>
                  <span className="font-medium text-blue-900">{session.city}, {session.state}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Prima Mensual:</span>
                  <span className="font-medium text-blue-900">${session.premium}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Método de Verificación:</span>
                  <span className="font-medium text-blue-900">
                    {session.verificationMethod === 'zoom' && 'Zoom'}
                    {session.verificationMethod === 'phone' && 'Teléfono'}
                    {session.verificationMethod === 'whatsapp' && 'WhatsApp'}
                    {session.verificationMethod === 'facetime' && 'FaceTime'}
                  </span>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-yellow-800 mb-3">
                📋 Aviso Legal de Verificación
              </h3>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>
                  <strong>Al aprobar este aviso legal, usted confirma que:</strong>
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Es el titular de la póliza mencionada arriba</li>
                  <li>Autoriza a su agente a verificar los detalles de su póliza</li>
                  <li>Comprende que esta verificación es para propósitos de cumplimiento</li>
                  <li>Acepta participar en la llamada de verificación programada</li>
                  <li>Su información será manejada de manera segura y confidencial</li>
                </ul>
                <p className="font-medium">
                  Su agente procederá con la verificación una vez que apruebe este aviso.
                </p>
              </div>
            </div>

            {/* Approval Status */}
            {session.clientApprovalStatus === 'approved' ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 mb-2">✅ Aviso Legal Aprobado</h3>
                <p className="text-green-700 text-sm">
                  Gracias por aprobar el aviso legal. Su agente puede proceder con la verificación.
                </p>
                <Badge variant="secondary" className="mt-3 bg-green-100 text-green-800">
                  Aprobado el {session.clientApprovalTime ? new Date(session.clientApprovalTime).toLocaleString('es-ES') : ''}
                </Badge>
              </div>
            ) : (
              <div className="text-center">
                <Button
                  onClick={handleDisclaimerApproval}
                  disabled={disclaimerMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-lg"
                  size="lg"
                >
                  {disclaimerMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Aprobar Aviso Legal de Verificación
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-gray-500 mt-3">
                  Al hacer clic en "Aprobar", usted acepta los términos mencionados arriba
                </p>
              </div>
            )}

            {/* Security Notice */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center text-xs text-gray-500">
                <Shield className="w-4 h-4 mr-1" />
                <span>Protegido por AO Precheck • Verificación Segura</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}