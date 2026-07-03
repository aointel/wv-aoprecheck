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
  User,
  Target
} from "lucide-react";
// Placeholder crystal image
const crystalBlue2 = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop';

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
          {/* Check if this is a confirmed sale */}
          {(() => {
            const id1 = String(connect?.connectId || '');
            const id2 = String(connect?.connect_id || '');
            const id3 = String(connect?.id || '');
            const source = String(connect?.cardSource || '');
            const isConfirmedSale = source === 'submitted_applications' || 
                                   id1.includes('submitted_app') ||
                                   id2.includes('submitted_app') ||
                                   id3.includes('submitted_app');
            
            // CONFIRMED SALES - Different swipe overlays
            if (isConfirmedSale) {
              return (
                <>
                  {/* AO Intelligence Overlay (Left Swipe) */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: swipeDirection === 'left' ? 0.9 : 0
                    }}
                    className="absolute inset-0 z-30 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center"
                    style={{ transform: 'rotate(-15deg)' }}
                  >
                    <div className="text-center">
                      <Target className="w-16 h-16 text-white mx-auto mb-2" />
                      <span className="text-white text-2xl font-bold tracking-wider">AO INTELLIGENCE</span>
                    </div>
                  </motion.div>

                  {/* Call Connector Pro Overlay (Right Swipe) */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: swipeDirection === 'right' ? 0.9 : 0
                    }}
                    className="absolute inset-0 z-30 bg-gradient-to-br from-green-500 via-emerald-600 to-green-700 rounded-2xl flex items-center justify-center"
                    style={{ transform: 'rotate(15deg)' }}
                  >
                    <div className="text-center">
                      <Phone className="w-16 h-16 text-white mx-auto mb-2" />
                      <span className="text-white text-2xl font-bold tracking-wider">CALL CONNECTOR PRO</span>
                    </div>
                  </motion.div>

                  {/* Standard Overlay (Up Swipe) */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: swipeDirection === 'up' ? 0.9 : 0,
                      scale: swipeDirection === 'up' ? 1 : 0.8
                    }}
                    className="absolute inset-0 z-30 bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700 rounded-2xl flex items-center justify-center"
                    style={{ transform: 'rotate(0deg)' }}
                  >
                    <div className="text-center">
                      <DollarSign className="w-16 h-16 text-white mx-auto mb-2" />
                      <span className="text-white text-2xl font-bold tracking-wider">STANDARD</span>
                    </div>
                  </motion.div>
                </>
              );
            }
            
            // REGULAR CONNECTS - Original swipe overlays
            return (
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
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`
                  }}
                >
                  <img 
                    src={crystalBlue2} 
                    alt="Sale" 
                    className="w-6 h-6 object-contain"
                  />
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
            );
          })()}
        </>
      )}

      {/* Enhanced Professional Connect Card */}
      <div className="w-full h-full bg-gradient-to-br from-white via-gray-50 to-blue-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-600/50 overflow-hidden backdrop-blur-sm">
        {/* Confirmed Sales (Rotated 180°) */}
        {connect.cardSource === 'submitted_applications' ? (
          <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl" style={{ transform: 'rotate(180deg)' }}>
            {/* Sci-Fi Card Art Background with integrated badge */}
            <div className="absolute inset-0" style={{ transform: 'rotate(180deg)' }}>
              <img 
                src="/assets/confirmed-sale-card-art-scifi-v3.png" 
                alt="Confirmed Sale Card Art"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              {/* Fallback sci-fi gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-900/70 via-yellow-900/60 to-orange-900/70"></div>
              {/* Sci-fi overlay - darker at edges, lighter in center */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]"></div>
            </div>
            
            {/* Card Content - Rotated back so text is readable - TCG Layout */}
            <div className="relative z-10 h-full flex flex-col text-white" style={{ transform: 'rotate(180deg)' }}>
              {/* Top Row - Card Type (left) and LOB (right) */}
              <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start">
                {connect.saleType && (
                  <div className="px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded border border-amber-500/40 shadow-lg">
                    <span className="text-xs font-bold uppercase tracking-widest text-white drop-shadow-2xl">
                      {connect.saleType}
                    </span>
                  </div>
                )}
                {connect.lob && (
                  <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded border border-amber-500/30 shadow-md">
                    <span className="text-[10px] font-semibold uppercase text-amber-300">
                      {connect.lob}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Center - Client Name Banner */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-12 z-20">
                <div className="px-6 py-3 bg-black/80 backdrop-blur-sm rounded-lg border border-amber-500/40 shadow-xl">
                  <h3 className="text-xl font-bold text-white drop-shadow-2xl uppercase tracking-wide text-center whitespace-nowrap">
                    {connect.leadName || connect.lead_name || 'Unknown Client'}
                  </h3>
                </div>
              </div>
              
              {/* Center - Phone Banner (hidden for confirmed sales - they don't have phone numbers) */}
              {connect.cardSource !== 'submitted_applications' && (connect.leadPhone || connect.lead_phone) && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-2 z-20">
                  <div className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded border border-amber-500/30 shadow-lg">
                    <p className="text-sm text-amber-300 font-medium drop-shadow-lg text-center whitespace-nowrap">
                      {connect.leadPhone || connect.lead_phone}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Bottom Section - Stats Row */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between">
                {/* ALP Stat - Bottom-left */}
                <div className="px-3 py-2 bg-black/80 backdrop-blur-sm rounded border border-green-500/50 shadow-lg">
                  <div className="flex flex-col items-start">
                    <p className="text-[8px] uppercase tracking-widest font-bold text-green-300 mb-0.5">ALP</p>
                    <p className="text-lg font-bold text-white leading-none">
                      ${connect.alp ? Math.round(parseFloat(connect.alp) / 1000) : '0'}K
                    </p>
                  </div>
                </div>
                
                {/* Policy - Bottom-right */}
                {connect.policy_number && (
                  <div className="px-2 py-1.5 bg-black/70 backdrop-blur-sm rounded border border-gray-500/40 shadow-md">
                    <p className="text-[9px] text-gray-300 font-mono text-right">
                      {connect.policy_number}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (() => {
          // Check if this is an Appointment
          const appointmentDate = connect.appointmentDate || connect.appointment_date;
          const appointmentSet = connect.appointmentSet || connect.appointment_set;
          const isAppointment = appointmentSet || appointmentDate;
          
          // Check if this is a Call Connector Pro connect
          const connectType = connect.connectType || connect.connect_type || '';
          const isCCPro = connectType?.toLowerCase().includes('ccpro') || 
                         connectType?.toLowerCase().includes('call_connector') ||
                         connect.market?.toLowerCase().includes('ccpro') ||
                         connect.lead_source?.toLowerCase().includes('ccpro');
          
          return isAppointment ? (
            /* Appointment Card - Sci-Fi Style */
            <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-purple-500/30 shadow-2xl">
              {/* Sci-Fi Card Art Background with integrated badge */}
              <div className="absolute inset-0">
                <img 
                  src="/assets/appointment-card-art-scifi-v3.png" 
                  alt="Appointment Card Art"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {/* Fallback sci-fi gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-pink-900/60 to-violet-900/70"></div>
                {/* Sci-fi overlay - darker at edges, lighter in center */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]"></div>
              </div>
              
              {/* Card Content - TCG Layout */}
              <div className="relative z-10 h-full flex flex-col text-white">
                {/* Top Row - Card Type (left) and Date/Time (right) */}
                <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start">
                  <div className="px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded border border-purple-500/40 shadow-lg">
                    <span className="text-xs font-bold uppercase tracking-widest text-white drop-shadow-2xl">
                      APPOINTMENT
                    </span>
                  </div>
                  {appointmentDate && (
                    <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded border border-purple-500/30 shadow-md">
                      <span className="text-[10px] font-semibold text-purple-300">
                        {new Date(appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Center - Client Name Banner */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-12 z-20">
                  <div className="px-6 py-3 bg-black/80 backdrop-blur-sm rounded-lg border border-purple-500/40 shadow-xl">
                    <h3 className="text-xl font-bold text-white drop-shadow-2xl uppercase tracking-wide text-center whitespace-nowrap">
                      {connect.leadName || connect.lead_name || 'Unknown Contact'}
                    </h3>
                  </div>
                </div>
                
                {/* Center - Phone Banner */}
                {(connect.leadPhone || connect.lead_phone) && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-2 z-20">
                    <div className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded border border-purple-500/30 shadow-lg">
                      <p className="text-sm text-purple-300 font-medium drop-shadow-lg text-center whitespace-nowrap">
                        {connect.leadPhone || connect.lead_phone}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Bottom Section - Stats Row */}
                <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between">
                  {/* Appointment Time - Bottom-left */}
                  {appointmentDate && (
                    <div className="px-3 py-2 bg-black/80 backdrop-blur-sm rounded border border-pink-500/50 shadow-lg">
                      <div className="flex flex-col items-start">
                        <p className="text-[8px] uppercase tracking-widest font-bold text-pink-300 mb-0.5">TIME</p>
                        <p className="text-sm font-bold text-white leading-none">
                          {new Date(appointmentDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* State - Bottom-right */}
                  {connect.state && (
                    <div className="px-2 py-1.5 bg-black/70 backdrop-blur-sm rounded border border-violet-500/40 shadow-md">
                      <p className="text-[9px] text-violet-300 font-mono text-right uppercase">
                        {connect.state}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isCCPro ? (
            /* Call Connector Pro Card - Sci-Fi Style */
            <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl">
              {/* Sci-Fi Card Art Background with integrated badge */}
              <div className="absolute inset-0">
                <img 
                  src="/assets/call-connector-pro-card-art-scifi-v3.png" 
                  alt="Call Connector Pro Card Art"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {/* Fallback sci-fi gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-900/70 via-emerald-900/60 to-teal-900/70"></div>
                {/* Sci-fi overlay - darker at edges, lighter in center */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]"></div>
              </div>
              
              {/* Card Content - TCG Layout */}
              <div className="relative z-10 h-full flex flex-col text-white">
                {/* Top Row - Card Type (left) and Market (right) */}
                <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start">
                  <div className="px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded border border-emerald-500/40 shadow-lg">
                    <span className="text-xs font-bold uppercase tracking-widest text-white drop-shadow-2xl">
                      CALL CONNECTOR PRO
                    </span>
                  </div>
                  {connect.market && (
                    <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded border border-emerald-500/30 shadow-md">
                      <span className="text-[10px] font-semibold uppercase text-emerald-300">
                        {connect.market}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Center - Client Name Banner */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-12 z-20">
                  <div className="px-6 py-3 bg-black/80 backdrop-blur-sm rounded-lg border border-emerald-500/40 shadow-xl">
                    <h3 className="text-xl font-bold text-white drop-shadow-2xl uppercase tracking-wide text-center whitespace-nowrap">
                      {connect.leadName || connect.lead_name || 'Unknown Contact'}
                    </h3>
                  </div>
                </div>
                
                {/* Center - Phone Banner */}
                {(connect.leadPhone || connect.lead_phone) && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-2 z-20">
                    <div className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded border border-emerald-500/30 shadow-lg">
                      <p className="text-sm text-emerald-300 font-medium drop-shadow-lg text-center whitespace-nowrap">
                        {connect.leadPhone || connect.lead_phone}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Bottom Section - Stats Row */}
                <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between">
                  {/* Duration and State - Bottom-left */}
                  <div className="flex gap-2">
                    {connect.duration && (
                      <div className="px-3 py-2 bg-black/80 backdrop-blur-sm rounded border border-green-500/50 shadow-lg">
                        <div className="flex flex-col items-start">
                          <p className="text-[8px] uppercase tracking-widest font-bold text-green-300 mb-0.5">TIME</p>
                          <p className="text-sm font-bold text-white leading-none">
                            {Math.floor(connect.duration / 60)}:{(connect.duration % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                    )}
                    {connect.state && (
                      <div className="px-2 py-2 bg-black/70 backdrop-blur-sm rounded border border-teal-500/40 shadow-md">
                        <p className="text-xs font-bold text-teal-300 uppercase">
                          {connect.state}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Policy - Bottom-right */}
                  {connect.policy_number && (
                    <div className="px-2 py-1.5 bg-black/70 backdrop-blur-sm rounded border border-gray-500/40 shadow-md">
                      <p className="text-[9px] text-gray-300 font-mono text-right">
                        {connect.policy_number}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Regular Connect Card - Sci-Fi Style */
            <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl">
              {/* Sci-Fi Card Art Background with integrated badge */}
              <div className="absolute inset-0">
                <img 
                  src="/assets/connect-card-art-scifi-v3.png" 
                  alt="Connect Card Art"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {/* Fallback sci-fi gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-purple-900/60 to-indigo-900/70"></div>
                {/* Sci-fi overlay - darker at edges, lighter in center */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]"></div>
              </div>
              
              {/* Card Content - TCG Layout */}
              <div className="relative z-10 h-full flex flex-col text-white">
                {/* Top Row - Card Type (left) and Market (right) */}
                <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start">
                  <div className="px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded border border-cyan-500/40 shadow-lg">
                    <span className="text-xs font-bold uppercase tracking-widest text-white drop-shadow-2xl">
                      CONNECT
                    </span>
                  </div>
                  {connect.market && (
                    <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded border border-cyan-500/30 shadow-md">
                      <span className="text-[10px] font-semibold uppercase text-cyan-300">
                        {connect.market}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Center - Client Name Banner */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-12 z-20">
                  <div className="px-6 py-3 bg-black/80 backdrop-blur-sm rounded-lg border border-cyan-500/40 shadow-xl">
                    <h3 className="text-xl font-bold text-white drop-shadow-2xl uppercase tracking-wide text-center whitespace-nowrap">
                      {connect.leadName || connect.lead_name || 'Unknown Contact'}
                    </h3>
                  </div>
                </div>
                
                {/* Center - Phone Banner */}
                {(connect.leadPhone || connect.lead_phone) && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-2 z-20">
                    <div className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded border border-cyan-500/30 shadow-lg">
                      <p className="text-sm text-cyan-300 font-medium drop-shadow-lg text-center whitespace-nowrap">
                        {connect.leadPhone || connect.lead_phone}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Bottom Section - Stats Row */}
                <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between">
                  {/* Duration and State - Bottom-left */}
                  <div className="flex gap-2">
                    {connect.duration && (
                      <div className="px-3 py-2 bg-black/80 backdrop-blur-sm rounded border border-blue-500/50 shadow-lg">
                        <div className="flex flex-col items-start">
                          <p className="text-[8px] uppercase tracking-widest font-bold text-blue-300 mb-0.5">TIME</p>
                          <p className="text-sm font-bold text-white leading-none">
                            {Math.floor(connect.duration / 60)}:{(connect.duration % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                    )}
                    {connect.state && (
                      <div className="px-2 py-2 bg-black/70 backdrop-blur-sm rounded border border-purple-500/40 shadow-md">
                        <p className="text-xs font-bold text-purple-300 uppercase">
                          {connect.state}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Policy - Bottom-right */}
                  {connect.policy_number && (
                    <div className="px-2 py-1.5 bg-black/70 backdrop-blur-sm rounded border border-gray-500/40 shadow-md">
                      <p className="text-[9px] text-gray-300 font-mono text-right">
                        {connect.policy_number}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        
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
                  <img 
                    src={crystalBlue2} 
                    alt="Submit" 
                    className="w-5 h-5 object-contain"
                  />
                </Button>
              </div>
            </div>
          </div>
        )}


      </div>
    </motion.div>
  );
}