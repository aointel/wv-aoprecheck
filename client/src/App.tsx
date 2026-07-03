import { Router, Switch, Route, Redirect, useLocation } from "wouter";
import { useState, useEffect, lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { DemoProvider } from "@/contexts/DemoContext";

// Error Boundary for catching render errors
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = err?.message || 'An error occurred';
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <div className="text-center p-8 max-w-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-2 font-medium">{msg}</p>
            {err?.stack && (
              <pre className="text-left text-xs text-gray-500 bg-gray-100 p-3 rounded overflow-auto max-h-40 mb-4">{err.stack}</pre>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText?.(msg + (err?.stack ? '\n\n' + err.stack : '')); }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Copy error
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageLoader } from "@/components/ui/custom-loader";
import { WalkthroughGuard } from "@/components/auth/walkthrough-guard";
import { ConnectionsBlocker } from "@/components/ConnectionsBlocker";
import { AOIReportsBlocker } from "@/components/AOIReportsBlocker";
import { ConnectNowLayout } from "@/components/layouts/ConnectNowLayout";
import { PrecheckStandaloneLayout } from "@/components/layouts/PrecheckStandaloneLayout";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { isAoPrecheckStandalone } from "@/lib/aoprecheck-standalone";
import { useAuth } from "@/hooks/use-auth";
import { ElectronAutoCapture } from "@/components/screen-share/ElectronAutoCapture";
import { HPProTracker } from "@/components/HPProTracker";
import UpdateRequired from "@/pages/UpdateRequired";
import { setupVersionCheck } from "@/lib/version-check";
import { UserpilotInit } from "@/components/UserpilotInit";
import { UsageHeartbeat } from "@/components/UsageHeartbeat";
import { ChangelogModal } from "@/components/changelog/ChangelogModal";
import { DailyQualityRatingModal } from "@/components/DailyQualityRatingModal";
import { QualitySurveyOpenRoute } from "@/components/QualitySurveyOpenRoute";
import GuidedHelpWidget from "@/components/help/GuidedHelpWidget";
import AgentCalendarPanel from "@/components/scheduling/AgentCalendarPanel";
import {
  clearQualitySurveyForcePreview,
  getPacificYmd,
  getQualityRatingLocalStorageKey,
  getQualitySurveyNormalTimerTotalMs,
  isQualitySurveyForcePreviewActive,
  shouldPromptQualityRatingOnPath,
  syncQualitySurveyForceFromUrl,
} from "@/lib/quality-rating-prompt";
import { useChangelog } from "@/hooks/use-changelog";
import { ChangelogProvider, useChangelogContext } from "@/contexts/ChangelogContext";
import { CreditPurchaseModalProvider } from "@/contexts/CreditPurchaseModalContext";
import { CallConnectorProPrimerModal } from "@/components/modals/CallConnectorProPrimerModal";
// import { OnboardingGate } from "@/components/OnboardingGate"; // DISABLED - Not ready yet
// Global API interceptor - DISABLED (causes issues with Electron app)
// import "@/lib/api-interceptor";

/** REDIRECT DISABLED. No redirect to baa2 or any other host — production is aoirail only. */
function DevRedirectGuard() {
  return null;
}

const CHUNK_RECOVERY_KEY = "aoi_chunk_recovery_once";
const CHUNK_RECOVERY_TS_KEY = "aoi_chunk_recovery_ts";
const CHUNK_RECOVERY_COOLDOWN_MS = 5 * 60 * 1000;

function shouldSuppressChunkRecoveryForPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard/verification-start");
}

function isChunkLoadErrorMessage(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("chunkloaderror") ||
    m.includes("loading chunk")
  );
}

function shouldTriggerChunkRecovery(reason: unknown): boolean {
  if (typeof reason === "string") return isChunkLoadErrorMessage(reason);
  if (reason instanceof Error) return isChunkLoadErrorMessage(reason.message);
  if (reason && typeof reason === "object") {
    const maybeMessage = (reason as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return isChunkLoadErrorMessage(maybeMessage);
  }
  return false;
}

function tryRecoverChunkLoadFailure() {
  if (typeof window === "undefined") return;

  // Do not auto-reload this route; users are actively filling workflow data here.
  if (shouldSuppressChunkRecoveryForPath(window.location.pathname)) {
    console.warn("⚠️ Chunk load mismatch detected on verification page; auto-reload suppressed.");
    return;
  }

  const hasRetriedInSession = sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1";
  const lastRecoveryTs = Number(localStorage.getItem(CHUNK_RECOVERY_TS_KEY) || "0");
  const inCooldown = Number.isFinite(lastRecoveryTs) && Date.now() - lastRecoveryTs < CHUNK_RECOVERY_COOLDOWN_MS;
  const hasRetried = hasRetriedInSession || inCooldown;
  if (hasRetried) return;

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
  localStorage.setItem(CHUNK_RECOVERY_TS_KEY, String(Date.now()));
  console.warn("⚠️ Chunk load mismatch detected, forcing one-time reload");
  window.location.reload();
}

// Component to redirect root path to dashboard based on user role
function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  const { authState } = useAuth();

  useEffect(() => {
    // Wait for auth to initialize before redirecting
    if (!authState.initialized) {
      return;
    }

    if (!authState.user?.email) {
      setLocation('/connect');
      return;
    }

    // Navigate immediately to default route, fetch permissions in background
    // This allows data to start loading on the target page immediately
    const defaultRoute = '/connect'; // Main page for everyone
    setLocation(defaultRoute);

    // Fetch permissions in background and redirect if needed (without blocking initial data load)
    fetch('/api/user-permissions', {
      headers: {
        'user-email': authState.user.email
      }
    })
    .then(res => res.json())
    .then(permissions => {
      // Quality managers go to AO Precheck Admin
      if (permissions.role === 'quality_manager' || permissions.role === 'ao_quality_manager') {
        console.log(`🎯 Redirecting ${permissions.role} to AO Precheck Admin`);
        setLocation('/dashboard/aoi-precheck-admin');
      }
      // All other roles default to /dashboard/connect (Call Connector Pro)
    })
    .catch(error => {
      console.error('Failed to fetch permissions for redirect:', error);
      // Already on default route, so no action needed
    });
  }, [setLocation, authState.user?.email, authState.initialized]);

  if (!authState.initialized) {
    return <PageLoader text="Loading…" />;
  }

  return null;
}

// Component to render dashboard layout with connections and AOI reports blocking  
function ConditionalDashboardLayout({ children }: { children: React.ReactNode }) {
  // Everyone gets the ConnectNow layout with proper sidebar navigation, wrapped in ConnectionsBlocker and AOIReportsBlocker
  return (
    <ConnectNowLayout>
      <ConnectionsBlocker>
        <AOIReportsBlocker>
          {children}
        </AOIReportsBlocker>
      </ConnectionsBlocker>
    </ConnectNowLayout>
  );
}

// AO Precheck pages (existing verification system)
import VerificationWorkflow from "@/pages/verification-workflow";
import VerificationWorkflowES from "@/pages/verification-workflow-es";
import producerVerification from "@/pages/agent-verification";
import ClientVerification from "@/pages/client-verification";
import FinalCompletion from "@/pages/final-completion";
import SimpleCallPage from "@/pages/simple-call-page";
import ConferenceTest from "@/pages/conference-test";
import WebRtcTest from "@/pages/webrtc-test";
import TestCall from "@/pages/test-call";
import AlexTest from "@/pages/AlexTest";
import { VerificationProgress } from "@/components/verification/verification-progress";

// ConnectNow platform pages
import ConnectMobile from "@/pages/ConnectMobile";
import ConnectPage from "@/pages/Connect";
import AOIntelligencePage from "@/pages/AOIntelligence";
import AOIReports from "@/pages/AOIReports";
import MasterAOIReports from "@/pages/MasterAOIReports";
import Dashboard from "@/pages/Dashboard";
import NewDialer from "@/pages/NewDialer";
import LeaseDialerPage from "@/pages/LeaseDialer";
import AOPrecheck from "@/pages/AOPrecheck";
import AORecruit from "@/pages/AORecruit";
import { LivePresentationsPage } from "@/pages/LivePresentations";
import { PresentationReviewPage } from "@/pages/PresentationReview";
import AOICards from "@/pages/WarSystem";
const Subscription = lazy(() => import("@/pages/Subscription"));
import VerificationResults from "@/pages/verification-results";
import UserManagement from "@/pages/UserManagement";
import SystemSettings from "@/pages/SystemSettings";
import Admin from "@/pages/Admin";
import InboundCallDashboard from "@/pages/InboundCallDashboard";
import BillingReports from "@/pages/BillingReports";
import AOConnectBilling from "@/pages/AOConnectBilling";
import producerBilling from "@/pages/AgentBilling";
import BillingDashboard from "@/pages/BillingDashboard";
import ConnectNowAnalytics from "@/pages/ConnectNowAnalytics";
import UploadPage from "@/pages/Upload";

// Auth pages
import { LoginPage } from "@/pages/Login";
import { SignupAssistancePage } from "@/pages/SignupAssistancePage";
import HelpPage from "@/pages/HelpPage";
import HelpQueuePage from "@/pages/HelpQueuePage";
import HelpManagerPage from "@/pages/HelpManagerPage";
import { EmailVerificationPage } from "@/pages/EmailVerificationPage";
import Onboarding from "@/pages/Onboarding";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { ResetPasswordPage } from "@/pages/reset-password";
import { JoinPage } from "@/pages/JoinPage";
import { ForgotPasscodePage } from "@/pages/ForgotPasscodePage";
import NotFound from "@/pages/not-found";
import ApplicationPage from "@/pages/application";
import LandingPage from "@/pages/landing";
import PublicLiveCard from "@/pages/PublicLiveCard";

// Getting Started Walkthrough
import GettingStarted from "@/pages/GettingStarted";
import TrainingPractice from "@/pages/TrainingPractice";
import WalkthroughAdmin from "@/pages/WalkthroughAdmin";
import WelcomeScreen from "@/pages/WelcomeScreen";
import StartPage from "@/pages/StartPage";
import TaalkCampaignManager from "@/pages/TaalkCampaignManager";
import AppointmentCalendarPage from "@/pages/AppointmentCalendar";
import AppointmentsPage from "@/pages/AppointmentsPage";
import EditAppointment from "@/pages/edit-appointment";
import Downloads from "@/pages/Downloads";
import DesktopApps from "@/pages/DesktopApps";
import DesktopDownloads from "@/pages/DesktopDownloads";
import HotleadAdmin from "@/pages/HotleadAdmin";
import VerificationBotTest from "@/pages/VerificationBotTest";
import TeamsManagement from "@/pages/TeamsManagement";
import WarReports from "@/pages/WarReports";
import { AccountabilityPage } from "@/pages/AccountabilityPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import CallMonitoringBoard from "@/pages/CallMonitoringBoard";
import GoogleCalendarSetup from "@/pages/GoogleCalendarSetup";
import GamificationMockup from "@/pages/GamificationMockup";
import Achievements from "@/pages/Achievements";
import AOIAchieve from "@/pages/AOIAchieve";
import SeasonPass from "@/pages/SeasonPass";
import Clash from "@/pages/Clash";
import Triumphs from "@/pages/Triumphs";
import { ProgressOverlay } from "@/components/gamification/ProgressOverlay";

// Removed LinkedIn and ResumeSearch imports - systems were ineffective per user request

// Video conferencing pages
import VideoTest from "@/pages/VideoTest";
import VideoCall from "@/pages/VideoCall";
import VideoTestPage from "@/pages/VideoTestPage";
import ClientMeetingJoin from "@/pages/ClientMeetingJoin";
import ClientVideoCall from "@/pages/ClientVideoCall";
import VideoWaitingRoom from "@/pages/VideoWaitingRoom";
import RecruitJourney from "@/pages/RecruitJourney";
import RecruitWaiting from "@/pages/RecruitWaiting";
import VideoDebug from "@/pages/VideoDebug";
import SimpleVideoTest from "@/pages/SimpleVideoTest";
import TwilioVideoCall from "@/pages/TwilioVideoCall";
import TwilioClientVideoCall from "@/pages/TwilioClientVideoCall";
import VideoConnectionTest from "@/pages/VideoConnectionTest";
import ConferenceConnectTest from "@/pages/ConferenceConnectTest";
import SimpleTokenTest from "@/pages/SimpleTokenTest";
import CameraPermissionTest from "@/pages/CameraPermissionTest";
import WorkingVideoCall from "@/pages/WorkingVideoCall";
import AOIMeet from "@/pages/AOIMeet";
import MeetingControlsPage from "@/pages/MeetingControlsPage";
import { MeetingPopupPage } from "@/pages/MeetingPopupPage";
import { AccountabilityModal } from "@/components/AccountabilityModal";
import { VDPCreditAlert } from "@/components/VDPCreditAlert";
import HelpQueueStatusBanner from "@/components/help/HelpQueueStatusBanner";
import ItsYourTurnModal from "@/components/help/ItsYourTurnModal";
import { CallConnectorPromoModal } from "@/components/modals/CallConnectorPromoModal";
import producerInfoTest from "@/pages/agent-info-test";
import producerDemo from "@/pages/agent-demo";
import LiveCallBoard from "@/pages/LiveCallBoard";
import LiveCallBoardSimple from "@/pages/LiveCallBoardSimple";
import LiveCallBoardNew from "@/pages/LiveCallBoardNew";
import WeeklyAgencyReport from "@/pages/WeeklyAgencyReport";
import SubmittedApplicationsPage from "@/pages/SubmittedApplicationsPage";
import UsageReport from "@/pages/UsageReport";
import AOMeet from "@/pages/AOMeet";
import AOPresentHistory from "@/pages/AOPresentHistory";
import MissedCalls from "@/pages/MissedCalls";
import MissedCallAdmin from "@/pages/MissedCallAdmin";
import producerCreditDashboard from "@/pages/AgentCreditDashboard";
import AdminBillingManagement from "@/pages/AdminBillingManagement";
import ManagerBillingPortal from "@/pages/ManagerBillingPortal";
import AOIPrecheckAdmin from "@/pages/AOIPrecheckAdmin";
import PrecheckManagerAdminPage from "@/pages/PrecheckManagerAdminPage";
import PresentationAnalytics from "@/pages/PresentationAnalytics";
import producerPresentations from "@/pages/AgentPresentations";
import CallAnalyticsAdmin from "@/pages/CallAnalyticsAdmin";

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
            lastName: 'producer',
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

function AppRoutes() {
  const [location] = useLocation();

  return (
    <Switch key={location}>
      <Route path="/open-quality-survey">
        <QualitySurveyOpenRoute />
      </Route>
      {/* Public routes - no authentication required - wrapped in ErrorBoundary */}
      <Route path="/verify-email">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <EmailVerificationPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/login">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <LoginPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/signup">
        <Redirect to="/join" />
      </Route>
      <Route path="/signup-assistance">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <SignupAssistancePage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/live/:token" component={PublicLiveCard} />
      <Route path="/onboarding">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
                <Onboarding />
              </Suspense>
            </ErrorBoundary>
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/join">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <JoinPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/forgot-passcode">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <ForgotPasscodePage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/forgot-password">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <ForgotPasswordPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/reset-password">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
            <ResetPasswordPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/agent-verify/:sessionId" component={producerVerification} />
      <Route path="/agent-verify-es/:sessionId" component={producerVerification} />
      <Route path="/client-verify/:sessionId" component={ClientVerification} />
      <Route path="/client-verify-es/:sessionId" component={ClientVerification} />
      <Route path="/complete/:sessionId" component={FinalCompletion} />

      {/* Test pages for producer information form */}
      <Route path="/agent-info-test" component={producerInfoTest} />
      <Route path="/agent-demo" component={producerDemo} />
      
      {/* Public downloads page */}
      <Route path="/downloads" component={Downloads} />

      {/* Conference test POC - public, no auth required */}
      <Route path="/conference-test" component={ConferenceConnectTest} />

      {/* Get Help - public, works for both anonymous and logged-in */}
      <Route path="/help">
        <ErrorBoundary>
          <HelpPage />
        </ErrorBoundary>
      </Route>
      <Route path="/help/queue">
        <ErrorBoundary>
          <HelpQueuePage />
        </ErrorBoundary>
      </Route>
      <Route path="/help/manager">
        <ProtectedRoute>
          <ErrorBoundary>
            <HelpManagerPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      {/* Season Pass testing route - temporary public access */}
      <Route path="/season-pass-test" component={SeasonPass} />
      <Route path="/rank-battlepass" component={lazy(() => import("./pages/RankBattlePass"))} />

      {/* Getting Started Walkthrough - Mandatory for all users */}
      <Route path="/getting-started">
        <ProtectedRoute>
          <GettingStarted />
        </ProtectedRoute>
      </Route>

      {/* Training Practice Environment */}
      <Route path="/training-practice">
        <ProtectedRoute>
          <TrainingPractice />
        </ProtectedRoute>
      </Route>

      {/* Campaign Manager hidden - using auto-load for all masterlead table leads */}
      {/* <Route path="/campaign-manager">
        <ProtectedRoute>
          <ConnectNowLayout>
            <CampaignManagerPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route> */}

      {/* Direct WAR Reports access */}
      <Route path="/war-reports">
        <ProtectedRoute>
          <ConnectNowLayout>
            <WarReports />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Direct Connect page access */}
      <Route path="/connect">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <ConnectPage />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>


      {/* Direct Accountability Page access */}
      <Route path="/accountability">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AccountabilityPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Direct Analytics Page access */}
      <Route path="/analytics">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AnalyticsPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Verification Results Dashboard - Admin only (cnsysop@aoglobelife.com) */}
      <Route path="/verification-results">
        <ProtectedRoute>
          <ConnectNowLayout>
            <VerificationResults />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Upload Portal - Admin only (cnsysop@aoglobelife.com) */}
      <Route path="/upload">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <UploadPage />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* AO Connect Billing Page */}
      <Route path="/ao-connect-billing">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOConnectBilling />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Manager Billing Portal - MGA/RGA pay for agent calls */}
      <Route path="/manager-billing">
        <ProtectedRoute>
          <ConnectNowLayout>
            <ManagerBillingPortal />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Direct Call Monitoring Board access */}
      <Route path="/call-monitoring">
        <ProtectedRoute>
          <ConnectNowLayout>
            <CallMonitoringBoard />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Direct Live Call Board access */}
      <Route path="/live-call-board">
        <ProtectedRoute>
          <ConnectNowLayout>
            <LiveCallBoardNew />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* AOI Reports - Direct access route */}
      <Route path="/aoi-reports">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOIReports />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Master AOI Reports - Management oversight for All producers */}
      <Route path="/master-aoi-reports">
        <ProtectedRoute>
          <ConnectNowLayout>
            <MasterAOIReports />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Hotlead Distribution System */}

      {/* Welcome/Getting Started Page - Optional route that doesn't interfere with main flow */}
      <Route path="/welcome">
        <ProtectedRoute>
          <WelcomeScreen />
        </ProtectedRoute>
      </Route>

      {/* Start Page - Gaming-style daily objectives and announcements */}
      <Route path="/start">
        <ProtectedRoute>
          <StartPage />
        </ProtectedRoute>
      </Route>

      {/* Gamification Mockup - Visual design preview */}
      <Route path="/gamification-mockup">
        <ProtectedRoute>
          <GamificationMockup />
        </ProtectedRoute>
      </Route>

      {/* Achievements - Destiny-style achievement system */}
      <Route path="/achievements">
        <ProtectedRoute>
          <Achievements />
        </ProtectedRoute>
      </Route>

      {/* Protected ConnectNow Dashboard sub-pages with sidebar layout - MUST come before /dashboard route */}
      <Route path="/dashboard/call-analytics">
        <ProtectedRoute>
          <ConnectNowLayout>
            <CallAnalyticsAdmin />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/aoi">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOIntelligencePage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/aoi-report">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOIReports />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/aoi/billing">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOConnectBilling />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/agent-billing">
        <ProtectedRoute>
          <ConnectNowLayout>
            <producerBilling />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Mobile dialer — no sidebar, must be before /dashboard/connect */}
      <Route path="/dashboard/connect/mobile">
        <ProtectedRoute>
          <ConnectMobile />
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/connect/leasedialer">
        <ProtectedRoute>
          <ConnectNowLayout>
            <LeaseDialerPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/connect">
        <ProtectedRoute>
          <ConnectNowLayout>
            <ConnectPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/outbound-dialer">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <NewDialer />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/campaign-manager">
        <ProtectedRoute>
          <ConnectNowLayout>
            <div className="p-6">
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                AOI Command has been removed from shell routing.
              </div>
            </div>
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

        <Route path="/dashboard/ao-recruit">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AORecruit />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Live Presentations Monitoring - Like AOI Recruit for HPPRO */}
      <Route path="/dashboard/live-presentations">
        <ProtectedRoute>
          <ConnectNowLayout>
            <LivePresentationsPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Presentation Review - Browse and replay past presentations */}
      <Route path="/dashboard/presentation-review">
        <ProtectedRoute>
          <ConnectNowLayout>
            <PresentationReviewPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/ao-precheck">
        <Redirect to="/dashboard/verification-start" />
      </Route>


      <Route path="/subscription">
        <Redirect to="/dashboard/billing-dashboard" />
      </Route>
      <Route path="/dashboard/subscription">
        <Redirect to="/dashboard/billing-dashboard" />
      </Route>

      <Route path="/dashboard/missed-calls">
        <ProtectedRoute>
          <ConnectNowLayout>
            <MissedCalls />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/missed-call-admin">
        <ProtectedRoute>
          <ConnectNowLayout>
            <MissedCallAdmin />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/billing-dashboard">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <BillingDashboard />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/aoi-precheck-admin">
        <ProtectedRoute>
          <PrecheckManagerAdminPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/presentation-analytics">
        <ProtectedRoute>
          <ConnectNowLayout>
            <PresentationAnalytics />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/my-presentations">
        <ProtectedRoute>
          <ConnectNowLayout>
            <producerPresentations />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/ao-meet">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOMeet />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/presentation-history">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOPresentHistory />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/users">
        <ProtectedRoute>
          <ConnectNowLayout>
            <UserManagement />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/settings">
        <ProtectedRoute>
          <ConnectNowLayout>
            <SystemSettings />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/admin">
        <ProtectedRoute>
          <ConnectNowLayout>
            <Admin />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/inbound-calls">
        <ProtectedRoute>
          <ConnectNowLayout>
            <InboundCallDashboard />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/walkthrough-admin">
        <ProtectedRoute>
          <ConnectNowLayout>
            <WalkthroughAdmin />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/billing-reports">
        <ProtectedRoute>
          <ConnectNowLayout>
            <BillingReports />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/appointments">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <AppointmentCalendarPage />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/appointments-manager">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <AppointmentsPage />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/appointments/edit/:id">
        <ProtectedRoute>
          <ConnectNowLayout>
            <EditAppointment />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/downloads">
        {/* Downloads page - public but checks for desktop app */}
        <ConnectNowLayout>
          <Downloads />
        </ConnectNowLayout>
      </Route>

      <Route path="/dashboard/desktop-apps">
        <ProtectedRoute>
          <ConnectNowLayout>
            <DesktopApps />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/desktop-downloads">
        <DesktopDownloads />
      </Route>

      <Route path="/dashboard/hotlead-admin">
        <ProtectedRoute>
          <ConnectNowLayout>
            <HotleadAdmin />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/teams">
        <ProtectedRoute>
          <ConnectNowLayout>
            <TeamsManagement />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/war-reports">
        <ProtectedRoute>
          <ConnectNowLayout>
            <WarReports />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* AOI Cards - Connect Card Deck for reviewing connects */}
      <Route path="/dashboard/aoi-cards">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOICards />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/accountability">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AccountabilityPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/analytics">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AnalyticsPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/connectnow-analytics">
        <ProtectedRoute>
          <ConnectNowLayout>
            <ConnectNowAnalytics />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/call-monitoring">
        <ProtectedRoute>
          <ConnectNowLayout>
            <CallMonitoringBoard />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/live-call-board">
        <ProtectedRoute>
          <ConnectNowLayout>
            <LiveCallBoardNew />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/taalk-campaigns">
        <ProtectedRoute>
          <ConnectNowLayout>
            <TaalkCampaignManager />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/weekly-agency-report">
        <ProtectedRoute>
          <ConnectNowLayout>
            <WeeklyAgencyReport />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/submitted-applications">
        <ProtectedRoute>
          <ConnectNowLayout>
            <SubmittedApplicationsPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/usage-report">
        <ProtectedRoute>
          <ConnectNowLayout>
            <UsageReport />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/google-calendar-setup">
        <ProtectedRoute>
          <ConnectNowLayout>
            <GoogleCalendarSetup />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/aoi-achieve">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOIAchieve />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/season-pass">
        <ProtectedRoute>
          <ConnectNowLayout>
            <SeasonPass />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/clash">
        <ProtectedRoute>
          <ConnectNowLayout>
            <Clash />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/triumphs">
        <ProtectedRoute>
          <ConnectNowLayout>
            <Triumphs />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/achievements">
        <ProtectedRoute>
          <ConnectNowLayout>
            <Achievements />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* AO Precheck main page: Completed Verifications (transmit) + Start new Precheck (track selector) */}
      <Route path="/dashboard/verification-start">
        <ProtectedRoute>
          {isAoPrecheckStandalone() ? (
            <PrecheckStandaloneLayout>
              <AOPrecheck />
            </PrecheckStandaloneLayout>
          ) : (
            <ConnectNowLayout>
              <AOPrecheck />
            </ConnectNowLayout>
          )}
        </ProtectedRoute>
      </Route>

      {/* Development/testing routes */}
      <Route path="/dashboard/simple-call">
        <ProtectedRoute>
          <ConnectNowLayout>
            <SimpleCallPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/test-call">
        <ProtectedRoute>
          <ConnectNowLayout>
            <TestCall />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/dev-call">
        <ProtectedRoute>
          <ConnectNowLayout>
            <DevCallPage />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/verification-bot-test">
        <ProtectedRoute>
          <ConnectNowLayout>
            <VerificationBotTest />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Standalone verification workflow (legacy direct access) */}
      <Route path="/verification">
        <ProtectedRoute>
          <ConnectNowLayout>
            <VerificationWorkflow />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Spanish verification workflow */}
      <Route path="/verification-es">
        <ProtectedRoute>
          <ConnectNowLayout>
            <VerificationWorkflowES />
          </ConnectNowLayout>
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

      <Route path="/video-test" component={VideoTest} />
      <Route path="/video-meeting" component={VideoCall} />
      <Route path="/video-call" component={VideoCall} />
      <Route path="/video-test-page" component={VideoTestPage} />
      <Route path="/join-meeting" component={ClientMeetingJoin} />
      <Route path="/waiting-room" component={VideoWaitingRoom} />
      <Route path="/video-waiting-room" component={VideoWaitingRoom} />
      <Route path="/recruit-journey" component={RecruitJourney} />
      <Route path="/recruit/waiting" component={RecruitWaiting} />
      <Route path="/video-debug" component={VideoDebug} />
      <Route path="/simple-test" component={SimpleVideoTest} />
      <Route path="/twilio-video" component={TwilioVideoCall} />
      <Route path="/twilio-client" component={TwilioClientVideoCall} />
      <Route path="/test-connection" component={VideoConnectionTest} />
      <Route path="/conference-test" component={ConferenceConnectTest} />
      <Route path="/token-test" component={SimpleTokenTest} />
      <Route path="/camera-test" component={CameraPermissionTest} />
      <Route path="/working-video" component={WorkingVideoCall} />

      {/* Meeting Controls Popup - No layout needed */}
      <Route path="/meeting-controls" component={MeetingControlsPage} />
      <Route path="/meeting-popup" component={MeetingPopupPage} />

      {/* AOI Meet - Professional meeting management */}
      <Route path="/aoi-meet">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOIMeet />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* Dashboard Meet route */}
      <Route path="/dashboard/meet">
        <ProtectedRoute>
          <ConnectNowLayout>
            <AOMeet />
          </ConnectNowLayout>
        </ProtectedRoute>
      </Route>

      {/* AOI Card - Hierarchy Owners */}
      <Route path="/AOI">
        <PublicLiveCard />
      </Route>
      <Route path="/aoi">
        <PublicLiveCard />
      </Route>

      {/* Root path redirect to /connect */}
      <Route path="/" component={RedirectToDashboard} />

      {/* /dashboard redirects to /connect so app starts on Connect, not dashboard */}
      <Route path="/dashboard">
        <Redirect to="/connect" />
      </Route>

      {/* Landing page — same content as /dashboard */}
      <Route path="/landing">
        <ProtectedRoute>
          <ConditionalDashboardLayout>
            <LandingPage />
          </ConditionalDashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Alex Voice Agent Demo - Public route */}
      <Route path="/alextest">
        <AlexTest />
      </Route>

      {/* Explicit lafond route to avoid relying on catch-all vanity matching */}
      <Route path="/lafond">
        <PublicLiveCard params={{ vanitySlug: "lafond" }} />
      </Route>

      {/* Senior Combo intake form */}
      <Route path="/application">
        <ProtectedRoute>
          <ApplicationPage />
        </ProtectedRoute>
      </Route>

      {/* Vanity public hierarchy links like /lafond */}
      <Route path="/:vanitySlug" component={PublicLiveCard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithAccountabilityInner() {
  const [location] = useLocation();
  const [showAccountabilityModal, setShowAccountabilityModal] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const { authState } = useAuth();
  const { isOpen: showChangelog, closeChangelog, openChangelog } = useChangelogContext();
  const queryClient = useQueryClient();
  const [showCCProPrimer, setShowCCProPrimer] = useState(false);
  const [showDailyQualityRating, setShowDailyQualityRating] = useState(false);
  const suppressGlobalOverlaysOnConnect =
    location === '/connect' || location.startsWith('/dashboard/connect');
  
  // Changelog hook
  const { unreadEntries, dismissEntry, markAsViewed } = useChangelog(authState?.user?.email);
  
  // Check if user needs to watch CCPro primer - Only show if they don't have access AND haven't dismissed it
  const { data: needsCCProPrimer, isLoading: checkingPrimer, error: primerCheckError } = useQuery({
    queryKey: ['ccpro-primer-completed', authState?.user?.email],
    queryFn: async () => {
      if (!authState?.user?.email) {
        console.log('📺 CCPro primer: No user email');
        return false;
      }
      
      const email = authState.user.email.toLowerCase();
      
      // BYPASS: morgangorham@aoglobelife.com never sees CCPro primer
      const bypassEmail = 'morgangorham@aoglobelife.com';
      if (email === bypassEmail.toLowerCase()) {
        console.log(`✅ Bypassing CCPro primer for ${bypassEmail}`);
        return false;
      }
      
      // Check if user has Call Connector Pro access (now uses SubscriptionService to check ALL access methods)
      // Also checks database for dismissal status (persists across browsers)
      try {
        console.log('📺 CCPro primer: Checking access and dismissal status for', email);
        const response = await fetch(`/api/call-connector-pro/access-check/${encodeURIComponent(email)}`);
        if (!response.ok) {
          console.log('📺 CCPro primer: Access check failed (status:', response.status, '), will NOT show modal to avoid spam');
          return false; // Don't show if check fails - avoid showing modal repeatedly
        }
        const data = await response.json();
        const hasAccess = data?.hasAccess || false;
        const hasDismissedPrimer = data?.hasDismissedPrimer || false;
        
        // If they have access (through subscription service or customers.CCPRO), don't show modal
        if (hasAccess) {
          console.log('📺 CCPro primer: User has access - no modal needed');
          return false;
        }
        
        // If they dismissed it in database, don't show again (persists across browsers/devices)
        if (hasDismissedPrimer) {
          console.log('📺 CCPro primer: User dismissed modal in DATABASE - not showing again (persists across browsers)');
          return false;
        }
        
        // Only show if no access AND not dismissed in database
        console.log('📺 CCPro primer check:', { 
          email, 
          hasAccess, 
          hasDismissedPrimer,
          willShow: true,
          source: 'database_check'
        });
        return true;
      } catch (error) {
        console.error('❌ Error checking CCPro access:', error);
        console.log('📺 CCPro primer: Error occurred, will NOT show modal to avoid spam');
        return false; // Don't show if check fails - avoid showing modal repeatedly
      }
    },
    enabled: !!authState?.user?.email && authState.initialized,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  
  // Show CCPro primer modal if needed
  useEffect(() => {
    console.log('🔍 CCPro primer useEffect:', { 
      checkingPrimer, 
      needsCCProPrimer, 
      email: authState?.user?.email, 
      initialized: authState?.initialized,
      showCCProPrimer 
    });
    
    if (!checkingPrimer && needsCCProPrimer === true && authState?.user?.email && authState.initialized && !showCCProPrimer) {
      console.log('🎬 Showing CCPro primer modal for', authState.user.email);
      // Small delay to let page load
      const timer = setTimeout(() => {
        setShowCCProPrimer(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [needsCCProPrimer, checkingPrimer, authState?.user?.email, authState?.initialized, showCCProPrimer]);

  // Check version on startup - set up global interceptor
  useEffect(() => {
    // Set up global interceptor that redirects on 426 errors
    setupVersionCheck();
  }, []);

  // Recover from stale SPA runtime after deploy (chunk URL mismatch on route change).
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event?.message || String(event?.error || "");
      if (shouldTriggerChunkRecovery(message) || shouldTriggerChunkRecovery(event?.error)) {
        tryRecoverChunkLoadFailure();
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldTriggerChunkRecovery(event?.reason)) {
        tryRecoverChunkLoadFailure();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  // Check accountability status when user logs in
  useEffect(() => {
    if (authState.user?.email) {
      checkAccountabilityStatus();
    }
  }, [authState.user?.email]);

  // Show changelog when user logs in (if there are unread entries)
  // Only show once per update - track shown entry IDs in localStorage
  useEffect(() => {
    if (authState.user?.email && unreadEntries.length > 0 && !showChangelog) {
      // Get list of entry IDs that have been shown to this user
      const shownEntriesKey = `changelog_shown_entries_${authState.user.email}`;
      const shownEntriesJson = localStorage.getItem(shownEntriesKey);
      const shownEntryIds = shownEntriesJson ? new Set<string>(JSON.parse(shownEntriesJson)) : new Set<string>();
      
      // Filter out entries that have already been shown
      const newUnreadEntries = unreadEntries.filter(entry => !shownEntryIds.has(entry.id));
      
      // Only show if there are truly new entries that haven't been shown
      if (newUnreadEntries.length > 0) {
        // Small delay to let the page load first
        const timer = setTimeout(() => {
          openChangelog();
          // Mark all unread entries as shown in localStorage (persists across sessions)
          const allShownEntryIds = new Set([...Array.from(shownEntryIds), ...unreadEntries.map(e => e.id)]);
          localStorage.setItem(shownEntriesKey, JSON.stringify(Array.from(allShownEntryIds)));
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [authState.user?.email, unreadEntries, showChangelog, openChangelog]);

  // Persist ?qualitySurvey=1 / #qualitySurvey=1 whenever the path changes (SPA may strip search only).
  useEffect(() => {
    syncQualitySurveyForceFromUrl();
  }, [location]);

  useEffect(() => {
    const onHash = () => syncQualitySurveyForceFromUrl();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Immediate open: visit /open-quality-survey or run __AO_OPEN_CONNECTNOW_SURVEY__() in the console.
  useEffect(() => {
    const open = () => {
      if (!authState?.user?.email) return;
      setShowDailyQualityRating(true);
    };
    window.addEventListener('aoirail-open-quality-survey', open);
    const w = window as unknown as { __AO_OPEN_CONNECTNOW_SURVEY__?: () => void };
    w.__AO_OPEN_CONNECTNOW_SURVEY__ = open;
    return () => {
      window.removeEventListener('aoirail-open-quality-survey', open);
      delete w.__AO_OPEN_CONNECTNOW_SURVEY__;
    };
  }, [authState?.user?.email]);

  // Forced preview (session/query/hash): timer after overlays close — backup if deep link route was not used.
  useEffect(() => {
    if (!authState?.user?.email || !authState.initialized) return;
    if (!isQualitySurveyForcePreviewActive()) return;
    if (showAccountabilityModal || showChangelog) return;

    const timer = setTimeout(() => setShowDailyQualityRating(true), 500);
    return () => clearTimeout(timer);
  }, [
    authState?.user?.email,
    authState.initialized,
    showAccountabilityModal,
    showChangelog,
  ]);

  // Normal once-per-day survey (not forced).
  useEffect(() => {
    if (!authState?.user?.email || !authState.initialized) return;
    if (isQualitySurveyForcePreviewActive()) return;

    if (showAccountabilityModal || showChangelog) return;
    if (!shouldPromptQualityRatingOnPath(location)) return;

    const ymd = getPacificYmd();
    const key = getQualityRatingLocalStorageKey(authState.user.email, ymd);
    if (localStorage.getItem(key)) return;

    const waitMs = getQualitySurveyNormalTimerTotalMs(authState.user.email);
    const timer = setTimeout(() => setShowDailyQualityRating(true), waitMs);
    return () => clearTimeout(timer);
  }, [
    authState?.user?.email,
    authState.initialized,
    location,
    showAccountabilityModal,
    showChangelog,
  ]);

  const checkAccountabilityStatus = async () => {
    if (!authState.user?.email) return;

    try {
      const response = await fetch(`/api/accountability/check-status?userEmail=${encodeURIComponent(authState.user.email)}`);
      const data = await response.json();

      if (data.isBlocked && !data.hasCompletedReport) {
        setShowAccountabilityModal(true);
      }
    } catch (error) {
      console.error('Failed to check accountability status:', error);
    }
  };

  const handleAccountabilityComplete = () => {
    setShowAccountabilityModal(false);
  };

  return (
    <>
      <TooltipProvider>
        <Router>
          <DevRedirectGuard />
          <UserpilotInit />
          <UsageHeartbeat />
          <Toaster />
          {/* <ProgressOverlay /> */}
          {/* <OnboardingGate> DISABLED - Not ready yet */}
          <AppRoutes />
          <GuidedHelpWidget />
          <AgentCalendarPanel />
          {!suppressGlobalOverlaysOnConnect ? <VDPCreditAlert /> : null}
          {!suppressGlobalOverlaysOnConnect ? <HelpQueueStatusBanner /> : null}
          {!suppressGlobalOverlaysOnConnect ? <ItsYourTurnModal /> : null}
        {!suppressGlobalOverlaysOnConnect ? (
          <AccountabilityModal 
            isOpen={showAccountabilityModal} 
            onComplete={handleAccountabilityComplete}
          />
        ) : null}
        {authState?.user?.email && !suppressGlobalOverlaysOnConnect ? (
          <DailyQualityRatingModal
            isOpen={showDailyQualityRating}
            userEmail={authState.user.email}
            currentPath={location}
            onClose={() => {
              clearQualitySurveyForcePreview();
              setShowDailyQualityRating(false);
            }}
          />
        ) : null}
        {!suppressGlobalOverlaysOnConnect ? (
          <ChangelogModal
            entries={unreadEntries}
            isOpen={showChangelog}
            onClose={async () => {
              // Mark all visible entries as viewed when modal is closed
              // Get current visible entries (not dismissed) from the modal's state
              // Since we can't access that, mark all unread entries as viewed
              for (const entry of unreadEntries) {
                await markAsViewed(entry.id);
              }
              // Force a refetch to update the count
              setTimeout(() => {
                closeChangelog();
              }, 100);
            }}
            onDismiss={async (entryId) => {
              await dismissEntry(entryId);
              // Small delay to allow state to update
              await new Promise(resolve => setTimeout(resolve, 200));
              // Close if no more unread entries (check will happen on next render)
            }}
          />
        ) : null}
        {/* Call Connector Pro Primer Modal - DISABLED */}
        {/* {authState?.user?.email && (
          <CallConnectorProPrimerModal
            isOpen={showCCProPrimer}
            onComplete={() => {
              setShowCCProPrimer(false);
              // Invalidate query to refresh completion status
              queryClient.invalidateQueries({ queryKey: ['ccpro-primer-completed', authState.user?.email] });
            }}
          />
        )} */}
        {/* Electron Auto-Capture - Only active in Electron app */}
        <ElectronAutoCapture 
          enabled={true}
          onCaptureStart={(stream) => {
            console.log('📹 Auto-capture started - HPPRO presentation detected');
            setCaptureStream(stream);
          }}
          onCaptureStop={() => {
            console.log('⏹️ Auto-capture stopped - HPPRO presentation ended');
            setCaptureStream(null);
          }}
        />
        {/* HP Pro Tracker - Inject tracking code into HP Pro iframes/popups (NO Electron changes) */}
        <HPProTracker />
        {/* Call Connector Pro Promotional Modal - DISABLED TEMPORARILY */}
        {/* {authState.user?.email && (
          <CallConnectorPromoModal userEmail={authState.user.email} />
        )} */}
        {/* </OnboardingGate> DISABLED - Not ready yet */}
        </Router>
      </TooltipProvider>
    </>
  );
}

function AppWithAccountability() {
  return (
    <ChangelogProvider>
      <AppWithAccountabilityInner />
    </ChangelogProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DemoProvider>
          <AuthProvider>
          <CreditPurchaseModalProvider>
          <ErrorBoundary>
            <AppWithAccountability />
          </ErrorBoundary>
          </CreditPurchaseModalProvider>
          </AuthProvider>
        </DemoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;