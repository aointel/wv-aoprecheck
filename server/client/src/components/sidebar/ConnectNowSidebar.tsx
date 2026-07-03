import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { FaChevronLeft, FaChevronRight, FaDownload, FaQuestionCircle, FaTimes } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { IRoute } from '@/components/routes';
import { DesktopAppModal } from '@/components/desktop-app/DesktopAppModal';

interface SidebarProps {
  routes: IRoute[];
  isOpen: boolean;
  onToggle: () => void;
  userEmail?: string;
  creditsRemaining: number;
}

export function ConnectNowSidebar({ routes, isOpen, onToggle, userEmail, creditsRemaining }: SidebarProps) {
  const [location] = useLocation();
  const [isDesktopAppModalOpen, setIsDesktopAppModalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-screen bg-background border-r border-border transition-all duration-300 z-50 overflow-hidden",
        isOpen ? "w-[290px]" : "w-20"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b min-h-[70px]">
        {isOpen && (
          <div className="flex flex-col">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
              AO Intelligence
            </h1>
            <p className="text-xs text-muted-foreground">
              powered by ConnectNow
            </p>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2"
          >
            {isOpen ? <FaChevronLeft size={16} /> : <FaChevronRight size={16} />}
          </Button>
        </div>
      </div>



      {/* Navigation */}
      <div className="p-4 space-y-1">
        {routes.map((route, index) => {
          // Fix active state detection - handle root dashboard specially
          const isActive = route.path === '/dashboard' 
            ? (location === '/dashboard' || location === '/dashboard/')
            : location === route.path || location === route.path + '/';
          
          return (
            <Link
              key={index}
              href={route.path}
              className="block"
            >
              <div
                className={cn(
                  "flex items-center p-3 rounded-md transition-all duration-200 cursor-pointer",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isOpen ? "justify-start" : "justify-center"
                )}
              >
                <div className="min-w-[20px] flex items-center justify-center">
                  <route.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "")} />
                </div>
                
                {isOpen && (
                  <span className={cn(
                    "ml-3 text-sm font-medium truncate",
                    isActive 
                      ? "text-primary-foreground" 
                      : "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent"
                  )}>
                    {route.name}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Spacer to push support badge and footer content to bottom */}
      <div className="flex-1 flex items-end p-4">
        <button
          type="button"
          onClick={() => setIsSupportOpen(true)}
          className={cn(
            "w-full rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-600 text-white shadow-xl transition-all hover:scale-[1.02]",
            isOpen ? "px-4 py-4 text-left" : "h-14 p-0"
          )}
          title="Get Support"
        >
          <div className={cn("flex items-center", isOpen ? "gap-3" : "justify-center")}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <FaQuestionCircle className="h-5 w-5" />
            </span>
            {isOpen && (
              <span>
                <span className="block text-base font-black leading-tight">Get Support</span>
                <span className="block text-xs font-semibold text-blue-100">Open guided help</span>
              </span>
            )}
          </div>
        </button>
      </div>

      <div
        className={cn(
          "fixed bottom-4 top-4 z-[60] w-[420px] max-w-[calc(100vw-110px)] overflow-hidden rounded-r-3xl border-y border-r border-white/10 bg-[#0b1020] text-white shadow-2xl transition-all duration-300",
          isSupportOpen ? "translate-x-0 opacity-100" : "-translate-x-full pointer-events-none opacity-0"
        )}
        style={{ left: isOpen ? 290 : 80 }}
      >
        <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.20),transparent_40%)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">AOI Support</div>
              <div className="mt-1 text-sm text-slate-300">Guided help</div>
            </div>
            <button
              type="button"
              onClick={() => setIsSupportOpen(false)}
              className="rounded-full bg-red-500 p-2 text-white hover:bg-red-600"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            <div className="rounded-2xl rounded-bl-md bg-white/12 px-4 py-3 text-base font-semibold">
              Hi, I am AOI Help.
            </div>
            <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm">
              Please let me know how I can help you.
            </div>
            {[
              'Call Connector Pro',
              'Leads or queue are not loading',
              'WebRTC / Microphone',
              'Billing / Subscription',
              'Account / Login',
              'Report a Bug',
            ].map((label) => (
              <button
                key={label}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-white/20"
              >
                <FaQuestionCircle className="h-4 w-4 text-blue-300" />
                <span>{label}</span>
              </button>
            ))}
            <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm leading-6 text-slate-100">
              Select the closest section, then send support the page, lead ID if applicable, and a screenshot if the answer does not resolve it.
            </div>
          </div>
        </div>
      </div>

      {/* Desktop App Download Button */}
      <div className="p-4 border-t">
        <Button
          onClick={() => setIsDesktopAppModalOpen(true)}
          className={cn(
            "w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white border-0 transition-all duration-200",
            isOpen ? "h-12 text-sm" : "h-10 p-0"
          )}
        >
          <div className="flex items-center justify-center space-x-2">
            <FaDownload className={cn("flex-shrink-0", isOpen ? "w-4 h-4" : "w-5 h-5")} />
            {isOpen && (
              <div className="flex flex-col items-start leading-tight">
                <span className="font-semibold text-xs">Desktop App Available!</span>
                <span className="text-xs opacity-90">Download Now</span>
              </div>
            )}
          </div>
        </Button>
      </div>

      {/* User Info */}
      {isOpen && userEmail && (
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground truncate">
            {userEmail}
          </p>
        </div>
      )}

      {/* Desktop App Modal */}
      <DesktopAppModal 
        isOpen={isDesktopAppModalOpen} 
        onClose={() => setIsDesktopAppModalOpen(false)} 
      />
    </div>
  );
}