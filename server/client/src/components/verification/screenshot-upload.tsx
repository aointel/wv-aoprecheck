import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type VerificationMethod = 'zoom' | 'phone' | 'whatsapp' | 'facetime';

interface ScreenshotUploadProps {
  method: VerificationMethod;
  sessionId: string;
  onScreenshotUpload: (file: File) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function ScreenshotUpload({ method, sessionId, onScreenshotUpload, onBack, onContinue }: ScreenshotUploadProps) {
  const { toast } = useToast();

  // Poll for screenshot status
  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/verification/session/${sessionId}`);
      return response.json();
    },
    refetchInterval: 2000, // Check every 2 seconds
  });

  const hasScreenshot = session?.screenshotPath;

  useEffect(() => {
    if (hasScreenshot) {
      toast({
        title: "Screenshot received!",
        description: "Screenshot uploaded and SMS sent. Moving to next step...",
      });
      // Automatically advance to next step after 2 seconds
      setTimeout(() => {
        onContinue();
      }, 2000);
    }
  }, [hasScreenshot, toast, onContinue]);

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for Screenshot</h1>
          <p className="text-gray-600">Use the QR code from Step 2 to access the verification page on your mobile device and take the screenshot.</p>
        </div>

        {!hasScreenshot ? (
          <div className="text-center space-y-6">
            {/* Waiting State */}
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <Smartphone className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Use Your Mobile Device</h3>
              <p className="text-gray-600 mb-4">
                Go back to Step 2 and scan the QR code or use the verification link on your mobile device to take the screenshot during your call.
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Waiting for screenshot upload...</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h4 className="font-medium text-gray-800 mb-2">Quick reminder:</h4>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Start your {method} call with the client</li>
                <li>2. Open the QR code link on your mobile device</li>
                <li>3. Take a screenshot during the active call</li>
                <li>4. Upload it on the mobile verification page</li>
                <li>5. Return here to continue the workflow</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-green-50 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Screenshot Received!</h3>
              <p className="text-gray-600 mb-2">
                Your verification screenshot has been successfully uploaded via mobile device.
              </p>
              <p className="text-sm text-green-700 font-medium">
                ✓ SMS disclaimer automatically sent to client
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <Button 
            onClick={onBack}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          
          <Button 
            onClick={onContinue}
            disabled={!hasScreenshot}
            className={`flex items-center space-x-2 ${
              hasScreenshot 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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