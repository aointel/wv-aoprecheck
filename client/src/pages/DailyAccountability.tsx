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

interface AppointmentReport {
  appointmentId: number;
  outcome?: 'sale' | 'refused' | 'cannot_afford' | 'thinker' | 'medically_uninsurable' | 'no_need' | 'no_show' | 'reschedule';
  saleAmount?: number;
  notes?: string;
}

export function DailyAccountability() {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountabilityData, setAccountabilityData] = useState<any>(null);
  const [appointmentReports, setAppointmentReports] = useState<AppointmentReport[]>([]);
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
      
      // Initialize appointment reports - no default outcome
      if (data.appointments) {
        const initialReports = data.appointments.map((apt: Appointment) => ({
          appointmentId: apt.id,
          outcome: undefined as any, // No default selection
          saleAmount: 0,
          notes: ''
        }));
        setAppointmentReports(initialReports);
      }
      
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

  const handleOutcomeChange = (appointmentId: number, outcome: AppointmentReport['outcome']) => {
    setAppointmentReports(prev => 
      prev.map(report => 
        report.appointmentId === appointmentId 
          ? { ...report, outcome, saleAmount: outcome === 'sale' ? (report.saleAmount || 0) : undefined }
          : report
      )
    );
  };

  const handleSaleAmountChange = (appointmentId: number, amount: number) => {
    setAppointmentReports(prev => 
      prev.map(report => 
        report.appointmentId === appointmentId 
          ? { ...report, saleAmount: amount }
          : report
      )
    );
  };

  const handleNotesChange = (appointmentId: number, notes: string) => {
    setAppointmentReports(prev => 
      prev.map(report => 
        report.appointmentId === appointmentId 
          ? { ...report, notes }
          : report
      )
    );
  };

  const submitAOIReport = async () => {
    if (!authState.user?.email || !accountabilityData) return;
    
    // Check if all appointments have outcomes selected
    const incompleteReports = appointmentReports.filter(r => !r.outcome);
    if (incompleteReports.length > 0) {
      toast({
        title: "Incomplete Report",
        description: "Please select an outcome for all appointments before submitting.",
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
          appointmentReports,
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

  const totalSales = appointmentReports.filter(r => r.outcome === 'sale').length;
  const totalRevenue = appointmentReports
    .filter(r => r.outcome === 'sale')
    .reduce((sum, r) => sum + (r.saleAmount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full mb-4">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">Unresolved Appointments Found</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">📊 Daily AOI Report</h1>
          <p className="text-blue-200">
            Complete your AOI report for <strong>{new Date(accountabilityData.accountabilityDate).toLocaleDateString()}</strong> to access the system
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            You have unresolved appointments from {new Date(accountabilityData.accountabilityDate).toLocaleDateString()}. 
            All previous appointment outcomes must be reported before system access is restored.
          </p>
        </div>

        <div className="grid gap-6 mb-8">
          {accountabilityData.appointments.map((appointment: Appointment, index: number) => {
            const report = appointmentReports.find(r => r.appointmentId === appointment.id);
            
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
                <div className="text-2xl font-bold text-blue-400">{accountabilityData.appointmentsToReport}</div>
                <div className="text-blue-200">Total Appointments</div>
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