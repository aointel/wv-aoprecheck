import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface GoogleCalendarStatus {
  success: boolean;
  configured: boolean;
  details: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    redirectUri: string;
    setupInstructions: {
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      step5: string;
      step6: string;
    };
  };
}

export default function GoogleCalendarSetupPage() {
  const [location, setLocation] = useLocation();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [authUrl, setAuthUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const success = urlParams.get('success');

  useEffect(() => {
    checkGoogleCalendarStatus();
  }, []);

  const checkGoogleCalendarStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/google-calendar/config-status');
      const data = await response.json();
      setStatus(data);
      
      if (data.success && !data.configured) {
        // Get auth URL for setup
        const authResponse = await fetch('/api/google-calendar/auth-url');
        const authData = await authResponse.json();
        if (authData.success) {
          setAuthUrl(authData.authUrl);
        }
      }
    } catch (error) {
      console.error('Failed to check Google Calendar status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorize = async () => {
    if (!authUrl) return;
    
    setIsAuthorizing(true);
    try {
      // Open Google OAuth in new window
      const authWindow = window.open(authUrl, 'google-oauth', 'width=500,height=600');
      
      // Poll for completion
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          setIsAuthorizing(false);
          // Refresh status after OAuth completion
          setTimeout(checkGoogleCalendarStatus, 2000);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start OAuth:', error);
      setIsAuthorizing(false);
    }
  };

  const handleRefresh = () => {
    checkGoogleCalendarStatus();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Checking Google Calendar Status...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🗓️ Google Calendar Integration Setup
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your personal Google Calendar to automatically sync appointments and meetings.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">✅ Google Calendar Connected Successfully!</h3>
                <p className="text-sm">Your Google Calendar integration is now active.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">❌ Google Calendar Authorization Failed</h3>
                <p className="text-sm">Please try again or contact support if the issue persists.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Configuration Status:</span>
                <Badge variant={status.configured ? "default" : "secondary"}>
                  {status.configured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Client ID:</span>
                <Badge variant={status.details.hasClientId ? "default" : "destructive"}>
                  {status.details.hasClientId ? "Present" : "Missing"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Client Secret:</span>
                <Badge variant={status.details.hasClientSecret ? "default" : "destructive"}>
                  {status.details.hasClientSecret ? "Present" : "Missing"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Redirect URI:</span>
                <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {status.details.redirectUri}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Unable to load status</p>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      {status && !status.configured && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(status.details.setupInstructions).map(([key, instruction]) => (
                <div key={key} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">
                    {key.replace('step', '')}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{instruction}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {status && !status.configured && authUrl && (
          <Button 
            onClick={handleAuthorize} 
            disabled={isAuthorizing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isAuthorizing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Authorizing...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Authorize Google Calendar
              </>
            )}
          </Button>
        )}
        
        <Button 
          onClick={handleRefresh} 
          variant="outline"
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
        
        <Button 
          onClick={() => setLocation('/dashboard')} 
          variant="ghost"
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How It Works:</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Click "Authorize Google Calendar" to connect your personal Google account</li>
          <li>• Grant permission for the app to access your calendar</li>
          <li>• Your appointments will automatically sync to your Google Calendar</li>
          <li>• You can manage your calendar integration anytime from this page</li>
        </ul>
      </div>
    </div>
  );
}