
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { translateIfSpanish as translateIfSpanishFn } from '@/lib/translate';
import { useAuth } from '@/hooks/use-auth';

// Simple component to display GPS location name
function GPSLocationName({ latitude, longitude }: { latitude: string | number; longitude: string | number }) {
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!latitude || !longitude) return;
    
    setLoading(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`, {
      headers: { 'User-Agent': 'AOIrail/1.0' }
    })
      .then(res => res.json())
      .then(data => {
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const state = addr.state || addr.region || '';
        const country = addr.country || '';
        const parts = [];
        if (city) parts.push(city);
        if (state && state !== country) parts.push(state);
        if (country) parts.push(country);
        setLocationName(parts.length > 0 ? parts.join(', ') : null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [latitude, longitude]);

  if (loading) return <span className="text-xs text-slate-400">Loading...</span>;
  if (!locationName) return null;
  return <p className="text-xs text-slate-500 dark:text-slate-500 italic">{locationName} <span className="ml-1 text-[10px]">(GPS)</span></p>;
}
import { 
  Shield, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Calendar, 
  User, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock,
  Download,
  RefreshCw,
  ChevronDown,
  Edit3,
  Check,
  X,
  FileText,
  Image,
  Play,
  Award,
  Pause,
  Flag,
  Bot,
  Volume2,
  AlertTriangle,
  MapPin
} from 'lucide-react';

interface PrecheckSession {
  id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_ip_address?: string;
  agent_ip_address?: string;
  city?: string;
  state?: string;
  agent_email: string;
  agent_name?: string;
  agent_rga_team?: string;
  agent_mga_team?: string;
  verification_method: 'zoom' | 'phone' | 'conference';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
  completed_at?: string;
  session_data?: any;
  session_id?: string;
  verification_notes?: string;
  policy_number?: string;
  beneficiary_info?: string;
  premium_amount?: number;
  verification_score?: number;
  screenshots_count?: number;
  call_duration?: number;
  cancellation_reason?: string;
  attempts?: number;
  // Evidence URLs - Direct access to verification files
  certificate_url?: string;
  screenshot_url?: string;
  screenshot_path?: string;
  recording_url?: string;
  taalk_call_url?: string;
  transcript_url?: string;
  // AI validation results
  screenshot_validation?: {
    isValid: boolean;
    confidence: number;
    validationType: string;
    reason: string;
    detectedElements?: any;
    issues?: string[];
    validatedAt?: string;
  };
  screenshot_analysis_complete?: boolean;
  screenshot_analysis_confidence?: number;
  // Audio analysis results
  audio_analysis?: {
    transcript: string;
    summary: string;
    validation: {
      isValid: boolean;
      confidence: number;
      reason: string;
      detectedIssues?: string[];
    };
    keyMoments?: Array<{
      timestamp: string;
      description: string;
    }>;
    sentiment?: string;
    analyzedAt?: string;
  };
  call_analysis_complete?: boolean;
  call_analysis_confidence?: number;
  // Taalk AI Summary & Transcript
  call_transcript?: string;
  taalk_ai_summary?: any;
  ai_quick_recap?: string;
  ai_next_steps?: string;
  ai_key_topics?: string;
  ai_sentiment_score?: number;
  ai_user_refused_call?: boolean;
  ai_result?: string;
  ai_result_passed?: boolean;
  ai_red_flags?: string;
  ai_favorite_feature?: string;
  ai_preview?: string;
  // Compliance checklist
  compliance_agent_confirmed?: boolean;
  compliance_contact_verified?: boolean;
  compliance_premium_ok?: boolean;
  compliance_medical_asked?: boolean;
  compliance_meds_asked?: boolean;
  compliance_legal_asked?: boolean;
  compliance_needs_analysis?: boolean;
  compliance_all_medical?: boolean;
  compliance_info_accurate?: boolean;
  compliance_ach_explained?: boolean;
  compliance_client_satisfied?: boolean;
  // IP Analysis results
  ip_analysis?: {
    isValid: boolean;
    flagStatus: 'valid' | 'flagged' | 'suspicious' | 'critical' | 'pending';
    confidence: number;
    reason: string;
    details: {
      sameIp: boolean;
      sameCity: boolean;
      sameRegion: boolean;
      sameCountry: boolean;
      distanceMiles: number | null;
      agentLocation: string | null;
      clientLocation: string | null;
    };
  };
  ip_flag_status?: string;
  ip_flag_reason?: string;
  ip_analysis_summary?: string;
  // Location data
  client_city?: string;
  client_region?: string;
  client_country?: string;
  client_is_vpn?: boolean;
  client_is_proxy?: boolean;
  client_is_hosting?: boolean;
  client_vpn_detection_reason?: string;
  client_isp?: string; // ✅ ISP name (e.g., "NordVPN Inc", "DigitalOcean LLC")
  agent_city?: string;
  agent_region?: string;
  agent_country?: string;
  agent_is_vpn?: boolean;
  agent_is_proxy?: boolean;
  agent_is_hosting?: boolean;
  agent_vpn_detection_reason?: string;
  agent_isp?: string; // ✅ ISP name (e.g., "NordVPN Inc", "DigitalOcean LLC")
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

const AVAILABLE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const METHOD_COLORS = {
  zoom: 'bg-purple-100 text-purple-800',
  phone: 'bg-green-100 text-green-800',
  conference: 'bg-blue-100 text-blue-800'
};

const formatConfidence = (value?: number | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const percent = value > 1 ? value : value * 100;
  return Math.round(percent);
};

interface CompactRecordingPlayerProps {
  session: PrecheckSession | null;
  onClose: () => void;
}

function CompactRecordingPlayer({ session, onClose }: CompactRecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useState<HTMLAudioElement | null>(() => {
    if (typeof window !== 'undefined') {
      return new Audio();
    }
    return null;
  })[0];

  useEffect(() => {
    if (!audioRef || !session) return;
    
    // Get valid recording URL - check if recording_url is valid HTTP URL (not "PENDING" or invalid)
    let recordingUrl = session.recording_url;
    const isValidHttpUrl = recordingUrl && 
      recordingUrl.startsWith('http') && 
      recordingUrl !== 'PENDING';
    
    // If recording_url is invalid but we have taalk_call_url (storage path), generate signed URL
    if (!isValidHttpUrl && session.taalk_call_url && session.taalk_call_url.startsWith('recordings/')) {
      // Use the proxy endpoint to get the recording
      recordingUrl = `/api/aoi-precheck/recording/${session.session_id}`;
      console.log('⚠️ Using proxy endpoint for recording (recording_url was invalid)');
    }
    
    if (!recordingUrl) {
      console.log('⚠️ No valid recording URL for session:', session.id);
      return;
    }

    console.log('🎵 Loading recording:', recordingUrl.substring(0, 100));
    audioRef.src = recordingUrl;
    audioRef.load();

    const handleTimeUpdate = () => setCurrentTime(audioRef.currentTime);
    const handleDurationChange = () => setDuration(audioRef.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: any) => {
      console.error('❌ Audio playback error:', e, 'Session ID:', session.id);
      setIsPlaying(false);
    };
    const handleCanPlay = () => {
      console.log('✅ Audio can play, duration:', audioRef.duration);
    };

    audioRef.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.addEventListener('durationchange', handleDurationChange);
    audioRef.addEventListener('ended', handleEnded);
    audioRef.addEventListener('error', handleError);
    audioRef.addEventListener('canplay', handleCanPlay);

    return () => {
      audioRef.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.removeEventListener('durationchange', handleDurationChange);
      audioRef.removeEventListener('ended', handleEnded);
      audioRef.removeEventListener('error', handleError);
      audioRef.removeEventListener('canplay', handleCanPlay);
      audioRef.pause();
    };
  }, [session?.recording_url, session?.taalk_call_url, audioRef]);

  const togglePlayPause = () => {
    if (!audioRef) return;
    
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef) return;
    const newTime = parseFloat(e.target.value);
    audioRef.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = () => {
    const recordingUrl = session?.recording_url || session?.taalk_call_url;
    if (!recordingUrl) return;
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `recording-${session.id}.mp3`;
    a.click();
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!session) return null;

  return (
    <Dialog open={!!session} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Recording - {session.client_name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 py-2">
          {/* Play/Pause Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={togglePlayPause}
            className="h-10 w-10 p-0 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          {/* Time Display */}
          <div className="text-sm text-gray-600 min-w-[80px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Slider */}
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #9333ea 0%, #9333ea ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
            }}
          />

          {/* Download Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            className="h-10 w-10 p-0"
            title="Download Recording"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface InlineStatusEditorProps {
  session: PrecheckSession;
  updateStatusMutation: any;
  onStatusChange?: () => void;
}

function InlineStatusEditor({ session, updateStatusMutation, onStatusChange }: InlineStatusEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(session.status);
  const [note, setNote] = useState('');
  const [showNoteField, setShowNoteField] = useState(false);
  const { toast } = useToast();

  const handleUpdateStatus = () => {
    if (selectedStatus === session.status) {
      setIsOpen(false);
      return;
    }

    updateStatusMutation.mutate(
      {
        sessionId: session.id,
        status: selectedStatus,
        note: note.trim() || undefined
      },
      {
        onSuccess: () => {
          toast({ 
            title: "Status updated successfully", 
            description: `Session status changed to ${selectedStatus.replace('_', ' ')}` 
          });
          setIsOpen(false);
          setNote('');
          setShowNoteField(false);
          onStatusChange?.();
        },
        onError: (error: any) => {
          toast({ 
            title: "Failed to update status", 
            description: error.message || "Please try again", 
            variant: "destructive" 
          });
        }
      }
    );
  };

  const handleCancel = () => {
    setSelectedStatus(session.status);
    setNote('');
    setShowNoteField(false);
    setIsOpen(false);
  };

  const currentStatusLabel = AVAILABLE_STATUSES.find(s => s.value === session.status)?.label || session.status;
  const selectedStatusLabel = AVAILABLE_STATUSES.find(s => s.value === selectedStatus)?.label || selectedStatus;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`badge-status-${session.id}`}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[session.status]}`}
          onClick={() => setIsOpen(true)}
        >
          {currentStatusLabel.toUpperCase()}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Update Status</h4>
            <Button
              data-testid={`button-close-popover-${session.id}`}
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor={`status-select-${session.id}`} className="text-xs font-medium text-slate-600">
                New Status
              </Label>
              <Select 
                value={selectedStatus} 
                onValueChange={(value) => setSelectedStatus(value as PrecheckSession['status'])}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger 
                  id={`status-select-${session.id}`}
                  data-testid={`select-status-${session.id}`}
                  className="h-8 text-xs"
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status.value as keyof typeof STATUS_COLORS]?.split(' ')[0] || 'bg-gray-200'}`} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">
                Add Note (Optional)
              </Label>
              <Button
                data-testid={`button-toggle-note-${session.id}`}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNoteField(!showNoteField)}
                className="h-6 text-xs"
              >
                {showNoteField ? 'Hide' : 'Show'} Note
              </Button>
            </div>

            {showNoteField && (
              <div>
                <Textarea
                  data-testid={`input-status-note-${session.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for status change..."
                  className="h-16 text-xs resize-none"
                  disabled={updateStatusMutation.isPending}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              data-testid={`button-update-status-${session.id}`}
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending || selectedStatus === session.status}
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              {updateStatusMutation.isPending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Update
                </>
              )}
            </Button>
            <Button
              data-testid={`button-cancel-status-${session.id}`}
              variant="outline"
              onClick={handleCancel}
              disabled={updateStatusMutation.isPending}
              size="sm"
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to convert names to proper case
const toProperCase = (name: string): string => {
  if (!name || name === '-') return '-';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to get status color variant
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'default';
    case 'in_progress':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
};

// Component to display translated text
function TranslatedText({ text, className }: { text: string; className?: string }) {
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!text) return;
    
    // Check if translation is needed
    const needsTranslation = /[áéíóúñüÁÉÍÓÚÑÜ]/.test(text) || 
      /\b(realizó|realizo|confirmó|confirmo|reunió|reunio|agente|llamada|grabada|información|ubicación|pago|mensual|cómodo|presupuesto|división|de|la|con|para|sobre|su)\b/gi.test(text);
    
    if (needsTranslation) {
      setIsTranslating(true);
      // Safety check - ensure function exists
      if (typeof translateIfSpanishFn === 'function') {
        translateIfSpanishFn(text).then((translated) => {
          setTranslatedText(translated);
          setIsTranslating(false);
        }).catch(() => {
          setTranslatedText(text);
          setIsTranslating(false);
        });
      } else {
        // Fallback if function not available
        console.warn('translateIfSpanish not available, using original text');
        setTranslatedText(text);
        setIsTranslating(false);
      }
    } else {
      setTranslatedText(text);
    }
  }, [text]);

  if (isTranslating) {
    return <p className={className || 'text-sm'}><span className="italic text-slate-500">Translating to English...</span></p>;
  }

  return <p className={className || 'text-sm'}>{translatedText}</p>;
}

export type AOIPrecheckAdminProps = {
  /** Embedded in Precheck Manager modal (no Connect chrome). */
  embedded?: boolean;
  /** When set, only show sessions for this manager's confirmed team. */
  teamManagerEmail?: string;
  onClose?: () => void;
};

export default function AOIPrecheckAdmin(props: AOIPrecheckAdminProps = {}) {
  console.log('🚀 AOIPrecheckAdmin component loaded - recording functionality should be working!');

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const teamManagerEmail = (props.teamManagerEmail || urlParams.get('teamManager') || '').trim().toLowerCase() || undefined;
  const embedded = props.embedded ?? urlParams.get('embedded') === '1';
  const onClose = props.onClose;
  const isTeamManagerView = !!teamManagerEmail;

  useEffect(() => {
    if (!embedded) return;
    document.documentElement.classList.add('precheck-mgr-embed');
    return () => document.documentElement.classList.remove('precheck-mgr-embed');
  }, [embedded]);

  const { authState } = useAuth();
  const userEmail = authState?.user?.email?.toLowerCase();
  const isCnsysop =
    userEmail === 'cnsysop@aoglobelife.com' ||
    userEmail === 'daniellenoble@aoglobelife.com' ||
    userEmail === 'robhay@aoglobelife.com';
  const precheckIpTrackingEnabled = false;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [producerFilter, setproducerFilter] = useState('all');
  const [rgaFilter, setRgaFilter] = useState('all');
  const [mgaFilter, setMgaFilter] = useState('all');
  const [highImpactOnly, setHighImpactOnly] = useState(!isTeamManagerView); // Team manager: show all by default
  const [completedCallsOnly, setCompletedCallsOnly] = useState(!isTeamManagerView);
  const [selectedSession, setSelectedSession] = useState<PrecheckSession | null>(null);
  const [certificateSession, setCertificateSession] = useState<PrecheckSession | null>(null);
  const [pictureSession, setPictureSession] = useState<PrecheckSession | null>(null);
  const [recordingSession, setRecordingSession] = useState<PrecheckSession | null>(null);
  const [transcriptSession, setTranscriptSession] = useState<PrecheckSession | null>(null);

  const [dateRange, setDateRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);

  // ✅ Track which screenshots failed to load - button should be grey if image fails
  const [failedScreenshots, setFailedScreenshots] = useState<Set<string>>(new Set());

  // Store GPS-based location names (reverse geocoded) - DISABLED to prevent initialization errors
  // const [gpsLocations, setGpsLocations] = useState<Record<string, { client?: ReverseGeocodeResult; agent?: ReverseGeocodeResult }>>({});
  // const processedSessionsRef = useRef<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Re-run AI Summary sync - fetches pending transcripts/summaries from Taalk
  const triggerAiSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/aoi-precheck/trigger-transcript-sync', undefined, userEmail);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || 'Failed to trigger sync');
      }
    },
    onSuccess: () => {
      toast({ title: 'AI Summary sync started', description: 'Fetching pending transcripts and summaries. Refreshing...' });
      refetchSessions();
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions/all-for-filters'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Sync failed', description: err.message });
    }
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, methodFilter, producerFilter, rgaFilter, mgaFilter, dateRange, completedCallsOnly, highImpactOnly]);

  // Reverse geocode GPS coordinates - DISABLED to prevent initialization errors
  // Will re-enable later with a simpler approach


  // Fetch precheck sessions
  const { data: sessionsData, isLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['/api/aoi-precheck/sessions', { searchTerm, statusFilter, methodFilter, producerFilter, rgaFilter, mgaFilter, dateRange, currentPage, pageSize, teamManagerEmail }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (methodFilter !== 'all') params.append('method', methodFilter);
      if (producerFilter !== 'all') params.append('producer', producerFilter);
      if (rgaFilter !== 'all') params.append('rga', rgaFilter);
      if (mgaFilter !== 'all') params.append('mga', mgaFilter);
      if (dateRange !== 'all') params.append('dateRange', dateRange);
      if (teamManagerEmail) params.append('teamManager', teamManagerEmail);
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());

      console.log('🔄 Fetching AOI Precheck sessions...');
      const response = await apiRequest('GET', `/api/aoi-precheck/sessions?${params.toString()}`, undefined, userEmail);
      const result = await response.json();
      console.log('📊 AOI Precheck sessions result:', result);
      return result;
    },
    refetchInterval: false, // DISABLED - No auto-refresh
    staleTime: 0, // Always consider data stale - ensures fresh data after IP flag updates
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch summary stats
  const { data: stats = {} } = useQuery({
    queryKey: ['/api/aoi-precheck/stats', teamManagerEmail],
    queryFn: async () => {
      console.log('📈 Fetching AOI Precheck stats...');
      const statsUrl = teamManagerEmail
        ? `/api/aoi-precheck/stats?teamManager=${encodeURIComponent(teamManagerEmail)}`
        : '/api/aoi-precheck/stats';
      const response = await apiRequest('GET', statsUrl, undefined, userEmail);
      const result = await response.json();
      console.log('📊 AOI Precheck stats result:', result);
      return result || {};
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
  });

  // Extract sessions and pagination from data
  const sessions = sessionsData?.sessions || [];
  const pagination = sessionsData?.pagination || { page: 1, limit: 100, total: 0, totalPages: 0 };
  
  // Use the currently loaded page to build dropdown lists (fast path)
  const allSessionsForFilters = sessions;
  
  // Generate unique RGA and MGA team lists from all filtered sessions
  // ✅ FIXED: Case-insensitive deduplication - deduplicate by lowercase, keep first occurrence for display
  const uniqueRGAs = useMemo(() => {
    if (!Array.isArray(allSessionsForFilters)) return [];
    const rgaMap = new Map<string, string>(); // lowercase -> original case (first occurrence)
    allSessionsForFilters.forEach(session => {
      const rga = session.agent_rga_team;
      if (rga && rga !== 'Unknown') {
        const rgaLower = rga.toLowerCase();
        // Only add if we haven't seen this team (case-insensitive) before
        if (!rgaMap.has(rgaLower)) {
          rgaMap.set(rgaLower, rga);
        }
      }
    });
    return Array.from(rgaMap.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [allSessionsForFilters]);

  const uniqueMGAs = useMemo(() => {
    if (!Array.isArray(allSessionsForFilters)) return [];
    const mgaMap = new Map<string, string>(); // lowercase -> original case (first occurrence)
    allSessionsForFilters.forEach(session => {
      const mga = session.agent_mga_team;
      if (mga && mga !== 'Unknown') {
        const mgaLower = mga.toLowerCase();
        // Only add if we haven't seen this team (case-insensitive) before
        if (!mgaMap.has(mgaLower)) {
          mgaMap.set(mgaLower, mga);
        }
      }
    });
    return Array.from(mgaMap.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [allSessionsForFilters]);

  // Generate grouped producers from all filtered sessions with counts based on date range
  const groupedproducers = useMemo(() => {
    if (!Array.isArray(allSessionsForFilters)) return [];

    const producerCounts = new Map();

    allSessionsForFilters.forEach(session => {
      const agentName = session.agent_name || session.agent_email;
      if (agentName) {
        const currentCount = producerCounts.get(agentName) || 0;
        producerCounts.set(agentName, currentCount + 1);
      }
    });

    // Convert to array and sort by name
    return Array.from(producerCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSessionsForFilters]);

  // Build search suggestions from all filterable fields
  const searchSuggestions = useMemo(() => {
    if (!Array.isArray(allSessionsForFilters)) return [];
    
    const suggestions: Array<{
      type: 'producer' | 'mga' | 'rga' | 'client' | 'status' | 'method';
      label: string;
      value: string;
      filterKey: string;
    }> = [];

    // Add producers
    groupedproducers.forEach(producer => {
      suggestions.push({
        type: 'producer',
        label: `${producer.name} (${producer.count} sessions)`,
        value: producer.name,
        filterKey: 'producer'
      });
    });

    // Add MGA teams
    uniqueMGAs.forEach(mga => {
      const count = allSessionsForFilters.filter(s => s.agent_mga_team === mga).length;
      suggestions.push({
        type: 'mga',
        label: `${mga} MGA team (${count} sessions)`,
        value: mga as string,
        filterKey: 'mga'
      });
    });

    // Add RGA teams
    uniqueRGAs.forEach(rga => {
      const count = allSessionsForFilters.filter(s => s.agent_rga_team === rga).length;
      suggestions.push({
        type: 'rga',
        label: `${rga} RGA team (${count} sessions)`,
        value: rga as string,
        filterKey: 'rga'
      });
    });

    // Add unique client names
    const clientNames = new Set<string>();
    allSessionsForFilters.forEach(session => {
      if (session.client_name) {
        clientNames.add(session.client_name);
      }
    });
    clientNames.forEach(name => {
      const count = allSessionsForFilters.filter(s => s.client_name === name).length;
      suggestions.push({
        type: 'client',
        label: `${name} (${count} sessions)`,
        value: name,
        filterKey: 'client'
      });
    });

    // Add statuses
    ['pending', 'in_progress', 'completed', 'failed', 'cancelled'].forEach(status => {
      const count = allSessionsForFilters.filter(s => s.status === status).length;
      if (count > 0) {
        suggestions.push({
          type: 'status',
          label: `${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} (${count} sessions)`,
          value: status,
          filterKey: 'status'
        });
      }
    });

    // Add methods
    ['zoom', 'phone', 'conference'].forEach(method => {
      const count = allSessionsForFilters.filter(s => s.verification_method === method).length;
      if (count > 0) {
        suggestions.push({
          type: 'method',
          label: `${method.charAt(0).toUpperCase() + method.slice(1)} (${count} sessions)`,
          value: method,
          filterKey: 'method'
        });
      }
    });

    return suggestions;
  }, [allSessionsForFilters, groupedproducers, uniqueMGAs, uniqueRGAs]);

  // Filter suggestions based on search term
  const filteredSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return searchSuggestions;
    const term = searchTerm.toLowerCase();
    return searchSuggestions.filter(s => 
      s.label.toLowerCase().includes(term) || 
      s.value.toLowerCase().includes(term)
    );
  }, [searchTerm, searchSuggestions]);

  // Handle search suggestion selection
  const handleSuggestionSelect = (suggestion: typeof searchSuggestions[0]) => {
    setSearchTerm('');
    setSearchOpen(false);
    
    // Apply the appropriate filter
    switch (suggestion.filterKey) {
      case 'producer':
        setproducerFilter(suggestion.value);
        break;
      case 'mga':
        setMgaFilter(suggestion.value);
        break;
      case 'rga':
        setRgaFilter(suggestion.value);
        break;
      case 'status':
        setStatusFilter(suggestion.value);
        break;
      case 'method':
        setMethodFilter(suggestion.value);
        break;
      case 'client':
        // For client names, use the search term
        setSearchTerm(suggestion.value);
        break;
    }
  };

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: Partial<PrecheckSession> }) => {
      const response = await apiRequest('PUT', `/api/aoi-precheck/sessions/${sessionId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Session updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
      setSelectedSession(null);
    },
    onError: () => {
      toast({ title: "Failed to update session", variant: "destructive" });
    }
  });

  // Status change mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ sessionId, status, note }: { sessionId: string; status: string; note?: string }) => {
      const response = await apiRequest('PUT', `/api/aoi-precheck/sessions/${sessionId}/status`, { 
        status, 
        note,
        updated_by: 'manager' // This would be from auth in real app
      });
      return response.json();
    }
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('DELETE', `/api/aoi-precheck/sessions/${sessionId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Session deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
    },
    onError: () => {
      toast({ title: "Failed to delete session", variant: "destructive" });
    }
  });

  // Helper function to determine light status: 'red' | 'green' | 'grey' (no summary)
  // THIS FUNCTION IS THE ONLY PLACE THAT DETERMINES THE RESULT COLUMN STATUS
  // IP FLAGGING, IP ADDRESSES, GPS, LOCATION DATA, sameIp, sameCity, sameRegion, ip_flag_status
  // ARE COMPLETELY AND TOTALLY IGNORED - THEY DO NOT AFFECT THIS FUNCTION AT ALL
  const getLightStatus = (session: PrecheckSession): 'red' | 'green' | 'grey' => {
    // CRITICAL: If there's no AI summary, return grey (not acceptable to show green without summary)
    // Also check that taalk_ai_summary is not "PENDING" or empty/invalid
    const isValidSummary = (summary: any): boolean => {
      if (!summary) return false;
      if (typeof summary === 'string') {
        const trimmed = summary.trim();
        return trimmed !== '' && trimmed !== '[]' && trimmed !== 'PENDING' && trimmed.toUpperCase() !== 'PENDING';
      }
      if (Array.isArray(summary)) {
        return summary.length > 0;
      }
      return !!summary;
    };
    
    // CRITICAL: Only check ACTUAL AI summary fields - NOT transcript (transcript is not an AI summary)
    // PENDING is NOT a valid summary - it means the summary hasn't been generated yet
    // Check if call is marked as incomplete
    const isIncomplete = session.ai_result === 'INCOMPLETE' || session.ai_result?.toUpperCase() === 'INCOMPLETE';
    if (isIncomplete) {
      return 'grey'; // Incomplete call = grey (not red, not green)
    }
    
    // No AI summary = RED LIGHT (missing required data)
    const hasAiSummary = !!(session.ai_quick_recap || session.ai_result || session.ai_key_topics || isValidSummary(session.taalk_ai_summary));
    if (!hasAiSummary) {
      return 'red'; // No summary = red (missing required data)
    }
    
    // Check if screenshot exists but has no analysis (red light)
    // NOTE: NOT checking IP, location, GPS, or any IP-related fields
    const hasScreenshotFile = !!(session.screenshot_url || session.screenshot_path);
    const hasScreenshotAnalysis = !!(session.screenshot_validation || session.screenshot_analysis_complete);
    const noScreenshotAnalysis = hasScreenshotFile && !hasScreenshotAnalysis;
    
    // Check for questionable picture (screenshot validation invalid)
    // NOTE: NOT checking IP, location, GPS, or any IP-related fields
    // CRITICAL: Only flag as invalid if isValid is EXPLICITLY false (not undefined/null)
    // If validation doesn't exist, that's NOT invalid - it's just pending/not analyzed yet
    const screenshotInvalid = session.screenshot_validation && session.screenshot_validation.isValid === false;
    
    // Check if recording exists but has no audio analysis (red light)
    // NOTE: NOT checking IP, location, GPS, or any IP-related fields
    const hasRecordingFile = !!(session.recording_url || session.taalk_call_url);
    const hasCallData = !!(session.call_transcript || session.ai_quick_recap || session.ai_result);
    // If we have call data (transcript, AI summary, etc.), that means the call was analyzed
    // The audio_analysis object is optional - having call data IS audio analysis
    const hasAudioAnalysis = !!(session.audio_analysis || session.call_analysis_complete || hasCallData);
    const noAudioAnalysis = (hasRecordingFile || hasCallData) && !hasAudioAnalysis;
    
    // Check for questionable call recording (audio analysis invalid)
    // NOTE: NOT checking IP, location, GPS, or any IP-related fields
    // CRITICAL: Only flag as invalid if isValid is EXPLICITLY false (not undefined/null)
    // If validation doesn't exist, that's NOT invalid - it's just pending/not analyzed yet
    const audioInvalid = session.audio_analysis?.validation && session.audio_analysis.validation.isValid === false;
    
    const hasRecording = hasRecordingFile || hasCallData;
    const missingBoth = !hasScreenshotFile && !hasRecording;
    
    // CRITICAL FIX: Only mark RED if EXPLICITLY invalid (isValid === false) OR missing BOTH screenshot AND recording
    // Do NOT mark red for:
    // - Missing analysis (that's pending, not invalid)
    // - Low confidence scores (that's not a failure)
    // - Missing validation objects (that's pending, not invalid)
    // ABSOLUTELY NO IP-RELATED CHECKS HERE - IP FLAGGING DOES NOT AFFECT THIS
    // The following fields are COMPLETELY IGNORED in this function:
    // - session.client_ip_address
    // - session.agent_ip_address
    // - session.ip_analysis
    // - session.ip_flag_status
    // - session.ip_flag_reason
    // - session.session_data?.ipAnalysis
    // - session.client_city, client_region, client_country
    // - session.agent_city, agent_region, agent_country
    // - session.sameIp, sameCity, sameRegion (from ip_analysis.details)
    // - ANY GPS or location data
    if (screenshotInvalid || audioInvalid || missingBoth) {
      return 'red';
    }
    
    // Green light only if summary exists AND everything is valid (screenshot + audio only)
    // IP/location data is NOT considered for green light determination - it is purely informational
    return 'green';
  };

  // Helper function for backwards compatibility (for high impact filter)
  const hasRedLight = (session: PrecheckSession): boolean => {
    return getLightStatus(session) === 'red';
  };

  const filteredSessions = useMemo(() => {
    if (!Array.isArray(sessions) || sessions.length === 0) return [];
    
    // Cutoff date: February 9, 2026 00:00:00 - filtering only applies to sessions from this date onwards
    const filterCutoffDate = new Date('2026-02-09T00:00:00.000Z').getTime();
    
    return sessions.filter((session: PrecheckSession) => {
      const sessionDate = new Date(session.created_at || 0).getTime();
      const isBeforeCutoff = sessionDate < filterCutoffDate;
      
      const matchesSearch = !searchTerm || 
        session.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.client_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.agent_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.policy_number?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || session.verification_method === methodFilter;
      // 🔥 CRITICAL: Case-insensitive matching for producer/agent name filter
      const matchesproducer = producerFilter === 'all' || 
        (session.agent_name?.toLowerCase() === producerFilter?.toLowerCase()) || 
        (session.agent_email?.toLowerCase() === producerFilter?.toLowerCase());

      const sessionRGA = session.agent_rga_team || 'Unknown';
      const sessionMGA = session.agent_mga_team || 'Unknown';
      // 🔥 CRITICAL: Case-insensitive matching for MGA/RGA filters
      const matchesRGA = rgaFilter === 'all' || sessionRGA?.toLowerCase() === rgaFilter?.toLowerCase();
      const matchesMGA = mgaFilter === 'all' || sessionMGA?.toLowerCase() === mgaFilter?.toLowerCase();

      // For sessions before 2/9: skip completedCallsOnly and highImpactOnly filters
      // For sessions from 2/9 onwards: apply filters
      let matchesCompletedCall = true;
      let matchesHighImpact = true;
      
      if (!isBeforeCutoff) {
        // Check if verification call is completed (has call duration, recording, or taalk call URL)
        const hasCompletedCall = (session.call_duration && session.call_duration > 0) || 
                                 !!session.recording_url || 
                                 !!session.taalk_call_url;
        matchesCompletedCall = !completedCallsOnly || hasCompletedCall;

        // High impact filter: only show red light items
        matchesHighImpact = !highImpactOnly || hasRedLight(session);
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesproducer && matchesRGA && matchesMGA && matchesCompletedCall && matchesHighImpact;
    }).sort((a, b) => {
      // CRITICAL: Sort by created_at DESC to ensure most recent sessions appear first
      // This is a safety net in case backend ordering fails
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // Descending order (newest first)
    }).filter((session, index, array) => {
      // Deduplication: Keep only the most recent session for duplicates
      // A duplicate is defined as: same client (name + email + phone) + same agent
      // Only deduplicate if sessions are "pretty recent" (within 30 days of each other)
      const sessionKey = `${session.client_name?.toLowerCase() || ''}_${session.client_email?.toLowerCase() || ''}_${session.client_phone?.toLowerCase() || ''}_${session.agent_email?.toLowerCase() || ''}`;
      const sessionDate = new Date(session.created_at || 0).getTime();
      
      // Since array is sorted DESC, check if there's a more recent duplicate earlier in the array
      for (let i = 0; i < index; i++) {
        const earlierSession = array[i];
        const key = `${earlierSession.client_name?.toLowerCase() || ''}_${earlierSession.client_email?.toLowerCase() || ''}_${earlierSession.client_phone?.toLowerCase() || ''}_${earlierSession.agent_email?.toLowerCase() || ''}`;
        
        if (key === sessionKey) {
          // Found a duplicate - check if it's recent enough
          const earlierDate = new Date(earlierSession.created_at || 0).getTime();
          const daysDiff = Math.abs(sessionDate - earlierDate) / (1000 * 60 * 60 * 24);
          
          // If within 30 days, this is a duplicate - exclude this one (keep the more recent one)
          if (daysDiff <= 30) {
            return false;
          }
        }
      }
      
      // No more recent duplicate found, keep this session
      return true;
    });
  }, [sessions, searchTerm, statusFilter, methodFilter, producerFilter, rgaFilter, mgaFilter, completedCallsOnly, highImpactOnly]);

  const exportToCSV = () => {
    const csvData = filteredSessions.map((session: any) => ({
      ID: session.id,
      'producer': session.agent_email,
      'Client Name': session.client_name,
      'Client Email': session.client_email || '',
      'Client Phone': session.client_phone || '',
      'Attempts': session.attempts ?? 1,
      'City': session.city || '',
      'State': session.state || '',
      'MGA Team': session.agent_mga_team || '',
      'RGA Team': session.agent_rga_team || '',
      'Method': session.verification_method,
      'Status': session.status,
      'Policy Number': session.policy_number || '',
      'Premium Amount': session.premium_amount || '',
      'Created': new Date(session.created_at).toLocaleString(),
      'Completed': session.completed_at ? new Date(session.completed_at).toLocaleString() : '',
      'Duration (min)': session.call_duration ? Math.round(session.call_duration / 60) : '',
      'Score': session.verification_score || '',
      'Notes': session.verification_notes || ''
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aoi-precheck-sessions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={embedded ? 'h-full w-full overflow-auto bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900' : 'min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900'}>
      <div className={embedded ? 'container mx-auto px-3 py-3 max-w-[1600px]' : 'container mx-auto px-4 py-6'}>
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {isTeamManagerView && (
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="h-5 w-5 text-violet-600 shrink-0" />
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  Precheck Manager
                </h1>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 ml-auto flex-wrap">
              {embedded && onClose && (
                <Button onClick={onClose} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
              )}
              <Button
                onClick={async () => {
                  await refetchSessions();
                  queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/stats'] });
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => triggerAiSyncMutation.mutate()}
                disabled={triggerAiSyncMutation.isPending}
                variant="outline"
                size="sm"
                title="Re-run pending AI call summary fetch from Taalk"
              >
                {triggerAiSyncMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                Re-run AI Summary
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filters - Compact Single Row */}
        <Card className="mb-4">
          <CardContent className="py-3">
            {/* Stats in Filters - Single Line */}
            <div className="flex flex-wrap items-center gap-3 text-xs mb-3 pb-3 border-b">
              <span className="text-slate-600 dark:text-slate-400">Total Sessions: <span className="text-slate-900 dark:text-slate-100">{filteredSessions.length}</span></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">Completed: <span className="text-green-600">{filteredSessions.filter(s => s.status === 'completed').length}</span></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">In Progress: <span className="text-yellow-600">{filteredSessions.filter(s => s.status === 'in_progress').length}</span></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">Failed: <span className="text-red-600">{filteredSessions.filter(s => s.status === 'failed').length}</span></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">Today: <span className="text-purple-600">
                {filteredSessions.filter(s => {
                  const sessionDate = new Date(s.created_at);
                  const today = new Date();
                  return sessionDate.toDateString() === today.toDateString();
                }).length}
              </span></span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* High Impact Only Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="high-impact-only"
                  checked={highImpactOnly}
                  onCheckedChange={(checked) => setHighImpactOnly(checked === true)}
                />
                <Label
                  htmlFor="high-impact-only"
                  className="text-xs font-medium cursor-pointer"
                >
                  High Impact Only
                </Label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
              {/* Enhanced Search with Autocomplete */}
              <div className="relative w-48">
                <Popover open={searchOpen && (filteredSuggestions.length > 0 || searchTerm.trim().length > 0)} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
              <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400 z-10 pointer-events-none" />
                <Input
                        placeholder="Search..."
                  value={searchTerm}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSearchTerm(value);
                          if (value.trim()) {
                            setSearchOpen(true);
                          } else {
                            setSearchOpen(false);
                          }
                        }}
                        onFocus={() => {
                          if (searchTerm.trim() || filteredSuggestions.length > 0) {
                            setSearchOpen(true);
                          }
                        }}
                        className="pl-7 pr-2 h-8 text-xs"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[400px] p-0" 
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    sideOffset={5}
                  >
                    <Command shouldFilter={false}>
                      <CommandList>
                        <CommandEmpty>No matches found.</CommandEmpty>
                        {filteredSuggestions.length > 0 && (
                          <>
                            <CommandGroup heading="Producers">
                              {filteredSuggestions
                                .filter(s => s.type === 'producer')
                                .map((suggestion, idx) => (
                                  <CommandItem
                                    key={`producer-${idx}`}
                                    onSelect={() => handleSuggestionSelect(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <User className="mr-2 h-4 w-4" />
                                    {suggestion.label}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="MGA Teams">
                              {filteredSuggestions
                                .filter(s => s.type === 'mga')
                                .map((suggestion, idx) => (
                                  <CommandItem
                                    key={`mga-${idx}`}
                                    onSelect={() => handleSuggestionSelect(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <Award className="mr-2 h-4 w-4" />
                                    {suggestion.label}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="RGA Teams">
                              {filteredSuggestions
                                .filter(s => s.type === 'rga')
                                .map((suggestion, idx) => (
                                  <CommandItem
                                    key={`rga-${idx}`}
                                    onSelect={() => handleSuggestionSelect(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <Award className="mr-2 h-4 w-4" />
                                    {suggestion.label}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="Clients">
                              {filteredSuggestions
                                .filter(s => s.type === 'client')
                                .slice(0, 10)
                                .map((suggestion, idx) => (
                                  <CommandItem
                                    key={`client-${idx}`}
                                    onSelect={() => handleSuggestionSelect(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <User className="mr-2 h-4 w-4" />
                                    {suggestion.label}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="Status & Method">
                              {filteredSuggestions
                                .filter(s => s.type === 'status' || s.type === 'method')
                                .map((suggestion, idx) => (
                                  <CommandItem
                                    key={`status-method-${idx}`}
                                    onSelect={() => handleSuggestionSelect(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    {suggestion.type === 'status' ? (
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                    ) : (
                                      <Phone className="mr-2 h-4 w-4" />
                                    )}
                                    {suggestion.label}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="conference">Conference</SelectItem>
                </SelectContent>
              </Select>

              <Select value={producerFilter} onValueChange={setproducerFilter}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue placeholder="Producer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All producers</SelectItem>
                  {groupedproducers.map((producer, index) => (
                    <SelectItem key={`producer-${index}-${producer.name}`} value={producer.name}>
                      {producer.name} ({producer.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={rgaFilter} onValueChange={setRgaFilter}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="RGA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RGA Teams</SelectItem>
                  {Array.isArray(uniqueRGAs) ? uniqueRGAs.map((rga) => (
                    <SelectItem key={rga as string} value={rga as string}>{rga as string}</SelectItem>
                  )) : null}
                </SelectContent>
              </Select>

              <Select value={mgaFilter} onValueChange={setMgaFilter}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="MGA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MGA Teams</SelectItem>
                  {Array.isArray(uniqueMGAs) ? uniqueMGAs.map((mga) => (
                    <SelectItem key={mga as string} value={mga as string}>{mga as string}</SelectItem>
                  )) : null}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
            
            <div className="flex justify-end mt-2">
              <Button 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setMethodFilter('all');
                  setproducerFilter('all');
                  setRgaFilter('all');
                  setMgaFilter('all');
                  setDateRange('today');
                  setHighImpactOnly(true); // Reset to default (checked)
                  setCompletedCallsOnly(true); // Reset to default (checked)
                }}
                variant="outline"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sessions Table */}
        <div className="w-full -mx-4 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <span>Verification Sessions ({filteredSessions.length})</span>
                  <div className="flex items-center gap-2 text-sm font-normal text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>AI Result column is in testing - Please review each screenshot manually</span>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading sessions...</div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No sessions found matching your filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800">
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-20">Status</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Result</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Producer</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Client</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Phone</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Attempts</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-20">Premium</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-16">State</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Method</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Screen</th>
                      <th className="text-center py-1.5 px-2 font-normal text-xs w-16">Call</th>
                      {precheckIpTrackingEnabled && (
                        <th className="text-center py-1.5 px-2 font-normal text-xs w-16">IP</th>
                      )}
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-24">Created</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-40">Actions</th>
                      <th className="text-left py-1.5 px-2 font-normal text-xs w-32">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session: PrecheckSession) => (
                      <tr key={session.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="py-1.5 px-2 w-20">
                          <InlineStatusEditor 
                            session={session} 
                            updateStatusMutation={updateStatusMutation}
                            onStatusChange={() => {
                              queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/stats'] });
                            }}
                          />
                        </td>
                        {/* AI Result Column */}
                        <td className="py-1.5 px-2 w-16">
                          <div className="flex justify-center gap-1">
                            {(session.screenshot_validation || session.audio_analysis || session.call_transcript || session.ai_result_passed !== undefined) ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button 
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity bg-slate-100 dark:bg-slate-800"
                                    title="Click to view AI analysis"
                                  >
                                    {/* High Impact, Valid, or Grey (no summary) indicator */}
                                    {(() => {
                                      const status = getLightStatus(session);
                                      if (status === 'grey') {
                                        return (
                                          <div className="flex items-center justify-center text-slate-500">
                                            <div className="w-3 h-3 rounded-full bg-slate-400" />
                                          </div>
                                        );
                                      }
                                      const isRed = status === 'red';
                                      return (
                                        <div className={`flex items-center justify-center ${isRed ? 'text-red-600' : 'text-green-600'}`}>
                                          <div className={`w-4 h-4 rounded-full ${isRed ? 'bg-red-500' : 'bg-green-500'}`} style={{ boxShadow: isRed ? '0 0 8px rgba(239, 68, 68, 0.8)' : '0 0 8px rgba(34, 197, 94, 0.8)' }} />
                                        </div>
                                      );
                                    })()}
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <Bot className="w-5 h-5 text-purple-600" />
                                      AI Verification Analysis
                                    </DialogTitle>
                                  </DialogHeader>
                                  
                                  {/* Overall Status Indicator - High Impact/Valid or Grey (no summary) */}
                                  <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border-2">
                                    {(() => {
                                      const status = getLightStatus(session);
                                      if (status === 'grey') {
                                        return (
                                          <div className="flex items-center gap-3 text-slate-500">
                                            <div className="w-6 h-6 rounded-full bg-slate-400" />
                                            <span className="text-lg font-bold">NO SUMMARY AVAILABLE</span>
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                              (AI summary required for status)
                                            </span>
                                          </div>
                                        );
                                      }
                                      const isRed = status === 'red';
                                      return (
                                        <div className={`flex items-center gap-3 ${isRed ? 'text-red-600' : 'text-green-600'}`}>
                                          <div className={`w-6 h-6 rounded-full ${isRed ? 'bg-red-500' : 'bg-green-500'}`} style={{ boxShadow: isRed ? '0 0 12px rgba(239, 68, 68, 0.8)' : '0 0 12px rgba(34, 197, 94, 0.8)' }} />
                                          {isRed && (
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                              Questionable picture, recording, or missing both
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  
                                  <div className="space-y-6">
                                    {/* IP Analysis Section - Only visible to cnsysop */}
                                    {precheckIpTrackingEnabled && isCnsysop && (session.session_data?.ipAnalysis || session.ip_analysis || session.client_ip_address || session.agent_ip_address) && (
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <MapPin className="w-4 h-4 text-orange-600" />
                                          <h3 className="font-bold text-lg">IP & Location Analysis</h3>
                                        </div>
                                        
                                        {/* IP Analysis Status */}
                                        {(() => {
                                          const ipData = session.session_data?.ipAnalysis || session.ip_analysis;
                                          if (ipData) {
                                            const flagColors: Record<string, string> = {
                                              valid: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                                              pending: 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800',
                                              suspicious: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                                              flagged: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
                                              critical: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
                                            };
                                            const statusLabels: Record<string, { text: string; icon: any }> = {
                                              valid: { text: 'VALID - Different Locations', icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
                                              pending: { text: 'PENDING - Awaiting Data', icon: <Clock className="w-4 h-4 text-slate-600" /> },
                                              suspicious: { text: 'SUSPICIOUS - Same Region', icon: <AlertTriangle className="w-4 h-4 text-yellow-600" /> },
                                              flagged: { text: 'FLAGGED - Same City/Proximity', icon: <AlertTriangle className="w-4 h-4 text-orange-600" /> },
                                              critical: { text: 'CRITICAL - Same IP Address', icon: <XCircle className="w-4 h-4 text-red-600" /> },
                                            };
                                            const status = statusLabels[ipData.flagStatus] || statusLabels.pending;
                                            
                                            return (
                                              <>
                                                <div className={`p-4 rounded-lg border-2 ${flagColors[ipData.flagStatus] || flagColors.pending}`}>
                                                  <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold flex items-center gap-2">
                                                      {status.icon} {status.text}
                                                    </h4>
                                                    <Badge variant="outline" className="text-xs">
                                                      {((ipData.confidence ?? 0) * 100).toFixed(0)}% Confidence
                                                    </Badge>
                                                  </div>
                                                  {ipData.details?.distanceMiles !== null && (
                                                    <p className="text-xs">
                                                      Distance: <span className="font-medium">{ipData.details?.distanceMiles} miles apart</span>
                                                    </p>
                                                  )}
                                                </div>

                                                {/* Reasoning */}
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                  <h5 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                                                    <Bot className="w-3 h-3" />
                                                    Analysis Reason
                                                  </h5>
                                                  <p className="text-xs">{ipData.reason}</p>
                                                </div>

                                                {/* Flags Detail */}
                                                {ipData.details && (
                                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className={`p-2 rounded ${ipData.details.sameIp ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                                      Same IP: {ipData.details.sameIp ? '⚠️ YES' : '✅ No'}
                                                    </div>
                                                    <div className={`p-2 rounded ${ipData.details.sameCity ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                                      Same City: {ipData.details.sameCity ? '⚠️ YES' : '✅ No'}
                                                    </div>
                                                    <div className={`p-2 rounded ${ipData.details.sameRegion ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                                      Same Region: {ipData.details.sameRegion ? '⚠️ YES' : '✅ No'}
                                                    </div>
                                                    <div className={`p-2 rounded ${ipData.details.sameCountry ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-900/30'}`}>
                                                      Same Country: {ipData.details.sameCountry ? 'Yes' : 'No'}
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          }
                                          return null;
                                        })()}

                                        {/* Agent vs Client Location Comparison */}
                                        <div className="grid grid-cols-2 gap-4">
                                          {/* Agent Location */}
                                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                              <User className="w-3 h-3" /> Agent Location
                                            </h5>
                                            <div className="space-y-1 text-xs">
                                              <p><strong>IP:</strong> {session.agent_ip_address || 'Not captured'}</p>
                                              <p><strong>Location:</strong> {
                                                session.session_data?.ipAnalysis?.details?.agentLocation || 
                                                (session.agent_city ? `${session.agent_city}, ${session.agent_region || ''}` : 'Unknown')
                                              }</p>
                                            </div>
                                          </div>

                                          {/* Client Location */}
                                          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                              <User className="w-3 h-3" /> Client Location
                                            </h5>
                                            <div className="space-y-1 text-xs">
                                              <p><strong>IP:</strong> {session.client_ip_address || 'Not captured'}</p>
                                              <p><strong>Location:</strong> {
                                                session.session_data?.ipAnalysis?.details?.clientLocation || 
                                                (session.client_city ? `${session.client_city}, ${session.client_region || ''}` : 'Unknown')
                                              }</p>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Re-analyze button */}
                                        <button
                                          onClick={async () => {
                                            try {
                                              const response = await fetch(`/api/verification/session/${session.id}/analyze-ip`, {
                                                method: 'POST'
                                              });
                                              if (response.ok) {
                                                toast({
                                                  title: "IP Analysis Complete",
                                                  description: "Refresh to see updated analysis results"
                                                });
                                              }
                                            } catch (error) {
                                              console.error('Failed to analyze IP:', error);
                                            }
                                          }}
                                          className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                                        >
                                          🔄 Re-analyze IP Addresses
                                        </button>
                                      </div>
                                    )}

                                    {/* Screenshot Analysis Section */}
                                    {session.screenshot_validation && (
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <Image className="w-4 h-4 text-blue-600" />
                                          <h3 className="font-bold text-lg">Screenshot Analysis</h3>
                                        </div>
                                        
                                        {/* Overall Status */}
                                        <div className={`p-4 rounded-lg border-2 ${
                                          session.screenshot_validation?.isValid 
                                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                        }`}>
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold flex items-center gap-2">
                                              {session.screenshot_validation?.isValid ? (
                                                <><CheckCircle className="w-4 h-4 text-green-600" /> VALID</>
                                              ) : (
                                                <><XCircle className="w-4 h-4 text-red-600" /> FLAGGED</>
                                              )}
                                            </h4>
                                            <Badge variant="outline" className="text-xs">
                                              {(session.screenshot_validation?.confidence * 100).toFixed(0)}% Confidence
                                            </Badge>
                                          </div>
                                          <p className="text-xs">
                                            Type: <span className="capitalize">{session.screenshot_validation?.validationType?.replace(/_/g, ' ')}</span>
                                          </p>
                                        </div>

                                        {/* Reasoning */}
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                          <h5 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                                            <Bot className="w-3 h-3" />
                                            AI Analysis
                                          </h5>
                                          <p className="text-xs">{session.screenshot_validation?.reason}</p>
                                        </div>

                                        {/* Detected Elements */}
                                        {session.screenshot_validation?.detectedElements && (
                                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Detected Elements</h5>
                                            <ul className="text-xs space-y-1">
                                              {Object.entries(session.screenshot_validation?.detectedElements).map(([key, value]) => (
                                                <li key={key}>
                                                  <strong className="capitalize">{key.replace(/_/g, ' ')}:</strong> {String(value)}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Issues */}
                                        {session.screenshot_validation?.issues && session.screenshot_validation?.issues.length > 0 && (
                                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                                              <AlertTriangle className="w-3 h-3 text-yellow-600" />
                                              Detected Issues
                                            </h5>
                                            <ul className="text-xs space-y-1 list-disc list-inside">
                                              {session.screenshot_validation?.issues.map((issue, i) => (
                                                <li key={i}>{issue}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Timestamp */}
                                        {session.screenshot_validation?.validatedAt && (
                                          <div className="text-xs text-slate-500 text-center">
                                            Analyzed: {new Date(session.screenshot_validation?.validatedAt).toLocaleString()}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Audio Analysis Section */}
                                    {session.audio_analysis && (
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <Volume2 className="w-4 h-4 text-purple-600" />
                                          <h3 className="font-bold text-lg">Audio Call Analysis</h3>
                                        </div>
                                        
                                        {/* Overall Status */}
                                        <div className={`p-4 rounded-lg border-2 ${
                                          session.audio_analysis?.validation?.isValid 
                                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                        }`}>
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold flex items-center gap-2">
                                              {session.audio_analysis?.validation?.isValid ? (
                                                <><CheckCircle className="w-4 h-4 text-green-600" /> VALID CALL</>
                                              ) : (
                                                <><XCircle className="w-4 h-4 text-red-600" /> FLAGGED CALL</>
                                              )}
                                            </h4>
                                            <Badge variant="outline" className="text-xs">
                                              {((session.audio_analysis?.validation?.confidence ?? 0) * 100).toFixed(0)}% Confidence
                                            </Badge>
                                          </div>
                                          {session.audio_analysis?.sentiment && (
                                            <p className="text-xs">
                                              Sentiment: <span className="font-medium">{session.audio_analysis?.sentiment}</span>
                                            </p>
                                          )}
                                        </div>

                                        {/* Summary */}
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                          <h5 className="font-semibold mb-1 text-sm">Summary</h5>
                                          <p className="text-xs">{session.audio_analysis?.summary}</p>
                                        </div>

                                        {/* Reasoning */}
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                          <h5 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                                            <Bot className="w-3 h-3" />
                                            AI Analysis
                                          </h5>
                                          <p className="text-xs">{session.audio_analysis?.validation?.reason}</p>
                                        </div>

                                        {/* Key Moments */}
                                        {session.audio_analysis?.keyMoments && session.audio_analysis?.keyMoments.length > 0 && (
                                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-2 text-sm">Key Moments</h5>
                                            <ul className="text-xs space-y-2">
                                              {session.audio_analysis?.keyMoments.map((moment, i) => (
                                                <li key={i} className="flex gap-2">
                                                  <span className="font-mono text-purple-600">{moment.timestamp}</span>
                                                  <span>{moment.description}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Issues */}
                                        {session.audio_analysis?.validation?.detectedIssues && session.audio_analysis?.validation?.detectedIssues.length > 0 && (
                                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                                              <AlertTriangle className="w-3 h-3 text-yellow-600" />
                                              Detected Issues
                                            </h5>
                                            <ul className="text-xs space-y-1 list-disc list-inside">
                                              {session.audio_analysis?.validation?.detectedIssues.map((issue, i) => (
                                                <li key={i}>{issue}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Transcript Preview */}
                                        {session.audio_analysis?.transcript && (
                                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Transcript Preview</h5>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                                              {session.audio_analysis?.transcript}
                                            </p>
                                          </div>
                                        )}

                                        {/* Timestamp */}
                                        {session.audio_analysis?.analyzedAt && (
                                          <div className="text-xs text-slate-500 text-center">
                                            Analyzed: {new Date(session.audio_analysis?.analyzedAt).toLocaleString()}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Taalk AI Summary Section */}
                                    {(session.call_transcript || session.ai_quick_recap || session.ai_result_passed !== undefined) && (
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <Bot className="w-4 h-4 text-indigo-600" />
                                          <h3 className="font-bold text-lg">Taalk AI Analysis</h3>
                                        </div>
                                        
                                        {/* Pass/Fail Result */}
                                        {session.ai_result_passed !== undefined && (
                                          <div className={`p-4 rounded-lg border-2 ${
                                            session.ai_result_passed === true
                                              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                              : session.ai_result_passed === false
                                                ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                                : 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800'
                                          }`}>
                                            <div className="flex items-center justify-between mb-2">
                                              <h4 className="font-bold flex items-center gap-2">
                                                {session.ai_result_passed === true ? (
                                                  <><CheckCircle className="w-5 h-5 text-green-600" /> VERIFICATION PASSED</>
                                                ) : session.ai_result_passed === false ? (
                                                  <><XCircle className="w-5 h-5 text-red-600" /> VERIFICATION FAILED</>
                                                ) : (
                                                  <><Clock className="w-5 h-5 text-slate-600" /> VERIFICATION PENDING</>
                                                )}
                                              </h4>
                                              {session.ai_sentiment_score !== undefined && (
                                                <Badge variant="outline" className="text-xs">
                                                  Sentiment: {session.ai_sentiment_score}/10
                                                </Badge>
                                              )}
                                            </div>
                                            {session.ai_preview && (
                                              <p className="text-xs font-medium">{session.ai_preview}</p>
                                            )}
                                          </div>
                                        )}

                                        {/* Quick Recap */}
                                        {session.ai_quick_recap && (
                                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Quick Recap</h5>
                                            <TranslatedText text={session.ai_quick_recap} className="text-xs" />
                                          </div>
                                        )}

                                        {/* Compliance Checklist */}
                                        {(session.compliance_agent_confirmed !== undefined || session.compliance_contact_verified !== undefined) && (
                                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                              <Shield className="w-3 h-3" /> Compliance Checklist
                                            </h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              {[
                                                { key: 'compliance_contact_verified', label: 'Contact Verified' },
                                                { key: 'compliance_premium_ok', label: 'Premium OK' },
                                                { key: 'compliance_medical_asked', label: 'Medical Q\'s Asked' },
                                                { key: 'compliance_meds_asked', label: 'Meds Q\'s Asked' },
                                                { key: 'compliance_legal_asked', label: 'Legal Q\'s Asked' },
                                                { key: 'compliance_needs_analysis', label: 'Needs Analysis' },
                                                { key: 'compliance_info_accurate', label: 'Info Accurate' },
                                                { key: 'compliance_ach_explained', label: 'ACH Explained' },
                                                { key: 'compliance_client_satisfied', label: 'Client Satisfied' },
                                              ].map(({ key, label }) => {
                                                const value = (session as any)[key];
                                                if (value === undefined) return null;
                                                return (
                                                  <div key={key} className="flex items-center gap-1">
                                                    {value ? (
                                                      <CheckCircle className="w-3 h-3 text-green-600" />
                                                    ) : (
                                                      <XCircle className="w-3 h-3 text-red-600" />
                                                    )}
                                                    <span>{label}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        {/* Next Steps */}
                                        {session.ai_next_steps && (
                                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Next Steps</h5>
                                            <p className="text-xs">{session.ai_next_steps}</p>
                                          </div>
                                        )}

                                        {/* Key Topics */}
                                        {session.ai_key_topics && (
                                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Key Topics</h5>
                                            <p className="text-xs">{session.ai_key_topics}</p>
                                          </div>
                                        )}

                                        {/* Red Flags */}
                                        {session.ai_red_flags && session.ai_red_flags.toLowerCase() !== 'none' && (
                                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm flex items-center gap-2">
                                              <AlertTriangle className="w-3 h-3 text-red-600" /> Red Flags
                                            </h5>
                                            <p className="text-xs text-red-700 dark:text-red-400">{session.ai_red_flags}</p>
                                          </div>
                                        )}

                                        {/* Favorite Feature */}
                                        {session.ai_favorite_feature && (
                                          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Client's Favorite Feature</h5>
                                            <p className="text-xs">{session.ai_favorite_feature}</p>
                                          </div>
                                        )}

                                        {/* Full Transcript */}
                                        {session.call_transcript && (
                                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <h5 className="font-semibold mb-1 text-sm">Full Transcript</h5>
                                            <div className="text-xs text-slate-600 dark:text-slate-400 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
                                              {session.call_transcript}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ) : (() => {
                              // Check for missing data (red flags)
                              const hasScreenshotFile = !!(session.screenshot_url || session.screenshot_path);
                              const hasScreenshotValidation = !!(session.screenshot_validation || session.screenshot_analysis_complete);
                              const missingScreenshot = !hasScreenshotFile && !hasScreenshotValidation;
                              
                              const hasRecordingFile = !!(session.recording_url || session.taalk_call_url);
                              const hasCallData = !!(session.call_transcript || session.ai_quick_recap || session.ai_result || session.audio_analysis);
                              const missingCallRecording = !hasRecordingFile && !hasCallData;
                              
                              // IP/location data is NOT checked for red flag - IP does not affect status
                              
                              // If any data is missing, show red flag (screenshot and recording only, NOT IP)
                              if (missingScreenshot || missingCallRecording) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                    <Flag className="w-3 h-3" />
                                    FLAG
                                  </span>
                                );
                              }
                              
                              // Otherwise show dash
                              return <span className="text-xs text-slate-400">—</span>;
                            })()}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs truncate">{session.agent_name || 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-32">
                          <div className="text-xs truncate">{session.client_name || 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-24">
                          <div className="text-xs truncate">{session.client_phone || 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-16 text-center">
                          <span className="text-xs font-medium">{session.attempts ?? 1}</span>
                        </td>
                        <td className="py-1.5 px-2 w-20">
                          <div className="text-xs truncate">{session.premium_amount ? `$${session.premium_amount.toLocaleString()}` : 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-16">
                          <div className="text-xs truncate">{session.state || 'N/A'}</div>
                        </td>
                        <td className="py-1.5 px-2 w-16 text-center">
                          <Badge className={`${METHOD_COLORS[session.verification_method]} text-xs px-1 py-0`}>
                            {session.verification_method.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 w-16">
                          {(() => {
                            // Check if screenshot file exists
                            const hasScreenshotFile = !!(session.screenshot_url || session.screenshot_path);
                            // Check if we have validation/analysis data
                            const hasValidation = !!(session.screenshot_validation || session.screenshot_analysis_complete);
                            
                            // If no screenshot file AND no validation, show flag
                            if (!hasScreenshotFile && !hasValidation) {
                              return (
                                <div className="flex items-center justify-center" title="Screenshot missing - No screenshot file or analysis available">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md">
                                    <Flag className="h-3 w-3" />
                                  </div>
                                </div>
                              );
                            }
                            
                            // If we have validation or analysis, show the hover card
                            return hasValidation ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <div className="flex items-center justify-center cursor-pointer" title="Screenshot AI Analysis - Hover for details">
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                      (() => {
                                        // Red if validation exists and is invalid
                                        if (session.screenshot_validation && !session.screenshot_validation.isValid) {
                                          return 'bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md';
                                        }
                                        
                                        // Green if validation exists and is valid
                                        if (session.screenshot_validation && session.screenshot_validation.isValid) {
                                          return 'bg-green-600 border-green-700 text-white dark:bg-green-700 dark:border-green-800 shadow-md';
                                        }
                                        
                                        // Default grey (shouldn't happen if validation exists)
                                        return 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500';
                                      })()
                                    }`}
                                  >
                                    <Image className="h-4 w-4" />
                                  </div>
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-96 p-4" side="right" align="start" sideOffset={10}>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Image className="w-4 h-4 text-blue-600" />
                                    <h3 className="font-bold text-base">Screenshot AI Analysis</h3>
                                  </div>
                                  
                                  {session.screenshot_validation ? (
                                    <>
                                      {/* Overall Status */}
                                      <div className={`p-3 rounded-lg border ${
                                        session.screenshot_validation?.isValid 
                                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                          : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                      }`}>
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            {session.screenshot_validation?.isValid ? (
                                              <CheckCircle className="w-4 h-4 text-green-600" />
                                            ) : (
                                              <XCircle className="w-4 h-4 text-red-600" />
                                            )}
                                            <span className="font-semibold text-sm">
                                              {session.screenshot_validation?.isValid ? 'VALID' : 'INVALID'}
                                            </span>
                                          </div>
                                          <Badge variant="outline" className="text-xs">
                                            {(session.screenshot_validation?.confidence * 100).toFixed(0)}% Confidence
                                          </Badge>
                                        </div>
                                        <p className="text-xs">
                                          Type: <span className="capitalize">{session.screenshot_validation?.validationType?.replace(/_/g, ' ')}</span>
                                        </p>
                                      </div>

                                      {/* Reasoning */}
                                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <h5 className="font-semibold mb-1 flex items-center gap-2 text-xs">
                                          <Bot className="w-3 h-3" />
                                          AI Analysis
                                        </h5>
                                        <p className="text-xs text-slate-900 dark:text-slate-100">{session.screenshot_validation?.reason}</p>
                                      </div>

                                      {/* Detected Elements */}
                                      {session.screenshot_validation?.detectedElements && (
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                          <h5 className="font-semibold mb-1 text-xs">Detected Elements</h5>
                                          <ul className="text-xs space-y-1">
                                            {Object.entries(session.screenshot_validation?.detectedElements).slice(0, 5).map(([key, value]) => (
                                              <li key={key}>
                                                <strong className="capitalize">{key.replace(/_/g, ' ')}:</strong> {String(value)}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {/* Issues */}
                                      {session.screenshot_validation?.issues && session.screenshot_validation?.issues.length > 0 && (
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                          <h5 className="font-semibold mb-1 flex items-center gap-2 text-xs">
                                            <AlertTriangle className="w-3 h-3 text-yellow-600" />
                                            Issues
                                          </h5>
                                          <ul className="text-xs space-y-1 list-disc list-inside">
                                            {session.screenshot_validation?.issues.map((issue: string, i: number) => (
                                              <li key={i}>{issue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Analysis in progress...</p>
                                  )}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                            ) : (
                              <div className="flex flex-col items-center gap-1" title="Screenshot AI analysis status - No analysis available">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md">
                                  <Flag className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">!</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-1.5 px-2 w-16">
                          {(() => {
                            // Check for ACTUAL AI summary data (not just flags)
                            // Validate taalk_ai_summary to exclude "PENDING" and empty values
                            const isValidSummary = (summary: any): boolean => {
                              if (!summary) return false;
                              if (typeof summary === 'string') {
                                const trimmed = summary.trim();
                                return trimmed !== '' && trimmed !== '[]' && trimmed !== 'PENDING' && trimmed.toUpperCase() !== 'PENDING';
                              }
                              if (Array.isArray(summary)) {
                                return summary.length > 0;
                              }
                              return !!summary;
                            };
                            
                            // Only check ACTUAL AI summary fields - NOT transcript
                            const hasActualSummary = session.ai_quick_recap || session.ai_result || session.ai_key_topics || isValidSummary(session.taalk_ai_summary);
                            const hasAnalysis = session.audio_analysis && (session.audio_analysis.validation || session.audio_analysis.summary);
                            const hasConfidence = session.call_analysis_confidence !== null || session.audio_analysis?.validation?.confidence !== null;
                            // Check if recording file exists
                            const hasRecordingFile = !!(session.recording_url || session.taalk_call_url);
                            
                            // Only show button if there's actual data to display
                            const shouldShowButton = hasActualSummary || hasAnalysis || hasConfidence;
                            
                            // If no recording file AND no data, show flag
                            if (!hasRecordingFile && !shouldShowButton) {
                              return (
                                <div className="flex items-center justify-center" title="Call recording missing - No recording file or analysis available">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md">
                                    <Flag className="h-3 w-3" />
                                  </div>
                                </div>
                              );
                            }
                            
                            return shouldShowButton ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <div className="flex items-center justify-center cursor-pointer" title="Call AI Summary - Hover for details">
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                      (() => {
                                        // Check if call is under 3 minutes (180 seconds) and AI summary is PENDING
                                        const callDurationSeconds = session.call_duration || 0;
                                        const isUnder3Minutes = callDurationSeconds > 0 && callDurationSeconds < 180;
                                        const isSummaryPending = !isValidSummary(session.taalk_ai_summary) && 
                                                               (!session.ai_quick_recap && !session.ai_result && !session.ai_key_topics);
                                        
                                        // RED if call is under 3 minutes and summary is pending (incomplete summary)
                                        if (isUnder3Minutes && isSummaryPending) {
                                          return 'bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md';
                                        }
                                        
                                        // Check for actual AI call data
                                        const hasTaalkData = session.call_transcript || session.ai_quick_recap || session.ai_result;
                                        const hasAnalysis = session.audio_analysis && (session.audio_analysis.validation || session.audio_analysis.summary);
                                        const hasAnyData = hasTaalkData || hasAnalysis;
                                        
                                        // Grey if no actual data
                                        if (!hasAnyData) {
                                          return 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500';
                                        }

                                        const rawConfidence =
                                          session.call_analysis_confidence ??
                                          session.audio_analysis?.validation?.confidence ??
                                          null;
                                        const confidencePercent =
                                          rawConfidence === null
                                            ? null
                                            : rawConfidence > 1
                                              ? rawConfidence
                                              : rawConfidence * 100;

                                        const audioInvalid =
                                          session.audio_analysis?.validation?.isValid === false;
                                        
                                        // Check if Taalk AI result is failed - ONLY mark red if EXPLICITLY failed
                                        const taalkFailed = session.ai_result_passed === false;

                                        // CRITICAL: Only mark RED if EXPLICITLY failed - do NOT mark red for low confidence
                                        // Low confidence is NOT a failure - it's just lower confidence
                                        // Only mark red if validation.isValid is EXPLICITLY false OR ai_result_passed is EXPLICITLY false
                                        if (audioInvalid || taalkFailed) {
                                          return 'bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md';
                                        }

                                        // Green if passed OR has data (even with low confidence - low confidence is not a failure)
                                        // If ai_result_passed is true OR undefined (not explicitly failed), show green
                                        return 'bg-green-600 border-green-700 text-white dark:bg-green-700 dark:border-green-800 shadow-md';
                                      })()
                                    }`}
                                  >
                                    <Play className="h-4 w-4" />
                                  </div>
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-96 p-4" side="right" align="start" sideOffset={10}>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Bot className="w-4 h-4 text-indigo-600" />
                                    <h3 className="font-bold text-base">Call AI Summary</h3>
                                  </div>
                                  
                                  {/* Pass/Fail Result */}
                                  {session.ai_result_passed !== undefined && (
                                    <div className={`p-3 rounded-lg border ${
                                      session.ai_result_passed 
                                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                    }`}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {session.ai_result_passed === true ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : session.ai_result_passed === false ? (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          ) : (
                                            <Clock className="w-4 h-4 text-slate-600" />
                                          )}
                                          <span className="font-semibold text-sm">
                                            {session.ai_result_passed === true 
                                              ? 'VERIFICATION PASSED' 
                                              : session.ai_result_passed === false 
                                                ? 'VERIFICATION FAILED' 
                                                : 'PENDING'}
                                          </span>
                                        </div>
                                        {session.ai_sentiment_score !== undefined && (
                                          <Badge variant="outline" className="text-xs">
                                            {session.ai_sentiment_score}/10
                                          </Badge>
                                        )}
                                      </div>
                                      {session.ai_preview && (
                                        <p className="text-xs mt-2 text-slate-700 dark:text-slate-300">{session.ai_preview}</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Quick Recap */}
                                  {session.ai_quick_recap && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      <h5 className="font-semibold mb-1 text-xs text-slate-600 dark:text-slate-400">Quick Recap</h5>
                                      <TranslatedText text={session.ai_quick_recap} className="text-sm text-slate-900 dark:text-slate-100" />
                                    </div>
                                  )}

                                  {/* Key Topics */}
                                  {session.ai_key_topics && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                      <h5 className="font-semibold mb-1 text-xs text-blue-600 dark:text-blue-400">Key Topics</h5>
                                      <TranslatedText text={session.ai_key_topics} className="text-sm text-blue-900 dark:text-blue-100" />
                                    </div>
                                  )}

                                  {/* Result */}
                                  {session.ai_result && !session.ai_result_passed && (
                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                      <h5 className="font-semibold mb-1 text-xs text-orange-600 dark:text-orange-400">Result</h5>
                                      <p className="text-sm text-orange-900 dark:text-orange-100">{session.ai_result}</p>
                                    </div>
                                  )}

                                  {/* Red Flags */}
                                  {session.ai_red_flags && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                      <h5 className="font-semibold mb-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Red Flags
                                      </h5>
                                      <p className="text-sm text-red-900 dark:text-red-100">{session.ai_red_flags}</p>
                                    </div>
                                  )}

                                  {/* Next Steps */}
                                  {session.ai_next_steps && (
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                      <h5 className="font-semibold mb-1 text-xs text-purple-600 dark:text-purple-400">Next Steps</h5>
                                      <p className="text-sm text-purple-900 dark:text-purple-100">{session.ai_next_steps}</p>
                                    </div>
                                  )}

                                  {/* Sentiment Score (if no result shown) */}
                                  {session.ai_sentiment_score !== undefined && session.ai_result_passed === undefined && (
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                      <h5 className="font-semibold mb-1 text-xs text-indigo-600 dark:text-indigo-400">Sentiment Score</h5>
                                      <p className="text-sm text-indigo-900 dark:text-indigo-100">{session.ai_sentiment_score}/10</p>
                                    </div>
                                  )}

                                  {/* No data message */}
                                  {!session.ai_quick_recap && !session.ai_result && session.ai_result_passed === undefined && session.ai_sentiment_score === undefined && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">No AI summary data available yet</p>
                                  )}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                              <div className="flex flex-col items-center gap-1" title="Call AI Summary - No data available">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md">
                                <Flag className="h-4 w-4" />
                              </div>
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">!</span>
                            </div>
                            );
                          })()}
                        </td>
                        {/* IP Flag Column - temporarily disabled */}
                        {precheckIpTrackingEnabled && (
                        <td className="py-1.5 px-2 w-16">
                          <div className="flex flex-col items-center gap-1" title="IP location analysis - checks if agent and client are in same location">
                            {(() => {
                              const ipData = session.session_data?.ipAnalysis || session.ip_analysis;
                              const hasClientIp = !!session.client_ip_address;
                              const hasAgentIp = !!session.agent_ip_address;
                              const hasBothIps = hasClientIp && hasAgentIp;
                              const hasAnyIp = hasClientIp || hasAgentIp;
                              
                              // Get flag status from multiple possible locations
                              const flagStatus = session.ip_flag_status || ipData?.flagStatus || ipData?.flag_status;
                              
                              // If no IPs at all - RED FLAG (missing data)
                              if (!hasAnyIp && !flagStatus) {
                                return (
                                  <div className="flex items-center justify-center">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md">
                                      <Flag className="h-3 w-3" />
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Determine color based on flag status and IP completeness
                              // Red = flagged/incomplete (missing one IP), Grey = no data, Green = valid
                              const confidence = ipData?.confidence ?? (ipData?.risk_score ? ipData.risk_score / 100 : 0);
                              
                              let colorClass = 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500';
                              let statusText = 'No Data';
                              
                              // Check if we're missing one IP (incomplete data = RED FLAG)
                              if (!hasBothIps && hasAnyIp) {
                                // Missing one IP - RED FLAG (incomplete/problematic)
                                colorClass = 'bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md';
                                statusText = 'INCOMPLETE';
                              } else if (flagStatus === 'critical' || flagStatus === 'flagged' || flagStatus === 'suspicious') {
                                // Flagged - red
                                colorClass = 'bg-red-600 border-red-700 text-white dark:bg-red-700 dark:border-red-800 shadow-md';
                                statusText = flagStatus === 'critical' ? 'CRITICAL' : flagStatus === 'flagged' ? 'FLAGGED' : 'REVIEW';
                              } else if (flagStatus === 'valid') {
                                // Valid - green
                                colorClass = 'bg-green-600 border-green-700 text-white dark:bg-green-700 dark:border-green-800 shadow-md';
                                statusText = 'VALID';
                              } else if (!hasAnyIp) {
                                // No IPs at all - grey
                                colorClass = 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500';
                                statusText = 'No Data';
                              } else if (flagStatus === 'pending') {
                                // Pending - grey
                                colorClass = 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500';
                                statusText = 'Pending';
                              }
                              
                              // Get IP analysis data - prioritize database columns, then fallback to session_data
                              const ipAnalysis = session.ip_analysis || session.session_data?.ipAnalysis;
                              const ipFlagStatus = session.ip_flag_status || ipData?.flagStatus || ipData?.flag_status || flagStatus;
                              const ipFlagReason = session.ip_flag_reason || ipData?.reason;
                              const ipAnalysisSummary = session.ip_analysis_summary || ipFlagReason || ipAnalysis?.reason || 'No analysis summary available';
                              
                              // Get details from the ip_analysis JSONB field
                              const analysisDetails = ipAnalysis?.details || {};
                              const distanceMiles = analysisDetails.distanceMiles ?? analysisDetails.distance_miles;
                              const sameCity = analysisDetails.sameCity ?? analysisDetails.same_city;
                              const sameRegion = analysisDetails.sameRegion ?? analysisDetails.same_region;
                              const sameCountry = analysisDetails.sameCountry ?? analysisDetails.same_country;
                              const sameIp = analysisDetails.sameIp ?? analysisDetails.same_ip;
                              const agentLocation = analysisDetails.agentLocation ?? analysisDetails.agent_location;
                              const clientLocation = analysisDetails.clientLocation ?? analysisDetails.client_location;
                              const agentVpn = analysisDetails.agentVpn ?? analysisDetails.agent_vpn;
                              const clientVpn = analysisDetails.clientVpn ?? analysisDetails.client_vpn;
                              
                              // GPS overrides IP-based VPN detection - check GPS before showing VPN warnings
                              const hasAgentGps = !!(session.agent_latitude && session.agent_longitude);
                              const hasClientGps = !!(session.client_latitude && session.client_longitude);
                              
                              // Only show VPN if GPS is not available (GPS overrides IP detection)
                              const shouldShowAgentVpn = (agentVpn || session.agent_is_vpn) && !hasAgentGps;
                              const shouldShowClientVpn = (clientVpn || session.client_is_vpn) && !hasClientGps;
                              
                              // Check for incomplete IP data
                              const missingClientIp = !hasClientIp && hasAgentIp;
                              const missingAgentIp = hasClientIp && !hasAgentIp;
                              
                              return (
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <div className="cursor-pointer">
                                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${colorClass}`}>
                                        <MapPin className="h-3 w-3" />
                                      </div>
                                    </div>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-[420px] p-4">
                                    <div className="space-y-4">
                                      {/* Header with Status Badge */}
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-semibold text-base">IP Address Analysis</h4>
                                        {(!hasBothIps && hasAnyIp) ? (
                                          <Badge variant="destructive" className="text-xs font-medium">
                                            INCOMPLETE
                                          </Badge>
                                        ) : ipFlagStatus && ipFlagStatus !== 'pending' ? (
                                          <Badge 
                                            variant={ipFlagStatus === 'valid' ? 'default' : ipFlagStatus === 'critical' ? 'destructive' : 'destructive'} 
                                            className="text-xs font-medium"
                                          >
                                            {ipFlagStatus.toUpperCase()}
                                          </Badge>
                                        ) : null}
                                      </div>
                                      
                                      {/* Incomplete IP Warning */}
                                      {(!hasBothIps && hasAnyIp) && (
                                        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                                          <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                              <p className="text-sm font-semibold text-red-900 dark:text-red-100">Incomplete IP Data</p>
                                              <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                                                {missingClientIp && 'Client IP address not captured'}
                                                {missingAgentIp && 'Agent IP address not captured'}
                                                {'. Analysis requires both IPs to validate location.'}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Geolocation Denial - NOT A FLAG if IP address exists */}
                                      {/* REMOVED: Geolocation denial is NOT suspicious if IP address is available */}

                                      {/* VPN Warning Section - Prominent */}
                                      {/* GPS overrides IP-based VPN detection - only show VPN if GPS not available */}
                                      {(shouldShowAgentVpn || shouldShowClientVpn) && (
                                        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                                          <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 space-y-1.5">
                                              <p className="text-sm font-semibold text-red-900 dark:text-red-100">VPN/Proxy Detected</p>
                                              {shouldShowAgentVpn && (
                                                <div className="text-xs text-red-800 dark:text-red-200">
                                                  <strong>Agent:</strong> Using VPN/Proxy
                                                  {session.agent_isp && (
                                                    <span className="block text-red-700 dark:text-red-400 mt-0.5 font-semibold">ISP: {session.agent_isp}</span>
                                                  )}
                                                  {session.agent_vpn_detection_reason && (
                                                    <span className="block text-red-600 dark:text-red-300 mt-0.5">{session.agent_vpn_detection_reason}</span>
                                                  )}
                                                </div>
                                              )}
                                              {shouldShowClientVpn && (
                                                <div className="text-xs text-red-800 dark:text-red-200">
                                                  <strong>Client:</strong> Using VPN/Proxy
                                                  {session.client_isp && (
                                                    <span className="block text-red-700 dark:text-red-400 mt-0.5 font-semibold">ISP: {session.client_isp}</span>
                                                  )}
                                                  {session.client_vpn_detection_reason && (
                                                    <span className="block text-red-600 dark:text-red-300 mt-0.5">{session.client_vpn_detection_reason}</span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Analysis Summary */}
                                      {ipAnalysisSummary && ipAnalysisSummary !== 'No analysis summary available' && (
                                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                          {ipAnalysisSummary}
                                        </div>
                                      )}

                                      {/* Location Details */}
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                          {/* Client IP Card */}
                                          <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <User className="h-3.5 w-3.5 text-slate-500" />
                                              <strong className="text-xs text-slate-700 dark:text-slate-300">Client</strong>
                                              {session.client_is_vpn && (
                                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">VPN</Badge>
                                              )}
                                              {/* Device Geolocation Badge */}
                                              {session.client_latitude && session.client_longitude && (
                                                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-green-600 text-white">GPS</Badge>
                                              )}
                                            </div>
                                            <p className="text-xs font-mono text-slate-900 dark:text-slate-100 mb-1">
                                              {session.client_ip_address || 'Not captured'}
                                            </p>
                                            {/* ✅ ISP Name - Shows VPN/hosting provider */}
                                            {session.client_isp && (
                                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 italic">
                                                ISP: {session.client_isp}
                                              </p>
                                            )}
                                            {/* PRIORITIZE Device Geolocation */}
                                            {session.client_latitude && session.client_longitude ? (
                                              <div className="space-y-1">
                                                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                                  📍 Device Location (GPS)
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                                  {parseFloat(session.client_latitude).toFixed(4)}, {parseFloat(session.client_longitude).toFixed(4)}
                                                </p>
                                                <GPSLocationName latitude={session.client_latitude} longitude={session.client_longitude} />
                                            {(session.client_city || clientLocation) && (
                                                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                                {session.client_city ? (
                                                  <>
                                                    {session.client_city}
                                                    {session.client_region && `, ${session.client_region}`}
                                                    {session.client_country && session.client_region !== session.client_country && `, ${session.client_country}`}
                                                  </>
                                                ) : (
                                                  clientLocation || 'Location unknown'
                                                )}
                                                    <span className="ml-1 text-[10px]">(IP-based)</span>
                                              </p>
                                            )}
                                              </div>
                                            ) : (session.client_city || clientLocation) ? (
                                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                                {session.client_city ? (
                                                  <>
                                                    {session.client_city}
                                                    {session.client_region && `, ${session.client_region}`}
                                                    {session.client_country && session.client_region !== session.client_country && `, ${session.client_country}`}
                                                  </>
                                                ) : (
                                                  clientLocation || 'Location unknown'
                                                )}
                                                <span className="ml-1 text-[10px] text-slate-400">(IP-based)</span>
                                              </p>
                                            ) : null}
                                          </div>

                                          {/* Agent IP Card */}
                                          <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <User className="h-3.5 w-3.5 text-slate-500" />
                                              <strong className="text-xs text-slate-700 dark:text-slate-300">Agent</strong>
                                              {session.agent_is_vpn && (
                                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">VPN</Badge>
                                              )}
                                              {/* Device Geolocation Badge */}
                                              {session.agent_latitude && session.agent_longitude && (
                                                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-green-600 text-white">GPS</Badge>
                                              )}
                                            </div>
                                            <p className="text-xs font-mono text-slate-900 dark:text-slate-100 mb-1">
                                              {session.agent_ip_address || 'Not captured'}
                                            </p>
                                            {/* ✅ ISP Name - Shows VPN/hosting provider */}
                                            {session.agent_isp && (
                                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 italic">
                                                ISP: {session.agent_isp}
                                              </p>
                                            )}
                                            {/* PRIORITIZE Device Geolocation */}
                                            {session.agent_latitude && session.agent_longitude ? (
                                              <div className="space-y-1">
                                                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                                  📍 Device Location (GPS)
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                                  {parseFloat(session.agent_latitude).toFixed(4)}, {parseFloat(session.agent_longitude).toFixed(4)}
                                                </p>
                                                <GPSLocationName latitude={session.agent_latitude} longitude={session.agent_longitude} />
                                            {(session.agent_city || agentLocation) && (
                                                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                                {session.agent_city ? (
                                                  <>
                                                    {session.agent_city}
                                                    {session.agent_region && `, ${session.agent_region}`}
                                                    {session.agent_country && session.agent_region !== session.agent_country && `, ${session.agent_country}`}
                                                  </>
                                                ) : (
                                                  agentLocation || 'Location unknown'
                                                )}
                                                    <span className="ml-1 text-[10px]">(IP-based)</span>
                                              </p>
                                            )}
                                              </div>
                                            ) : (session.agent_city || agentLocation) ? (
                                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                                {session.agent_city ? (
                                                  <>
                                                    {session.agent_city}
                                                    {session.agent_region && `, ${session.agent_region}`}
                                                    {session.agent_country && session.agent_region !== session.agent_country && `, ${session.agent_country}`}
                                                  </>
                                                ) : (
                                                  agentLocation || 'Location unknown'
                                                )}
                                                <span className="ml-1 text-[10px] text-slate-400">(IP-based)</span>
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>

                                        {/* Analysis Metrics */}
                                        {ipAnalysis && analysisDetails && (distanceMiles !== null || sameIp || sameCity || sameRegion) && (
                                          <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Analysis Details</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                              {distanceMiles !== null && distanceMiles !== undefined && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-600 dark:text-slate-400">Distance:</span>
                                                  <span className="font-medium text-slate-900 dark:text-slate-100">
                                                    {typeof distanceMiles === 'number' ? distanceMiles.toFixed(1) : distanceMiles} mi
                                                  </span>
                                                </div>
                                              )}
                                              {sameIp !== undefined && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-600 dark:text-slate-400">Same IP:</span>
                                                  <span className={`font-medium ${sameIp ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {sameIp ? 'Yes ⚠️' : 'No'}
                                                  </span>
                                                </div>
                                              )}
                                              {sameCity !== undefined && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-600 dark:text-slate-400">Same City:</span>
                                                  <span className={`font-medium ${sameCity ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {sameCity ? 'Yes ⚠️' : 'No'}
                                                  </span>
                                                </div>
                                              )}
                                              {sameRegion !== undefined && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-600 dark:text-slate-400">Same Region:</span>
                                                  <span className={`font-medium ${sameRegion ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {sameRegion ? 'Yes' : 'No'}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            })()}
                          </div>
                        </td>
                        )}
                        <td className="py-1.5 px-2 w-24">
                          <div className="text-xs">{new Date(session.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="py-1.5 px-2 w-40">
                          <div className="flex gap-1">

                            {/* Picture Button with Hover Preview */}
                            {/* ✅ FIXED: Check if screenshot_url OR screenshot_path exists AND is valid (not empty/null/PENDING) */}
                            {/* ✅ FIXED: Button is grey if image fails to load */}
                            {(() => {
                              const hasScreenshot = (session.screenshot_url && 
                                                   session.screenshot_url.trim() !== '' && 
                                                   session.screenshot_url !== 'PENDING' &&
                                                   session.screenshot_url !== 'null') ||
                                                  (session.screenshot_path && 
                                                   session.screenshot_path.trim() !== '' && 
                                                   session.screenshot_path !== 'PENDING' &&
                                                   session.screenshot_path !== 'null');
                              const screenshotUrl = session.screenshot_url && 
                                                   session.screenshot_url !== 'PENDING' &&
                                                   session.screenshot_url !== 'null' 
                                                   ? session.screenshot_url 
                                                   : session.screenshot_path;
                              
                              // ✅ Check if this screenshot failed to load
                              const imageFailed = failedScreenshots.has(session.id);
                              
                              // If no screenshot OR image failed to load → grey button
                              if (!hasScreenshot || !screenshotUrl || imageFailed) {
                                return (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-6 w-6 p-0 text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed border-gray-300 dark:border-gray-700 opacity-50"
                                    data-testid={`button-picture-${session.id}`}
                                    title={imageFailed ? "Screenshot failed to load" : "No screenshot available"}
                                    disabled
                                  >
                                    <Image className="h-3 w-3" />
                                  </Button>
                                );
                              }
                              
                              // Has screenshot and hasn't failed → green button
                              return (
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="h-6 w-6 p-0 text-white bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 shadow-md"
                                      onClick={() => {
                                        // Create a deep copy to prevent stale data when page refreshes
                                        setPictureSession(JSON.parse(JSON.stringify(session)));
                                      }}
                                      data-testid={`button-picture-${session.id}`}
                                      title="Hover to preview or click to view full screen"
                                    >
                                      <Image className="h-3 w-3" />
                                    </Button>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-[600px] p-2" side="right" align="start">
                                    <div className="space-y-2">
                                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {session.client_name}
                                      </div>
                                      <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                        <img 
                                          src={screenshotUrl}
                                          alt="Verification Screenshot Preview"
                                          className="w-full max-h-[500px] object-contain"
                                          onError={(e) => {
                                            // ✅ Mark this screenshot as failed - button will turn grey
                                            setFailedScreenshots(prev => new Set(prev).add(session.id));
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                            const errorDiv = (e.currentTarget.parentElement as HTMLElement).querySelector('.error-message') as HTMLElement;
                                            if (errorDiv) {
                                              errorDiv.style.display = 'block';
                                            }
                                          }}
                                        />
                                        <div className="error-message hidden text-center text-slate-500 p-4">
                                          <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                          <p className="text-xs">Unable to load image</p>
                                        </div>
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            })()}

                            {/* Recording Button - Open Player Modal */}
                            {(() => {
                              // Check both recording_url and taalk_call_url for playback
                              // recording_url must be a valid HTTP URL (not "PENDING" or other invalid values)
                              const hasValidRecordingUrl = session.recording_url && 
                                session.recording_url.startsWith('http') && 
                                session.recording_url !== 'PENDING';
                              const hasTaalkCallUrl = session.taalk_call_url && 
                                session.taalk_call_url.startsWith('recordings/');
                              // Also enable if there's a taalkCallId (call was made, recording might be processing)
                              // Check multiple possible field names
                              const hasTaalkCallId = (session as any).taalk_call_id || (session as any).taalkCallId || (session as any).taalkCallId;
                              // Enable if call was completed (has duration) or status is completed
                              const hasCallDuration = session.call_duration && session.call_duration > 0;
                              const isCompleted = session.status === 'completed';
                              const hasValidRecording = hasValidRecordingUrl || hasTaalkCallUrl || hasTaalkCallId || hasCallDuration || isCompleted;
                              
                              return (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  disabled={!hasValidRecording}
                                  className={`h-6 w-6 p-0 ${hasValidRecording ? 'text-white bg-purple-600 hover:bg-purple-700 border-purple-600 hover:border-purple-700 shadow-md' : 'text-gray-400 cursor-not-allowed border-gray-300'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!hasValidRecording) return;
                                    // Create a deep copy with recording_url set (use taalk_call_url as fallback)
                                    const sessionCopy = JSON.parse(JSON.stringify(session));
                                    // If recording_url is invalid/PENDING but we have taalk_call_url, 
                                    // the player will need to generate a signed URL from the storage path
                                    if (!hasValidRecordingUrl && hasTaalkCallUrl) {
                                      // Set taalk_call_url so the player can generate a signed URL
                                      sessionCopy.taalk_call_url = session.taalk_call_url;
                                    }
                                    setRecordingSession(sessionCopy);
                                  }}
                                  data-testid={`button-recording-${session.id}`}
                                  title={hasValidRecording ? "Play Recording" : "Recording not available"}
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              );
                            })()}

                            {/* Transcript Button */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700"
                                  onClick={() => {
                                    // Create a deep copy to prevent stale data when page refreshes
                                    setTranscriptSession(JSON.parse(JSON.stringify(session)));
                                  }}
                                  data-testid={`button-transcript-${session.id}`}
                                  title="View Transcript"
                                >
                                  <FileText className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                            </Dialog>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 w-32" data-testid={`text-mga-team-${session.id}`}>
                          <div className="text-xs truncate">
                            {toProperCase(session.agent_mga_team || '-')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls - Only show when NO filters are active */}
                {(() => {
                  const hasActiveFilters = searchTerm || statusFilter !== 'all' || methodFilter !== 'all' || 
                                           producerFilter !== 'all' || rgaFilter !== 'all' || mgaFilter !== 'all' || dateRange !== 'all';
                  // Only show pagination when no filters are active
                  if (hasActiveFilters) {
                    return (
                      <div className="flex items-center justify-between mt-4 px-2">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Showing all {sessions.length} filtered sessions
                        </div>
                      </div>
                    );
                  }
                  
                  // Show pagination controls when no filters
                  return sessions.length > 0 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Showing {sessions.length > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} sessions
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          Page {pagination.page} of {pagination.totalPages || 1}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                          disabled={currentPage >= pagination.totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Certificate Modal */}
      {certificateSession && (
        <Dialog open={!!certificateSession} onOpenChange={(open) => !open && setCertificateSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Verification Certificate - {certificateSession?.client_name || 'Unknown Client'}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="text-center space-y-4">
                <Award className="h-16 w-16 text-blue-600 mx-auto" />
                <h3 className="text-xl font-semibold">Verification Certificate</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Certificate for {certificateSession?.client_name || 'Unknown Client'}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  Session ID: {certificateSession?.session_id || certificateSession?.id}
                </p>
                <Button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `/api/aoi-precheck/download/certificate/${certificateSession?.id}`;
                    link.download = `certificate-${certificateSession?.client_name || 'unknown'}-${certificateSession?.id}.html`;
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

      {/* Picture Viewer Modal */}
      <Dialog open={!!pictureSession} onOpenChange={() => setPictureSession(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Verification Screenshot - {pictureSession?.client_name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {pictureSession?.screenshot_url ? (
              <div className="space-y-4">
                <img 
                  src={pictureSession.screenshot_url}
                  alt="Verification Screenshot"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                    if (nextElement) {
                      nextElement.style.display = 'block';
                    }
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

      {/* Transcript Viewer Modal */}
      <Dialog open={!!transcriptSession} onOpenChange={() => setTranscriptSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Call Transcript & AI Summary - {transcriptSession?.client_name}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-6">
            {/* Transcript Section */}
            {transcriptSession?.call_transcript ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Call Transcript</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      if (!transcriptSession?.session_id) {
                        toast({
                          title: "Error",
                          description: "Session ID not found",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      try {
                        toast({
                          title: "Refreshing...",
                          description: "Fetching transcript and summary from Taalk"
                        });
                        
                        const response = await fetch(`/api/aoi-precheck/sessions/${transcriptSession.session_id}/refresh-transcript`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.success) {
                          toast({
                            title: "Success",
                            description: `Transcript and summary refreshed. ${data.hasTranscript ? 'Transcript' : ''} ${data.hasSummary ? 'Summary' : ''} updated.`
                          });
                          // Refetch sessions to get updated data
                          queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
                          // Update the current transcript session if we have the updated data
                          // The modal will refresh when sessions are refetched
                        } else {
                          throw new Error(data.error || 'Failed to refresh');
                        }
                      } catch (error: any) {
                        toast({
                          title: "Refresh Failed",
                          description: error.message || "Failed to refresh transcript and summary",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh from Taalk
                  </Button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg max-h-[40vh] overflow-y-auto">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {transcriptSession.call_transcript}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([transcriptSession.call_transcript || ''], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `transcript-${transcriptSession.id}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Transcript
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-4 space-y-4">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No transcript available for this session</p>
                {transcriptSession?.session_id && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      if (!transcriptSession?.session_id) {
                        toast({
                          title: "Error",
                          description: "Session ID not found",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      try {
                        toast({
                          title: "Refreshing...",
                          description: "Fetching transcript and summary from Taalk"
                        });
                        
                        const response = await fetch(`/api/aoi-precheck/sessions/${transcriptSession.session_id}/refresh-transcript`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.success) {
                          toast({
                            title: "Success",
                            description: `Transcript and summary refreshed. ${data.hasTranscript ? 'Transcript' : ''} ${data.hasSummary ? 'Summary' : ''} updated.`
                          });
                          // Refetch sessions to get updated data
                          queryClient.invalidateQueries({ queryKey: ['/api/aoi-precheck/sessions'] });
                        } else {
                          throw new Error(data.error || 'Failed to refresh');
                        }
                      } catch (error: any) {
                        toast({
                          title: "Refresh Failed",
                          description: error.message || "Failed to refresh transcript and summary",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Fetch from Taalk
                  </Button>
                )}
              </div>
            )}

            {/* AI Summary Section */}
            {(transcriptSession?.ai_quick_recap || transcriptSession?.ai_result || transcriptSession?.ai_key_topics) && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">AI Summary</h3>
                
                {transcriptSession.ai_quick_recap && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Quick Recap</h4>
                    <TranslatedText text={transcriptSession.ai_quick_recap} className="text-sm" />
                  </div>
                )}

                {transcriptSession.ai_key_topics && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Key Topics</h4>
                    <TranslatedText text={transcriptSession.ai_key_topics} className="text-sm" />
                  </div>
                )}

                {transcriptSession.ai_result && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Result</h4>
                    <p className="text-sm">{transcriptSession.ai_result}</p>
                    {transcriptSession.ai_result_passed !== null && transcriptSession.ai_result_passed !== undefined && (
                      <p className="text-sm mt-2 font-semibold">
                        Status: {transcriptSession.ai_result_passed === true ? '✓ Passed' : transcriptSession.ai_result_passed === false ? '✗ Failed' : 'Pending'}
                      </p>
                    )}
                  </div>
                )}

                {transcriptSession.ai_next_steps && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Next Steps</h4>
                    <p className="text-sm">{transcriptSession.ai_next_steps}</p>
                  </div>
                )}

                {transcriptSession.ai_sentiment_score !== null && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Sentiment Score</h4>
                    <p className="text-sm">{transcriptSession.ai_sentiment_score}/10</p>
                  </div>
                )}

                {transcriptSession.ai_red_flags && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Red Flags</h4>
                    <p className="text-sm">{transcriptSession.ai_red_flags}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compact Recording Player Modal */}
      <CompactRecordingPlayer 
        session={recordingSession}
        onClose={() => setRecordingSession(null)}
      />

      </div>
    </div>
  );
}
