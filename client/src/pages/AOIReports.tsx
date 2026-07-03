import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Phone,
  Calendar,
  User,
  MessageSquare
} from 'lucide-react';

interface VDPCall {
  id: string | number; // Can be string or number from different sources
  phone_number: string;
  customer_name?: string;
  agent_email: string;
  created_at: string;
  call_duration?: number;
  cnresolution?: string;
  resolution_notes?: string;
  days_since_call: number;
  is_followup_required?: boolean;
  followup_deadline?: string;
  final_outcome?: string;
  final_outcome_notes?: string;
  source?: string;
  market?: string;
  lead_id?: string;
  duration_display?: string;
}

interface AOIFollowup {
  id: number;
  vdp_call_id: number;
  taalk_leadid: string;
  agent_email: string;
  followup_type: 'appointment' | 'callback';
  initial_resolution: string;
  initial_resolution_at: string;
  initial_notes?: string;
  due_date: string;
  status: 'pending' | 'completed';
  appointment_date?: string;
  appointment_type?: string;
  appointment_details?: string;
  callback_date?: string;
  callback_phone?: string;
  callback_notes?: string;
  final_outcome?: string;
  final_notes?: string;
  completed_at?: string;
  completed_by?: string;
}

interface ResolutionStats {
  pending_reports: number;
  total_calls: number;
  resolved_calls: number;
  overdue_calls: number;
}

const RESOLUTION_OPTIONS = [
  { value: 'sold', label: '✅ Sold', color: 'bg-green-100 text-green-800' },
  { value: 'appointment_set', label: '📅 Appointment Set', color: 'bg-blue-100 text-blue-800' },
  { value: 'instant_presentation', label: '⚡ Instant Presentation', color: 'bg-purple-100 text-purple-800' },
  { value: 'not_interested', label: '❌ Not Interested', color: 'bg-red-100 text-red-800' },
  { value: 'in_progress', label: '⏳ In Progress', color: 'bg-purple-100 text-purple-800' }
];

const FINAL_OUTCOME_OPTIONS = [
  { value: 'sold', label: '✅ Sold', color: 'bg-green-100 text-green-800' },
  { value: 'no_show', label: '👻 No Show', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: '❌ Cancelled', color: 'bg-orange-100 text-orange-800' },
  { value: 'rescheduled', label: '📅 Rescheduled', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed_declined', label: '🔄 Completed but Declined', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'unable_to_reach', label: '📞 Unable to Reach', color: 'bg-gray-100 text-gray-800' },
  { value: 'rescheduled_again', label: '📅 Rescheduled Again', color: 'bg-purple-100 text-purple-800' }
];

export default function AOIReports() {
  const [selectedTab, setSelectedTab] = useState<'pending' | 'all' | 'followups'>('pending');
  const [appointmentDetails, setAppointmentDetails] = useState<{[key: string]: { date?: string; time?: string; type?: string; details?: string }}>({});
  const [selectedResolution, setSelectedResolution] = useState<{[key: string]: string}>({});
  const [saleDetails, setSaleDetails] = useState<{[key: string]: { alp?: string }}>({});
  const [callbackDetails, setCallbackDetails] = useState<{[key: string]: { date?: string; notes?: string }}>({});
  const [finalOutcomes, setFinalOutcomes] = useState<{[key: string]: { outcome?: string; notes?: string }}>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  // Real-time resolution tracking
  const [resolvedCallIds, setResolvedCallIds] = useState<Set<string>>(new Set());
  const [isSubmittingResolution, setIsSubmittingResolution] = useState<{[key: string]: boolean}>({});
  const [initialCallCount, setInitialCallCount] = useState<number>(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get authenticated user's email (no more hardcoding!)
  const { authState } = useAuth();
  
  useEffect(() => {
    // Use authenticated user's email first, then fallback to API/localStorage
    const authenticatedEmail = authState.user?.email;
    if (authenticatedEmail) {
      setCurrentUserEmail(authenticatedEmail);
    } else {
      fetch('/api/user/credits')
        .then(response => response.json())
        .then(data => {
          const userEmail = data.email || localStorage.getItem('user_email');
          if (userEmail) setCurrentUserEmail(userEmail);
        })
        .catch(() => {
          const storedEmail = localStorage.getItem('user_email');
          if (storedEmail) setCurrentUserEmail(storedEmail);
        });
    }
  }, [authState.user?.email]);

  // Fetch resolution stats
  const { data: stats } = useQuery({
    queryKey: ['/api/aoi-reports/stats'],
    refetchInterval: 30000,
  });

  // Fetch pending reports for authenticated user only
  const { data: allPendingCalls, isLoading: pendingLoading, error: pendingError } = useQuery({
    queryKey: ['/api/aoi-reports/pending', currentUserEmail],
    queryFn: async () => {
      const storedEmail = localStorage.getItem('user_email') || currentUserEmail;
      const url = storedEmail ? `/api/aoi-reports/pending?userEmail=${encodeURIComponent(storedEmail)}` : '/api/aoi-reports/pending';
      const response = await fetch(url, {
        headers: { 'x-user-email': storedEmail || '' }
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    },
    enabled: !!currentUserEmail,
    refetchInterval: 30000,
    staleTime: 0,
    gcTime: 0,
  });

  // Backend already filters by user, no need for additional filtering
  // VDP calls use producer field (117239), masterlead calls use agent_email field
  const allPendingCallsArray = (allPendingCalls as any) || [];
  
  // Set initial call count when data first loads
  useEffect(() => {
    if (allPendingCallsArray.length > 0 && initialCallCount === 0) {
      setInitialCallCount(allPendingCallsArray.length);
    }
  }, [allPendingCallsArray.length, initialCallCount]);
  
  // Filter out resolved calls for real-time updates
  // Convert id to string for comparison since resolvedCallIds uses strings
  const pendingCalls = allPendingCallsArray.filter((call: VDPCall) => {
    const callId = String(call.id);
    return !resolvedCallIds.has(callId);
  });

  // Separate overdue vs current calls
  const overdueCalls = pendingCalls.filter((call: VDPCall) => call.days_since_call >= 3);
  const currentCalls = pendingCalls.filter((call: VDPCall) => call.days_since_call < 3);

  // Calculate user-specific stats with real-time updates
  const resolvedCount = resolvedCallIds.size;
  const userStats = {
    pending_reports: pendingCalls.length,
    total_calls: initialCallCount || allPendingCallsArray.length, 
    resolved_calls: resolvedCount,
    overdue_calls: overdueCalls.length
  };

  // Fetch all reports
  const { data: allCalls, isLoading: allLoading } = useQuery({
    queryKey: ['/api/aoi-reports/all'],
    enabled: selectedTab === 'all',
  });

  // Fetch pending follow-ups
  const { data: pendingFollowups, isLoading: followupsLoading } = useQuery({
    queryKey: [`/api/aoi-followups/pending/${currentUserEmail}`],
    enabled: selectedTab === 'followups' && !!currentUserEmail,
    refetchInterval: 30000,
  });

  // Resolution mutation with follow-up support
  const resolutionMutation = useMutation({
    mutationFn: async ({ callId, resolution, notes, appointmentDate, appointmentType, appointmentDetails: aptDetails, callbackDate, source, saleAlp }: {
      callId: string;
      resolution: string;
      notes?: string;
      appointmentDate?: string;
      appointmentType?: string;
      appointmentDetails?: string;
      callbackDate?: string;
      source?: string;
      saleAlp?: string;
    }) => {
      return apiRequest('PUT', `/api/aoi-reports/resolve/${callId}`, {
        cnresolution: resolution,
        resolution_notes: notes,
        appointmentDate,
        appointmentType,
        appointmentDetails: aptDetails,
        callbackDate,
        source,
        saleAlp
      });
    },
    onSuccess: (data: any, variables) => {
      // Immediately add to resolved calls for real-time UI update
      // Ensure callId is converted to string for Set comparison
      const callIdString = String(variables.callId);
      setResolvedCallIds(prev => new Set([...prev, callIdString]));
      
      // Clear form data for this specific call
      setAppointmentDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[variables.callId];
        return newDetails;
      });
      setCallbackDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[variables.callId];
        return newDetails;
      });
      setSelectedResolution(prev => {
        const newSelection = { ...prev };
        delete newSelection[variables.callId];
        return newSelection;
      });
      setSaleDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[variables.callId];
        return newDetails;
      });
      setIsSubmittingResolution(prev => {
        const newSubmitting = { ...prev };
        delete newSubmitting[variables.callId];
        return newSubmitting;
      });
      
      toast({
        title: "✅ Resolution Saved",
        description: data?.followup_required 
          ? "Call resolution saved and follow-up created."
          : "Call resolution has been recorded successfully.",
      });
      
      // Invalidate queries to keep data in sync
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-reports'] });
      queryClient.invalidateQueries({ queryKey: [`/api/aoi-followups/pending/${currentUserEmail}`] });
      // CRITICAL: Invalidate blocking status cache so the blocker disappears when all reports are resolved
      queryClient.invalidateQueries({ queryKey: [`/api/aoi-reports/check-blocking/${encodeURIComponent(currentUserEmail)}`] });
    },
    onError: (error: any, variables) => {
      // Reset the submitting state on error
      setIsSubmittingResolution(prev => {
        const newSubmitting = { ...prev };
        delete newSubmitting[variables.callId];
        return newSubmitting;
      });
      
      toast({
        title: "❌ Error",
        description: "Failed to save resolution. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Follow-up completion mutation
  const followupCompletionMutation = useMutation({
    mutationFn: async ({ followupId, finalOutcome, finalNotes, completedBy }: {
      followupId: number;
      finalOutcome: string;
      finalNotes?: string;
      completedBy: string;
    }) => {
      return apiRequest('PUT', `/api/aoi-followups/complete/${followupId}`, {
        finalOutcome,
        finalNotes,
        completedBy
      });
    },
    onSuccess: () => {
      toast({
        title: "✅ Follow-up Completed",
        description: "Final outcome has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/aoi-followups/pending/${currentUserEmail}`] });
      // CRITICAL: Invalidate blocking status cache so the blocker disappears when all reports are resolved
      queryClient.invalidateQueries({ queryKey: [`/api/aoi-reports/check-blocking/${encodeURIComponent(currentUserEmail)}`] });
      setFinalOutcomes({});
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete follow-up. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleResolution = (callId: string, resolution: string, callSource?: string) => {
    // Mark this call as being submitted
    setIsSubmittingResolution(prev => ({ ...prev, [callId]: true }));
    
    const appointmentData = appointmentDetails[callId] || {};
    const callbackData = callbackDetails[callId] || {};
    const saleData = saleDetails[callId] || {};
    
    // For appointment_set, combine date and time into a full datetime
    let appointmentDateTime = null;
    if (resolution === 'appointment_set' && appointmentData.date && appointmentData.time) {
      appointmentDateTime = `${appointmentData.date}T${appointmentData.time}:00`;
    }
    
    resolutionMutation.mutate({ 
      callId, 
      resolution,
      appointmentDate: appointmentDateTime || undefined,
      appointmentType: appointmentData.type,
      appointmentDetails: appointmentData.details,
      callbackDate: callbackData.date,
      source: callSource,
      saleAlp: saleData.alp
    });
  };

  const handleFollowupCompletion = (followupId: number, finalOutcome: string) => {
    const outcomeData = finalOutcomes[followupId] || {};
    const finalNotes = outcomeData.notes || '';
    
    followupCompletionMutation.mutate({
      followupId,
      finalOutcome,
      finalNotes,
      completedBy: currentUserEmail
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getResolutionOption = (status?: string) => {
    return RESOLUTION_OPTIONS.find(opt => opt.value === status);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              AOI Reports
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Report outcomes for each connect and track lead resolutions
          </p>
        </div>

        {/* Progress Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-semibold text-blue-900 dark:text-blue-100">
                  Resolution Progress: {resolvedCount} of {userStats.total_calls} completed
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-200">
                  {pendingCalls.length > 0 
                    ? `${pendingCalls.length} calls still require resolution • Select outcome and confirm each call`
                    : "✅ All reports completed! Ready to finalize."
                  }
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {Math.round((resolvedCount / Math.max(userStats.total_calls, 1)) * 100)}% Complete
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(resolvedCount / Math.max(userStats.total_calls, 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Complete & Submit Button */}
              {/* Moved Complete & Submit button to bottom of page */}
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {userStats.pending_reports}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Pending Reports
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {userStats.total_calls}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Total Calls
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {userStats.resolved_calls}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Resolved
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {userStats.overdue_calls}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Overdue (3+ Days)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <Button 
            variant={selectedTab === 'pending' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('pending')}
            className="flex items-center gap-2"
            data-testid="tab-pending"
          >
            <Clock className="h-4 w-4" />
            Pending Reports ({userStats.pending_reports})
          </Button>
          <Button 
            variant={selectedTab === 'followups' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('followups')}
            className="flex items-center gap-2"
            data-testid="tab-followups"
          >
            <Calendar className="h-4 w-4" />
            Follow-ups ({(pendingFollowups as any)?.length || 0})
          </Button>
          <Button 
            variant={selectedTab === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('all')}
            className="flex items-center gap-2"
            data-testid="tab-all"
          >
            <FileText className="h-4 w-4" />
            View All Reports
          </Button>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedTab === 'pending' ? (
                <>
                  <Clock className="h-5 w-5 text-red-500" />
                  Pending Resolutions - Separated by Urgency
                </>
              ) : selectedTab === 'followups' ? (
                <>
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Follow-up Actions Required
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 text-blue-500" />
                  All Call Reports
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTab === 'pending' ? (
              <div className="space-y-6">
                {pendingLoading ? (
                  <div className="text-center py-8 text-slate-500">
                    Loading pending reports...
                  </div>
                ) : pendingCalls.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    ✅ No pending reports! All calls have been resolved.
                  </div>
                ) : (
                  <>
                    {/* OVERDUE CALLS - URGENT */}
                    {overdueCalls.length > 0 && (
                      <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                              🚨 OVERDUE - Action Required ({overdueCalls.length})
                            </h3>
                            <p className="text-sm text-red-600 dark:text-red-500">
                              These calls are 3+ days old and need immediate attention
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4 border-l-4 border-red-400 pl-4 bg-red-50 dark:bg-red-900/10 p-4 rounded-r-lg">
                          {overdueCalls.map((call: VDPCall) => (
                            <div key={call.id} className="border rounded-lg p-6 bg-white dark:bg-slate-800 shadow-sm">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Call Info */}
                                <div className="lg:col-span-1">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Phone className="h-4 w-4 text-blue-600" />
                                    <span className="font-semibold text-blue-600">
                                      {call.phone_number}
                                    </span>
                                    <Badge variant="destructive">
                                      {call.days_since_call} days ago
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                    {call.customer_name && (
                                      <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        <span>{call.customer_name}</span>
                                      </div>
                                    )}
                                    {call.agent_email && (
                                      <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        <span>producer: {call.agent_email}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3" />
                                      <span>{new Date(call.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div>Duration: {call.duration_display || formatDuration(call.call_duration)}</div>
                                    <div>Market: {call.market}</div>
                                    <div>Lead ID: {call.lead_id}</div>
                                    {call.cnresolution && (
                                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                        <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                          Current Resolution:
                                        </div>
                                        <div className="text-sm text-blue-900 dark:text-blue-100">
                                          {getResolutionOption(call.cnresolution)?.label || call.cnresolution}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Resolution Section */}
                                <div className="lg:col-span-1">
                                  <label className="block text-sm font-medium mb-2">
                                    {call.cnresolution ? 'Update Resolution:' : 'Resolution:'}
                                  </label>
                                  <Select
                                    value={selectedResolution[call.id] || ''}
                                    onValueChange={(value) => setSelectedResolution(prev => ({
                                      ...prev,
                                      [call.id]: value
                                    }))}
                                    data-testid={`resolution-select-${call.id}`}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select resolution..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {RESOLUTION_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  {/* Sale Details */}
                                  {selectedResolution[call.id] === 'sold' && (
                                    <div className="mt-4">
                                      <label className="block text-sm font-medium mb-2">
                                        ALP Amount:
                                      </label>
                                      <Input
                                        type="number"
                                        placeholder="Enter ALP amount..."
                                        value={saleDetails[call.id]?.alp || ''}
                                        onChange={(e) => setSaleDetails(prev => ({
                                          ...prev,
                                          [call.id]: { ...prev[call.id], alp: e.target.value }
                                        }))}
                                        data-testid={`alp-input-${call.id}`}
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleResolution(call.id, 'sold', call.source)}
                                        disabled={!saleDetails[call.id]?.alp || isSubmittingResolution[call.id]}
                                        className="mt-2 w-full"
                                        data-testid={`confirm-sale-${call.id}`}
                                      >
                                        {isSubmittingResolution[call.id] ? (
                                          <>⏳ Saving Sale...</>
                                        ) : (
                                          <>💰 Confirm Sale</>
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  {/* Appointment Details */}
                                  {selectedResolution[call.id] === 'appointment_set' && (
                                    <div className="mt-4 space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Date:</label>
                                          <Input
                                            type="date"
                                            value={appointmentDetails[call.id]?.date || ''}
                                            onChange={(e) => setAppointmentDetails(prev => ({
                                              ...prev,
                                              [call.id]: { ...prev[call.id], date: e.target.value }
                                            }))}
                                            data-testid={`appointment-date-${call.id}`}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Time:</label>
                                          <Input
                                            type="time"
                                            value={appointmentDetails[call.id]?.time || ''}
                                            onChange={(e) => setAppointmentDetails(prev => ({
                                              ...prev,
                                              [call.id]: { ...prev[call.id], time: e.target.value }
                                            }))}
                                            data-testid={`appointment-time-${call.id}`}
                                          />
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          if (appointmentDetails[call.id]?.date && appointmentDetails[call.id]?.time) {
                                            console.log('🔄 Scheduling appointment for call:', call.id);
                                          }
                                          handleResolution(call.id, 'appointment_set', call.source);
                                        }}
                                        disabled={!appointmentDetails[call.id]?.date || !appointmentDetails[call.id]?.time || isSubmittingResolution[call.id]}
                                        data-testid={`confirm-appointment-${call.id}`}
                                        className="w-full"
                                      >
                                        {isSubmittingResolution[call.id] ? (
                                          <>⏳ Scheduling...</>
                                        ) : (
                                          <>✅ Confirm Appointment</>
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  {/* Instant Presentation Confirmation */}
                                  {selectedResolution[call.id] === 'instant_presentation' && (
                                    <div className="mt-4">
                                      <Button
                                        size="sm"
                                        onClick={() => handleResolution(call.id, 'instant_presentation', call.source)}
                                        disabled={isSubmittingResolution[call.id]}
                                        data-testid={`confirm-instant-presentation-${call.id}`}
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                      >
                                        {isSubmittingResolution[call.id] ? (
                                          <>⏳ Saving...</>
                                        ) : (
                                          <>⚡ Confirm Instant Presentation</>
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  {/* General Confirmation Button for ALL other resolutions */}
                                  {selectedResolution[call.id] && 
                                   selectedResolution[call.id] !== 'sold' && 
                                   selectedResolution[call.id] !== 'appointment_set' && 
                                   selectedResolution[call.id] !== 'instant_presentation' && (
                                    <div className="mt-4">
                                      <Button
                                        size="sm"
                                        onClick={() => handleResolution(call.id, selectedResolution[call.id], call.source)}
                                        disabled={isSubmittingResolution[call.id]}
                                        data-testid={`confirm-resolution-${call.id}`}
                                        className="w-full"
                                      >
                                        {isSubmittingResolution[call.id] ? (
                                          <>⏳ Saving...</>
                                        ) : (
                                          <>✅ Confirm {RESOLUTION_OPTIONS.find(opt => opt.value === selectedResolution[call.id])?.label}</>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CURRENT CALLS - Less Urgent */}
                    {currentCalls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Clock className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                              📋 Current Reports ({currentCalls.length})
                            </h3>
                            <p className="text-sm text-blue-600 dark:text-blue-500">
                              Recent calls (less than 3 days old)
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {currentCalls.map((call: VDPCall) => (
                    <div key={call.id} className="border rounded-lg p-6 bg-slate-50 dark:bg-slate-800">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Call Info */}
                        <div className="lg:col-span-1">
                          <div className="flex items-center gap-2 mb-3">
                            <Phone className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-blue-600">
                              {call.phone_number}
                            </span>
                            <Badge variant={call.days_since_call >= 3 ? 'destructive' : 'secondary'}>
                              {call.days_since_call} days ago
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            {call.customer_name && (
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {call.customer_name}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {new Date(call.created_at).toLocaleDateString()}
                            </div>
                            <div>producer: {call.agent_email}</div>
                            <div>Duration: {call.duration_display || formatDuration(call.call_duration)}</div>
                            <div className="text-xs">
                              <strong>Market:</strong> {call.market || 'Unknown'}
                            </div>
                            <div className="text-xs font-mono">
                              <strong>Lead ID:</strong> {call.lead_id || 'No ID'}
                            </div>
                            {call.cnresolution && (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                  Current Resolution:
                                </div>
                                <div className="text-sm text-blue-900 dark:text-blue-100">
                                  {getResolutionOption(call.cnresolution)?.label || call.cnresolution}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resolution Selection */}
                        <div className="lg:col-span-1">
                          <label className="block text-sm font-medium mb-2">
                            {call.cnresolution ? 'Update Resolution:' : 'Select Resolution:'}
                          </label>
                          <Select onValueChange={(value) => {
                            // Just mark as selected for ALL resolution types, don't auto-submit
                            setSelectedResolution(prev => ({...prev, [call.id]: value}));
                          }}>
                            <SelectTrigger data-testid={`resolution-select-${call.id}`}>
                              <SelectValue placeholder="Choose outcome..." />
                            </SelectTrigger>
                            <SelectContent>
                              {RESOLUTION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Sale ALP Input */}
                          {selectedResolution[call.id] === 'sold' && (
                            <div className="mt-4 space-y-3">
                              <div>
                                <label className="block text-xs font-medium mb-1 text-slate-600">
                                  Annual Life Premium (ALP):
                                </label>
                                <input
                                  type="number"
                                  placeholder="Enter ALP amount..."
                                  className="w-full text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  value={saleDetails[call.id]?.alp || ''}
                                  onChange={(e) => setSaleDetails(prev => ({
                                    ...prev,
                                    [call.id]: { ...prev[call.id], alp: e.target.value }
                                  }))}
                                  data-testid={`sale-alp-${call.id}`}
                                />
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const alpAmount = saleDetails[call.id]?.alp;
                                  if (!alpAmount || isNaN(Number(alpAmount))) {
                                    toast({
                                      title: "Missing Information",
                                      description: "Please enter a valid ALP amount for the sale.",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  handleResolution(call.id, 'sold', call.source);
                                }}
                                disabled={!saleDetails[call.id]?.alp || isNaN(Number(saleDetails[call.id]?.alp || ''))}
                                data-testid={`confirm-sale-${call.id}`}
                              >
                                ✅ Confirm Sale
                              </Button>
                            </div>
                          )}
                          
                          {/* Appointment Date/Time Picker */}
                          {selectedResolution[call.id] === 'appointment_set' && (
                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-slate-600">
                                    Appointment Date:
                                  </label>
                                  <input
                                    type="date"
                                    className="w-full text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={appointmentDetails[call.id]?.date || ''}
                                    onChange={(e) => setAppointmentDetails(prev => ({
                                      ...prev,
                                      [call.id]: { ...prev[call.id], date: e.target.value }
                                    }))}
                                    data-testid={`appointment-date-${call.id}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-slate-600">
                                    Time:
                                  </label>
                                  <input
                                    type="time"
                                    className="w-full text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={appointmentDetails[call.id]?.time || ''}
                                    onChange={(e) => setAppointmentDetails(prev => ({
                                      ...prev,
                                      [call.id]: { ...prev[call.id], time: e.target.value }
                                    }))}
                                    data-testid={`appointment-time-${call.id}`}
                                  />
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const aptData = appointmentDetails[call.id];
                                  if (!aptData?.date || !aptData?.time) {
                                    toast({
                                      title: "Missing Information",
                                      description: "Please set both date and time for the appointment.",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  handleResolution(call.id, 'appointment_set', call.source);
                                }}
                                disabled={!appointmentDetails[call.id]?.date || !appointmentDetails[call.id]?.time}
                                data-testid={`confirm-appointment-${call.id}`}
                              >
                                ✅ Confirm Appointment
                              </Button>
                            </div>
                          )}

                          {/* Instant Presentation Confirmation */}
                          {selectedResolution[call.id] === 'instant_presentation' && (
                            <div className="mt-4">
                              <Button
                                size="sm"
                                onClick={() => handleResolution(call.id, 'instant_presentation', call.source)}
                                disabled={isSubmittingResolution[call.id]}
                                data-testid={`confirm-instant-presentation-${call.id}`}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                              >
                                {isSubmittingResolution[call.id] ? (
                                  <>⏳ Saving...</>
                                ) : (
                                  <>⚡ Confirm Instant Presentation</>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* General Confirmation Button for ALL other resolutions */}
                          {selectedResolution[call.id] && 
                           selectedResolution[call.id] !== 'sold' && 
                           selectedResolution[call.id] !== 'appointment_set' && 
                           selectedResolution[call.id] !== 'instant_presentation' && (
                            <div className="mt-4">
                              <Button
                                size="sm"
                                onClick={() => handleResolution(call.id, selectedResolution[call.id], call.source)}
                                disabled={isSubmittingResolution[call.id]}
                                data-testid={`confirm-resolution-${call.id}`}
                                className="w-full"
                              >
                                {isSubmittingResolution[call.id] ? (
                                  <>⏳ Saving...</>
                                ) : (
                                  <>✅ Confirm {RESOLUTION_OPTIONS.find(opt => opt.value === selectedResolution[call.id])?.label}</>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : selectedTab === 'followups' ? (
              <div className="space-y-4">
                {followupsLoading ? (
                  <div className="text-center py-8 text-slate-500">
                    Loading follow-ups...
                  </div>
                ) : (pendingFollowups as any)?.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    ✅ No pending follow-ups! All appointments and callbacks have been completed.
                  </div>
                ) : (
                  (pendingFollowups as any)?.map((followup: AOIFollowup) => (
                    <div key={followup.id} className="border rounded-lg p-6 bg-slate-50 dark:bg-slate-800">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Follow-up Info */}
                        <div className="lg:col-span-1">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-blue-600">
                              {followup.followup_type === 'appointment' ? '📅 Appointment' : '📞 Callback'}
                            </span>
                            <Badge variant={new Date(followup.due_date) < new Date() ? 'destructive' : 'secondary'}>
                              Due: {new Date(followup.due_date).toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <div>Lead ID: {followup.taalk_leadid}</div>
                            <div>Initial: {followup.initial_resolution}</div>
                            <div>Created: {new Date(followup.initial_resolution_at).toLocaleDateString()}</div>
                            {followup.appointment_date && (
                              <div>Appointment: {new Date(followup.appointment_date).toLocaleDateString()}</div>
                            )}
                            {followup.callback_date && (
                              <div>Callback: {new Date(followup.callback_date).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>

                        {/* Final Outcome Selection */}
                        <div className="lg:col-span-1">
                          <label className="block text-sm font-medium mb-2">
                            Final Outcome:
                          </label>
                          <Select onValueChange={(value) => handleFollowupCompletion(followup.id, value)}>
                            <SelectTrigger data-testid={`outcome-select-${followup.id}`}>
                              <SelectValue placeholder="Select final outcome..." />
                            </SelectTrigger>
                            <SelectContent>
                              {FINAL_OUTCOME_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Final Notes */}
                        <div className="lg:col-span-1">
                          <label className="block text-sm font-medium mb-2">
                            Final Notes:
                          </label>
                          <Textarea
                            placeholder="Add final outcome notes..."
                            value={finalOutcomes[followup.id]?.notes || ''}
                            onChange={(e) => setFinalOutcomes(prev => ({
                              ...prev,
                              [followup.id]: { 
                                ...prev[followup.id],
                                notes: e.target.value 
                              }
                            }))}
                            className="h-20"
                            data-testid={`final-notes-${followup.id}`}
                          />
                          {followup.initial_notes && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                              <strong>Initial Notes:</strong> {followup.initial_notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {allLoading ? (
                  <div className="text-center py-8 text-slate-500">
                    Loading all reports...
                  </div>
                ) : (allCalls as any)?.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No call reports found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(allCalls as any)?.map((call: VDPCall) => (
                      <div key={call.id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">{call.phone_number}</span>
                            </div>
                            {call.customer_name && (
                              <span className="text-slate-600 dark:text-slate-400">
                                {call.customer_name}
                              </span>
                            )}
                            <span className="text-sm text-slate-500">
                              {new Date(call.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {call.cnresolution && (
                              <Badge className={getResolutionOption(call.cnresolution)?.color || 'bg-gray-100 text-gray-800'}>
                                {getResolutionOption(call.cnresolution)?.label || call.cnresolution}
                              </Badge>
                            )}
                            {call.cnresolution ? (
                              <Badge className={getResolutionOption(call.cnresolution)?.color}>
                                {getResolutionOption(call.cnresolution)?.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Unresolved</Badge>
                            )}
                            {call.resolution_notes && (
                              <MessageSquare className="h-4 w-4 text-slate-400" />
                            )}
                            {call.final_outcome && (
                              <Badge className="bg-purple-100 text-purple-800">
                                Final: {call.final_outcome}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* LARGE COMPLETE & SUBMIT BUTTON AT THE BOTTOM - UNMISSABLE for producers */}
        {(pendingCalls.length === 0 || resolvedCallIds.size >= initialCallCount) && initialCallCount > 0 && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl text-center">
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-green-800 dark:text-green-400 mb-2">
                🎉 All Reports Completed!
              </h3>
              <p className="text-green-700 dark:text-green-300 text-lg">
                You've successfully resolved all {initialCallCount} AOI reports. Great work!
              </p>
            </div>
            <Button
              onClick={async () => {
                // Force immediate refresh of blocking status
                await queryClient.invalidateQueries({ queryKey: [`/api/aoi-reports/check-blocking/${encodeURIComponent(currentUserEmail)}`] });
                await queryClient.refetchQueries({ queryKey: [`/api/aoi-reports/check-blocking/${encodeURIComponent(currentUserEmail)}`] });
                
                toast({
                  title: "🎉 All Reports Completed!",
                  description: "System unlocked! All AOI reports have been successfully resolved.",
                });
                
                // Small delay then navigate to main dashboard
                setTimeout(() => {
                  window.location.href = '/dashboard/aoi';
                }, 1000);
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xl px-12 py-6 rounded-xl shadow-lg animate-pulse hover:animate-none transition-all duration-300 hover:scale-105"
              data-testid="complete-submit-button"
              size="lg"
            >
              ✅ Complete & Submit - Unlock System
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}