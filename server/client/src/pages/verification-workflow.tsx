import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClientForm } from "@/components/verification/client-form";
import { UnifiedVerification } from "@/components/verification/unified-verification";
import { VerificationProgress } from "@/components/verification/verification-progress";
import { ZoomVerificationStep } from "@/components/verification/zoom-verification-step";
import { EnterpriseCertificate } from "@/components/verification/enterprise-certificate";
import { AgentProfile } from "@/components/agent/agent-profile";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { VerificationSession, ClientInfo } from "@shared/schema";

type VerificationStep = 1 | 2 | 3 | 4;
type VerificationMethod = 'zoom' | 'phone' | 'whatsapp' | 'facetime';

export default function VerificationWorkflow() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>(1);
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [uploadedScreenshot, setUploadedScreenshot] = useState<File | null>(null);
  const [showAgentProfile, setShowAgentProfile] = useState(false);
  const { toast } = useToast();

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const goToStep = (step: VerificationStep) => {
    setCurrentStep(step);
  };

  const handleClientInfoSubmit = async (session: VerificationSession) => {
    setVerificationSession(session);
    setCurrentStep(2);
    
    toast({
      title: "Ready for verification",
      description: "Use your mobile device to take the screenshot during your call.",
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

  const handleVerificationComplete = () => {
    toast({
      title: "Verification completed",
      description: "The policy verification has been successfully completed.",
    });
  };

  const startNewVerification = () => {
    setCurrentStep(1);
    setVerificationSession(null);
    setUploadedScreenshot(null);
    toast({
      title: "Ready for new verification",
      description: "Starting a new verification session.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-md">
                <div className="w-6 h-6 bg-white bg-opacity-20 rounded flex items-center justify-center mr-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <span className="font-bold text-sm">AO Precheck</span>
              </div>

            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setShowAgentProfile(true)}
                className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full flex items-center justify-center p-0 hover:from-blue-700 hover:to-indigo-800 shadow-md"
              >
                <span className="text-white font-medium text-sm">M</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <ProgressBar progress={progress} />
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
          />
        )}

        {currentStep === 3 && verificationSession && (
          verificationSession.verificationMethod === 'zoom' ? (
            <ZoomVerificationStep
              sessionId={verificationSession.sessionId}
              onComplete={() => {
                handleVerificationComplete();
                goToStep(4);
              }}
              onBack={() => goToStep(2)}
            />
          ) : (
            <VerificationProgress
              sessionId={verificationSession.sessionId}
              onComplete={() => {
                handleVerificationComplete();
                goToStep(4);
              }}
              onBack={() => goToStep(2)}
            />
          )
        )}

        {currentStep === 4 && verificationSession && (
          <EnterpriseCertificate
            session={verificationSession}
            onStartNew={startNewVerification}
            onBack={() => goToStep(3)}
          />
        )}
      </main>

      {/* Agent Profile Modal */}
      {showAgentProfile && (
        <AgentProfile onClose={() => setShowAgentProfile(false)} />
      )}
    </div>
  );
}
