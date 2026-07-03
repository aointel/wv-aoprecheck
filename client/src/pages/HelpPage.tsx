import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { useQualityManagerPermissions } from '@/hooks/use-quality-manager-permissions';
import { useToast } from '@/hooks/use-toast';
import AlexAIActions from '@/components/alex-ai/AlexAIActions';
import { SUPPORT_SCHEDULE, useSupportLive } from '@/lib/support-schedule';
import {
  MapPin,
  Globe,
  Wrench,
  Key,
  CreditCard,
  GraduationCap,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Send,
  Loader2,
  Video,
  LogIn,
} from 'lucide-react';

const ISSUE_CATEGORIES = [
  { id: 'add_states', label: 'Add Licensed States', icon: MapPin },
  { id: 'change_market', label: 'Change Market', icon: Globe },
  { id: 'fix_vdp', label: 'Fix VDP / Call Connector Error', icon: Wrench },
  { id: 'login_issue', label: 'Login Issue', icon: LogIn },
  { id: 'reset_password', label: 'Reset Password', icon: Key },
  { id: 'billing', label: 'Billing & Credits', icon: CreditCard },
  { id: 'training', label: 'Training & Practice', icon: GraduationCap },
  { id: 'something_else', label: 'Something Else', icon: MessageSquare },
];

const FAQ_ITEMS = [
  { q: 'How do I add licensed states?', a: 'Use the "Add Licensed States" option above and select your states directly from the checklist.' },
  { q: 'How do I change my market?', a: 'Select "Change Market" above. You\'ll need to contact support to update your market assignment in the system.' },
  { q: 'My VDP isn\'t working. What should I do?', a: 'Try the "Fix VDP Error" option. Ensure your browser has microphone permissions and you\'ve accepted the disclaimer. Clear cache and refresh if needed.' },
  { q: 'I forgot my password. How do I reset it?', a: 'Use "Reset Password" above or go to the login page and click "Forgot Password."' },
  { q: 'How do I get live support?', a: 'Click "Get live help now" to join the queue immediately when support is online.' },
];

export default function HelpPage() {
  const { authState } = useAuth();
  const { isQualityManager, role } = useQualityManagerPermissions();
  const canManageQueue = isQualityManager || role === 'system_admin';
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [showScheduling, setShowScheduling] = useState(false);
  const [liveHelpNowOpen, setLiveHelpNowOpen] = useState(false);
  const [liveHelpNowLoading, setLiveHelpNowLoading] = useState(false);
  const { toast } = useToast();

  const isSupportLiveNow = useSupportLive();
  const userName = authState.user?.email
    ? authState.user.user_metadata?.full_name ||
      authState.user.user_metadata?.name ||
      authState.user.email.split('@')[0]
    : '';
  const userEmail = authState.user?.email || '';

  const handleGetLiveHelpNow = async (name?: string, email?: string, issueCategory?: string) => {
    const n = name ?? userName;
    const e = email ?? userEmail;
    if (!n || !e) {
      setLiveHelpNowOpen(true);
      return;
    }
    setLiveHelpNowLoading(true);
    try {
      const now = new Date();
      const slotEnd = new Date(now.getTime() + 10 * 60 * 1000);
      const res = await fetch('/api/help/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: e,
          name: n,
          slotStart: now.toISOString(),
          slotEnd: slotEnd.toISOString(),
          issueCategory: issueCategory || selectedIssue || 'general',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to join');
      }
      const data = await res.json();
      window.location.href = `/help/queue?booking=${data.id}`;
    } catch (err: unknown) {
      toast({ title: 'Could not join', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLiveHelpNowLoading(false);
      setLiveHelpNowOpen(false);
    }
  };

  const handleIssueSelect = (id: string) => {
    setSelectedIssue(id);
    setShowScheduling(false);
  };

  const handleBack = () => {
    setSelectedIssue(null);
    setShowScheduling(false);
  };

  const handleScheduleClick = () => {
    setShowScheduling(true);
    // Keep selectedIssue to pass to scheduling flow for issue_category
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Simple nav */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {canManageQueue && (
              <Link href="/help/manager">
                <Button variant="outline" size="sm">
                  Manage queue
                </Button>
              </Link>
            )}
            {authState.user ? (
              <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                {userEmail}
              </span>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/join">
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    Get your account
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            Get Help
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Find answers, get live support
          </p>
        </div>

        {!selectedIssue && !showScheduling && (
          <>
            {/* Issue selector */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                What do you need help with?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ISSUE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <Card
                      key={cat.id}
                      className="cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                      onClick={() => handleIssueSelect(cat.id)}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-sm sm:text-base">{cat.label}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Live help CTAs — "Get live help now" only during active support windows */}
            <section className="mb-12 space-y-4">
              {isSupportLiveNow && (
                <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Video className="w-10 h-10 text-green-600" />
                      <div>
                        <h3 className="font-semibold">Get live help now</h3>
                        <p className="text-sm text-muted-foreground">
                          Join the queue immediately — no scheduling required
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleGetLiveHelpNow()}
                      disabled={liveHelpNowLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {liveHelpNowLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Video className="w-4 h-4 mr-2" />}
                      Get live help now
                    </Button>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Frequently Asked Questions
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {FAQ_ITEMS.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="border rounded-lg px-4 bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            {/* Support links */}
            <section className="mt-12 pt-8 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                More resources
              </h3>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Documentation
                </a>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Help Center
                </a>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Status
                </a>
              </div>
            </section>
          </>
        )}

        {/* Selected issue: self-support content */}
        {selectedIssue && !showScheduling && (
          <section>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to options
            </Button>

            {['billing', 'training', 'login_issue'].includes(selectedIssue) ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedIssue === 'billing' ? 'Billing & Credits' : selectedIssue === 'training' ? 'Training & Practice' : 'Login Issue'}
                  </CardTitle>
                  <CardDescription>
                    {selectedIssue === 'billing'
                      ? 'For billing questions, check your Subscription or Billing Dashboard. For credit issues, contact your team lead.'
                      : selectedIssue === 'training'
                      ? 'Access training videos and practice tools from the Onboarding or Training sections in the app.'
                      : 'Having trouble signing in? Try "Reset Password" from the login page, or get live support to help you access your account.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handleGetLiveHelpNow()} className="mt-2">
                    Get live help now
                  </Button>
                </CardContent>
              </Card>
            ) : selectedIssue === 'something_else' ? (
              <SomethingElseForm
                defaultEmail={userEmail}
                defaultName={userName}
                onScheduleClick={handleScheduleClick}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {ISSUE_CATEGORIES.find((c) => c.id === selectedIssue)?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AlexAIActions initialAction={selectedIssue} />
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">
                      Still need help?
                    </p>
                    <Button onClick={() => handleGetLiveHelpNow()}>
                      Get live help now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Scheduling flow */}
        {showScheduling && (
          <HelpSchedulingFlow
            userEmail={userEmail}
            userName={userName}
            defaultIssueCategory={selectedIssue || 'general'}
            onBack={handleBack}
          />
        )}

        {/* Get live help now – collect details when not logged in */}
        <Dialog open={liveHelpNowOpen} onOpenChange={setLiveHelpNowOpen}>
          <LiveHelpNowDialog
            defaultName={userName}
            defaultEmail={userEmail}
            defaultIssue={selectedIssue || 'general'}
            onSubmit={(name, email, issue) => {
              handleGetLiveHelpNow(name, email, issue);
            }}
            onCancel={() => setLiveHelpNowOpen(false)}
            loading={liveHelpNowLoading}
          />
        </Dialog>
      </div>
    </div>
  );
}

function LiveHelpNowDialog({
  defaultName,
  defaultEmail,
  defaultIssue,
  onSubmit,
  onCancel,
  loading,
}: {
  defaultName: string;
  defaultEmail: string;
  defaultIssue: string;
  onSubmit: (name: string, email: string, issue: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [issue, setIssue] = useState(defaultIssue);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Get live help now</DialogTitle>
        <DialogDescription>
          Enter your details to join the support queue. You&apos;ll be connected with a support agent shortly.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div>
          <Label>Your name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1" required />
        </div>
        <div>
          <Label>Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="mt-1" required />
        </div>
        <div>
          <Label>Issue</Label>
          <select
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
            <option value="general">General</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSubmit(name, email, issue)} disabled={!name || !email || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Join queue now
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function SomethingElseForm({
  defaultEmail,
  defaultName,
  onScheduleClick,
}: {
  defaultEmail: string;
  defaultName: string;
  onScheduleClick: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: defaultName || '',
    email: defaultEmail || '',
    subject: '',
    category: '',
    message: '',
    urgency: 'normal',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast({ title: 'Missing information', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/help/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          userId: 'anonymous',
        }),
      });
      if (res.ok) {
        toast({ title: 'Help request sent', description: "We'll get back to you soon." });
        setFormData({ ...formData, subject: '', message: '' });
      } else {
        throw new Error('Failed to submit');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Something Else</CardTitle>
        <CardDescription>Submit a support request and we&apos;ll get back to you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical Support</SelectItem>
                  <SelectItem value="call-connector">Call Connector Pro</SelectItem>
                  <SelectItem value="verification">AO PreCheck/Verification</SelectItem>
                  <SelectItem value="billing">Billing & Credits</SelectItem>
                  <SelectItem value="account">Account Setup</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={formData.urgency} onValueChange={(v) => setFormData((p) => ({ ...p, urgency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Subject *</Label>
            <Input value={formData.subject} onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))} placeholder="Brief description" required />
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea value={formData.message} onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))} rows={4} required />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send request
            </Button>
            <Button type="button" variant="outline" onClick={onScheduleClick}>
              Or schedule live support
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const SLOT_DURATION_MS = 10 * 60 * 1000; // 10 min
const PST = 'America/Los_Angeles';

function pstToUTC(year: number, month: number, day: number, hour: number, min: number): number {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  // US DST: 2nd Sunday Mar - 1st Sunday Nov. Feb is never DST; avoid broken heuristics.
  const inDST = month >= 3 && month <= 10;
  return new Date(iso + (inDST ? '-07:00' : '-08:00')).getTime();
}

// Get next N Mon/Tue/Thu dates in PST
function getValidDays(count: number): { y: number; m: number; d: number; label: string; dow: number }[] {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: PST, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  let y = get('year');
  let m = get('month');
  let d = get('day');
  const out: { y: number; m: number; d: number; label: string; dow: number }[] = [];
  for (let i = 0; i < count * 3; i++) {
    const dow = new Date(pstToUTC(y, m, d, 12, 0)).getUTCDay();
    const sched = SUPPORT_SCHEDULE.find((s) => s.dayOfWeek === dow);
    if (sched) {
      const date = new Date(pstToUTC(y, m, d, 12, 0));
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: PST });
      out.push({ y, m, d, label: dateStr, dow });
      if (out.length >= count) break;
    }
    const nextTs = pstToUTC(y, m, d, 12, 0) + 86400000;
    const nextParts = new Intl.DateTimeFormat('en-CA', { timeZone: PST, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(nextTs));
    y = parseInt(nextParts.find((p) => p.type === 'year')?.value || '0', 10);
    m = parseInt(nextParts.find((p) => p.type === 'month')?.value || '0', 10);
    d = parseInt(nextParts.find((p) => p.type === 'day')?.value || '0', 10);
  }
  return out;
}

// Get valid time slots for a given day (10-min increments, only within schedule)
function getValidTimesForDay(y: number, m: number, d: number, dow: number): { slotStart: Date; slotEnd: Date; label: string }[] {
  const sched = SUPPORT_SCHEDULE.find((s) => s.dayOfWeek === dow);
  if (!sched) return [];
  const now = new Date();
  const slots: { slotStart: Date; slotEnd: Date; label: string }[] = [];
  for (let slotMin = sched.startMin; slotMin + 10 <= sched.endMin; slotMin += 10) {
    const sh = Math.floor(slotMin / 60);
    const sm = slotMin % 60;
    const slotStartTs = pstToUTC(y, m, d, sh, sm);
    const slotEndTs = slotStartTs + SLOT_DURATION_MS;
    if (slotStartTs <= now.getTime()) continue;
    const slotStart = new Date(slotStartTs);
    const slotEnd = new Date(slotEndTs);
    const timeStr = slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PST });
    slots.push({ slotStart, slotEnd, label: timeStr });
  }
  return slots;
}

function HelpSchedulingFlow({
  userEmail,
  userName,
  defaultIssueCategory = 'general',
  onBack,
}: {
  userEmail: string;
  userName: string;
  defaultIssueCategory?: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<{ y: number; m: number; d: number; label: string; dow: number } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ slotStart: Date; slotEnd: Date; label: string } | null>(null);
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(userEmail || '');
  const [issueCategory, setIssueCategory] = useState(defaultIssueCategory);
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const validDays = getValidDays(6);
  const validTimes = selectedDay ? getValidTimesForDay(selectedDay.y, selectedDay.m, selectedDay.d, selectedDay.dow) : [];
  const slotStarts = validTimes.map((t) => t.slotStart.toISOString());
  const { data: availabilityData } = useQuery({
    queryKey: ['/api/help/bookings/availability', slotStarts.join(',')],
    queryFn: async () => {
      const res = await fetch(`/api/help/bookings/availability?slots=${encodeURIComponent(slotStarts.join(','))}`);
      if (!res.ok) throw new Error('Failed to fetch');
        return res.json() as Promise<{ slots: { [k: string]: number } }>;
    },
    enabled: selectedDay !== null && slotStarts.length > 0,
  });
  const slotCounts = availabilityData?.slots ?? {};
  const SLOTS_PER_SLOT = 3;
  const issueLabel = ISSUE_CATEGORIES.find((c) => c.id === issueCategory)?.label || 'General';

  const handleBook = async () => {
    if (!selectedSlot || !selectedDay || !name || !email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/help/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: email,
          name,
          slotStart: selectedSlot.slotStart.toISOString(),
          slotEnd: selectedSlot.slotEnd.toISOString(),
          issueCategory,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || 'Failed to create booking';
        toast({ title: 'Booking failed', description: msg, variant: 'destructive' });
        return;
      }
      setBookingId(data.id);
      setBooked(true);
    } catch (e: unknown) {
      toast({ title: 'Booking failed', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (booked && bookingId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
              Booking confirmed!
            </h3>
            <p className="text-muted-foreground">
              Your slot: {selectedDay!.label}, {selectedSlot!.label} PST
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You can join the queue anytime. You can browse the site — your queue status will follow you.
            </p>
            <Link href={`/help/queue?booking=${bookingId}`}>
              <Button className="mt-4">Go to queue when ready</Button>
            </Link>
            <div className="pt-4">
              <Button variant="ghost" onClick={onBack}>
                Back to help
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Live Support Queue
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400 text-left sm:text-right"
        >
          View & edit details
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <p className="text-sm font-medium mb-2">Day</p>
          <div className="flex flex-wrap gap-2">
            {validDays.map((day) => (
              <button
                key={day.label}
                type="button"
                onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}
                className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                  selectedDay?.label === day.label
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 font-medium'
                    : 'border-input hover:bg-muted/50'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        {selectedDay && (
          <div>
            <p className="text-sm font-medium mb-2">Time (PST)</p>
            <div className="flex flex-wrap gap-2">
              {validTimes.map((t) => {
                const count = slotCounts[t.slotStart.toISOString()] ?? 0;
                const isFull = count >= SLOTS_PER_SLOT;
                return (
                  <button
                    key={t.label}
                    type="button"
                    disabled={isFull}
                    onClick={() => !isFull && setSelectedSlot(t)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                      isFull
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : selectedSlot?.label === t.label
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 font-medium'
                          : 'border-input hover:bg-muted/50'
                    }`}
                    title={isFull ? `${count}/${SLOTS_PER_SLOT} filled` : undefined}
                  >
                    {t.label}{isFull ? ` (${count}/${SLOTS_PER_SLOT})` : ''}
                  </button>
                );
              })}
              {validTimes.length === 0 && <p className="text-sm text-muted-foreground">No slots left today</p>}
            </div>
          </div>
        )}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleBook}
        disabled={loading || !selectedSlot || !selectedDay || !name || !email}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Book & get live support
      </Button>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View & edit details</DialogTitle>
            <DialogDescription>
              Update your contact info and the issue you need help with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Your name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="mt-1" />
            </div>
            <div>
              <Label>Issue</Label>
              <select
                value={issueCategory}
                onChange={(e) => setIssueCategory(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
                <option value="general">General</option>
              </select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
