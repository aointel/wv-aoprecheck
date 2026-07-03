import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Home } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { VerificationSession } from "@shared/schema";

export default function FinalCompletion() {
  const [match, params] = useRoute("/complete/:sessionId");
  const sessionId = params?.sessionId;

  const { data: session, isLoading } = useQuery({
    queryKey: ['/api/verification/session', sessionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/verification/session/${sessionId}`);
      return response.json() as Promise<VerificationSession>;
    },
    enabled: !!sessionId,
  });

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading completion details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Navigation Debug Panel */}
      <div className="bg-yellow-100 border-b border-yellow-300 p-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm">
          <span className="font-medium text-yellow-800">Navigation Debug:</span>
          <div className="flex space-x-2">
            <button 
              onClick={() => window.location.href = '/'}
              className="px-3 py-1 bg-white rounded border text-xs hover:bg-gray-50"
            >
              ← Main
            </button>
            <button 
              onClick={() => window.location.href = `/agent-verify/${sessionId}`}
              className="px-3 py-1 bg-blue-100 rounded border text-xs hover:bg-blue-200"
            >
              Agent URL
            </button>
            <button 
              onClick={() => window.location.href = `/client-verify/${sessionId}`}
              className="px-3 py-1 bg-green-100 rounded border text-xs hover:bg-green-200"
            >
              Client URL
            </button>
            <button 
              onClick={() => window.location.href = `/complete/${sessionId}`}
              className="px-3 py-1 bg-purple-100 rounded border text-xs hover:bg-purple-200 font-medium"
            >
              Complete
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AO</span>
                </div>
                <span className="font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent', 
                  backgroundClip: 'text'
                }}>
                  AO Precheck
                </span>
              </div>
              <div className="hidden md:block h-6 w-px bg-gray-300"></div>
              <span className="hidden md:block text-sm text-gray-600">Verification Complete</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-600 font-medium">Completed</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Verification Complete!</h1>
          <p className="text-lg text-gray-600">
            {session.firstName} {session.lastName}'s insurance verification has been successfully completed.
          </p>
        </div>

        {/* Verification Summary */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Verification Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Client Information</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Name:</strong> {session.firstName} {session.lastName}</div>
                  {session.spouseName && <div><strong>Spouse:</strong> {session.spouseName}</div>}
                  <div><strong>Phone:</strong> {session.phone}</div>
                  <div><strong>Location:</strong> {session.city}, {session.state}</div>
                  <div><strong>Premium:</strong> {session.premium}</div>
                </div>
              </div>

              {/* Verification Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Verification Details</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Method:</strong> {session.verificationMethod?.toUpperCase()}</div>
                  <div><strong>Status:</strong> <span className="text-green-600 font-medium">Completed</span></div>
                  <div><strong>Session ID:</strong> {session.sessionId}</div>
                  <div><strong>Created:</strong> {new Date(session.createdAt).toLocaleString()}</div>
                  {session.completedAt && (
                    <div><strong>Completed:</strong> {new Date(session.completedAt).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Client Compliance Information */}
            {session.clientApprovalStatus === 'approved' && session.clientIpAddress && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Client Compliance Data</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>IP Address:</strong> {session.clientIpAddress}<br/>
                      {session.clientCountry && (
                        <>
                          <strong>Location:</strong> {session.clientCity ? `${session.clientCity}, ` : ''}{session.clientRegion ? `${session.clientRegion}, ` : ''}{session.clientCountry}<br/>
                        </>
                      )}
                      {session.clientTimezone && (
                        <>
                          <strong>Timezone:</strong> {session.clientTimezone}<br/>
                        </>
                      )}
                    </div>
                    <div>
                      {session.clientLatitude && session.clientLongitude && (
                        <>
                          <strong>Coordinates:</strong> {parseFloat(session.clientLatitude).toFixed(4)}, {parseFloat(session.clientLongitude).toFixed(4)}<br/>
                        </>
                      )}
                      {session.clientIsp && (
                        <>
                          <strong>ISP:</strong> {session.clientIsp}<br/>
                        </>
                      )}
                      {session.clientApprovalTime && (
                        <>
                          <strong>Client Approved:</strong> {new Date(session.clientApprovalTime).toLocaleString()}<br/>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => window.print()}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700"
          >
            <Download className="w-4 h-4" />
            <span>Print Summary</span>
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>New Verification</span>
          </Button>
        </div>
      </main>
    </div>
  );
}