import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Home, 
  Settings, 
  UserCircle, 
  HelpCircle, 
  LogOut, 
  Bell,
  Menu,
  Upload,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  // Format user role for display
  const formatRole = (role: string) => {
    if (!role) return '';
    return role.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <header className="border-b bg-white sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Just page title */}
          <h1 className="text-lg font-semibold text-gray-900">
            {location === '/' ? 'Dashboard' :
             location === '/hierarchy' ? 'Hierarchy' :
             location === '/hierarchy-management' ? 'Manage Users' :
             location === '/csv-upload' ? 'CSV Upload' :
             location === '/analytics' ? 'Analytics' : 'Dashboard'}
          </h1>
          
          {/* Mobile menu button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link href="/">
              <Button
                variant={location === '/' ? 'default' : 'ghost'}
                className={cn(
                  "flex items-center rounded-md",
                  location === '/' && "bg-gray-100 text-gray-900 hover:bg-gray-100"
                )}
                size="sm"
              >
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            
            <Link href="/hierarchy">
              <Button
                variant={location === '/hierarchy' ? 'default' : 'ghost'}
                className={cn(
                  "flex items-center rounded-md",
                  location === '/hierarchy' && "bg-gray-100 text-gray-900 hover:bg-gray-100"
                )}
                size="sm"
              >
                <Users className="mr-2 h-4 w-4" />
                Hierarchy
              </Button>
            </Link>
            
            {user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
              <Link href="/hierarchy-management">
                <Button
                  variant={location === '/hierarchy-management' ? 'default' : 'ghost'}
                  className={cn(
                    "flex items-center rounded-md",
                    location === '/hierarchy-management' && "bg-gray-100 text-gray-900 hover:bg-gray-100"
                  )}
                  size="sm"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
              </Link>
            )}
            
            <Link href="/csv-upload">
              <Button
                variant={location === '/csv-upload' ? 'default' : 'ghost'}
                className={cn(
                  "flex items-center rounded-md",
                  location === '/csv-upload' && "bg-gray-100 text-gray-900 hover:bg-gray-100"
                )}
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                CSV Upload
              </Button>
            </Link>
            
            <Link href="/analytics">
              <Button
                variant={location === '/analytics' ? 'default' : 'ghost'}
                className={cn(
                  "flex items-center rounded-md",
                  location === '/analytics' && "bg-gray-100 text-gray-900 hover:bg-gray-100"
                )}
                size="sm"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </Link>
            
            {/* Notification icon */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 bg-red-500 text-white text-[10px]">
                3
              </Badge>
            </Button>
            
            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border border-slate-200">
                    <AvatarFallback className="bg-slate-100 text-slate-500">
                      {user ? getInitials(user.fullName) : '?'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start p-2">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium">{user?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    {user?.office && (
                      <p className="text-xs text-muted-foreground">
                        Office: {user.office}
                      </p>
                    )}
                    {user?.role && (
                      <Badge variant="outline" className="mt-1">
                        {formatRole(user.role)}
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t mt-3">
            <nav className="flex flex-col space-y-2">
              <Link href="/">
                <Button
                  variant={location === '/' ? 'default' : 'ghost'}
                  className="flex items-center w-full justify-start"
                  size="sm"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              
              <Link href="/hierarchy">
                <Button
                  variant={location === '/hierarchy' ? 'default' : 'ghost'}
                  className="flex items-center w-full justify-start"
                  size="sm"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Hierarchy
                </Button>
              </Link>
              
              <Link href="/csv-upload">
                <Button
                  variant={location === '/csv-upload' ? 'default' : 'ghost'}
                  className="flex items-center w-full justify-start"
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  CSV Upload
                </Button>
              </Link>
              
              <Link href="/analytics">
                <Button
                  variant={location === '/analytics' ? 'default' : 'ghost'}
                  className="flex items-center w-full justify-start"
                  size="sm"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Analytics
                </Button>
              </Link>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}