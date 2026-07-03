import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft, Loader2, Video, Users, RefreshCw } from 'lucide-react';

interface QueueEntry {
  id: number;
  user_email: string;
  name: string;
  issue_category: string;
  joined_at: string;
  position: number;
  status: string;
  zoom_link: string | null;
  booking_id: number | null;
}

const ISSUE_LABELS: Record<string, string> = {
  add_states: 'Add Licensed States',
  change_market: 'Change Market',
  fix_vdp: 'Fix VDP / Call Connector',
  login_issue: 'Login Issue',
  reset_password: 'Reset Password',
  billing: 'Billing & Credits',
  training: 'Training & Practice',
  something_else: 'Something Else',
  general: 'General',
};

function formatIssue(cat: string) {
  return ISSUE_LABELS[cat] || cat;
}

function formatJoined(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const SUPPORT_ZOOM_LINK = 'https://us06web.zoom.us/j/5692241629';

export default function HelpManagerPage() {
  const { authState } = useAuth();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [acceptModal, setAcceptModal] = useState<QueueEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userEmail = authState?.user?.email;

  const fetchActiveSessions = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch('/api/help/queue/active', {
        headers: { 'user-email': userEmail, 'x-user-email': userEmail },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data);
      }
    } catch {
      setActiveSessions([]);
    }
  }, [userEmail]);

  const fetchQueue = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch('/api/help/queue/list', {
        headers: { 'user-email': userEmail, 'x-user-email': userEmail },
      });
      if (res.status === 403) {
        setError('Manager access required. You do not have permission to view the support queue.');
        setEntries([]);
        return;
      }
      if (res.status === 401) {
        setError('Please sign in to access the support queue.');
        setEntries([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch queue');
      const data = await res.json();
      setEntries(data);
      setError(null);
      await fetchActiveSessions();
    } catch (e: any) {
      setError(e.message || 'Failed to load queue');
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail, fetchActiveSessions]);

  const handleComplete = async (entry: QueueEntry) => {
    if (!userEmail) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/help/queue/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-email': userEmail, 'x-user-email': userEmail },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to complete');
      }
      await fetchQueue();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to complete');
    } finally {
      setCompleting(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!userEmail) return;
    const interval = setInterval(() => { fetchActiveSessions(); }, 10000);
    return () => clearInterval(interval);
  }, [userEmail, fetchActiveSessions]);

  useEffect(() => {
    if (!acceptModal) return;
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, [acceptModal, fetchQueue]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchQueue();
  };

  const handleAccept = async () => {
    if (!acceptModal || !userEmail) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/help/queue/${acceptModal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'user-email': userEmail,
          'x-user-email': userEmail,
        },
        body: JSON.stringify({ status: 'in_session', zoomLink: SUPPORT_ZOOM_LINK }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to accept');
      }
      setAcceptModal(null);
      fetchQueue();
    } catch (e: any) {
      alert(e.message || 'Failed to accept meeting');
    } finally {
      setAccepting(false);
    }
  };

  if (!authState.initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center mb-4">
              Please sign in to access the support queue manager.
            </p>
            <Link href="/login">
              <Button className="w-full">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/help">
            <span className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Get Help
            </span>
          </Link>
          <span className="text-sm text-muted-foreground truncate max-w-[220px]">{userEmail}</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Support Queue
              </CardTitle>
              <CardDescription>
                View who is waiting and accept meetings to reveal the Zoom link to agents.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading || refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Active sessions - manager must Complete to remove from queue */}
                {activeSessions.length > 0 && (
                  <div className="mb-6 p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
                    <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-3">
                      Active sessions — click Complete when done to remove from queue
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-green-200 dark:border-green-800">
                            <th className="text-left py-2 px-2 font-medium">Name</th>
                            <th className="text-left py-2 px-2 font-medium">Email</th>
                            <th className="text-left py-2 px-2 font-medium">Issue</th>
                            <th className="text-right py-2 px-2 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSessions.map((e) => (
                            <tr key={e.id} className="border-b last:border-0 border-green-100 dark:border-green-900">
                              <td className="py-2 px-2">{e.name}</td>
                              <td className="py-2 px-2 text-muted-foreground">{e.user_email}</td>
                              <td className="py-2 px-2">{formatIssue(e.issue_category)}</td>
                              <td className="py-2 px-2 text-right">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleComplete(e)}
                                  disabled={completing}
                                >
                                  {completing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                  Complete
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* Waiting queue */}
                {entries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">#</th>
                        <th className="text-left py-3 px-2 font-medium">Name</th>
                        <th className="text-left py-3 px-2 font-medium">Email</th>
                        <th className="text-left py-3 px-2 font-medium">Issue</th>
                        <th className="text-left py-3 px-2 font-medium">Joined</th>
                        <th className="text-right py-3 px-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-2 font-mono">{e.position}</td>
                          <td className="py-3 px-2">{e.name}</td>
                          <td className="py-3 px-2 text-muted-foreground">{e.user_email}</td>
                          <td className="py-3 px-2">{formatIssue(e.issue_category)}</td>
                          <td className="py-3 px-2 text-muted-foreground">{formatJoined(e.joined_at)}</td>
                          <td className="py-3 px-2 text-right">
                            <Button
                              size="sm"
                              onClick={() => setAcceptModal(e)}
                            >
                              <Video className="w-4 h-4 mr-1" />
                              Accept
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
                {entries.length === 0 && activeSessions.length === 0 && !error && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No one is in the queue right now.</p>
                    <p className="text-sm mt-1">New entries will appear when agents join from the help page.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!acceptModal} onOpenChange={(open) => !open && setAcceptModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept meeting</DialogTitle>
            <DialogDescription>
              The agent will receive the support Zoom link (Meeting ID 569 224 1629) and can join immediately.
            </DialogDescription>
          </DialogHeader>
          {acceptModal && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                <strong>{acceptModal.name}</strong> ({acceptModal.user_email}) — {formatIssue(acceptModal.issue_category)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
