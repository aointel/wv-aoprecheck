import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TinderCard } from "@/components/TinderCard";
import { 
  ThumbsDown, 
  DollarSign, 
  Phone, 
  Calendar, 
  ArrowLeft,
  Trophy,
  Target,
  Zap,
  X,
  Star,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
// Placeholder crystal image
const crystalBlue3 = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=100&h=100&fit=crop';

// US Timezones for appointment scheduling
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

// Time slots for appointment scheduling (HH:mm format)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

// Format time slot for display (HH:mm -> AM/PM)
const formatTimeSlot = (time: string) => {
  const [hour, minute] = time.split(':');
  const tempDate = new Date();
  tempDate.setHours(parseInt(hour), parseInt(minute));
  return tempDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

interface ConnectCardDeckProps {
  agentEmail: string;
  onComplete?: () => void;
}

type ConnectResult = 'interested' | 'not_interested' | 'sale' | 'callback' | 'pending' | 'aoi_intelligence' | 'call_connector_pro' | 'standard' | 'reschedule' | 'no_show';

export function ConnectCardDeck({ agentEmail, onComplete }: ConnectCardDeckProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [saleAmount, setSaleAmount] = useState('');
  const [showSaleInput, setShowSaleInput] = useState(false);
  const [showAppointmentPicker, setShowAppointmentPicker] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentTimezone, setAppointmentTimezone] = useState('America/New_York');
  const [showAppointmentResult, setShowAppointmentResult] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
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
  const [undoHistory, setUndoHistory] = useState<Array<{ connectId: string; result: ConnectResult }>>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch producer profile for profile picture
  const { data: producerProfile } = useQuery({
    queryKey: ['/api/agent/profile-direct', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return null;
      try {
        const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(agentEmail)}`);
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
    },
    enabled: !!agentEmail
  });

  // Fetch confirmed sales from SEPARATE endpoint
  const { data: confirmedSalesData, isLoading: isLoadingSales, error: salesError, refetch: refetchSales } = useQuery({
    queryKey: ['/api/war/confirmed-sales-for-review', agentEmail],
    queryFn: async () => {
      console.log('💰 Fetching confirmed sales for:', agentEmail);
      const response = await apiRequest('GET', `/api/war/confirmed-sales-for-review?agentEmail=${encodeURIComponent(agentEmail)}`);
      const data = await response.json();
      console.log('💰 Confirmed Sales API Response:', {
        dataType: typeof data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : null
      });
      if (Array.isArray(data)) {
        console.log(`✅ Returning ${data.length} confirmed sales`);
        return data;
      }
      console.warn('⚠️ Unexpected confirmed sales response format:', data);
      return [];
    },
    enabled: !!agentEmail,
    refetchInterval: 30000,
  });

  // Fetch regular connects from database
  const { data: connectsData, isLoading: isLoadingConnects, error: connectsError, refetch: refetchConnects } = useQuery({
    queryKey: ['/api/war/connects-for-review', agentEmail],
    queryFn: async () => {
      console.log('🔍 Fetching regular connects for:', agentEmail);
      const response = await apiRequest('GET', `/api/war/connects-for-review?agentEmail=${encodeURIComponent(agentEmail)}`);
      const data = await response.json();
      console.log('🔍 Regular Connects API Response:', {
        dataType: typeof data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : null
      });
      if (Array.isArray(data)) {
        console.log(`✅ Returning ${data.length} regular connects`);
        return data;
      }
      if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          console.log(`✅ Returning ${data.data.length} connects from data.data`);
          return data.data;
        }
        if (Array.isArray(data.connects)) {
          console.log(`✅ Returning ${data.connects.length} connects from data.connects`);
          return data.connects;
        }
        if (Array.isArray(data.results)) {
          console.log(`✅ Returning ${data.results.length} connects from data.results`);
          return data.results;
        }
      }
      console.warn('⚠️ Unexpected response format:', data);
      return [];
    },
    enabled: !!agentEmail,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Combine loading states
  const isLoading = isLoadingSales || isLoadingConnects;
  const error = salesError || connectsError;
  
  // Refetch function that refetches both
  const refetch = () => {
    refetchSales();
    refetchConnects();
  };
  
  // Refetch connects when demo cards are added
  useEffect(() => {
    const handleStorageChange = () => {
      refetch();
    };
    window.addEventListener('demoCardsAdded', handleStorageChange);
    return () => window.removeEventListener('demoCardsAdded', handleStorageChange);
  }, [refetch]);

  // Fetch availability from master_schedule when date/timezone changes
  const { data: availabilityData, isLoading: isLoadingAvailability } = useQuery({
    queryKey: ['/api/schedule/availability', agentEmail, appointmentDate, appointmentTimezone],
    queryFn: async () => {
      if (!appointmentDate || !agentEmail) return [];
      const params = new URLSearchParams({
        agentEmail,
        date: appointmentDate,
        timezone: appointmentTimezone
      });
      const response = await fetch(`/api/schedule/availability?${params}`);
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!appointmentDate && !!agentEmail && showAppointmentPicker
  });

  // Calculate available slots
  const bookedTimes = (availabilityData || []).map((s: any) => s.time);
  const availableSlots = TIME_SLOTS.filter(slot => !bookedTimes.includes(slot));
  
  // Auto-select first available slot if current selection is unavailable
  useEffect(() => {
    if (showAppointmentPicker && appointmentDate && availableSlots.length > 0) {
      if (!appointmentTime || !availableSlots.includes(appointmentTime)) {
        setAppointmentTime(availableSlots[0]);
      }
    }
  }, [showAppointmentPicker, appointmentDate, availableSlots, appointmentTime]);

  // Confirmed sales come from SEPARATE endpoint - no filtering needed
  const confirmedSales = Array.isArray(confirmedSalesData) ? confirmedSalesData : [];
  
  // Regular connects come from SEPARATE endpoint - no filtering needed
  const regularConnects = Array.isArray(connectsData) ? connectsData : [];
  
  // Combined for logging
  const pendingConnections = [...confirmedSales, ...regularConnects];
  
  console.log('ConnectCardDeck:', {
    isLoading,
    error,
    connectsDataType: typeof connectsData,
    isArray: Array.isArray(connectsData),
    totalLength: pendingConnections.length,
    confirmedSalesCount: confirmedSales.length,
    regularConnectsCount: regularConnects.length,
    agentEmail
  });

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

  // Filter out already processed - SEPARATE for confirmed sales and regular connects
  const filteredConfirmedSales = confirmedSales.filter((connect: any) => {
    const connectId = connect.connectId || connect.connect_id || connect.id;
    return !processedCards.has(connectId);
  });
  
  const filteredRegularConnects = regularConnects.filter((connect: any) => {
    const connectId = connect.connectId || connect.connect_id || connect.id;
    return !processedCards.has(connectId);
  });
  
  // COMBINE: Confirmed Sales FIRST, then Regular Connects
  const sortedConnects = [...filteredConfirmedSales, ...filteredRegularConnects];
  
  console.log('📊 Filter results:', {
    totalConnects: pendingConnections.length,
    confirmedSalesCount: confirmedSales.length,
    regularConnectsCount: regularConnects.length,
    filteredConfirmedSalesCount: filteredConfirmedSales.length,
    filteredRegularConnectsCount: filteredRegularConnects.length,
    sortedConnectsCount: sortedConnects.length,
    processedCount: processedCards.size,
    processedIds: Array.from(processedCards)
  });
  
  const currentConnect = sortedConnects[currentCardIndex];
  const totalCards = sortedConnects.length;
  const completedCards = processedCards.size;
  
  // Check if current appointment has passed and needs result
  const appointmentDateValue = currentConnect?.appointmentDate || currentConnect?.appointment_date;
  const isAppointmentPassed = appointmentDateValue && new Date(appointmentDateValue) < new Date() && 
                              currentConnect?.disposition !== 'Sale' && 
                              currentConnect?.disposition !== 'No Sale' &&
                              currentConnect?.disposition !== 'Rescheduled' &&
                              currentConnect?.disposition !== 'Refused Presentation' &&
                              currentConnect?.disposition !== 'No Show' &&
                              currentConnect?.disposition !== 'Not interested';
  
  // Reset card index if it's out of bounds (e.g., after filtering)
  useEffect(() => {
    if (currentCardIndex >= totalCards && totalCards > 0) {
      setCurrentCardIndex(0);
    }
  }, [currentCardIndex, totalCards]);
  
  // Debug: Log current card details
  if (currentConnect) {
    const id1 = String(currentConnect?.connectId || '');
    const id2 = String(currentConnect?.connect_id || '');
    const id3 = String(currentConnect?.id || '');
    const source = String(currentConnect?.cardSource || '');
    const isConfirmedSale = source === 'submitted_applications' || 
                            id1.includes('submitted_app') ||
                            id2.includes('submitted_app') ||
                            id3.includes('submitted_app');
    console.log('🎴 Current Card:', {
      connectId: id1,
      connect_id: id2,
      id: id3,
      cardSource: source,
      isConfirmedSale,
      leadName: currentConnect?.lead_name || currentConnect?.leadName
    });
  }

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
      appointmentDate?: string;
      appointmentTimezone?: string;
      connectType?: string;
      productionStatus?: string;
      appointmentSet?: boolean;
      disposition?: string;
    }) => {
      return await apiRequest('POST', '/api/war/connect-review', data);
    },
    onSuccess: (_, variables) => {
      setProcessedCards(prev => new Set([...Array.from(prev), variables.connectId]));
      setUndoHistory(prev => [...prev, { connectId: variables.connectId, result: variables.result }]);
      
      // Increment swipe count and award experience
      const newSwipeCount = swipeCount + 1;
      setSwipeCount(newSwipeCount);
      
      // Award 4 experience points for every swipe
      awardExperienceMutation.mutate(4);
      
      const resultMessages = {
        interested: "Great! This connect will appear tomorrow for follow-up.",
        not_interested: "Got it - marked as not interested.",
        sale: `AMAZING SALE! 🎉 AOI AIP +$${variables.saleAmount} recorded! 🚀`,
        callback: "Status set to CALLBACK/PENDING - will appear again tomorrow.",
        aoi_intelligence: "✅ Confirmed as AO: Intelligence sale!",
        call_connector_pro: "✅ Confirmed as Call Connector Pro sale!",
        standard: "✅ Confirmed as Standard sale!"
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
      } else {
        // For all non-sale results (including confirmed sales), advance to next card
        // Advance to next card after brief delay
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

    // Handle confirmed sale types - these go directly to the API
    if (result === 'aoi_intelligence' || result === 'call_connector_pro' || result === 'standard') {
      setCardDirection('right'); // Animate right for confirmation
      updateConnectMutation.mutate({
        connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
        result,
      });
      return;
    }

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
        // Show appointment date/time picker instead of immediately submitting
        setShowAppointmentPicker(true);
        return; // Don't submit yet, wait for date/time
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

  const handlePendingAction = () => {
    if (!currentConnect) return;

    // Set as pending for follow-up (no specific date required)
    let updatedConnectType = 'pending_followup';
    let updatedProductionStatus = 'pending';

    setCardDirection('down');
    
    updateConnectMutation.mutate({
      connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
      result: 'callback', // Set as callback status
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

  const handleAppointmentSubmit = () => {
    if (!currentConnect || !appointmentDate || !appointmentTime) {
      toast({
        title: "Date and Time Required",
        description: "Please select both date and time for the appointment",
        variant: "destructive",
      });
      return;
    }

    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    if (appointmentDateTime < new Date()) {
      toast({
        title: "Invalid Date/Time",
        description: "Appointment must be in the future",
        variant: "destructive",
      });
      return;
    }

    const leadStatus = getLeadStatus(currentConnect);
    let updatedConnectType = 'aoi_appointment';
    let updatedProductionStatus = 'confirmed';
    
    // Determine if this is a reschedule or new appointment
    const resultType = isRescheduling ? 'reschedule' : 'interested';

    setCardDirection('right');
    updateConnectMutation.mutate({
      connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
      result: resultType,
      appointmentDate: appointmentDateTime.toISOString(),
      appointmentTimezone: appointmentTimezone,
      connectType: updatedConnectType,
      productionStatus: updatedProductionStatus,
      appointmentSet: true,
      disposition: isRescheduling ? 'Rescheduled' : undefined
    });

    setShowAppointmentPicker(false);
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentTimezone('America/New_York');
    setIsRescheduling(false);
  };

  const handleAppointmentResult = (result: 'sale' | 'no_sale' | 'reschedule' | 'refused_presentation') => {
    if (!currentConnect) return;

    // Map result to card direction and API values
    const directionMap = {
      'sale': 'right',
      'no_sale': 'left',
      'reschedule': 'right',
      'refused_presentation': 'left'
    };
    
    const resultMap = {
      'sale': 'sale',
      'no_sale': 'not_interested',
      'reschedule': 'reschedule',
      'refused_presentation': 'not_interested'
    };
    
    const dispositionMap = {
      'sale': 'Sale',
      'no_sale': 'No Sale',
      'reschedule': 'Rescheduled',
      'refused_presentation': 'Refused Presentation'
    };

    setCardDirection(directionMap[result] as 'left' | 'right');
    
    // For sale, show the sale input modal (like regular connects)
    if (result === 'sale') {
      setSaleSuccess(true);
      setShowSaleInput(true);
      return;
    }
    
    // For reschedule, we need to show the appointment picker again
    if (result === 'reschedule') {
      setIsRescheduling(true);
      setShowAppointmentPicker(true);
      return;
    }
    
    // For no_sale and refused_presentation, submit directly
    updateConnectMutation.mutate({
      connectId: currentConnect.connectId || currentConnect.connect_id || currentConnect.id,
      result: resultMap[result] as ConnectResult,
      disposition: dispositionMap[result]
    });
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
      
      // Find the undone card in the sorted connects data
      const allConnects = sortedConnects;
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
      queryClient.invalidateQueries({ queryKey: ['/api/war/connects-for-review', agentEmail] });
      queryClient.invalidateQueries({ queryKey: ['/api/war/confirmed-sales-for-review', agentEmail] });
    }
  };

  // Handle Tinder-style swipe gestures with vertical swipe for sale
  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 150;
    const { offset } = info;
    
    setIsDragging(false);
    setSwipeDirection(null);
    
    // Check if this is a confirmed sale card
    const isConfirmedSaleCard = currentConnect?.cardSource === 'submitted_applications' || 
                                currentConnect?.connectId?.startsWith('submitted_app_') ||
                                currentConnect?.connect_id?.startsWith('submitted_app_') ||
                                currentConnect?.id?.startsWith('submitted_app_');
    
    if (isConfirmedSaleCard) {
      // Confirmed Sale swipe gestures:
      // Up = Standard, Right = Call Connector Pro, Left = AO Intelligence
      if (Math.abs(offset.y) > swipeThreshold && Math.abs(offset.y) > Math.abs(offset.x)) {
        if (offset.y < 0) {
          // Swiped up - Standard
          setCardDirection('up');
          handleCardAction('standard');
        }
        // Down swipe does nothing for confirmed sales
      }
      // Check horizontal swipes
      else if (Math.abs(offset.x) > swipeThreshold) {
        if (offset.x > 0) {
          // Swiped right - Call Connector Pro
          setCardDirection('right');
          handleCardAction('call_connector_pro');
        } else {
          // Swiped left - AO Intelligence
          setCardDirection('left');
          handleCardAction('aoi_intelligence');
        }
      }
      return;
    }
    
    // Regular connect cards - original logic
    // Check for vertical swipes first
    if (Math.abs(offset.y) > swipeThreshold && Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y < 0) {
        // Swiped up - show sale animation and input immediately (no submission yet)
        setCardDirection('up');
        setSaleSuccess(true);
        setShowSaleInput(true);
      } else {
        // Swiped down - set as pending for follow-up
        setCardDirection('down');
        handlePendingAction();
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
    
    // Check if this is a confirmed sale card
    const isConfirmedSaleCard = currentConnect?.cardSource === 'submitted_applications' || 
                                currentConnect?.connectId?.startsWith('submitted_app_') ||
                                currentConnect?.connect_id?.startsWith('submitted_app_') ||
                                currentConnect?.id?.startsWith('submitted_app_');
    
    if (isConfirmedSaleCard) {
      // For confirmed sales: show direction hints
      if (Math.abs(offset.y) > threshold && Math.abs(offset.y) > Math.abs(offset.x)) {
        setSwipeDirection(offset.y < 0 ? 'up' : null); // Only up matters for confirmed sales
      }
      // Check horizontal swipes
      else if (Math.abs(offset.x) > threshold) {
        setSwipeDirection(offset.x > 0 ? 'right' : 'left');
      } else {
        setSwipeDirection(null);
      }
      return;
    }
    
    // Regular connect cards - original logic
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
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading connects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Error Loading Connects
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : 'Failed to load connects for review'}
          </p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/war/connects-for-review', agentEmail] })}>
            Retry
          </Button>
        </CardContent>
      </Card>
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
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `100%`
                  }}
                >
                  <img 
                    src={crystalBlue3} 
                    alt="Sale" 
                    className="w-8 h-8 object-contain"
                  />
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
                {/* Producer Profile Card */}
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
                    {/* producer Photo */}
                    <div className="w-full h-32 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative">
                      {false ? (
                        <img 
                          src="" 
                          alt="Producer Profile"
                          className="w-20 h-20 rounded-full object-cover border-2 border-white/50"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">
                            {agentEmail.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Producer Info */}
                    <div className="p-3 text-center">
                      <h3 className="font-bold text-gray-800 text-sm mb-1 truncate">
                        {(producerProfile as any)?.firstName || agentEmail.split('@')[0]}
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
                      <img 
                    src={crystalBlue3} 
                    alt="Submit" 
                    className="w-5 h-5 object-contain mr-2"
                  />
                  Submit
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

    <div className="max-w-md mx-auto space-y-3">
      {/* Streamlined Progress & Counter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm px-1">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {currentCardIndex + 1} / {totalCards}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completedCards} reviewed
          </span>
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(completedCards / totalCards) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-full"
          />
        </div>
      </div>

      {/* Tinder-Style Card Stack */}
      <div className="relative h-[480px] w-full max-w-xs mx-auto">
        {/* Background Stack Cards */}
        {sortedConnects.slice(currentCardIndex + 1, currentCardIndex + 3).map((connect, index) => (
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

      {/* Compact Lead Status Indicator */}
      {currentConnect && (
        <div className="text-center">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            getLeadStatus(currentConnect) === 'new' 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
              : getLeadStatus(currentConnect) === 'appointment'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
          }`}>
            {getLeadStatus(currentConnect) === 'new' && (
              <>
                <Target className="w-3 h-3" />
                New Lead
              </>
            )}
            {getLeadStatus(currentConnect) === 'appointment' && (
              <>
                <Calendar className="w-3 h-3" />
                Appointment
              </>
            )}
            {getLeadStatus(currentConnect) === 'callback' && (
              <>
                <Phone className="w-3 h-3" />
                Callback
              </>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMED SALE BUTTONS - SEPARATE COMPONENT */}
      {currentConnect && (() => {
        const id1 = String(currentConnect?.connectId || '');
        const id2 = String(currentConnect?.connect_id || '');
        const id3 = String(currentConnect?.id || '');
        const source = String(currentConnect?.cardSource || '');
        const isConfirmedSale = source === 'submitted_applications' || 
                               id1.includes('submitted_app') ||
                               id2.includes('submitted_app') ||
                               id3.includes('submitted_app');
        
        console.log('🔍 Button Check - Confirmed Sale:', {
          isConfirmedSale,
          source,
          id1,
          id2,
          id3,
          willShowSaleButtons: isConfirmedSale
        });
        
        if (isConfirmedSale) {
          return (
            <>
              <div className="flex justify-center items-center gap-4 mt-4">
                {/* Standard */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('standard')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-16 h-16 bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700 hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 text-white shadow-lg hover:shadow-xl border-2 border-gray-400/50 relative group"
                  >
                    <span className="text-xs font-bold">STD</span>
                  </Button>
                </motion.div>
                
                {/* Call Connector Pro */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => handleCardAction('call_connector_pro')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-16 h-16 bg-gradient-to-br from-green-500 via-emerald-600 to-green-700 hover:from-green-600 hover:via-emerald-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl border-2 border-green-400/50 relative group"
                  >
                    <Phone className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  </Button>
                </motion.div>
                
                {/* AO Intelligence - Larger and Central */}
                <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    onClick={() => handleCardAction('aoi_intelligence')}
                    disabled={updateConnectMutation.isPending}
                    size="lg"
                    className="rounded-full w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-700 hover:from-blue-600 hover:via-purple-700 hover:to-indigo-800 text-white shadow-xl hover:shadow-2xl border-2 border-blue-400/50 relative group"
                  >
                    <Target className="w-8 h-8 group-hover:rotate-12 transition-transform duration-200" />
                    <div className="absolute inset-0 rounded-full bg-blue-300 opacity-20 animate-ping group-hover:opacity-30"></div>
                  </Button>
                </motion.div>
              </div>
              
              <div className="flex justify-center items-center gap-4 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-16 text-center">Standard</span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium w-16 text-center">CC Pro</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold w-20 text-center">AO Intel</span>
              </div>
            </>
          );
        }
        return null;
      })()}

      {/* REGULAR CONNECT BUTTONS - ONLY FOR NON-CONFIRMED SALES */}
      {currentConnect && (() => {
        const id1 = String(currentConnect?.connectId || '');
        const id2 = String(currentConnect?.connect_id || '');
        const id3 = String(currentConnect?.id || '');
        const source = String(currentConnect?.cardSource || '');
        const isConfirmedSale = source === 'submitted_applications' || 
                               id1.includes('submitted_app') ||
                               id2.includes('submitted_app') ||
                               id3.includes('submitted_app');
        
        console.log('🔍 Button Check - Regular Connect:', {
          isConfirmedSale,
          source,
          id1,
          id2,
          id3,
          willShowRegularButtons: !isConfirmedSale
        });
        
        // SKIP regular buttons if it's a confirmed sale
        if (isConfirmedSale) {
          console.log('⏭️ SKIPPING regular buttons - this is a confirmed sale');
          return null;
        }
        
        const leadStatus = getLeadStatus(currentConnect);
        
        // NEW LEADS: Appointment, Not Interested, Call Back
        if (leadStatus === 'new') {
          return (
            <>
              <div className="flex justify-center items-center gap-6 mt-4">
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
                    onClick={() => handlePendingAction()}
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
              
              <div className="flex justify-center items-center gap-6 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Not Int.</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Call Back</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Appointment</span>
              </div>
            </>
          );
        }
        
        // EXISTING APPOINTMENTS: Show result buttons if passed, otherwise show regular buttons
        if (leadStatus === 'appointment') {
          // If appointment has passed, show result buttons (handled separately below)
          if (isAppointmentPassed) {
            return null; // Will be handled by the past appointment result section
          }
          
          // Future appointments: Sale, No Show, Not Interested, Reschedule
          return (
            <>
              <div className="flex justify-center items-center gap-6 mt-4">
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
              
              <div className="flex justify-center items-center gap-6 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Not Int.</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">No Show</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold w-20 text-center flex items-center gap-1">
                  SALE! 
                  <img 
                    src={crystalBlue3} 
                    alt="Sale" 
                    className="w-4 h-4 object-contain"
                  />
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Reschedule</span>
              </div>
            </>
          );
        }
        
        // CALLBACKS: Appointment, Not Interested, Call Back Again
        if (leadStatus === 'callback') {
          return (
            <>
              <div className="flex justify-center items-center gap-6 mt-4">
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
                    onClick={() => handlePendingAction()}
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
              
              <div className="flex justify-center items-center gap-6 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Not Int.</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Call Back</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-14 text-center">Appointment</span>
              </div>
            </>
          );
        }
        
        return null;
      })()}

      {/* PAST APPOINTMENT RESULT BUTTONS - Show when appointment has passed */}
      {currentConnect && isAppointmentPassed && (
        <>
          <div className="flex justify-center items-center gap-4 mt-4 flex-wrap">
            {/* No Sale */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => handleAppointmentResult('no_sale')}
                disabled={updateConnectMutation.isPending}
                size="lg"
                className="rounded-full w-16 h-16 bg-gradient-to-br from-red-400 via-red-500 to-red-600 hover:from-red-500 hover:via-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-300/50 relative group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
              </Button>
            </motion.div>
            
            {/* Refused Presentation */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => handleAppointmentResult('refused_presentation')}
                disabled={updateConnectMutation.isPending}
                size="lg"
                className="rounded-full w-16 h-16 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl border-2 border-orange-300/50 relative group"
              >
                <ThumbsDown className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
              </Button>
            </motion.div>
            
            {/* Sale - Larger and Central */}
            <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
              <Button
                onClick={() => handleAppointmentResult('sale')}
                disabled={updateConnectMutation.isPending}
                size="lg"
                className="rounded-full w-20 h-20 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 hover:from-green-500 hover:via-emerald-600 hover:to-green-700 text-white shadow-xl hover:shadow-2xl border-2 border-green-300/50 relative group"
              >
                <Trophy className="w-9 h-9 group-hover:rotate-12 transition-transform duration-200" />
                <div className="absolute inset-0 rounded-full bg-green-300 opacity-20 animate-ping group-hover:opacity-30"></div>
              </Button>
            </motion.div>
            
            {/* Reschedule */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => handleAppointmentResult('reschedule')}
                disabled={updateConnectMutation.isPending}
                size="lg"
                className="rounded-full w-16 h-16 bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 hover:from-purple-500 hover:via-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border-2 border-purple-300/50 relative group"
              >
                <Calendar className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
              </Button>
            </motion.div>
          </div>
          
          <div className="flex justify-center items-center gap-4 mt-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-16 text-center">No Sale</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-16 text-center">Refused</span>
            <span className="text-xs text-green-600 dark:text-green-400 font-bold w-20 text-center">SALE</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-16 text-center">Reschedule</span>
          </div>
        </>
      )}

      {/* Appointment Date/Time Picker Modal */}
      <AnimatePresence>
        {showAppointmentPicker && currentConnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
            onClick={() => {
              setShowAppointmentPicker(false);
              setAppointmentDate('');
              setAppointmentTime('');
              setAppointmentTimezone('America/New_York');
              setIsRescheduling(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-600" />
                {isRescheduling ? 'Reschedule Appointment' : 'Schedule Appointment'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label htmlFor="appointment-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time {isLoadingAvailability && <span className="text-xs text-gray-500">(Loading availability...)</span>}
                  </Label>
                  <Select 
                    value={appointmentTime} 
                    onValueChange={setAppointmentTime}
                    disabled={isLoadingAvailability || availableSlots.length === 0}
                  >
                    <SelectTrigger id="appointment-time" className="w-full">
                      <SelectValue placeholder={isLoadingAvailability ? "Loading..." : availableSlots.length === 0 ? "No available slots" : "Select time"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {formatTimeSlot(slot)}
                        </SelectItem>
                      ))}
                      {availableSlots.length === 0 && !isLoadingAvailability && (
                        <SelectItem value="" disabled>
                          No available slots for this date
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {bookedTimes.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {bookedTimes.length} slot{bookedTimes.length !== 1 ? 's' : ''} already booked
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="appointment-timezone" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timezone
                  </Label>
                  <Select value={appointmentTimezone} onValueChange={setAppointmentTimezone}>
                    <SelectTrigger id="appointment-timezone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {US_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {appointmentDate && appointmentTime && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      Scheduled for: {new Date(`${appointmentDate}T${appointmentTime}`).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAppointmentPicker(false);
                    setAppointmentDate('');
                    setAppointmentTime('');
                    setAppointmentTimezone('America/New_York');
                    setIsRescheduling(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAppointmentSubmit}
                  disabled={!appointmentDate || !appointmentTime}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  Schedule
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Navigation */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={previousCard}
          disabled={currentCardIndex === 0}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Previous</span>
        </Button>
        
        {/* Undo Button */}
        {undoHistory.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={undoLastAction}
            className="flex items-center gap-1.5 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300"
          >
            <motion.div
              animate={{ rotate: [0, -15, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              ↩️
            </motion.div>
            UNDO ({undoHistory.length})
          </Button>
        )}
        
        {swipeCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Zap className="w-3 h-3 text-purple-500" />
            <span>+{swipeCount * 4} XP</span>
          </div>
        )}
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
                                  <img 
                    src={crystalBlue3} 
                    alt="Sale" 
                    className="w-5 h-5 object-contain"
                  />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}