import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ConferenceClientForm } from "@/components/verification/conference-client-form";
import { ConferenceMobileVerification } from "@/components/verification/conference-mobile-verification";
import { ConferenceCallStep } from "@/components/verification/conference-call-step";
import { ConferenceCompletion } from "@/components/verification/conference-completion";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { VerificationSession, ClientInfo } from "@shared/schema";
import { Phone, Clock, CheckCircle, AlertCircle, Shield } from "lucide-react";

type VerificationStep = 1 | 2 | 3 | 4;

export default function ConferenceVerificationWorkflow() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>(1);
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [showproducerProfile, setShowproducerProfile] = useState(false);
  const { toast } = useToast();

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const goToStep = (step: VerificationStep) => {
    if (!verificationSession && step > 1) {
      toast({
        title: "No Active Session",
        description: "Please start a verification session first.",
        variant: "destructive"
      });
      return;
    }
    setCurrentStep(step);
  };

  const handleClientInfoSubmit = async (clientInfo: ClientInfo) => {
    try {
      // Create verification session
      const response = await fetch('/api/verification/create-conference-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientInfo,
          verificationMethod: 'conference'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const session = await response.json();
      setVerificationSession(session);
      setCurrentStep(2);
      
      toast({
        title: "Session created",
        description: "Proceeding to mobile verification...",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create verification session",
        variant: "destructive"
      });
    }
  };

  const handleMobileVerificationComplete = () => {
    setCurrentStep(3);
    toast({
      title: "Mobile Verified",
      description: "Proceeding to conference call...",
    });
  };

  const handleCallComplete = () => {
    setCurrentStep(4);
    toast({
      title: "Call Completed",
      description: "Proceeding to completion...",
    });
  };

  const handleVerificationComplete = () => {
    toast({
      title: "Verification Complete",
      description: "Conference call verification has been completed successfully!",
    });
    
    // Reset or redirect
    setVerificationSession(null);
    setCurrentStep(1);
  };

  const getStepTitle = (step: VerificationStep) => {
    switch (step) {
      case 1:
        return "Step 1: Client Information";
      case 2:
        return "Step 2: Mobile Verification";
      case 3:
        return "Step 3: Conference Call";
      case 4:
        return "Step 4: Complete Verification";
      default:
        return "";
    }
  };

  const getStepDescription = (step: VerificationStep) => {
    switch (step) {
      case 1:
        return "Enter client information for conference call verification";
      case 2:
        return "Verify your mobile phone to receive the verification call";
      case 3:
        return "The bot will call your phone to complete verification";
      case 4:
        return "Upload evidence and complete the verification process";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Conference Call Verification
          </h1>
          <p className="text-lg text-gray-600">
            Complete verification through direct phone call
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {currentStep} of {totalSteps}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <ProgressBar value={progress} className="h-2" />
        </div>

        {/* Step Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  step === currentStep
                    ? 'bg-green-100 text-green-800'
                    : step < currentStep
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
                onClick={() => goToStep(step as VerificationStep)}
              >
                {step < currentStep ? (
                  <CheckCircle className="w-5 h-5" />
                ) : step === currentStep ? (
                  <div className="w-5 h-5 rounded-full bg-green-600 animate-pulse" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-400" />
                )}
                <span className="font-medium">Step {step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {/* Step 1: Client Information */}
          {currentStep === 1 && (
            <ConferenceClientForm
              onClientInfoSubmit={handleClientInfoSubmit}
              onBack={() => window.history.back()}
            />
          )}

          {/* Step 2: Mobile Verification */}
          {currentStep === 2 && verificationSession && (
            <ConferenceMobileVerification
              sessionId={verificationSession.id}
              clientName={`${verificationSession.clientInfo.firstName} ${verificationSession.clientInfo.lastName}`}
              onVerificationComplete={handleMobileVerificationComplete}
              onBack={() => goToStep(1)}
            />
          )}

          {/* Step 3: Conference Call */}
          {currentStep === 3 && verificationSession && (
            <ConferenceCallStep
              session={verificationSession}
              onCallComplete={handleCallComplete}
              onBack={() => goToStep(2)}
            />
          )}

          {/* Step 4: Completion */}
          {currentStep === 4 && verificationSession && (
            <ConferenceCompletion
              session={verificationSession}
              onComplete={handleVerificationComplete}
              onBack={() => goToStep(3)}
            />
          )}
        </div>

        {/* Producer Profile Modal */}
        {showproducerProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Producer Profile</h3>
              <p className="text-gray-600 mb-4">
                Producer Profile information would go here
              </p>
              <Button onClick={() => setShowproducerProfile(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

