import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, QrCode, MessageSquare, Smartphone, Camera, Copy, Check } from "lucide-react";
import QRCode from "qrcode";
import type { VerificationSession } from "@shared/schema";

interface QRCodeDisplayProps {
  session: VerificationSession;
  onBack: () => void;
  onContinue: () => void;
}

export function QRCodeDisplay({ session, onBack, onContinue }: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  
  if (!session || !session.sessionId) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
        <CardContent className="p-6 md:p-8">
          <div className="text-center">
            <p className="text-gray-600">Loading verification session...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const verificationUrl = session.sessionId 
    ? `${window.location.origin}/verify/${session.sessionId}`
    : '';

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        if (verificationUrl) {
          const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeUrl(qrDataUrl);
        }
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQRCode();
  }, [verificationUrl]);

  const handleSendSMS = () => {
    // In a real implementation, this would trigger an SMS API call
    alert(`SMS sent to ${session.phone}`);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Share Verification Link with Client</h1>
          <p className="text-gray-600">
            Use YOUR CELL PHONE to send this link to your client. They will receive {session.verificationMethod} verification instructions.
          </p>
          <div className="mt-3">
            <Badge variant="secondary" className="bg-purple-100 text-purple-600">
              Method: {session.verificationMethod?.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Step-by-Step Instructions for producers */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-6">
          <div className="flex items-center mb-3">
            <Smartphone className="w-6 h-6 text-yellow-600 mr-2" />
            <h3 className="font-bold text-yellow-800">IMPORTANT: Use Your Cell Phone</h3>
          </div>
          <div className="space-y-3 text-sm text-yellow-700">
            <p className="font-medium">Step 1: Get your phone ready</p>
            <p className="font-medium">Step 2: Choose ONE option below to send the link</p>
            <p className="font-medium">Step 3: Wait for client to complete their part</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code Section */}
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="text-center mb-4">
              <div className="w-64 h-64 mx-auto bg-white rounded-lg shadow-sm flex items-center justify-center border-2">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" className="w-full h-full rounded-lg" />
                ) : (
                  <div className="text-center">
                    <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Generating QR Code...</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-blue-100 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-blue-800 mb-2 flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Option 1: Show QR Code to Client
              </h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>1. Hold your phone up to your computer screen</p>
                <p>2. Open your phone's camera app</p>
                <p>3. Point camera at the QR code above</p>
                <p>4. Tell client to tap the link that appears</p>
              </div>
            </div>
          </div>

          {/* SMS/Text Section */}
          <div className="bg-green-50 rounded-lg p-6">
            <div className="bg-green-100 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-green-800 mb-2 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Option 2: Text the Link to Client
              </h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>1. Copy the link below</p>
                <p>2. Open your text messaging app</p>
                <p>3. Send to: {session.phone}</p>
                <p>4. Tell client to tap the link</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-xs text-gray-500 mb-2">Link to copy and send:</p>
                <div className="text-sm text-gray-700 font-mono break-all bg-gray-50 p-2 rounded">
                  {verificationUrl}
                </div>
              </div>
              
              <Button
                onClick={copyToClipboard}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors duration-200"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link to Send via Text
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Final Instructions */}
        <div className="bg-purple-50 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-purple-800 mb-2">After you send the link:</h4>
          <div className="text-sm text-purple-700 space-y-1">
            <p>• Your client will see instructions for taking their verification screenshot</p>
            <p>• Wait for them to complete the upload before clicking "Continue" below</p>
            <p>• The next step will prepare you for the AI verification call</p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-8">
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
            <span>Client Connected</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
