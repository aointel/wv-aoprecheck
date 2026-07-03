import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, FileText, Clock, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/use-auth';

interface AOIReportsBlockerProps {
  children: React.ReactNode;
}

interface AOIBlockingStatus {
  hasPendingReports: boolean;
  pendingCount: number;
  mustResolveReports: boolean;
  hasOverdueAppointments?: boolean;
  overdueAppointmentsCount?: number;
  bookedCallsWithoutAppointments?: number;
  threshold: number;
}

export function AOIReportsBlocker({ children }: AOIReportsBlockerProps) {
  const [location, setLocation] = useLocation();
  const { authState } = useAuth();
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Public routes that don't require authentication or AOI Reports blocking
  const publicRoutes = [
    '/login',
    '/join',
    '/signup', // legacy URL; route redirects to /join
    '/forgot-password',
    '/reset-password',
    '/recruit-journey',
    '/recruit/waiting',
    '/landing',
    '/verification-workflow',
    '/agent-verification',
    '/client-verification',
    '/agent-verify',
    '/client-verify',
    '/complete',
    '/downloads',
    '/agent-info-test',
    '/agent-demo'
  ];

  // Skip AOI Reports blocker entirely for public routes - check FIRST before any auth logic
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));

  if (isPublicRoute) {
    return <>{children}</>;
  }

  useEffect(() => {
    // Use authenticated user's email first
    if (authState.user?.email) {
      setCurrentUserEmail(authState.user.email);
    } else {
      // Fallback to localStorage or API
      const storedEmail = localStorage.getItem('user_email');
      if (storedEmail) {
        setCurrentUserEmail(storedEmail);
      } else {
        // Last resort API call
        fetch('/api/user/credits')
          .then(response => response.json())
          .then(data => {
            if (data.email) {
              setCurrentUserEmail(data.email);
              localStorage.setItem('user_email', data.email);
            }
          })
          .catch(() => {
            console.error('Failed to get user email');
          });
      }
    }
  }, [authState.user?.email]);


  // Check if producer has pending AOI reports requiring resolution
  const { data: blockingStatus, isLoading } = useQuery<AOIBlockingStatus>({
    queryKey: [`/api/aoi-reports/check-blocking/${encodeURIComponent(currentUserEmail)}`],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/aoi-reports/check-blocking/${encodeURIComponent(currentUserEmail)}`, {
        headers: {
          'x-user-email': currentUserEmail
        },
        credentials: 'include'
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    },
    enabled: !!currentUserEmail,
    refetchInterval: 30000, // Check every 30 seconds (reduced from 1 hour for testing)
    staleTime: 0, // Always fetch fresh data
  });

  const allowedPaths = [
    '/dashboard/aoi-report',
    '/aoi-reports',
    '/aoi-achieve',
    '/ao-meet', // Allow access to AO Meet for scheduling appointments and recording results
    '/dashboard/ao-meet' // Actual route path
  ];

  const isOnAllowedPath = allowedPaths.some(path => location.includes(path));

  // DISABLED: All blocking checks - blocker is completely disabled
  // if (isLoading || !currentUserEmail) {
  //   console.log('⏳ AOIReportsBlocker: Loading or no email, showing children');
  //   return <>{children}</>;
  // }

  // DISABLED: Blocking for appointments, booked leads, and pending reports
  // const shouldBlock = blockingStatus?.mustResolveReports && !isOnAllowedPath;
  const shouldBlock = false; // Blocking completely disabled

  if (shouldBlock) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 p-4 flex items-center justify-center">
        <Card className="max-w-2xl w-full bg-gray-900/80 border-red-500/30 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-white mb-2">
              📋 Action Required
            </CardTitle>
            <p className="text-gray-300 text-lg">
              {blockingStatus?.bookedCallsWithoutAppointments && blockingStatus.bookedCallsWithoutAppointments > 0 ? (
                <>
                  You have <Badge variant="destructive" className="text-lg px-3 py-1">
                    {blockingStatus.bookedCallsWithoutAppointments}
                  </Badge> call(s) marked as "booked" without scheduled appointments.
                  <br />
                  <strong className="text-red-400 mt-2 block">Please schedule appointments for all booked calls to continue.</strong>
                </>
              ) : blockingStatus?.hasOverdueAppointments ? (
                <>
                  You have <Badge variant="destructive" className="text-lg px-3 py-1">
                    {blockingStatus?.overdueAppointmentsCount || 0}
                  </Badge> appointment(s) scheduled 24+ hours ago that require presentation results.
                  <br />
                  <strong className="text-red-400 mt-2 block">Please record the results of these presentations to continue.</strong>
                </>
              ) : (
                <>
                  You have <Badge variant="destructive" className="text-lg px-3 py-1">
                    {blockingStatus?.pendingCount || 0}
                  </Badge> pending AOI reports that need your attention
                </>
              )}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                What are AOI Reports?
              </h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• <strong className="text-blue-400">VDP calls &gt; 4 minutes</strong> - Meaningful conversations requiring follow-up</li>
                <li>• <strong className="text-purple-400">Call backs</strong> - Promised follow-up calls that must be tracked</li>
                <li>• <strong className="text-yellow-400">Booked appointments</strong> - Appointments requiring outcome reporting</li>
              </ul>
            </div>

            <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
              <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Why This Is Required?
              </h3>
              <p className="text-gray-300 text-sm">
                {blockingStatus?.bookedCallsWithoutAppointments && blockingStatus.bookedCallsWithoutAppointments > 0 ? (
                  <>When you mark a call as "booked", you must schedule an appointment with a date and time. This ensures proper follow-up and accountability.</>
                ) : blockingStatus?.hasOverdueAppointments ? (
                  <>Appointments scheduled 24+ hours ago require you to record the presentation results (sale, refused, medically uninsurable, etc.) to maintain accurate records.</>
                ) : (
                  <>Complete your pending reports to regain full system access and continue your work.</>
                )}
              </p>
            </div>

            <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/30">
              <h3 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Resolution Threshold
              </h3>
              <p className="text-gray-300 text-sm">
                Please complete all pending AOI reports to regain access to ConnectNow. 
                Each report represents valuable opportunities and maintaining up-to-date records ensures your success.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {blockingStatus?.bookedCallsWithoutAppointments && blockingStatus.bookedCallsWithoutAppointments > 0 ? (
                <Button 
                  onClick={() => setLocation('/dashboard/ao-meet')}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3"
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Schedule Appointments Now
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    setLocation('/dashboard/ao-meet?tab=aoi-reports');
                    window.scrollTo(0, 0);
                  }}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3"
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Record Presentation Results
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has acceptable number of pending reports, show normal dashboard
  return <>{children}</>;
}