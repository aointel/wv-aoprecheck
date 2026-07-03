import { Device as TwilioDevice } from '@twilio/voice-sdk';
import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
// Lazy-loaded OUTSIDE of render so it's a stable reference, but after all imports
const ApplicationPage = lazy(() => import('@/pages/application').catch(() => ({ default: () => React.createElement('div', { style: { color: '#22d3ee', padding: 40 } }, 'Application loading...') })));
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiTarget, FiTrendingUp, FiClock, FiMonitor, FiStar } from 'react-icons/fi';
import { MdHistory } from 'react-icons/md';
import { CheckCircle, Phone, PhoneOff, Calendar, Clock, MapPin, User, Search, Filter, X, Mail, Eye, Power, Layers, Flame, Monitor, Video, Send, BookOpen } from 'lucide-react';
import { NewUserGuideModal } from '@/components/training/NewUserGuideModal';
import { MarketNeedModal } from '@/components/modals/MarketNeedModal';
import { useAuth } from '@/hooks/use-auth';
import { useCallConnectorActivity } from '@/hooks/use-call-connector-activity';
import { callTrackingClient } from '@/lib/call-tracking-client';
import { apiRequest, segmentedFetch } from '@/lib/queryClient';
import { masterleadUpdateResolution } from '@/lib/masterlead-api';
import { getServiceRequestCredentials, resolveServiceUrl } from '@/lib/service-routing';
import { useDemo } from '@/contexts/DemoContext';
import { DesktopAppModal } from '@/components/DesktopAppModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { VideoCallModal } from './VideoCallModal';
import { SubscriptionUpgradeModal } from '@/components/stripe/SubscriptionUpgradeModal';
import { updateMasterleadLastContacted } from '@/lib/masterlead-tracking';
import { DemoCertificationModal } from '@/components/connectnow/DemoCertificationModal';
import { updateAllLeadLastContacted } from '@/lib/hotlead-tracking';
import { PricingHoverCard } from '@/components/pricing/PricingHoverCard';
import { MicrophonePermissionRecoveryModal } from '@/components/MicrophonePermissionRecoveryModal';
import { useAgentDiagnostics } from '@/hooks/use-agent-diagnostics';
import StartupSequence from './StartupSequence';
// DISCLAIMER MODALS REMOVED - All users bypass disclaimers
// import { CallConnectorProDisclaimerModal } from '@/components/modals/CallConnectorProDisclaimerModal';
// import { StandardVsHotLeadExplainerModal, EXPLAINER_LOCALSTORAGE_KEY } from '@/components/modals/StandardVsHotLeadExplainerModal';
import { Loader2 } from 'lucide-react';
import VDPStatus from '@/components/connectnow/VDPStatus';
import { getRestoredPosition, savePositionWithTTL, POSITION_TTL_MS } from './position-ttl';
import { fetchTwilioVoiceToken } from '@/utils/webrtc-endpoints';
import { ProductionRankBadge } from './ProductionRankBadge';
import { CCProRankBadge } from './CCProRankBadge';
import { InboundTransfersExplainerModal } from '@/components/modals/InboundTransfersExplainerModal';
import { AppointmentBookingModal, type BookingLeadInfo, type BookingAgentInfo } from '@/components/scheduling/AppointmentBookingModal';
import { AppointmentOutcomeModal } from '@/components/scheduling/AppointmentOutcomeModal';
import { AgentCalendarPanel } from '@/components/scheduling/AgentCalendarPanel';
import { useDialerGate } from '@/hooks/use-dialer-gate';

// Declare global Taalk VDP functions
declare global {
  interface Window {
    TaalkVDP?: {
      open: (agentId: string, params: { states: string[], market?: any, first_name?: string, last_name?: string }) => void;
      close: () => void;
      disconnect: () => void;
    };
    TaalkVDPSettings?: {
      APIKey: string;
      container: string;
      onLoad?: () => void;
      onStatusChange?: (online: boolean) => void;
    };
    __webrtcDebugLog?: Array<Record<string, any>>;
    __webrtcDebugEnabled?: boolean;
    __dumpWebrtcDebug?: (count?: number) => Array<Record<string, any>>;
  }
}

const DEBUG_WEBRTC_AND_DIALER = false;
function debugLog(...args: unknown[]) {
  if (DEBUG_WEBRTC_AND_DIALER) console.log('[CCP-DEBUG]', ...args);
}

// Inbound panel debugging: set window.__INBOUND_DEBUG = true or localStorage.setItem('INBOUND_DEBUG', '1') then refresh
function inboundDebugEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && (!!(window as any).__INBOUND_DEBUG || !!localStorage.getItem('INBOUND_DEBUG'));
  } catch {
    return false;
  }
}
function inboundDebugLog(tag: string, data?: Record<string, unknown>) {
  try {
    if (!inboundDebugEnabled()) return;
    const msg = `[INBOUND-DEBUG] ${tag}`;
    if (data != null) {
      console.log(msg, data);
    } else {
      console.log(msg);
    }
  } catch (_) {}
}
function inboundDebugStack(tag: string): string {
  try {
    if (!inboundDebugEnabled()) return '';
    const stack = new Error().stack ?? '';
    console.log(`[INBOUND-DEBUG] ${tag}`, { stack });
    return stack;
  } catch {
    return '';
  }
}

interface VDPData {
  success: boolean;
  customer_id: string;
  associate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  states: string[];
  market: string | string[];
  vdpActive: string;
}

type AoiAppPrefillCheck = {
  ready: boolean;
  checking: boolean;
  reason: string;
  missing: string[];
  presentationGuid?: string;
};

function hasInjectValue(v: unknown): boolean {
  return !(v == null || String(v).trim() === '');
}

function validateAoiAppPendingPayload(
  pending: { inject?: Record<string, unknown>; presentation_guid?: string } | null | undefined,
): AoiAppPrefillCheck {
  if (!pending?.inject || typeof pending.inject !== 'object') {
    return {
      ready: false,
      checking: false,
      reason: 'No HPPRO prefill payload found yet.',
      missing: ['pending.inject'],
    };
  }

  const inject = pending.inject;
  const missing: string[] = [];
  const requireKey = (key: string) => {
    if (!hasInjectValue(inject[key])) missing.push(key);
  };

  ['firstName', 'lastName', 'state', 'dobMonth', 'dobDay', 'dobYear', 'selectedPlanName', 'totalPremium'].forEach(requireKey);

  const hasLife = String(inject.hasLife || '').toLowerCase() === 'true';
  const hasAccident = String(inject.hasAccident || '').toLowerCase() === 'true';
  const hasSpouseLife = String(inject.hasSpouseLife || '').toLowerCase() === 'true';

  if (hasLife) ['life1GroupId', 'life1Face', 'life1Units'].forEach(requireKey);
  if (hasAccident) ['accident1GroupId', 'accident1Face', 'accident1Units'].forEach(requireKey);
  if (hasSpouseLife) ['spouseLife1GroupId', 'spouseLife1Face', 'spouseLife1Units'].forEach(requireKey);

  if (missing.length > 0) {
    return {
      ready: false,
      checking: false,
      reason: 'HPPRO payload incomplete. Finish sync before opening AOI Application.',
      missing,
      presentationGuid: pending.presentation_guid,
    };
  }

  return {
    ready: true,
    checking: false,
    reason: '',
    missing: [],
    presentationGuid: pending.presentation_guid,
  };
}

// Enhanced Appointments Display Component
function AppointmentsDisplay() {
  const { authState } = useAuth();
  const userEmail = authState?.user?.email;

  // State for infinite scroll and filtering
  const [visibleCount, setVisibleCount] = useState(4);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['/api/appointments', userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      if (!userEmail) throw new Error('No user email');
      const response = await fetch(`/api/appointments?agentEmail=${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      return response.json();
    },
    refetchInterval: 300000, // 5 min
  });

  const allAppointments = appointments || [];

  // Filter and search appointments
  const filteredAppointments = useMemo(() => {
    let filtered = allAppointments;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((apt: any) => 
        apt.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.leadName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.status?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((apt: any) => apt.status === statusFilter);
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      filtered = filtered.filter((apt: any) => {
        const aptDate = new Date(apt.startTime || apt.appointmentDate);
        switch (dateFilter) {
          case 'today':
            return aptDate.toDateString() === today.toDateString();
          case 'tomorrow':
            return aptDate.toDateString() === tomorrow.toDateString();
          case 'dayAfterTomorrow':
            return aptDate.toDateString() === dayAfterTomorrow.toDateString();
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [allAppointments, searchTerm, statusFilter, dateFilter]);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => 
    Array.from(new Set(allAppointments.map((apt: any) => apt.status))).filter(Boolean) as string[],
    [allAppointments]
  );

  // Load more appointments (infinite scroll)
  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 4, filteredAppointments.length));
  };



  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setVisibleCount(4);
  };

  // Handle appointment actions
  const handleAppointmentAction = (appointment: any, action: string) => {
    debugLog(`🔄 ${action} requested for appointment:`, appointment);
    // TODO: Implement appointment actions (reschedule, cancel, etc.)
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Loading Appointments...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allAppointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-2">
            <p className="text-sm">No appointments found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleAppointments = filteredAppointments.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAppointments.length;



  const formatTime = (timeString: string) => {
    try {
      return new Date(timeString).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'Time TBD';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Date TBD';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rescheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search appointments by title, lead name, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-2 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="dayAfterTomorrow">Day After Tomorrow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters */}
          {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') && (
            <Button
              onClick={resetFilters}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              Reset All Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Appointments ({filteredAppointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleAppointments.map((apt: any) => (
            <div key={apt.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
              {/* Main Appointment Info - ONE ROW */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 flex-1">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {apt.title || 'Appointment'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {apt.leadName ? `Lead: ${apt.leadName}` : 'No lead assigned'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${getStatusColor(apt.status)}`}>
                    {apt.status || 'Scheduled'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedAppointment(expandedAppointment === apt.id ? null : apt.id)}
                    className="h-8 w-8 p-0"
                  >
                    {expandedAppointment === apt.id ? '−' : '+'}
                  </Button>
                </div>
              </div>

              {/* Expanded Appointment Details */}
              {expandedAppointment === apt.id && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Time:</span> {formatTime(apt.startTime || apt.appointmentDate)}
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span> {formatDate(apt.startTime || apt.appointmentDate)}
                    </div>
                    {apt.leadName && (
                      <div>
                        <span className="text-gray-500">Lead:</span> {apt.leadName}
                      </div>
                    )}
                    {apt.notes && (
                      <div>
                        <span className="text-gray-500">Notes:</span> {apt.notes}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleAppointmentAction(apt, 'reschedule')}
                      variant="outline"
                      size="sm"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Reschedule
                    </Button>
                    <Button
                      onClick={() => handleAppointmentAction(apt, 'cancel')}
                      variant="outline"
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <Button
              onClick={loadMore}
              variant="outline"
              size="sm"
              className="w-full mt-3"
            >
              Load More Appointments
            </Button>
          )}

          {/* No appointments found message */}
          {filteredAppointments.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
              <p className="text-gray-500">Try adjusting your filters or search terms.</p>
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Global device variable - exactly like TestCall pattern
let device: any = null;
let activeCall: any = null;
let currentPSTNCallSid: string | null = null;
let powerOnWebRtcInProgress = false;
let allowTwilioDeviceDestroy = false;

function withAllowedTwilioDeviceDestroy<T>(fn: () => T): T {
  allowTwilioDeviceDestroy = true;
  try {
    return fn();
  } finally {
    allowTwilioDeviceDestroy = false;
  }
}

function guardTwilioDeviceDestroy(dev: any) {
  if (!dev || typeof dev.destroy !== 'function') return;
  if ((dev as any).__destroyGuardInstalled) return;
  const originalDestroy = dev.destroy.bind(dev);
  (dev as any).__destroyGuardInstalled = true;
  dev.destroy = (...args: any[]) => {
    const state = dev?.state;
    if (!allowTwilioDeviceDestroy && (state === 'registering' || state === 'registered' || state === 'ready')) {
      console.warn('[WEBRTC GUARD] Blocked unexpected device.destroy()', {
        state,
        identity: dev?.identity,
      });
      return;
    }
    return originalDestroy(...args);
  };
}

// FTC/time-window filtering is enabled for CCP UI.
const FTC_FILTERING_ENABLED = true;

// FTC Compliance function for frontend filtering
const isCallPermissibleFrontend = (leadState: string, ftcRestricted?: string): boolean => {
  if (!FTC_FILTERING_ENABLED) return true;
  // Enforce call-window by timezone regardless of ftcrestricted override values.

  if (!leadState) return false;

  // FTC timezone mappings
  const stateTimezones: Record<string, string> = {
    // Eastern Time
    'FL': 'America/New_York', 'GA': 'America/New_York', 'SC': 'America/New_York',
    'NC': 'America/New_York', 'VA': 'America/New_York', 'MD': 'America/New_York',
    'DE': 'America/New_York', 'NJ': 'America/New_York', 'NY': 'America/New_York',
    'CT': 'America/New_York', 'RI': 'America/New_York', 'MA': 'America/New_York',
    'VT': 'America/New_York', 'NH': 'America/New_York', 'ME': 'America/New_York',
    'PA': 'America/New_York', 'OH': 'America/New_York', 'WV': 'America/New_York',
    'KY': 'America/New_York', 'TN': 'America/New_York',
    'MI': 'America/Detroit', 'IN': 'America/Indiana/Indianapolis',

    // Central Time
    'AL': 'America/Chicago', 'AR': 'America/Chicago', 'IL': 'America/Chicago',
    'IA': 'America/Chicago', 'KS': 'America/Chicago', 'LA': 'America/Chicago',
    'MN': 'America/Chicago', 'MS': 'America/Chicago', 'MO': 'America/Chicago',
    'NE': 'America/Chicago', 'ND': 'America/Chicago', 'OK': 'America/Chicago',
    'SD': 'America/Chicago', 'TX': 'America/Chicago', 'WI': 'America/Chicago',

    // Mountain Time
    'AZ': 'America/Phoenix', 'CO': 'America/Denver', 'ID': 'America/Denver',
    'MT': 'America/Denver', 'NV': 'America/Denver', 'NM': 'America/Denver',
    'UT': 'America/Denver', 'WY': 'America/Denver',

    // Pacific Time
    'CA': 'America/Los_Angeles', 'OR': 'America/Los_Angeles', 'WA': 'America/Los_Angeles',

    // Alaska & Hawaii
    'AK': 'America/Anchorage', 'HI': 'Pacific/Honolulu'
  };

  const timezone = stateTimezones[leadState.toUpperCase()];
  if (!timezone) return false;

  try {
    const now = new Date();
    // Get current hour/minute in lead's timezone (toLocaleString + new Date parses as local, so use Intl)
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const currentMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // FTC allows 8 AM (480 minutes) to 9 PM (1260 minutes)
    const isPermissible = currentTimeInMinutes >= 480 && currentTimeInMinutes <= 1260;

    if (!isPermissible) {
      debugLog(`🚫 FRONTEND FTC: ${leadState} not callable at ${currentHour}:${String(currentMinute).padStart(2, '0')} (${timezone})`);
    }

    return isPermissible;
  } catch (error) {
    console.error('❌ Frontend FTC error:', error);
    return false;
  }
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
};

const normalizeStateForFtc = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();

  const lettersOnly = upper.replace(/[^A-Z]/g, '');
  if (/^[A-Z]{2}$/.test(lettersOnly)) return lettersOnly;

  const fromName = STATE_NAME_TO_CODE[upper];
  if (fromName) return fromName;

  return upper;
};

const getLeadStateForFtc = (lead: any): string => {
  // Prefer taalk_state first; `state` can be long-form names that need normalization.
  const primary = normalizeStateForFtc(lead?.taalk_state);
  if (primary) return primary;
  return normalizeStateForFtc(lead?.state);
};

const isLeadFtcCallable = (lead: any): boolean =>
  !FTC_FILTERING_ENABLED ||
  isCallPermissibleFrontend(
    getLeadStateForFtc(lead),
    (lead as any)?.ftcRestricted || (lead as any)?.ftcrestricted
  );

// Helper function to detect Mac
const isMac = () => {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac/.test(navigator.userAgent);
};

// Helper function to detect broken microphone permission (Mac-specific)
// Checks for NotAllowedError or empty device labels (TCC corruption)
const detectBrokenMicrophonePermission = async (): Promise<boolean> => {
  if (!isMac()) return false;

  try {
    // Try to get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    // Check if device labels are empty (indicates TCC corruption)
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const hasEmptyLabels = audioInputs.some(device => !device.label || device.label === '');

    if (hasEmptyLabels) {
      console.warn('⚠️ Mac: Microphone devices have empty labels - TCC permission may be corrupted');
      return true;
    }

    return false;
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.warn('⚠️ Mac: Microphone permission denied - may be broken or corrupted');
      return true;
    }
    return false;
  }
};

// Helper function to request microphone permission explicitly (critical for Mac Electron)
// Returns { success: boolean; error?: string; stream?: MediaStream; needsRecovery?: boolean } for better error handling
// On Mac Electron, we need to request system permission via IPC first, then getUserMedia
const requestMicrophonePermission = async (keepStreamActive: boolean = false): Promise<{ success: boolean; error?: string; stream?: MediaStream; needsRecovery?: boolean }> => {
  try {
    debugLog('🎤 Requesting microphone permission...');
    
    // 🍎 MAC ELECTRON: Request system-level permission via IPC first
    if (isMac() && (window as any).electronAPI?.requestMicrophonePermission) {
      debugLog('🍎 Mac Electron detected - requesting system microphone permission via IPC...');
      try {
        const electronResult = await (window as any).electronAPI.requestMicrophonePermission();
        debugLog('🍎 Mac Electron IPC result:', electronResult);
        if (!electronResult.success && !electronResult.alreadyGranted) {
          return { 
            success: false,
            needsRecovery: true,
            error: electronResult.error || 'System microphone permission denied. Please allow in System Preferences > Security & Privacy > Microphone.' 
          };
        }
        debugLog('✅ Mac Electron: System microphone permission granted');
      } catch (electronError: any) {
        console.error('❌ Mac Electron: IPC permission request failed:', electronError);
        // Continue to try getUserMedia anyway
      }
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('❌ getUserMedia not supported');
      return { success: false, error: 'Microphone access not supported in this browser' };
    }

    // Request microphone access explicitly (Electron permission handler will grant it)
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false 
    });
    
    debugLog('✅ Microphone permission granted, stream active:', stream.active);
    
    // 🍎 MAC-SPECIFIC: Check for broken permission (empty device labels)
    const isBroken = await detectBrokenMicrophonePermission();
    if (isBroken) {
      stream.getTracks().forEach(track => track.stop());
      return { success: false, needsRecovery: true, error: 'Microphone permission appears to be corrupted. Please reset permissions.' };
    }
    
    // 🍎 MAC-SPECIFIC: On Mac, keep stream active if requested (needed for device.register())
    if (!keepStreamActive) {
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      debugLog('🛑 Microphone stream stopped (permission obtained)');
      return { success: true };
    } else {
      // Keep stream active for Mac - caller must stop it after device.register()
      debugLog('🍎 Mac: Keeping microphone stream active for device registration');
      return { success: true, stream };
    }
  } catch (error: any) {
    console.error('❌ Microphone permission denied:', error);
    
    let errorMessage = 'Microphone access denied';
    
    let needsRecovery = false;
    
    // Provide helpful error messages
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.error('🚫 Microphone access denied by user');
      needsRecovery = isMac(); // Mac needs recovery flow
      if (isMac()) {
        errorMessage = 'Microphone permission denied. Please allow microphone access in System Preferences > Security & Privacy > Microphone, then refresh the page.';
        console.error('💡 Mac users: Please allow microphone access in System Settings > Privacy & Security > Microphone, then refresh the page');
      } else {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      }
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone and try again.';
      console.error('❌ No microphone found');
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Microphone is being used by another application. Please close other apps using the microphone and try again.';
      console.error('❌ Microphone is being used by another application');
    }
    
    return { success: false, error: errorMessage, needsRecovery };
  }
};

const pushWebRtcDebug = (event: string, data: Record<string, any> = {}) => {
  try {
    const entry = {
      event,
      ts: new Date().toISOString(),
      ...data,
    };
    if (!window.__webrtcDebugLog) window.__webrtcDebugLog = [];
    window.__webrtcDebugLog.push(entry);
    if (window.__webrtcDebugLog.length > 1000) {
      window.__webrtcDebugLog = window.__webrtcDebugLog.slice(-1000);
    }
    if (window.__webrtcDebugEnabled !== false) {
      debugLog('WEBRTC_DEBUG', entry);
    }
  } catch (e) {
    console.warn('WEBRTC_DEBUG_PUSH_FAILED', e);
  }
};

const isDeviceConnectReady = (deviceObj: any) => {
  // In current Twilio Voice SDK behavior, 'registered' is connect-ready.
  return deviceObj?.state === 'ready' || deviceObj?.state === 'registered';
};

type WebRtcFailureReason =
  | 'token_fetch'
  | 'token_http'
  | 'token_invalid'
  | 'register_timeout'
  | 'unknown';

const clearLastWebRtcFailure = () => {
  (window as any).__webrtcLastFailure = null;
};

const setLastWebRtcFailure = (reason: WebRtcFailureReason, detail: string) => {
  (window as any).__webrtcLastFailure = {
    reason,
    detail,
    at: Date.now(),
  };
};

const getLastWebRtcFailure = (): { reason: WebRtcFailureReason; detail: string } | null => {
  return ((window as any).__webrtcLastFailure as { reason: WebRtcFailureReason; detail: string } | null) || null;
};

const getWebRtcFailureToast = () => {
  const failure = getLastWebRtcFailure();
  if (!failure) {
    return {
      title: 'WebRTC could not register',
      description: 'Twilio registration timed out. Turn off VPN/firewall blocks and retry.',
    };
  }
  if (failure.reason === 'token_fetch') {
    return {
      title: 'Token fetch failed',
      description: 'Dialer could not reach /api/twilio/token. Network, VPN, proxy, or CORS is blocking the request.',
    };
  }
  if (failure.reason === 'token_http') {
    return {
      title: 'Token endpoint rejected request',
      description: failure.detail || 'Token endpoint returned an error. Sign in again and retry.',
    };
  }
  if (failure.reason === 'token_invalid') {
    return {
      title: 'Invalid Twilio token',
      description: failure.detail || 'Token payload was invalid. Retry and check Twilio token service logs.',
    };
  }
  if (failure.reason === 'register_timeout') {
    return {
      title: 'Twilio registration timeout',
      description: 'Token was fetched, but Twilio signaling never reached ready. Check VPN/firewall WebSocket blocks.',
    };
  }
  return {
    title: 'WebRTC start failed',
    description: failure.detail || 'Unknown WebRTC startup failure. Check browser console + Twilio logs.',
  };
};

const powerOnWebRTC = async (
  identity = "producer123",
  agentEmail?: string,
  macMicrophoneStream?: MediaStream,
  incomingCallHandlers?: {
    setIncomingConn: (c: any) => void;
    setDialerState: (u: any) => void;
    inboundCallLeadRef?: React.MutableRefObject<Lead | null | undefined>;
    /** When true, agent already clicked Accept; accept browser leg as soon as incoming arrives */
    answerRequestedRef?: React.MutableRefObject<boolean>;
    /** Set to true when we accept in device handler so useEffect does not double-accept */
    acceptIssuedRef?: React.MutableRefObject<boolean>;
    shouldHandleInboundAccept?: () => boolean;
    onInboundAccepted?: (conn: any) => void;
    onInboundDisconnected?: () => void;
    onInboundCanceled?: () => void;
    onTaskRouterSync?: (reason: string, force?: 'online' | 'offline' | 'busy' | 'wrap') => void;
    onDuplicateSession?: (isDuplicate: boolean) => void;
  },
  options?: { simpleRegister?: boolean }
) => {
  const initStartedAt = Date.now();
  clearLastWebRtcFailure();
  const powerOnTraceId = `poweron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let activeMicrophoneStream: MediaStream | null =
    macMicrophoneStream || (window as any).__micStream || (window as any).__webrtcMicStream || null;
  const requestedIdentity = (agentEmail || identity || "").toLowerCase();
  (window as any).__webrtcAgentEmail = requestedIdentity; // for beforeunload/voice-offline body fallback

  debugLog("═══════════════════════════════════════════════════════════════");
  debugLog("🟢 [WEBRTC DEBUG] ENTERED powerOnWebRTC()");
  debugLog("═══════════════════════════════════════════════════════════════");
  debugLog("📋 [WEBRTC DEBUG] Parameters:", {
    identity,
    agentEmail,
    hasMacStream: !!macMicrophoneStream,
    isMac: isMac(),
    powerOnTraceId,
    timestamp: new Date().toISOString(),
    callStack: new Error().stack?.split('\n').slice(1, 5).join('\n'),
  });
  debugLog("📋 [WEBRTC DEBUG] Environment:", {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hasTwilioSDK: typeof (window as any).Twilio !== "undefined",
    hasElectronAPI: !!(window as any).electronAPI,
    currentUrl: window.location.href,
  });

  // Hard guard: if a same-user device is already in progress or connect-ready, never create a new one.
  const bootDevice = (window as any).twilioDevice;
  if (bootDevice) {
    const bootState = bootDevice.state;
    const bootIdentity = ((bootDevice as any).identity || "").toLowerCase();
    const identityMatches = !requestedIdentity || !bootIdentity || bootIdentity === requestedIdentity;
    if (identityMatches && (bootState === 'registering' || bootState === 'registered' || bootState === 'ready')) {
      debugLog("✅ [WEBRTC DEBUG] Reusing existing boot device (skip recreate):", {
        state: bootState,
        identity: bootIdentity,
        requestedIdentity,
      });
      device = bootDevice;
      pushWebRtcDebug('powerOnWebRTC:reuse-early', {
        powerOnTraceId,
        state: bootState,
        identity: bootIdentity,
        requestedIdentity,
      });
      // Re-attach incoming handler so modal + accept/disconnect use current handlers (fixes no popup when device was reused)
      const setIncoming = incomingCallHandlers?.setIncomingConn ?? (window as any).__setIncomingConn;
      const setDialer = incomingCallHandlers?.setDialerState;
      const leadRef = incomingCallHandlers?.inboundCallLeadRef;
      const answerRequestedRefReuse = incomingCallHandlers?.answerRequestedRef;
      const acceptIssuedRefReuse = incomingCallHandlers?.acceptIssuedRef;
      const shouldHandleInboundAccept = incomingCallHandlers?.shouldHandleInboundAccept;
      const onInboundAccepted = incomingCallHandlers?.onInboundAccepted;
      const onInboundDisconnected = incomingCallHandlers?.onInboundDisconnected;
      const onInboundCanceled = incomingCallHandlers?.onInboundCanceled;
      if (typeof setIncoming === 'function' && device.on) {
        try {
          device.off?.('incoming');
        } catch (_) {}
        device.on('incoming', (conn: any) => {
          debugLog('📞 Incoming call received (reused device)');
          console.log('[INBOUND-MODAL] Device "incoming" handler fired (REUSED device)', { from: conn?.parameters?.From });
          (window as any).__lastIncomingConn = conn;
          const hasGlobal = typeof (window as any).__setIncomingConn === 'function';
          console.log('[INBOUND-MODAL] reuse path: __setIncomingConn?', hasGlobal);
          (window as any).__setIncomingConn?.(conn);
          console.log('[INBOUND-MODAL] reuse: incoming delegated to global queue');
          if (setDialer) {
            const fireConnectedReuse = () => {
              if (shouldHandleInboundAccept && !shouldHandleInboundAccept()) return;
              incomingCallHandlers?.onTaskRouterSync?.('incoming-device-reuse-accept', 'busy');
              if (onInboundAccepted) {
                onInboundAccepted(conn);
                return;
              }
              (window as any).__setIncomingConn?.(null);
              setIncoming(null);
              setDialer((prev: any) => {
                const lead = leadRef?.current ?? prev.inboundCallLead ?? null;
                const rawFrom = conn?.parameters?.From;
                const last10 = rawFrom ? String(rawFrom).replace(/\D/g, '').slice(-10) : '';
                const isDequeue = last10.length >= 10 && ['9142289324', '6096048379', '6095473687', '6096045352'].includes(last10);
                const prevFrom = prev.inboundCallInfo?.from;
                const prevFromLast10 = prevFrom ? String(prevFrom).replace(/\D/g, '').slice(-10) : '';
                const prevFromIsDequeue = prevFromLast10.length >= 10 && ['9142289324', '6096048379', '6095473687', '6096045352'].includes(prevFromLast10);
                const callerPhone = lead?.phone ?? (prevFrom && !prevFromIsDequeue ? prevFrom : '') ?? (!isDequeue && rawFrom ? rawFrom : '');
                return {
                  ...prev,
                  dialingStatus: 'connected',
                  isConnected: true,
                  webRTCConferenceActive: true,
                  inboundCallInfo: (callerPhone || conn?.parameters?.To) ? { from: callerPhone ?? '', to: conn?.parameters?.To ?? '', callSid: conn?.parameters?.CallSid ?? '' } : null,
                  inboundCallLead: lead ?? prev.inboundCallLead ?? null,
                  viewedLead: lead ?? prev.viewedLead ?? null,
                  currentCall: lead ?? prev.currentCall ?? null,
                };
              });
            };
            conn.on?.('accept', () => {
              inboundDebugLog('device accept (reuse path)', { hasHandler: !!onInboundAccepted, shouldHandle: !shouldHandleInboundAccept || shouldHandleInboundAccept() });
              fireConnectedReuse();
            });
            conn.on?.('disconnect', () => {
              inboundDebugLog('device disconnect (reuse path)', { hasFreezeHandler: !!onInboundDisconnected });
              try {
                if (onInboundDisconnected) {
                  onInboundDisconnected();
                  return;
                }
                (window as any).__setIncomingConn?.(null);
                setIncoming(null);
                setDialer((prev: any) => ({ ...prev, webRTCConferenceActive: false, dialingStatus: 'idle', isConnected: false, inboundCallInfo: null, inboundCallLead: null }));
              } catch (e) {
                console.warn('Inbound disconnect handler error (ignored):', e);
              }
            });
            conn.on?.('cancel', () => {
              inboundDebugLog('device cancel (reuse path)', { hasFreezeHandler: !!onInboundCanceled });
              try {
                if (onInboundCanceled) {
                  onInboundCanceled();
                  return;
                }
                (window as any).__setIncomingConn?.(null);
                setIncoming(null);
              } catch (e) {
                console.warn('Inbound cancel handler error (ignored):', e);
              }
            });
            if (answerRequestedRefReuse?.current && typeof conn.accept === 'function') {
              debugLog('📞 Reuse path: Answer already clicked – accepting browser leg (handlers already attached)');
              try {
                conn.accept();
                acceptIssuedRefReuse && (acceptIssuedRefReuse.current = true);
              } catch (e) { console.warn('Reuse path immediate accept failed', e); }
            }
            // Only treat as connected if we already requested Answer — RINGING must not set BusyOnCall
            const statusReuse = (conn as any).status ?? (conn as any).state;
            if ((statusReuse === 'open' || statusReuse === 'connected') && answerRequestedRefReuse?.current) {
              inboundDebugLog('device already open (reuse path)', { status: statusReuse });
              fireConnectedReuse();
            }
          }
        });
      }
      return true;
    }
  }
  
  if (powerOnWebRtcInProgress) {
    console.warn("⚠️ [WEBRTC DEBUG] powerOnWebRTC already in progress - checking existing device");
    const existingDevice = (window as any).twilioDevice;
    debugLog("📋 [WEBRTC DEBUG] Existing device check:", {
      exists: !!existingDevice,
      state: existingDevice?.state,
      identity: existingDevice?.identity,
      isReady: isDeviceConnectReady(existingDevice),
    });
    pushWebRtcDebug('powerOnWebRTC:deduped', { powerOnTraceId, agentEmail, identity });
    for (let i = 0; i < 12; i++) {
      if (isDeviceConnectReady((window as any).twilioDevice)) {
        debugLog("✅ [WEBRTC DEBUG] Existing device is ready, returning early");
        return true;
      }
      if (!powerOnWebRtcInProgress) {
        debugLog("⚠️ [WEBRTC DEBUG] powerOnWebRtcInProgress flag cleared, breaking wait loop");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const finalCheck = isDeviceConnectReady((window as any).twilioDevice);
    debugLog("📋 [WEBRTC DEBUG] Final device check after wait:", { isReady: finalCheck });
    return finalCheck;
  }
  
  debugLog("🔒 [WEBRTC DEBUG] Setting powerOnWebRtcInProgress = true");
  powerOnWebRtcInProgress = true;
  pushWebRtcDebug('powerOnWebRTC:start', {
    identity,
    agentEmail,
    powerOnTraceId,
    hasMacStream: !!macMicrophoneStream,
    isMac: isMac(),
  });
  
  // 🍎 MAC-SPECIFIC: On Mac, microphone permission should already be requested in click handler
  // The stream is passed in to keep it active during registration
  debugLog("📋 [WEBRTC DEBUG] Checking Mac/microphone setup:", {
    isMac: isMac(),
    hasMacStream: !!macMicrophoneStream,
    macStreamActive: macMicrophoneStream?.active,
    macStreamTracks: macMicrophoneStream?.getTracks().length,
  });
  
  if (isMac() && macMicrophoneStream) {
    debugLog('🍎 [WEBRTC DEBUG] Mac: Using microphone stream from click handler, keeping active during registration');
    debugLog('📋 [WEBRTC DEBUG] Mac stream details:', {
      id: macMicrophoneStream.id,
      active: macMicrophoneStream.active,
      tracks: macMicrophoneStream.getTracks().map(t => ({
        id: t.id,
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      })),
    });
  } else if (isMac() && !macMicrophoneStream) {
    // Fallback: Request permission here if not already requested
    debugLog('🍎 [WEBRTC DEBUG] Mac detected - requesting microphone permission (fallback)...');
    const micResult = await requestMicrophonePermission(true);
    debugLog('📋 [WEBRTC DEBUG] Mac microphone permission result:', {
      success: micResult.success,
      error: micResult.error,
      hasStream: !!micResult.stream,
      streamActive: micResult.stream?.active,
      needsRecovery: micResult.needsRecovery,
    });
    if (!micResult.success) {
      throw new Error(micResult.error || 'Microphone permission denied');
    }
    if (micResult.stream) {
      macMicrophoneStream = micResult.stream;
      debugLog('✅ [WEBRTC DEBUG] Mac microphone stream obtained');
    }
  }
  
  try {
    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 1: Checking Twilio SDK");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // Check if Twilio SDK is loaded first
    const twilioExists = typeof (window as any).Twilio !== "undefined";
    debugLog("📋 [WEBRTC DEBUG] Twilio SDK check:", {
      exists: twilioExists,
      type: typeof (window as any).Twilio,
      hasDevice: true,
      hasJWT: !!(window as any).Twilio?.jwt,
    });
    
    if (!twilioExists) {
      console.error("❌ [WEBRTC DEBUG] Twilio SDK not loaded - checking script tags...");
      const allScripts = Array.from(document.scripts);
      const twilioScripts = allScripts.filter(s => s.src.includes('twilio'));
      debugLog("📜 [WEBRTC DEBUG] All scripts:", allScripts.map(s => ({ src: s.src, async: s.async, defer: s.defer })));
      debugLog("📜 [WEBRTC DEBUG] Twilio scripts found:", twilioScripts.map(s => s.src));
      throw new Error("Twilio SDK not loaded - make sure script tag is present");
    }

    debugLog("✅ [WEBRTC DEBUG] Twilio SDK found:", {
      type: typeof (window as any).Twilio,
      hasDevice: true,
      hasJWT: !!(window as any).Twilio?.jwt,
      deviceConstructor: typeof TwilioDevice,
    });

    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 2: Getting user email");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // Get user email from agentEmail parameter or localStorage
    let userEmail = agentEmail;
    debugLog("📋 [WEBRTC DEBUG] Initial userEmail from parameter:", userEmail);
    
    if (!userEmail) {
      try {
        const storedUser = localStorage.getItem('current_producer');
        debugLog("📋 [WEBRTC DEBUG] Checking localStorage:", {
          hasStoredUser: !!storedUser,
          storedUserLength: storedUser?.length,
        });
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email;
          debugLog("✅ [WEBRTC DEBUG] Got email from localStorage:", userEmail);
        }
      } catch (e) {
        console.error('❌ [WEBRTC DEBUG] Error parsing localStorage:', e);
        console.error('📋 [WEBRTC DEBUG] Error details:', {
          message: (e as Error)?.message,
          stack: (e as Error)?.stack,
        });
      }
    }

    debugLog("📋 [WEBRTC DEBUG] Final userEmail:", userEmail);
    if (!userEmail) {
      console.error("❌ [WEBRTC DEBUG] No user email found - checking session/auth");
      console.error("📋 [WEBRTC DEBUG] Available auth data:", {
        localStorage: localStorage.getItem('current_producer'),
        sessionStorage: sessionStorage.getItem('current_producer'),
        hasAuthState: !!(window as any).__authState,
      });
      throw new Error('User email not found. Please log in again.');
    }

    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 3: Fetching WebRTC token");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // Always send cookies - use exact format for reliability
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (userEmail) {
      headers['x-user-email'] = userEmail;
      debugLog('🔑 [WEBRTC DEBUG] Added x-user-email header:', userEmail);
    } else {
      console.error('❌ [WEBRTC DEBUG] No userEmail to send in header!');
    }

    // Get correct endpoint based on platform
    const { getTwilioTokenEndpoint, isElectron } = await import('../../utils/webrtc-endpoints');
    const tokenEndpoint = getTwilioTokenEndpoint();
    if (isElectron()) {
      headers['x-desktop-app'] = 'true';
    }
    
    debugLog('📋 [WEBRTC DEBUG] Request headers:', JSON.stringify(headers, null, 2));
    debugLog(`📋 [WEBRTC DEBUG] Request URL: ${tokenEndpoint}`);
    debugLog('📋 [WEBRTC DEBUG] Request method: GET');
    debugLog('📋 [WEBRTC DEBUG] Credentials: include (sending cookies)');
    debugLog('📋 [WEBRTC DEBUG] Cookies:', document.cookie);

    const tokenReqStartedAt = Date.now();
    debugLog('⏱️ [WEBRTC DEBUG] Token request started at:', new Date(tokenReqStartedAt).toISOString());
    
    const tokenFetchCredentials = getServiceRequestCredentials(tokenEndpoint);
    let res: Response;
    try {
      res = await fetch(tokenEndpoint, {
        method: 'GET',
        credentials: tokenFetchCredentials,
        headers
      });
      const tokenReqDuration = Date.now() - tokenReqStartedAt;
      debugLog('⏱️ [WEBRTC DEBUG] Token request completed in:', tokenReqDuration, 'ms');
    } catch (fetchError: any) {
      console.error('❌ [WEBRTC DEBUG] Token fetch failed:', fetchError);
      console.error('📋 [WEBRTC DEBUG] Fetch error details:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        name: fetchError?.name,
        cause: fetchError?.cause,
      });
      setLastWebRtcFailure('token_fetch', String(fetchError?.message || fetchError || 'Failed to fetch'));
      throw new Error(`Token fetch failed: ${fetchError?.message || fetchError}`);
    }
    
    debugLog('📋 [WEBRTC DEBUG] Token response received:', {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      hasSetCookie: !!res.headers.get('set-cookie'),
      contentType: res.headers.get('content-type'),
    });
    
    pushWebRtcDebug('powerOnWebRTC:token-response', {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - tokenReqStartedAt,
      hasSetCookieHeader: !!res.headers.get('set-cookie'),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Could not read error response');
      console.error('❌ [WEBRTC DEBUG] Token request failed:', {
        status: res.status,
        statusText: res.statusText,
        errorText,
      });
      let err: any = {};
      try {
        err = JSON.parse(errorText);
        console.error('📋 [WEBRTC DEBUG] Parsed error response:', err);
      } catch (e) {
        console.error('📋 [WEBRTC DEBUG] Could not parse error as JSON:', e);
      }
      setLastWebRtcFailure(
        'token_http',
        `HTTP ${res.status} ${res.statusText}${errorText ? ` — ${String(errorText).slice(0, 140)}` : ''}`
      );
      throw new Error(err?.message || err?.error || errorText || "Login required to get token");
    }
    
    const tokenData = await res.json().catch(async (parseError) => {
      const text = await res.text();
      console.error('❌ [WEBRTC DEBUG] Failed to parse token response as JSON:', parseError);
      console.error('📋 [WEBRTC DEBUG] Response text:', text);
      throw new Error(`Invalid token response: ${text}`);
    });
    
    debugLog('📋 [WEBRTC DEBUG] Token response parsed:', {
      hasToken: !!tokenData.token,
      tokenLength: tokenData.token?.length,
      tokenIdentity: tokenData.identity,
      responseKeys: Object.keys(tokenData || {}),
      fullResponse: JSON.stringify(tokenData, null, 2),
    });
    
    let token = tokenData.token;
    pushWebRtcDebug('powerOnWebRTC:token-parsed', {
      tokenLength: token?.length,
      tokenIdentity: tokenData?.identity,
      responseKeys: Object.keys(tokenData || {}),
    });

    try {
      const [, payloadB64] = token.split('.');
      const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(normalized);
      const payload = JSON.parse(payloadJson);
      const expMs = typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
      // Expose expiry for diagnostics hook
      if (typeof payload?.exp === 'number') (window as any).__twilioTokenExpiry = payload.exp;
      const grants = payload?.grants || {};
      const hasVoiceGrant = !!grants.voice;
      const hasOutgoingGrant = !!(grants.voice?.outgoing || grants.outgoing_application_sid);
      const hasIncomingGrant = !!(grants.voice?.incoming?.allow || grants.incoming?.allow);
      pushWebRtcDebug('powerOnWebRTC:token-exp', {
        exp: payload?.exp,
        expiresAtIso: expMs ? new Date(expMs).toISOString() : null,
        expiresInMs: expMs ? expMs - Date.now() : null,
        hasVoiceGrant,
        hasOutgoingGrant,
        hasIncomingGrant,
        grantKeys: Object.keys(grants || {}),
      });
      debugLog('📋 [WEBRTC DEBUG] Token grants:', {
        hasVoiceGrant,
        hasOutgoingGrant,
        hasIncomingGrant,
        grantKeys: Object.keys(grants || {}),
        identityClaim: payload?.grants?.identity || payload?.sub || payload?.jti,
      });
    } catch (jwtDecodeError) {
      console.warn('⚠️ [WEBRTC DEBUG] Could not decode token expiry:', jwtDecodeError);
    }

    if (!token) {
      console.error('❌ [WEBRTC DEBUG] No token in response:', tokenData);
      setLastWebRtcFailure('token_invalid', 'No token returned from /api/twilio/token');
      throw new Error("No token received from server");
    }
    
    if (token.length < 100) {
      console.error('❌ [WEBRTC DEBUG] Token too short:', {
        length: token.length,
        tokenPreview: token.substring(0, 50),
        fullToken: token,
      });
      setLastWebRtcFailure('token_invalid', `Token too short (${token.length})`);
      throw new Error(`Received invalid token (length: ${token.length}, expected >= 100)`);
    }
    
    debugLog('✅ [WEBRTC DEBUG] Token validated:', {
      length: token.length,
      preview: token.substring(0, 50) + '...',
      identity: tokenData.identity,
    });

    const fetchFreshTwilioToken = async (): Promise<string | null> => {
      try {
        const refreshRes = await fetch(tokenEndpoint, {
          method: 'GET',
          credentials: tokenFetchCredentials,
          headers,
        });
        if (!refreshRes.ok) return null;
        const refreshData = await refreshRes.json().catch(() => null);
        const refreshedToken = refreshData?.token;
        if (!refreshedToken || typeof refreshedToken !== 'string' || refreshedToken.length < 100) {
          return null;
        }
        return refreshedToken;
      } catch {
        return null;
      }
    };

    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 4: Validating token identity");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // Identity in token must match current user (server issues from session only)
    const tokenIdentity = (tokenData.identity || "").toLowerCase();
    const currentIdentity = (agentEmail || identity || "").toLowerCase();
    
    debugLog('📋 [WEBRTC DEBUG] Identity check:', {
      tokenIdentity,
      currentIdentity,
      matches: tokenIdentity === currentIdentity,
      agentEmail,
      identity,
    });
    
    if (currentIdentity && tokenIdentity && tokenIdentity !== currentIdentity) {
      console.warn("⚠️ [WEBRTC DEBUG] Token identity mismatch — destroying stale device", { 
        tokenIdentity, 
        currentIdentity,
        existingDevice: (window as any).twilioDevice?.state,
      });
      (window as any).twilioDevice = null;
    } else {
      debugLog('✅ [WEBRTC DEBUG] Token identity matches current user');
    }

    debugLog("📋 [WEBRTC DEBUG] Token summary:", {
      preview: token.slice(0, 40) + "...",
      length: token.length,
      identity: tokenIdentity,
    });

    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 5: Checking for existing device");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // Reuse a healthy same-identity device. Normal outbound dialing must not
    // unregister/destroy Twilio.Device between calls because registration churn
    // adds delay and can race the next dial.
    const existingDevice = (window as any).twilioDevice;
    const existingModuleDevice = device;
    
    debugLog('📋 [WEBRTC DEBUG] Checking for existing devices to cleanup:', {
      windowDevice: !!existingDevice,
      windowDeviceState: existingDevice?.state,
      moduleDevice: !!existingModuleDevice,
      moduleDeviceState: existingModuleDevice?.state,
    });
    
    const anyExisting = existingDevice || existingModuleDevice;
    if (anyExisting && (anyExisting.state === 'registered' || anyExisting.state === 'ready')) {
      const existingIdentity = String((anyExisting as any).identity || '').toLowerCase();
      const identityMatches = !requestedIdentity || !existingIdentity || existingIdentity === requestedIdentity;
      if (identityMatches) {
        debugLog('✅ [WEBRTC DEBUG] Reusing healthy registered device; no teardown between calls', {
          state: anyExisting.state,
          identity: existingIdentity,
          requestedIdentity,
        });
        (window as any).twilioDevice = anyExisting;
        device = anyExisting;
        powerOnWebRtcInProgress = false;
        return true;
      }
    }

    // If existing device is still registering, wait briefly for it to complete instead of destroying (avoids closing WebSocket before connection established)
    if (anyExisting && (anyExisting.state === 'registering' as string)) {
      debugLog('⏳ [WEBRTC DEBUG] Existing device still registering – waiting up to 4s before replacing');
      const waitStart = Date.now();
      const waitMs = 4000;
      while (Date.now() - waitStart < waitMs && (anyExisting.state === 'registering' as string)) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      if (anyExisting.state === 'registered' || anyExisting.state === 'ready') {
        debugLog('✅ [WEBRTC DEBUG] Existing device registered while waiting – reusing');
        (window as any).twilioDevice = anyExisting;
        device = anyExisting;
        powerOnWebRtcInProgress = false;
        return true;
      }
      debugLog('📋 [WEBRTC DEBUG] Existing device still not ready after wait – will replace');
    }

    // Cleanup existing devices (don't destroy a registering device we just waited for – we only get here if it didn't become ready)
    const devicesToCleanup = [existingDevice, existingModuleDevice].filter(Boolean);
    
    for (const dev of devicesToCleanup) {
      if (!dev) continue;
      
      try {
        const devState = dev.state;
        debugLog(`🧹 [WEBRTC DEBUG] Destroying existing device (state: ${devState})`);
        
        // Disconnect all calls first
        if (typeof dev.disconnectAll === 'function') {
          try {
            dev.disconnectAll();
            debugLog('✅ [WEBRTC DEBUG] disconnectAll() completed');
          } catch (e) {
            console.warn("⚠️ [WEBRTC DEBUG] Error in disconnectAll():", e);
          }
        }
        
        // Unregister if registered (skip unregister if still registering – destroy will close the connection)
        if ((devState === 'registered' || devState === 'ready') && typeof dev.unregister === 'function') {
          try {
            debugLog('📋 [WEBRTC DEBUG] Unregistering device');
            dev.unregister();
            await new Promise(resolve => setTimeout(resolve, 300));
            debugLog('✅ [WEBRTC DEBUG] Unregister completed');
          } catch (e) {
            console.warn("⚠️ [WEBRTC DEBUG] Error unregistering:", e);
          }
        }
        
        if (typeof dev.destroy === 'function') {
          withAllowedTwilioDeviceDestroy(() => dev.destroy());
          debugLog('✅ [WEBRTC DEBUG] Device destroyed');
        }
      } catch (e) {
        console.error("❌ [WEBRTC DEBUG] Error cleaning up device:", e);
      }
    }
    
    (window as any).twilioDevice = null;
    device = null;
    debugLog('✅ [WEBRTC DEBUG] All device references cleared - ready for fresh device');

    // Device cleanup already handled above - no need to check again

    if (!options?.simpleRegister) {
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("🔍 [WEBRTC DEBUG] STEP 6: Resuming AudioContext and requesting microphone permission");
      debugLog("═══════════════════════════════════════════════════════════════");
      
      // CRITICAL: Resume AudioContext BEFORE requesting microphone permission
      // This ensures AudioContext is active when Twilio SDK needs it
      try {
        debugLog('🔊 [WEBRTC DEBUG] Ensuring AudioContext is resumed...');
        let audioContext = (window as any).__webrtcAudioContext;
        if (!audioContext) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioContext = new AudioContextClass();
            (window as any).__webrtcAudioContext = audioContext;
            debugLog('✅ [WEBRTC DEBUG] Created new AudioContext');
          }
        }
        if (audioContext) {
          if (audioContext.state === 'suspended') {
            debugLog('📋 [WEBRTC DEBUG] AudioContext is suspended, resuming...');
            await audioContext.resume();
            debugLog(`✅ [WEBRTC DEBUG] AudioContext resumed, state: ${audioContext.state}`);
          } else {
            debugLog(`✅ [WEBRTC DEBUG] AudioContext already active (state: ${audioContext.state})`);
          }
        } else {
          console.warn('⚠️ [WEBRTC DEBUG] AudioContext not available in this browser');
        }
      } catch (audioError: any) {
        console.error('❌ [WEBRTC DEBUG] Failed to resume AudioContext:', audioError);
        // Continue anyway - might still work
      }
      
      const hasUsableActiveStream = !!(
        activeMicrophoneStream &&
        activeMicrophoneStream.active &&
        activeMicrophoneStream.getAudioTracks().some((track) => track.readyState === 'live')
      );

      if (!hasUsableActiveStream) {
        debugLog('🎤 [WEBRTC DEBUG] No active microphone stream found - requesting and retaining one');
        try {
          activeMicrophoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          debugLog('✅ [WEBRTC DEBUG] Microphone stream acquired and retained:', {
            active: activeMicrophoneStream.active,
            trackCount: activeMicrophoneStream.getTracks().length,
            audioTrackStates: activeMicrophoneStream.getAudioTracks().map((track) => track.readyState),
          });
        } catch (micError: any) {
          console.warn('⚠️ [WEBRTC DEBUG] Auto-start microphone request failed, continuing without live mic stream:', micError);
          activeMicrophoneStream = null;
        }
      } else {
        debugLog('✅ [WEBRTC DEBUG] Reusing active microphone stream');
      }

      (window as any).__micStream = activeMicrophoneStream;
      (window as any).__webrtcMicStream = activeMicrophoneStream;
    } else {
      debugLog('⚡ [WEBRTC DEBUG] Simple register mode: skipping audio and microphone preflight');
      activeMicrophoneStream = null;
      (window as any).__micStream = null;
      (window as any).__webrtcMicStream = null;
    }
    
    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 6.5: PRE-FLIGHT DIAGNOSTICS");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // 1. Token Grant Validation
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        debugLog('🔍 [WEBRTC DEBUG] Token payload:', {
          identity: payload.identity,
          grants: Object.keys(payload.grants || {}),
          hasVoiceGrant: !!(payload.grants?.voice),
          voiceGrantAppSid: payload.grants?.voice?.outgoing?.application_sid,
          exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          expSeconds: payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : null,
        });
        
        if (!payload.grants?.voice) {
          console.error('❌ [WEBRTC DEBUG] TOKEN MISSING VOICEGRANT - This will cause registration to hang!');
        }
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          console.error('❌ [WEBRTC DEBUG] TOKEN EXPIRED - This will cause registration to hang!');
        }
      }
    } catch (e) {
      console.warn('⚠️ [WEBRTC DEBUG] Could not decode token:', e);
    }
    
    // 2. Browser WebRTC Support
    const webrtcSupport = {
      hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
      hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
      hasWebSocket: typeof WebSocket !== 'undefined',
      hasAudioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
    };
    debugLog('🔍 [WEBRTC DEBUG] Browser WebRTC support:', webrtcSupport);
    if (!webrtcSupport.hasWebSocket) {
      console.error('❌ [WEBRTC DEBUG] NO WEBSOCKET SUPPORT - Registration will fail!');
    }
    
    // 3. Network Connectivity
    const networkInfo = {
      onLine: navigator.onLine,
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt,
        saveData: (navigator as any).connection.saveData,
      } : 'not available',
      userAgent: navigator.userAgent,
    };
    debugLog('🔍 [WEBRTC DEBUG] Network info:', networkInfo);
    
    // 4. Test WebSocket connectivity to Twilio signaling
    // NOTE: Windows Chrome may fail this test even though Twilio Device works fine
    // This is a known Windows Chrome WebSocket behavior difference, not a network issue
    const testWebSocketConnectivity = async () => {
      const isWindows = navigator.platform.toLowerCase().includes('win') || navigator.userAgent.toLowerCase().includes('windows');
      
      // Skip WebSocket test on Windows - it often fails incorrectly due to Chrome behavior
      // The actual Twilio Device will still work even if this test fails
      if (isWindows) {
        debugLog('🪟 [WEBRTC DEBUG] Windows detected - skipping WebSocket test (Windows Chrome has different WebSocket behavior)');
        return;
      }
      
      return new Promise<void>((resolve) => {
        const testWs = new WebSocket('wss://chunderw-gll.twilio.com');
        const timeout = setTimeout(() => {
          testWs.close();
          console.warn('⚠️ [WEBRTC DEBUG] WebSocket test timed out after 5s');
          resolve();
        }, 5000);
        
        testWs.onopen = () => {
          clearTimeout(timeout);
          debugLog('✅ [WEBRTC DEBUG] WebSocket test: CONNECTED to Twilio signaling');
          testWs.close();
          resolve();
        };
        
        testWs.onerror = () => {
          // Server responded with an error (e.g. 403) — this means reachable, NOT a firewall block.
          // Only a timeout means truly unreachable.
          clearTimeout(timeout);
          debugLog('✅ [WEBRTC DEBUG] WebSocket test: server responded (not a firewall block)');
          testWs.close();
          resolve();
        };
      });
    };
    
    await testWebSocketConnectivity();
    
    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 7: Creating Twilio Device");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // Match working test page options - simpler is better
    // No edge specified - let Twilio SDK use default
    const inboundRingerMuted = typeof localStorage !== 'undefined' && localStorage.getItem('inbound_ringer_muted') === 'true';
    const SIGNALING_EDGES = ['ashburn', 'umatilla', 'roaming'] as const;
    const buildTwilioDeviceOptions = (edge?: string): Record<string, any> => ({
      debug: true,
      enableRingingState: true,
      closeProtection: true, // Match test page
      ...(inboundRingerMuted ? { sounds: { incoming: '' } } : {}),
      ...(edge ? { edge } : {}),
    });
    let selectedEdge: string | undefined = undefined;
    let twilioDeviceOptions: Record<string, any> = buildTwilioDeviceOptions(selectedEdge);

    debugLog("🚀 [WEBRTC DEBUG] Creating Twilio Device with options:", {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 50) + '...',
      identity: tokenData?.identity || identity,
      hasMicPermission: !!activeMicrophoneStream,
      options: twilioDeviceOptions,
    });
    
    const deviceCreateStart = Date.now();
    pushWebRtcDebug('powerOnWebRTC:create-device', {
      usingIdentity: tokenData?.identity || identity,
      hasMicPermission: !!activeMicrophoneStream,
    });
    
    try {
      device = new TwilioDevice(token, twilioDeviceOptions);
      guardTwilioDeviceDestroy(device);
      const deviceCreateDuration = Date.now() - deviceCreateStart;
      debugLog('✅ [WEBRTC DEBUG] Twilio Device created in', deviceCreateDuration, 'ms');
      debugLog('📋 [WEBRTC DEBUG] Device object:', {
        exists: !!device,
        state: device?.state,
        identity: device?.identity,
        hasOn: typeof device?.on === 'function',
        hasRegister: typeof device?.register === 'function',
        hasConnect: typeof device?.connect === 'function',
        hasUnregister: typeof device?.unregister === 'function',
        hasDestroy: typeof device?.destroy === 'function',
      });
    } catch (deviceError: any) {
      console.error('❌ [WEBRTC DEBUG] Device creation failed:', deviceError);
      console.error('📋 [WEBRTC DEBUG] Device creation error details:', {
        message: deviceError?.message,
        stack: deviceError?.stack,
        name: deviceError?.name,
      });
      throw deviceError;
    }
    
    (window as any).twilioDevice = device; // Make device accessible to volume control
    debugLog('✅ [WEBRTC DEBUG] Device stored in window.twilioDevice');

    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 8: Setting up device event handlers");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    device.on("ready", () => {
      const readyElapsed = Date.now() - initStartedAt;
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("✅ [WEBRTC DEBUG] DEVICE READY EVENT FIRED");
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("📋 [WEBRTC DEBUG] Ready event details:", {
        elapsedMs: readyElapsed,
        state: (device as any)?.state,
        identity: device?.identity,
        timestamp: new Date().toISOString(),
      });
      debugLog("✅ [WEBRTC DEBUG] Twilio device ready - SESSION ESTABLISHED");
      
      pushWebRtcDebug('device:event:ready', {
        elapsedMs: readyElapsed,
        state: (device as any)?.state,
      });
      
      // CRITICAL: Update agent_live_call_status in Supabase when CCPro device becomes ready
      if (agentEmail) {
        debugLog('📋 [WEBRTC DEBUG] Updating agent presence status');
        fetch('/agent/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_email: agentEmail,
            status: 'ready'
          })
        }).then(() => {
          debugLog(`✅ [WEBRTC DEBUG] CCPro DEVICE READY: Updated agent_live_call_status for ${agentEmail}`);
        }).catch((error) => {
          console.error('❌ [WEBRTC DEBUG] Failed to update agent_live_call_status:', error);
        });
      }
    });

    device.on("error", (error: any) => {
      const errorElapsed = Date.now() - initStartedAt;
      console.error("═══════════════════════════════════════════════════════════════");
      console.error("❌ [WEBRTC DEBUG] DEVICE ERROR EVENT FIRED");
      console.error("═══════════════════════════════════════════════════════════════");
      console.error("📋 [WEBRTC DEBUG] Error details:", {
        elapsedMs: errorElapsed,
        state: (device as any)?.state,
        code: error?.code,
        message: error?.message,
        name: error?.name,
        twilioError: error,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
        timestamp: new Date().toISOString(),
      });
      console.error("❌ [WEBRTC DEBUG] Twilio.Device error:", error);
      
      pushWebRtcDebug('device:event:error', {
        elapsedMs: errorElapsed,
        state: (device as any)?.state,
        code: error?.code,
        message: error?.message,
        twilioError: error,
      });
      
      // Expose last error for diagnostics hook
      (window as any).__aoiLastWebRTCError = `${error?.code ?? 'unknown'}: ${error?.message ?? ''}`.trim();

      // Handle specific error codes
      if (error?.code === 20104) {
        // Access token expired — auto-refresh so agent doesn't drop off inbound availability
        console.warn('[WEBRTC] Token expired (20104) — auto-refreshing...');
        fetchTwilioVoiceToken(agentEmail)
          .then(r => r.json())
          .then(data => {
            const newToken = data.token;
            if (newToken && device) {
              device.updateToken(newToken);
              // Update expiry for diagnostics
              try {
                const [, b64] = newToken.split('.');
                const p = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
                if (p?.exp) (window as any).__twilioTokenExpiry = p.exp;
              } catch { /* noop */ }
              console.log('[WEBRTC] Token refreshed after expiry');
            }
          })
          .catch(e => console.error('[WEBRTC] Token refresh after 20104 failed:', e));
      } else if (error?.code === 31005) {
        console.error('❌ [WEBRTC DEBUG] Network error (31005) - check firewall/VPN settings. WebSocket connection may be blocked.');
        console.error('📋 [WEBRTC DEBUG] Network diagnostics:', {
          onLine: navigator.onLine,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
          } : 'not available',
        });
        // Try to re-register on network errors
        setTimeout(() => {
          if (device && device.state !== 'ready' && device.state !== 'registered') {
            debugLog('🔄 [WEBRTC DEBUG] Attempting to re-register after network error...');
            try {
              device.register();
              debugLog('✅ [WEBRTC DEBUG] Re-registration call completed');
            } catch (e) {
              console.error('❌ [WEBRTC DEBUG] Re-registration failed:', e);
            }
          }
        }, 2000);
      } else if (error?.code === 31000) {
        console.error('❌ [WEBRTC DEBUG] Invalid token (31000) - check Twilio credentials');
        console.error('📋 [WEBRTC DEBUG] Token validation:', {
          tokenLength: token?.length,
          tokenPreview: token?.substring(0, 50),
        });
      } else if (error?.code === 31003) {
        console.error('❌ [WEBRTC DEBUG] Connection error (31003) - WebSocket connection failed. Check network/firewall.');
        console.error('📋 [WEBRTC DEBUG] Connection diagnostics:', {
          deviceState: device?.state,
          hasWebSocket: typeof WebSocket !== 'undefined',
        });
      } else if (error?.message?.includes('WebSocket') || error?.message?.includes('websocket')) {
        console.error('❌ [WEBRTC DEBUG] WebSocket connection failed - check network/firewall. This prevents device registration.');
        console.error('💡 [WEBRTC DEBUG] Troubleshooting: Check if firewall/VPN is blocking WebSocket connections to Twilio');
        console.error('📋 [WEBRTC DEBUG] WebSocket support:', {
          hasWebSocket: typeof WebSocket !== 'undefined',
          WebSocketConstructor: typeof WebSocket,
        });
      } else {
        console.error('❌ [WEBRTC DEBUG] Unknown error code:', error?.code);
      }
    });

    device.on("connect", (conn: any) => {
      debugLog("📞 WebRTC connected");
      pushWebRtcDebug('device:event:connect', {
        elapsedMs: Date.now() - initStartedAt,
        state: (device as any)?.state,
        callSid: conn?.parameters?.CallSid,
        direction: conn?.parameters?.Direction,
        from: conn?.parameters?.From,
        to: conn?.parameters?.To,
      });
    });

    device.on("disconnect", (conn: any) => {
      debugLog("🔌 WebRTC disconnected - KEEPING DEVICE ACTIVE");
      pushWebRtcDebug('device:event:disconnect', {
        elapsedMs: Date.now() - initStartedAt,
        state: (device as any)?.state,
        callSid: conn?.parameters?.CallSid,
      });
      // When an inbound call was active, ensure panel shows "Call ended" (conn.on('disconnect') may not fire in all cases).
      if ((window as any).__inboundCallActive && typeof (window as any).__onInboundDisconnected === 'function') {
        (window as any).__inboundCallActive = false;
        try { (window as any).__onInboundDisconnected(); } catch (e) { console.warn('Inbound disconnect (device-level) error:', e); }
      } else if (typeof (window as any).__onOutboundOrDeviceDisconnected === 'function') {
        // No inbound was active — this disconnect is from an outbound call; rotate off so agent isn't stuck BusyOnCall.
        try { (window as any).__onOutboundOrDeviceDisconnected(); } catch (e) { console.warn('Outbound disconnect fallback error:', e); }
      }
    });

    device.on("registering", () => {
      const registeringElapsed = Date.now() - initStartedAt;
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("📡 [WEBRTC DEBUG] DEVICE REGISTERING EVENT FIRED");
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("📋 [WEBRTC DEBUG] Registering event details:", {
        elapsedMs: registeringElapsed,
        state: (device as any)?.state,
        identity: device?.identity,
        timestamp: new Date().toISOString(),
      });
      debugLog("📡 [WEBRTC DEBUG] Registering with Twilio servers...");
      
      pushWebRtcDebug('device:event:registering', {
        elapsedMs: registeringElapsed,
        state: (device as any)?.state,
      });
      
      // Set a timeout to detect if registration is stuck (WebSocket failure)
      const registeringStartTime = Date.now();
      setTimeout(() => {
        const stuckDuration = Date.now() - registeringStartTime;
        if (device && device.state === 'registering') {
          console.error("═══════════════════════════════════════════════════════════════");
          console.error("⚠️ [WEBRTC DEBUG] DEVICE STUCK IN REGISTERING STATE");
          console.error("═══════════════════════════════════════════════════════════════");
          console.error('📋 [WEBRTC DEBUG] Stuck registration details:', {
            durationMs: stuckDuration,
            totalElapsedMs: Date.now() - initStartedAt,
            state: device.state,
            identity: device.identity,
            timestamp: new Date().toISOString(),
          });
          console.error('⚠️ [WEBRTC DEBUG] Device stuck in registering state for 15+ seconds - WebSocket may be blocked');
          console.error('💡 [WEBRTC DEBUG] Check: Firewall blocking WebSocket, VPN interfering, or network issues');
          console.error('📋 [WEBRTC DEBUG] Network diagnostics:', {
            onLine: navigator.onLine,
            connection: (navigator as any).connection ? {
              effectiveType: (navigator as any).connection.effectiveType,
              downlink: (navigator as any).connection.downlink,
              rtt: (navigator as any).connection.rtt,
            } : 'not available',
            hasWebSocket: typeof WebSocket !== 'undefined',
            userAgent: navigator.userAgent,
          });
          pushWebRtcDebug('device:registering-stuck', {
            elapsedMs: Date.now() - initStartedAt,
            state: device.state,
            stuckDurationMs: stuckDuration,
          });

          // Do NOT destroy the device on timeout — let it keep trying to register.
          // Destroying it causes a full re-boot cycle (20-40s) on the next dial.
          // Just log and let the SDK retry on its own.
          pushWebRtcDebug('device:register-timeout', {
            elapsedMs: Date.now() - initStartedAt,
            state: device.state,
          });
          console.warn('⚠️ [WEBRTC DEBUG] Register taking long — keeping device alive, SDK will retry');
        }
      }, 15000);
    });

    device.on("registered", () => {
      const registeredElapsed = Date.now() - initStartedAt;
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("✅ [WEBRTC DEBUG] DEVICE REGISTERED EVENT FIRED");
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("📋 [WEBRTC DEBUG] Registered event details:", {
        elapsedMs: registeredElapsed,
        state: (device as any)?.state,
        identity: device?.identity,
        timestamp: new Date().toISOString(),
      });
      debugLog("✅ [WEBRTC DEBUG] Successfully registered with Twilio servers (connect-ready)");
      debugLog("📋 [WEBRTC DEBUG] Current device state:", device?.state);
      debugLog("📋 [WEBRTC DEBUG] Microphone stream status:", {
        hasStream: !!activeMicrophoneStream,
        streamActive: activeMicrophoneStream?.active,
        streamTracks: activeMicrophoneStream?.getTracks().length,
      });
      
      pushWebRtcDebug('device:event:registered', {
        elapsedMs: registeredElapsed,
        state: (device as any)?.state,
      });

      // TaskRouter: if inbound Online toggle is on when device registers (or re-registers after token refresh),
      // re-assert voice-online so TaskRouter stays AvailableInbound and the worker is ready to receive calls.
      incomingCallHandlers?.onTaskRouterSync?.('device-registered');

      // BroadcastChannel: announce registration to other tabs; detect conflicts.
      try {
        const identity = device?.identity ?? (window as any).__webrtcAgentEmail ?? '';
        if (identity) {
          const ch = new BroadcastChannel(`twilio-device-${identity}`);
          ch.postMessage({ type: 'registered', ts: Date.now() });
          ch.onmessage = (ev: MessageEvent) => {
            if (ev.data?.type === 'registered') {
              incomingCallHandlers?.onDuplicateSession?.(true);
              ch.postMessage({ type: 'registered', ts: Date.now() }); // echo back so new tab also sees conflict
            } else if (ev.data?.type === 'unregistered') {
              incomingCallHandlers?.onDuplicateSession?.(false);
            }
          };
          (device as any).__conflictChannel = ch;
        }
      } catch (_) {}
    });

    device.on("unregistered", () => {
      debugLog("❌ Unregistered from Twilio servers");
      pushWebRtcDebug('device:event:unregistered', {
        elapsedMs: Date.now() - initStartedAt,
        state: (device as any)?.state,
      });
      // BroadcastChannel: tell other tabs this device unregistered (conflict cleared).
      try {
        const ch = (device as any).__conflictChannel;
        if (ch) { ch.postMessage({ type: 'unregistered', ts: Date.now() }); ch.close(); }
      } catch (_) {}
      incomingCallHandlers?.onDuplicateSession?.(false);
      // TaskRouter: only mark Worker Offline on unregistered if the inbound Online toggle is also OFF.
      // If the Online toggle is ON, this is a CCPRO power-cycle/token-refresh — do not go Offline, re-sync to Online instead.
      incomingCallHandlers?.onTaskRouterSync?.('device-unregistered');
      // Suppress toast if call just ended (expected unregistered state after call completion)
      if (callJustEndedRef.current) {
        debugLog('🔇 Suppressing unregistered toast - call just ended (expected behavior)');
        return;
      }
      // Auto-reconnect: if agent should be online, attempt re-registration after a short delay
      let reconnectAttempt = 0;
      const tryReconnect = () => {
        if (!device || device.state === 'registered' || device.state === 'destroyed') return;
        if (reconnectAttempt >= 5) {
          console.warn('[WEBRTC] Auto-reconnect gave up after 5 attempts');
          return;
        }
        reconnectAttempt++;
        const delayMs = Math.min(5000 * reconnectAttempt, 30000); // 5s, 10s, 15s, 20s, 25s
        debugLog(`🔄 Auto-reconnect attempt ${reconnectAttempt} in ${delayMs}ms`);
        setTimeout(() => {
          if (!device || device.state === 'registered' || device.state === 'destroyed') return;
          device.register().catch((err: any) => {
            console.warn('[WEBRTC] Auto-reconnect register() failed:', err?.message);
            tryReconnect();
          });
        }, delayMs);
      };
      tryReconnect();
    });

    device.on("offline", (error: any) => {
      console.error("❌ [WEBRTC DEBUG] DEVICE OFFLINE EVENT FIRED", {
        elapsedMs: Date.now() - initStartedAt,
        state: (device as any)?.state,
        code: error?.code,
        message: error?.message,
        twilioError: error,
      });
      pushWebRtcDebug('device:event:offline', {
        elapsedMs: Date.now() - initStartedAt,
        state: (device as any)?.state,
        code: error?.code,
        message: error?.message,
      });
      
      // Suppress toast if call just ended (expected offline state after call completion)
      if (callJustEndedRef.current) {
        debugLog('🔇 Suppressing offline toast - call just ended (expected behavior)');
        return;
      }
      
      // Only show toast for unexpected offline events (not right after call ends)
      toast({
        title: 'WebRTC Inactive',
        description: 'WebRTC connection lost. Please power on again if needed.',
        variant: 'destructive',
        duration: 3000
      });
    });

    device.on("cancel", () => {
      debugLog("🚫 Call was cancelled");
    });

    device.on("incoming", (conn: any) => {
      debugLog("📞 Incoming call received");
      console.log('[INBOUND-MODAL] Device "incoming" handler fired', { from: conn?.parameters?.From, hasConn: !!conn });
      (window as any).__lastIncomingConn = conn;
      // Queued inbound: show lead card right away, but do NOT auto-accept.
      // The agent must explicitly click Answer so the preview card + fuse behave like the demo flow.
      if ((window as any).__acceptIncomingFromQueue === true) {
        (window as any).__acceptIncomingFromQueue = false;
        const lead = incomingCallHandlers?.inboundCallLeadRef?.current ?? null;
        const setDialerForInbound = incomingCallHandlers?.setDialerState ?? (window as any).__setDialerState;
        if (lead && setDialerForInbound) {
          setDialerForInbound((prev: any) => ({
            ...prev,
            viewedLead: lead,
            currentCall: lead,
            dialingStatus: 'ringing',
          }));
        }
        debugLog('📞 Queued inbound armed for manual answer');
      }
      pushWebRtcDebug('device:event:incoming', {
        elapsedMs: Date.now() - initStartedAt,
        state: (device as any)?.state,
        callSid: conn?.parameters?.CallSid,
        from: conn?.parameters?.From,
        to: conn?.parameters?.To,
      });
      // Always try global setter first (avoids stale closure when device is reused)
      const setIncomingConn = incomingCallHandlers?.setIncomingConn ?? (window as any).__setIncomingConn;
      const setDialerState = incomingCallHandlers?.setDialerState;
      const answerRequestedRef = incomingCallHandlers?.answerRequestedRef;
      const acceptIssuedRef = incomingCallHandlers?.acceptIssuedRef;
      const shouldHandleInboundAccept = incomingCallHandlers?.shouldHandleInboundAccept;
      const onInboundAccepted = incomingCallHandlers?.onInboundAccepted;
      const onInboundDisconnected = incomingCallHandlers?.onInboundDisconnected;
      const onInboundCanceled = incomingCallHandlers?.onInboundCanceled;
      const hasGlobal = typeof (window as any).__setIncomingConn === 'function';
      console.log('[INBOUND-MODAL] __setIncomingConn present?', hasGlobal, 'setIncomingConn from handlers?', !!incomingCallHandlers?.setIncomingConn);
      (window as any).__setIncomingConn?.(conn);
      if (hasGlobal) console.log('[INBOUND-MODAL] __setIncomingConn(conn) called');
      // Attach handlers BEFORE accept() so we don't miss the accept event (it can fire before next tick)
      if (setIncomingConn) {
        const fireConnected = () => {
          if (shouldHandleInboundAccept && !shouldHandleInboundAccept()) return;
          incomingCallHandlers?.onTaskRouterSync?.('incoming-device-accept', 'busy');
          if (onInboundAccepted) {
            onInboundAccepted(conn);
            return;
          }
          (window as any).__setIncomingConn?.(null);
          setIncomingConn(null);
          if (setDialerState) {
            const to = (conn as any).parameters?.To;
            const callSid = (conn as any).parameters?.CallSid;
            const lead = incomingCallHandlers?.inboundCallLeadRef?.current ?? null;
            const connFromRaw = (conn as any).parameters?.From ?? '';
            const connFromLast10 = connFromRaw ? String(connFromRaw).replace(/\D/g, '').slice(-10) : '';
            const connFromIsDequeue = connFromLast10.length >= 10 && ['9142289324', '6096048379', '6095473687', '6096045352'].includes(connFromLast10);
            const connFrom = connFromIsDequeue ? '' : connFromRaw;
            setDialerState((prev: any) => {
              const rawFrom = lead?.phone ?? prev.inboundCallInfo?.from ?? connFrom ?? '';
              const from = (rawFrom && !(rawFrom.replace(/\D/g, '').slice(-10).length >= 10 && ['9142289324', '6096048379', '6095473687', '6096045352'].includes(rawFrom.replace(/\D/g, '').slice(-10)))) ? rawFrom : '';
              return {
                ...prev,
                dialingStatus: 'connected',
                isConnected: true,
                webRTCConferenceActive: true,
                inboundCallInfo: (from || to) ? { from, to: to ?? '', callSid: callSid ?? '' } : null,
                inboundCallLead: lead || prev.inboundCallLead || null,
                viewedLead: lead || prev.viewedLead || null,
                currentCall: lead || prev.currentCall || null,
              };
            });
          }
        };
        conn.on('accept', () => {
          inboundDebugLog('device accept (full path)', { hasHandler: !!onInboundAccepted, shouldHandle: !shouldHandleInboundAccept || shouldHandleInboundAccept() });
          fireConnected();
        });
        conn.on('disconnect', () => {
          inboundDebugLog('device disconnect (full path)', { hasFreezeHandler: !!onInboundDisconnected });
          try {
            if (onInboundDisconnected) {
              onInboundDisconnected();
              return;
            }
            (window as any).__setIncomingConn?.(null);
            setIncomingConn(null);
            if (setDialerState) {
              setDialerState((prev: any) => ({
                ...prev,
                webRTCConferenceActive: false,
                dialingStatus: 'idle',
                isConnected: false,
                inboundCallInfo: null,
                inboundCallLead: null,
              }));
            }
          } catch (e) {
            console.warn('Inbound disconnect handler error (ignored):', e);
          }
        });
        conn.on('cancel', () => {
          inboundDebugLog('device cancel (full path)', { hasFreezeHandler: !!onInboundCanceled });
          try {
            if (onInboundCanceled) {
              onInboundCanceled();
              return;
            }
            (window as any).__setIncomingConn?.(null);
            setIncomingConn(null);
          } catch (e) {
            console.warn('Inbound cancel handler error (ignored):', e);
          }
        });
        setIncomingConn(conn);
        // If agent already clicked Answer (TaskRouter dequeue), accept browser leg AFTER handlers are on (so we don't miss accept event)
        if (answerRequestedRef?.current && typeof conn.accept === 'function') {
          debugLog('📞 Incoming after Answer clicked – accepting browser leg (handlers already attached)');
          try {
            conn.accept();
            acceptIssuedRef && (acceptIssuedRef.current = true);
          } catch (e) {
            console.warn('Inbound immediate accept failed', e);
          }
        }
        // Fallback: only if we already requested Answer and connection is already open (accept fired before we attached)
        // Do NOT fire when connection first arrives (ringing) — RINGING is not connected; never set BusyOnCall here.
        const status = (conn as any).status ?? (conn as any).state;
        if ((status === 'open' || status === 'connected') && answerRequestedRef?.current) {
          inboundDebugLog('device already open (full path)', { status });
          fireConnected();
        }
      }
    });

    // 🍎 MAC-SPECIFIC: On Mac, handle microphone stream cleanup after device is ready
    if (isMac() && activeMicrophoneStream) {
      device.once('ready', () => {
        setTimeout(() => {
          debugLog('🍎 Mac: Device ready, stopping microphone stream');
          activeMicrophoneStream?.getTracks().forEach(track => track.stop());
          (window as any).__micStream = null;
          (window as any).__webrtcMicStream = null;
          (window as any).__macMicrophoneStream = null;
        }, 1000);
      });
    }
    
    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("🔍 [WEBRTC DEBUG] STEP 9: Registration with automatic retry");
    debugLog("═══════════════════════════════════════════════════════════════");
    
    // RETRY-BASED REGISTRATION: Automatically retry if stuck in registering
    let registered = false;
    let retryCount = 0;
    const maxRetries = 3;
    const REGISTER_TIMEOUT_MS = 12000; // Twilio signaling/register can take a few seconds on real networks; avoid false timeout failures.
    
    // Safe event listener removal helpers (Twilio Device may not have .off())
    const safeOff = (deviceObj: any, event?: string, handler?: (...args: any[]) => void) => {
      if (!deviceObj) return;
      
      // DEBUG: Log available methods before attempting cleanup
      debugLog("🔍 [WEBRTC DEBUG] about to safeOff()", {
        hasOff: typeof deviceObj.off === "function",
        hasRemoveListener: typeof deviceObj.removeListener === "function",
        hasRemoveAllListeners: typeof deviceObj.removeAllListeners === "function",
        deviceType: typeof deviceObj,
        deviceState: deviceObj?.state,
        event,
        hasHandler: !!handler,
      });
      
      try {
        if (event && handler) {
          // Remove specific handler
          if (typeof deviceObj.off === "function") {
            deviceObj.off(event, handler);
            return;
          }
          if (typeof deviceObj.removeListener === "function") {
            deviceObj.removeListener(event, handler);
            return;
          }
        } else {
          // Remove all listeners
          if (typeof deviceObj.removeAllListeners === "function") {
            deviceObj.removeAllListeners();
            return;
          }
          if (typeof deviceObj.off === "function") {
            deviceObj.off();
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ [WEBRTC DEBUG] Error removing event listener:', e);
      }
    };
    
    const safeRemoveAll = (deviceObj: any) => {
      if (!deviceObj) return;
      
      // DEBUG: Log available methods before attempting cleanup
      debugLog("🔍 [WEBRTC DEBUG] about to safeRemoveAll()", {
        hasOff: typeof deviceObj.off === "function",
        hasRemoveListener: typeof deviceObj.removeListener === "function",
        hasRemoveAllListeners: typeof deviceObj.removeAllListeners === "function",
        deviceType: typeof deviceObj,
        deviceState: deviceObj?.state,
        device: deviceObj,
      });
      
      try {
        if (typeof deviceObj.removeAllListeners === "function") {
          deviceObj.removeAllListeners();
        } else if (typeof deviceObj.off === "function") {
          deviceObj.off();
        }
      } catch (e) {
        console.warn('⚠️ [WEBRTC DEBUG] Error removing all listeners:', e);
      }
    };
    
    // Monitor WebSocket state helper
    const monitorWebSocketState = () => {
      try {
        const deviceInternal = (device as any);
        const signaling = deviceInternal?._signaling;
        const ws = signaling?._ws || signaling?.ws;
        if (ws) {
          const stateText = ws.readyState === 0 ? 'CONNECTING' : ws.readyState === 1 ? 'OPEN' : ws.readyState === 2 ? 'CLOSING' : 'CLOSED';
          debugLog('🔍 [WEBRTC DEBUG] Internal WebSocket state:', {
            readyState: ws.readyState,
            readyStateText: stateText,
            url: ws.url,
          });
          
          if (ws.readyState === WebSocket.CONNECTING) {
            debugLog('⏳ [WEBRTC DEBUG] WebSocket is CONNECTING - waiting for handshake...');
          } else if (ws.readyState === WebSocket.OPEN) {
            debugLog('✅ [WEBRTC DEBUG] WebSocket is OPEN - signaling connection established!');
          } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            console.error('❌ [WEBRTC DEBUG] WebSocket is CLOSED/CLOSING - connection failed!');
            console.error('📋 [WEBRTC DEBUG] This explains why device stays in "registering" state');
          }
        } else {
          console.warn('⚠️ [WEBRTC DEBUG] Could not access internal WebSocket - may not be created yet');
        }
      } catch (e) {
        console.warn('⚠️ [WEBRTC DEBUG] Could not inspect WebSocket state:', e);
      }
    };
    
    // Clean up device for retry
    const cleanupDevice = () => {
      try {
        if (device) {
          debugLog('🧹 [WEBRTC DEBUG] Cleaning up device for retry...');
          incomingCallHandlers?.onTaskRouterSync?.('device-cleanup-retry', 'offline');
          safeRemoveAll(device); // Remove all event listeners safely
          // Only unregister if device is actually registered (not registering)
          if (device.state === 'registered' || device.state === 'ready') {
            try {
              device.unregister();
            } catch (e) {
              console.warn('⚠️ [WEBRTC DEBUG] Error unregistering:', e);
            }
          } else if (device.state === 'registering') {
            // Device is still registering - just destroy it, don't try to unregister
            console.warn('⚠️ [WEBRTC DEBUG] Device still registering, skipping unregister');
          }
          try {
            withAllowedTwilioDeviceDestroy(() => device.destroy());
          } catch (e) {
            console.warn('⚠️ [WEBRTC DEBUG] Error destroying:', e);
          }
          if ((window as any).twilioDevice === device) {
            (window as any).twilioDevice = null;
          }
          device = null;
          debugLog('✅ [WEBRTC DEBUG] Device cleaned up');
        }
      } catch (cleanupError) {
        console.error('❌ [WEBRTC DEBUG] Error during cleanup:', cleanupError);
      }
    };

    const simpleRegisterFallback = async (): Promise<boolean> => {
      try {
        cleanupDevice();
        const fallbackEdge = SIGNALING_EDGES[SIGNALING_EDGES.length - 1];
        device = new TwilioDevice(token, {
          debug: true,
          enableRingingState: true,
          closeProtection: true,
          edge: fallbackEdge,
        });
        debugLog(`🔄 [WEBRTC DEBUG] Simple fallback using edge: ${fallbackEdge}`);
        guardTwilioDeviceDestroy(device);
        (window as any).twilioDevice = device;
        setupEventHandlers(maxRetries + 1);

        return await new Promise<boolean>((resolve) => {
          let resolved = false;
          const finish = (ok: boolean) => {
            if (resolved) return;
            resolved = true;
            resolve(ok);
          };

          const timeout = setTimeout(() => {
            finish(isDeviceConnectReady(device));
          }, 2500);

          const onReady = () => {
            clearTimeout(timeout);
            finish(true);
          };
          const onError = () => {
            clearTimeout(timeout);
            finish(false);
          };

          device.once?.('ready', onReady);
          device.once?.('registered', onReady);
          device.once?.('error', onError);

          try {
            device.register();
          } catch {
            clearTimeout(timeout);
            finish(false);
          }
        });
      } catch (error) {
        console.error('❌ [WEBRTC DEBUG] Simple register fallback failed:', error);
        return false;
      }
    };
    
    // Retry registration function
    const tryRegister = async (): Promise<boolean> => {
      retryCount++;
      registered = false; // Reset for this attempt
      debugLog(`═══════════════════════════════════════════════════════════════`);
      debugLog(`🔄 [WEBRTC DEBUG] Registration attempt #${retryCount}/${maxRetries}`);
      debugLog(`═══════════════════════════════════════════════════════════════`);
      
      // Clean up previous device if retrying
      if (retryCount > 1) {
        cleanupDevice();
        // CRITICAL: Wait a moment and ensure device is null before recreating
        await new Promise(resolve => setTimeout(resolve, 100));
        if (device) {
          console.error('❌ [WEBRTC DEBUG] Device still exists after cleanup!');
          return false;
        }
        // Recreate device for retry
        debugLog('🔄 [WEBRTC DEBUG] Recreating device for retry...');
        try {
          selectedEdge = SIGNALING_EDGES[Math.min(retryCount - 2, SIGNALING_EDGES.length - 1)];
          twilioDeviceOptions = buildTwilioDeviceOptions(selectedEdge);
          debugLog(`🌐 [WEBRTC DEBUG] Retry attempt #${retryCount} using Twilio edge: ${selectedEdge}`);
          device = new TwilioDevice(token, twilioDeviceOptions);
          guardTwilioDeviceDestroy(device);
          (window as any).twilioDevice = device;
          // Setup handlers for the new device
          setupEventHandlers(retryCount);
        } catch (createError) {
          console.error('❌ [WEBRTC DEBUG] Failed to recreate device:', createError);
          return false;
        }
      }
      
      // Guard against calling register() while already registering
      if (device.state === 'registering') {
        console.warn('⚠️ [WEBRTC DEBUG] Device already registering, skipping register() call');
        return false;
      }
      
      debugLog("📡 [WEBRTC DEBUG] Calling device.register()...");
      debugLog("📋 [WEBRTC DEBUG] Pre-register device state:", {
        state: device?.state,
        identity: device?.identity,
        timestamp: new Date().toISOString(),
      });
      
      const registerStartTime = Date.now();
      try {
        device.register();
        const registerCallDuration = Date.now() - registerStartTime;
        debugLog("✅ [WEBRTC DEBUG] device.register() called successfully in", registerCallDuration, "ms");
        
        // Monitor WebSocket state
        setTimeout(monitorWebSocketState, 100);
        setTimeout(monitorWebSocketState, 500);
        setTimeout(monitorWebSocketState, 1000);
        setTimeout(monitorWebSocketState, 3000);
        
        pushWebRtcDebug('powerOnWebRTC:register-called', {
          attempt: retryCount,
          elapsedMs: Date.now() - initStartedAt,
          state: (device as any)?.state,
        });
      } catch (registerError: any) {
        console.error("❌ [WEBRTC DEBUG] device.register() call failed:", registerError);
        pushWebRtcDebug('powerOnWebRTC:register-error', {
          attempt: retryCount,
          elapsedMs: Date.now() - initStartedAt,
          message: registerError?.message,
        });
        return false;
      }
      
      // Wait for registration with timeout
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          if (!registered && device && device.state === 'registering') {
            console.warn(`⚠️ [WEBRTC DEBUG] Registration attempt #${retryCount} timed out after ${REGISTER_TIMEOUT_MS}ms`);
            console.warn(`📋 [WEBRTC DEBUG] Device still in "registering" state - will retry if attempts remaining`);
            
            // Final WebSocket state check
            monitorWebSocketState();
            
            pushWebRtcDebug('device:register-timeout', {
              attempt: retryCount,
              elapsedMs: Date.now() - initStartedAt,
              state: device.state,
            });
            
            resolve(false);
          } else if (registered) {
            resolve(true);
          } else {
            resolve(false);
          }
        }, REGISTER_TIMEOUT_MS);
        
        // Clear timeout if registered
        const checkRegistered = () => {
          if (registered || device?.state === 'registered' || device?.state === 'ready') {
            clearTimeout(timeout);
            registered = true;
            resolve(true);
          }
        };
        
        device.once('registered', checkRegistered);
        device.once('ready', checkRegistered);
      });
    };
    
    // Setup event handlers that work for all attempts
    const setupEventHandlers = (attemptNum: number) => {
      if (!device) return;
      safeRemoveAll(device); // Remove any existing handlers first (safely)
      device.on("registered", () => {
        registered = true;
        debugLog(`✅ [WEBRTC DEBUG] Device registered successfully (attempt #${attemptNum})!`);
        // Power on = Call Connector Pro (outbound). Inbound = Online/Offline toggle (TaskRouter) only.
      });
      device.on("ready", () => {
        registered = true;
        debugLog(`✅ [WEBRTC DEBUG] Device ready (attempt #${attemptNum})!`);
      });
      device.on("error", (err: any) => {
        console.error(`❌ [WEBRTC DEBUG] Device error (attempt #${attemptNum}):`, err);
      });
      device.on("offline", (err: any) => {
        console.error(`❌ [WEBRTC DEBUG] Device offline (attempt #${attemptNum}):`, err);
      });
      device.on("registering", () => {
        debugLog(`📡 [WEBRTC DEBUG] Device registering (attempt #${attemptNum})...`);
      });
      device.on("disconnect", () => {
        // Call ended; Online/Offline is controlled by the inbound toggle only.
      });
    };
    
    // Setup handlers for first attempt
    setupEventHandlers(1);
    
    // Start registration attempts with Twilio edge failover.
    let success = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      success = await tryRegister();
      if (success) {
        debugLog(`✅ [WEBRTC DEBUG] Registration succeeded on attempt #${attempt}`);
        break;
      } else if (attempt < maxRetries) {
        // One fast retry: refresh token and try again quickly.
        const refreshedToken = await fetchFreshTwilioToken();
        if (refreshedToken) {
          token = refreshedToken;
          pushWebRtcDebug('powerOnWebRTC:token-refreshed-for-retry', { attempt });
          debugLog('🔄 [WEBRTC DEBUG] Refreshed Twilio token for retry attempt');
        } else {
          pushWebRtcDebug('powerOnWebRTC:token-refresh-failed', { attempt });
          console.warn('⚠️ [WEBRTC DEBUG] Token refresh failed before retry attempt');
        }
        const backoffMs = 500;
        debugLog(`⏳ [WEBRTC DEBUG] Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    if (!success) {
      console.error("❌ [WEBRTC DEBUG] Registration failed after", maxRetries, "attempts");
      console.error("❌ [WEBRTC] Cause: WebSocket to Twilio never connected (closed before established). Check: firewall/VPN blocking wss://, or try another network.");
      pushWebRtcDebug('powerOnWebRTC:max-retries-reached', {
        elapsedMs: Date.now() - initStartedAt,
        retryCount,
      });
      const fallbackSuccess = await simpleRegisterFallback();
      if (!fallbackSuccess) {
        setLastWebRtcFailure('register_timeout', 'Device stayed in registering state after retries');
        cleanupDevice();
        powerOnWebRtcInProgress = false;
        return false;
      }
    }
    
    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("✅ [WEBRTC DEBUG] Registration complete - device is ready");
    debugLog("═══════════════════════════════════════════════════════════════");
    pushWebRtcDebug('powerOnWebRTC:success', {
      elapsedMs: Date.now() - initStartedAt,
      finalState: (device as any)?.state,
      retryCount,
    });
    
    powerOnWebRtcInProgress = false;
    return true;
  } catch (err: any) {
    console.error("❌ powerOnWebRTC failed:", err);
    const message = String(err?.message || err || '');
    if (!getLastWebRtcFailure()) {
      if (message.toLowerCase().includes('token fetch failed')) {
        setLastWebRtcFailure('token_fetch', message);
      } else {
        setLastWebRtcFailure('unknown', message || 'Unknown powerOnWebRTC failure');
      }
    }
    pushWebRtcDebug('powerOnWebRTC:failure', {
      elapsedMs: Date.now() - initStartedAt,
      message: err?.message,
      stack: err?.stack,
    });
    return false;
  } finally {
    powerOnWebRtcInProgress = false;
    pushWebRtcDebug('powerOnWebRTC:finished', {
      powerOnTraceId,
      elapsedMs: Date.now() - initStartedAt,
      hasDevice: !!(window as any).twilioDevice,
      state: (window as any).twilioDevice?.state,
    });
  }
};

// Function will be defined inside component to access state

// Import Call Connector Pro components
import { DialerState, Lead, CallDisposition } from './types';
import type { PlanOption, SubscriptionPlan } from './types';
import LeadDisplay from './LeadDisplay';
import CallControls from './CallControls';
import { InboundCallHeaderPanel, type InboundPanelState } from './InboundCallHeaderPanel';
// DISABLED: import NewLeadsNotification from './NewLeadsNotification';
import CallTrackers from './CallTrackers';
import { LocalPresenceDisplay } from './LocalPresenceDisplay';
import { TrialWelcomeModal } from './TrialWelcomeModal';

import { AppointmentManager } from '../appointments/AppointmentManager';
import CampaignManager from '../campaign-manager/CampaignManager';

import SimpleDialerTest from '../test/SimpleDialerTest';

// Import AOIntel components
import { ClipboardList, AlertCircle, ArrowRight, ChevronDown } from 'lucide-react';

const DEMO_USER_ID = 1;

type PlanDisplayKey = 'intro' | 'professional';

const PLAN_BADGE_LABELS: Record<PlanDisplayKey, string> = {
  intro: 'Starter (Inbound Only)',
  professional: 'Professional',
};

const PLAN_BADGE_STYLES: Record<PlanDisplayKey, string> = {
  intro: 'border border-white/40 bg-white/15 text-white/90',
  professional: 'border border-blue-300/60 bg-blue-500/25 text-blue-50',
};

const resolvePlanKey = (plan?: string | null, hasActiveSubscription?: boolean): PlanDisplayKey => {
  if (hasActiveSubscription && plan === 'professional') {
    return 'professional';
  }
  return 'intro';
};

// ── Draggable Whereby panel ────────────────────────────────────────────────────
function DraggableWherebyPanel({ roomUrl, displayName, onClose }: { roomUrl: string; displayName: string; onClose: () => void }) {
  const [pos, setPos] = React.useState({ x: window.innerWidth - 376, y: 60 });
  const dragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: 360, height: 280,
      zIndex: 100100, borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)',
      background: '#020617', resize: 'both',
    }}>
      <div
        onMouseDown={onMouseDown}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px',
          background:'rgba(30,41,59,0.98)', borderBottom:'1px solid rgba(255,255,255,0.1)', cursor:'grab' }}
      >
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600, userSelect:'none' }}>📹 Video — drag to move</span>
        <button type="button" onClick={onClose}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:16, padding:'0 4px', lineHeight:1 }}>✕</button>
      </div>
      <iframe
        title="Whereby — agent video"
        src={`${roomUrl}?background=off&displayName=${encodeURIComponent(displayName)}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ width:'100%', height:'calc(100% - 30px)', border:'none', display:'block' }}
      />
    </div>
  );
}

export interface OutboundDialerInterfaceProps {
  /** When "aorecruit", worker market is set to aorecruit for TaskRouter and recent connects show only aorecruit. Used on AO Recruit page. */
  marketContext?: 'aorecruit' | null;
}

export function OutboundDialerInterface({ marketContext }: OutboundDialerInterfaceProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const { updateActivity } = useCallConnectorActivity();
  const { isDemoMode, demoProduct, exitDemoMode } = useDemo();
  const isCCPDemo = isDemoMode && demoProduct === 'callconnector';
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const isLeaseDialerRoute =
    currentPath.includes('/dashboard/connect/leasedialer') ||
    currentPath === '/dashboard/connect' ||
    currentPath === '/connect';
  const localQueueWindowSize = 100;

  // ── AOI Command Diagnostics & Startup Sequence ──
  const [startupComplete, setStartupComplete] = useState(false);
  // Send health reports immediately — don't gate on startup so Electron users show up in AOI Command
  const { diagnostics } = useAgentDiagnostics(authState?.user?.email?.toLowerCase());
  const shownFirewallToast = React.useRef(false);
  React.useEffect(() => {
    if (diagnostics?.wsConnectivity !== 'blocked' || shownFirewallToast.current) return;
    shownFirewallToast.current = true;
    const isElectron = !!(window as any).electronAPI?.isDesktopApp;
    toast({
      title: '🚫 WebSocket blocked — calls may not work',
      description: isElectron
        ? 'Windows Firewall may be blocking AO Intelligence. Click "Fix" to open Firewall settings and allow access.'
        : 'A firewall or VPN is blocking Twilio voice WebSocket. Contact IT to allow WSS traffic to chunderw-vpc-gll.twilio.com.',
      duration: 0, // persistent until dismissed
      action: isElectron ? (
        <button
          onClick={() => (window as any).electronAPI?.openFirewallSettings?.()}
          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded font-semibold"
        >
          Fix Firewall
        </button>
      ) : undefined,
    } as any);
  }, [diagnostics?.wsConnectivity, toast]);

  const startOnlineByDefault = React.useMemo(() => {
    // Authenticated agents are auto-signed into WebRTC on page load. Power On/Off is cosmetic (TaskRouter/UI only).
    return true;
  }, []);
  const [status, setStatus] = useState('Not Connected');
  const [isPoweredOnRaw, setIsPoweredOnRaw] = useState(true);
  const isPoweredOn = true;
  const setIsPoweredOn = React.useCallback((v: boolean) => { if (v) setIsPoweredOnRaw(true); }, []);
  const [duplicateSession, setDuplicateSession] = useState(false);
  const [showPowerTooltip, setShowPowerTooltip] = useState(false);
  const [incomingConn, setIncomingConn] = useState<any>(null);
  const [answering, setAnswering] = useState(false);
  const [inboundCallAccepted, setInboundCallAccepted] = useState(false);
  /** True after Accept clicked (TaskRouter path) until browser leg is actually connected */
  const [inboundConnecting, setInboundConnecting] = useState(false);
  // Inbound modal: draggable position (offset from center)
  const [inboundModalDrag, setInboundModalDrag] = useState({ x: 0, y: 0 });
  const [inboundModalDragging, setInboundModalDragging] = useState(false);
  const inboundModalDragStart = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const [incomingCallLead, setIncomingCallLead] = useState<Lead | null>(null);
  const [incomingRingStartedAt, setIncomingRingStartedAt] = useState<number | null>(null);
  const [inboundConnectionType, setInboundConnectionType] = useState<'gold' | 'diamond' | 'recruit'>('diamond');
  const [inboundCharge, setInboundCharge] = useState<number>(8);
  const inboundCallLeadRef = React.useRef<Lead | null>(null);
  const inboundAnswerRequestedRef = React.useRef<boolean>(false);
  const browserLegAcceptIssuedRef = React.useRef<boolean>(false);
  /** Caller SID from task when we clicked Answer (so poll can detect end even while still "connecting") */
  const inboundCallSidForPollRef = React.useRef<string | null>(null);
  /** Agent connection SID when connected (server may push this leg when call ends) */
  const inboundAgentConnCallSidRef = React.useRef<string | null>(null);
  /** Active inbound connection so we can detect closed state when disconnect event never fires */
  const inboundConnRef = React.useRef<any>(null);
  const lastIncomingFingerprintRef = React.useRef<string | null>(null);
  // When true, next "incoming" is from our queue (we already set lead card); auto-accept and use same CCP flow
  const acceptIncomingFromQueueRef = React.useRef<boolean>(false);
  const [inboundQueuePosition, setInboundQueuePosition] = useState(0);
  /** Eligible inbound queue size from Supabase-backed /eligible-for-inbound (for PositionTracker total). */
  const [inboundQueueTotalEligible, setInboundQueueTotalEligible] = useState(0);
  /** TaskRouter: pending reservation offered to this agent (from assignment callback). Cleared on accept/reject. */
  const [taskRouterPending, setTaskRouterPending] = useState<{ taskSid: string; reservationSid: string; taskAttributes: string; createdAt?: number } | null>(null);
  const taskRouterPendingRef = React.useRef(taskRouterPending);
  /** Keep the last reservation snapshot during ringing so the lead card and fuse don't disappear if polling briefly misses a row. */
  const [retainedTaskRouterPending, setRetainedTaskRouterPending] = useState<{ taskSid: string; reservationSid: string; taskAttributes: string; createdAt?: number } | null>(null);
  const retainedTaskRouterPendingRef = React.useRef(retainedTaskRouterPending);
  /** Last taskSid/reservationSid we ever saw for this agent — so Accept always has something to send even if poll cleared state. */
  const lastPendingSidsRef = React.useRef<{ taskSid: string; reservationSid: string } | null>(null);
  /** Agent email for inbound: so we can accept incoming even when browser leg arrives before pending poll (race). */
  const agentEmailForInboundRef = React.useRef<string | null>(null);
  /** When we last polled /pending (so UI can show "polling" is active). */
  const [lastPendingPollAt, setLastPendingPollAt] = useState<number | null>(null);
  /** When call ended (client/agent hangup); panel shows "Wrapping" with countdown. */
  const [inboundCallEndedAt, setInboundCallEndedAt] = useState<number | null>(null);
  /** Dequeue/trunk numbers — never show these as caller on inbound preview (task attributes hold real lead phone). */
  const DEQUEUE_CALLER_LAST10 = new Set(['9142289324', '6096048379', '6095473687', '6096045352']);
  const isDequeueCallerId = (phone: string | null | undefined): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    const last10 = phone.replace(/\D/g, '').slice(-10);
    return last10.length >= 10 && DEQUEUE_CALLER_LAST10.has(last10);
  };
  /** Timestamp when wrap period ends (call ended + 30s); after this we reset panel and set agent online. */
  const [inboundWrapEndsAt, setInboundWrapEndsAt] = useState<number | null>(null);
  /** Seconds left in wrap (for countdown display); updated every second. */
  const [wrapSecondsLeft, setWrapSecondsLeft] = useState<number>(0);
  /** True only when an answered inbound call ended and still needs disposition before reset. */
  const [inboundDispositionRequired, setInboundDispositionRequired] = useState<boolean>(false);
  const lastConsumedBonusCallSidRef = React.useRef<string | null>(null);
  /** Prevent duplicate end-of-call signals from restarting the 30s wrap window forever. */
  const inboundWrapActiveRef = React.useRef<boolean>(false);
  const inboundCallEndedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapTimerRef = React.useRef<{ timeout: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> } | null>(null);
  const [tick, setTick] = useState(0);
  const [demoInjecting, setDemoInjecting] = useState(false);
  const successViewerRefetchRef = React.useRef<(() => void) | null>(null);
  /** Inbound ringer muted (persisted in localStorage); when true, Device uses sounds.incoming = '' and audio.incoming(false). */
  const [inboundRingerMuted, setInboundRingerMuted] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('inbound_ringer_muted') === 'true'
  );
  const handleRingerMuteToggle = React.useCallback((muted: boolean) => {
    setInboundRingerMuted(muted);
    if (typeof localStorage !== 'undefined') localStorage.setItem('inbound_ringer_muted', muted ? 'true' : 'false');
    const dev = (window as any).twilioDevice;
    if (dev?.audio?.incoming) dev.audio.incoming(!muted);
  }, []);
  const getIncomingFingerprint = React.useCallback((conn: any): string => {
    const params = conn?.parameters || conn?.customParameters || {};
    const callSid = params.CallSid ?? params.call_sid ?? conn?.CallSid ?? '';
    const from = params.From ?? params.from ?? conn?.from ?? '';
    const to = params.To ?? params.to ?? conn?.to ?? '';
    return `${callSid}|${from}|${to}`;
  }, []);

  const queueIncomingConn = React.useCallback((conn: any, source: string) => {
    if (!conn) return;
    // Authorized if we have a pending offer, already clicked Accept, or we're on Connect with an agent email (incoming is for this client identity)
    const hasAuthorizedInboundOffer = !!(
      taskRouterPendingRef.current ||
      retainedTaskRouterPendingRef.current ||
      inboundAnswerRequestedRef.current ||
      (agentEmailForInboundRef.current && agentEmailForInboundRef.current.includes('@'))
    );
    if (!isPoweredOn || !hasAuthorizedInboundOffer) {
      console.log('[INBOUND-MODAL] incoming rejected without active TaskRouter offer', {
        source,
        isPoweredOn,
        hasAuthorizedInboundOffer,
      });
      try {
        if (typeof conn.reject === 'function') conn.reject();
      } catch (rejectErr) {
        console.warn('[INBOUND-MODAL] failed to reject stray incoming connection', rejectErr);
      }
      return;
    }
    const fp = getIncomingFingerprint(conn);
    if (fp && lastIncomingFingerprintRef.current === fp) {
      console.log('[INBOUND-MODAL] duplicate incoming ignored', { source, fp });
      return;
    }
    lastIncomingFingerprintRef.current = fp || `unknown-${Date.now()}`;
    setIncomingConn(conn);
    console.log('[INBOUND-MODAL] incoming connection queued', { source, fp });
    // If user already clicked Accept, accept the browser leg immediately so caller is bridged (no wait for useEffect).
    if (inboundAnswerRequestedRef.current && typeof (conn as any).accept === 'function' && !browserLegAcceptIssuedRef.current) {
      browserLegAcceptIssuedRef.current = true;
      try {
        const result = (conn as any).accept();
        console.log('[INBOUND] Immediate accept: browser leg accepted (caller should connect now)');
        debugLog('📞 Incoming after Answer clicked – accepting browser leg immediately (queueIncomingConn)');
        if (result && typeof result.then === 'function') {
          result.catch((err: unknown) => {
            browserLegAcceptIssuedRef.current = false;
            console.warn('Inbound browser-leg accept failed (queueIncomingConn)', err);
          });
        }
      } catch (err) {
        browserLegAcceptIssuedRef.current = false;
        console.warn('Inbound browser-leg accept failed (queueIncomingConn)', err);
      }
    }
    // Refs used inside (taskRouterPendingRef, retainedTaskRouterPendingRef, isPoweredOnRef) — stable, no re-create on poll updates
}, [getIncomingFingerprint, inboundAnswerRequestedRef]);

  useEffect(() => {
    if (lastPendingPollAt == null) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [lastPendingPollAt]);

  // NOTE: aoi-present-open listener moved below wherebyRoom useState declaration

  // Global ref so Device "incoming" updates state (header panel + main card; no popup modal)
  useEffect(() => {
    (window as any).__setIncomingConn = (conn: any) => queueIncomingConn(conn, '__setIncomingConn');

    // CRITICAL: Patch whatever device is in window.twilioDevice so WE get incoming (debug showed nothing = handler was on wrong/nonexistent device)
    const patchedDevices = new WeakSet<object>();
    const patchDevice = (dev: any) => {
      if (!dev || typeof dev.on !== 'function' || patchedDevices.has(dev)) return;
      patchedDevices.add(dev);
      console.log('[INBOUND-MODAL] Patching device for incoming:', dev?.state, dev?.identity);
      dev.on('incoming', (conn: any) => {
        console.log('[INBOUND-MODAL] PATCHED handler fired — incoming call', { from: conn?.parameters?.From });
        (window as any).__lastIncomingConn = conn;
        (window as any).__setIncomingConn?.(conn);
      });
    };
    const interval = setInterval(() => {
      const dev = (window as any).twilioDevice;
      if (dev) patchDevice(dev);
    }, 1500);
    patchDevice((window as any).twilioDevice);

    return () => {
      clearInterval(interval);
      delete (window as any).__setIncomingConn;
      console.log('[INBOUND-MODAL] Listener removed on unmount');
    };
  }, [queueIncomingConn]);

  // When incomingConn clears: only reset accepted/refs when we're sure we're not post-answer.
  // After answer, freeze() sets incomingConn=null and webRTCConferenceActive=true; ref can lag so don't clear when lead/answer is present.
  useEffect(() => {
    if (!incomingConn) {
      const webRTC = dialerStateRef.current.webRTCConferenceActive;
      const hasLeadRef = !!inboundCallLeadRef.current;
      const answerRequested = inboundAnswerRequestedRef.current;
      const postAnswerOrRinging = webRTC || hasLeadRef || answerRequested;
      inboundDebugLog('incomingConn effect: conn=null', { webRTC, hasLeadRef, answerRequested, postAnswerOrRinging, willClear: !postAnswerOrRinging });
      if (!postAnswerOrRinging) {
        setInboundCallAccepted(false);
        setRetainedTaskRouterPending(null);
        setIncomingRingStartedAt(null);
        inboundAnswerRequestedRef.current = false;
        browserLegAcceptIssuedRef.current = false;
        lastIncomingFingerprintRef.current = null;
      }
      setInboundModalDrag({ x: 0, y: 0 });
    }
  }, [incomingConn]);

  useEffect(() => {
    if (!incomingConn) return;
    if (!inboundAnswerRequestedRef.current) return;
    if (browserLegAcceptIssuedRef.current) return;
    const acceptFn = (incomingConn as any).accept;
    if (typeof acceptFn !== 'function') return;
    browserLegAcceptIssuedRef.current = true;
    debugLog('📞 Accepting browser leg only because Answer button requested it');
    try {
      const result = acceptFn.call(incomingConn);
      if (result && typeof result.then === 'function') {
        result.catch((acceptErr: unknown) => {
          browserLegAcceptIssuedRef.current = false;
          console.warn('Inbound browser-leg accept failed', acceptErr);
        });
      }
    } catch (acceptErr) {
      browserLegAcceptIssuedRef.current = false;
      console.warn('Inbound browser-leg accept failed', acceptErr);
    }
  }, [incomingConn, taskRouterPending, retainedTaskRouterPending]);

  // Inbound modal: global pointer move/up for dragging
  useEffect(() => {
    if (!inboundModalDragging) return;
    const onMove = (e: PointerEvent) => {
      setInboundModalDrag((prev) => ({
        x: prev.x + e.clientX - inboundModalDragStart.current.startX,
        y: prev.y + e.clientY - inboundModalDragStart.current.startY
      }));
      inboundModalDragStart.current.startX = e.clientX;
      inboundModalDragStart.current.startY = e.clientY;
    };
    const onUp = () => setInboundModalDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [inboundModalDragging]);

  // When an inbound call arrives, look up lead in masterlead by caller phone
  useEffect(() => {
    if (!incomingConn) {
      const postAnswer = dialerStateRef.current.webRTCConferenceActive || !!inboundCallLeadRef.current || inboundAnswerRequestedRef.current;
      inboundDebugLog('lead-by-phone effect: no conn', { postAnswer, willClearLead: !postAnswer });
      if (!postAnswer) {
        setIncomingCallLead(null);
        inboundCallLeadRef.current = null;
      }
      return;
    }
    const hasActivePending = !!(taskRouterPending || retainedTaskRouterPending);
    const params = (incomingConn as any).parameters || (incomingConn as any).customParameters || {};
    const from = params.From ?? params.from ?? (incomingConn as any).from;
    const to = params.To ?? params.to ?? (incomingConn as any).to ?? '';
    const callSid = params.CallSid ?? params.call_sid ?? (incomingConn as any).CallSid ?? '';
    // Prefer phone_number from task attributes — it holds the actual lead phone.
    // params.From on the browser/dequeue leg is the Taalk transfer number, not the lead.
    const activePending = taskRouterPending || retainedTaskRouterPending;
    let taskLeadPhone = '';
    if (activePending?.taskAttributes) {
      try {
        const ta = typeof activePending.taskAttributes === 'string' ? JSON.parse(activePending.taskAttributes) : activePending.taskAttributes;
        taskLeadPhone = String(ta?.phone_number ?? ta?.phone ?? '').trim();
      } catch (_) {}
    }
    // Parse all available task attributes up front for immediate preview
    let taLeadPhone = taskLeadPhone;
    let taLeadName = '';
    let taLeadId = '';
    let taMarket = '';
    let taState = '';
    let taConnectionType: 'gold' | 'diamond' | 'recruit' = 'diamond';
    let taCharge = 8;
    if (activePending?.taskAttributes) {
      try {
        const ta = typeof activePending.taskAttributes === 'string' ? JSON.parse(activePending.taskAttributes) : activePending.taskAttributes;
        taLeadPhone = String(ta?.phone_number ?? ta?.phone ?? taLeadPhone ?? '').trim();
        taLeadName = String(ta?.lead_name ?? ta?.name ?? '').trim();
        taLeadId = String(ta?.lead_id ?? ta?.taalk_lead_id ?? '').trim();
        taMarket = String(ta?.market ?? '').trim();
        taState = String(ta?.state ?? '').trim();
        if (ta?.connection_type === 'gold') taConnectionType = 'gold';
        else if (ta?.connection_type === 'recruit') taConnectionType = 'recruit';
        if (typeof ta?.charge === 'number' && ta.charge > 0) taCharge = ta.charge;
      } catch (_) {}
    }
    // Apply connection type/charge from task attributes whenever present so panel shows correct Gold/Diamond/Recruit even when preview lead is not set
    if (activePending?.taskAttributes) {
      setInboundConnectionType(taConnectionType);
      setInboundCharge(taCharge);
    }
    // 609 inbound: caller data comes from TaskRouter task attributes only (phone_number, lead_name, etc.). Never use connection From — that's the dequeue/trunk (914).
    let phone = taLeadPhone;
    if (!phone && typeof from === 'string') {
      const f = from.trim();
      if (!/^client:/i.test(f) && !isDequeueCallerId(f)) phone = f;
    }
    if (!phone) {
      console.warn('[INBOUND] No From phone on connection', { params, conn: incomingConn });
      if (hasActivePending || inboundAnswerRequestedRef.current) {
        setDialerState((prev: any) => ({
          ...prev,
          // Don't touch dialingStatus or campaignActive — inbound ringing must not block outbound
          inboundCallInfo: callSid || to ? { from: '', to, callSid } : prev.inboundCallInfo,
        }));
      }
      return;
    }
    setIncomingRingStartedAt((prev) => prev ?? Date.now());
    if (hasActivePending || inboundAnswerRequestedRef.current) {
      setDialerState((prev: any) => ({
        ...prev,
        // Don't touch dialingStatus or campaignActive — inbound ringing must not block outbound
        inboundCallInfo: { from: phone, to, callSid },
      }));
    }

    // Set an immediate preview lead from task attributes so the panel is correct before lead-by-phone returns.
    // This prevents showing "Call from +19142289324" (Taalk number) during ringing.
    if (taLeadPhone && !inboundCallLeadRef.current) {
      const previewLead: Lead = {
        id: taLeadId || callSid || taLeadPhone,
        leadId: taLeadId || callSid || taLeadPhone,
        name: taLeadName || taLeadPhone,
        phone: taLeadPhone,
        state: taState,
        market: taMarket || 'Inbound',
        taalk_market: taMarket || 'Inbound',
        status: '',
        timestamp: new Date().toISOString(),
      } as Lead;
      setIncomingCallLead(previewLead);
      inboundCallLeadRef.current = previewLead;
      setDialerState((prev: any) => ({ ...prev, inboundCallLead: previewLead }));
      setInboundConnectionType(taConnectionType);
      setInboundCharge(taCharge);
    }

    const userEmail = authState?.user?.email ?? '';
    const url = `/api/outbound-dialer/lead-by-phone?phone=${encodeURIComponent(phone)}&userEmail=${encodeURIComponent(userEmail)}`;
    apiRequest("GET", url, undefined, userEmail || undefined)
      .then((r) => r.json())
      .then((data: { success?: boolean; lead?: any }) => {
        if (data?.lead) {
          const lead = { ...data.lead, status: '', timestamp: new Date().toISOString() } as Lead;
          setIncomingCallLead(lead);
          inboundCallLeadRef.current = lead;
          setDialerState((prev: any) => ({
            ...prev,
            inboundCallLead: lead,
          }));
        } else {
          console.warn('[INBOUND] lead-by-phone returned no lead for phone', phone);
          // Only overwrite if we don't already have a task-attributes preview
          if (!inboundCallLeadRef.current || inboundCallLeadRef.current.id === (callSid || phone)) {
            const fallbackLead: Lead = {
              id: callSid || phone,
              leadId: callSid || phone,
              name: taLeadName || phone,
              phone,
              state: taState,
              market: taMarket || 'Inbound',
              taalk_market: taMarket || 'Inbound',
              status: '',
              timestamp: new Date().toISOString(),
            } as Lead;
            setIncomingCallLead(fallbackLead);
            inboundCallLeadRef.current = fallbackLead;
          }
        }
      })
      .catch((e) => {
        console.warn('[INBOUND] lead-by-phone fetch failed', e);
        if (!inboundCallLeadRef.current || inboundCallLeadRef.current.id === (callSid || phone)) {
          const fallbackLead: Lead = {
            id: callSid || phone,
            leadId: callSid || phone,
            name: taLeadName || phone,
            phone,
            state: taState,
            market: taMarket || 'Inbound',
            taalk_market: taMarket || 'Inbound',
            status: '',
            timestamp: new Date().toISOString(),
          } as Lead;
          setIncomingCallLead(fallbackLead);
          inboundCallLeadRef.current = fallbackLead;
        }
      });
  }, [incomingConn, authState?.user?.email, taskRouterPending, retainedTaskRouterPending]);

  // Auto-show tooltip when powered off, then auto-dismiss after 4 seconds
  useEffect(() => {
    if (!isPoweredOn) {
      setShowPowerTooltip(true);
      const timer = setTimeout(() => {
        setShowPowerTooltip(false);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setShowPowerTooltip(false);
    }
  }, [isPoweredOn]);

  useEffect(() => {
    window.__dumpWebrtcDebug = (count = 200) => {
      const log = window.__webrtcDebugLog || [];
      return log.slice(-count);
    };
    return () => {
      delete window.__dumpWebrtcDebug;
    };
  }, []);
  
  // VDP integration state
  const [vdpData, setVdpData] = useState<VDPData | null>(null);
  const [vdpScriptLoaded, setVdpScriptLoaded] = useState(false);
  const [vdpOnline, setVdpOnline] = useState<boolean>(startOnlineByDefault);
  /** "Away" is a UI-only sub-state of Offline — agent is offline but shown as Away in the pill. */
  const [agentAwayMode, setAgentAwayMode] = useState(false);
  /** Ref populated by VDPStatus so InboundCallHeaderPanel can trigger the full toggle (with disclaimer/mic checks). */
  const vdpToggleRef = React.useRef<((online: boolean) => Promise<void>) | null>(null);
  const [queueMode, setQueueMode] = useState<'standard' | 'hotlead'>('hotlead'); // Single control: Online/Offline in VDP panel (no separate Standard/Hot Lead toggle)
  /** Double dial: first Complete = redial same lead, second Complete = dial next. */
  const [doubleDialMode, setDoubleDialMode] = useState(false);
  /** When double dial is on: true = next Complete will redial; false = will dial next. */
  const [doubleDialNextIsRedial, setDoubleDialNextIsRedial] = useState(true);
  const [completeCallCooldownSeconds, setCompleteCallCooldownSeconds] = useState(0);
  const completeCallCooldownTimerRef = React.useRef<number | null>(null);
  const outboundCallStartTimeoutMs = Number((import.meta as any).env?.VITE_OUTBOUND_CALL_START_TIMEOUT_MS || 15_000);

  // ── Appointment Booking Modal ──────────────────────────────────────────────
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingDispositionSource, setBookingDispositionSource] = useState<'booked' | 'instant_presentation'>('booked');
  const [bookingLead, setBookingLead] = useState<BookingLeadInfo | null>(null);
  const [bookingAgentInfo, setBookingAgentInfo] = useState<BookingAgentInfo | null>(null);
  const lastCalendarAutoOpenKeyRef = React.useRef<string | null>(null);

  const openAppointmentBookingForLead = React.useCallback((leadForBooking: any, dispositionSource: 'booked' | 'instant_presentation' | 'callback') => {
    if (!leadForBooking || !authState?.user?.email) return;
    const agentEmail = authState.user.email;
    const agentName =
      (authState.user as any)?.name ||
      (authState.user as any)?.user_metadata?.full_name ||
      agentEmail.split('@')[0] ||
      '';
    const leadName =
      leadForBooking.name ||
      `${leadForBooking.first_name || ''} ${leadForBooking.last_name || ''}`.trim() ||
      'Unknown';
    window.dispatchEvent(new CustomEvent('aoirail-open-calendar', {
      detail: {
        leadId: leadForBooking.taalk_lead_id ?? leadForBooking.leadId ?? leadForBooking.id,
        leadName,
        leadPhone: leadForBooking.phone ?? '',
        leadMarket: leadForBooking.taalk_market ?? leadForBooking.market ?? '',
        leadState: leadForBooking.taalk_state ?? leadForBooking.state ?? '',
        leadCity: leadForBooking.city ?? leadForBooking.taalk_city ?? '',
        dispositionSource,
      },
    }));
  }, [authState?.user]);

  const maybeOpenCalendarForDisposition = React.useCallback((leadForBooking: any, rawDisposition: string | null | undefined) => {
    if (!leadForBooking) return false;
    const normalized = String(rawDisposition || '').toLowerCase().trim();
    const canonicalDisposition = normalized === 'callback' ? 'call_back' : normalized;
    if (canonicalDisposition !== 'booked') return false;

    const source: 'booked' = 'booked';

    const leadKey = String(
      leadForBooking.taalk_lead_id ??
      leadForBooking.leadId ??
      leadForBooking.id ??
      leadForBooking.phone ??
      leadForBooking.name ??
      'unknown'
    );
    const dedupeKey = `${source}:${leadKey}`;
    if (lastCalendarAutoOpenKeyRef.current === dedupeKey) return false;
    lastCalendarAutoOpenKeyRef.current = dedupeKey;
    openAppointmentBookingForLead(leadForBooking, source);
    return true;
  }, [openAppointmentBookingForLead]);

  const hasBookedAppointmentEntry = React.useCallback(async (leadForBooking: any) => {
    const agentEmail = String(authState?.user?.email || '').trim();
    if (!agentEmail) return false;

    const now = Date.now();
    const fromIso = new Date(now - (2 * 24 * 60 * 60 * 1000)).toISOString();
    const toIso = new Date(now + (370 * 24 * 60 * 60 * 1000)).toISOString();
    const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-10);
    const leadPhoneLast10 = normalizePhone(leadForBooking?.phone);
    const isValidAppointment = (row: any) =>
      String(row?.appointment_type || '').toLowerCase() !== 'callback' &&
      String(row?.status || '').toLowerCase() !== 'cancelled';

    const candidateLeadIds = Array.from(
      new Set(
        [
          leadForBooking?.taalk_lead_id,
          leadForBooking?.leadId,
          leadForBooking?.id,
        ]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    for (const leadId of candidateLeadIds) {
      try {
        const endpoint = resolveServiceUrl(
          `/api/appointments?agentEmail=${encodeURIComponent(agentEmail)}&leadId=${encodeURIComponent(leadId)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        );
        const response = await fetch(endpoint, {
          credentials: getServiceRequestCredentials(endpoint),
        });
        if (!response.ok) continue;
        const data = await response.json().catch(() => []);
        const rows = Array.isArray(data) ? data : [];
        if (rows.some(isValidAppointment)) return true;
      } catch (error) {
        console.warn('⚠️ Failed appointment verification by leadId', { leadId, error });
      }
    }

    if (!leadPhoneLast10) return false;

    try {
      const endpoint = resolveServiceUrl(
        `/api/appointments?agentEmail=${encodeURIComponent(agentEmail)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      );
      const response = await fetch(endpoint, {
        credentials: getServiceRequestCredentials(endpoint),
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => []);
      const rows = Array.isArray(data) ? data : [];
      return rows.some((row: any) => {
        if (!isValidAppointment(row)) return false;
        return normalizePhone(row?.lead_phone) === leadPhoneLast10;
      });
    } catch (error) {
      console.warn('⚠️ Failed appointment verification by phone', error);
      return false;
    }
  }, [authState?.user?.email]);

  // ── Outcome Modal ──────────────────────────────────────────────────────────
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [softReminderDismissed, setSoftReminderDismissed] = useState(false);
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);

  // ── Dialer Gate ────────────────────────────────────────────────────────────
  const dialerGate = useDialerGate(authState?.user?.email);

  const startCompleteCallCooldown = React.useCallback((seconds = 3) => {
    if (completeCallCooldownTimerRef.current) {
      window.clearInterval(completeCallCooldownTimerRef.current);
      completeCallCooldownTimerRef.current = null;
    }
    setCompleteCallCooldownSeconds(seconds);
    completeCallCooldownTimerRef.current = window.setInterval(() => {
      setCompleteCallCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (completeCallCooldownTimerRef.current) {
            window.clearInterval(completeCallCooldownTimerRef.current);
            completeCallCooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  React.useEffect(() => () => {
    if (completeCallCooldownTimerRef.current) {
      window.clearInterval(completeCallCooldownTimerRef.current);
    }
  }, []);

  const handleOutboundCallStartTimeout = React.useCallback((lead: any, conn: any, source: string, agentEmail?: string | null) => {
    debugLog('⏱️ Outbound call start timeout - moving to next lead', {
      source,
      leadId: lead?.id ?? lead?.taalk_lead_id,
      phone: lead?.phone,
      timeoutMs: outboundCallStartTimeoutMs,
    });
    try {
      armSuppressDispositionPromptOnDisconnect();
      if (conn && typeof conn.disconnect === 'function') conn.disconnect();
    } catch (error) {
      console.warn('⚠️ Failed to disconnect timed-out outbound call', error);
    }
    if ((window as any).twilioConnection === conn) {
      (window as any).twilioConnection = null;
    }
    if (lead?.id || lead?.phone) {
      void masterleadUpdateResolution({
        leadId: lead.id,
        leadPhone: lead.phone,
        cnresolution: 'no_answer',
        agentEmail: agentEmail || authState?.user?.email,
      }).catch((error: any) => console.warn('⚠️ Timeout no_answer update failed (non-critical):', error));
    }
    setStatus('Call start timed out - dialing next lead');
    const currentState = dialerStateRef.current;
    const currentLeadId = String(lead?.id ?? lead?.taalk_lead_id ?? lead?.leadId ?? '');
    const currentIndex = currentState.availableLeads.findIndex((item: any) =>
      String(item?.id ?? item?.taalk_lead_id ?? item?.leadId ?? '') === currentLeadId
    );
    const removeIndex = currentIndex >= 0 ? currentIndex : currentState.currentLeadIndex;
    const updatedLeads = currentState.availableLeads.filter((_, index) => index !== removeIndex);
    const nextLead = updatedLeads[0] || null;
    setDialerState((prev) => {
      const activeLeadKey = String(lead?.id ?? lead?.taalk_lead_id ?? lead?.leadId ?? lead?.phone ?? '');
      const viewedLeadKey = String(prev.viewedLead?.id ?? prev.viewedLead?.taalk_lead_id ?? prev.viewedLead?.leadId ?? prev.viewedLead?.phone ?? '');
      const shouldClearViewedLead = Boolean(activeLeadKey && viewedLeadKey && activeLeadKey === viewedLeadKey);
      return {
        ...prev,
        leads: updatedLeads,
        availableLeads: updatedLeads,
        currentLeadIndex: 0,
        currentIndex: 0,
        availableLeadsCount: updatedLeads.length,
        dialingStatus: nextLead ? 'dialing' : 'ready',
        callStatus: nextLead ? 'connecting_direct' : 'idle',
        webRTCConferenceActive: false,
        isConnected: false,
        currentCall: nextLead,
        currentConferenceName: undefined,
        viewedLead: nextLead || (shouldClearViewedLead ? null : prev.viewedLead),
        selectedDisposition: '',
        dispositionApplied: false,
      };
    });
    toast({
      title: 'Lead no-answer timeout',
      description: nextLead ? 'Lead did not answer before timeout. Dialing the next lead.' : 'Lead did not answer before timeout. No backup lead is ready.',
      variant: 'default',
      duration: 2500,
    });
    if (nextLead?.phone) {
      window.setTimeout(() => {
        void dialLead(nextLead);
      }, 250);
    } else {
      void loadQueue({ forceRefill: true });
    }
  }, [authState?.user?.email, outboundCallStartTimeoutMs, toast]);
  
  // Refs to access latest state in VDP callback - initialized after dialerState is defined
  const isPoweredOnRef = React.useRef(isPoweredOn);
  const startDialingInFlightRef = React.useRef(false);
  const autoIgniteInFlightRef = React.useRef(false);
  const lastAutoIgniteAtRef = React.useRef(0);
  const dialLeadInFlightRef = React.useRef(false);
  const autoPowerOnInFlightRef = React.useRef(false);
  const autoPowerOnAttemptedRef = React.useRef(false);
  const handlePowerToggleRef = React.useRef<(options?: { simpleRegister?: boolean; forcePowerOn?: boolean }) => Promise<void>>(() => Promise.resolve());
  const manualPowerOffRef = React.useRef(false);
  const callJustEndedRef = React.useRef(false); // Track if call just ended to suppress expected offline toasts
  const directCallDisconnectedRef = React.useRef(false); // Suppress "call error" toast when call ended by disconnect (e.g. client hangup)
  const suppressDispositionPromptOnDisconnectRef = React.useRef(false);
  const suppressDispositionPromptTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const vdpOnlineRef = React.useRef(vdpOnline); // So call-end handlers can sync TaskRouter to toggle without WebRTC "setting" Online
  const taskRouterPresenceRef = React.useRef<'online' | 'offline' | 'busy' | 'wrap' | null>(null);
  const taskRouterSyncInFlightRef = React.useRef<'online' | 'offline' | 'busy' | 'wrap' | null>(null);
  const offlineTransitionRequestedRef = React.useRef(false);
  const powerTogglePromiseRef = React.useRef<Promise<void> | null>(null);
  const initializedEmailRef = React.useRef<string | null>(null);
  /** Once per load we auto-connect WebRTC when authenticated; Power button is cosmetic. */
  const autoPowerOnOnLoadDoneRef = React.useRef(false);
  const [isPowerToggling, setIsPowerToggling] = useState(false);

  const armSuppressDispositionPromptOnDisconnect = React.useCallback((ms = 6000) => {
    suppressDispositionPromptOnDisconnectRef.current = true;
    if (suppressDispositionPromptTimeoutRef.current) {
      clearTimeout(suppressDispositionPromptTimeoutRef.current);
    }
    suppressDispositionPromptTimeoutRef.current = setTimeout(() => {
      suppressDispositionPromptOnDisconnectRef.current = false;
      suppressDispositionPromptTimeoutRef.current = null;
    }, ms);
  }, []);

  React.useEffect(() => {
    return () => {
      if (suppressDispositionPromptTimeoutRef.current) {
        clearTimeout(suppressDispositionPromptTimeoutRef.current);
        suppressDispositionPromptTimeoutRef.current = null;
      }
    };
  }, []);
  
  // DISCLAIMER LOGIC REMOVED - All users bypass disclaimers - All users bypass disclaimers
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true); // Always accepted
  const [disclaimerLoading, setDisclaimerLoading] = useState(false); // No loading needed
  const [showExplainer, setShowExplainer] = useState(false);
  const [isManualLeadSyncing, setIsManualLeadSyncing] = useState(false);
  const currentUserEmail = authState?.user?.email?.toLowerCase();

  // Credits for inbound panel wallet display (treat as dollars for UI)
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const res = await fetch('/api/user/credits', { credentials: 'include', headers: { 'x-user-email': currentUserEmail } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentUserEmail,
    refetchInterval: 300000, // 5 min
  });
  const { data: userProfileData } = useQuery({
    queryKey: ['/api/user/profile', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(currentUserEmail)}`, {
        credentials: 'include',
        headers: { 'x-user-email': currentUserEmail },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentUserEmail,
    refetchInterval: 300000, // 5 min
  });
  const creditsRemaining = (creditsData as any)?.credits_remaining ?? (creditsData as any)?.creditsRemaining ?? 0;
  const walletBalanceDollars = typeof creditsRemaining === 'number' ? creditsRemaining : undefined;
  const currentMga =
    String(
      (userProfileData as any)?.mga ??
      (userProfileData as any)?.mga_team ??
      (authState?.profile as any)?.mgaTeam ??
      ''
    )
      .trim()
      .toLowerCase();
  // New inbound panel is the only option (Taalk removed); show for everyone.
  const useNewVdpPanel = true;

  // Backup Billing: persist in localStorage until backend supports it
  const CCP_BACKUP_BILLING_KEY = 'ccp_backup_billing_enabled';
  const [backupBillingEnabled, setBackupBillingEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CCP_BACKUP_BILLING_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [backupBillingLoading, setBackupBillingLoading] = useState(false);
  const handleBackupBillingToggle = (enabled: boolean) => {
    setBackupBillingLoading(true);
    try {
      localStorage.setItem(CCP_BACKUP_BILLING_KEY, enabled ? 'true' : 'false');
      setBackupBillingEnabled(enabled);
    } finally {
      setBackupBillingLoading(false);
    }
  };

  // Tab state for AOIntel integration (defined once at the top)
  // Removed: activePanelTab state - tabs removed for more space

  // AOIntel Components - Defined inside main component to avoid initialization issues
  const AccountabilitySectionContent = ({ userEmail }: { userEmail?: string }) => {
  const { data: aoiReportsStatus } = useQuery({
    queryKey: ['/api/aoi-reports/check-blocking', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const response = await fetch(`/api/aoi-reports/check-blocking/${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 300000 // 5 min
  });

  const { data: accountabilityStatus } = useQuery({
    queryKey: ['/api/accountability/check-status', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const response = await fetch(`/api/accountability/check-status?userEmail=${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail
  });

  if (!userEmail) return null;

  const pendingCount = aoiReportsStatus?.pendingCount || accountabilityStatus?.pendingConnectsCount || 0;
  const isBlocked = aoiReportsStatus?.mustResolveReports || accountabilityStatus?.isBlocked || false;
  const threshold = aoiReportsStatus?.threshold || 50;
  const totalActivities = accountabilityStatus?.totalActivities || 0;

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            AOI Report
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Report outcomes for each connect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/30 rounded-lg border">
            <div className="flex items-center gap-2">
              {pendingCount > threshold ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : pendingCount > 0 ? (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium">Pending AOI Reports</span>
            </div>
            <Badge variant={pendingCount > threshold ? "destructive" : pendingCount > 0 ? "destructive" : "secondary"}>
              {pendingCount}
            </Badge>
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/30 rounded-lg border">
              <div className="flex items-center gap-2">
                {isBlocked ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm font-medium">Access Status</span>
              </div>
              <Badge variant={isBlocked ? "destructive" : "secondary"}>
                {isBlocked ? `BLOCKED (${pendingCount} > 0)` : `OK (${pendingCount} = 0)`}
              </Badge>
            </div>
          )}

          {totalActivities > 0 && (
            <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Total Activities</span>
              </div>
              <Badge variant="outline">{totalActivities}</Badge>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {pendingCount > 0 && (
            <Button 
              className={`w-full text-white ${isBlocked ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              onClick={() => window.location.href = '/dashboard/aoi-report'}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              {isBlocked ? `RESOLVE NOW (${pendingCount})` : `Complete Reports (${pendingCount})`}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={() => window.location.href = '/dashboard/aoi-report'}
          >
            View AOI Reports
          </Button>
        </div>

        {isBlocked && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                <strong>Access Temporarily Restricted:</strong> You have {pendingCount} pending AOI reports. 
                Please complete all reports to regain full system access.
              </div>
            </div>
          </div>
        )}

        {!isBlocked && pendingCount > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
              <div className="text-xs text-orange-700 dark:text-orange-300">
                Stay current! You have {pendingCount} pending reports. 
                Keep reports up-to-date to maintain full system access.
              </div>
            </div>
          </div>
        )}

        {pendingCount === 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <div className="text-xs text-green-700 dark:text-green-300">
                Excellent! All AOI reports are up to date. Keep up the great accountability work!
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
  };

  const CallHistoryTabContent = ({ userEmail }: { userEmail?: string }) => {
  const [dateRange, setDateRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: callHistoryData } = useQuery({
    queryKey: ['/api/call-history', userEmail],
    queryFn: async () => {
      if (!userEmail) return { success: false, calls: [], total: 0 };
      const response = await fetch(`/api/call-history?userEmail=${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail
  });

  const recentCalls = callHistoryData?.calls || [];

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All Time' }
  ];

  const toggleCard = (callId: string) => {
    setExpandedCard(expandedCard === callId ? null : callId);
  };

  const filteredCalls = useMemo(() => {
    if (!searchTerm.trim()) return recentCalls;
    const term = searchTerm.toLowerCase();
    return recentCalls.filter((call: any) => 
      call.name?.toLowerCase().includes(term) ||
      call.phone?.toLowerCase().includes(term) ||
      call.market?.toLowerCase().includes(term) ||
      call.mga?.toLowerCase().includes(term) ||
      call.call_status?.toLowerCase().includes(term) ||
      call.leadId?.toLowerCase().includes(term)
    );
  }, [recentCalls, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">Call History</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search calls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {filteredCalls && Array.isArray(filteredCalls) && filteredCalls.length > 0 ? (
        <div className="space-y-3">
          {filteredCalls.slice(0, 20).map((call: any) => (
            <Card
              key={call.id || call.leadId}
              className={`border rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${expandedCard === call.id ? 'shadow-xl scale-[1.01]' : 'shadow-sm'}`}
              onClick={() => toggleCard(call.id || call.leadId)}
            >
              <CardContent className={`p-4 transition-all duration-300 ${expandedCard === call.id ? 'bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50' : 'bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-blue-950/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {(call.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                        {call.name || 'Unknown Contact'}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="font-mono">{call.phone || 'No phone number'}</span>
                        {call.market && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{call.market}</span>
                        )}
                        {call.state && (
                          <span className="text-green-600 dark:text-green-400 font-medium">{call.state}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={call.call_status === 'completed' ? 'default' : call.call_status === 'missed' ? 'destructive' : 'secondary'}
                      className="px-3 py-1"
                    >
                      {call.call_status || 'Unknown'}
                    </Badge>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Today'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.createdAt ? new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MdHistory className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            No calls yet {dateRange === 'today' ? 'today' : dateRange === 'week' ? 'this week' : dateRange === 'month' ? 'this month' : `for ${dateRange}`}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Your call history will appear here once you start making calls.
          </p>
        </div>
      )}
    </div>
  );
  };

  // 🍎 MAC-SPECIFIC: Request microphone permission IMMEDIATELY on component mount
  // Auto-detect broken permissions and show recovery modal
  useEffect(() => {
    if (isMac()) {
      debugLog('🍎 Mac detected - requesting microphone permission immediately on component mount...');
      requestMicrophonePermission(true).then((result) => {
        if (result.success) {
          debugLog('✅ Mac: Microphone permission granted on app load');
          if (result.stream) {
            // Keep stream active for entire session
            (window as any).__macMicrophoneStream = result.stream;
            debugLog('✅ Mac: Microphone stream stored globally for entire session');
          }
        } else {
          console.error('❌ Mac: Failed to get microphone permission on app load:', result.error);
          setHasMicIssue(true);
          // Show recovery modal if permission is broken
          if (result.needsRecovery) {
            setShowMicRecoveryModal(true);
          }
        }
      }).catch((error) => {
        console.error('❌ Mac: Error requesting microphone permission on app load:', error);
        // Show recovery modal on error
        setShowMicRecoveryModal(true);
      });
    }
  }, []); // Run once on mount
  
  // Bypass emails - ALL USERS BYPASS DISCLAIMERS (disclaimer logic removed)
  const bypassEmails = [
    'richiealtig@aoglobelife.com',
    'coopertyler@aoglobelife.com',
    'jacobnavarre@aoglobelife.com',
    'kaylar@aoglobelife.com',
    'ryancarrion@aoglobelife.com',
    'makelaoutlawalexander@aoglobelife.com',
    'langjames@aoglobelife.com',
    'vernawillbur@aoglobelife.com',
    'nicolasmahaffy@aoglobelife.com',
    'karamikovar@aoglobelife.com',
    'demarcusporter@aoglobelife.com',
    'patricasantamarina@aoglobelife.com',
    'stephengarnica@aoglobelife.com'
  ];
  // DISCLAIMER LOGIC COMPLETELY REMOVED - All users bypass disclaimers
  // No disclaimer checks, no API calls, no modals - just set accepted to true
  useEffect(() => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    setDisclaimerLoading(false);
    localStorage.setItem('call_connector_pro_disclaimer_accepted', 'true');
    debugLog('✅ DISCLAIMER BYPASSED - All disclaimers removed for /connect and Call Connector Pro');
  }, []);

  // DISCLAIMER LOGIC REMOVED - No explainer or disclaimer modals
  
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>(null);
  const isEmbeddedSubscriptionEnabled = true;
  const [showCertification, setShowCertification] = useState(false);
  const [demoCallStarted, setDemoCallStarted] = useState(false);
  const [showMicRecoveryModal, setShowMicRecoveryModal] = useState(false);
  /** True when mic permission failed or unavailable; status indicator shows Mic icon and flashes blue. */
  const [hasMicIssue, setHasMicIssue] = useState(false);
  
  // Queue selector state (moved to header)
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Undo state - track previous lead and disposition for undo functionality
  const [undoState, setUndoState] = useState<{
    previousLeadIndex: number;
    previousDisposition: CallDisposition | null;
    previousDispositionApplied: boolean;
    previousLeads: Lead[];
  } | null>(null);
  
  // Call state management
  const [callState, setCallState] = useState<'offline' | 'idle' | 'on-call' | 'post-call'>('offline');
  const [presentMode, setPresentMode] = useState(false);
  const [presentPanelPos, setPresentPanelPos] = useState({ x: 16, y: 84 });
  const presentPanelDragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });
  const [wherebyRoom, setWherebyRoom] = useState<{ roomUrl: string; hostRoomUrl: string; joinLink: string } | null>(null);
  const [wherebyCreating, setWherebyCreating] = useState(false);
  /** When true, show Whereby video strip above HPPRO (same origin shell — not inside HPPRO iframe). */
  const [wherebyFloating, setWherebyFloating] = useState(false);

  // Listen for aoi-present-open from CallConnectorPro or any other component
  // Placed here AFTER wherebyRoom is declared to avoid TDZ error
  useEffect(() => {
    const handler = () => {
      setPresentMode(true);
      setWherebyFloating(true);
      if (!wherebyRoom && !wherebyCreating && currentUserEmail) {
        setWherebyCreating(true);
        fetch('/api/whereby/create-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentEmail: currentUserEmail, leadName: 'Guest', leadId: '' }),
        }).then(r => r.json()).then((d: any) => {
          if (d.success && d.roomUrl) setWherebyRoom({ roomUrl: d.roomUrl, hostRoomUrl: d.hostRoomUrl || d.roomUrl, joinLink: d.roomUrl });
        }).catch(console.error).finally(() => setWherebyCreating(false));
      }
    };
    window.addEventListener('aoi-present-open', handler);
    return () => window.removeEventListener('aoi-present-open', handler);
  }, [wherebyRoom, wherebyCreating, currentUserEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  /** HPPRO present: share Whereby link via SMS/email to any number or address (prefilled from lead when present). */
  const [presentShareModalOpen, setPresentShareModalOpen] = useState(false);
  const [aoiAppModalOpen, setAoiAppModalOpen] = useState(false);
  const [aoiAppPrefill, setAoiAppPrefill] = useState<AoiAppPrefillCheck>({
    ready: false,
    checking: false,
    reason: 'Enter Present mode to enable AOI Application.',
    missing: [],
  });
  const [shareClientName, setShareClientName] = useState('Client');
  const [sharePhone, setSharePhone] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareSendingSms, setShareSendingSms] = useState(false);
  const [shareSendingEmail, setShareSendingEmail] = useState(false);
  const aoiModalOpenedAtRef = useRef<number>(0);
  const restorePresentAfterAoiRef = useRef(false);

  const closePresentMode = (reason: string) => {
    if (aoiAppModalOpen) {
      console.warn(`[AOI Present] Ignored close while AOI app modal open (${reason})`);
      return;
    }
    setPresentMode(false);
  };

  const closeAoiAppModal = () => {
    setAoiAppModalOpen(false);
    if (restorePresentAfterAoiRef.current) {
      restorePresentAfterAoiRef.current = false;
      setTimeout(() => setPresentMode(true), 0);
    }
  };

  useEffect(() => {
    if (!presentMode) {
      setAoiAppPrefill({
        ready: false,
        checking: false,
        reason: 'Enter Present mode to enable AOI Application.',
        missing: [],
      });
      return;
    }

    let active = true;
    const checkPrefill = async () => {
      setAoiAppPrefill((prev) => ({ ...prev, checking: true }));
      try {
        const res = await apiRequest('GET', `/api/hppro/eapp-pending?_=${Date.now()}`);
        const data = (await res.json()) as {
          pending?: { inject?: Record<string, unknown>; presentation_guid?: string } | null;
        };
        if (!active) return;
        setAoiAppPrefill(validateAoiAppPendingPayload(data.pending));
      } catch {
        if (!active) return;
        setAoiAppPrefill({
          ready: false,
          checking: false,
          reason: 'Unable to verify HPPRO prefill payload. Stay in Present mode and retry.',
          missing: ['api/hppro/eapp-pending'],
        });
      }
    };

    void checkPrefill();
    const timer = window.setInterval(() => {
      void checkPrefill();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [presentMode]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!presentPanelDragRef.current.dragging) return;
      const panelWidth = Math.min(1280, Math.floor(window.innerWidth * 0.92));
      const panelHeight = Math.min(840, Math.floor(window.innerHeight * 0.84));
      const nextX = Math.max(0, Math.min(e.clientX - presentPanelDragRef.current.offsetX, window.innerWidth - panelWidth));
      const nextY = Math.max(0, Math.min(e.clientY - presentPanelDragRef.current.offsetY, window.innerHeight - panelHeight));
      setPresentPanelPos({ x: nextX, y: nextY });
    };
    const onUp = () => {
      presentPanelDragRef.current.dragging = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const {
    data: subscriptionData,
    isLoading: isSubscriptionLoading,
    isError: subscriptionError,
  } = useQuery({
    queryKey: ['/api/billing/subscription/status'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/billing/subscription/status');
      return res.json();
    },
    refetchInterval: 300000, // 5 min
  });

  const subscription = subscriptionData?.subscription ?? null;
  const subscriptionResolved =
    !isSubscriptionLoading && (subscriptionData !== undefined || subscriptionError);
  
  // 🔥 CRITICAL: Force pro access for cnsysop and bypass emails
  const userEmail = authState?.user?.email?.toLowerCase();
  const isCnsysop = userEmail === 'cnsysop@aoglobelife.com';
  
  // 🔥 BYPASS: These emails get FULL ACCESS - BYPASSES ALL CHECKS (already declared earlier for disclaimer)
  const isBypassEmail = userEmail && bypassEmails.includes(userEmail.toLowerCase().trim());
  
  const hasActiveSubscription = isCnsysop || isBypassEmail ? true : Boolean(subscription?.hasActiveSubscription);
  const resolvedPlanKey = resolvePlanKey(subscription?.plan, subscription?.hasActiveSubscription);
  const planKey = isCnsysop || isBypassEmail ? 'professional' : (subscription?.outboundEnabled ? 'professional' : resolvedPlanKey);
  const planLabel = PLAN_BADGE_LABELS[planKey];
  const planBadgeStyle = PLAN_BADGE_STYLES[planKey];
  const canProfessionalPower = isCnsysop || isBypassEmail ? true : (subscription?.plan === 'professional' && subscription?.hasActiveSubscription);
  const hasOutboundAccess = Boolean(isCnsysop || isBypassEmail || canProfessionalPower || subscription?.outboundEnabled);
  const shouldGateOutbound = Boolean(subscriptionResolved && subscription && !hasOutboundAccess && !isCnsysop && !isBypassEmail);
  const isStarterPlan = planKey === 'intro';

  // Fetch trialone status from agent_live_call_status
  const { data: agentStatus } = useQuery({
    queryKey: ['/api/debug/agent-live-status', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const response = await fetch(`/api/debug/agent-live-status?agent_email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.records?.[0] || null;
    },
    enabled: !!userEmail,
    refetchInterval: 300000, // 5 min
  });

  // Fetch timeout status from agent anomaly detector
  const { data: timeoutStatusData } = useQuery({
    queryKey: ['/api/agent-anomaly/check-timeout', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/agent-anomaly/check-timeout?agentEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    },
    enabled: !!currentUserEmail,
    refetchInterval: 300000, // 5 min
  });

  // Extract timeout values - ensure they're always defined (default to safe values)
  const timeoutStatus = (timeoutStatusData && timeoutStatusData.success !== false) ? timeoutStatusData : null;
  const isTimedOut: boolean = Boolean(timeoutStatus?.isTimedOut);
  const timeoutRemaining: number = timeoutStatus?.remainingSeconds ?? 0;

  const planOptions: PlanOption[] = [
    {
      plan: 'professional',
      label: 'Professional',
      price: '$64.99',
      priceSuffix: '/month',
      tagline: 'Unlock unlimited outbound dialing with the Professional plan',
      cardClass: 'border-2 border-blue-500 shadow-xl scale-[1.02]',
      gradientClass: 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30',
      bodyClass: 'bg-white/80 backdrop-blur',
      buttonClass:
        'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white',
      icon: <FiStar className="h-5 w-5 text-blue-600" />,
      benefits: [
        'Unlimited outbound minutes',
        'Local Presence EVERY STATE.. Take your activity to the next level!',
        'Advanced call analytics & reporting',
        'Priority support response',
        'Unlimited dialing',
      ],
      ctaLabel: 'Upgrade Now',
      topBanner: 'Recommended',
    },
  ];

  const professionalPlan = planOptions[0];

  const activePlan = hasActiveSubscription ? (subscription?.plan as SubscriptionPlan | undefined) : undefined;

  const handleCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlanForUpgrade(plan);
    setSubscriptionModalOpen(true);
  };

  const showUpgradeButton = !isCnsysop && !canProfessionalPower && !subscription?.outboundEnabled;


  // Initialize dialer state with restored position from localStorage (expires after 30 min to prevent stale leads)
  const initializeDialerState = (): DialerState => {
    const userEmail = authState?.user?.email;
    const savedPosition = getRestoredPosition(userEmail);

    return {
      webRTCConferenceActive: false,
      powered: true,
      campaignActive: false,
      dialingStatus: 'idle',
      currentCall: null,
      callNotes: '',
      selectedDisposition: '',
      dispositionApplied: false, // Track if disposition has been applied to masterlead
      availableLeads: [],
      currentLeadIndex: savedPosition, // Restore saved position
      callStatus: 'idle',
      callDuration: 0,
      customerCallStatus: { hasCustomer: false, hasPendingCall: false },
      vdpCallStatus: {
        hasVDPCall: false,
        vdpCall: null,
        countdownValue: 0,
        countdownActive: false
      },
      viewedLead: null, // For leads selected from search that don't affect queue
      inboundCallInfo: null,
      inboundCallLead: null
    };
  };

  // Core dialer state matching Call Connector Pro
  const [dialerState, setDialerState] = useState<DialerState>(initializeDialerState);
  
  // Refs to access latest state in VDP callback - initialized after dialerState is defined
  const dialerStateRef = React.useRef(dialerState);
  
  // Keep refs in sync with state
  React.useEffect(() => {
    isPoweredOnRef.current = isPoweredOn;
  }, [isPoweredOn]);

  React.useEffect(() => {
    taskRouterPendingRef.current = taskRouterPending;
  }, [taskRouterPending]);

  React.useEffect(() => {
    retainedTaskRouterPendingRef.current = retainedTaskRouterPending;
  }, [retainedTaskRouterPending]);

  React.useEffect(() => {
    const email = authState?.user?.email?.trim?.();
    agentEmailForInboundRef.current = email && email.includes('@') ? email : null;
  }, [authState?.user?.email]);

  React.useEffect(() => {
    vdpOnlineRef.current = vdpOnline;
  }, [vdpOnline]);
  
  React.useEffect(() => {
    dialerStateRef.current = dialerState;
  }, [dialerState]);

  const syncTaskRouterState = React.useCallback(async (
    reason: string,
    options?: { force?: 'online' | 'offline' | 'busy' | 'wrap'; allowWrap?: boolean }
  ) => {
    const email = (authState?.user?.email || (window as any).__webrtcAgentEmail || '').toLowerCase().trim();
    if (!email || !email.includes('@')) return;

    // Only AvailableInbound when WebRTC device is powered on (registered).
    // That means the agent's browser can actually receive calls.
    // TaskRouter manages BusyOnCall during active dequeue calls automatically.
    let target: 'online' | 'offline' | 'busy' | 'wrap';
    if (options?.force) {
      target = options.force;
    } else {
      target = isPoweredOnRef.current ? 'online' : 'offline';
    }

    if (taskRouterPresenceRef.current === target || taskRouterSyncInFlightRef.current === target) return;

    const endpointByTarget: Record<'online' | 'offline' | 'busy' | 'wrap', string> = {
      online: '/api/agents/voice-online',
      offline: '/api/agents/voice-offline',
      busy: '/api/agents/voice-busy',
      wrap: '/api/agents/voice-wrap',
    };

    try {
      taskRouterSyncInFlightRef.current = target;
      const response = await fetch(endpointByTarget[target], {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        console.warn(`[TaskRouter] ${target} failed during ${reason}:`, response.status);
        return;
      }
      taskRouterPresenceRef.current = target;
      if (target === 'offline') {
        offlineTransitionRequestedRef.current = false;
      }
    } catch (error) {
      console.warn(`[TaskRouter] ${target} error during ${reason}:`, error);
    } finally {
      if (taskRouterSyncInFlightRef.current === target) {
        taskRouterSyncInFlightRef.current = null;
      }
    }
  }, [authState?.user?.email]);

  // Safety-net: re-assert TaskRouter presence from the current interface/device state.
  // This keeps the UI as the source of truth even if a one-time startup/toggle event is missed.
  React.useEffect(() => {
    const email = authState?.user?.email?.toLowerCase?.();
    if (!email || !email.includes('@')) return;
    void syncTaskRouterState('state-reassert', { allowWrap: true });
  }, [
    authState?.user?.email,
    vdpOnline,
    isPoweredOn,
    dialerState.webRTCConferenceActive,
    dialerState.isConnected,
    dialerState.callStatus,
    dialerState.dialingStatus,
    syncTaskRouterState,
  ]);

  /** Clear connection/ringing state but keep inbound lead so agent can add disposition after call ends. */
  const clearInboundConnectionOnly = React.useCallback(() => {
    inboundDebugLog('clearInboundConnectionOnly CALLED – keeping lead for disposition');
    setIncomingConn(null);
    setTaskRouterPending(null);
    setRetainedTaskRouterPending(null);
    setIncomingCallLead(null);
    setIncomingRingStartedAt(null);
    setInboundCallAccepted(false);
    setInboundModalDrag({ x: 0, y: 0 });
    setAnswering(false);
    inboundAnswerRequestedRef.current = false;
    browserLegAcceptIssuedRef.current = false;
    acceptIncomingFromQueueRef.current = false;
    lastIncomingFingerprintRef.current = null;
    setDialerState((prev: any) => ({
      ...prev,
      webRTCConferenceActive: false,
      dialingStatus: 'ready',
      isConnected: false,
      inboundCallInfo: prev.inboundCallInfo,
      inboundCallLead: prev.inboundCallLead,
      viewedLead: prev.viewedLead ?? prev.inboundCallLead,
      currentCall: prev.currentCall ?? prev.inboundCallLead,
    }));
  }, [setDialerState]);

  const clearInboundConnectionState = React.useCallback(() => {
    inboundDebugLog('clearInboundConnectionState CALLED');
    inboundWrapActiveRef.current = false;
    setInboundDispositionRequired(false);
    setIncomingConn(null);
    setTaskRouterPending(null);
    setRetainedTaskRouterPending(null);
    setIncomingCallLead(null);
    setIncomingRingStartedAt(null);
    setInboundCallAccepted(false);
    setInboundModalDrag({ x: 0, y: 0 });
    setAnswering(false);
    inboundCallLeadRef.current = null;
    inboundAnswerRequestedRef.current = false;
    browserLegAcceptIssuedRef.current = false;
    acceptIncomingFromQueueRef.current = false;
    lastIncomingFingerprintRef.current = null;
    inboundCallSidForPollRef.current = null;
    inboundAgentConnCallSidRef.current = null;
    inboundConnRef.current = null;
    setDialerState((prev: any) => ({
      ...prev,
      webRTCConferenceActive: false,
      dialingStatus: 'idle',
      isConnected: false,
      inboundCallInfo: null,
      inboundCallLead: null,
    }));
  }, [setDialerState]);

  const clearInboundPanelState = React.useCallback(() => {
    (window as any).__inboundCallActive = false;
    inboundWrapActiveRef.current = false;
    setInboundDispositionRequired(false);
    setInboundConnecting(false);
    setInboundWrapEndsAt(null);
    setWrapSecondsLeft(0);
    void syncTaskRouterState('clear-inbound-panel', {
      force: vdpOnlineRef.current && isPoweredOnRef.current ? 'online' : 'offline',
    });
    inboundDebugLog('clearInboundPanelState CALLED');
    inboundDebugStack('clearInboundPanelState');
    if (inboundCallEndedTimeoutRef.current) {
      clearTimeout(inboundCallEndedTimeoutRef.current);
      inboundCallEndedTimeoutRef.current = null;
    }
    setInboundCallEndedAt(null);
    clearInboundConnectionState();
  }, [clearInboundConnectionState, syncTaskRouterState]);

  /** Clear pending inbound only when ringing (not accepted). Call from lead transition / tab switch so ringing doesn't hang around. Never run when connected (webRTCConferenceActive). */
  const clearPendingInboundIfRinging = React.useCallback(async () => {
    const state = dialerStateRef.current;
    if (state.dialingStatus !== 'ringing' || state.webRTCConferenceActive) return;
    try {
      if (incomingConn && typeof (incomingConn as any).reject === 'function') {
        (incomingConn as any).reject();
      }
    } catch (e) {
      console.warn('[INBOUND] clearPendingInboundIfRinging: connection.reject error', e);
    }
    const pending = taskRouterPending ?? retainedTaskRouterPending;
    if (pending) {
      try {
        await fetch('/api/twilio/taskrouter/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ taskSid: pending.taskSid, reservationSid: pending.reservationSid }),
        });
      } catch (e) {
        console.warn('[INBOUND] clearPendingInboundIfRinging: taskrouter/reject error', e);
      }
    }
    clearInboundPanelState();
  }, [incomingConn, taskRouterPending, retainedTaskRouterPending, clearInboundPanelState]);

  const handleInboundDisconnected = React.useCallback(() => {
    if (inboundWrapActiveRef.current) {
      inboundDebugLog('handleInboundDisconnected ignored - wrap already active');
      return;
    }
    const hadLiveInboundCall =
      inboundCallAccepted ||
      dialerStateRef.current.webRTCConferenceActive ||
      inboundConnRef.current != null;
    inboundWrapActiveRef.current = true;
    (window as any).__inboundCallActive = false;
    inboundConnRef.current = null;
    setInboundConnecting(false);
    try {
      inboundDebugLog('handleInboundDisconnected CALLED – call ended, clearing immediately (no wrap)');
      if (inboundCallEndedTimeoutRef.current) {
        clearTimeout(inboundCallEndedTimeoutRef.current);
        inboundCallEndedTimeoutRef.current = null;
      }
      const now = Date.now();
      setInboundCallEndedAt(now);
      setInboundWrapEndsAt(now); // No wrap — end immediately
      setWrapSecondsLeft(0);
      setInboundDispositionRequired(false);
      inboundWrapActiveRef.current = false;
      // Go straight back to online/available
      void syncTaskRouterState('inbound-disconnect-done');
      clearInboundConnectionOnly();
    } catch (err) {
      console.error('[INBOUND] handleInboundDisconnected error', err);
      setInboundCallEndedAt(null);
      setInboundWrapEndsAt(null);
      setWrapSecondsLeft(0);
      inboundWrapActiveRef.current = false;
      clearInboundConnectionOnly();
    }
  }, [clearInboundConnectionOnly, inboundCallAccepted, syncTaskRouterState]);

  // When wrap period is active: tick wrapSecondsLeft every second. When wrap ends, always set agent back to AvailableInbound so they can take calls; then clear panel unless disposition still required.
  React.useEffect(() => {
    if (inboundWrapEndsAt == null) return;
    const endsAt = inboundWrapEndsAt;
    const timeout = setTimeout(() => {
      if (wrapTimerRef.current) {
        clearInterval(wrapTimerRef.current.interval);
        wrapTimerRef.current = null;
      }
      setInboundWrapEndsAt(null);
      setWrapSecondsLeft(0);
      // Always flag agent back to take calls when wrap ends (voice-online → AvailableInbound). Do not leave them in Wrap.
      void syncTaskRouterState('wrap-ended', {
        force: vdpOnlineRef.current && isPoweredOnRef.current ? 'online' : 'offline',
      });
      if (inboundDispositionRequired && !dialerState.dispositionApplied) {
        inboundDebugLog('wrap expired but inbound disposition still required - keeping panel open');
        return;
      }
      clearInboundPanelState();
    }, Math.max(0, endsAt - Date.now()));
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setWrapSecondsLeft(left);
    }, 1000);
    wrapTimerRef.current = { timeout, interval };
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      wrapTimerRef.current = null;
    };
  }, [inboundWrapEndsAt, clearInboundPanelState, inboundDispositionRequired, dialerState.dispositionApplied, syncTaskRouterState]);

  const freezeInboundPanelState = React.useCallback(() => {
    inboundDebugLog('freezeInboundPanelState CALLED', { leadRef: !!inboundCallLeadRef.current });
    setIncomingConn(null);
    setTaskRouterPending(null);
    setRetainedTaskRouterPending(null);
    setIncomingRingStartedAt(null);
    setInboundModalDrag({ x: 0, y: 0 });
    setAnswering(false);
    inboundAnswerRequestedRef.current = false;
    browserLegAcceptIssuedRef.current = false;
    acceptIncomingFromQueueRef.current = false;
    lastIncomingFingerprintRef.current = null;
    setInboundCallAccepted(true);
    setDialerState((prev: any) => ({
      ...prev,
      dialingStatus: 'connected',
      isConnected: true,
      webRTCConferenceActive: true,
      inboundCallInfo: prev.inboundCallInfo,
      inboundCallLead: prev.inboundCallLead ?? inboundCallLeadRef.current ?? null,
      viewedLead: prev.viewedLead ?? prev.inboundCallLead ?? inboundCallLeadRef.current ?? null,
      currentCall: prev.currentCall ?? prev.inboundCallLead ?? inboundCallLeadRef.current ?? null,
      campaignActive: false,
    }));
  }, [setDialerState]);
  const markInboundPanelConnected = React.useCallback((conn: any) => {
    (window as any).__inboundCallActive = true;
    inboundConnRef.current = conn;
    setInboundConnecting(false); // browser leg is up – we're really connected now
    const params = conn?.parameters || conn?.customParameters || {};
    const to = params.To ?? params.to ?? conn?.to ?? '';
    const callSid = params.CallSid ?? params.call_sid ?? conn?.CallSid ?? '';
    if (callSid) inboundAgentConnCallSidRef.current = String(callSid);
    const consumeBonusCallSid = callSid ? String(callSid) : (inboundCallSidForPollRef.current || null);
    const lead = incomingCallLead ?? inboundCallLeadRef.current ?? null;
    inboundDebugLog('markInboundPanelConnected CALLED', { hasLead: !!lead, leadPhone: lead?.phone });
    setInboundCallAccepted(true);
    setTaskRouterPending(null);
    setRetainedTaskRouterPending(null);
    setIncomingRingStartedAt(null);
    inboundAnswerRequestedRef.current = false;
    browserLegAcceptIssuedRef.current = false;
    acceptIncomingFromQueueRef.current = false;
    setDialerState((prev: any) => {
      const resolvedLead = lead ?? prev.inboundCallLead ?? null;
      const rawFrom = params.From ?? params.from ?? conn?.from ?? '';
      const fromForDisplay = isDequeueCallerId(rawFrom) ? '' : rawFrom;
      const prevFrom = prev.inboundCallInfo?.from;
      const prevFromOk = prevFrom && !isDequeueCallerId(prevFrom);
      const callerPhone = resolvedLead?.phone ?? (prevFromOk ? prevFrom : '') ?? fromForDisplay ?? '';
      return {
        ...prev,
        dialingStatus: 'connected',
        isConnected: true,
        webRTCConferenceActive: true,
        inboundCallInfo: (callerPhone || to || callSid) ? { from: callerPhone, to, callSid } : prev.inboundCallInfo,
        inboundCallLead: resolvedLead,
        viewedLead: resolvedLead ?? prev.viewedLead ?? null,
        currentCall: resolvedLead ?? prev.currentCall ?? null,
        campaignActive: false,
      };
    });
    if (currentUserEmail && consumeBonusCallSid && lastConsumedBonusCallSidRef.current !== consumeBonusCallSid) {
      lastConsumedBonusCallSidRef.current = consumeBonusCallSid;
      fetch('/api/inbound/bonus-connects/consume', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail, callSid: consumeBonusCallSid }),
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data) => {
          if (!data) return;
          queryClient.invalidateQueries({ queryKey: ['/api/user/credits', currentUserEmail] });
        })
        .catch((err) => console.warn('bonus connect consume failed', err));
    }
  }, [incomingCallLead, setDialerState, currentUserEmail, queryClient]);
  const incomingDeviceHandlers = React.useMemo(() => ({
    setIncomingConn,
    setDialerState,
    inboundCallLeadRef,
    answerRequestedRef: inboundAnswerRequestedRef,
    acceptIssuedRef: browserLegAcceptIssuedRef,
    shouldHandleInboundAccept: () => inboundAnswerRequestedRef.current,
    onInboundAccepted: markInboundPanelConnected,
    onInboundDisconnected: handleInboundDisconnected,
    onInboundCanceled: clearInboundPanelState,
    onTaskRouterSync: (reason: string, force?: 'online' | 'offline' | 'busy' | 'wrap') => {
      void syncTaskRouterState(reason, force ? { force } : undefined);
    },
    onDuplicateSession: (isDuplicate: boolean) => {
      setDuplicateSession(isDuplicate);
    },
  }), [clearInboundPanelState, handleInboundDisconnected, markInboundPanelConnected, setDialerState, syncTaskRouterState]);

  // Expose disconnect handler so device-level "disconnect" can clear panel when conn.on('disconnect') doesn't fire
  React.useEffect(() => {
    (window as any).__onInboundDisconnected = handleInboundDisconnected;
    return () => { (window as any).__onInboundDisconnected = null; };
  }, [handleInboundDisconnected]);

  // When an outbound call ends, device may fire "disconnect" even if conn.on('disconnect') didn't run (e.g. tab backgrounded). Rotate agent off BusyOnCall.
  React.useEffect(() => {
    (window as any).__onOutboundOrDeviceDisconnected = () => {
      void syncTaskRouterState('device-disconnect-fallback', { force: isPoweredOnRef.current ? 'online' : 'offline' });
    };
    return () => { (window as any).__onOutboundOrDeviceDisconnected = null; };
  }, [syncTaskRouterState]);

  // When on an inbound call (or still "connecting"), poll task-route status so we can force "Call ended" if server got completed/failed
  const inboundCallSid =
    (dialerState.webRTCConferenceActive && dialerState.inboundCallLead ? (dialerState.inboundCallInfo?.callSid ?? null) : null) ||
    (inboundConnecting ? inboundCallSidForPollRef.current : null);
  React.useEffect(() => {
    if (!inboundCallSid && !inboundConnecting) return;
    const poll = async () => {
      const sids = [inboundCallSid, inboundAgentConnCallSidRef.current, inboundCallSidForPollRef.current].filter(Boolean) as string[];
      if (sids.length === 0) return;
      try {
        const res = await fetch(resolveServiceUrl('/api/twilio-task-route/status'), { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const events: Array<{ callSid?: string; status?: string }> = data?.recentStatusEvents ?? [];
        const ended = events.some((e: any) => sids.includes(e.callSid) && (e.status === 'completed' || e.status === 'failed'));
        if (ended) {
          handleInboundDisconnected();
          return;
        }
      } catch (_) {}
      // Fallback: connection object is closed but disconnect event never fired (e.g. tab backgrounded)
      const conn = inboundConnRef.current;
      if (conn) {
        const status = (conn as any).status ?? (conn as any).state;
        if (status === 'closed') {
          inboundConnRef.current = null;
          handleInboundDisconnected();
        }
      }
    };
    const t = setInterval(poll, 300000); // 5 min
    poll();
    return () => clearInterval(t);
  }, [inboundCallSid, inboundConnecting, handleInboundDisconnected]);

  React.useEffect(() => () => {
    if (inboundCallEndedTimeoutRef.current) {
      clearTimeout(inboundCallEndedTimeoutRef.current);
      inboundCallEndedTimeoutRef.current = null;
    }
  }, []);

  // DISABLED: Track previous lead count for new leads notification
  // const previousLeadCountRef = useRef(0);
  // const [showNewLeadsNotification, setShowNewLeadsNotification] = useState(false);
  
  // Throttling removed - agents must start a call first, so throttling is no longer needed
  
  // DISABLED: Detect new leads when count increases
  // useEffect(() => {
  //   const currentCount = dialerState.availableLeads.length;
  //   const previousCount = previousLeadCountRef.current;
  //   
  //   // Only show notification if leads increased and we had leads before
  //   if (currentCount > previousCount && previousCount > 0) {
  //     setShowNewLeadsNotification(true);
  //   }
  //   
  //   // Update ref after a delay to allow notification to show
  //   const timer = setTimeout(() => {
  //     previousLeadCountRef.current = currentCount;
  //   }, 100);
  //   
  //   return () => clearTimeout(timer);
  // }, [dialerState.availableLeads.length]);
  

  // Track Call Connector activity based on dialer state
  useEffect(() => {
    if (!authState?.user?.email) return;

    const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];

    if (dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive) {
      updateActivity('live', {
        phoneNumber: currentLead?.phone,
        clientName: currentLead?.name,
        direction: 'outbound'
      });
    } else if (dialerState.dialingStatus === 'dialing' || dialerState.dialingStatus === 'ringing') {
      updateActivity('dialing', {
        phoneNumber: currentLead?.phone,
        clientName: currentLead?.name,
        direction: 'outbound'
      });
    } else {
      // Any other state = idle (ready, idle, powered off, etc.)
      updateActivity('idle');
    }
  }, [dialerState.dialingStatus, dialerState.callStatus, dialerState.webRTCConferenceActive, dialerState.powered, dialerState.currentLeadIndex, authState?.user?.email, updateActivity, dialerState.availableLeads]);

  // Header POS tile: GET /api/call-connector-pro/eligible-for-inbound → myPosition (Supabase agent_queue_position, else agent_live_call_status from CCPro heartbeat, else in-memory tracker)
  useEffect(() => {
    const email = authState?.user?.email;
    if (!email || !dialerState.powered) return;
    const isIdle = !incomingConn && dialerState.dialingStatus !== 'ringing' && !dialerState.webRTCConferenceActive;
    if (!isIdle) {
      setInboundQueuePosition(0);
      setInboundQueueTotalEligible(0);
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch(`/api/call-connector-pro/eligible-for-inbound?agentEmail=${encodeURIComponent(email)}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setInboundQueuePosition(typeof data.myPosition === 'number' ? data.myPosition : 0);
        setInboundQueueTotalEligible(typeof data.totalEligible === 'number' ? data.totalEligible : 0);
      } catch (_) {}
    };
    poll();
    const interval = setInterval(poll, 8000); // live-ish; server reads agent_live_call_status (Supabase)
    return () => clearInterval(interval);
  }, [authState?.user?.email, dialerState.powered, dialerState.dialingStatus, dialerState.webRTCConferenceActive, incomingConn]);

  // TaskRouter: poll pending so inbound call card shows (assignments stored in DB so any instance sees them)
  // Poll for inbound reservations whenever powered on OR online — show panel to all agents.
  // Sound/browser ring only plays when online (handled in InboundCallHeaderPanel).
  useEffect(() => {
    const email = authState?.user?.email;
    if (!email) return;
    const onlineForInbound = isPoweredOn || vdpOnline;
    if (!onlineForInbound) {
      inboundDebugLog('TaskRouter poll: not online for inbound, clearing inbound state');
      setTaskRouterPending(null);
      setRetainedTaskRouterPending(null);
      setIncomingCallLead(null);
      inboundCallLeadRef.current = null;
      setDialerState((prev: any) => ({
        ...prev,
        inboundCallInfo: null,
        inboundCallLead: prev.webRTCConferenceActive ? prev.inboundCallLead : null,
        dialingStatus: prev.webRTCConferenceActive ? prev.dialingStatus : 'idle',
      }));
      return;
    }
    if (dialerState.webRTCConferenceActive && inboundCallAccepted) return;
    let pollDelayMs = 1000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const scheduleNext = () => {
      timeoutId = setTimeout(() => { poll(); }, pollDelayMs);
    };
    const poll = async () => {
      try {
        const pendingUrl = `/api/twilio/taskrouter/pending?agentEmail=${encodeURIComponent(email)}`;
        const res = await fetch(pendingUrl, { credentials: 'include' });
        pollDelayMs = 1000; // reset to 1s on success
        setLastPendingPollAt(Date.now());
        if (!res.ok) {
          const _ = await res.text().catch(() => '');
          throw new Error(`pending ${res.status}`);
        }
        const data = await res.json().catch(() => ({}));
        const pending = data?.pending ?? [];
        const forMe = pending[0];
        if (forMe?.taskSid && forMe?.reservationSid) {
          const rawAttrs = forMe.taskAttributes ?? forMe.task_attributes ?? '{}';
          const created = typeof forMe.createdAt === 'number' ? forMe.createdAt : Date.now();
          const pendingSnapshot = {
            taskSid: forMe.taskSid,
            reservationSid: forMe.reservationSid,
            taskAttributes: typeof rawAttrs === 'string' ? rawAttrs : JSON.stringify(rawAttrs),
            createdAt: created,
          };
          try {
            const attrs = typeof rawAttrs === 'string' ? (rawAttrs ? JSON.parse(rawAttrs) : {}) : (rawAttrs || {}) as Record<string, unknown>;
            const phone = String(attrs.phone_number ?? attrs.phone ?? '').trim();
            const leadName = attrs.lead_name ?? attrs.leadName;
            const firstName = attrs.first_name ?? attrs.firstName;
            const lastName = attrs.last_name ?? attrs.lastName;
            const city = String(attrs.city ?? (attrs as any).taalk_city ?? '').trim();
            const lead: Lead = {
              id: String(attrs.lead_id ?? forMe.taskSid),
              leadId: String(attrs.lead_id ?? forMe.taskSid),
              name:
                (typeof leadName === 'string' && leadName.trim()) ||
                [firstName, lastName].filter(Boolean).map(String).join(' ').trim() ||
                (phone ? `Call from ${phone}` : 'Inbound Call'),
              phone,
              state: String(attrs.state ?? '').trim(),
              market: String(attrs.market ?? 'Inbound').trim() || 'Inbound',
              taalk_market: String(attrs.market ?? 'Inbound').trim() || 'Inbound',
              status: '',
              timestamp: new Date().toISOString(),
              ...(city ? { city } : {}),
            } as Lead;
            if (attrs.taalk_lead_id != null) (lead as any).taalk_lead_id = String(attrs.taalk_lead_id);
            if (attrs.lead_email != null) (lead as any).email = String(attrs.lead_email);
            if (firstName != null) (lead as any).first_name = String(firstName);
            if (lastName != null) (lead as any).last_name = String(lastName);
            inboundCallLeadRef.current = lead;
            setIncomingCallLead(lead);
            setDialerState((prev: any) => {
              const fromForDisplay = phone && !isDequeueCallerId(phone) ? phone : '';
              return {
                ...prev,
                // Don't override dialingStatus or campaignActive — inbound ringing must not block outbound. Never show 914/dequeue as caller.
                inboundCallInfo: (fromForDisplay || attrs.call_sid || forMe.taskSid) ? { from: fromForDisplay, to: '', callSid: String(attrs.call_sid ?? forMe.taskSid) } : prev.inboundCallInfo,
                inboundCallLead: lead,
              };
            });
          } catch (_) {}
          lastPendingSidsRef.current = { taskSid: pendingSnapshot.taskSid, reservationSid: pendingSnapshot.reservationSid };
          setRetainedTaskRouterPending((prev) => (prev?.reservationSid === pendingSnapshot.reservationSid ? prev : pendingSnapshot));
          setTaskRouterPending((prev) => {
            if (prev?.reservationSid === forMe.reservationSid) return prev;
            // New reservation: play ring tone so agent clearly hears "you're being offered a call"
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const playBeep = (t: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                osc.start(t);
                osc.stop(t + 0.2);
              };
              playBeep(0);
              playBeep(0.4);
            } catch (_) {}
            return pendingSnapshot;
          });
        } else {
          setTaskRouterPending(null);
          lastPendingSidsRef.current = null;
          const wouldClear = !inboundAnswerRequestedRef.current && !dialerStateRef.current.webRTCConferenceActive;
          inboundDebugLog('TaskRouter poll: no pending', { wouldClear, webRTC: dialerStateRef.current.webRTCConferenceActive, answerRequested: inboundAnswerRequestedRef.current });
          if (wouldClear) {
            setRetainedTaskRouterPending(null);
            setDialerState((prev: any) => ({
              ...prev,
              inboundCallInfo: null,
              inboundCallLead: prev.webRTCConferenceActive ? prev.inboundCallLead : null,
              dialingStatus: prev.webRTCConferenceActive ? prev.dialingStatus : 'idle',
            }));
          }
        }
      } catch {
        pollDelayMs = Math.min(pollDelayMs * 2, 15000); // back off on failure (max 15s) to avoid spam when server resets
        setLastPendingPollAt(Date.now());
        setTaskRouterPending(null);
        lastPendingSidsRef.current = null;
        const wouldClear = !inboundAnswerRequestedRef.current && !dialerStateRef.current.webRTCConferenceActive;
        inboundDebugLog('TaskRouter poll: catch, no pending', { wouldClear, webRTC: dialerStateRef.current.webRTCConferenceActive });
        if (wouldClear) {
          setRetainedTaskRouterPending(null);
          setDialerState((prev: any) => ({
            ...prev,
            inboundCallInfo: null,
            inboundCallLead: prev.webRTCConferenceActive ? prev.inboundCallLead : null,
            dialingStatus: prev.webRTCConferenceActive ? prev.dialingStatus : 'idle',
          }));
        }
      }
      scheduleNext();
    };
    poll();
    return () => {
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [authState?.user?.email, dialerState.webRTCConferenceActive, isPoweredOn, vdpOnline]);

  // When ringing: poll reservation-status so panel clears as soon as someone else takes the call (no refresh needed)
  React.useEffect(() => {
    const pending = taskRouterPending ?? retainedTaskRouterPending;
    if (!pending?.taskSid || !pending?.reservationSid) return;
    if (inboundAnswerRequestedRef.current || dialerState.webRTCConferenceActive) return;
    const taskSid = pending.taskSid;
    const reservationSid = pending.reservationSid;
    const check = async () => {
      try {
        const res = await fetch(
          `/api/twilio/taskrouter/reservation-status?taskSid=${encodeURIComponent(taskSid)}&reservationSid=${encodeURIComponent(reservationSid)}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.pending === false) {
          setTaskRouterPending(null);
          setRetainedTaskRouterPending(null);
          lastPendingSidsRef.current = null;
          inboundCallLeadRef.current = null;
          setIncomingCallLead(null);
          setDialerState((prev: any) => ({
            ...prev,
            inboundCallInfo: null,
            inboundCallLead: prev.webRTCConferenceActive ? prev.inboundCallLead : null,
            dialingStatus: prev.webRTCConferenceActive ? prev.dialingStatus : 'idle',
          }));
        }
      } catch (_) {}
    };
    check();
    const t = setInterval(check, 1500);
    return () => clearInterval(t);
  }, [taskRouterPending?.taskSid, taskRouterPending?.reservationSid, retainedTaskRouterPending?.taskSid, retainedTaskRouterPending?.reservationSid, dialerState.webRTCConferenceActive]);

  /** Play a short "incoming" ring (two beeps) when simulating a call. */
  const playDemoRingTone = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (startTime: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      };
      playBeep(0);
      playBeep(0.4);
    } catch (_) {}
  };

  /** Demo: add fake success events to the Recent Successes feed (5 lines) so the running scroll + fade is visible. */
  const handleDemoIncomingClick = async () => {
    const email = authState?.user?.email?.toLowerCase?.();
    if (!email?.includes('@') || demoInjecting) return;
    setDemoInjecting(true);
    try {
      const res = await fetch('/api/inbound/recent-successes/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agentEmail: email, count: 5 }),
      });
      if (res.ok) successViewerRefetchRef.current?.();
    } finally {
      setDemoInjecting(false);
    }
  };

  // Cleanup: Track Call Connector Pro call end on component unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // CRITICAL: Always destroy WebRTC device on page unload to prevent stale state
      try {
        const globalDevice = (window as any).twilioDevice;
        if (globalDevice && typeof globalDevice.destroy === 'function') {
          console.log('🧹 [CLEANUP] Destroying WebRTC device on page unload');
          try {
            if (typeof globalDevice.disconnectAll === 'function') {
              globalDevice.disconnectAll();
            }
            fetch('/api/agents/voice-offline', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (window as any).__webrtcAgentEmail || '' }), keepalive: true }).catch(() => {});
            if (typeof globalDevice.unregister === 'function' && 
                (globalDevice.state === 'registered' || globalDevice.state === 'ready')) {
              globalDevice.unregister();
            }
            withAllowedTwilioDeviceDestroy(() => globalDevice.destroy());
          } catch (e) {
            console.warn('⚠️ [CLEANUP] Error destroying device:', e);
          }
          (window as any).twilioDevice = null;
        }
        // Also clear module-level device
        if (device && typeof device.destroy === 'function') {
          try {
            withAllowedTwilioDeviceDestroy(() => device.destroy());
          } catch (e) {
            console.warn('⚠️ [CLEANUP] Error destroying module device:', e);
          }
          device = null;
        }
      } catch (e) {
        console.warn('⚠️ [CLEANUP] Error in device cleanup:', e);
      }
      
      // Check if there's an active call
      const hasActiveCall = dialerState.webRTCConferenceActive || 
                          dialerState.callStatus === 'connected' || 
                          dialerState.dialingStatus === 'dialing' ||
                          dialerState.dialingStatus === 'ringing';
      
      if (hasActiveCall && userEmail) {
        // Send call end event (using sendBeacon for reliability)
        const sessionId = authState?.session?.id || `session-${Date.now()}`;
        const callId = (window as any).currentCallSid || null;
        const duration = dialerState.callDuration || 0;
        
        const data = JSON.stringify({
          agentEmail: userEmail,
          sessionId: sessionId,
          callId: callId,
          duration: duration
        });
        
        // Use sendBeacon for page unload (more reliable than fetch)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/usage/ccpro-call-end', new Blob([data], { type: 'application/json' }));
        } else {
          // Fallback to fetch with keepalive
          fetch('/api/usage/ccpro-call-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(err => console.warn('Failed to track CCPro call end on unload:', err));
        }
      }
    };

    // Add beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function: send end event if call is still active when component unmounts; release token slot so user can get new token when they return
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Clear token slot when leaving dialer (send email so server can resolve when session/cookie missing)
      const releaseEmail = (window as any).__webrtcAgentEmail || userEmail || '';
      const releaseBody = JSON.stringify(releaseEmail ? { email: releaseEmail } : {});
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/twilio/release-token', new Blob([releaseBody], { type: 'application/json' }));
      } else {
        fetch(resolveServiceUrl('/api/twilio/release-token'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: releaseBody, keepalive: true }).catch(() => {});
      }
      const hasActiveCall = dialerState.webRTCConferenceActive || 
                          dialerState.callStatus === 'connected' || 
                          dialerState.dialingStatus === 'dialing' ||
                          dialerState.dialingStatus === 'ringing';
      
      if (hasActiveCall && userEmail) {
        const sessionId = authState?.session?.id || `session-${Date.now()}`;
        const callId = (window as any).currentCallSid || null;
        const duration = dialerState.callDuration || 0;
        
        const data = JSON.stringify({
          agentEmail: userEmail,
          sessionId: sessionId,
          callId: callId,
          duration: duration
        });
        
        // Use sendBeacon if available, otherwise fetch with keepalive
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/usage/ccpro-call-end', new Blob([data], { type: 'application/json' }));
        } else {
          fetch('/api/usage/ccpro-call-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(err => console.warn('Failed to track CCPro call end on unmount:', err));
        }
      }
    };
  }, [dialerState.webRTCConferenceActive, dialerState.callStatus, dialerState.dialingStatus, dialerState.callDuration, userEmail, authState?.session?.id]);

  // 🚨 CRITICAL: Auto-pause dialer when AOIntel call comes in (agent status = 'in_call')
  // When AOIntel PICK_UP event is received, backend sets agent_live_call_status to 'in_call'
  // This should immediately pause any active outbound dialing to prioritize the inbound call
  useEffect(() => {
    const hasInboundSignal =
      !!incomingConn ||
      !!taskRouterPending?.taskSid ||
      !!retainedTaskRouterPending?.taskSid ||
      !!dialerState.inboundCallLead ||
      !!dialerState.inboundCallInfo;

    // IMPORTANT: outbound calls also report "in_call".
    // Only auto-pause campaign when there is an actual inbound signal.
    if (agentStatus?.status === 'in_call' && dialerState.campaignActive && hasInboundSignal) {
      debugLog('🚨 AOIntel call detected - pausing outbound dialer automatically');
      setDialerState((prev) => ({
        ...prev,
        campaignActive: false,
        dialingStatus: 'ready'
      }));

      toast({
        title: 'Dialing Paused',
        description: 'AOIntel inbound call received - outbound dialing paused automatically',
        variant: 'default'
      });
    }
  }, [
    agentStatus?.status,
    dialerState.campaignActive,
    dialerState.inboundCallLead,
    dialerState.inboundCallInfo,
    incomingConn,
    taskRouterPending?.taskSid,
    retainedTaskRouterPending?.taskSid,
  ]);

  // ==========================================
  // ONE SIMPLE QUEUE - ALL LEADS FOR this producer
  // ==========================================
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // 🚀 LEAD PRE-LOADING CACHE for instant transitions
  const [leadPreloadOffset, setLeadPreloadOffset] = useState(0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PRELOAD_BATCH_SIZE = 20; // Pre-load 20 leads at a time
  const REFETCH_THRESHOLD = 5; // Fetch more when down to 5 leads

  // DISABLED AUTO-FETCH: Causing infinite refresh loop
  // Auto-fetch more leads when running low
  // useEffect(() => {
  //   const currentQueue = selectedMarket === 'hotleads' ? hotleadsQueue : plusLeadsQueue;
  //   
  //   if (currentQueue.length <= REFETCH_THRESHOLD && !isFetchingMore && authState?.user?.email) {
  //     debugLog(`🔄 AUTO-FETCH: Queue low (${currentQueue.length} leads), fetching more...`);
  //     setIsFetchingMore(true);
  //     
  //     loadLeadsFromAPI(true, selectedMarket).finally(() => {
  //       setIsFetchingMore(false);
  //     });
  //   }
  // }, [hotleadsQueue.length, plusLeadsQueue.length, selectedMarket, isFetchingMore, authState?.user?.email]);

  // ==========================================
  // SIMPLE QUEUE LOADER - ALL LEADS FOR producer
  // ==========================================
  const loadQueue = async (options?: { forceRefill?: boolean }) => {
    if (!authState?.user?.email) {
      debugLog('❌ No user email, cannot load queue');
      return { success: false, reason: 'MISSING_USER', statusTitle: 'Sign in required', statusMessage: 'Sign in to sync your lead queue.' };
    }

    if (!subscriptionResolved && !isLeaseDialerRoute) {
      debugLog('⏳ Subscription status pending – deferring queue load');
      return { success: false, reason: 'SUBSCRIPTION_PENDING', statusTitle: 'Checking subscription', statusMessage: 'Checking subscription status before syncing leads.' };
    }

    // CRITICAL: NEVER update queue during active calls - current lead must stay stable.
    // forceRefill is only allowed after call legs are actually down (soft stale dialing flags ignored).
    const hardCallLock =
      callState === 'on-call' ||
      dialerState.callStatus === 'connected' ||
      dialerState.webRTCConferenceActive ||
      dialerState.currentCall !== null;
    const softDialLock =
      dialerState.dialingStatus === 'connected' ||
      dialerState.dialingStatus === 'dialing' ||
      dialerState.dialingStatus === 'ringing';
    const isCallActive = hardCallLock || softDialLock;

    if (isCallActive) {
      if (options?.forceRefill && !hardCallLock) {
        debugLog(
          '🔄 LOAD QUEUE: forceRefill allowed post-call (soft dialing flag still settling)'
        );
      } else {
        debugLog('🔒 LOAD QUEUE: LOCKED during active call - queue update deferred');
        return { success: false, reason: 'ACTIVE_CALL', statusTitle: 'Call in progress', statusMessage: 'Queue sync is paused while a call is active.' };
      }
    }

    if (shouldGateOutbound) {
      debugLog('ℹ️ Outbound access disabled – keeping outbound queues empty');
      setHotleadQueue([]);
      setPlusLeadsQueue([]);
      setAllMyLeadsEligible([]);
      setMyLeadsQueue([]);
      setQueuePositions({ hotlead: 0, plus: 0, 'my-leads': 0 });
      setDialerState(prev => ({
        ...prev,
        leads: [],
        availableLeads: [],
        currentIndex: 0,
        currentLeadIndex: 0,
        availableLeadsCount: 0,
        viewedLead: prev.viewedLead,
      }));
      return {
        success: false,
        reason: 'SUBSCRIPTION_INACTIVE',
        statusTitle: 'Subscription inactive',
        statusMessage: 'Your Call Connector Pro subscription is not active. Reactivate to sync leads.',
      };
    }

    const userEmail = authState.user.email;
    const leadPackCacheKey = `ccp-lead-pack:${String(userEmail || '').toLowerCase().trim()}`;
    // Keep debug flag local to loadQueue to avoid temporal-dead-zone access
    // if this function is invoked during render-time query startup.
    const queueDebugForLoad =
      typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('queueDebug') === '1' ||
        localStorage.getItem('QUEUE_DEBUG') === '1' ||
        (window as any).__QUEUE_DEBUG === true);
    const queueTraceId = `uiq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const queueDebug = (stage: string, payload: Record<string, any>) => {
      if (!queueDebugForLoad) return;
      console.log(`🔎 QUEUE TRACE ${queueTraceId} :: ${stage}`, payload);
    };
    setIsLoadingQueue(true);
    
    debugLog(`🔄 LOADING ALL LEADS for ${userEmail}`);
    debugLog(`🎭 DEMO MODE CHECK: isCCPDemo=${isCCPDemo}, isDemoMode=${isDemoMode}, demoProduct=${demoProduct}`);
    
    try {
      // Load leads (assigned leads with cnresolution=pending)
      // Email-only lead ownership for this endpoint.
      const params = new URLSearchParams({ userEmail });
      if (isCCPDemo) params.set('demo', 'true');
      if (queueDebugForLoad) params.set('debug', '1');
      const apiUrl = isLeaseDialerRoute
        ? `/api/leasedialer/sync?${params}`
        : `/api/outbound-dialer/leads?${params}`;
      debugLog(`🎭 DEMO MODE: Fetching from ${apiUrl}`);
      queueDebug('request', { apiUrl, activeQueueTab, forceRefill: !!options?.forceRefill });
      const response = await apiRequest('GET', apiUrl, undefined, userEmail);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (isLeaseDialerRoute) {
          return {
            success: false,
            reason: data?.reason || `HTTP_${response.status}`,
            statusTitle: data?.statusTitle || 'Queue sync failed',
            statusMessage: data?.statusMessage || data?.error || `Leasedialer sync failed with status ${response.status}.`,
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      if (isLeaseDialerRoute && data?.mode !== 'leasedialer_v2') {
        throw new Error('Invalid leasedialer response mode');
      }
      const apiLeads = Array.isArray(data?.leads) ? data.leads : [];
      try {
        if (apiLeads.length > 0) {
          localStorage.setItem(
            leadPackCacheKey,
            JSON.stringify({ ts: Date.now(), leads: apiLeads }),
          );
        }
      } catch {}
      const normalizedUserEmail = String(userEmail || '').toLowerCase().trim();
      queueDebug('api-response', {
        status: response.status,
        leadCount: apiLeads.length,
        apiDebug: data?.debug || null,
      });
      setLastApiLeadCount(apiLeads.length);
      setLastApiNonPendingCount(
        apiLeads.filter((l: any) => String(l?.cnresolution ?? '').toLowerCase().trim() !== 'pending').length
      );
      setLastApiNonOwnedCount(
        apiLeads.filter((l: any) => String(l?.cn_email || '').toLowerCase().trim() !== normalizedUserEmail).length
      );
      debugLog(`✅ API RESPONSE: ${data.leads?.length || 0} leads assigned to ${userEmail}`);
      if (queueDebugForLoad) {
        console.log('🔎 AO QUEUE DEBUG: apiLeads (full objects)', apiLeads);
        console.table(
          apiLeads.map((lead: any, index: number) => ({
            idx: index + 1,
            id: lead?.id,
            taalk_lead_id: lead?.taalk_lead_id,
            name: `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim(),
            phone: lead?.phone,
            cn_email: lead?.cn_email,
            cnresolution: lead?.cnresolution,
            taalk_market: lead?.taalk_market,
            market: lead?.market,
            priority_score: lead?.priority_score,
            state: lead?.state,
          }))
        );
      }
      
      
      // AUTO-ASSIGNMENT WEBHOOK: Show notification if webhook was sent
      if (data.webhookSent && data.needsMoreLeads) {
        const assignedCount = data.leadsAssigned || 0;
        const responseData = data.webhookResponse;
        debugLog(`📤 AUTO-ASSIGNMENT: Webhook sent for ${userEmail} - ${assignedCount} leads assigned`);
        
        toast({
          title: assignedCount > 0 ? "✅ Queue Synced" : "🔄 Syncing Queue",
          description: assignedCount > 0 
            ? `Lead sync completed. Markets: ${responseData?.producerMarkets?.join(', ') || 'Various'}`
            : "Checking for available leads...",
          duration: 7000
        });
      }
      
      if (data.leads && data.leads.length > 0) {
        // Convert leads to display format - pass through ALL data
        const allLeads = data.leads.map((lead: any) => ({
          ...lead, // Pass through everything (includes taalk_lead_id from masterlead row)
          id: lead.id,
          name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
          phone: lead.phone,
          // masterlead PK for UI + APIs; Taalk external id stays on taalk_lead_id (Planet links use that separately)
          leadId: lead.id ?? lead.taalk_lead_id ?? lead.lead_id,
          market: lead.taalk_market || lead.market || 'Unknown',
          isHotLead: lead.is_hot_lead || lead.isHotLead || false,
          priority: lead.priority_score || 'normal'
        }));
        
        // FTC filtering now done by API - leads returned are already within 8am-9pm in lead's timezone
        const convertedLeads = allLeads;
        
        // All leads go into regular flow (AOIntel leads automatically move to agent's intown box)
        const regularLeads = convertedLeads;
        queueDebug('post-convert', {
          allLeads: allLeads.length,
          regularLeads: regularLeads.length,
          plusCandidates: regularLeads.filter((lead: any) => {
            const taalkMarket = String(lead.taalk_market || '').toLowerCase().trim();
            const market = String(lead.market || '').toLowerCase().trim();
            return taalkMarket.includes('plus') || market.includes('plus');
          }).length,
          nonPlusCandidates: regularLeads.filter((lead: any) => {
            const taalkMarket = String(lead.taalk_market || '').toLowerCase().trim();
            const market = String(lead.market || '').toLowerCase().trim();
            return !(taalkMarket.includes('plus') || market.includes('plus'));
          }).length,
        });
        
        // AO Queue: keep ownership from API, but exclude leads outside FTC call window
        // so frontend counts/queue reflect what is callable right now.
        const getLeadRecencyMs = (lead: any): number => {
          const stamp = lead?.updated_at || lead?.assigned_date || lead?.created_at || 0;
          const ts = new Date(stamp).getTime();
          return Number.isFinite(ts) ? ts : 0;
        };
        const sortByRecencyThenId = (a: any, b: any): number => {
          const timeDiff = getLeadRecencyMs(b) - getLeadRecencyMs(a);
          if (timeDiff !== 0) return timeDiff;
          return (Number(b?.id) || 0) - (Number(a?.id) || 0);
        };

        const hotLeads = regularLeads
          .filter((lead: any) => {
            const taalkMarket = String(lead.taalk_market || '').toLowerCase().trim();
            const market = String(lead.market || '').toLowerCase().trim();
            const isPlusLead = taalkMarket.includes('plus') || market.includes('plus');
            if (isPlusLead) return false;
            return isLeadFtcCallable(lead);
          })
          .sort(sortByRecencyThenId);

        if (queueDebugForLoad) {
          console.log('🔎 AO QUEUE DEBUG: hotLeads (full objects)', hotLeads);
          console.table(
            hotLeads.map((lead: any, index: number) => ({
              idx: index + 1,
              id: lead?.id,
              taalk_lead_id: lead?.taalk_lead_id,
              name: `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim(),
              phone: lead?.phone,
              cn_email: lead?.cn_email,
              cnresolution: lead?.cnresolution,
              taalk_market: lead?.taalk_market,
              market: lead?.market,
              priority_score: lead?.priority_score,
              state: lead?.state,
            }))
          );
        }
        // For plus leads, filter to show only pending Plus Leads that the user owns
        const currentUserEmail = authState?.user?.email?.toLowerCase();
        const plusLeads = regularLeads.filter((lead: any) => {
          // Check if it's a hotlead first
          if (isLeadHotlead(lead)) {
            if (lead.id === 566655) {
              debugLog(`❌ Lead 566655 filtered: is hotlead`);
            }
            return false;
          }
          
          // 🔥 CRITICAL: Check if lead is actually a Plus Lead (market contains "plus")
          const taalkMarket = (lead.taalk_market || '').toLowerCase().trim();
          const market = (lead.market || '').toLowerCase().trim();
          const isPlusLead = taalkMarket.includes('plus') || market.includes('plus');
          
          if (!isPlusLead) {
            if (lead.id === 566655) {
              debugLog(`❌ Lead 566655 filtered: not a plus lead`, { taalkMarket, market });
            }
            return false; // Not a plus lead
          }
          
          // Plus queue: show leads where associate_id OR Taalk_associate_id matches user (server already filters by associate_id + no true resolution).
          const leadAssociateId = lead.associate_id ?? lead.taalk_associate_id ?? lead.assigned_to ?? lead.assignedTo;
          const userProfileAssociateId = (authState?.profile as any)?.associate_id;
          const assignedByProfileOrEmail =
            (leadAssociateId != null && userProfileAssociateId != null && String(leadAssociateId) === String(userProfileAssociateId)) ||
            (lead.assigned_email && lead.assigned_email.toLowerCase() === currentUserEmail) ||
            (lead.agent_email && lead.agent_email.toLowerCase() === currentUserEmail) ||
            (lead.cn_email && lead.cn_email.toLowerCase() === currentUserEmail);
          // If profile has no associate_id, trust API (lead is in response = server said it's ours)
          const isAssignedToUser = userProfileAssociateId != null ? assignedByProfileOrEmail : true;
          
          // Plus queue allows pending OR null/empty resolution.
          const normalizedResolution = String(lead.cnresolution ?? '').toLowerCase().trim();
          const isPending = normalizedResolution === 'pending';
          const isNullResolution = lead.cnresolution == null || normalizedResolution === '' || normalizedResolution === 'null';
          const isPlusResolutionEligible = isPending || isNullResolution;
          
          const isFtcCallable = isLeadFtcCallable(lead);
          const shouldInclude = isPlusResolutionEligible && isAssignedToUser && isFtcCallable;
          
          // Debug logging for this specific lead
          if (lead.id === 566655) {
            debugLog(`🔍 Lead 566655 Plus Lead Filter Check:`, {
              isPlusLead,
              isPending,
              isNullResolution,
              isPlusResolutionEligible,
              isAssignedToUser,
              isFtcCallable,
              leadAssociateId,
              userProfileAssociateId,
              assigned_email: lead.assigned_email,
              agent_email: lead.agent_email,
              cn_email: lead.cn_email,
              userEmail: currentUserEmail,
              cnresolution: lead.cnresolution,
              shouldInclude,
              inRegularLeads: true
            });
          }
          
          if (isPlusLead && !shouldInclude) {
            debugLog(`🔍 Plus Lead ${lead.id} filtered out:`, {
              isPending,
              isNullResolution,
              isPlusResolutionEligible,
              isAssignedToUser,
              isFtcCallable,
              leadAssociateId,
              userProfileAssociateId,
              assigned_email: lead.assigned_email,
              agent_email: lead.agent_email,
              cn_email: lead.cn_email,
              userEmail: currentUserEmail,
              cnresolution: lead.cnresolution
            });
          }
          
          return shouldInclude;
        })
        .sort(sortByRecencyThenId);
        
        debugLog(`🟢 PLUS LEADS QUEUE: Found ${plusLeads.length} plus leads for ${currentUserEmail}`, {
          totalRegularLeads: regularLeads.length,
          plusLeads: plusLeads.map((l: any) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`, market: l.taalk_market || l.market, cn_email: l.cn_email }))
        });
        
        // 🔍 DEBUG: Check if lead 566655 is in regularLeads
        const lead566655 = regularLeads.find((l: any) => l.id === 566655);
        if (lead566655) {
          debugLog(`✅ Lead 566655 FOUND in regularLeads:`, {
            id: lead566655.id,
            taalk_market: lead566655.taalk_market,
            market: lead566655.market,
            cn_email: lead566655.cn_email,
            cnresolution: lead566655.cnresolution,
            is_hot_lead: lead566655.is_hot_lead,
            aointel: lead566655.aointel,
            inPlusLeads: plusLeads.some((l: any) => l.id === 566655)
          });
        } else {
          debugLog(`❌ Lead 566655 NOT FOUND in regularLeads. Checking convertedLeads...`);
          const leadInConverted = convertedLeads.find((l: any) => l.id === 566655);
          if (leadInConverted) {
            debugLog(`✅ Lead 566655 FOUND in convertedLeads but NOT in regularLeads:`, {
              id: leadInConverted.id,
              aointel: leadInConverted.aointel,
              cnresolution: leadInConverted.cnresolution,
              reason: 'Filtered out by regularLeads filter'
            });
          } else {
            debugLog(`❌ Lead 566655 NOT FOUND in convertedLeads either. Not fetched from API?`);
          }
        }

        // My Leads: cn_email only (no associate_id). Only show leads assigned to this agent by email.
        // Resolve selected pool locally to avoid any render-order TDZ on first queue bootstrap.
        const selectedLeadPoolForLoad: 'all' | 'intown' | 'road-trip' | 'list' | 'lapse' = (() => {
          try {
            const saved = localStorage.getItem('ccp-selected-lead-pool');
            if (
              saved === 'all' ||
              saved === 'intown' ||
              saved === 'road-trip' ||
              saved === 'list' ||
              saved === 'lapse'
            ) {
              return saved;
            }
          } catch {}
          return 'all';
        })();
        const normalizeLeadBox = (v: string) => (v || '').toLowerCase().replace(/[- ]/g, '').trim();
        const canonicalLeadBox = (normalized: string): string => {
          if (!normalized) return '';
          if (normalized === 'listleadpool' || normalized === 'list') return 'list';
          if (normalized === 'lapseleadpool' || normalized === 'lapse' || normalized === 'lapsed') return 'lapse';
          if (normalized === 'intown') return 'intown';
          if (normalized === 'roadtrip') return 'roadtrip';
          return normalized;
        };
        const cnEmailMatches = (lead: any) => (lead.cn_email || '').toLowerCase().trim() === (userEmail || '').toLowerCase().trim();
        const inSelectedBox = (lead: any) => {
          const aoLeadBox = lead.ao_lead_box || lead.aoLeadBox;
          if (selectedLeadPoolForLoad === 'all') return true;
          const leadCanon = canonicalLeadBox(normalizeLeadBox(aoLeadBox || ''));
          const poolCanon = canonicalLeadBox(normalizeLeadBox(selectedLeadPoolForLoad));
          return leadCanon !== '' && leadCanon === poolCanon;
        };
        const myLeadsEligible = regularLeads.filter((lead: any) => {
          const resolution = String(lead.cnresolution ?? '').toLowerCase().trim();
          if (resolution !== 'pending') return false;
          if ((lead.cn_email || '').toLowerCase().trim() !== (userEmail || '').toLowerCase().trim()) return false;
          return isLeadFtcCallable(lead);
        });
        // cn_email matches (hot leads assigned to this agent) ALWAYS first, no matter what
        const cnEmailLeads = myLeadsEligible
          .filter((lead: any) => cnEmailMatches(lead))
          .sort(sortByRecencyThenId);
        const otherLeads = myLeadsEligible.filter((lead: any) => !cnEmailMatches(lead));
        const boxLeads = otherLeads
          .filter((lead: any) => inSelectedBox(lead))
          .sort(sortByRecencyThenId);
        const mergedMyLeads = [...cnEmailLeads, ...boxLeads];
        queueDebug('queue-split', {
          hotLeads: hotLeads.length,
          plusLeads: plusLeads.length,
          myLeadsEligible: myLeadsEligible.length,
          mergedMyLeads: mergedMyLeads.length,
          activeQueueTab,
          selectedLeadPool: selectedLeadPoolForLoad,
        });
        
        // AO Queue restored: Hot Leads + My Leads + Plus
        setHotleadQueue(hotLeads);
        setPlusLeadsQueue(plusLeads);
        setAllMyLeadsEligible(myLeadsEligible);
        setMyLeadsQueue(mergedMyLeads);
        const finalActiveTab = activeQueueTab;

        const nextHotLeadIndex = hotLeads.length === 0 ? 0 : Math.min(queuePositions.hotlead ?? 0, hotLeads.length - 1);
        const nextPlusIndex = plusLeads.length === 0 ? 0 : Math.min(queuePositions.plus ?? 0, plusLeads.length - 1);
        const nextMyLeadsIndex = mergedMyLeads.length === 0 ? 0 : Math.min(queuePositions['my-leads'] ?? 0, mergedMyLeads.length - 1);

        setQueuePositions({
          hotlead: nextHotLeadIndex,
          plus: nextPlusIndex,
          'my-leads': nextMyLeadsIndex,
        });

        // Determine selected queue: AO Queue (Hot Leads), My Leads, or Plus
        let selectedQueue: any[] = [];
        let selectedIndex = 0;
        if (finalActiveTab === 'hotlead') {
          selectedQueue = hotLeads;
          selectedIndex = nextHotLeadIndex;
        } else if (finalActiveTab === 'my-leads') {
          selectedQueue = mergedMyLeads;
          selectedIndex = nextMyLeadsIndex;
        } else {
          selectedQueue = plusLeads;
          selectedIndex = nextPlusIndex;
        }

        // Queue already filtered to currently FTC-callable leads for accurate frontend counts.
        const finalQueue = selectedQueue;
        const ftcDroppedCount = 0;
        queueDebug('selected-queue', {
          activeQueueTab: finalActiveTab,
          selectedQueueCount: selectedQueue.length,
          ftcFilteredQueueCount: finalQueue.length,
          ftcDroppedCount,
          selectedIndexBeforeNormalize: selectedIndex,
          selectedSampleIds: selectedQueue.slice(0, 10).map((l: any) => l?.id ?? l?.taalk_lead_id).filter(Boolean),
          filteredSampleIds: finalQueue.slice(0, 10).map((l: any) => l?.id ?? l?.taalk_lead_id).filter(Boolean),
        });

        setDialerState(prev => {
          // CRITICAL: Check for active call - if active, DO NOT replace leads at all
          const hasActiveCall = prev.dialingStatus === 'connected' || 
                                prev.dialingStatus === 'dialing' ||
                                prev.callStatus === 'connected' ||
                                prev.webRTCConferenceActive ||
                                prev.currentCall !== null;
          
          // ABSOLUTE CRITICAL: During active calls, NEVER replace a populated leads array.
          // But if the current array is empty and fetch returned data, allow a one-time
          // bootstrap so agents do not stay stuck on a blank queue after login/reconnect.
          if (hasActiveCall && prev.availableLeads.length > 0 && !isLeaseDialerRoute) {
            debugLog('🔒 LOAD QUEUE: Active call detected - PRESERVING ALL EXISTING LEADS (not replacing)');
            debugLog(`   Current leads count: ${prev.availableLeads.length}`);
            debugLog(`   Current lead index: ${prev.currentLeadIndex}`);
            // DO NOT UPDATE STATE - preserve everything as-is
            return prev;
          }
          
          // No active call - safe to update leads
          const currentLead = prev.availableLeads[prev.currentLeadIndex];
          const currentLeadId = currentLead?.id ?? currentLead?.taalk_lead_id;
          const preserveCurrentLead = isLeaseDialerRoute && hasActiveCall && prev.availableLeads.length > 0;
          
          // Find same lead in new queue by ID - keep it on screen
          let preserveIndex = selectedIndex;
          if (currentLeadId != null && selectedQueue.length > 0) {
            const idx = selectedQueue.findIndex((l: any) => 
              String(l?.id) === String(currentLeadId) || String(l?.taalk_lead_id) === String(currentLeadId)
            );
            if (idx >= 0) preserveIndex = idx;
          }
          
          queueDebug('pre-bind', {
            prevAvailableLeads: prev.availableLeads.length,
            prevCurrentLeadIndex: prev.currentLeadIndex,
            finalQueueCount: finalQueue.length,
            preserveIndexCandidate: preserveIndex,
            currentLeadId,
          });
          // Adjust preserveIndex if the current lead was filtered out
          let finalIndex = preserveIndex;
          let finalQueueForState = finalQueue;
          if (preserveCurrentLead) {
            const incomingWithoutCurrent = finalQueue.filter((lead: any) =>
              String(lead?.id) !== String(currentLead?.id) &&
              String(lead?.taalk_lead_id) !== String(currentLead?.taalk_lead_id)
            );
            finalQueueForState = [currentLead, ...incomingWithoutCurrent].filter(Boolean);
            finalIndex = 0;
          }
          if (preserveIndex >= finalQueue.length) {
            finalIndex = finalQueue.length > 0 ? 0 : 0;
          } else {
            // Check if the preserved lead is still in the filtered queue
            const preservedLead = selectedQueue[preserveIndex];
            if (preservedLead) {
              const stillExists = finalQueue.some((l: any) => 
                String(l?.id) === String(preservedLead?.id) || String(l?.taalk_lead_id) === String(preservedLead?.taalk_lead_id)
              );
              if (!stillExists) {
                finalIndex = finalQueue.length > 0 ? 0 : 0;
              } else {
                const newIdx = finalQueue.findIndex((l: any) => 
                  String(l?.id) === String(preservedLead?.id) || String(l?.taalk_lead_id) === String(preservedLead?.taalk_lead_id)
                );
                if (newIdx >= 0) finalIndex = newIdx;
              }
            }
          }

          const loadResult = {
            ...prev,
            leads: finalQueueForState,
            availableLeads: finalQueueForState,
            currentIndex: 0,
            currentLeadIndex: finalIndex,
            availableLeadsCount: finalQueueForState.length,
            viewedLead: null,
          };
          return loadResult;
        });
        
        debugLog(`✅ QUEUE LOADED: ${convertedLeads.length} leads`);
        debugLog(`🔍 First 3 leads:`, convertedLeads.slice(0, 3).map(l => ({
          name: l.name,
          phone: l.phone,
          cnresolution: l.cnresolution,
          cn_email: l.cn_email,
          taalk_lead_id: l.taalk_lead_id
        })));
        if (isLeaseDialerRoute && convertedLeads.length > 0 && hotLeads.length === 0 && activeQueueTab === 'hotlead') {
          return {
            success: false,
            reason: 'NO_CALLABLE_LEADS',
            statusTitle: 'No callable leads right now',
            statusMessage:
              'Queued rows exist, but none are currently callable (ownership/resolution/window filters). Queue refill is required before dialing can continue.',
          };
        }
        return { success: true, reason: data?.reason || null, statusTitle: null, statusMessage: null, lead: finalQueue[0] || null };
      } else {
        debugLog(`❌ NO LEADS FOUND for ${userEmail}`);
        queueDebug('api-empty', {
          message: 'API returned no leads',
          activeQueueTab,
          responseKeys: Object.keys(data || {}),
        });
        if (isLeaseDialerRoute) {
          const existingCount = dialerStateRef.current?.availableLeads?.length || 0;
          if (existingCount > 0) {
            return {
              success: false,
              reason: data?.reason || 'QUEUE_WARMING',
              statusTitle: data?.statusTitle || 'Building queue',
              statusMessage:
                data?.statusMessage ||
                data?.error ||
                'Keeping your current leads while the leasedialer refreshes in the background.',
              lead: dialerStateRef.current.availableLeads[dialerStateRef.current.currentLeadIndex || 0] || null,
            };
          }
        }
        setHotleadQueue([]);
        setPlusLeadsQueue([]);
        setAllMyLeadsEligible([]);
        setAoiIntelQueue([]);
        setQueuePositions({ hotlead: 0, plus: 0, 'my-leads': 0, aointel: 0 });
        setDialerState(prev => ({
          ...prev,
          leads: [],
          availableLeads: [],
          currentIndex: 0,
          currentLeadIndex: 0,
          availableLeadsCount: 0,
          viewedLead: null,
        }));
        return {
          success: Boolean(data?.success),
          reason: data?.reason || (isLeaseDialerRoute ? 'NO_ELIGIBLE_LEADS' : 'NO_LEADS'),
          statusTitle:
            data?.statusTitle ||
            (isLeaseDialerRoute
              ? (String(data?.reason || '').toUpperCase() === 'NO_CALLABLE_LEADS'
                  ? 'No callable leads right now'
                  : 'No eligible leads right now')
              : 'No leads found'),
          statusMessage:
            data?.statusMessage ||
            data?.error ||
            (isLeaseDialerRoute
              ? (String(data?.reason || '').toUpperCase() === 'NO_CALLABLE_LEADS'
                  ? 'Queue rows exist, but none are callable after ownership/resolution/calling-window checks.'
                  : 'No queued lead is available for your market/state filters right now.')
              : 'No leads are available in this queue right now.'),
        };
      }
    } catch (error) {
      console.error(`❌ Failed to load queue:`, error);
      if (isLeaseDialerRoute) {
        // Hard rule for /leasedialer:
        // never hydrate from generic cached lead packs, because those may contain legacy assigned leads.
        const existingCount = dialerStateRef.current?.availableLeads?.length || 0;
        if (existingCount > 0) {
          return {
            success: false,
            reason: 'SYNC_FAILED',
            statusTitle: 'Queue sync failed',
            statusMessage: error instanceof Error ? error.message : 'The leasedialer sync request failed.',
            lead: dialerStateRef.current.availableLeads[dialerStateRef.current.currentLeadIndex || 0] || null,
          };
        }
        setHotleadQueue([]);
        setPlusLeadsQueue([]);
        setAllMyLeadsEligible([]);
        setAoiIntelQueue([]);
        setQueuePositions({ hotlead: 0, plus: 0, 'my-leads': 0, aointel: 0 });
        setDialerState(prev => ({
          ...prev,
          leads: [],
          availableLeads: [],
          currentIndex: 0,
          currentLeadIndex: 0,
          availableLeadsCount: 0,
          viewedLead: null,
        }));
        return {
          success: false,
          reason: 'SYNC_FAILED',
          statusTitle: 'Queue sync failed',
          statusMessage: error instanceof Error ? error.message : 'The leasedialer sync request failed.',
        };
      }
      try {
        const cachedRaw = localStorage.getItem(leadPackCacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          const cachedLeads = Array.isArray(parsed?.leads) ? parsed.leads : [];
          if (cachedLeads.length > 0) {
            const hydrated = cachedLeads.map((lead: any) => ({
              ...lead,
              id: lead.id,
              name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
              phone: lead.phone,
              leadId: lead.id ?? lead.taalk_lead_id ?? lead.lead_id,
              market: lead.taalk_market || lead.market || 'Unknown',
              isHotLead: lead.is_hot_lead || lead.isHotLead || false,
              priority: lead.priority_score || 'normal',
            }));
            const hotLeads = hydrated
              .filter((lead: any) => {
                const taalkMarket = String(lead.taalk_market || '').toLowerCase().trim();
                const market = String(lead.market || '').toLowerCase().trim();
                return !(taalkMarket.includes('plus') || market.includes('plus'));
              })
              .sort((a: any, b: any) => {
                const aTime = new Date(a.updated_at || a.assigned_date || a.created_at || 0).getTime();
                const bTime = new Date(b.updated_at || b.assigned_date || b.created_at || 0).getTime();
                if (bTime !== aTime) return bTime - aTime;
                return (Number(b.id) || 0) - (Number(a.id) || 0);
              });
            const plusLeads = hydrated.filter((lead: any) => {
              const taalkMarket = String(lead.taalk_market || '').toLowerCase().trim();
              const market = String(lead.market || '').toLowerCase().trim();
              return taalkMarket.includes('plus') || market.includes('plus');
            });
            setHotleadQueue(hotLeads);
            setPlusLeadsQueue(plusLeads);
            setDialerState(prev => ({
              ...prev,
              leads: activeQueueTab === 'plus' ? plusLeads : hotLeads,
              availableLeads: activeQueueTab === 'plus' ? plusLeads : hotLeads,
              currentIndex: 0,
              currentLeadIndex: 0,
              availableLeadsCount: activeQueueTab === 'plus' ? plusLeads.length : hotLeads.length,
            }));
            toast({
              title: 'Loaded cached lead pack',
              description: 'Using last saved desktop lead pack while reconnecting.',
              duration: 3500,
            });
            return;
          }
        }
      } catch {}
      setDialerState(prev => ({
        ...prev,
        leads: [],
        availableLeads: [],
        currentIndex: prev.currentIndex,
        currentLeadIndex: prev.currentLeadIndex,
        availableLeadsCount: 0
      }));
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleConnectIgniteQueue = async (agentEmail: string) => {
    const response = await apiRequest(
      'POST',
      '/api/leads/ignite',
      { agentEmail },
      agentEmail,
    );
    return response.json();
  };

  const handleManualLeadSync = async () => {
    const agentEmail = String(currentUserEmail || "").trim().toLowerCase();
    if (!agentEmail) {
      toast({
        title: 'Sign in required',
        description: 'Login is required to request lead sync.',
        variant: 'destructive',
      });
      return;
    }

    if (isManualLeadSyncing) return;
    setIsManualLeadSyncing(true);
    try {
      await apiRequest(
        'POST',
        '/api/leads/signal-online-and-request',
        { agentEmail, status: 'available', queue: 'hotlead' },
        agentEmail,
      );
      await loadQueue({ forceRefill: true });
      // One more pass after queue warmup settles.
      setTimeout(() => {
        loadQueue({ forceRefill: true }).catch(() => undefined);
      }, 2000);
      toast({
        title: 'Lead sync requested',
        description: 'Signal sent. Queue is refreshing now.',
        duration: 3000,
      });
    } catch (error) {
      console.error('❌ Manual lead sync failed:', error);
      toast({
        title: 'Lead sync failed',
        description: 'Could not request lead sync. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsManualLeadSyncing(false);
    }
  };

  const triggerAutoIgniteForEmptyQueue = async (agentEmail: string) => {
    const normalizedEmail = String(agentEmail || '').toLowerCase().trim();
    if (!normalizedEmail) return false;

    const now = Date.now();
    const cooldownMs = 30_000;
    if (autoIgniteInFlightRef.current) return false;
    if (now - lastAutoIgniteAtRef.current < cooldownMs) return false;

    autoIgniteInFlightRef.current = true;
    lastAutoIgniteAtRef.current = now;

    try {
      await handleConnectIgniteQueue(normalizedEmail);
      toast({
        title: 'Requesting leads',
        description: 'Queue refill started automatically. Try Start Dialing again in a few seconds.',
        duration: 3500,
      });

      // Give ignite job a moment, then refresh queue.
      setTimeout(() => {
        loadQueue({ forceRefill: true }).catch(() => {});
      }, 2500);
      setTimeout(() => {
        loadQueue({ forceRefill: true }).catch(() => {});
      }, 7000);
      return true;
    } catch (error) {
      console.error('❌ Auto-ignite failed for empty queue:', error);
      toast({
        title: 'Lead request failed',
        description: 'Could not auto-request leads. Please try again in a few seconds.',
        variant: 'destructive',
      });
      return false;
    } finally {
      autoIgniteInFlightRef.current = false;
    }
  };

  // DISABLED: Process plus leads data - preventing auto-refresh from overwriting local state
  // useEffect(() => {
  //   if (plusLeadsData?.success && plusLeadsData?.leads) {
  //     const loadedPlusLeads = plusLeadsData.leads.map((lead: any) => ({
  //       id: lead.id,
  //       name: lead.name,
  //       phone: lead.phone,
  //       leadId: lead.leadId,
  //       market: lead.market || 'Unknown',
  //       state: lead.state || 'Unknown',
  //       city: lead.city || '',
  //       email: lead.email || '',
  //       isHotLead: lead.isHotLead || false,
  //       priority: lead.priority || 'normal'
  //     }));
  //     setPlusLeadsQueue(loadedPlusLeads);
  //     debugLog(`🔥 PLUS QUEUE AUTO-REFRESHED: ${loadedPlusLeads.length} leads`);
  //   }
  // }, [plusLeadsData]);

  // DISABLED: Process hotleads data - preventing auto-refresh from overwriting local state
  // useEffect(() => {
  //   if (hotleadsData?.success && hotleadsData?.leads) {
  //     const previousCount = hotleadsQueue.length;
  //     const newCount = hotleadsData.leads.length;
  //     
  //     const loadedHotLeads = hotleadsData.leads.map((lead: any) => ({
  //       id: lead.id,
  //       name: lead.name,
  //       phone: lead.phone,
  //       leadId: lead.leadId,
  //       market: lead.market || 'Unknown',
  //       state: lead.state || 'Unknown',
  //       city: lead.city || '',
  //       email: lead.email || '',
  //       isHotLead: lead.isHotLead || false,
  //       priority: lead.priority || 'normal'
  //     }));
  //     setHotleadsQueue(loadedHotLeads);
  //     
  //     // Show notification for new hotleads (only after initial load)
  //     if (previousCount > 0 && newCount > previousCount) {
  //       const newHotleadsCount = newCount - previousCount;
  //       debugLog(`🔥 NEW HOTLEADS DETECTED: ${newHotleadsCount} new hotleads added automatically`);
  //       toast({
  //         title: "🔥 New Hotleads Available!",
  //         description: `${newHotleadsCount} new hotlead${newHotleadsCount > 1 ? 's' : ''} automatically loaded`,
  //         duration: 5000,
  //       });
  //     }
  //     
  //     debugLog(`🔥 HOTLEAD QUEUE AUTO-REFRESHED: ${loadedHotLeads.length} leads (was: ${previousCount})`);
  //   }
  // }, [hotleadsData, hotleadsQueue.length, toast]);

  // Queue updates are handled by loadQueue() function - no need for this useEffect anymore

  // Separate state to track when PSTN actually answers (not just when call is initiated)
  const [pstnAnswered, setPstnAnswered] = useState(false);
  
  // Track if 60-second webhook timer has been started for current call
  const [webhookTimerStarted, setWebhookTimerStarted] = useState(false);
  // Store timer ID in ref so it persists across re-renders
  const webhookTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Campaign Manager integration state
  const [activeCampaign, setActiveCampaign] = useState<any>(null);

  // Handle campaign selection from Campaign Manager
  const handleCampaignSelect = async (campaign: any) => {
    debugLog('🎯 Campaign selected:', campaign);
    setActiveCampaign(campaign);

    if (campaign) {
      // Fetch leads for this campaign
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/leads?agentEmail=${authState?.user?.email}`);
        const data = await response.json();

        if (data.success && data.leads) {
          // Convert Supabase masterlead format to Lead format
          const campaignLeads = data.leads.map((lead: any, index: number) => ({
            id: lead.id || lead.phone,
            leadId: lead.id, // Use database ID only
            name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
            firstName: lead.first_name || '',
            lastName: lead.last_name || '',
            phone: lead.phone,
            email: lead.email || '',
            city: lead.city || '',
            state: lead.state || '',
            market: lead.taalk_market || 'Unknown',
            source: campaign.campaignType === 'smart' ? 'Smart Campaign' : 'Custom Pack',
            lastContacted: lead.masterlead_last_contacted || null,
            disposition: lead.cnresolution || 'pending',
            notes: lead.notes || '',
            beneficiary: lead.taalk_beneficiary && lead.taalk_beneficiary !== 'null' ? lead.taalk_beneficiary : '',
            relationship: lead.taalk_relationship && lead.taalk_relationship !== 'null' ? lead.taalk_relationship : '',
            referredBy: lead.taalk_reffered && lead.taalk_reffered !== 'null' ? lead.taalk_reffered : '',
            sponsorOrg: lead.taalk_sponsor_org && lead.taalk_sponsor_org !== 'null' ? lead.taalk_sponsor_org : '',
            groupName: lead.taalk_groupname && lead.taalk_groupname !== 'null' ? lead.taalk_groupname : '',
            secretKey: lead.taalk_secretkey || lead.taalk_secretKey || lead.Taalk_secretkey || lead.Taalk_secretKey || lead.secretKey || '',
            groupCode: lead.taalk_group_code || '',
            isHotLead: lead.taalk_market === 'Hot Lead Campaign',
            priority: lead.taalk_market === 'Hot Lead Campaign' ? 'high' : 'normal'
          }));

          // Update dialer state with campaign leads
          setDialerState(prev => ({
            ...prev,
            availableLeads: campaignLeads,
            currentLeadIndex: 0,
            campaignActive: true
          }));

          toast({
            title: "Campaign Activated",
            description: `Loaded ${campaignLeads.length} leads from ${campaign.campaignName}`,
          });
        }
      } catch (error) {
        console.error('Error loading campaign leads:', error);
        toast({
          title: "Error",
          description: "Failed to load campaign leads",
          variant: "destructive"
        });
      }
    } else {
      // No campaign selected - reset to normal lead loading
      setDialerState(prev => ({
        ...prev,
        campaignActive: false
      }));
      // Trigger normal lead reload - DISABLED to prevent race condition
      // queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/leads'] });
    }
  };

  // Market selection removed - auto-loading all available markets

  // Desktop app modal state
  const [showDesktopAppModal, setShowDesktopAppModal] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  // Removed videoModalOpen - using direct popup instead
  const [videoModalLead, setVideoModalLead] = useState<any>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showInboundExplainerModal, setShowInboundExplainerModal] = useState(false);










  // Enhanced Callbacks Display Component
  function CallbacksDisplay() {
    const { authState } = useAuth();
    const userEmail = authState?.user?.email;

    // State for infinite scroll and filtering
    const [visibleCount, setVisibleCount] = useState(4);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [expandedCallback, setExpandedCallback] = useState<string | null>(null);

    // Mock callbacks data - replace with actual API call
    const callbacks = [
      {
        id: '1',
        leadName: 'John Smith',
        phone: '+1234567890',
        status: 'pending',
        priority: 'high',
        notes: 'Interested in life insurance',
        scheduledTime: '2025-08-19T10:00:00Z',
        market: 'Life Insurance'
      },
      {
        id: '2',
        leadName: 'Sarah Johnson',
        phone: '+1234567891',
        status: 'confirmed',
        priority: 'medium',
        notes: 'Follow up on annuity quote',
        scheduledTime: '2025-08-19T14:00:00Z',
        market: 'Annuities'
      }
    ];

    // Filter and search callbacks
    const filteredCallbacks = useMemo(() => {
      let filtered = callbacks;

      // Apply search filter
      if (searchTerm) {
        filtered = filtered.filter((callback: any) => 
          callback.leadName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          callback.phone?.includes(searchTerm) ||
          callback.notes?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter((callback: any) => callback.status === statusFilter);
      }

      // Apply priority filter
      if (priorityFilter !== 'all') {
        filtered = filtered.filter((callback: any) => callback.priority === priorityFilter);
      }

      return filtered;
    }, [callbacks, searchTerm, statusFilter, priorityFilter]);

    // Get unique values for filters
    const uniqueStatuses = useMemo(() => 
      Array.from(new Set(callbacks.map((callback: any) => callback.status))).filter(Boolean) as string[],
      [callbacks]
    );

    const uniquePriorities = useMemo(() => 
      Array.from(new Set(callbacks.map((callback: any) => callback.priority))).filter(Boolean) as string[],
      [callbacks]
    );

    // Load more callbacks (infinite scroll)
    const loadMore = () => {
      setVisibleCount(prev => Math.min(prev + 4, filteredCallbacks.length));
    };

    // Reset filters
    const resetFilters = () => {
      setSearchTerm('');
      setStatusFilter('all');
      setPriorityFilter('all');
      setVisibleCount(4);
    };

    // Handle callback actions
    const handleCallbackAction = (callback: any, action: string) => {
      debugLog(`🔄 ${action} requested for callback:`, callback);
      // TODO: Implement callback actions (call, reschedule, etc.)
    };

    if (callbacks.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Callbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-2">
              <p className="text-sm">No callbacks found</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const visibleCallbacks = filteredCallbacks.slice(0, visibleCount);
    const hasMore = visibleCount < filteredCallbacks.length;

    const formatTime = (timeString: string) => {
      try {
        return new Date(timeString).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      } catch {
        return 'Time TBD';
      }
    };

    const formatDate = (dateString: string) => {
      try {
        return new Date(dateString).toLocaleDateString('en-US', { 
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return 'Date TBD';
      }
    };

    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
        case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority?.toLowerCase()) {
        case 'high': return 'bg-red-100 text-red-800 border-red-200';
        case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'low': return 'bg-green-100 text-green-800 border-green-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    return (
      <div className="space-y-4">
        {/* Filters and Search Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search callbacks by lead name, phone, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {uniquePriorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                Reset All Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Callbacks List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Callbacks ({filteredCallbacks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleCallbacks.map((callback: any) => (
              <div key={callback.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                {/* Main Callback Info - ONE ROW */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 flex-1">
                    <Phone className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {callback.leadName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {callback.market} • {callback.phone}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getStatusColor(callback.status)}`}>
                      {callback.status || 'Pending'}
                    </Badge>
                    <Badge className={`text-xs ${getPriorityColor(callback.priority)}`}>
                      {callback.priority || 'Medium'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedCallback(expandedCallback === callback.id ? null : callback.id)}
                      className="h-8 w-8 p-0"
                    >
                      {expandedCallback === callback.id ? '−' : '+'}
                    </Button>
                  </div>
                </div>

                {/* Expanded Callback Details */}
                {expandedCallback === callback.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Scheduled:</span> {formatTime(callback.scheduledTime)}
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span> {formatDate(callback.scheduledTime)}
                      </div>
                      <div>
                        <span className="text-gray-500">Market:</span> {callback.market}
                      </div>
                      <div>
                        <span className="text-gray-500">Phone:</span> {callback.phone}
                      </div>
                    </div>

                    {callback.notes && (
                      <div className="text-sm">
                        <span className="text-gray-500">Notes:</span> {callback.notes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleCallbackAction(callback, 'call')}
                        variant="outline"
                        size="sm"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Call Lead
                      </Button>
                      <Button
                        onClick={() => handleCallbackAction(callback, 'reschedule')}
                        variant="outline"
                        size="sm"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Reschedule
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <Button
                onClick={loadMore}
                variant="outline"
                size="sm"
                className="w-full mt-3"
              >
                Load More Callbacks
              </Button>
            )}

            {/* No callbacks found message */}
            {filteredCallbacks.length === 0 && (
              <div className="text-center py-8">
                <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No callbacks found</h3>
                <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  Reset All Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Enhanced Lead Search Display Component
  function LeadSearchDisplay() {
    const { authState } = useAuth();
    const userEmail = authState?.user?.email;

    // State for search and results
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [expandedLead, setExpandedLead] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(4);

    // Search leads function
    const searchLeads = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // This would be your actual API endpoint for searching leads
        const response = await fetch(`/api/leads/search?agentEmail=${encodeURIComponent(userEmail || '')}&query=${encodeURIComponent(searchTerm)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.leads || []);
        } else {
          console.error('Failed to search leads');
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching leads:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Mock search results for demonstration - replace with actual API call
    const mockSearchLeads = () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      // Simulate API delay
      setTimeout(() => {
        const mockResults = [
          {
            id: '1',
            name: 'John Smith',
            email: 'john.smith@email.com',
            phone: '+1234567890',
            status: 'active',
            market: 'Life Insurance',
            lastContacted: '2025-08-15T10:00:00Z',
            notes: 'Interested in term life policy',
            source: 'Website Lead'
          },
          {
            id: '2',
            name: 'Sarah Johnson',
            email: 'sarah.j@email.com',
            phone: '+1234567891',
            status: 'pending',
            market: 'Annuities',
            lastContacted: '2025-08-14T14:00:00Z',
            notes: 'Follow up on annuity quote',
            source: 'Referral'
          },
          {
            id: '3',
            name: 'Mike Wilson',
            email: 'mike.w@email.com',
            phone: '+1234567892',
            status: 'completed',
            market: 'Life Insurance',
            lastContacted: '2025-08-13T09:00:00Z',
            notes: 'Policy sold - follow up in 6 months',
            source: 'Cold Call'
          }
        ].filter(lead => 
          lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.phone.includes(searchTerm) ||
          lead.market.toLowerCase().includes(searchTerm.toLowerCase())
        );

        setSearchResults(mockResults);
        setIsSearching(false);
      }, 500);
    };

    // Load more results
    const loadMore = () => {
      setVisibleCount(prev => Math.min(prev + 4, searchResults.length));
    };

    // Handle lead actions
    const handleLeadAction = (lead: any, action: string) => {
      debugLog(`🔄 ${action} requested for lead:`, lead);
      // TODO: Implement lead actions (call, email, view details, etc.)
    };

    const visibleResults = searchResults.slice(0, visibleCount);
    const hasMore = visibleCount < searchResults.length;

    const formatDate = (dateString: string) => {
      try {
        return new Date(dateString).toLocaleDateString('en-US', { 
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } catch {
        return 'Date TBD';
      }
    };

    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'active': return 'bg-green-100 text-green-800 border-green-200';
        case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    return (
      <div className="space-y-4">
        {/* Search Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search Your Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name, email, phone, or market..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && mockSearchLeads()}
                className="flex-1"
              />
              <Button
                onClick={mockSearchLeads}
                disabled={isSearching || !searchTerm.trim()}
                className="px-6"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Search through all leads in your ownership by name, email, phone number, or market.
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Search Results ({searchResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleResults.map((lead: any) => (
                <div key={lead.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  {/* Main Lead Info - ONE ROW */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 flex-1">
                      <User className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {lead.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {lead.email} • {lead.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getStatusColor(lead.status)}`}>
                        {lead.status || 'Unknown'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                        className="h-8 w-8 p-0"
                      >
                        {expandedLead === lead.id ? '−' : '+'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Lead Details */}
                  {expandedLead === lead.id && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Market:</span> {lead.market}
                        </div>
                        <div>
                          <span className="text-gray-500">Source:</span> {lead.source}
                        </div>
                        <div>
                          <span className="text-gray-500">Last Contacted:</span> {formatDate(lead.lastContacted)}
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span> {lead.phone}
                        </div>
                      </div>

                      {lead.notes && (
                        <div className="text-sm">
                          <span className="text-gray-500">Notes:</span> {lead.notes}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          onClick={() => handleLeadAction(lead, 'call')}
                          variant="outline"
                          size="sm"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call
                        </Button>
                        <Button
                          onClick={() => handleLeadAction(lead, 'email')}
                          variant="outline"
                          size="sm"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                        <Button
                          onClick={() => handleLeadAction(lead, 'view')}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <Button
                  onClick={loadMore}
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                >
                  Load More Results
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* No results message */}
        {searchTerm && searchResults.length === 0 && !isSearching && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">No Results Found</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                <p className="text-gray-500">Try adjusting your search terms or check spelling.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Initial state message */}
        {!searchTerm && searchResults.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ready to Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Search Your Leads</h3>
                <p className="text-gray-500">Enter a name, email, phone, or market to find leads in your ownership.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Enhanced Call History Display Component
  function CallHistoryDisplay() {
    const { authState } = useAuth();
    const userEmail = authState?.user?.email;

    // State for infinite scroll and filtering
    const [visibleCount, setVisibleCount] = useState(4);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [directionFilter, setDirectionFilter] = useState('all');
    const [expandedCall, setExpandedCall] = useState<string | null>(null);

    const { data: callHistory, isLoading, error } = useQuery({
      queryKey: ['/api/call-history', userEmail],
      queryFn: async () => {
        // Only make API call if we have a valid userEmail
        if (!userEmail) {
          debugLog('❌ CALL HISTORY: No userEmail available, skipping API call');
          return { success: false, calls: [], total: 0, sources: { incoming: 0, outgoing: 0 } };
        }
        
        debugLog('📞 CALL HISTORY: Fetching for userEmail:', userEmail);
        const response = await fetch(`/api/call-history?userEmail=${encodeURIComponent(userEmail)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch call history');
        }
        return response.json();
      },
      enabled: !!userEmail, // Only enabled when we have a userEmail
      refetchInterval: 300000, // 5 min
    });

    const calls = callHistory?.calls || [];

    // Filter and search calls
    const filteredCalls = useMemo(() => {
      let filtered = calls;

      // Apply search filter
      if (searchTerm) {
        filtered = filtered.filter((call: any) => 
          call.to_number?.includes(searchTerm) ||
          call.from_number?.includes(searchTerm) ||
          call.call_status?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter((call: any) => call.call_status === statusFilter);
      }

      // Apply direction filter
      if (directionFilter !== 'all') {
        filtered = filtered.filter((call: any) => call.call_direction === directionFilter);
      }

      return filtered;
    }, [calls, searchTerm, statusFilter, directionFilter]);

    // Get unique values for filters
    const uniqueStatuses = useMemo(() => 
      Array.from(new Set(calls.map((call: any) => call.call_status))).filter(Boolean) as string[],
      [calls]
    );

    const uniqueDirections = useMemo(() => 
      Array.from(new Set(calls.map((call: any) => call.call_direction))).filter(Boolean) as string[],
      [calls]
    );

    // Load more calls (infinite scroll)
    const loadMore = () => {
      setVisibleCount(prev => Math.min(prev + 4, filteredCalls.length));
    };

    // Reset filters
    const resetFilters = () => {
      setSearchTerm('');
      setStatusFilter('all');
      setDirectionFilter('all');
      setVisibleCount(4);
    };

    // Handle callback click
    const handleCallback = async (call: any) => {
      debugLog('🔄 Callback requested for call:', call);
      
      try {
        // Create lead object for masterlead insertion
        const leadData = {
          email: call.agent_id || call.company_email || userEmail,
          leadId: call.lead_id || call.id?.replace('vdp_', '') || Date.now().toString(),
          name: call.name || call.agent_name || 'Callback Lead',
          phone: call.phone,
          market: call.market || 'Callback',
          city: call.city || '',
          state: call.state || '',
          address: call.address || '',
          cnresolution: 'pending',
          isHotLead: true,
          source: 'callback_' + call.source
        };
        
        debugLog('🔄 Setting VDP call as current lead:', { name: leadData.name, phone: leadData.phone });
        
        // Set VDP call as current lead using new API
        const userEmail = authState.user?.email || '';
        const response = await fetch(`/api/current-lead?userEmail=${encodeURIComponent(userEmail)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'vdp',
            id: call.id // Use the vdp_calls ID directly
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to set current lead');
        }
        
        const result = await response.json();
        debugLog('✅ VDP call set as current lead:', result);
        
        // Show success message
        toast({
          title: "Success",
          description: `VDP call "${leadData.name}" loaded as current lead!`
        });
        
        // Invalidate current lead cache to refresh the dialer
        queryClient.invalidateQueries({ queryKey: ['/api/current-lead'] });
        
        // Switch to the dialer tab to show the loaded lead
        const dialerTab = document.querySelector('[data-state="active"][value="queue"]');
        if (!dialerTab) {
          // If we're not on the dialer tab, programmatically switch to it
          const queueTabTrigger = document.querySelector('[value="queue"]') as HTMLButtonElement;
          if (queueTabTrigger) {
            debugLog('🔄 Switching to dialer tab to show loaded lead');
            queueTabTrigger.click();
          }
        }
        
        // Wait a moment for the leads to refresh, then the hotlead should appear at the top
        setTimeout(() => {
          debugLog('🎯 Callback lead loaded - it should appear as a hotlead at the top of your queue');
        }, 1000);
        
      } catch (error) {
        console.error('❌ Failed to set current lead:', error);
        toast({
          title: "Error",
          description: "Failed to set current lead. Please try again.",
          variant: "destructive"
        });
      }
    };

    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Loading Call History...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Error Loading Call History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 text-red-600">
              Failed to load call history. Please try again.
            </div>
          </CardContent>
        </Card>
      );
    }

    const formatDuration = (seconds: number) => {
      if (!seconds) return '0s';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const formatTime = (timeString: string) => {
      try {
        return new Date(timeString).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      } catch {
        return 'Time TBD';
      }
    };

    const formatDate = (dateString: string) => {
      try {
        return new Date(dateString).toLocaleDateString('en-US', { 
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return 'Date TBD';
      }
    };

    const getCallStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'completed': return 'bg-green-100 text-green-800 border-green-200';
        case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'failed': return 'bg-red-100 text-red-800 border-red-200';
        case 'busy': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'no-answer': return 'bg-gray-100 text-gray-800 border-gray-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const getCallDirectionIcon = (direction: string) => {
      switch (direction?.toLowerCase()) {
        case 'outbound-api': return '📞';
        case 'inbound': return '📥';
        default: return '📱';
      }
    };

    if (calls.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Call History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-2">
              <p className="text-sm">No calls found</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const visibleCalls = filteredCalls.slice(0, visibleCount);
    const hasMore = visibleCount < filteredCalls.length;

    return (
      <div className="space-y-4">
        {/* Filters and Search Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search calls by phone number or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  {uniqueDirections.map((direction) => (
                    <SelectItem key={direction} value={direction}>{direction}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || statusFilter !== 'all' || directionFilter !== 'all') && (
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                Reset All Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Call History List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Call History ({filteredCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleCalls.map((call: any) => (
              <div 
                key={call.id} 
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer" 
                onClick={() => handleCallback(call)}
                data-testid={`call-history-card-${call.id}`}
              >
                {/* Main Call Info - ONE ROW */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg">{getCallDirectionIcon(call.call_direction)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {call.phone || 'Unknown Number'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {call.name || 'Unknown Lead'}
                        {call.market && ` • ${call.market}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getCallStatusColor(call.call_status)}`}>
                      {call.call_status || 'Unknown'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCall(expandedCall === call.id ? null : call.id);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      {expandedCall === call.id ? '−' : '+'}
                    </Button>
                  </div>
                </div>

                {/* Expanded Call Details */}
                {expandedCall === call.id && callHistory?.calls && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">From:</span> {call.from_number}
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span> {formatDuration(call.duration_seconds || call.call_duration)}
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span> {formatTime(call.started_at)}
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span> {formatDate(call.started_at)}
                      </div>
                      {call.lead_name && call.lead_name !== 'Unknown Lead' && (
                        <div>
                          <span className="text-gray-500">Lead:</span> {call.lead_name}
                        </div>
                      )}
                      {call.lead_id && (
                        <div>
                          <span className="text-gray-500">Lead ID:</span> {call.lead_id}
                        </div>
                      )}
                      {call.city && call.state && (
                        <div>
                          <span className="text-gray-500">Location:</span> {call.city}, {call.state}
                        </div>
                      )}
                      {call.premium_amount && (
                        <div>
                          <span className="text-gray-500">Premium:</span> ${call.premium_amount}
                        </div>
                      )}
                    </div>

                    {/* Callback Button */}
                    <Button
                      onClick={() => handleCallback(call)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Callback Lead
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <Button
                onClick={loadMore}
                variant="outline"
                size="sm"
                className="w-full mt-3"
              >
                Load More Calls
              </Button>
            )}

            {/* No calls found message */}
            {filteredCalls.length === 0 && (
              <div className="text-center py-8">
                <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No calls found</h3>
                <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  Reset All Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Global function to stop all audio
  const stopAllAudio = () => {
    try {
      // Safe disconnect: Try multiple methods to ensure connection is closed
      const device: any = (window as any).twilioDevice;
      const conn: any =
        device?.activeConnection?.() ??
        (window as any).twilioConnection ??
        device?.connections?.[0];

      if (conn) {
        debugLog('🔇 Disconnecting active WebRTC connection (keeping device registered)');
        try {
          if (typeof conn.disconnect === 'function') {
            conn.disconnect();
          }
        } catch (e) {
          console.warn('⚠️ Error stopping audio streams:', e);
        }
        (window as any).twilioConnection = null;
      }

      // Stop any HTML5 audio elements that might be playing
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.paused) {
          debugLog('🔇 Stopping HTML5 audio element');
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Stop any media streams
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            stream.getTracks().forEach(track => {
              if (track.kind === 'audio') {
                debugLog('🔇 Stopping audio track');
                track.stop();
              }
            });
          })
          .catch(() => {
            // Ignore errors if no audio stream is active
          });
      }
    } catch (error) {
      console.error('⚠️ Error stopping audio streams:', error);
    }
  };

  // Helper: same lead identity (for excluding inbound from main card while ringing)
  const isSameLead = (a: any, b: any) =>
    !a || !b ? false : (a.id && a.id === b.id) || (a.leadId && a.leadId === b.leadId) || (a.phone && a.phone === b.phone);

  // Helper function to get the current lead - do NOT switch to inbound lead until after accept
  const getCurrentLead = () => {
    // While ringing: do NOT show inbound lead on main card — only viewed/queue lead (inbound stays in preview only)
    if (dialerState.dialingStatus === 'ringing') {
      const inbound = dialerState.inboundCallLead;
      if (dialerState.viewedLead && !isSameLead(dialerState.viewedLead, inbound)) return dialerState.viewedLead;
      const fromCall = dialerState.currentCall;
      if (fromCall && !isSameLead(fromCall, inbound)) return fromCall;
      return dialerState.availableLeads?.[dialerState.currentLeadIndex ?? 0] ?? null;
    }
    // Connected inbound: show the lead they're on the phone with (before viewedLead so main card is correct). Never show 914/dequeue — use lead data only.
    if (dialerState.webRTCConferenceActive && (dialerState.inboundCallLead || dialerState.inboundCallInfo?.from)) {
      if (dialerState.inboundCallLead) return dialerState.inboundCallLead;
      const rawFrom = dialerState.inboundCallInfo!.from.replace(/^client:/i, '').trim();
      if (isDequeueCallerId(rawFrom)) return null;
      const digits = rawFrom.replace(/\D/g, '');
      const phone = digits.length === 11 && digits.startsWith('1') ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}` : digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : rawFrom;
      return {
        id: dialerState.inboundCallInfo!.callSid || 'inbound',
        name: 'Inbound call',
        phone,
        state: '',
        city: '',
        market: 'Inbound',
        email: '',
        groupName: 'Inbound Call',
        isVDPCall: false,
        leadId: dialerState.inboundCallInfo!.callSid || 'inbound',
        taalk_lead_id: undefined,
        status: 'connected',
        timestamp: new Date().toISOString()
      } as Lead;
    }
    // Prioritize viewed lead from search if one is set
    if (dialerState.viewedLead) {
      return dialerState.viewedLead;
    }
    // Inbound/AOI lead fallback (connected case already handled above)
    if (dialerState.inboundCallLead) {
      return dialerState.inboundCallLead;
    }
    if (dialerState.vdpCallStatus.hasVDPCall && dialerState.vdpCallStatus.vdpCall) {
      // Transform VDP call data to lead format
      const vdpCall = dialerState.vdpCallStatus.vdpCall;
      return {
        id: vdpCall.callSid || vdpCall.twilioCallSid,
        name: vdpCall.leadName,
        phone: vdpCall.callerNumber,
        state: vdpCall.leadState || 'CO',
        city: vdpCall.leadCity || 'Wellington',
        market: 'Globe Market',
        email: '', // VDP calls don't have email
        groupName: 'AO Intelligence Call',
        isVDPCall: true,
        leadId: vdpCall.callSid?.replace('VDP_', '').split('_')[0] || vdpCall.twilioCallSid?.replace('VDP_', '').split('_')[0],
        taalk_lead_id: vdpCall.callSid?.replace('VDP_', '').split('_')[0] || vdpCall.twilioCallSid?.replace('VDP_', '').split('_')[0]
      };
    }
    // Fall back to regular lead.
    // Safety net: stale saved index should never blank the lead card.
    const idx = Number.isFinite(dialerState.currentLeadIndex) ? dialerState.currentLeadIndex : 0;
    return dialerState.availableLeads[idx] || dialerState.availableLeads[0] || null;
  };

  // Hot Lead specific states
  const [planetViewTimer, setPlanetViewTimer] = useState(0);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [finalCallDuration, setFinalCallDuration] = useState(0); // Preserve final duration after call ends
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNewUserGuideOpen, setIsNewUserGuideOpen] = useState(false);
  const [isMarketNeedOpen, setIsMarketNeedOpen] = useState(false);
  const [showMarketNeedBubble, setShowMarketNeedBubble] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hotleadQueue, setHotleadQueue] = useState<any[]>([]);
  const [plusLeadsQueue, setPlusLeadsQueue] = useState<any[]>([]);
  /** Full list of agent's My Leads (all boxes) - filtered by selectedLeadPool to get myLeadsQueue */
  const [allMyLeadsEligible, setAllMyLeadsEligible] = useState<any[]>([]);
  const [myLeadsQueue, setMyLeadsQueue] = useState<any[]>([]);
  const [aoiIntelQueue, setAoiIntelQueue] = useState<any[]>([]);
  const [activeQueueTab, setActiveQueueTab] = useState<'hotlead' | 'plus' | 'my-leads'>('hotlead');
  const [selectedLeadPool, setSelectedLeadPool] = useState<'all' | 'intown' | 'road-trip' | 'list' | 'lapse'>(() => {
    const saved = localStorage.getItem('ccp-selected-lead-pool');
    return (saved as 'all' | 'intown' | 'road-trip' | 'list' | 'lapse') || 'all';
  });
  const [queuePositions, setQueuePositions] = useState<{ hotlead: number; plus: number; 'my-leads': number; aointel: number }>({
    hotlead: 0,
    plus: 0,
    'my-leads': 0,
    aointel: 0,
  });
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const loadQueueRef = useRef<() => Promise<any>>(() => Promise.resolve());
  const [priority99Count, setPriority99Count] = useState(0);
  const previousPriority99CountRef = useRef(0);
  const [lastApiLeadCount, setLastApiLeadCount] = useState(0);
  const [lastApiNonPendingCount, setLastApiNonPendingCount] = useState(0);
  const [lastApiNonOwnedCount, setLastApiNonOwnedCount] = useState(0);
  const queueDebugEnabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('queueDebug') === '1' ||
      localStorage.getItem('QUEUE_DEBUG') === '1' ||
      (window as any).__QUEUE_DEBUG === true);

  // DISABLED: Priority-99 polling that auto-refreshes queue
  // CRITICAL: Queue should ONLY change when agent explicitly requests leads - NO automatic updates
  // useEffect(() => {
  //   const userEmail = authState?.user?.email;
  //   if (!userEmail) return;
  //   // ... (disabled - no automatic queue refreshes)
  // }, []);

  // Keep ref updated so priority-99 polling can trigger queue refresh
  useEffect(() => {
    loadQueueRef.current = loadQueue;
  });

  useEffect(() => {
    const signedInEmail = authState?.user?.email?.toLowerCase()?.trim();
    if (!signedInEmail) return;
    const normalizedEmail = signedInEmail;
    const bubbleSeenKey = `ccpro-market-need-bubble-seen:${normalizedEmail}`;
    if (sessionStorage.getItem(bubbleSeenKey) === '1') return;

    setShowMarketNeedBubble(true);
    sessionStorage.setItem(bubbleSeenKey, '1');

    const timeoutId = window.setTimeout(() => {
      setShowMarketNeedBubble(false);
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [authState?.user?.email]);

  const confirmedWebRtcReady =
    isPoweredOn && isDeviceConnectReady((window as any).twilioDevice || device);

  // Save lead pool preference
  useEffect(() => {
    localStorage.setItem('ccp-selected-lead-pool', selectedLeadPool);
  }, [selectedLeadPool]);

  // Absolute client-side guardrail:
  // keep only queue-eligible leads even if queue reload is locked during active-call protections.
  useEffect(() => {
    // Leasedialer returns the active leased lead plus buffers even after a
    // call marks cnresolution as called/no_answer. Do not run the legacy
    // pending-only queue cleanup here or it clears the leased queue right
    // after /api/leasedialer/sync succeeds.
    if (isLeaseDialerRoute) return;

    const resolutionOf = (lead: any) => String(lead?.cnresolution ?? '').toLowerCase().trim();
    const isPendingLead = (lead: any) => resolutionOf(lead) === 'pending';
    const isNullResolution = (lead: any) => {
      const r = resolutionOf(lead);
      return lead?.cnresolution == null || r === '' || r === 'null';
    };
    const isAOIntelResolution = (lead: any) => {
      const r = resolutionOf(lead);
      return lead?.aointel === true || lead?.aointel === 1 || r === 'aointel';
    };
    const isAOQueueEligible = (lead: any) =>
      isPendingLead(lead) || isNullResolution(lead) || isAOIntelResolution(lead);
    const isPlusLead = (lead: any) =>
      String(lead?.taalk_market || '').toLowerCase().includes('plus') ||
      String(lead?.market || '').toLowerCase().includes('plus');
    const isPlusQueueEligible = (lead: any) =>
      isPlusLead(lead) && (isPendingLead(lead) || isNullResolution(lead));

    if (hotleadQueue.some((lead: any) => !isAOQueueEligible(lead))) {
      setHotleadQueue(hotleadQueue.filter(isAOQueueEligible));
    }
    if (plusLeadsQueue.some((lead: any) => !isPlusQueueEligible(lead))) {
      setPlusLeadsQueue(plusLeadsQueue.filter(isPlusQueueEligible));
    }
    if (myLeadsQueue.some((lead: any) => !isAOQueueEligible(lead))) {
      setMyLeadsQueue(myLeadsQueue.filter(isAOQueueEligible));
    }
    if (allMyLeadsEligible.some((lead: any) => !isAOQueueEligible(lead))) {
      setAllMyLeadsEligible(allMyLeadsEligible.filter(isAOQueueEligible));
    }

    setDialerState((prev: any) => {
      const available = Array.isArray(prev?.availableLeads) ? prev.availableLeads : [];
      const leads = Array.isArray(prev?.leads) ? prev.leads : [];
      const allowLeadInActiveTab = (lead: any) =>
        activeQueueTab === 'plus' ? isPlusQueueEligible(lead) : isAOQueueEligible(lead);
      const hasInvalidAvailable = available.some((lead: any) => !allowLeadInActiveTab(lead));
      const hasInvalidLeads = leads.some((lead: any) => !allowLeadInActiveTab(lead));
      if (!hasInvalidAvailable && !hasInvalidLeads) return prev;

      const nextAvailable = available.filter(allowLeadInActiveTab);
      const nextLeads = leads.filter(allowLeadInActiveTab);
      return {
        ...prev,
        availableLeads: nextAvailable,
        leads: nextLeads,
        availableLeadsCount: nextAvailable.length,
        currentLeadIndex: Math.min(prev.currentLeadIndex ?? 0, Math.max(0, nextAvailable.length - 1)),
      };
    });
  }, [hotleadQueue, plusLeadsQueue, myLeadsQueue, allMyLeadsEligible, activeQueueTab, isLeaseDialerRoute]);

  // When user changes My Leads box (List, Lapse, In Town, etc.), re-filter allMyLeadsEligible → myLeadsQueue and update dialer state
  // Priority 99 from other boxes only at top if cn_email matches (not associate_id)
  useEffect(() => {
    const userEmail = authState?.user?.email;
    const isPendingOnly = (lead: any) => {
      const r = String(lead?.cnresolution ?? '').toLowerCase().trim();
      return r === 'pending';
    };
    const pendingOnly = allMyLeadsEligible.filter(isPendingOnly);
    
    // DEBUG: Log filtering stats
    const sampleLeads = allMyLeadsEligible.slice(0, 5).map(l => ({
      id: l.id,
      ao_lead_box: l.ao_lead_box || l.aoLeadBox,
      cnresolution: l.cnresolution,
      associate_id: l.associate_id
    }));
    debugLog(`🔍 [${selectedLeadPool}] Filtering leads:`, {
      totalEligible: allMyLeadsEligible.length,
      pendingOnly: pendingOnly.length,
      selectedPool: selectedLeadPool,
      sampleLeads
    });
    
    if (pendingOnly.length === 0) {
      setMyLeadsQueue([]);
      if (activeQueueTab === 'my-leads') {
        setDialerState(prev => ({
          ...prev,
          leads: [],
          availableLeads: [],
          availableLeadsCount: 0,
          currentLeadIndex: 0,
        }));
      }
      return;
    }
    const normalizeLeadBox = (v: string) => (v || '').toLowerCase().replace(/[- ]/g, '').trim();
    const canonicalLeadBox = (normalized: string): string => {
      if (!normalized) return '';
      if (normalized === 'listleadpool' || normalized === 'list') return 'list';
      if (normalized === 'lapseleadpool' || normalized === 'lapse' || normalized === 'lapsed') return 'lapse';
      if (normalized === 'intown') return 'intown';
      if (normalized === 'roadtrip') return 'roadtrip';
      return normalized;
    };
    const inSelectedBox = (lead: any) => {
      const aoLeadBox = lead.ao_lead_box || lead.aoLeadBox;
      if (selectedLeadPool === 'all') return true; // All leads including no-box - match script
      const normalizedLeadBox = normalizeLeadBox(aoLeadBox || '');
      const leadCanon = canonicalLeadBox(normalizedLeadBox);
      const poolCanon = canonicalLeadBox(normalizeLeadBox(selectedLeadPool));
      return leadCanon !== '' && leadCanon === poolCanon;
    };
    const cnEmailMatches = (lead: any) => (lead.cn_email || '').toLowerCase().trim() === (userEmail || '').toLowerCase().trim();
    const cnEmailLeads = pendingOnly.filter(lead => cnEmailMatches(lead));
    const otherLeads = pendingOnly.filter(lead => !cnEmailMatches(lead));
    const boxLeads = otherLeads.filter(lead => inSelectedBox(lead));
    const mergedMyLeads = [...cnEmailLeads, ...boxLeads];
    
    debugLog(`✅ [${selectedLeadPool}] Filtered results:`, {
      cnEmailLeads: cnEmailLeads.length,
      boxLeads: boxLeads.length,
      mergedTotal: mergedMyLeads.length
    });
    
    setMyLeadsQueue(mergedMyLeads);
    if (activeQueueTab === 'my-leads') {
      setDialerState(prev => {
        const hasActiveCall = prev.dialingStatus === 'connected' || prev.dialingStatus === 'dialing' ||
          prev.callStatus === 'connected' || prev.webRTCConferenceActive || prev.currentCall !== null;
        const preserveIndex = hasActiveCall && prev.currentLeadIndex < mergedMyLeads.length ? prev.currentLeadIndex : 0;
        const newIndex = Math.min(preserveIndex, Math.max(0, mergedMyLeads.length - 1));
        return {
          ...prev,
          leads: mergedMyLeads,
          availableLeads: mergedMyLeads,
          availableLeadsCount: mergedMyLeads.length,
          currentLeadIndex: newIndex,
        };
      });
      setQueuePositions(prev => ({ ...prev, 'my-leads': Math.min(prev['my-leads'] ?? 0, Math.max(0, mergedMyLeads.length - 1)) }));
    }
  }, [selectedLeadPool, allMyLeadsEligible, activeQueueTab, authState?.user?.email]);

  const callConnected =
    dialerState.dialingStatus === 'in_progress' ||
    dialerState.callStatus === 'in_call' ||
    dialerState.callStatus === 'incoming';

  useEffect(() => {
    const controller = new AbortController();

    if (!searchQuery || searchQuery.trim().length < 2 || !authState?.user?.email) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return () => controller.abort();
    }

    setIsSearching(true);
    setSearchError(null);

    const timeout = setTimeout(async () => {
      if (controller.signal.aborted) {
        return;
      }

      try {
        const params = new URLSearchParams({
          query: searchQuery.trim(),
          agentEmail: authState.user.email!,
        });

        const response = await apiRequest('GET', `/api/outbound-dialer/leads/search?${params.toString()}`);
        if (controller.signal.aborted) {
          return;
        }

        const payload = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        if (payload?.success) {
          setSearchResults(Array.isArray(payload.results) ? payload.results : []);
        } else {
          setSearchResults([]);
          setSearchError(payload?.error || 'Unknown search error');
        }
      } catch (error: any) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('❌ Lead search failed:', error);
        setSearchError(error?.message || 'Failed to search leads');
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
      setIsSearching(false);
    };
  }, [searchQuery, authState?.user?.email]);

  useEffect(() => {
    setQueuePositions(prev => {
      const currentIndex = dialerState.currentLeadIndex ?? 0;
      const tab = activeQueueTab;
      if (prev[tab] === currentIndex) {
        return prev;
      }
      return {
        ...prev,
        [tab]: currentIndex,
      };
    });
  }, [dialerState.currentLeadIndex, activeQueueTab]);

  // Timer reference to prevent multiple auto-refresh timers
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const toPacificDayKey = (timestamp?: string): string => {
    const parsed = timestamp ? new Date(timestamp) : new Date();
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(safeDate);
  };

  const normalizeDailyStats = (raw: any) => {
    const totalDialed = Math.max(0, Number(raw?.total_dialed ?? raw?.todayDialed ?? 0) || 0);
    const reached = Math.max(0, Number(raw?.reached ?? 0) || 0);
    const booked = Math.max(0, Number(raw?.booked ?? 0) || 0);
    const timestamp = typeof raw?.timestamp === 'string' ? raw.timestamp : new Date().toISOString();
    const dayKey = toPacificDayKey(timestamp);

    return {
      total_dialed: totalDialed,
      todayDialed: totalDialed,
      reached,
      booked,
      timestamp,
      dayKey,
    };
  };

  // Query for real daily stats from database - USER SPECIFIC
  const { data: dailyStatsRaw, refetch: refetchDailyStats } = useQuery({
    queryKey: ['/api/outbound-dialer/daily-stats', authState.user?.email],
    queryFn: async () => {
      const userEmail = authState.user?.email;
      if (!userEmail) return normalizeDailyStats(null);
      const queryParam = `?userEmail=${encodeURIComponent(userEmail)}`;
      const response = await segmentedFetch(`/api/outbound-dialer/daily-stats${queryParam}`);
      if (!response.ok) {
        throw new Error(`daily-stats request failed (${response.status})`);
      }
      const json = await response.json();
      if (json?.success === false) {
        throw new Error(json?.error || 'daily-stats request failed');
      }
      return normalizeDailyStats(json);
    },
    refetchInterval: 10000, // 10s — near real-time
    enabled: !!authState.user?.email,
    retry: 1,
    // Keep last successful value visible while refetching/failing (prevents flicker-to-zero)
    placeholderData: (prev) => prev,
  });

  // /connect DRB display should reflect direct server values from /api/outbound-dialer/daily-stats.
  // Keep optimistic counters for existing call flow hooks, but do not render them in DRB tiles.
  const [localDialDelta, setLocalDialDelta] = React.useState(0);
  const [localReachDelta, setLocalReachDelta] = React.useState(0);
  const [localBookedDelta, setLocalBookedDelta] = React.useState(0);
  const countedDialKeysRef = React.useRef<Set<string>>(new Set());

  const getDialCountKey = (
    callSid?: string | null,
    _leadId?: string | number | null,
    attemptKey?: string | null,
  ): string => {
    const attempt = String(attemptKey || '').trim();
    if (attempt) return `attempt:${attempt}`;
    const sid = String(callSid || '').trim();
    if (sid) return `sid:${sid}`;
    return '';
  };

  const markDialCounted = (
    callSid?: string | null,
    leadId?: string | number | null,
    attemptKey?: string | null,
  ): boolean => {
    const key = getDialCountKey(callSid, leadId, attemptKey);
    if (!key) return false;
    if (countedDialKeysRef.current.has(key)) return false;
    countedDialKeysRef.current.add(key);
    setLocalDialDelta((d) => d + 1);
    return true;
  };

  const dailyStats = dailyStatsRaw;

  // Calculate trial status and remaining leads (AFTER dailyStats is defined)
  const isTrial = agentStatus?.trialone === true;
  const maxTrialLeads = 50;
  const dialedToday = dailyStats?.total_dialed || dailyStats?.todayDialed || 0;
  const remainingTrialLeads = isTrial ? Math.max(0, maxTrialLeads - dialedToday) : Infinity;

  // Fetch VDP data for agent
  const { data: vdpRoutingData } = useQuery<VDPData>({
    queryKey: ['/api/vdp/routing', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) throw new Error('No user email');
      const response = await fetch('/api/vdp/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail })
      });
      if (!response.ok) throw new Error('Failed to fetch VDP data');
      return response.json();
    },
    /** After startup diagnostic: Taalk script + open() must run when mount is visible (not under z-9999 overlay). */
    enabled: !!currentUserEmail && startupComplete,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 1
  });
  
  // Store VDP data when fetched
  useEffect(() => {
    if (vdpRoutingData) {
      setVdpData(vdpRoutingData);
      debugLog('✅ VDP data loaded for OutboundDialerInterface:', vdpRoutingData);
      // Don't set vdpOnline from vdpRoutingData - wait for VDP SDK onStatusChange callback
      // vdpRoutingData.vdpActive might be stale. Only trust the SDK's actual status.
      // vdpOnline will be set to true when VDP SDK's onStatusChange fires with online=true
    }
  }, [vdpRoutingData]);

  useEffect(() => {
    if (!currentUserEmail || !vdpRoutingData) return;
    const markets = Array.isArray(vdpRoutingData.market)
      ? vdpRoutingData.market
      : String(vdpRoutingData.market || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    const states = Array.isArray(vdpRoutingData.states) ? vdpRoutingData.states : [];
    void fetch("/api/outbound-dialer/leases/profile/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: currentUserEmail,
        markets,
        states,
      }),
    }).catch((error) => {
      debugLog("⚠️ Failed to sync lease routing profile:", error);
    });
  }, [currentUserEmail, vdpRoutingData]);

  // Startup overlay unmounts VDPStatus until complete — refetch routing when gate opens so Taalk + producer row stay in sync.
  useEffect(() => {
    if (!startupComplete || !currentUserEmail) return;
    void queryClient.invalidateQueries({ queryKey: ['/api/vdp/routing', currentUserEmail] });
  }, [startupComplete, currentUserEmail, queryClient]);
  
  // VDP control helper functions (defined before useEffect that uses them)
  // Control VDP status via API - backend is source of truth
  const enableVDPInbound = React.useCallback(async () => {
    if (!currentUserEmail || !window.TaalkVDP) {
      console.warn('⚠️ Cannot enable VDP inbound: Email or TaalkVDP not available');
      return;
    }
    
    // Always call API when powering on - backend is source of truth
    // VDP window will handle not resetting if already online
    try {
      debugLog('🚀 Calling API to set VDP online for:', currentUserEmail);
      
      // Call backend API to get VDP config - backend is source of truth
      const response = await fetch('/api/vdp/set-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const apiData = await response.json();
      debugLog('✅ API returned VDP config:', apiData);
      
      if (apiData.command === 'open' && apiData.params) {
        // Execute VDP command based on API response
        window.TaalkVDP.open(apiData.agentId, apiData.params);
        debugLog('✅ VDP open() called with API config - waiting for VDP window to confirm online status');
      } else {
        console.warn('⚠️ Unexpected API response format:', apiData);
      }
    } catch (error) {
      console.error('❌ Failed to enable VDP inbound via API:', error);
    }
  }, [currentUserEmail]);
  
  const disableVDPInbound = React.useCallback(async () => {
    if (!currentUserEmail || !window.TaalkVDP) {
      console.warn('⚠️ Cannot disable VDP inbound: Email or TaalkVDP not available');
      return;
    }
    
    try {
      debugLog('🔌 Calling API to set VDP offline for:', currentUserEmail);
      
      // Call backend API - backend is source of truth
      const response = await fetch('/api/vdp/set-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const apiData = await response.json();
      debugLog('✅ API returned disconnect command:', apiData);
      
      if (apiData.command === 'disconnect') {
        // Execute VDP command based on API response
        if (window.TaalkVDP.disconnect) {
          window.TaalkVDP.disconnect();
        } else {
          window.TaalkVDP.close();
        }
        debugLog('✅ VDP disconnect() called via API - waiting for VDP window to confirm offline status');
      } else {
        console.warn('⚠️ Unexpected API response format:', apiData);
      }
    } catch (error) {
      console.error('❌ Failed to disable VDP inbound via API:', error);
    }
  }, [currentUserEmail]);
  
  // Keep authState in window for VDP callback access
  React.useEffect(() => {
    (window as any).__currentAuthState = authState;
  }, [authState]);
  
  // Taalk removed — inbound uses new panel + TaskRouter (voice-online/voice-offline) only; no legacy script.
  useEffect(() => {}, [vdpData, vdpScriptLoaded]);
  
  const handleVDPStatusChange = React.useCallback(async (online: boolean) => {
    debugLog('📡 Inbound panel Online/Offline:', online ? 'ONLINE' : 'OFFLINE');
    offlineTransitionRequestedRef.current = !online;
    // Sync ref immediately — setVdpOnline schedules a re-render, but vdpOnlineRef's useEffect
    // only fires after that render. syncTaskRouterState reads vdpOnlineRef.current synchronously,
    // so it would see the old value and skip the call. Force-sync the ref now.
    vdpOnlineRef.current = online;
    setVdpOnline(online);
    // REMOVED: Auto power-on WebRTC when Taalk goes online
    // Taalk VDP and WebRTC are independent - don't auto-register WebRTC
    // if (online && !isPoweredOnRef.current && !autoPowerOnInFlightRef.current) {
    //   autoPowerOnInFlightRef.current = true;
    //   try {
    //     await handlePowerToggleRef.current?.({ simpleRegister: true });
    //   } finally {
    //     autoPowerOnInFlightRef.current = false;
    //   }
    // }
    await syncTaskRouterState('inbound-toggle-change');
  }, [syncTaskRouterState]);

  /** Handler for the Online / Away / Offline pill in InboundCallHeaderPanel. */
  const handleAgentStatusChange = React.useCallback(async (status: 'online' | 'away' | 'offline') => {
    const online = status === 'online';
    setAgentAwayMode(status === 'away');
    // Incoming ring: only play when status is Online; mute when Away or Offline
    const dev = (window as any).twilioDevice;
    if (dev?.audio?.incoming) {
      const playIncomingRing = online && !inboundRingerMuted;
      dev.audio.incoming(playIncomingRing);
    }
    if (vdpToggleRef.current) {
      await vdpToggleRef.current(online);
    } else {
      // Fallback: dispatch the event that VDPStatus listens to
      vdpOnlineRef.current = online;
      setVdpOnline(online);
      window.dispatchEvent(new CustomEvent('taalk-vdp-status', { detail: { online } }));
    }
  }, [inboundRingerMuted]);
  
  // 🧪 VDP DEBUG: Wrap TaalkVDP methods to log all calls (wait for TaalkVDP to load)
  useEffect(() => {
    let wrapped = false;
    
    const wrapMethods = () => {
      if (!window.TaalkVDP || wrapped) return;
      
      const originalOpen = window.TaalkVDP.open;
      const originalClose = window.TaalkVDP.close;
      const originalDisconnect = window.TaalkVDP.disconnect;
      
      let openCount = 0;
      let closeCount = 0;
      let disconnectCount = 0;
      
      window.TaalkVDP.open = function(...args) {
        openCount++;
        debugLog(`\n🚀 [VDP DEBUG OPEN #${openCount}] TaalkVDP.open() called:`, {
          agentId: args[0],
          params: args[1],
          timestamp: new Date().toISOString(),
          caller: new Error().stack.split('\n').slice(0, 8).join('\n')
        });
        
        const result = originalOpen.apply(this, args);
        
        setTimeout(() => {
          const container = document.getElementById('mount-vdp-selector');
          const iframe = container?.querySelector('iframe');
          debugLog(`   ✅ [VDP DEBUG OPEN #${openCount}] State check:`, {
            container: !!container,
            iframe: !!iframe,
            iframeVisible: iframe ? (iframe.offsetWidth > 0 && iframe.offsetHeight > 0) : false,
            iframeSrc: iframe?.src
          });
        }, 500);
        
        return result;
      };
      
      window.TaalkVDP.close = function(...args) {
        closeCount++;
        debugLog(`\n🔌 [VDP DEBUG CLOSE #${closeCount}] TaalkVDP.close() called:`, {
          timestamp: new Date().toISOString(),
          caller: new Error().stack.split('\n').slice(0, 8).join('\n')
        });
        return originalClose.apply(this, args);
      };
      
      if (originalDisconnect) {
        window.TaalkVDP.disconnect = function(...args) {
          disconnectCount++;
          debugLog(`\n🔌 [VDP DEBUG DISCONNECT #${disconnectCount}] TaalkVDP.disconnect() called:`, {
            timestamp: new Date().toISOString(),
            caller: new Error().stack.split('\n').slice(0, 8).join('\n')
          });
          return originalDisconnect.apply(this, args);
        };
      }
      
      wrapped = true;
      debugLog('🧪 VDP Debug: Wrapped TaalkVDP methods for monitoring');
    };
    
    // Try immediately
    wrapMethods();
    
    // Also try after a delay in case TaalkVDP loads later
    const timeout = setTimeout(wrapMethods, 2000);
    
    // Also listen for when TaalkVDP becomes available
    const checkInterval = setInterval(() => {
      if (window.TaalkVDP && !wrapped) {
        wrapMethods();
        clearInterval(checkInterval);
      }
    }, 500);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(checkInterval);
    };
  }, []);

  // Legacy inbound-calls poller conflicts with the TaskRouter + browser-leg flow.
  // This dialer should use the TaskRouter pending feed as the only inbound panel source.
  useEffect(() => {
    return undefined;
  }, []);

  // Call Connector Pro heartbeat - sends every 10 seconds when interface is active
  useEffect(() => {
    const userEmail = authState?.user?.email;
    if (!userEmail) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/call-connector-pro/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentEmail: userEmail,
            isActive: true,
            localLeasedLeadCount: isLeaseDialerRoute
              ? Math.max(0, (dialerState.availableLeads?.length || 0) - (dialerState.currentLeadIndex || 0))
              : 0,
            currentLeadId: isLeaseDialerRoute
              ? String(dialerState.availableLeads?.[dialerState.currentLeadIndex]?.id || dialerState.availableLeads?.[dialerState.currentLeadIndex]?.taalk_lead_id || '')
              : '',
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('❌ Failed to send heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Keep pending-lead counters fresh in AOI Command.
    // Campaign Manager polls every 10s, so heartbeat must be at least this frequent.
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [authState?.user?.email, isLeaseDialerRoute, dialerState.availableLeads, dialerState.currentLeadIndex]);

  // DISABLED: /ws real-time updates — endpoint returns 400; breaks frontend
  useEffect(() => {
    return () => {};
    /* DISABLED /ws:
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
    const wsUrl = `${protocol}//${host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      debugLog('🔌 WebSocket connected for auto-complete updates');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle lead hung up event
        if (data.type === 'lead-hung-up') {
          debugLog('🎯 LEAD HUNG UP EVENT RECEIVED:', data);

          // Update UI to show call ended (but keep WebRTC active and powered on)
          // CRITICAL: Preserve viewedLead and currentLeadIndex - lead must stay on screen until "Complete Call & Dial Next"
          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'idle',
            webRTCConferenceActive: false, // No active call; WebRTC device stays powered separately
            powered: true, // Keep powered on - don't show Power On button again
            callStatus: 'idle', // Return to idle, not completed
            campaignActive: false, // Stop dialing
            currentCall: null,
            currentConferenceName: undefined
            // viewedLead and currentLeadIndex are preserved - lead stays visible
          }));

          toast({
            title: 'Lead Hung Up',
            description: 'Call ended - lead remains on screen until you click "Complete Call & Dial Next"',
            variant: 'default'
          });
        }

        // 🚨 CRITICAL: Handle AOIntel lead arrival - supercedes all filters, displays instantly
        if (data.type === 'aoi-lead-arrived' && data.agentEmail === authState?.user?.email?.toLowerCase()) {
          debugLog('🚨 AOINTEL LEAD ARRIVED - INSTANT DISPLAY:', data.lead);

          const aoiLead = data.lead;
          
          // Transform to match lead format
          const transformedLead = {
            id: aoiLead.id || aoiLead.taalk_lead_id,
            taalk_lead_id: aoiLead.taalk_lead_id || String(aoiLead.id),
            first_name: aoiLead.first_name || '',
            last_name: aoiLead.last_name || '',
            name: aoiLead.name || `${aoiLead.first_name || ''} ${aoiLead.last_name || ''}`.trim() || 'AOIntel Lead',
            phone: aoiLead.phone,
            state: aoiLead.state,
            market: aoiLead.market || aoiLead.taalk_market || 'AOIntel',
            cn_email: aoiLead.cn_email,
            cnresolution: aoiLead.cnresolution || 'pending',
            aointel: true, // 🚨 CRITICAL: Mark as AOIntel lead
            source_table: 'ao_intel_inbound',
            is_hot_lead: true, // AOIntel leads are always hot
            isHotLead: true,
            priority: 'urgent',
            updated_at: aoiLead.updated_at
          };

          // Add to AOIntel queue (primary) and also to other queues
          setAoiIntelQueue(prev => {
            // Check if already exists
            const exists = prev.some(l => l.id === transformedLead.id || l.taalk_lead_id === transformedLead.taalk_lead_id);
            if (exists) return prev;
            // Add to top
            return [transformedLead, ...prev];
          });

          setHotleadQueue(prev => {
            // Check if already exists
            const exists = prev.some(l => l.id === transformedLead.id || l.taalk_lead_id === transformedLead.taalk_lead_id);
            if (exists) return prev;
            // Add to top
            return [transformedLead, ...prev];
          });

          setPlusLeadsQueue(prev => {
            // Check if already exists
            const exists = prev.some(l => l.id === transformedLead.id || l.taalk_lead_id === transformedLead.taalk_lead_id);
            if (exists) return prev;
            // Add to top
            return [transformedLead, ...prev];
          });

          // 🚨 CRITICAL: Disconnect any active WebRTC calls and power down dialer
          // Disconnect active WebRTC connection if one exists
          if ((window as any).twilioConnection) {
            try {
              debugLog('🔌 Disconnecting active WebRTC call for AOIntel inbound call');
              (window as any).twilioConnection.disconnect();
              (window as any).twilioConnection = null;
            } catch (error) {
              console.error('⚠️ Error disconnecting WebRTC for AOIntel call:', error);
            }
          }

          // Stop any active dialing/campaign
          if (device && typeof device.disconnectAll === 'function') {
            try {
              debugLog('🔌 Disconnecting all WebRTC audio streams for AOIntel call');
              device.disconnectAll();
            } catch (error) {
              console.error('⚠️ Error disconnecting WebRTC device:', error);
            }
          }

          // 🚨 CRITICAL: Pause outbound dialing immediately when AOIntel call arrives
          // Do NOT swap the main CCP current lead until the agent actually accepts the inbound call.
          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'idle', // Stop any active dialing
            powered: true, // WebRTC always on - never power off
            webRTCConferenceActive: false, // Stop WebRTC if active
            campaignActive: false, // Stop campaign
            callStatus: 'idle',
            currentCall: null, // Clear any active outbound call
            currentConferenceName: undefined, // Clear conference
          }));

          // Update queue position for AOIntel queue if currently viewing it
          setQueuePositions(prev => ({
            ...prev,
            aointel: 0 // Select first lead (the AOIntel one) if user switches to AOIntel queue
          }));

          debugLog('✅ AOIntel lead added to queue and outbound dialer paused');
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    socket.onclose = () => {
      debugLog('🔌 WebSocket disconnected');
    };

    // Cleanup on unmount
    return () => {
      socket.close();
    };
    */
  }, [authState?.user?.email]);

  // WASD + Q/E Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (aoiAppModalOpen) return;
      // Only process if not typing in an input/textarea
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName
      );
      if (isTyping) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case 'w': // Power Toggle (W = up/on)
          e.preventDefault();
          handlePowerToggle();
          break;

        case 's': // Stop/Complete Call (S = down/stop)
          e.preventDefault();
          if (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected') {
            handleCompleteCall();
          }
          break;

        case 'a': // Previous Lead (A = left)
          e.preventDefault();
          handlePreviousLead();
          break;

        case 'd': // Next Lead (D = right)
          e.preventDefault();
          handleNextLead();
          break;

        case 'q': // Start Dialing (Q = action) — no hotlead block; Power and Inbound are separate
          e.preventDefault();
          if (dialerState.availableLeads.length > 0) {
            handleStartDialing();
          }
          break;

        case 'e': // Complete Call & Dial Next (E = execute/end)
          e.preventDefault();
          if (completeCallCooldownSeconds > 0) {
            debugLog('⏳ E KEY: Complete & Dial Next cooling down', { completeCallCooldownSeconds });
            return;
          }
          debugLog('🔥 E KEY PRESSED: Complete call and dial next lead');
          debugLog('🔍 E KEY State Check:', {
            dialingStatus: dialerState.dialingStatus,
            callStatus: dialerState.callStatus,
            webRTCConferenceActive: dialerState.webRTCConferenceActive,
            condition1: dialerState.dialingStatus === 'dialing',
            condition2: dialerState.callStatus === 'connected',
            condition3: dialerState.webRTCConferenceActive,
            canProceed: (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive)
          });
          
          if (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive) {
            debugLog('✅ E KEY: Conditions met, executing complete and dial next');
            void handleCompleteCall().then(() => {
              setTimeout(() => {
                debugLog('⏰ E KEY: Timeout reached, calling handleDialNextLead');
                handleDialNextLead();
              }, 500);
            });
          } else {
            debugLog('❌ E KEY: Conditions not met, aborting complete and dial next');
            toast({
              title: 'Cannot Complete & Dial Next',
              description: 'No active call to complete',
              variant: 'destructive'
            });
          }
          break;

        case 'r': // Redial Same Lead (R = redial) — no hotlead block
        case 'R': // Redial Same Lead (R = redial)
          e.preventDefault();
          if (dialerState.availableLeads.length > 0) {
            debugLog('🔄 R KEY: Redialing same lead');
            handleRedial();
          }
          break;

        case '?': // Help (? = show keyboard shortcuts)
        case '/': // Help (/ = show keyboard shortcuts)
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;

        case 'arrowup': // Volume Up
          e.preventDefault();
          // Music controls removed
          break;

        case 'arrowdown': // Volume Down
          e.preventDefault();
          // Music controls removed
          break;

      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialerState, aoiAppModalOpen, completeCallCooldownSeconds]);

  // Auto power-on and online for inbound as soon as they have email — no subscription/CCPRO gate. Open page → WebRTC on → online for taking calls.
  // Skip WebRTC entirely if microphone permission fails (don't turn on device).
  useEffect(() => {
    const email = authState?.user?.email;
    if (!email || !email.includes('@') || isDemoMode || autoPowerOnOnLoadDoneRef.current) return;
    autoPowerOnOnLoadDoneRef.current = true;
    vdpOnlineRef.current = true;
    setVdpOnline(true);
    debugLog('🔌 Auto power-on + online for inbound (no subscription wait)');
    const t = setTimeout(async () => {
      const micResult = await requestMicrophonePermission(true);
      if (!micResult.success) {
        debugLog('🔌 Auto power-on skipped: microphone not available', micResult.error);
        setHasMicIssue(true);
        if (micResult.needsRecovery) setShowMicRecoveryModal(true);
        toast({
          title: 'Microphone required',
          description: micResult.error || 'Allow microphone access to receive and make calls.',
          variant: 'destructive',
          duration: 8000,
        });
        return;
      }
      setHasMicIssue(false);
      if (micResult.stream && isMac()) (window as any).__macMicrophoneStream = micResult.stream;
      handlePowerToggleRef.current?.({ simpleRegister: true, forcePowerOn: true });
    }, 0);
    return () => clearTimeout(t);
  }, [authState?.user?.email, isDemoMode]);

  // Hard isolate /leasedialer from any previously loaded standard queue state.
  useEffect(() => {
    if (!isLeaseDialerRoute) return;
    setHotleadQueue([]);
    setPlusLeadsQueue([]);
    setAllMyLeadsEligible([]);
    setMyLeadsQueue([]);
    setAoiIntelQueue([]);
    setQueuePositions({ hotlead: 0, plus: 0, 'my-leads': 0, aointel: 0 });
    setDialerState(prev => ({
      ...prev,
      leads: [],
      availableLeads: [],
      currentIndex: 0,
      currentLeadIndex: 0,
      availableLeadsCount: 0,
      viewedLead: null,
    }));
  }, [isLeaseDialerRoute]);

  // Auto-load leads when component mounts and user is authenticated
  useEffect(() => {
    if (!subscriptionResolved) {
      debugLog('⏳ Subscription status pending – waiting before initializing queue');
      return;
    }

    if (authState?.user?.email) {
      debugLog('🚀 Component mounted for authenticated user:', authState.user.email);
      const normalizedEmail = authState.user.email.toLowerCase().trim();
      const isFirstInitForUser = initializedEmailRef.current !== normalizedEmail;
      if (isFirstInitForUser) {
        initializedEmailRef.current = normalizedEmail;

        // Reset call state only (do NOT reset power or destroy device — page load auto-connects WebRTC and sets online for inbound regardless of subscription).
        debugLog('🔄 First init: resetting call state only (keeping WebRTC/power intact)');
        setDialerState(prev => ({
          ...prev,
          currentCall: null,
          dialingStatus: 'idle',
          callStatus: 'idle',
          webRTCConferenceActive: false,
          powered: prev.powered
        }));

        // Clear localStorage cache
        try {
          const storageKey = `outbound_leads_${authState.user.email}`;
          const leadPackCacheKey = `ccp-lead-pack:${normalizedEmail}`;
          localStorage.removeItem(storageKey);
          localStorage.removeItem(leadPackCacheKey);
          queryClient.removeQueries({
            predicate: (query) => {
              const key = query.queryKey?.[0];
              return (
                typeof key === 'string' &&
                (key.startsWith('/api/outbound-dialer/') || key.startsWith('/api/leasedialer/'))
              );
            },
          });
          debugLog('🧹 Cleared outbound dialer cache');
        } catch (error) {
          console.warn('Failed to clear cache:', error);
        }

        // Stop any playing audio on mount
        stopAllAudio();
      }

      // Load all leads assigned to producer
      debugLog('📥 Loading leads...');
      if (shouldGateOutbound) {
        debugLog('ℹ️ Outbound access disabled on mount – clearing queue state');
        setHotleadQueue([]);
        setPlusLeadsQueue([]);
        setQueuePositions({ hotlead: 0, plus: 0, 'my-leads': 0, aointel: 0 });
        setDialerState(prev => ({
          ...prev,
          leads: [],
          availableLeads: [],
          currentIndex: 0,
          currentLeadIndex: 0,
          availableLeadsCount: 0,
          viewedLead: prev.viewedLead,
        }));
      } else if (!shouldGateOutbound) {
        loadQueue();
      }

      // WebRTC auto-connect is handled by the separate effect that runs on email only (no subscription gate).
    } else {
      debugLog('⏳ Waiting for user authentication');
    }
  }, [authState?.user?.email, subscriptionResolved, shouldGateOutbound, isDemoMode, demoProduct, isLeaseDialerRoute]); // Include demo mode in dependencies

  // Load leads based on selected market filter (plus_leads or hotleads)
  // OLD loadLeadsFromAPI removed - replaced with simple loadQueue() function above

  // AUTO-LOADING handled by main mount useEffect with loadQueue()

  // DISABLED: Demo mode auto-refresh
  // CRITICAL: Queue should ONLY change when agent explicitly requests leads - NO automatic updates
  // useEffect(() => {
  //   // ... (disabled - no automatic queue refreshes)
  // }, []);

  // DISABLED: Visibility change auto-refresh
  // CRITICAL: Queue should ONLY change when agent explicitly requests leads - NO automatic updates
  // useEffect(() => {
  //   // ... (disabled - no automatic queue refreshes)
  // }, []);

  // DISABLED: Auto-refresh interval
  // CRITICAL: Queue should ONLY change when agent explicitly requests leads - NO automatic updates
  // useEffect(() => {
  //   // ... (disabled - no automatic queue refreshes)
  // }, []);

  // Cleanup auto-refresh timer on component unmount
  useEffect(() => {
    return () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
        debugLog('🧹 Auto-refresh timer cleared on unmount');
      }

      // Stop all audio when component unmounts
      stopAllAudio();
      debugLog('🔇 All audio stopped on component unmount');
    };
  }, []);

  // DISABLED EMERGENCY LEADS LOADER: Only load leads from Smart Campaign
  // useEffect(() => {
  //   debugLog('🔥 EMERGENCY LEADS LOADER: Attempting to force load leads...');
  //   const forceLoadLeads = async () => {
  //     // Wait a bit for auth to initialize
  //     await new Promise(resolve => setTimeout(resolve, 1000));
  //     
  //     const userEmail = authState?.user?.email || ''; // No hardcoded fallback
  //     debugLog('🔥 FORCING LEAD LOAD for:', userEmail);
  //     
  //     try {
  //       const response = await fetch('/api/outbound-dialer/leads', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({
  //           userEmail: userEmail,
  //           autoLoadAll: true,
  //           resumePosition: true // Always preserve position
  //         })
  //       });
  //       const data = await response.json();
  //       
  //       if (data.success && data.leads) {
  //         debugLog(`🔥 EMERGENCY LOAD SUCCESS: ${data.leads.length} leads loaded`);
  //         const convertedLeads = data.leads.map((lead: any) => ({
  //           id: lead.id,
  //           name: lead.name,
  //           phone: lead.phone,
  //           leadId: lead.leadId,
  //           market: lead.market || 'Veteran',
  //           state: lead.state || 'Unknown',
  //           city: lead.city || '',
  //           email: lead.email || '',
  //           status: lead.status || 'pending',
  //           timestamp: lead.timestamp || new Date().toISOString(),
  //           groupName: lead.groupName || '',
  //           groupCode: lead.groupCode || '',
  //           beneficiary: lead.beneficiary || '',
  //           relationship: lead.relationship || '',
  //           referredBy: lead.referredBy || '',
  //           sponsorOrg: lead.sponsorOrg || '',
  //           isHotLead: lead.is_hot_lead || lead.isHotLead || lead.priority_score === 10 || lead.priority === 10,
  //           priority: (lead.isHotLead || lead.priority_score === 10 || lead.priority === 10) ? 1 : 0
  //         }));
  //         
  //         setDialerState(prev => ({
  //           ...prev,
  //           availableLeads: convertedLeads,
  //           currentLeadIndex: data.resumePosition || 0
  //         }));
  //         
  //         debugLog(`🔥 EMERGENCY LOAD COMPLETE: ${convertedLeads.length} leads set in state`);
  //       }
  //     } catch (error) {
  //       console.error('🔥 EMERGENCY LOAD FAILED:', error);
  //     }
  //   };
  //   
  //   forceLoadLeads();
  // }, []); // Run once on mount

  // Track producer position in lead queue for resume functionality
  const trackproducerPosition = async (position: number, leadId?: string, leadPhone?: string) => {
    try {
      const userEmail = authState?.user?.email;
      if (!userEmail || position < 0) return;

      // CRITICAL: Save position with TTL so stale leads expire after 30 min
      savePositionWithTTL(userEmail, position);
      debugLog(`💾 POSITION SAVED: ${position} for ${userEmail}`);

      const currentLead = dialerState.availableLeads[position];

      // Track all positions now since hotleads don't disrupt queue order
      const trackingData = {
        agentEmail: userEmail,
        market: 'All', // Since we load all markets now
        leadId: leadId || currentLead?.leadId || 'unknown',
        leadPhone: leadPhone || currentLead?.phone || 'unknown',
        position: position
      };

      debugLog(`📍 Tracking position ${position} for ${userEmail}`);

      await segmentedFetch('/api/outbound-dialer/track-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackingData)
      });
    } catch (error) {
      console.error('❌ Error tracking position:', error);
      // Don't block user workflow if tracking fails
    }
  };

  // Check if hotleads/AOI leads are complete and auto-load regular leads
  const checkAndLoadRegularLeads = async () => {
    // Get current state to ensure we have the latest data
    setDialerState(currentState => {
      const remainingLeads = currentState.availableLeads;
      const hotleadsCount = remainingLeads.filter(lead => lead.isHotLead || lead.priority === 1 || lead.priority_score === 10).length;

      debugLog('🔍 Lead status check:', {
        totalRemaining: remainingLeads.length,
        hotleadsRemaining: hotleadsCount,
        shouldLoadRegular: remainingLeads.length <= 3 || hotleadsCount === 0
      });

      // If we have 3 or fewer leads left, OR no hotleads left, load more regular leads
      if (remainingLeads.length <= 3 || (remainingLeads.length > 0 && hotleadsCount === 0)) {
        debugLog('🔄 Triggering automatic regular lead reload');

        // DISABLED AUTO-LOADING: Only load leads from Smart Campaign
        // setTimeout(async () => {
        //   try {
        //     await loadLeadsFromAPI(false);
        //     toast({
        //       title: 'Regular Leads Loaded',
        //       description: 'Priority leads completed - returned to regular lead queue',
        //     });
        //   } catch (error) {
        //     console.error('❌ Failed to auto-load regular leads:', error);
        //     toast({
        //       title: 'Load More Leads',
        //       description: 'Please manually refresh leads to continue',
        //       variant: 'destructive'
        //     });
        //   }
        // }, 100);
      }

      return currentState; // Return unchanged state
    });
  };

  // CSV Import functionality removed per user request

  // DISABLED AUTO-LOAD: Only manual refresh to prevent spam loops
  // Leads loading handled by main mount useEffect with loadQueue()

  // Planet View Timer Effect - 35 seconds countdown when call connects
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;

    if (callConnected && planetViewTimer > 0) {
      timerInterval = setInterval(() => {
        setPlanetViewTimer(prev => {
          if (prev <= 1) {
            debugLog('⏰ Planet View timer finished - button now available');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [callConnected, planetViewTimer]);

  // Monitor call connection state to start timer - ONLY for Hot Leads
  useEffect(() => {
    if (dialerState.dialingStatus === 'connected') {
      const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
      const isHotLead =
        currentLead?.source_table === 'hotleads' ||
        currentLead?.market === 'Hot Lead' ||
        currentLead?.isHotLead;

      if (isHotLead) {
        debugLog('🔥 Hot Lead call connected - starting 35 second Planet View timer');
        setPlanetViewTimer(35);
      } else {
        debugLog('📞 Regular lead call connected - no timer restrictions');
        setPlanetViewTimer(0);
      }
    } else if (dialerState.dialingStatus === 'idle') {
      debugLog('📴 Call ended - resetting timer state');
      setPlanetViewTimer(0);
    }
  }, [dialerState.dialingStatus, dialerState.availableLeads, dialerState.currentLeadIndex]);

  // Reset call timer when a new VDP call starts so duration counts from 0 (enables dispositions)
  useEffect(() => {
    if (dialerState.vdpCallStatus?.hasVDPCall) {
      setCallDurationSeconds(0);
    }
  }, [dialerState.vdpCallStatus?.hasVDPCall, dialerState.vdpCallStatus?.vdpCall?.id]);

  // Call timer effect - tracks actual conversation time with hotlead auto-assignment
  // CRITICAL: Also run timer for VDP/AOIntel inbound calls - without this, dispositions (callback, booked, etc.) stay disabled
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    // Include all active call statuses: connected, ringing, dialing, in_progress
    const hasOutboundCall = dialerState.dialingStatus === 'connected' ||
                           dialerState.dialingStatus === 'ringing' ||
                           dialerState.dialingStatus === 'dialing' ||
                           dialerState.dialingStatus === 'in_progress';
    const hasVdpCall = dialerState.vdpCallStatus?.hasVDPCall;
    
    // When a new call starts (dialing/ringing/connected), reset finalCallDuration from previous call
    if (hasOutboundCall && finalCallDuration > 0) {
      setFinalCallDuration(0);
    }
    
    if (hasOutboundCall || hasVdpCall) {
      interval = setInterval(() => {
        setCallDurationSeconds(prev => {
          const newDuration = prev + 1;

          // Check for hotlead auto-assignment (outbound only)
          const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
          const isHotLead = currentLead && (
            currentLead?.is_hot_lead === true || currentLead?.is_hot_lead === 'true' || currentLead?.is_hot_lead === 1 ||
            currentLead?.isHotLead === true || currentLead?.isHotLead === 'true' || currentLead?.isHotLead === 1 ||
            currentLead?.source_table === 'hotleads' ||
            currentLead?.taalk_market === 'Hot Lead' ||
            currentLead?.market === 'Hot Lead'
          );

          // Debug logging every 15 seconds for more frequent updates
          if (newDuration % 15 === 0) {
            debugLog(`🔍 DETAILED CALL DEBUG: duration: ${newDuration}s, status: ${dialerState.dialingStatus}, vdp: ${hasVdpCall}`);
            if (!hasVdpCall) {
              debugLog(`🔥 HOTLEAD CHECK:`, {
                leadName: currentLead?.name,
                isHotLead: isHotLead,
                market: currentLead?.market,
                campaign_type: currentLead?.campaign_type,
                taalk_market: currentLead?.taalk_market,
                source_table: currentLead?.source_table,
                isHotLeadFlag: currentLead?.isHotLead
              });
            }
          }

          return newDuration;
        });

        if (hasOutboundCall) {
          setDialerState(prev => ({ 
            ...prev, 
            callDuration: prev.callDuration + 1 
          }));
        }
      }, 1000);
    } else {
      // When call ends, FREEZE the duration (don't reset it)
      // The duration should remain visible and usable for disposition validation
      // Only reset when explicitly starting a new call (handled in dialLead and handleDialNextLead)
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [dialerState.dialingStatus, dialerState.vdpCallStatus?.hasVDPCall, dialerState.availableLeads, dialerState.currentLeadIndex, authState?.user?.email, finalCallDuration]);

  // Poll Twilio webhook data for real call answered status
  useEffect(() => {
    if (dialerState.dialingStatus !== 'connected' || !dialerState.availableLeads[dialerState.currentLeadIndex]) {
      // Only clear timer if call actually ended (not just status change)
      // Don't clear if we're just checking status - let the timer complete
      if (webhookTimerRef.current && dialerState.dialingStatus === 'idle') {
        debugLog('🧹 Clearing 60-second webhook timer - call ended (idle status)');
        clearTimeout(webhookTimerRef.current);
        webhookTimerRef.current = null;
      }
      if (pstnAnswered && dialerState.dialingStatus === 'idle') setPstnAnswered(false);
      if (webhookTimerStarted && dialerState.dialingStatus === 'idle') setWebhookTimerStarted(false);
      return;
    }

    const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
    if (!currentLead?.phone) return;

    const checkCallStatus = async () => {
      try {
        const response = await fetch(`/api/twilio/call-status/${currentLead.phone}`);
        const data = await response.json();
        
        if (data.found && data.status === 'answered') {
          debugLog('📞 REAL TWILIO WEBHOOK: Call answered!', data);
          setPstnAnswered(true);
          
          // 🔥 START REACH WEBHOOK TIMER HERE (when call actually answered)
          // ONLY START ONCE PER CALL
          // Send webhook for ALL leads after 45 seconds, not just hotleads
          
          if (!webhookTimerStarted && !webhookTimerRef.current) {
            debugLog('🔥 CALL ANSWERED - Starting 45-second reach webhook timer');
            setWebhookTimerStarted(true);
            
            // Clear any existing timer first
            if (webhookTimerRef.current) {
              clearTimeout(webhookTimerRef.current);
            }
            
            // Store lead data in closure to avoid stale data
            const leadId = currentLead?.taalk_lead_id || currentLead?.lead_id || currentLead?.id;
            const userEmail = authState?.user?.email;
            const associateId = (authState?.profile as any)?.associate_id;
            
            if (!associateId) {
              console.error(`❌ CRITICAL: No associate_id for ${userEmail}. Cannot send reach webhook (never send 999).`);
              return;
            }
            
            debugLog(`⏰ SETTING 45-SECOND REACH TIMER: leadId=${leadId}, userEmail=${userEmail}, associateId=${associateId}`);
            
            // Start the timer and store it in ref
            const timerStartTime = Date.now();
            debugLog(`⏰ TIMER START TIME: ${new Date(timerStartTime).toISOString()}`);
            const reachWebhookDelayMs = 45000;
            debugLog(`⏰ TIMER WILL FIRE AT: ${new Date(timerStartTime + reachWebhookDelayMs).toISOString()}`);
            
            webhookTimerRef.current = setTimeout(async () => {
              const timerFireTime = Date.now();
              const actualElapsed = timerFireTime - timerStartTime;
              debugLog('🚨🚨🚨 45-SECOND REACH TIMER FIRED! 🚨🚨🚨');
              debugLog(`⏰ TIMER FIRE TIME: ${new Date(timerFireTime).toISOString()}`);
              debugLog(`⏰ ACTUAL ELAPSED: ${actualElapsed}ms (expected: 45000ms)`);
              debugLog('📤 Sending webhook...');
              
              if (leadId && userEmail) {
                const webhookPayload = {
                  lead_id: leadId,
                  taalk_lead_id: leadId,
                  associate_id: associateId,
                  agent_email: userEmail // Send email so server can resolve if associate_id missing
                };
                
                debugLog('📤📤📤 45-SECOND REACH WEBHOOK (REAL ANSWERED): Sending to Zapier', webhookPayload);
                debugLog('📤 Webhook: sending via /api/webhook/zapier-60sec-call');
                
                try {
                  const webhookStartTime = Date.now();
                  const webhookResponse = await fetch('/api/webhook/zapier-60sec-call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                  });
                  const webhookEndTime = Date.now();
                  
                  if (webhookResponse.ok) {
                    const responseData = await webhookResponse.text();
                    debugLog(`✅✅✅ REACH WEBHOOK SUCCESS! ✅✅✅`);
                    debugLog(`✅ Lead: ${leadId} | Producer: ${userEmail} (${associateId})`);
                    debugLog(`✅ Response: ${responseData}`);
                    debugLog(`✅ Webhook took: ${webhookEndTime - webhookStartTime}ms`);
                  } else {
                    const errorText = await webhookResponse.text();
                    console.error(`❌❌❌ REACH WEBHOOK FAILED! ❌❌❌`);
                    console.error(`❌ Status: ${webhookResponse.status}`);
                    console.error(`❌ Response: ${errorText}`);
                  }
                } catch (error) {
                  console.error(`❌❌❌ REACH WEBHOOK ERROR! ❌❌❌`, error);
                }
              } else {
                console.warn('⚠️⚠️⚠️ REACH WEBHOOK: Missing leadId or userEmail', { leadId, userEmail });
              }
              
              // Clear the ref after timer fires
              webhookTimerRef.current = null;
            }, reachWebhookDelayMs); // 45 seconds (reach threshold)
            
            debugLog(`✅✅✅ 45-SECOND REACH TIMER STARTED ✅✅✅`);
            debugLog(`✅ Timer ID: ${webhookTimerRef.current}`);
            debugLog(`✅ Lead ID: ${leadId}`);
            debugLog(`✅ User Email: ${userEmail}`);
            debugLog(`✅ Associate ID: ${associateId}`);
          }
        } else if (data.found && (data.status === 'completed' || data.status === 'failed')) {
          debugLog('📞 REAL TWILIO WEBHOOK: Call ended', data);
          
          // Clear timer when call ends
          if (webhookTimerRef.current) {
            debugLog('🧹 Clearing 60-second webhook timer - call ended');
            clearTimeout(webhookTimerRef.current);
            webhookTimerRef.current = null;
          }
          
          setPstnAnswered(false);
          setWebhookTimerStarted(false);
        }
      } catch (error) {
        console.error('Failed to check call status:', error);
      }
    };

    // Check immediately and then every 5 min during active call
    if (dialerState.dialingStatus === 'connected') {
      checkCallStatus();
      const interval = setInterval(checkCallStatus, 300000);
      return () => {
        clearInterval(interval);
        // DON'T clear timer on cleanup - let it complete even if effect re-runs
        // The timer will fire and send the webhook regardless
        debugLog('🧹 Cleaning up call status check interval (60s webhook timer will continue)');
      };
    }
  }, [dialerState.dialingStatus, dialerState.availableLeads, dialerState.currentLeadIndex, pstnAnswered, webhookTimerStarted, authState?.user?.email, authState?.profile]);

  // Auto-save position with TTL whenever currentLeadIndex changes (expires after 30 min inactivity)
  useEffect(() => {
    const userEmail = authState?.user?.email;
    if (userEmail) {
      savePositionWithTTL(userEmail, dialerState.currentLeadIndex);
      debugLog(`💾 AUTO-SAVED POSITION: ${dialerState.currentLeadIndex} for ${userEmail}`);
    }
  }, [dialerState.currentLeadIndex, authState?.user?.email]);

  // Auto-refetch when leasedialer local buffer drops low
  useEffect(() => {
    if (!isLeaseDialerRoute) return;
    // Do not block or churn the UI while agents are dialing from the local 50-lead buffer.
    // Server-side refill can happen out of band; dialing must advance locally.
    return;
    const remaining = Math.max(
      0,
      (dialerState.availableLeads?.length || 0) - (dialerState.currentLeadIndex || 0),
    );
    if (remaining > 25) return;
    if (isLoadingQueue) return;
    if (dialerState.webRTCConferenceActive) return;
    if (dialerState.callStatus === 'connected') return;
    if (!authState?.user?.email) return;
    loadQueue({ forceRefill: false });
  }, [
    isLeaseDialerRoute,
    dialerState.availableLeads?.length,
    dialerState.currentLeadIndex,
    dialerState.webRTCConferenceActive,
    dialerState.callStatus,
    isLoadingQueue,
    authState?.user?.email,
  ]);

  // Call lead mutation removed - using direct TestCall pattern instead

  const logWebRtcTrace = (path: string, deviceObj: any, connectionObj?: any) => {
    debugLog('WEBRTC_TRACE', {
      path,
      deviceState: deviceObj?.state,
      deviceHasOn: typeof deviceObj?.on === 'function',
      deviceHasConnect: typeof deviceObj?.connect === 'function',
      connectionType: connectionObj ? typeof connectionObj : 'none',
      connectionHasOn: connectionObj ? typeof connectionObj?.on === 'function' : false,
      timestamp: new Date().toISOString(),
    });
  };

  const waitForDeviceReadyOrTimeout = async (
    deviceObj: any,
    source: 'dialLead' | 'handleCallLead',
    timeoutMs = 4000 // Fail fast for outbound start; don't stall 20-30s.
  ) => {
    if (isDeviceConnectReady(deviceObj)) return;
    pushWebRtcDebug(`${source}:wait-connect-ready:start`, {
      state: deviceObj?.state,
      timeoutMs,
    });
    await new Promise<void>((resolve, reject) => {
      // Safe helper for removing listeners
      const safeOff = (event: string, handler: (...args: any[]) => void) => {
        if (!deviceObj) return;
        
        // DEBUG: Log available methods before attempting cleanup
        debugLog("🔍 [WEBRTC DEBUG] about to safeOff() in waitForDeviceReadyOrTimeout", {
          hasOff: typeof deviceObj.off === "function",
          hasRemoveListener: typeof deviceObj.removeListener === "function",
          hasRemoveAllListeners: typeof deviceObj.removeAllListeners === "function",
          deviceType: typeof deviceObj,
          deviceState: deviceObj?.state,
          event,
          hasHandler: !!handler,
        });
        
        try {
          if (typeof deviceObj.off === "function") {
            deviceObj.off(event, handler);
          } else if (typeof deviceObj.removeListener === "function") {
            deviceObj.removeListener(event, handler);
          }
        } catch (e) {
          console.warn('⚠️ [WEBRTC DEBUG] Error removing listener in waitForDeviceReadyOrTimeout:', e);
        }
      };
      
      const timeout = setTimeout(() => {
        const currentState = deviceObj?.state;
        safeOff('ready', onReady);
        safeOff('registered', onRegistered);
        safeOff('error', onError);
        reject(new Error(`Device did not become connect-ready within ${timeoutMs}ms (current state: ${currentState}). Check network connection and microphone permissions.`));
      }, timeoutMs);
      const onReady = () => {
        clearTimeout(timeout);
        safeOff('ready', onReady);
        safeOff('registered', onRegistered);
        safeOff('error', onError);
        resolve();
      };
      const onRegistered = () => {
        clearTimeout(timeout);
        safeOff('ready', onReady);
        safeOff('registered', onRegistered);
        safeOff('error', onError);
        resolve();
      };
      const onError = (error: any) => {
        clearTimeout(timeout);
        safeOff('ready', onReady);
        safeOff('registered', onRegistered);
        safeOff('error', onError);
        reject(new Error(`Device error while waiting for connect-ready: ${error?.message || error}`));
      };
      deviceObj.once('ready', onReady);
      deviceObj.once('registered', onRegistered);
      deviceObj.once('error', onError);
    });
    pushWebRtcDebug(`${source}:wait-connect-ready:done`, {
      state: deviceObj?.state,
    });
  };



  // Guard dialLead() from broken state
  async function dialLead(specificLead?: Lead) {
    // CRITICAL: Resume AudioContext if not already running
    // This ensures AudioContext is active when Twilio SDK needs it
    try {
      let audioContext = (window as any).__webrtcAudioContext;
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContext = new AudioContextClass();
          (window as any).__webrtcAudioContext = audioContext;
          debugLog('🔊 [WEBRTC DEBUG] Created new AudioContext in dialLead');
        }
      }
      if (audioContext && audioContext.state !== 'running') {
        debugLog(`🔊 [WEBRTC DEBUG] AudioContext state: ${audioContext.state}, resuming in dialLead...`);
        await audioContext.resume();
        debugLog(`✅ [WEBRTC DEBUG] AudioContext resumed in dialLead, state: ${audioContext.state}`);
      }
    } catch (audioError: any) {
      console.error('❌ [WEBRTC DEBUG] Failed to resume AudioContext in dialLead:', audioError);
      // Continue anyway
    }
    // CRITICAL: Block if auth not ready — prevents missing agent email in twilio_call_logs
    if (!authState.initialized || !authState.user?.email?.includes?.('@')) {
      toast({ title: 'Sign-in required', description: 'Please sign in to use the dialer.', variant: 'destructive' });
      return;
    }
    // ── Dialer Gate: block if overdue appointment outcomes exist ──────────
    if (dialerGate.isBlocked) {
      setOutcomeModalOpen(true);
      return;
    }
    if (dialLeadInFlightRef.current) {
      toast({
        title: 'Dial already starting',
        description: 'Please wait for the current dial attempt.',
        variant: 'destructive',
      });
      return;
    }
    dialLeadInFlightRef.current = true;
    try {
    // Reset call duration when starting a new call - but keep finalCallDuration until call actually starts
    setCallDurationSeconds(0);
    // Don't reset finalCallDuration here - let it show until the new call actually connects
    
    // REMOVED: VDP status check - outbound calls work independently of VDP status
    // VDP can be online or offline, outbound dialing should always work when powered on
    // NO VDP CHECK - Outbound dialing works regardless of VDP status or active inbound calls
    
    // 🎭 DEMO MODE: In demo mode, make REAL call to agent's phone number (from demo lead)
    // The demo lead has the agent's phone number, so this will call their actual phone
    if (isCCPDemo) {
      debugLog('🎭 DEMO MODE: Making real call to agent phone number from demo lead');
    }
    debugLog('🚀 dialLead called - checking device and lead state');

    // REMOVED: VDP status check that was blocking outbound calls
    // Outbound calls should work independently of VDP status
    // VDP can be online or offline - it doesn't affect outbound dialing capability
    // NO VDP CHECK - Outbound dialing works regardless of VDP status or active inbound calls

    // Guard: FTC COMPLIANCE CHECK - Block calls outside 8 AM - 9 PM in lead's timezone
    // Filter out ALL FTC restricted leads at once to prevent infinite loops
    let lead = specificLead || dialerState?.availableLeads?.[dialerState?.currentLeadIndex ?? 0] || dialerState?.availableLeads?.[0];
    if (lead) {
      const leadStateForFtc = getLeadStateForFtc(lead);
      const isPermitted = isCallPermissibleFrontend(leadStateForFtc, (lead as any).ftcRestricted || (lead as any).ftcrestricted);
      if (!isPermitted) {
        console.error(`🚫 FTC VIOLATION: Removing ${lead.name} in ${leadStateForFtc} - outside calling hours`);

        const leadKey = String((lead as any)?.id ?? (lead as any)?.taalk_lead_id ?? (lead as any)?.leadId ?? (lead as any)?.phone ?? '');
        const updatedLeads = dialerState.availableLeads.filter((candidate: any) => {
          const candidateKey = String(candidate?.id ?? candidate?.taalk_lead_id ?? candidate?.leadId ?? candidate?.phone ?? '');
          if (candidateKey && leadKey && candidateKey === leadKey) return false;
          return isCallPermissibleFrontend(getLeadStateForFtc(candidate), candidate?.ftcRestricted || candidate?.ftcrestricted);
        });

        const nextCompliantLead = updatedLeads[0] || null;

        if (isLeaseDialerRoute && (lead as any)?.id && authState?.user?.email) {
          void apiRequest('POST', '/api/leasedialer/release-to-pool', {
            leadId: (lead as any).id,
            agentEmail: authState.user.email,
            reason: 'browser_outside_calling_window',
          }, authState.user.email).catch((error) => {
            console.warn('⚠️ Failed to release outside-hours leased lead back to pool:', error);
          });
        }

        setDialerState(prev => ({
          ...prev,
          leads: updatedLeads,
          availableLeads: updatedLeads,
          currentLeadIndex: 0,
          currentIndex: 0,
          availableLeadsCount: updatedLeads.length,
          currentCall: nextCompliantLead,
          dialingStatus: nextCompliantLead ? 'dialing' : 'ready',
          callStatus: nextCompliantLead ? 'connecting_direct' : 'idle',
          selectedDisposition: '',
          dispositionApplied: false,
        }));

        if (nextCompliantLead) {
          debugLog('🔄 Outside-hours lead removed; auto-dialing next compliant lead', {
            removedLead: lead?.name,
            removedState: leadStateForFtc,
            nextLead: nextCompliantLead?.name,
            remaining: updatedLeads.length,
          });
          setTimeout(() => void dialLead(nextCompliantLead), 250);
        } else {
          debugLog('❌ No compliant leads left after removing outside-hours leads; refreshing queue');
          void loadQueue({ forceRefill: true });
        }

        return;
      }
    }

    // Guard: Check WebRTC device readiness - ALWAYS use window.twilioDevice as source of truth
    // This ensures we're checking the actual device instance that's registered
    const twilioDevice = (window as any).twilioDevice;
    let deviceToCheck = twilioDevice || device;
    
    // Log which device instance we're checking
    const deviceSource = twilioDevice ? 'window.twilioDevice' : (device ? 'global device' : 'none');
    debugLog('🔍 Device check - source:', deviceSource, 'device exists:', !!deviceToCheck);
    
    if (!deviceToCheck) {
      toast({
        title: 'Power On Required',
        description: 'Power On WebRTC first, then Start Dialing.',
        variant: 'destructive',
      });
      throw new Error('WebRTC device not initialized. Power On first.');
    }

    // Sync global device variable with the actual device being used
    if (twilioDevice && device !== twilioDevice) {
      debugLog('🔄 Syncing global device variable with window.twilioDevice');
      device = twilioDevice;
    }

    // SIMPLE: Just try to connect - device.connect() will work when device is ready
    // No need to check state - let the connect call handle it (like working code)
    debugLog('📞 Attempting to connect - device will handle registration automatically');

    // Hard guard: never start a second dial while first call is active.
    const activeConnFromSdk =
      typeof deviceToCheck?.activeConnection === 'function' ? deviceToCheck.activeConnection() : null;
    if ((window as any).twilioConnection || activeConnFromSdk) {
      toast({
        title: 'Call already active',
        description: 'Finish or end the current call before dialing again.',
        variant: 'destructive',
      });
      throw new Error('Dial blocked: active call already exists');
    }

    // Re-check lead after guards (may have been updated)
    lead = specificLead || dialerState?.availableLeads?.[dialerState?.currentLeadIndex ?? 0] || dialerState?.availableLeads?.[0];
    if (!lead || !lead.phone) {
      const errorMsg = 'No valid lead available';
      console.error('❌', errorMsg);
      toast({
        title: 'No Lead Available',
        description: 'Please load leads before dialing',
        variant: 'destructive'
      });
      throw new Error(errorMsg);
    }

    debugLog('📞 DIALING LEAD:', lead.name, lead.phone);
    debugLog('✅ VDP BYPASS: Outbound dialing allowed regardless of VDP status');
    setStatus(`Calling ${lead.name}...`);
    // Immediate right-panel feedback: each dial trigger counts as an attempt now.
    markDialCounted(
      null,
      lead.id ?? lead.taalk_lead_id ?? null,
      `diallead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );


    // Never block ringing on tracking writes.
    const runDialSideEffects = async () => {
      // 📊 USAGE TRACKING: Track Call Connector Pro call start — fire-and-forget
      void fetch('/api/usage/ccpro-call-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: authState?.user?.email,
          sessionId: authState?.session?.id || `session-${Date.now()}`,
          callId: (window as any).currentCallSid || `call-${Date.now()}`
        }),
      }).catch(() => {});

      // 📊 CALL TRACKING: Log the dial attempt to database — fire-and-forget, never block the call
      void segmentedFetch('/api/outbound-dialer/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            phone: lead.phone,
            name: lead.name,
            state: (lead as any).taalk_state || lead.state,
            market: lead.market,
            id: lead.id,
            leadId: (lead as any).leadId || lead.id,
            taalk_lead_id: (lead as any).taalk_lead_id,
            assignmentId: (lead as any).assignmentId || (lead as any).assignment_id,
          },
          userEmail: authState?.user?.email
        })
      }).catch(err => console.warn('⚠️ Call tracking error (non-blocking):', err));

      // Update BOTH masterlead AND hotlead last_contacted timestamp when call is initiated
      // Fire-and-forget — do NOT block the call on this
      void updateAllLeadLastContacted(lead.phone);
    };

    // DISABLED: Hotlead priority system - no longer auto-prioritizing hotleads
    // if (lead.isHotLead || lead.market === 'Hot Lead') {
    //   try {
    //     debugLog('🔄 Resetting hotlead priority to 0 for NEXT call:', lead.name);

    //     await fetch('/api/hotleads/reset-priority', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         leadId: lead.id,
    //         phone: lead.phone
    //       })
    //     });
    //     debugLog('✅ Hotlead priority reset - will appear lower in NEXT queue refresh');
    //   } catch (error) {
    //     console.error('⚠️ Failed to reset hotlead priority:', error);
    //   }
    // }

    try {
      // DIRECT CALL: Producer Calls lead directly (NO CONFERENCE)
      debugLog(`📞 Making DIRECT call to lead: ${lead.name} (${lead.phone})`);

      // Store lead info for display
      setDialerState(prev => ({ 
        ...prev, 
        currentCall: lead,
        viewedLead: lead,
        callStatus: 'connecting_direct'
      }));

      // 🍎 MAC-SPECIFIC: Ensure microphone permission before connecting
      if (isMac()) {
        debugLog('🍎 Mac detected - verifying microphone permission before connect...');
        const micResult = await requestMicrophonePermission();
        if (!micResult.success) {
          toast({
            title: 'Microphone Permission Required',
            description: micResult.error || 'Please allow microphone access to make calls. Check System Preferences > Security & Privacy > Microphone.',
            variant: 'destructive',
            duration: 5000
          });
          throw new Error(micResult.error || 'Microphone permission denied');
        }
      }

      // WebRTC requires a signed-in user – never send a call without one
      const userEmail = authState?.user?.email;
      if (!userEmail || !userEmail.includes('@')) {
        toast({ title: 'Sign-in required', description: 'You must be signed in to make calls.', variant: 'destructive' });
        throw new Error('Sign-in required');
      }
      // If device dropped (null or unregistered), re-register it immediately before dialing
      if (!deviceToCheck || !isDeviceConnectReady(deviceToCheck)) {
        const deviceState = deviceToCheck?.state ?? 'null';
        debugLog(`⚡ Device not ready (state: ${deviceState}) — reconnecting WebRTC before dial...`);
        const macStream = isMac() ? (window as any).__macMicrophoneStream : undefined;
        const reconnected = await powerOnWebRTC(userEmail, userEmail, macStream, incomingCallHandlers);
        if (!reconnected) {
          const failureToast = getWebRtcFailureToast();
          throw new Error(`${failureToast.title}: ${failureToast.description}`);
        }
        // Re-grab the (now registered) device
        deviceToCheck = (window as any).twilioDevice || device;
        debugLog('✅ WebRTC reconnected — proceeding with dial');
      }

      logWebRtcTrace('dialLead:before-connect', deviceToCheck);
      pushWebRtcDebug('dialLead:before-connect', {
        deviceState: deviceToCheck?.state,
        leadPhone: lead.phone,
        leadName: lead.name,
        userEmail,
      });
      debugLog('📞 Device is ready - connecting call (SIMPLE - like test HTML)...');
      // device.connect() returns Promise<Call> in Twilio Voice SDK v2 — must await
      const callConnection = await deviceToCheck.connect({
        params: {
          To: lead.phone.replace(/\D/g, ''),
          leadName: lead.name,
          leadState: lead.taalk_state || lead.state || 'Unknown',
          leadId: String((lead as any).leadId || lead.id || ''),
          taalkLeadId: String((lead as any).taalk_lead_id || ''),
          assignmentId: String((lead as any).assignmentId || (lead as any).assignment_id || ''),
          agentEmail: userEmail,
          agentName: (authState?.user as any)?.name || userEmail.split('@')[0] || 'Producer',
        }
      });

      (window as any).twilioConnection = callConnection;
      void runDialSideEffects();

      let callAcceptedOrEnded = false;
      let callWasAccepted = false;
      const callStartTimeout = window.setTimeout(() => {
        if (callAcceptedOrEnded) return;
        callAcceptedOrEnded = true;
        handleOutboundCallStartTimeout(lead, callConnection, 'dialLead', userEmail);
      }, outboundCallStartTimeoutMs);

      // Set up connection event listeners
      callConnection.on('accept', async () => {
        callAcceptedOrEnded = true;
        callWasAccepted = true;
        window.clearTimeout(callStartTimeout);
        debugLog('✅ producer WebRTC call accepted - DIRECT CALL CONNECTED');
        void syncTaskRouterState('outbound-call-accept', { force: 'busy' });
        // 🎭 DEMO MODE: Track that demo call started
        if (isCCPDemo) {
          setDemoCallStarted(true);
        }
        
        // Update state to show connected
        setDialerState(prev => ({ 
          ...prev, 
          dialingStatus: 'connected',
          isConnected: true,
          webRTCConferenceActive: true
        }));
        setStatus(`Connected to ${lead.name} - Live call`);
        
        // Track usage: Update agent status to 'in_call'
        if (authState?.user?.email) {
          try {
            await fetch('/agent/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_email: authState.user.email,
                status: 'in_call'
              })
            });
            debugLog('✅ Updated agent status to in_call');
          } catch (error) {
            console.warn('⚠️ Failed to update agent status to in_call:', error);
          }
        }
      });

      // PERSISTENT: Don't reset state on disconnect, keep WebRTC ready
      // CRITICAL: When remote party hangs up, KEEP currentCall + freeze duration so agent can add disposition
      callConnection.on('disconnect', async () => {
        callAcceptedOrEnded = true;
        window.clearTimeout(callStartTimeout);
        // If outbound never reached accept, treat as no-answer/failed and auto-advance so the same lead is not presented repeatedly.
        if (!callWasAccepted && lead?.id) {
          toast({
            title: 'No Answer — Skipping',
            description: `${lead.name || 'Lead'} (${lead.phone}) did not connect. Auto-marked No Answer.`,
            variant: 'default',
            duration: 3000,
          });
          void masterleadUpdateResolution({
            leadId: lead.id,
            cnresolution: 'no_answer',
            agentEmail: userEmail || undefined,
          }).catch((e: any) => console.warn('⚠️ Auto-disposition update failed (non-critical):', e));
          setTimeout(() => {
            setDialerState((prev) => {
              const failedLeadKey = String(lead?.id ?? lead?.taalk_lead_id ?? lead?.leadId ?? lead?.phone ?? '');
              const nextAvailableLeads = (prev.availableLeads || []).filter((candidate: any) => {
                const candidateKey = String(candidate?.id ?? candidate?.taalk_lead_id ?? candidate?.leadId ?? candidate?.phone ?? '');
                return !(failedLeadKey && candidateKey && failedLeadKey === candidateKey);
              });
              const nextLead = nextAvailableLeads[0] || null;
              if (nextLead?.phone) {
                setTimeout(() => {
                  void dialLead(nextLead);
                }, 250);
              } else {
                void loadQueue({ forceRefill: true });
              }
              return {
                ...prev,
                leads: nextAvailableLeads,
                availableLeads: nextAvailableLeads,
                availableLeadsCount: nextAvailableLeads.length,
                currentLeadIndex: 0,
                currentIndex: 0,
                dialingStatus: nextLead ? 'dialing' : 'ready',
                callStatus: nextLead ? 'connecting_direct' : 'idle',
                currentCall: nextLead,
                viewedLead: nextLead,
                webRTCConferenceActive: false,
                isConnected: false,
                selectedDisposition: '',
                dispositionApplied: false,
              };
            });
          }, 400);
          return;
        }
        debugLog('🔌 WebRTC call disconnected - KEEPING DEVICE ACTIVE (preserving lead for disposition)');
        // Restore TaskRouter based on current toggle/device state.
        let duration = 0;
        setDialerState(prev => {
          duration = prev.callDuration || 0;
          return {
            ...prev,
            dialingStatus: 'ready',
            callStatus: 'idle',
            // KEEP currentCall - agent needs it for disposition! Only clear on "Complete Call & Dial Next"
            isConnected: false,
            webRTCConferenceActive: false,
            callDuration: duration, // Preserve for disposition (e.g. callback requires > 0)
            // KEEP powered: true - WebRTC stays active!
          };
        });
        setFinalCallDuration(duration);
        setStatus('Call ended');
        // Rotate off outbound call: always put back to AvailableInbound when device still on (so TaskRouter doesn't leave them BusyOnCall).
        void syncTaskRouterState('outbound-call-disconnect', {
          force: isPoweredOnRef.current ? 'online' : 'offline',
        });

        // Track usage: Update agent status back to 'ready' (available)
        if (authState?.user?.email) {
          try {
            await fetch('/agent/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_email: authState.user.email,
                status: 'ready'
              })
            });
            debugLog('✅ Updated agent status to ready');
          } catch (error) {
            console.warn('⚠️ Failed to update agent status to ready:', error);
          }
        }
      });

      callConnection.on('error', (error: any) => {
        callAcceptedOrEnded = true;
        window.clearTimeout(callStartTimeout);
        console.error('❌ WebRTC connection error:', error);
        // Don't destroy device on error, keep it active
        setDialerState(prev => ({ 
          ...prev, 
          dialingStatus: 'error',
          isConnected: false,
          // KEEP powered: true - WebRTC stays active!
        }));
      });

    } catch (error: any) {
      console.error('❌ Dial failed:', error);
      pushWebRtcDebug('dialLead:failed', {
        message: error?.message,
        stack: error?.stack,
      });
      // Don't destroy device on error, keep it active
      setDialerState(prev => ({ 
        ...prev, 
        dialingStatus: 'error',
        isConnected: false,
        // KEEP powered: true - WebRTC stays active!
      }));
      throw error;
    }
    } finally {
      dialLeadInFlightRef.current = false;
    }
  }



  const disconnectWebRTCDevice = () => {
    if (device) {
      withAllowedTwilioDeviceDestroy(() => device.destroy());
      device = null;
    }
    setDialerState(prev => ({ ...prev, webRTCConferenceActive: false }));
  };

  // Power button handler - simplified for Call Connector Pro with debouncing

  // START DIALING - Initialize WebRTC AND dial the lead
  const testSimpleCall = async (lead: Lead) => {
    try {
      debugLog(`📞 START DIALING: Initializing WebRTC and calling ${lead.name} at ${lead.phone}`);

      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'dialing',
        currentCall: lead
      }));

      toast({
        title: 'Initializing Call System',
        description: `Setting up WebRTC and calling ${lead.name}...`
      });

      // 🍎 MAC-SPECIFIC: Request microphone permission BEFORE initializing Twilio Device
      if (isMac()) {
        debugLog('🍎 Mac detected - requesting microphone permission first...');
        setStatus('Requesting microphone permission...');
        const micResult = await requestMicrophonePermission();
        if (!micResult.success) {
          toast({
            title: 'Microphone Permission Required',
            description: micResult.error || 'Please allow microphone access to make calls.',
            variant: 'destructive',
            duration: 5000
          });
          throw new Error(micResult.error || 'Microphone permission denied');
        }
      }

      // Step 1: Initialize WebRTC Device (from test-call logic)
      debugLog('🔌 Step 1: Initializing WebRTC device...');
      setStatus('Fetching token...');

      const res = await fetchTwilioVoiceToken(authState?.user?.email);
      const tokenData = await res.json();
      const token = tokenData.token;
      debugLog('✅ Token received:', token?.slice(0, 50) + '...');
      debugLog('✅ Token length:', token?.length, 'characters');

      const Device = TwilioDevice;
      if (!Device) {
        throw new Error('Twilio SDK not loaded');
      }

      debugLog('🚀 Creating Twilio Device...');
      device = new Device(token, { debug: true });
      (window as any).twilioDevice = device;

      // Set up device events BEFORE registering
      device.on('connect', (connection: any) => {
        debugLog('🔌 WebRTC CONNECTED:', connection);
      });

      device.on('disconnect', (connection: any) => {
        debugLog('🔌 WebRTC DISCONNECTED:', connection);
      });

      device.on('error', (error: any) => {
        console.error('❌ WebRTC ERROR:', error);
      });

      device.on('ready', async () => {
        debugLog('📞 Device ready - producer joins conference FIRST');
        setStatus('Creating conference...');
        

        // Generate unique conference name
        const agentId = authState?.user?.email?.split('@')[0] || 'producer';
        const uniqueConferenceName = `ConnectNow-${agentId}-${Date.now()}`;
        debugLog(`🎧 producer joining conference: ${uniqueConferenceName}`);

        // 🍎 MAC-SPECIFIC: Ensure microphone permission before connecting
        if (isMac()) {
          debugLog('🍎 Mac detected - verifying microphone permission before connect...');
          const micResult = await requestMicrophonePermission();
          if (!micResult.success) {
            toast({
              title: 'Microphone Permission Required',
              description: micResult.error || 'Please allow microphone access to make calls. Check System Preferences > Security & Privacy > Microphone.',
              variant: 'destructive',
              duration: 5000
            });
            throw new Error(micResult.error || 'Microphone permission denied');
          }
        }

        // Step 1: producer joins conference FIRST via WebRTC (no To parameter = uses TwiML app)
        const confUserEmail = authState?.user?.email;
        if (!confUserEmail || !confUserEmail.includes('@')) {
          toast({ title: 'Sign-in required', description: 'You must be signed in to make calls.', variant: 'destructive' });
          throw new Error('Sign-in required');
        }
        const connection = await device.connect({
          params: {
            conferenceName: uniqueConferenceName,
            participantType: 'producer',
            agentEmail: confUserEmail,
            agentName: (authState?.user as any)?.name || confUserEmail.split('@')[0] || 'Producer'
          }
        });

        debugLog('✅ producer WebRTC connected to conference');
        (window as any).twilioConnection = connection;

        // Step 2: Call lead to join same conference
        const response = await fetch('/api/simple-outbound/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadPhone: lead.phone,
            leadName: lead.name,
            leadState: lead.state || 'Unknown',
            agentEmail: authState?.user?.email,
            conferenceName: uniqueConferenceName
          })
        });

        const result = await response.json();

        if (result.success) {
          debugLog(`✅ Lead call initiated to join conference - CallSID: ${result.callSid}`);
          markDialCounted(result.callSid, lead.id ?? lead.taalk_lead_id ?? null);

          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'ringing',
            currentCall: lead,
            currentConferenceName: uniqueConferenceName
          }));

          toast({
            title: 'Ringing',
            description: `Calling ${lead.name}…`
          });
        } else {
          throw new Error(result.error || 'Lead call failed');
        }
      });

      device.on('error', (err: any) => {
        console.error('❌ Device Error:', err);
        setStatus(`WebRTC Error: ${err.message}`);
        throw new Error(`WebRTC Error: ${err.message}`);
      });

      device.on('registered', async () => {
        debugLog('🎯 Device registered successfully - BYPASSING WEBRTC FOR DIRECT CALLING');
        setStatus('Device Ready - Starting Direct Call');
        clearTimeout(registrationTimeout);

        // SIMPLE WORKING APPROACH: Just call the lead directly
        debugLog('📞 Making simple outbound call to lead...');

        try {
          const response = await fetch('/api/simple-outbound/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadPhone: lead.phone,
              leadName: lead.name,
              leadState: lead.state || 'Unknown',
              agentEmail: authState?.user?.email
            })
          });

          const result = await response.json();

          if (result.success) {
            debugLog(`✅ Call initiated - CallSID: ${result.callSid}`);
            markDialCounted(result.callSid, lead.id ?? lead.taalk_lead_id ?? null);

            setDialerState(prev => ({
              ...prev,
              dialingStatus: 'ringing',
              callStatus: 'calling_direct'
            }));
            
            // REMOVED: VDP should stay online during outbound calls
            // Agents need to stay available for inbound calls even while on outbound calls
            // Most outbound calls are voicemail, so VDP must remain online
            // VDP will only go offline if agent has an active inbound VDP call (handled by backend)
            // Do NOT set dialingStatus to 'connected' here — that would set TaskRouter BusyOnCall while still ringing.
            // Connected is set only when call is actually answered (e.g. status webhook or connection accept).

            toast({
              title: 'Ringing',
              description: `Calling ${lead.name} at ${lead.phone}`
            });

            // Store call for disconnect
            (window as any).currentCallSid = result.callSid;

            // REMOVED: 45-second hotlead webhook (not needed)

          } else {
            throw new Error(result.error || 'Call failed');
          }

        } catch (error) {
          console.error('❌ Call failed:', error);

          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'error',
            callStatus: 'failed'
          }));
        }
      });

      device.on('unregistered', () => {
        debugLog('📴 Device unregistered');
        setStatus('Device Unregistered');
      });

      // Add registration timeout
      const registrationTimeout = setTimeout(() => {
        console.error('⏰ Registration timeout after 15 seconds');
        setStatus('Registration timeout - check network/firewall');
      }, 15000);

      debugLog('📡 Registering WebRTC device...');
      setStatus('Registering WebRTC device...');

      // Clear timeout when ready event fires
      device.on('ready', () => {
        clearTimeout(registrationTimeout);
      });

      // 🍎 MAC-SPECIFIC: Microphone permission should already be granted from click handler
      // But verify again here as a safety check
      if (isMac()) {
        debugLog('🍎 Mac detected - verifying microphone permission is still active before device.register()...');
        // On Mac, if permission was granted in click handler, we should be good
        // But double-check by trying to get the stream again (should succeed instantly if already granted)
        try {
          const checkStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          checkStream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking
          debugLog('✅ Mac: Microphone permission confirmed active');
        } catch (error) {
          console.error('❌ Mac: Microphone permission lost or denied:', error);
          toast({
            title: 'Microphone Permission Lost',
            description: 'Microphone permission was lost. Click Start Dialing again and allow microphone access.',
            variant: 'destructive',
            duration: 5000
          });
          throw new Error('Microphone permission lost');
        }
      }

      device.register();

    } catch (error) {
      console.error('❌ START DIALING failed:', error);

      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'idle',
        currentCall: null
      }));

      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Failed to start call',
        variant: 'destructive'
      });
    }
  };

  /** Real power-on only (auto/Online). Power control in UI is display-only — no click behavior. */
  const handlePowerToggle = async (options?: { simpleRegister?: boolean; forcePowerOn?: boolean }) => {
    if (!options?.simpleRegister) return;

    if (powerTogglePromiseRef.current) {
      await powerTogglePromiseRef.current;
      return;
    }

    const powerTogglePromise = (async () => {
      setIsPowerToggling(true);
      try {
        if (options?.forcePowerOn || !isPoweredOn) {
          const agentEmail = authState?.user?.email;
          if (!agentEmail || !agentEmail.includes('@')) {
            toast({ title: 'Sign-in required', description: 'You must be signed in to use the dialer.', variant: 'destructive' });
            return;
          }

          const existingDevice = (window as any).twilioDevice;
          if (existingDevice && (existingDevice.state === 'registered' || existingDevice.state === 'ready')) {
            setHasMicIssue(false);
            isPoweredOnRef.current = true;
            setIsPoweredOn(true);
            setDialerState((prev) => ({
              ...prev,
              powered: true,
              dialingStatus: prev.dialingStatus === 'idle' ? 'ready' : prev.dialingStatus,
            }));
            manualPowerOffRef.current = false;
            await syncTaskRouterState('power-on-success');
            toast({ title: 'WebRTC Ready', description: 'You are already connected.' });
            return;
          }

          if (isMac()) {
            const micResult = await requestMicrophonePermission(true);
            if (!micResult.success) {
              setHasMicIssue(true);
              autoPowerOnAttemptedRef.current = false;
              if (micResult.needsRecovery) setShowMicRecoveryModal(true);
              toast({
                title: 'Microphone Permission Required',
                description: micResult.error || 'Please allow microphone access to make calls.',
                variant: 'destructive',
                duration: 8000,
              });
              return;
            }
            if (micResult.stream) {
              (window as any).__macMicrophoneStream = micResult.stream;
            }
          }

          const macStream = isMac() ? (window as any).__macMicrophoneStream : undefined;
          const powered = await powerOnWebRTC(agentEmail, agentEmail, macStream, incomingDeviceHandlers, options);
          if (!powered) {
            autoPowerOnAttemptedRef.current = false;
            const failureToast = getWebRtcFailureToast();
            toast({
              title: failureToast.title,
              description: failureToast.description,
              variant: 'destructive',
            });
            return;
          }

          setHasMicIssue(false);
          isPoweredOnRef.current = true;
          setIsPoweredOn(true);
          setDialerState((prev) => ({
            ...prev,
            powered: true,
            webRTCConferenceActive: false,
            dialingStatus: prev.dialingStatus === 'idle' ? 'ready' : prev.dialingStatus,
          }));
          manualPowerOffRef.current = false;
          await syncTaskRouterState('power-on-success');
          toast({ title: 'WebRTC Powered On', description: 'Device connected. You can now Start Dialing. Use Online/Offline for inbound calls.' });
        }
      } catch (error) {
        autoPowerOnAttemptedRef.current = false;
        console.error('❌ Power toggle failed:', error);
      } finally {
        setIsPowerToggling(false);
      }
    })();

    powerTogglePromiseRef.current = powerTogglePromise;
    try {
      await powerTogglePromise;
    } finally {
      if (powerTogglePromiseRef.current === powerTogglePromise) {
        powerTogglePromiseRef.current = null;
      }
    }
  };
  handlePowerToggleRef.current = handlePowerToggle;

  // Call lead handler - Step 3E implementation
  const handleStartCall = async () => {
    // CRITICAL: Block until auth is ready — prevents intermittent missing agent email in twilio_call_logs
    if (!authState.initialized || !authState.user?.email?.includes?.('@')) {
      toast({ title: 'Sign-in required', description: 'Please wait for sign-in to complete, or sign in to use the dialer.', variant: 'destructive' });
      return;
    }
    const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
    if (!currentLead) {
      toast({
        title: 'No Lead Selected',
        description: 'Please select a lead to call',
        variant: 'destructive'
      });
      return;
    }

    // REMOVED: VDP status check - outbound calls work independently of VDP status
    // VDP can be online or offline, outbound dialing should always work when powered on

    try {
      debugLog('🎯 START DIALING clicked - using Step 3 conference flow');

      // Step 1: Connect producer to conference via WebRTC
      dialLead();

      // Step 2: Dial the lead via REST API to join same conference (pass agent so Twilio/call analytics link correctly)
      // CRITICAL: Never send cnsysop/unknown as agentEmail - causes wrong attribution in twilio_call_logs
      const BAD_AGENT_EMAIL = ['cnsysop@aoglobelife.com', 'unknown@aoglobelife.com', 'system@aoglobelife.com'];
      const rawEmail = authState?.user?.email?.toLowerCase?.();
      const agentEmailToSend = (rawEmail && !BAD_AGENT_EMAIL.includes(rawEmail)) ? authState?.user?.email : undefined;
      await fetch("/api/dial-lead", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(agentEmailToSend && { "x-user-email": agentEmailToSend }),
        },
        body: JSON.stringify({
          leadPhone: currentLead.phone,
          leadState: currentLead.state,
          conference: "conf_producer123",
          leadId: currentLead.taalk_lead_id || currentLead.leadId || currentLead.id,
          isHotLead: currentLead.isHotLead || currentLead.market === 'Hot Lead',
          agentEmail: agentEmailToSend ?? undefined,
          agentName: (authState?.user as any)?.user_metadata?.full_name ?? (authState?.user as any)?.name ?? undefined,
        })
      });

    setDialerState((prev) => ({
      ...prev,
      callStatus: 'calling',
      dialingStatus: 'dialing',
      currentCall: currentLead
    }));

      toast({
        title: 'Starting Call',
        description: `Connecting to ${currentLead.name}...`
      });

    } catch (error) {
      console.error('❌ Start call failed:', error);
      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };

  // END CALL - destroy call but KEEP POWER ON
  const handleEndCall = async () => {
    try {
      debugLog('💥 END CALL - ending lead\'s call but keeping WebRTC active...');
      
      const currentLead = getCurrentLead();
      
      // 🚨 CRITICAL: AOIntel leads MUST have a disposition before ending call
      if (currentLead) {
        const isAOIntel = currentLead.aointel === true || currentLead.aointel === 1 || 
                         String(currentLead.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
          debugLog('🚨 AOIntel lead requires disposition before ending call');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned before ending the call. Please select a disposition.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block - AOIntel leads require disposition
        }
      }
      
      // 🎯 SIMPLE COUNTER INCREMENT WITH THROTTLING DEBUG
      const lastCounterTime = localStorage.getItem('lastCounterTime');
      const now = Date.now();
      const timeSinceLastCounter = lastCounterTime ? now - parseInt(lastCounterTime) : Infinity;
      
      debugLog('🔍 THROTTLING DEBUG:', {
        lastCounterTime,
        now,
        timeSinceLastCounter,
        twentySeconds: 20000,
        canIncrement: timeSinceLastCounter >= 20000
      });
      
      if (timeSinceLastCounter >= 3000) { // 3 seconds delay between complete call actions
        debugLog('🔥 COMPLETE CALL BUTTON HIT - INCREMENTING COUNTER!');
        localStorage.setItem('lastCounterTime', now.toString());
        const plusLeadEvent = new CustomEvent('callCompleted', {
          detail: {
            agentEmail: authState.user?.email,
            leadType: 'plus'
          }
        });
        window.dispatchEvent(plusLeadEvent);
        debugLog('🎯 COUNTER INCREMENT EVENT FIRED!');
      } else {
        const remaining = Math.ceil((3000 - timeSinceLastCounter) / 1000);
        debugLog(`⏳ THROTTLED: Must wait ${remaining} more seconds before next counter increment`);
      }

      // 0. Stop all audio/music
      stopAllAudio();

      // Check VDP disposition requirements before changing leads
      const canProceed = await endVDPCallOnLeadChange();
      if (!canProceed) {
        return; // Block lead change if disposition required
      }

      // 0.5 Dispatch call completion event for hotlead counter
      if (dialerState.currentCall && authState?.user?.email) {
        const callCompletedEvent = new CustomEvent('callCompleted', {
          detail: {
            callStartTime: new Date().toISOString(),
            agentEmail: authState.user?.email,
            leadId: dialerState.currentCall.id // Use database primary key, not taalk_lead_id
          }
        });
        window.dispatchEvent(callCompletedEvent);
        debugLog('🔔 Call completion event dispatched for hotlead tracking');
      }

      // 1. CRITICAL: Mark current lead as contacted FIRST (use getCurrentLead() so inbound call lead is included)
      const leadToDisposition = getCurrentLead() || dialerState.currentCall;
      if (leadToDisposition && authState?.user?.email) {
        try {
          const actualDisposition = dialerState.selectedDisposition || 'no_answer_vm';
          debugLog(`📝 Saving disposition ${actualDisposition} for lead ${leadToDisposition.id} for ${authState.user.email}`);
          await masterleadUpdateResolution({
            leadId: leadToDisposition.id,
            cnresolution: actualDisposition,
            agentEmail: authState.user?.email
          });
          debugLog(`✅ Lead disposition saved to masterlead.cnresolution for lead ${leadToDisposition.id}`);
          
          // 🚀 CRITICAL: DON'T invalidate query here - causes race condition
          // Lead will be removed from local state, preventing re-fetch
          // queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/leads'] });

          // 🔥 CHECK FOR 5 CALLS WEBHOOK: Track ANY calls (plus leads + hotleads)
          try {
            // Get all calls counter (not just plus leads)
            const allCallsKey = `all_calls_${authState.user.email}_${new Date().toDateString()}`;
            const allCalls = parseInt(localStorage.getItem(allCallsKey) || '0') + 1;
            localStorage.setItem(allCallsKey, allCalls.toString());
              
            // REMOVED: 5-call milestone webhook (not needed)
          } catch (error) {
            console.error('❌ Error checking call stats:', error);
          }
        } catch (error: any) {
          console.error('❌ Error dispositioning lead:', error);
          // Check if this is a throttling error
          const isThrottled = error?.message?.includes('rate limit') || 
                             error?.message?.includes('throttled') || 
                             error?.message?.includes('Rate limit') ||
                             error?.message?.includes('Throttled');
          
          if (isThrottled) {
            toast({
              title: '⚠️ Rate Limit Exceeded',
              description: error.message || 'You are applying dispositions too quickly. Please wait before trying again.',
              variant: 'destructive',
              duration: 5000
            });
          }
        }
      }

      // 📊 USAGE TRACKING: Track Call Connector Pro call end
      try {
        const sessionId = authState?.session?.id || `session-${Date.now()}`;
        const callId = (window as any).currentCallSid || null;
        const duration = callDurationSeconds || finalCallDuration || 0;
        
        await fetch('/api/usage/ccpro-call-end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentEmail: authState?.user?.email,
            sessionId: sessionId,
            callId: callId,
            duration: duration // Duration in seconds
          }),
        }).catch(err => console.warn('⚠️ Failed to track CCPro call end (non-blocking):', err));
      } catch (usageError) {
        console.warn('⚠️ Failed to track CCPro call end (non-blocking):', usageError);
      }

      // 2. 3-LAYER TEARDOWN: Disconnect connection, device, and server conference
      debugLog('[END] Starting 3-layer teardown...');
      
      const device: any = (window as any).twilioDevice;
      const conn: any =
        device?.activeConnection?.() ??
        (window as any).twilioConnection ??
        device?.connections?.[0];

      // Layer A: Disconnect active connection (browser leg)
      try {
        if (conn && typeof conn.disconnect === 'function') {
          debugLog('[END] Layer A: Disconnecting active connection...');
          conn.disconnect();
          debugLog('[END] Layer A: Connection disconnected');
        } else {
          debugLog('[END] Layer A: No active connection (expected if call already ended)');
        }
      } catch (e) {
        debugLog('[END] Layer A: conn.disconnect failed', e);
      }

      // Layer B: Disconnect all connections (covers weird states)
      try {
        if (device && typeof device.disconnectAll === 'function') {
          debugLog('[END] Layer B: Disconnecting all connections...');
          device.disconnectAll();
          debugLog('[END] Layer B: All connections disconnected');
        } else {
          console.warn('[END] Layer B: device.disconnectAll not available');
        }
      } catch (e) {
        console.warn('[END] Layer B: device.disconnectAll failed', e);
      }

      // Clear connection reference
      (window as any).twilioConnection = null;

      // Layer C: End server-side conference (if using conferences)
      const conferenceName = dialerState.currentConferenceName;
      if (conferenceName) {
        try {
          debugLog(`[END] Layer C: Ending server-side conference: ${conferenceName}`);
          const response = await fetch('/api/end-conference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ conferenceName }),
          });
          if (response.ok) {
            debugLog('[END] Layer C: Conference ended successfully');
          } else {
            console.warn('[END] Layer C: Conference end request failed', response.status);
          }
        } catch (e) {
          console.warn('[END] Layer C: Conference end request failed', e);
        }
      } else {
        debugLog('[END] Layer C: No conference to end (direct call)');
      }

      debugLog('[END] 3-layer teardown complete');

      // 3. KEEP WebRTC device active (don't destroy it!)
      debugLog('🔌 Keeping WebRTC device active for next call');

      // 4. Reset call state and STOP all audio/music but KEEP SYSTEM ACTIVE
      // CRITICAL: Preserve viewedLead and currentLeadIndex - lead must stay on screen until "Complete Call & Dial Next"
      // CRITICAL: FREEZE the call duration - don't reset it, keep it visible for disposition validation
      
      // REMOVED: VDP should already be online - we don't disable it during outbound calls
      // VDP stays online throughout outbound calls so agent can receive inbound calls
      // Only backend checkAgentVDPStatus will take VDP offline if there's an actual inbound VDP call
      
      if (callDurationSeconds > 0) {
        setFinalCallDuration(callDurationSeconds);
        setDialerState(prev => ({
          ...prev,
          dialingStatus: 'ready',
          webRTCConferenceActive: false,
          campaignActive: false,
          powered: true,
          currentCall: null,
          callStatus: 'idle',
          callDuration: callDurationSeconds,
          inboundCallInfo: null,
          inboundCallLead: null,
        }));
      } else {
        setDialerState(prev => ({
          ...prev,
          dialingStatus: 'ready',
          webRTCConferenceActive: false,
          campaignActive: false,
          powered: true,
          currentCall: null,
          callStatus: 'idle',
          callDuration: 0,
          inboundCallInfo: null,
          inboundCallLead: null,
        }));
      }

      inboundDebugLog('end-call flow (hangup/end-conference) clearing inbound state');
      setInboundCallAccepted(false);
      inboundCallLeadRef.current = null;

      // 5. Reset PSTN answered state
      setPstnAnswered(false);

      // 6. CRITICAL: Reset callState to 'idle' to prevent call from staying red
      setCallState('idle');

      // 5. Audio already stopped by stopAllAudio() call above
      
      // Set flag to suppress expected offline toasts for a few seconds after call ends
      callJustEndedRef.current = true;
      setTimeout(() => {
        callJustEndedRef.current = false;
      }, 5000); // Suppress offline toasts for 5 seconds after call ends

      toast({
        title: 'Call Ended - Ready to Continue',
        description: 'System returned to ready state - click Start Dialing to continue'
      });
    } catch (error) {
      console.error('❌ End call failed:', error);
    }
  };

  // Helper function to check if VDP call needs disposition before lead change
  const checkVDPDispositionRequired = async (): Promise<boolean> => {
    if (!dialerState.vdpCallStatus?.hasVDPCall || !dialerState.vdpCallStatus?.vdpCall) {
      return false; // No VDP call active, no disposition needed
    }

    // If already dispositioned locally, no need to require it again
    if (vdpCallDispositioned) {
      debugLog('✅ VDP disposition not required - already dispositioned locally');
      return false;
    }

    // If a disposition was already selected in the current session, allow navigation
    if (dialerState.selectedDisposition) {
      debugLog('✅ VDP disposition not required - disposition already selected:', dialerState.selectedDisposition);
      return false;
    }

    const vdpCall = dialerState.vdpCallStatus.vdpCall;

    // Check if appointment was booked or video meeting was started
    try {
      const response = await fetch(`/api/appointments/check-vdp-disposition/${vdpCall.leadName}/${vdpCall.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        const hasAppointment = result?.hasAppointment || false;
        const hasVideoMeeting = result?.hasVideoMeeting || false;

        debugLog('🔍 VDP disposition check:', { hasAppointment: hasAppointment, hasVideoMeeting: hasVideoMeeting });

        // If appointment was booked or video meeting started, no disposition needed
        if (hasAppointment || hasVideoMeeting) {
          debugLog('✅ VDP disposition not required - appointment/video meeting found');
          return false;
        }

        // Otherwise, disposition is required
        debugLog('⚠️ VDP disposition required - no appointment/video meeting found');
        return true;
      }
    } catch (error) {
      console.error('❌ Error checking VDP disposition:', error);
    }

    // Default to requiring disposition if we can't verify
    return true;
  };

  // Track if VDP call has been dispositioned
  const [vdpCallDispositioned, setVdpCallDispositioned] = useState(false);

  // Reset VDP disposition state when a new VDP call starts
  useEffect(() => {
    if (dialerState.vdpCallStatus?.hasVDPCall && !vdpCallDispositioned) {
      // New VDP call detected, reset disposition state
      setVdpCallDispositioned(false);
    }
  }, [dialerState.vdpCallStatus?.hasVDPCall, dialerState.vdpCallStatus?.vdpCall?.id]);

  // Helper function to check if VDP call has been dispositioned using existing dropdown
  const checkVDPCallDispositioned = (): boolean => {
    if (!dialerState.vdpCallStatus?.hasVDPCall) {
      return true; // No VDP call, no disposition needed
    }

    return vdpCallDispositioned; // Check if disposition was completed
  };

  // Helper function to end VDP call when changing leads
  const endVDPCallOnLeadChange = async (): Promise<boolean> => {
    if (dialerState.vdpCallStatus?.hasVDPCall && authState?.user?.email) {
      try {
        debugLog('🔚 Checking VDP call disposition requirements...');

        // Check if disposition is required
        const needsDisposition = await checkVDPDispositionRequired();

        if (needsDisposition) {
          debugLog('⚠️ VDP call requires disposition before lead change');

          toast({
            title: 'VDP Call Disposition Required',
            description: 'Please use the "Select Disposition..." dropdown below before changing leads',
            variant: 'destructive'
          });

          return false; // Block lead change until disposition is selected
        }

        debugLog('🔚 Ending VDP call due to lead change...');

        // End the VDP call in the database
        const response = await fetch(resolveServiceUrl('/api/inbound-calls/end'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: authState.user.email,
            reason: 'producer changed leads'
          })
        });

        if (response.ok) {
          debugLog('✅ VDP call ended successfully');

          // Clear VDP call state and reset disposition tracking
          setDialerState(prev => ({
            ...prev,
            vdpCallStatus: {
              hasVDPCall: false,
              vdpCall: null,
              countdownValue: 0,
              countdownActive: false
            }
          }));

          // Reset VDP disposition state for new calls
          setVdpCallDispositioned(false);

          toast({
            title: 'VDP Call Ended',
            description: 'Disconnected from AO Intelligence call'
          });
          return true;
        } else {
          console.error('❌ Failed to end VDP call:', response.status);
          return false;
        }
      } catch (error) {
        console.error('❌ Error ending VDP call:', error);
        return false;
      }
    }
    return true; // No VDP call active, allow lead change
  };

  // Skip lead handler
  const handleSkipLead = async () => {
    const currentLead = getCurrentLead();
    
    // 🚨 CRITICAL: AOIntel leads CANNOT be skipped - they MUST be dispositioned
    if (currentLead) {
      const isAOIntel = currentLead.aointel === true || currentLead.aointel === 1 || 
                       String(currentLead.cnresolution || '').toLowerCase() === 'aointel';
      
      if (isAOIntel) {
        debugLog('🚨 Cannot skip AOIntel lead - disposition is required');
        toast({
          title: 'Cannot Skip AOIntel Lead',
          description: 'AOIntel leads must be dispositioned before moving on. Please select a disposition.',
          variant: 'destructive',
          duration: 5000
        });
        return; // Block skip - AOIntel leads require disposition
      }
    }
    
    // Check VDP disposition requirements before changing leads
    const canProceed = await endVDPCallOnLeadChange();
    if (!canProceed) {
      return; // Block lead change if disposition required
    }

    // Play "next lead" sound notification (higher pitch two-tone)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (frequency: number, duration: number, delay: number) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };

      // Play two higher-pitch tones: "beep boop" (next lead sound)
      playTone(660, 0.15, 0);    // Higher pitch first beep
      playTone(550, 0.15, 200);  // Lower pitch second boop
    } catch (error) {
      debugLog('Could not play next lead sound:', error);
    }

    // Use auto-switching logic to determine next index
    const nextIndex = handleQueueAutoSwitch(dialerState.currentLeadIndex);
    // Reset duration when skipping to a new lead
    setCallDurationSeconds(0);
    setFinalCallDuration(0);
    
    setDialerState((prev) => ({
      ...prev,
      currentLeadIndex: nextIndex,
      dialingStatus: 'idle',
      currentCall: null,
      callDuration: 0,
      // Keep viewedLead if it's a searched lead (searchQuery is not empty)
      viewedLead: searchQuery.trim().length >= 2 ? prev.viewedLead : null
    }));

    // Track the new position for resume functionality (only for regular leads)
    trackproducerPosition(nextIndex);

    toast({
      title: 'Lead Skipped',
      description: 'Moving to next lead'
    });
  };

  // Navigate to previous lead
  const handlePreviousLead = async () => {
    if (dialerState.availableLeads.length === 0) return;
    void clearPendingInboundIfRinging();

    // Check VDP disposition requirements before changing leads
    const canProceed = await endVDPCallOnLeadChange();
    if (!canProceed) {
      return; // Block lead change if disposition required
    }

    // Play navigation sound (lower pitch)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (error) {
      debugLog('Could not play previous lead sound:', error);
    }

    const visibleLeadCount = Math.min(localQueueWindowSize, dialerState.availableLeads.length);
    const prevIndex = dialerState.currentLeadIndex === 0 
      ? visibleLeadCount - 1 
      : dialerState.currentLeadIndex - 1;

    setDialerState(prev => ({
      ...prev,
      currentLeadIndex: prevIndex,
      // Keep viewedLead if it's a searched lead (searchQuery is not empty)
      viewedLead: searchQuery.trim().length >= 2 ? prev.viewedLead : null
    }));

    // Track the new position for resume functionality
    trackproducerPosition(prevIndex);

    toast({
      title: 'Previous Lead',
      description: `Moved to lead ${prevIndex + 1} of ${dialerState.availableLeads.length}`
    });
  };

  // Helper function to detect if a lead is a hotlead
  function isLeadHotlead(lead: any) {
    // Hot leads are determined by multiple fields - matches CallConnectorPro filtering logic
    return lead?.is_hot_lead === true || lead?.is_hot_lead === 'true' || lead?.is_hot_lead === 1 || // Primary check - snake_case from database
      lead?.isHotLead === true || lead?.isHotLead === 'true' || lead?.isHotLead === 1 || // Fallback camelCase
      lead?.source_table === 'hotleads' || // Direct indicator from hotleads table
      lead?.taalk_market === 'Hot Lead' || // Market-based identification
      lead?.market === 'Hot Lead'; // Alternative market field
  }

  // Helper function to find next lead of specific type
  const findNextLeadOfType = (currentIndex: number, isHotlead: boolean) => {
    const totalLeads = dialerState.availableLeads.length;
    for (let i = 1; i < totalLeads; i++) {
      const checkIndex = (currentIndex + i) % totalLeads;
      const lead = dialerState.availableLeads[checkIndex];
      if (isLeadHotlead(lead) === isHotlead) {
        return checkIndex;
      }
    }
    return null; // No more leads of this type
  };

  // Auto-switching logic when queue runs out
  const handleQueueAutoSwitch = (currentIndex: number) => {
    const currentLead = dialerState.availableLeads[currentIndex];
    const isCurrentHotlead = isLeadHotlead(currentLead);
    
    // Try to find next lead of same type first
    const nextSameType = findNextLeadOfType(currentIndex, isCurrentHotlead);
    
    if (nextSameType !== null) {
      return nextSameType; // Stay in same queue type
    }
    
    // Current queue type exhausted, try to switch to other type
    const nextDifferentType = findNextLeadOfType(currentIndex, !isCurrentHotlead);
    
    if (nextDifferentType !== null) {
      const switchingTo = isCurrentHotlead ? 'regular leads' : 'hotleads';
      debugLog(`🔄 AUTO-SWITCH: ${isCurrentHotlead ? 'Hotlead' : 'Regular lead'} queue exhausted, switching to ${switchingTo}`);
      
      toast({
        title: 'Queue Auto-Switch',
        description: `Switched to ${switchingTo} - ${isCurrentHotlead ? 'hotlead' : 'regular'} queue exhausted`,
        className: 'bg-blue-50 border-blue-200'
      });
      
      return nextDifferentType;
    }
    
    // Both queue types exhausted, go to next available lead
    return (currentIndex + 1) % dialerState.availableLeads.length;
  };

  // Navigate to next lead with auto-switching
  const handleNextLead = async () => {
    if (dialerState.availableLeads.length === 0) {
      debugLog('🚫 Next Lead: No available leads');
      return;
    }
    void clearPendingInboundIfRinging();

    debugLog('🔄 Next Lead: Current state:', {
      currentIndex: dialerState.currentLeadIndex,
      totalLeads: dialerState.availableLeads.length,
      currentLead: dialerState.availableLeads[dialerState.currentLeadIndex]?.name
    });

    // If there's only one lead, try to load more leads first
    if (dialerState.availableLeads.length === 1) {
      debugLog('⚠️ Only 1 lead available! Attempting to load more leads...');
      toast({
        title: 'Loading More Leads',
        description: 'Only one lead available - loading more leads for rotation',
      });
    }

    // Check VDP disposition requirements before changing leads
    const canProceed = await endVDPCallOnLeadChange();
    if (!canProceed) {
      debugLog('🚫 Next Lead: Blocked by VDP disposition requirement');
      return; // Block lead change if disposition required
    }

    // Play navigation sound (higher pitch)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (error) {
      debugLog('Could not play next lead sound:', error);
    }

    const visibleLeadCount = Math.min(localQueueWindowSize, dialerState.availableLeads.length);
    const nextIndex = (dialerState.currentLeadIndex + 1) % visibleLeadCount;

    debugLog('🎯 Next Lead: Moving from index', dialerState.currentLeadIndex, 'to index', nextIndex);
    debugLog('🎯 Next Lead: New lead will be:', dialerState.availableLeads[nextIndex]?.name);

    setDialerState(prev => ({
      ...prev,
      currentLeadIndex: nextIndex,
      // Keep viewedLead if it's a searched lead (searchQuery is not empty)
      viewedLead: searchQuery.trim().length >= 2 ? prev.viewedLead : null
    }));

    // Track the new position for resume functionality (only for regular leads)  
    trackproducerPosition(nextIndex);

    // Check if we need to auto-load more regular leads
    setTimeout(() => {
      checkAndLoadRegularLeads();
    }, 500);

    toast({
      title: 'Next Lead',
      description: `Moved to lead ${nextIndex + 1} of ${dialerState.availableLeads.length}`
    });
  };

  const handleQueueTabChange = (value: string) => {
    void clearPendingInboundIfRinging();
    const nextTab: 'hotlead' | 'plus' | 'my-leads' = 
      value === 'hotlead' ? 'hotlead' :
      value === 'plus' ? 'plus' : 
      value === 'my-leads' ? 'my-leads' : 
      'my-leads';
    
    // Defer queue switch if on call
    if (callState === 'on-call') {
      toast({
        title: "Cannot Switch Queue",
        description: "Please end your current call before switching queues",
        variant: "destructive"
      });
      return;
    }
    
    setActiveQueueTab(nextTab);
    
    // Reset lead pool to 'all' when switching away from 'my-leads' queue
    if (nextTab !== 'my-leads') {
      setSelectedLeadPool('all');
    }

    const targetQueue = nextTab === 'hotlead' ? hotleadQueue : nextTab === 'my-leads' ? myLeadsQueue : plusLeadsQueue;
    
    // 🔍 DEBUG: Log queue switch
    debugLog(`🔄 Queue Tab Changed to: ${nextTab}`, {
      targetQueueLength: targetQueue.length,
      plusLeadsQueueLength: plusLeadsQueue.length,
      myLeadsQueueLength: myLeadsQueue.length,
      targetQueueSample: targetQueue.slice(0, 3).map((l: any) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`, market: l.taalk_market }))
    });
    
    const savedIndex = queuePositions[nextTab] ?? 0;
    const safeIndex = targetQueue.length === 0 ? 0 : Math.min(savedIndex, targetQueue.length - 1);

    setQueuePositions(prev => ({
      ...prev,
      [nextTab]: safeIndex,
    }));

    setDialerState(prev => ({
      ...prev,
      leads: targetQueue,
      availableLeads: targetQueue,
      availableLeadsCount: targetQueue.length,
      currentLeadIndex: safeIndex,
      // Keep viewedLead if it's a searched lead (searchQuery is not empty)
      viewedLead: searchQuery.trim().length >= 2 ? prev.viewedLead : null,
    }));

    if (targetQueue.length === 0) {
      debugLog(`⚠️ ${nextTab === 'hotlead' ? 'AO Queue (Hot Leads)' : nextTab === 'my-leads' ? 'My Leads' : 'Plus'} queue is empty`);
    } else {
      debugLog(`🔁 Switched to ${nextTab} queue (lead ${safeIndex + 1} of ${targetQueue.length})`);
    }
  };
  
  // Update call state based on dialerState. Hot Lead no longer requires AOI online.
  useEffect(() => {
    if (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive) {
      setCallState('on-call');
    } else if (dialerState.availableLeads.length > 0) {
      setCallState('idle');
    } else {
      setCallState('idle');
    }
  }, [dialerState.dialingStatus, dialerState.callStatus, dialerState.webRTCConferenceActive, dialerState.availableLeads.length]);

  // Auto-bind lead index whenever queue is non-empty and index is stale.
  useEffect(() => {
    const indexOutOfRange =
      !Number.isFinite(dialerState.currentLeadIndex) ||
      dialerState.currentLeadIndex < 0 ||
      dialerState.currentLeadIndex >= dialerState.availableLeads.length;
    if (dialerState.availableLeads.length > 0 && indexOutOfRange) {
      // Auto-bind first FTC-compliant lead
      const firstCompliantIndex = dialerState.availableLeads.findIndex((lead: Lead) => 
        isCallPermissibleFrontend(getLeadStateForFtc(lead), lead.ftcrestricted)
      );
      if (firstCompliantIndex >= 0) {
        setDialerState(prev => ({
          ...prev,
          currentLeadIndex: firstCompliantIndex
        }));
      } else if (dialerState.availableLeads.length > 0) {
        // If no compliant leads, still bind first one
        setDialerState(prev => ({
          ...prev,
          currentLeadIndex: 0
        }));
      }
    }
  }, [dialerState.availableLeads, dialerState.currentLeadIndex]);

  const handleSelectLeadFromList = async (
    lead: any,
    index: number,
    options?: { queueType?: 'hotlead' | 'my-leads' | 'plus' }
  ) => {
    const queueType = options?.queueType;
    const targetQueue =
      queueType === 'hotlead'
        ? hotleadQueue
        : queueType === 'my-leads'
          ? myLeadsQueue
          : queueType === 'plus'
            ? plusLeadsQueue
            : dialerState.availableLeads;
    const queueLength = targetQueue.length;
    const normalizedIndex = typeof index === 'number' ? index : -1;
    const previousQueueIndex =
      queueType === 'my-leads'
        ? queuePositions['my-leads'] ?? -1
        : queueType === 'plus'
          ? queuePositions.plus ?? -1
          : dialerState.currentLeadIndex;
    const leadCandidate =
      lead ||
      (normalizedIndex >= 0 && normalizedIndex < queueLength
        ? targetQueue[normalizedIndex]
        : null);

    if (!leadCandidate) {
      toast({
        title: 'Lead unavailable',
        description: 'Unable to load lead details.',
        variant: 'destructive'
      });
      return;
    }

    // Clear search results and query to return to Call Connector Pro view
    setSearchResults([]);
    setSearchQuery('');

    if (queueType && activeQueueTab !== queueType) {
      void clearPendingInboundIfRinging();
      setActiveQueueTab(queueType);
    }

    const inQueue = normalizedIndex >= 0 && normalizedIndex < queueLength;

    if (dialerState.vdpCallStatus.hasVDPCall) {
      const canProceed = await endVDPCallOnLeadChange();
      if (!canProceed) {
        toast({
          title: 'Complete current call',
          description: 'Please wrap up the active call before switching leads.',
          variant: 'destructive'
        });
        return;
      }
    }

    if (!inQueue) {
      setDialerState(prev => ({
        ...prev,
        leads: queueType ? targetQueue : prev.leads,
        availableLeads: queueType ? targetQueue : prev.availableLeads,
        availableLeadsCount: queueType ? queueLength : prev.availableLeadsCount,
        currentLeadIndex: queueType
          ? queueLength > 0
            ? Math.min(previousQueueIndex >= 0 ? previousQueueIndex : 0, queueLength - 1)
            : 0
          : prev.currentLeadIndex,
        viewedLead: leadCandidate || null // Keep viewedLead loaded - don't clear it
      }));
      toast({
        title: leadCandidate?.name || 'Lead loaded',
        description: 'Lead loaded from search.'
      });
      return;
    }

    if (queueType) {
      const clampedIndex = normalizedIndex < 0 ? 0 : normalizedIndex;
      setQueuePositions(prev => ({
        ...prev,
        [queueType]: clampedIndex
      }));
    }

    if (normalizedIndex === previousQueueIndex && (queueType ? queueType === activeQueueTab : true)) {
      setDialerState(prev => ({
        ...prev,
        leads: queueType ? targetQueue : prev.leads,
        availableLeads: queueType ? targetQueue : prev.availableLeads,
        availableLeadsCount: queueType ? queueLength : prev.availableLeadsCount,
        currentLeadIndex: normalizedIndex,
        viewedLead:
          leadCandidate ||
          (queueType ? targetQueue[normalizedIndex] : prev.availableLeads[normalizedIndex]) ||
          prev.viewedLead // Keep existing viewedLead if no new lead candidate
      }));
      return;
    }

    const canProceed = await endVDPCallOnLeadChange();
    if (!canProceed) {
      return;
    }

    setDialerState(prev => ({
      ...prev,
      leads: queueType ? targetQueue : prev.leads,
      availableLeads: queueType ? targetQueue : prev.availableLeads,
      availableLeadsCount: queueType ? queueLength : prev.availableLeadsCount,
      currentLeadIndex: normalizedIndex,
      viewedLead:
        leadCandidate ||
        (queueType ? targetQueue[normalizedIndex] : prev.availableLeads[normalizedIndex]) ||
        prev.viewedLead // Keep existing viewedLead if no new lead candidate
    }));

    trackproducerPosition(normalizedIndex);

    toast({
      title: 'Lead selected',
      description: `Now viewing lead ${normalizedIndex + 1} of ${queueLength || dialerState.availableLeads.length}`
    });
  };

  const handleViewLeadInPlanet = (leadId?: string | number | null) => {
    if (!leadId) {
      toast({
        title: 'Lead ID missing',
        description: 'Unable to open this lead in Planet.',
        variant: 'destructive'
      });
      return;
    }

    const normalizedLeadId = String(leadId).trim();
    if (!normalizedLeadId) {
      toast({
        title: 'Lead ID missing',
        description: 'Unable to open this lead in Planet.',
        variant: 'destructive'
      });
      return;
    }

    window.open(`https://m.planetaltig.com/Lead/InboxDetail?LeadId=${normalizedLeadId}`, '_blank', 'noopener,noreferrer');
  };

  // Handle call disposition selection
  const handleDispositionSelect = async (disposition: CallDisposition) => {
    const hadCallAttempt = dialerState.currentCall !== null ||
      dialerState.dialingStatus === 'dialing' || dialerState.dialingStatus === 'ringing' ||
      dialerState.callStatus === 'connected' || dialerState.callStatus === 'in_call' ||
      dialerState.webRTCConferenceActive;
    const currentCallDuration = callDurationSeconds || finalCallDuration || dialerState.callDuration || 0;

    if (!hadCallAttempt && currentCallDuration <= 0) {
      toast({
        title: 'Call Required',
        description: 'You must make a call before selecting a disposition.',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    const dispositionLower = (disposition || '').toLowerCase();
    const exempt = ['no_answer', 'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number', 'bad_number'];

    if (!exempt.includes(dispositionLower) && currentCallDuration <= 0) {
      toast({
        title: 'Call Required',
        description: `"${disposition}" requires a connected call. Use no answer or wrong number if you didn't reach them.`,
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    // Allow disposition selection - use current lead (including VDP calls)
    const currentLead = getCurrentLead();
    const targetCall = dialerState.currentCall || currentLead;

    if (!targetCall) {
      toast({
        title: 'No Lead Available',
        description: 'No lead selected for disposition',
        variant: 'destructive'
      });
      return;
    }

    // Throttling removed - agents must start a call first, so no throttling needed

    // CRITICAL: Block sale disposition without ALP amount
    if (disposition === 'sale') {
      toast({
        title: 'ALP Required for Sales',
        description: 'Please use the Call Disposition panel on the right to enter the ALP amount for this sale',
        variant: 'destructive'
      });
      return;
    }

    debugLog('📋 Setting call disposition:', disposition);

    // If there's an active VDP call, mark it as dispositioned and end it
    if (dialerState.vdpCallStatus?.hasVDPCall) {
      debugLog('🔔 VDP call dispositioned:', disposition);
      setVdpCallDispositioned(true);

      // Save VDP disposition to database
      try {
        await fetch('/api/vdp-calls/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: dialerState.vdpCallStatus.vdpCall?.id,
            leadName: dialerState.vdpCallStatus.vdpCall?.leadName,
            disposition: disposition,
            userEmail: authState?.user?.email,
            timestamp: new Date().toISOString()
          })
        });

        // Automatically end the VDP call after disposition
        const endResponse = await fetch(resolveServiceUrl('/api/inbound-calls/end'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: authState?.user?.email,
            reason: `Call dispositioned as: ${disposition}`
          })
        });

        if (endResponse.ok) {
          // Clear VDP call state immediately after disposition
          setDialerState(prev => ({
            ...prev,
            vdpCallStatus: {
              hasVDPCall: false,
              vdpCall: null,
              countdownValue: 0,
              countdownActive: false
            }
          }));

          toast({
            title: 'VDP Call Completed',
            description: `Call dispositioned as: ${disposition} and ended`,
          });
        } else {
          toast({
            title: 'VDP Call Dispositioned',
            description: `AO Intelligence call marked as: ${disposition}`,
          });
        }
      } catch (error) {
        console.error('❌ Error saving VDP disposition:', error);
      }
    }

    setDialerState((prev) => ({
      ...prev,
      selectedDisposition: disposition
    }));

    // Save disposition to call history ONLY (don't update masterlead yet)
    // Masterlead will be updated when "APPLY" button is clicked
    try {
      // 1. Save to call history
      const callHistoryResponse = await fetch('/api/outbound-call-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: authState?.user?.email,
          agentName: authState?.user?.email?.split('@')[0] || 'Unknown producer',
          leadPhone: targetCall.phone,
          leadName: targetCall.name,
          callDisposition: disposition,
          callStatus: 'completed',
          leadState: targetCall.state || 'Unknown',
          leadId:
            targetCall?.taalk_lead_id ??
            targetCall?.taalkLeadId ??
            targetCall?.lead_id ??
            targetCall?.id ??
            null,
          associateId:
            targetCall?.associate_id ??
            targetCall?.agent_associate_id ??
            targetCall?.agentAssociateId ??
            null
        })
      });

      if (callHistoryResponse.ok) {
        debugLog('✅ Call disposition saved to history - Click "APPLY" to save to masterlead');

        // Disposition selected - lead stays visible until agent clicks "APPLY" then "Complete Call & Dial Next"
        toast({
          title: 'Disposition Selected ✅',
          description: `Lead marked as "${String(disposition).replace('_', ' ').toUpperCase()}" - Click "APPLY" to save, then "Complete Call & Dial Next"`,
        });
      } else {
        console.warn('⚠️ Disposition selection history write failed; continuing without toast.');
      }
    } catch (error) {
      console.error('❌ Failed to save call disposition:', error);
      console.warn('⚠️ Disposition selection history write failed; continuing without toast.');
    }
  };

  // Handle applying disposition (saves to masterlead.cnresolution but keeps lead visible)
  // Undo Handler - Revert last disposition and go back to previous lead
  const handleUndo = async () => {
    if (!undoState) {
      toast({
        title: 'Nothing to Undo',
        description: 'No previous action to undo',
        variant: 'default'
      });
      return;
    }

    try {
      debugLog('↩️ UNDO: Reverting to previous state...', undoState);

      // Restore previous lead index and disposition
      setDialerState((prev) => ({
        ...prev,
        currentLeadIndex: undoState.previousLeadIndex,
        selectedDisposition: undoState.previousDisposition || '',
        dispositionApplied: undoState.previousDispositionApplied,
        availableLeads: undoState.previousLeads
      }));

      // Clear undo state after using it
      setUndoState(null);

      toast({
        title: 'Undone ✅',
        description: 'Reverted to previous lead and disposition state',
      });
    } catch (error) {
      console.error('❌ Error undoing:', error);
      toast({
        title: 'Undo Failed',
        description: 'Failed to undo last action',
        variant: 'destructive'
      });
    }
  };

  const handleApplyDisposition = async (saleData?: { alp?: string; saleAmount?: string }) => {
    const currentLead = getCurrentLead();
    const leadToDisposition = dialerState.currentCall || currentLead;
    
    if (!leadToDisposition || !authState?.user?.email) {
      toast({
        title: 'Error',
        description: 'No lead to apply disposition to',
        variant: 'destructive'
      });
      return;
    }

    // Check timeout status before applying disposition
    if (isTimedOut) {
      const remainingMinutes = Math.ceil(timeoutRemaining / 60);
      const timeoutUntil = timeoutStatus?.timeoutUntil 
        ? new Date(timeoutStatus.timeoutUntil).toLocaleString() 
        : 'unknown time';
      
      toast({
        title: '⏸️ Action Blocked',
        description: `You've been temporarily paused for ${remainingMinutes} minute(s) due to unusual activity patterns. Timeout expires at ${timeoutUntil}.`,
        variant: 'destructive',
        duration: 10000
      });
      return;
    }

    // Throttling removed - agents must start a call first, so no throttling needed

    const selectedDispositionRaw = String(dialerState.selectedDisposition || '');
    const normalizedDisposition = selectedDispositionRaw === 'callback'
      ? 'call_back'
      : dialerState.selectedDisposition;
    const actualDisposition = normalizedDisposition || 'no_answer_vm';

    if (actualDisposition === 'booked') {
      const hasRequiredEntry = await hasBookedAppointmentEntry(leadToDisposition);
      if (!hasRequiredEntry) {
        maybeOpenCalendarForDisposition(leadToDisposition, 'booked');
        toast({
          title: 'Log Appointment',
          description: 'Please add the appointment in My Calendar. You can keep working if you need to skip for now.',
        });
      }
    }

    // Optimistic update — dial increment happens at call-init success.
    // If we somehow missed that event, backfill dial here once.
    markDialCounted((window as any).currentCallSid || null, leadToDisposition.id || leadToDisposition.taalk_lead_id || null);
    if (['spoke', 'callback', 'not_interested', 'booked', 'sale', 'appointment_set'].includes(actualDisposition)) {
      setLocalReachDelta(d => d + 1);
    }
    if (['booked', 'sale', 'appointment_set'].includes(actualDisposition)) {
      setLocalBookedDelta(d => d + 1);
    }
    
    // Validate lead ID before proceeding
    if (!leadToDisposition.id && !leadToDisposition.taalk_lead_id) {
      toast({
        title: 'Invalid Lead',
        description: 'Lead ID is missing. Cannot apply disposition.',
        variant: 'destructive'
      });
      console.error('❌ Cannot apply disposition: Lead ID is missing', leadToDisposition);
      return;
    }
    
    // VDP/AOIntel: id is callSid, use taalk_lead_id for masterlead. Regular leads: use numeric id
    const leadIdForUpdate = leadToDisposition.isVDPCall
      ? (leadToDisposition.taalk_lead_id || leadToDisposition.leadId || leadToDisposition.id)
      : (leadToDisposition.id || leadToDisposition.taalk_lead_id);
    debugLog(`📝 APPLY Disposition: Saving ${actualDisposition} for lead ${leadIdForUpdate} to masterlead.cnresolution`);

    try {
      // Update masterlead.cnresolution NOW (when applying disposition) — data service when segmented
      await masterleadUpdateResolution({
        leadId: leadIdForUpdate,
        leadPhone: leadToDisposition.phone,
        cnresolution: actualDisposition,
        agentEmail: authState.user?.email
      });

      // Save undo state BEFORE applying disposition
      setUndoState({
        previousLeadIndex: dialerState.currentLeadIndex,
        previousDisposition: dialerState.selectedDisposition,
        previousDispositionApplied: dialerState.dispositionApplied,
        previousLeads: [...dialerState.availableLeads]
      });

      // If we just dispositioned the inbound lead, clear it so UI doesn't keep showing that card
      const wasInboundLead = dialerState.inboundCallLead && (
        dialerState.inboundCallLead.id === leadToDisposition.id ||
        dialerState.inboundCallLead.phone === leadToDisposition.phone ||
        String(dialerState.inboundCallLead.id) === String(leadIdForUpdate)
      );
      // Strict queue policy: AO Queue/My Leads/Plus only show cnresolution='pending'.
      // As soon as disposition changes away from pending, remove that lead from local queue state.
      const isStillPending = String(actualDisposition || '').toLowerCase().trim() === 'pending';
      const isSameLead = (l: any) =>
        l.id === leadIdForUpdate ||
        l.taalk_lead_id === leadIdForUpdate ||
        String(l.id) === String(leadIdForUpdate) ||
        String(l.taalk_lead_id) === String(leadIdForUpdate);

      setDialerState((prev) => {
        const nextAvailableLeads = isStillPending
          ? prev.availableLeads.map((l: any) => (isSameLead(l) ? { ...l, cnresolution: actualDisposition } : l))
          : prev.availableLeads.filter((l: any) => !isSameLead(l));
        const nextLeads = Array.isArray(prev.leads)
          ? (isStillPending
              ? prev.leads.map((l: any) => (isSameLead(l) ? { ...l, cnresolution: actualDisposition } : l))
              : prev.leads.filter((l: any) => !isSameLead(l)))
          : prev.leads;

        return {
          ...prev,
          dispositionApplied: true,
          ...(wasInboundLead ? { inboundCallLead: null, viewedLead: null, currentCall: null } : {}),
          availableLeads: nextAvailableLeads,
          leads: nextLeads,
          availableLeadsCount: nextAvailableLeads.length,
          currentLeadIndex: Math.min(prev.currentLeadIndex, Math.max(0, nextAvailableLeads.length - 1)),
        };
      });
      setAllMyLeadsEligible((prev) =>
        isStillPending
          ? prev.map((l: any) => (isSameLead(l) ? { ...l, cnresolution: actualDisposition } : l))
          : prev.filter((l: any) => !isSameLead(l))
      );
      setHotleadQueue((prev) => (isStillPending ? prev.map((l: any) => (isSameLead(l) ? { ...l, cnresolution: actualDisposition } : l)) : prev.filter((l: any) => !isSameLead(l))));
      setMyLeadsQueue((prev) => (isStillPending ? prev.map((l: any) => (isSameLead(l) ? { ...l, cnresolution: actualDisposition } : l)) : prev.filter((l: any) => !isSameLead(l))));
      setPlusLeadsQueue((prev) => (isStillPending ? prev.map((l: any) => (isSameLead(l) ? { ...l, cnresolution: actualDisposition } : l)) : prev.filter((l: any) => !isSameLead(l))));

      // Keep server refresh behavior unchanged; queue is now locally strict pending-only.
      debugLog('✅ Disposition applied - non-pending lead removed from queue immediately');

      debugLog('✅ Disposition applied to masterlead.cnresolution - strict pending-only queue enforced');
      toast({
        title: 'Disposition Applied',
        description: 'Disposition applied.',
      });
      // Keep scheduling auto-open on apply as a safety-net, but dedupe if already opened on select.
      maybeOpenCalendarForDisposition(leadToDisposition, actualDisposition);
    } catch (error: any) {
      console.error('❌ Error applying disposition:', error);
      console.error('   Lead ID:', leadToDisposition?.id || leadToDisposition?.taalk_lead_id);
      console.error('   Disposition:', actualDisposition);
      console.error('   Agent:', authState.user?.email);
      toast({
        title: 'Disposition Failed',
        description: error?.message || 'Could not save disposition. Lead was not advanced.',
        variant: 'destructive',
      });
      return;
    }
  };

  // Handle call notes change
  const handleNotesChange = (notes: string) => {
    setDialerState((prev) => ({
      ...prev,
      callNotes: notes
    }));
  };

  // Handle pause dialing
  const handlePauseDialing = () => {
    setDialerState((prev) => ({
      ...prev,
      campaignActive: false,
      dialingStatus: 'ready'
    }));

    toast({
      title: 'Dialing Paused',
      description: 'Campaign paused - click Start Dialing to resume'
    });
  };

  // Handle start dialing - automatically calls first lead
  // CRITICAL: Start Dialing must NEVER answer an incoming call. Only Accept does that.
  const handleStartDialing = async () => {
    if (startDialingInFlightRef.current) {
      console.warn('⚠️ Start Dialing ignored: previous start flow still in progress');
      pushWebRtcDebug('startDialing:deduped', {
        dialingStatus: dialerState.dialingStatus,
        callStatus: dialerState.callStatus,
      });
      return;
    }
    // Block Start Dialing while an incoming call is ringing — user must Accept or End first
    if (incomingConn || dialerState.dialingStatus === 'ringing') {
      toast({
        title: 'Incoming call active',
        description: 'Accept or end the incoming call first, then Start Dialing.',
        variant: 'destructive',
      });
      return;
    }
    startDialingInFlightRef.current = true;
    const startDialingTraceId = `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pushWebRtcDebug('startDialing:begin', {
      startDialingTraceId,
      leadCount: dialerState.availableLeads?.length || 0,
      dialingStatus: dialerState.dialingStatus,
      callStatus: dialerState.callStatus,
    });
    
    try {
      if (powerTogglePromiseRef.current) {
        await powerTogglePromiseRef.current;
      }

      // Strict gate: Start Dialing is allowed only after confirmed WebRTC registration.
      const activeDevice = (window as any).twilioDevice || device;
      const readyForDial = isPoweredOnRef.current && isDeviceConnectReady(activeDevice);

      if (!readyForDial) {
        toast({
          title: 'WebRTC Not Ready',
          description: 'Please wait for confirmed WebRTC connection, then start dialing.',
          variant: 'destructive',
        });
        return;
      }

      const { availableLeads } = dialerState;
      const callableAvailableLeads = availableLeads.filter((lead: any) => isLeadFtcCallable(lead));

      if (callableAvailableLeads.length === 0) {
        const agentEmail = String(authState?.user?.email || '').toLowerCase().trim();
        if (agentEmail) {
          void triggerAutoIgniteForEmptyQueue(agentEmail);
        }
        toast({
          title: 'No Leads Available',
          description: 'No callable leads right now. We started an automatic refill request now.',
          variant: 'destructive'
        });
        return;
      }

    // REMOVED: VDP status check - outbound calls work independently of VDP status
    // VDP can be online or offline, outbound dialing should always work when powered on
    // NO VDP CHECK - Outbound dialing works regardless of VDP status

      const firstLead = callableAvailableLeads[0];

      if (!firstLead) {
        toast({
          title: 'No Lead Available',
          description: 'No lead available to dial',
          variant: 'destructive'
        });
        return;
      }

      setDialerState((prev) => ({
        ...prev,
        campaignActive: true, // Set to true when starting campaign
        dialingStatus: 'dialing',
        currentLeadIndex: 0,
        callStatus: 'initiating'
      }));

      toast({
        title: 'Campaign Started',
        description: `Auto-dialing first lead: ${firstLead.name}`
      });

      // Start immediately and keep this action bound to one click.
      await new Promise((resolve) => setTimeout(resolve, 100));
      debugLog('🚀 AUTO-DIALING FIRST LEAD:', firstLead.name);
      await dialLead(firstLead);
    } finally {
      // Keep lock briefly to absorb double-click / hotkey bursts.
      setTimeout(() => {
        startDialingInFlightRef.current = false;
        pushWebRtcDebug('startDialing:released', { startDialingTraceId });
      }, 3000);
    }
  };

  // Call a specific lead - DIRECT WebRTC call (no conferences)
  const handleCallLead = async (lead: Lead) => {
    // 🎭 DEMO MODE: Make REAL call to agent's phone number (from demo lead)
    if (isCCPDemo) {
      debugLog('🎭 DEMO MODE: Making real call to agent phone number:', lead.phone);
    }
    
    // CRITICAL: Request microphone permission FIRST (inside user gesture)
    // Chrome requires microphone to be requested directly by user code, not by Twilio internally
    try {
      debugLog('🎤 [WEBRTC DEBUG] Requesting microphone permission (user gesture available)...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      debugLog('✅ [WEBRTC DEBUG] Microphone permission granted, stream active');
      // Keep stream active - Twilio will use it when device becomes ready
      (window as any).__webrtcMicStream = stream;
    } catch (micError: any) {
      console.error('❌ [WEBRTC DEBUG] Microphone permission denied:', micError);
      toast({
        title: 'Microphone Permission Required',
        description: 'Please allow microphone access to make calls',
        variant: 'destructive'
      });
      return;
    }
    
    // CRITICAL: Resume AudioContext immediately after user gesture (button click)
    try {
      debugLog('🔊 [WEBRTC DEBUG] Resuming AudioContext after user gesture (handleCallLead)...');
      let audioContext = (window as any).__webrtcAudioContext;
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContext = new AudioContextClass();
          (window as any).__webrtcAudioContext = audioContext;
          debugLog('✅ [WEBRTC DEBUG] Created new AudioContext');
        }
      }
      if (audioContext && audioContext.state !== 'running') {
        debugLog(`📋 [WEBRTC DEBUG] AudioContext state: ${audioContext.state}, resuming...`);
        await audioContext.resume();
        debugLog(`✅ [WEBRTC DEBUG] AudioContext resumed, new state: ${audioContext.state}`);
      } else if (audioContext) {
        debugLog(`✅ [WEBRTC DEBUG] AudioContext already running (state: ${audioContext.state})`);
      }
    } catch (audioError: any) {
      console.error('❌ [WEBRTC DEBUG] Failed to resume AudioContext:', audioError);
      // Don't block - continue anyway
    }
    
    let callInitiated = false;
    try {
      debugLog('📞 DIRECT CALL: producer WebRTC calling lead directly');
      debugLog('📞 Calling lead:', lead.name, lead.phone);

      setDialerState((prev) => ({
        ...prev,
        dialingStatus: 'dialing',
        currentCall: lead,
        viewedLead: lead,
      callStatus: 'connecting_direct'
      }));

      const device = (window as any).twilioDevice;
      if (!device) {
        throw new Error('WebRTC device not initialized. Power On first.');
      }

      // Do NOT reject incoming when starting dialing — TaskRouter owns the inbound offer.
      // Answering the incoming call will end dialing (outbound is disconnected in Accept handler).

      // Check for existing connections
      const existingConnection = (window as any).twilioConnection;
      if (existingConnection) {
        const connectionStatus = existingConnection.status();
        if (connectionStatus === 'open' || connectionStatus === 'connecting') {
          throw new Error('Call already in progress. End current call first.');
        } else {
          existingConnection.disconnect();
          (window as any).twilioConnection = null;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 🍎 MAC-SPECIFIC: Ensure microphone permission before connecting
      if (isMac()) {
        debugLog('🍎 Mac detected - verifying microphone permission before connect...');
        const micResult = await requestMicrophonePermission();
        if (!micResult.success) {
          toast({
            title: 'Microphone Permission Required',
            description: micResult.error || 'Please allow microphone access to make calls. Check System Preferences > Security & Privacy > Microphone.',
            variant: 'destructive',
            duration: 5000
          });
          throw new Error(micResult.error || 'Microphone permission denied');
        }
      }

      // DIRECT CALL: producer WebRTC device calls lead's phone number directly
      const directUserEmail = authState?.user?.email;
      if (!directUserEmail || !directUserEmail.includes('@')) {
        toast({ title: 'Sign-in required', description: 'You must be signed in to make calls.', variant: 'destructive' });
        throw new Error('Sign-in required');
      }
      debugLog('📞 Making DIRECT WebRTC call to lead phone number...');
      
      // CRITICAL: Wait for device to be ready BEFORE calling connect (like working test HTML)
      if (!isDeviceConnectReady(device)) {
        debugLog(`⏳ Device not connect-ready (state: ${device.state}), waiting for registered/ready event...`);
        await waitForDeviceReadyOrTimeout(device, 'handleCallLead', 4000);
        debugLog('✅ Device is now connect-ready');
      }

      logWebRtcTrace('handleCallLead:before-connect', device);
      pushWebRtcDebug('handleCallLead:before-connect', {
        deviceState: device?.state,
        leadPhone: lead.phone,
        leadName: lead.name,
        directUserEmail,
      });
      const debugTraceId = `ccpro-handleCallLead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      debugLog('📞 Device is ready - connecting call (SIMPLE - like test HTML)...');
      // device.connect() returns Promise<Call> in Twilio Voice SDK v2 — must await to get the Call object
      // Validate and format phone number to E.164 before dialing
      const rawPhone = (lead.phone || '').replace(/\D/g, '');
      let dialPhone = rawPhone;
      if (rawPhone.length === 10) {
        dialPhone = '1' + rawPhone; // add US country code
      } else if (rawPhone.length === 11 && rawPhone.startsWith('1')) {
        dialPhone = rawPhone;
      } else if (rawPhone.length < 10) {
        debugLog(`⚠️ Invalid phone number (${rawPhone.length} digits): ${lead.phone} — skipping call`);
        toast({ title: 'Invalid Phone', description: `Lead ${lead.name} has an invalid phone number (${lead.phone}). Skipping.`, variant: 'destructive' });
        // Auto-advance to next lead
        return;
      }
      const formattedPhone = '+' + dialPhone;
      debugLog(`📞 Dialing formatted number: ${formattedPhone} (raw: ${lead.phone})`);

      const callConnection = await device.connect({
        params: { 
          To: formattedPhone,
          leadName: lead.name,
          leadState: lead.taalk_state || lead.state || 'Unknown',
          agentEmail: directUserEmail,
          agentName: (authState?.user as any)?.name || directUserEmail.split('@')[0] || 'Producer',
        }
      });

      // Store connection globally for call management
      (window as any).twilioConnection = callConnection;

      let callAcceptedOrEnded = false;
      let callWasAccepted = false;
      const callStartTimeout = window.setTimeout(() => {
        if (callAcceptedOrEnded) return;
        callAcceptedOrEnded = true;
        handleOutboundCallStartTimeout(lead, callConnection, 'handleCallLead', directUserEmail);
      }, outboundCallStartTimeoutMs);

      setDialerState((prev) => ({
        ...prev,
        callStatus: 'calling_direct'
      }));

      // Listen for connection events
      callConnection.on('accept', async () => {
        callAcceptedOrEnded = true;
        callWasAccepted = true;
        window.clearTimeout(callStartTimeout);
        debugLog('✅ Direct call connected - producer can hear and talk to lead');
        void syncTaskRouterState('direct-call-accept', { force: 'busy' });
        setDialerState((prev) => ({
          ...prev,
          dialingStatus: 'connected',
          isConnected: true,
          webRTCConferenceActive: true,
          callStatus: 'connected_direct'
        }));
        
        // REMOVED: VDP should stay online during outbound calls
        // Agents need to stay available for inbound calls even while on outbound calls
        // Most outbound calls are voicemail, so VDP must remain online
        // VDP will only go offline if agent has an active inbound VDP call (handled by backend)
        
        toast({
          title: 'Call Connected',
          description: 'You are now directly connected to the lead'
        });
        
        // Track usage: Update agent status to 'in_call'
        if (authState?.user?.email) {
          try {
            await fetch('/agent/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_email: authState.user.email,
                status: 'in_call'
              })
            });
            debugLog('✅ Updated agent status to in_call');
          } catch (error) {
            console.warn('⚠️ Failed to update agent status to in_call:', error);
          }
        }
      });

      const callStartedAt = Date.now();

      callConnection.on('disconnect', async () => {
        callAcceptedOrEnded = true;
        window.clearTimeout(callStartTimeout);
        const callDurationMs = Date.now() - callStartedAt;
        const wasInstantFail = callDurationMs < 4000; // <4s = carrier rejection (404/480), not a real ring
        const shouldAutoSkipUnanswered = !callWasAccepted;

        debugLog(`📴 Direct call ended after ${callDurationMs}ms (instantFail=${wasInstantFail}, callWasAccepted=${callWasAccepted})`);

        // Rotate off call: always put back to AvailableInbound when device still on.
        void syncTaskRouterState('direct-call-disconnect', {
          force: isPoweredOnRef.current ? 'online' : 'offline',
        });
        directCallDisconnectedRef.current = true;
        callJustEndedRef.current = true;
        setTimeout(() => {
          directCallDisconnectedRef.current = false;
        }, 4000);
        let duration = 0;
        try {
          setDialerState((prev) => {
            duration = prev.callDuration || 0;
            return {
              ...prev,
              callStatus: 'idle',
              dialingStatus: 'ready',
              webRTCConferenceActive: false,
              isConnected: false,
              callDuration: duration
            };
          });
          setFinalCallDuration(duration);
          (window as any).twilioConnection = null;

          // Outbound that never reached "accept" should never stay pinned. Auto-disposition as no_answer and advance.
          if (shouldAutoSkipUnanswered && lead?.id) {
            toast({
              title: wasInstantFail ? '⚡ Bad Number — Skipping' : 'No Answer — Skipping',
              description: `${lead.name || 'Lead'} (${lead.phone}) could not be reached. Auto-marked No Answer.`,
              variant: 'default',
              duration: 3000,
            });
            // Save no_answer disposition silently
            void masterleadUpdateResolution({
              leadId: lead.id,
              cnresolution: 'no_answer',
              agentEmail: directUserEmail || undefined,
            }).catch((e: any) => console.warn('⚠️ Auto-disposition update failed (non-critical):', e));
            // Remove failed lead from visible queue so displayed lead cannot stay pinned on the failed call.
            setTimeout(() => {
              setDialerState((prev) => {
                const failedLeadKey = String(lead?.id ?? lead?.taalk_lead_id ?? lead?.leadId ?? lead?.phone ?? '');
                const nextAvailableLeads = (prev.availableLeads || []).filter((candidate: any) => {
                  const candidateKey = String(candidate?.id ?? candidate?.taalk_lead_id ?? candidate?.leadId ?? candidate?.phone ?? '');
                  return !(failedLeadKey && candidateKey && failedLeadKey === candidateKey);
                });
                const nextLead = nextAvailableLeads[0] || null;
                return {
                  ...prev,
                  leads: nextAvailableLeads,
                  availableLeads: nextAvailableLeads,
                  availableLeadsCount: nextAvailableLeads.length,
                  currentLeadIndex: 0,
                  currentIndex: 0,
                  currentCall: nextLead,
                  viewedLead: nextLead,
                  selectedDisposition: '',
                  dispositionApplied: false,
                };
              });
            }, 1000);
            return; // Skip the normal "add disposition" flow
          }

        // Track usage: Update agent status back to 'ready' (available)
        if (authState?.user?.email) {
          try {
            await fetch('/agent/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_email: authState.user.email,
                status: 'ready'
              })
            });
            debugLog('✅ Updated agent status to ready');
          } catch (error) {
            console.warn('⚠️ Failed to update agent status to ready:', error);
          }
        }
        } catch (e) {
          console.warn('⚠️ Disconnect handler error (ignored):', e);
        }
      });

      callConnection.on('error', (error: any) => {
        callAcceptedOrEnded = true;
        window.clearTimeout(callStartTimeout);
        console.error('❌ WebRTC connection error:', error);
        // Don't show error toast when call ended by disconnect (e.g. client hung up)
        if (directCallDisconnectedRef.current) {
          debugLog('🔇 Suppressing call error toast - call already ended by disconnect');
          return;
        }
        const code = error?.code;
        const msg = (error?.message || '').toLowerCase();
        const isNormalTermination = code === 31003 || code === 31005 || msg.includes('disconnect') || msg.includes('ended') || msg.includes('cancel');
        if (isNormalTermination) {
          debugLog('🔇 Suppressing call error toast - normal termination:', code || msg);
          return;
        }
        toast({
          title: 'Call Error',
          description: error?.message || 'An error occurred during the call',
          variant: 'destructive'
        });
      });

      debugLog('✅ Direct WebRTC call initiated');

      toast({
        title: 'Calling Lead',
        description: 'Direct connection in progress...'
      });
      debugLog('📞 STEP 2: Making outbound call to lead and merging into conference...');

      setDialerState((prev) => ({
        ...prev,
        callStatus: 'dialing_lead',
      dialingStatus: 'dialing'
      }));

      // START SEARCH FOR CALL MUSIC while waiting for client to answer
      debugLog('🎵 Starting search for call music while waiting for client...');
      let searchMusicInterval: NodeJS.Timeout;
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        let oscillatorNodes: OscillatorNode[] = [];

        // Create gentle search music pattern
        const startSearchMusic = () => {
          const frequencies = [220, 246.94, 261.63, 293.66]; // A3, B3, C4, D4
          let currentNote = 0;

          const playNote = () => {
            // Clean up previous oscillators
            oscillatorNodes.forEach(osc => {
              try { osc.stop(); } catch (e) {}
            });
            oscillatorNodes = [];

            // Create new oscillator for current note
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(frequencies[currentNote], audioContext.currentTime);
            oscillator.type = 'sine';

            // Gentle volume for background music
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.8);

            oscillatorNodes.push(oscillator);
            currentNote = (currentNote + 1) % frequencies.length;
          };

          // Start with first note immediately
          playNote();

          // Continue playing notes every 1 second
          searchMusicInterval = setInterval(playNote, 1000);
        };

        startSearchMusic();

        // Store cleanup function globally
        (window as any).stopSearchMusic = () => {
          if (searchMusicInterval) {
            clearInterval(searchMusicInterval);
          }
          oscillatorNodes.forEach(osc => {
            try { osc.stop(); } catch (e) {}
          });
          oscillatorNodes = [];

          // Close audio context to free up resources
          try {
            if (audioContext && audioContext.state !== 'closed') {
              audioContext.close();
              debugLog('🎵 Audio context closed');
            }
          } catch (e) {
            debugLog('🎵 Audio context close error:', e);
          }

          debugLog('🎵 Search music stopped');
        };

        toast({
          title: 'Searching for Client',
          description: 'Playing search music while connecting...'
        });

      } catch (audioError) {
        debugLog('🎵 Search music not available:', audioError);
      }

      const leadIdForCall = Number((lead as any).id ?? (lead as any).leadId ?? 0);
      if (!Number.isFinite(leadIdForCall) || leadIdForCall <= 0) {
        throw new Error('Missing required leadId for outbound call');
      }
      const taalkLeadIdForCall = String((lead as any).taalk_lead_id || '').trim();

      // 📊 CALL TRACKING: Log the dial attempt to database FIRST
      const trackingResponse = await segmentedFetch('/api/outbound-dialer/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            id: leadIdForCall,
            leadId: leadIdForCall,
            taalk_lead_id: taalkLeadIdForCall || undefined,
            taalkLeadId: taalkLeadIdForCall || undefined,
            phone: lead.phone,
            name: lead.name,
            state: lead.state,
            market: lead.market
          },
          userEmail: authState?.user?.email
        })
      });

      if (!trackingResponse.ok) {
        const errText = await trackingResponse.text().catch(() => '');
        throw new Error(errText || 'Call tracking preflight failed');
      }
      debugLog('✅ Call tracking logged successfully');

      const callResponse = await segmentedFetch('/api/outbound-dialer/call-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadIdForCall,
          taalkLeadId: taalkLeadIdForCall || undefined,
          leadPhone: lead.phone,
          leadName: lead.name,
          leadState: lead.state,
          conferenceName: 'Call-Connector-Pro-Conference'
        })
      });

      // 2xx = backend initiated the call; avoid "Call Failed" toast if we throw later (e.g. bad JSON)
      callInitiated = callResponse.ok;

      if (!callResponse.ok) {
        throw new Error('Failed to initiate outbound call to lead');
      }

      const callResult = await callResponse.json().catch(() => null);
      debugLog('📞 Outbound call result:', callResult);

      // STOP SEARCH MUSIC when call is initiated (we'll stop again when actually connected if needed)
      if ((window as any).stopSearchMusic) {
        (window as any).stopSearchMusic();
      }

      // Ringing: backend initiated the call; do NOT set connected — TaskRouter Busy only when lead answers.
      setDialerState((prev) => ({
        ...prev,
        callStatus: 'calling_direct',
        dialingStatus: 'ringing',
        currentCall: lead
      }));
      
      // REMOVED: VDP should stay online during outbound calls
      // Agents need to stay available for inbound calls even while on outbound calls
      // Most outbound calls are voicemail, so VDP must remain online
      // VDP will only go offline if agent has an active inbound VDP call (handled by backend)

      toast({
        title: 'Ringing',
        description: `Calling ${lead.name}…`
      });

    } catch (error: any) {
      console.error('❌ Call failed:', error);
      pushWebRtcDebug('handleCallLead:failed', {
        message: error?.message,
        stack: error?.stack,
      });

      // STOP SEARCH MUSIC on call failure
      if ((window as any).stopSearchMusic) {
        (window as any).stopSearchMusic();
      }

      // Backend already returned 2xx = call was initiated; don't show "Call Failed" or reset state
      if (callInitiated) {
        return;
      }

      const errMsg = String(error?.message || '').toLowerCase();
      const shouldFailAndAdvance =
        errMsg.includes('leadid is required') ||
        errMsg.includes('missing required leadid') ||
        errMsg.includes('preflight failed');

      if (shouldFailAndAdvance && lead?.id && authState?.user?.email) {
        try {
          await segmentedFetch('/api/outbound-dialer/disposition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: lead.id,
              taalk_lead_id: (lead as any).taalk_lead_id || undefined,
              phone: lead.phone,
              disposition: 'failed',
              agentEmail: authState.user.email,
              failureStage: 'call_start_rejected',
              failureReason: String(error?.message || '').slice(0, 300),
              autoAdvance: true,
            }),
          });
        } catch (markErr) {
          console.warn('⚠️ Auto-failed disposition write failed after call-start rejection:', markErr);
        }

        const nextLocalLead =
          (dialerState?.availableLeads || []).find(
            (l: any) => String(l?.id ?? l?.taalk_lead_id) !== String(lead?.id ?? (lead as any)?.taalk_lead_id),
          ) || null;

        setDialerState((prev) => {
          const filtered = (prev.availableLeads || []).filter(
            (l: any) => String(l?.id ?? l?.taalk_lead_id) !== String(lead?.id ?? (lead as any)?.taalk_lead_id),
          );
          return {
            ...prev,
            availableLeads: filtered,
            currentLeadIndex: 0,
            dialingStatus: 'idle',
            callStatus: 'idle',
            currentCall: null,
          };
        });

        toast({
          title: 'Lead Auto-Failed',
          description: 'Call start was rejected. Lead marked failed and advancing to next lead.',
          variant: 'default',
        });

        if (nextLocalLead?.phone) {
          setTimeout(() => {
            void dialLead(nextLocalLead);
          }, 250);
          return;
        }

        const next = await loadQueue({ forceRefill: true });
        if (next?.lead?.phone) {
          await dialLead(next.lead);
          return;
        }
      }

      setDialerState((prev) => ({
        ...prev,
        dialingStatus: 'idle',
        callStatus: 'idle',
        currentCall: null
      }));

      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate call',
        variant: 'destructive'
      });
    }
  };

  // Handle disposition selection

  // Complete Call Handler - END LEAD'S CALL AND MOVE TO NEXT
  const handleCompleteCall = async (saleData?: { alp?: string; saleAmount?: string }) => {
    try {
      debugLog('✅ Complete Call: ENDING LEAD\'S CALL AND MOVING TO NEXT...');


      // 0. Stop all audio/music
      stopAllAudio();

      const currentLead = getCurrentLead();

      // 🚨 CRITICAL: AOIntel leads MUST have a disposition before moving on
      if (currentLead) {
        const isAOIntel = currentLead.aointel === true || currentLead.aointel === 1 || 
                         String(currentLead.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
          debugLog('🚨 AOIntel lead requires disposition before moving on');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned before moving to the next lead. Please select a disposition.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block lead change - disposition is mandatory for AOIntel leads
        }
      }

      // 🚨 Inbound/AOI leads: require disposition before completing (treat like queue lead until dispositioned)
      if (dialerState.inboundCallLead && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        debugLog('🚨 Inbound lead requires disposition before completing');
        toast({
          title: 'Disposition Required',
          description: 'Please add a disposition to this call before completing.',
          variant: 'destructive',
          duration: 5000
        });
        return;
      }

      // Inbound lead completed (with disposition): clear inbound state only, do NOT remove from queue
      if (dialerState.inboundCallLead) {
        inboundDebugLog('completing inbound lead – clearing state only');
        stopAllAudio();
        const device: any = (window as any).twilioDevice;
        const conn: any = device?.activeConnection?.() ?? (window as any).twilioConnection ?? device?.connections?.[0];
        if (conn && typeof conn.disconnect === 'function') {
          armSuppressDispositionPromptOnDisconnect();
          conn.disconnect();
          (window as any).twilioConnection = null;
        }
        setDialerState(prev => ({
          ...prev,
          dialingStatus: 'idle',
          webRTCConferenceActive: false,
          campaignActive: false,
          powered: true,
          currentCall: null,
          inboundCallInfo: null,
          inboundCallLead: null,
          viewedLead: prev.viewedLead === prev.inboundCallLead ? null : prev.viewedLead,
          selectedDisposition: '',
          dispositionApplied: false,
          callNotes: '',
          callStatus: 'idle',
        }));
        setInboundCallAccepted(false);
        setCallState('idle');
        toast({ title: 'Call completed', description: 'Inbound call disposition saved.' });
        return;
      }

      // 🚨 CRITICAL: Block completing call if it was answered and lasted over 110 seconds without a proper disposition
      // This prevents agents from churning through leads by immediately ending answered calls
      if (currentLead && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        const currentCallDuration = callDurationSeconds || 0;
        
        if (currentCallDuration > 110) {
          debugLog(`🚨 BLOCKED: Call was answered and lasted ${currentCallDuration}s - disposition required`);
          toast({
            title: 'Disposition Required',
            description: `This call was answered and lasted ${currentCallDuration} seconds. You must select a proper disposition (callback, not_interested, booked, etc.) before moving to the next lead.`,
            variant: 'destructive',
            duration: 7000
          });
          return; // Block - cannot skip answered calls over 45 seconds
        }
      }

      // Check VDP disposition requirements before changing leads
      const canProceed = await endVDPCallOnLeadChange();
      if (!canProceed) {
        return; // Block lead change if disposition required
      }

      // INBOUND CALL: only stop WebRTC / clear inbound state; do NOT touch queue (availableLeads, currentLeadIndex)
      const isInboundCall = dialerState.webRTCConferenceActive && (dialerState.inboundCallLead || dialerState.inboundCallInfo);
      if (isInboundCall) {
        inboundDebugLog('inbound call ended (Complete/lead change): clearing panel');
        if (!dialerState.dispositionApplied && dialerState.selectedDisposition) {
          debugLog('⚠️ Inbound: applying disposition before ending');
          void handleApplyDisposition(saleData);
        }
        const device: any = (window as any).twilioDevice;
        const conn: any = device?.activeConnection?.() ?? (window as any).twilioConnection ?? device?.connections?.[0];
        if (conn && typeof conn.disconnect === 'function') {
          armSuppressDispositionPromptOnDisconnect();
          conn.disconnect();
          (window as any).twilioConnection = null;
        }
        setDialerState(prev => ({
          ...prev,
          dialingStatus: 'idle',
          webRTCConferenceActive: false,
          campaignActive: false,
          powered: true,
          currentCall: null,
          callStatus: 'idle',
          inboundCallInfo: null,
          inboundCallLead: null,
          selectedDisposition: '',
          dispositionApplied: false,
          callNotes: '',
        }));
        setInboundCallAccepted(false);
        setCallState('idle');
        toast({ title: 'Inbound call ended', description: 'Queue unchanged.' });
        return;
      }

      // 1. If disposition hasn't been applied yet, apply it now (shouldn't happen if workflow is followed)
      if (!dialerState.dispositionApplied && dialerState.selectedDisposition) {
        debugLog('⚠️ Disposition not applied yet - applying now before completing call');
        void handleApplyDisposition(saleData);
        debugLog('✅ Disposition send triggered (non-blocking)');
      }

      // 1.5. If NO disposition was selected/applied, mark lead as "called" in masterlead
      // Note: currentLead already declared above, reuse it
      // 🚨 EXCEPTION: AOIntel leads cannot be marked as "called" without disposition - they must be dispositioned
      // 🚨 EXCEPTION: Calls over 110 seconds cannot be marked as "called" - they must be dispositioned
      if (currentLead && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        const currentCallDuration = callDurationSeconds || 0;
        
        // Double-check: If call was over 110 seconds, block marking as "called"
        if (currentCallDuration > 110) {
          debugLog(`🚨 BLOCKED: Cannot mark call as "called" - duration ${currentCallDuration}s requires proper disposition`);
          toast({
            title: 'Disposition Required',
            description: `This call lasted ${currentCallDuration} seconds. You must select a proper disposition before completing the call.`,
            variant: 'destructive',
            duration: 7000
          });
          return; // Block - cannot mark as "called" if over 110 seconds
        }
        const isAOIntel = currentLead.aointel === true || currentLead.aointel === 1 || 
                         String(currentLead.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel) {
          debugLog('🚨 Cannot mark AOIntel lead as "called" without disposition - blocking');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned. Please select a disposition before completing the call.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block - AOIntel leads require disposition
        }
        
        debugLog('📞 No disposition selected - marking lead as "called" in masterlead');
        void (async () => {
          try {
            const res = await masterleadUpdateResolution({
              leadId: currentLead.id,
              leadPhone: currentLead.phone,
              cnresolution: 'called',
              agentEmail: authState?.user?.email
            });
            const result = await res.json().catch(() => ({}));
            debugLog('✅ Lead marked as "called" in masterlead:', result);
          } catch (error) {
            console.error('❌ Error marking lead as "called":', error);
          }
        })();
      }

      // 2. End the lead's call (if there's an active call)
      if (dialerState.currentCall && dialerState.currentCall.phone && dialerState.currentConferenceName) {
        try {
          debugLog(`📞 Ending lead's call to: ${dialerState.currentCall.phone}`);
          const response = await fetch('/api/end-lead', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conferenceName: dialerState.currentConferenceName
            })
          });

          const result = await response.json();
          debugLog('📞 Lead call end result:', result);
        } catch (error) {
          console.error('⚠️ Error ending lead call:', error);
        }
      }

      // 3. KEEP WebRTC device active (don't destroy it!)
      debugLog('🔌 Keeping WebRTC device active for next call');

      // 4. REMOVE COMPLETED LEAD - KEEP CURRENT INDEX AT 0 (POSITION 1)
      const completedLead = dialerState.availableLeads[dialerState.currentLeadIndex];
      const updatedLeads = dialerState.availableLeads.filter((_, index) => index !== dialerState.currentLeadIndex);
      debugLog(`🎯 REMOVING COMPLETED LEAD: ${completedLead?.name} - ${updatedLeads.length} leads remaining`);

      // Clear undo state when completing call (can't undo after moving to next lead)
      setUndoState(null);

      // 4. Reset call state, keep current index at 0, remove completed lead, RESET DISPOSITION for new lead
      setDialerState(prev => {
        const shouldClearViewedLead = Boolean(
          completedLead &&
          prev.viewedLead &&
          isSameLead(prev.viewedLead, completedLead),
        );
        return {
          ...prev,
          leads: updatedLeads,
          availableLeads: updatedLeads,
          currentLeadIndex: 0, // ALWAYS STAY AT POSITION 1
          dialingStatus: 'idle',
          webRTCConferenceActive: false, // Conference ended but WebRTC stays active
          powered: true, // Keep WebRTC powered on
          currentCall: null,
          currentConferenceName: undefined,
          viewedLead: shouldClearViewedLead ? null : prev.viewedLead,
          selectedDisposition: '', // Reset disposition for NEW lead
          dispositionApplied: false, // Reset applied status for NEW lead
          callNotes: '', // Clear notes for new lead
        };
      });

      // 5. Force stop any playing audio/music
      try {
        // DON'T call disconnectAll() - only disconnect the active connection
        if ((window as any).twilioConnection) {
          armSuppressDispositionPromptOnDisconnect();
          debugLog('🔇 Disconnecting active WebRTC connection (keeping device registered)');
          (window as any).twilioConnection.disconnect();
          (window as any).twilioConnection = null;
        }

        // Stop any HTML5 audio elements that might be playing
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
          if (!audio.paused) {
            debugLog('🔇 Stopping HTML5 audio element');
            audio.pause();
            audio.currentTime = 0;
          }
        });

        // Stop any media streams
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              stream.getTracks().forEach(track => {
                if (track.kind === 'audio') {
                  debugLog('🔇 Stopping audio track');
                  track.stop();
                }
              });
            })
            .catch(() => {
              // Ignore errors if no audio stream is active
            });
        }
      } catch (error) {
        console.error('⚠️ Error stopping audio streams:', error);
      }

      // REMOVED: VDP should already be online - we don't disable it during outbound calls
      // VDP stays online throughout outbound calls so agent can receive inbound calls
      // Only backend checkAgentVDPStatus will take VDP offline if there's an actual inbound VDP call
      
      // 🔥 NOW invalidate queries to refresh lead queue after lead has been removed
      debugLog('🔄 Complete Call - invalidating queries to refresh lead queue');
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/leads'] });
      
      // Also clear server cache to ensure fresh data (non-blocking; don't throw)
      if (authState.user?.email) {
        fetch(`/api/admin/force-refresh-leads/${encodeURIComponent(authState.user.email)}`, { method: 'POST' })
          .then(() => debugLog('✅ Server cache cleared for immediate lead refresh'))
          .catch(() => {});
      }

      // Get next lead after removal (index stays at 0)
      const nextLead = updatedLeads[0];
      const nextLeadName = nextLead?.name || 'Unknown';

      toast({
        title: 'Call Completed - Advanced to Next Lead',
        description: `Now viewing: ${nextLeadName} (1 of ${updatedLeads.length})`
      });

      // When queue is empty or low (≤3), refill so agent can keep dialing (forceRefill skips stale active-call check)
      if (updatedLeads.length <= 3) {
        setTimeout(() => {
          if (updatedLeads.length === 0) {
            debugLog('🔄 Queue empty after Complete Call – refreshing leads from server');
            toast({
              title: 'Refreshing Leads',
              description: 'Loading more leads from the server...',
              variant: 'default'
            });
          } else {
            debugLog('🔄 Queue low (≤3 leads) – refreshing leads from server');
          }
          loadQueue({ forceRefill: true });
        }, 800);
      }

      // ── Open Booking Modal for booked / instant_presentation ──────────────
      const completedDisposition = dialerState.selectedDisposition;
      if (completedDisposition === 'booked' || completedDisposition === 'instant_presentation') {
        const leadForBooking = completedLead;
        if (leadForBooking) {
          // Disabled for now: booked disposition should not force appointment scheduling.
        }
      }

    } catch (error) {
      console.error('❌ Error in Complete Call:', error);
      toast({
        title: 'Complete Call Failed',
        description: 'Failed to complete call',
        variant: 'destructive'
      });
    }
  };

  // Redial Handler - SAME BEHAVIOR AS COMPLETE & DIAL NEXT (teardown) BUT DIAL SAME LEAD
  const handleRedial = async () => {
    try {
      debugLog('🔄 Redial: same teardown as Complete & Dial Next, then dial SAME lead...');

      const currentLead = getCurrentLead();
      if (!currentLead) {
        toast({
          title: 'No Lead to Redial',
          description: 'No current lead available for redial',
          variant: 'destructive'
        });
        return;
      }

      if (dialerState.availableLeads.length === 0) {
        toast({
          title: 'Cannot Redial',
          description: 'No leads available',
          variant: 'destructive'
        });
        return;
      }

      const hadActiveCall = !!(
        dialerState.currentConferenceName ||
        dialerState.webRTCConferenceActive ||
        dialerState.currentCall
      );

      if (hadActiveCall) {
        // 0. Stop all audio (same as Complete & Dial Next)
        stopAllAudio();

        // 1. END SERVER-SIDE CONFERENCE (same as handleDialNextLead)
        const conferenceName = dialerState.currentConferenceName;
        if (conferenceName) {
          try {
            debugLog(`[REDIAL] Layer C: Ending server-side conference: ${conferenceName}`);
            const response = await fetch('/api/end-conference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ conferenceName }),
            });
            if (response.ok) {
              debugLog('[REDIAL] Layer C: Conference ended successfully');
            } else {
              console.warn('[REDIAL] Layer C: Conference end request failed', response.status);
            }
          } catch (e) {
            console.warn('[REDIAL] Layer C: Conference end request failed', e);
          }
        }

        // 2. 3-LAYER TEARDOWN (same as handleDialNextLead)
        debugLog('[REDIAL] Starting 3-layer teardown...');
        const deviceForDisconnect: any = (window as any).twilioDevice;
        const connForDisconnect: any =
          deviceForDisconnect?.activeConnection?.() ??
          (window as any).twilioConnection ??
          deviceForDisconnect?.connections?.[0];

        try {
          if (connForDisconnect && typeof connForDisconnect.disconnect === 'function') {
            debugLog('[REDIAL] Layer A: Disconnecting active connection...');
            connForDisconnect.disconnect();
          }
        } catch (e) {
          console.warn('[REDIAL] Layer A: conn.disconnect failed', e);
        }

        try {
          if (deviceForDisconnect && typeof deviceForDisconnect.disconnectAll === 'function') {
            debugLog('[REDIAL] Layer B: Disconnecting all connections...');
            deviceForDisconnect.disconnectAll();
          }
        } catch (e) {
          console.warn('[REDIAL] Layer B: device.disconnectAll failed', e);
        }

        (window as any).twilioConnection = null;
      }

      // 3. Clear call state but KEEP same lead and index (do not remove from queue)
      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'idle',
        webRTCConferenceActive: false,
        currentCall: null,
        currentConferenceName: undefined,
        powered: true,
      }));

      toast({
        title: 'Redialing Lead',
        description: `Redialing ${currentLead.name || 'current lead'}`
      });

      // 4. Dial same lead after same delay as Complete & Dial Next
      setTimeout(() => {
        dialLead(currentLead);
      }, hadActiveCall ? 500 : 100);

    } catch (error) {
      console.error('❌ Error in Redial:', error);
      toast({
        title: 'Redial Failed',
        description: 'Failed to redial lead',
        variant: 'destructive'
      });
    }
  };

  // Dial Next Lead Handler - END CALL AND DIAL NEXT (SIMPLIFIED - ALWAYS WORKS)
  const handleDialNextLead = async () => {
    try {
      debugLog('🔥 DIAL NEXT: Ending call and moving to next lead...');
      
      // 0. Stop all audio/music
      stopAllAudio();

      // 1. END SERVER-SIDE CONFERENCE (fire-and-forget — never block dial next)
      const conferenceName = dialerState.currentConferenceName;
      if (conferenceName) {
        void fetch('/api/end-conference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ conferenceName }),
        }).catch(() => {});
      }

      // 2. 3-LAYER TEARDOWN: Disconnect connection, device, and server conference
      debugLog('[DIAL NEXT] Starting 3-layer teardown...');
      
      const deviceForDisconnect: any = (window as any).twilioDevice;
      const connForDisconnect: any =
        deviceForDisconnect?.activeConnection?.() ??
        (window as any).twilioConnection ??
        deviceForDisconnect?.connections?.[0];

      // Layer A: Disconnect active connection (browser leg)
      try {
        if (connForDisconnect && typeof connForDisconnect.disconnect === 'function') {
          debugLog('[DIAL NEXT] Layer A: Disconnecting active connection...');
          connForDisconnect.disconnect();
          debugLog('[DIAL NEXT] Layer A: Connection disconnected');
        } else {
          debugLog('[DIAL NEXT] Layer A: No active connection (expected if call already ended)');
        }
      } catch (e) {
        debugLog('[DIAL NEXT] Layer A: conn.disconnect failed', e);
      }

      // Layer B: Disconnect all connections (covers weird states)
      try {
        if (deviceForDisconnect && typeof deviceForDisconnect.disconnectAll === 'function') {
          debugLog('[DIAL NEXT] Layer B: Disconnecting all connections...');
          deviceForDisconnect.disconnectAll();
          debugLog('[DIAL NEXT] Layer B: All connections disconnected');
        } else {
          console.warn('[DIAL NEXT] Layer B: device.disconnectAll not available');
        }
      } catch (e) {
        console.warn('[DIAL NEXT] Layer B: device.disconnectAll failed', e);
      }

      // Clear connection reference
      (window as any).twilioConnection = null;

      // 3. REMOVE COMPLETED LEAD - KEEP CURRENT INDEX AT 0 (POSITION 1)
      const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
      const updatedLeads = dialerState.availableLeads.filter((_, index) => index !== dialerState.currentLeadIndex);
      debugLog(`🎯 REMOVING COMPLETED LEAD: ${currentLead?.name} - ${updatedLeads.length} leads remaining`);

      // Track position 0 (always position 1)
      trackproducerPosition(0);

      // Preserve call duration BEFORE starting new call - this will be visible until dialLead() resets it
      const preservedDuration = callDurationSeconds > 0 ? callDurationSeconds : finalCallDuration || dialerState.callDuration || 0;
      
      // Set finalCallDuration so it displays while we prepare to dial next
      if (preservedDuration > 0) {
        setFinalCallDuration(preservedDuration);
      }
      
      setDialerState(prev => {
        const shouldClearViewedLead = Boolean(
          currentLead &&
          prev.viewedLead &&
          isSameLead(prev.viewedLead, currentLead),
        );
        return {
          ...prev,
          leads: updatedLeads,
          availableLeads: updatedLeads,
          currentLeadIndex: 0, // ALWAYS STAY AT POSITION 1
          dialingStatus: 'idle',
          webRTCConferenceActive: false,
          currentCall: null,
          currentConferenceName: undefined,
          inboundCallLead: null, // Clear inbound lead after complete so agent can take next
          viewedLead: (prev.inboundCallLead || shouldClearViewedLead) ? null : prev.viewedLead,
          powered: true, // Keep WebRTC powered on
          selectedDisposition: null, // Reset disposition for NEW lead
          callNotes: '', // Clear notes for new lead
          callDuration: preservedDuration, // PRESERVE duration - dialLead() will reset when new call starts
        };
      });

      // 4. Audio already stopped by stopAllAudio() call above

      // 5. AUTO-DIAL NEXT LEAD immediately — no blocking inbound check, no artificial delay
      if (updatedLeads.length > 0) {
        debugLog('🔄 Auto-dialing next lead after completing call...');
        dialLead(updatedLeads[0]);
        // When queue is low (≤3), refill in background so agent doesn't run out after a few more completes
        if (updatedLeads.length <= 3) {
          setTimeout(() => {
            debugLog('🔄 Queue low (≤3 leads) – refreshing leads from server');
            loadQueue({ forceRefill: true });
          }, 800);
        }
      } else {
        if (isLeaseDialerRoute) {
          const result = await loadQueue({ forceRefill: true });
          const nextLead = result?.lead;
          if (nextLead?.phone) {
            debugLog('🔄 Leasedialer queue refilled from server - dialing returned lead');
            await dialLead(nextLead);
            return;
          }
        }
        debugLog('❌ No more leads available – refreshing queue from server');
        toast({
          title: 'Refreshing Leads',
          description: 'All leads in this batch are done. Loading more from the server...',
          variant: 'default'
        });
        // Auto-refill so agent can keep dialing (forceRefill skips stale "active call" check)
        setTimeout(() => {
          loadQueue({ forceRefill: true });
        }, 800);
      }

    } catch (error) {
      console.error('❌ Failed to complete and dial next:', error);
      toast({
        title: 'Dial Next Failed',
        description: error instanceof Error ? error.message : 'Failed to move to next lead',
        variant: 'destructive'
      });
    }
  };

  const handleLeaseDialerCompleteAndDialNext = async () => {
    const currentLead = getCurrentLead();
    const currentLeadId = currentLead?.id ?? currentLead?.taalk_lead_id;
    const backupLeads = dialerState.availableLeads
      .filter((lead: any) =>
        String(lead?.id ?? lead?.taalk_lead_id) !== String(currentLeadId)
      )
      .slice(0, 2);
    const backupLead = backupLeads[0] || null;

    if (!currentLead) {
      toast({ title: 'No current lead', description: 'No leasedialer lead is active.', variant: 'destructive' });
      return;
    }

    stopAllAudio();

    const conferenceName = dialerState.currentConferenceName;
    if (conferenceName) {
      void fetch('/api/end-conference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conferenceName }),
      }).catch(() => {});
    }

    const deviceForDisconnect: any = (window as any).twilioDevice;
    const connForDisconnect: any =
      deviceForDisconnect?.activeConnection?.() ??
      (window as any).twilioConnection ??
      deviceForDisconnect?.connections?.[0];

    try {
      if (connForDisconnect && typeof connForDisconnect.disconnect === 'function') {
        armSuppressDispositionPromptOnDisconnect();
        connForDisconnect.disconnect();
      }
      if (deviceForDisconnect && typeof deviceForDisconnect.disconnectAll === 'function') {
        deviceForDisconnect.disconnectAll();
      }
    } catch (error) {
      console.warn('[LEASE] complete dial next disconnect failed', error);
    }
    (window as any).twilioConnection = null;

    const dispositionToSend = String(dialerState.selectedDisposition || '').trim() || 'spoke';
    let promotedNextLead: any = null;
    let promotedBackups: any[] = [];
    try {
      const dispositionResponse = await apiRequest('POST', '/api/outbound-dialer/disposition', {
        leadId: currentLead.id ?? currentLead.leadId,
        taalk_lead_id: currentLead.taalk_lead_id,
        phone: currentLead.phone,
        disposition: dispositionToSend,
        agentEmail: authState.user?.email,
      }, authState.user?.email);
      const dispositionResult = await dispositionResponse.json().catch(() => ({}));
      const normalizeLeasedLead = (lead: any) => lead
        ? {
            ...lead,
            id: lead.id,
            name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
            phone: lead.phone,
            leadId: lead.id ?? lead.taalk_lead_id ?? lead.lead_id,
            market: lead.taalk_market || lead.market || 'Unknown',
            isHotLead: lead.is_hot_lead || lead.isHotLead || false,
            priority: lead.priority_score || 'normal',
          }
        : null;
      promotedNextLead = normalizeLeasedLead(dispositionResult?.nextLead || dispositionResult?.currentLead || dispositionResult?.leads?.[0] || null);
      promotedBackups = Array.isArray(dispositionResult?.backupLeads)
        ? dispositionResult.backupLeads.map(normalizeLeasedLead).filter(Boolean)
        : [];
    } catch (error) {
      console.warn('[LEASE] disposition save failed before dial next', error);
      toast({
        title: 'Disposition Failed',
        description: 'Could not save disposition. Fix and retry before dialing next lead.',
        variant: 'destructive',
      });
      return;
    }

    const nextLeadToDial = promotedNextLead?.phone ? promotedNextLead : backupLead;
    const nextLocalQueue = [nextLeadToDial, ...promotedBackups].filter(Boolean);

    if (nextLeadToDial?.phone) {
      setDialerState(prev => ({
        ...prev,
        leads: nextLocalQueue,
        availableLeads: nextLocalQueue,
        availableLeadsCount: nextLocalQueue.length,
        currentLeadIndex: 0,
        currentIndex: 0,
        dialingStatus: 'idle',
        webRTCConferenceActive: false,
        currentCall: null,
        currentConferenceName: undefined,
        inboundCallLead: null,
        viewedLead: null,
        powered: true,
        selectedDisposition: '',
        dispositionApplied: false,
        callNotes: '',
      }));

      await new Promise((resolve) => setTimeout(resolve, 150));
      await dialLead(nextLeadToDial);

      setTimeout(() => {
        void loadQueue({ forceRefill: true });
      }, 500);
      return;
    }

    const result = await loadQueue({ forceRefill: true });
    const nextLead = result?.lead;
    if (nextLead?.phone) {
      await dialLead(nextLead);
      return;
    }

    toast({
      title: 'No backup lead ready',
      description: 'The server did not return a callable backup lead.',
      variant: 'destructive',
    });
  };

  // When double-dial mode is on: first Complete = redial same, second = dial next. Used by main Complete button.
  const handleCompleteCallThenRedialOrDialNext = async () => {
    if (completeCallCooldownSeconds > 0) {
      debugLog('⏳ Complete & Dial Next blocked by cooldown', { completeCallCooldownSeconds });
      return;
    }
    if (doubleDialMode && doubleDialNextIsRedial) {
      await handleRedial();
      setDoubleDialNextIsRedial(false);
    } else {
      if (isLeaseDialerRoute) {
        await handleLeaseDialerCompleteAndDialNext();
        if (doubleDialMode) setDoubleDialNextIsRedial(true);
        return;
      }
      await handleCompleteCall();
      setTimeout(() => handleDialNextLead(), 500);
      if (doubleDialMode) setDoubleDialNextIsRedial(true);
    }
  };

  const getStatusColor = () => {
    switch (dialerState.dialingStatus) {
      case 'connected': return 'bg-green-500';
      case 'dialing': return 'bg-yellow-500';
      case 'paused': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  // Connected first: if we're actually on a live call, show connected even if lead hydration is late.
  // Requiring a lead object here can leave the panel stuck on "Connecting" while the call is already up.
  const activeTaskRouterPending = taskRouterPending ?? retainedTaskRouterPending;
  const hasLiveInboundCall =
    inboundCallAccepted ||
    dialerState.webRTCConferenceActive ||
    inboundConnRef.current != null;
  const shouldShowConnectedInboundUi =
    hasLiveInboundCall ||
    (inboundConnecting &&
      inboundAnswerRequestedRef.current &&
      !!(dialerState.inboundCallLead || inboundCallLeadRef.current || dialerState.inboundCallInfo));
  // Show ringing panel when TaskRouter pending offer OR when Twilio Device has an incoming connection
  // (dequeue-from-assignment means reservation is already 'accepted' when browser rings, so pending endpoint returns empty)
  const hasPendingInboundOffer =
    (activeTaskRouterPending != null || incomingConn != null) &&
    !inboundAnswerRequestedRef.current &&
    !hasLiveInboundCall;
  const inboundPanelState: InboundPanelState =
    inboundWrapEndsAt != null && wrapSecondsLeft > 0
      ? 'wrapping'
      : inboundCallEndedAt != null
        ? 'ended'
        : hasPendingInboundOffer
          ? 'ringing'
        : shouldShowConnectedInboundUi
          ? 'connected'
          : inboundConnecting
            ? 'connecting'
            : 'idle';
  // Prefer resolved lead (masterlead lookup) so preview shows name, not "Call from 914..."
  const taskAttrsLead: Lead | null = activeTaskRouterPending
    ? (() => {
        try {
          const raw = activeTaskRouterPending.taskAttributes;
          const attrs = typeof raw === 'string' ? (raw ? JSON.parse(raw) : {}) : (raw || {}) as Record<string, unknown>;
          const phone = String(attrs.phone_number ?? attrs.phone ?? '').trim();
          const state = String(attrs.state ?? '').trim();
          const market = String(attrs.market ?? 'Inbound').trim() || 'Inbound';
          const leadName = attrs.lead_name ?? attrs.leadName;
          const firstName = attrs.first_name ?? attrs.firstName;
          const lastName = attrs.last_name ?? attrs.lastName;
          const name =
            (typeof leadName === 'string' && leadName.trim()) ||
            [firstName, lastName].filter(Boolean).map(String).join(' ').trim() ||
            (phone ? `Call from ${phone}` : 'Inbound Call');
          const city = String(attrs.city ?? (attrs as any).taalk_city ?? '').trim();
          const lead: Lead = {
            id: String(attrs.lead_id ?? activeTaskRouterPending.taskSid),
            leadId: String(attrs.lead_id ?? activeTaskRouterPending.taskSid),
            name,
            phone,
            state,
            market: (attrs.market as string) || market,
            taalk_market: market,
            status: '',
            timestamp: new Date().toISOString(),
            ...(city ? { city } : {}),
          } as Lead;
          if (attrs.taalk_lead_id != null) (lead as any).taalk_lead_id = String(attrs.taalk_lead_id);
          if (attrs.lead_email != null) (lead as any).email = String(attrs.lead_email);
          if (firstName != null) (lead as any).first_name = String(firstName);
          if (lastName != null) (lead as any).last_name = String(lastName);
          return lead;
        } catch {
          return { id: activeTaskRouterPending.taskSid, leadId: activeTaskRouterPending.taskSid, name: 'Inbound Call', phone: '', state: '', market: 'Inbound', taalk_market: 'Inbound', status: '', timestamp: new Date().toISOString() } as Lead;
        }
      })()
    : null;
  const inboundPanelLead: Lead | null =
    incomingCallLead ||
    dialerState.inboundCallLead ||
    inboundCallLeadRef.current ||
    taskAttrsLead ||
    (inboundPanelState === 'connected' ? getCurrentLead() : null);

  const handleInboundPanelAnswer = async () => {
    if (answering) return;
    // Capture immediately so a concurrent poll can't clear pending before we use it
    const pending = taskRouterPending ?? retainedTaskRouterPending;
    const sids = pending ? { taskSid: pending.taskSid, reservationSid: pending.reservationSid } : lastPendingSidsRef.current;
    if (!sids?.taskSid || !sids?.reservationSid) {
      if (!incomingConn) {
        toast({ title: 'No call to accept', description: 'Accept is only available when an inbound call is ringing.', variant: 'destructive' });
        return;
      }
    }
    inboundAnswerRequestedRef.current = true;
    const taskSid = sids?.taskSid;
    const reservationSid = sids?.reservationSid;
    const isDemoCall = reservationSid ? String(reservationSid).startsWith('test-inject-') : true;
    if (taskSid && reservationSid) {
      setAnswering(true);
      try {
        // If WebRTC Device never initialized, Twilio has nowhere to deliver the call and we reject incoming in queueIncomingConn.
        // Power on first so the browser is registered when we send dequeue; then the incoming leg will be accepted.
        if (!isDemoCall && !isPoweredOnRef.current && handlePowerToggleRef.current) {
          toast({ title: 'Starting WebRTC…', description: 'Turn on so the call can connect.', variant: 'default', duration: 3000 });
          await handlePowerToggleRef.current({ simpleRegister: true });
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 500));
            if (isPoweredOnRef.current) break;
          }
          if (!isPoweredOnRef.current) {
            console.warn('[INBOUND] WebRTC did not register in time; sending accept anyway so server can dequeue');
          }
        }
        // TaskRouter flow: assignment callback returns empty (hold). We MUST POST accept so the server
        // sends dequeue to Twilio; only then does Twilio dial the worker's browser. Then we accept the browser leg.
        if (!isDemoCall) {
          try {
            const agentEmail = (authState?.user?.email ?? '').trim();
            const contactUri = agentEmail ? `client:${agentEmail}` : '';
            const acceptBody = { taskSid, reservationSid, agent_email: agentEmail || undefined, contact_uri: contactUri || undefined };
            console.log('[INBOUND] Sending taskrouter/accept (dequeue signal)', { taskSid, reservationSid, hasAgentEmail: !!agentEmail });
            const acceptRes = await fetch('/api/twilio/taskrouter/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(acceptBody),
            });
            if (!acceptRes.ok) {
              const errBody = await acceptRes.json().catch(() => ({}));
              console.error('[INBOUND] taskrouter/accept failed', acceptRes.status, errBody);
              toast({ title: 'Accept failed', description: errBody?.error || `Server returned ${acceptRes.status}`, variant: 'destructive' });
              setAnswering(false);
              return;
            }
            console.log('[INBOUND] taskrouter/accept OK — Twilio will dial browser; incoming handler will accept when it arrives');
          } catch (err) {
            console.error('[INBOUND] taskrouter/accept request failed', err);
            toast({ title: 'Accept failed', description: (err as Error)?.message || 'Network error', variant: 'destructive' });
            setAnswering(false);
            return;
          }
        }

        // Browser leg: if Twilio already delivered it, accept now; else inboundAnswerRequestedRef is set so handler will accept when it fires.
        if (!isDemoCall && incomingConn && !browserLegAcceptIssuedRef.current) {
          browserLegAcceptIssuedRef.current = true;
          try {
            const result = (incomingConn as any).accept();
            console.log('[INBOUND] Direct accept: browser leg accepted via incomingConn.accept()');
            if (result && typeof result.then === 'function') {
              result.catch((err: unknown) => {
                browserLegAcceptIssuedRef.current = false;
                console.warn('[INBOUND] incomingConn.accept() promise rejected', err);
              });
            }
          } catch (err) {
            browserLegAcceptIssuedRef.current = false;
            console.warn('[INBOUND] incomingConn.accept() threw', err);
          }
        } else if (!isDemoCall) {
          console.log('[INBOUND] No incomingConn yet — inboundAnswerRequestedRef set; incoming handler will auto-accept');
        }
        // Build lead info and update state from task attributes (works regardless of call path).
        const fakeOk = true;
        if (fakeOk) {
          // Show "Connecting…" until browser leg is accepted; voice-busy is set when conn fires 'accept' (call actually connected)
          setInboundConnecting(true);
          try {
            const attrs = pending && (typeof pending.taskAttributes === 'string' ? JSON.parse(pending.taskAttributes) : pending.taskAttributes) || {};
            const callSidFromTask = attrs.call_sid != null ? String(attrs.call_sid).trim() : null;
            if (callSidFromTask) inboundCallSidForPollRef.current = callSidFromTask;
            const phone = attrs.phone_number || attrs.phone || '';
            const lead: Lead = {
              id: attrs.lead_id || taskSid,
              leadId: attrs.lead_id || taskSid,
              name: attrs.lead_name || [attrs.first_name, attrs.last_name].filter(Boolean).join(' ').trim() || 'Inbound Call',
              phone,
              state: attrs.state || '',
              market: (attrs.market as string) || 'Inbound',
              taalk_market: (attrs.market as string) || 'Inbound',
              status: '',
              timestamp: new Date().toISOString(),
            } as Lead;
            if (attrs.taalk_lead_id) (lead as any).taalk_lead_id = attrs.taalk_lead_id;
            if (attrs.lead_email) (lead as any).email = attrs.lead_email;
            inboundCallLeadRef.current = lead;
            const fromForDisplay = phone && !isDequeueCallerId(phone) ? phone : '';
            setDialerState((prev: any) => ({
              ...prev,
              dialingStatus: 'connecting',
              isConnected: false,
              webRTCConferenceActive: false,
              inboundCallInfo: fromForDisplay || attrs.call_sid ? { from: fromForDisplay, to: '', callSid: attrs.call_sid || taskSid } : prev.inboundCallInfo,
              inboundCallLead: lead,
              viewedLead: lead,
              currentCall: lead,
              campaignActive: false,
            }));
            // End any active Call Connector Pro (outbound) call so only the inbound is active
            const outboundConn = (window as any).twilioConnection;
            if (outboundConn && typeof outboundConn.disconnect === 'function') {
              try {
                debugLog('🔌 Accepting inbound (TaskRouter): disconnecting active outbound call');
                outboundConn.disconnect();
              } catch (e) {
                console.warn('⚠️ Error disconnecting outbound for inbound answer:', e);
              }
              (window as any).twilioConnection = null;
            }
            if (!isDemoCall && lead?.phone && authState?.user?.email) {
              apiRequest(
                "POST",
                "/api/outbound-dialer/inbound-picked-up",
                { leadId: lead.id, leadPhone: lead.phone, agentEmail: authState.user.email },
                authState.user.email,
              ).catch((err) => console.warn("inbound-picked-up failed", err));
            }
          } catch (e) {
            console.warn('TaskRouter answer: build lead/state failed', e);
          }
          setTaskRouterPending(null);
          setRetainedTaskRouterPending(null);
          lastPendingSidsRef.current = null;
        }
      } catch (e) {
        console.warn('TaskRouter accept error', e);
      } finally {
        setAnswering(false);
      }
      return;
    }
    if (!incomingConn) return;
    setAnswering(true);
    try {
      const conn = incomingConn;
      const to = (conn as any).parameters?.To;
      const callSid = (conn as any).parameters?.CallSid;
      const lead = incomingCallLead ?? inboundCallLeadRef.current;
      const rawFrom = (conn as any).parameters?.From;
      const callerPhone = lead?.phone ?? (rawFrom && !isDequeueCallerId(rawFrom) ? rawFrom : '');
      if (typeof conn.accept === 'function') {
        const r = conn.accept();
        if (r && typeof r.then === 'function') await r;
      }
      setInboundCallAccepted(true);
      // Terminate any active outbound Call Connector Pro call so only the inbound is active
      const outboundConn = (window as any).twilioConnection;
      if (outboundConn && typeof outboundConn.disconnect === 'function') {
        try {
          debugLog('🔌 Answering inbound: disconnecting active outbound call');
          outboundConn.disconnect();
        } catch (e) {
          console.warn('⚠️ Error disconnecting outbound for inbound answer:', e);
        }
        (window as any).twilioConnection = null;
      }
      setDialerState((prev: any) => {
        const rawFrom = lead?.phone ?? prev.inboundCallInfo?.from ?? callerPhone ?? '';
        const from = isDequeueCallerId(rawFrom) ? '' : rawFrom;
        return {
          ...prev,
          dialingStatus: 'connected',
          isConnected: true,
          webRTCConferenceActive: true,
          inboundCallInfo: (from || to || callSid) ? { from, to: to ?? '', callSid: callSid ?? '' } : null,
          inboundCallLead: lead || null,
          viewedLead: lead || null,
          currentCall: lead || null,
          campaignActive: false,
        };
      });
      // Update masterlead.cn_email when inbound is picked up so disposition/Zapier attribute correctly
      if (lead && (lead.id || lead.phone) && authState?.user?.email) {
        apiRequest(
          "POST",
          "/api/outbound-dialer/inbound-picked-up",
          {
            leadId: lead.id || (lead as any).taalk_lead_id,
            leadPhone: lead.phone,
            agentEmail: authState.user.email,
          },
          authState.user.email,
        ).catch((err) => console.warn("inbound-picked-up failed", err));
      }
      // Kill Taalk VDP immediately when they answer so it stops ringing and closes
      if (typeof (window as any).TaalkVDP !== 'undefined') {
        const TaalkVDP = (window as any).TaalkVDP;
        try {
          if (TaalkVDP.disconnect) TaalkVDP.disconnect();
          else if (TaalkVDP.close) TaalkVDP.close();
          debugLog('✅ Taalk VDP killed on inbound answer');
        } catch (e) {
          console.warn('Taalk VDP close on answer:', e);
        }
      }
      void disableVDPInbound();
      // On disconnect/cancel: show "Call ended" then idle so panel doesn't stay "Connected"
      conn.on?.('disconnect', () => {
        try {
          if (typeof (window as any).__onInboundDisconnected === 'function') {
            (window as any).__onInboundDisconnected();
          }
        } catch (e) {
          console.warn('Inbound disconnect handler error (ignored):', e);
        }
      });
      conn.on?.('cancel', () => {
        try {
          if (typeof (window as any).__onInboundDisconnected === 'function') {
            (window as any).__onInboundDisconnected();
          }
        } catch (e) {
          console.warn('Inbound cancel handler error (ignored):', e);
        }
      });
    } catch (e) {
      console.error(e);
      inboundDebugLog('handleAcceptInbound catch: setting incomingConn=null');
      setIncomingConn(null);
    } finally {
      setAnswering(false);
    }
  };

  const handleInboundPanelReject = async () => {
    inboundAnswerRequestedRef.current = false;
    setInboundDispositionRequired(false);
    // Reject browser connection first so ringing stops immediately
    try {
      if (incomingConn && typeof (incomingConn as any).reject === 'function') {
        (incomingConn as any).reject();
      }
    } catch (e) {
      console.warn('[INBOUND] Decline: connection.reject error', e);
    }
    // Reject TaskRouter reservation so the task can go to the next worker or timeout
    if (activeTaskRouterPending) {
      try {
        await fetch('/api/twilio/taskrouter/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ taskSid: activeTaskRouterPending.taskSid, reservationSid: activeTaskRouterPending.reservationSid }),
        });
      } catch (e) {
        console.warn('[INBOUND] Decline: taskrouter/reject error', e);
      }
      inboundDebugLog('clearInboundPanelState call site: handleInboundPanelReject (TaskRouter reject)');
    } else {
      inboundDebugLog('clearInboundPanelState call site: handleInboundPanelReject (browser reject)');
    }
    clearInboundPanelState();
  };

  const handleInboundPanelHangup = React.useCallback(() => {
    inboundDebugLog('handleInboundPanelHangup CALLED');
    try {
      const conn: any =
        inboundConnRef.current ??
        incomingConn ??
        (window as any).twilioDevice?.activeConnection?.() ??
        (window as any).twilioConnection;
      if (conn && typeof conn.disconnect === 'function') {
        conn.disconnect();
      } else if ((window as any).twilioDevice && typeof (window as any).twilioDevice.disconnectAll === 'function') {
        (window as any).twilioDevice.disconnectAll();
      } else {
        console.warn('[INBOUND] Hangup: no active connection found');
      }
    } catch (e) {
      console.warn('[INBOUND] Hangup error', e);
    }
    // Force the same UI cleanup path as a normal Twilio disconnect event so the
    // panel immediately enters visible 30s wrap instead of lingering on "Connecting".
    try {
      if (typeof (window as any).__onInboundDisconnected === 'function') {
        (window as any).__onInboundDisconnected();
      }
    } catch (e) {
      console.warn('[INBOUND] Hangup disconnect callback error', e);
    }
  }, [incomingConn]);

  // Mobile bridge: expose key state and handlers for ConnectMobile via window.__aoiMobile + custom event
  React.useEffect(() => {
    const mobileState = {
      availableLeads: dialerState.availableLeads,
      currentLeadIndex: dialerState.currentLeadIndex,
      dialingStatus: dialerState.dialingStatus,
      inboundCallInfo: dialerState.inboundCallInfo,
      inboundCallLead: dialerState.inboundCallLead,
      inboundPanelState,
      dailyStats,
      selectedDisposition: dialerState.selectedDisposition,
      dispositionApplied: dialerState.dispositionApplied,
      activeQueueTab,
      doubleDialMode,
    };
    (window as any).__aoiMobile = {
      state: mobileState,
      startDialing: handleStartDialing,
      handleDisposition: handleDispositionSelect,
      applyDisposition: handleApplyDisposition,
      completeAndContinue: handleCompleteCallThenRedialOrDialNext,
      previousLead: handlePreviousLead,
      nextLead: handleNextLead,
      queueSwitch: (q: 'hot' | 'plus') => handleQueueTabChange(q === 'hot' ? 'hotlead' : 'plus'),
      toggleDoubleDialMode: () => setDoubleDialMode((prev) => !prev),
      answerInbound: handleInboundPanelAnswer,
      rejectInbound: handleInboundPanelReject,
    };
    window.dispatchEvent(new CustomEvent('aoi-mobile-update', { detail: mobileState }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dialerState.availableLeads,
    dialerState.currentLeadIndex,
    dialerState.dialingStatus,
    dialerState.inboundCallInfo,
    dialerState.inboundCallLead,
    inboundPanelState,
    dailyStats,
    dialerState.selectedDisposition,
    dialerState.dispositionApplied,
    activeQueueTab,
    doubleDialMode,
  ]);

  // Show loading while checking disclaimer
  if (disclaimerLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Format timeout remaining time
  const formatTimeoutRemaining = (seconds: number): string => {
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 
        ? `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`
        : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`
      : `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  // Block access if disclaimer not accepted
  if (!disclaimerAccepted) {
    return (
      <div className="space-y-6 p-6">
        <div className="w-full border border-red-300 dark:border-red-700 rounded-lg overflow-hidden bg-red-50 dark:bg-red-950/20 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center justify-center text-center p-8">
            <Phone className="h-16 w-16 text-red-600 dark:text-red-400 mb-4" />
            <h3 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2">
              Disclaimer Required
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 max-w-md mb-4">
              You must accept the Call Connector Pro disclaimer before accessing the outbound dialer.
            </p>
            <Button
              onClick={() => setShowDisclaimer(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              Review Disclaimer
            </Button>
          </div>
        </div>

        {/* DISCLAIMER MODALS REMOVED - All users bypass disclaimers */}
      </div>
    );
  }
  
  return (
    <div className="space-y-4 md:space-y-6 w-full max-w-full overflow-x-hidden px-2">
      {/* AO Intel Startup Diagnostic Sequence — runs before dialer loads */}
      {!startupComplete && currentUserEmail && (
        <StartupSequence
          userEmail={currentUserEmail}
          onComplete={() => setStartupComplete(true)}
        />
      )}

      {/* 🎭 DEMO MODE Banner */}
      {isCCPDemo && (
        <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 rounded-lg p-4 text-white border-2 border-yellow-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <div>
                <h3 className="text-lg font-bold">DEMO MODE - Call Connector Pro</h3>
                <p className="text-sm text-yellow-100">This is a training demo. No real calls will be made.</p>
              </div>
            </div>
            <Button
              onClick={() => {
                // 🎭 DEMO MODE: Show certification if call was made
                if (demoCallStarted) {
                  setShowCertification(true);
                } else {
                  exitDemoMode();
                  if ((window as any).__demoExitHandler) {
                    (window as any).__demoExitHandler();
                  } else {
                    window.location.href = '/onboarding';
                  }
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
      
      {/* ⏸️ Timeout Banner */}
      {isTimedOut && (
        <div className="bg-gradient-to-r from-red-500 via-orange-500 to-red-600 rounded-lg p-4 text-white border-2 border-red-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏸️</span>
              <div>
                <h3 className="text-lg font-bold">Temporarily Paused</h3>
                <p className="text-sm text-red-100">
                  You've been temporarily paused due to unusual activity patterns.
                  {timeoutRemaining > 0 && (
                    <span> Timeout expires in {formatTimeoutRemaining(timeoutRemaining)}.</span>
                  )}
                  {timeoutStatus?.timeoutUntil && (
                    <span> Resumes at {new Date(timeoutStatus.timeoutUntil).toLocaleString()}.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs removed - showing dialer content directly for more space */}
      <div>
      {/* ── Search Modal ── */}
      <Dialog open={isSearchModalOpen} onOpenChange={(open) => { setIsSearchModalOpen(open); if (!open) { setSearchQuery(''); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Search input bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50/60 shrink-0">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <Input
              autoFocus
              type="text"
              placeholder="Search leads by name, phone, or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-base px-0 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {searchQuery.trim().length < 2 && (
              <p className="text-sm text-slate-400 text-center py-8">Type at least 2 characters to search…</p>
            )}
            {searchQuery.trim().length >= 2 && isSearching && (
              <p className="text-xs text-slate-500 py-3">Searching leads…</p>
            )}
            {searchQuery.trim().length >= 2 && !isSearching && searchError && (
              <p className="text-xs text-red-500 py-3">{searchError}</p>
            )}
            {searchQuery.trim().length >= 2 && !isSearching && !searchError && searchResults.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No matching leads found.</p>
            )}
            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((lead: any, idx: number) => {
                  const myLeadsQueueIndex = myLeadsQueue.findIndex((queueLead: any) =>
                    (lead.taalk_lead_id && queueLead?.taalk_lead_id === lead.taalk_lead_id) ||
                    (lead.id && queueLead?.id === lead.id) ||
                    (lead.phone && queueLead?.phone === lead.phone)
                  );
                  const plusQueueIndex = plusLeadsQueue.findIndex((queueLead: any) =>
                    (lead.taalk_lead_id && queueLead?.taalk_lead_id === lead.taalk_lead_id) ||
                    (lead.id && queueLead?.id === lead.id) ||
                    (lead.phone && queueLead?.phone === lead.phone)
                  );
                  const hotleadQueueIndex = hotleadQueue.findIndex((queueLead: any) =>
                    (lead.taalk_lead_id && queueLead?.taalk_lead_id === lead.taalk_lead_id) ||
                    (lead.id && queueLead?.id === lead.id) ||
                    (lead.phone && queueLead?.phone === lead.phone)
                  );
                  const derivedQueueType: 'hotlead' | 'my-leads' | 'plus' =
                    hotleadQueueIndex >= 0 ? 'hotlead' : myLeadsQueueIndex >= 0 ? 'my-leads' : plusQueueIndex >= 0 ? 'plus' : 'my-leads';
                  const queueIndex = hotleadQueueIndex >= 0 ? hotleadQueueIndex : myLeadsQueueIndex >= 0 ? myLeadsQueueIndex : plusQueueIndex >= 0 ? plusQueueIndex : -1;
                  const isHotLeadForAgent = (lead.cn_email || '').toLowerCase().trim() === (authState?.user?.email || '').toLowerCase().trim();
                  const badgeLabel = derivedQueueType === 'my-leads' ? (isHotLeadForAgent ? 'Hot Lead' : 'My Lead') : 'Plus Lead';
                  const badgeClasses = derivedQueueType === 'my-leads'
                    ? isHotLeadForAgent ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white border-2 border-orange-400 shadow-lg font-bold' : 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-emerald-100 text-emerald-600 border border-emerald-200';
                  return (
                    <Card
                      key={lead.id ?? lead.taalk_lead_id ?? lead.phone ?? idx}
                      className="cursor-pointer border-slate-200 hover:border-blue-400 hover:shadow-md transition-all"
                      onClick={() => {
                        handleSelectLeadFromList(
                          { ...lead, name: lead.name, taalk_lead_id: lead.taalk_lead_id, phone: lead.phone, state: lead.state, city: lead.city, market: lead.market, cnresolution: lead.cnresolution, associate_id: lead.associate_id },
                          queueIndex,
                          queueIndex >= 0 ? { queueType: derivedQueueType } : undefined
                        );
                        setIsSearchModalOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-semibold text-slate-800">{lead.name || 'Unknown Lead'}</CardTitle>
                          <Badge className={`text-xs font-semibold ${badgeClasses}`}>{badgeLabel}</Badge>
                        </div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          {queueIndex === -1 ? `Not in queue` : `Position ${queueIndex + 1} · ${derivedQueueType === 'hotlead' ? 'AO Queue' : derivedQueueType === 'my-leads' ? 'My Leads' : 'Plus'}`}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-600">
                        {(() => {
                          const isHotlead = lead.is_hot_lead || lead.isHotLead || lead.source_table === 'hotleads';
                          const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
                          const isCurrentLead = currentLead && ((lead.taalk_lead_id && currentLead.taalk_lead_id === lead.taalk_lead_id) || (lead.id && currentLead.id === lead.id) || (lead.phone && currentLead.phone === lead.phone));
                          const shouldReveal = !isHotlead || (isCurrentLead && dialerState.callDuration >= 110);
                          return shouldReveal ? (
                            <div className="flex flex-wrap gap-4">
                              <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{lead.phone || 'No phone'}</span>
                              <span className="flex items-center gap-1"><User className="h-4 w-4" />#{lead.id}</span>
                              {lead.taalk_lead_id && (
                                <span className="flex items-center gap-1 text-muted-foreground">AO Lead ID {lead.taalk_lead_id}</span>
                              )}
                            </div>
                          ) : null;
                        })()}
                        <div className="flex flex-wrap gap-4 text-xs uppercase tracking-wide text-slate-400">
                          {lead.state && <span>State: {lead.state}</span>}
                          {lead.city && <span>City: {lead.city}</span>}
                          {lead.associate_id && <span>Associate #{lead.associate_id}</span>}
                        </div>
                        {lead.cnresolution && <div className="text-xs text-slate-500">Last Disposition: {lead.cnresolution}</div>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SubscriptionUpgradeModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => {
          setSubscriptionModalOpen(false);
          setSelectedPlanForUpgrade(null);
        }}
        planOptions={planOptions}
        currentPlan={activePlan}
        initialPlan={selectedPlanForUpgrade}
        userEmail={authState?.user?.email ?? undefined}
        onCompleted={(_subscription) => {
          setSubscriptionModalOpen(false);
          setSelectedPlanForUpgrade(null);
          queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription/status'] });
          toast({
            title: 'Subscription Updated',
            description: 'Professional plan is now active.',
          });
        }}
      />

      {/* Split Layout: [Header + Lead Display + Controls] Left | [Inbound Panel] Right — tops aligned */}
      <div className="flex flex-col lg:flex-row gap-2 md:gap-3 items-start">
        {/* Left Side: Header bar on top, then Lead Display + CallControls below */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Header — top of left column, top aligns with inbound panel top */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-xl px-3 py-2.5 text-white w-full mb-2 shadow-lg shrink-0" style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-xl pointer-events-none" />
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center shrink-0">
                <CCProRankBadge />
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                <button
                  onClick={() => handleQueueTabChange('hotlead')}
                  disabled={callState === 'on-call'}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeQueueTab === 'hotlead' ? 'bg-white text-orange-600 shadow-md' : 'bg-white/15 border border-white/20 text-white hover:bg-white/25'} ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>AO Queue</span>
                  <span className="absolute -top-1.5 -right-1 bg-emerald-500 text-white text-[9px] font-black rounded-full min-h-[18px] px-1.5 flex items-center justify-center leading-none">
                    Synced
                  </span>
                </button>
                <button
                  onClick={() => handleQueueTabChange('plus')}
                  disabled={callState === 'on-call'}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeQueueTab === 'plus' ? 'bg-white text-emerald-600 shadow-md' : 'bg-white/15 border border-white/20 text-white hover:bg-white/25'} ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-[11px]">🟢</span>
                  <span>Plus</span>
                  {plusLeadsQueue.length > 0 && <span className="absolute -top-1.5 -right-1 bg-emerald-500 text-white text-[9px] font-black rounded-full min-h-[18px] min-w-[18px] px-1 flex items-center justify-center leading-none">{plusLeadsQueue.length}</span>}
                </button>
                <button type="button" onClick={() => setIsNewUserGuideOpen(true)} title="New User Guide" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-white/15 border border-white/20 text-white hover:bg-white/25 cursor-pointer">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Guide</span>
                </button>
                <div className="relative">
                  {showMarketNeedBubble && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-11 z-20">
                      <div className="relative whitespace-nowrap rounded-md border border-amber-200/70 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900 shadow-lg">
                        We need agents in these states!
                        <span className="absolute left-1/2 -bottom-1.5 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-r border-b border-amber-200/70 bg-amber-100" />
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMarketNeedBubble(false);
                      setIsMarketNeedOpen(true);
                    }}
                    title="Market Need!"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      userEmail
                        ? 'bg-amber-400/30 border-amber-200/60 text-amber-50 hover:bg-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.55)] animate-pulse'
                        : 'bg-amber-500/20 border-amber-300/40 text-amber-100 hover:bg-amber-500/30'
                    } cursor-pointer`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Market Need!</span>
                  </button>
                </div>
                <button type="button" onClick={() => setIsSearchModalOpen(true)} disabled={callState === 'on-call'} title="Search leads" className={`flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 border border-white/20 text-white hover:bg-white/25 transition-all ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCalendarPanel(true)}
                  title="My Appointments"
                  className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 border border-white/20 text-white hover:bg-white/25 transition-all cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {dialerGate.softReminder.length > 0 && (
                    <span className="absolute -top-1.5 -right-1 bg-amber-500 text-white text-[9px] font-black rounded-full min-h-[15px] min-w-[15px] px-0.5 flex items-center justify-center leading-none">
                      {dialerGate.softReminder.length}
                    </span>
                  )}
                </button>
                {!document.getElementById('aoi-present-portal') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPresentMode(true);
                      setWherebyFloating(true);
                      if (!wherebyRoom && !wherebyCreating && currentUserEmail) {
                        setWherebyCreating(true);
                        fetch('/api/whereby/create-meeting', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            agentEmail: currentUserEmail,
                            leadName: getCurrentLead()?.name || 'Guest',
                            leadId: String(getCurrentLead()?.id || ''),
                          }),
                        })
                          .then((r) => r.json())
                          .then((d: any) => {
                            if (d.success && d.roomUrl) {
                              setWherebyRoom({
                                roomUrl: d.roomUrl,
                                hostRoomUrl: d.hostRoomUrl || d.roomUrl,
                                joinLink: d.roomUrl,
                              });
                            }
                          })
                          .catch(console.error)
                          .finally(() => setWherebyCreating(false));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${presentMode ? 'bg-amber-500 border-amber-400 text-white' : 'bg-white/20 border-white/30 text-white hover:bg-white/30'}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Present
                  </button>
                )}
                {queueDebugEnabled && (
                  <div className="ml-2 px-2 py-1 rounded bg-black/30 text-[9px] font-mono text-white/90 border border-white/20">
                    {`DBG api=${lastApiLeadCount} np=${lastApiNonPendingCount} no=${lastApiNonOwnedCount} hot=${hotleadQueue.length} plus=${plusLeadsQueue.length} my=${myLeadsQueue.length} avail=${dialerState.availableLeads.length} tab=${activeQueueTab}`}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Customer info tile with call controls footer attached to bottom */}
          <div className="flex flex-col">

            <LeadDisplay
                state={dialerState}
                callDurationSeconds={callDurationSeconds}
                isStarterPlan={shouldGateOutbound}
                onUpgrade={() => handleCheckout('professional')}
                upgradePlan={professionalPlan}
                onUndo={handleUndo}
                canUndo={!!undoState && dialerState.dispositionApplied}
                activeQueueTab={activeQueueTab}
                displayLeadCount={
                  activeQueueTab === 'hotlead'
                    ? hotleadQueue.length
                    : activeQueueTab === 'plus'
                      ? plusLeadsQueue.length
                      : myLeadsQueue.length
                }
                onRefetchLeads={loadQueue}
                onIgniteQueue={handleConnectIgniteQueue}
                forceLead={dialerState.webRTCConferenceActive && (dialerState.inboundCallLead || dialerState.inboundCallInfo) ? getCurrentLead() ?? null : undefined}
              />
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-2 sm:p-3 bg-white dark:bg-gray-900">
              <CallControls
                selectedDisposition={dialerState.selectedDisposition}
                dispositionApplied={dialerState.dispositionApplied}
                onApplyDisposition={handleApplyDisposition}
                onUndo={handleUndo}
                canUndo={!!undoState && dialerState.dispositionApplied}
                state={dialerState}
                vdpOnline={vdpOnline}
                currentLead={getCurrentLead()}
                onStartCall={() => dialLead()}
                onEndCall={handleEndCall}
                onSkipLead={handleSkipLead}
                onPowerToggle={handlePowerToggle}
                duplicateSession={duplicateSession}
                micIssue={hasMicIssue}
                webRtcReady={confirmedWebRtcReady}
                onDispositionSelect={handleDispositionSelect}
                onPauseDialing={handlePauseDialing}
                onStartDialing={handleStartDialing}
                onCompleteCall={handleCompleteCall}
                onDialNextLead={handleDialNextLead}
                onRedial={handleRedial}
                onCompleteAndContinue={handleCompleteCallThenRedialOrDialNext}
                doubleDialMode={doubleDialMode}
                onDoubleDialModeChange={setDoubleDialMode}
                completeNextIsRedial={doubleDialMode ? doubleDialNextIsRedial : false}
                completeCooldownSeconds={completeCallCooldownSeconds}
                onPreviousLead={handlePreviousLead}
                onNextLead={handleNextLead}
                userEmail={authState?.user?.email}
                callDurationSeconds={callDurationSeconds > 0 ? callDurationSeconds : finalCallDuration}
                dailyStats={dailyStats}
                hasRecentCall={getCurrentLead()?.hasRecentCall || false}
                onQueueModeChange={setQueueMode}
                queueMode={queueMode}
              />
            </div>
          </div>
        </div>

        {/* Right Side: VDP panel (Online/Offline + caller info in one card) – full height to base of left tile */}
        <div className="flex flex-shrink-0 gap-3 w-full lg:w-auto">
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col gap-3">

            <div className="flex-1 min-h-0 flex flex-col">
              {startupComplete ? (
              <VDPStatus
                userEmail={currentUserEmail ?? ''}
                user={null}
                title="ConnectNow"
                cardClassName=""
                titleClassName=""
                hideProducerRow={false}
                compact
                panelVariant={useNewVdpPanel ? 'new' : 'legacy'}
                onVDPStatusChange={handleVDPStatusChange}
                demoInjecting={demoInjecting}
                defaultOnline={startOnlineByDefault}
                vdpToggleRef={vdpToggleRef}
              >
                <InboundCallHeaderPanel
                state={inboundPanelState}
                wrapSecondsLeft={inboundPanelState === 'wrapping' ? wrapSecondsLeft : undefined}
                incomingConn={incomingConn}
                lead={inboundPanelLead}
                queuePosition={inboundQueuePosition}
                queueMarket={
                  typeof vdpData?.market === 'string'
                    ? vdpData.market
                    : Array.isArray(vdpData?.market)
                      ? vdpData.market[0]
                      : undefined
                }
                totalInMarket={inboundQueueTotalEligible > 0 ? inboundQueueTotalEligible : undefined}
                onAnswer={handleInboundPanelAnswer}
                onReject={handleInboundPanelReject}
                onHangup={handleInboundPanelHangup}
                onCompleteCall={() => { void handleCompleteCall(); }}
                hasDisposition={!inboundDispositionRequired || dialerState.dispositionApplied || !!dialerState.selectedDisposition}
                selectedDisposition={dialerState.selectedDisposition}
                dispositionApplied={dialerState.dispositionApplied}
                onDispositionSelect={inboundDispositionRequired ? handleDispositionSelect : undefined}
                onApplyDisposition={inboundDispositionRequired ? (() => { void handleApplyDisposition(); }) : undefined}
                answering={answering}
                dailyStats={dailyStats ?? undefined}
                charge={inboundCharge}
                connectionType={inboundConnectionType}
                reservationCreatedAt={activeTaskRouterPending?.createdAt ?? incomingRingStartedAt ?? undefined}
                variant="vertical"
                vdpOnline={vdpOnline}
                answerRequestedRef={inboundAnswerRequestedRef}
                successViewerRefetchRef={successViewerRefetchRef}
                onFindOutMore={() => setShowInboundExplainerModal(true)}
                walletBalanceDollars={walletBalanceDollars}
                backupBillingEnabled={backupBillingEnabled}
                backupBillingLoading={backupBillingLoading}
                onBackupBillingToggle={handleBackupBillingToggle}
                cardDisplay={null}
                showBackupBillingCard={true}
                ringerMuted={inboundRingerMuted}
                onRingerMuteToggle={handleRingerMuteToggle}
                webRTCOffForAccept={inboundPanelState === 'ringing' && !isPoweredOn}
                agentStatus={vdpOnline ? 'online' : agentAwayMode ? 'away' : 'offline'}
                onAgentStatusChange={handleAgentStatusChange}
                producerAssociateId={vdpData?.associate_id}
                producerMarket={vdpData?.market}
                producerStates={vdpData?.states}
              />
              {lastPendingPollAt != null && (
                <div className="text-[10px] text-white/40 mt-1" title="Inbound: polling /api/twilio/taskrouter/pending every 1s">
                  Checking for calls · last {Math.round((Date.now() - lastPendingPollAt) / 1000)}s ago
                </div>
              )}
              </VDPStatus>
              ) : currentUserEmail ? (
                <div
                  className="flex-1 min-h-[280px] rounded-2xl border border-white/10 bg-black flex flex-col items-center justify-center p-6 text-center"
                  aria-hidden
                >
                  <p className="text-sm text-white/55 max-w-[240px]">
                    Finish AO Intel diagnostics above. Taalk VDP will load here right after.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* AOI Present Overlay - Portal so it renders above everything */}
      {presentMode && createPortal(
        <div
          id='aoi-present-portal'
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'transparent',
            pointerEvents: 'none',
          }}
        >
          {/* Shell: Whereby strip is a sibling above HPPRO — not inside the HPPRO iframe (avoids cross-origin / overlap issues). */}
          <div
            style={{
              position: 'absolute',
              left: presentPanelPos.x,
              top: presentPanelPos.y,
              width: 'min(1280px, 92vw)',
              height: 'min(840px, 84vh)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 12,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              pointerEvents: aoiAppModalOpen ? 'none' : 'auto',
              background: '#0f172a',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onMouseDown={(e) => {
                if ((e.target as HTMLElement)?.closest('button')) return;
                presentPanelDragRef.current.dragging = true;
                presentPanelDragRef.current.offsetX = e.clientX - presentPanelPos.x;
                presentPanelDragRef.current.offsetY = e.clientY - presentPanelPos.y;
              }}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'linear-gradient(to right,#3b82f6,#7c3aed,#3b82f6)',color:'white',flexShrink:0,gap:8,cursor:'move',userSelect:'none'}}
            >
              <span style={{fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <span>🎯</span> HPPRO Presentation
                <span style={{fontSize:10,opacity:0.65,fontWeight:400,marginLeft:4}}>Drag header to move panel</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {wherebyRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      const lead = getCurrentLead();
                      setShareClientName((lead?.name || '').trim() || 'Client');
                      setSharePhone((lead?.phone || '').trim());
                      setShareEmail(
                        String((lead as any)?.email || (lead as any)?.taalk_email || '')
                          .trim(),
                      );
                      setPresentShareModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="Open share dialog — SMS or email the Whereby link to any number or address"
                  >
                    📤 Share link
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!wherebyRoom && !wherebyCreating) {
                      setWherebyCreating(true);
                      setWherebyFloating(true);
                      fetch('/api/whereby/create-meeting', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          agentEmail: currentUserEmail,
                          leadName: getCurrentLead()?.name || 'Guest',
                          leadId: String(getCurrentLead()?.id || ''),
                        }),
                      })
                        .then((r) => r.json())
                        .then((d: any) => {
                          if (d.success && d.roomUrl) {
                            setWherebyRoom({ roomUrl: d.roomUrl, hostRoomUrl: d.hostRoomUrl || d.roomUrl, joinLink: d.roomUrl });
                          }
                        })
                        .catch(console.error)
                        .finally(() => setWherebyCreating(false));
                    } else {
                      setWherebyFloating((w: boolean) => !w);
                    }
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: wherebyFloating && wherebyRoom ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
                    color: wherebyFloating && wherebyRoom ? '#1d4ed8' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  {wherebyCreating ? 'Creating...' : wherebyRoom ? (wherebyFloating ? 'Hide Video' : 'Show Video') : 'Start Video'}
                </button>
                <button type="button" onClick={() => closePresentMode('header-close')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close presentation">✕</button>
              </div>
            </div>
            {/* Whereby: draggable floating panel above HPPRO */}
            {wherebyFloating && wherebyRoom && (
              <DraggableWherebyPanel
                roomUrl={wherebyRoom.hostRoomUrl}
                displayName={(currentUserEmail || '').split('@')[0] || 'Agent'}
                onClose={() => setWherebyFloating(false)}
              />
            )}
            {/* HPPRO via app proxy.
                Login shell pulls legacy bundles that 404 in proxy mode; use SPA StartPresentation entrypoint.
                Disable iframe hit-testing while AOI modal is open so clicks cannot be swallowed by iframe compositing. */}
            <iframe
              src="/api/hppro/#/StartPresentation"
              style={{ flex: 1, width: '100%', border: 'none', minHeight: 0, pointerEvents: aoiAppModalOpen ? 'none' : 'auto' }}
              allow="camera; microphone; fullscreen"
              title="HPPRO presentation"
            />
          </div>
        </div>
      , document.body)}

      {/* AOI Application — floating modal over HPPRO presentation */}
      {aoiAppModalOpen && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 12px', overflowY: 'auto', pointerEvents: 'auto' }}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            // Guard against immediate reopen/close race from bubbling pointer events.
            if (Date.now() - aoiModalOpenedAtRef.current < 900) return;
            closeAoiAppModal();
          }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: 680, background: '#0f172a', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', minHeight: 200, pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'linear-gradient(to right,#0891b2,#0e7490)', borderRadius: '16px 16px 0 0' }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>📋 AOI Application</span>
              <button type="button" onClick={closeAoiAppModal}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 60px)' }}>
              <Suspense fallback={<div style={{ color: '#22d3ee', padding: 40, textAlign: 'center' }}>Loading…</div>}>
                <ApplicationPage />
              </Suspense>
            </div>
          </div>
        </div>
      , document.body)}

      {/* HPPRO Present: share Whereby join link — any phone/email (z above present overlay) */}
      <Dialog open={presentShareModalOpen} onOpenChange={setPresentShareModalOpen}>
        <DialogContent
          overlayClassName="z-[100001]"
          className="z-[100002] sm:max-w-md border-slate-700 bg-slate-900 text-slate-100 shadow-2xl [&>button]:text-slate-400"
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">Share meeting link</DialogTitle>
            <p className="text-xs font-normal text-slate-400 pt-1 leading-snug">
              Send the client Whereby join link by SMS (Zapier) or email (Mailgun). Edit any field — you do not need a lead on screen.
            </p>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label htmlFor="present-share-name" className="text-slate-300 text-xs">
                Client name (for greeting)
              </Label>
              <Input
                id="present-share-name"
                value={shareClientName}
                onChange={(e) => setShareClientName(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-600 text-slate-100 placeholder:text-slate-500"
                placeholder="e.g. Jane Smith"
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="present-share-phone" className="text-slate-300 text-xs">
                Phone (SMS)
              </Label>
              <Input
                id="present-share-phone"
                value={sharePhone}
                onChange={(e) => setSharePhone(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-600 text-slate-100 placeholder:text-slate-500"
                placeholder="Any number — 10 digits or +1…"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <div>
              <Label htmlFor="present-share-email" className="text-slate-300 text-xs">
                Email
              </Label>
              <Input
                id="present-share-email"
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="mt-1 bg-slate-950 border-slate-600 text-slate-100 placeholder:text-slate-500"
                placeholder="client@example.com"
                autoComplete="email"
              />
            </div>
            {wherebyRoom && (
              <div className="rounded-md border border-slate-600 bg-slate-950/90 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Client join URL</p>
                <p className="text-xs text-cyan-400 break-all leading-relaxed">
                  {wherebyRoom.roomUrl || wherebyRoom.joinLink}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-600"
                  disabled={!wherebyRoom?.roomUrl && !wherebyRoom?.joinLink}
                  onClick={async () => {
                    const url = wherebyRoom?.roomUrl || wherebyRoom?.joinLink;
                    if (!url) return;
                    try {
                      await navigator.clipboard.writeText(url);
                      toast({ title: 'Copied', description: 'Join link copied to clipboard.' });
                    } catch {
                      toast({ title: 'Copy failed', description: 'Could not access clipboard.', variant: 'destructive' });
                    }
                  }}
                >
                  Copy link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  disabled={shareSendingSms || !wherebyRoom}
                  onClick={async () => {
                    const meetingUrl = wherebyRoom!.roomUrl || wherebyRoom!.joinLink;
                    const raw = sharePhone.trim();
                    const digits = raw.replace(/\D/g, '');
                    const phoneNumber =
                      digits.length === 11 && digits.startsWith('1')
                        ? digits
                        : digits.length === 10
                          ? `1${digits}`
                          : raw;
                    if (!phoneNumber) {
                      toast({
                        title: 'Enter a phone number',
                        description: 'Type the number to SMS, or paste 10 digits.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    const leadName = (shareClientName || 'Client').trim() || 'Client';
                    const agentLocal = (currentUserEmail || 'producer').split('@')[0];
                    const agentName = agentLocal ? agentLocal.replace(/[._-]/g, ' ') : 'producer';
                    setShareSendingSms(true);
                    try {
                      const r = await fetch('/api/whereby/send-sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phoneNumber, leadName, agentName, meetingUrl }),
                      });
                      const text = await r.text();
                      let j: Record<string, string> = {};
                      try {
                        j = JSON.parse(text) as Record<string, string>;
                      } catch {
                        /* ignore */
                      }
                      if (!r.ok) throw new Error(j?.error || j?.details || text || r.statusText);
                      toast({ title: 'SMS sent', description: `Invite sent to ${raw || phoneNumber}.` });
                    } catch (err: any) {
                      toast({ title: 'SMS failed', description: err?.message || 'Could not send SMS.', variant: 'destructive' });
                    } finally {
                      setShareSendingSms(false);
                    }
                  }}
                >
                  {shareSendingSms ? 'Sending…' : 'Send SMS'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-500 text-slate-100 bg-transparent hover:bg-slate-800"
                  disabled={shareSendingEmail || !wherebyRoom}
                  onClick={async () => {
                    const meetingUrl = wherebyRoom!.roomUrl || wherebyRoom!.joinLink;
                    const to = shareEmail.trim().toLowerCase();
                    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
                      toast({
                        title: 'Enter a valid email',
                        description: 'Type the address to send the meeting link.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    const leadName = (shareClientName || 'Client').trim() || 'Client';
                    const agentLocal = (currentUserEmail || 'producer').split('@')[0];
                    const agentName = agentLocal ? agentLocal.replace(/[._-]/g, ' ') : 'producer';
                    setShareSendingEmail(true);
                    try {
                      const r = await fetch('/api/whereby/send-meeting-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to, leadName, agentName, meetingUrl }),
                      });
                      const text = await r.text();
                      let j: Record<string, string> = {};
                      try {
                        j = JSON.parse(text) as Record<string, string>;
                      } catch {
                        /* ignore */
                      }
                      if (!r.ok) throw new Error(j?.error || j?.details || text || r.statusText);
                      toast({ title: 'Email sent', description: `Meeting link sent to ${to}.` });
                    } catch (err: any) {
                      toast({ title: 'Email failed', description: err?.message || 'Could not send email.', variant: 'destructive' });
                    } finally {
                      setShareSendingEmail(false);
                    }
                  }}
                >
                  {shareSendingEmail ? 'Sending…' : 'Send email'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop App Modal - DISABLED - using Chrome browser only */}
      {/* <DesktopAppModal 
        isOpen={showDesktopAppModal}
        onClose={() => setShowDesktopAppModal(false)}
      /> */}

      {/* Inbound: no popup - answer/decline from header; full lead + disposition in main view. */}

      {/* Keyboard Shortcuts Help Modal */}
      <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
        <DialogContent className="max-w-md [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <DialogTitle className="flex items-center gap-2">
                ⌨️ Keyboard Shortcuts
              </DialogTitle>
              <DialogClose asChild>
                <button
                  onClick={() => setShowKeyboardHelp(false)}
                  className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Movement</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">W</kbd>
                    <span className="text-xs">Power Toggle</span>
                  </div>
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">S</kbd>
                    <span className="text-xs">Stop/Complete</span>
                  </div>
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">A</kbd>
                    <span className="text-xs">Previous Lead</span>
                  </div>
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">D</kbd>
                    <span className="text-xs">Next Lead</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">Actions</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Q</kbd>
                    <span className="text-xs">Start Dialing</span>
                  </div>
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">E</kbd>
                    <span className="text-xs">Complete & Dial Next</span>
                  </div>
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">R</kbd>
                    <span className="text-xs">Redial Same Lead</span>
                  </div>
                  <div className="flex justify-between">
                    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">?</kbd>
                    <span className="text-xs">Show Help</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded">
              <strong>Tip:</strong> Shortcuts work when not typing in input fields. Navigate leads like an MMORPG!
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Modal */}
      {isVideoModalOpen && videoModalLead && (
        <VideoCallModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          currentLead={videoModalLead}
          userEmail={authState.user?.email}
        />
      )}

      {/* Inbound Transfers Explainer Modal */}
      <InboundTransfersExplainerModal
        isOpen={showInboundExplainerModal}
        onClose={() => setShowInboundExplainerModal(false)}
        userEmail={authState?.user?.email}
      />

      {/* DISABLED: New Leads Notification */}
      {/* {showNewLeadsNotification && (
        <NewLeadsNotification
          previousLeadCount={previousLeadCountRef.current || dialerState.availableLeads.length}
          currentLeadCount={dialerState.availableLeads.length > previousLeadCountRef.current ? dialerState.availableLeads.length : previousLeadCountRef.current + Math.floor(Math.random() * 20) + 1}
          onDismiss={() => {
            setShowNewLeadsNotification(false);
            // Reset ref after dismissing
            previousLeadCountRef.current = dialerState.availableLeads.length;
          }}
        />
      )} */}

      {/* Demo Certification Modal */}
      {isCCPDemo && (
        <DemoCertificationModal
          isOpen={showCertification}
          onCertify={() => {
            setShowCertification(false);
            setDemoCallStarted(false);
            exitDemoMode();
            toast({
              title: 'Demo Certified',
              description: 'Thank you for completing the demo certification.',
              duration: 3000,
            });
            if ((window as any).__demoExitHandler) {
              (window as any).__demoExitHandler();
            } else {
              window.location.href = '/onboarding';
            }
          }}
          onCancel={() => {
            setShowCertification(false);
            // User canceled certification, still allow exit
            exitDemoMode();
            if ((window as any).__demoExitHandler) {
              (window as any).__demoExitHandler();
            } else {
              window.location.href = '/onboarding';
            }
          }}
          demoType="callconnector"
        />
      )}

      {/* 🍎 MAC ELECTRON: Microphone Permission Recovery Modal */}
      {showMicRecoveryModal && (
        <MicrophonePermissionRecoveryModal
          open={showMicRecoveryModal}
          onOpenChange={setShowMicRecoveryModal}
        />
      )}

      {/* DISCLAIMER MODAL REMOVED - All users bypass disclaimers */}

      {/* New User Guide Modal */}
      <NewUserGuideModal
        isOpen={isNewUserGuideOpen}
        onClose={() => setIsNewUserGuideOpen(false)}
      />

      <MarketNeedModal
        isOpen={isMarketNeedOpen}
        onClose={() => setIsMarketNeedOpen(false)}
      />

      {/* ── Soft Reminder Banner: appointments awaiting outcome ──────────── */}
      {dialerGate.softReminder.length > 0 && !softReminderDismissed && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/80 text-amber-800 dark:text-amber-100 text-sm font-medium max-w-md"
          style={{ animation: 'fadeInDown 0.3s ease' }}
        >
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            You have {dialerGate.softReminder.length} appointment{dialerGate.softReminder.length !== 1 ? 's' : ''} awaiting outcome.
          </span>
          <button
            className="underline font-semibold ml-1 hover:text-amber-600"
            onClick={() => setOutcomeModalOpen(true)}
          >
            Resolve Now
          </button>
          <button
            className="ml-auto text-amber-500 hover:text-amber-700"
            onClick={() => setSoftReminderDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Appointment Booking Modal ─────────────────────────────────────── */}
      {bookingModalOpen && bookingLead && bookingAgentInfo && (
        <AppointmentBookingModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          dispositionSource={bookingDispositionSource}
          lead={bookingLead}
          agent={bookingAgentInfo}
          onBooked={() => {
            dialerGate.refetch();
            window.dispatchEvent(new CustomEvent('aoirail-open-calendar'));
          }}
        />
      )}

      {/* ── Appointment Outcome Modal (soft/hard gate) ────────────────────── */}
      {outcomeModalOpen && (
        <AppointmentOutcomeModal
          isOpen={outcomeModalOpen}
          onClose={() => { setOutcomeModalOpen(false); dialerGate.refetch(); }}
          appointments={[...dialerGate.overdueAppointments, ...dialerGate.softReminder]}
          onOutcomeSaved={() => { dialerGate.refetch(); setSoftReminderDismissed(false); }}
        />
      )}

      </div>{/* closes space-y-4 md:space-y-6 content wrapper */}
    </div>
  );
}

