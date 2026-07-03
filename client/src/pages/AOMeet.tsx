import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  Phone, 
  MapPin, 
  User, 
  Clock,
  Briefcase,
  TrendingUp,
  Video,
  Shield,
  Share,
  Plus,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  ExternalLink,
  Presentation,
  X,
  DollarSign,
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AOIMeetModal } from '@/components/modals/AOIMeetModal';
import { AppointmentResolutionModal } from '@/components/modals/AppointmentResolutionModal';
import { RecruitResolutionModal } from '@/components/modals/RecruitResolutionModal';
import { BookAppointmentModal } from '@/components/appointments/BookAppointmentModal';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getGravatarUrl, getInitialsFromEmail } from '@/lib/gravatar';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocation } from 'wouter';

interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  city: string;
  state: string;
  market: string;
  time: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  comments: number;
  attachments: number;
}

interface ScheduledEvent {
  id: string;
  title: string;
  time: string;
  color: 'green' | 'blue' | 'purple';
  participants: string[];
}

interface Note {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

// Demo Data
const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    clientName: 'Richard Fisher',
    clientPhone: '989-724-8468',
    city: 'Caro',
    state: 'MI',
    market: 'Veteran',
    time: '10:00 AM',
    status: 'in_progress',
    comments: 3,
    attachments: 2
  },
  {
    id: '2',
    clientName: 'Sandra Johnson',
    clientPhone: '555-123-4567',
    city: 'Detroit',
    state: 'MI',
    market: 'Senior',
    time: '01:30 PM',
    status: 'scheduled',
    comments: 1,
    attachments: 1
  },
  {
    id: '3',
    clientName: 'Michael Brown',
    clientPhone: '555-987-6543',
    city: 'Grand Rapids',
    state: 'MI',
    market: 'Family',
    time: '03:00 PM',
    status: 'completed',
    comments: 5,
    attachments: 3
  }
];

const SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    id: '1',
    title: 'Richard Fisher - Veterans Presentation',
    time: '10:00 AM to 11:30 AM',
    color: 'green',
    participants: ['RF', 'VP']
  },
  {
    id: '2',
    title: 'Sandra Johnson - Medicare Review',
    time: '01:30 PM to 02:30 PM',
    color: 'blue',
    participants: ['SJ', 'VP']
  },
  {
    id: '3',
    title: 'Michael Brown - Final Health Plan',
    time: '03:00 PM to 04:30 PM',
    color: 'purple',
    participants: ['MB', 'VP']
  }
];

const NOTES: Note[] = [
  {
    id: '1',
    title: 'Follow up with Richard Fisher',
    description: 'Client interested in additional coverage for spouse. Schedule follow-up call next week.',
    completed: false
  },
  {
    id: '2',
    title: 'Send proposal to Sandra Johnson',
    description: 'Email detailed Medicare Advantage plan comparison by end of day.',
    completed: false
  },
  {
    id: '3',
    title: 'Complete verification for Michael Brown',
    description: 'Finalize AO Precheck and submit application to carrier.',
    completed: true
  }
];

// Presentation outcomes (5 dispositions) - when they "started a presentation"
const APPOINTMENT_OUTCOMES = [
  { value: 'SALE', label: 'Sale', icon: DollarSign, color: 'text-green-600' },
  { value: 'NO_SALE', label: 'No Sale', icon: X, color: 'text-red-600' },
  { value: 'THINK', label: 'Think / Reschedule', icon: CalendarClock, color: 'text-yellow-600' },
  { value: 'NO_SHOW', label: 'No Show', icon: AlertCircle, color: 'text-orange-600' },
  { value: 'CANCELLED', label: 'Cancelled', icon: X, color: 'text-gray-600' }
];

// Non-presentation outcomes (2 dispositions) - when they did NOT start a presentation
const NON_PRESENTATION_OUTCOMES = [
  { value: 'ATTENDED', label: 'Attended', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'NO_SHOW', label: 'No Show', icon: AlertCircle, color: 'text-orange-600' }
];

export default function AOMeet() {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [isAOIMeetOpen, setIsAOIMeetOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState(NOTES);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<{
    meetId: string;
    clientName: string;
    disposition: 'SALE' | 'NO_SALE' | 'THINK' | 'NO_SHOW' | 'CANCELLED' | 'ATTENDED';
    meetingLink?: string | null;
  } | null>(null);

  // Recruit resolution (required disposition for recruit schedule items)
  const [isRecruitResolutionOpen, setIsRecruitResolutionOpen] = useState(false);
  const [selectedRecruitResolution, setSelectedRecruitResolution] = useState<{
    candidateId: string;
    candidateName?: string;
  } | null>(null);
  
  // Booked leads without appointments
  const [isBookAppointmentModalOpen, setIsBookAppointmentModalOpen] = useState(false);
  const [selectedBookedLead, setSelectedBookedLead] = useState<any>(null);
  const [currentBookedLeadIndex, setCurrentBookedLeadIndex] = useState(0);
  
  // Calendar state - MUST be declared before queries that use it
  // 🕒 TIMEZONE SUPPORT
  const [userTimezone, setUserTimezone] = useState<string>(() => {
    // Default to user's browser timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  
  // Get today's date in the user's timezone
  const getTodayInTimezone = () => {
    const now = new Date();
    // Convert to user's timezone string
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    return new Date(year, month, day);
  };
  
  const today = getTodayInTimezone();
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(currentDay);
  // Check URL for tab parameter
  const [location, setLocation] = useLocation();
  
  // Get tab from URL
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = urlParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<'appointments' | 'aoi-reports'>(() => {
    // Initialize from URL on mount
    return tabFromUrl === 'aoi-reports' ? 'aoi-reports' : 'appointments';
  });

  const [appointmentsViewMode, setAppointmentsViewMode] = useState<'cards' | 'table'>('cards');
  const remindedSlotIdsRef = React.useRef<Set<string>>(new Set());
  
  // Update tab when URL changes (including initial mount)
  useEffect(() => {
    const currentUrlParams = new URLSearchParams(location.split('?')[1] || '');
    const currentTab = currentUrlParams.get('tab');
    console.log('🔍 Tab check - location:', location, 'currentTab:', currentTab);
    if (currentTab === 'aoi-reports') {
      console.log('✅ Setting tab to aoi-reports');
      setActiveTab('aoi-reports');
    } else {
      console.log('✅ Setting tab to appointments');
      setActiveTab('appointments');
    }
  }, [location]);
  
  // AOI Reports state
  const queryClient = useQueryClient();
  const [finalOutcomes, setFinalOutcomes] = useState<{[key: string]: string}>({});
  const [saleDetails, setSaleDetails] = useState<{[key: string]: { alp?: string }}>({});
  const [finalOutcomeNotes, setFinalOutcomeNotes] = useState<{[key: string]: string}>({});
  const [resolvedCallIds, setResolvedCallIds] = useState<Set<string>>(new Set());
  const [currentCallIndex, setCurrentCallIndex] = useState(0);

  // Fetch THIS WEEK's stats (Appointments, Presentations, Sales, ALP)
  const { data: weeklyStats } = useQuery({
    queryKey: ['weekly-stats', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return { appointments: 0, presentations: 0, sales: 0, alp: 0 };
      
      const response = await fetch(`/api/aoi-meet/weekly-stats?agentEmail=${authState.user.email}`);
      if (!response.ok) return { appointments: 0, presentations: 0, sales: 0, alp: 0 };
      
      const data = await response.json();
      
      return {
        appointments: data.appointments || 0,
        presentations: data.presentations || 0,
        sales: data.sales || 0,
        alp: data.alp || 0
      };
    },
    enabled: !!authState.user?.email,
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch ALL agent's meets
  const { data: allMeetsData, refetch: refetchMeets } = useQuery({
    queryKey: ['all-meets', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return [];
      
      const response = await fetch(`/api/meets/agent/${authState.user.email}`);
      const data = await response.json();
      return data.meets || [];
    },
    enabled: !!authState.user?.email,
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  
  // Filter meets based on selected calendar day (timezone-aware)
  const meetsData = (allMeetsData || []).filter((meet: any) => {
    if (!meet.scheduled_date && !meet.created_at) return false;
    
    const meetDate = new Date(meet.scheduled_date || meet.created_at);
    
    // Calculate selected date in user's timezone
    const selectedDate = new Date(today);
    const daysDiff = selectedCalendarDay - currentDay;
    selectedDate.setDate(selectedDate.getDate() + daysDiff);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Convert selected date to user's timezone for comparison
    // Get the date string in user's timezone
    const selectedDateStr = selectedDate.toLocaleDateString('en-CA', { timeZone: userTimezone }); // YYYY-MM-DD format
    const meetDateStr = meetDate.toLocaleDateString('en-CA', { timeZone: userTimezone });
    
    // Compare dates (ignoring time)
    return selectedDateStr === meetDateStr;
  });

  // Selected calendar day as YYYY-MM-DD in user timezone (for master schedule range)
  const selectedDayDate = new Date(today);
  selectedDayDate.setDate(selectedDayDate.getDate() + (selectedCalendarDay - currentDay));
  const selectedDayDateStr = selectedDayDate.toLocaleDateString('en-CA', { timeZone: userTimezone });

  // Get start/end of selected day in user timezone as UTC ISO strings for API
  const getSelectedDayRangeISO = (): { fromISO: string; toISO: string } => {
    const [y, m, d] = selectedDayDateStr.split('-').map(Number);
    const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = formatter.formatToParts(utcNoon);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    // Midnight in user timezone = utcNoon minus (hour:minute) in that zone
    const offsetMs = (hour * 60 + minute) * 60 * 1000;
    const startOfDayUTC = utcNoon.getTime() - offsetMs;
    const endOfDayUTC = startOfDayUTC + 24 * 60 * 60 * 1000 - 1;
    return {
      fromISO: new Date(startOfDayUTC).toISOString(),
      toISO: new Date(endOfDayUTC).toISOString(),
    };
  };

  const selectedDayRange = getSelectedDayRangeISO();

  // Get start/end of a day (offset from today) in user timezone for API
  const getDayRangeFromOffset = (offsetDays: number): { fromISO: string; toISO: string } => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: userTimezone });
    const [y, m, day] = dateStr.split('-').map(Number);
    const utcNoon = new Date(Date.UTC(y, m - 1, day, 12, 0, 0, 0));
    const tf = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = tf.formatToParts(utcNoon);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const offsetMs = (hour * 60 + minute) * 60 * 1000;
    const startOfDayUTC = utcNoon.getTime() - offsetMs;
    const endOfDayUTC = startOfDayUTC + 24 * 60 * 60 * 1000 - 1;
    return { fromISO: new Date(startOfDayUTC).toISOString(), toISO: new Date(endOfDayUTC).toISOString() };
  };

  // Get day offset (0=today, 1=tomorrow) for a slot's date in user timezone
  const getDayOffsetForSlot = (slotStartISO: string): number => {
    const slotDateStr = new Date(slotStartISO).toLocaleDateString('en-CA', { timeZone: userTimezone });
    for (let off = 0; off <= 7; off++) {
      const r = getDayRangeFromOffset(off);
      const rangeDateStr = new Date(r.fromISO).toLocaleDateString('en-CA', { timeZone: userTimezone });
      if (rangeDateStr === slotDateStr) return off;
    }
    return 0;
  };

  // Day schedule popup (opened when clicking countdown banner)
  const [daySchedulePopupOpen, setDaySchedulePopupOpen] = useState(false);
  const [dayPopupDayOffset, setDayPopupDayOffset] = useState(0); // 0=today, 1=tomorrow, etc.

  // Sorted meets for selected day (by time)
  const meetsDataSorted = [...meetsData].sort((a: any, b: any) => {
    const ta = new Date(a.scheduled_date || a.created_at || 0).getTime();
    const tb = new Date(b.scheduled_date || b.created_at || 0).getTime();
    return ta - tb;
  });

  // Master schedule: next upcoming slot (countdown)
  const { data: upcomingSlot } = useQuery({
    queryKey: ['schedule-master-upcoming', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return null;
      const response = await fetch(`/api/schedule/master/upcoming?agentEmail=${encodeURIComponent(authState.user.email)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!authState.user?.email,
    refetchInterval: 60000,
  });

  // Master schedule: selected day (unified timeline)
  const { data: masterScheduleItems } = useQuery({
    queryKey: ['schedule-master', authState.user?.email, selectedDayRange.fromISO, selectedDayRange.toISO],
    queryFn: async () => {
      if (!authState.user?.email) return [];
      const { fromISO, toISO } = selectedDayRange;
      const response = await fetch(
        `/api/schedule/master?agentEmail=${encodeURIComponent(authState.user.email)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!authState.user?.email,
    refetchInterval: 60000,
  });

  const dayPopupRange = getDayRangeFromOffset(dayPopupDayOffset);

  // Schedule for day popup (when clicking countdown banner)
  const { data: dayPopupScheduleItems } = useQuery({
    queryKey: ['schedule-master-day-popup', authState.user?.email, dayPopupRange.fromISO, dayPopupRange.toISO],
    queryFn: async () => {
      if (!authState.user?.email) return [];
      const response = await fetch(
        `/api/schedule/master?agentEmail=${encodeURIComponent(authState.user.email)}&from=${encodeURIComponent(dayPopupRange.fromISO)}&to=${encodeURIComponent(dayPopupRange.toISO)}`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!authState.user?.email && daySchedulePopupOpen,
  });
  
  // Fetch future appointments (schedule)
  const { data: futureAppointments } = useQuery({
    queryKey: ['future-appointments', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return [];
      
      const response = await fetch(`/api/meets/agent/${authState.user.email}`);
      const data = await response.json();
      const allMeets = data.meets || [];
      
      // Filter to future only (tomorrow onwards)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      return allMeets.filter((meet: any) => {
        const meetDate = new Date(meet.scheduled_date || meet.created_at);
        return meetDate >= tomorrow;
      }).slice(0, 5); // Show next 5
    },
    enabled: !!authState.user?.email,
    refetchInterval: 60000
  });

  // Fetch pending AOI Reports calls
  // Fetch booked leads without appointments
  const { data: bookedLeads, refetch: refetchBookedLeads, isLoading: isLoadingBookedLeads } = useQuery({
    queryKey: ['booked-leads', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) {
        console.log('📋 Booked Leads: No user email, returning empty array');
        return [];
      }
      
      console.log('📋 Booked Leads: Fetching for', authState.user.email);
      const response = await fetch('/api/aoi-reports/booked-leads', {
        headers: {
          'x-user-email': authState.user.email
        }
      });
      if (!response.ok) {
        console.error('❌ Booked Leads: API error', response.status, response.statusText);
        return [];
      }
      const data = await response.json();
      console.log('📋 Booked Leads: Received', data?.length || 0, 'leads', data);
      if (data && data.length > 0) {
        console.log('📋 Booked Leads: Sample lead', data[0]);
      }
      return data || [];
    },
    enabled: !!authState.user?.email,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 0 // Always fetch fresh data
  });

  const { data: pendingAOICalls, isLoading: aoiLoading } = useQuery({
    queryKey: ['/api/aoi-reports/pending', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return [];
      
      console.log('📡 AOMeet: Fetching pending AOI reports for:', authState.user.email);
      const response = await fetch(`/api/aoi-reports/pending?userEmail=${encodeURIComponent(authState.user.email)}`, {
        headers: {
          'x-user-email': authState.user.email
        }
      });
      if (!response.ok) {
        console.error('❌ AOMeet: API error:', response.status, response.statusText);
        return [];
      }
      
      const data = await response.json();
      console.log('📊 AOMeet: API response:', Array.isArray(data) ? `Array with ${data.length} items` : typeof data);
      // API returns array directly, not wrapped in {calls: [...]}
      const calls = Array.isArray(data) ? data : (data.calls || []);
      console.log('📊 AOMeet: Returning', calls.length, 'calls');
      if (calls.length > 0) {
        console.log('📊 AOMeet: First call:', calls[0]);
      }
      return calls;
    },
    enabled: !!authState.user?.email && activeTab === 'aoi-reports',
    refetchInterval: 30000
  });


  // Reset call index when tab changes or calls change
  const unresolvedCalls = pendingAOICalls?.filter((call: any) => !resolvedCallIds.has(String(call.id))) || [];
  useEffect(() => {
    if (activeTab === 'aoi-reports' && unresolvedCalls.length > 0) {
      if (currentCallIndex >= unresolvedCalls.length) {
        setCurrentCallIndex(0);
      }
    }
  }, [activeTab, unresolvedCalls.length, currentCallIndex, pendingAOICalls, resolvedCallIds]);

  // Reset booked lead index when booked leads change
  useEffect(() => {
    if (bookedLeads && bookedLeads.length > 0) {
      if (currentBookedLeadIndex >= bookedLeads.length) {
        setCurrentBookedLeadIndex(0);
      }
    }
  }, [bookedLeads, currentBookedLeadIndex]);

  // Reminder: notify agent 15 minutes before any master_schedule event (runs on load and every 60s)
  useEffect(() => {
    if (!authState.user?.email) return;
    const check = () => {
      if (!upcomingSlot?.id) return;
      if (remindedSlotIdsRef.current.has(upcomingSlot.id)) return;
      const slotStart = new Date(upcomingSlot.slot_start).getTime();
      const now = Date.now();
      const minutesUntil = (slotStart - now) / (60 * 1000);
      if (minutesUntil >= 0 && minutesUntil <= 15) {
        remindedSlotIdsRef.current.add(upcomingSlot.id);
        toast({
          title: 'Upcoming in 15 minutes',
          description: `${upcomingSlot.title || 'Scheduled item'} at ${new Date(upcomingSlot.slot_start).toLocaleTimeString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true })}`,
          duration: 10000,
        });
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [upcomingSlot?.id, upcomingSlot?.slot_start, upcomingSlot?.title, authState.user?.email, userTimezone]);

  // Final outcome mutation (for presentation results)
  const finalOutcomeMutation = useMutation({
    mutationFn: async ({ callId, outcome, alp, notes, source }: {
      callId: string;
      outcome: string;
      alp?: string;
      notes?: string;
      source?: string;
    }) => {
      console.log('📝 AOMeet: Recording final outcome', { callId, outcome, alp, notes, source });
      
      // For "sale" outcomes, we need ALP
      if (outcome === 'sale' && !alp) {
        throw new Error('ALP amount is required for sales');
      }
      
      return apiRequest('PUT', `/api/aoi-reports/resolve/${callId}`, {
        cnresolution: outcome,
        resolution_notes: notes,
        saleAlp: outcome === 'sale' ? alp : undefined,
        source: source || 'masterlead'
      });
    },
    onSuccess: (data: any, variables) => {
      setResolvedCallIds(prev => new Set([...prev, variables.callId]));
      setFinalOutcomeNotes(prev => {
        const newNotes = { ...prev };
        delete newNotes[variables.callId];
        return newNotes;
      });
      setFinalOutcomes(prev => {
        const newOutcomes = { ...prev };
        delete newOutcomes[variables.callId];
        return newOutcomes;
      });
      setSaleDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[variables.callId];
        return newDetails;
      });
      
      toast({
        title: "✅ Outcome Recorded",
        description: "Presentation result has been saved successfully.",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-reports/pending'] });
      
      // Move to next call if available
      const remainingCalls = (pendingAOICalls || []).filter((c: any) => !resolvedCallIds.has(String(c.id)) && String(c.id) !== variables.callId);
      if (remainingCalls.length > 0 && currentCallIndex < remainingCalls.length) {
        // Stay on same index (next call moves up)
      } else if (remainingCalls.length > 0) {
        setCurrentCallIndex(Math.max(0, remainingCalls.length - 1));
      } else {
        setCurrentCallIndex(0);
      }
    },
    onError: (error: any) => {
      console.error('❌ Final outcome error:', error);
      toast({
        title: "❌ Error",
        description: error?.message || "Failed to save outcome. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Fetch callbacks from masterlead (leads with callback disposition)
  const { data: callbacks } = useQuery({
    queryKey: ['callbacks', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return [];
      
      // Routed to data service when VITE_DATA_SERVICE_URL / Railway segmented host is set (same as apiRequest).
      try {
        const response = await apiRequest(
          "GET",
          `/api/masterlead/callbacks?agentEmail=${encodeURIComponent(authState.user.email)}&limit=10`,
        );
        const data = await response.json();
        return (data.callbacks || []).slice(0, 5); // Show top 5
      } catch (e) {
        console.error("Failed to fetch callbacks", e);
        return [];
      }
    },
    enabled: !!authState.user?.email,
    refetchInterval: 60000
  });

  // Handle resolution completion
  const handleResolutionComplete = async (data: {
    disposition: string;
    saleAmount?: number;
    notes?: string;
  }) => {
    if (!selectedResolution) return;

    try {
      const response = await fetch(`/api/meets/${selectedResolution.meetId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition: data.disposition,
          sale_amount: data.saleAmount,
          notes: data.notes
        })
      });

      if (!response.ok) throw new Error('Failed to update appointment');

      // Refresh appointments and stats
      queryClient.invalidateQueries({ queryKey: ['all-meets'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-stats'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-master-day-popup'] });

      toast({
        title: 'Appointment Resolved ✅',
        description: data.disposition === 'SALE' 
          ? `Sale recorded: $${data.saleAmount} ALP`
          : `Marked as: ${data.disposition.replace(/_/g, ' ')}`
      });

      setIsResolutionModalOpen(false);
      setSelectedResolution(null);
    } catch (error) {
      console.error('Failed to resolve appointment:', error);
      toast({
        title: 'Error',
        description: 'Failed to save appointment outcome',
        variant: 'destructive'
      });
    }
  };

  const handleRecruitResolutionComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-master'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-master-upcoming'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-master-day-popup'] });
    toast({ title: 'Recruit outcome saved', description: 'Disposition recorded.' });
    setIsRecruitResolutionOpen(false);
    setSelectedRecruitResolution(null);
  };

  const handleSendMeetInvite = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsAOIMeetOpen(true);
  };

  const handleStartHPPRO = () => {
    const hpproUrl = 'https://hppro.planetaltig.com/#/';
    
    if (window.isElectron && window.electronAPI) {
      console.log('🖥️ Opening HPPRO in Electron - screen capture will be available');
      window.electronAPI.openExternal(hpproUrl);
      
      toast({
        title: "HP Pro Opened",
        description: "Sales presentation platform opened - screen capture active",
        duration: 3000
      });
      return;
    }
    
    window.open(hpproUrl, '_blank', 'width=1600,height=1000');
    toast({
      title: "HP Pro Opened",
      description: "Sales presentation platform opened",
      duration: 2000
    });
  };

  const toggleNoteComplete = (noteId: string) => {
    setNotes(notes.map(note => 
      note.id === noteId ? { ...note, completed: !note.completed } : note
    ));
  };

  // Normalize meet record to display values (handles missing client_* or alternate fields)
function getMeetDisplay(meet: any) {
  const clientName =
    `${meet.client_first_name || ''} ${meet.client_last_name || ''}`.trim() ||
    `${meet.first_name || ''} ${meet.last_name || ''}`.trim() ||
    meet.lead_name ||
    (meet.metadata as any)?.client_name ||
    (meet.title && String(meet.title).replace(/^Meet with\s+/i, '').trim()) ||
    'Unknown';
  const city = meet.client_city ?? meet.city ?? '';
  const state = meet.client_state ?? meet.state ?? '';
  const location =
    city && state ? `${city}, ${state}` : state ? state : city || 'N/A';
  return {
    clientName,
    clientPhone: meet.client_phone || meet.phone || '',
    city: meet.client_city ?? meet.city ?? 'N/A',
    state: meet.client_state ?? meet.state ?? '',
    location,
    market: meet.market_type || meet.taalk_market || meet.market || 'Unknown',
  };
}

const getStatusBadge = (status: string) => {
    const styles = {
      'in_progress': 'bg-green-100 text-green-700 border-green-200',
      'scheduled': 'bg-purple-100 text-purple-700 border-purple-200',
      'completed': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    
    const labels = {
      'in_progress': 'In Progress',
      'scheduled': 'Scheduled',
      'completed': 'Completed'
    };
    
    return (
      <Badge className={`${styles[status as keyof typeof styles]} border`}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-3xl font-bold text-gray-900">
                Good {today.getHours() < 12 ? 'Morning' : today.getHours() < 17 ? 'Afternoon' : 'Evening'}! {authState?.profile?.firstName || 'Agent'},
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Stats Cards - Gradient Style (THIS WEEK) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-sm text-blue-100 mb-1">Appointments (Week)</div>
                <div className="text-4xl font-bold">{weeklyStats?.appointments || 0}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-sm text-purple-100 mb-1">Presentations (Week)</div>
                <div className="text-4xl font-bold">{weeklyStats?.presentations || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-sm text-green-100 mb-1">Sales (Week)</div>
                <div className="text-4xl font-bold">{weeklyStats?.sales || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-sm text-orange-100 mb-1">ALP (Week)</div>
                <div className="text-4xl font-bold">${(weeklyStats?.alp || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Next up - from master_schedule; click opens schedule for that day */}
        {upcomingSlot && (
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-90"
                onClick={() => {
                  setDayPopupDayOffset(getDayOffsetForSlot(upcomingSlot.slot_start));
                  setDaySchedulePopupOpen(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDayPopupDayOffset(getDayOffsetForSlot(upcomingSlot.slot_start));
                    setDaySchedulePopupOpen(true);
                  }
                }}
              >
                <CalendarClock className="h-5 w-5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-indigo-900">Next up</p>
                  <p className="text-sm text-indigo-700 truncate">
                    {upcomingSlot.title || 'Scheduled item'} — {new Date(upcomingSlot.slot_start).toLocaleTimeString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="border-indigo-300 text-indigo-800 capitalize">
                  {upcomingSlot.schedule_type}
                </Badge>
                {(upcomingSlot.schedule_type === 'meet' || upcomingSlot.schedule_type === 'recruit') && (
                  upcomingSlot.schedule_type === 'meet' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Mark outcome
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {((upcomingSlot.metadata as any)?.presentationSessionId ? APPOINTMENT_OUTCOMES : NON_PRESENTATION_OUTCOMES).map((outcome) => (
                          <DropdownMenuItem
                            key={outcome.value}
                            onClick={() => {
                              setSelectedResolution({
                                meetId: upcomingSlot.source_id,
                                clientName: upcomingSlot.title || 'Client',
                                disposition: outcome.value as 'SALE' | 'NO_SALE' | 'THINK' | 'NO_SHOW' | 'CANCELLED',
                                meetingLink: (upcomingSlot.metadata as any)?.meetingLink ?? null,
                              });
                              setIsResolutionModalOpen(true);
                            }}
                          >
                            <outcome.icon className={cn('h-4 w-4 mr-2', outcome.color)} />
                            {outcome.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      onClick={() => {
                        setSelectedRecruitResolution({
                          candidateId: upcomingSlot.source_id,
                          candidateName: upcomingSlot.title,
                        });
                        setIsRecruitResolutionOpen(true);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark outcome
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's schedule - unified from master_schedule */}
        {masterScheduleItems && masterScheduleItems.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                {selectedCalendarDay === currentDay ? "Today's" : fullDayNames[selectedCalendarDay] + "'s"} schedule
              </h2>
              <ul className="space-y-2">
                {masterScheduleItems.map((item: any) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-900 font-medium truncate flex-1">{item.title || 'Item'}</span>
                    <span className="text-gray-500 shrink-0">
                      {new Date(item.slotStart).toLocaleTimeString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true })}
                      {' – '}
                      {new Date(item.slotEnd).toLocaleTimeString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                    <Badge variant="outline" className="capitalize text-xs shrink-0">
                      {item.scheduleType === 'support' ? 'Support' : item.scheduleType === 'meet' ? 'Meet' : item.scheduleType}
                    </Badge>
                    {(item.scheduleType === 'meet' || item.scheduleType === 'recruit') && (
                      item.scheduleType === 'meet' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" title="Mark outcome">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {((item.metadata as any)?.presentationSessionId ? APPOINTMENT_OUTCOMES : NON_PRESENTATION_OUTCOMES).map((outcome) => (
                              <DropdownMenuItem
                                key={outcome.value}
                                onClick={() => {
                                  setSelectedResolution({
                                    meetId: item.sourceId,
                                    clientName: item.title || 'Client',
                                    disposition: outcome.value as 'SALE' | 'NO_SALE' | 'THINK' | 'NO_SHOW' | 'CANCELLED',
                                    meetingLink: (item.metadata as any)?.meetingLink ?? null,
                                  });
                                  setIsResolutionModalOpen(true);
                                }}
                              >
                                <outcome.icon className={cn('h-4 w-4 mr-2', outcome.color)} />
                                {outcome.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          title="Mark outcome"
                          onClick={() => {
                            setSelectedRecruitResolution({
                              candidateId: item.sourceId,
                              candidateName: item.title,
                            });
                            setIsRecruitResolutionOpen(true);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Booked Leads Without Appointments - Priority Section - ALWAYS SHOW IF EXISTS */}
        {(() => {
          console.log('🔍 Rendering booked leads section:', {
            isLoading: isLoadingBookedLeads,
            bookedLeadsCount: bookedLeads?.length || 0,
            bookedLeads: bookedLeads
          });
          
          if (isLoadingBookedLeads) {
            return (
              <Card className="border-2 border-orange-300 bg-orange-50 mb-6">
                <CardContent className="p-6">
                  <div className="text-center text-orange-700">
                    Loading booked leads...
                  </div>
                </CardContent>
              </Card>
            );
          }
          
          if (bookedLeads && bookedLeads.length > 0) {
            return (
          <Card className="border-2 border-orange-300 bg-orange-50 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                  <div>
                    <h2 className="text-xl font-bold text-orange-900">
                      {bookedLeads.length} Booked Lead{bookedLeads.length !== 1 ? 's' : ''} Need{bookedLeads.length === 1 ? 's' : ''} Appointment
                    </h2>
                    <p className="text-sm text-orange-700">
                      Schedule appointments for these leads to continue
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Carousel-style booked lead card */}
              {(() => {
                const currentLead = bookedLeads[currentBookedLeadIndex];
                const hasNext = currentBookedLeadIndex < bookedLeads.length - 1;
                const hasPrevious = currentBookedLeadIndex > 0;
                
                return (
                  <div className="relative">
                    <Card className="bg-white border-orange-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {currentLead.first_name?.[0]}{currentLead.last_name?.[0]}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">
                                {currentLead.first_name} {currentLead.last_name}
                              </h3>
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 mt-1">
                                Booked
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            <span className="font-mono">{currentLead.phone}</span>
                          </div>
                          {currentLead.city && currentLead.state && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4" />
                              <span>{currentLead.city}, {currentLead.state}</span>
                            </div>
                          )}
                          {currentLead.taalk_market && (
                            <Badge variant="outline" className="text-sm">
                              {currentLead.taalk_market}
                            </Badge>
                          )}
                        </div>
                        
                        <Button 
                          size="lg" 
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => {
                            setSelectedBookedLead(currentLead);
                            setIsBookAppointmentModalOpen(true);
                          }}
                        >
                          <Calendar className="h-5 w-5 mr-2" />
                          Schedule Appointment
                        </Button>
                      </CardContent>
                    </Card>
                    
                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentBookedLeadIndex(prev => Math.max(0, prev - 1))}
                        disabled={!hasPrevious}
                        className="border-orange-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Progress dots */}
                      <div className="flex items-center gap-2 flex-1 justify-center">
                        {bookedLeads.slice(0, 20).map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentBookedLeadIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              index === currentBookedLeadIndex
                                ? 'bg-orange-600 w-6'
                                : 'bg-orange-300 hover:bg-orange-400'
                            }`}
                            aria-label={`Go to lead ${index + 1}`}
                          />
                        ))}
                        {bookedLeads.length > 20 && (
                          <span className="text-xs text-orange-600 ml-2">
                            +{bookedLeads.length - 20} more
                          </span>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentBookedLeadIndex(prev => Math.min(bookedLeads.length - 1, prev + 1))}
                        disabled={!hasNext}
                        className="border-orange-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="text-center mt-2 text-sm text-orange-700">
                      {currentBookedLeadIndex + 1} of {bookedLeads.length}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
            );
          }

          // If not loading and no booked leads, render nothing
          return null;
        })()}

        {/* Main Content - Tabs for Appointments and AOI Reports */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'appointments' | 'aoi-reports')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="aoi-reports">
              AOI Reports
              {pendingAOICalls && pendingAOICalls.length > 0 && (
                <Badge className="ml-2 bg-red-500">{pendingAOICalls.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-6">
            {/* Main Content - Appointments + Calendar in 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* LEFT: Today's Appointments */}
              <Card className="bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">
                      <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {selectedCalendarDay === currentDay ? "Today's" : fullDayNames[selectedCalendarDay] + "'s"}
                      </span>
                      <span className="text-gray-900"> Appointments</span>
                    </h2>
                <div className="flex items-center gap-3">
                  <Button
                    variant={appointmentsViewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAppointmentsViewMode('cards')}
                  >
                    Cards
                  </Button>
                  <Button
                    variant={appointmentsViewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAppointmentsViewMode('table')}
                  >
                    Table
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCalendarDay(currentDay)}
                  >
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" className="text-sm text-gray-600">
                    See All
                  </Button>
                </div>
              </div>

                {/* Appointments list - cards or compact table */}
                <div className="space-y-3">
                {meetsDataSorted && meetsDataSorted.length > 0 ? (
                  appointmentsViewMode === 'table' ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Time</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="hidden sm:table-cell">Market</TableHead>
                          <TableHead className="w-[100px]">Meeting link</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[140px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meetsDataSorted.map((meet: any) => {
                          const display = getMeetDisplay(meet);
                          const appointment = {
                            id: meet.id,
                            clientName: display.clientName,
                            clientPhone: display.clientPhone,
                            city: display.city,
                            state: display.state,
                            market: display.market,
                            time: meet.scheduled_time,
                            status: meet.status,
                            comments: meet.comments_count || 0,
                            attachments: 0
                          };
                          return (
                            <TableRow key={meet.id}>
                              <TableCell className="font-medium text-gray-700">
                                {new Date(meet.scheduled_date || meet.created_at).toLocaleTimeString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true })}
                              </TableCell>
                              <TableCell>{appointment.clientName}</TableCell>
                              <TableCell className="hidden sm:table-cell">{appointment.market}</TableCell>
                              <TableCell>
                                {meet.meeting_link ? (
                                  <Button size="sm" variant="link" className="h-auto p-0 text-blue-600" onClick={() => window.open(meet.meeting_link, '_blank')}>
                                    Join
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleSendMeetInvite(appointment)} title="Send invite"><Calendar className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleStartHPPRO} title="HP Pro"><Presentation className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedAppointment(appointment); setIsAOIMeetOpen(true); }} title="AOI Meet"><Video className="h-4 w-4" /></Button>
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Mark outcome"><CheckCircle2 className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                      {(meet.presentation_session_id ? APPOINTMENT_OUTCOMES : NON_PRESENTATION_OUTCOMES).map((outcome) => (
                                        <DropdownMenuItem
                                          key={outcome.value}
                                          onClick={() => {
                                            setSelectedResolution({ meetId: meet.id, clientName: appointment.clientName, disposition: outcome.value as any, meetingLink: meet.meeting_link });
                                            setIsResolutionModalOpen(true);
                                          }}
                                        >
                                          <outcome.icon className={cn('h-4 w-4 mr-2', outcome.color)} />
                                          {outcome.label}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                <div className="space-y-3">
                  {meetsDataSorted.map((meet: any) => {
                    const display = getMeetDisplay(meet);
                    const appointment = {
                      id: meet.id,
                      clientName: display.clientName,
                      clientPhone: display.clientPhone,
                      city: display.city,
                      state: display.state,
                      market: display.market,
                      time: meet.scheduled_time,
                      status: meet.status,
                      comments: meet.comments_count || 0,
                      attachments: 0
                    };
                    // Calculate progress based on status
                    const progressValue = 
                      appointment.status === 'completed' ? 100 :
                      appointment.status === 'in_progress' ? 65 : 25;
                    
                    return (
                      <Card key={appointment.id} className="bg-gray-50 border-gray-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          {/* Row 1: Main Info + Action Buttons */}
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <Avatar className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600">
                                <AvatarImage 
                                  src={meet.client_email ? `https://unavatar.io/${meet.client_email}?fallback=https://ui-avatars.com/api/?name=${encodeURIComponent(appointment.clientName)}&size=80&background=random` : `https://ui-avatars.com/api/?name=${encodeURIComponent(appointment.clientName)}&size=80&background=random`} 
                                  alt={appointment.clientName} 
                                />
                                <AvatarFallback className="text-white text-xs font-semibold">
                                  {appointment.clientName.split(' ').map((n: string) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900 truncate">{appointment.clientName}</p>
                                  {getStatusBadge(appointment.status)}
                                  <Badge variant="outline" className="text-xs ml-1">
                                    {appointment.market}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {appointment.clientPhone}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {display.location}
                                  </span>
                                  <span className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                                    <Clock className="w-3 h-3 text-purple-600" /> 
                                    {new Date(meet.scheduled_date || meet.created_at).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })}
                                  </span>
                                  {meet.meeting_link && (
                                    <span className="flex items-center gap-1">
                                      <Video className="w-3 h-3 text-blue-600" />
                                      <button
                                        type="button"
                                        onClick={() => window.open(meet.meeting_link, '_blank')}
                                        className="text-blue-600 hover:underline text-xs font-medium"
                                      >
                                        Join meeting
                                      </button>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons - Icon Only, Matching Navbar */}
                            <div className="flex items-center gap-2">
                              <Button 
                                onClick={() => handleSendMeetInvite(appointment)}
                                size="sm"
                                className="w-9 h-9 p-0 bg-gradient-to-r from-green-600 to-teal-600 text-white border-none hover:from-green-700 hover:to-teal-700"
                                title="Send AO Meet Invitation"
                              >
                                <Calendar className="w-4 h-4" />
                              </Button>
                              <Button 
                                onClick={handleStartHPPRO}
                                size="sm"
                                className="w-9 h-9 p-0 bg-gradient-to-r from-orange-600 to-red-600 text-white border-none hover:from-orange-700 hover:to-red-700"
                                title="Start HP Pro Presentation"
                              >
                                <Presentation className="w-4 h-4" />
                              </Button>
                              <Button 
                                onClick={() => {
                                  // Navigate to verification with appointment data pre-filled
                                  const clientData = encodeURIComponent(JSON.stringify({
                                    firstName: meet.client_first_name,
                                    lastName: meet.client_last_name,
                                    phone: meet.client_phone,
                                    email: meet.client_email,
                                    city: meet.client_city,
                                    state: meet.client_state,
                                    zipCode: meet.client_zip
                                  }));
                                  setLocation(`/dashboard/verification-start?client=${clientData}&skipTo=0`);
                                }}
                                size="sm"
                                className="w-9 h-9 p-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none hover:from-purple-700 hover:to-blue-700"
                                title="Start AO Precheck Verification"
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                              {/* Resolution Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    size="sm"
                                    className="w-9 h-9 p-0 bg-gradient-to-r from-indigo-600 to-pink-600 text-white border-none hover:from-indigo-700 hover:to-pink-700"
                                    title="Mark Outcome"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {(meet.presentation_session_id ? APPOINTMENT_OUTCOMES : NON_PRESENTATION_OUTCOMES).map((outcome) => (
                                    <DropdownMenuItem
                                      key={outcome.value}
                                      onClick={() => {
                                        setSelectedResolution({
                                          meetId: meet.id,
                                          clientName: `${meet.client_first_name} ${meet.client_last_name}`,
                                          disposition: outcome.value as any,
                                          meetingLink: meet.meeting_link
                                        });
                                        setIsResolutionModalOpen(true);
                                      }}
                                      className="flex items-center gap-2 py-2"
                                    >
                                      <outcome.icon className={`w-4 h-4 ${outcome.color}`} />
                                      <span>{outcome.label}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Row 2: Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Progress</span>
                              <span className="font-medium">{progressValue}%</span>
                            </div>
                            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full transition-all duration-300"
                                style={{ width: `${progressValue}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                  )
                ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No meets scheduled today</p>
                      <p className="text-sm mt-1">Schedule a meet from Call Connector Pro</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          {/* RIGHT: Schedule Calendar */}
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  <span className="text-gray-900">Schedule - </span>
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Today</span>
                </h2>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>

              {/* Timezone Selector */}
              <div className="mb-4 flex items-center gap-2">
                <Label htmlFor="timezone-select" className="text-sm font-medium">Timezone:</Label>
                <Select value={userTimezone} onValueChange={setUserTimezone}>
                  <SelectTrigger id="timezone-select" className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PST/PDT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MST/MDT)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CST/CDT)</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time (EST/EDT)</SelectItem>
                    <SelectItem value="America/Phoenix">Arizona (MST)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska (AKST/AKDT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii (HST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Week Calendar - Clickable */}
              <div className="flex items-center gap-2 mb-6">
                {weekDays.map((day, index) => {
                  // Fix: Calculate actual date properly using date math, not getDate()
                  const dayDateObj = new Date(today);
                  const daysDiff = index - currentDay;
                  dayDateObj.setDate(dayDateObj.getDate() + daysDiff);
                  const dayDate = dayDateObj.getDate();
                  
                  const isToday = index === currentDay;
                  const isSelected = index === selectedCalendarDay;
                  
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedCalendarDay(index)}
                      className={`flex-1 text-center py-3 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white ring-2 ring-blue-300' 
                          : isToday
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-2 border-blue-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <p className="text-xs font-medium">{day}</p>
                      <p className="text-sm font-bold mt-1">{dayDate}</p>
                    </button>
                  );
                })}
              </div>

              {/* Follow-ups Below Calendar */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  Follow-ups
                </h3>
                <div className="space-y-4">
                  {callbacks && callbacks.length > 0 ? (
                    callbacks.map((lead: any, index: number) => (
                      <div key={lead.id} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 flex-shrink-0">
                            <AvatarImage 
                              src={lead.email ? `https://unavatar.io/${lead.email}?fallback=https://ui-avatars.com/api/?name=${encodeURIComponent(`${lead.first_name} ${lead.last_name}`)}&size=80&background=random` : `https://ui-avatars.com/api/?name=${encodeURIComponent(`${lead.first_name} ${lead.last_name}`)}&size=80&background=random`} 
                              alt={`${lead.first_name} ${lead.last_name}`} 
                            />
                            <AvatarFallback className="text-white text-xs font-semibold">
                              {(lead.first_name?.[0] || '') + (lead.last_name?.[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">
                              {lead.first_name} {lead.last_name}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {lead.phone} • {lead.state}
                            </p>
                            <p className="text-xs text-orange-600 mt-1 font-medium">
                              {lead.cnresolution}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              window.location.href = '/dashboard/aoi';
                            }}
                          >
                            <Phone className="w-3 h-3 text-purple-600" />
                          </Button>
                        </div>
                        {index !== (callbacks.length - 1) && (
                          <div className="border-b" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No pending callbacks</p>
                      <p className="text-xs mt-1">All caught up!</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="aoi-reports" className="space-y-6">
            {/* AOI Reports Section - Carousel Style */}
            <div>
              {/* Pending Calls Needing Resolution - Carousel */}
              <Card>
                <CardContent className="p-0">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">Presentation Results</h2>
                        <p className="text-red-100 mt-1">
                          {aoiLoading ? 'Loading...' : 
                           pendingAOICalls && pendingAOICalls.filter((c: any) => !resolvedCallIds.has(String(c.id))).length > 0
                             ? `${pendingAOICalls.filter((c: any) => !resolvedCallIds.has(String(c.id))).length} presentations need results • ${currentCallIndex + 1} of ${pendingAOICalls.filter((c: any) => !resolvedCallIds.has(String(c.id))).length}`
                             : 'All caught up!'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {aoiLoading ? (
                    <div className="text-center py-12 text-gray-500">Loading...</div>
                  ) : (() => {
                    if (unresolvedCalls.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500">
                          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-300" />
                          <p className="text-lg font-medium">No pending presentations</p>
                          <p className="text-sm mt-1">All presentation results have been recorded</p>
                        </div>
                      );
                    }
                    
                    const currentCall = unresolvedCalls[currentCallIndex];
                    const hasNext = currentCallIndex < unresolvedCalls.length - 1;
                    const hasPrevious = currentCallIndex > 0;
                    
                    return (
                      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
                        {/* Single Call Card */}
                        <div className="p-6">
                          <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-red-950/30 dark:via-gray-800 dark:to-orange-950/30 p-6 space-y-4">
                            {/* Call Info */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {currentCall.customer_name || currentCall.lead_name || 'Unknown Customer'}
                                  </h3>
                                  <Badge variant="outline" className="text-xs">
                                    {currentCall.source || 'VDP'}
                                  </Badge>
                                  {currentCall.days_since_call >= 3 && (
                                    <Badge className="bg-red-500 text-white border-0">Overdue</Badge>
                                  )}
                                </div>
                                
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    <span>{currentCall.phone_number || currentCall.phone || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      {currentCall.days_since_call ? `${currentCall.days_since_call} days ago` : 'Recent'}
                                    </span>
                                  </div>
                                  {currentCall.market && (
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4" />
                                      <span>{currentCall.market}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Final Outcome Form (Presentation Results) */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                              <div>
                                <Label className="text-sm font-medium mb-2 block">Final Outcome *</Label>
                                <Select
                                  value={finalOutcomes[currentCall.id] || ''}
                                  onValueChange={(value) => {
                                    setFinalOutcomes(prev => ({ ...prev, [currentCall.id]: value }));
                                    // Clear ALP if not sale
                                    if (value !== 'sale') {
                                      setSaleDetails(prev => {
                                        const newDetails = { ...prev };
                                        if (newDetails[currentCall.id]) {
                                          delete newDetails[currentCall.id].alp;
                                        }
                                        return newDetails;
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="What happened after the presentation?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sale">✅ Sale</SelectItem>
                                    <SelectItem value="refused">❌ Refused</SelectItem>
                                    <SelectItem value="cannot_afford">💰 Cannot Afford</SelectItem>
                                    <SelectItem value="thinker">🤔 Thinker</SelectItem>
                                    <SelectItem value="medically_uninsurable">🏥 Medically Uninsurable</SelectItem>
                                    <SelectItem value="no_need">🚫 No Need</SelectItem>
                                    <SelectItem value="no_show">👻 No Show</SelectItem>
                                    <SelectItem value="reschedule">📅 Reschedule</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* ALP Amount (for sale outcomes) */}
                              {finalOutcomes[currentCall.id] === 'sale' && (
                                <div>
                                  <Label className="text-sm font-medium mb-2 block">
                                    Annual Life Premium (ALP) *
                                  </Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={saleDetails[currentCall.id]?.alp || ''}
                                      onChange={(e) => setSaleDetails(prev => ({
                                        ...prev,
                                        [currentCall.id]: { ...prev[currentCall.id], alp: e.target.value }
                                      }))}
                                      className="pl-7"
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Enter the Annual Life Premium amount (e.g., 150.00, 275.50)
                                  </p>
                                </div>
                              )}
                              
                              <div>
                                <Label className="text-sm font-medium mb-2 block">
                                  Notes {finalOutcomes[currentCall.id] !== 'sale' && '(Optional)'}
                                </Label>
                                <Textarea
                                  placeholder="What happened during/after the presentation?"
                                  value={finalOutcomeNotes[currentCall.id] || ''}
                                  onChange={(e) => setFinalOutcomeNotes(prev => ({ ...prev, [currentCall.id]: e.target.value }))}
                                  className="text-sm"
                                  rows={3}
                                />
                              </div>
                              
                              <Button
                                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
                                onClick={() => {
                                  if (!finalOutcomes[currentCall.id]) {
                                    toast({
                                      title: "Select Outcome",
                                      description: "Please select a final outcome first.",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  if (finalOutcomes[currentCall.id] === 'sale' && !saleDetails[currentCall.id]?.alp) {
                                    toast({
                                      title: "ALP Required",
                                      description: "Please enter the ALP amount for sales.",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  finalOutcomeMutation.mutate({
                                    callId: String(currentCall.id),
                                    outcome: finalOutcomes[currentCall.id],
                                    alp: finalOutcomes[currentCall.id] === 'sale' ? saleDetails[currentCall.id]?.alp : undefined,
                                    notes: finalOutcomeNotes[currentCall.id],
                                    source: currentCall.source || 'masterlead'
                                  });
                                }}
                                disabled={
                                  !finalOutcomes[currentCall.id] || 
                                  finalOutcomeMutation.isPending ||
                                  (finalOutcomes[currentCall.id] === 'sale' && !saleDetails[currentCall.id]?.alp)
                                }
                              >
                                {finalOutcomeMutation.isPending ? 'Saving...' : 'Save Outcome'}
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Navigation Footer */}
                        <div className="p-6 border-t bg-gray-50 dark:bg-gray-900/50">
                          <div className="flex items-center justify-between">
                            {/* Progress Dots */}
                            <div className="flex items-center gap-2 flex-1">
                              {unresolvedCalls.slice(0, 20).map((_, index) => (
                                <button
                                  key={index}
                                  onClick={() => setCurrentCallIndex(index)}
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    index === currentCallIndex
                                      ? 'bg-red-600 w-6'
                                      : 'bg-gray-300 hover:bg-gray-400'
                                  }`}
                                  aria-label={`Go to call ${index + 1}`}
                                />
                              ))}
                              {unresolvedCalls.length > 20 && (
                                <span className="text-xs text-gray-500 ml-2">
                                  +{unresolvedCalls.length - 20} more
                                </span>
                              )}
                            </div>
                            
                            {/* Navigation Buttons */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCurrentCallIndex(prev => Math.max(0, prev - 1))}
                                disabled={!hasPrevious}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <span className="text-sm text-gray-600 min-w-[80px] text-center">
                                {currentCallIndex + 1} / {unresolvedCalls.length}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCurrentCallIndex(prev => Math.min(unresolvedCalls.length - 1, prev + 1))}
                                disabled={!hasNext}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AOIMeetModal
        isOpen={isAOIMeetOpen}
        onClose={() => setIsAOIMeetOpen(false)}
        agentName={`${authState?.profile?.firstName || ''} ${authState?.profile?.lastName || ''}`.trim()}
        producerPhone={authState?.profile?.phone || ''}
        clientName={selectedAppointment?.clientName}
        clientPhone={selectedAppointment?.clientPhone}
      />

      {/* Book Appointment Modal */}
      {selectedBookedLead && authState.user && (
        <BookAppointmentModal
          isOpen={isBookAppointmentModalOpen}
          onClose={() => {
            setIsBookAppointmentModalOpen(false);
            setSelectedBookedLead(null);
            refetchBookedLeads();
            queryClient.invalidateQueries({ queryKey: ['/api/aoi-reports/check-blocking'] });
          }}
          leadData={{
            id: selectedBookedLead.taalk_lead_id || String(selectedBookedLead.id),
            taalk_lead_id: selectedBookedLead.taalk_lead_id || String(selectedBookedLead.id),
            leadId: selectedBookedLead.taalk_lead_id || String(selectedBookedLead.id),
            name: `${selectedBookedLead.first_name} ${selectedBookedLead.last_name}`.trim(),
            phone: selectedBookedLead.phone,
            email: undefined
          }}
          producerData={{
            id: authState.user.id || '',
            name: `${authState.profile?.firstName || ''} ${authState.profile?.lastName || ''}`.trim() || 'Agent',
            email: authState.user.email || ''
          }}
        />
      )}

      {/* Appointment Resolution Modal (Sales / Meet) */}
      {selectedResolution && (
        <AppointmentResolutionModal
          isOpen={isResolutionModalOpen}
          onClose={() => {
            setIsResolutionModalOpen(false);
            setSelectedResolution(null);
          }}
          meetId={selectedResolution.meetId}
          clientName={selectedResolution.clientName}
          disposition={selectedResolution.disposition}
          meetingLink={selectedResolution.meetingLink}
          onComplete={handleResolutionComplete}
        />
      )}

      {/* Recruit Resolution Modal (required disposition for recruit schedule) */}
      {selectedRecruitResolution && (
        <RecruitResolutionModal
          isOpen={isRecruitResolutionOpen}
          onClose={() => {
            setIsRecruitResolutionOpen(false);
            setSelectedRecruitResolution(null);
          }}
          candidateId={selectedRecruitResolution.candidateId}
          candidateName={selectedRecruitResolution.candidateName}
          onComplete={handleRecruitResolutionComplete}
        />
      )}

      {/* Day schedule popup (opened when clicking upcoming appt) - disposition available per item */}
      <Dialog
        open={daySchedulePopupOpen}
        onOpenChange={(open) => {
          setDaySchedulePopupOpen(open);
          if (!open) setDayPopupDayOffset(0);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Schedule at a glance</DialogTitle>
          </DialogHeader>

          {/* Day navigation - 5 upcoming days */}
          <div className="flex flex-wrap gap-1.5 shrink-0 mb-3">
            {[0, 1, 2, 3, 4].map((off) => {
              const range = getDayRangeFromOffset(off);
              const label = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : new Date(range.fromISO).toLocaleDateString('en-US', { timeZone: userTimezone, weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <Button
                  key={off}
                  size="sm"
                  variant={dayPopupDayOffset === off ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setDayPopupDayOffset(off)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
            {(dayPopupScheduleItems || []).length === 0 ? (
              <p className="text-sm text-gray-500 py-6">No items for this day.</p>
            ) : (
              <div className="space-y-1.5">
                {(dayPopupScheduleItems || []).map((item: any) => {
                  const start = new Date(item.slotStart);
                  const end = new Date(item.slotEnd);
                  const durMs = end.getTime() - start.getTime();
                  const durMins = Math.round(durMs / 60000);
                  const durLabel = durMins >= 60 ? `${Math.floor(durMins / 60)} hr` : `${durMins} min`;
                  const time30 = new Date(start);
                  time30.setMinutes(Math.floor(time30.getMinutes() / 30) * 30);
                  const timeStr = time30.toLocaleTimeString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true });
                  const meetingLink = (item.metadata as any)?.meetingLink;
                  const typeLabel = item.scheduleType === 'support' ? 'Support' : item.scheduleType === 'meet' ? 'Meet' : item.scheduleType === 'appointment' ? 'Appt' : item.scheduleType;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50"
                    >
                      <span className="w-14 shrink-0 text-xs font-medium text-gray-600 tabular-nums">{timeStr}</span>
                      <span className="flex-1 min-w-0 truncate font-medium text-gray-900" title={item.title}>{item.title || 'Item'}</span>
                      <Badge variant="outline" className="capitalize text-[10px] shrink-0">{typeLabel}</Badge>
                      <span className="text-[10px] text-gray-400 shrink-0">{durLabel}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.scheduleType === 'meet' && meetingLink && (
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => window.open(meetingLink, '_blank')}>
                            <Video className="h-3.5 w-3.5" /> Start Zoom
                          </Button>
                        )}
                        {(item.scheduleType === 'meet' || item.scheduleType === 'recruit') && (
                          item.scheduleType === 'meet' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Disposition
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                {((item.metadata as any)?.presentationSessionId ? APPOINTMENT_OUTCOMES : NON_PRESENTATION_OUTCOMES).map((outcome) => (
                                  <DropdownMenuItem
                                    key={outcome.value}
                                    onClick={() => {
                                      setSelectedResolution({
                                        meetId: item.sourceId,
                                        clientName: item.title || 'Client',
                                        disposition: outcome.value as 'SALE' | 'NO_SALE' | 'THINK' | 'NO_SHOW' | 'CANCELLED' | 'ATTENDED',
                                        meetingLink: meetingLink ?? null,
                                      });
                                      setIsResolutionModalOpen(true);
                                    }}
                                  >
                                    <outcome.icon className={cn('h-4 w-4 mr-2', outcome.color)} />
                                    {outcome.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedRecruitResolution({ candidateId: item.sourceId, candidateName: item.title });
                                setIsRecruitResolutionOpen(true);
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Disposition
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

