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
  Calendar, 
  ArrowLeft,
  ArrowRight,
  Trophy,
  Target,
  Zap,
  Heart,
  X,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
// Placeholder crystal image
const crystalBlue4 = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop';

interface AppointmentCardDeckProps {
  agentEmail: string;
  onComplete?: () => void;
}

type AppointmentOutcome = 'sale' | 'interested' | 'not_interested' | 'no_show' | 'reschedule';

export function AppointmentCardDeck({ agentEmail, onComplete }: AppointmentCardDeckProps) {
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
  const [undoHistory, setUndoHistory] = useState<string[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch pending appointments for review
  const { data: appointmentsData, isLoading, error } = useQuery({
    queryKey: ['/api/appointments/pending-review', agentEmail],
    queryFn: async () => {
      const response = await fetch(`/api/appointments/pending-review?agentEmail=${encodeURIComponent(agentEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch pending appointments');
      return response.json();
    },
    enabled: !!agentEmail,
  });

  // Ensure we have an array of appointments
  const pendingAppointments = Array.isArray(appointmentsData?.appointments) ? appointmentsData.appointments : [];
  
  console.log('AppointmentCardDeck Debug:');
  console.log('Producer Email:', agentEmail);
  console.log('Pending Appointments:', pendingAppointments.length);
  console.log('Current Card Index:', currentCardIndex);

  // Award experience mutation
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
        description: `+${experience} XP earned for reviewing appointments!`,
        variant: "default",
      });
    }
  });

  // Mutation to update appointment outcome
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: {
      appointmentId: number;
      outcome: AppointmentOutcome;
      saleAmount?: string;
      notes?: string;
      agentEmail: string;
    }) => {
      return await apiRequest('POST', '/api/appointments/review', data);
    },
    onSuccess: (_, variables) => {
      setProcessedCards(prev => new Set([...Array.from(prev), variables.appointmentId.toString()]));
      setUndoHistory(prev => [...prev, variables.appointmentId.toString()]);
      
      // Increment swipe count and award experience
      const newSwipeCount = swipeCount + 1;
      setSwipeCount(newSwipeCount);
      
      // Award 5 experience points for every appointment review
      awardExperienceMutation.mutate(5);
      
      const resultMessages = {
        sale: `🎉 SALE RECORDED! Premium: $${variables.saleAmount}`,
        interested: "Marked as interested - great follow-up opportunity!",
        not_interested: "Marked as not interested - noted for future reference.",
        no_show: "Marked as no-show - will follow up appropriately.",
        reschedule: "Marked for reschedule - will arrange new appointment."
      };

      toast({
        title: "Appointment Reviewed!",
        description: resultMessages[variables.outcome],
        variant: variables.outcome === 'sale' ? 'default' : 'default',
      });

      // If this was a sale with amount, immediately update any related trackers
      if (variables.outcome === 'sale' && variables.saleAmount) {
        queryClient.invalidateQueries({ queryKey: ['/api/war/aoi-aip'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/agent-stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/gamification/stats'] });
        
        // Close sale animation and advance to next card
        setSaleSuccess(false);
        setShowSaleInput(false);
        setSaleAmount('');
        setCardDirection(null);
        
        setTimeout(() => {
          setCurrentCardIndex(prev => prev + 1);
        }, 500);
      } else {
        // Advance to next card for non-sale outcomes
        setTimeout(() => {
          setCurrentCardIndex(prev => prev + 1);
          setCardDirection(null);
        }, 500);
      }
      
      // Invalidate appointments query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/pending-review'] });
    },
    onError: (error) => {
      console.error('Error updating appointment:', error);
      toast({
        title: "Error",
        description: "Failed to update appointment. Please try again.",
        variant: "destructive",
      });
      setCardDirection(null);
    }
  });

  const handleSwipe = (outcome: AppointmentOutcome, direction: 'left' | 'right' | 'up' | 'down') => {
    const currentAppointment = pendingAppointments[currentCardIndex];
    if (!currentAppointment || processedCards.has(currentAppointment.id.toString())) return;

    console.log('Swiping appointment:', currentAppointment.leadName, 'with outcome:', outcome);

    setCardDirection(direction);
    setSwipeDirection(direction);

    if (outcome === 'sale') {
      setShowSaleInput(true);
      setSaleSuccess(true);
      return;
    }

    updateAppointmentMutation.mutate({
      appointmentId: currentAppointment.id,
      outcome,
      agentEmail,
      notes: `Reviewed via appointment cards - ${outcome}`
    });
  };

  const handleSaleSubmit = () => {
    const currentAppointment = pendingAppointments[currentCardIndex];
    if (!currentAppointment || !saleAmount || processedCards.has(currentAppointment.id.toString())) return;

    updateAppointmentMutation.mutate({
      appointmentId: currentAppointment.id,
      outcome: 'sale',
      saleAmount,
      agentEmail,
      notes: `Sale recorded via appointment cards - Premium: $${saleAmount}`
    });
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    const threshold = 100;
    const velocity = Math.abs(info.velocity.x) + Math.abs(info.velocity.y);

    if (velocity > 500 || Math.abs(info.offset.x) > threshold || Math.abs(info.offset.y) > threshold) {
      if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
        // Horizontal swipe
        if (info.offset.x > 0) {
          handleSwipe('interested', 'right'); // Swipe right for interested
        } else {
          handleSwipe('not_interested', 'left'); // Swipe left for not interested
        }
      } else {
        // Vertical swipe
        if (info.offset.y < 0) {
          handleSwipe('sale', 'up'); // Swipe up for sale
        } else {
          handleSwipe('no_show', 'down'); // Swipe down for no show
        }
      }
    }
  };

  // Check if all appointments have been processed
  const remainingAppointments = pendingAppointments.filter(
    (appointment: any) => !processedCards.has(appointment.id.toString())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment reviews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p>Error loading appointments. Please try again.</p>
        </div>
      </div>
    );
  }

  if (remainingAppointments.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">All Done!</h3>
          <p className="text-gray-600 mb-4">
            You've reviewed all your completed appointments.
          </p>
          <Button onClick={onComplete} className="bg-purple-600 hover:bg-purple-700">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const currentAppointment = pendingAppointments[currentCardIndex];
  if (!currentAppointment || processedCards.has(currentAppointment.id.toString())) {
    // Find next unprocessed appointment
    const nextIndex = pendingAppointments.findIndex(
      (appointment: any, index: number) => 
        index > currentCardIndex && !processedCards.has(appointment.id.toString())
    );
    
    if (nextIndex !== -1) {
      setCurrentCardIndex(nextIndex);
      return null; // Re-render with new index
    }
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Experience Reward Animation */}
      <AnimatePresence>
        {showExperienceReward && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-full font-bold shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>+{earnedExperience} XP</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with progress */}
      <div className="mb-6 text-center">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline" className="text-purple-700 border-purple-300">
            {remainingAppointments.length} remaining
          </Badge>
          <Badge variant="outline" className="text-green-700 border-green-300">
            {swipeCount} reviewed
          </Badge>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Appointment Reviews</h2>
        <p className="text-gray-600">Swipe to review your completed appointments</p>
      </div>

      {/* Swipe Instructions */}
      <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-gray-600">
        <div className="flex items-center space-x-1">
          <ArrowLeft className="h-3 w-3 text-red-500" />
          <span>Not Interested</span>
        </div>
        <div className="flex items-center space-x-1">
          <ArrowRight className="h-3 w-3 text-green-500" />
          <span>Interested</span>
        </div>
        <div className="flex items-center space-x-1">
          <DollarSign className="h-3 w-3 text-yellow-500" />
          <span>↑ Sale</span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3 text-gray-500" />
          <span>↓ No Show</span>
        </div>
      </div>

      {/* Card Stack */}
      <div className="flex-1 relative">
        <AnimatePresence>
          {currentAppointment && !processedCards.has(currentAppointment.id.toString()) && (
            <motion.div
              key={currentAppointment.id}
              ref={cardRef}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              animate={{
                x: cardDirection === 'left' ? -300 : cardDirection === 'right' ? 300 : 0,
                y: cardDirection === 'up' ? -300 : cardDirection === 'down' ? 300 : 0,
                rotate: cardDirection === 'left' ? -30 : cardDirection === 'right' ? 30 : 0,
                opacity: cardDirection ? 0 : 1,
              }}
              transition={{
                duration: cardDirection ? 0.3 : 0,
                ease: "easeOut"
              }}
              className="absolute inset-0"
            >
              <Card className="h-full bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 shadow-xl">
                <CardContent className="p-6 h-full flex flex-col">
                  {/* Appointment Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      {currentAppointment.leadName}
                    </h3>
                    <p className="text-gray-600 text-lg">
                      {currentAppointment.leadPhone}
                    </p>
                  </div>

                  {/* Appointment Details */}
                  <div className="flex-1 space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Date:</span>
                          <p className="text-gray-600">
                            {new Date(currentAppointment.appointmentDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Time:</span>
                          <p className="text-gray-600">
                            {new Date(currentAppointment.appointmentDate).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {currentAppointment.notes && (
                        <div className="mt-3">
                          <span className="font-semibold text-gray-700">Notes:</span>
                          <p className="text-gray-600 text-sm mt-1">{currentAppointment.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Sale Input */}
                    {showSaleInput && saleSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-lg p-4"
                      >
                        <div className="text-center mb-4">
                          <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                          <h4 className="font-bold text-green-800">🎉 SALE! 🎉</h4>
                          <p className="text-green-700 text-sm">Enter the premium amount:</p>
                        </div>
                        <div className="flex space-x-2">
                          <Input
                            type="number"
                            placeholder="Premium amount"
                            value={saleAmount}
                            onChange={(e) => setSaleAmount(e.target.value)}
                            className="border-green-300 focus:border-green-500"
                            autoFocus
                          />
                          <Button
                            onClick={handleSaleSubmit}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={!saleAmount}
                          >
                            Submit
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => handleSwipe('not_interested', 'left')}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      disabled={isDragging || showSaleInput}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Not Interested
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSwipe('interested', 'right')}
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      disabled={isDragging || showSaleInput}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Interested
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSwipe('sale', 'up')}
                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      disabled={isDragging || showSaleInput}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Sale
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSwipe('no_show', 'down')}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      disabled={isDragging || showSaleInput}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      No Show
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}