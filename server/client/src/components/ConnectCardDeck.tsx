import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TinderCard } from "@/components/TinderCard";
import { 
  ThumbsUp, 
  ThumbsDown, 
  DollarSign, 
  Phone, 
  Calendar, 
  ArrowLeft,
  ArrowRight,
  Trophy,
  Target,
  Zap,
  Heart,
  X,
  Coins,
  Star
} from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

interface ConnectCardDeckProps {
  agentEmail: string;
  onComplete?: () => void;
}

type ConnectResult = 'interested' | 'not_interested' | 'sale' | 'no_show' | 'reschedule';

export function ConnectCardDeck({ agentEmail, onComplete }: ConnectCardDeckProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [saleAmount, setSaleAmount] = useState('');
  const [showSaleInput, setShowSaleInput] = useState(false);
  const [processedCards, setProcessedCards] = useState<Set<string>>(new Set());
  const [cardDirection, setCardDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);
  const [showExperienceReward, setShowExperienceReward] = useState(false);
  const [earnedExperience, setEarnedExperience] = useState(0);
  const [showCreditReward, setShowCreditReward] = useState(false);
  const [earnedCredits, setEarnedCredits] = useState(0);
  const [undoHistory, setUndoHistory] = useState<string[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch connects that need review directly from WAR connects table
  const { data: connectsData, isLoading, refetch, error } = useQuery({
    queryKey: ['/api/war/connects-for-review', agentEmail],
    queryFn: () => apiRequest('GET', `/api/war/connects-for-review/${agentEmail}`).then(res => res.json()),
    enabled: !!agentEmail,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60000, // 1 minute
  });

  // Fetch agent profile data for celebration overlay
  const { data: agentProfile } = useQuery({
    queryKey: ['/api/auth/profile'],
    enabled: !!agentEmail,
  });

  // Ensure we have an array of connects
  const pendingConnects = Array.isArray(connectsData) ? connectsData : [];
  
  console.log('ConnectCardDeck Debug:');
  console.log('- isLoading:', isLoading);
  console.log('- error:', error);
  console.log('- connectsData length:', Array.isArray(connectsData) ? connectsData.length : 'not array');
  console.log('- pendingConnects length:', pendingConnects.length);

  // Initialize swipe state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('swipedConnects');
      if (saved) {
        const swipedIds = JSON.parse(saved);
        setProcessedCards(new Set(swipedIds));
      }
    } catch (error) {
      console.error('Error loading swipe state:', error);
    }
  }, []);

  // Save swipe state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('swipedConnects', JSON.stringify(Array.from(processedCards)));
    } catch (error) {
      console.error('Error saving swipe state:', error);
    }
  }, [processedCards]);

  // Filter out already processed connects
  const filteredConnects = pendingConnects.filter((connect: any) => {
    const connectId = connect.connectId || connect.connect_id || connect.id;
    const isProcessed = processedCards.has(connectId);
    console.log(`Connect ${connectId} processed: ${isProcessed}`);
    return !isProcessed;
  });
  
  console.log('- filteredConnects length:', filteredConnects.length);
  
  const currentConnect = filteredConnects[currentCardIndex];
  const totalCards = filteredConnects.length;
  const completedCards = processedCards.size;

  // Mutation to award experience
  const awardExperienceMutation = useMutation({
    mutationFn: async (experience: number) => {
      return await apiRequest('POST', '/api/user/award-experience', { experience });
    },
    onSuccess: (data, experience) => {
      setEarnedExperience(experience);
      setShowExperienceReward(true);
      setTimeout(() => setShowExperienceReward(false), 2500);
      
      // Invalidate user experience to refresh the display
      queryClient.invalidateQueries({ queryKey: ['/api/user/experience'] });
      
      toast({
        title: "⚡ Experience Gained!",
        description: `+${experience} XP earned for reviewing connects!`,
        variant: "default",
      });
    }
  });

  // Mutation to update connect result
  const updateConnectMutation = useMutation({
    mutationFn: async (data: {
      connectId: string;
      result: ConnectResult;
      saleAmount?: string;
      nextReviewDate?: string;
    }) => {
      return await apiRequest('POST', '/api/war/connect-review', data);
    },
    onSuccess: (_, variables) => {
      setProcessedCards(prev => new Set([...Array.from(prev), variables.connectId]));
      setUndoHistory(prev => [...prev, variables.connectId]);
      
      // Increment swipe count and award experience
      const newSwipeCount = swipeCount + 1;
      setSwipeCount(newSwipeCount);
      
      // Award 4 experience points for every swipe
      awardExperienceMutation.mutate(4);
      
      const resultMessages = {
        interested: "Great! This connect will appear tomorrow for follow-up.",
        not_interested: "Got it - marked as not interested.",
        sale: `AMAZING SALE! 🎉 AOI AIP +$${variables.saleAmount} recorded! 💰🚀`,
        callback: "Status set to CALLBACK/PENDING - will appear again tomorrow."
      };

      toast({
        title: "Connect Reviewed!",
        description: resultMessages[variables.result],
        variant: variables.result === 'sale' ? 'default' : 'default',
      });

      // If this was a sale with amount, immediately update the AOI AIP tracker and advance
      if (variables.result === 'sale' && variables.saleAmount) {
        queryClient.invalidateQueries({ queryKey: ['/api/war/aoi-aip'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/agent-stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/gamification/stats'] });
        
        // Close sale animation immediately and advance to next card
        setSaleSuccess(false);
        setShowSaleInput(false);
        setSaleAmount('');
        setCardDirection(null);
        
        // Advance to next card after brief delay to allow UI to update
        setTimeout(() => {
          if (currentCardIndex < totalCards - 1) {
            setCurrentCardIndex(prev => prev + 1);
          } else if (completedCards + 1 >= totalCards) {
            // All cards completed
            toast({
              title: "Deck Complete! 🏆",
              description: `You've reviewed all ${totalCards} connects. Great job!`,
            });
            onComplete?.();
          }
        }, 500);
      } else if (variables.result !== 'sale') {
        // For non-sales, advance to next card normally
        if (currentCardIndex < totalCards - 1) {
          setCurrentCardIndex(prev => prev + 1);
        } else if (completedCards + 1 >= totalCards) {
          // All cards completed
          setTimeout(() => {
            toast({
              title: "Deck Complete! 🏆",
              description: `You've reviewed all ${totalCards} connects. Great job!`,
            });
            onComplete?.();
          }, 1000);
        }
        
        setShowSaleInput(false);
        setSaleAmount('');
        setCardDirection(null);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCardDirection(null);
    },
  });

  // Get lead status to determine available actions
  const getLeadStatus = (connect: any) => {
    const connectType = connect.connectType || connect.connect_type;
    const productionStatus = connect.productionStatus || connect.production_status;
    
    // If it's already an appointment
    if (connectType === 'aoi_appointment' || productionStatus === 'confirmed') {
      return 'appointment';
    }
    
    // If it's a callback/pending
    if (connectType === 'callback_scheduled' || productionStatus === 'pending') {
      return 'callback';
    }
    
    // Default to new lead
    return 'new';
  };

  const handleCardAction = (result: ConnectResult) => {
    if (!currentConnect) return;

    if (result === 'sale') {
      // For sale gesture, just show animation and input - don't submit yet
      setSaleSuccess(true);
      setShowSaleInput(true);
      return;
    }

    const leadStatus = getLeadStatus(currentConnect);
    let nextReviewDate = undefined;
    let updatedConnectType = currentConnect.connectType || currentConnect.connect_type;
    let updatedProductionStatus = currentConnect.productionStatus || currentConnect.production_status;

    // Update status based on action and current lead status
    if (result === 'interested') {
      if (leadStatus === 'new' || leadStatus === 'callback') {
        // New lead or callback becomes appointment
        updatedConnectType = 'aoi_appointment';
        updatedProductionStatus = 'confirmed';
        nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
      }
    } else if (result === 'reschedule') {
      // Reschedule keeps as appointment but updates date
      updatedConnectType = 'aoi_appointment';
      updatedProductionStatus = 'confirmed';
      nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
    } else if (result === 'no_show') {
      // No show - mark as completed/no_show
      updatedProductionStatus = 'no_show';
    }

    // Set proper card direction for animation
    const directionMap = {
      'interested': 'right',
      'not_interested': 'left',
      'reschedule': 'right',
      'no_show': 'down'
    };
    setCardDirection(directionMap[result] as 'left' | 'right' | 'down');
    
    updateConnectMutation.mutate({
      connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
      result,
      nextReviewDate,
      connectType: updatedConnectType,
      productionStatus: updatedProductionStatus
    });
  };

  const handleCallbackAction = () => {
    if (!currentConnect) return;

    const leadStatus = getLeadStatus(currentConnect);
    let updatedConnectType = 'callback_scheduled';
    let updatedProductionStatus = 'pending';
    const nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow

    setCardDirection('down');
    
    updateConnectMutation.mutate({
      connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
      result: 'interested', // Keep as interested but mark as callback
      nextReviewDate,
      connectType: updatedConnectType,
      productionStatus: updatedProductionStatus
    });
  };

  const handleSaleSubmit = () => {
    if (!currentConnect || !saleAmount) {
      toast({
        title: "Sale Amount Required",
        description: "Please enter the sale amount (AOI or ALP)",
        variant: "destructive",
      });
      return;
    }

    setCardDirection('right');
    updateConnectMutation.mutate({
      connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
      result: 'sale',
      saleAmount
    });
  };

  const skipCard = () => {
    if (currentCardIndex < totalCards - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const undoLastAction = () => {
    if (undoHistory.length > 0) {
      const lastProcessedId = undoHistory[undoHistory.length - 1];
      
      console.log('🔄 Undoing last action for connect:', lastProcessedId);
      
      // Remove from processed cards FIRST
      setProcessedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(lastProcessedId);
        console.log('🔄 Removed from processed cards:', lastProcessedId);
        return newSet;
      });
      
      // Remove from undo history
      setUndoHistory(prev => prev.slice(0, -1));
      
      // Update localStorage immediately
      try {
        const currentProcessed = Array.from(processedCards);
        const updatedProcessed = currentProcessed.filter(id => id !== lastProcessedId);
        localStorage.setItem('swipedConnects', JSON.stringify(updatedProcessed));
        console.log('🔄 Updated localStorage, removed:', lastProcessedId);
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }
      
      // Find the undone card in the original connects data
      const allConnects = Array.isArray(connectsData) ? connectsData : [];
      const undoneCardIndex = allConnects.findIndex(connect => 
        (connect.connectId || connect.connect_id || connect.id) === lastProcessedId
      );
      
      console.log('🔄 Found undone card at index:', undoneCardIndex, 'for ID:', lastProcessedId);
      
      // Reset current card index to show the undone card
      if (undoneCardIndex !== -1) {
        setCurrentCardIndex(undoneCardIndex);
        console.log('🔄 Set current card index to:', undoneCardIndex);
      } else {
        // If not found, go back one card
        setCurrentCardIndex(prev => Math.max(0, prev - 1));
        console.log('🔄 Card not found, going back one card');
      }
      
      // Reset any active animations
      setCardDirection(null);
      setSaleSuccess(false);
      setShowSaleInput(false);
      setIsDragging(false);
      setSwipeDirection(null);
      
      toast({
        title: "Card Restored! ↩️",
        description: "Last card action has been undone and card is back.",
        variant: "default",
      });
      
      console.log('🔄 Undo completed for connect:', lastProcessedId);
      refetch();
    }
  };

  // Handle Tinder-style swipe gestures with vertical swipe for sale
  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 150;
    const { offset } = info;
    
    setIsDragging(false);
    setSwipeDirection(null);
    
    // Check for vertical swipes first
    if (Math.abs(offset.y) > swipeThreshold && Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y < 0) {
        // Swiped up - show sale animation and input immediately (no submission yet)
        setCardDirection('up');
        setSaleSuccess(true);
        setShowSaleInput(true);
      } else {
        // Swiped down - trigger call back
        setCardDirection('down');
        handleCardAction('callback');
      }
    }
    // Check horizontal swipes
    else if (Math.abs(offset.x) > swipeThreshold) {
      if (offset.x > 0) {
        // Swiped right - appointment
        setCardDirection('right');
        handleCardAction('interested');
      } else {
        // Swiped left - not interested
        setCardDirection('left');
        handleCardAction('not_interested');
      }
    }
    // If not far enough, card snaps back to center (automatic with framer-motion)
  };

  const handleDrag = (event: any, info: PanInfo) => {
    const { offset } = info;
    const threshold = 50;
    
    // Check for vertical swipes first
    if (Math.abs(offset.y) > threshold && Math.abs(offset.y) > Math.abs(offset.x)) {
      setSwipeDirection(offset.y < 0 ? 'up' : 'down');
    }
    // Then check for horizontal swipes
    else if (Math.abs(offset.x) > threshold) {
      setSwipeDirection(offset.x > 0 ? 'right' : 'left');
    } else {
      setSwipeDirection(null);
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
    setSwipeDirection(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (totalCards === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center p-8">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            All Caught Up! 🎉
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No connects to review right now. Make some calls to fill your deck!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Full-Screen Sale Celebration Overlay - Tinder Match Style */}
      <AnimatePresence>
        {saleSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              duration: 0.8,
              type: "spring",
              stiffness: 100,
              damping: 20,
              opacity: { duration: 0.6 }
            }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
          >
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, y: 100 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 2, 0],
                    y: [100, -200],
                    x: [(Math.random() - 0.5) * 400]
                  }}
                  transition={{
                    duration: 3,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatType: "loop"
                  }}
                  className="absolute text-yellow-300 text-4xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `100%`
                  }}
                >
                  💰
                </motion.div>
              ))}
            </div>

            {/* Main Celebration Content - Tinder Style with Profile Cards */}
            <div className="text-center relative z-10 max-w-4xl px-8">
              {/* "It's a Match!" Title */}
              <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: 0.3, 
                  duration: 0.8,
                  type: "spring",
                  stiffness: 120,
                  damping: 15
                }}
                className="mb-8"
              >
                <h1 className="text-white text-7xl font-bold tracking-wider drop-shadow-lg mb-4" style={{
                  fontFamily: "'Dancing Script', cursive, system-ui",
                  textShadow: '0 4px 8px rgba(0,0,0,0.3)'
                }}>
                  It's a Sale!
                </h1>
                <p className="text-yellow-200 text-lg font-medium tracking-wide">
                  You and {currentConnect?.leadName || currentConnect?.lead_name || 'this client'} have connected!
                </p>
              </motion.div>

              {/* Profile Cards Side by Side */}
              <div className="flex justify-center items-center gap-12 mb-8">
                {/* Agent Profile Card */}
                <motion.div
                  initial={{ x: -200, opacity: 0, rotate: -15 }}
                  animate={{ x: 0, opacity: 1, rotate: 0 }}
                  transition={{ 
                    delay: 1.6,
                    duration: 1.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  className="relative"
                >
                  <div className="w-40 h-52 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
                    {/* Agent Photo */}
                    <div className="w-full h-32 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative">
                      {(agentProfile as any)?.profilePicture ? (
                        <img 
                          src={(agentProfile as any).profilePicture} 
                          alt="Agent Profile"
                          className="w-20 h-20 rounded-full object-cover border-2 border-white/50"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">
                            {((agentProfile as any)?.firstName || agentEmail.charAt(0)).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Agent Info */}
                    <div className="p-3 text-center">
                      <h3 className="font-bold text-gray-800 text-sm mb-1 truncate">
                        {(agentProfile as any)?.firstName || agentEmail.split('@')[0]}
                      </h3>
                      <p className="text-xs text-gray-600">AO Intelligence</p>
                      <div className="flex justify-center mt-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Client Profile Card */}
                <motion.div
                  initial={{ x: 200, opacity: 0, rotate: 15 }}
                  animate={{ x: 0, opacity: 1, rotate: 0 }}
                  transition={{ 
                    delay: 1.6,
                    duration: 1.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  className="relative"
                >
                  <div className="w-40 h-52 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
                    {/* Client Photo Placeholder */}
                    <div className="w-full h-32 bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                      <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          {(currentConnect?.leadName || currentConnect?.lead_name || 'C').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {/* Client Info */}
                    <div className="p-3 text-center">
                      <h3 className="font-bold text-gray-800 text-sm mb-1 truncate">
                        {currentConnect?.leadName || currentConnect?.lead_name || 'Client'}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {currentConnect?.state || 'Lead'}
                      </p>
                      <div className="flex justify-center mt-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Sale Input Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.6 }}
                className="text-center"
              >
                <p className="text-yellow-200 text-xl font-medium tracking-wide mb-6">
                  ConnectNow
                </p>
                
                {/* Sale Amount Input */}
                <div className="max-w-sm mx-auto bg-white/90 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
                  <h3 className="text-gray-800 text-lg font-bold mb-4 flex items-center justify-center gap-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    Enter Sale Amount
                  </h3>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      placeholder="AOI/ALP Amount"
                      value={saleAmount}
                      onChange={(e) => setSaleAmount(e.target.value)}
                      className="flex-1 text-lg h-12 border-2 border-green-300 focus:ring-green-500 focus:border-green-500"
                      autoFocus
                    />
                    <Button
                      onClick={() => handleSaleSubmit()}
                      disabled={!saleAmount}
                      className="h-12 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold"
                    >
                      💰 Submit
                    </Button>
                  </div>
                </div>

                <div className="mt-6">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ 
                      delay: 1.2, 
                      duration: 0.5,
                      type: "spring",
                      stiffness: 200,
                      damping: 15
                    }}
                    className="inline-block px-8 py-3 bg-yellow-400 text-blue-900 font-bold rounded-full text-lg shadow-2xl"
                  >
                    Record Your Sale! 🎉
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="max-w-md mx-auto space-y-4">
      {/* Enhanced Progress Bar */}
      <div className="bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700 rounded-full h-4 overflow-hidden shadow-inner border border-gray-300/50 dark:border-gray-600/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(completedCards / totalCards) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 h-full relative"
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
        </motion.div>
      </div>
      
      {/* Enhanced Card Counter */}
      <div className="text-center bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-700/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/50">
        <div className="flex items-center justify-center gap-3 mb-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <Target className="w-5 h-5 text-blue-600" />
          </motion.div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Card {currentCardIndex + 1} of {totalCards}
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-700 dark:text-green-400 font-medium">
              {completedCards} Reviewed
            </span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <span className="text-blue-700 dark:text-blue-400 font-medium">
              {totalCards - completedCards} Remaining
            </span>
          </div>
        </div>
      </div>

      {/* Tinder-Style Card Stack */}
      <div className="relative h-[480px] w-full max-w-xs mx-auto">
        {/* Background Stack Cards */}
        {filteredConnects.slice(currentCardIndex + 1, currentCardIndex + 3).map((connect, index) => (
          <TinderCard
            key={connect.connectId || connect.connect_id || connect.id}
            connect={connect}
            isActive={false}
            stackIndex={index + 1}
            onSwipe={() => {}}
            onSale={() => {}}
            isDragging={false}
            swipeDirection={null}
            onDragStart={() => {}}
            onDrag={() => {}}
            onDragEnd={() => {}}
            showSaleInput={false}
            saleAmount=""
            setSaleAmount={() => {}}
          />
        ))}

        {/* Active Card */}
        <AnimatePresence mode="wait">
          {currentConnect && (
            <TinderCard
              key={currentConnect.connectId || currentConnect.connect_id || currentConnect.id}
              connect={currentConnect}
              isActive={true}
              onSwipe={(direction) => {
                if (direction === 'up') {
                  handleCardAction('sale');
                } else {
                  setCardDirection(direction);
                  handleCardAction(direction === 'right' ? 'interested' : 'not_interested');
                }
              }}
              onSale={handleSaleSubmit}
              isDragging={isDragging}
              swipeDirection={swipeDirection}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              showSaleInput={showSaleInput}
              saleAmount={saleAmount}
              setSaleAmount={setSaleAmount}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Lead Status Indicator */}
      {currentConnect && (
        <div className="text-center mb-4">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            getLeadStatus(currentConnect) === 'new' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
              : getLeadStatus(currentConnect) === 'appointment'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
          }`}>
            {getLeadStatus(currentConnect) === 'new' && (
              <>
                <Target className="w-4 h-4" />
                New Lead - Set Appointment or Schedule Callback
              </>
            )}
            {getLeadStatus(currentConnect) === 'appointment' && (
              <>
                <Calendar className="w-4 h-4" />
                Existing Appointment - Record Sale or Update Status
              </>
            )}
            {getLeadStatus(currentConnect) === 'callback' && (
              <>
                <Phone className="w-4 h-4" />
                Callback Scheduled - Set Appointment or Schedule Another Call
              </>
            )}
          </div>
        </div>
      )}

      {/* Advanced Lead Lifecycle Action Buttons */}
      {(() => {
        if (!currentConnect) return null;
        
        const leadStatus = getLeadStatus(currentConnect);
        
        // NEW LEADS: Appointment, Not Interested, Call Back
        if (leadStatus === 'new') {
          return (
            <>
              <div className="flex justify-center items-center gap-6 mt-8">
                {/* Not Interested */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('not_interested')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-red-400 via-red-500 to-red-600 hover:from-red-500 hover:via-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-300/50 relative group"
                  >
                    <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* Call Back */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCallbackAction()}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-yellow-400 via-orange-500 to-orange-600 hover:from-yellow-500 hover:via-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl border-2 border-yellow-300/50 relative group"
                  >
                    <Phone className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* Appointment */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('interested')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 hover:from-green-500 hover:via-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl border-2 border-green-300/50 relative group"
                  >
                    <Calendar className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
              </div>
              
              <div className="flex justify-center items-center gap-6 mt-4">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium w-14 text-center">Not Int.</span>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium w-14 text-center">Call Back</span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium w-14 text-center">Appointment</span>
              </div>
            </>
          );
        }
        
        // EXISTING APPOINTMENTS: Sale, No Show, Not Interested, Reschedule
        if (leadStatus === 'appointment') {
          return (
            <>
              <div className="flex justify-center items-center gap-6 mt-8">
                {/* Not Interested */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('not_interested')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-red-400 via-red-500 to-red-600 hover:from-red-500 hover:via-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-300/50 relative group"
                  >
                    <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* No Show */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('no_show')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 hover:from-gray-500 hover:via-gray-600 hover:to-gray-700 text-white shadow-lg hover:shadow-xl border-2 border-gray-300/50 relative group"
                  >
                    <ThumbsDown className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* Sale - Larger and Central */}
                <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    onClick={() => handleCardAction('sale')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-20 h-20 bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 hover:from-blue-500 hover:via-purple-600 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl border-2 border-blue-300/50 relative group"
                  >
                    <DollarSign className="w-9 h-9 group-hover:rotate-12 transition-transform duration-200" />
                    <div className="absolute inset-0 rounded-full bg-blue-300 opacity-20 animate-ping group-hover:opacity-30"></div>
                  </Button>
                </motion.div>
                
                {/* Reschedule */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('reschedule')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 hover:from-purple-500 hover:via-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border-2 border-purple-300/50 relative group"
                  >
                    <Calendar className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
              </div>
              
              <div className="flex justify-center items-center gap-6 mt-4">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium w-14 text-center">Not Int.</span>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium w-14 text-center">No Show</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold w-20 text-center">SALE! 💰</span>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium w-14 text-center">Reschedule</span>
              </div>
            </>
          );
        }
        
        // CALLBACKS: Appointment, Not Interested, Call Back Again
        if (leadStatus === 'callback') {
          return (
            <>
              <div className="flex justify-center items-center gap-6 mt-8">
                {/* Not Interested */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('not_interested')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-red-400 via-red-500 to-red-600 hover:from-red-500 hover:via-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-300/50 relative group"
                  >
                    <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* Call Back Again */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCallbackAction()}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-yellow-400 via-orange-500 to-orange-600 hover:from-yellow-500 hover:via-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl border-2 border-yellow-300/50 relative group"
                  >
                    <Phone className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* Appointment */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('interested')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-14 h-14 bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 hover:from-green-500 hover:via-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl border-2 border-green-300/50 relative group"
                  >
                    <Calendar className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
              </div>
              
              <div className="flex justify-center items-center gap-6 mt-4">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium w-14 text-center">Not Int.</span>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium w-14 text-center">Call Back</span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium w-14 text-center">Appointment</span>
              </div>
            </>
          );
        }
        
        return null;
      })()}



      {/* Experience Progress Tracker */}
      <div className="flex items-center justify-center gap-3 mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <Zap className="w-5 h-5 text-purple-600" />
        <div className="text-sm font-medium text-purple-800 dark:text-purple-300">
          {swipeCount > 0 ? `+${swipeCount * 4} XP this session` : 'Start swiping to earn XP!'}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(swipeCount, 10) }).map((_, i) => (
            <Star
              key={i}
              className="w-3 h-3 text-purple-500 fill-purple-400 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Enhanced Swipe Instructions */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 mt-6 border border-blue-200/50 dark:border-blue-700/50">
        <h4 className="text-sm font-bold text-center text-gray-900 dark:text-white mb-3 flex items-center justify-center gap-2">
          <motion.div
            animate={{ y: [-2, 2, -2] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            👆
          </motion.div>
          Swipe or Tap to Review
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-700 dark:text-red-400 font-medium">← Not Interested</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-700 dark:text-green-400 font-medium">Appointment →</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-yellow-700 dark:text-yellow-400 font-bold">↑ SALE! 💰</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-orange-700 dark:text-orange-400 font-medium">↓ Call Back</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={previousCard}
          disabled={currentCardIndex === 0}
          className="flex items-center gap-2 text-gray-500"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>
        
        {/* Undo Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={undoLastAction}
          disabled={undoHistory.length === 0}
          className="flex items-center gap-2 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <motion.div
            animate={{ rotate: undoHistory.length > 0 ? [0, -15, 0] : 0 }}
            transition={{ duration: 0.5, repeat: undoHistory.length > 0 ? Infinity : 0, repeatDelay: 2 }}
          >
            ↩️
          </motion.div>
          UNDO ({undoHistory.length})
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={skipCard}
          disabled={currentCardIndex >= totalCards - 1}
          className="flex items-center gap-2 text-gray-500"
        >
          Skip
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>

    {/* Experience Reward Celebration Overlay */}
    <AnimatePresence>
      {showExperienceReward && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ 
            type: "spring", 
            duration: 0.4,
            bounce: 0.3
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center"
          >
            {/* Experience Lightning Bolt */}
            <motion.div
              animate={{ 
                scale: [1, 1.3, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                scale: { duration: 0.5, repeat: 2, repeatType: "reverse" },
                rotate: { duration: 0.3, repeat: 3, repeatType: "reverse" }
              }}
              className="mb-4"
            >
              <div className="relative">
                <Zap className="w-16 h-16 text-purple-400 mx-auto drop-shadow-2xl fill-purple-300" />
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
                  className="absolute inset-0 w-16 h-16 bg-purple-400/30 rounded-full blur-lg mx-auto"
                />
              </div>
            </motion.div>

            {/* Experience Stars */}
            <motion.div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: 0 }}
                  animate={{ 
                    scale: [0, 1.2, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{
                    delay: i * 0.1,
                    duration: 0.6,
                    ease: "backOut"
                  }}
                >
                  <Star className="w-4 h-4 text-purple-400 fill-purple-300" />
                </motion.div>
              ))}
            </motion.div>

            {/* Experience Gained Text */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
              className="space-y-2"
            >
              <h1 className="text-3xl font-bold text-white mb-2">
                EXPERIENCE GAINED!
              </h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-purple-300 text-lg font-medium"
              >
                +{earnedExperience} XP
              </motion.p>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-sm text-gray-300"
              >
                Keep swiping to level up!
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Credit Reward Celebration Overlay */}
    <AnimatePresence>
      {showCreditReward && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ 
            type: "spring", 
            duration: 0.4,
            bounce: 0.3
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center relative"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", bounce: 0.6 }}
              className="bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent"
            >
              <h1 className="text-6xl font-bold mb-2">+{earnedCredits}</h1>
              <p className="text-2xl font-semibold text-white mb-1">CREDIT{earnedCredits > 1 ? 'S' : ''} EARNED!</p>
            </motion.div>

            {/* Animated Stars */}
            <motion.div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                </motion.div>
              ))}
            </motion.div>

            {/* Celebration Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-white/90 text-lg mt-4 font-medium"
            >
              Keep reviewing connects to earn more rewards!
            </motion.p>

            {/* Floating Money Emojis */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  opacity: 0, 
                  scale: 0,
                  x: 0,
                  y: 0 
                }}
                animate={{ 
                  opacity: [0, 1, 0], 
                  scale: [0, 1, 0],
                  x: (Math.random() - 0.5) * 400,
                  y: (Math.random() - 0.5) * 400,
                  rotate: Math.random() * 360
                }}
                transition={{ 
                  duration: 2,
                  delay: Math.random() * 0.5,
                  ease: "easeOut"
                }}
                className="absolute text-4xl"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                💰
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}