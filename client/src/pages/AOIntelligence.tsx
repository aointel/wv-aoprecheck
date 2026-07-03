import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { 
  MdCall, 
  MdHistory,
  MdPhone
} from 'react-icons/md';
import { FiClock } from 'react-icons/fi';
import { FaRocket } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { GamificationOverlay } from '@/components/gamification/GamificationOverlay';
import { SilentConnectivityTester } from '@/components/SilentConnectivityTester';
import { AdminDiagnosticPanel } from '@/components/AdminDiagnosticPanel';
import { ClipboardList, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// WALKTHROUGH DISABLED - User never asked for this
// import { PageWalkthrough, WalkthroughStep } from '@/components/walkthrough/PageWalkthrough';

import VDPStatus from '@/components/connectnow/VDPStatus';
import VDPHeartbeat from '@/components/connectnow/VDPHeartbeat';

import { AccountPausedModal } from '@/components/account/AccountPausedModal';
import { CustomLoader } from '@/components/ui/custom-loader';
import { PricingHoverCard } from '@/components/pricing/PricingHoverCard';

function getTimeOfDay() {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 12) return 'Morning';
  else if (hour < 18) return 'Afternoon';
  else return 'Evening';
}

function AccountabilitySection({ userEmail }: { userEmail?: string }) {
  // Use the new AOI Reports blocking API endpoint for accurate data
  const { data: aoiReportsStatus } = useQuery({
    queryKey: ['/api/aoi-reports/check-blocking', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const response = await fetch(`/api/aoi-reports/check-blocking/${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 3600000 // Refresh every hour
  });

  // Keep the old accountability status for backward compatibility
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

  // Use AOI Reports data as primary source
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
        {/* Status Summary */}
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
              <span className="text-sm font-medium">
                Pending AOI Reports
              </span>
            </div>
            <Badge variant={pendingCount > threshold ? "destructive" : pendingCount > 0 ? "destructive" : "secondary"}>
              {pendingCount}
            </Badge>
          </div>

          {/* Threshold Status */}
          {pendingCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/30 rounded-lg border">
              <div className="flex items-center gap-2">
                {isBlocked ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm font-medium">
                  Access Status
                </span>
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

        {/* Warning Message */}
        {isBlocked && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                <strong>Access Temporarily Restricted:</strong> You have {pendingCount} pending AOI reports. 
                Please complete all reports to regain full system access. Each report represents 
                valuable opportunities - stay current for continued success.
              </div>
            </div>
          </div>
        )}

        {/* Informational Message for Non-Blocked Users */}
        {!isBlocked && pendingCount > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
              <div className="text-xs text-orange-700 dark:text-orange-300">
                Stay current! You have {pendingCount} pending reports. 
                Keep reports up-to-date to maintain full system access and track your success effectively.
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
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
}

function Greeting({ username }: { username?: string }) {
  const timeOfDay = getTimeOfDay();
  
  return (
    <div className="text-lg font-semibold text-muted-foreground">
      Good {timeOfDay}, {username || 'producer'}!
    </div>
  );
}

function CallHistoryTab() {
  const [dateRange, setDateRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { authState } = useAuth();
  const userEmail = authState?.user?.email;
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

  // Handle loading call as current lead (same logic as lead queue)
  const handleLoadAsCurrentLead = async (call: any) => {
    console.log('🔄 Loading call history as current lead:', call);
    
    try {
      // Create lead object for masterlead insertion (same format as callback leads)
      const leadData = {
        email: userEmail || '',
        leadId: call.leadId || call.id?.replace('vdp_', '') || Date.now().toString(),
        name: call.name || 'Call History Lead',
        phone: call.phone,
        market: call.market || 'Unknown Market',
        city: '',
        state: '',
        address: '',
        cnresolution: call.call_status || call.resolution || 'pending',
        isHotLead: true,
        source: 'call_history_' + (call.source || 'vdp_calls')
      };
      
      console.log('🔄 Loading call history lead into masterlead:', leadData);
      
      // Add lead to masterlead table for Call Connector Pro
      const response = await fetch('/api/callback-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to load call history lead');
      }
      
      const result = await response.json();
      console.log('✅ Call history lead loaded successfully:', result);
      
      // Show success message
      toast({
        title: "Lead Loaded!",
        description: `"${leadData.name}" loaded as current lead in Call Connector Pro`,
      });
      
      // Navigate to the outbound dialer to show the loaded lead
      // This simulates the behavior of lead queue cards
      window.location.href = '/dashboard/outbound-dialer?tab=queue';
      
    } catch (error) {
      console.error('❌ Failed to load call history lead:', error);
      toast({
        title: "Error",
        description: "Failed to load call as current lead. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter calls based on search term
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
          {filteredCalls.slice(0, 10).map((call: any) => (
            <div
              key={call.id}
              className={`border rounded-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${expandedCard === call.id ? 'shadow-xl scale-[1.01]' : 'shadow-sm'}`}
              onClick={() => handleLoadAsCurrentLead(call)}
              data-testid={`call-history-card-${call.id}`}
            >
              {/* Main Card Content */}
              <div className={`p-4 transition-all duration-300 ${expandedCard === call.id ? 'bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50' : 'bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-blue-950/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {(call.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                        {call.name || 'Unknown Lead'}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="font-mono">{call.phone || 'No phone number'}</span>
                        {call.leadId && (
                          <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
                            ID: {call.leadId}
                          </span>
                        )}
                        {call.market && call.market !== 'Unknown Market' && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {call.market}
                          </span>
                        )}
                        {call.mga && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            MGA: {call.mga}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {call.started_at ? new Date(call.started_at).toLocaleString() : 'No timestamp'}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={call.call_status === 'Sale' ? 'default' : call.call_status === 'Appointment' ? 'secondary' : 'outline'}>
                        {call.call_status || call.resolution || 'No Status'}
                      </Badge>
                      {call.duration_seconds && (
                        <Badge variant="outline" className="text-xs">
                          {call.duration_seconds}s
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable Details */}
              {expandedCard === call.id && (
                <div className="border-t bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/30 dark:to-purple-900/30">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Contact Information */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Contact Info</h5>
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium">Phone:</span> {call.phoneNumber || 'N/A'}</div>
                        <div><span className="font-medium">Email:</span> {call.email || 'N/A'}</div>
                        <div><span className="font-medium">Notes:</span> {call.notes || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Location Information */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Location</h5>
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium">State:</span> {call.state || 'N/A'}</div>
                        <div><span className="font-medium">Market:</span> {call.market || 'N/A'}</div>
                        <div><span className="font-medium">Status:</span> {call.status || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Call Details */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Call Details</h5>
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium">Duration:</span> {call.duration ? `${call.duration}s` : 'N/A'}</div>
                        <div><span className="font-medium">Timestamp:</span> {call.timestamp ? new Date(call.timestamp).toLocaleString() : 'N/A'}</div>
                        <div><span className="font-medium">Session ID:</span> {call.sessionId || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Webhook Data - Only for debugging */}
                  {call.rawWebhookData && (
                    <div className="p-4 border-t bg-gradient-to-r from-gray-100 via-blue-100 to-purple-100 dark:from-gray-800 dark:via-blue-800/30 dark:to-purple-800/30">
                      <h5 className="font-medium text-sm mb-2 text-gray-600 dark:text-gray-400">Raw Webhook Data (Debug)</h5>
                      <pre className="text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(call.rawWebhookData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="p-4 border-t bg-gradient-to-r from-white via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="text-xs">
                        <MdCall className="mr-1 h-3 w-3" />
                        Call Back
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        <MdHistory className="mr-1 h-3 w-3" />
                        Add Notes
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        <FaRocket className="mr-1 h-3 w-3" />
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <MdHistory className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            {searchTerm ? 'No matching calls found' : 'No Call History'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm 
              ? 'Try adjusting your search terms.'
              : 'Your recent calls will appear here once you start making calls.'}
          </p>
        </div>
      )}
    </div>
  );
}


export default function AOIntelligencePage() {
  const [showGamification, setShowGamification] = useState(false);

  const { data: userStats } = useQuery({
    queryKey: ['/api/dashboard/user-stats'],
  });

  const { data: credits } = useQuery({
    queryKey: ['/api/user/credits'],
  });

  // Get user email from auth context
  const { authState } = useAuth();
  const userEmail = authState.user?.email || "default@example.com";
  
  // Only specific emails have admin access
  const isAdmin = authState.user?.email === "martintoma@aoglobelife.com" || 
                  authState.user?.email === "cnsysop@aoglobelife.com";

  const handlePurchaseCredits = () => {
    // Redirect to in-app subscription page for purchasing credits
    window.location.href = '/dashboard/billing-dashboard';
  };

  // Check if account is paused (-10 credits or less) - only check when credits data is loaded  
  const creditsRemaining = credits && (credits as any).credits_remaining ? Number((credits as any).credits_remaining) : 0;
  const isAccountPaused = credits && creditsRemaining <= -10;
  
  // Add console log for navigation verification
  console.log('🔌 AO Intelligence page loaded');
  console.log('🔍 Admin Check:', { userEmail, isAdmin });
  
  // Debug logging for credit check
  console.log('🔍 AO Intelligence Credit Check:', {
    credits: !!credits,
    creditsRemaining,
    creditsRemainingNumber: Number(creditsRemaining),
    isAccountPaused,
    condition1: !!credits,
    condition2: creditsRemaining !== undefined,
    condition3: Number(creditsRemaining) <= -10
  });

  // WALKTHROUGH DISABLED - User never asked for this feature
  // Removed walkthroughSteps and PageWalkthrough component

  return (
    <div className="min-h-screen bg-background">
      {/* Full Mode Layout - 3 Column Grid */}
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <PricingHoverCard type="connects" showHowItWorks={true}>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-help">
                AO Intelligence
              </h1>
            </PricingHoverCard>
          </div>
        </div>
      </div>
      <div className="px-6 pt-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-240px)]">
          
          {/* Left Column - Accountability Section */}
          <div className="lg:col-span-3 space-y-4">
            <AccountabilitySection userEmail={userEmail} />
          </div>
          
          {/* Center Column - Call History */}
          <div className="lg:col-span-6">
            <div className="bg-card rounded-lg border p-6">
              <CallHistoryTab />
            </div>
          </div>

          {/* Right Column - VDP and Connection Health (3/12 columns to match Connect page) */}
          <div className="lg:col-span-3 space-y-4">
            <VDPStatus 
              userEmail={userEmail} 
              title="AO Intelligence"
              cardClassName="border-2 border-blue-200 dark:border-blue-800"
              titleClassName="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            />
            
            {/* Quiet Connectivity Status */}
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">System Status</h3>
                <SilentConnectivityTester 
                  email={userEmail}
                  onIssueDetected={(issueType) => {
                    // Only log for admin debugging - don't alert users
                    console.log(`Connectivity issue detected for ${userEmail}:`, issueType);
                  }}
                />
              </div>
            </div>
            
            {/* Admin-only diagnostic panel */}
            {isAdmin && (
              <AdminDiagnosticPanel 
                email={userEmail} 
                isVisible={true} 
              />
            )}
          </div>

        </div>
      </div>

      {/* VDP Heartbeat Component for maintaining connection */}
      {userEmail ? (
        <div className="hidden">
          <VDPHeartbeat userEmail={userEmail} isActive={true} />
        </div>
      ) : null}

      {/* Account Paused Modal - Only show when credits are -10 or less */}
      {isAccountPaused && (
        <AccountPausedModal
          isOpen={true}
          creditsRemaining={creditsRemaining}
          onPurchaseCredits={handlePurchaseCredits}
        />
      )}

      {/* Gamification Overlay */}
      {showGamification && (
        <GamificationOverlay
          isVisible={showGamification}
          onClose={() => setShowGamification(false)}
          userId={authState.user?.id || 'default-user'}
        />
      )}
    </div>
  );
}