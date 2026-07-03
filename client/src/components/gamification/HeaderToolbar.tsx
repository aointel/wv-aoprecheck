import React, { useState, useEffect } from 'react';
import { ToastAction } from '@/components/ui/toast';
import { useQuery } from '@tanstack/react-query';
import { MdStars } from 'react-icons/md';

import { Wrench, LogOut, User, Settings, Calendar, ExternalLink, Volume2, GraduationCap, Bell, Coins, Megaphone, CalendarDays, DollarSign, Phone, AlertTriangle, Clock, Users, Zap, X, Sparkles, Trash2, MoreVertical, HelpCircle, BookOpen, Video, Search, LayoutGrid, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { AudioSetupModal } from '@/components/audio/AudioSetupModal';
import SchedulingModal from '@/components/scheduling/SchedulingModal';
import { CreditPurchaseModal } from '@/components/stripe/CreditPurchaseModal';
import { AOICardsModal } from '@/components/modals/AOICardsModal';
import { AppointmentCardsModal } from '@/components/modals/AppointmentCardsModal';
import { AOIMeetModal } from '@/components/modals/AOIMeetModal';
import { producerProfile } from '@/components/agent/agent-profile';
import { BugReportModal } from '@/components/feedback/BugReportModal';
import { ProducerSetupModal } from '@/components/modals/AgentSetupModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import AlexAIToggle from '@/components/alex-ai/AlexAIToggle';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { useCreditNotifications } from '@/components/credit-notifications';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';
import { useCall } from '@/components/global/GlobalCallModal';
import { supabase } from '@/lib/supabase';
import { useChangelogContext } from '@/contexts/ChangelogContext';
import { useChangelog } from '@/hooks/use-changelog';
import { useLocation, Link } from 'wouter';
import { GlobalSearch } from '@/components/global/GlobalSearch';
import { HelpModal } from '@/components/training/HelpModal';
import ZoomControl from '@/components/ui/ZoomControl';
import { useHelpQueueStatus } from '@/hooks/use-help-queue-status';
import { formatAppointmentCountdown } from '@/components/help/HelpQueueStatusBanner';

interface AgentRankTickerProps {
  userEmail?: string;
}

interface Announcement {
  id: string;
  title: string;
  description: string;
  schedule: string;
  actionLabel: string;
  link: string;
  meetingId?: string;
  passcode?: string;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'office-hours-thursday',
    title: 'AOIntel Office Hours',
    description: 'Office Hours for Thursday the 20th from 8:30 - 9:30 a.m. PST. Office hours will be consistent on Thursdays from 8:30-9:30 a.m. PST moving forward unless otherwise announced. Live help for tech issues, workflow guidance, and platform questions.',
    schedule: 'Thursdays • 8:30-9:30 AM PST',
    actionLabel: 'CLICK TO JOIN',
    link: 'https://zoom.us/j/5692241629?pwd=AOIntel',
    meetingId: '569 224 1629',
    passcode: 'AOIntel',
  },
  {
    id: 'office-hours-monday',
    title: 'AOIntel Office Hours',
    description: 'Office Hours every Monday at 12:00 PM PST. Live help for tech issues, workflow guidance, and platform questions.',
    schedule: 'Mondays • 12:00 PM PST',
    actionLabel: 'CLICK TO JOIN',
    link: 'https://zoom.us/j/5692241629?pwd=AOIntel',
    meetingId: '569 224 1629',
    passcode: 'AOIntel',
  },
];

function HelpQueueNavStatus() {
  const { authState } = useAuth();
  const { hasScheduledSupport, hasUpcomingBooking, hasQueue, isReady, acknowledged, position, bookingId, slotStart, zoomLink } = useHelpQueueStatus(authState?.user?.email);
  const [countdown, setCountdown] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (!slotStart) {
      setCountdown(null);
      return;
    }
    const update = () => setCountdown(formatAppointmentCountdown(slotStart));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [slotStart]);

  if (!hasScheduledSupport) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-md',
          'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white hover:from-blue-500 hover:via-purple-500 hover:to-blue-600',
          'border-0 transition-all hover:shadow-lg'
        )}
      >
        <Wrench className="w-4 h-4 shrink-0" />
        <span className="font-mono">
          {isReady && !acknowledged ? "It's your turn!" : isReady ? "AOI Support ready" : hasUpcomingBooking ? "Scheduled" : `#${position ?? '…'}`}
        </span>
        {countdown && <span className="font-mono text-xs opacity-90 ml-0.5">({countdown})</span>}
      </button>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
              AOI Support Queue
            </DialogTitle>
            <DialogDescription>
              {isReady && !acknowledged ? (
                <>Your session is ready. Join the Zoom call now.</>
              ) : isReady ? (
                <>Your AOI Support session is available.</>
              ) : hasUpcomingBooking ? (
                <>Your support slot is scheduled. Join the queue when ready. {countdown && <span className="font-mono">{countdown}</span>}</>
              ) : (
                <>Position #{position ?? '…'} — {countdown}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            {isReady && zoomLink && (
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-500 hover:via-purple-500 hover:to-blue-600 text-white"
                onClick={() => { window.open(zoomLink, '_blank'); setModalOpen(false); }}
              >
                <Video className="w-4 h-4 mr-2" />
                Join Zoom
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={bookingId ? `/help/queue?booking=${bookingId}` : '/help'} onClick={() => setModalOpen(false)}>
                View full queue
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AgentRankTicker({ userEmail }: AgentRankTickerProps) {
  const { toast } = useToast();
  const [previousRank, setPreviousRank] = useState<number | null>(null);
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(Date.now());
  
  const { data: leaderboardData } = useQuery({
    queryKey: ['/api/leaderboard'],
    refetchInterval: 30000, // Update every 30 seconds
  });

  // Find current user's stats in leaderboard
  const userStats = (leaderboardData as any)?.leaderboard?.find((producer: any) => producer.email === userEmail);
  const leaderboard = (leaderboardData as any)?.leaderboard || [];
  
  // Debug logging
  if (leaderboardData && !userStats && userEmail) {
    console.log(`⚠️ User ${userEmail} not found in leaderboard of ${leaderboard.length} producers`);
  }
  
  // Track rank changes and show toast notification every 15 minutes
  useEffect(() => {
    if (!userStats || !userEmail) return;
    
    const currentRank = userStats.rank;
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    
    // Check if 15 minutes have passed since last notification
    if (previousRank !== null && now - lastNotificationTime >= fifteenMinutes) {
      const rankDiff = previousRank - currentRank; // Positive = moved up
      
      if (rankDiff > 0) {
        // Moved UP
        toast({
          title: `📈 Rank Improved!`,
          description: `You moved up from #${previousRank} to #${currentRank}! Keep it up!`,
          className: 'bg-green-50 border-green-500',
        });
      } else if (rankDiff < 0) {
        // Moved DOWN
        toast({
          title: `📉 Rank Changed`,
          description: `You dropped from #${previousRank} to #${currentRank}. Time to hustle!`,
          variant: 'destructive',
        });
      } else {
        // Stayed the same
        toast({
          title: `➡️ Rank Stable`,
          description: `You're still holding #${currentRank}. Keep grinding!`,
        });
      }
      
      setLastNotificationTime(now);
    }
    
    // Update previous rank
    if (previousRank === null || now - lastNotificationTime >= fifteenMinutes) {
      setPreviousRank(currentRank);
    }
  }, [userStats, previousRank, lastNotificationTime, userEmail, toast]);
  
  // If user not found in leaderboard, show top performer as example
  const displayStats = userStats || (leaderboard.length > 0 ? leaderboard[0] : null);
  
  if (!displayStats) {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded text-sm font-mono cursor-pointer">
            <span>CNSYS</span>
            <span>#-</span>
            <Minus className="h-3 w-3" />
            <span className="text-xs">--%</span>
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-96 p-0" side="bottom" align="end">
          <Leaderboard compact userEmail={userEmail} />
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Generate ticker symbol from Producer Name or use CNSYS for admin
  const tickerSymbol = userStats ? 
    userStats.agentName
      .split(' ')
      .map((name: string) => name.substring(0, 2))
      .join('')
      .toUpperCase()
      .substring(0, 4)
    : 'CNSYS';

  // Calculate trend using site theme colors
  const trend = displayStats.bookingRate > 25 ? 'up' : displayStats.bookingRate < 15 ? 'down' : 'neutral';
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';
  const bgColor = trend === 'up' ? 'bg-primary/20 border-green-500/30' : trend === 'down' ? 'bg-destructive/20 border-destructive/30' : 'bg-muted border-border';
  
  // Show "#1" if admin user (not in Producer Leaderboard)
  const displayRank = userStats ? userStats.rank : 1;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className={`flex items-center gap-3 px-4 py-2 ${bgColor} rounded-lg cursor-pointer font-mono text-sm transition-colors hover:bg-accent border-2 shadow-sm`}>
          <span className="text-slate-700 dark:text-slate-300 font-bold">#{displayRank}</span>
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          <span className="text-foreground font-semibold">{displayStats.agentName || 'Unknown'}</span>
          <span className="text-slate-600 dark:text-slate-400">-</span>
          <span className="text-blue-600 font-semibold">D {displayStats.dials || 0}</span>
          <span className="text-green-600 font-semibold">R {displayStats.reaches || 0}</span>
          <span className="text-purple-600 font-semibold">B {displayStats.bookings || 0}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 p-0" side="bottom" align="end">
        <Leaderboard compact userEmail={userEmail} />
      </HoverCardContent>
    </HoverCard>
  );
}

interface HeaderToolbarProps {
  userId: string;
  onToggle: () => void;
}

export function HeaderToolbar({ userId, onToggle }: HeaderToolbarProps) {
  const [location] = useLocation();
  
  const [isAudioSetupOpen, setIsAudioSetupOpen] = useState(false);
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [isCreditPurchaseOpen, setIsCreditPurchaseOpen] = useState(false);
  const [isAOICardsOpen, setIsAOICardsOpen] = useState(false);
  const [isAppointmentCardsOpen, setIsAppointmentCardsOpen] = useState(false);
  const [isAOIMeetOpen, setIsAOIMeetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isproducerSetupOpen, setIsproducerSetupOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [isAnnouncementsModalOpen, setAnnouncementsModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  // Check if we're on AO Precheck pages
  const isPrecheckPage = location.includes('/verification-start') || location.includes('/precheck');

  const [aoiAipAmount, setAoiAipAmount] = useState(0);
  const { authState, logout } = useAuth();
  const queryClient = useQueryClient();
  const { openCallModal, isCallActive } = useCall();
  const { notifications: creditNotifications } = useCreditNotifications();
  const { toast } = useToast();
  const { openChangelog } = useChangelogContext();
  const { unreadEntries } = useChangelog(authState?.user?.email);

  // 🔥 NEW: Fetch billing notifications directly from Supabase with real-time updates
const { data: notificationsData, refetch: refetchNotifications, error: notificationsError } =  useQuery({
    queryKey: ['/api/notifications', authState?.user?.email],
    queryFn: async () => {
      if (!authState?.user?.email || !supabase) {
        throw new Error('No user email or Supabase not available');
      }
      
      const agentEmail = authState.user.email.toLowerCase();
      console.log('🔔 Fetching notifications from Supabase for:', agentEmail);
      
      // Fetch notifications - sort by urgent first, then by date
      const { data: notifications, error: notificationsError } = await supabase
        .from('agent_notifications')
        .select('*')
        .eq('agent_email', agentEmail)
        .order('urgent', { ascending: false }) // Urgent first
        .order('created_at', { ascending: false })
        .limit(50); // Increased limit for better UX

      if (notificationsError) {
        console.error('❌ Failed to fetch notifications:', notificationsError);
        throw new Error(`Failed to fetch notifications: ${notificationsError.message}`);
      }

      // Get unread count
      const { count: unreadCount, error: countError } = await supabase
        .from('agent_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', agentEmail)
        .eq('read', false);

      if (countError) {
        console.error('❌ Failed to fetch unread count:', countError);
      }

      const result = {
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
      };

      return result;
    },
    refetchInterval: 10000, // Poll every 10 seconds for better responsiveness
    enabled: !!authState?.user?.email && !!supabase,
    retry: 1,
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!authState?.user?.email || !supabase) {
      console.log('⚠️ Cannot set up real-time subscription: missing email or supabase');
      return;
    }

    const agentEmail = authState.user.email.toLowerCase();
    console.log('🔔 Setting up real-time subscription for:', agentEmail);

    const channel = supabase
      .channel(`agent_notifications_${agentEmail.replace('@', '_at_')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_notifications',
          filter: `agent_email=eq.${agentEmail}`,
        },
        (payload) => {
          console.log('🔔 Real-time notification update:', payload.eventType);
          console.log('🔔 Payload:', JSON.stringify(payload, null, 2));
          
          // Handle new notifications
          if (payload.eventType === 'INSERT' && payload.new) {
            const notification = payload.new;
            console.log('🔔 New notification received:', notification);
            console.log('🔔 Notification read status:', notification.read);
            
            // Check if already read (some might come in as read)
            if (notification.read === true) {
              console.log('⚠️ Notification already marked as read, skipping alerts');
              refetchNotifications();
              return;
            }
            
            console.log('✅ Processing new unread notification');
            
            // Play sound for notifications (pleasant chime sound)
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (!AudioContextClass) {
                console.warn('AudioContext not supported');
              } else {
                const audioContext = new AudioContextClass();
                
                // Resume audio context if suspended (required after user interaction)
                if (audioContext.state === 'suspended') {
                  audioContext.resume().catch(e => console.warn('Could not resume audio context:', e));
                }
                
                const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
                  const oscillator = audioContext.createOscillator();
                  const gainNode = audioContext.createGain();
                  oscillator.connect(gainNode);
                  gainNode.connect(audioContext.destination);
                  oscillator.frequency.value = frequency;
                  oscillator.type = 'sine';
                  gainNode.gain.setValueAtTime(0, startTime);
                  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
                  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
                  oscillator.start(startTime);
                  oscillator.stop(startTime + duration);
                };
                
                if (notification.urgent) {
                  // Urgent: Three-tone ascending chime (more attention-grabbing)
                  playTone(523.25, audioContext.currentTime, 0.15, 0.3); // C5
                  playTone(659.25, audioContext.currentTime + 0.1, 0.15, 0.3); // E5
                  playTone(783.99, audioContext.currentTime + 0.2, 0.2, 0.35); // G5
                } else {
                  // Regular: Pleasant two-tone chime (C5 to E5)
                  playTone(523.25, audioContext.currentTime, 0.15, 0.25); // C5
                  playTone(659.25, audioContext.currentTime + 0.1, 0.2, 0.25); // E5
                }
              }
            } catch (e) {
              console.warn('Could not play notification sound:', e);
            }
            
            // Visual alert: briefly highlight the notification bell with a pulse animation
            const bellButton = document.querySelector('[data-testid="notification-bell"]') as HTMLElement;
            if (bellButton) {
              // Add a temporary class for the pulse animation
              bellButton.classList.add('animate-pulse');
              setTimeout(() => {
                bellButton.classList.remove('animate-pulse');
              }, 3000); // Remove after 3 seconds
            }
            
            // Also try to find by button structure
            const bellButtons = document.querySelectorAll('button[title*="notification"], button[title*="Notification"]');
            bellButtons.forEach((btn) => {
              const htmlBtn = btn as HTMLElement;
              htmlBtn.classList.add('animate-pulse');
              setTimeout(() => {
                htmlBtn.classList.remove('animate-pulse');
              }, 3000);
            });
            
            // Show toast notification with "Got it" action button
            const notificationId = notification.id;
            const userEmail = authState?.user?.email;
            console.log('🔔 Showing toast for notification:', notificationId);
            
            toast({
              title: notification.urgent ? '🔔 Urgent Notification' : '🔔 New Notification',
              description: notification.message || notification.title,
              duration: notification.urgent ? 15000 : 12000, // Longer duration: 15s for urgent, 12s for regular
              className: notification.urgent ? 'bg-red-50 border-red-500 dark:bg-red-900/20' : '',
              onOpenChange: async (open) => {
                // Mark as read when toast is dismissed (closed)
                if (!open && notificationId && supabase && userEmail) {
                  try {
                    await supabase
                      .from('agent_notifications')
                      .update({ read: true, read_at: new Date().toISOString() })
                      .eq('id', notificationId);
                    queryClient.invalidateQueries({ queryKey: ['/api/notifications', userEmail] });
                    refetchNotifications();
                  } catch (error) {
                    console.error('Failed to mark notification as read:', error);
                  }
                }
              },
              action: (
                <ToastAction
                  altText="Got it"
                  onClick={async () => {
                    console.log('🔔 "Got it" clicked for notification:', notificationId);
                    // Mark as read and delete notification when "Got it" is clicked
                    if (notificationId && supabase && userEmail) {
                      try {
                        await supabase
                          .from('agent_notifications')
                          .update({ read: true, read_at: new Date().toISOString() })
                          .eq('id', notificationId);
                        await supabase
                          .from('agent_notifications')
                          .delete()
                          .eq('id', notificationId);
                        queryClient.invalidateQueries({ queryKey: ['/api/notifications', userEmail] });
                        refetchNotifications();
                      } catch (error) {
                        console.error('Failed to dismiss notification:', error);
                      }
                    }
                  }}
                >
                  Got it
                </ToastAction>
              ),
            });
            
            console.log('✅ Toast called for notification');
            
            // Browser notification (if permission granted and tab not focused)
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: notification.id,
                requireInteraction: notification.urgent || false,
              });
            }
          }
          
          // Refetch to update badge count
          refetchNotifications();
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error - real-time subscription failed');
        }
      });

    return () => {
      console.log('🔔 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [authState?.user?.email, supabase, refetchNotifications, toast, queryClient]);

  const billingNotifications = notificationsData?.notifications || [];

  const unreadCount = billingNotifications.filter((n: any) => !n.read).length +
                      creditNotifications.filter((n: any) => !n.read).length;

  const allNotifications = [...billingNotifications, ...creditNotifications];

  // Track last notification IDs to detect new ones (fallback if real-time doesn't work)
  const [lastNotificationIds, setLastNotificationIds] = useState<Set<string>>(new Set());

  // Track if we've initialized (to avoid showing notifications on first load)
  const [hasInitialized, setHasInitialized] = useState(false);

  // Detect new notifications by comparing IDs (fallback if real-time doesn't work)
  useEffect(() => {
    if (!allNotifications.length) {
      setLastNotificationIds(new Set());
      if (!hasInitialized) {
        setHasInitialized(true);
      }
      return;
    }
    
    const currentIds = new Set(allNotifications.map((n: any) => n.id));
    
    // On first load OR when we have notifications but lastNotificationIds is empty (e.g. we
    // initialized when list was empty, then data arrived) - store baseline without showing toasts.
    // This prevents toasts for every notification on every page refresh.
    if (!hasInitialized || (lastNotificationIds.size === 0 && currentIds.size > 0)) {
      console.log('🔔 Initializing notification tracking with', currentIds.size, 'notifications (no toasts)');
      setLastNotificationIds(currentIds);
      setHasInitialized(true);
      return;
    }
    
    // Find new notifications (IDs that weren't in the last set)
    const newIds = Array.from(currentIds).filter(id => !lastNotificationIds.has(id));
    
    if (newIds.length > 0) {
      console.log('🔔 Detected new notifications via polling fallback:', newIds);
      const newNotifications = allNotifications.filter((n: any) => newIds.includes(n.id) && !n.read);
      
      newNotifications.forEach((notification: any) => {
        console.log('🔔 Processing new notification (polling fallback):', notification);
        
        // Play sound (pleasant chime)
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            if (audioContext.state === 'suspended') {
              audioContext.resume().catch(() => {});
            }
            
            const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.frequency.value = frequency;
              oscillator.type = 'sine';
              gainNode.gain.setValueAtTime(0, startTime);
              gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
              gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
              oscillator.start(startTime);
              oscillator.stop(startTime + duration);
            };
            
            // Pleasant two-tone chime (C5 to E5)
            playTone(523.25, audioContext.currentTime, 0.15, 0.25); // C5
            playTone(659.25, audioContext.currentTime + 0.1, 0.2, 0.25); // E5
          }
        } catch (e) {
          console.warn('Could not play sound:', e);
        }
        
        // Visual alert: pulse the bell
        const bellButton = document.querySelector('[data-testid="notification-bell"]') as HTMLElement;
        if (bellButton) {
          bellButton.classList.add('animate-pulse');
          setTimeout(() => {
            bellButton.classList.remove('animate-pulse');
          }, 3000);
        }
        
        // Show toast
        toast({
          title: notification.urgent ? '🔔 Urgent Notification' : '🔔 New Notification',
          description: notification.message || notification.title,
          duration: notification.urgent ? 15000 : 12000, // Longer duration: 15s for urgent, 12s for regular
          className: notification.urgent ? 'bg-red-50 border-red-500 dark:bg-red-900/20' : '',
          onOpenChange: async (open) => {
            // Mark as read when toast is dismissed (closed)
            if (!open && notification.id && supabase && authState?.user?.email) {
              try {
                await supabase
                  .from('agent_notifications')
                  .update({ read: true, read_at: new Date().toISOString() })
                  .eq('id', notification.id);
                queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState.user.email] });
                refetchNotifications();
              } catch (error) {
                console.error('Failed to mark notification as read:', error);
              }
            }
          },
          action: (
            <ToastAction
              altText="Got it"
              onClick={async () => {
                console.log('🔔 "Got it" clicked for notification:', notification.id);
                if (notification.id && supabase && authState?.user?.email) {
                  try {
                    await supabase
                      .from('agent_notifications')
                      .update({ read: true, read_at: new Date().toISOString() })
                      .eq('id', notification.id);
                    await supabase.from('agent_notifications').delete().eq('id', notification.id);
                    queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState.user.email] });
                    refetchNotifications();
                  } catch (error) {
                    console.error('Failed to dismiss notification:', error);
                  }
                }
              }}
            >
              Got it
            </ToastAction>
          ),
        });
      });
    }
    
    setLastNotificationIds(currentIds);
  }, [allNotifications.map((n: any) => n.id).join(','), hasInitialized, toast, supabase, authState?.user?.email, queryClient, refetchNotifications]);

  // Helper function to get notification icon and color
  const getNotificationIcon = (type: string, urgent: boolean) => {
    const iconClass = urgent ? 'text-red-500' : '';
    switch (type) {
      case 'billing_transaction':
        return <DollarSign className={`w-4 h-4 ${iconClass}`} />;
      case 'credit_low':
        return <AlertTriangle className={`w-4 h-4 text-orange-500`} />;
      case 'missed_call':
        return <Phone className={`w-4 h-4 ${iconClass}`} />;
      case 'appointment':
        return <Calendar className={`w-4 h-4 ${iconClass}`} />;
      case 'waiting_room':
        return <Users className={`w-4 h-4 text-blue-500`} />;
      case 'system':
        return <Zap className={`w-4 h-4 ${iconClass}`} />;
      default:
        return <Bell className={`w-4 h-4 ${iconClass}`} />;
    }
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Helper function to get notification color
  const getNotificationColor = (type: string, urgent: boolean) => {
    if (urgent) return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20';
    switch (type) {
      case 'billing_transaction':
        return 'border-l-4 border-l-blue-500';
      case 'credit_low':
        return 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'missed_call':
        return 'border-l-4 border-l-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'appointment':
        return 'border-l-4 border-l-green-500';
      case 'waiting_room':
        return 'border-l-4 border-l-indigo-500 bg-indigo-50 dark:bg-indigo-900/20';
      default:
        return '';
    }
  };

  // Debug logging
  useEffect(() => {
    if (notificationsError) {
      console.error('🔔 Notification query error:', notificationsError);
    }
    if (authState?.user?.email) {
      console.log('🔔 Notification state:', {
        email: authState.user.email,
        notificationsCount: billingNotifications.length,
        unreadCount,
        creditNotificationsCount: creditNotifications.length,
        allNotificationsCount: allNotifications.length,
        queryEnabled: !!authState?.user?.email
      });
    }
  }, [notificationsData, notificationsError, unreadCount, billingNotifications.length, creditNotifications.length, allNotifications.length, authState?.user?.email]);

  // Update unread state
  useEffect(() => {
    setHasUnreadNotifications(unreadCount > 0 || creditNotifications.length > 0);
  }, [unreadCount, creditNotifications.length]);

  const { data: gameStats } = useQuery({
    queryKey: ['/api/gamification/stats', userId],
    enabled: !!userId,
  });

  // Fetch credits from the canonical user credits API (Supabase-backed)
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', authState?.user?.email],
    queryFn: async () => {
      if (!authState?.user?.email) {
        return { credits_remaining: 0, credits_used: 0, credits_purchased: 0 };
      }
      
      try {
        const response = await fetch(`/api/user/credits?email=${encodeURIComponent(authState.user.email)}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ HeaderToolbar credits loaded:', data);
          return data;
        }
      } catch (error) {
        console.log('❌ Failed to fetch credits:', error);
      }
      
      // Return 0 if fetch fails
      return { credits_remaining: 0, credits_used: 0, credits_purchased: 0 };
    },
    enabled: !!authState?.user?.email,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch Producer Profile for profile picture
  const { data: producerProfile } = useQuery({
    queryKey: ['/api/agent/profile-direct', authState?.user?.email],
    queryFn: async () => {
      if (!authState?.user?.email) return null;
      
      try {
        const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(authState.user.email)}`);
        if (response.ok) {
          const profile = await response.json();
          return profile;
        }
      } catch (error) {
        console.log('❌ Failed to fetch Producer Profile:', error);
      }
      return null;
    },
    enabled: !!authState?.user?.email,
    refetchInterval: 60000, // Refresh every minute
  });




  // WAR AIP polling removed - no longer needed
  const aoiAipData = null;

  // WAR connects-for-review polling removed - no longer needed

  // AOI AIP polling removed - no updates needed

  // Function to get the appropriate coin color based on credits
  const getCoinColor = (credits: number) => {
    if (credits < 15) return 'bg-red-500';
    if (credits < 30) return 'bg-orange-500';
    if (credits < 50) return 'bg-yellow-500';
    if (credits < 75) return 'bg-blue-500';
    if (credits < 100) return 'bg-purple-500';
    return 'bg-green-500';
  };

  const credits = Number(
    (creditsData as any)?.credits_remaining ??
    (creditsData as any)?.creditsRemaining ??
    0,
  );

  useEffect(() => {
    if (ANNOUNCEMENTS.length <= 1) {
      return;
    }
    const interval = setInterval(() => {
      setAnnouncementIndex((prev) => (prev + 1) % ANNOUNCEMENTS.length);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const activeAnnouncement = ANNOUNCEMENTS[announcementIndex] || ANNOUNCEMENTS[0];

  // Low credits notification disabled - causing infinite re-renders

  const handleCreditsAdded = () => {
    // Refresh credit data after successful purchase
    queryClient.invalidateQueries({ queryKey: ['/api/user/credits'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/agent-stats'] });
    setIsCreditPurchaseOpen(false);
  };

  return (
    <>
    {/* Header Bar - Separate from Profile */}
    <div 
      className="sticky top-0 z-40 bg-background/20 backdrop-blur-md border border-gray-200/30 rounded-xl mx-0 mb-0 px-2 py-1.5 pr-20 transition-all hover:bg-background/60 hover:border-gray-200/60"
      style={{
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05), 0 0 5px rgba(0, 0, 0, 0.02)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div className="flex items-center justify-between w-full">
        {/* Page Title with Gradient - Left Side */}
        <div className="flex items-center">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            {location === '/dashboard/connect' ? 'AO Intelligence' :
             location === '/dashboard/ao-meet' ? 'AO Meet' :
             location === '/dashboard/ao-recruit' ? 'AO Recruit' :
             location === '/dashboard/ao-precheck' ? 'PreCheck' :
             location === '/dashboard/verification-start' ? 'PreCheck' :
             location === '/dashboard/aoi-precheck-admin' ? 'AO Precheck Management' :
             location === '/dashboard/billing-dashboard' ? 'AO Billing' :
             location === '/onboarding' ? 'AO Training' :
             location === '/dashboard/settings' ? 'AO Settings' :
             'AO Intelligence'}
          </h1>
        </div>

        <div className="flex-1 flex justify-center px-3">
          <div className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 px-4 py-1.5 shadow-sm border border-white/10">
            <span className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent whitespace-nowrap">
              Office Hours: Tue 10:00 AM & Fri 11:00 AM PST on Zoom @ 5692241629
            </span>
          </div>
        </div>

        {/* Right Side - Zoom, Alerts */}
        <div className="flex items-center gap-2">
          {/* Credits */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreditPurchaseOpen(true)}
            className="px-3 py-2 flex items-center gap-2"
            title="Credits"
          >
            <span className={cn('w-2.5 h-2.5 rounded-full', getCoinColor(credits))} />
            <Coins className="w-4 h-4" />
            <span className="font-semibold">{credits.toLocaleString()}</span>
          </Button>

          {/* Zoom Control */}
          <ZoomControl />
          
          {/* Notifications */}
          <DropdownMenu open={isNotificationsOpen} onOpenChange={async (open) => {
            setIsNotificationsOpen(open);
            // Auto-mark all notifications as read when dropdown opens
            if (open && unreadCount > 0 && authState?.user?.email && supabase) {
              try {
                const agentEmail = authState.user.email.toLowerCase();
                await supabase
                  .from('agent_notifications')
                  .update({ read: true, read_at: new Date().toISOString() })
                  .eq('agent_email', agentEmail)
                  .eq('read', false);
                // Refresh to update badge count
                refetchNotifications();
                queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState?.user?.email] });
              } catch (error) {
                console.error('Failed to mark notifications as read:', error);
              }
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"  
                size="sm"
                className="p-2 relative"
                title={`${unreadCount} unread notifications`}
                data-testid="notification-bell"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 max-h-[600px] overflow-y-auto">
              <DropdownMenuLabel className="flex items-center justify-between sticky top-0 bg-background z-10 pb-2">
                <span className="font-semibold">Notifications</span>
                <div className="flex items-center gap-2">
                  {/* Filter buttons */}
                  <div className="flex gap-1">
                    <Button
                      variant={notificationFilter === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setNotificationFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={notificationFilter === 'unread' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setNotificationFilter('unread')}
                    >
                      Unread ({unreadCount})
                    </Button>
                    <Button
                      variant={notificationFilter === 'urgent' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setNotificationFilter('urgent')}
                    >
                      Urgent
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={async () => {
                          if (!authState?.user?.email || !supabase) return;
                          try {
                            const agentEmail = authState.user.email.toLowerCase();
                            const { error } = await supabase
                              .from('agent_notifications')
                              .update({ read: true, read_at: new Date().toISOString() })
                              .eq('agent_email', agentEmail)
                              .eq('read', false);
                            
                            if (error) {
                              console.error('Failed to mark all as read:', error);
                              toast({
                                title: 'Error',
                                description: 'Failed to mark all as read',
                                variant: 'destructive',
                              });
                            } else {
                              queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState?.user?.email] });
                              refetchNotifications();
                              toast({
                                title: 'Marked all as read',
                                duration: 2000,
                              });
                            }
                          } catch (error) {
                            console.error('Failed to mark all as read:', error);
                          }
                        }}
                      >
                        Mark all read
                      </Button>
                    )}
                    {/* Delete all read notifications */}
                    {allNotifications.filter((n: any) => n.read).length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-red-600 hover:text-red-700"
                        onClick={async () => {
                          if (!authState?.user?.email || !supabase) return;
                          if (!confirm(`Delete ${allNotifications.filter((n: any) => n.read).length} read notifications?`)) return;
                          
                          try {
                            const agentEmail = authState.user.email.toLowerCase();
                            const readNotificationIds = allNotifications
                              .filter((n: any) => n.read && n.id)
                              .map((n: any) => n.id);
                            
                            if (readNotificationIds.length === 0) return;
                            
                            const { error } = await supabase
                              .from('agent_notifications')
                              .delete()
                              .eq('agent_email', agentEmail)
                              .in('id', readNotificationIds);
                            
                            if (error) {
                              console.error('Failed to delete notifications:', error);
                              toast({
                                title: 'Error',
                                description: 'Failed to delete notifications',
                                variant: 'destructive',
                              });
                            } else {
                              queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState?.user?.email] });
                              refetchNotifications();
                              toast({
                                title: 'Deleted read notifications',
                                duration: 2000,
                              });
                            }
                          } catch (error) {
                            console.error('Failed to delete notifications:', error);
                          }
                        }}
                        title="Delete all read notifications"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(() => {
                let filteredNotifications = [...allNotifications];

                if (notificationFilter === 'unread') {
                  filteredNotifications = filteredNotifications.filter((n: any) => !n.read);
                } else if (notificationFilter === 'urgent') {
                  filteredNotifications = filteredNotifications.filter((n: any) => n.urgent === true);
                }

                if (filteredNotifications.length === 0) {
                  return (
                    <div className="p-4 text-center text-sm text-gray-500">
                      {notificationFilter === 'all' ? 'No notifications' : 
                       notificationFilter === 'unread' ? 'No unread notifications' :
                       'No urgent notifications'}
                    </div>
                  );
                }

                return filteredNotifications.map((notification: any, index: number) => {
                  const isBilling = notification.notification_type === 'billing_transaction';
                  const isRead = notification.read !== false;
                  const isUrgent = notification.urgent === true;
                  const hasAction = notification.actionUrl;
                  
                  return (
                    <DropdownMenuItem
                      key={notification.id || index}
                      className={`p-3 group ${!isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${getNotificationColor(notification.notification_type, isUrgent)}`}
                      onClick={async (e) => {
                        // Mark as read when clicked (if not already read)
                        if (!isRead && notification.id && supabase) {
                          try {
                            await supabase
                              .from('agent_notifications')
                              .update({ read: true, read_at: new Date().toISOString() })
                              .eq('id', notification.id);
                            queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState?.user?.email] });
                            refetchNotifications();
                          } catch (error) {
                            console.error('Failed to mark notification as read:', error);
                          }
                        }
                        
                        // Handle navigation if actionUrl exists
                        if (hasAction && notification.actionUrl) {
                          e.preventDefault();
                          window.location.href = notification.actionUrl;
                          return;
                        }
                      }}
                    >
                      <div className="flex gap-3 w-full">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.notification_type, isUrgent)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium text-sm ${!isRead ? 'font-semibold' : ''} ${isUrgent ? 'text-red-600 dark:text-red-400' : ''}`}>
                                  {notification.title || 'Notification'}
                                </span>
                                {isUrgent && (
                                  <span className="px-1.5 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                                    URGENT
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {notification.message || notification.description}
                              </p>
                              
                              {/* Metadata display */}
                              {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {isBilling && notification.metadata.transaction_type && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                        {notification.metadata.transaction_type === 'connect' && '💳 AO Connect'}
                                        {notification.metadata.transaction_type === 'precheck' && '✅ AO PreCheck'}
                                        {notification.metadata.transaction_type === 'recruit' && '👥 AO Recruit'}
                                      </span>
                                      {notification.metadata.amount_usd && (
                                        <span className="text-gray-500">
                                          ${notification.metadata.amount_usd.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {notification.metadata.lead_name && (
                                    <div className="text-xs text-gray-500">
                                      Lead: {notification.metadata.lead_name}
                                    </div>
                                  )}
                                  {notification.metadata.clientName && (
                                    <div className="text-xs text-gray-500">
                                      Client: {notification.metadata.clientName}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Timestamp */}
                              <div className="flex items-center gap-2 mt-2">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {formatRelativeTime(notification.created_at)}
                                </span>
                                {hasAction && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-auto">
                                    Click to view →
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Unread indicator */}
                              {!isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                              {/* Delete button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!notification.id || !supabase) return;
                                  
                                  try {
                                    const { error } = await supabase
                                      .from('agent_notifications')
                                      .delete()
                                      .eq('id', notification.id);
                                    
                                    if (error) {
                                      console.error('Failed to delete notification:', error);
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to delete notification',
                                        variant: 'destructive',
                                      });
                                    } else {
                                      queryClient.invalidateQueries({ queryKey: ['/api/notifications', authState?.user?.email] });
                                      refetchNotifications();
                                    }
                                  } catch (error) {
                                    console.error('Failed to delete notification:', error);
                                  }
                                }}
                                title="Delete notification"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  );
                });
              })()}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Re-run Diagnostics Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { sessionStorage.removeItem('aoi_startup_complete'); window.location.reload(); }}
            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            title="Run Diagnostics"
          >
            <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </Button>

          {/* Changelog Button */}
          <Button
            variant="outline"  
            size="sm"
            onClick={() => openChangelog()}
            className="p-2 relative hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
            title="View Changelog"
          >
            <BookOpen className="w-5 h-5" />
            {unreadEntries && unreadEntries.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {unreadEntries.length > 9 ? '9+' : unreadEntries.length}
              </span>
            )}
          </Button>

          {/* Queue status in navbar - visible when user is in queue */}
          <HelpQueueNavStatus />

        </div>
      </div>
    </div>

    {/* Announcements Modal */}
    {!isPrecheckPage && (
      <Dialog open={isAnnouncementsModalOpen} onOpenChange={setAnnouncementsModalOpen}>
        <DialogContent className="max-w-xl [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>AOIntel Events &amp; Announcements</DialogTitle>
                <DialogDescription>
                  Stay in the loop with live trainings, office hours, and platform updates.
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <button
                  onClick={() => setAnnouncementsModalOpen(false)}
                  className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {ANNOUNCEMENTS.map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-lg border border-blue-200/60 bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 shadow-sm dark:border-blue-800/60 dark:from-blue-950/40 dark:via-slate-950/60 dark:to-purple-950/40"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-blue-700 dark:text-blue-200">
                      {announcement.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {announcement.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <CalendarDays className="h-4 w-4" />
                        {announcement.schedule}
                      </span>
                      {announcement.meetingId && (
                        <span className="inline-flex items-center gap-1">
                          Meeting ID:
                          <span className="font-semibold">{announcement.meetingId}</span>
                        </span>
                      )}
                      {announcement.passcode && (
                        <span className="inline-flex items-center gap-1">
                          Passcode:
                          <span className="font-semibold uppercase">
                            {announcement.passcode}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => window.open(announcement.link, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    {announcement.actionLabel}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </DialogContent>
        </Dialog>
    )}

      <AudioSetupModal
        isOpen={isAudioSetupOpen}
        onClose={() => setIsAudioSetupOpen(false)}
      />

      <SchedulingModal 
        isOpen={isSchedulingOpen}
        onClose={() => setIsSchedulingOpen(false)}
      />

      <CreditPurchaseModal
        isOpen={isCreditPurchaseOpen}
        onClose={() => setIsCreditPurchaseOpen(false)}
        userEmail={authState.user?.email}
        onCreditsAdded={handleCreditsAdded}
      />

      <AOICardsModal
        isOpen={isAOICardsOpen}
        onClose={() => setIsAOICardsOpen(false)}
        agentEmail={authState?.user?.email || ''}
        remainingCount={0}
      />

      <AppointmentCardsModal
        isOpen={isAppointmentCardsOpen}
        onClose={() => setIsAppointmentCardsOpen(false)}
        agentEmail={authState?.user?.email || ''}
        remainingCount={0}
      />

      <AOIMeetModal
        isOpen={isAOIMeetOpen}
        onClose={() => setIsAOIMeetOpen(false)}
        agentName={creditsData?.name || authState.profile?.firstName || 'producer'}
        producerPhone={""}
      />

      {/* Profile modal handled by ProducerSetupModal */}

      <ProducerSetupModal
        isOpen={isproducerSetupOpen}
        onClose={() => {
          setIsproducerSetupOpen(false);
          // Refresh the profile data to show updated profile picture
          queryClient.invalidateQueries({ queryKey: ['/api/agent/profile-direct', authState?.user?.email] });
        }}
      />

      {/* Help Modal - Always available */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* AO Precheck Walkthrough Modal - Only on Precheck pages */}
      {isPrecheckPage && (
        <Dialog open={isWalkthroughOpen} onOpenChange={setIsWalkthroughOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">AO Precheck Walkthrough</DialogTitle>
              <DialogDescription>
                Watch this tutorial to learn how to use AO Precheck verification system
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full">
              <iframe
                className="w-full h-full rounded-lg"
                src={'https://www.youtube.com/embed/YOUR_VIDEO_ID'}
                title="AO Precheck Walkthrough"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}