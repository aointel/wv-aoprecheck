import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap, Clock, Target, CheckCircle } from 'lucide-react';

interface LightningRoundProgressProps {
  agentEmail: string;
}

interface LightningRoundData {
  isActive: boolean;
  progress: {
    agentEmail: string;
    currentMilestone: number;
    validPlusLeadCalls: number;
    requiredCalls: number;
    lightningRoundActive: boolean;
    lastUpdated: string;
  };
}

export default function LightningRoundProgress({ agentEmail }: LightningRoundProgressProps) {
  const [lightningData, setLightningData] = useState<LightningRoundData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch lightning round progress
  const fetchLightningProgress = async () => {
    if (!agentEmail) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/lightning-round/status/${agentEmail}`);
      const data = await response.json();
      
      if (data.success) {
        setLightningData(data);
      }
    } catch (error) {
      console.error('❌ Error fetching lightning round progress:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch progress on mount and every 10 seconds when active
  useEffect(() => {
    fetchLightningProgress();
    
    const interval = setInterval(() => {
      if (lightningData?.isActive) {
        fetchLightningProgress();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [agentEmail, lightningData?.isActive]);

  // Don't show if no lightning round active
  if (!lightningData?.isActive) {
    return null;
  }

  const { progress } = lightningData;
  const progressPercentage = Math.round((progress.validPlusLeadCalls / progress.requiredCalls) * 100);
  const callsRemaining = Math.max(0, progress.requiredCalls - progress.validPlusLeadCalls);

  return (
    <Card className="border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-yellow-800">
          <Zap className="h-5 w-5 animate-pulse" />
          ⚡ Lightning Round Active
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-yellow-900">Plus Lead Calls Progress</span>
            <span className="font-bold text-yellow-800">
              {progress.validPlusLeadCalls}/{progress.requiredCalls}
            </span>
          </div>
          
          <Progress 
            value={progressPercentage} 
            className="h-3 bg-yellow-200" 
          />
          
          <div className="text-center text-sm font-medium text-yellow-700">
            {progressPercentage}% Complete
          </div>
        </div>

        {/* Status */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 border border-yellow-300">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-semibold">Valid Calls</span>
            </div>
            <div className="text-xl font-bold text-green-800">
              {progress.validPlusLeadCalls}
            </div>
            <div className="text-xs text-green-600">25+ seconds each</div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-yellow-300">
            <div className="flex items-center gap-2 text-orange-700">
              <Target className="h-4 w-4" />
              <span className="font-semibold">Remaining</span>
            </div>
            <div className="text-xl font-bold text-orange-800">
              {callsRemaining}
            </div>
            <div className="text-xs text-orange-600">calls needed</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-300">
          <div className="text-sm font-semibold text-yellow-800 mb-1">
            📞 Complete 10 actual calls to ANY leads (25+ seconds each)
          </div>
          <div className="text-xs text-yellow-700">
            Plus leads OR hotleads both count! Skipped calls simply don't count toward your quota.
          </div>
        </div>

        {/* Completion Message */}
        {progress.validPlusLeadCalls >= progress.requiredCalls && (
          <div className="bg-green-100 rounded-lg p-3 border-2 border-green-400 animate-pulse">
            <div className="text-sm font-bold text-green-800 text-center">
              🎉 Lightning Round Complete! Next hot leads batch unlocked! 🎉
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}