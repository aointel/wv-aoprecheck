import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Award,
  Calendar,
  Download,
  FileText,
  MapPin,
  MonitorPlay,
  Phone,
  Shield,
  User,
  Video,
} from 'lucide-react';
import React from 'react';

export interface PrecheckSession {
  id: string;
  sessionId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  method?: string | null;
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
  agentEmail?: string | null;
  agentFirstName?: string | null;
  agentLastName?: string | null;
  agentFullName?: string | null;
  agentMgaTeam?: string | null;
  agentRgaTeam?: string | null;
  callDuration?: number | null;
}

interface PrecheckSessionModalProps {
  open: boolean;
  onClose: () => void;
  session: PrecheckSession | null;
  allowCertificateDownload?: boolean;
}

const statusStyles: Record<string, string> = {
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

const formatStatus = (status?: string | null) =>
  (status ?? 'pending')
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatMethod = (method?: string | null) => {
  const normalized = (method ?? '').toString().toLowerCase();
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

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';

const formatPremium = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return value.toString();
  }
  return `$${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatScore = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Pending';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return value.toString();
  return `${numeric}/100`;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const openInNewTab = (url?: string | null) => {
  if (!url) return;
  const href = url.startsWith('http') ? url : url;
  window.open(href, '_blank', 'noopener,noreferrer');
};

export const PrecheckSessionModal: React.FC<PrecheckSessionModalProps> = ({
  open,
  onClose,
  session,
  allowCertificateDownload = true,
}) => {
  if (!session) {
    return (
      <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
        <DialogContent className="max-w-5xl"></DialogContent>
      </Dialog>
    );
  }

  const statusKey = session.status?.toString().toLowerCase() ?? 'pending';
  const statusClass = statusStyles[statusKey] ?? statusStyles.default;
  const methodClass = methodStyles[session.method?.toString().toLowerCase() ?? ''] ?? statusStyles.default;
  const agentName =
    session.agentFullName ||
    [session.agentFirstName, session.agentLastName].filter(Boolean).join(' ').trim() ||
    session.agentEmail ||
    'Unknown';
  const teams = [session.agentMgaTeam, session.agentRgaTeam].filter(Boolean).join(' • ') || 'Unassigned';
  const location = [session.city, session.state].filter(Boolean).join(', ') || 'Location unknown';

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-800 dark:text-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <User className="h-5 w-5" />
            </div>
            {session.clientName}
            <Badge className={statusClass}>{formatStatus(session.status)}</Badge>
            <Badge className={methodClass}>{formatMethod(session.method)}</Badge>
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Session ID: {session.sessionId || session.id}</span>
            <span>Created: {formatDateTime(session.createdAt)}</span>
            {session.completedAt && <span>Completed: {formatDateTime(session.completedAt)}</span>}
          </div>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Client information */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <User className="h-4 w-4 text-blue-500" />
              Client Information
            </h4>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Email</span>
                <span className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {session.clientEmail || 'Not provided'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Phone</span>
                <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                  <Phone className="h-4 w-4 text-blue-500" />
                  {session.clientPhone || 'Not provided'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Location</span>
                <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  {location}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Relationship</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{session.relationship || '—'}</span>
              </div>
            </div>
          </div>

          {/* Session details */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Shield className="h-4 w-4 text-purple-500" />
              Session Details
            </h4>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Producer</span>
                <span className="text-right font-medium text-slate-900 dark:text-slate-100">{agentName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Team</span>
                <span className="text-right font-medium text-slate-900 dark:text-slate-100">{teams}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Policy #</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{session.policyNumber || 'Pending'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Call Duration</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{formatDuration(session.callDuration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Method</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{formatMethod(session.method)}</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <FileText className="h-4 w-4 text-emerald-500" />
              Verification Metrics
            </h4>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Premium</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-300">
                  {formatPremium(session.premiumAmount ?? session.premiumRaw)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Score</span>
                <span className="font-semibold text-blue-600 dark:text-blue-300">{formatScore(session.verificationScore)}</span>
              </div>
              <div>
                <span className="text-xs uppercase text-slate-500">Notes</span>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {session.notes ? session.notes : 'No additional notes on this verification.'}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-slate-500">Created</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{formatDate(session.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Files */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <FileText className="h-4 w-4 text-indigo-500" />
            Verification Files
          </h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Award className="h-4 w-4 text-amber-500" />
                  Certificate
                </div>
                <Badge variant={session.certificateUrl ? 'default' : 'outline'}>
                  {session.certificateUrl ? 'Ready' : 'Pending'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Official verification certificate generated after a successful session.
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => openInNewTab(session.certificateUrl ?? undefined)}
                disabled={!session.certificateUrl || !allowCertificateDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Certificate
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Video className="h-4 w-4 text-blue-500" />
                  Screenshot
                </div>
                <Badge variant={session.screenshotUrl ? 'default' : 'outline'}>
                  {session.screenshotUrl ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Snapshot captured during the verification for compliance evidence.
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => openInNewTab(session.screenshotUrl ?? undefined)}
                disabled={!session.screenshotUrl}
              >
                <MonitorPlay className="mr-2 h-4 w-4" />
                View Screenshot
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Video className="h-4 w-4 text-purple-500" />
                  Recording
                </div>
                <Badge variant={session.recordingUrl ? 'default' : 'outline'}>
                  {session.recordingUrl ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Voice recording of the verification session for audit purposes.
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => openInNewTab(session.recordingUrl ?? undefined)}
                disabled={!session.recordingUrl}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Recording
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

