import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { producerProfile } from "@/components/agent/agent-profile";
import { getRoutesForUser, getAllRoutesForSysOp } from '@/components/routes.tsx';
import { MdSpeed } from 'react-icons/md';
import ZoomControl from '@/components/ui/ZoomControl';
import {
  Menu,
  Home,
  Phone,
  Users,
  Settings,
  CreditCard,
  Trophy,
  Shield,
  UserCog,
  LogOut,
  CheckCircle2,
  BarChart3,
  Headphones,
  TrendingUp,
  Edit3,
  Calendar,
  CalendarCheck
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Use the same routes as ConnectNowLayout for consistency

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showproducerProfile, setShowproducerProfile] = useState(false);
  const [location] = useLocation();
  const { authState, logout } = useAuth();
  const { user, profile } = authState;

  const isActivePath = (path: string) => {
    return location === path || location.startsWith(path);
  };

  // Debug effect to watch state changes
  useEffect(() => {
    console.log('DashboardLayout: showproducerProfile state changed to:', showproducerProfile);
  }, [showproducerProfile]);

  // Any authenticated user with company email has access
  const isAdmin = user?.email?.includes('@aoglobelife.com') || false;

  // Give full admin access to specific users
  const fullAdminEmails = [
    'cnsysop@aoglobelife.com',
    'leynatran@aoglobelife.com',
    'diankablash@aoglobelife.com',
    'mathewkawaji@aoglobelife.com' // Always has access to Live Call Board
  ];
  
  const isSysOp = fullAdminEmails.includes(user?.email || '') || user?.email === 'richiealtig@aoglobelife.com';

  // Check if user is MGA/RGA (for Live Call Board access)
  const { data: userTeamInfo } = useQuery<{
    role: 'MGA' | 'RGA' | 'BOTH' | null;
    mgaAssociateId: number | null;
  }>({
    queryKey: ['/api/live-call-board/user-team-info', user?.email],
    queryFn: async () => {
      if (!user?.email) return { role: null, mgaAssociateId: null };
      const response = await fetch(`/api/live-call-board/user-team-info?email=${encodeURIComponent(user.email)}`);
      if (!response.ok) return { role: null, mgaAssociateId: null };
      return response.json();
    },
    enabled: !!user?.email && !isSysOp, // Only check if not sysop
    staleTime: 300000, // Cache for 5 minutes
  });

  // Get base routes
  const baseRoutes = isSysOp 
    ? getAllRoutesForSysOp() // SYSOPS (cnsysop) get ALL routes
    : getRoutesForUser(isAdmin || false, user?.email);

  // Return base routes without adding Live Call Board
  const routes = baseRoutes;


  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AO</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AO Intelligence</h1>
            <p className="text-xs text-gray-500">powered by ConnectNow</p>
          </div>
        </div>
      </div>

      {/* User Profile - Clickable */}
      <div className="border-b px-6 py-4">
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => {
            console.log('Profile clicked, opening modal');
            setShowproducerProfile(true);
          }}
        >
          <Avatar className="h-10 w-10">
            {profile?.profilePicture ? (
              <AvatarImage src={profile.profilePicture} alt="Profile" />
            ) : (
              <AvatarFallback className="bg-purple-100 text-purple-600">
                {profile?.firstName?.[0]}{profile?.lastName?.[0]}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.firstName} {profile?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-600 text-xs">
                Admin
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Force opening modal');
                setShowproducerProfile(true);
              }}
              className="px-2 py-1 text-xs"
            >
              Profile
            </Button>
            <Edit3 className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {routes.map((route) => {
          const isActive = isActivePath(route.path);
          const Icon = route.icon;
          
          return (
            <Link key={route.path} href={route.path}>
              <span
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon
                  className={`mr-3 h-5 w-5 ${
                    isActive ? "text-purple-500" : "text-gray-400 group-hover:text-gray-500"
                  }`}
                />
                <span className="flex-1">
                  <span className="block">{route.name}</span>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t px-3 py-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-600 hover:text-gray-900"
          onClick={logout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        {/* Desktop Header with Zoom Control */}
        <div className="hidden lg:flex items-center justify-between h-16 bg-white border-b border-gray-200 px-6">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">AO</span>
            </div>
            <span className="font-semibold text-gray-900">ConnectNow</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={navigator?.userAgent?.includes('Mac') ? 'https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-1.3.8-x86_64.dmg' : 'https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-1.3.8-x86_64.exe'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-xs font-medium transition-colors"
              title="Download RustDesk for remote assistance"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Remote Support
            </a>
            <ZoomControl />
          </div>
        </div>

        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between h-16 bg-white border-b border-gray-200 px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">AO</span>
            </div>
            <span className="font-semibold text-gray-900">ConnectNow</span>
          </div>
          <ZoomControl />
        </div>

        {/* Page Content */}
        <main className="flex-1 pb-8">
          {children}
        </main>
      </div>

      {/* Producer Profile Modal */}
      {showproducerProfile && (
        <producerProfile onClose={() => setShowproducerProfile(false)} />
      )}
    </div>
  );
}