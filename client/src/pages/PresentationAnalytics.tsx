import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { SlideDeckViewer } from '@/components/modals/SlideDeckViewer';
import { useAuth } from '@/hooks/use-auth';
import { 
  Presentation, 
  Search, 
  Filter, 
  Eye, 
  Calendar, 
  User, 
  Clock,
  Download,
  RefreshCw,
  Play,
  BarChart3,
  CheckCircle,
  XCircle,
  Layers
} from 'lucide-react';

interface PresentationSession {
  id: string;
  session_id: string;
  agent_email: string;
  agent_name: string;
  presentation_url: string;
  presentation_type: string;
  video_url?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  status: 'active' | 'completed' | 'interrupted';
  total_slides_shown?: number;
  ai_summary?: string;
  engagement_score?: number;
  screenshot_count?: number;
  
  // NEW: Individual columns (not JSONB)
  current_phase?: string; // 'lead_selection', 'client_info', 'quotes', etc.
  phase_updated_at?: string;
  
  // Client data as individual columns
  client_first_name?: string;
  client_last_name?: string;
  client_full_name?: string;
  client_phone?: string;
  client_city?: string;
  client_state?: string;
  client_zip?: string;
  client_age?: number;
  lead_type?: string;
  
  // Quote data
  total_quotes_generated?: number;
  carriers_quoted?: string[];
  products_quoted?: string[];
  lowest_monthly_premium?: number;
  highest_monthly_premium?: number;
  average_premium?: number;
  
  // Application data
  application_started?: boolean;
  personal_info_completed?: boolean;
  health_questions_completed?: boolean;
  beneficiary_added?: boolean;
  payment_method_added?: boolean;
  esignature_completed?: boolean;
  
  // Sales data
  sale_made?: boolean;
  sale_amount?: number;
  products_sold?: string[];
}

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  interrupted: 'bg-red-100 text-red-800'
};

const PHASE_LABELS: Record<string, string> = {
  lead_selection: 'Lead Selection',
  client_info: 'Client Info',
  quotes: 'Quotes',
  comparison: 'Comparison',
  application: 'Application',
  summary: 'Summary',
  other: 'In Progress'
};

const PHASE_COLORS: Record<string, string> = {
  lead_selection: 'bg-blue-500',
  client_info: 'bg-cyan-500',
  quotes: 'bg-purple-500',
  comparison: 'bg-pink-500',
  application: 'bg-yellow-500',
  summary: 'bg-green-500',
  other: 'bg-gray-400'
};

const PHASE_PROGRESS: Record<string, number> = {
  lead_selection: 17,
  client_info: 33,
  quotes: 50,
  comparison: 67,
  application: 83,
  summary: 100,
  other: 10
};

export default function PresentationAnalytics() {
  console.log('🎬 PresentationAnalytics component loaded');
  
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('week');
  const [slideDeckSession, setSlideDeckSession] = useState<PresentationSession | null>(null);
  const [slideDeckScreenshots, setSlideDeckScreenshots] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<PresentationSession | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  
  // NO ACCESS RESTRICTIONS - All authenticated users can access
  console.log('🔐 Presentation Analytics access check:', user?.email);

  // Fetch presentation sessions
  const { data: sessionsData, isLoading, error, refetch } = useQuery({
    queryKey: ['presentation-sessions', { search: searchTerm, status: statusFilter, dateRange }],
    queryFn: async () => {
      console.log('🔄 Fetching presentation sessions...');
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (dateRange) params.append('dateRange', dateRange);
      
      const response = await apiRequest('GET', `/api/presentations/sessions?${params.toString()}`);
      const result = await response.json();
      
      console.log('📊 Presentation sessions result:', result);
      console.log('🔍 First session data:', result.sessions?.[0]);
      console.log('📸 Screenshot counts:', result.sessions?.map((s: any) => ({ 
        email: s.agent_email, 
        screenshots: s.screenshot_count,
        phase: s.current_phase,
        client: s.client_data
      })));
      return result;
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    retry: false
  });

  useEffect(() => {
    if (error) {
      console.error('❌ Error fetching presentations:', error);
    }
  }, [error]);

  const sessions = sessionsData?.sessions || [];
  const totalSessions = sessionsData?.total || 0;

  // Stats
  const stats = {
    total: totalSessions,
    active: sessions.filter(s => s.status === 'active').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    interrupted: sessions.filter(s => s.status === 'interrupted').length,
    avgDuration: sessions.filter(s => s.duration_seconds).reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.filter(s => s.duration_seconds).length || 0
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Presentation className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Presentation Analytics
          </h1>
        </div>
        <p className="text-gray-600">Track and review producer presentations with AI-powered insights</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Presentations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Interrupted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.interrupted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-600">{formatDuration(Math.floor(stats.avgDuration))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search Producer Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="interrupted">Interrupted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Presentation Sessions ({totalSessions})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading presentations...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No presentations found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">producer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Client</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Started</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Progress</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Quotes</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{session.agent_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{session.agent_email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {session.client_full_name || session.client_first_name || session.client_last_name ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {session.client_full_name || `${session.client_first_name || ''} ${session.client_last_name || ''}`.trim()}
                            </div>
                            {session.client_phone && (
                              <div className="text-sm text-gray-500">{session.client_phone}</div>
                            )}
                            {(session.client_city || session.client_state) && (
                              <div className="text-xs text-gray-400">
                                {session.client_city}{session.client_city && session.client_state ? ', ' : ''}{session.client_state}
                              </div>
                            )}
                            {session.lead_type && (
                              <div className="text-xs text-blue-600 font-medium mt-1">{session.lead_type}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No client data</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(session.started_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(session.duration_seconds)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {session.current_phase ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[session.current_phase] || 'bg-gray-400'} ${session.status === 'active' ? 'animate-pulse' : ''}`} />
                              <span className="text-xs font-medium text-gray-700">
                                {PHASE_LABELS[session.current_phase] || 'In Progress'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${PHASE_COLORS[session.current_phase] || 'bg-gray-400'} transition-all duration-500`}
                                style={{ width: `${PHASE_PROGRESS[session.current_phase] || 10}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not started</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {session.total_quotes_generated ? (
                          <div>
                            <div className="font-medium text-gray-900">{session.total_quotes_generated} quotes</div>
                            {session.carriers_quoted && session.carriers_quoted.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {session.carriers_quoted.slice(0, 2).join(', ')}
                                {session.carriers_quoted.length > 2 && ` +${session.carriers_quoted.length - 2}`}
                              </div>
                            )}
                            {session.average_premium && (
                              <div className="text-xs text-green-600 font-medium mt-1">
                                Avg: ${session.average_premium.toFixed(2)}/mo
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No quotes</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[session.status]}>
                          {session.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {/* View AI Summary */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSession(session)}
                            className="bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100"
                          >
                            <BarChart3 className="w-4 h-4 mr-1" />
                            View Summary
                          </Button>

                          {/* Play Slides Button */}
                          {session.screenshot_count > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                console.log('🎬 Loading slides for session:', session.session_id);
                                try {
                                  // Fetch screenshots for this session
                                  const response = await fetch(`/api/presentations/${session.id}/screenshots`);
                                  const data = await response.json();
                                  
                                  if (data.success && data.screenshots) {
                                    console.log(`✅ Loaded ${data.screenshots.length} screenshots`);
                                    setSlideDeckScreenshots(data.screenshots);
                                    setSlideDeckSession(session);
                                  }
                                } catch (error) {
                                  console.error('❌ Error loading slides:', error);
                                }
                              }}
                              className="bg-green-50 hover:bg-green-100"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Play Slides ({session.screenshot_count})
                            </Button>
                          )}
                          
                          {/* Watch Video Button */}
                          {session.video_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSession(session);
                                setShowVideoDialog(true);
                              }}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Watch
                            </Button>
                          )}
                          
                          {/* AI Summary Button */}
                          {session.ai_summary ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="w-4 h-4 mr-1" />
                                  AI Summary
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>AI Analysis - {session.agent_name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="font-semibold mb-2">Summary</h3>
                                    <p className="text-gray-700 whitespace-pre-wrap">{session.ai_summary}</p>
                                  </div>
                                  {session.total_slides_shown && (
                                    <div>
                                      <h3 className="font-semibold mb-2">Presentation Metrics</h3>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-sm text-gray-600">Total Slides</div>
                                          <div className="text-2xl font-bold">{session.screenshot_count || session.total_slides_shown}</div>
                                        </div>
                                        <div>
                                          <div className="text-sm text-gray-600">Duration</div>
                                          <div className="text-2xl font-bold">{formatDuration(session.duration_seconds)}</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : session.status === 'completed' && session.screenshot_count > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                console.log('🤖 Generating AI summary for session:', session.session_id);
                                try {
                                  const response = await apiRequest('POST', `/api/presentations/${session.session_id}/generate-summary`);
                                  const data = await response.json();
                                  if (data.success) {
                                    refetch(); // Refresh to show new summary
                                  }
                                } catch (error) {
                                  console.error('❌ Error generating summary:', error);
                                }
                              }}
                            >
                              <BarChart3 className="w-4 h-4 mr-1" />
                              Generate AI Summary
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Player Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSession?.agent_name} - Presentation Recording
            </DialogTitle>
          </DialogHeader>
          {selectedSession?.video_url && (
            <div className="space-y-4">
              <video
                controls
                className="w-full rounded-lg bg-black"
                src={selectedSession.video_url}
              >
                Your browser does not support video playback.
              </video>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Started</div>
                  <div className="font-semibold">{formatDate(selectedSession.started_at)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Duration</div>
                  <div className="font-semibold">{formatDuration(selectedSession.duration_seconds)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Slides Shown</div>
                  <div className="font-semibold">{selectedSession.total_slides_shown || 0}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Slide Deck Viewer Modal */}
      {slideDeckSession && (
        <SlideDeckViewer
          isOpen={!!slideDeckSession}
          onClose={() => {
            setSlideDeckSession(null);
            setSlideDeckScreenshots([]);
          }}
          screenshots={slideDeckScreenshots}
          sessionId={slideDeckSession.session_id}
          agentName={slideDeckSession.agent_name || slideDeckSession.agent_email}
        />
      )}
    </div>
  );
}

