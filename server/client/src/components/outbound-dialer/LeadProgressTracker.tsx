'use client';

import { DialerState, Lead } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Mail, Building2 } from 'lucide-react';

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

      {/* Lead Queue Section - BELOW PROGRESS BAR */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Lead Queue</h3>
            
            {availableLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No leads available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableLeads.slice(currentLeadIndex).map((lead, index) => {
                  const isActive = index === 0; // First in remaining queue is active
                  const actualIndex = currentLeadIndex + index;
                  
                  return (
                    <div
                      key={lead.id}
                      className={`
                        p-2 rounded border transition-all duration-200
                        ${isActive 
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <span className={`
                              text-xs font-medium truncate
                              ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}
                            `}>
                              {lead.name}
                            </span>
                            {isActive && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                Active
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-[10px] text-muted-foreground truncate">
                            <Phone className="h-2.5 w-2.5 inline mr-1" />
                            {lead.phone}
                          </div>
                          
                          {lead.city && lead.state && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              <MapPin className="h-2.5 w-2.5 inline mr-1" />
                              {lead.city}, {lead.state}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right ml-2 flex-shrink-0">
                          <div className="text-[10px] text-muted-foreground">
                            #{actualIndex + 1}
                          </div>
                          {lead.call_count > 0 && (
                            <div className="text-[10px] text-orange-600 dark:text-orange-400">
                              {lead.call_count}x
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}