import React, { useState, useEffect } from 'react';
import { MdStars } from 'react-icons/md';
import { FaTrophy } from 'react-icons/fa';
import { Volume2, LogOut, User, Settings, Calendar, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { AgentProfile } from '@/components/agent/agent-profile';
import { useQueryClient } from '@tanstack/react-query';

// Import coin images
import coin1 from '@assets/coins_yellow_1_1753634547849.png';
import coin2 from '@assets/coins_yellow_2_1753634547849.png';
import coin3 from '@assets/coins_yellow_3_1753634547849.png';
import coin4 from '@assets/coins_yellow_4_1753634547848.png';
import coin5 from '@assets/coins_yellow_5_1753634547848.png';
import coin6 from '@assets/coins_yellow_6_1753634547848.png';

interface HeaderToolbarProps {
  userId: string;
  onToggle: () => void;
}

export function HeaderToolbar({ userId, onToggle }: HeaderToolbarProps) {
  const [isAudioSetupOpen, setIsAudioSetupOpen] = useState(false);
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [isCreditPurchaseOpen, setIsCreditPurchaseOpen] = useState(false);
  const [isAOICardsOpen, setIsAOICardsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [aoiAipAmount, setAoiAipAmount] = useState(0);
  const { authState, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: gameStats } = useQuery({
    queryKey: ['/api/gamification/stats', userId],
    enabled: !!userId,
  });

  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits'],
    enabled: !!userId,
  });

  // Fetch AOI AIP data for the agent
  const { data: aoiAipData } = useQuery({
    queryKey: ['/api/war/aoi-aip', authState?.user?.email],
    queryFn: () => fetch(`/api/war/aoi-aip/${authState?.user?.email}`).then(res => res.json()),
    enabled: !!authState?.user?.email,
    refetchInterval: 10000, // Refresh every 10 seconds to catch new sales
  });

  // Fetch AOI Cards count (connects for review)
  const { data: aoiCardsData } = useQuery({
    queryKey: ['/api/war/connects-for-review', authState?.user?.email],
    queryFn: () => fetch(`/api/war/connects-for-review/${authState?.user?.email}`).then(res => res.json()),
    enabled: !!authState?.user?.email,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Update AOI AIP amount when data changes (animation removed)
  useEffect(() => {
    if (aoiAipData?.totalAoiAip) {
      setAoiAipAmount(aoiAipData.totalAoiAip);
    }
  }, [aoiAipData]);

  // Function to get the appropriate coin image based on credits
  const getCoinImage = (credits: number) => {
    if (credits < 15) return coin1;
    if (credits < 30) return coin2;
    if (credits < 50) return coin3;
    if (credits < 75) return coin4;
    if (credits < 100) return coin5;
    return coin6;
  };

  const credits = (creditsData as any)?.credits_remaining || 0;

  const handleCreditsAdded = () => {
    // Refresh credit data after successful purchase
    queryClient.invalidateQueries({ queryKey: ['/api/user/credits'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/agent-stats'] });
    setIsCreditPurchaseOpen(false);
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b px-6 py-3">
      <div className="flex justify-end items-center space-x-4">
        {/* Calendar and Credits Display */}
        <div className="flex items-center space-x-3">
          {/* Calendar Button */}
          <Button
            variant="outline"
            onClick={() => setIsSchedulingOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white border-none hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 flex items-center space-x-2"
            title="Scheduling Suite"
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Calendar</span>
          </Button>

          {/* AOI Cards Notification */}
          <div className="relative">
            <Button
              onClick={() => setIsAOICardsOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 hover:from-blue-600 hover:via-purple-700 hover:to-indigo-700 px-4 py-2 rounded-lg shadow-lg text-white border-none"
              title="AOI Cards - Review Connects"
            >
              <TrendingUp className="h-5 w-5" />
              <div>
                <div className="text-xs font-medium opacity-90">AOI Cards</div>
                <div className="text-sm font-bold">
                  {Array.isArray(aoiCardsData) ? aoiCardsData.length : 0} to review
                </div>
              </div>
            </Button>
            {/* Red Notification Badge */}
            {Array.isArray(aoiCardsData) && aoiCardsData.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse shadow-lg border-2 border-white">
                {aoiCardsData.length}
              </div>
            )}
          </div>

          {/* AOI AIP Tracker */}
          <div className="relative">
            <div className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 rounded-lg shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
              <div className="text-white">
                <div className="text-xs font-medium opacity-90">AOI ALP</div>
                <div className="text-lg font-bold bg-gradient-to-r from-yellow-200 to-yellow-400 bg-clip-text text-transparent">
                  ${(aoiAipAmount || 0).toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Sale Animation - REMOVED per user request */}
          </div>

          {/* Credits Display */}
          <div className="flex items-center space-x-2">
            <img 
              src={getCoinImage(credits)} 
              alt="Credits" 
              className="w-5 h-5 object-contain"
            />
            <span className="text-black dark:text-white font-medium">
              {credits.toLocaleString()} credits
            </span>

            {/* Buy Credits Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreditPurchaseOpen(true)}
              className="px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white border-none hover:from-green-700 hover:to-green-800"
              title="Purchase Credits"
            >
              + Buy
            </Button>
          </div>
        </div>

          {/* XP Display */}
          <div className="flex items-center space-x-2">
            <MdStars className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-medium">
              {(gameStats as any)?.xp?.toLocaleString() || 0} XP
            </span>
          </div>

          {/* Level Display */}
          <div className="flex items-center space-x-2">
            <FaTrophy className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium">
              Level {(gameStats as any)?.level || 1}
            </span>
          </div>

          {/* Audio Setup */}
          <Button
            variant="outline"  
            size="sm"
            onClick={() => setIsAudioSetupOpen(true)}
            className="p-2"
            title="Audio Setup"
          >
            <Volume2 className="w-5 h-5" />
          </Button>

          {/* Gamification Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="p-2"
            title="Open Gamification Panel"
          >
            <MdStars className="w-5 h-5" />
          </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={authState.user?.email || 'User'} />
                <AvatarFallback className="bg-primary/10">
                  {authState.profile?.firstName?.charAt(0) || authState.user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {authState.profile?.firstName} {authState.profile?.lastName}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {authState.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
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
        remainingCount={Array.isArray(aoiCardsData) ? aoiCardsData.length : 0}
      />

      {isProfileOpen && (
        <AgentProfile onClose={() => setIsProfileOpen(false)} />
      )}
    </div>
  );
}