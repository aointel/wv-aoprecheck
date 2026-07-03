'use client';

import { DialerState, Lead } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';

interface LeadProgressTrackerProps {
  state: DialerState;
}

export function LeadProgressTracker({ state }: LeadProgressTrackerProps) {
  const { availableLeads, currentLeadIndex } = state;
  
  // Calculate progress percentage
  const totalLeads = availableLeads.length;
  const completedLeads = currentLeadIndex;
  const progressPercentage = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress Bar Section - AT THE TOP */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Lead Progress</h3>
              <Badge variant="secondary">
                {completedLeads} / {totalLeads} Leads
              </Badge>
            </div>
            
            {/* Gradient Progress Bar */}
            <div className="relative">
              <Progress 
                value={progressPercentage} 
                className="h-3"
              />
              <div 
                className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Started</span>
              <span>{Math.round(progressPercentage)}% Complete</span>
              <span>Finished</span>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}