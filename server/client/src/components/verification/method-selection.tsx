import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Video, Phone, MessageCircle } from "lucide-react";

type VerificationMethod = 'zoom' | 'phone' | 'whatsapp' | 'facetime';

interface MethodSelectionProps {
  selectedMethod: VerificationMethod | null;
  onMethodSelect: (method: VerificationMethod) => void;
  onBack: () => void;
  onContinue: () => void;
}

const methodConfig = {
  zoom: {
    icon: Video,
    title: "Zoom Meeting",
    description: "AI agent joins your Zoom room",
    badge: "Recommended",
    badgeColor: "bg-blue-100 text-blue-600",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  phone: {
    icon: Phone,
    title: "Phone Call",
    description: "Speakerphone verification",
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  whatsapp: {
    icon: MessageCircle,
    title: "WhatsApp Call",
    description: "Voice verification via WhatsApp",
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  facetime: {
    icon: Video,
    title: "FaceTime",
    description: "Audio verification via FaceTime",
    iconColor: "text-gray-600",
    bgColor: "bg-gray-100",
  },
};

const methodInstructions = {
  zoom: [
    "Start your Zoom meeting with the client",
    "Have your Zoom meeting ID and passcode ready", 
    "Our AI agent will join automatically when verification begins"
  ],
  phone: [
    "Start a speakerphone call with your client",
    "Ensure both you and client can hear clearly",
    "Our AI agent will join the call automatically"
  ],
  whatsapp: [
    "Start a WhatsApp voice call with your client",
    "Put the call on speaker for verification",
    "Our AI agent will conduct voice verification"
  ],
  facetime: [
    "Start a FaceTime audio call with your client",
    "Enable speaker mode for verification",
    "Our AI agent will join for voice verification"
  ],
};

export function MethodSelection({ selectedMethod, onMethodSelect, onBack, onContinue }: MethodSelectionProps) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Verification Method</h1>
          <p className="text-gray-600">Choose how you'll conduct the verification call with your client.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {Object.entries(methodConfig).map(([method, config]) => {
            const Icon = config.icon;
            const isSelected = selectedMethod === method;
            
            return (
              <div
                key={method}
                className={`verification-method border-2 rounded-lg p-6 cursor-pointer transition-colors duration-200 ${
                  isSelected ? 'verification-method-selected' : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => onMethodSelect(method as VerificationMethod)}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`${config.iconColor} text-xl w-6 h-6`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{config.title}</h3>
                    <p className="text-sm text-gray-600">{config.description}</p>
                    {config.badge && (
                      <Badge className={`text-xs ${config.badgeColor} mt-1`}>
                        {config.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Method Specific Instructions */}
        {selectedMethod && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Next Steps</h3>
            <div className="space-y-2">
              {methodInstructions[selectedMethod].map((instruction, index) => (
                <p key={index} className="text-sm text-gray-700">
                  {index + 1}. {instruction}
                </p>
              ))}
            </div>
          </div>
        )}

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
            disabled={!selectedMethod}
            className={`bg-purple-600 hover:bg-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
              !selectedMethod ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
