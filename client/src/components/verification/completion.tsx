import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, RotateCcw } from "lucide-react";
import type { VerificationSession } from "@shared/schema";

interface CompletionProps {
  session: VerificationSession;
  onStartNew: () => void;
}

export function Completion({ session, onStartNew }: CompletionProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const handleDownloadReport = () => {
    // In a real implementation, this would generate and download a PDF report
    alert('Report download functionality would be implemented here');
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6 md:p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600 w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Complete</h1>
          <p className="text-gray-600">The policy verification has been successfully completed and submitted.</p>
        </div>

        {/* Verification Results */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-green-50 rounded-lg p-6 mb-4">
            <h3 className="font-medium text-green-800 mb-3">Verification Results</h3>
            <div className="space-y-2 text-sm text-green-700">
              <div className="flex justify-between">
                <span>Client Verified:</span>
                <span className="font-medium">✓ Passed</span>
              </div>
              <div className="flex justify-between">
                <span>Policy Valid:</span>
                <span className="font-medium">✓ Confirmed</span>
              </div>
              <div className="flex justify-between">
                <span>Compliance:</span>
                <span className="font-medium">✓ Recorded</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">
              Session ID: <span className="font-mono text-gray-800">{session.sessionId}</span>
            </p>
            <p className="text-sm text-gray-600">
              Timestamp: <span className="text-gray-800">{currentDate} at {currentTime}</span>
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Client:</p>
              <p className="text-sm font-medium text-gray-800">
                {session.firstName} {session.lastName}
                {session.spouseName && ` & ${session.spouseName}`}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {session.city}, {session.state} • {session.phone}
              </p>
              <p className="text-sm text-gray-600">Premium: {session.premium}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={onStartNew}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Start New Verification</span>
          </Button>
          <div>
            <Button
              variant="ghost"
              onClick={handleDownloadReport}
              className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Report</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
