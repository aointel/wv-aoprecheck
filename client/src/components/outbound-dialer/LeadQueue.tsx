import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ExternalLink } from 'lucide-react';

// Hotlead gradient glow animation
const hotleadGlowStyles = `
  @keyframes hotlead-pulse {
    0%, 100% {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.6),
                  0 0 40px rgba(168, 85, 247, 0.4),
                  0 0 60px rgba(236, 72, 153, 0.3),
                  inset 0 0 20px rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.8);
    }
    50% {
      box-shadow: 0 0 30px rgba(59, 130, 246, 0.8),
                  0 0 60px rgba(168, 85, 247, 0.6),
                  0 0 90px rgba(236, 72, 153, 0.5),
                  inset 0 0 30px rgba(59, 130, 246, 0.3);
      border-color: rgba(168, 85, 247, 0.9);
    }
  }

  @keyframes gradient-shift {
    0%, 100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }

  .hotlead-glow {
    animation: hotlead-pulse 2s ease-in-out infinite;
    border-width: 2px;
    border-style: solid;
    background: linear-gradient(135deg, 
      rgba(59, 130, 246, 0.1) 0%,
      rgba(168, 85, 247, 0.1) 50%,
      rgba(236, 72, 153, 0.1) 100%);
    background-size: 200% 200%;
    animation: hotlead-pulse 2s ease-in-out infinite, 
               gradient-shift 3s ease infinite;
    position: relative;
    overflow: hidden;
  }

  .hotlead-glow::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(45deg, 
      #3b82f6, 
      #a855f7, 
      #ec4899, 
      #a855f7, 
      #3b82f6);
    background-size: 400% 400%;
    border-radius: inherit;
    z-index: -1;
    animation: gradient-shift 3s linear infinite;
    opacity: 0.6;
  }
`;

interface LeadQueueProps {
  state: any;
  callConnected?: boolean;
  planetViewTimer?: number;
  selectedMarket?: 'plus_leads' | 'hotleads';
  onMarketChange?: (market: 'plus_leads' | 'hotleads') => void;
  onViewInPlanet?: (leadId: string) => void;
  onSelectLead?: (lead: any, index: number) => void;
  plusLeadsCount?: number;
  hotleadsCount?: number;
}

export default function LeadQueue({ state, callConnected, planetViewTimer, selectedMarket, onMarketChange, onViewInPlanet, onSelectLead, plusLeadsCount = 0, hotleadsCount = 0 }: LeadQueueProps) {
  const { availableLeads, currentLeadIndex, vdpCallStatus } = state;

  // Inject hotlead glow styles
  useEffect(() => {
    const styleId = 'hotlead-glow-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = hotleadGlowStyles;
      document.head.appendChild(styleElement);
    }
  }, []);

  // Handle lead selection
  const handleLeadSelect = (lead: any, index: number) => {
    if (onSelectLead) {
      onSelectLead(lead, index);
    }
  };

  return (
    <div className="space-y-3">
      {/* Lead Queue - Simple display without market filtering */}
      <div className="space-y-3">
        {/* Show all available leads regardless of queue selection */}
        {availableLeads.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <p className="text-sm">No leads assigned</p>
            <p className="text-xs mt-2">Leads will appear here when assigned to you</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availableLeads.map((lead, index) => {
              // Check if lead was updated in the last 5 minutes (newly assigned)
              const isNewLead = lead.updated_at ? 
                (new Date().getTime() - new Date(lead.updated_at).getTime()) < 5 * 60 * 1000 : 
                false;
              
              // Check if it's a hotlead
              const isHotLead = lead.source_table === 'hotleads' || 
                               lead.market === 'Hot Lead' || 
                               lead.isHotLead === true || lead.isHotLead === 'true' || lead.isHotLead === 1 ||
                               lead.is_hot_lead === true || lead.is_hot_lead === 'true' || lead.is_hot_lead === 1 || lead?.is_hot_lead === "true";
              
              // Check if it's priority 99 (super hot/fiery) - handle string/number
              const isPriority99 = Number(lead.priority_score || lead.priority || 0) === 99;
              
              // Check if it's an AOIntel live call
              const isAOIntelLiveCall = lead.aointel === true || 
                                       lead.aointel === 1 || 
                                       (String(lead.cnresolution || '').toLowerCase() === 'pending' && lead.aointel === true);
              
              // Apply glow animation ONLY to newly assigned priority 99 hotleads
              const shouldGlow = isNewLead && isHotLead && isPriority99;
              
              return (
                <Card 
                  key={lead.id || index}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-sm ${
                    shouldGlow ? 'hotlead-glow' : ''
                  } ${
                    isAOIntelLiveCall
                      ? 'border-2 border-red-500 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 shadow-lg animate-pulse'
                      : isHotLead && isPriority99
                        ? 'border-2 border-orange-500 bg-gradient-to-r from-orange-200 via-red-100 to-orange-300 dark:from-orange-900/60 dark:via-red-900/60 dark:to-orange-900/60 shadow-orange-500/50'
                        : isHotLead
                          ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800'
                          : index === currentLeadIndex 
                            ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 shadow-lg' 
                            : 'border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20'
                  }`}
                  onClick={() => handleLeadSelect(lead, index)}
                >
                <CardContent className="p-3">
                  {/* AOIntel Live Call Banner */}
                  {isAOIntelLiveCall && (
                    <div className="mb-2 -mx-3 -mt-3 px-3 py-1.5 bg-gradient-to-r from-red-600 via-orange-600 to-red-700 text-white text-center font-bold text-xs uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                        <span>🔴 LIVE CALL</span>
                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Lead position indicator */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isAOIntelLiveCall
                          ? 'bg-red-600 text-white animate-pulse'
                          : index === currentLeadIndex 
                            ? 'bg-green-600 text-white' 
                            : 'bg-blue-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      
                      {/* Lead info */}
                      <div>
                        <div className="flex items-center gap-2">
                          {index === currentLeadIndex && (
                            <span className="text-green-600 text-sm">▶️</span>
                          )}
                          {isAOIntelLiveCall && (
                            <span className="text-red-600 text-sm animate-pulse">🔴</span>
                          )}
                          <h4 className={`font-medium text-sm ${
                            isAOIntelLiveCall ? 'text-red-700 dark:text-red-300 font-bold' : ''
                          }`}>
                            {lead.name || 'Unknown'}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {lead.state || 'Unknown'} • {lead.market || 'Standard'}
                        </p>
                        {/* Hide phone for hotleads */}
                        {lead.phone && !isHotLead && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {lead.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {onViewInPlanet && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInPlanet(lead.leadId || lead.taalk_lead_id || lead.id);
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}