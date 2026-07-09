import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Home, 
  Users, 
  Settings, 
  Upload, 
  BarChart3,
  Search,
  Menu,
  Sun,
  Moon,
  ChevronRight,
  User,
  LogOut,
  Coins,
  Video,
  Brain,
  UserPlus,
  FileCheck,
  CreditCard,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { ProducerSetupModal } from '@/components/modals/AgentSetupModal';
import { useQueryClient } from '@tanstack/react-query';
import { CreditPurchaseModal } from '@/components/stripe/CreditPurchaseModal';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = React.useState(false);
  const [isproducerSetupOpen, setIsproducerSetupOpen] = React.useState(false);
  const [isCreditPurchaseOpen, setIsCreditPurchaseOpen] = React.useState(false);
  const queryClient = useQueryClient();

  // Fetch Producer Profile for profile picture
  const { data: producerProfile } = useQuery({
    queryKey: ['/api/agent/profile-direct', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      try {
        const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          const profile = await response.json();
          return profile;
        }
      } catch (error) {
        console.log('❌ Failed to fetch Producer Profile:', error);
      }
      return null;
    },
    enabled: !!user?.email,
    refetchInterval: 60000, // Refresh every minute
  });

  const navigationItems = [
    {
      icon: Video,
      label: 'Meet',
      path: '/dashboard/ao-meet',
    },
    {
      icon: Brain,
      label: 'AO Intel',
      path: '/dashboard/aoi',
    },
    {
      icon: UserPlus,
      label: 'Recruit',
      path: '/dashboard/ao-recruit',
    },
    {
      icon: FileCheck,
      label: 'Precheck',
      path: '/dashboard/ao-precheck',
    },
    {
      icon: CreditCard,
      label: 'Billing',
      path: '/dashboard/billing-dashboard',
    },
    {
      icon: GraduationCap,
      label: 'Training',
      path: '/training-practice',
    },
    {
      icon: Settings,
      label: 'Settings',
      path: '/dashboard/settings',
    },
  ];

  const toggleTheme = () => {
    setIsDark(!isDark);
    // Add your theme toggle logic here
    document.documentElement.classList.toggle('dark');
  };

  // Fetch credits
  const { data: creditsData } = useQuery({
    queryKey: ['/api/connectnow/user-credits', user?.email],
    queryFn: async () => {
      if (!user?.email) {
        return { credits_remaining: 0, credits_used: 0, credits_purchased: 0 };
      }
      
      try {
        const response = await fetch(`/api/connectnow/user-credits/${user.email}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          return data;
        }
      } catch (error) {
        console.log('❌ Failed to fetch credits:', error);
      }
      
      return { credits_remaining: 0, credits_used: 0, credits_purchased: 0 };
    },
    enabled: !!user?.email,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const credits = (creditsData as any)?.credits_remaining || 0;

  const handleCreditsAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/connectnow/user-credits', user?.email] });
    setIsCreditPurchaseOpen(false);
  };

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-50 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header - Just logo and toggle */}
      <div className="flex items-center justify-between p-4 border-b">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AO</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">AO - Pre Check</h1>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">AO</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* Search Bar */}
      {!isCollapsed && (
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search"
              className="pl-9 pr-3 h-9"
            />
            <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">/</span>
            </kbd>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {!isCollapsed && 'NAVIGATION'}
          </div>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || location === item.path + '/';
            
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-50',
                    isCollapsed ? 'px-2' : 'px-3',
                    isActive && 'bg-gray-100 text-gray-900'
                  )}
                  size="sm"
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn('h-4 w-4 text-gray-600', !isCollapsed && 'mr-2')} />
                  {!isCollapsed && <span className="text-gray-700">{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer - Credits, Theme Toggle and Profile */}
      <div className="p-4 border-t space-y-3">
        {/* Credits Display - Above Profile */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Coins className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {credits.toLocaleString()} credits
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
              <span className="text-xs font-medium text-gray-700">
                {credits > 999 ? `${(credits / 1000).toFixed(1)}k` : credits}
              </span>
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <span className="text-xs text-gray-500">Theme</span>
          )}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <Button
              variant={!isDark ? 'default' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7',
                !isDark && 'bg-white shadow-sm'
              )}
              onClick={() => !isDark && toggleTheme()}
              title={isCollapsed ? 'Light' : undefined}
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              variant={isDark ? 'default' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7',
                isDark && 'bg-white shadow-sm'
              )}
              onClick={() => isDark && toggleTheme()}
              title={isCollapsed ? 'Dark' : undefined}
            >
              <Moon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Profile Dropdown - Bottom Left */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn(
              "relative w-full justify-start p-2 h-auto",
              isCollapsed && "justify-center"
            )} data-testid="button-profile">
              <div className={cn(
                "rounded-full overflow-hidden ring-2 ring-gray-300 ring-offset-2 shadow-sm hover:ring-gray-400 transition-all duration-200 flex-shrink-0",
                isCollapsed ? "h-10 w-10" : "h-10 w-10"
              )}>
                {producerProfile?.profilePicture ? (
                  <img 
                    src={producerProfile.profilePicture} 
                    alt="Profile" 
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold rounded-full">
                    <User className={isCollapsed ? "w-5 h-5" : "w-5 h-5"} />
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col items-start ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none truncate w-full text-gray-700">
                    {producerProfile?.firstName && producerProfile?.lastName 
                      ? `${producerProfile.firstName} ${producerProfile.lastName}`
                      : (user?.email ? user.email.split('@')[0] : 'User')
                    }
                  </p>
                  <p className="text-xs leading-none text-gray-500 truncate w-full">
                    {user?.email}
                  </p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-gray-700">
                  {producerProfile?.firstName && producerProfile?.lastName 
                    ? `${producerProfile.firstName} ${producerProfile.lastName}`
                    : (user?.email ? user.email.split('@')[0] : 'User')
                  }
                </p>
                <p className="text-xs leading-none text-gray-500">
                  Executive Producer
                </p>
                <p className="text-xs leading-none text-gray-500 opacity-75">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsproducerSetupOpen(true)}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Producer Setup Modal */}
      <ProducerSetupModal
        isOpen={isproducerSetupOpen}
        onClose={() => {
          setIsproducerSetupOpen(false);
          // Refresh the profile data to show updated profile picture
          queryClient.invalidateQueries({ queryKey: ['/api/agent/profile-direct', user?.email] });
        }}
      />

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={isCreditPurchaseOpen}
        onClose={() => setIsCreditPurchaseOpen(false)}
        userEmail={user?.email}
        onCreditsAdded={handleCreditsAdded}
      />
    </div>
  );
}

