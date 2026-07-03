import { lazy, type ComponentType } from "react";

const named = <T extends ComponentType<unknown>>(
  importer: () => Promise<{ [k: string]: T }>,
  exportName: string,
) =>
  lazy(() =>
    importer().then((m) => {
      const c = (m as Record<string, T>)[exportName];
      return { default: c };
    }),
  );

/** Route-level lazy pages — keeps initial bundle small; load behind AppRoutes Suspense. */
export const VerificationWorkflow = lazy(() => import("@/pages/verification-workflow"));
export const VerificationWorkflowES = lazy(() => import("@/pages/verification-workflow-es"));
export const producerVerification = lazy(() => import("@/pages/agent-verification"));
export const ClientVerification = lazy(() => import("@/pages/client-verification"));
export const FinalCompletion = lazy(() => import("@/pages/final-completion"));
export const SimpleCallPage = lazy(() => import("@/pages/simple-call-page"));
export const ConferenceTest = lazy(() => import("@/pages/conference-test"));
export const WebRtcTest = lazy(() => import("@/pages/webrtc-test"));
export const TestCall = lazy(() => import("@/pages/test-call"));
export const AlexTest = lazy(() => import("@/pages/AlexTest"));

export const ConnectPage = lazy(() => import("@/pages/Connect"));
export const AOIntelligencePage = lazy(() => import("@/pages/AOIntelligence"));
export const AOIReports = lazy(() => import("@/pages/AOIReports"));
export const MasterAOIReports = lazy(() => import("@/pages/MasterAOIReports"));
export const Dashboard = lazy(() => import("@/pages/Dashboard"));
export const NewDialer = lazy(() => import("@/pages/NewDialer"));
export const AOPrecheck = lazy(() => import("@/pages/AOPrecheck"));
export const AORecruit = lazy(() => import("@/pages/AORecruit"));
export const LivePresentationsPage = named(() => import("@/pages/LivePresentations"), "LivePresentationsPage");
export const PresentationReviewPage = named(() => import("@/pages/PresentationReview"), "PresentationReviewPage");
export const AOICards = lazy(() => import("@/pages/WarSystem"));
export const Subscription = lazy(() => import("@/pages/Subscription"));
export const VerificationResults = lazy(() => import("@/pages/verification-results"));
export const UserManagement = lazy(() => import("@/pages/UserManagement"));
export const SystemSettings = lazy(() => import("@/pages/SystemSettings"));
export const Admin = lazy(() => import("@/pages/Admin"));
export const InboundCallDashboard = lazy(() => import("@/pages/InboundCallDashboard"));
export const BillingReports = lazy(() => import("@/pages/BillingReports"));
export const AOConnectBilling = lazy(() => import("@/pages/AOConnectBilling"));
export const producerBilling = lazy(() => import("@/pages/AgentBilling"));
export const BillingDashboard = lazy(() => import("@/pages/BillingDashboard"));
export const ConnectNowAnalytics = lazy(() => import("@/pages/ConnectNowAnalytics"));
export const UploadPage = lazy(() => import("@/pages/Upload"));

export const LoginPage = named(() => import("@/pages/Login"), "LoginPage");
export const SignupAssistancePage = named(() => import("@/pages/SignupAssistancePage"), "SignupAssistancePage");
export const HelpPage = lazy(() => import("@/pages/HelpPage"));
export const HelpQueuePage = lazy(() => import("@/pages/HelpQueuePage"));
export const HelpManagerPage = lazy(() => import("@/pages/HelpManagerPage"));
export const EmailVerificationPage = named(() => import("@/pages/EmailVerificationPage"), "EmailVerificationPage");
export const Onboarding = lazy(() => import("@/pages/Onboarding"));
export const ForgotPasswordPage = named(() => import("@/pages/forgot-password"), "ForgotPasswordPage");
export const ResetPasswordPage = named(() => import("@/pages/reset-password"), "ResetPasswordPage");
export const JoinPage = named(() => import("@/pages/JoinPage"), "JoinPage");
export const ForgotPasscodePage = named(() => import("@/pages/ForgotPasscodePage"), "ForgotPasscodePage");
export const NotFound = lazy(() => import("@/pages/not-found"));
export const LandingPage = lazy(() => import("@/pages/landing"));
export const PublicLiveCard = lazy(() => import("@/pages/PublicLiveCard"));

export const GettingStarted = lazy(() => import("@/pages/GettingStarted"));
export const TrainingPractice = lazy(() => import("@/pages/TrainingPractice"));
export const WalkthroughAdmin = lazy(() => import("@/pages/WalkthroughAdmin"));
export const WelcomeScreen = lazy(() => import("@/pages/WelcomeScreen"));
export const StartPage = lazy(() => import("@/pages/StartPage"));
export const CampaignManagerPage = lazy(() => import("@/pages/CampaignManagerPage"));
export const TaalkCampaignManager = lazy(() => import("@/pages/TaalkCampaignManager"));
export const AppointmentCalendarPage = lazy(() => import("@/pages/AppointmentCalendar"));
export const AppointmentsPage = lazy(() => import("@/pages/AppointmentsPage"));
export const EditAppointment = lazy(() => import("@/pages/edit-appointment"));
export const Downloads = lazy(() => import("@/pages/Downloads"));
export const DesktopApps = lazy(() => import("@/pages/DesktopApps"));
export const DesktopDownloads = lazy(() => import("@/pages/DesktopDownloads"));
export const HotleadAdmin = lazy(() => import("@/pages/HotleadAdmin"));
export const VerificationBotTest = lazy(() => import("@/pages/VerificationBotTest"));
export const TeamsManagement = lazy(() => import("@/pages/TeamsManagement"));
export const WarReports = lazy(() => import("@/pages/WarReports"));
export const AccountabilityPage = named(() => import("@/pages/AccountabilityPage"), "AccountabilityPage");
export const AnalyticsPage = named(() => import("@/pages/AnalyticsPage"), "AnalyticsPage");
export const CallMonitoringBoard = lazy(() => import("@/pages/CallMonitoringBoard"));
export const GoogleCalendarSetup = lazy(() => import("@/pages/GoogleCalendarSetup"));
export const GamificationMockup = lazy(() => import("@/pages/GamificationMockup"));
export const Achievements = lazy(() => import("@/pages/Achievements"));
export const AOIAchieve = lazy(() => import("@/pages/AOIAchieve"));
export const SeasonPass = lazy(() => import("@/pages/SeasonPass"));
export const Clash = lazy(() => import("@/pages/Clash"));
export const Triumphs = lazy(() => import("@/pages/Triumphs"));

export const VideoTest = lazy(() => import("@/pages/VideoTest"));
export const VideoCall = lazy(() => import("@/pages/VideoCall"));
export const VideoTestPage = lazy(() => import("@/pages/VideoTestPage"));
export const ClientMeetingJoin = lazy(() => import("@/pages/ClientMeetingJoin"));
export const ClientVideoCall = lazy(() => import("@/pages/ClientVideoCall"));
export const VideoWaitingRoom = lazy(() => import("@/pages/VideoWaitingRoom"));
export const RecruitJourney = lazy(() => import("@/pages/RecruitJourney"));
export const RecruitWaiting = lazy(() => import("@/pages/RecruitWaiting"));
export const VideoDebug = lazy(() => import("@/pages/VideoDebug"));
export const SimpleVideoTest = lazy(() => import("@/pages/SimpleVideoTest"));
export const TwilioVideoCall = lazy(() => import("@/pages/TwilioVideoCall"));
export const TwilioClientVideoCall = lazy(() => import("@/pages/TwilioClientVideoCall"));
export const VideoConnectionTest = lazy(() => import("@/pages/VideoConnectionTest"));
export const SimpleTokenTest = lazy(() => import("@/pages/SimpleTokenTest"));
export const CameraPermissionTest = lazy(() => import("@/pages/CameraPermissionTest"));
export const WorkingVideoCall = lazy(() => import("@/pages/WorkingVideoCall"));
export const AOIMeet = lazy(() => import("@/pages/AOIMeet"));
export const MeetingControlsPage = lazy(() => import("@/pages/MeetingControlsPage"));
export const MeetingPopupPage = named(() => import("@/pages/MeetingPopupPage"), "MeetingPopupPage");

export const producerInfoTest = lazy(() => import("@/pages/agent-info-test"));
export const producerDemo = lazy(() => import("@/pages/agent-demo"));
export const LiveCallBoard = lazy(() => import("@/pages/LiveCallBoard"));
export const LiveCallBoardSimple = lazy(() => import("@/pages/LiveCallBoardSimple"));
export const LiveCallBoardNew = lazy(() => import("@/pages/LiveCallBoardNew"));
export const WeeklyAgencyReport = lazy(() => import("@/pages/WeeklyAgencyReport"));
export const SubmittedApplicationsPage = lazy(() => import("@/pages/SubmittedApplicationsPage"));
export const UsageReport = lazy(() => import("@/pages/UsageReport"));
export const AOMeet = lazy(() => import("@/pages/AOMeet"));
export const AOPresentHistory = lazy(() => import("@/pages/AOPresentHistory"));
export const MissedCalls = lazy(() => import("@/pages/MissedCalls"));
export const MissedCallAdmin = lazy(() => import("@/pages/MissedCallAdmin"));
export const producerCreditDashboard = lazy(() => import("@/pages/AgentCreditDashboard"));
export const AdminBillingManagement = lazy(() => import("@/pages/AdminBillingManagement"));
export const ManagerBillingPortal = lazy(() => import("@/pages/ManagerBillingPortal"));
export const AOIPrecheckAdmin = lazy(() => import("@/pages/AOIPrecheckAdmin"));
export const PresentationAnalytics = lazy(() => import("@/pages/PresentationAnalytics"));
export const producerPresentations = lazy(() => import("@/pages/AgentPresentations"));
export const CallAnalyticsAdmin = lazy(() => import("@/pages/CallAnalyticsAdmin"));
