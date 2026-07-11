import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { IRoute } from '@/components/routes';
import { FileText, Shield, User, Coins, Settings, Headphones, HelpCircle, ChevronLeft, ChevronRight, LogOut, CalendarDays } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AoAppsSwitcher } from '@/components/AoAppsSwitcher';
import { PlayCircle } from 'lucide-react';
import { CreditPurchaseModal } from '@/components/stripe/CreditPurchaseModal';
import { ProducerSetupModal } from '@/components/modals/AgentSetupModal';
import { AudioSetupModal } from '@/components/audio/AudioSetupModal';
import { PrivacyPolicyModal } from '@/components/modals/PrivacyPolicyModal';
import { TermsOfServiceModal } from '@/components/modals/TermsOfServiceModal';
import { AccessibilityPolicyModal } from '@/components/modals/AccessibilityPolicyModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface SidebarProps {
  routes: IRoute[];
  isOpen: boolean;
  onToggle: () => void;
  userEmail?: string;
  creditsRemaining: number;
}

export function ConnectNowSidebar({ routes, isOpen, onToggle, userEmail, creditsRemaining }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isCreditPurchaseOpen, setIsCreditPurchaseOpen] = useState(false);
  const [isProducerSetupOpen, setIsProducerSetupOpen] = useState(false);
  const [isAudioSetupOpen, setIsAudioSetupOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isTermsOfServiceOpen, setIsTermsOfServiceOpen] = useState(false);
  const [isAccessibilityPolicyOpen, setIsAccessibilityPolicyOpen] = useState(false);
  const { authState, logout } = useAuth();
  const user = authState?.user;
  const queryClient = useQueryClient();

  // Fetch producer profile for profile picture
  const { data: producerProfile } = useQuery({
    queryKey: ['/api/agent/profile-direct', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
    },
    enabled: !!user?.email
  });


  // Use the creditsRemaining prop directly from the layout
  // The layout already fetches from /api/user/credits which is the correct source
  const actualCredits = typeof creditsRemaining === 'number' ? creditsRemaining : 0;

  const handleCreditsAdded = () => {
    // Invalidate both the layout's query and any other credit queries
    queryClient.invalidateQueries({ queryKey: ['/api/user/credits'] });
    queryClient.invalidateQueries({ queryKey: ['/api/connectnow/user-credits', user?.email] });
    setIsCreditPurchaseOpen(false);
  };

  const navigateWithFallback = (targetPath: string) => {
    if (!targetPath || targetPath === location) return;
    setLocation(targetPath);
  };

  const openGuidedHelp = () => {
    window.dispatchEvent(
      new CustomEvent('aoirail-open-guided-help', {
        detail: {
          anchorLeft: isOpen ? 252 : 92,
        },
      }),
    );
  };

  const openCalendar = () => {
    window.dispatchEvent(new CustomEvent('aoirail-open-calendar'));
  };

  return (
    <div
      className={cn(
        "bg-background border border-gray-200 rounded-xl transition-all duration-300 overflow-hidden flex flex-col relative group",
        isOpen ? "w-[240px]" : "w-20"
      )}
      style={{
        height: 'calc(100vh - 2rem)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Right Edge Highlight - Entire right side highlights on hover */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-transparent hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all duration-200 cursor-pointer z-40 rounded-r-xl" 
           onClick={onToggle}
           title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      />
      {/* Header with Profile Picture */}
      <div className="p-4 border-b min-h-[70px]">
        {isOpen ? (
          <div className="flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                  <Avatar className="h-12 w-12 ring-2 ring-gray-300 dark:ring-gray-600 ring-offset-2 ring-offset-background">
                    <AvatarImage src={producerProfile?.profilePicture} alt={user?.email} />
                    <AvatarFallback className="bg-gray-200 dark:bg-gray-700">
                      <User className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {producerProfile?.firstName && producerProfile?.lastName
                        ? `${producerProfile.firstName} ${producerProfile.lastName}`
                        : (user?.email ? user.email.split('@')[0] : 'User')}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="opacity-100 cursor-default">
                  <User className="mr-2 h-4 w-4" />
                  <span className="font-medium">
                    {producerProfile?.firstName && producerProfile?.lastName
                      ? `${producerProfile.firstName} ${producerProfile.lastName}`
                      : (user?.email ? user.email.split('@')[0] : 'User')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsProducerSetupOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Setup</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent truncate">
                AO Intelligence
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || userEmail || 'User'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer hover:opacity-80 transition-opacity">
                  <Avatar className="h-10 w-10 ring-2 ring-gray-300 dark:ring-gray-600 ring-offset-2 ring-offset-background">
                    <AvatarImage src={producerProfile?.profilePicture} alt={user?.email} />
                    <AvatarFallback className="bg-gray-200 dark:bg-gray-700">
                      <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {producerProfile?.firstName && producerProfile?.lastName
                        ? `${producerProfile.firstName} ${producerProfile.lastName}`
                        : (user?.email ? user.email.split('@')[0] : 'User')}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="opacity-100 cursor-default">
                  <User className="mr-2 h-4 w-4" />
                  <span className="font-medium">
                    {producerProfile?.firstName && producerProfile?.lastName
                      ? `${producerProfile.firstName} ${producerProfile.lastName}`
                      : (user?.email ? user.email.split('@')[0] : 'User')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsProducerSetupOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Setup</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Triangle Panel Toggle - Inside Right Edge, Vertically Centered, Subtle */}
      <button
        onClick={onToggle}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-2 z-50 pointer-events-none",
          "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
          "bg-transparent",
          "border-0"
        )}
        title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {/* Triangle shape - Subtle */}
        <div className={cn(
          "w-0 h-0 transition-all duration-200",
          isOpen 
            ? "border-t-[4px] border-b-[4px] border-r-[6px] border-t-transparent border-b-transparent border-r-gray-400 dark:border-r-gray-500 group-hover:border-r-blue-500 dark:group-hover:border-r-blue-400"
            : "border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-gray-400 dark:border-l-gray-500 group-hover:border-l-blue-500 dark:group-hover:border-l-blue-400"
        )} />
      </button>

      {/* AO Apps switcher — identical across all four AO apps */}
      <AoAppsSwitcher collapsed={!isOpen} />

      {/* Navigation */}
      <div className="p-4 space-y-2">
        {routes.map((route, index) => {
          // Check if this route has sub-items
          const hasSubItems = route.subItems && route.subItems.length > 0;
          const isExpanded = expandedSections[route.name];

          // Check if any sub-item is active
          const isSubItemActive = hasSubItems && route.subItems?.some(subItem =>
            location === subItem.path || location === subItem.path + '/'
          );

          // Fix active state detection - handle root dashboard specially and sub-items
          const isActive = route.path === '/dashboard'
            ? (location === '/dashboard' || location === '/dashboard/')
            : (location === route.path || location === route.path + '/') || isSubItemActive;

          return (
            <div key={index}>
              {/* Main Navigation Item */}
              {hasSubItems ? (
                <div
                  onClick={() => {
                    if (hasSubItems) {
                      setExpandedSections(prev => ({
                        ...prev,
                        [route.name]: !prev[route.name]
                      }));
                    }
                  }}
                  className={cn(
                    "flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer relative",
                    isActive
                      ? "bg-blue-50 border-l-4 border-l-blue-600"
                      : "hover:bg-gray-50",
                    isOpen ? "justify-start" : "justify-center"
                  )}
                >
                  <div className="min-w-[20px] flex items-center justify-center">
                    <route.icon
                      className={cn(
                        "w-5 h-5",
                        isActive ? "text-blue-600" : "text-gray-500"
                      )}
                    />
                  </div>

                  {isOpen && (
                    <React.Fragment>
                      <span className={cn(
                        "ml-3 text-sm font-semibold truncate flex-1 tracking-wide",
                        isActive
                          ? "text-blue-700"
                          : "text-gray-700"
                      )}>
                        {route.name}
                      </span>
                      {hasSubItems && (
                        <div className="ml-2">
                          {isExpanded ?
                            <FaChevronUp className="w-3 h-3" /> :
                            <FaChevronDown className="w-3 h-3" />
                          }
                        </div>
                      )}
                    </React.Fragment>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => navigateWithFallback(route.path)}
                >
                  <div
                    className={cn(
                      "flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer relative",
                      isActive
                        ? "bg-blue-50 border-l-4 border-l-blue-600"
                        : "hover:bg-gray-50",
                      isOpen ? "justify-start" : "justify-center"
                    )}
                  >
                    <div className="min-w-[20px] flex items-center justify-center">
                    <route.icon
                      className={cn(
                        "w-5 h-5",
                        isActive ? "text-blue-600" : "text-gray-500"
                      )}
                    />
                    </div>

                    {isOpen && (
                      <span className={cn(
                        "ml-3 text-sm font-semibold truncate tracking-wide",
                        isActive
                          ? "text-blue-700"
                          : "text-gray-700"
                      )}>
                        {route.name}
                      </span>
                    )}
                  </div>
                </button>
              )}

              {/* Sub-items */}
              {hasSubItems && isExpanded && isOpen && (
                <div className="ml-6 mt-2 space-y-2 pl-4">
                  {route.subItems?.map((subItem, subIndex) => {
                    const isSubActive = location === subItem.path || location === subItem.path + '/';

                    return (
                      <button
                        key={subIndex}
                        type="button"
                        className="block w-full text-left"
                        onClick={() => navigateWithFallback(subItem.path)}
                      >
                        <div
                    className={cn(
                      "flex items-center p-2 rounded-lg transition-all duration-200 cursor-pointer text-sm relative",
                      isSubActive
                        ? "bg-blue-50 border-l-4 border-l-blue-600"
                        : "hover:bg-gray-50"
                    )}
                        >
                          <div className="min-w-[16px] flex items-center justify-center">
                            <subItem.icon className={cn("w-4 h-4", isSubActive ? "text-blue-600" : "text-gray-500")} />
                          </div>
                          <span className={cn(
                            "ml-2 text-xs font-semibold truncate tracking-wide",
                            isSubActive
                              ? "text-blue-700"
                              : "text-gray-700"
                          )}>
                            {subItem.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={openCalendar}
          className={cn(
            "flex w-full items-center p-3 rounded-lg transition-all duration-200 cursor-pointer relative bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 hover:from-blue-100 hover:via-indigo-100 hover:to-cyan-100 border border-blue-100",
            isOpen ? "justify-start" : "justify-center"
          )}
          title="My Calendar"
        >
          <div className="min-w-[20px] flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          {isOpen && (
            <span className="ml-3 text-sm font-semibold truncate tracking-wide bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-600 bg-clip-text text-transparent">
              My Calendar
            </span>
          )}
        </button>
      </div>

      {/* Getting Started video entry REMOVED for now (videos unfinished) —
          restore the openGettingStarted() button when they're ready. */}

      {/* Settings, Audio Setup, Credits, Buy Button, and Get Support - Right Below Last Navbar Item */}
      <div className="px-4 pb-4 border-t space-y-3 mt-2">
        {/* Settings and Headset Icons */}
        <div className="flex flex-col items-center space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsProducerSetupOpen(true)}
            className="p-2 rounded-full hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAudioSetupOpen(true)}
            className="p-2 rounded-full hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            title="Audio Setup"
          >
            <Headphones className="w-5 h-5" />
          </Button>
        </div>

        {/* Theme Toggle */}
        <div className={cn("flex", isOpen ? "justify-end" : "justify-center")}>
          <ThemeToggle />
        </div>

        {/* Credits Display and Buy Button */}
        {isOpen ? (
          <div className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
            <div className="flex items-center space-x-2">
              <Coins className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                {actualCredits.toLocaleString()} credits
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreditPurchaseOpen(true)}
              className="h-7 px-2 text-xs"
            >
              Buy
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center p-2">
            <div className="flex flex-col items-center">
              <Coins className="h-4 w-4 text-gray-600 mb-1" />
              <span className="text-xs font-medium bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                {actualCredits > 999 ? `${(actualCredits / 1000).toFixed(1)}k` : actualCredits}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Spacer to push support badge and policy links to the bottom */}
      <div className="flex-1 flex flex-col items-end justify-end px-4 pb-4 gap-2">
        {/* My Calendar button */}
        {isOpen ? (
          <button
            type="button"
            onClick={openCalendar}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 p-[2px] text-left shadow-md transition hover:scale-[1.02]"
            title="My Calendar"
          >
            <span className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight">My Calendar</span>
                <span className="mt-0.5 block text-xs font-semibold text-blue-100">Appointments</span>
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openCalendar}
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 text-white shadow-md transition hover:scale-105"
            title="My Calendar"
          >
            <CalendarDays className="h-5 w-5" />
          </button>
        )}

        {/* Get Support button */}
        {isOpen ? (
          <button
            type="button"
            onClick={openGuidedHelp}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-600 p-[2px] text-left shadow-[0_14px_32px_rgba(79,70,229,0.35)] transition hover:scale-[1.02] hover:shadow-[0_18px_42px_rgba(79,70,229,0.45)]"
            title="Get Support"
          >
            <span className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-4 text-white">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
                <HelpCircle className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-black leading-tight">Get Support</span>
                <span className="mt-0.5 block text-xs font-semibold text-blue-100">Open guided help</span>
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openGuidedHelp}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_12px_28px_rgba(79,70,229,0.4)] transition hover:scale-105"
            title="Get Support"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <HelpCircle className="h-6 w-6" />
            </span>
          </button>
        )}
      </div>
      
      {/* Policy Links - Very bottom, small grey text, stacked vertically */}
      {isOpen && (
        <div className="px-4 pb-2 border-t pt-2">
          <div className="flex flex-col gap-y-1">
            <button
              onClick={() => setIsPrivacyPolicyOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors text-left"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setIsTermsOfServiceOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors text-left"
            >
              Terms of Service
            </button>
            <button
              onClick={() => setIsAccessibilityPolicyOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors text-left"
            >
              Accessibility Policy
            </button>
          </div>
        </div>
      )}
      
      {/* Modals - rendered inside sidebar for proper z-index */}
      <ProducerSetupModal
        isOpen={isProducerSetupOpen}
        onClose={() => {
          setIsProducerSetupOpen(false);
          queryClient.invalidateQueries({ queryKey: ['/api/agent/profile-direct', user?.email] });
        }}
      />
      <AudioSetupModal
        isOpen={isAudioSetupOpen}
        onClose={() => setIsAudioSetupOpen(false)}
      />
      <CreditPurchaseModal
        isOpen={isCreditPurchaseOpen}
        onClose={() => setIsCreditPurchaseOpen(false)}
        userEmail={user?.email}
        onCreditsAdded={handleCreditsAdded}
      />
      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />
      <TermsOfServiceModal
        isOpen={isTermsOfServiceOpen}
        onClose={() => setIsTermsOfServiceOpen(false)}
      />
      <AccessibilityPolicyModal
        isOpen={isAccessibilityPolicyOpen}
        onClose={() => setIsAccessibilityPolicyOpen(false)}
      />
    </div>
  );
}