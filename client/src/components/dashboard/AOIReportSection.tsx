import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  Clock, 
  User,
  AlertTriangle,
  CheckCircle,
  FileText,
  Trophy
} from 'lucide-react';
import { useLocation } from 'wouter';

interface UnresolvedAppointment {
  id: string;
  title: string;
  lead_name: string;
  lead_phone: string;
  start_time: string;
  end_time: string;
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

interface AccountabilityStatus {
  isBlocked: boolean;
  hasCompletedReport: boolean;
  accountabilityDate: string | null;
  appointmentsToReport: number;
  appointments: UnresolvedAppointment[];
  unresolvedCalls: UnresolvedCall[];
  unresolvedCallsCount: number;
}

export function AOIReportSection() {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();
  const userEmail = authState?.user?.email || 'cnsysop@aoglobelife.com';

  // Get accountability status to see if there are unresolved appointments
  const { data: accountabilityStatus, isLoading } = useQuery<AccountabilityStatus>({
    queryKey: ['/api/accountability/check-status', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/accountability/check-status?userEmail=${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 60000, // Check every minute
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            AOI Report Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-yellow-700 dark:text-yellow-400">Checking for unresolved appointments...</div>
        </CardContent>
      </Card>
    );
  }

  // If no unresolved appointments AND no unresolved calls, show positive status
  if (!accountabilityStatus?.isBlocked || 
      (accountabilityStatus?.appointmentsToReport === 0 && 
       accountabilityStatus?.unresolvedCallsCount === 0)) {
    return (
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            AOI Report Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">All caught up!</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            No pending AOI reports required.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show unresolved appointments that need AOI reports
  const appointmentDate = new Date(accountabilityStatus.accountabilityDate || '').toLocaleDateString();
  
  return (
    <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          AOI Report Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Unresolved appointments from {appointmentDate}</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-500 mt-1">
              {accountabilityStatus.appointmentsToReport} appointment{accountabilityStatus.appointmentsToReport !== 1 ? 's' : ''} 
              {accountabilityStatus.unresolvedCallsCount > 0 && 
                ` and ${accountabilityStatus.unresolvedCallsCount} unresolved call${accountabilityStatus.unresolvedCallsCount !== 1 ? 's' : ''}`
              } need reporting
            </p>
          </div>
          <Button 
            onClick={() => setLocation('/accountability')}
            className="bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Complete Report
          </Button>
        </div>

        {/* Show the appointments that need reporting */}
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {accountabilityStatus.appointments.slice(0, 3).map((appointment) => (
            <div key={appointment.id} className="flex items-center gap-2 p-2 bg-white/50 dark:bg-black/20 rounded border">
              <User className="h-4 w-4 text-red-500" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-red-800 dark:text-red-300 truncate">
                  {appointment.lead_name}
                </div>
                <div className="text-xs text-red-600 dark:text-red-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <Badge variant="outline" className="border-red-300 text-red-700 text-xs">
                Pending
              </Badge>
            </div>
          ))}
          
          {accountabilityStatus.appointmentsToReport > 3 && (
            <div className="text-center text-sm text-red-600 dark:text-red-500 pt-2">
              +{accountabilityStatus.appointmentsToReport - 3} more appointments...
            </div>
          )}
        </div>

        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded border border-red-200 dark:border-red-700/50">
          <div className="text-sm text-red-800 dark:text-red-300">
            <strong>Important:</strong> Complete your AOI report to maintain system access. 
            System will lock out after today until reports are submitted.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}