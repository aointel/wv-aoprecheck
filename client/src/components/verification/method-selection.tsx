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
    badge: "Recommended",
    badgeColor: "bg-blue-100 text-blue-600",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  phone: {
    icon: Phone,
    title: "Phone Call",
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  whatsapp: {
    icon: MessageCircle,
    title: "WhatsApp Call",
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
  },
  facetime: {
    icon: Video,
    title: "FaceTime",
    iconColor: "text-gray-600",
    bgColor: "bg-gray-100",
  },
};

export function MethodSelection({ selectedMethod, onMethodSelect, onBack, onContinue }: MethodSelectionProps) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Verification Method</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 mb-8">
          {Object.entries(methodConfig).map(([method, config]) => {
            const Icon = config.icon;
            const isSelected = selectedMethod === method;
            
            return (
              <div
                key={method}
                className={`verification-method border-2 rounded-lg p-6 min-h-[140px] cursor-pointer transition-colors duration-200 ${
                  isSelected ? 'verification-method-selected' : 'border-gray-200 hover:border-purple-300'
                }`}
                data-testid={`card-method-${method}`}
                onClick={() => onMethodSelect(method as VerificationMethod)}
              >
                <div className="flex items-center space-x-4 h-full">
                  <div className={`w-12 h-12 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`${config.iconColor} text-xl w-6 h-6`} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900">{config.title}</h3>
                    {config.badge && (
                      <Badge className={`text-xs ${config.badgeColor}`}>
                        {config.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
