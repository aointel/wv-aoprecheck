import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, AlertCircle, CheckCircle, ArrowRight, Trophy, DollarSign, X, CreditCard, Brain, Shield, Ban, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';

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

function AccountabilitySection({ userEmail }: { userEmail?: string }) {
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

  const pendingCount = accountabilityStatus?.pendingConnectsCount || 0;
  const isBlocked = accountabilityStatus?.isBlocked || false;
  const totalActivities = accountabilityStatus?.totalActivities || 0;

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            AOI Report Status
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Report outcomes for each connect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/30 rounded-lg border">
            <div className="flex items-center gap-2">
              {pendingCount > 0 ? (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium">
                Pending Reports
              </span>
            </div>
            <Badge variant={pendingCount > 0 ? "destructive" : "secondary"}>
              {pendingCount}
            </Badge>
          </div>

          {totalActivities > 0 && (
            <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">
                  Total Activities
                </span>
              </div>
              <Badge variant="outline">
                {totalActivities}
              </Badge>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {pendingCount > 0 && (
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => window.location.href = '/accountability'}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Complete Reports ({pendingCount})
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={() => window.location.href = '/accountability'}
          >
            View All Reports
          </Button>
        </div>

        {/* Warning Message */}
        {isBlocked && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                <p className="font-medium">Reports Required</p>
                <p>Complete pending reports to continue using the system.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AOIReportPage() {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Demo reports data - similar to Call Connector Pro leads
  const demoReports = [
    {
      id: 1,
      leadName: "Robert Johnson",
      leadPhone: "(555) 234-5678",
      appointmentDate: "2025-01-05",
      appointmentTime: "10:00 AM",
      status: "pending",
      outcome: null,
      leadAge: 45,
      leadState: "TX",
      leadScore: 85
    },
    {
      id: 2,
      leadName: "Mary Williams",
      leadPhone: "(555) 345-6789", 
      appointmentDate: "2025-01-05",
      appointmentTime: "2:30 PM",
      status: "pending",
      outcome: null,
      leadAge: 52,
      leadState: "FL",
      leadScore: 92
    },
    {
      id: 3,
      leadName: "David Brown",
      leadPhone: "(555) 456-7890",
      appointmentDate: "2025-01-04",
      appointmentTime: "11:15 AM", 
      status: "completed",
      outcome: "sale",
      saleAmount: 450.00,
      leadAge: 38,
      leadState: "CA",
      leadScore: 78
    },
    {
      id: 4,
      leadName: "Jennifer Davis",
      leadPhone: "(555) 567-8901",
      appointmentDate: "2025-01-04",
      appointmentTime: "3:45 PM",
      status: "completed",
      outcome: "thinker",
      notes: "Interested but needs to discuss with spouse",
      leadAge: 41,
      leadState: "NY",
      leadScore: 88
    },
    {
      id: 5,
      leadName: "Michael Miller",
      leadPhone: "(555) 678-9012",
      appointmentDate: "2025-01-03",
      appointmentTime: "9:30 AM",
      status: "completed", 
      outcome: "refused",
      notes: "Not interested in coverage at this time",
      leadAge: 35,
      leadState: "AZ",
      leadScore: 65
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              AOI Report
            </h1>
            <p className="text-lg text-muted-foreground">
              Complete your AOI report by reporting appointment outcomes
            </p>
          </div>

          {/* Main Content */}
          <div className="grid gap-6">
            {/* Accountability Status Section */}
            <AccountabilitySection userEmail={authState?.user?.email} />

            {/* Demo Reports Section */}
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                  Demo Reports - Test Data
                </CardTitle>
                <CardDescription>
                  Sample appointment reports for testing (similar to Call Connector Pro leads)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {demoReports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4 bg-white/50 dark:bg-gray-800/30">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-base">{report.leadName}</h4>
                          <p className="text-sm text-muted-foreground">{report.leadPhone}</p>
                        </div>
                        <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'}>
                          {report.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <p className="font-medium">{report.appointmentDate}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time:</span>
                          <p className="font-medium">{report.appointmentTime}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Age:</span>
                          <p className="font-medium">{report.leadAge} years</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">State:</span>
                          <p className="font-medium">{report.leadState}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Lead Score:</span>
                          <Badge variant="outline" className="text-xs">{report.leadScore}%</Badge>
                        </div>

                        {report.outcome && (
                          <div className="flex items-center gap-2">
                            {report.outcome === 'sale' && (
                              <>
                                <DollarSign className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-green-700">
                                  Sale: ${report.saleAmount?.toFixed(2)}
                                </span>
                              </>
                            )}
                            {report.outcome === 'refused' && (
                              <>
                                <X className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-medium text-red-700">Refused</span>
                              </>
                            )}
                            {report.outcome === 'thinker' && (
                              <>
                                <Brain className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-medium text-purple-700">Thinker</span>
                              </>
                            )}
                          </div>
                        )}

                        {report.status === 'pending' && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Report Outcome
                          </Button>
                        )}
                      </div>

                      {report.notes && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                          <span className="text-muted-foreground">Notes:</span> {report.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Additional Information Card */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  AOI Report System
                </CardTitle>
                <CardDescription>
                  How the AOI Report accountability system works
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Report Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      All appointment outcomes must be reported within 24 hours to maintain system access.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Outcome Types</h4>
                    <p className="text-sm text-muted-foreground">
                      Report sales, refusals, reschedules, no-shows, and other appointment outcomes.
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Available Dispositions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <DollarSign className="w-3 h-3 text-green-500" />
                      <span>Sale</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <X className="w-3 h-3 text-red-500" />
                      <span>Refused</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CreditCard className="w-3 h-3 text-yellow-500" />
                      <span>Cannot Afford</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Brain className="w-3 h-3 text-purple-500" />
                      <span>Thinker</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Shield className="w-3 h-3 text-blue-500" />
                      <span>Uninsurable</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Ban className="w-3 h-3 text-gray-500" />
                      <span>No Need</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                      <span>No Show</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      <span>Reschedule</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}