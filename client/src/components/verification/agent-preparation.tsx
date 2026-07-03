import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Users, Bot, CheckCircle, AlertTriangle } from "lucide-react";
import type { VerificationSession } from "@shared/schema";

interface producerPreparationProps {
  session: VerificationSession;
  onBack: () => void;
  onContinue: () => void;
}

const preparationSteps = [
  {
    title: "Set Up Your Call",
    items: [
      "Start your verification call with the client",
      "Ensure both parties can hear clearly",
      "Have client information readily available",
      "Confirm client identity before proceeding"
    ]
  },
  {
    title: "Brief Your Client",
    items: [
      "Explain that an AI producer will join the call",
      "Tell them to give short, clear answers (yes/no preferred)",
      "Mention the call will be recorded for compliance",
      "Assure them this is a standard verification process"
    ]
  },
  {
    title: "AI Interaction Guidelines",
    items: [
      "Let the AI lead the verification questions",
      "Only intervene if there are technical issues",
      "Help clarify if the client doesn't understand",
      "Stay professional throughout the process"
    ]
  }
];

const dosDonts = {
  dos: [
    "Give short, direct answers",
    "Speak clearly and wait for questions",
    "Confirm policy details when asked",
    "Stay on the line throughout verification"
  ],
  donts: [
    "Don't coach or prompt the client",
    "Don't interrupt the AI producer",
    "Don't discuss policy changes during verification",
    "Don't end the call until verification is complete"
  ]
};

export function producerPreparation({ session, onBack, onContinue }: producerPreparationProps) {
  const methodName = session.verificationMethod?.toUpperCase() || 'CALL';

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Prepare for AI Verification</h1>
          <p className="text-gray-600">
            Review these guidelines to ensure a smooth verification process with your client.
          </p>
          <div className="mt-3">
            <Badge variant="secondary" className="bg-purple-100 text-purple-600">
              Method: {methodName}
            </Badge>
          </div>
        </div>

        {/* Preparation Steps */}
        <div className="space-y-6 mb-8">
          {preparationSteps.map((step, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm mr-3">
                  {index + 1}
                </div>
                <h3 className="font-medium text-gray-900">{step.title}</h3>
              </div>
              <ul className="space-y-1 ml-11">
                {step.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm text-gray-700 flex items-start">
                    <span className="text-purple-600 mr-2 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Client Coaching Guidelines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="font-medium text-green-800 mb-3 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Coach Your Client To:
            </h3>
            <ul className="space-y-2">
              {dosDonts.dos.map((item, index) => (
                <li key={index} className="text-sm text-green-700 flex items-start">
                  <span className="text-green-600 mr-2 mt-1">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-red-50 rounded-lg p-6">
            <h3 className="font-medium text-red-800 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Important: Avoid These:
            </h3>
            <ul className="space-y-2">
              {dosDonts.donts.map((item, index) => (
                <li key={index} className="text-sm text-red-700 flex items-start">
                  <span className="text-red-600 mr-2 mt-1">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* AI producer Information */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-3">
            <Bot className="w-6 h-6 text-blue-600 mr-3" />
            <h3 className="font-medium text-blue-800">About the AI producer</h3>
          </div>
          <div className="text-sm text-blue-700 space-y-2">
            <p>• The AI will introduce itself and explain the verification process</p>
            <p>• It will ask standard questions about policy details and client identity</p>
            <p>• The entire process typically takes 3-5 minutes</p>
            <p>• All interactions are recorded for compliance and quality assurance</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-purple-50 rounded-lg p-4 mb-6 text-center">
          <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <p className="text-sm text-purple-800 font-medium">
            Ready to begin? Make sure your client is prepared and can hear clearly.
          </p>
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800 font-medium flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          <Button
            onClick={onContinue}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <span>Begin AI Verification</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}