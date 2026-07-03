import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { 
  Phone, 
  User, 
  Clock, 
  Search, 
  RefreshCw, 
  TrendingUp, 
  Activity,
  CheckCircle,
  PhoneCall,
  Timer,
  Target,
  PhoneOutgoing,
  Presentation,
  Play,
  Zap,
  PhoneForwarded,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface producer {
  id: string;
  associateId?: string;
  name: string;
  email: string;
  mgaName?: string | null;
  rgaName?: string | null;
  mgaAssociateId?: number | null;
  rgaAssociateId?: number | null;
  mgaTeam?: string;
  status: 'online' | 'calling' | 'presenting' | 'live' | 'dialing' | 'active' | 'offline';
  availableForInbound?: boolean; // New: Can they take inbound calls?
  hasCallConnectorHeartbeat?: boolean; // Active in Call Connector Pro
  eligibleForHotleads?: boolean; // Hot Lead enabled (Hot Lead + VDP online)
  hasRecruitHeartbeat?: boolean; // Active in AO Recruit
  creditsRemaining?: number;
  currentCall?: {
    phoneNumber: string;
    duration: number;
    clientName?: string;
    direction: 'inbound' | 'outbound';
    callStatus?: string; // 'dialing' | 'ringing' | 'answered' | 'completed' | 'failed'
  };
  currentPresentation?: {
    type: 'presentation';
    presentationType: 'hppro' | 'other';
    duration: number;
    clientName?: string;
    clientPhone?: string;
    presentationUrl?: string;
  };
  currentLive?: {
    type: 'live';
    lastActivity: string;
    duration: number;
  };
  todayStats?: {
    dialed: number;
    reached: number;
    booked: number;
    presentations: number;
    sales: number;
    alp: number;
  };
  usageStats?: {
    vdpTotalMinutes: number;
    vdpAvailableMinutes: number;
    vdpCallMinutes: number;
    onlineMinutes: number;
  };
  availableTime?: number;
  waitingTime?: number;
  callTime?: number;
  connects?: number;
  credits?: number;
  pendingLeads?: number;
  missedCalls?: number;
  lastActivity?: string;
}

interface RecruitStats {
  agentEmail: string;
  agentName: string;
  totalCandidates: number;
  candidatesToday: number;
  newCandidates: number;
  contactedCandidates: number;
  interviewCandidates: number;
  pendingCandidates: number;
  hiredCandidates: number;
  rejectedCandidates: number;
  upcomingAppointments: number;
  appointmentsToday: number;
  hasRecruitHeartbeat: boolean;
  vdpStatus: 'online' | 'calling' | 'offline';
  mgaName?: string | null;
  rgaName?: string | null;
  mgaAssociateId?: number | null;
  rgaAssociateId?: number | null;
  todayStats: {
    dialed: number;
    reached: number;
    booked: number;
    connects: number;
  };
}

interface ActiveRecruiter {
  agentEmail: string;
  agentName: string;
  hasRecruitHeartbeat: boolean;
  vdpStatus: 'online' | 'calling' | 'offline';
  currentCall?: {
    phoneNumber: string;
    duration: number;
    candidateName?: string;
    callStatus?: string;
  };
  lastActivity?: Date;
}

export default function LiveCallBoardNew() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [allScreenshots, setAllScreenshots] = useState<string[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [mgaFilter, setMgaFilter] = useState<string>('');
  const [rgaFilter, setRgaFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'sales' | 'recruiting'>('sales');
  const [salesTimePeriod, setSalesTimePeriod] = useState<'day' | 'week' | 'month' | 'realtime'>('realtime');
  const [recruitingTimePeriod, setRecruitingTimePeriod] = useState<'day' | 'week' | 'month' | 'realtime'>('realtime');
  // Date ranges for sales and recruiting (always shown, pre-populated based on time period)
  const [salesCustomStartDate, setSalesCustomStartDate] = useState<string>('');
  const [salesCustomEndDate, setSalesCustomEndDate] = useState<string>('');
  const [recruitingCustomStartDate, setRecruitingCustomStartDate] = useState<string>('');
  const [recruitingCustomEndDate, setRecruitingCustomEndDate] = useState<string>('');

  // Helper function to calculate date range based on time period
  const calculateDateRange = (period: 'day' | 'week' | 'month' | 'realtime'): { start: string; end: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let start: Date;
    let end: Date = new Date(today);
    end.setHours(23, 59, 59, 999);
    
    switch (period) {
      case 'realtime':
      case 'day':
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - 6); // 7 days including today
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(today);
        start.setDate(start.getDate() - 29); // 30 days including today
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
    }
    
    // Format as YYYY-MM-DD for date inputs
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    return {
      start: formatDate(start),
      end: formatDate(end)
    };
  };

  // Update date ranges when time period changes
  useEffect(() => {
    const salesRange = calculateDateRange(salesTimePeriod);
    setSalesCustomStartDate(salesRange.start);
    setSalesCustomEndDate(salesRange.end);
  }, [salesTimePeriod]);

  useEffect(() => {
    const recruitingRange = calculateDateRange(recruitingTimePeriod);
    setRecruitingCustomStartDate(recruitingRange.start);
    setRecruitingCustomEndDate(recruitingRange.end);
  }, [recruitingTimePeriod]);
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const userEmail = authState.profile?.email || '';

  // Check if user is sysop/admin (cnsysop, richiealtig, etc.)
  const isSysOp = userEmail === 'cnsysop@aoglobelife.com' || userEmail === 'robhay@aoglobelife.com' || userEmail === 'richiealtig@aoglobelife.com';

  // Fetch user's team role and MGAs they manage
  const { data: userTeamInfo } = useQuery<{
    role: 'MGA' | 'RGA' | 'BOTH' | null;
    mgaAssociateId: number | null;
    managedMGAs: Array<{ associate_id: number; name: string }>;
  }>({
    queryKey: ['/api/live-call-board/user-team-info', userEmail],
    queryFn: async () => {
      if (!userEmail) return { role: null, mgaAssociateId: null, managedMGAs: [] };
      const response = await fetch(`/api/live-call-board/user-team-info?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch user team info');
      return response.json();
    },
    enabled: !!userEmail && !isSysOp, // Only fetch if not sysop
    staleTime: 60000, // Cache for 1 minute
  });

  // REMOVED: Auto-filtering - everyone can now select any MGA/RGA manually
  // No automatic filtering based on user's hierarchy

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [mgaFilter, rgaFilter, sortBy, sortOrder]);

  // Handle header click for sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle order if clicking same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Get 4-letter stock ticker for producer
  const getproducerTicker = (name: string): string => {
    // Special case for Leyna Tran (case insensitive)
    const upperName = name.trim().toUpperCase();
    if (upperName === 'LEYNA TRAN' || upperName.includes('LEYNA') && upperName.includes('TRAN')) {
      return 'LYNA';
    }
    
    // Remove suffixes
    const suffixes = ['jr', 'sr', 'iii', 'ii', 'iv', 'v', 'jr.', 'sr.'];
    let cleanName = name.trim();
    suffixes.forEach(suffix => {
      const regex = new RegExp(`\\s+${suffix}\\s*$`, 'i');
      cleanName = cleanName.replace(regex, '');
    });
    
    const parts = cleanName.split(' ').filter(p => p.length > 0);
    
    if (parts.length === 0) return 'UNKN';
    
    // Get first name (first 2 letters)
    const firstName = parts[0].toUpperCase();
    const firstPart = firstName.substring(0, 2).padEnd(2, 'X');
    
    // Get last name (first 2 letters)
    if (parts.length === 1) {
      // Only one name - use first 2 + last 2
      return (firstName.substring(0, 2) + firstName.substring(Math.max(0, firstName.length - 2))).padEnd(4, 'X').substring(0, 4);
    }
    
    const lastName = parts[parts.length - 1].toUpperCase();
    const lastPart = lastName.substring(0, 2).padEnd(2, 'X');
    
    return (firstPart + lastPart).substring(0, 4);
  };

  // Fetch teams for filtering
  const { data: teams } = useQuery<Array<{associate_id: number; name: string; role: string; email: string}>>({
    queryKey: ['/api/live-call-board/teams', userEmail],
    queryFn: async () => {
      const headers: HeadersInit = {};
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      const response = await fetch('/api/live-call-board/teams', { headers });
      if (!response.ok) {
        console.error('❌ Teams fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch teams: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('👥 Teams data received:', data);
      console.log('👥 Teams count:', data?.length);
      console.log('👥 Teams sample:', data?.slice(0, 3));
      return data;
    },
    enabled: !!userEmail, // Only fetch if user email is available
    staleTime: 60000, // Cache for 1 minute
  });

  const { data: producersData, isLoading } = useQuery<{
    agents: producer[];
    totals?: {
      dialed: number;
      reached: number;
      booked: number;
      connects: number;
      instantPresentation: number;
      missedCalls: number;
    };
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ['/api/live-call-board/agents', mgaFilter, rgaFilter, userEmail, sortBy, sortOrder, activeTab, salesTimePeriod, salesCustomStartDate, salesCustomEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mgaFilter) params.set('mgaFilter', mgaFilter);
      if (rgaFilter) params.set('rgaFilter', rgaFilter);
      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
      }
      if (userEmail) params.set('userEmail', userEmail);
      if (activeTab === 'sales') {
        params.set('timePeriod', salesTimePeriod);
        if (salesCustomStartDate && salesCustomEndDate) {
          params.set('startDate', salesCustomStartDate);
          params.set('endDate', salesCustomEndDate);
        }
      }
      const url = `/api/live-call-board/agents?${params.toString()}`;
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
      };
      const response = await fetch(url, { headers, cache: 'no-store' });
      if (!response.ok) {
        console.error('❌ Live Call Board agents fetch failed:', response.status, response.statusText);
        throw new Error('Failed to fetch producers');
      }
      const data = await response.json();
      console.log('📊 Live Call Board agents response:', {
        isArray: Array.isArray(data),
        hasAgents: !Array.isArray(data) && data.agents,
        agentsCount: Array.isArray(data) ? data.length : (data.agents?.length || 0),
        firstAgent: Array.isArray(data) ? data[0] : (data.agents?.[0] || null),
        sampleTodayStats: Array.isArray(data) 
          ? data[0]?.todayStats 
          : (data.agents?.[0]?.todayStats || null)
      });
      
      // Handle both old format (array) and new format (object with agents)
      if (Array.isArray(data)) {
        // Calculate totals from array for backward compatibility
        const totalDialed = data.reduce((sum, p) => sum + (p.todayStats?.dialed || 0), 0);
        const totalReached = data.reduce((sum, p) => sum + (p.todayStats?.reached || 0), 0);
        const totalBooked = data.reduce((sum, p) => sum + (p.todayStats?.booked || 0), 0);
        const totalConnects = data.reduce((sum, p) => sum + (p.connects || 0), 0);
        const totalInstantPresentation = data.reduce((sum, p) => sum + (p.todayStats?.instantPresentation || 0), 0);
        const totalMissedCalls = data.reduce((sum, p) => sum + (p.missedCalls || 0), 0);
        return { 
          agents: data, 
          totals: {
            dialed: totalDialed,
            reached: totalReached,
            booked: totalBooked,
            connects: totalConnects,
            instantPresentation: totalInstantPresentation,
            missedCalls: totalMissedCalls
          },
          pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } 
        };
      }
      // Ensure totals exist even if backend doesn't provide them
      if (data && !data.totals) {
        const agents = data.agents || [];
        data.totals = {
          dialed: agents.reduce((sum: number, p: any) => sum + (p.todayStats?.dialed || 0), 0),
          reached: agents.reduce((sum: number, p: any) => sum + (p.todayStats?.reached || 0), 0),
          booked: agents.reduce((sum: number, p: any) => sum + (p.todayStats?.booked || 0), 0),
          connects: agents.reduce((sum: number, p: any) => sum + (p.connects || 0), 0),
          instantPresentation: agents.reduce((sum: number, p: any) => sum + (p.todayStats?.instantPresentation || 0), 0),
          missedCalls: agents.reduce((sum: number, p: any) => sum + (p.missedCalls || 0), 0)
        };
      }
      return data;
    },
    refetchInterval: 2000, // Real-time updates every 2 seconds (connects, dialed, etc.)
    staleTime: 0, // Always consider data stale - force fresh fetches
    refetchIntervalInBackground: true, // Continue updating even when tab is in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    keepPreviousData: true, // Keep showing old data while fetching new data
    enabled: activeTab === 'sales', // Only fetch when Sales tab is active
  });

  const producers = producersData?.agents || [];
  const pagination = producersData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 };
  
  // DEBUG: Log what producers we have
  if (producers.length > 0) {
    console.log('📊 Live Call Board producers loaded:', {
      count: producers.length,
      firstProducer: {
        email: producers[0]?.email,
        name: producers[0]?.name,
        todayStats: producers[0]?.todayStats,
        dialed: producers[0]?.todayStats?.dialed,
        reached: producers[0]?.todayStats?.reached,
        booked: producers[0]?.todayStats?.booked
      }
    });
  } else if (!isLoading) {
    console.warn('⚠️ Live Call Board: No producers loaded!', {
      hasData: !!producersData,
      isLoading,
      agentsCount: producersData?.agents?.length || 0
    });
  }

  const { data: stats } = useQuery<{
    totalproducers: number;
    onlineproducers: number;
    callingproducers: number;
    presentingproducers: number;
    totalPresentations: number;
    totalSales: number;
    totalALP: number;
    totalDailyConnects: number;
    totalMissedCalls?: number;
    totalInstantPresentation?: number;
    avgCallTime: string;
    estimatedWaitTime: string;
    callableLeadCount?: number;
    plusLeadCount?: number;
    totalDials?: number;
    totalReached?: number;
    totalBooked?: number;
  }>({
    queryKey: ['/api/live-call-board/stats', userEmail, salesTimePeriod, salesCustomStartDate, salesCustomEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('timePeriod', salesTimePeriod);
      if (userEmail) params.set('userEmail', userEmail);
      if (salesCustomStartDate && salesCustomEndDate) {
        params.set('startDate', salesCustomStartDate);
        params.set('endDate', salesCustomEndDate);
      }
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
      };
      const response = await fetch(`/api/live-call-board/stats?${params.toString()}`, { headers, cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 15000, // 15s (stats are cached server-side 15s; keeps LCB snappy without hammering DB)
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    enabled: !!userEmail && activeTab === 'sales',
  });

  // Fetch outbound calls
  const { data: outboundCalls } = useQuery({
    queryKey: ['/api/live-call-board/outbound-calls'],
    queryFn: async () => {
      const response = await fetch('/api/live-call-board/outbound-calls', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        cache: 'no-store',
      });
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 2000, // Real-time updates every 2 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches
  });

  // Fetch sales/outbound stats
  const { data: outboundStats } = useQuery({
    queryKey: ['/api/live-call-board/outbound-stats', mgaFilter, rgaFilter, userEmail, salesTimePeriod, salesCustomStartDate, salesCustomEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mgaFilter) params.set('mgaFilter', mgaFilter);
      if (rgaFilter) params.set('rgaFilter', rgaFilter);
      params.set('timePeriod', salesTimePeriod);
      if (userEmail) params.set('userEmail', userEmail);
      if (salesCustomStartDate && salesCustomEndDate) {
        params.set('startDate', salesCustomStartDate);
        params.set('endDate', salesCustomEndDate);
      }
      const url = `/api/live-call-board/outbound-stats?${params.toString()}`;
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
      };
      const response = await fetch(url, { headers, cache: 'no-store' });
      if (!response.ok) return { totalDialed: 0, totalReached: 0, totalBooked: 0, totalInstantPresentation: 0 };
      const data = await response.json();
      console.log('📊 Sales stats received:', data);
      return data;
    },
    refetchInterval: 2000, // Real-time updates every 2 seconds (connects, dialed, etc. aggregates)
    staleTime: 0, // Always consider data stale - force fresh fetches
    refetchIntervalInBackground: true, // Continue updating even when tab is in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    enabled: activeTab === 'sales', // Only fetch when Sales tab is active
  });

  // Fetch recruiting stats
  const { data: recruitStatsData } = useQuery<{
    success: boolean;
    recruitStats: RecruitStats[];
    activeRecruiters: ActiveRecruiter[];
    totals?: {
      dialed: number;
      reached: number;
      booked: number;
      connects: number;
    };
  }>({
    queryKey: ['/api/live-call-board/recruit-stats', mgaFilter, rgaFilter, userEmail, recruitingTimePeriod, recruitingCustomStartDate, recruitingCustomEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mgaFilter) params.append('mgaFilter', mgaFilter);
      if (rgaFilter) params.append('rgaFilter', rgaFilter);
      params.append('timePeriod', recruitingTimePeriod);
      // Always send date range
      if (recruitingCustomStartDate && recruitingCustomEndDate) {
        params.append('startDate', recruitingCustomStartDate);
        params.append('endDate', recruitingCustomEndDate);
      }
      const url = `/api/live-call-board/recruit-stats${params.toString() ? `?${params.toString()}` : ''}`;
      const headers: HeadersInit = {};
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) return { success: false, recruitStats: [], activeRecruiters: [] };
      return response.json();
    },
    refetchInterval: 2000, // Real-time updates every 2 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches
    refetchIntervalInBackground: true, // Continue updating even when tab is in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    enabled: activeTab === 'recruiting', // Only fetch when Recruiting tab is active
  });

  const recruitStats = recruitStatsData?.recruitStats || [];
  const activeRecruiters = recruitStatsData?.activeRecruiters || [];

  // Fetch active presentations
  const { data: presentations } = useQuery({
    queryKey: ['/api/live-call-board/presentations'],
    queryFn: async () => {
      const response = await fetch('/api/live-call-board/presentations');
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 2000, // Real-time updates every 2 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches
    refetchIntervalInBackground: true, // Continue updating even when tab is in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHoursMinutes = (minutes: number) => {
    if (!minutes || minutes === 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Check if agent has recent activity in last 10 minutes
  const hasRecentActivity = (producer: producer): boolean => {
    // Check if currently on call or presenting (definitely active)
    if (producer.currentCall || producer.currentPresentation) {
      return true;
    }

    // Check if status indicates active state
    const activeStatuses: producer['status'][] = ['online', 'calling', 'presenting', 'live', 'dialing', 'active'];
    if (producer.status && activeStatuses.includes(producer.status)) {
      return true;
    }

    // Check if VDP is online (availableForInbound)
    if (producer.availableForInbound) {
      return true;
    }

    // Check if Call Connector Pro is active
    if (producer.hasCallConnectorHeartbeat) {
      return true;
    }

    // Check lastActivity timestamp (within 10 minutes)
    if (producer.lastActivity) {
      try {
        const lastActivityDate = new Date(producer.lastActivity);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (lastActivityDate > tenMinutesAgo) {
          return true;
        }
      } catch (e) {
        // Invalid date, ignore
      }
    }

    return false;
  };

  // Format duration as "Xs" or "Xm"
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  // Format time as "X seconds ago" or "X minutes ago"
  const formatTimeAgo = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
    }
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  };

  const teamFilteredProducers = (producers || []).filter((producer) => {
    const matchesMga = !mgaFilter || (producer.mgaAssociateId !== undefined && producer.mgaAssociateId !== null && producer.mgaAssociateId.toString() === mgaFilter);
    const matchesRga = !rgaFilter || (producer.rgaAssociateId !== undefined && producer.rgaAssociateId !== null && producer.rgaAssociateId.toString() === rgaFilter);
    return matchesMga && matchesRga;
  });

  // All producers are "active" - presentations and calls shown inline
  const allActiveproducers = teamFilteredProducers;
  
  // Sort producers by activity priority: Presenting > Live Call > Dialing > Others
  const sortedproducers = [...allActiveproducers].sort((a, b) => {
    // Get activity scores (higher = more important)
    const getActivityScore = (producer: producer) => {
      if (producer.currentPresentation) return 3; // Presenting = highest priority
      const callStatus = producer.currentCall?.callStatus;
      const isLiveCall = callStatus === 'answered' || callStatus === 'in-progress';
      const isDialing = callStatus === 'dialing' || callStatus === 'ringing' || callStatus === 'initiated';
      if (isLiveCall) return 2; // Live call = second priority
      if (isDialing) return 1; // Dialing = third priority
      return 0; // No activity = bottom
    };
    
    return getActivityScore(b) - getActivityScore(a); // Sort descending (highest first)
  });
  
  // Apply search filter
  const filteredActive = sortedproducers.filter(producer =>
    producer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producer.associateId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producer.mgaName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producer.rgaName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producer.currentCall?.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (producer.currentPresentation?.clientName || '').toLowerCase().includes(searchTerm.toLowerCase())
  ); // Already paginated on backend

  const hasOnlineproducers = allActiveproducers.length > 0;

  // CRITICAL FIX: Use totals from backend (calculated from ALL agents, not just paginated subset)
  // This ensures totals are correct even when pagination is active
  // Fallback to calculating from visible agents if backend totals are not available
  const backendTotals = producersData?.totals;
  const totalConnects = backendTotals?.connects ?? teamFilteredProducers.reduce((s, p) => s + (p.connects ?? p.vdpCalls ?? 0), 0);
  const totalDialed = backendTotals?.dialed ?? teamFilteredProducers.reduce((s, p) => s + (p.todayStats?.dialed ?? 0), 0);
  const totalReached = backendTotals?.reached ?? teamFilteredProducers.reduce((s, p) => s + (p.todayStats?.reached ?? 0), 0);
  const totalBooked = backendTotals?.booked ?? teamFilteredProducers.reduce((s, p) => s + (p.todayStats?.booked ?? 0), 0);
  const totalInstantPresentation = backendTotals?.instantPresentation ?? teamFilteredProducers.reduce((s, p) => s + (p.todayStats?.instantPresentation ?? 0), 0);
  const totalMissedCalls = backendTotals?.missedCalls ?? teamFilteredProducers.reduce((s, p) => s + (p.missedCalls ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Live Call Board
              </h1>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/live-call-board/agents'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/live-call-board/stats'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/live-call-board/outbound-stats'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/live-call-board/recruit-stats'] });
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Real-time Producer Status and call activity monitoring
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sales' | 'recruiting')} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <PhoneOutgoing className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="recruiting" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Recruiting
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab Content */}
          <TabsContent value="sales" className="space-y-6 mt-6">
            {/* Time Period Selector for Sales */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">Time Period:</span>
                  <div className="flex gap-2">
                    <Button
                      variant={salesTimePeriod === 'realtime' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSalesTimePeriod('realtime')}
                      className="text-xs"
                    >
                      Realtime
                    </Button>
                    <Button
                      variant={salesTimePeriod === 'day' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSalesTimePeriod('day')}
                      className="text-xs"
                    >
                      Day
                    </Button>
                    <Button
                      variant={salesTimePeriod === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSalesTimePeriod('week')}
                      className="text-xs"
                    >
                      Week
                    </Button>
                    <Button
                      variant={salesTimePeriod === 'month' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSalesTimePeriod('month')}
                      className="text-xs"
                    >
                      Month
                    </Button>
                  </div>
                </div>
                {/* Date Range Picker for Sales - Always Visible */}
                <div className="mt-3 pt-3 border-t flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Start Date:</label>
                    <Input
                      type="date"
                      value={salesCustomStartDate}
                      onChange={(e) => setSalesCustomStartDate(e.target.value)}
                      className="w-40 h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">End Date:</label>
                    <Input
                      type="date"
                      value={salesCustomEndDate}
                      onChange={(e) => setSalesCustomEndDate(e.target.value)}
                      className="w-40 h-8 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
        {/* OUTBOUND ACTIVITY - Combined Stats */}
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <PhoneOutgoing className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">
                Sales Activity {
                  salesCustomStartDate && salesCustomEndDate ? 
                    `(${salesCustomStartDate} to ${salesCustomEndDate})` : 
                  '(Today)'
                }
              </h2>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Online */}
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats?.onlineproducers || 0}</div>
                <div className="text-xs text-gray-600">Online</div>
              </div>
              
              {/* On Calls */}
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats?.callingproducers || 0}</div>
                <div className="text-xs text-gray-600">On Calls</div>
              </div>
              
              {/* Presenting */}
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats?.presentingproducers || 0}</div>
                <div className="text-xs text-gray-600">Presenting</div>
              </div>
              
              {/* Connects */}
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-600">{totalConnects}</div>
                <div className="text-xs text-gray-600">📲 Connects</div>
              </div>
              
              {/* Missed Calls */}
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{totalMissedCalls}</div>
                <div className="text-xs text-gray-600">📞 Missed Calls</div>
              </div>
              
              {/* Dialed */}
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalDialed}</div>
                <div className="text-xs text-gray-600">📞 Dialed</div>
              </div>
              
              {/* Reached */}
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalReached}</div>
                <div className="text-xs text-gray-600">✅ Reached</div>
              </div>
              
              {/* Booked */}
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{totalBooked}</div>
                <div className="text-xs text-gray-600">📅 Booked</div>
              </div>
              
              {/* Instant Presentations */}
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{totalInstantPresentation}</div>
                <div className="text-xs text-gray-600">⚡ Instant Presentations</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar and Team Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search producers, clients, or phone numbers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Team Filters - Role-based visibility */}
              {/* EVERYONE can filter by ANY MGA and ANY RGA - no hierarchy restrictions */}
              <>
                {/* Debug: Show teams count */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500">
                    Teams: {teams?.length || 0} | MGA: {teams?.filter(t => t.role === 'MGA' || t.role === 'BOTH').length || 0} | RGA: {teams?.filter(t => t.role === 'RGA' || t.role === 'BOTH').length || 0}
                  </div>
                )}
                <Select value={mgaFilter || undefined} onValueChange={(val) => {
                  console.log('🔍 MGA filter changed to:', val);
                  setMgaFilter(val === 'all' ? '' : val);
                }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by MGA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All MGAs</SelectItem>
                    {teams && teams.length > 0 ? (
                      teams.filter(t => t.role === 'MGA' || t.role === 'BOTH').map(team => {
                        console.log('🔍 Rendering MGA option:', team);
                        return (
                          <SelectItem key={team.associate_id} value={team.associate_id.toString()}>
                            {team.name}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="loading" disabled>Loading teams...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                <Select value={rgaFilter || undefined} onValueChange={(val) => setRgaFilter(val === 'all' ? '' : val)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by RGA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All RGAs</SelectItem>
                    {teams && teams.length > 0 ? (
                      teams.filter(t => t.role === 'RGA' || t.role === 'BOTH').map(team => (
                        <SelectItem key={team.associate_id} value={team.associate_id.toString()}>
                          {team.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="loading" disabled>Loading teams...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </>
              
              {/* MGAs - No dropdown visible (auto-filtered to their team) */}
              {/* {!isSysOp && (userTeamInfo?.role === 'MGA' || userTeamInfo?.role === 'BOTH') && (
                <div className="text-sm text-slate-600 px-3 py-2 bg-slate-100 rounded">
                  Viewing: Your Team Only
                </div>
              )} */}
              
              {/* Clear Filters button (show if filters are active - everyone can filter now) */}
              {(mgaFilter || rgaFilter) && (
                <Button
                  onClick={() => { setMgaFilter(''); setRgaFilter(''); }}
                  variant="outline"
                  size="sm"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Outbound Calls */}
        {outboundCalls && outboundCalls.length > 0 && (
          <Card className="mb-6 border-2 border-green-400 shadow-lg">
            <div className="px-6 py-4 bg-green-50 border-b border-green-200">
              <div className="flex items-center gap-2">
                <PhoneOutgoing className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold">ACTIVE OUTBOUND CALLS ({outboundCalls.length})</h2>
              </div>
            </div>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {outboundCalls.map((call: any) => (
                  <Card key={call.callSid} className={`border-2 ${
                    call.status === 'answered' 
                      ? 'border-green-400 bg-green-50/50 shadow-lg shadow-green-400/50 animate-pulse' 
                      : 'border-orange-400 bg-orange-50/50 shadow-lg shadow-orange-400/50 animate-pulse'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={call.status === 'answered' ? 'bg-green-600' : 'bg-orange-500'}>
                          {call.status === 'answered' ? '🟢 LIVE' : '📞 DIALING'}
                        </Badge>
                        <div className="text-xs text-gray-600">{formatTime(Math.floor((new Date().getTime() - new Date(call.startedAt).getTime()) / 1000))}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold">{call.agentName}</div>
                        <div className="text-sm text-gray-600">→ {call.leadName}</div>
                        <div className="text-xs font-mono">{call.leadPhone}</div>
                        {call.leadState && (
                          <div className="text-xs space-y-0.5">
                            <div>📍 {call.leadState}</div>
                            {call.leadCurrentLocalTime && (
                              <div className="font-semibold text-green-700">
                                🕐 Lead's Time: {call.leadCurrentLocalTime} {call.leadTimezone}
                              </div>
                            )}
                            {call.callStartedPST && (
                              <div className="text-gray-500">
                                Started: {call.callStartedPST} PST
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Presenting producers - removed, now shown inline in Active Producers */}
        {false && (
          <Card className="mb-6 border-2 border-purple-400 shadow-lg">
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-200">
              <div className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Presenting producers ({filteredPresenting.length})
                </h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <Zap className="h-4 w-4 inline" title="AOI/VDP Status" />
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <PhoneForwarded className="h-4 w-4 inline" title="Call Connector Pro Status" />
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">producer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Presentation Type</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-blue-50">📞 Dialed</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-green-50">✅ Reached</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-purple-50">📅 Booked</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-blue-50">⚡ Instant Pres</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-indigo-50">🎬 Presentations</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-green-50">💰 Sales</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-yellow-50">🏆 ALP</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Credits</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-cyan-50">📲 Connects</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredPresenting.map((producer) => {
                    // Determine call status for presenting producers
                    const callStatus = producer.currentCall?.callStatus;
                    const isOnCall = !!producer.currentCall;
                    const isLiveCall = callStatus === 'answered' || callStatus === 'in-progress';
                    const isDialing = callStatus === 'dialing' || callStatus === 'ringing' || callStatus === 'initiated';
                    
                    return (
                      <tr key={producer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {/* VDP Status Icon */}
                        <td className="px-2 py-1 whitespace-nowrap text-center">
                          <Zap 
                            className={`h-2.5 w-2.5 inline ${producer.availableForInbound ? 'text-green-500' : 'text-gray-300'}`}
                            title={producer.availableForInbound ? 'Active on VDP' : 'Not on VDP'}
                          />
                        </td>
                        {/* Call Connector Pro Status Icon · Flame = Hot Lead enabled */}
                        <td className="px-2 py-1 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <PhoneForwarded 
                              className={`h-2.5 w-2.5 inline ${producer.hasCallConnectorHeartbeat ? 'text-green-500' : 'text-gray-300'}`}
                              title={producer.hasCallConnectorHeartbeat ? 'Active on Call Connector Pro' : 'Not on Call Connector Pro'}
                            />
                            {producer.eligibleForHotleads && (
                              <span className="text-amber-500" title="Hot Lead enabled">🔥</span>
                            )}
                          </div>
                        </td>
                        {/* Status Column - Shows call status with proper colors */}
                        <td className="px-2 py-1 whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {isLiveCall ? (
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live Call"></div>
                            ) : isDialing ? (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" title="Ringing"></div>
                            ) : (
                              <div className="w-2 h-2 bg-gray-300 rounded-full" title="No Active Call"></div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1 whitespace-nowrap">
                          <span className="text-xs font-medium text-purple-600">{producer.associateId}</span>
                        </td>
                      <td className="px-4 py-1 whitespace-nowrap">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{producer.email}</div>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {producer.currentPresentation?.clientName || 'Unknown Client'}
                        </div>
                        {producer.currentPresentation?.clientPhone && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {producer.currentPresentation.clientPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 text-xs py-0">
                          {producer.currentPresentation?.presentationType === 'hppro' ? 'HPPro' : 'Other'}
                        </Badge>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <Badge variant="outline" className="font-mono text-purple-600 border-purple-300 text-xs py-0">
                          {formatTime(producer.currentPresentation?.duration || 0)}
                        </Badge>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-blue-50">
                        <span className="text-sm font-bold text-blue-600">{producer.todayStats?.dialed || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-green-50">
                        <span className="text-sm font-bold text-green-600">{producer.todayStats?.reached || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-purple-50">
                        <span className="text-sm font-bold text-purple-600">{producer.todayStats?.booked || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-blue-50">
                        <span className="text-sm font-bold text-blue-600">{producer.todayStats?.instantPresentation || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <Badge variant={(producer.creditsRemaining || producer.credits || 0) <= 0 ? "destructive" : (producer.creditsRemaining || producer.credits || 0) < 10 ? "outline" : "secondary"} className="font-semibold text-xs py-0">
                          {producer.creditsRemaining || producer.credits || 0}
                        </Badge>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <Badge variant="secondary" className="font-semibold bg-cyan-100 text-cyan-800 text-xs py-0">
                          {producer.connects || producer.vdpCalls || 0}
                        </Badge>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Active Presentations */}
        {presentations && presentations.filter((p: any) => {
          // Filter: active presentations (duration > 0)
          if (p.durationSeconds <= 0) return false;
          // Filter: regular agents only see their own presentations (sysops/MGAs see all)
          if (!isSysOp && p.agentEmail && userEmail && p.agentEmail.toLowerCase() !== userEmail.toLowerCase()) {
            return false;
          }
          return true;
        }).length > 0 && (
          <Card className="mb-4 border-2 border-purple-400">
            <div className="px-4 py-2 bg-purple-50 border-b border-purple-200">
              <div className="flex items-center gap-2">
                <Presentation className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-semibold">ACTIVE PRESENTATIONS ({presentations.filter((p: any) => {
                  if (p.durationSeconds <= 0) return false;
                  if (!isSysOp && p.agentEmail && userEmail && p.agentEmail.toLowerCase() !== userEmail.toLowerCase()) return false;
                  return true;
                }).length})</h2>
              </div>
            </div>
            <CardContent className="pt-3 pb-2">
              <div className="space-y-2">
                {presentations
                  .filter((pres: any) => {
                    // Filter: active presentations (duration > 0)
                    if (pres.durationSeconds <= 0) return false;
                    // Filter: regular agents only see their own presentations (sysops/MGAs see all)
                    if (!isSysOp && pres.agentEmail && userEmail && pres.agentEmail.toLowerCase() !== userEmail.toLowerCase()) {
                      return false;
                    }
                    return true;
                  })
                  .map((pres: any) => (
                  <div key={pres.sessionId} className="flex items-center justify-between p-2 border border-purple-200 bg-white rounded hover:bg-purple-50 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge className="bg-purple-600 text-xs px-2 py-0 flex-shrink-0">🟣</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{pres.agentName}</div>
                        {pres.clientName && <div className="text-xs text-gray-600 truncate">{pres.clientName}</div>}
                      </div>
                      <div className="text-xs font-mono text-purple-700 flex-shrink-0">⏱️ {formatTime(pres.durationSeconds || 0)}</div>
                    </div>
                    {pres.latestScreenshot && (
                      <Button 
                        size="sm" 
                        className="ml-2 bg-purple-600 hover:bg-purple-700 h-7 flex-shrink-0" 
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🖼️ Opening screenshot slideshow:', pres.sessionId);
                          setSelectedScreenshot(pres.latestScreenshot);
                          setSelectedSessionId(pres.sessionId);
                          
                          // Fetch ALL screenshots for this presentation session
                          try {
                            const response = await fetch(`/api/presentations/${pres.sessionId}/screenshots`);
                            const data = await response.json();
                            if (data && data.screenshots) {
                              const screenshotUrls = data.screenshots.map((s: any) => s.screenshot_url || s.file_path);
                              setAllScreenshots(screenshotUrls);
                              const index = screenshotUrls.indexOf(pres.latestScreenshot);
                              setCurrentSlideIndex(index >= 0 ? index : 0);
                            } else {
                              setAllScreenshots([pres.latestScreenshot]);
                              setCurrentSlideIndex(0);
                            }
                          } catch (error) {
                            console.error('Failed to fetch screenshots:', error);
                            setAllScreenshots([pres.latestScreenshot]);
                            setCurrentSlideIndex(0);
                          }
                        }}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        <span className="text-xs">View</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* NO producerS ONLINE MESSAGE */}
        {!hasOnlineproducers && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <div className="text-lg text-slate-500 mb-2">No producers currently online</div>
              <div className="text-sm text-slate-400">producers will appear here when they come online</div>
            </CardContent>
          </Card>
        )}

        {/* Active Producers */}
        {hasOnlineproducers && (
          <Card className="overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Active Producers
                  </h2>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  {filteredActive.length}
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th 
                      className="px-2 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('ao_intel')}
                      title="AOI/VDP Status - Click to sort"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Zap className="h-2.5 w-2.5 inline" />
                        {sortBy === 'ao_intel' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'ao_intel' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-2 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('call_connector_pro')}
                      title="Call Connector Pro · 🔥 = Hot Lead enabled - Click to sort"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <PhoneForwarded className="h-2.5 w-2.5 inline" />
                        <span className="text-amber-500" title="Hot Lead">🔥</span>
                        {sortBy === 'call_connector_pro' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'call_connector_pro' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-2 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('ao_recruit')}
                      title="AO Recruit Status - Click to sort"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-2.5 w-2.5 inline" />
                        {sortBy === 'ao_recruit' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'ao_recruit' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('mga')}
                    >
                      <div className="flex items-center gap-1">
                        MGA
                        {sortBy === 'mga' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'mga' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('rga')}
                    >
                      <div className="flex items-center gap-1">
                        RGA
                        {sortBy === 'rga' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'rga' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('producer')}
                    >
                      <div className="flex items-center gap-1">
                        producer
                        {sortBy === 'producer' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'producer' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortBy === 'status' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'status' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-blue-50 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                      onClick={() => handleSort('dialed')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        📞 Dialed
                        {sortBy === 'dialed' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'dialed' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-green-50 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                      onClick={() => handleSort('reached')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        ✅ Reached
                        {sortBy === 'reached' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'reached' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-purple-50 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                      onClick={() => handleSort('booked')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        📅 Booked
                        {sortBy === 'booked' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'booked' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-blue-50 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                      onClick={() => handleSort('instant_presentation')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        ⚡ Instant Pres
                        {sortBy === 'instant_presentation' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'instant_presentation' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort('credits')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Credits
                        {sortBy === 'credits' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'credits' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-purple-50 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                      title="AOI Usage - VDP time and online time for current week"
                    >
                      <div className="flex items-center justify-center gap-1">
                        📊 AOI Usage
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-orange-50 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors"
                      title="Missed Calls - Total missed calls charged"
                    >
                      <div className="flex items-center justify-center gap-1">
                        📞 Missed Calls
                      </div>
                    </th>
                    <th 
                      className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-cyan-50 cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-colors"
                      onClick={() => handleSort('connects')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        📲 Connects
                        {sortBy === 'connects' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                        {sortBy !== 'connects' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredActive.map((producer) => {
                    // Determine call status badge and border color
                    const callStatus = producer.currentCall?.callStatus;
                    const isOnCall = !!producer.currentCall;
                    const isLiveCall = callStatus === 'answered' || callStatus === 'in-progress';
                    const isDialing = callStatus === 'dialing' || callStatus === 'ringing' || callStatus === 'initiated';
                    const isWrapUp = callStatus === 'completed' || callStatus === 'wrapup';
                    
                    let statusBadge = null;
                    let borderClass = '';
                    
                    if (isLiveCall) {
                      statusBadge = <Badge className="text-xs bg-green-500 text-white">🟢 On Call</Badge>;
                      borderClass = 'border-l-4 border-green-500';
                    } else if (isDialing) {
                      statusBadge = <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-300">📞 Ringing</Badge>;
                      borderClass = 'border-l-4 border-orange-500';
                    } else if (isWrapUp) {
                      statusBadge = <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-300">📝 Wrap Up</Badge>;
                      borderClass = 'border-l-4 border-red-500';
                    }
                    
                    return (
                      <tr key={producer.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${borderClass}`}>
                        {/* VDP Status Icon */}
                        <td className="px-2 py-1 whitespace-nowrap text-center">
                          <Zap 
                            className={`h-2.5 w-2.5 inline ${producer.availableForInbound ? 'text-green-500' : 'text-gray-300'}`}
                            title={producer.availableForInbound ? 'Active on VDP' : 'Not on VDP'}
                          />
                        </td>
                        {/* Call Connector Pro Status Icon · Flame = Hot Lead enabled */}
                        <td className="px-2 py-1 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <PhoneForwarded 
                              className={`h-2.5 w-2.5 inline ${producer.hasCallConnectorHeartbeat ? 'text-green-500' : 'text-gray-300'}`}
                              title={producer.hasCallConnectorHeartbeat ? 'Active on Call Connector Pro' : 'Not on Call Connector Pro'}
                            />
                            {producer.eligibleForHotleads && (
                              <span className="text-amber-500" title="Hot Lead enabled">🔥</span>
                            )}
                          </div>
                        </td>
                        {/* AO Recruit Status Icon */}
                        <td className="px-2 py-1 whitespace-nowrap text-center">
                          <Users 
                            className={`h-2.5 w-2.5 inline ${(producer.availableForInbound && producer.hasRecruitHeartbeat) ? 'text-green-500' : 'text-gray-300'}`}
                            title={(producer.availableForInbound && producer.hasRecruitHeartbeat) ? 'VDP Online on AO Recruit' : 'VDP Offline'}
                          />
                        </td>
                        {/* MGA Column */}
                        <td className="px-3 py-1 whitespace-nowrap">
                          <span className="text-xs font-medium text-blue-600">{producer.mgaName || '-'}</span>
                        </td>
                        {/* RGA Column */}
                        <td className="px-3 py-1 whitespace-nowrap">
                          <span className="text-xs font-medium text-indigo-600">{producer.rgaName || '-'}</span>
                        </td>
                        <td className="px-4 py-1 whitespace-nowrap">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {producer.email}
                          </div>
                        </td>
                        {/* Status Column - Shows activity with colored icons and duration */}
                        <td className="px-3 py-1 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isLiveCall && (
                              <div className="flex flex-col items-center">
                                <Phone className="h-3 w-3 text-green-500" title={`Live Call: ${producer.currentCall?.clientName || producer.currentCall?.phoneNumber}`} />
                                <span className="text-xs text-gray-600 mt-0.5">{formatTime(producer.currentCall?.duration || 0)}</span>
                              </div>
                            )}
                            {isDialing && (
                              <div className="flex flex-col items-center">
                                <Phone className="h-3 w-3 text-blue-500" title={`Calling: ${producer.currentCall?.clientName || producer.currentCall?.phoneNumber}`} />
                                <span className="text-xs text-gray-600 mt-0.5">Dialing</span>
                              </div>
                            )}
                            {isWrapUp && (
                              <div className="flex flex-col items-center">
                                <Phone className="h-3 w-3 text-red-500" title="Wrap Up - Completing call disposition" />
                                <span className="text-xs text-gray-600 mt-0.5">Wrap Up</span>
                              </div>
                            )}
                            {producer.currentPresentation && (
                              <div className="flex flex-col items-center">
                                <Presentation className="h-3 w-3 text-purple-500" title={`Presenting: ${producer.currentPresentation.clientName}`} />
                                <span className="text-xs text-gray-600 mt-0.5">{formatTime(producer.currentPresentation.duration)}</span>
                              </div>
                            )}
                            {producer.cameraActive && (
                              <Video className="h-3 w-3 text-blue-600" title="Camera Active" />
                            )}
                          </div>
                        </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-blue-50">
                        <span className="text-sm font-bold text-blue-600">{producer.todayStats?.dialed || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-green-50">
                        <span className="text-sm font-bold text-green-600">{producer.todayStats?.reached || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-purple-50">
                        <span className="text-sm font-bold text-purple-600">{producer.todayStats?.booked || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-blue-50">
                        <span className="text-sm font-bold text-blue-600">{producer.todayStats?.instantPresentation || 0}</span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <Badge variant={(producer.creditsRemaining || producer.credits || 0) <= 0 ? "destructive" : (producer.creditsRemaining || producer.credits || 0) < 10 ? "outline" : "secondary"} className="font-semibold text-xs py-0">
                          {producer.creditsRemaining || producer.credits || 0}
                        </Badge>
                      </td>
                      <td className={`px-3 py-1 whitespace-nowrap text-center ${
                        (producer.usageStats?.vdpTotalMinutes || 0) === 0 && (producer.usageStats?.onlineMinutes || 0) === 0
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : hasRecentActivity(producer) 
                            ? 'bg-green-50 dark:bg-green-900/20' 
                            : 'bg-purple-50 dark:bg-purple-900/20'
                      }`}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span 
                            className={`text-xs font-semibold ${
                              (producer.usageStats?.vdpTotalMinutes || 0) === 0 && (producer.usageStats?.onlineMinutes || 0) === 0
                                ? 'text-red-700 dark:text-red-400'
                                : hasRecentActivity(producer)
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-purple-700 dark:text-purple-400'
                            }`}
                            title={`VDP Total: ${formatHoursMinutes(producer.usageStats?.vdpTotalMinutes || 0)}${producer.usageStats && producer.usageStats.vdpTotalMinutes > 0 ? ` (Available: ${formatHoursMinutes(producer.usageStats.vdpAvailableMinutes || 0)}, On Calls: ${formatHoursMinutes(producer.usageStats.vdpCallMinutes || 0)})` : ''}${hasRecentActivity(producer) ? ' • Active in last 10 min' : ''}`}
                          >
                            {formatHoursMinutes(producer.usageStats?.vdpTotalMinutes || 0)}
                          </span>
                          {producer.usageStats && producer.usageStats.onlineMinutes > 0 && (
                            <span className={`text-xs ${
                              (producer.usageStats?.vdpTotalMinutes || 0) === 0 && (producer.usageStats?.onlineMinutes || 0) === 0
                                ? 'text-red-600 dark:text-red-500'
                                : hasRecentActivity(producer)
                                  ? 'text-green-600 dark:text-green-500'
                                  : 'text-purple-500 dark:text-purple-400'
                            }`} title={`Total online time this week`}>
                              {formatHoursMinutes(producer.usageStats.onlineMinutes)} online
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center bg-orange-50">
                        <Badge variant="secondary" className="font-semibold bg-orange-100 text-orange-800 text-xs py-0">
                          {producer.missedCalls || 0}
                        </Badge>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <Badge variant="secondary" className="font-semibold bg-cyan-100 text-cyan-800 text-xs py-0">
                          {producer.connects || producer.vdpCalls || 0}
                        </Badge>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
                      {filteredActive.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                          <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          No Active Producers
                        </div>
                      )}
            </div>
          </Card>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} agents with activity
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={currentPage >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 text-slate-400 animate-spin" />
              <div className="text-slate-500">Loading producer data...</div>
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Recruiting Tab Content */}
          <TabsContent value="recruiting" className="space-y-6 mt-6">
            {/* Time Period Selector for Recruiting */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">Time Period:</span>
                  <div className="flex gap-2">
                    <Button
                      variant={recruitingTimePeriod === 'realtime' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecruitingTimePeriod('realtime')}
                      className="text-xs"
                    >
                      Realtime
                    </Button>
                    <Button
                      variant={recruitingTimePeriod === 'day' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecruitingTimePeriod('day')}
                      className="text-xs"
                    >
                      Day
                    </Button>
                    <Button
                      variant={recruitingTimePeriod === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecruitingTimePeriod('week')}
                      className="text-xs"
                    >
                      Week
                    </Button>
                    <Button
                      variant={recruitingTimePeriod === 'month' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecruitingTimePeriod('month')}
                      className="text-xs"
                    >
                      Month
                    </Button>
                  </div>
                </div>
                {/* Date Range Picker for Recruiting - Always Visible */}
                <div className="mt-3 pt-3 border-t flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Start Date:</label>
                    <Input
                      type="date"
                      value={recruitingCustomStartDate}
                      onChange={(e) => setRecruitingCustomStartDate(e.target.value)}
                      className="w-40 h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">End Date:</label>
                    <Input
                      type="date"
                      value={recruitingCustomEndDate}
                      onChange={(e) => setRecruitingCustomEndDate(e.target.value)}
                      className="w-40 h-8 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Recruiting Stats Overview */}
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Recruiting Activity {
                      recruitingCustomStartDate && recruitingCustomEndDate ? 
                        `(${recruitingCustomStartDate} to ${recruitingCustomEndDate})` : 
                      '(Today)'
                    }
                  </h2>
                </div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {/* Dialed */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{recruitStatsData?.totals?.dialed || recruitStats.reduce((sum, s) => sum + (s.todayStats?.dialed || 0), 0)}</div>
                    <div className="text-xs text-gray-600">📞 Dialed</div>
                  </div>
                  
                  {/* Reached */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{recruitStatsData?.totals?.reached || recruitStats.reduce((sum, s) => sum + (s.todayStats?.reached || 0), 0)}</div>
                    <div className="text-xs text-gray-600">✅ Reached</div>
                  </div>
                  
                  {/* Booked */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{recruitStatsData?.totals?.booked || recruitStats.reduce((sum, s) => sum + (s.todayStats?.booked || 0), 0)}</div>
                    <div className="text-xs text-gray-600">📅 Booked</div>
                  </div>
                  
                  {/* Connects */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-600">{recruitStatsData?.totals?.connects || recruitStats.reduce((sum, s) => sum + (s.todayStats?.connects || 0), 0)}</div>
                    <div className="text-xs text-gray-600">📲 Connects</div>
                  </div>
                  
                  {/* Active Recruiters */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">{activeRecruiters.length}</div>
                    <div className="text-xs text-gray-600">Active Recruiters</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search and Filters (same as outbound) */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search recruiters..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {isSysOp && (
                    <>
                      <Select value={mgaFilter} onValueChange={(val) => setMgaFilter(val === 'all' ? '' : val)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filter by MGA" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All MGAs</SelectItem>
                          {teams?.filter(t => t.role === 'MGA' || t.role === 'BOTH').map(team => (
                            <SelectItem key={team.associate_id} value={team.associate_id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={rgaFilter} onValueChange={(val) => setRgaFilter(val === 'all' ? '' : val)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filter by RGA" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All RGAs</SelectItem>
                          {teams?.filter(t => t.role === 'RGA' || t.role === 'BOTH').map(team => (
                            <SelectItem key={team.associate_id} value={team.associate_id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recruiting Stats Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th 
                          className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            {sortBy === 'status' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'status' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => handleSort('producer')}
                        >
                          <div className="flex items-center gap-1">
                            Recruiter
                            {sortBy === 'producer' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'producer' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-blue-50 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                          onClick={() => handleSort('dialed')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            📞 Dialed
                            {sortBy === 'dialed' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'dialed' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-green-50 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                          onClick={() => handleSort('reached')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            ✅ Reached
                            {sortBy === 'reached' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'reached' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-purple-50 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                          onClick={() => handleSort('booked')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            📅 Booked
                            {sortBy === 'booked' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'booked' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-cyan-50 cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-colors"
                          onClick={() => handleSort('connects')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            📲 Connects
                            {sortBy === 'connects' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'connects' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => handleSort('mga')}
                        >
                          <div className="flex items-center gap-1">
                            MGA
                            {sortBy === 'mga' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'mga' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => handleSort('rga')}
                        >
                          <div className="flex items-center gap-1">
                            RGA
                            {sortBy === 'rga' && (sortOrder === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />)}
                            {sortBy !== 'rga' && <ArrowUpDown className="h-2 w-2 opacity-30" />}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                      {(() => {
                        // Create a map of active recruiters by email
                        const activeRecruitersMap = new Map(activeRecruiters.map(r => [r.agentEmail.toLowerCase(), r]));
                        
                        // Combine stats with active recruiter data
                        const combinedData = recruitStats.map(stat => {
                          const activeRecruiter = activeRecruitersMap.get(stat.agentEmail.toLowerCase());
                          return { stat, activeRecruiter };
                        });
                        
                        // Separate active and inactive
                        const activeData = combinedData.filter(d => d.activeRecruiter);
                        const inactiveData = combinedData.filter(d => !d.activeRecruiter);
                        
                        // Sort each group
                        const sortData = (data: typeof combinedData) => {
                          return data.sort((a, b) => {
                            if (sortBy === 'dialed') {
                              const aDialed = a.stat.todayStats?.dialed || 0;
                              const bDialed = b.stat.todayStats?.dialed || 0;
                              return sortOrder === 'asc' ? aDialed - bDialed : bDialed - aDialed;
                            }
                            if (sortBy === 'reached') {
                              const aReached = a.stat.todayStats?.reached || 0;
                              const bReached = b.stat.todayStats?.reached || 0;
                              return sortOrder === 'asc' ? aReached - bReached : bReached - aReached;
                            }
                            if (sortBy === 'booked') {
                              const aBooked = a.stat.todayStats?.booked || 0;
                              const bBooked = b.stat.todayStats?.booked || 0;
                              return sortOrder === 'asc' ? aBooked - bBooked : bBooked - aBooked;
                            }
                            if (sortBy === 'connects') {
                              const aConnects = a.stat.todayStats?.connects || 0;
                              const bConnects = b.stat.todayStats?.connects || 0;
                              return sortOrder === 'asc' ? aConnects - bConnects : bConnects - aConnects;
                            }
                            if (sortBy === 'mga') {
                              const aMga = (a.stat.mgaName || '').toLowerCase();
                              const bMga = (b.stat.mgaName || '').toLowerCase();
                              return sortOrder === 'asc' ? aMga.localeCompare(bMga) : bMga.localeCompare(aMga);
                            }
                            if (sortBy === 'rga') {
                              const aRga = (a.stat.rgaName || '').toLowerCase();
                              const bRga = (b.stat.rgaName || '').toLowerCase();
                              return sortOrder === 'asc' ? aRga.localeCompare(bRga) : bRga.localeCompare(aRga);
                            }
                            // Default: sort by name
                            return sortOrder === 'asc' 
                              ? a.stat.agentName.localeCompare(b.stat.agentName)
                              : b.stat.agentName.localeCompare(a.stat.agentName);
                          });
                        };
                        
                        // Combine: active first, then inactive
                        const sortedData = [...sortData(activeData), ...sortData(inactiveData)];
                        
                        return sortedData
                          .filter(({ stat }) => 
                            !searchTerm ||
                            stat.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            stat.agentEmail.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map(({ stat, activeRecruiter }) => {
                            const callStatus = activeRecruiter?.currentCall?.callStatus;
                            const isOnCall = !!activeRecruiter?.currentCall;
                            const isLiveCall = callStatus === 'answered' || callStatus === 'in-progress';
                            const isDialing = callStatus === 'dialing' || callStatus === 'ringing' || callStatus === 'initiated';
                            
                            return (
                              <tr key={stat.agentEmail} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <td className="px-3 py-1 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {activeRecruiter && isLiveCall && activeRecruiter.currentCall && (
                                      <div className="flex flex-col items-center">
                                        <Phone className="h-3 w-3 text-green-500" title={`Live Call: ${activeRecruiter.currentCall.candidateName || activeRecruiter.currentCall.phoneNumber}`} />
                                        <span className="text-xs text-gray-600 mt-0.5">{formatTime(activeRecruiter.currentCall.duration || 0)}</span>
                                      </div>
                                    )}
                                    {activeRecruiter && isDialing && activeRecruiter.currentCall && (
                                      <div className="flex flex-col items-center">
                                        <Phone className="h-3 w-3 text-blue-500" title={`Calling: ${activeRecruiter.currentCall.candidateName || activeRecruiter.currentCall.phoneNumber}`} />
                                        <span className="text-xs text-gray-600 mt-0.5">Dialing</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-1 whitespace-nowrap">
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {stat.agentEmail}
                                  </div>
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap text-center bg-blue-50">
                                  <span className="text-sm font-bold text-blue-600">{stat.todayStats?.dialed || 0}</span>
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap text-center bg-green-50">
                                  <span className="text-sm font-bold text-green-600">{stat.todayStats?.reached || 0}</span>
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap text-center bg-purple-50">
                                  <span className="text-sm font-bold text-purple-600">{stat.todayStats?.booked || 0}</span>
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap text-center bg-cyan-50">
                                  <span className="text-sm font-bold text-cyan-600">{stat.todayStats?.connects || 0}</span>
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap text-left">
                                  <span className="text-xs font-medium text-blue-600">{stat.mgaName || '-'}</span>
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap text-left">
                                  <span className="text-xs font-medium text-indigo-600">{stat.rgaName || '-'}</span>
                                </td>
                              </tr>
                            );
                          });
                      })()}
                      {recruitStats.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                            No recruiting data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Screenshot Viewer Modal with Slideshow */}
        {selectedScreenshot && allScreenshots.length > 0 && (
          <Dialog open={true} onOpenChange={(open) => {
            console.log('🔄 Dialog state changing:', open);
            if (!open) {
              setSelectedScreenshot(null);
              setSelectedSessionId(null);
              setAllScreenshots([]);
              setCurrentSlideIndex(0);
            }
          }}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Presentation className="w-5 h-5" />
                  HP-PRO Presentation Slideshow - Slide {currentSlideIndex + 1} of {allScreenshots.length}
                </DialogTitle>
              </DialogHeader>
              
              <div className="mt-4">
                {/* Slideshow Controls */}
                {allScreenshots.length > 1 && (
                  <div className="flex justify-between items-center mb-4">
                    <Button 
                      onClick={() => {
                        const newIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : allScreenshots.length - 1;
                        setCurrentSlideIndex(newIndex);
                        setSelectedScreenshot(allScreenshots[newIndex]);
                      }}
                      variant="outline"
                      size="sm"
                      disabled={allScreenshots.length === 1}
                    >
                      ← Previous
                    </Button>
                    
                    <div className="text-sm text-gray-600">
                      Slide {currentSlideIndex + 1} of {allScreenshots.length}
                    </div>
                    
                    <Button 
                      onClick={() => {
                        const newIndex = currentSlideIndex < allScreenshots.length - 1 ? currentSlideIndex + 1 : 0;
                        setCurrentSlideIndex(newIndex);
                        setSelectedScreenshot(allScreenshots[newIndex]);
                      }}
                      variant="outline"
                      size="sm"
                      disabled={allScreenshots.length === 1}
                    >
                      Next →
                    </Button>
                  </div>
                )}
                
                {/* Current Slide */}
                <div className="bg-gray-100 rounded-lg p-4 mb-4">
                  <img 
                    src={selectedScreenshot || allScreenshots[currentSlideIndex]} 
                    alt={`Slide ${currentSlideIndex + 1}`} 
                    className="max-w-full h-auto rounded border shadow-lg mx-auto"
                    style={{ maxHeight: '70vh' }}
                    onLoad={() => console.log('✅ Screenshot loaded successfully')}
                    onError={(e) => {
                      console.error('❌ Failed to load screenshot:', selectedScreenshot);
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const errorDiv = target.nextElementSibling as HTMLElement;
                      if (errorDiv) {
                        errorDiv.style.display = 'block';
                      }
                    }}
                  />
                  <div 
                    className="hidden text-center py-8 text-gray-500"
                    style={{ display: 'none' }}
                  >
                    <Presentation className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Screenshot not available</p>
                    <p className="text-sm">The current slide screenshot could not be loaded.</p>
                    <p className="text-xs mt-2 font-mono">{selectedScreenshot}</p>
                  </div>
                </div>
                
                {/* Thumbnail Navigation */}
                {allScreenshots.length > 1 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {allScreenshots.map((screenshot, index) => (
                      <img
                        key={index}
                        src={screenshot}
                        alt={`Thumbnail ${index + 1}`}
                        onClick={() => {
                          setCurrentSlideIndex(index);
                          setSelectedScreenshot(screenshot);
                        }}
                        className={`w-16 h-10 object-cover rounded border cursor-pointer transition-opacity ${
                          currentSlideIndex === index 
                            ? 'border-blue-500 border-2 opacity-100' 
                            : 'border-gray-300 opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <Button 
                    onClick={() => {
                      setSelectedScreenshot(null);
                      setSelectedSessionId(null);
                      setAllScreenshots([]);
                      setCurrentSlideIndex(0);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = selectedScreenshot || allScreenshots[currentSlideIndex];
                      link.download = `slide-${currentSlideIndex + 1}-${Date.now()}.png`;
                      link.click();
                    }}
                    variant="default"
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Download Current Slide
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
