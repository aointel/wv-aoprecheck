import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Phone, 
  Clock,
  DollarSign,
  Heart,
  X,
  User
} from "lucide-react";

interface TinderCardProps {
  connect: any;
  isActive: boolean;
  stackIndex?: number;
  onSwipe: (direction: 'left' | 'right' | 'up' | 'down') => void;
  onSale: (amount: string) => void;
  isDragging: boolean;
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  onDragStart: () => void;
  onDrag: (event: any, info: PanInfo) => void;
  onDragEnd: (event: any, info: PanInfo) => void;
  showSaleInput: boolean;
  saleAmount: string;
  setSaleAmount: (amount: string) => void;
}

export function TinderCard({
  connect,
  isActive,
  stackIndex = 0,
  onSwipe,
  onSale,
  isDragging,
  swipeDirection,
  onDragStart,
  onDrag,
  onDragEnd,
  showSaleInput,
  saleAmount,
  setSaleAmount
}: TinderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isActive && stackIndex > 0) {
    // Background stack cards - matches mobile app style
    return (
      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${0.92 - stackIndex * 0.04}) translateY(${stackIndex * 12}px)`,
          zIndex: 10 - stackIndex,
          opacity: 0.6 - stackIndex * 0.2
        }}
      >
        <div className="w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700" />
      </div>
    );
  }

  if (!isActive) return null;

  return (
    <motion.div
      key={connect.connectId || connect.connect_id || connect.id}
      ref={cardRef}
      drag
      dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
      dragElastic={0.2}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.9, opacity: 0, y: 50 }}
      animate={{ 
        scale: 1, 
        opacity: 1, 
        y: 0,
        x: 0,
        rotate: 0
      }}
      exit={{ 
        scale: 0.8, 
        opacity: 0, 
        x: swipeDirection === 'left' ? -400 : swipeDirection === 'right' ? 400 : 0,
        y: swipeDirection === 'up' ? -400 : swipeDirection === 'down' ? 400 : 0,
        rotate: swipeDirection === 'left' ? -30 : swipeDirection === 'right' ? 30 : 0
      }}
      whileDrag={{
        scale: 1.05,
        transition: { duration: 0.1 }
      }}
      transition={{ 
        duration: 0.4, 
        type: "spring",
        stiffness: 400,
        damping: 30
      }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{
        zIndex: 20,
        boxShadow: isDragging ? '0 25px 50px rgba(0,0,0,0.25)' : '0 15px 35px rgba(0,0,0,0.15)'
      }}
    >
      {/* Swipe Direction Overlays */}
      {isDragging && (
        <>
          {/* Not Interested Overlay (Left Swipe) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: swipeDirection === 'left' ? 0.9 : 0
            }}
            className="absolute inset-0 z-30 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center"
            style={{ transform: 'rotate(-15deg)' }}
          >
            <div className="text-center">
              <X className="w-16 h-16 text-white mx-auto mb-2" />
              <span className="text-white text-2xl font-bold tracking-wider">NOT INTERESTED</span>
            </div>
          </motion.div>

          {/* Appointment Overlay (Right Swipe) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: swipeDirection === 'right' ? 0.9 : 0
            }}
            className="absolute inset-0 z-30 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center"
            style={{ transform: 'rotate(15deg)' }}
          >
            <div className="text-center">
              <Heart className="w-16 h-16 text-white mx-auto mb-2" />
              <span className="text-white text-2xl font-bold tracking-wider">APPOINTMENT</span>
            </div>
          </motion.div>

          {/* Sale Overlay (Up Swipe) - Tinder Match Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: swipeDirection === 'up' ? 0.95 : 0,
              scale: swipeDirection === 'up' ? 1 : 0.8
            }}
            transition={{ 
              duration: 0.3,
              type: "spring",
              stiffness: 400,
              damping: 25
            }}
            className="absolute inset-0 z-30 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex flex-col items-center justify-center"
          >
            {/* Animated Background Hearts/Stars */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, y: 50 }}
                  animate={{
                    opacity: swipeDirection === 'up' ? [0, 1, 0] : 0,
                    scale: swipeDirection === 'up' ? [0, 1.5, 0] : 0,
                    y: swipeDirection === 'up' ? [50, -100] : 50,
                    x: swipeDirection === 'up' ? [0, (Math.random() - 0.5) * 200] : 0
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.1,
                    repeat: swipeDirection === 'up' ? Infinity : 0
                  }}
                  className="absolute text-yellow-300 text-2xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`
                  }}
                >
                  💰
                </motion.div>
              ))}
            </div>

            {/* Main Content */}
            <div className="text-center relative z-10">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ 
                  scale: swipeDirection === 'up' ? 1 : 0,
                  rotate: swipeDirection === 'up' ? 0 : -180
                }}
                transition={{ 
                  duration: 0.5,
                  type: "spring",
                  stiffness: 300,
                  damping: 20
                }}
              >
                <DollarSign className="w-24 h-24 text-yellow-300 mx-auto mb-4 drop-shadow-lg" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ 
                  opacity: swipeDirection === 'up' ? 1 : 0,
                  y: swipeDirection === 'up' ? 0 : 30
                }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="space-y-2"
              >
                <h2 className="text-white text-4xl font-bold tracking-wider drop-shadow-lg" style={{
                  fontFamily: "'Dancing Script', cursive, system-ui",
                  textShadow: '0 4px 8px rgba(0,0,0,0.3)'
                }}>
                  It's a Sale!
                </h2>
                <p className="text-yellow-200 text-lg font-medium tracking-wide">
                  ConnectNow
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Callback/Pending Overlay (Down Swipe) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: swipeDirection === 'down' ? 0.9 : 0
            }}
            className="absolute inset-0 z-30 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center"
            style={{ transform: 'rotate(-10deg)' }}
          >
            <div className="text-center">
              <Clock className="w-16 h-16 text-white mx-auto mb-2" />
              <span className="text-white text-2xl font-bold tracking-wider">CALLBACK / PENDING</span>
            </div>
          </motion.div>

        </>
      )}

      {/* Enhanced Professional Connect Card */}
      <div className="w-full h-full bg-gradient-to-br from-white via-gray-50 to-blue-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-600/50 overflow-hidden backdrop-blur-sm">
        {/* Enhanced Card Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-6 text-white relative overflow-hidden">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full translate-x-12 translate-y-12"></div>
          </div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-16 h-16 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-lg"
              >
                <User className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h3 className="text-xl font-bold tracking-wide drop-shadow-sm">
                  {connect.leadName || connect.lead_name || 'Unknown Contact'}
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <Phone className="w-4 h-4 text-blue-200" />
                  <p className="text-blue-100 text-sm font-medium">
                    {connect.leadPhone || connect.lead_phone || 'No phone'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold border-0 shadow-lg text-xs">
                {connect.state || 'Unknown'}
              </Badge>
              <Badge variant="outline" className="text-xs font-mono bg-white/20 border-white/30 text-white">
                #{(connect.connectId || connect.connect_id || connect.id || 'NEW').toString().slice(-4)}
              </Badge>
            </div>
          </div>

        </div>
        
        {/* Enhanced Card Body */}
        <div className="p-6 pt-4">
          {/* Connect Stats with Better Design */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-blue-700 dark:text-blue-300 uppercase font-bold tracking-wider">Duration</span>
              </div>
              <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                {connect.duration ? `${Math.floor(connect.duration / 60)}:${(connect.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
              </p>
            </motion.div>
            
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/50"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-purple-700 dark:text-purple-300 uppercase font-bold tracking-wider">Market</span>
              </div>
              <p className="text-sm font-bold text-purple-900 dark:text-purple-100">
                {connect.market || connect.lead_source || 'General'}
              </p>
            </motion.div>
          </div>

          {/* AO Intelligence Logo Display */}
          <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-700/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/50 mb-4 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-wide bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 bg-clip-text text-transparent">
                AO Intelligence
              </h1>
            </div>
          </div>

          {/* Enhanced Action Status */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-700/50">
            <div className="flex items-center gap-3">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-3 h-3 bg-green-500 rounded-full shadow-lg"
              ></motion.div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Ready for Review</span>
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Swipe to decide →
            </div>
          </div>
        </div>

        {/* Sale Input Section */}
        {showSaleInput && (
          <div className="px-6 pb-6">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Record Sale Amount
              </h4>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="AOI/ALP Amount"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                  className="flex-1 border-yellow-300 focus:ring-yellow-500"
                />
                <Button
                  onClick={() => onSale(saleAmount)}
                  disabled={!saleAmount}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  💰
                </Button>
              </div>
            </div>
          </div>
        )}


      </div>
    </motion.div>
  );
}