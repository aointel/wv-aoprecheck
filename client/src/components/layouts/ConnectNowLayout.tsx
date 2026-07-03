
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { getRoutesForUser, getRoutesForQualityManager, getRoutesForSuperQualityManager, getAllRoutesForSysOp } from '@/components/routes';
import { useQualityManagerPermissions } from '@/hooks/use-quality-manager-permissions';
import { ConnectNowSidebar } from '@/components/sidebar/ConnectNowSidebar';
import { HeaderToolbar } from '@/components/gamification/HeaderToolbar';
import { GamificationOverlay } from '@/components/gamification/GamificationOverlay';
import { ZoomDisclaimerModal } from '@/components/modals/ZoomDisclaimerModal';
import { CallProvider } from '@/components/global/GlobalCallModal';
import { MissedCallNotificationCenter } from '@/components/notifications/MissedCallNotification';
import { CreditNotifications } from '@/components/credit-notifications';
import { StartupStatsCard } from '@/components/StartupStatsCard';
import { useTrainingProgress } from '@/hooks/use-training-progress';
import { useLocation } from 'wouter';
import { MdSpeed } from 'react-icons/md';

const TRAINING_ENFORCEMENT_ENABLED = false;

interface Props {
  children: React.ReactNode;
}

export function ConnectNowLayout({ children }: Props) {
  // Load sidebar state from localStorage, default to true
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-open');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebar-open', String(isSidebarOpen));
  }, [isSidebarOpen]);
  const [gamificationVisible, setGamificationVisible] = useState(false);
  const [location, setLocation] = useLocation();
  
  // Get real authenticated user
  const { authState } = useAuth();
  const user = authState.user;
  const isLoading = authState.loading;

  // Check if user is a Quality Manager
  const { isQualityManager, role, isLoading: qmLoading } = useQualityManagerPermissions();

  // Fetch real credits data
  const isSysOp =
    user?.email === 'cnsysop@aoglobelife.com' ||
    user?.email === 'chrislafond@aoglobelife.com' ||
    user?.email === 'tabithamcdermid@aoglobelife.com' ||
    user?.email === 'diankablash@aoglobelife.com' ||
    user?.email === 'nateschoot@aoglobelife.com' ||
    user?.email === 'mathewkawaji@aoglobelife.com'; // Always has access to Live Call Board

  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const url = `/api/user/credits?email=${encodeURIComponent(user.email)}`;
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'x-user-email': user.email },
        });
        if (response.ok) {
          const data = await response.json();
          return data;
        }
      } catch (error) {
        console.error('❌ Failed to fetch credits in layout:', error);
      }
      return null;
    },
    enabled: !!user?.email,
    refetchInterval: 300000, // 5 min
  });

  const baseRoutes = isSysOp
    ? getAllRoutesForSysOp()
    : role === 'ao_quality_manager'
    ? getRoutesForSuperQualityManager()
    : isQualityManager && role === 'quality_manager'
    ? getRoutesForQualityManager()
    : getRoutesForUser(true, user?.email || '');

  const routes = baseRoutes;

  const {
    completedSections,
    isLoading: trainingLoading,
    userEmail: trainingUserEmail,
  } = useTrainingProgress();

  const demoBypass = (trainingUserEmail ?? '').toLowerCase() === 'aointeldemo@aoglobelife.com';
  const trainingBypass = !TRAINING_ENFORCEMENT_ENABLED || demoBypass;

  const welcomeComplete = trainingBypass || completedSections.has('welcome');
  const supportComplete = trainingBypass || completedSections.has('support');

  const SECTION_LABELS: Record<string, string> = {
    welcome: 'Welcome',
    support: 'Support & Troubleshooting',
    ao_intelligence: 'AO Intelligence',
    call_connector: 'AO Intelligence',
    ao_meet: 'AO Meet',
    ao_recruit: 'AO Recruit',
    ao_precheck: 'AO Precheck',
    ao_precheck_admin: 'AO Precheck Management',
    billing_center: 'Billing Center',
    live_call_boardt: 'Live Call Board',
  };

  const enhancedRoutes = useMemo(() => {
    if (trainingBypass) {
      return routes.map((route) => ({
        ...route,
        locked: false,
        lockReason: undefined,
      }));
    }

    return routes.map((route) => {
      if (route.alwaysAccessible) {
        return { ...route, locked: false, lockReason: undefined };
      }

      if (!welcomeComplete) {
        return {
          ...route,
          locked: true,
          lockReason: 'Complete the Welcome training modules to unlock this feature.',
        };
      }

      if (!supportComplete) {
        return {
          ...route,
          locked: true,
          lockReason: 'Complete Support & Troubleshooting training to unlock this feature.',
        };
      }

      if (!route.requiredSections || route.requiredSections.length === 0) {
        return { ...route, locked: false, lockReason: undefined };
      }

      const missingSection = route.requiredSections.find(
        (section) => !completedSections.has(section)
      );

      if (!missingSection) {
        return { ...route, locked: false, lockReason: undefined };
      }

      const label = SECTION_LABELS[missingSection] ?? missingSection;
      return {
        ...route,
        locked: true,
        lockReason: `Complete the ${label} training to unlock this feature.`,
      };
    });
  }, [routes, welcomeComplete, supportComplete, completedSections, trainingBypass]);

  useEffect(() => {
    if (trainingBypass) {
      return;
    }

    if (trainingLoading) {
      return;
    }
    const isTrainingRoute = location.startsWith('/onboarding');

    if (!welcomeComplete || !supportComplete) {
      setLocation('/onboarding');
      return;
    }

    const lockedRoute = enhancedRoutes.find(
      (route) =>
        route.locked &&
        !route.alwaysAccessible &&
        (location === route.path || location.startsWith(`${route.path}/`))
    );

    if (lockedRoute && !isTrainingRoute) {
      setLocation('/onboarding');
    }
  }, [
    trainingLoading,
    welcomeComplete,
    supportComplete,
    location,
    enhancedRoutes,
    setLocation,
    trainingBypass,
  ]);

  const routeDebugSignature = useMemo(
    () => routes.map((r) => `${r.path}:${r.name}`).join('|'),
    [routes]
  );

  // Extract credits from the API response
  const creditsRemaining = creditsData 
    ? ((creditsData as any)?.credits_remaining ?? (creditsData as any)?.creditsRemaining ?? 0)
    : 0;

  // Normal layout
  return (
    <CallProvider>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <ConnectNowSidebar
          routes={enhancedRoutes}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          userEmail={user?.email || ''}
          creditsRemaining={creditsRemaining}
        />

        {/* Main Content Area - no marginLeft; sidebar is flex child, content sits flush next to it */}
        <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out min-w-0">
          {/* Header Toolbar for Gamification - STICKY */}
          <HeaderToolbar
            userId={user?.id || 'default-user'}
            onToggle={() => setGamificationVisible(true)}
          />

          {/* Main Content - Scrollable */}
          <div className="flex-1 overflow-auto px-0 pt-0 pb-6">
            <div key={location}>
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Gamification Overlay - Always available (even in compact mode) */}
      <GamificationOverlay
        isVisible={gamificationVisible}
        onClose={() => setGamificationVisible(false)}
        userId={user?.id || 'default-user'}
      />

      {/* Modals - Always available (even in compact mode) */}
      <ZoomDisclaimerModal 
        isOpen={false}
        onClose={() => {}}
        onAccept={() => {}}
      />
      
      {/* Notifications - Always available (even in compact mode) */}
      <MissedCallNotificationCenter />
      <CreditNotifications />

      {/* Startup Stats Card — SportsCenter-style weekly stats on first load */}
      {user?.email && <StartupStatsCard userEmail={user.email} />}
    </CallProvider>
  );
}
