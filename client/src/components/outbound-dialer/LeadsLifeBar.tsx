import React, { useEffect, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';

interface LeadsLifeBarProps {
  remainingLeads: number;
  maxLeads: number;
  isTrial: boolean;
  triggerRefill?: number; // Incrementing number to trigger refill animation
}

export function LeadsLifeBar({ remainingLeads, maxLeads, isTrial, triggerRefill = 0 }: LeadsLifeBarProps) {
  const [isRefilling, setIsRefilling] = useState(false);
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const glowControls = useAnimationControls();
  
  const percentage = Math.max(0, Math.min(100, (remainingLeads / maxLeads) * 100));
  const segments = 20; // Number of segments in the bar
  
  // Trigger refill animation when triggerRefill changes
  useEffect(() => {
    if (triggerRefill > 0) {
      setIsRefilling(true);
      setDisplayPercentage(0);
      
      // Animate glow
      glowControls.start({
        opacity: [0.5, 1, 0.5],
        scale: [1, 1.1, 1],
        transition: {
          duration: 0.5,
          repeat: 3,
          ease: 'easeInOut'
        }
      });
  
      // Animate refill from 0 to current percentage
      const duration = 1500; // 1.5 seconds
      const steps = 60;
      const stepDuration = duration / steps;
      const increment = percentage / steps;
      
      let currentStep = 0;
      const refillInterval = setInterval(() => {
        currentStep++;
        const newPercentage = Math.min(increment * currentStep, percentage);
        setDisplayPercentage(newPercentage);
        
        if (currentStep >= steps) {
          setDisplayPercentage(percentage);
          clearInterval(refillInterval);
          setIsRefilling(false);
        }
      }, stepDuration);
      
      return () => clearInterval(refillInterval);
      } else {
      setDisplayPercentage(percentage);
    }
  }, [triggerRefill, percentage, glowControls]);
  
  // Update display percentage when remainingLeads changes (normal updates)
  useEffect(() => {
    if (!isRefilling) {
      setDisplayPercentage(percentage);
    }
  }, [percentage, isRefilling]);
  
  // Calculate how many segments should be filled based on display percentage
  const displaySegments = Math.floor((displayPercentage / 100) * segments);
  const filledSegments = displaySegments;
  
  // Get gradient based on percentage - memoized
  const gradient = React.useMemo(() => {
    if (percentage < 25) {
      return 'linear-gradient(90deg, #ef4444, #f59e0b, #ef4444)'; // Red to orange
    } else if (percentage < 50) {
      return 'linear-gradient(90deg, #f59e0b, #eab308, #f59e0b)'; // Orange to yellow
    } else if (percentage < 75) {
      return 'linear-gradient(90deg, #eab308, #84cc16, #eab308)'; // Yellow to light green
    } else {
      return 'linear-gradient(90deg, #84cc16, #22c55e, #10b981)'; // Light green to bright green
    }
  }, [percentage]);

  return (
    <div className="w-full" style={{ display: 'block', visibility: 'visible', opacity: 1, minHeight: '32px' }}>
      {/* Energy Bar - Vibrant with gradients and animations */}
      <div className="relative h-8 rounded-lg overflow-hidden border-2 border-yellow-400/50 shadow-xl" style={{ 
        display: 'flex', 
        visibility: 'visible', 
        opacity: 1,
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        boxShadow: '0 0 20px rgba(250, 204, 21, 0.3), inset 0 0 10px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Background gradient fill - simplified animations */}
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${displayPercentage}%`,
            background: gradient,
            boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.3), 0 0 15px rgba(250, 204, 21, 0.5)',
            filter: 'brightness(1.1) saturate(1.2)',
            transition: 'width 0.3s ease-out'
          }}
          initial={{ opacity: 0.9 }}
          animate={{ opacity: [0.9, 1, 0.9] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
            repeatType: 'reverse'
          }}
        >
          {/* Static shine effect - only when refilling */}
          {isRefilling && (
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
              }}
              animate={{ 
                x: ['-100%', '200%']
              }}
              transition={{ 
                duration: 1.5,
                ease: 'linear'
              }}
            />
          )}
        </motion.div>

        {/* Segment dividers for visual effect */}
        <div className="absolute inset-0 flex h-full">
          {Array.from({ length: segments }).map((_, index) => (
            <div
              key={index}
              className="h-full border-r border-gray-900/30 last:border-r-0"
              style={{ width: `${100 / segments}%` }}
            />
          ))}
        </div>

        {/* Subtle pulsing glow effect when low - simplified */}
        {percentage < 30 && (
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.3) 0%, transparent 70%)',
              filter: 'blur(8px)',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
        )}

        {/* Static glow border when high - no animation */}
        {percentage >= 75 && (
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              border: '2px solid rgba(34, 197, 94, 0.5)',
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)'
            }}
          />
        )}

        {/* Percentage text overlay - static glow */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span 
            className="text-sm font-bold text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
            style={{
              textShadow: percentage >= 75
                ? '0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.5)'
                : percentage < 30
                ? '0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.5)'
                : '0 0 10px rgba(250, 204, 21, 0.8), 0 0 20px rgba(250, 204, 21, 0.5)'
            }}
          >
            {remainingLeads} / {maxLeads} ({Math.round(percentage)}%)
          </span>
        </div>
        
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>

      {/* Warning message when low */}
      {percentage < 20 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-red-400 text-center"
        >
          ⚠️ Low on leads! {isTrial ? 'Trial limit approaching. Upgrade to continue!' : 'Requesting more...'}
        </motion.div>
      )}

      {/* Upgrade prompt when trial is exhausted */}
      {isTrial && remainingLeads === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 p-2 bg-red-600/30 border border-red-500 rounded text-xs text-red-200 text-center"
        >
          🚫 Trial exhausted! Upgrade to Pro for unlimited leads.
        </motion.div>
      )}
    </div>
  );
}

