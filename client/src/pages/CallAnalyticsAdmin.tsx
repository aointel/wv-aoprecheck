import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : '';
}

/** Recording exists only when it is a Supabase URL (call transcripts). API returns recording_url only in that case. */
function isSupabaseRecordingUrl(url: string | null | undefined): boolean {
  const u = (url || '').trim();
  return u.startsWith('http') && u.includes('supabase');
}

function getRecordingPlaybackUrl(session: { recording_url?: string; taalk_call_id?: string }): string | null {
  if (!session) return null;
  const raw = (session.recording_url || '').trim();
  if (!isSupabaseRecordingUrl(raw)) return null;
  return raw;
}
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import * as localAnalytics from '@/lib/local-call-analytics';
import { 
  Filter, 
  Eye, 
  Calendar, 
  User, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock,
  Download,
  RefreshCw,
  Play,
  Pause,
  FileText,
  Bot,
  Volume2,
  AlertTriangle,
  TrendingUp,
  Award,
  Settings2
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface TransferCall {
  id: number;
  transaction_id: string;
  agent_email: string;
  agent_name?: string;
  agent_associate_id?: number;
  transaction_date: string;
  call_time?: string;
  lead_name?: string;
  lead_phone?: string;
  lead_email?: string;
  amount_usd: string;
  credits_charged: number;
  status: string;
  market?: string;
  transaction_type?: string; // 'connect' or 'inbound'
  type_label?: string; // e.g. 'CCPRO' for outbound Twilio
  agent_rga_team?: string;
  agent_mga_team?: string;
  analysis?: {
    call_score?: number;
    analysis_status?: string;
    analyzed_at?: string;
    sentiment?: string;
    call_outcome?: string;
  };
  has_analysis?: boolean;
  taalk_call_id?: string;
  recording_url?: string;
  transcript?: string;
  call_duration?: number; // Duration in seconds
}

interface DispositionRuleRow {
  id: string;
  label: string;
  description: string;
  prompt_instructions?: string | null;
  min_duration_sec?: number | null;
  max_duration_sec?: number | null;
  scorecard_zero?: boolean;
  transcript_indicators?: string[];
  must_not_contain?: string[];
  call_outcome_mapping?: string[];
  sort_order?: number;
  active?: boolean;
  updated_at?: string;
}

interface CallAnalysis {
  transfer: TransferCall;
  analytics: {
    id: number;
    billing_transaction_id: string;
    agent_email: string;
    call_date: string;
    taalk_call_id?: string;
    recording_url?: string;
    transcript?: string;
    transcript_source?: string;
    call_score?: number;
    scorecard_results?: any;
    coaching_notes?: string;
    key_topics?: string[];
    objections_detected?: string[];
    sentiment_score?: number;
    sentiment_label?: string;
    agent_talk_time_pct?: number;
    client_engagement_level?: string;
    call_outcome?: string;
    call_outcome_confidence?: number;
    outcome?: string;
    compliance_flags?: any;
    key_moments?: Array<{ timestamp: string; description: string }>;
    ai_analysis?: any;
    analyzed_at?: string;
  } | null;
}

function DispositionRuleForm({
  rule,
  onSave,
  onCancel,
  isPending,
}: {
  rule: DispositionRuleRow;
  onSave: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(rule.label);
  const [description, setDescription] = useState(rule.description);
  const [promptInstructions, setPromptInstructions] = useState(rule.prompt_instructions ?? '');
  const [minDurationSec, setMinDurationSec] = useState(rule.min_duration_sec != null ? String(rule.min_duration_sec) : '');
  const [maxDurationSec, setMaxDurationSec] = useState(rule.max_duration_sec != null ? String(rule.max_duration_sec) : '');
  const [scorecardZero, setScorecardZero] = useState(rule.scorecard_zero ?? false);
  const [sortOrder, setSortOrder] = useState(rule.sort_order != null ? String(rule.sort_order) : '0');
  const [active, setActive] = useState(rule.active ?? true);
  const [transcriptIndicators, setTranscriptIndicators] = useState(
    Array.isArray(rule.transcript_indicators) ? rule.transcript_indicators.join(', ') : ''
  );
  const [mustNotContain, setMustNotContain] = useState(
    Array.isArray(rule.must_not_contain) ? rule.must_not_contain.join(', ') : ''
  );
  const [callOutcomeMapping, setCallOutcomeMapping] = useState(
    Array.isArray(rule.call_outcome_mapping) ? rule.call_outcome_mapping.join(', ') : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      label: label.trim(),
      description: description.trim(),
      prompt_instructions: promptInstructions.trim() || null,
      min_duration_sec: minDurationSec.trim() ? parseInt(minDurationSec, 10) : null,
      max_duration_sec: maxDurationSec.trim() ? parseInt(maxDurationSec, 10) : null,
      scorecard_zero: scorecardZero,
      sort_order: parseInt(sortOrder, 10) || 0,
      active,
      transcript_indicators: transcriptIndicators.split(',').map((s) => s.trim()).filter(Boolean),
      must_not_contain: mustNotContain.split(',').map((s) => s.trim()).filter(Boolean),
      call_outcome_mapping: callOutcomeMapping.split(',').map((s) => s.trim()).filter(Boolean),
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="label">Label</Label>
          <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" required />
        </div>
        <div>
          <Label htmlFor="prompt">Prompt instructions (optional)</Label>
          <Textarea id="prompt" value={promptInstructions} onChange={(e) => setPromptInstructions(e.target.value)} rows={2} className="mt-1" placeholder="Extra instructions for AI" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minDuration">Min duration (sec)</Label>
            <Input id="minDuration" type="number" min={0} value={minDurationSec} onChange={(e) => setMinDurationSec(e.target.value)} className="mt-1" placeholder="empty" />
          </div>
          <div>
            <Label htmlFor="maxDuration">Max duration (sec)</Label>
            <Input id="maxDuration" type="number" min={0} value={maxDurationSec} onChange={(e) => setMaxDurationSec(e.target.value)} className="mt-1" placeholder="empty" />
          </div>
        </div>
        <div>
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="transcriptIndicators">Transcript indicators (comma-separated)</Label>
          <Textarea id="transcriptIndicators" value={transcriptIndicators} onChange={(e) => setTranscriptIndicators(e.target.value)} rows={2} className="mt-1" placeholder="leave a message, voicemail, ..." />
        </div>
        <div>
          <Label htmlFor="mustNotContain">Must NOT contain (comma-separated)</Label>
          <Textarea id="mustNotContain" value={mustNotContain} onChange={(e) => setMustNotContain(e.target.value)} rows={2} className="mt-1" placeholder="prospect said, client said, ..." />
        </div>
        <div>
          <Label htmlFor="callOutcomeMapping">Call outcome mapping (comma-separated)</Label>
          <Input id="callOutcomeMapping" value={callOutcomeMapping} onChange={(e) => setCallOutcomeMapping(e.target.value)} className="mt-1" placeholder="BOOKED, CALLBACK, ..." />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="scorecardZero" checked={scorecardZero} onCheckedChange={(v) => setScorecardZero(!!v)} />
            <Label htmlFor="scorecardZero">Scorecard zero</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="active" checked={active} onCheckedChange={(v) => setActive(!!v)} />
            <Label htmlFor="active">Active</Label>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

export default function CallAnalyticsAdmin() {
  console.log('🚀 CallAnalyticsAdmin component loaded');

  const { authState } = useAuth();
  const userEmail = authState?.user?.email?.toLowerCase();

  const [selectedTransfer, setSelectedTransfer] = useState<TransferCall | null>(null);
  const [detailData, setDetailData] = useState<CallAnalysis | null>(null);
  const [recordingSession, setRecordingSession] = useState<TransferCall | null>(null);
  const [transcriptSession, setTranscriptSession] = useState<TransferCall | null>(null);

  const [dateRange, setDateRange] = useState('all'); // Default to 'all' to show all transfers
  const [dispositionFilter, setDispositionFilter] = useState('all'); // Filter by outcome/disposition
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(250);
  const [editingRule, setEditingRule] = useState<DispositionRuleRow | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, dispositionFilter, pageSize]);

  const { data: transfersData, isLoading, refetch: refetchTransfers } = useQuery({
    queryKey: ['/api/call-analytics/transfers', { dateRange, dispositionFilter, currentPage, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange !== 'all') params.append('dateRange', dateRange);
      if (dispositionFilter !== 'all') params.append('outcome', dispositionFilter);
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      const response = await apiRequest('GET', `/api/call-analytics/transfers?${params.toString()}`);
      const result = await response.json();
      return result;
    },
    refetchInterval: 20000,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/call-analytics/stats', { dateRange, dispositionFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange !== 'all') params.append('dateRange', dateRange);
      if (dispositionFilter !== 'all') params.append('outcome', dispositionFilter);
      
      console.log('📈 Fetching call analytics stats...');
      const response = await apiRequest('GET', `/api/call-analytics/stats?${params.toString()}`);
      const result = await response.json();
      console.log('📊 Call analytics stats result:', result);
      return result || { total: 0, analyzed: 0, pending: 0, avg_score: 0 };
    },
    refetchInterval: 20000,
    staleTime: 0,
    gcTime: 0,
  });

  const transfers = transfersData?.transfers || [];
  const pagination = transfersData?.pagination || { page: 1, limit: 100, total: 0, totalPages: 0 };

  // Fetch transfer detail when selected
  const { data: transferDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['/api/call-analytics/transfers', selectedTransfer?.transaction_id],
    queryFn: async () => {
      if (!selectedTransfer) return null;
      const response = await apiRequest('GET', `/api/call-analytics/transfers/${selectedTransfer.transaction_id}`);
      return response.json();
    },
    enabled: !!selectedTransfer,
  });

  useEffect(() => {
    if (transferDetail) {
      setDetailData(transferDetail);
    } else if (selectedTransfer && !isLoadingDetail) {
      // If no detail data yet, set basic structure
      setDetailData({
        transfer: selectedTransfer,
        analytics: null
      });
    }
  }, [transferDetail, selectedTransfer, isLoadingDetail]);

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await apiRequest('POST', `/api/call-analytics/analyze/${transactionId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Analysis started. Refresh in 30–60 sec to see results." });
      queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/stats'] });
      if (selectedTransfer) {
        queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/transfers', selectedTransfer.transaction_id] });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to start analysis", 
        description: error.message || "Unknown error",
        variant: "destructive" 
      });
    }
  });

  const handleAnalyze = (transfer: TransferCall) => {
    analyzeMutation.mutate(transfer.transaction_id);
  };

  const { data: dispositionRulesData, refetch: refetchDispositionRules } = useQuery({
    queryKey: ['/api/call-analytics/disposition-rules'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/call-analytics/disposition-rules');
      const result = await response.json();
      return result;
    },
    enabled: true,
  });
  const dispositionRules: DispositionRuleRow[] = dispositionRulesData?.rules ?? [];

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest('PUT', `/api/call-analytics/disposition-rules/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Disposition rule updated' });
      setEditingRule(null);
      refetchDispositionRules();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update rule', description: error?.message, variant: 'destructive' });
    },
  });

  const exportToCSV = () => {
    const csvData = transfers.map((transfer: any) => ({
      'Transaction ID': transfer.transaction_id,
      'Associate ID': transfer.agent_associate_id ?? '',
      'Agent Email': transfer.agent_email,
      'Agent Name': transfer.agent_name || '',
      'Client Name': transfer.lead_name || '',
      'Client Phone': transfer.lead_phone || '',
      'Date': new Date(transfer.transaction_date).toLocaleString(),
      'Amount': transfer.amount_usd,
      'Credits': transfer.credits_charged,
      'Status': transfer.status,
      'MGA Team': transfer.agent_mga_team || '',
      'RGA Team': transfer.agent_rga_team || '',
      'Call Score': transfer.analysis?.call_score || '',
      'Analysis Status': transfer.analysis?.analysis_status || 'pending',
      'Sentiment': transfer.analysis?.sentiment || '',
      'Outcome (CCPRO)': transfer.analysis?.outcome || transfer.analysis?.call_outcome || ''
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-analytics-transfers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper function to convert names to proper case (SAME AS LIVE CALL BOARD)
  const toProperCase = (name: string): string => {
    if (!name || name === '-') return '-';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getScoreColor = (score?: number): string => {
    if (!score) return 'bg-slate-100 text-slate-600';
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                Call Analytics - Taalk Transfers
              </h1>
              <p className="text-muted-foreground mt-1">
                AI-powered call scoring and analysis for Taalk transfer calls (connects)
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  try {
                    toast({ title: 'Analyzing all pending calls...' });
                    const r = await apiRequest('POST', '/api/call-analytics/run-all');
                    await r.json();
                    toast({ title: 'Analysis started - processing in background' });
                    setTimeout(() => {
                      refetchTransfers();
                      queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/transfers'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/stats'] });
                    }, 3000);
                  } catch (e: any) {
                    toast({ title: 'Failed', description: e?.message, variant: 'destructive' });
                  }
                }}
              >
                <Bot className="h-4 w-4 mr-2" />
                Analyze All Now
              </Button>
              <Button
                onClick={async () => {
                  await refetchTransfers();
                  queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/transfers'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/call-analytics/stats'] });
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Direct API Fetch
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Fetch Directly from Twilio & Taalk</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Twilio Account SID</Label>
                      <Input
                        type="text"
                        placeholder="AC..."
                        defaultValue={localStorage.getItem('twilio_account_sid') || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            localAnalytics.setCredentials({ twilioSid: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>Twilio Auth Token</Label>
                      <Input
                        type="password"
                        placeholder="Your auth token"
                        defaultValue={localStorage.getItem('twilio_auth_token') || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            localAnalytics.setCredentials({ twilioToken: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>Taalk API Key (optional - has default)</Label>
                      <Input
                        type="text"
                        placeholder="Bearer token"
                        defaultValue={localStorage.getItem('taalk_api_key') || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            localAnalytics.setCredentials({ taalkApiKey: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          toast({ title: 'Fetching from Twilio API...' });
                          const calls = await localAnalytics.fetchTwilioCalls();
                          toast({ title: `Fetched ${calls.length} calls from Twilio` });
                          
                          // Store in local storage
                          for (const call of calls.slice(0, 50)) { // Limit to 50 for now
                            await localAnalytics.storeTransfer({
                              transaction_id: call.sid,
                              agent_email: call.from,
                              transaction_date: call.startTime,
                              lead_phone: call.to,
                              status: call.status,
                              // Map other fields as needed
                            });
                          }
                          
                          toast({ title: 'Stored in local IndexedDB', description: 'Data is now available offline' });
                          await refetchTransfers();
                        } catch (error: any) {
                          toast({ 
                            title: 'Error fetching from Twilio', 
                            description: error.message,
                            variant: 'destructive'
                          });
                        }
                      }}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Fetch from Twilio & Store Locally
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will fetch call data directly from Twilio API and store it in your browser's IndexedDB. 
                      Works offline and doesn't require Supabase.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <Tabs defaultValue="transfers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-xs mb-4">
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="rules">
              <Settings2 className="h-4 w-4 mr-2" />
              Disposition Rules
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transfers" className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">Total Transfers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats?.analyzed ?? 0}</div>
              <p className="text-xs text-muted-foreground">Analyzed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</div>
              <p className="text-xs text-muted-foreground">Pending Analysis</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats?.avg_score ? stats.avg_score.toFixed(1) : '0'}</div>
              <p className="text-xs text-muted-foreground">Avg Call Score</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters: Date, Disposition, Per page */}
        <Card className="mb-4">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-slate-600 dark:text-slate-400">Total: <span className="text-slate-900 dark:text-slate-100 font-medium">{stats?.total ?? 0}</span></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">Analyzed: <span className="text-green-600 font-medium">{stats?.analyzed ?? 0}</span></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">Pending: <span className="text-yellow-600 font-medium">{stats?.pending ?? 0}</span></span>
              <span className="flex-1" />
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">Disposition:</span>
                <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs border-blue-200 bg-blue-50/50">
                    <SelectValue placeholder="Filter by outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="_none_">No outcome / Pending</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                    <SelectItem value="call_back">Call Back</SelectItem>
                    <SelectItem value="instant_presentation">Instant Presentation</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="no_answer_vm">No Answer / VM</SelectItem>
                    <SelectItem value="short_ring">Short Ring</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="dnc">DNC</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number</SelectItem>
                    <SelectItem value="duplicate">Duplicate</SelectItem>
                    <SelectItem value="over_age">Over Age</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-slate-400">|</span>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-slate-600 dark:text-slate-400">Per page:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1,000</SelectItem>
                  <SelectItem value="2000">2,000</SelectItem>
                  <SelectItem value="5000">5,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transfers Table - EXACT COPY OF LIVE CALL BOARD */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Transfer Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading transfers...</div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No transfers found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800">
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-28">Transfer ID</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-20">Status</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Score</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Outcome</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Producer</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-20">Assoc ID</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Client</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Phone</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Type</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-20">Market</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-16">Duration</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Date</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-20">Time</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-40">Actions</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((transfer: TransferCall) => (
                      <tr key={transfer.id || transfer.transaction_id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="py-1.5 px-2 w-28">
                          <div className="text-xs font-mono truncate max-w-[10rem]" title={transfer.transaction_id}>{transfer.transaction_id || '—'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-20">
                          {transfer.has_analysis ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs px-1 py-0">
                              Analyzed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 text-xs px-1 py-0">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-2 w-16">
                          <div className="flex justify-center gap-1">
                            {transfer.analysis?.call_score !== null && transfer.analysis?.call_score !== undefined ? (
                              <Badge className={`${getScoreColor(transfer.analysis.call_score)} text-xs px-1 py-0`}>
                                {transfer.analysis.call_score.toFixed(0)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          <div className="text-xs truncate" title={transfer.analysis?.outcome || transfer.analysis?.call_outcome || ''}>
                            {transfer.analysis?.outcome || transfer.analysis?.call_outcome || '—'}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs truncate">{toProperCase(transfer.agent_name || 'N/A')}</div>
                        </td>
                        <td className="py-1.5 px-2 w-20">
                          <div className="text-xs font-mono">{transfer.agent_associate_id ?? '—'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs truncate">{transfer.lead_name || 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          <div className="text-xs truncate">{transfer.lead_phone || 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-16 text-center">
                          <Badge className={`${transfer.transaction_type === 'connect' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} text-xs px-1 py-0`}>
                            {transfer.type_label || (transfer.transaction_type || 'connect').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 w-20">
                          <div className="text-xs truncate">{transfer.market || '-'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-16 text-center">
                          <div className="text-xs">
                            {transfer.call_duration ? `${Math.floor(transfer.call_duration / 60)}:${(transfer.call_duration % 60).toString().padStart(2, '0')}` : '—'}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 w-36">
                          <div className="text-xs whitespace-nowrap">{new Date(transfer.transaction_date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                        </td>
                        <td className="py-1.5 px-2 w-20">
                          <div className="text-xs whitespace-nowrap">{transfer.call_time || (transfer.transaction_date ? new Date(transfer.transaction_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')}</div>
                        </td>
                        <td className="py-1.5 px-2 w-40">
                          <div className="flex gap-1">
                            {/* Recording Button - only enabled when we have a Supabase recording URL (call transcripts) */}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!getRecordingPlaybackUrl(transfer)}
                              className={`h-6 w-6 p-0 ${getRecordingPlaybackUrl(transfer) ? 'text-white bg-purple-600 hover:bg-purple-700 border-purple-600 hover:border-purple-700 shadow-md' : 'text-gray-400 cursor-not-allowed border-gray-300'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (getRecordingPlaybackUrl(transfer)) {
                                  setRecordingSession(transfer);
                                }
                              }}
                              title={getRecordingPlaybackUrl(transfer) ? 'Play Recording' : (transfer.taalk_call_id ? 'No recording yet (Supabase only)' : 'No call ID')}
                            >
                              <Play className="h-3 w-3" />
                            </Button>

                            {/* Transcript Button - Icon Only */}
                            {transfer.transcript && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700"
                                    onClick={() => {
                                      setTranscriptSession(transfer);
                                    }}
                                    title="View Transcript"
                                  >
                                    <FileText className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                              </Dialog>
                            )}

                            {/* View Details Button - Icon Only */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                              onClick={() => setSelectedTransfer(transfer)}
                              title="View Details"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>

                            {/* Analyze Button - Icon Only (if not analyzed) */}
                            {!transfer.has_analysis && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                onClick={() => handleAnalyze(transfer)}
                                disabled={analyzeMutation.isPending}
                                title="Analyze Call"
                              >
                                <Bot className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs truncate">
                            {toProperCase(transfer.agent_mga_team || '-')}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transfers.length > 0 && transfers.filter((t) => getRecordingPlaybackUrl(t)).length === 0 && (
                      <tr>
                        <td colSpan={15} className="py-4 text-center text-slate-500 text-sm">
                          No recording available for these calls (e.g. VDP connects). Play button appears when a Supabase recording exists.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-xs text-slate-600">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Disposition Rules</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Rules used by the AI to assign outcomes. Edit and save to apply.
                </p>
              </CardHeader>
              <CardContent>
                {dispositionRules.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">No rules loaded. Check database table call_analytics_disposition_rules.</p>
                ) : (
                  <div className="space-y-3">
                    {dispositionRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`border rounded-lg p-4 ${rule.active === false ? 'opacity-60 bg-slate-50 dark:bg-slate-900/50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{rule.label}</span>
                              {rule.active === false && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                              <span className="text-xs text-muted-foreground">sort: {rule.sort_order ?? 0}</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rule.description}</p>
                            {(rule.min_duration_sec != null || rule.max_duration_sec != null) && (
                              <p className="text-xs text-slate-500 mt-1">
                                Duration: {rule.min_duration_sec ?? '—'}–{rule.max_duration_sec ?? '—'} sec
                                {rule.scorecard_zero && ' • Scorecard zero'}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingRule(rule)}
                            disabled={updateRuleMutation.isPending}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {editingRule && (
              <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Rule: {editingRule.label}</DialogTitle>
                  </DialogHeader>
                  <DispositionRuleForm
                    rule={editingRule}
                    onSave={(payload) => updateRuleMutation.mutate({ id: editingRule.id, payload })}
                    onCancel={() => setEditingRule(null)}
                    isPending={updateRuleMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
        </Tabs>

      {/* Recording Player Modal */}
      {recordingSession && (
        <Dialog open={!!recordingSession} onOpenChange={(open) => {
          if (!open) {
            setRecordingSession(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Recording - {recordingSession.lead_name || 'Unknown Client'}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3 py-2">
              {getRecordingPlaybackUrl(recordingSession) ? (
                <audio controls className="w-full" src={getRecordingPlaybackUrl(recordingSession)!}>
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="text-sm text-slate-500">No recording available for this call. Recordings appear after the call ends and Twilio sends the recording to the server.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Transcript Dialog */}
      {transcriptSession && (
        <Dialog open={!!transcriptSession} onOpenChange={(open) => {
          if (!open) {
            setTranscriptSession(null);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transcript - {transcriptSession.lead_name || 'Unknown Client'}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {transcriptSession.transcript ? (
                <div className="whitespace-pre-wrap text-sm">{transcriptSession.transcript}</div>
              ) : (
                <div className="text-sm text-slate-500">Transcript not available</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Transfer Detail Modal */}
      {selectedTransfer && (
        <Dialog open={!!selectedTransfer} onOpenChange={(open) => {
          if (!open) {
            setSelectedTransfer(null);
            setDetailData(null);
          }
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call Analytics - {selectedTransfer.lead_name || 'Unknown Client'}
              </DialogTitle>
            </DialogHeader>

            {isLoadingDetail ? (
              <div className="text-center py-8">Loading call details...</div>
            ) : detailData ? (
              (() => {
                const detailRecordingUrl = getRecordingPlaybackUrl({ recording_url: detailData.analytics?.recording_url, taalk_call_id: detailData.analytics?.taalk_call_id });
                return (
              <Tabs defaultValue="analysis" className="w-full">
              <TabsList className={`grid w-full ${detailRecordingUrl ? 'grid-cols-4' : 'grid-cols-2'}`}>
                <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
                {detailRecordingUrl && <TabsTrigger value="transcript">Transcript</TabsTrigger>}
                {detailRecordingUrl && <TabsTrigger value="recording">Recording</TabsTrigger>}
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
              </TabsList>

              <TabsContent value="analysis" className="space-y-4">
                {detailData.analytics ? (
                  <>
                    {/* Overall Score */}
                    <div className={`p-4 rounded-lg border-2 ${getScoreColor(detailData.analytics.call_score)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg">Overall Call Score</h3>
                        <Badge className="text-lg px-3 py-1">
                          {detailData.analytics.call_score?.toFixed(1) || 'N/A'}/100
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Sentiment</div>
                          <div className="font-semibold">{detailData.analytics.sentiment_label || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Outcome (CCPRO)</div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{detailData.analytics.outcome || detailData.analytics.call_outcome || 'N/A'}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleAnalyze(selectedTransfer)}
                              disabled={analyzeMutation.isPending}
                              title="Re-analyze (fix wrong outcome like call_back vs booked)"
                            >
                              {analyzeMutation.isPending ? '...' : <Bot className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Associate ID</div>
                          <div className="font-semibold font-mono">{detailData.transfer?.agent_associate_id ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Agent Talk Time</div>
                          <div className="font-semibold">{detailData.analytics.agent_talk_time_pct?.toFixed(0) || 'N/A'}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Client Engagement</div>
                          <div className="font-semibold">{detailData.analytics.client_engagement_level || 'N/A'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Scorecard */}
                    {detailData.analytics.scorecard_results && (
                      <div className="space-y-3">
                        <h3 className="font-bold text-lg">Scorecard Breakdown</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(detailData.analytics.scorecard_results).map(([key, value]: [string, any]) => {
                            if (key === 'overallScore') return null;
                            return (
                              <div key={key} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <Badge className={getScoreColor(value?.score)}>
                                    {value?.score?.toFixed(0) || 0}/100
                                  </Badge>
                                </div>
                                {value?.notes && (
                                  <p className="text-xs text-slate-600 mt-1">{value.notes}</p>
                                )}
                                {value?.objections && value.objections.length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs font-semibold">Objections:</div>
                                    <ul className="text-xs text-slate-600 list-disc list-inside">
                                      {value.objections.map((obj: string, idx: number) => (
                                        <li key={idx}>{obj}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Key Topics */}
                    {detailData.analytics.key_topics && detailData.analytics.key_topics.length > 0 && (
                      <div>
                        <h3 className="font-bold text-lg mb-2">Key Topics</h3>
                        <div className="flex flex-wrap gap-2">
                          {detailData.analytics.key_topics.map((topic: string, idx: number) => (
                            <Badge key={idx} variant="outline">{topic}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Objections */}
                    {detailData.analytics.objections_detected && detailData.analytics.objections_detected.length > 0 && (
                      <div>
                        <h3 className="font-bold text-lg mb-2">Objections Detected</h3>
                        <div className="flex flex-wrap gap-2">
                          {detailData.analytics.objections_detected.map((obj: string, idx: number) => (
                            <Badge key={idx} variant="destructive">{obj}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coaching Notes */}
                    {detailData.analytics.coaching_notes && (
                      <div>
                        <h3 className="font-bold text-lg mb-2">Coaching Notes</h3>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm whitespace-pre-wrap">{detailData.analytics.coaching_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Key Moments */}
                    {detailData.analytics.key_moments && detailData.analytics.key_moments.length > 0 && (
                      <div>
                        <h3 className="font-bold text-lg mb-2">Key Moments</h3>
                        <div className="space-y-2">
                          {detailData.analytics.key_moments.map((moment: any, idx: number) => (
                            <div key={idx} className="p-2 border rounded text-sm">
                              <span className="font-mono text-xs text-slate-500">{moment.timestamp}</span>
                              <span className="ml-2">{moment.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-500">No analysis available</p>
                    <Button
                      className="mt-4"
                      onClick={() => handleAnalyze(selectedTransfer)}
                      disabled={analyzeMutation.isPending}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Start Analysis
                    </Button>
                  </div>
                )}
              </TabsContent>

              {detailRecordingUrl && (
              <TabsContent value="transcript" className="space-y-4">
                {detailData.analytics?.transcript ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">Call Transcript</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([detailData.analytics?.transcript || ''], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `transcript-${selectedTransfer.transaction_id}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {detailData.analytics.transcript}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transcript available</p>
                  </div>
                )}
              </TabsContent>
              )}
              {detailRecordingUrl && (
              <TabsContent value="recording" className="space-y-4">
                {detailRecordingUrl ? (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg">Call Recording</h3>
                    <audio
                      controls
                      className="w-full"
                      src={detailRecordingUrl}
                    >
                      Your browser does not support the audio element.
                    </audio>
                    <Button
                      variant="outline"
                      onClick={() => { if (detailRecordingUrl) window.open(detailRecordingUrl, '_blank'); }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Recording
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recording available</p>
                  </div>
                )}
              </TabsContent>
              )}

              <TabsContent value="compliance" className="space-y-4">
                {detailData.analytics?.compliance_flags ? (
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg">Compliance Checklist</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(detailData.analytics.compliance_flags).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center gap-2 p-2 border rounded">
                          {value ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No compliance data available</p>
                  </div>
                )}
              </TabsContent>
              </Tabs>
                );
              })()
            ) : (
              <div className="text-center py-8 text-slate-500">
                Failed to load call details
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
