import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MdVerifiedUser } from 'react-icons/md';
import {
  Shield,
  Play,
  Loader2,
  Award,
  Calendar,
  Phone,
  MapPin,
  User,
  DollarSign,
  FileText,
  Send,
  Trash2,
  RotateCcw,
  Image,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { PrecheckSessionModal } from '@/components/precheck/PrecheckSessionModal';
import { PricingHoverCard } from '@/components/pricing/PricingHoverCard';
import { useDemo } from '@/contexts/DemoContext';
import VerificationWorkflow from '@/pages/verification-workflow';
import { isAoPrecheckStandalone, precheckGreeting } from '@/lib/aoprecheck-standalone';
import {
  PrecheckStandaloneShell,
  PrecheckStage,
  PrecheckWorkflowPanel,
  type PrecheckSidebarSession,
} from '@/components/precheck/PrecheckStandaloneShell';

type AgentVerificationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'reschedule';
type AgentVerificationMethod = 'zoom' | 'phone' | 'conference' | string;

type AgentVerification = {
  id: string;
  sessionId?: string | null;
  agentEmail?: string | null;
  agentFirstName?: string | null;
  agentLastName?: string | null;
  agentFullName?: string | null;
  agentMgaTeam?: string | null;
  agentRgaTeam?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  state?: string | null;
  city?: string | null;
  status: AgentVerificationStatus | string;
  method: AgentVerificationMethod | string;
  createdAt?: string | null;
  completedAt?: string | null;
  policyNumber?: string | null;
  premiumAmount?: number | string | null;
  premiumRaw?: number | string | null;
  verificationScore?: number | string | null;
  certificateUrl?: string | null;
  recordingUrl?: string | null;
  screenshotUrl?: string | null;
  meetingUrl?: string | null;
  relationship?: string | null;
  notes?: string | null;
  callDuration?: number | null;
  transmitStatus?: string | null;
  precheckType?: string | null;
  transmittedAt?: string | null;
  scheduledDeleteAt?: string | null;
  sessionType?: string | null;
};

const statusStyles: Record<AgentVerificationStatus | 'default', string> = {
  completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  in_progress: 'bg-blue-100 text-blue-700 border border-blue-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  failed: 'bg-red-100 text-red-700 border border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border border-slate-200',
  reschedule: 'bg-purple-100 text-purple-700 border border-purple-200',
  default: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const methodStyles: Record<string, string> = {
  zoom: 'bg-purple-100 text-purple-700 border border-purple-200',
  phone: 'bg-green-100 text-green-700 border border-green-200',
  conference: 'bg-blue-100 text-blue-700 border border-blue-200',
};

const formatStatus = (status: string) =>
  status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getStatusBadgeClass = (status: AgentVerification['status']) => {
  const key = (status || 'default').toString().toLowerCase() as AgentVerificationStatus;
  return statusStyles[key] ?? statusStyles.default;
};

const getMethodBadgeClass = (method: AgentVerification['method']) => {
  const key = (typeof method === 'string' ? method.toLowerCase() : '') as string;
  return methodStyles[key] ?? 'bg-slate-100 text-slate-600 border border-slate-200';
};

const formatMethod = (method: AgentVerification['method']) => {
  const normalized = (method || '').toString().toLowerCase();
  switch (normalized) {
    case 'zoom':
      return 'Zoom';
    case 'phone':
      return 'Phone';
    case 'conference':
      return 'Conference';
    default:
      return normalized
        ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        : 'Unknown';
  }
};

const formatDateShort = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';

const formatDuration = (seconds?: number | null) => {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const formatPremium = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return value?.toString() ?? null;
  }
  return '$' + numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatScore = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Pending';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return value.toString();
  }
  return `${numeric}/100`;
};

export default function AOPrecheck() {
  const { authState, logout } = useAuth();
  const userEmail = authState?.user?.email || undefined;
  const { isDemoMode, demoProduct, exitDemoMode } = useDemo();
  const isPrecheckDemo = isDemoMode && demoProduct === 'precheck';

  const { data: recentData, isLoading: isRecentLoading, error: recentError } = useQuery<{
    success: boolean;
    sessions: AgentVerification[];
  }>({
    queryKey: ['/api/aoi-precheck/agent/recent'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/aoi-precheck/agent/recent?limit=50', undefined, userEmail);
      return response.json();
    },
    refetchInterval: 60000,
    enabled: !!userEmail,
  });

  const allSessions: AgentVerification[] = recentData?.sessions ?? [];
  // Completed = transmitted sessions (transmit_status === 'transmitted')
  const isTransmitted = (s: AgentVerification) => s.transmitStatus === 'transmitted';
  const isPendingActive = (s: AgentVerification) =>
    s.transmitStatus !== 'transmitted' && s.transmitStatus !== 'scheduled_delete';
  const completedSessions = allSessions.filter(isTransmitted);
  const pendingSessions = allSessions.filter(isPendingActive);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedSession, setSelectedSession] = useState<AgentVerification | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showVerificationWorkflow, setShowVerificationWorkflow] = useState(false);
  const [precheckTypeBySession, setPrecheckTypeBySession] = useState<Record<string, 'live' | 'training'>>({});
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [certificateSession, setCertificateSession] = useState<AgentVerification | null>(null);
  const [screenshotSession, setScreenshotSession] = useState<AgentVerification | null>(null);
  const [recordingSession, setRecordingSession] = useState<AgentVerification | null>(null);
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<AgentVerification | null>(null);

  // If arriving from AO Meet with client data, go straight to workflow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('client') || params.get('skipTo')) {
      setShowVerificationWorkflow(true);
    }
  }, []);
  const [transmittingSessionId, setTransmittingSessionId] = useState<string | null>(null);
  const [recoveringSessionId, setRecoveringSessionId] = useState<string | null>(null);
  const [transmitTypePerSession, setTransmitTypePerSession] = useState<Record<string, 'live' | 'training' | 'incomplete'>>({});

  const transmitMutation = useMutation({
    mutationFn: async ({ sessionId, precheckType }: { sessionId: string; precheckType: 'live' | 'training' | 'incomplete' }) => {
      const res = await apiRequest('POST', '/api/aoi-precheck/agent/transmit', { sessionId, precheckType }, userEmail);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to transmit');
      }
      return res.json();
    },
    onSuccess: (_, { precheckType }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/agent/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/team/manager-sessions'] });
      if (precheckType === 'live') {
        toast({ title: 'Transmitted successfully', description: 'This session will now appear in AO Precheck Management.' });
      } else {
        toast({ title: 'Marked', description: `Session marked as ${precheckType}. Will be deleted in 24 hours. Use Recover if sent wrong.` });
      }
      setTransmittingSessionId(null);
      if (isAoPrecheckStandalone() && window.self !== window.top) {
        window.parent.postMessage({ type: 'aoprecheck-refresh-drawer' }, '*');
      }
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Transmit failed', description: err.message });
      setTransmittingSessionId(null);
    },
  });

  const recoverMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest('POST', `/api/aoi-precheck/agent/session/${sessionId}/recover`, {}, userEmail);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to recover');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/agent/recent'] });
      toast({ title: 'Recovered', description: 'Session restored. You can transmit again.' });
      setRecoveringSessionId(null);
      if (isAoPrecheckStandalone() && window.self !== window.top) {
        window.parent.postMessage({ type: 'aoprecheck-refresh-drawer' }, '*');
      }
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Recover failed', description: err.message });
      setRecoveringSessionId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest('DELETE', `/api/aoi-precheck/agent/session/${sessionId}`, undefined, userEmail);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to remove');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/agent/recent'] });
      toast({ title: 'Removed', description: 'Session has been deleted.' });
      setDeletingSessionId(null);
      if (isAoPrecheckStandalone() && window.self !== window.top) {
        window.parent.postMessage({ type: 'aoprecheck-refresh-drawer' }, '*');
      }
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Remove failed', description: err.message });
      setDeletingSessionId(null);
    },
  });

  const openCertificate = (certificateUrl?: string | null) => {
    if (!certificateUrl) return;
    const href = certificateUrl.startsWith('http') ? certificateUrl : certificateUrl;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const recentErrorMessage =
    recentError instanceof Error ? recentError.message : 'Unable to load your recent verifications. Please try again.';

  const standalone = isAoPrecheckStandalone();
  const inAppFrame = typeof window !== 'undefined' && window.self !== window.top;
  const firstName =
    authState?.user?.firstName?.split(/\s+/)[0] ||
    authState?.user?.email?.split('@')[0] ||
    'Agent';

  const userInitials =
    ((authState?.user?.firstName?.[0] || '') + (authState?.user?.lastName?.[0] || '')).toUpperCase() ||
    authState?.user?.email?.[0]?.toUpperCase() ||
    '—';

  const toSidebarSession = (session: AgentVerification): PrecheckSidebarSession => ({
    id: String(session.id),
    sessionId: session.sessionId || String(session.id),
    clientName: session.clientName,
    clientPhone: session.clientPhone,
    status: session.status?.toString(),
    method: session.method?.toString(),
    createdAt: session.createdAt,
    transmitStatus: session.transmitStatus,
  });

  const sidebarPending = pendingSessions.map(toSidebarSession);
  const sidebarCompleted = completedSessions.map(toSidebarSession);

  const notifyParentRefresh = () => {
    if (inAppFrame) {
      window.parent.postMessage({ type: 'aoprecheck-refresh-drawer' }, '*');
    }
  };

  useEffect(() => {
    if (standalone && inAppFrame) {
      notifyParentRefresh();
    }
  }, [standalone, inAppFrame, pendingSessions.length, completedSessions.length]);

  const openSession = (session: AgentVerification) => {
    setSelectedSession(session);
    setIsDetailOpen(true);
  };

  const handleSidebarSelect = (session: PrecheckSidebarSession) => {
    const hit = allSessions.find((s) => String(s.sessionId || s.id) === String(session.sessionId || session.id));
    if (hit) openSession(hit);
  };

  const handleWorkflowComplete = () => {
    setShowVerificationWorkflow(false);
    queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/agent/recent'] });
    notifyParentRefresh();
  };

  const handleSidebarTransmit = (session: PrecheckSidebarSession) => {
    const sid = session.sessionId || String(session.id);
    setTransmittingSessionId(sid);
    transmitMutation.mutate({ sessionId: sid, precheckType: 'live' });
  };

  const handleSidebarArchive = (session: PrecheckSidebarSession) => {
    const sid = session.sessionId || String(session.id);
    setTransmittingSessionId(sid);
    transmitMutation.mutate({ sessionId: sid, precheckType: 'training' });
  };

  const sidebarActionBusy = !!transmittingSessionId;

  const sessionModals = (
    <>
      <PrecheckSessionModal
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedSession(null);
        }}
        session={
          selectedSession
            ? {
                ...selectedSession,
                status: selectedSession.status?.toString() ?? 'pending',
                method: selectedSession.method?.toString() ?? 'phone',
              }
            : null
        }
        allowCertificateDownload
      />
      {certificateSession && (
        <Dialog open={!!certificateSession} onOpenChange={(open) => !open && setCertificateSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Verification Certificate - {certificateSession?.clientName || 'Unknown Client'}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="text-center space-y-4">
                <Award className="h-16 w-16 text-blue-600 mx-auto" />
                <h3 className="text-xl font-semibold">Verification Certificate</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Certificate for {certificateSession?.clientName || 'Unknown Client'}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  Session ID: {certificateSession?.sessionId || certificateSession?.id}
                </p>
                <Button
                  onClick={() => {
                    const sessionId = certificateSession?.sessionId || certificateSession?.id;
                    if (!sessionId) return;
                    const link = document.createElement('a');
                    link.href = `/api/aoi-precheck/download/certificate/${sessionId}`;
                    link.download = `certificate-${certificateSession?.clientName || 'unknown'}-${sessionId}.html`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="mt-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Certificate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {screenshotSession && (
        <Dialog open={!!screenshotSession} onOpenChange={() => setScreenshotSession(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Verification Screenshot - {screenshotSession?.clientName}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              {screenshotSession?.screenshotUrl ? (
                <div className="space-y-4">
                  <img
                    src={screenshotSession.screenshotUrl}
                    alt="Verification Screenshot"
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextElement) nextElement.style.display = 'block';
                    }}
                  />
                  <div className="hidden text-center text-slate-500">
                    <Image className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Unable to load image</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500">
                  <Image className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No screenshot available for this session</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      {recordingSession && (
        <Dialog open={!!recordingSession} onOpenChange={() => setRecordingSession(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Recording - {recordingSession?.clientName || 'Unknown Client'}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              {recordingSession?.recordingUrl ? (
                <audio controls className="w-full" src={recordingSession.recordingUrl}>
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="text-center text-slate-500">
                  <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No recording available for this session</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog open={!!deleteConfirmSession} onOpenChange={(open) => !open && setDeleteConfirmSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session for <strong>{deleteConfirmSession?.clientName}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmSession(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteConfirmSession) return;
                const sid = deleteConfirmSession.sessionId || String(deleteConfirmSession.id);
                setDeletingSessionId(sid);
                setDeleteConfirmSession(null);
                deleteMutation.mutate(sid);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={!!deletingSessionId}
            >
              {deletingSessionId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (standalone) {
    if (showVerificationWorkflow) {
      return (
        <PrecheckStandaloneShell
          pendingSessions={sidebarPending}
          completedSessions={sidebarCompleted}
          isLoading={isRecentLoading}
          onSelectSession={handleSidebarSelect}
          onTransmitSession={handleSidebarTransmit}
          onArchiveSession={handleSidebarArchive}
          actionBusy={sidebarActionBusy}
          userInitials={userInitials}
          managerEmail={userEmail}
          onSignOut={() => logout()}
        >
          <PrecheckWorkflowPanel onBack={() => setShowVerificationWorkflow(false)}>
            <VerificationWorkflow standalone onComplete={handleWorkflowComplete} />
          </PrecheckWorkflowPanel>
          {sessionModals}
        </PrecheckStandaloneShell>
      );
    }

    return (
      <PrecheckStandaloneShell
        pendingSessions={sidebarPending}
        completedSessions={sidebarCompleted}
        isLoading={isRecentLoading}
        onSelectSession={handleSidebarSelect}
        onTransmitSession={handleSidebarTransmit}
        onArchiveSession={handleSidebarArchive}
        actionBusy={sidebarActionBusy}
        userInitials={userInitials}
        managerEmail={userEmail}
        onSignOut={() => logout()}
      >
        <PrecheckStage>
          {isPrecheckDemo && (
            <div className="w-full max-w-lg mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
              Demo mode — sessions will not appear in management.
            </div>
          )}
          <div className="w-full max-w-[560px] text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-[#eef1f5] text-[#56607a] flex items-center justify-center mb-5">
              <Shield className="w-10 h-10 text-violet-600" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0f1729] mb-3">
              {precheckGreeting()}, {firstName}
            </h1>
            <p className="text-[15px] text-[#56607a] max-w-md leading-relaxed mb-8">
              Ready when you are — start a new policy verification for your client. Choose US, Canada, or New York
              track, then walk through agent and client verify steps.
            </p>
            <button
              type="button"
              onClick={() => setShowVerificationWorkflow(true)}
              className="relative inline-flex items-center justify-center rounded-full px-10 py-4 text-base font-semibold text-white bg-gradient-to-br from-violet-600 to-indigo-500 shadow-[0_14px_34px_rgba(124,58,237,0.35)] hover:brightness-105 transition-all"
            >
              Start New Precheck
            </button>
            <div className="flex flex-wrap gap-2 justify-center mt-8">
              <span className="inline-flex items-center gap-2 text-sm text-[#56607a] bg-white border border-[#e7eaf0] rounded-full px-4 py-2 shadow-sm">
                <MdVerifiedUser className="w-4 h-4 text-violet-600" />
                <b className="text-[#0f1729]">{pendingSessions.length}</b> pending
              </span>
              <span className="inline-flex items-center gap-2 text-sm text-[#56607a] bg-white border border-[#e7eaf0] rounded-full px-4 py-2 shadow-sm">
                <Award className="w-4 h-4 text-emerald-600" />
                <b className="text-[#0f1729]">{completedSessions.length}</b> completed
              </span>
            </div>
          </div>
        </PrecheckStage>
        {sessionModals}
      </PrecheckStandaloneShell>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {showVerificationWorkflow ? (
        /* In workflow: show track selector (US/Canada/NY) → method → client form → call → certificate */
        <div className="w-full h-full overflow-auto">
          <Button
            onClick={() => setShowVerificationWorkflow(false)}
            variant="outline"
            className="mb-4"
          >
            ← Back to AO Precheck
          </Button>
          <div className="max-w-4xl mx-auto px-4 py-4">
            <VerificationWorkflow onComplete={() => {
              setShowVerificationWorkflow(false);
              // Invalidate queries to refresh the session list
              queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/agent/recent'] });
            }} />
          </div>
        </div>
      ) : (
        <>
          {/* 🎭 DEMO MODE Banner */}
          {isPrecheckDemo && (
            <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 rounded-lg p-4 text-white border-2 border-yellow-400 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎭</span>
                  <div>
                    <h3 className="text-lg font-bold">DEMO MODE - AO Precheck</h3>
                    <p className="text-sm text-yellow-100">This is a training demo. Sessions created here will not appear in AO Precheck Management.</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    exitDemoMode();
                    if ((window as any).__demoExitHandler) {
                      (window as any).__demoExitHandler();
                    } else {
                      window.location.href = '/onboarding';
                    }
                  }}
                  variant="outline"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  Exit Demo
                </Button>
              </div>
            </div>
          )}
          
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Shield className="w-10 h-10 text-blue-600" />
                <PricingHoverCard type="ao-precheck">
                  <span
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent cursor-help"
                    style={{
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'inline-block',
                      lineHeight: '1.2'
                    }}
                  >
                    AO Precheck
                  </span>
                </PricingHoverCard>
              </h1>
            </div>
          </div>

          {/* Start a new Precheck - FIRST, at top */}
          <Card className="border-2 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <MdVerifiedUser className="w-6 h-6 text-blue-600" />
                <span>Start a new Precheck</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Select your track (US, Canada, or New York) and begin verification</p>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowVerificationWorkflow(true)}
              >
                Start Precheck →
              </Button>
            </CardContent>
          </Card>

          {/* SECTION 1a: Completed - Transmitted sessions */}
          <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Completed</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Transmitted sessions appear in AO Precheck Management</p>
        </CardHeader>
        <CardContent>
          {isRecentLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading recent verifications…</span>
            </div>
          ) : recentError ? (
            <div className="space-y-2 py-8 text-center text-destructive">
              <p>Unable to load your recent verifications.</p>
              <p className="text-xs text-muted-foreground">{recentErrorMessage}</p>
            </div>
          ) : completedSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MdVerifiedUser className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No completed transactions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800">
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Client</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Session ID</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Phone</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Status</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Type</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Transmit</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Completed</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSessions.map((session) => {
                    const completedDate = session.completedAt ? formatDateShort(session.completedAt) : null;
                    const completedTime = session.completedAt ? formatTime(session.completedAt) : null;
                    const transmittedDate = session.transmittedAt ? formatDateShort(session.transmittedAt) : null;
                    const transmittedTime = session.transmittedAt ? formatTime(session.transmittedAt) : null;
                    const displayDate = transmittedDate || completedDate;
                    const displayTime = transmittedTime || completedTime;
                    const statusLower = session.status?.toString().toLowerCase() ?? '';
                    const sid = session.sessionId || String(session.id);

                    return (
                      <tr key={session.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{session.clientName}</div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">{session.sessionId || session.id}</div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          <div className="text-xs text-slate-600 dark:text-slate-400">{session.clientPhone || '—'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          {session.transmitStatus === 'transmitted' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">Transmitted</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 text-xs">Pending</Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          <span className="text-xs text-slate-500">—</span>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <span className="text-xs text-slate-500">—</span>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          {displayDate && displayTime ? (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              <div>{displayDate}</div>
                              <div className="text-slate-500">{displayTime}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-48">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => setCertificateSession(session)}
                              title="View Certificate"
                            >
                              <Award className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => setScreenshotSession(session)}
                              disabled={!session.screenshotUrl}
                              title="View Screenshot"
                            >
                              <Image className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => setRecordingSession(session)}
                              disabled={!session.recordingUrl}
                              title="View Recording"
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeleteConfirmSession(session)}
                              title="Delete Session"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

          {/* SECTION 1b: Pending Transmit - Scrollable box */}
          <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Pending Transmit</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Complete verification to transmit to AO Precheck Management</p>
        </CardHeader>
        <CardContent>
          {pendingSessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p>No pending transmit</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Date/Time</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Client</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Session ID</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Phone</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Status</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Type</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Transmit</th>
                    <th className="text-left py-1.5 px-2 font-normal text-xs w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSessions.map((session) => {
                    const statusLower = session.status?.toString().toLowerCase() ?? '';
                    const isScheduledDelete = session.transmitStatus === 'scheduled_delete';
                    const sid = session.sessionId || String(session.id);
                    const createdDate = session.createdAt ? formatDateShort(session.createdAt) : null;
                    const createdTime = session.createdAt ? formatTime(session.createdAt) : null;

                    return (
                      <tr 
                        key={session.id} 
                        className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800 ${
                          isScheduledDelete ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                        }`}
                      >
                        <td className="py-1.5 px-2 w-32">
                          {createdDate && createdTime ? (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              <div>{createdDate}</div>
                              <div className="text-slate-500">{createdTime}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{session.clientName}</div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">{session.sessionId || session.id}</div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          <div className="text-xs text-slate-600 dark:text-slate-400">{session.clientPhone || '—'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          {isScheduledDelete ? (
                            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 text-xs">Scheduled Delete</Badge>
                          ) : statusLower === 'completed' ? (
                            <Badge className="bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 text-xs">Completed</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 text-xs">{formatStatus(statusLower)}</Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          {!isScheduledDelete ? (
                            <Select
                              value={transmitTypePerSession[sid] || 'live'}
                              onValueChange={(v) => {
                                setTransmitTypePerSession((p) => ({ ...p, [sid]: v as 'live' | 'training' | 'incomplete' }));
                              }}
                            >
                              <SelectTrigger className="w-full h-7 text-xs">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="live">Live</SelectItem>
                                <SelectItem value="training">Training</SelectItem>
                                <SelectItem value="incomplete">Incomplete</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRecoveringSessionId(sid);
                                recoverMutation.mutate(sid);
                              }}
                              disabled={recoveringSessionId === sid}
                              className="h-7 text-xs"
                            >
                              {recoveringSessionId === sid ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <RotateCcw className="h-3 w-3 mr-1" />
                              )}
                              Recover
                            </Button>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          {!isScheduledDelete ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const type = transmitTypePerSession[sid] || 'live';
                                setTransmittingSessionId(sid);
                                transmitMutation.mutate({ sessionId: sid, precheckType: type });
                              }}
                              disabled={transmittingSessionId === sid}
                              className="w-full h-7 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-900"
                            >
                              {transmittingSessionId === sid ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              Transmit
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-48">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => setCertificateSession(session)}
                              title="View Certificate"
                            >
                              <Award className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => setScreenshotSession(session)}
                              disabled={!session.screenshotUrl}
                              title="View Screenshot"
                            >
                              <Image className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => setRecordingSession(session)}
                              disabled={!session.recordingUrl}
                              title="View Recording"
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeleteConfirmSession(session)}
                              title="Delete Session"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

          {/* AO Precheck Guide Video */}
          <Card>
            <CardHeader>
              <CardTitle>Watch AO Precheck Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full md:w-auto" variant="outline">
                    <Play className="w-5 h-5 mr-2" />
                    Watch AO Precheck Guide
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>AO Precheck Guide</DialogTitle>
                  </DialogHeader>
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full max-w-4xl aspect-video">
                      <video
                        controls
                        className="w-full h-full rounded-lg shadow-lg object-contain"
                      >
                        <source
                          src="https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/ao_intelligence_-_how_to_do_a_precheck_call%20(1080p).mp4"
                          type="video/mp4"
                        />
                        <p className="text-center text-muted-foreground mt-4">
                          Your browser does not support the video tag. Please update your browser to view the AO Precheck Guide.
                        </p>
                      </video>
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Learn how to use AO Precheck verification system
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Verification System</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    {sessionModals}
    </>
  );
}