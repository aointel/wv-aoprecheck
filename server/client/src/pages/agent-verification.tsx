import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import type { VerificationSession } from "@shared/schema";

export default function AgentVerification() {
  const [match, params] = useRoute("/agent-verify/:sessionId");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const sessionId = params?.sessionId;

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/verification/session/${sessionId}`);
      return response.json() as Promise<VerificationSession>;
    },
    enabled: !!sessionId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('screenshot', file);
      
      const response = await fetch(`/api/verification/session/${sessionId}/screenshot`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Screenshot uploaded successfully",
        description: "Your verification screenshot has been submitted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload screenshot",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    uploadMutation.mutate(file);
  };

  if (!sessionId || !match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Agent Link</h1>
            <p className="text-gray-600">This agent verification link is not valid or has expired.</p>
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
          <p className="text-gray-600">Loading verification session...</p>
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
            <h1 className="text-xl font-bold text-gray-900 mb-2">Session Not Found</h1>
            <p className="text-gray-600">This verification session could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInstructions = () => {
    switch (session.verificationMethod) {
      case 'zoom':
        return {
          title: "Zoom Meeting Screenshot - Agent Instructions",
          steps: [
            "During your active Zoom call with the client, take a screenshot",
            "Make sure the gallery view shows both you and the client clearly",
            "Take a screenshot on your device (iPhone: Side + Volume Up, Android: Power + Volume Down)",
            "Upload the screenshot below to verify the call took place",
            "Once uploaded, you can proceed to the next step in your workflow"
          ],
          needsSpeakerPhone: false
        };
      case 'phone':
        return {
          title: "Phone Call Screenshot - Agent Instructions", 
          steps: [
            "During your active phone call with the client, take a screenshot of your phone screen",
            "Screenshot should show the call is active with client's name/number",
            "Make sure call duration and contact info are visible",
            "Take screenshot on your phone (iPhone: Side + Volume Up, Android: Power + Volume Down)",
            "Upload the screenshot below to verify the call took place"
          ],
          needsSpeakerPhone: false
        };
      case 'whatsapp':
        return {
          title: "WhatsApp Call Screenshot - Agent Instructions",
          steps: [
            "During your active WhatsApp call with the client, take a screenshot of WhatsApp",
            "Screenshot should show the WhatsApp call is active with client's name",
            "Make sure call duration and contact info are visible", 
            "Take screenshot on your phone (iPhone: Side + Volume Up, Android: Power + Volume Down)",
            "Upload the screenshot below to verify the WhatsApp call took place"
          ],
          needsSpeakerPhone: false
        };
      case 'facetime':
        return {
          title: "FaceTime Call Screenshot - Agent Instructions",
          steps: [
            "During your active FaceTime call with the client, take a screenshot of FaceTime",
            "Screenshot should show both you and the client in the FaceTime call",
            "Make sure call duration is visible and both participants are shown",
            "Take screenshot on your phone (iPhone: Side + Volume Up, Android: Power + Volume Down)",
            "Upload the screenshot below to verify the FaceTime call took place"
          ],
          needsSpeakerPhone: false
        };
      default:
        return { title: "Verification Screenshot", steps: [], needsSpeakerPhone: false };
    }
  };

  const instructions = getInstructions();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AO</span>
                </div>
                <span className="font-semibold text-gray-900">AO Precheck</span>
              </div>
              <div className="hidden md:block h-6 w-px bg-gray-300"></div>
              <span className="hidden md:block text-sm text-gray-600">Agent Mobile Screenshot</span>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-600">
              Agent Access
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardContent className="p-6 md:p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Agent Screenshot Upload
              </h1>
              <p className="text-gray-600">
                Take a screenshot during your verification call with {session.firstName}.
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="font-medium text-blue-600 mb-3">{instructions.title}</h3>
              
              <div className="space-y-2">
                {instructions.steps.map((step, index) => (
                  <p key={index} className="text-sm text-gray-700">
                    {index + 1}. {step}
                  </p>
                ))}
              </div>
            </div>

            {/* Upload Interface */}
            <div className="space-y-4">
              {!uploadedFile && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      📱 Upload your {session.verificationMethod} screenshot below
                    </p>
                  </div>
                  
                  {/* Primary Upload Option */}
                  <div className="text-center mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">Upload Screenshot</h4>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                      <p className="text-xs font-medium text-gray-700 mb-2">How to take a screenshot:</p>
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <span className="text-xs text-blue-600 font-medium">📱 iPhone:</span>
                          <span className="text-xs text-gray-600">Press Side Button + Volume Up at the same time</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-xs text-green-600 font-medium">🤖 Android:</span>
                          <span className="text-xs text-gray-600">Press Power Button + Volume Down at the same time</span>
                        </div>
                      </div>
                    </div>
                    <FileUpload
                      onFileSelect={handleFileUpload}
                      accept="image/*"
                      maxSize={10 * 1024 * 1024}
                      className="border-2 border-dashed border-blue-300 rounded-lg p-6 hover:border-blue-500 transition-colors cursor-pointer bg-blue-50"
                    >
                      <Upload className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900">Choose Image File</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </FileUpload>
                  </div>
                </div>
              )}

              {/* Upload Success */}
              {uploadedFile && (
                <div className="text-center space-y-4 bg-green-50 rounded-lg p-6 border border-green-200">
                  <div className="flex items-center justify-center text-green-600">
                    <CheckCircle className="w-8 h-8 mr-3" />
                    <span className="font-medium">Screenshot Uploaded Successfully!</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    File: {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
                  </p>
                  <p className="text-sm text-green-700 font-medium">
                    ✅ You can now proceed to the next step in your verification workflow.
                  </p>
                </div>
              )}

              {/* Loading State */}
              {uploadMutation.isPending && (
                <div className="text-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Uploading screenshot...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}