import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, DollarSign, CheckCircle, AlertTriangle, Trophy, X, CreditCard, Brain, Shield, Ban } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Appointment {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  lead_name: string;
  lead_phone: string;
  status: string;
}

interface UnresolvedCall {
  call_sid: string;
  to_number: string;
  from_number: string;
  duration: number;
  created_at: string;
  call_date: string;
  call_direction?: string;
  minutes?: number;
  seconds?: number;
}

interface DispositionInconsistency {
  id: number;
  callSid: string;
  reportedOutcome: string;
  issueType: string;
  accountabilityDate: string;
  createdAt: string;
}

interface PhantomBooking {
  lead_name: string;
  lead_phone: string;
  market: string;
  updated_at: string;
  type: string;
  severity: string;
  description: string;
}

interface AppointmentReport {
  appointmentId: number;
  outcome?: 'sale' | 'refused' | 'cannot_afford' | 'thinker' | 'medically_uninsurable' | 'no_need' | 'no_show' | 'reschedule';
  saleAmount?: number;
}

interface CallReport {
  callSid: string;
  outcome?: 'sale' | 'refused' | 'cannot_afford' | 'thinker' | 'medically_uninsurable' | 'no_need' | 'no_show' | 'reschedule' | 'pending';
  saleAmount?: number;
  notes?: string;
}

interface ActivityReport {
  activityId: string | number;
  activityType: 'appointment' | 'call' | 'phantom_booking';
  outcome?: 'sale' | 'refused' | 'cannot_afford' | 'thinker' | 'medically_uninsurable' | 'no_need' | 'no_show' | 'reschedule' | 'set_appointment' | 'not_interested' | 'callback_requested' | 'no_answer' | 'voicemail' | 'wrong_number' | 'do_not_call' | 'pending' | 'data_error' | 'forgot_appointment' | 'incorrect_marking';
  saleAmount?: number;
  notes?: string;
  isInconsistency?: boolean;
  originalCallSid?: string;
  reportedOutcome?: string;
  issueType?: string;
  phantomBooking?: PhantomBooking;
}

interface AccountabilityModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function AccountabilityModal({ isOpen, onComplete }: AccountabilityModalProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountabilityData, setAccountabilityData] = useState<any>(null);
  const [activityReports, setActivityReports] = useState<ActivityReport[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [plusLeadsCollected, setPlusLeadsCollected] = useState(0);
  const [appointmentScheduling, setAppointmentScheduling] = useState<{
    callSid: string;
    appointmentDate: string;
    appointmentTime: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && authState.user?.email) {
      checkAOIReportStatus();
    }
  }, [isOpen, authState.user?.email]);

  const checkAOIReportStatus = async () => {
    if (!authState.user?.email) return;
    
    try {
      const response = await fetch(`/api/accountability/check-status?userEmail=${encodeURIComponent(authState.user.email)}`);
      const data = await response.json();
      
      console.log('🚨 ACCOUNTABILITY DATA RECEIVED:', data);
      console.log('🚨 PHANTOM BOOKINGS COUNT:', data.phantomBookings?.length || 0);
      console.log('🚨 PHANTOM BOOKINGS DATA:', data.phantomBookings);
      setAccountabilityData(data);
      
      // Initialize activity reports for both appointments and unresolved calls
      const allReports: ActivityReport[] = [];
      
      // Add appointment activities
      if (data.appointments) {
        const appointmentReports = data.appointments.map((apt: Appointment) => ({
          activityId: apt.id,
          activityType: 'appointment' as const,
          outcome: undefined as any,
          saleAmount: 0,
          notes: ''
        }));
        allReports.push(...appointmentReports);
      }
      
      // Add unresolved call activities
      if (data.unresolvedCalls) {
        const callReports = data.unresolvedCalls.map((call: UnresolvedCall) => ({
          activityId: call.call_sid,
          activityType: 'call' as const,
          outcome: undefined as any,
          saleAmount: 0,
          notes: ''
        }));
        allReports.push(...callReports);
      }
      
      // Add disposition inconsistencies as activities that need resolution
      if (data.dispositionInconsistencies) {
        const inconsistencyReports = data.dispositionInconsistencies.map((inconsistency: DispositionInconsistency) => ({
          activityId: `inconsistency-${inconsistency.id}`,
          activityType: 'call' as const,
          outcome: undefined as any,
          saleAmount: 0,
          notes: '',
          isInconsistency: true,
          originalCallSid: inconsistency.callSid,
          reportedOutcome: inconsistency.reportedOutcome,
          issueType: inconsistency.issueType
        }));
        allReports.push(...inconsistencyReports);
      }

      // Add phantom bookings as activities that need resolution
      if (data.phantomBookings) {
        const phantomReports = data.phantomBookings.map((phantom: PhantomBooking, index: number) => ({
          activityId: `phantom-${index}`,
          activityType: 'phantom_booking' as const,
          outcome: undefined as any,
          saleAmount: 0,
          notes: '',
          phantomBooking: phantom
        }));
        allReports.push(...phantomReports);
      }
      
      setActivityReports(allReports);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load accountability data:', error);
      setLoading(false);
    }
  };

  const handleOutcomeChange = (activityId: string | number, outcome: ActivityReport['outcome']) => {
    setActivityReports(prev => 
      prev.map(report => 
        report.activityId === activityId 
          ? { ...report, outcome, saleAmount: outcome === 'sale' ? (report.saleAmount || 0) : undefined }
          : report
      )
    );

    // If "Set Appointment" is selected for a call, open the appointment scheduling interface
    if (outcome === 'set_appointment' && typeof activityId === 'string') {
      setAppointmentScheduling({
        callSid: activityId,
        appointmentDate: '',
        appointmentTime: ''
      });
    }
  };

  const handleSaleAmountChange = (activityId: string | number, amount: number) => {
    setActivityReports(prev => 
      prev.map(report => 
        report.activityId === activityId 
          ? { ...report, saleAmount: amount }
          : report
      )
    );
  };

  const handleNotesChange = (activityId: string | number, notes: string) => {
    setActivityReports(prev => 
      prev.map(report => 
        report.activityId === activityId 
          ? { ...report, notes }
          : report
      )
    );
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'sale': return 'bg-green-500';
      case 'set_appointment': return 'bg-blue-500';
      case 'not_interested': return 'bg-red-500';
      case 'callback_requested': return 'bg-yellow-500';
      case 'no_answer': return 'bg-gray-500';
      case 'voicemail': return 'bg-orange-500';
      case 'wrong_number': return 'bg-red-400';
      case 'do_not_call': return 'bg-red-600';
      case 'pending': return 'bg-yellow-400';
      // Phantom booking resolutions
      case 'data_error': return 'bg-orange-500';
      case 'forgot_appointment': return 'bg-blue-500';
      case 'incorrect_marking': return 'bg-purple-500';
      // Keep old appointment outcomes for backwards compatibility
      case 'refused': return 'bg-red-500';
      case 'cannot_afford': return 'bg-orange-500';
      case 'thinker': return 'bg-yellow-500';
      case 'medically_uninsurable': return 'bg-purple-500';
      case 'no_need': return 'bg-gray-500';
      case 'no_show': return 'bg-red-400';
      case 'reschedule': return 'bg-blue-500';
      default: return 'bg-gray-300';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'sale': return <DollarSign className="w-4 h-4" />;
      case 'set_appointment': return <Calendar className="w-4 h-4" />;
      case 'not_interested': return <X className="w-4 h-4" />;
      case 'callback_requested': return <Clock className="w-4 h-4" />;
      case 'no_answer': return <AlertTriangle className="w-4 h-4" />;
      case 'voicemail': return <CheckCircle className="w-4 h-4" />;
      case 'wrong_number': return <Ban className="w-4 h-4" />;
      case 'do_not_call': return <Shield className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      // Phantom booking icons
      case 'data_error': return <AlertTriangle className="w-4 h-4" />;
      case 'forgot_appointment': return <Calendar className="w-4 h-4" />;
      case 'incorrect_marking': return <X className="w-4 h-4" />;
      // Keep old appointment outcomes for backwards compatibility
      case 'refused': return <X className="w-4 h-4" />;
      case 'cannot_afford': return <CreditCard className="w-4 h-4" />;
      case 'thinker': return <Brain className="w-4 h-4" />;
      case 'medically_uninsurable': return <Shield className="w-4 h-4" />;
      case 'no_need': return <Ban className="w-4 h-4" />;
      case 'no_show': return <AlertTriangle className="w-4 h-4" />;
      case 'reschedule': return <Calendar className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const isFormValid = () => {
    console.log('🔥 FORM VALIDATION - Activity Reports:', activityReports);
    console.log('🔥 FORM VALIDATION - Reports Count:', activityReports.length);
    
    // Check if all reports have required fields
    const allReportsValid = activityReports.every(report => {
      console.log('🔥 CHECKING REPORT:', report.activityId, 'Type:', report.activityType, 'Outcome:', report.outcome);
      if (!report.outcome) {
        console.log('❌ MISSING OUTCOME FOR:', report.activityId);
        return false;
      }
      if (report.outcome === 'sale' && (!report.saleAmount || report.saleAmount <= 0)) {
        console.log('❌ SALE VALIDATION FAILED FOR:', report.activityId, 'Amount:', report.saleAmount);
        return false;
      }
      
      // If "Set Appointment" is selected, check appointment details are filled
      if (report.outcome === 'set_appointment' && appointmentScheduling?.callSid === report.activityId) {
        if (!appointmentScheduling.appointmentDate || !appointmentScheduling.appointmentTime) {
          console.log('❌ APPOINTMENT VALIDATION FAILED FOR:', report.activityId);
          return false;
        }
      }
      
      // For phantom bookings, notes are optional for all outcomes 
      // (Originally required notes for non-pending, but user feedback indicates they should be optional)
      // if (report.activityType === 'phantom_booking' && report.outcome !== 'pending' && (!report.notes || report.notes.trim().length === 0)) {
      //   console.log('❌ PHANTOM BOOKING NOTES REQUIRED FOR:', report.activityId, 'Outcome:', report.outcome, 'Notes:', report.notes);
      //   return false;
      // }
      
      console.log('✅ REPORT PASSED VALIDATION:', report.activityId);
      return true;
    });

    console.log('🔥 FORM VALIDATION RESULT:', allReportsValid);
    return allReportsValid;
  };

  const submitAOIReport = async () => {
    if (!authState.user?.email || !accountabilityData) return;
    
    // Check if all activities have outcomes selected
    const incompleteReports = activityReports.filter(r => !r.outcome);
    if (incompleteReports.length > 0) {
      toast({
        title: "Incomplete Report",
        description: "Please select an outcome for all activities before submitting.",
        variant: "destructive"
      });
      return;
    }

    // Phantom booking explanations are OPTIONAL - no validation required
    
    setSubmitting(true);
    
    try {
      // Handle appointment scheduling if "Set Appointment" was selected
      let futureAppointmentData = null;
      if (appointmentScheduling && appointmentScheduling.appointmentDate && appointmentScheduling.appointmentTime) {
        const appointmentDateTime = new Date(`${appointmentScheduling.appointmentDate}T${appointmentScheduling.appointmentTime}`);
        futureAppointmentData = {
          callSid: appointmentScheduling.callSid,
          appointmentDateTime: appointmentDateTime.toISOString(),
          agentEmail: authState.user.email
        };
      }

      const response = await fetch('/api/accountability/submit-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentEmail: authState.user.email,
          accountabilityDate: accountabilityData.accountabilityDate,
          appointmentReports: activityReports.filter(r => r.activityType === 'appointment').map(r => ({
            appointmentId: r.activityId,
            outcome: r.outcome,
            saleAmount: r.saleAmount,
            notes: r.notes
          })),
          callReports: activityReports.filter(r => r.activityType === 'call').map(r => ({
            callSid: r.activityId,
            outcome: r.outcome,
            saleAmount: r.saleAmount,
            notes: r.notes
          })),
          phantomBookingReports: activityReports.filter(r => r.activityType === 'phantom_booking').map(r => ({
            phantom: r.phantomBooking,
            resolution: r.outcome,
            explanation: r.notes
          })),
          futureAppointmentData, // Include future appointment data
          notes: generalNotes,
          plusLeadsCollected
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "AOI Report Complete!",
          description: `You earned ${result.xpAwarded} XP for completing your report`,
        });
        
        // Close modal and trigger completion
        onComplete();
      } else {
        throw new Error(result.error || 'Failed to submit report');
      }
      
    } catch (error) {
      console.error('Failed to submit AOI report:', error);
      toast({
        title: "Error",
        description: "Failed to submit AOI report",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto border border-blue-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-t-xl text-white">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-300" />
            <h2 className="text-3xl font-bold">Daily AOI Report</h2>
          </div>
          <p className="text-blue-100 text-lg">Complete your AOI report for {accountabilityData?.accountabilityDate} to continue</p>
          <div className="mt-4 bg-white/20 rounded-lg p-3">
            <p className="text-sm text-blue-100">
              <Shield className="w-4 h-4 inline mr-2" />
              This report ensures accurate tracking of your performance and helps maintain system integrity.
            </p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-700 text-lg">Loading your accountability data...</p>
              <p className="text-sm text-gray-500 mt-2">Preparing your report form</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Status Summary */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    Activity to Report
                  </h3>
                  <Badge className="bg-blue-600 text-white px-4 py-2 text-lg">
                    {((accountabilityData?.appointmentsToReport || 0) + (accountabilityData?.unresolvedCallsCount || 0) + (accountabilityData?.phantomBookingsCount || 0))} Activity
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-800">Date</span>
                    </div>
                    <p className="text-blue-700 text-lg font-bold mt-1">{accountabilityData?.accountabilityDate}</p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">Status</span>
                    </div>
                    <p className="text-green-700 text-lg font-bold mt-1">Pending Review</p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-800">Performance</span>
                    </div>
                    <p className="text-purple-700 text-lg font-bold mt-1">In Progress</p>
                  </div>
                </div>
              </div>

              {/* Activity List */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Complete Reports for Each Activity
                </h3>
                <div className="space-y-6">
                  {/* Appointments */}
                  {accountabilityData?.appointments?.map((appointment: Appointment, index: number) => {
                    const report = activityReports.find(r => r.activityId === appointment.id && r.activityType === 'appointment');
                    
                    return (
                      <Card key={appointment.id} className="border-l-6 border-l-blue-500 bg-white shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-blue-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                  {index + 1}
                                </div>
                                {appointment.lead_name}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-3 mt-2 text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium">
                                    {new Date(appointment.start_time).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-green-500" />
                                  <span className="font-medium">
                                    {new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </CardDescription>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800 px-3 py-1 text-sm font-medium">
                              {appointment.lead_phone}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                          {/* Outcome Selection */}
                          <div>
                            <label className="block text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              Appointment Outcome *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { value: 'sale', label: 'Sale', color: 'green' },
                                { value: 'refused', label: 'Refused', color: 'red' },
                                { value: 'cannot_afford', label: 'Cannot Afford', color: 'orange' },
                                { value: 'thinker', label: 'Thinker', color: 'yellow' },
                                { value: 'medically_uninsurable', label: 'Med. Uninsurable', color: 'purple' },
                                { value: 'no_need', label: 'No Need', color: 'gray' },
                                { value: 'no_show', label: 'No Show', color: 'red' },
                                { value: 'reschedule', label: 'Reschedule', color: 'blue' }
                              ].map((outcome) => (
                                <button
                                  key={outcome.value}
                                  type="button"
                                  onClick={() => handleOutcomeChange(appointment.id, outcome.value as ActivityReport['outcome'])}
                                  className={`p-3 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-2 ${
                                    report?.outcome === outcome.value
                                      ? `${getOutcomeColor(outcome.value)} text-white border-transparent shadow-lg transform scale-105`
                                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
                                  }`}
                                >
                                  {getOutcomeIcon(outcome.value)}
                                  <span>{outcome.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sale Amount (only for sales) */}
                          {report?.outcome === 'sale' && (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                              <label className="block text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Sale Amount ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Enter sale amount"
                                className="w-full p-3 border-2 border-green-300 rounded-lg text-lg font-medium focus:border-green-500 focus:outline-none"
                                value={report.saleAmount || ''}
                                onChange={(e) => handleSaleAmountChange(appointment.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}


                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Phantom Bookings */}
                  {accountabilityData?.phantomBookings?.map((phantom: PhantomBooking, index: number) => {
                    const report = activityReports.find(r => r.activityId === `phantom-${index}` && r.activityType === 'phantom_booking');
                    const appointmentCount = accountabilityData?.appointments?.length || 0;
                    
                    return (
                      <Card key={`phantom-${index}`} className="border-l-6 border-l-red-500 bg-white shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-4 bg-gradient-to-r from-red-50 to-orange-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold text-red-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                  {appointmentCount + index + 1}
                                </div>
                                Phantom Booking: {phantom.lead_name}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-3 mt-2 text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4 text-red-500" />
                                  <span className="font-medium">
                                    {new Date(phantom.updated_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge className="bg-blue-100 text-blue-800 px-2 py-1 text-xs">
                                    {phantom.market}
                                  </Badge>
                                </div>
                              </CardDescription>
                            </div>
                            <Badge className="bg-red-100 text-red-800 px-3 py-1 text-sm font-medium">
                              {phantom.lead_phone}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                              <div>
                                <p className="text-sm text-red-800 font-medium mb-2">
                                  <strong>Data Integrity Issue:</strong> This lead was marked as "booked" but no appointment exists.
                                </p>
                                <p className="text-xs text-red-700">
                                  Please explain what actually happened with this lead to resolve the data inconsistency.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Resolution Selection */}
                          <div>
                            <label className="block text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              What Actually Happened? *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { value: 'sale', label: 'Sale', color: 'green', desc: 'Client purchased policy' },
                                { value: 'set_appointment', label: 'Set Appointment', color: 'blue', desc: 'Scheduled follow-up meeting' },
                                { value: 'not_interested', label: 'Not Interested', color: 'red', desc: 'Client declined service' },
                                { value: 'pending', label: 'Pending', color: 'yellow', desc: 'Still under consideration' }
                              ].map((outcome) => (
                                <button
                                  key={outcome.value}
                                  type="button"
                                  onClick={() => handleOutcomeChange(`phantom-${index}`, outcome.value as ActivityReport['outcome'])}
                                  className={`p-4 rounded-xl border-2 transition-all text-sm font-medium ${
                                    report?.outcome === outcome.value
                                      ? `${getOutcomeColor(outcome.value)} text-white border-transparent shadow-lg transform scale-105`
                                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    {getOutcomeIcon(outcome.value)}
                                    <span className="font-semibold">{outcome.label}</span>
                                  </div>
                                  <p className="text-xs opacity-75">{outcome.desc}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sale Amount (only for sales) */}
                          {report?.outcome === 'sale' && (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                              <label className="block text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                ALP Amount ($) *
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Enter ALP amount"
                                className="w-full p-3 border-2 border-green-300 rounded-lg text-lg font-medium focus:border-green-500 focus:outline-none"
                                value={report.saleAmount || ''}
                                onChange={(e) => handleSaleAmountChange(`phantom-${index}`, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}

                          {/* Appointment Scheduling (for set_appointment outcome) */}
                          {report?.outcome === 'set_appointment' && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                              <label className="block text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Schedule Appointment *
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-blue-700 mb-1">Date</label>
                                  <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full p-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                    value={appointmentScheduling?.callSid === `phantom-${index}` ? appointmentScheduling.appointmentDate : ''}
                                    onChange={(e) => setAppointmentScheduling({ 
                                      callSid: `phantom-${index}`, 
                                      appointmentDate: e.target.value, 
                                      appointmentTime: appointmentScheduling?.appointmentTime || '' 
                                    })}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-blue-700 mb-1">Time</label>
                                  <input
                                    type="time"
                                    className="w-full p-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                    value={appointmentScheduling?.callSid === `phantom-${index}` ? appointmentScheduling.appointmentTime : ''}
                                    onChange={(e) => setAppointmentScheduling({ 
                                      callSid: `phantom-${index}`, 
                                      appointmentDate: appointmentScheduling?.appointmentDate || '', 
                                      appointmentTime: e.target.value 
                                    })}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Notes section for phantom bookings */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Explanation (Required)
                            </label>
                            <Textarea
                              placeholder="Please explain what happened with this lead..."
                              className="w-full h-20 resize-none"
                              value={report?.notes || ''}
                              onChange={(e) => handleNotesChange(`phantom-${index}`, e.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Disposition Inconsistencies */}
                  {accountabilityData?.dispositionInconsistencies?.map((inconsistency: any, index: number) => {
                    const report = activityReports.find(r => r.activityId === inconsistency.callSid && r.activityType === 'call');
                    const appointmentCount = accountabilityData?.appointments?.length || 0;
                    
                    return (
                      <Card key={inconsistency.callSid} className="border-l-6 border-l-red-800 bg-red-50 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-4 bg-gradient-to-r from-red-50 to-red-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold text-red-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-red-800 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                  {appointmentCount + index + 1}
                                </div>
                                Data Integrity Issue: Phantom Booking
                              </CardTitle>
                              <CardDescription className="flex items-center gap-3 mt-2 text-gray-700">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4 text-red-600" />
                                  <span className="font-medium">
                                    {new Date(inconsistency.accountabilityDate).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-green-500" />
                                  <span className="font-medium">
                                    Duration: {Math.floor(inconsistency.callDuration / 60)}m {inconsistency.callDuration % 60}s
                                  </span>
                                </div>
                                <Badge className="bg-red-200 text-red-900 text-xs">
                                  {inconsistency.issueType}
                                </Badge>
                              </CardDescription>
                            </div>
                            <Badge className="bg-red-200 text-red-800 px-3 py-1 text-sm font-medium">
                              {inconsistency.callDirection === 'inbound' ? inconsistency.fromNumber : inconsistency.toNumber}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="bg-red-100 p-4 rounded-lg mb-4 border border-red-200">
                            <p className="text-sm text-red-800 font-medium mb-2">
                              <strong>Issue:</strong> This call was marked as "booked" but no appointment record exists in the system.
                            </p>
                            <p className="text-xs text-red-700">
                              Please provide the correct disposition or create the missing appointment record.
                            </p>
                          </div>

                          {/* Call Outcome Selection */}
                          <div className="space-y-4">
                            <label className="block text-lg font-bold text-gray-800 mb-3">
                              Correct Call Disposition:
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {[
                                { value: 'sale', label: 'Sale', color: 'green' },
                                { value: 'refused', label: 'Refused', color: 'red' },
                                { value: 'set_appointment', label: 'Actually Booked', color: 'blue' },
                                { value: 'callback', label: 'Callback', color: 'yellow' },
                                { value: 'not_interested', label: 'Not Interested', color: 'gray' },
                                { value: 'wrong_number', label: 'Wrong Number', color: 'orange' }
                              ].map((outcome) => (
                                <button
                                  key={outcome.value}
                                  type="button"
                                  onClick={() => handleOutcomeChange(inconsistency.callSid, outcome.value as ActivityReport['outcome'])}
                                  className={`p-3 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-2 ${
                                    report?.outcome === outcome.value
                                      ? `${getOutcomeColor(outcome.value)} text-white border-transparent shadow-lg transform scale-105`
                                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
                                  }`}
                                >
                                  {getOutcomeIcon(outcome.value)}
                                  <span>{outcome.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Unresolved Calls */}
                  {accountabilityData?.unresolvedCalls?.map((call: UnresolvedCall, index: number) => {
                    const report = activityReports.find(r => r.activityId === call.call_sid && r.activityType === 'call');
                    const appointmentCount = accountabilityData?.appointments?.length || 0;
                    const inconsistencyCount = accountabilityData?.dispositionInconsistencies?.length || 0;
                    
                    return (
                      <Card key={call.call_sid} className="border-l-6 border-l-red-500 bg-white shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-red-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                  {appointmentCount + inconsistencyCount + index + 1}
                                </div>
                                {call.call_direction === 'inbound' ? 'Incoming AOI Call' : 'Outbound Call'}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-3 mt-2 text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4 text-red-500" />
                                  <span className="font-medium">
                                    {new Date(call.call_date).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-green-500" />
                                  <span className="font-medium">
                                    Duration: {call.minutes ? `${call.minutes}m ${call.seconds}s` : `${Math.round(call.duration)}s`}
                                  </span>
                                </div>
                                {call.call_direction === 'inbound' && (
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                                      AOI Intel
                                    </Badge>
                                  </div>
                                )}
                              </CardDescription>
                            </div>
                            <Badge className="bg-red-100 text-red-800 px-3 py-1 text-sm font-medium">
                              {call.call_direction === 'inbound' ? call.from_number : call.to_number}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                          {/* Outcome Selection */}
                          <div>
                            <label className="block text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              Call Outcome *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { value: 'sale', label: 'Sale', color: 'green' },
                                { value: 'refused', label: 'Refused', color: 'red' },
                                { value: 'cannot_afford', label: 'Cannot Afford', color: 'orange' },
                                { value: 'thinker', label: 'Thinker', color: 'yellow' },
                                { value: 'medically_uninsurable', label: 'Med. Uninsurable', color: 'purple' },
                                { value: 'no_need', label: 'No Need', color: 'gray' },
                                { value: 'no_show', label: 'No Show', color: 'red' },
                                { value: 'reschedule', label: 'Reschedule', color: 'blue' },
                                { value: 'set_appointment', label: 'Set Appointment', color: 'blue' },
                                { value: 'not_interested', label: 'Not Interested', color: 'red' },
                                { value: 'callback_requested', label: 'Callback Requested', color: 'yellow' },
                                { value: 'no_answer', label: 'No Answer', color: 'gray' },
                                { value: 'voicemail', label: 'Voicemail', color: 'orange' },
                                { value: 'wrong_number', label: 'Wrong Number', color: 'red' },
                                { value: 'do_not_call', label: 'Do Not Call', color: 'red' },
                                { value: 'pending', label: 'Pending', color: 'yellow' }
                              ].map((outcome) => (
                                <button
                                  key={outcome.value}
                                  type="button"
                                  onClick={() => handleOutcomeChange(call.call_sid, outcome.value as ActivityReport['outcome'])}
                                  className={`p-3 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-2 ${
                                    report?.outcome === outcome.value
                                      ? `${getOutcomeColor(outcome.value)} text-white border-transparent shadow-lg transform scale-105`
                                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
                                  }`}
                                >
                                  {getOutcomeIcon(outcome.value)}
                                  <span>{outcome.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sale Amount (only for sales) */}
                          {report?.outcome === 'sale' && (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                              <label className="block text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Sale Amount ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Enter sale amount"
                                className="w-full p-3 border-2 border-green-300 rounded-lg text-lg font-medium focus:border-green-500 focus:outline-none"
                                value={report.saleAmount || ''}
                                onChange={(e) => handleSaleAmountChange(call.call_sid, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}

                          {/* Appointment Scheduling (for set_appointment outcome) */}
                          {report?.outcome === 'set_appointment' && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                              <label className="block text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Schedule Appointment *
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-blue-700 mb-1">Date</label>
                                  <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full p-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                    value={appointmentScheduling?.appointmentDate || ''}
                                    onChange={(e) => setAppointmentScheduling(prev => 
                                      prev ? { ...prev, appointmentDate: e.target.value } : null
                                    )}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-blue-700 mb-1">Time</label>
                                  <input
                                    type="time"
                                    className="w-full p-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                    value={appointmentScheduling?.appointmentTime || ''}
                                    onChange={(e) => setAppointmentScheduling(prev => 
                                      prev ? { ...prev, appointmentTime: e.target.value } : null
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Notes (optional for calls) */}
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-lg font-bold text-gray-800 mb-2">
                              Notes (Optional)
                            </label>
                            <textarea
                              placeholder="Add notes about this call..."
                              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:border-gray-500 focus:outline-none"
                              rows={3}
                              value={report?.notes || ''}
                              onChange={(e) => handleNotesChange(call.call_sid, e.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {/* Disposition Inconsistencies */}
                  {accountabilityData?.dispositionInconsistencies?.map((inconsistency: DispositionInconsistency, index: number) => {
                    const report = activityReports.find(r => r.activityId === `inconsistency-${inconsistency.id}` && r.activityType === 'call');
                    
                    return (
                      <Card key={`inconsistency-${inconsistency.id}`} className="border-l-6 border-l-red-500 bg-red-50 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="pb-4 bg-gradient-to-r from-red-50 to-red-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold text-red-800 flex items-center gap-2">
                                <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                  ⚠
                                </div>
                                Disposition Inconsistency
                              </CardTitle>
                              <CardDescription className="flex items-center gap-3 mt-2 text-red-700">
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-4 h-4 text-red-600" />
                                  <span className="font-medium">
                                    Issue: {inconsistency.issueType}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-red-600" />
                                  <span className="font-medium">
                                    Reported: {inconsistency.reportedOutcome}
                                  </span>
                                </div>
                              </CardDescription>
                            </div>
                            <Badge className="bg-red-200 text-red-900 px-3 py-1 text-sm font-medium">
                              {inconsistency.callSid}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                          <div className="bg-red-100 p-4 rounded-xl border border-red-200">
                            <p className="text-red-800 font-medium">
                              <strong>Issue:</strong> This call was marked as "{inconsistency.reportedOutcome}" but no corresponding appointment record was found. 
                              Please provide the correct disposition for this call.
                            </p>
                          </div>

                          {/* Outcome Selection for Inconsistency Resolution */}
                          <div>
                            <label className="block text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-red-600" />
                              Correct Call Outcome *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { value: 'sale', label: 'Sale', color: 'green' },
                                { value: 'refused', label: 'Refused', color: 'red' },
                                { value: 'cannot_afford', label: 'Cannot Afford', color: 'orange' },
                                { value: 'thinker', label: 'Thinker', color: 'yellow' },
                                { value: 'medically_uninsurable', label: 'Med. Uninsurable', color: 'purple' },
                                { value: 'no_need', label: 'No Need', color: 'gray' },
                                { value: 'no_show', label: 'No Show', color: 'red' },
                                { value: 'reschedule', label: 'Reschedule', color: 'blue' },
                                { value: 'set_appointment', label: 'Set Appointment', color: 'blue' },
                                { value: 'not_interested', label: 'Not Interested', color: 'red' },
                                { value: 'callback_requested', label: 'Callback Requested', color: 'yellow' },
                                { value: 'no_answer', label: 'No Answer', color: 'gray' },
                                { value: 'voicemail', label: 'Voicemail', color: 'orange' },
                                { value: 'wrong_number', label: 'Wrong Number', color: 'red' },
                                { value: 'do_not_call', label: 'Do Not Call', color: 'red' },
                                { value: 'pending', label: 'Pending', color: 'yellow' }
                              ].map((outcome) => (
                                <button
                                  key={outcome.value}
                                  type="button"
                                  onClick={() => handleOutcomeChange(`inconsistency-${inconsistency.id}`, outcome.value as ActivityReport['outcome'])}
                                  className={`p-3 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-2 ${
                                    report?.outcome === outcome.value
                                      ? `${getOutcomeColor(outcome.value)} text-white border-transparent shadow-lg transform scale-105`
                                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
                                  }`}
                                >
                                  {getOutcomeIcon(outcome.value)}
                                  <span>{outcome.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sale Amount (only for sales) */}
                          {report?.outcome === 'sale' && (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                              <label className="block text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Sale Amount ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Enter sale amount"
                                className="w-full p-3 border-2 border-green-300 rounded-lg text-lg font-medium focus:border-green-500 focus:outline-none"
                                value={report.saleAmount || ''}
                                onChange={(e) => handleSaleAmountChange(`inconsistency-${inconsistency.id}`, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}

                          {/* Notes (required for inconsistencies) */}
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-lg font-bold text-gray-800 mb-2">
                              Resolution Notes *
                            </label>
                            <textarea
                              placeholder="Explain why the original disposition was incorrect..."
                              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:border-gray-500 focus:outline-none"
                              rows={3}
                              value={report?.notes || ''}
                              onChange={(e) => handleNotesChange(`inconsistency-${inconsistency.id}`, e.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>



              {/* Submit Button */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">Ready to Submit?</h4>
                    <p className="text-gray-600">
                      {activityReports.every(r => r.outcome) ? 
                        "All required fields completed. Submit to continue." : 
                        "Please complete all activity outcomes before submitting."
                      }
                    </p>
                  </div>
                  <Button 
                    onClick={submitAOIReport}
                    disabled={(() => {
                      const valid = isFormValid();
                      console.log('🔥 BUTTON DISABLED CHECK:', !valid || submitting, 'Valid:', valid, 'Submitting:', submitting);
                      return !valid || submitting;
                    })()}
                    className={`px-8 py-3 text-lg font-bold transition-all ${
                      isFormValid() && !submitting
                        ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg transform hover:scale-105'
                        : 'bg-gray-400'
                    }`}
                    size="lg"
                    onMouseEnter={() => {
                      console.log('🔥 BUTTON HOVER - isFormValid():', isFormValid());
                      console.log('🔥 BUTTON HOVER - submitting:', submitting);
                    }}
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Submit Report & Continue
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}