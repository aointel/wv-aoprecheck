import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { ConnectNowSidebar } from '@/components/sidebar/ConnectNowSidebar';
import { HeaderToolbar } from '@/components/gamification/HeaderToolbar';
import { GamificationOverlay } from '@/components/gamification/GamificationOverlay';
import { ZoomDisclaimerModal } from '@/components/modals/ZoomDisclaimerModal';

import { LowCreditsReminderModal } from '@/components/modals/LowCreditsReminderModal';
import { getRoutesForUser } from '@/components/routes.tsx';

interface Props {
  children: React.ReactNode;
}

export function ConnectNowLayout({ children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [gamificationVisible, setGamificationVisible] = useState(false);
  
  // Get real authenticated user
  const { authState } = useAuth();
  const user = authState.user;
  const isLoading = authState.loading;

  // Fetch real credits data
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits'],
    enabled: !!user?.email,
  });

  // Get routes based on user role and email
  const routes = getRoutesForUser(
    user?.isAdmin || false,
    user?.email
  );

  const sidebarWidth = isSidebarOpen ? 290 : 80;
  const creditsRemaining = (creditsData as any)?.creditsRemaining || (creditsData as any)?.credits_remaining || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // ProtectedRoute will handle this
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <ConnectNowSidebar
        routes={routes}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        userEmail={user?.email || ''}
        creditsRemaining={creditsRemaining}
      />

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col transition-all duration-300 ease-in-out"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        {/* Header Toolbar for Gamification */}
        <HeaderToolbar
          userId={user?.id || 'default-user'}
          onToggle={() => setGamificationVisible(true)}
        />

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>

      {/* Gamification Overlay */}
      <GamificationOverlay
        isVisible={gamificationVisible}
        onClose={() => setGamificationVisible(false)}
        userId={user?.id || 'default-user'}
      />

      {/* Modals */}
      <ZoomDisclaimerModal />
      <LowCreditsReminderModal />
    </div>
  );
}