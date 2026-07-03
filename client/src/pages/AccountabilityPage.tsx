import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
  duration: number;
  to_number: string;
  from_number: string;
  created_at: string;
  call_date: string;
}

interface PhantomBooking {
  lead_name: string;
  lead_phone: string;
  market: string;
  updated_at: string;
  type: 'phantom_booking';
  severity: 'high';
  description: string;
}

interface ActivityReport {
  activityId: string | number;
  activityType: 'appointment' | 'call' | 'phantom_booking';
  outcome?: 'sale' | 'refused' | 'cannot_afford' | 'thinker' | 'medically_uninsurable' | 'no_need' | 'no_show' | 'reschedule' | 'pending';
  saleAmount?: number;
  notes?: string;
}

export function AccountabilityPage() {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountabilityData, setAccountabilityData] = useState<any>(null);
  const [activityReports, setActivityReports] = useState<ActivityReport[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [plusLeadsCollected, setPlusLeadsCollected] = useState(0);

  useEffect(() => {
    checkAOIReportStatus();
  }, [authState.user?.email]);

  const checkAOIReportStatus = async () => {
    if (!authState.user?.email) return;
    
    try {
      const response = await fetch(`/api/accountability/check-status?userEmail=${encodeURIComponent(authState.user.email)}`);
      const data = await response.json();
      
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
      
      // Add phantom booking activities
      if (data.phantomBookings) {
        const phantomReports = data.phantomBookings.map((phantom: PhantomBooking, index: number) => ({
          activityId: `phantom_${phantom.lead_phone}_${index}`,
          activityType: 'phantom_booking' as const,
          outcome: undefined as any,
          saleAmount: 0,
          notes: ''
        }));
        allReports.push(...phantomReports);
      }
      
      setActivityReports(allReports);
      
      // If not blocked, redirect to dashboard
      if (!data.isBlocked) {
        setLocation('/dashboard');
      }
      
    } catch (error) {
      console.error('Failed to check AOI report status:', error);
      toast({
        title: "Error",
        description: "Failed to load AOI report status",
        variant: "destructive"
      });
    } finally {
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
    
    setSubmitting(true);
    
    try {
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
        
        // Navigate to dashboard
        setLocation('/dashboard');
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

  const getOutcomeColor = (outcome: string) => {
    // All outcomes use the same blue color when selected
    return 'bg-blue-500';
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'sale': return <DollarSign className="w-4 h-4" />;
      case 'refused': return <X className="w-4 h-4" />;
      case 'cannot_afford': return <CreditCard className="w-4 h-4" />;
      case 'thinker': return <Brain className="w-4 h-4" />;
      case 'medically_uninsurable': return <Shield className="w-4 h-4" />;
      case 'no_need': return <Ban className="w-4 h-4" />;
      case 'no_show': return <AlertTriangle className="w-4 h-4" />;
      case 'reschedule': return <Calendar className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading AOI report status...</div>
      </div>
    );
  }

  if (!accountabilityData?.isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Redirecting to dashboard...</div>
      </div>
    );
  }

  const totalSales = activityReports.filter(r => r.outcome === 'sale').length;
  const totalRevenue = activityReports
    .filter(r => r.outcome === 'sale')
    .reduce((sum, r) => sum + (r.saleAmount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full mb-4">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">Unresolved Activity Found</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">📊 Daily Activity Report</h1>
          <p className="text-blue-200">
            Complete your activity report for <strong>{new Date(accountabilityData.accountabilityDate).toLocaleDateString()}</strong> to access the system
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            {[
              accountabilityData.appointmentsToReport > 0 ? `${accountabilityData.appointmentsToReport} unresolved appointment(s)` : null,
              accountabilityData.unresolvedCallsCount > 0 ? `${accountabilityData.unresolvedCallsCount} unresolved call(s)` : null,
              accountabilityData.phantomBookingsCount > 0 ? `${accountabilityData.phantomBookingsCount} phantom booking(s)` : null
            ].filter(Boolean).length > 0 
              ? `You have ${[
                  accountabilityData.appointmentsToReport > 0 ? `${accountabilityData.appointmentsToReport} unresolved appointment(s)` : null,
                  accountabilityData.unresolvedCallsCount > 0 ? `${accountabilityData.unresolvedCallsCount} unresolved call(s)` : null,
                  accountabilityData.phantomBookingsCount > 0 ? `${accountabilityData.phantomBookingsCount} phantom booking(s)` : null
                ].filter(Boolean).join(', ')} requiring dispositions.`
              : 'No unresolved activities found.'
            }
            {accountabilityData.phantomBookingsCount > 0 && (
              <span className="block text-red-300 font-semibold mt-1">
                🚨 Phantom bookings require immediate attention for data integrity!
              </span>
            )}
          </p>
        </div>

        <div className="grid gap-6 mb-8">
          {accountabilityData.appointments?.map((appointment: Appointment, index: number) => {
            const report = activityReports.find(r => r.activityId === appointment.id && r.activityType === 'appointment');
            
            return (
              <Card key={appointment.id} className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {appointment.title || `Appointment with ${appointment.lead_name}`}
                  </CardTitle>
                  <CardDescription className="text-blue-200">
                    {new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                    {new Date(appointment.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <br />
                    {appointment.lead_name} • {appointment.lead_phone}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-white font-medium mb-2 block">What was the outcome?</label>
                    <div className="flex flex-wrap gap-2">
                      {(['sale', 'refused', 'cannot_afford', 'thinker', 'medically_uninsurable', 'no_need', 'no_show', 'reschedule'] as const).map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => handleOutcomeChange(appointment.id, outcome)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                            report?.outcome === outcome 
                              ? `${getOutcomeColor(outcome)} text-white` 
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {getOutcomeIcon(outcome)}
                          {outcome.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {report?.outcome === 'sale' && (
                    <div>
                      <label className="text-white font-medium mb-2 block">Sale Amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={report.saleAmount || ''}
                        onChange={(e) => handleSaleAmountChange(appointment.id, Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                        placeholder="Enter sale amount"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-white font-medium mb-2 block">Notes (optional)</label>
                    <Textarea
                      value={report?.notes || ''}
                      onChange={(e) => handleNotesChange(appointment.id, e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder-white/50"
                      placeholder="Any additional notes about this appointment..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Render unresolved calls */}
          {accountabilityData.unresolvedCalls?.map((call: UnresolvedCall) => {
            const report = activityReports.find(r => r.activityId === call.call_sid && r.activityType === 'call');
            const duration = Math.floor(call.duration / 60);
            const seconds = call.duration % 60;
            
            return (
              <Card key={`call-${call.call_sid}`} className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Unresolved Call - {duration}m {seconds}s
                  </CardTitle>
                  <CardDescription className="text-blue-200">
                    Called {call.to_number} on {new Date(call.created_at).toLocaleDateString()}
                    <br />
                    Duration: {duration} minutes {seconds} seconds • From: {call.from_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-white font-medium mb-2 block">What was the outcome of this call?</label>
                    <div className="flex flex-wrap gap-2">
                      {(['sale', 'refused', 'cannot_afford', 'thinker', 'medically_uninsurable', 'no_need', 'no_show', 'reschedule', 'pending'] as const).map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => handleOutcomeChange(call.call_sid, outcome)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                            report?.outcome === outcome 
                              ? `${getOutcomeColor(outcome)} text-white` 
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {getOutcomeIcon(outcome)}
                          {outcome.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {report?.outcome === 'sale' && (
                    <div>
                      <label className="text-white font-medium mb-2 block">Sale Amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={report.saleAmount || ''}
                        onChange={(e) => handleSaleAmountChange(call.call_sid, Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                        placeholder="Enter sale amount"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-white font-medium mb-2 block">Notes (optional)</label>
                    <Textarea
                      value={report?.notes || ''}
                      onChange={(e) => handleNotesChange(call.call_sid, e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder-white/50"
                      placeholder="What happened on this call? Any follow-up needed?"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Render phantom bookings */}
          {accountabilityData.phantomBookings?.map((phantom: PhantomBooking, index: number) => {
            const phantomId = `phantom_${phantom.lead_phone}_${index}`;
            const report = activityReports.find(r => r.activityId === phantomId && r.activityType === 'phantom_booking');
            
            return (
              <Card key={phantomId} className="bg-red-900/20 backdrop-blur-md border-red-500/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    🚨 PHANTOM BOOKING - Data Integrity Issue
                  </CardTitle>
                  <CardDescription className="text-red-200">
                    <strong>{phantom.lead_name}</strong> • {phantom.lead_phone}
                    <br />
                    Market: {phantom.market} • Last Updated: {new Date(phantom.updated_at).toLocaleDateString()}
                    <br />
                    <span className="text-red-300 font-semibold">
                      ⚠️ Lead marked as "booked" but NO appointment found in system
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-red-800/30 p-3 rounded-lg border border-red-500/30">
                    <p className="text-red-100 text-sm">
                      <strong>Issue:</strong> This lead was marked as "booked" in your lead management system, 
                      but no corresponding appointment was created. This creates false positive statistics 
                      and must be resolved for accurate accountability.
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-white font-medium mb-2 block">
                      What actually happened with this lead?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['sale', 'refused', 'cannot_afford', 'thinker', 'medically_uninsurable', 'no_need', 'no_show', 'reschedule'] as const).map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => handleOutcomeChange(phantomId, outcome)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                            report?.outcome === outcome 
                              ? `${getOutcomeColor(outcome)} text-white` 
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {getOutcomeIcon(outcome)}
                          {outcome.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {report?.outcome === 'sale' && (
                    <div>
                      <label className="text-white font-medium mb-2 block">Sale Amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={report.saleAmount || ''}
                        onChange={(e) => handleSaleAmountChange(phantomId, Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                        placeholder="Enter sale amount"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-white font-medium mb-2 block">
                      Explanation (Required - Why was this marked as booked?)
                    </label>
                    <Textarea
                      value={report?.notes || ''}
                      onChange={(e) => handleNotesChange(phantomId, e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder-white/50"
                      placeholder="Please explain what happened. Was this a data entry error? Did the lead actually book but appointment wasn't recorded? This helps improve our processes."
                      rows={3}
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Summary & Additional Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{totalSales}</div>
                <div className="text-blue-200">Sales Made</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">${totalRevenue.toLocaleString()}</div>
                <div className="text-blue-200">Total Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{(accountabilityData.appointmentsToReport || 0) + (accountabilityData.unresolvedCallsCount || 0) + (accountabilityData.phantomBookingsCount || 0)}</div>
                <div className="text-blue-200">Total Activity</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{plusLeadsCollected}</div>
                <div className="text-blue-200">Plus Leads</div>
              </div>
            </div>
            
            <div className="max-w-md mx-auto">
              <label className="text-white font-medium mb-2 block">Plus Leads Collected (Referrals)</label>
              <input
                type="number"
                min="0"
                value={plusLeadsCollected}
                onChange={(e) => setPlusLeadsCollected(Number(e.target.value))}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-md px-3 py-2 text-center text-lg font-semibold"
                placeholder="0"
              />
              <p className="text-blue-200 text-sm mt-1 text-center">Number of referrals you collected yesterday</p>
            </div>
            
            <div>
              <label className="text-white font-medium mb-2 block">General Notes</label>
              <Textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-white/50"
                placeholder="Any general notes about yesterday's performance..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={submitAOIReport}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
          >
            {submitting ? 'Submitting Report...' : 'Submit AOI Report'}
          </Button>
          <p className="text-blue-200 mt-2 text-sm">
            You'll earn {accountabilityData.appointmentsToReport * 5} XP for completing this report
          </p>
        </div>
      </div>
    </div>
  );
}