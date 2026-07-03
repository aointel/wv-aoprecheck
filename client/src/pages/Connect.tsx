import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  MdCall, 
  MdHistory,
  MdPhone
} from 'react-icons/md';
import { FiClock } from 'react-icons/fi';
import { FaRocket } from 'react-icons/fa';
import { Maximize2, Minimize2, CheckCircle2, CalendarDays } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { GamificationOverlay } from '@/components/gamification/GamificationOverlay';
import { SubscriptionUpgradeModal } from '@/components/stripe/SubscriptionUpgradeModal';
import type { PlanOption } from '@/components/outbound-dialer/types';
import { FiStar } from 'react-icons/fi';

import VDPStatus from '@/components/connectnow/VDPStatus';
import VDPHeartbeat from '@/components/connectnow/VDPHeartbeat';

import { AccountPausedModal } from '@/components/account/AccountPausedModal';
import { AOQueueAnnouncementModal, getAOQueueAnnouncementDismissed } from '@/components/modals/AOQueueAnnouncementModal';
import { OutboundDialerInterface } from '@/components/outbound-dialer/OutboundDialerInterface';
import { CustomLoader } from '@/components/ui/custom-loader';
// WALKTHROUGH DISABLED - User never asked for this
// import { PageWalkthrough, WalkthroughStep } from '@/components/walkthrough/PageWalkthrough';

/** Same Professional card as StartupSequence / dialer upgrade modal */
const CC_PRO_SUBSCRIPTION_PLAN_OPTIONS: PlanOption[] = [
  {
    plan: 'professional',
    label: 'Professional',
    price: '$64.99',
    priceSuffix: '/month',
    tagline: 'Unlock unlimited outbound dialing with Call Connector Pro',
    cardClass: 'border-2 border-blue-500 shadow-xl scale-[1.02]',
    gradientClass: 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30',
    bodyClass: 'bg-white/80 backdrop-blur',
    buttonClass:
      'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white',
    icon: <FiStar className="h-5 w-5 text-blue-600" />,
    benefits: [
      'Unlimited outbound minutes',
      'Local presence by state',
      'Advanced call analytics & reporting',
      'Call Connector Pro power dialer',
    ],
    ctaLabel: 'Subscribe',
    topBanner: 'Recommended',
  },
];

function getTimeOfDay() {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 12) return 'Morning';
  else if (hour < 18) return 'Afternoon';
  else return 'Evening';
}



function Greeting({ username }: { username?: string }) {
  const timeOfDay = getTimeOfDay();
  
  return (
    <div className="px-6 pt-6 pb-3">
      <div className="text-sm font-bold text-muted-foreground mb-1">
        Good {timeOfDay}, {username || 'producer'}! 👍
      </div>
      <div className="text-xs text-muted-foreground">
        Ready to start taking calls?
      </div>
    </div>
  );
}

function CallHistoryTab() {
  const [dateRange, setDateRange] = useState('today');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  const { data: recentCalls } = useQuery({
    queryKey: ['/api/dashboard/recent-calls', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/recent-calls?range=${dateRange}`);
      return response.json();
    }
  });

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">Call History</h3>
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
      
      {recentCalls && Array.isArray(recentCalls) && recentCalls.length > 0 ? (
        <div className="space-y-3">
          {recentCalls.slice(0, 10).map((call: any) => (
            <div
              key={call.id}
              className={`border rounded-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${expandedCard === call.id ? 'shadow-xl scale-[1.01]' : 'shadow-sm'}`}
              onClick={() => toggleCard(call.id)}
            >
              {/* Main Card Content */}
              <div className={`p-4 transition-all duration-300 ${expandedCard === call.id ? 'bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50' : 'bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-blue-950/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {(call.notes || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                        {call.notes || 'Unknown Contact'}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="font-mono">{call.phoneNumber || 'No phone number'}</span>
                        {call.sessionId && call.sessionId !== 'N/A' && (
                          <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
                            ID: {call.sessionId}
                          </span>
                        )}
                        {call.market && call.market !== 'N/A' && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {call.market}
                          </span>
                        )}
                        {call.state && call.state !== 'N/A' && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {call.state}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={call.status === 'completed' ? 'default' : call.status === 'missed' ? 'destructive' : 'secondary'}
                      className="px-3 py-1"
                    >
                      {call.status || 'Unknown'}
                    </Badge>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Today'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.createdAt ? new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </p>
                    </div>
                    <div className={`transform transition-transform duration-200 ${expandedCard === call.id ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Expanded Details */}
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedCard === call.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className={`p-4 bg-white dark:bg-gray-800 border-t transform transition-all duration-300 ${expandedCard === call.id ? 'translate-y-0 scale-100' : 'translate-y-2 scale-95'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Contact & Lead Info */}
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                        <label className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2 block">Contact Information</label>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Name:</span>
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{call.notes || 'Unknown Contact'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Phone:</span>
                            <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{call.phoneNumber || 'No phone number'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Lead ID:</span>
                            <p className="text-sm font-mono bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded font-bold">
                              {call.sessionId || 'N/A'}
                            </p>
                          </div>
                          {call.clientEmail && (
                            <div>
                              <span className="text-xs text-muted-foreground">Email:</span>
                              <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-blue-600 dark:text-blue-400">
                                {call.clientEmail}
                              </p>
                            </div>
                          )}
                          {call.secretKey && (
                            <div>
                              <span className="text-xs text-muted-foreground">Secret Key:</span>
                              <p className="text-sm font-mono bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-1 rounded font-bold">
                                {call.secretKey}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Location & Market Info */}
                    <div className="space-y-4">
                      <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                        <label className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide mb-2 block">Market & Location</label>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Market:</span>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200">{call.market || 'General Market'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">State:</span>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200">{call.state || 'Unknown State'}</p>
                          </div>
                          {call.clientCity && (
                            <div>
                              <span className="text-xs text-muted-foreground">City:</span>
                              <p className="text-sm font-semibold text-green-800 dark:text-green-200">{call.clientCity}</p>
                            </div>
                          )}
                          {call.clientAddress && (
                            <div>
                              <span className="text-xs text-muted-foreground">Address:</span>
                              <p className="text-sm text-green-700 dark:text-green-300">{call.clientAddress}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Call Status & Timing */}
                    <div className="space-y-4">
                      <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
                        <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-2 block">Call Details</label>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Call Type:</span>
                            <p className="text-sm font-medium capitalize text-purple-700 dark:text-purple-300">{call.callType || 'Inbound'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Status:</span>
                            <div className="mt-1">
                              <Badge 
                                variant={call.status === 'completed' ? 'default' : call.status === 'missed' ? 'destructive' : 'secondary'}
                                className="text-xs font-bold"
                              >
                                {call.status || 'Unknown'}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Duration:</span>
                            <p className="text-sm font-bold text-purple-800 dark:text-purple-200">
                              {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '0:00'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">When:</span>
                            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                              {call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Today'} at {call.createdAt ? new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Raw Webhook Data Section (for debugging/admin) */}
                  {call.rawWebhookData && Object.keys(call.rawWebhookData).length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Raw Lead Data</h4>
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                            View All Lead Details ({Object.keys(call.rawWebhookData).length} fields)
                          </summary>
                          <div className="mt-3 space-y-2 text-xs">
                            {Object.entries(call.rawWebhookData).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between items-start border-b border-gray-200 dark:border-gray-700 pb-1">
                                <span className="font-medium text-gray-600 dark:text-gray-400 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>
                                <span className="font-mono text-gray-800 dark:text-gray-200 text-right max-w-xs truncate">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 mt-6 pt-4 border-t">
                    <button className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                      📞 Call Back
                    </button>
                    <button className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      📝 Add Notes
                    </button>
                    <button className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                      ✅ Mark Complete
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
}

export default function ConnectPage() {
  // Tab logic removed: OutboundDialerInterface has Dialer / AOI Report / Call History tabs built-in
  const queryClient = useQueryClient();
  const [showGamification, setShowGamification] = useState(false);
  const [showAOQueueAnnouncement, setShowAOQueueAnnouncement] = useState(false);
  const [ccProSubscribeModalOpen, setCcProSubscribeModalOpen] = useState(false);

  // WALKTHROUGH DISABLED - User never asked for this feature
  // Removed connectWalkthroughSteps


  // Get user email from auth context first so we can pass it to API calls
  const { authState } = useAuth();
  const userEmail = authState.user?.email || "default@example.com";

  const { data: userStats } = useQuery({
    queryKey: ['/api/dashboard/user-stats'],
  });

  const { data: credits } = useQuery({
    queryKey: ['/api/user/credits', userEmail],
    queryFn: async () => {
      if (!userEmail || userEmail === 'default@example.com') return null;
      const url = `/api/user/credits?email=${encodeURIComponent(userEmail)}`;
      const res = await fetch(url, { credentials: 'include', headers: { 'x-user-email': userEmail } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userEmail && userEmail !== 'default@example.com',
  });

  // Call Connector Pro access - show "Subscribe to Call Connector Pro now" in header when user doesn't have it
  const { data: ccpAccessData, isLoading: isCcpAccessLoading } = useQuery({
    queryKey: ['/api/call-connector-pro/access-check', userEmail],
    queryFn: async () => {
      if (!userEmail) return { hasAccess: false };
      const response = await fetch(`/api/call-connector-pro/access-check/${encodeURIComponent(userEmail)}`);
      if (!response.ok) return { hasAccess: false };
      const data = await response.json();
      return data;
    },
    enabled: !!userEmail,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const hasCallConnectorPro = ccpAccessData?.hasAccess === true && !isCcpAccessLoading;

  // Show AO Queue announcement once per user (localStorage) when they land on Connect
  useEffect(() => {
    if (!authState.user?.email) return;
    if (!getAOQueueAnnouncementDismissed()) setShowAOQueueAnnouncement(true);
  }, [authState.user?.email]);

  // Any authenticated user has access
  const isAdmin = authState.user?.email?.includes('@aoglobelife.com') || false;



  const handlePurchaseCredits = () => {
    // Redirect to in-app subscription page for purchasing credits
    window.location.href = '/dashboard/billing-dashboard';
  };

  // Check if account is paused (-10 credits or less) - only check when credits data is loaded  
  const creditsRemaining = (credits as any)?.credits_remaining;
  const isAccountPaused = credits && creditsRemaining !== undefined && Number(creditsRemaining) <= -10;

  // Log once on mount only (avoid spamming console on every re-render and avoid giving impression of remounts)
  useEffect(() => {
    console.log('🔌 ConnectNow (Connect) page loaded');
    console.log('🔍 Admin Check:', { userEmail, isAdmin });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header: interface alert + Subscribe to Call Connector Pro for non-subscribers */}
      <div className="px-6 pt-6 pb-0 space-y-3">
        
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent('aoirail-open-calendar'))}
            className="flex items-center gap-1.5"
          >
            <CalendarDays className="h-4 w-4" />
            My Calendar
          </Button>
        </div>
        {!isCcpAccessLoading && !hasCallConnectorPro && (
          <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Subscribe to Call Connector Pro now
            </span>
            <Button
              size="sm"
              variant="default"
              className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              onClick={() => setCcProSubscribeModalOpen(true)}
            >
              Subscribe
            </Button>
          </div>
        )}
      </div>

      {/* Full Mode Layout - 3 Column Grid */}
      {/* Main 3-Column Layout matching original ConnectNow */}
      <div className="pl-0 pr-6 pt-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-240px)]">
          {/* Single combined panel: VDP (left) + Call Connector Pro (right) */}
          <div className="lg:col-span-12">
            <Card className="h-full overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-x-0 lg:divide-x divide-gray-200 dark:divide-gray-800 min-h-[calc(100vh-280px)]">
                  {/* Left: Call Connector Pro (dialer, AOI Report, Call History tabs, controls) - no left padding to eliminate gap with navbar */}
                  <div className="lg:col-span-12 pl-0 pr-4 pt-4 pb-4 lg:pr-6 lg:pt-6 lg:pb-6 overflow-y-auto">
                    <OutboundDialerInterface />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* VDP Heartbeat Component for maintaining connection */}
      {userEmail && (
        <VDPHeartbeat 
          userEmail={userEmail} 
          isActive={true} 
        />
      )}

      {/* Gamification Overlay */}
      {showGamification && (
        <GamificationOverlay 
          isVisible={showGamification}
          onClose={() => setShowGamification(false)}
          userId={authState.user?.id || "demo-user"} 
        />
      )}

      {/* Account Paused Modal - Highest Priority - Only show when credits are actually -10 or less */}
      {isAccountPaused && creditsRemaining !== undefined && Number(creditsRemaining) <= -10 && (
        <AccountPausedModal
          isOpen={true}
          creditsRemaining={creditsRemaining || 0}
          onPurchaseCredits={handlePurchaseCredits}
        />
      )}

      {/* AO Queue announcement - once per user via localStorage */}
      <AOQueueAnnouncementModal
        isOpen={showAOQueueAnnouncement}
        onClose={() => setShowAOQueueAnnouncement(false)}
      />

      <SubscriptionUpgradeModal
        isOpen={ccProSubscribeModalOpen}
        onClose={() => setCcProSubscribeModalOpen(false)}
        planOptions={CC_PRO_SUBSCRIPTION_PLAN_OPTIONS}
        initialPlan="professional"
        userEmail={userEmail}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription/status'] });
          queryClient.invalidateQueries({ queryKey: ['/api/call-connector-pro/access-check', userEmail] });
          setCcProSubscribeModalOpen(false);
        }}
      />
    </div>
  );
}