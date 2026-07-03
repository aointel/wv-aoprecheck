import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Zap, Plus } from 'lucide-react';

interface HotleadProgressCounterProps {
  agentEmail: string;
}

// Simple in-memory call tracker - no database bullshit
const callTracker = {
  getTodayCalls: (email: string) => {
    const key = `calls_${email}_${new Date().toDateString()}`;
    return parseInt(localStorage.getItem(key) || '0');
  },
  addCall: (email: string) => {
    const key = `calls_${email}_${new Date().toDateString()}`;
    const lastCallKey = `lastcall_${email}`;
    const now = Date.now();
    
    // REMOVED: 20 second delay requirement - count all calls immediately
    const current = callTracker.getTodayCalls(email);
    const newCount = current + 1;
    
    // If hitting 6, trigger webhook and reset to 0
    if (newCount === 6) {
      console.log(`🔥 HOTLEAD EARNED! Triggering webhook for ${email}`);
      // Trigger hotlead assignment webhook
      fetch('/api/hotlead-entitlement-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentEmail: email, callCount: 6 })
      }).then(response => {
        if (response.ok) {
          console.log(`✅ Hotlead webhook triggered for ${email}`);
        } else {
          console.error(`❌ Hotlead webhook failed for ${email}`);
        }
      });
      
      // Reset counter to 0 after earning hotlead
      localStorage.setItem(key, '0');
      localStorage.setItem(lastCallKey, now.toString());
      return 0;
    } else {
      localStorage.setItem(key, newCount.toString());
      localStorage.setItem(lastCallKey, now.toString());
      return newCount;
    }
  },
  reset: (email: string) => {
    const key = `calls_${email}_${new Date().toDateString()}`;
    localStorage.setItem(key, '0');
  }
};

export function HotleadProgressCounter({ agentEmail }: HotleadProgressCounterProps) {
  const [animateProgress, setAnimateProgress] = useState(false);
  const [plusLeadCalls, setPlusLeadCalls] = useState(0);
  
  // TEST FUNCTION - manually increment counter
  const testIncrement = () => {
    const newCount = callTracker.addCall(agentEmail);
    setPlusLeadCalls(newCount);
    console.log(`🧪 TEST: Manually incremented counter to ${newCount}`);
  };

  // Load calls from localStorage on mount
  useEffect(() => {
    const calls = callTracker.getTodayCalls(agentEmail);
    setPlusLeadCalls(calls);
    
    // Listen for call completion events from the dialer
    const handleCallCompleted = (event: any) => {
      const { agentEmail: callproducer } = event.detail || {};
      
      if (callproducer === agentEmail) {
        const newCount = callTracker.addCall(agentEmail);
        setPlusLeadCalls(newCount);
        console.log(`🔥 Plus Lead call completed! New count: ${newCount}`);
      }
    };
    
    // Add event listener
    window.addEventListener('callCompleted', handleCallCompleted);
    
    // Cleanup
    return () => {
      window.removeEventListener('callCompleted', handleCallCompleted);
    };
  }, [agentEmail]);

  const callsTowardHotlead = plusLeadCalls % 6; // Plus lead calls toward next hotlead  
  const hotleadsEarned = Math.floor(plusLeadCalls / 6); // Total hotleads earned from plus leads
  const progressPercentage = (callsTowardHotlead / 6) * 100;
  const callsRemaining = 6 - callsTowardHotlead;

  // Animate progress when it changes
  useEffect(() => {
    setAnimateProgress(true);
    const timer = setTimeout(() => setAnimateProgress(false), 500);
    return () => clearTimeout(timer);
  }, [callsTowardHotlead]);

  // Manual add call function
  const addPlusCall = () => {
    const newCount = callTracker.addCall(agentEmail);
    setPlusLeadCalls(newCount);
  };

  // Reset calls function
  const resetCalls = () => {
    callTracker.reset(agentEmail);
    setPlusLeadCalls(0);
  };

  return (
    <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
      <CardContent className="pt-4 pb-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-sm text-orange-800">Hotlead Progress</h3>
            </div>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              <Trophy className="h-3 w-3 mr-1" />
              {hotleadsEarned} Earned
            </Badge>
          </div>

          {/* Progress Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-700 font-medium">
                {callsTowardHotlead}/6 calls made
              </span>
              <button 
                onClick={testIncrement}
                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                TEST +1
              </button>
              {callsTowardHotlead === 0 && plusLeadCalls > 0 ? (
                <span className="text-green-600 text-xs font-semibold animate-pulse">
                  🔥 HOTLEAD EARNED!
                </span>
              ) : (
                <span className="text-orange-600 text-xs">
                  {callsRemaining} more needed
                </span>
              )}
            </div>

            {/* Progress Bar with Moving Flame Icon */}
            <div className="relative">
              <Progress 
                value={progressPercentage} 
                className={`h-3 transition-all duration-500 ${
                  animateProgress ? 'animate-pulse' : ''
                }`}
              />
              
              {/* Moving Flame Icon */}
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-500 ease-out"
                style={{
                  left: `calc(${Math.max(progressPercentage, 8)}% - 8px)`, // Move with progress, min 8% for visibility
                  transform: `translateY(-50%) scale(${0.8})` // 20% smaller (0.8 scale)
                }}
              >
                <Flame 
                  className={`transition-all duration-500 ${
                    // Size and intensity based on progress
                    progressPercentage === 0 
                      ? 'h-3 w-3 text-orange-300 opacity-50' // Dim start
                      : progressPercentage < 33
                      ? 'h-3 w-3 text-orange-400 opacity-70' // Low intensity
                      : progressPercentage < 66
                      ? 'h-3 w-3 text-orange-500 opacity-85' // Medium intensity  
                      : progressPercentage < 100
                      ? 'h-3 w-3 text-red-500 opacity-95' // High intensity
                      : 'h-4 w-4 text-red-600 animate-pulse' // Maximum intensity + pulse
                  } drop-shadow-sm`}
                />
              </div>
              
              {progressPercentage === 100 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-yellow-500 animate-bounce" />
                </div>
              )}
            </div>
          </div>

          {/* Manual Controls */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={addPlusCall}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Call
            </button>
            <button
              onClick={resetCalls}
              className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white text-xs rounded transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Call Summary */}
          <div className="text-xs text-orange-600 text-center bg-orange-50 px-2 py-1 rounded">
            Today: {plusLeadCalls} plus lead calls • Next hotlead in {callsRemaining} calls
          </div>
        </div>
      </CardContent>
    </Card>
  );
}