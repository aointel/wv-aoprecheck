import { Device as TwilioDevice } from '@twilio/voice-sdk';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiTarget, FiTrendingUp, FiClock, FiZap, FiMonitor, FiStar } from 'react-icons/fi';
import { CheckCircle, Phone, Calendar, Clock, MapPin, User, Search, Filter, X, Mail, Eye, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCallConnectorActivity } from '@/hooks/use-call-connector-activity';
import { callTrackingClient } from '@/lib/call-tracking-client';
import { apiRequest, segmentedFetch } from '@/lib/queryClient';
import { masterleadUpdateResolution } from '@/lib/masterlead-api';
import { resolveServiceUrl } from '@/lib/service-routing';
import { useDemo } from '@/contexts/DemoContext';
import { DesktopAppModal } from '@/components/DesktopAppModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { VideoCallModal } from './VideoCallModal';
import { SubscriptionUpgradeModal } from '@/components/stripe/SubscriptionUpgradeModal';
import { updateMasterleadLastContacted } from '@/lib/masterlead-tracking';
import { DemoCertificationModal } from '@/components/connectnow/DemoCertificationModal';
import { updateAllLeadLastContacted } from '@/lib/hotlead-tracking';
import { PricingHoverCard } from '@/components/pricing/PricingHoverCard';
import { MicrophonePermissionRecoveryModal } from '@/components/MicrophonePermissionRecoveryModal';
// DISCLAIMER MODAL REMOVED - All users bypass disclaimers
// import { CallConnectorProDisclaimerModal } from '@/components/modals/CallConnectorProDisclaimerModal';
import { Loader2 } from 'lucide-react';
import { getRestoredPosition, savePositionWithTTL } from './position-ttl';
import { fetchTwilioVoiceToken } from '@/utils/webrtc-endpoints';
import type { RecruitCandidate } from '@shared/schema';
import { SMSMessengerModal } from '../recruit/SMSMessengerModal';
import { AppointmentScheduleModal } from '../recruit/AppointmentScheduleModal';
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
    refetchInterval: 30000,
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
    console.log(`🔄 ${action} requested for appointment:`, appointment);
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

// FTC Compliance function for frontend filtering
const isCallPermissibleFrontend = (leadState: string, ftcRestricted?: string): boolean => {
  // Check ftcrestricted column first - if NO, allow call anytime
  if (ftcRestricted === 'NO' || ftcRestricted === 'no' || ftcRestricted === 'N') {
    console.log(`✅ FRONTEND FTC: Lead has ftcrestricted=NO - allowing call anytime`);
    return true;
  }
  
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
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const currentMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // FTC allows 8 AM (480 minutes) to 9 PM (1260 minutes)
    const isPermissible = currentTimeInMinutes >= 480 && currentTimeInMinutes <= 1260;

    if (!isPermissible) {
      console.log(`🚫 FRONTEND FTC: ${leadState} not callable at ${currentHour}:${String(currentMinute).padStart(2, '0')} (${timezone})`);
    }

    return isPermissible;
  } catch (error) {
    console.error('❌ Frontend FTC error:', error);
    return false;
  }
};

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
    console.log('🎤 Requesting microphone permission...');
    
    // 🍎 MAC ELECTRON: Request system-level permission via IPC first
    if (isMac() && (window as any).electronAPI?.requestMicrophonePermission) {
      console.log('🍎 Mac Electron detected - requesting system microphone permission via IPC...');
      try {
        const electronResult = await (window as any).electronAPI.requestMicrophonePermission();
        console.log('🍎 Mac Electron IPC result:', electronResult);
        if (!electronResult.success && !electronResult.alreadyGranted) {
          return { 
            success: false,
            needsRecovery: true,
            error: electronResult.error || 'System microphone permission denied. Please allow in System Preferences > Security & Privacy > Microphone.' 
          };
        }
        console.log('✅ Mac Electron: System microphone permission granted');
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
    
    console.log('✅ Microphone permission granted, stream active:', stream.active);
    
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
      console.log('🛑 Microphone stream stopped (permission obtained)');
      return { success: true };
    } else {
      // Keep stream active for Mac - caller must stop it after device.register()
      console.log('🍎 Mac: Keeping microphone stream active for device registration');
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

const powerOnWebRTC = async (identity = "producer123", agentEmail?: string, macMicrophoneStream?: MediaStream) => {
  console.log("🟢 ENTERED powerOnWebRTC()");
  let activeMicrophoneStream: MediaStream | null =
    macMicrophoneStream || (window as any).__micStream || (window as any).__webrtcMicStream || null;
  
  // 🍎 MAC-SPECIFIC: On Mac, microphone permission should already be requested in click handler
  // The stream is passed in to keep it active during registration
  if (isMac() && macMicrophoneStream) {
    console.log('🍎 Mac: Using microphone stream from click handler, keeping active during registration');
  } else if (isMac() && !macMicrophoneStream) {
    // Fallback: Request permission here if not already requested
    console.log('🍎 Mac detected - requesting microphone permission (fallback)...');
    const micResult = await requestMicrophonePermission(true);
    if (!micResult.success) {
      throw new Error(micResult.error || 'Microphone permission denied');
    }
    if (micResult.stream) {
      macMicrophoneStream = micResult.stream;
      activeMicrophoneStream = micResult.stream;
    }
  }
  
  try {
    // Check if Twilio SDK is loaded first
    if (typeof (window as any).Twilio === "undefined") {
      console.error("❌ Twilio SDK not loaded - checking script tags...");
      const scripts = Array.from(document.scripts).map(s => s.src).filter(s => s.includes('twilio'));
      console.log("📜 Twilio scripts found:", scripts);
      throw new Error("Twilio SDK not loaded - make sure script tag is present");
    }

    console.log("✅ Twilio SDK found:", typeof (window as any).Twilio);

    // Get user email from agentEmail parameter or localStorage
    let userEmail = agentEmail;
    if (!userEmail) {
      try {
        const storedUser = localStorage.getItem('current_producer');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email;
        }
      } catch (e) {
        console.warn('Could not get email from localStorage:', e);
      }
    }

    if (!userEmail) {
      throw new Error('User email not found. Please log in again.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (userEmail) {
      headers['x-user-email'] = userEmail;
      console.log('🔑 [WebRTC] Sending x-user-email header:', userEmail);
    } else {
      console.error('❌ [WebRTC] No userEmail to send in header!');
    }

    // Get correct endpoint based on platform
    const { getTwilioTokenEndpoint, isElectron } = await import('../../utils/webrtc-endpoints');
    const tokenEndpoint = getTwilioTokenEndpoint();
    if (isElectron()) {
      headers['x-desktop-app'] = 'true';
    }
    console.log(`🔑 [WebRTC] Using endpoint: ${tokenEndpoint}`);
    console.log('🔑 [WebRTC] Fetch headers:', headers);

    const res = await fetch(tokenEndpoint, {
      method: 'GET',
      credentials: 'include', // CRITICAL: Always send cookies
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.error || "Login required to get token");
    }
    const tokenData = await res.json();
    const token = tokenData.token;

    if (!token || token.length < 100) {
      throw new Error("Received invalid token");
    }

    console.log('🎤 [WEBRTC DEBUG] Explicitly requesting microphone (required for ready state)');
    const hasUsableActiveStream = !!(
      activeMicrophoneStream &&
      activeMicrophoneStream.active &&
      activeMicrophoneStream.getAudioTracks().some((track) => track.readyState === 'live')
    );

    if (!hasUsableActiveStream) {
      activeMicrophoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      console.log('✅ [WEBRTC DEBUG] Microphone stream acquired and retained');
    } else {
      console.log('✅ [WEBRTC DEBUG] Reusing active microphone stream');
    }

    (window as any).__micStream = activeMicrophoneStream;
    (window as any).__webrtcMicStream = activeMicrophoneStream;

    console.log("🔑 Got token:", token.slice(0, 40), "...");
    console.log("🔑 Token length:", token.length, "characters");

    console.log("🚀 Creating Twilio Device...");
    device = new TwilioDevice(token, { debug: true });
    (window as any).twilioDevice = device; // Make device accessible to volume control

    device.on("ready", () => {
      console.log("✅ Twilio device ready - SESSION ESTABLISHED");
      
      // CRITICAL: Update agent_live_call_status in Supabase when CCPro device becomes ready
      if (agentEmail) {
        fetch('/agent/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_email: agentEmail,
            status: 'ready'
          })
        }).then(() => {
          console.log(`✅ CCPro DEVICE READY: Updated agent_live_call_status for ${agentEmail}`);
        }).catch((error) => {
          console.error('❌ Failed to update agent_live_call_status:', error);
        });
      }
    });

    device.on("error", (error: any) => {
      console.error("❌ Twilio.Device error:", error);
    });

    device.on("connect", () => {
      console.log("📞 WebRTC connected");
    });

    device.on("disconnect", () => {
      console.log("🔌 WebRTC disconnected - KEEPING DEVICE ACTIVE");
      // Don't destroy device, keep it ready for next call
    });

    device.on("registering", () => {
      console.log("📡 Registering with Twilio servers...");
    });

    device.on("registered", () => {
      console.log("✅ Successfully registered with Twilio servers");
    });

    device.on("unregistered", () => {
      console.log("❌ Unregistered from Twilio servers - attempting to re-register...");
      // Auto re-register if device was powered on
      if (device && typeof device.register === 'function') {
        setTimeout(() => {
          try {
            device.register();
            console.log("🔄 Auto re-registration attempted");
          } catch (err) {
            console.error("❌ Auto re-registration failed:", err);
          }
        }, 1000);
      }
    });

    device.on("cancel", () => {
      console.log("🚫 Call was cancelled");
    });

    device.on("incoming", (conn: any) => {
      console.log("📞 Incoming call received");
    });

    // CRITICAL: Actually register the device to establish session
    // 🍎 MAC-SPECIFIC: On Mac, use the stream from click handler or request new one
    let activeMacStream: MediaStream | null = activeMicrophoneStream || macMicrophoneStream || null;
    
    if (isMac() && !activeMacStream) {
      // Fallback: Get stream from global storage (set in click handler)
      activeMacStream = (window as any).__macMicrophoneStream || null;
      if (activeMacStream) {
        console.log('🍎 Mac: Using microphone stream from click handler');
      } else {
        console.log('🍎 Mac: Requesting microphone permission before device.register() (fallback)...');
        const micResult = await requestMicrophonePermission(true); // Keep stream active for Mac
        if (!micResult.success) {
          console.error('❌ Microphone permission denied before device.register()');
          throw new Error(micResult.error || 'Microphone permission denied - cannot register device');
        }
        activeMacStream = micResult.stream || null;
      }
    }

    console.log("📡 Calling device.register() to establish session...");

    try {
      device.register();
      
      // 🍎 MAC-SPECIFIC: On Mac, wait for device to become ready, then stop the stream
      if (isMac() && activeMacStream) {
        // Wait for device.ready event, then stop stream
        device.once('ready', () => {
          setTimeout(() => {
            console.log('🍎 Mac: Device ready, stopping microphone stream');
            activeMacStream?.getTracks().forEach(track => track.stop());
            (window as any).__micStream = null;
            (window as any).__webrtcMicStream = null;
            (window as any).__macMicrophoneStream = null; // Clear global reference
          }, 1000); // Give device time to fully initialize
        });
      }
    } catch (registerError) {
      console.error("❌ Registration failed immediately:", registerError);
      // Stop stream on error
      if (activeMacStream) {
        activeMacStream.getTracks().forEach(track => track.stop());
        (window as any).__micStream = null;
        (window as any).__webrtcMicStream = null;
        (window as any).__macMicrophoneStream = null;
      }
      // If registration fails on Mac, it might be due to microphone permission
      if (isMac()) {
        console.error("🍎 Mac: Registration failure might be due to microphone permission. Try refreshing and allowing microphone access.");
      }
      throw registerError;
    }

    // Check device readiness with improved logic
    setTimeout(() => {
      const deviceState = device.state;
      const isConnectReady = deviceState === 'ready' || deviceState === 'registered';
      console.log("📊 Device state after 2 seconds:", deviceState, "connectReady:", isConnectReady);
      if (!isConnectReady) {
        console.log("⚠️ Device not ready, checking network connectivity...");
        console.log("🔍 Device details:", {
          state: deviceState,
          audio: device.audio ? device.audio.isConnected : 'no audio',
          identity: device.identity
        });
      }
    }, 2000);

    setTimeout(() => {
      const deviceState = device.state;
      const isConnectReady = deviceState === 'ready' || deviceState === 'registered';
      console.log("📊 Device state after 5 seconds:", deviceState, "connectReady:", isConnectReady);
      if (!isConnectReady) {
        console.log("❌ WebRTC session failed - device state:", deviceState);
        // Try to force registration again - but unregister first if already registered
        console.log("🔄 Attempting to re-register device...");
        try {
          if (deviceState === 'registered') {
            console.log("🔄 Device already registered, unregistering first...");
            device.unregister();
            // Wait a moment before re-registering
            setTimeout(() => {
              device.register();
            }, 1000);
          } else {
            device.register();
          }
        } catch (reRegError) {
          console.error("❌ Re-registration failed:", reRegError);
        }
      } else {
        console.log("✅ WebRTC session established successfully (registered/connect-ready)!");
      }
    }, 5000);

    return true;
  } catch (err: any) {
    console.error("❌ powerOnWebRTC failed:", err);
    return false;
  }
};

// Function will be defined inside component to access state

// Import Call Connector Pro components
import { DialerState, Lead, CallDisposition } from './types';
import CandidateQueue from './CandidateQueue';
import CallControls from './CallControls';
import LeadDisplay from './LeadDisplay';
import { CCProRankBadge } from './CCProRankBadge';
import { RecruitInboundConnectPanel } from '../recruit/RecruitInboundConnectPanel';
// DISABLED: import NewLeadsNotification from './NewLeadsNotification';
import CallTrackers from './CallTrackers';
import { LocalPresenceDisplay } from './LocalPresenceDisplay';
import { TrialWelcomeModal } from './TrialWelcomeModal';

import { AppointmentManager } from '../appointments/AppointmentManager';
import CampaignManager from '../campaign-manager/CampaignManager';

import SimpleDialerTest from '../test/SimpleDialerTest';


const DEMO_USER_ID = 1;

type PlanDisplayKey = 'intro' | 'professional';
export type SubscriptionPlan = 'starter' | 'professional';

export type PlanOption = {
  plan: SubscriptionPlan;
  label: string;
  price: string;
  priceSuffix: string;
  tagline: string;
  cardClass: string;
  gradientClass: string;
  bodyClass: string;
  buttonClass: string;
  icon: React.ReactNode;
  benefits: string[];
  ctaLabel: string;
  topBanner?: string;
};

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

export function RecruitOutboundDialerInterface() {
  console.log('🎯 Call Connector Pro (Recruit) interface rendering...');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const { updateActivity } = useCallConnectorActivity();
  const { isDemoMode, demoProduct, exitDemoMode } = useDemo();
  const isCCPDemo = isDemoMode && demoProduct === 'callconnector';

  // Fetch pipeline stages for recruit
  const { data: stagesData } = useQuery({
    queryKey: ['/api/recruit/stages'],
    queryFn: async () => {
      const response = await fetch('/api/recruit/stages');
      if (!response.ok) throw new Error('Failed to fetch stages');
      return response.json();
    },
    retry: false,
  });

  const stages = stagesData?.stages || [];

  // Mutation to handle stage changes
  const stageChangeMutation = useMutation({
    mutationFn: async ({ candidateId, stageId }: { candidateId: number; stageId: number }) => {
      return await apiRequest('POST', `/api/recruit/candidates/${candidateId}/move-stage`, { toStageId: stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/recruit-candidates'] });
      toast({
        title: "Stage Updated",
        description: "Candidate moved to new stage",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage",
        variant: "destructive",
      });
    }
  });

  const handleStageChange = (candidateId: number, newStageId: number) => {
    stageChangeMutation.mutate({ candidateId, stageId: newStageId });
  };

  // Candidate action modals state
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [smsCandidate, setSmsCandidate] = useState<RecruitCandidate | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentCandidate, setAppointmentCandidate] = useState<RecruitCandidate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<RecruitCandidate | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    zipCode: '',
    position: '',
    experience: '',
    status: 'new' as const,
    notes: '',
  });

  // Convert masterrecruit to recruit_candidates (take ownership)
  const convertToCandidateMutation = useMutation({
    mutationFn: async ({ masterrecruitId }: { masterrecruitId: number }) => {
      const userEmail = authState?.user?.email;
      if (!userEmail) throw new Error('Not signed in');
      return await apiRequest('POST', '/api/masterrecruit/convert-to-candidate', {
        masterrecruitId,
        agentEmail: userEmail,
      });
    },
    onSuccess: (_data, { masterrecruitId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates/stage-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/recruit-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/masterrecruit-queue'] });
      loadQueue();
      toast({
        title: "Candidate added",
        description: "Added to My Candidates. You can now work this candidate in your pipeline.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Convert failed",
        description: error?.message || "Could not add to My Candidates",
        variant: "destructive",
      });
    },
  });

  // Delete candidate mutation
  const deleteCandidateMutation = useMutation({
    mutationFn: async (id: number) => {
      const userEmail = authState?.user?.email;
      return await apiRequest('DELETE', `/api/recruit/candidates/${id}`, undefined, userEmail);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/recruit-candidates'] });
      toast({
        title: "Success",
        description: "Candidate deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete candidate",
        variant: "destructive",
      });
    }
  });

  // Helper to convert candidate from queue format to RecruitCandidate format
  const convertToRecruitCandidate = (candidate: any): RecruitCandidate | null => {
    if (!candidate || !candidate.id) return null;
    
    return {
      id: candidate.id,
      firstName: candidate.first_name || candidate.firstName || '',
      lastName: candidate.last_name || candidate.lastName || '',
      phone: candidate.phone || '',
      email: candidate.email || '',
      city: candidate.city || null,
      state: candidate.state || null,
      zipCode: candidate.zip_code || candidate.zipCode || null,
      status: candidate.status || 'new',
      position: candidate.position || null,
      experience: candidate.experience || null,
      rating: candidate.rating || null,
      notes: candidate.notes || null,
      aiSummary: candidate.ai_summary || candidate.aiSummary || null,
      agentId: candidate.agent_id || candidate.agentId || '',
      agentEmail: candidate.agent_email || candidate.agentEmail || '',
      appointmentDate: candidate.appointment_date || candidate.appointmentDate || null,
      appointmentNotes: candidate.appointment_notes || candidate.appointmentNotes || null,
      currentStageId: candidate.current_stage_id || candidate.currentStageId || null,
      stageEnteredAt: candidate.stage_entered_at || candidate.stageEnteredAt || null,
      lastContacted: candidate.last_contacted || candidate.lastContacted || null,
      createdAt: candidate.created_at ? new Date(candidate.created_at) : new Date(),
      updatedAt: candidate.updated_at ? new Date(candidate.updated_at) : new Date(),
    } as RecruitCandidate;
  };

  // Update candidate mutation
  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const userEmail = authState?.user?.email;
      return await apiRequest('PATCH', `/api/recruit/candidates/${id}`, updates, userEmail);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/recruit-candidates'] });
      toast({
        title: "Success",
        description: "Candidate updated successfully",
      });
      setIsEditModalOpen(false);
      setEditCandidate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update candidate",
        variant: "destructive",
      });
    }
  });

  // Candidate action handlers
  const handleEditCandidate = (candidate: any) => {
    const recruitCandidate = convertToRecruitCandidate(candidate);
    if (recruitCandidate) {
      setEditCandidate(recruitCandidate);
      setEditFormData({
        firstName: recruitCandidate.firstName || '',
        lastName: recruitCandidate.lastName || '',
        phone: recruitCandidate.phone || '',
        email: recruitCandidate.email || '',
        city: recruitCandidate.city || '',
        state: recruitCandidate.state || '',
        zipCode: recruitCandidate.zipCode || '',
        position: recruitCandidate.position || '',
        experience: recruitCandidate.experience || '',
        status: recruitCandidate.status || 'new',
        notes: recruitCandidate.notes || '',
      });
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEditCandidate = () => {
    if (!editCandidate || !editCandidate.id) return;
    
    updateCandidateMutation.mutate({
      id: editCandidate.id,
      updates: editFormData
    });
  };

  const handleDeleteCandidate = (candidateId: number) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      deleteCandidateMutation.mutate(candidateId);
    }
  };

  const handleSMSCandidate = (candidate: any) => {
    const recruitCandidate = convertToRecruitCandidate(candidate);
    if (recruitCandidate) {
      setSmsCandidate(recruitCandidate);
      setIsSMSModalOpen(true);
    }
  };

  const handleAppointmentCandidate = (candidate: any) => {
    const recruitCandidate = convertToRecruitCandidate(candidate);
    if (recruitCandidate) {
      setAppointmentCandidate(recruitCandidate);
      setIsAppointmentModalOpen(true);
    }
  };

  // Update edit form data when editCandidate changes
  useEffect(() => {
    if (editCandidate && isEditModalOpen) {
      setEditFormData({
        firstName: editCandidate.firstName || '',
        lastName: editCandidate.lastName || '',
        phone: editCandidate.phone || '',
        email: editCandidate.email || '',
        city: editCandidate.city || '',
        state: editCandidate.state || '',
        zipCode: editCandidate.zipCode || '',
        position: editCandidate.position || '',
        experience: editCandidate.experience || '',
        status: editCandidate.status || 'new',
        notes: editCandidate.notes || '',
      });
    }
  }, [editCandidate, isEditModalOpen]);

  const [status, setStatus] = useState('Not Connected');
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  
  // DISCLAIMER LOGIC REMOVED - All users bypass disclaimers
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true); // Always accepted
  const [disclaimerLoading, setDisclaimerLoading] = useState(false); // No loading needed
  const currentUserEmail = authState?.user?.email?.toLowerCase();
  
  // DISCLAIMER LOGIC REMOVED - All users bypass disclaimers
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
  const isBypassEmailForDisclaimer = currentUserEmail && bypassEmails.includes(currentUserEmail.toLowerCase().trim());

  // 🍎 MAC-SPECIFIC: Request microphone permission IMMEDIATELY on component mount
  // Auto-detect broken permissions and show recovery modal
  useEffect(() => {
    if (isMac()) {
      console.log('🍎 Mac detected - requesting microphone permission immediately on component mount...');
      requestMicrophonePermission(true).then((result) => {
        if (result.success) {
          console.log('✅ Mac: Microphone permission granted on app load');
          if (result.stream) {
            // Keep stream active for entire session
            (window as any).__macMicrophoneStream = result.stream;
            console.log('✅ Mac: Microphone stream stored globally for entire session');
          }
        } else {
          console.error('❌ Mac: Failed to get microphone permission on app load:', result.error);
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
  
  // DISCLAIMER LOGIC COMPLETELY REMOVED - All users bypass disclaimers
  useEffect(() => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    setDisclaimerLoading(false);
    console.log('✅ DISCLAIMER BYPASSED - All disclaimers removed for /recruit');
  }, []);
  
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>(null);
  const isEmbeddedSubscriptionEnabled = true;
  const [showCertification, setShowCertification] = useState(false);
  const [demoCallStarted, setDemoCallStarted] = useState(false);
  const [showMicRecoveryModal, setShowMicRecoveryModal] = useState(false);
  
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
    refetchInterval: 60000,
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
    refetchInterval: 30000, // Refetch every 30 seconds
  });

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
      powered: false,
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
      viewedLead: null // For leads selected from search that don't affect queue
    };
  };

  // Core dialer state matching Call Connector Pro
  const [dialerState, setDialerState] = useState<DialerState>(initializeDialerState);
  
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
    
    // Debug logging
    console.log(`📊 Activity Tracker State:`, {
      dialingStatus: dialerState.dialingStatus,
      callStatus: dialerState.callStatus,
      webRTCConferenceActive: dialerState.webRTCConferenceActive,
      powered: dialerState.powered,
      hasLead: !!currentLead
    });
    
    // Determine activity based on state
    if (dialerState.dialingStatus === 'dialing') {
      // Call is being initiated/ringing
      console.log(`📞 Activity: RINGING for ${currentLead?.name}`);
      updateActivity('ringing', {
        phoneNumber: currentLead?.phone,
        clientName: currentLead?.name,
        direction: 'outbound'
      });
    } else if (dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive) {
      // Call is live/connected
      console.log(`🟢 Activity: LIVE for ${currentLead?.name}`);
      updateActivity('live', {
        phoneNumber: currentLead?.phone,
        clientName: currentLead?.name,
        direction: 'outbound'
      });
    } else if (dialerState.powered && !dialerState.dialingStatus) {
      // Powered on but not on a call
      console.log(`⚪ Activity: IDLE`);
      updateActivity('idle');
    }
  }, [dialerState.dialingStatus, dialerState.callStatus, dialerState.webRTCConferenceActive, dialerState.powered, dialerState.currentLeadIndex, authState?.user?.email, updateActivity, dialerState.availableLeads]);

  // 🚨 CRITICAL: Auto-pause dialer when AOIntel call comes in (agent status = 'in_call')
  // When AOIntel PICK_UP event is received, backend sets agent_live_call_status to 'in_call'
  // This should immediately pause any active outbound dialing to prioritize the inbound call
  useEffect(() => {
    if (agentStatus?.status === 'in_call' && dialerState.campaignActive) {
      console.log('🚨 AOIntel call detected - pausing outbound dialer automatically');
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
  }, [agentStatus?.status, dialerState.campaignActive]);

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
  //     console.log(`🔄 AUTO-FETCH: Queue low (${currentQueue.length} leads), fetching more...`);
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
  const loadQueue = async () => {
    if (!authState?.user?.email) {
      console.log('❌ No user email, cannot load queue');
      return;
    }

    if (!subscriptionResolved) {
      console.log('⏳ Subscription status pending – deferring queue load');
      return;
    }

    // CRITICAL: NEVER update queue during active calls - current lead must stay stable.
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
      console.log('🔒 LOAD QUEUE: LOCKED during active call - queue update deferred');
      return; // DO NOT update queue during active call
    }

    if (shouldGateOutbound) {
      console.log('ℹ️ Outbound access disabled – keeping outbound queues empty');
      setHotleadQueue([]);
      setPlusLeadsQueue([]);
      setHotCandidatesQueue([]);
      setQueuePositions({ hotlead: 0, hotcandidates: 0, plus: 0, aointel: 0 });
      setDialerState(prev => ({
        ...prev,
        leads: [],
        availableLeads: [],
        currentIndex: 0,
        currentLeadIndex: 0,
        availableLeadsCount: 0,
        viewedLead: prev.viewedLead,
      }));
      return;
    }

    const userEmail = authState.user.email;
    setIsLoadingQueue(true);
    
    console.log(`🔄 LOADING ALL LEADS for ${userEmail}`);
    console.log(`🎭 DEMO MODE CHECK: isCCPDemo=${isCCPDemo}, isDemoMode=${isDemoMode}, demoProduct=${demoProduct}`);
    
    try {
      // Load candidates from the same recruit source used in production.
      // Keep legacy endpoint as fallback for compatibility.
      const primaryApiUrl = `/api/recruit/candidates?email=${encodeURIComponent(userEmail)}`;
      const legacyApiUrl = `/api/outbound-dialer/recruit-candidates${isCCPDemo ? '?demo=true' : ''}`;
      console.log(`🎯 RECRUIT: Fetching candidates from ${primaryApiUrl} (fallback: ${legacyApiUrl})`);
      let response: Response;
      try {
        response = await apiRequest('GET', primaryApiUrl, undefined, userEmail);
      } catch (primaryError) {
        console.warn('⚠️ Recruit primary endpoint failed, trying legacy fallback:', primaryError);
        response = await apiRequest('GET', legacyApiUrl, undefined, userEmail);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ API RESPONSE: ${data.candidates?.length || 0} candidates assigned to ${userEmail}`);
      
      // For recruit, we don't have AOIntel logic - all candidates are treated equally
      if (data.candidates && data.candidates.length > 0) {
        console.log(`✅ RECRUIT CANDIDATES IN API RESPONSE: ${data.candidates.length} candidate(s) found`);
      } else {
        console.log(`🚨 NO CANDIDATES IN API RESPONSE`);
      }
      
      // For recruit, we don't have auto-assignment webhooks
      
      if (data.candidates && data.candidates.length > 0) {
        // Convert candidates to display format - pass through ALL data
        const allCandidates = data.candidates.map((candidate: any) => ({
          ...candidate, // Pass through everything
          id: candidate.id,
          name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unknown',
          phone: candidate.phone,
          email: candidate.email || '',
          candidateId: candidate.id,
          market: 'AO Recruit', // Recruit candidates are always AO Recruit market
          isHotLead: false, // Not applicable for recruit
          priority: 'normal',
          status: candidate.status || 'new',
          timestamp: candidate.created_at || candidate.updated_at || new Date().toISOString(),
          notes: candidate.notes || '',
          // Map recruit candidate fields to match lead structure for compatibility
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          state: candidate.state,
          city: candidate.city,
          agent_email: candidate.agent_email,
          // Include recruit-specific fields
          aiSummary: candidate.ai_summary || candidate.aiSummary || '',
          ai_summary: candidate.ai_summary || candidate.aiSummary || '',
          ai_notes: candidate.ai_notes || candidate.aiNotes || '',
          appointment_notes: candidate.appointment_notes || candidate.appointmentNotes || '',
          appointmentNotes: candidate.appointment_notes || candidate.appointmentNotes || '',
          appointment_date: candidate.appointment_date || candidate.appointmentDate || null,
          appointmentDate: candidate.appointment_date || candidate.appointmentDate || null,
          source_table: candidate.source_table || 'recruit_candidates',
          // Normalize missing/invalid stages to AO Recruit stage 1
          currentStageId: Number(candidate.current_stage_id ?? candidate.currentStageId ?? 0) || 1,
          current_stage_id: Number(candidate.current_stage_id ?? candidate.currentStageId ?? 0) || 1,
        }));
        
        // For recruit candidates, we don't need FTC filtering or complex queue splitting
        // Recruit hotlead: sort so hot candidates (is_hot_lead) appear first, like masterlead hotlead
        const convertedCandidates = [...(allCandidates || [])].sort((a: any, b: any) => {
          const aHot = a.is_hot_lead == true || a.is_hot_lead === "true" ? 1 : 0;
          const bHot = b.is_hot_lead == true || b.is_hot_lead === "true" ? 1 : 0;
          return bHot - aHot;
        });
        const stageOneCandidates = convertedCandidates.filter((c: any) => (Number(c.current_stage_id ?? 0) || 0) === 1);
        
        console.log(`📊 RECRUIT: Using ${convertedCandidates.length} candidates (hot first)`);

        setHotleadQueue(convertedCandidates);
        setPlusLeadsQueue([]);
        // Hot Candidates + AO Recruit (Standard): fetch masterrecruit with queue=hot and queue=standard
        const mapMr = (c: any) => ({
          ...c,
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
          phone: c.phone,
          email: c.email || '',
          status: c.status || 'new',
          timestamp: c.created_at || c.updated_at || new Date().toISOString(),
          notes: c.notes || '',
          first_name: c.first_name,
          last_name: c.last_name,
          state: c.state,
          city: c.city,
          agent_email: c.agent_email,
          current_stage_id: Number(c.current_stage_id ?? c.currentStageId ?? 0) || 1,
          currentStageId: Number(c.current_stage_id ?? c.currentStageId ?? 0) || 1,
          aiSummary: c.ai_summary || c.aiSummary || '',
          ai_summary: c.ai_summary || c.aiSummary || '',
          ai_notes: c.ai_notes || c.aiNotes || '',
          appointment_notes: c.appointment_notes || c.appointmentNotes || '',
          appointmentNotes: c.appointment_notes || c.appointmentNotes || '',
          appointment_date: c.appointment_date || c.appointmentDate || null,
          appointmentDate: c.appointment_date || c.appointmentDate || null,
          source_table: 'masterrecruit',
          market: 'AO Recruit',
          is_hot_candidate: c.is_hot_candidate === true,
        });
        let hotMr: any[] = [];
        let standardMr: any[] = [];
        try {
          const [hotRes, stdRes] = await Promise.all([
            apiRequest('GET', `/api/outbound-dialer/masterrecruit-queue?userEmail=${encodeURIComponent(userEmail)}&queue=hot`, undefined, userEmail),
            apiRequest('GET', `/api/outbound-dialer/masterrecruit-queue?userEmail=${encodeURIComponent(userEmail)}&queue=standard`, undefined, userEmail),
          ]);
          const hotData = await hotRes.json();
          const stdData = await stdRes.json();
          hotMr = (hotData.candidates || []).map(mapMr);
          standardMr = (stdData.candidates || []).map(mapMr);
          const fallbackHot = convertedCandidates.filter((c: any) => c.is_hot_candidate === true || c.is_hot_lead == true || c.is_hot_lead === "true");
          const fallbackStandard = stageOneCandidates.length > 0 ? stageOneCandidates : convertedCandidates;
          setHotCandidatesQueue(hotMr.length > 0 ? hotMr : fallbackHot);
          setAoiIntelQueue(standardMr.length > 0 ? standardMr : fallbackStandard);
        } catch (e) {
          console.warn('Failed to load masterrecruit queue:', e);
          const fallbackHot = convertedCandidates.filter((c: any) => c.is_hot_candidate === true || c.is_hot_lead == true || c.is_hot_lead === "true");
          const fallbackStandard = stageOneCandidates.length > 0 ? stageOneCandidates : convertedCandidates;
          hotMr = fallbackHot;
          standardMr = fallbackStandard;
          setHotCandidatesQueue(fallbackHot);
          setAoiIntelQueue(fallbackStandard);
        }
        
        // My Candidates: filter by selected stage (like My Leads by lead pool)
        const myCandidatesFiltered = selectedCandidateStage === 'all'
          ? convertedCandidates
          : convertedCandidates.filter(
              (c: any) =>
                (Number(c.current_stage_id ?? c.currentStageId ?? 0) || 0) === Number(selectedCandidateStage),
            );
        // Use the currently active tab
        const finalActiveTab = activeQueueTab;

        const nextHotIndex = myCandidatesFiltered.length === 0 ? 0 : Math.min(queuePositions.hotlead ?? 0, myCandidatesFiltered.length - 1);
        const nextHotCandIndex = hotMr.length === 0 ? 0 : Math.min(queuePositions.hotcandidates ?? 0, hotMr.length - 1);
        const nextPlusIndex = 0;
        const nextAOIIndex = standardMr.length === 0 ? 0 : Math.min(queuePositions.aointel ?? 0, standardMr.length - 1);

        setQueuePositions({
          hotlead: nextHotIndex,
          hotcandidates: nextHotCandIndex,
          plus: nextPlusIndex,
          aointel: nextAOIIndex,
        });

        // My Candidates (hotlead), Hot Candidates (masterrecruit hot), AO Recruit (masterrecruit standard)
        let selectedQueue: any[] = [];
        let selectedIndex = 0;
        if (finalActiveTab === 'hotlead') {
          selectedQueue = myCandidatesFiltered;
          selectedIndex = nextHotIndex;
        } else if (finalActiveTab === 'hotcandidates') {
          selectedQueue = hotMr;
          selectedIndex = nextHotCandIndex;
        } else if (finalActiveTab === 'aointel') {
          selectedQueue = standardMr;
          selectedIndex = nextAOIIndex;
        } else {
          selectedQueue = [];
          selectedIndex = nextPlusIndex;
        }

        setDialerState(prev => {
          // 🔥 CRITICAL FIX: Don't change lead index if there's an active call
          // Prevent leads from moving when a call starts - preserve current lead during active calls
          const hasActiveCall = prev.dialingStatus === 'connected' || 
                                prev.dialingStatus === 'dialing' ||
                                prev.callStatus === 'connected' ||
                                prev.webRTCConferenceActive ||
                                prev.currentCall !== null;
          
          // If call is active, preserve current lead index and viewedLead
          const preserveIndex = hasActiveCall && prev.currentLeadIndex < selectedQueue.length 
            ? prev.currentLeadIndex 
            : selectedIndex;
          
          return {
            ...prev,
            leads: selectedQueue,
            availableLeads: selectedQueue,
            currentIndex: 0,
            currentLeadIndex: preserveIndex,
            availableLeadsCount: selectedQueue.length,
            viewedLead: hasActiveCall ? prev.viewedLead : null, // Preserve viewedLead during active calls
          };
        });
        
        console.log(`✅ QUEUE LOADED: ${convertedCandidates.length} candidates`);
        console.log(`🔍 First 3 candidates:`, convertedCandidates.slice(0, 3).map(l => ({
          name: l.name,
          phone: l.phone,
          email: l.email,
          current_stage_id: l.current_stage_id
        })));
      } else {
        console.log(`❌ NO LEADS FOUND for ${userEmail}`);
        setHotleadQueue([]);
        setPlusLeadsQueue([]);
        setHotCandidatesQueue([]);
        setAoiIntelQueue([]);
        setQueuePositions({ hotlead: 0, hotcandidates: 0, plus: 0, aointel: 0 });
        setDialerState(prev => ({
          ...prev,
          leads: [],
          availableLeads: [],
          currentIndex: 0,
          currentLeadIndex: 0,
          availableLeadsCount: 0,
          viewedLead: null,
        }));
      }
    } catch (error) {
      console.error(`❌ Failed to load queue:`, error);
    setDialerState(prev => ({
      ...prev,
        leads: [],
        availableLeads: [],
        currentIndex: prev.currentIndex, // Keep position even on error
        currentLeadIndex: prev.currentLeadIndex, // Keep position even on error
        availableLeadsCount: 0
      }));
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleRecruitIgniteQueue = async (agentEmail: string) => {
    const response = await apiRequest(
      'POST',
      '/api/leads/ignite-recruit',
      { agentEmail },
      agentEmail,
    );
    const data = await response.json();
    return data;
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
  //     console.log(`🔥 PLUS QUEUE AUTO-REFRESHED: ${loadedPlusLeads.length} leads`);
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
  //       console.log(`🔥 NEW HOTLEADS DETECTED: ${newHotleadsCount} new hotleads added automatically`);
  //       toast({
  //         title: "🔥 New Hotleads Available!",
  //         description: `${newHotleadsCount} new hotlead${newHotleadsCount > 1 ? 's' : ''} automatically loaded`,
  //         duration: 5000,
  //       });
  //     }
  //     
  //     console.log(`🔥 HOTLEAD QUEUE AUTO-REFRESHED: ${loadedHotLeads.length} leads (was: ${previousCount})`);
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
    console.log('🎯 Campaign selected:', campaign);
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
      console.log(`🔄 ${action} requested for callback:`, callback);
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
      console.log(`🔄 ${action} requested for lead:`, lead);
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
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => handleLeadAction(lead, 'call')}
                          variant="outline"
                          size="sm"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call
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
                      {/* Apply Disposition Button for Previously Called Leads */}
                      {lead.status && lead.status !== 'pending' && lead.status !== 'new' && (
                        <div className="mt-2 pt-2 border-t">
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              // Set as viewedLead to enable disposition application
                              setDialerState(prev => ({
                                ...prev,
                                viewedLead: {
                                  id: lead.id,
                                  name: lead.name,
                                  phone: lead.phone,
                                  email: lead.email,
                                  state: lead.state,
                                  market: lead.market,
                                  cnresolution: lead.status,
                                  taalk_lead_id: lead.taalk_lead_id
                                }
                              }));
                              toast({
                                title: 'Lead Loaded',
                                description: 'Select a disposition to update this lead.',
                              });
                            }}
                          >
                            Apply New Disposition
                          </Button>
                        </div>
                      )}
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
          console.log('❌ CALL HISTORY: No userEmail available, skipping API call');
          return { success: false, calls: [], total: 0, sources: { incoming: 0, outgoing: 0 } };
        }
        
        console.log('📞 CALL HISTORY: Fetching for userEmail:', userEmail);
        const response = await fetch(`/api/call-history?userEmail=${encodeURIComponent(userEmail)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch call history');
        }
        return response.json();
      },
      enabled: !!userEmail, // Only enabled when we have a userEmail
      refetchInterval: 30000, // Refresh every 30 seconds
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
      console.log('🔄 Callback requested for call:', call);
      
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
        
        console.log('🔄 Setting VDP call as current lead:', { name: leadData.name, phone: leadData.phone });
        
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
        console.log('✅ VDP call set as current lead:', result);
        
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
            console.log('🔄 Switching to dialer tab to show loaded lead');
            queueTabTrigger.click();
          }
        }
        
        // Wait a moment for the leads to refresh, then the hotlead should appear at the top
        setTimeout(() => {
          console.log('🎯 Callback lead loaded - it should appear as a hotlead at the top of your queue');
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

      // DON'T call disconnectAll() - it can unregister the device
      // Only disconnect the active connection, not the device itself
      if ((window as any).twilioConnection) {
        console.log('🔇 Disconnecting active WebRTC connection (keeping device registered)');
        (window as any).twilioConnection.disconnect();
        (window as any).twilioConnection = null;
      }

      // Stop any HTML5 audio elements that might be playing
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.paused) {
          console.log('🔇 Stopping HTML5 audio element');
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
                console.log('🔇 Stopping audio track');
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

  // Helper function to get the current lead - prioritizes VDP call data when active
  const getCurrentLead = () => {
    // Prioritize viewed lead from search if one is set
    if (dialerState.viewedLead) {
      return dialerState.viewedLead;
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
    // Fall back to regular lead
    return dialerState.availableLeads[dialerState.currentLeadIndex] || null;
  };

  // Hot Lead specific states
  const [planetViewTimer, setPlanetViewTimer] = useState(0);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hotleadQueue, setHotleadQueue] = useState<any[]>([]);
  const [plusLeadsQueue, setPlusLeadsQueue] = useState<any[]>([]);
  const [hotCandidatesQueue, setHotCandidatesQueue] = useState<any[]>([]);
  const [aoiIntelQueue, setAoiIntelQueue] = useState<any[]>([]);
  const [activeQueueTab, setActiveQueueTab] = useState<'hotlead' | 'hotcandidates' | 'plus' | 'aointel'>('hotlead');
  const [selectedCandidateStage, setSelectedCandidateStage] = useState<'all' | number>('all');
  const [queuePositions, setQueuePositions] = useState<{ hotlead: number; hotcandidates: number; plus: number; aointel: number }>({
    hotlead: 0,
    hotcandidates: 0,
    plus: 0,
    aointel: 0,
  });
  /** Double dial: first Complete = redial same, second = dial next. */
  const [doubleDialMode, setDoubleDialMode] = useState(false);
  const [doubleDialNextIsRedial, setDoubleDialNextIsRedial] = useState(true);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Stage counts for My Candidates dropdown (like My Leads)
  const { data: stageCountsData } = useQuery({
    queryKey: ['/api/recruit/candidates/stage-counts', authState?.user?.email],
    queryFn: async () => {
      const email = authState?.user?.email;
      if (!email) return { stageCounts: {}, total: 0 };
      const response = await fetch(`/api/recruit/candidates/stage-counts?email=${encodeURIComponent(email)}`, {
        headers: { 'x-user-email': email },
      });
      if (!response.ok) throw new Error('Failed to fetch stage counts');
      return response.json();
    },
    enabled: !!authState?.user?.email,
  });
  const stageCounts: Record<number, number> = stageCountsData?.stageCounts || {};
  const totalCandidatesCount = stageCountsData?.total ?? 0;
  const stageGroupsForPicker = useMemo(() => {
    return stages.map((stage: { id: number; name: string; displayName?: string }) => {
      const candidates = hotleadQueue.filter((c: any) => (Number(c.current_stage_id ?? c.currentStageId ?? 0) || 0) === Number(stage.id));
      return {
        id: Number(stage.id),
        name: stage.displayName || stage.name,
        candidates,
      };
    });
  }, [stages, hotleadQueue]);

  const handleMyCandidatesStagePickerChange = (value: string) => {
    if (!value) return;
    if (value === 'all') {
      setSelectedCandidateStage('all');
      return;
    }
    if (value.startsWith('stage:')) {
      const stageId = parseInt(value.replace('stage:', ''), 10);
      if (!Number.isFinite(stageId)) return;
      setSelectedCandidateStage(stageId);
      return;
    }
    if (value.startsWith('candidate:')) {
      const candidateId = value.replace('candidate:', '');
      const candidate = hotleadQueue.find((c: any) => String(c.id) === candidateId);
      if (!candidate) return;
      const stageId = Number(candidate.current_stage_id ?? candidate.currentStageId ?? 0) || 0;
      const nextStage = stageId > 0 ? stageId : 'all';
      setSelectedCandidateStage(nextStage as 'all' | number);
      const filtered = stageId > 0
        ? hotleadQueue.filter((c: any) => (Number(c.current_stage_id ?? c.currentStageId ?? 0) || 0) === stageId)
        : hotleadQueue;
      const targetIndex = filtered.findIndex((c: any) => String(c.id) === candidateId);
      setDialerState((prev) => ({
        ...prev,
        leads: filtered,
        availableLeads: filtered,
        availableLeadsCount: filtered.length,
        currentLeadIndex: Math.max(0, targetIndex),
        viewedLead: null,
      }));
    }
  };

  // My Candidates queue filtered by selected stage (used for display and dialer when on hotlead tab)
  const myCandidatesQueue = useMemo(() => {
    if (selectedCandidateStage === 'all') return hotleadQueue;
    return hotleadQueue.filter(
      (c: any) =>
        (Number(c.current_stage_id ?? c.currentStageId ?? 0) || 0) === Number(selectedCandidateStage),
    );
  }, [hotleadQueue, selectedCandidateStage]);

  // When stage filter changes and we're on My Candidates tab, sync dialer to filtered queue (skip when queue empty so loadQueue owns initial set)
  useEffect(() => {
    if (activeQueueTab !== 'hotlead' || hotleadQueue.length === 0) return;
    const filtered =
      selectedCandidateStage === 'all'
        ? hotleadQueue
        : hotleadQueue.filter(
            (c: any) =>
              (Number(c.current_stage_id ?? c.currentStageId ?? 0) || 0) === Number(selectedCandidateStage),
          );
    setDialerState(prev => ({
      ...prev,
      leads: filtered,
      availableLeads: filtered,
      availableLeadsCount: filtered.length,
      currentLeadIndex: Math.min(prev.currentLeadIndex, Math.max(0, filtered.length - 1)),
    }));
  }, [activeQueueTab, selectedCandidateStage]); // hotleadQueue read in effect; loadQueue sets dialer when queue loads

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

        const response = await apiRequest('GET', `/api/recruit/candidates/search?${params.toString()}`);
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

  // Query for real daily stats from database - USER SPECIFIC
  const { data: dailyStats } = useQuery({
    queryKey: ['/api/outbound-dialer/daily-stats', authState.user?.email],
    queryFn: async () => {
      const userEmail = authState.user?.email;
      if (!userEmail) return { total_dialed: 0, todayDialed: 0 };
      const queryParam = `?userEmail=${encodeURIComponent(userEmail)}`;
      const response = await segmentedFetch(`/api/outbound-dialer/daily-stats${queryParam}`);
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!authState.user?.email, // Only run query if user is authenticated
  });

  /** Inbound recruit queue position — same API as RecruitInboundConnectPanel / Connect POS tile */
  const { data: recruitInboundQueueData } = useQuery({
    queryKey: ['/api/call-connector-pro/eligible-for-inbound', authState.user?.email, 'aorecruit-header'],
    queryFn: async () => {
      const email = authState.user?.email;
      if (!email) return null;
      const res = await fetch(
        `/api/call-connector-pro/eligible-for-inbound?agentEmail=${encodeURIComponent(email)}`,
        { credentials: 'include', headers: { 'x-user-email': email } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return { position: typeof data.myPosition === 'number' ? data.myPosition : 0 };
    },
    enabled: !!authState.user?.email,
    refetchInterval: 10000,
  });
  const recruitInboundQueuePosition = (recruitInboundQueueData as { position?: number } | null)?.position ?? null;

  // Calculate trial status and remaining leads (AFTER dailyStats is defined)
  const isTrial = agentStatus?.trialone === true;
  const maxTrialLeads = 50;
  const dialedToday = dailyStats?.total_dialed || dailyStats?.todayDialed || 0;
  const remainingTrialLeads = isTrial ? Math.max(0, maxTrialLeads - dialedToday) : Infinity;

  // VDP CALL POLLING - Real-time check for active VDP calls
  useEffect(() => {
    if (!authState?.user?.email) {
      console.log('❌ VDP Check: No user email, skipping VDP call check');
      return;
    }

    // Function to check for VDP calls
    const checkVDPCall = async () => {
      try {
        console.log('🔍 VDP Check: Checking for active VDP calls for:', authState.user?.email);
        const email = authState.user?.email;
        const response = await apiRequest(
          "GET",
          `/api/inbound-calls/active/${encodeURIComponent(email || "")}`,
          undefined,
          email,
        );
        const data = await response.json();

        console.log('🔍 VDP Check: API response received:', data);

        if (data.inboundCall) {
          console.log('🔔 VDP CALL DETECTED! Call data:', data.inboundCall);

          // Update VDP call status in dialer state
          setDialerState(prev => {
          const newState = {
            ...prev,
            vdpCallStatus: {
              hasVDPCall: true,
              vdpCall: data.inboundCall,
              countdownValue: 0,
              countdownActive: false
            }
          };
            console.log('🔔 VDP State updated! New state:', newState.vdpCallStatus);
            return newState;
          });
        } else {
          console.log('❌ VDP Check: No active VDP call found');
          // Clear VDP state if no call found
          setDialerState(prev => {
            if (prev.vdpCallStatus?.hasVDPCall) {
              console.log('🔄 Clearing VDP call state - no active call');
              return {
                ...prev,
                vdpCallStatus: {
                  hasVDPCall: false,
                  vdpCall: null,
                  countdownValue: 0,
                  countdownActive: false
                }
              };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('❌ VDP call check failed:', error);
      }
    };

    // Initial check after mount
    const initialTimer = setTimeout(checkVDPCall, 100);

    // Set up polling for real-time updates every 3 seconds
    const pollInterval = setInterval(checkVDPCall, 3000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
    };
  }, [authState?.user?.email]);

  // On unmount: set eligible_for_hot_candidates false (like Connect hotlead eligibility)
  useEffect(() => {
    const email = authState?.user?.email?.toLowerCase?.();
    return () => {
      if (!email) return;
      fetch('/api/vdp/recruit-hot-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eligible: false }),
      }).catch(() => {});
    };
  }, [authState?.user?.email]);

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
            timestamp: new Date().toISOString()
          })
        });
        console.log('💓 Call Connector Pro heartbeat sent for', userEmail);
      } catch (error) {
        console.error('❌ Failed to send heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Send heartbeat every 10 seconds
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [authState?.user?.email]);

  // DISABLED: /ws real-time updates — endpoint returns 400; breaks frontend
  useEffect(() => {
    return () => {};
    /* DISABLED /ws:
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
    const wsUrl = `${protocol}//${host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('🔌 WebSocket connected for auto-complete updates');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle lead hung up event
        if (data.type === 'lead-hung-up') {
          console.log('🎯 LEAD HUNG UP EVENT RECEIVED:', data);

          // Update UI to show call ended (but keep WebRTC active and powered on)
          // CRITICAL: Preserve viewedLead and currentLeadIndex - lead must stay on screen until "Complete Call & Dial Next"
          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'idle',
            webRTCConferenceActive: true, // Keep WebRTC active for next call
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
          console.log('🚨 AOINTEL LEAD ARRIVED - INSTANT DISPLAY:', data.lead);

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
              console.log('🔌 Disconnecting active WebRTC call for AOIntel inbound call');
              (window as any).twilioConnection.disconnect();
              (window as any).twilioConnection = null;
            } catch (error) {
              console.error('⚠️ Error disconnecting WebRTC for AOIntel call:', error);
            }
          }

          // Stop any active dialing/campaign
          if (device && typeof device.disconnectAll === 'function') {
            try {
              console.log('🔌 Disconnecting all WebRTC audio streams for AOIntel call');
              device.disconnectAll();
            } catch (error) {
              console.error('⚠️ Error disconnecting WebRTC device:', error);
            }
          }

          // 🚨 CRITICAL: Pause outbound dialing immediately when AOIntel call arrives
          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'idle', // Stop any active dialing
            powered: false, // Power off outbound dialer - CRITICAL: prevents outbound calls
            webRTCConferenceActive: false, // Stop WebRTC if active
            campaignActive: false, // Stop campaign
            callStatus: 'idle',
            currentCall: null, // Clear any active outbound call
            currentConferenceName: undefined, // Clear conference
            // Only update leads if user is currently on AOIntel queue tab
            ...(activeQueueTab === 'aointel' ? {
              leads: [transformedLead, ...prev.leads],
              availableLeads: [transformedLead, ...prev.availableLeads],
              availableLeadsCount: prev.availableLeadsCount + 1,
              currentLeadIndex: 0,
              viewedLead: transformedLead,
            } : {})
          }));

          // Update queue position for AOIntel queue if currently viewing it
          setQueuePositions(prev => ({
            ...prev,
            aointel: 0 // Select first lead (the AOIntel one) if user switches to AOIntel queue
          }));

          console.log('✅ AOIntel lead added to queue and outbound dialer paused');
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
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

        case 'q': // Start Dialing (Q = action)
          e.preventDefault();
          if (dialerState.powered && dialerState.availableLeads.length > 0) {
            handleStartDialing();
          }
          break;

        case 'e': // Complete Call & Dial Next (E = execute/end)
          e.preventDefault();
          console.log('🔥 E KEY PRESSED: Complete call and dial next lead');
          console.log('🔍 E KEY State Check:', {
            dialingStatus: dialerState.dialingStatus,
            callStatus: dialerState.callStatus,
            webRTCConferenceActive: dialerState.webRTCConferenceActive,
            condition1: dialerState.dialingStatus === 'dialing',
            condition2: dialerState.callStatus === 'connected',
            condition3: dialerState.webRTCConferenceActive,
            canProceed: (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive)
          });
          
          if (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive) {
            console.log('✅ E KEY: Conditions met, executing complete and dial next');
            handleCompleteCall();
            // Small delay to ensure call is properly ended before dialing next
            setTimeout(() => {
              console.log('⏰ E KEY: Timeout reached, calling handleDialNextLead');
              handleDialNextLead();
            }, 500);
          } else {
            console.log('❌ E KEY: Conditions not met, aborting complete and dial next');
            toast({
              title: 'Cannot Complete & Dial Next',
              description: 'No active call to complete',
              variant: 'destructive'
            });
          }
          break;

        case 'r': // Redial Same Lead (R = redial)
        case 'R': // Redial Same Lead (R = redial)
          e.preventDefault();
          if (dialerState.powered && dialerState.availableLeads.length > 0) {
            console.log('🔄 R KEY: Redialing same lead');
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
  }, [dialerState]);

  // Auto-load leads when component mounts and user is authenticated
  useEffect(() => {
    if (!subscriptionResolved) {
      console.log('⏳ Subscription status pending – waiting before initializing queue');
      return;
    }

    if (authState?.user?.email) {
      console.log('🚀 Component mounted for authenticated user:', authState.user.email);

      // Reset power state on mount
      console.log('🔄 Resetting power state on component mount');
      setDialerState(prev => ({
        ...prev,
        currentCall: null,
        dialingStatus: 'idle',
        callStatus: 'idle',
        webRTCConferenceActive: false,
        powered: false
      }));
      setIsPoweredOn(false);

      // Clear localStorage cache
      try {
        const storageKey = `outbound_leads_${authState.user.email}`;
        localStorage.removeItem(storageKey);
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey?.[0];
            return typeof key === 'string' && key.startsWith('/api/outbound-dialer/');
          },
        });
        console.log('🧹 Cleared outbound dialer cache');
      } catch (error) {
        console.warn('Failed to clear cache:', error);
      }

      // Clear any stale device
      if (device) {
        console.log('🧹 Clearing stale device on mount');
        device.destroy();
        device = null;
      }

      // Stop any playing audio on mount
      stopAllAudio();

      // Load all leads assigned to producer
      console.log('📥 Loading leads...');
      if (shouldGateOutbound) {
        console.log('ℹ️ Outbound access disabled on mount – clearing queue state');
        setHotleadQueue([]);
        setPlusLeadsQueue([]);
        setQueuePositions({ hotlead: 0, plus: 0 });
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
    } else {
      console.log('⏳ Waiting for user authentication');
    }
  }, [authState?.user?.email, subscriptionResolved, shouldGateOutbound, isDemoMode, demoProduct]); // Include demo mode in dependencies

  // Load leads based on selected market filter (plus_leads or hotleads)
  // OLD loadLeadsFromAPI removed - replaced with simple loadQueue() function above

  // AUTO-LOADING handled by main mount useEffect with loadQueue()

  // DISABLED: Demo mode auto-refresh
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
        console.log('🧹 Auto-refresh timer cleared on unmount');
      }

      // Stop all audio when component unmounts
      stopAllAudio();
      console.log('🔇 All audio stopped on component unmount');
    };
  }, []);

  // DISABLED EMERGENCY LEADS LOADER: Only load leads from Smart Campaign
  // useEffect(() => {
  //   console.log('🔥 EMERGENCY LEADS LOADER: Attempting to force load leads...');
  //   const forceLoadLeads = async () => {
  //     // Wait a bit for auth to initialize
  //     await new Promise(resolve => setTimeout(resolve, 1000));
  //     
  //     const userEmail = authState?.user?.email || ''; // No hardcoded fallback
  //     console.log('🔥 FORCING LEAD LOAD for:', userEmail);
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
  //         console.log(`🔥 EMERGENCY LOAD SUCCESS: ${data.leads.length} leads loaded`);
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
  //         console.log(`🔥 EMERGENCY LOAD COMPLETE: ${convertedLeads.length} leads set in state`);
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
      console.log(`💾 POSITION SAVED: ${position} for ${userEmail}`);

      const currentLead = dialerState.availableLeads[position];

      // Track all positions now since hotleads don't disrupt queue order
      const trackingData = {
        agentEmail: userEmail,
        market: 'All', // Since we load all markets now
        leadId: leadId || currentLead?.leadId || 'unknown',
        leadPhone: leadPhone || currentLead?.phone || 'unknown',
        position: position
      };

      console.log(`📍 Tracking position ${position} for ${userEmail}`);

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

      console.log('🔍 Lead status check:', {
        totalRemaining: remainingLeads.length,
        hotleadsRemaining: hotleadsCount,
        shouldLoadRegular: remainingLeads.length <= 3 || hotleadsCount === 0
      });

      // If we have 3 or fewer leads left, OR no hotleads left, load more regular leads
      if (remainingLeads.length <= 3 || (remainingLeads.length > 0 && hotleadsCount === 0)) {
        console.log('🔄 Triggering automatic regular lead reload');

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
            console.log('⏰ Planet View timer finished - button now available');
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
        console.log('🔥 Hot Lead call connected - starting 35 second Planet View timer');
        setPlanetViewTimer(35);
      } else {
        console.log('📞 Regular lead call connected - no timer restrictions');
        setPlanetViewTimer(0);
      }
    } else if (dialerState.dialingStatus === 'idle') {
      console.log('📴 Call ended - resetting timer state');
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
    if (hasOutboundCall || hasVdpCall) {
      interval = setInterval(() => {
        setCallDurationSeconds(prev => {
          const newDuration = prev + 1;

          // Check for hotlead 2-minute rule (outbound only)
          const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
          const isHotLead = currentLead?.source_table === 'hotleads' ||
                           currentLead?.isHotLead === true || currentLead?.isHotLead === 'true' || currentLead?.isHotLead === 1 ||
                           currentLead?.market === 'Hot Lead';

          // Debug logging every 15 seconds for more frequent updates
          if (newDuration % 15 === 0) {
            console.log(`🔍 DETAILED CALL DEBUG: duration: ${newDuration}s, status: ${dialerState.dialingStatus}, vdp: ${hasVdpCall}`);
            if (!hasVdpCall) {
              console.log(`🔥 HOTLEAD CHECK:`, {
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
      // Reset call duration when call ends (no outbound AND no VDP)
      setCallDurationSeconds(0);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [dialerState.dialingStatus, dialerState.vdpCallStatus?.hasVDPCall, dialerState.availableLeads, dialerState.currentLeadIndex, authState?.user?.email]);

  // Poll Twilio webhook data for real call answered status
  useEffect(() => {
    if (dialerState.dialingStatus !== 'connected' || !dialerState.availableLeads[dialerState.currentLeadIndex]) {
      // Clear timer if call ends or disconnected
      if (webhookTimerRef.current) {
        console.log('🧹 Clearing 60-second webhook timer - call disconnected');
        clearTimeout(webhookTimerRef.current);
        webhookTimerRef.current = null;
      }
      if (pstnAnswered) setPstnAnswered(false);
      if (webhookTimerStarted) setWebhookTimerStarted(false);
      return;
    }

    const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
    if (!currentLead?.phone) return;

    const checkCallStatus = async () => {
      try {
        const response = await fetch(`/api/twilio/call-status/${currentLead.phone}`);
        const data = await response.json();
        
        if (data.found && data.status === 'answered') {
          console.log('📞 REAL TWILIO WEBHOOK: Call answered!', data);
          setPstnAnswered(true);
          
          // 🔥 START REACH WEBHOOK TIMER HERE (when call actually answered)
          // ONLY START ONCE PER CALL
          // Send webhook for ALL leads after 45 seconds, not just hotleads
          
          if (!webhookTimerStarted && !webhookTimerRef.current) {
            console.log('🔥 CALL ANSWERED - Starting 45-second reach webhook timer');
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
            
            console.log(`⏰ SETTING 45-SECOND REACH TIMER: leadId=${leadId}, userEmail=${userEmail}, associateId=${associateId}`);
            
            // Start the timer and store it in ref
            const reachWebhookDelayMs = 45000;
            webhookTimerRef.current = setTimeout(async () => {
              console.log('⏰ 45-SECOND REACH TIMER FIRED! Sending webhook...');
              
              if (leadId && userEmail) {
                const webhookPayload = {
                  lead_id: leadId,
                  taalk_lead_id: leadId,
                  associate_id: associateId,
                  agent_email: userEmail // Send email so server can resolve if associate_id missing
                };
                
                console.log('📤 45-SECOND REACH WEBHOOK (REAL ANSWERED): Sending to Zapier', webhookPayload);
                
                try {
                  const webhookResponse = await fetch('/api/webhook/zapier-60sec-call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                  });
                  
                  if (webhookResponse.ok) {
                    console.log(`✅ REACH WEBHOOK SUCCESS: Lead ${leadId} | producer ${userEmail} (${associateId})`);
                  } else {
                    console.error(`❌ REACH WEBHOOK FAILED: ${webhookResponse.status}`);
                  }
                } catch (error) {
                  console.error(`❌ REACH WEBHOOK ERROR:`, error);
                }
              } else {
                console.warn('⚠️ REACH WEBHOOK: Missing leadId or userEmail', { leadId, userEmail });
              }
              
              // Clear the ref after timer fires
              webhookTimerRef.current = null;
            }, reachWebhookDelayMs); // 45 seconds (reach threshold)
            
            console.log(`✅ 45-SECOND REACH TIMER STARTED (ID: ${webhookTimerRef.current})`);
          }
        } else if (data.found && (data.status === 'completed' || data.status === 'failed')) {
          console.log('📞 REAL TWILIO WEBHOOK: Call ended', data);
          
          // Clear timer when call ends
          if (webhookTimerRef.current) {
            console.log('🧹 Clearing 60-second webhook timer - call ended');
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

    // Check immediately and then every 2 seconds during active call
    if (dialerState.dialingStatus === 'connected') {
      checkCallStatus();
      const interval = setInterval(checkCallStatus, 2000);
      return () => {
        clearInterval(interval);
        // Also clear timer on cleanup
        if (webhookTimerRef.current) {
          clearTimeout(webhookTimerRef.current);
          webhookTimerRef.current = null;
        }
      };
    }
  }, [dialerState.dialingStatus, dialerState.availableLeads, dialerState.currentLeadIndex, pstnAnswered, webhookTimerStarted, authState?.user?.email, authState?.profile]);

  // Auto-save position with TTL whenever currentLeadIndex changes (expires after 30 min inactivity)
  useEffect(() => {
    const userEmail = authState?.user?.email;
    if (userEmail) {
      savePositionWithTTL(userEmail, dialerState.currentLeadIndex);
      console.log(`💾 AUTO-SAVED POSITION: ${dialerState.currentLeadIndex} for ${userEmail}`);
    }
  }, [dialerState.currentLeadIndex, authState?.user?.email]);

  // Call lead mutation removed - using direct TestCall pattern instead



  // Guard dialLead() from broken state
  async function dialLead(specificLead?: Lead) {
    if (!authState.initialized || !authState.user?.email?.includes?.('@')) {
      toast({ title: 'Sign-in required', description: 'Please sign in to use the dialer.', variant: 'destructive' });
      return;
    }
    if (isCCPDemo) {
      console.log('🎭 DEMO MODE: Making real call to agent phone number from demo lead');
    }
    console.log('🚀 dialLead called - checking device and lead state');

    // Guard: FTC COMPLIANCE CHECK - Block calls outside 8 AM - 9 PM in lead's timezone
    let lead = specificLead || dialerState?.availableLeads?.[0];
    if (lead) {
      const isPermitted = isCallPermissibleFrontend(lead.state, (lead as any).ftcRestricted || (lead as any).ftcrestricted);
      if (!isPermitted) {
        console.error(`🚫 FTC VIOLATION: Removing ${lead.name} in ${lead.state} - outside calling hours`);
        
        // REMOVE this lead and ALL other FTC restricted leads from the queue
        const updatedLeads = dialerState.availableLeads.filter(l => {
          // Keep the current lead if it's the specific one requested (don't filter it if explicitly requested)
          if (specificLead && l.id === specificLead.id) {
            return false; // Remove the specific restricted lead
          }
          // Check if this lead is FTC compliant
          const isCompliant = isCallPermissibleFrontend(l.state, (l as any).ftcRestricted || (l as any).ftcrestricted);
          return isCompliant;
        });
        
        const removedCount = dialerState.availableLeads.length - updatedLeads.length;
        
        setDialerState(prev => ({
          ...prev,
          availableLeads: updatedLeads,
          availableLeadsCount: updatedLeads.length
        }));
        
        toast({
          title: '🚫 Lead Skipped - FTC Restriction',
          description: removedCount > 1 
            ? `${removedCount} leads removed - outside calling hours (8 AM - 9 PM). Moving to next compliant lead...`
            : `${lead.name} in ${lead.state} removed - outside calling hours (8 AM - 9 PM). Moving to next lead...`,
          variant: 'destructive',
          duration: 3000
        });
        
        // Try to dial the next COMPLIANT lead if available
        const nextCompliantLead = updatedLeads.find(l => {
          const compliant = isCallPermissibleFrontend(l.state, (l as any).ftcRestricted || (l as any).ftcrestricted);
          return compliant;
        });
        
        if (nextCompliantLead) {
          console.log(`🔄 Auto-dialing next FTC-compliant lead...`);
          setTimeout(() => dialLead(nextCompliantLead), 1000);
        } else if (updatedLeads.length > 0) {
          // Fallback: try first lead if any remain (shouldn't happen but safety check)
          console.log(`🔄 Auto-dialing first remaining lead...`);
          setTimeout(() => dialLead(updatedLeads[0]), 1000);
        } else {
          console.log(`❌ No more leads available`);
          toast({
            title: 'No Leads Available',
            description: 'All remaining leads are outside FTC calling hours',
            variant: 'destructive'
          });
        }
        
        throw new Error(`FTC violation: ${lead.state} outside calling hours - lead removed`);
      }
    }

    // Guard: Check WebRTC device readiness
    if (!device) {
      const errorMsg = 'WebRTC device not initialized';
      console.error('❌', errorMsg);
      toast({
        title: 'Device Not Ready',
        description: 'Click POWER ON first to initialize WebRTC',
        variant: 'destructive'
      });
      throw new Error(errorMsg);
    }

    // Guard: Check if there's already an active connection
    if ((window as any).twilioConnection) {
      console.log('⚠️ Active WebRTC connection detected, disconnecting first...');
      try {
        (window as any).twilioConnection.disconnect();
        (window as any).twilioConnection = null;
        console.log('✅ Existing connection disconnected - NO DELAY, device stays registered');
        // NO DELAY - device registration is preserved, only connection is disconnected
      } catch (error) {
        console.error('⚠️ Error disconnecting existing connection:', error);
      }
    }

    // Re-check lead after guards (may have been updated)
    lead = specificLead || dialerState?.availableLeads?.[0];
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

    console.log('📞 DIALING LEAD:', lead.name, lead.phone);
    setStatus(`Calling ${lead.name}...`);


    const leadIdForCall = Number((lead as any).id ?? (lead as any).leadId ?? 0);
    if (!Number.isFinite(leadIdForCall) || leadIdForCall <= 0) {
      throw new Error('Missing required leadId for outbound call');
    }
    const taalkLeadIdForCall = String((lead as any).taalk_lead_id || '').trim();

    // 📊 CALL TRACKING: Log the dial attempt to database
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
    console.log('✅ Call tracking logged successfully');

    // Update BOTH masterlead AND hotlead last_contacted timestamp when call is initiated
    await updateAllLeadLastContacted(lead.phone);

    // DISABLED: Hotlead priority system - no longer auto-prioritizing hotleads
    // if (lead.isHotLead || lead.market === 'Hot Lead') {
    //   try {
    //     console.log('🔄 Resetting hotlead priority to 0 for NEXT call:', lead.name);

    //     await fetch('/api/hotleads/reset-priority', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         leadId: lead.id,
    //         phone: lead.phone
    //       })
    //     });
    //     console.log('✅ Hotlead priority reset - will appear lower in NEXT queue refresh');
    //   } catch (error) {
    //     console.error('⚠️ Failed to reset hotlead priority:', error);
    //   }
    // }

    try {
      // DIRECT CALL: Producer Calls lead directly (NO CONFERENCE)
      console.log(`📞 Making DIRECT call to lead: ${lead.name} (${lead.phone})`);

      // Store lead info for display
      setDialerState(prev => ({ 
        ...prev, 
        currentCall: lead,
        callStatus: 'connecting_direct'
      }));

      // 🍎 MAC-SPECIFIC: Ensure microphone permission before connecting
      if (isMac()) {
        console.log('🍎 Mac detected - verifying microphone permission before connect...');
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
      const connection = await device.connect({
        params: {
          To: lead.phone.replace(/\D/g, ''),
          leadName: lead.name,
          leadState: lead.taalk_state || lead.state || 'Unknown',
          agentEmail: userEmail,
          agentName: (authState?.user as any)?.name || userEmail.split('@')[0] || 'Producer'
        }
      });

      console.log('✅ producer WebRTC connected for DIRECT call');
      (window as any).twilioConnection = connection;

      // Set up connection event listeners
      connection.on('accept', async () => {
        console.log('✅ producer WebRTC call accepted - DIRECT CALL CONNECTED');
        
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
            console.log('✅ Updated agent status to in_call');
          } catch (error) {
            console.warn('⚠️ Failed to update agent status to in_call:', error);
          }
        }
      });

      // PERSISTENT: Don't reset state on disconnect, keep WebRTC ready
      // CRITICAL: When remote party hangs up, KEEP currentCall + duration so agent can add disposition
      connection.on('disconnect', async () => {
        console.log('🔌 WebRTC call disconnected - KEEPING DEVICE ACTIVE (preserving lead for disposition)');
        setDialerState(prev => ({ 
          ...prev, 
          dialingStatus: 'ready',
          callStatus: 'idle',
          isConnected: false,
          webRTCConferenceActive: false,
          callDuration: prev.callDuration || 0, // Preserve for disposition validation
          // KEEP currentCall - agent needs it for disposition!
        }));
        setStatus('Call ended - add disposition, then Complete Call & Dial Next');
        toast({
          title: 'Call Ended',
          description: 'Please add a disposition before continuing to the next lead.',
          variant: 'default'
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
            console.log('✅ Updated agent status to ready');
          } catch (error) {
            console.warn('⚠️ Failed to update agent status to ready:', error);
          }
        }
      });

      connection.on('error', (error: any) => {
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
      // Don't destroy device on error, keep it active
      setDialerState(prev => ({ 
        ...prev, 
        dialingStatus: 'error',
        isConnected: false,
        // KEEP powered: true - WebRTC stays active!
      }));
      throw error;
    }
  }



  const disconnectWebRTCDevice = () => {
    if (device) {
      device.destroy();
      device = null;
    }
    setDialerState(prev => ({ ...prev, webRTCConferenceActive: false }));
  };

  // Power button handler - simplified for Call Connector Pro with debouncing
  const [isPowerToggling, setIsPowerToggling] = useState(false);

  // START DIALING - Initialize WebRTC AND dial the lead
  const testSimpleCall = async (lead: Lead) => {
    try {
      console.log(`📞 START DIALING: Initializing WebRTC and calling ${lead.name} at ${lead.phone}`);

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
        console.log('🍎 Mac detected - requesting microphone permission first...');
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
      console.log('🔌 Step 1: Initializing WebRTC device...');
      setStatus('Fetching token...');

      const res = await fetchTwilioVoiceToken(authState?.user?.email);
      const tokenData = await res.json();
      const token = tokenData.token;
      console.log('✅ Token received:', token?.slice(0, 50) + '...');
      console.log('✅ Token length:', token?.length, 'characters');

      const Device = TwilioDevice;
      if (!Device) {
        throw new Error('Twilio SDK not loaded');
      }

      console.log('🚀 Creating Twilio Device...');
      device = new Device(token, { debug: true });
      (window as any).twilioDevice = device;

      // Set up device events BEFORE registering
      device.on('connect', (connection: any) => {
        console.log('🔌 WebRTC CONNECTED:', connection);
      });

      device.on('disconnect', (connection: any) => {
        console.log('🔌 WebRTC DISCONNECTED:', connection);
      });

      device.on('error', (error: any) => {
        console.error('❌ WebRTC ERROR:', error);
      });

      device.on('ready', async () => {
        console.log('📞 Device ready - producer joins conference FIRST');
        setStatus('Creating conference...');
        

        // Generate unique conference name
        const agentId = authState?.user?.email?.split('@')[0] || 'producer';
        const uniqueConferenceName = `ConnectNow-${agentId}-${Date.now()}`;
        console.log(`🎧 producer joining conference: ${uniqueConferenceName}`);

        // 🍎 MAC-SPECIFIC: Ensure microphone permission before connecting
        if (isMac()) {
          console.log('🍎 Mac detected - verifying microphone permission before connect...');
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

        console.log('✅ producer WebRTC connected to conference');
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
          console.log(`✅ Lead call initiated to join conference - CallSID: ${result.callSid}`);

          setDialerState(prev => ({
            ...prev,
            dialingStatus: 'connected',
            currentCall: lead,
            currentConferenceName: uniqueConferenceName
          }));

          toast({
            title: 'Two-Way Call Connected!',
            description: `You are now connected with ${lead.name}`
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
        console.log('🎯 Device registered successfully - BYPASSING WEBRTC FOR DIRECT CALLING');
        setStatus('Device Ready - Starting Direct Call');
        clearTimeout(registrationTimeout);

        // SIMPLE WORKING APPROACH: Just call the lead directly
        console.log('📞 Making simple outbound call to lead...');

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
            console.log(`✅ Call initiated - CallSID: ${result.callSid}`);

            setDialerState(prev => ({
              ...prev,
              dialingStatus: 'connected',
              callStatus: 'connected'
            }));

            toast({
              title: 'Call Connected!',
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
        console.log('📴 Device unregistered');
        setStatus('Device Unregistered');
      });

      // Add registration timeout
      const registrationTimeout = setTimeout(() => {
        console.error('⏰ Registration timeout after 15 seconds');
        setStatus('Registration timeout - check network/firewall');
      }, 15000);

      console.log('📡 Registering WebRTC device...');
      setStatus('Registering WebRTC device...');

      // Clear timeout when ready event fires
      device.on('ready', () => {
        clearTimeout(registrationTimeout);
      });

      // 🍎 MAC-SPECIFIC: Microphone permission should already be granted from click handler
      // But verify again here as a safety check
      if (isMac()) {
        console.log('🍎 Mac detected - verifying microphone permission is still active before device.register()...');
        // On Mac, if permission was granted in click handler, we should be good
        // But double-check by trying to get the stream again (should succeed instantly if already granted)
        try {
          const checkStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          checkStream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking
          console.log('✅ Mac: Microphone permission confirmed active');
        } catch (error) {
          console.error('❌ Mac: Microphone permission lost or denied:', error);
          toast({
            title: 'Microphone Permission Lost',
            description: 'Microphone permission was lost. Please click Power On again and allow microphone access.',
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

  const handlePowerToggle = async () => {
    console.log("🔌 Power button clicked!");

    // Power on works for everyone - no upgrade required
    // Restrictions are on actual outbound dialing, not powering on WebRTC
    if (!isPoweredOn) {
      // 🍎 MAC-SPECIFIC: Request microphone permission IMMEDIATELY in click handler
      // This MUST be done synchronously from user gesture on Mac, not in async function
      // Store the stream globally so it stays active during device registration
      if (isMac()) {
        console.log('🍎 Mac detected - requesting microphone permission synchronously from click handler...');
        try {
          const micResult = await requestMicrophonePermission(true); // Keep stream active for registration
          if (!micResult.success) {
            // Show recovery modal if permission is broken
            if (micResult.needsRecovery) {
              setShowMicRecoveryModal(true);
            } else {
              toast({
                title: 'Microphone Permission Required',
                description: micResult.error || 'Please allow microphone access to make calls. Check System Preferences > Security & Privacy > Microphone.',
                variant: 'destructive',
                duration: 8000
              });
            }
            return; // Stop here if permission denied
          }
          // Store stream globally so it stays active during device registration
          if (micResult.stream) {
            (window as any).__macMicrophoneStream = micResult.stream;
            console.log('✅ Mac: Microphone stream stored globally, keeping active during registration');
          }
          console.log('✅ Mac: Microphone permission granted in click handler');
        } catch (error: any) {
          console.error('❌ Mac: Failed to request microphone permission:', error);
          // Show recovery modal on error
          setShowMicRecoveryModal(true);
          return; // Stop here if permission request fails
        }
      }

      const agentEmail = authState?.user?.email;
      if (!agentEmail || !agentEmail.includes('@')) {
        toast({ title: 'Sign-in required', description: 'You must be signed in to use the dialer.', variant: 'destructive' });
        return;
      }
      const macStream = isMac() ? (window as any).__macMicrophoneStream : undefined;
      const result = await powerOnWebRTC(agentEmail, agentEmail, macStream);
      if (result) {
        setIsPoweredOn(true);
        setDialerState(prev => ({ 
          ...prev, 
          webRTCConferenceActive: true, 
          powered: true
        }));
        // Sync eligible_for_hot_candidates when Recruit CCPRO powers on
        fetch('/api/vdp/recruit-hot-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: agentEmail, eligible: true }),
        }).catch((e) => console.warn('Recruit hot eligibility sync:', e));
        toast({
          title: 'WebRTC ready',
          description: 'Device powered on successfully'
        });
      } else {
        toast({
          title: 'Failed to power on',
          description: 'WebRTC initialization failed',
          variant: 'destructive'
        });
      }
    } else {
      console.log("🔻 Powering down...");
      device?.disconnectAll();
      if (device) {
        device.destroy();
        device = null;
      }
      setIsPoweredOn(false);
      setDialerState(prev => ({ 
        ...prev, 
        webRTCConferenceActive: false, 
        powered: false
      }));
      // Sync eligible_for_hot_candidates when Recruit CCPRO powers off
      const email = authState?.user?.email?.toLowerCase?.();
      if (email) {
        fetch('/api/vdp/recruit-hot-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, eligible: false }),
        }).catch(() => {});
      }
      toast({
        title: 'Powered down',
        description: 'WebRTC device disconnected'
      });
    }
  };

  // Call lead handler - Step 3E implementation
  const handleStartCall = async () => {
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

    try {
      console.log('🎯 START DIALING clicked - using Step 3 conference flow');

      // Step 1: Connect producer to conference via WebRTC
      dialLead();

      // Step 2: Dial the lead via REST API to join same conference (pass agent so Twilio/call analytics link correctly)
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
      console.log('💥 END CALL - ending lead\'s call but keeping WebRTC active...');
      
      const currentLead = getCurrentLead();
      
      // 🚨 CRITICAL: AOIntel leads MUST have a disposition before ending call
      if (currentLead) {
        const isAOIntel = currentLead.aointel === true || currentLead.aointel === 1 || 
                         String(currentLead.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
          console.log('🚨 AOIntel lead requires disposition before ending call');
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
      
      console.log('🔍 THROTTLING DEBUG:', {
        lastCounterTime,
        now,
        timeSinceLastCounter,
        twentySeconds: 20000,
        canIncrement: timeSinceLastCounter >= 20000
      });
      
      if (timeSinceLastCounter >= 5000) { // TEMPORARILY REDUCED TO 5 SECONDS FOR TESTING
        console.log('🔥 COMPLETE CALL BUTTON HIT - INCREMENTING COUNTER!');
        localStorage.setItem('lastCounterTime', now.toString());
        const plusLeadEvent = new CustomEvent('callCompleted', {
          detail: {
            agentEmail: authState.user?.email,
            leadType: 'plus'
          }
        });
        window.dispatchEvent(plusLeadEvent);
        console.log('🎯 COUNTER INCREMENT EVENT FIRED!');
      } else {
        const remaining = Math.ceil((5000 - timeSinceLastCounter) / 1000);
        console.log(`⏳ THROTTLED: Must wait ${remaining} more seconds before next counter increment`);
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
        console.log('🔔 Call completion event dispatched for hotlead tracking');
      }

      // 1. CRITICAL: Mark current lead as contacted FIRST
      if (dialerState.currentCall && authState?.user?.email) {
        try {
          const actualDisposition = dialerState.selectedDisposition || 'no_answer_vm';
          console.log(`📝 Saving disposition ${actualDisposition} for lead ${dialerState.currentCall.id} (DB primary key) for ${authState.user.email}`);
          await masterleadUpdateResolution({
            leadId: dialerState.currentCall.id,
            cnresolution: actualDisposition,
            agentEmail: authState.user?.email
          });
          console.log(`✅ Lead disposition saved to masterlead.cnresolution for lead ${dialerState.currentCall.id}`);
          
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

      // 2. Disconnect the WebRTC call (if there's an active connection)
      if ((window as any).twilioConnection) {
        try {
          console.log(`📞 Disconnecting WebRTC call`);
          (window as any).twilioConnection.disconnect();
          (window as any).twilioConnection = null;
          console.log('✅ WebRTC connection disconnected');
        } catch (error) {
          console.error('⚠️ Error disconnecting WebRTC:', error);
        }
      }

      // 3. KEEP WebRTC device active (don't destroy it!)
      console.log('🔌 Keeping WebRTC device active for next call');

      // 4. Reset call state and STOP all audio/music but KEEP SYSTEM ACTIVE
      // CRITICAL: Preserve viewedLead and currentLeadIndex - lead must stay on screen until "Complete Call & Dial Next"
      setDialerState(prev => ({
        ...prev,
        dialingStatus: 'ready', // Return to ready state, not idle
        webRTCConferenceActive: false, // Call ended
        campaignActive: false, // Set to paused state
        powered: true, // Keep WebRTC powered on
        currentCall: null,
        callStatus: 'idle',
        callDuration: 0
        // viewedLead and currentLeadIndex are preserved - lead stays visible
      }));

      // 5. Reset PSTN answered state
      setPstnAnswered(false);

      // 6. CRITICAL: Reset callState to 'idle' to prevent call from staying red
      setCallState('idle');

      // 5. Audio already stopped by stopAllAudio() call above

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
      console.log('✅ VDP disposition not required - already dispositioned locally');
      return false;
    }

    // If a disposition was already selected in the current session, allow navigation
    if (dialerState.selectedDisposition) {
      console.log('✅ VDP disposition not required - disposition already selected:', dialerState.selectedDisposition);
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

        console.log('🔍 VDP disposition check:', { hasAppointment: hasAppointment, hasVideoMeeting: hasVideoMeeting });

        // If appointment was booked or video meeting started, no disposition needed
        if (hasAppointment || hasVideoMeeting) {
          console.log('✅ VDP disposition not required - appointment/video meeting found');
          return false;
        }

        // Otherwise, disposition is required
        console.log('⚠️ VDP disposition required - no appointment/video meeting found');
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
        console.log('🔚 Checking VDP call disposition requirements...');

        // Check if disposition is required
        const needsDisposition = await checkVDPDispositionRequired();

        if (needsDisposition) {
          console.log('⚠️ VDP call requires disposition before lead change');

          toast({
            title: 'VDP Call Disposition Required',
            description: 'Please use the "Select Disposition..." dropdown below before changing leads',
            variant: 'destructive'
          });

          return false; // Block lead change until disposition is selected
        }

        console.log('🔚 Ending VDP call due to lead change...');

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
          console.log('✅ VDP call ended successfully');

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
        console.log('🚨 Cannot skip AOIntel lead - disposition is required');
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
      console.log('Could not play next lead sound:', error);
    }

    // Use auto-switching logic to determine next index
    const nextIndex = handleQueueAutoSwitch(dialerState.currentLeadIndex);
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
      console.log('Could not play previous lead sound:', error);
    }

    // Stay within visible range (0-2)
    const visibleLeadCount = Math.min(3, dialerState.availableLeads.length);
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
      console.log(`🔄 AUTO-SWITCH: ${isCurrentHotlead ? 'Hotlead' : 'Regular lead'} queue exhausted, switching to ${switchingTo}`);
      
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
      console.log('🚫 Next Lead: No available leads');
      return;
    }

    console.log('🔄 Next Lead: Current state:', {
      currentIndex: dialerState.currentLeadIndex,
      totalLeads: dialerState.availableLeads.length,
      currentLead: dialerState.availableLeads[dialerState.currentLeadIndex]?.name
    });

    // If there's only one lead, try to load more leads first
    if (dialerState.availableLeads.length === 1) {
      console.log('⚠️ Only 1 lead available! Attempting to load more leads...');
      toast({
        title: 'Loading More Leads',
        description: 'Only one lead available - loading more leads for rotation',
      });
    }

    // Check VDP disposition requirements before changing leads
    const canProceed = await endVDPCallOnLeadChange();
    if (!canProceed) {
      console.log('🚫 Next Lead: Blocked by VDP disposition requirement');
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
      console.log('Could not play next lead sound:', error);
    }

    // SIMPLE NAVIGATION: Stay within visible range (0-2)
    const visibleLeadCount = Math.min(3, dialerState.availableLeads.length);
    const nextIndex = (dialerState.currentLeadIndex + 1) % visibleLeadCount;

    console.log('🎯 Next Lead: Moving from index', dialerState.currentLeadIndex, 'to index', nextIndex);
    console.log('🎯 Next Lead: New lead will be:', dialerState.availableLeads[nextIndex]?.name);

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
    const nextTab: 'hotlead' | 'hotcandidates' | 'plus' | 'aointel' =
      value === 'hotcandidates' ? 'hotcandidates' : value === 'plus' ? 'plus' : value === 'aointel' ? 'aointel' : 'hotlead';

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

    const targetQueue =
      nextTab === 'hotcandidates' ? hotCandidatesQueue : nextTab === 'aointel' ? aoiIntelQueue : nextTab === 'hotlead' ? myCandidatesQueue : plusLeadsQueue;
    
    // 🔍 DEBUG: Log queue switch
    console.log(`🔄 Queue Tab Changed to: ${nextTab}`, {
      targetQueueLength: targetQueue.length,
      plusLeadsQueueLength: plusLeadsQueue.length,
      hotleadQueueLength: hotleadQueue.length,
      aoiIntelQueueLength: aoiIntelQueue.length,
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
      console.log(`⚠️ ${nextTab === 'hotlead' ? 'Hotlead' : 'Plus'} queue is empty`);
    } else {
      console.log(`🔁 Switched to ${nextTab} queue (lead ${safeIndex + 1} of ${targetQueue.length})`);
    }
  };
  
  // Update call state based on dialerState
  useEffect(() => {
    if (!dialerState.powered) {
      setCallState('offline');
    } else if (dialerState.dialingStatus === 'dialing' || dialerState.callStatus === 'connected' || dialerState.webRTCConferenceActive) {
      setCallState('on-call');
    } else if (dialerState.powered && dialerState.availableLeads.length > 0) {
      setCallState('idle');
    } else {
      setCallState('idle');
    }
  }, [dialerState.powered, dialerState.dialingStatus, dialerState.callStatus, dialerState.webRTCConferenceActive, dialerState.availableLeads.length]);
  
  // Auto-bind lead when idle
  useEffect(() => {
    if (callState === 'idle' && dialerState.availableLeads.length > 0 && dialerState.currentLeadIndex >= dialerState.availableLeads.length) {
      // Auto-bind first FTC-compliant lead
      const firstCompliantIndex = dialerState.availableLeads.findIndex((lead: Lead) => 
        isCallPermissibleFrontend(lead.state, lead.ftcrestricted)
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
  }, [callState, dialerState.availableLeads, dialerState.currentLeadIndex]);

  const handleSelectLeadFromList = async (
    lead: any,
    index: number,
    options?: { queueType?: 'hotlead' | 'hotcandidates' | 'plus' | 'aointel' }
  ) => {
    const queueType = options?.queueType;
    const targetQueue =
      queueType === 'hotlead'
        ? hotleadQueue
        : queueType === 'hotcandidates'
          ? hotCandidatesQueue
          : queueType === 'aointel'
            ? aoiIntelQueue
            : queueType === 'plus'
              ? plusLeadsQueue
              : dialerState.availableLeads;
    const queueLength = targetQueue.length;
    const normalizedIndex = typeof index === 'number' ? index : -1;
    const previousQueueIndex =
      queueType === 'hotlead'
        ? queuePositions.hotlead ?? -1
        : queueType === 'hotcandidates'
          ? queuePositions.hotcandidates ?? -1
          : queueType === 'aointel'
            ? queuePositions.aointel ?? -1
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
    const currentCallDuration = callDurationSeconds || dialerState.callDuration || 0;

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

    console.log('📋 Setting call disposition:', disposition);

    // If there's an active VDP call, mark it as dispositioned and end it
    if (dialerState.vdpCallStatus?.hasVDPCall) {
      console.log('🔔 VDP call dispositioned:', disposition);
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
        console.log('✅ Call disposition saved to history - Click "APPLY" to save to masterlead');

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
      console.log('↩️ UNDO: Reverting to previous state...', undoState);

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

    // Throttling removed - agents must start a call first, so no throttling needed

    const actualDisposition = dialerState.selectedDisposition || 'no_answer_vm';
    
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
    console.log(`📝 APPLY Disposition: Saving ${actualDisposition} for lead ${leadIdForUpdate} to masterlead.cnresolution`);

    try {
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

      // Mark disposition as applied - lead stays visible until "Complete Call & Dial Next"
      setDialerState((prev) => ({
        ...prev,
        dispositionApplied: true
      }));

      // 🔥 DO NOT invalidate queries here - lead must stay visible until "Complete Call & Dial Next"
      // Query invalidation will happen in handleCompleteCall when agent is ready to move on
      console.log('✅ Disposition applied - lead stays visible until Complete Call & Dial Next');

      console.log('✅ Disposition applied to masterlead.cnresolution - Lead stays visible until Complete Call');
      toast({
        title: 'Disposition Applied',
        description: 'Disposition applied.',
      });
    } catch (error: any) {
      console.error('❌ Error applying disposition:', error);
      console.error('   Lead ID:', leadToDisposition?.id || leadToDisposition?.taalk_lead_id);
      console.error('   Disposition:', actualDisposition);
      console.error('   Agent:', authState.user?.email);

      // Do not block agent flow on write errors; log and continue.
      setDialerState((prev) => ({
        ...prev,
        dispositionApplied: true,
      }));
      toast({
        title: 'Disposition Applied',
        description: 'Disposition applied.',
      });
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
    if (dialerState.dialingStatus === 'ringing') {
      toast({
        title: 'Incoming call active',
        description: 'Accept or end the incoming call first, then Start Dialing.',
        variant: 'destructive',
      });
      return;
    }
    const { availableLeads } = dialerState;

    if (availableLeads.length === 0) {
      toast({
        title: 'No Leads Available',
        description: 'Please load leads before starting dialing',
        variant: 'destructive'
      });
      return;
    }

    if (!dialerState.webRTCConferenceActive) {
      toast({
        title: 'System Offline',
        description: 'Please power on Call Connector Pro first',
        variant: 'destructive'
      });
      return;
    }

    const firstLead = availableLeads[0];

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

    // Use new WebRTC + PSTN conference approach
    dialLead();
  };

  // Call a specific lead - DIRECT WebRTC call (no conferences)
  const handleCallLead = async (lead: Lead) => {
    // 🎭 DEMO MODE: Make REAL call to agent's phone number (from demo lead)
    if (isCCPDemo) {
      console.log('🎭 DEMO MODE: Making real call to agent phone number:', lead.phone);
    }
    
    try {
      console.log('📞 DIRECT CALL: producer WebRTC calling lead directly');
      console.log('📞 Calling lead:', lead.name, lead.phone);

      setDialerState((prev) => ({
        ...prev,
        dialingStatus: 'dialing',
        currentCall: lead,
      callStatus: 'connecting_direct'
      }));

      const device = (window as any).twilioDevice;
      if (!device) {
        throw new Error('WebRTC device not initialized. Please power on first.');
      }

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
        console.log('🍎 Mac detected - verifying microphone permission before connect...');
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
      console.log('📞 Making DIRECT WebRTC call to lead phone number...');
      const connection = await device.connect({
        params: { 
          To: lead.phone.replace(/\D/g, ''),
          leadName: lead.name,
          leadState: lead.taalk_state || lead.state || 'Unknown',
          agentEmail: directUserEmail,
          agentName: (authState?.user as any)?.name || directUserEmail.split('@')[0] || 'Producer'
        }
      });

      // Store connection globally for call management
      (window as any).twilioConnection = connection;

      setDialerState((prev) => ({
        ...prev,
        callStatus: 'calling_direct'
      }));

      // Listen for connection events
      connection.on('accept', () => {
        console.log('✅ Direct call connected - producer can hear and talk to lead');
        setDialerState((prev) => ({
          ...prev,
          callStatus: 'connected_direct'
        }));
        toast({
          title: 'Call Connected',
          description: 'You are now directly connected to the lead'
        });
      });

      connection.on('disconnect', () => {
        console.log('📴 Direct call ended - preserving lead for disposition');
        let duration = 0;
        setDialerState((prev) => {
          duration = prev.callDuration || 0;
          return {
            ...prev,
            callStatus: 'idle',
            dialingStatus: 'ready',
            webRTCConferenceActive: false,
            isConnected: false,
            callDuration: duration,
            // KEEP currentCall - agent needs it for disposition
          };
        });
        (window as any).twilioConnection = null;
        toast({
          title: 'Call Ended',
          description: 'Please add a disposition before continuing to the next lead.',
          variant: 'default'
        });
      });

      console.log('✅ Direct WebRTC call initiated');

      toast({
        title: 'Calling Lead',
        description: 'Direct connection in progress...'
      });
      console.log('📞 STEP 2: Making outbound call to lead and merging into conference...');

      setDialerState((prev) => ({
        ...prev,
        callStatus: 'dialing_lead',
      dialingStatus: 'dialing'
      }));

      // START SEARCH FOR CALL MUSIC while waiting for client to answer
      console.log('🎵 Starting search for call music while waiting for client...');
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
              console.log('🎵 Audio context closed');
            }
          } catch (e) {
            console.log('🎵 Audio context close error:', e);
          }

          console.log('🎵 Search music stopped');
        };

        toast({
          title: 'Searching for Client',
          description: 'Playing search music while connecting...'
        });

      } catch (audioError) {
        console.log('🎵 Search music not available:', audioError);
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
      console.log('✅ Call tracking logged successfully');

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

      if (!callResponse.ok) {
        throw new Error('Failed to initiate outbound call to lead');
      }

      const callResult = await callResponse.json();
      console.log('📞 Outbound call result:', callResult);

      // STOP SEARCH MUSIC when call connects
      if ((window as any).stopSearchMusic) {
        (window as any).stopSearchMusic();
      }

      setDialerState((prev) => ({
        ...prev,
        callStatus: 'connected',
        dialingStatus: 'connected',
        currentCall: lead
      }));

      toast({
        title: 'Call Connected',
        description: `Outbound call to ${lead.name} merged into conference`
      });

    } catch (error) {
      console.error('❌ Call failed:', error);
      const errMsg = String((error as any)?.message || '').toLowerCase();
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
              failureReason: String((error as any)?.message || '').slice(0, 300),
              autoAdvance: true,
            }),
          });
        } catch (markErr) {
          console.warn('⚠️ Recruit auto-failed disposition write failed:', markErr);
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
      }

      // STOP SEARCH MUSIC on call failure
      if ((window as any).stopSearchMusic) {
        (window as any).stopSearchMusic();
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
      console.log('✅ Complete Call: ENDING LEAD\'S CALL AND MOVING TO NEXT...');


      // Button is already disabled if callDurationSeconds <= 0, so no need to check here

      // 0. Stop all audio/music
      stopAllAudio();

      const currentLead = getCurrentLead();

      // 🚨 CRITICAL: AOIntel leads MUST have a disposition before moving on
      if (currentLead) {
        const isAOIntel = currentLead.aointel === true || currentLead.aointel === 1 || 
                         String(currentLead.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
          console.log('🚨 AOIntel lead requires disposition before moving on');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned before moving to the next lead. Please select a disposition.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block lead change - disposition is mandatory for AOIntel leads
        }
      }

      // 🚨 CRITICAL: Block completing call if it was answered and lasted over 110 seconds without a proper disposition
      // This prevents agents from churning through leads by immediately ending answered calls
      if (currentLead && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        const currentCallDuration = callDurationSeconds || 0;
        
        if (currentCallDuration > 110) {
          console.log(`🚨 BLOCKED: Call was answered and lasted ${currentCallDuration}s - disposition required`);
          toast({
            title: 'Disposition Required',
            description: `This call was answered and lasted ${currentCallDuration} seconds. You must select a proper disposition (callback, not_interested, booked, etc.) before moving to the next lead.`,
            variant: 'destructive',
            duration: 7000
          });
          return; // Block - cannot skip answered calls over 110 seconds
        }
      }

      // Check VDP disposition requirements before changing leads
      const canProceed = await endVDPCallOnLeadChange();
      if (!canProceed) {
        return; // Block lead change if disposition required
      }

      // 1. If disposition hasn't been applied yet, apply it now (shouldn't happen if workflow is followed)
      if (!dialerState.dispositionApplied && dialerState.selectedDisposition) {
        console.log('⚠️ Disposition not applied yet - applying now before completing call');
        await handleApplyDisposition(saleData);
      }

      // 1.5. If NO disposition was selected/applied, mark lead as "called" in masterlead
      // Note: currentLead already declared above, reuse it
      // 🚨 EXCEPTION: AOIntel leads cannot be marked as "called" without disposition - they must be dispositioned
      // 🚨 EXCEPTION: Calls over 110 seconds cannot be marked as "called" - they must be dispositioned
      if (currentLead && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        const currentCallDuration = callDurationSeconds || 0;
        
        // Double-check: If call was over 110 seconds, block marking as "called"
        if (currentCallDuration > 110) {
          console.log(`🚨 BLOCKED: Cannot mark call as "called" - duration ${currentCallDuration}s requires proper disposition`);
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
          console.log('🚨 Cannot mark AOIntel lead as "called" without disposition - blocking');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned. Please select a disposition before completing the call.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block - AOIntel leads require disposition
        }
        
        console.log('📞 No disposition selected - marking lead as "called" in masterlead');
        try {
          await masterleadUpdateResolution({
            leadId: currentLead.id,
            leadPhone: currentLead.phone,
            cnresolution: 'called',
            agentEmail: authState?.user?.email
          });
          console.log('✅ Lead marked as "called" in masterlead');
        } catch (error) {
          console.error('❌ Error marking lead as "called":', error);
        }
      }

      // 2. End the lead's call (if there's an active call)
      if (dialerState.currentCall && dialerState.currentCall.phone && dialerState.currentConferenceName) {
        try {
          console.log(`📞 Ending lead's call to: ${dialerState.currentCall.phone}`);
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
          console.log('📞 Lead call end result:', result);
        } catch (error) {
          console.error('⚠️ Error ending lead call:', error);
        }
      }

      // 3. KEEP WebRTC device active (don't destroy it!)
      console.log('🔌 Keeping WebRTC device active for next call');

      // 4. REMOVE COMPLETED LEAD - KEEP CURRENT INDEX AT 0 (POSITION 1)
      const completedLead = dialerState.availableLeads[dialerState.currentLeadIndex];
      const updatedLeads = dialerState.availableLeads.filter((_, index) => index !== dialerState.currentLeadIndex);
      console.log(`🎯 REMOVING COMPLETED LEAD: ${completedLead?.name} - ${updatedLeads.length} leads remaining`);

      // Clear undo state when completing call (can't undo after moving to next lead)
      setUndoState(null);

      // 4. Reset call state, keep current index at 0, remove completed lead, RESET DISPOSITION for new lead
      setDialerState(prev => ({ 
        ...prev, 
        leads: updatedLeads,
        availableLeads: updatedLeads,
        currentLeadIndex: 0, // ALWAYS STAY AT POSITION 1
        dialingStatus: 'idle',
        webRTCConferenceActive: false, // Conference ended but WebRTC stays active
        powered: true, // Keep WebRTC powered on
        currentCall: null,
        currentConferenceName: undefined,
        selectedDisposition: '', // Reset disposition for NEW lead
        dispositionApplied: false, // Reset applied status for NEW lead
        callNotes: '' // Clear notes for new lead
      }));

      // 5. Force stop any playing audio/music
      try {
        // DON'T call disconnectAll() - only disconnect the active connection
        if ((window as any).twilioConnection) {
          console.log('🔇 Disconnecting active WebRTC connection (keeping device registered)');
          (window as any).twilioConnection.disconnect();
          (window as any).twilioConnection = null;
        }

        // Stop any HTML5 audio elements that might be playing
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
          if (!audio.paused) {
            console.log('🔇 Stopping HTML5 audio element');
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
                  console.log('🔇 Stopping audio track');
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

      // 🔥 NOW invalidate queries to refresh lead queue after lead has been removed
      console.log('🔄 Complete Call - invalidating queries to refresh lead queue');
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/leads'] });
      
      // Also clear server cache to ensure fresh data
      if (authState.user?.email) {
        try {
          await fetch(`/api/admin/force-refresh-leads/${encodeURIComponent(authState.user.email)}`, { method: 'POST' });
          console.log('✅ Server cache cleared for immediate lead refresh');
        } catch (error) {
          console.error('Failed to clear cache:', error);
        }
      }

      // Get next lead after removal (index stays at 0)
      const nextLead = updatedLeads[0];
      const nextLeadName = nextLead?.name || 'Unknown';

      toast({
        title: 'Call Completed - Advanced to Next Lead',
        description: `Now viewing: ${nextLeadName} (1 of ${updatedLeads.length})`
      });

      // Auto-dialing removed - agents must manually dial next lead

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
      console.log('🔄 Redial: same teardown as Complete & Dial Next, then dial SAME lead...');

      const currentLead = getCurrentLead();
      if (!currentLead) {
        toast({
          title: 'No Lead to Redial',
          description: 'No current lead available for redial',
          variant: 'destructive'
        });
        return;
      }

      if (!dialerState.powered || dialerState.availableLeads.length === 0) {
        toast({
          title: 'Cannot Redial',
          description: 'WebRTC not powered on or no leads available',
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
        // 0. Stop all audio (same as Dial Next)
        stopAllAudio();

        // 1. END CONFERENCE (same as handleDialNextLead)
        if (dialerState.currentConferenceName) {
          try {
            console.log(`[REDIAL] Ending conference: ${dialerState.currentConferenceName}`);
            await fetch('/api/end-conference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conferenceName: dialerState.currentConferenceName }),
            });
          } catch (error) {
            console.error('⚠️ Error ending conference on redial', error);
          }
        }

        // 2. DISCONNECT WEBRTC (same as handleDialNextLead)
        if (device && (window as any).twilioConnection) {
          try {
            console.log('[REDIAL] Disconnecting WebRTC connection...');
            (window as any).twilioConnection.disconnect();
            (window as any).twilioConnection = null;
          } catch (error) {
            console.error('⚠️ Error disconnecting WebRTC on redial', error);
          }
        }
      }

      // 3. Clear call state but KEEP same lead and index
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

      // 4. Dial same lead after same delay as Dial Next
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

  // Dial Next Lead Handler - END CONFERENCE AND DIAL NEXT
  const handleDialNextLead = async () => {
    try {
      // Capture call duration BEFORE resetting it (needed for disposition validation)
      const currentCallDuration = callDurationSeconds || dialerState.callDuration || 0;
      
      console.log('📞 Dial Next Lead: ENDING CONFERENCE AND DIALING NEXT...');
      console.log('🔍 Dial Next State Check:', {
        currentConferenceName: dialerState.currentConferenceName,
        webRTCConferenceActive: dialerState.webRTCConferenceActive,
        availableLeadsCount: dialerState.availableLeads.length,
        currentLeadIndex: dialerState.currentLeadIndex,
        callDuration: currentCallDuration
      });

      // 0. Stop all audio/music
      stopAllAudio();

      const currentLeadForDialNext = getCurrentLead();

      // 🚨 CRITICAL: AOIntel leads MUST have a disposition before moving on
      if (currentLeadForDialNext) {
        const isAOIntel = currentLeadForDialNext.aointel === true || currentLeadForDialNext.aointel === 1 || 
                         String(currentLeadForDialNext.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
          console.log('🚨 AOIntel lead requires disposition before moving on');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned before moving to the next lead. Please select a disposition.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block lead change - disposition is mandatory for AOIntel leads
        }
      }

      // 🚨 CRITICAL: Block dialing next if call was answered and lasted over 110 seconds without a proper disposition
      // This prevents agents from churning through leads by immediately ending answered calls
      if (currentLeadForDialNext && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        if (currentCallDuration > 110) {
          console.log(`🚨 BLOCKED: Call was answered and lasted ${currentCallDuration}s - disposition required`);
          toast({
            title: 'Disposition Required',
            description: `This call was answered and lasted ${currentCallDuration} seconds. You must select a proper disposition (callback, not_interested, booked, etc.) before moving to the next lead.`,
            variant: 'destructive',
            duration: 7000
          });
          return; // Block - cannot skip answered calls over 110 seconds
        }
      }

      // Check VDP disposition requirements before changing leads
      console.log('🔍 Checking VDP disposition requirements...');
      const canProceed = await endVDPCallOnLeadChange();
      console.log('🔍 VDP check result:', { canProceed });
      if (!canProceed) {
        console.log('❌ Dial Next Lead: VDP disposition required, aborting');
        toast({
          title: 'VDP Disposition Required',
          description: 'Please complete the VDP disposition before proceeding',
          variant: 'destructive'
        });
        return; // Block lead change if disposition required
      }

      // Reset call duration when moving to next lead (after validation checks)
      setCallDurationSeconds(0);

      // 0.5. If NO disposition was selected/applied, mark lead as "called" in masterlead
      // 🚨 EXCEPTION: Calls over 110 seconds cannot be marked as "called" - they must be dispositioned
      // 🚨 EXCEPTION: AOIntel leads cannot be marked as "called" without disposition
      if (currentLeadForDialNext && !dialerState.dispositionApplied && !dialerState.selectedDisposition) {
        // Double-check: If call was over 110 seconds, block marking as "called"
        if (currentCallDuration > 110) {
          console.log(`🚨 BLOCKED: Cannot mark call as "called" - duration ${currentCallDuration}s requires proper disposition`);
          toast({
            title: 'Disposition Required',
            description: `This call lasted ${currentCallDuration} seconds. You must select a proper disposition before moving to the next lead.`,
            variant: 'destructive',
            duration: 7000
          });
          return; // Block - cannot mark as "called" if over 110 seconds
        }
        
        const isAOIntel = currentLeadForDialNext.aointel === true || currentLeadForDialNext.aointel === 1 || 
                         String(currentLeadForDialNext.cnresolution || '').toLowerCase() === 'aointel';
        
        if (isAOIntel) {
          console.log('🚨 Cannot mark AOIntel lead as "called" without disposition - blocking');
          toast({
            title: 'Disposition Required',
            description: 'AOIntel leads must be dispositioned. Please select a disposition before moving to the next lead.',
            variant: 'destructive',
            duration: 5000
          });
          return; // Block - AOIntel leads require disposition
        }
        console.log('📞 No disposition selected - marking lead as "called" in masterlead');
        try {
          await masterleadUpdateResolution({
            leadId: currentLeadForDialNext.id,
            leadPhone: currentLeadForDialNext.phone,
            cnresolution: 'called',
            agentEmail: authState?.user?.email
          });
          console.log('✅ Lead marked as "called" in masterlead');
        } catch (error) {
          console.error('❌ Error marking lead as "called":', error);
        }
      }

      // 1. END ENTIRE CONFERENCE (both producer and lead)
      if (dialerState.currentConferenceName) {
        try {
          console.log(`☠️ Ending entire conference: ${dialerState.currentConferenceName}`);
          const response = await fetch('/api/end-conference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conferenceName: dialerState.currentConferenceName
            })
          });

          const result = await response.json();
          console.log('☠️ Conference end result:', result);
        } catch (error) {
          console.error('⚠️ Error ending conference:', error);
        }
      }

      // 2. DISCONNECT CURRENT WEBRTC CONNECTION
      if (device && (window as any).twilioConnection) {
        try {
          console.log('🔌 Disconnecting current WebRTC connection...');
          (window as any).twilioConnection.disconnect();
          (window as any).twilioConnection = null;
          console.log('✅ WebRTC connection disconnected');
        } catch (error) {
          console.error('⚠️ Error disconnecting WebRTC:', error);
        }
      }

      // 3. REMOVE COMPLETED LEAD - KEEP CURRENT INDEX AT 0 (POSITION 1)
      const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
      const updatedLeads = dialerState.availableLeads.filter((_, index) => index !== dialerState.currentLeadIndex);
      console.log(`🎯 REMOVING COMPLETED LEAD: ${currentLead?.name} - ${updatedLeads.length} leads remaining`);

      // Track position 0 (always position 1)
      trackproducerPosition(0);

      // Preserve call duration - don't reset it until new call starts
      const preservedDuration = callDurationSeconds > 0 ? callDurationSeconds : dialerState.callDuration || 0;
      
      setDialerState(prev => ({ 
        ...prev, 
        leads: updatedLeads,
        availableLeads: updatedLeads,
        currentLeadIndex: 0, // ALWAYS STAY AT POSITION 1
        dialingStatus: 'idle',
        webRTCConferenceActive: false,
        currentCall: null,
        currentConferenceName: undefined,
        powered: true, // Keep WebRTC powered on
        selectedDisposition: null, // Reset disposition for NEW lead
        callNotes: '', // Clear notes for new lead
        callDuration: preservedDuration // PRESERVE duration until new call starts
      }));

      // 4. Audio already stopped by stopAllAudio() call above

      // 5. AUTO-DIAL NEXT LEAD
      if (updatedLeads.length > 0) {
        console.log('🔄 Auto-dialing next lead after completing call...');
        // Small delay to ensure state update has processed
        setTimeout(() => {
          dialLead(updatedLeads[0]); // Next lead is now at index 0
        }, 500);
      } else {
        console.log('❌ No more leads available - cannot auto-dial');
        toast({
          title: 'No More Leads',
          description: 'All leads have been completed',
          variant: 'default'
        });
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

  // Double dial: first Complete = redial same, second = dial next (no hotlead check in Recruit)
  const handleCompleteCallThenRedialOrDialNext = async () => {
    if (doubleDialMode && doubleDialNextIsRedial) {
      await handleRedial();
      setDoubleDialNextIsRedial(false);
    } else {
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

  // DISCLAIMER BLOCKING REMOVED - All users bypass disclaimers

  const leadDisplayQueueTab: 'hotlead' | 'plus' | 'aointel' =
    activeQueueTab === 'aointel' ? 'aointel' : activeQueueTab === 'plus' ? 'plus' : 'hotlead';

  return (
    <div className="w-full max-w-full overflow-x-hidden pl-0 pr-0 pt-0 pb-0">
      {/* 🎭 DEMO MODE Banner */}
      {isCCPDemo && (
        <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 rounded-lg p-4 text-white border-2 border-yellow-400 shadow-lg mb-3">
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

      {/* Same split as /connect OutboundDialerInterface: left = stats header + lead + queue + CallControls; right = VDP + inbound + live queue */}
      <div className="flex flex-col lg:flex-row gap-2 md:gap-3 items-start w-full min-h-[calc(100vh-280px)]">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Header — matches Connect gradient bar (rounded-xl, shadow) */}
          <div
            className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-xl px-3 py-2.5 text-white w-full mb-2 shadow-lg shrink-0 relative"
            style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-xl pointer-events-none" />
            <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center shrink-0">
                <CCProRankBadge />
              </div>
              <div className="flex-1 flex justify-center items-center min-w-0">
                <div className="flex items-center gap-1.5 flex-nowrap transition-opacity">
                  {[
                    { label: 'D', value: dailyStats?.total_dialed ?? dailyStats?.todayDialed ?? 0, color: 'text-blue-200' },
                    { label: 'R', value: dailyStats?.reached ?? 0, color: 'text-amber-200' },
                    { label: 'B', value: dailyStats?.booked ?? 0, color: 'text-emerald-200' },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 min-w-[40px]">
                      <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider leading-none">{s.label}</span>
                      <span className={`text-base font-black tabular-nums leading-tight ${s.color}`}>{s.value}</span>
                    </div>
                  ))}
                  {(() => {
                    const pos = recruitInboundQueuePosition;
                    const tier = !pos ? 'off' : pos === 1 ? 'first' : pos === 2 ? 'second' : pos <= 5 ? 'hot' : pos <= 10 ? 'warm' : 'cool';
                    const posColor = tier === 'first' ? 'text-amber-300' : tier === 'second' ? 'text-red-400' : tier === 'hot' ? 'text-orange-400' : tier === 'warm' ? 'text-purple-400' : 'text-white';
                    const posBorder = tier === 'first' ? 'border-amber-400/60' : tier === 'second' ? 'border-red-400/50' : tier === 'hot' ? 'border-orange-400/40' : 'border-white/15';
                    const posBg = tier === 'first' ? 'bg-amber-500/20' : tier === 'second' ? 'bg-red-500/15' : 'bg-white/10';
                    const posGlow = tier === 'first' ? '0 0 12px rgba(251,191,36,0.5)' : tier === 'second' ? '0 0 10px rgba(239,68,68,0.4)' : 'none';
                    return (
                      <div
                        className={`flex flex-col items-center px-2.5 py-1 rounded-lg border min-w-[40px] transition-all duration-500 ${posBg} ${posBorder} ${!pos ? 'opacity-50' : ''} ${tier === 'first' ? 'animate-pulse' : ''}`}
                        style={{ boxShadow: posGlow }}
                        title="Queue position"
                      >
                        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider leading-none">POS</span>
                        <span className={`text-base font-black tabular-nums leading-tight ${posColor}`}>
                          {pos ? `#${pos}` : '—'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQueueTabChange('hotlead')}
                    disabled={callState === 'on-call'}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeQueueTab === 'hotlead' ? 'bg-white text-purple-600 shadow-md' : 'bg-white/15 border border-white/20 text-white hover:bg-white/25'} ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>My Candidates</span>
                    {myCandidatesQueue.length > 0 && (
                      <span className="absolute -top-1.5 -right-1 bg-purple-500 text-white text-[9px] font-black rounded-full min-h-[18px] min-w-[18px] px-1 flex items-center justify-center leading-none">
                        {myCandidatesQueue.length}
                      </span>
                    )}
                  </button>
                  {activeQueueTab === 'hotlead' && (
                    <Select
                      value={selectedCandidateStage === 'all' ? 'all' : `stage:${String(selectedCandidateStage)}`}
                      onValueChange={handleMyCandidatesStagePickerChange}
                    >
                      <SelectTrigger className="w-[220px] h-8 bg-white/20 border-white/30 text-white text-[10px]">
                        <SelectValue placeholder="Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages ({totalCandidatesCount})</SelectItem>
                        <SelectSeparator />
                        {stageGroupsForPicker.map((group: { id: number; name: string; candidates: any[] }) => (
                          <SelectGroup key={group.id}>
                            <SelectLabel>{group.name} ({group.candidates.length})</SelectLabel>
                            <SelectItem value={`stage:${group.id}`}>
                              View {group.name}
                            </SelectItem>
                            {group.candidates.map((candidate: any) => (
                              <SelectItem key={`candidate-${candidate.id}`} value={`candidate:${candidate.id}`}>
                                {`- ${(candidate.name || `${candidate.first_name || ''} ${candidate.last_name || ''}` || 'Unknown').trim()}`}
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleQueueTabChange('hotcandidates')}
                  disabled={callState === 'on-call'}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeQueueTab === 'hotcandidates' ? 'bg-white text-orange-600 shadow-md' : 'bg-white/15 border border-white/20 text-white hover:bg-white/25'} ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-[11px]">🔥</span>
                  <span>Hot</span>
                  {hotCandidatesQueue.length > 0 && (
                    <span className="absolute -top-1.5 -right-1 bg-orange-500 text-white text-[9px] font-black rounded-full min-h-[18px] min-w-[18px] px-1 flex items-center justify-center leading-none">
                      {hotCandidatesQueue.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleQueueTabChange('aointel')}
                  disabled={callState === 'on-call'}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeQueueTab === 'aointel' ? 'bg-white text-blue-600 shadow-md' : 'bg-white/15 border border-white/20 text-white hover:bg-white/25'} ${callState === 'on-call' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-[11px]">🎯</span>
                  <span>AO Recruit</span>
                  {aoiIntelQueue.length > 0 && (
                    <span className="absolute -top-1.5 -right-1 bg-indigo-500 text-white text-[9px] font-black rounded-full min-h-[18px] min-w-[18px] px-1 flex items-center justify-center leading-none">
                      {aoiIntelQueue.length}
                    </span>
                  )}
                </button>
                <div className={`relative w-[min(100%,200px)] ${isSearchFocused ? 'min-w-[180px]' : 'min-w-[120px]'}`}>
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/80 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    disabled={callState === 'on-call'}
                    className="pl-8 pr-2 h-8 bg-white/15 border-white/25 text-white placeholder:text-white/55 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0" ref={searchContainerRef}>
          {/* Search Results Display */}
          {searchQuery.trim().length >= 2 && (
            <div className="space-y-3">
              {isSearching && (
                <Card className="border-slate-200">
                  <CardContent className="py-3 text-xs text-slate-500">
                    Searching leads…
                  </CardContent>
                </Card>
              )}
              {!isSearching && searchError && (
                <Card className="border-red-300 bg-red-50">
                  <CardContent className="py-3 text-xs text-red-600">
                    {searchError}
                  </CardContent>
                </Card>
              )}
              {!isSearching && !searchError && searchResults.length === 0 && (
                <Card className="border-slate-200">
                  <CardContent className="py-3 text-xs text-slate-500">
                    No matching leads found. Refine your search by name, phone, or lead ID.
                  </CardContent>
                </Card>
              )}
              {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((lead: any, idx: number) => {
                      const hotQueueIndex = hotleadQueue.findIndex((queueLead: any) => {
                        return (
                          (lead.taalk_lead_id && queueLead?.taalk_lead_id === lead.taalk_lead_id) ||
                          (lead.id && queueLead?.id === lead.id) ||
                          (lead.phone && queueLead?.phone === lead.phone)
                        );
                      });

                      const plusQueueIndex = plusLeadsQueue.findIndex((queueLead: any) => {
                        return (
                          (lead.taalk_lead_id && queueLead?.taalk_lead_id === lead.taalk_lead_id) ||
                          (lead.id && queueLead?.id === lead.id) ||
                          (lead.phone && queueLead?.phone === lead.phone)
                        );
                      });

                      // Determine queue type: prioritize actual queue membership, then check if it's a hotlead
                      const isActuallyHotlead = isLeadHotlead(lead);
                      const derivedQueueType: 'hotlead' | 'plus' =
                        hotQueueIndex >= 0
                          ? 'hotlead'
                          : plusQueueIndex >= 0
                            ? 'plus'
                            : isActuallyHotlead
                              ? 'hotlead'
                              : 'plus';

                      // If lead is not in any queue, use -1 and let handleSelectLeadFromList handle it
                      // But if it's a hotlead not in queue, don't force it to plus queue
                      const queueIndex =
                        hotQueueIndex >= 0 ? hotQueueIndex :
                        plusQueueIndex >= 0 ? plusQueueIndex :
                        -1; // Not in any queue - will be handled as viewedLead

                      // Check if it's priority 99 (super hot/fiery) or recruit hotlead (is_hot_lead)
                      const isPriority99 = Number(lead.priority_score || lead.priority || 0) === 99;
                      const isRecruitHot = lead.is_hot_lead === true || lead.is_hot_lead === 'true' || lead.is_hot_lead === 1 || lead.isHotLead === true || lead.isHotLead === 'true' || lead.isHotLead === 1;
                      const badgeClasses =
                        derivedQueueType === 'hotlead'
                          ? isPriority99 || isRecruitHot
                            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white border-2 border-orange-400 shadow-lg font-bold'
                            : 'bg-orange-100 text-orange-700 border border-orange-300'
                          : 'bg-emerald-100 text-emerald-600 border border-emerald-200';

                      return (
                        <Card
                          key={lead.id ?? lead.taalk_lead_id ?? lead.phone ?? idx}
                          className="cursor-pointer border-slate-200 transition hover:border-blue-400 hover:shadow-md"
                          onClick={() =>
                            handleSelectLeadFromList(
                              {
                                ...lead,
                                name: lead.name,
                                taalk_lead_id: lead.taalk_lead_id,
                                phone: lead.phone,
                                state: lead.state,
                                city: lead.city,
                                market: lead.market,
                                cnresolution: lead.cnresolution,
                                associate_id: lead.associate_id
                              },
                              queueIndex,
                              // Only pass queueType if lead is actually in that queue, otherwise let it be handled as viewedLead
                              queueIndex >= 0 ? { queueType: derivedQueueType } : undefined
                            )
                          }
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base font-semibold text-slate-800">
                                {lead.name || 'Unknown Lead'}
                              </CardTitle>
                              <Badge className={`text-xs font-semibold ${badgeClasses}`}>
                                {derivedQueueType === 'hotlead'
                                  ? (lead.is_hot_lead || lead.isHotLead ? 'Hot Candidate' : 'Hot Lead')
                                  : activeQueueTab === 'aointel'
                                    ? 'AO Recruit'
                                    : 'Plus Lead'}
                              </Badge>
                            </div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              {queueIndex === -1
                                ? `Not currently in the ${derivedQueueType === 'hotlead' ? 'Hot Leads' : 'Plus Leads'} queue`
                                : `${derivedQueueType === 'hotlead' ? 'Hot Leads' : 'Plus Leads'} position ${queueIndex + 1}`}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-slate-600">
                            {/* Hide phone and taalk_lead_id for hotleads UNLESS call duration >= 60 seconds */}
                            {(() => {
                              const isHotlead = lead.is_hot_lead || lead.isHotLead || lead.source_table === 'hotleads';
                              const currentLead = dialerState.availableLeads[dialerState.currentLeadIndex];
                              const isCurrentLead = currentLead && (
                                (lead.taalk_lead_id && currentLead.taalk_lead_id === lead.taalk_lead_id) ||
                                (lead.id && currentLead.id === lead.id) ||
                                (lead.phone && currentLead.phone === lead.phone)
                              );
                              const shouldReveal = !isHotlead || (isCurrentLead && dialerState.callDuration >= 110);
                              
                              return shouldReveal ? (
                                <div className="flex flex-wrap gap-4">
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-4 w-4" />
                                    {lead.phone || 'No phone'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    #{lead.id}
                                  </span>
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
                            {lead.cnresolution && (
                              <div className="text-xs text-slate-500">
                                Last Disposition: {lead.cnresolution}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          <LeadDisplay
            state={dialerState}
            callDurationSeconds={callDurationSeconds}
            isStarterPlan={isStarterPlan}
            upgradePlan={professionalPlan}
            onUpgrade={() => handleCheckout('professional')}
            onUndo={handleUndo}
            canUndo={!!undoState && dialerState.dispositionApplied}
            activeQueueTab={leadDisplayQueueTab}
            onRefetchLeads={loadQueue}
            onIgniteQueue={handleRecruitIgniteQueue}
            stages={stages}
            onStageChange={handleStageChange}
          />

          {/* Candidate Queue - Table format like AORecruit page */}
          <CandidateQueue
            state={dialerState}
            callConnected={callConnected}
            stages={stages}
            onStageChange={handleStageChange}
            onSelectCandidate={(candidate, index) => {
              setDialerState(prev => ({
                ...prev,
                currentLeadIndex: index,
                viewedLead: null
              }));
            }}
            onEditCandidate={handleEditCandidate}
            onDeleteCandidate={handleDeleteCandidate}
            onSMS={handleSMSCandidate}
            onAppointment={handleAppointmentCandidate}
          />
            </div>

            {getCurrentLead()?.source_table === 'masterrecruit' && (
              <div className="px-2 pb-2 shrink-0">
                <Button
                  type="button"
                  onClick={() => {
                    const lead = getCurrentLead();
                    if (lead?.id) {
                      convertToCandidateMutation.mutate({ masterrecruitId: Number(lead.id) });
                    }
                  }}
                  disabled={convertToCandidateMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  {convertToCandidateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add to My Candidates
                </Button>
              </div>
            )}

            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-2 sm:p-3 bg-white dark:bg-gray-900">
              <CallControls
                selectedDisposition={dialerState.selectedDisposition}
                dispositionApplied={dialerState.dispositionApplied}
                onApplyDisposition={handleApplyDisposition}
                onUndo={handleUndo}
                canUndo={!!undoState && dialerState.dispositionApplied}
                state={dialerState}
                currentLead={getCurrentLead()}
                onStartCall={() => dialLead()}
                onEndCall={handleEndCall}
                onSkipLead={handleSkipLead}
                onPowerToggle={handlePowerToggle}
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
                onPreviousLead={handlePreviousLead}
                onNextLead={handleNextLead}
                userEmail={authState?.user?.email}
                callDurationSeconds={callDurationSeconds}
                dailyStats={dailyStats}
              />
            </div>
          </div>
        </div>

        {/* Right Side: VDP + inbound panel + live queue (InboundSuccessViewer) — same widths as /connect */}
        <div className="flex flex-shrink-0 gap-3 w-full lg:w-auto">
          <div className="w-full max-w-[380px] lg:max-w-none lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col gap-3 min-h-0 self-start">
            <div className="min-h-0 flex flex-col w-full">
              {authState?.user?.email ? (
                <RecruitInboundConnectPanel userEmail={authState.user.email} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop App Modal - DISABLED - using Chrome browser only */}
      {/* <DesktopAppModal 
        isOpen={showDesktopAppModal}
        onClose={() => setShowDesktopAppModal(false)}
      /> */}

      {/* Edit Candidate Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
              Edit Candidate
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEditCandidate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={editFormData.city}
                  onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-state">State</Label>
                <Input
                  id="edit-state"
                  value={editFormData.state}
                  onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-zipCode">Zip Code</Label>
                <Input
                  id="edit-zipCode"
                  value={editFormData.zipCode}
                  onChange={(e) => setEditFormData({ ...editFormData, zipCode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-position">Position</Label>
              <Input
                id="edit-position"
                value={editFormData.position}
                onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                placeholder="Position they're applying for"
              />
            </div>

            <div>
              <Label htmlFor="edit-experience">Experience</Label>
              <Textarea
                id="edit-experience"
                value={editFormData.experience}
                onChange={(e) => setEditFormData({ ...editFormData, experience: e.target.value })}
                placeholder="Years of experience, background, etc."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select 
                value={editFormData.status} 
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="hired">Hired</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Additional notes about the candidate..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700" disabled={updateCandidateMutation.isPending}>
                {updateCandidateMutation.isPending ? 'Updating...' : 'Update Candidate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SMS Messenger Modal */}
      <SMSMessengerModal
        open={isSMSModalOpen}
        onOpenChange={setIsSMSModalOpen}
        candidate={smsCandidate}
        userEmail={authState?.user?.email}
      />

      {/* Appointment Schedule Modal */}
      {appointmentCandidate && (
        <AppointmentScheduleModal
          open={isAppointmentModalOpen}
          onOpenChange={setIsAppointmentModalOpen}
          candidate={appointmentCandidate}
          userEmail={authState?.user?.email}
          currentStageId={appointmentCandidate.currentStageId || undefined}
          stageName={(() => {
            if (!appointmentCandidate.currentStageId) return undefined;
            const stage = stages.find((s: any) => s.id === appointmentCandidate.currentStageId);
            if (!stage) return undefined;
            return stage.displayName || stage.name;
          })()}
          onAppointmentSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
            queryClient.invalidateQueries({ queryKey: ['/api/outbound-dialer/recruit-candidates'] });
          }}
        />
      )}

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
    </div>
  );
}

