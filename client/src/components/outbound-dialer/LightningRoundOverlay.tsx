import React, { useEffect } from 'react';
import { Zap, Trophy, Target, Crown, Flame } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface LightningRoundOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  milestoneData: {
    name: string;
    target: number;
    bonusLeads: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  };
  totalDials: number;
}

export default function LightningRoundOverlay({ 
  isVisible, 
  onClose, 
  milestoneData, 
  totalDials 
}: LightningRoundOverlayProps) {
  
  // Auto-close after 5 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  const isLegendAchievement = milestoneData.name === 'Legend';

  return (
    <Dialog open={isVisible} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-4 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="text-center space-y-6 p-4">
          
          {/* Achievement Header */}
          <div className="space-y-3">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
              {milestoneData.icon && React.cloneElement(milestoneData.icon as React.ReactElement, {
                className: "h-10 w-10 text-white"
              })}
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">
                🎉 MILESTONE ACHIEVED! 🎉
              </h2>
              <div className="text-xl font-semibold text-orange-700">
                {milestoneData.name.toUpperCase()} LEVEL UNLOCKED
              </div>
            </div>
          </div>

          {/* Achievement Stats */}
          <div className="bg-white rounded-lg p-4 border-2 border-yellow-300 space-y-3">
            <div className="text-2xl font-bold text-gray-900">
              {totalDials} Calls Complete! 🔥
            </div>
            
            <div className="text-lg font-semibold text-green-700">
              +{milestoneData.bonusLeads} Hot Leads Earned! 
            </div>
          </div>

          {/* Lightning Round Announcement */}
          {!isLegendAchievement && (
            <div className="bg-gradient-to-r from-yellow-200 to-orange-200 rounded-lg p-4 border-2 border-yellow-400 space-y-3 animate-bounce">
              <div className="flex items-center justify-center gap-2 text-xl font-bold text-yellow-800">
                <Zap className="h-6 w-6" />
                ⚡ LIGHTNING ROUND ACTIVATED! ⚡
                <Zap className="h-6 w-6" />
              </div>
              
              <div className="text-lg font-semibold text-yellow-900">
                Complete 10 Plus Leads to unlock your next batch of Hot Leads!
              </div>
              
              <div className="text-sm text-yellow-700 font-medium">
                🎯 Variety keeps you sharp! Mix hot leads with plus leads for maximum performance.
              </div>
            </div>
          )}

          {/* Legend Achievement Special */}
          {isLegendAchievement && (
            <div className="bg-gradient-to-r from-orange-200 to-red-200 rounded-lg p-4 border-2 border-orange-400 space-y-3">
              <div className="flex items-center justify-center gap-2 text-xl font-bold text-orange-800">
                <Trophy className="h-6 w-6" />
                🏆 LEGEND STATUS ACHIEVED! 🏆
                <Trophy className="h-6 w-6" />
              </div>
              
              <div className="text-lg font-semibold text-orange-900">
                You've reached the pinnacle of calling excellence!
              </div>
              
              <div className="text-sm text-orange-700 font-medium">
                🌟 Keep going to maintain your legendary status!
              </div>
            </div>
          )}

          {/* Auto-close notice */}
          <div className="text-xs text-gray-500">
            Click anywhere to close • Auto-closing in 5 seconds
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}