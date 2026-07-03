import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ConnectNowLayout } from "@/components/layouts/ConnectNowLayout";

// AO Precheck pages (existing verification system)
import VerificationWorkflow from "@/pages/verification-workflow";
import AgentVerification from "@/pages/agent-verification";
import ClientVerification from "@/pages/client-verification";
import FinalCompletion from "@/pages/final-completion";
import SimpleCallPage from "@/pages/simple-call-page";
import ConferenceTest from "@/pages/conference-test";
import WebRtcTest from "@/pages/webrtc-test";
import TestCall from "@/pages/test-call";
import { VerificationProgress } from "@/components/verification/verification-progress";

// ConnectNow platform pages  
import ConnectPage from "@/pages/Connect";
import Dashboard from "@/pages/Dashboard";
import NewDialer from "@/pages/NewDialer";
import AOPrecheck from "@/pages/AOPrecheck";
import AORecruit from "@/pages/AORecruit";
import AOICards from "@/pages/WarSystem";
import Subscription from "@/pages/Subscription";
import CallCenter from "@/pages/CallCenter";
import Leaderboard from "@/pages/Leaderboard";
import UserManagement from "@/pages/UserManagement";
import SystemSettings from "@/pages/SystemSettings";
import Admin from "@/pages/Admin";

// Auth pages
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import NotFound from "@/pages/not-found";

// Development component for direct call page access
function DevCallPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Create a real session for testing
    const createTestSession = async () => {
      try {
        const response = await fetch('/api/verification/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Test',
            lastName: 'Agent',
            phone: '(503) 201-8470',
            city: 'Portland',
            state: 'OR',
            premium: '$150',
            verificationMethod: 'phone'
          })
        });

        if (response.ok) {
          const session = await response.json();
          setSessionId(session.sessionId);
        }
      } catch (error) {
        console.error('Failed to create test session:', error);
      }
    };

    createTestSession();
  }, []);

  const handleComplete = () => {
    console.log('Call verification completed');
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up test session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto">
        <VerificationProgress 
          sessionId={sessionId} 
          onComplete={handleComplete}
          onBack={() => console.log('Back clicked')}
        />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/agent-verify/:sessionId" component={AgentVerification} />
      <Route path="/client-verify/:sessionId" component={ClientVerification} />
      <Route path="/complete/:sessionId" component={FinalCompletion} />
      
      {/* Protected ConnectNow Dashboard with sidebar layout */}
      <Route path="/dashboard" nest>
        <ProtectedRoute>
          <ConnectNowLayout>
            <Switch>
              <Route path="/" component={ConnectPage} />
              <Route path="/connect" component={ConnectPage} />
              <Route path="/aorecruit" component={AORecruit} />
              <Route path="/aoprecheck" component={AOPrecheck} />
              <Route path="/call-center" component={CallCenter} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/subscription" component={Subscription} />
              <Route path="/users" component={UserManagement} />
              <Route path="/settings" component={SystemSettings} />
              <Route path="/admin" component={Admin} />
              
              {/* Legacy verification workflow accessible within dashboard */}
              <Route path="/verification-start" component={VerificationWorkflow} />
              
              {/* Development/testing routes */}
              <Route path="/simple-call" component={SimpleCallPage} />
              <Route path="/test-call" component={TestCall} />
              <Route path="/dev-call" component={DevCallPage} />
              
              {/* Fallback within dashboard */}
              <Route component={ConnectPage} />
            </Switch>
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Standalone verification workflow (legacy direct access) */}
      <Route path="/verification">
        <ProtectedRoute>
          <VerificationWorkflow />
        </ProtectedRoute>
      </Route>
      
      {/* Legacy routes that redirect to dashboard */}
      <Route path="/call">
        <ProtectedRoute>
          <ConnectNowLayout>
            <SimpleCallPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dev">
        <ProtectedRoute>
          <ConnectNowLayout>
            <DevCallPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/test">
        <ProtectedRoute>
          <ConnectNowLayout>
            <ConferenceTest />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/webrtc-test" component={WebRtcTest} />
      <Route path="/conference-test" component={ConferenceTest} />
      
      {/* Root route - redirect to dashboard */}
      <Route path="/">
        {() => {
          window.location.href = '/dashboard';
          return null;
        }}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;