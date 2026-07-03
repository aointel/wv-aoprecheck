import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { segmentedFetch } from '@/lib/queryClient';
import { CheckCircle, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MarketCounts {
  globe_leads: number;
  veteran_leads: number;
  plus_leads: number;
  willkit_leads: number;
  connectnow_leads: number;
  hot_leads: number;
}

interface MarketSelectorProps {
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  agentEmail?: string;
}

const marketConfig = {
  hot_leads: {
    label: 'Hot Lead',
    selectedColor: 'bg-red-600 border-red-400 text-white animate-pulse'
  },
  globe_leads: {
    label: 'Globe Market',
    selectedColor: 'bg-blue-600 border-blue-400 text-white'
  },
  veteran_leads: {
    label: 'Veteran', 
    selectedColor: 'bg-green-600 border-green-400 text-white'
  },
  plus_leads: {
    label: 'Plus Lead',
    selectedColor: 'bg-purple-600 border-purple-400 text-white'
  },
  willkit_leads: {
    label: 'Will Kit',
    selectedColor: 'bg-orange-600 border-orange-400 text-white'
  },
  connectnow_leads: {
    label: 'ConnectNow',
    selectedColor: 'bg-cyan-600 border-cyan-400 text-white'
  }
};

export function MarketSelector({ selectedMarkets, onMarketsChange, agentEmail }: MarketSelectorProps) {
  // Fetch market statistics - only if agentEmail is provided
  const { data: marketStats, isLoading } = useQuery({
    queryKey: ['/api/outbound-dialer/market-stats', agentEmail],
    queryFn: async () => {
      if (!agentEmail) {
        throw new Error('No Producer Email provided');
      }
      const response = await segmentedFetch('/api/outbound-dialer/market-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail: agentEmail })
      });
      if (!response.ok) throw new Error('Failed to fetch market stats');
      return response.json();
    },
    enabled: !!agentEmail, // Only run query if agentEmail exists
    refetchInterval: 300000 // 5 min
  });

  const marketCounts: MarketCounts = marketStats?.marketCounts || {
    hot_leads: 0,
    globe_leads: 0,
    veteran_leads: 0,
    plus_leads: 0,
    willkit_leads: 0,
    connectnow_leads: 0
  };

  const toggleMarket = (marketType: string) => {
    // Hot Lead is permanently selected and cannot be deselected
    if (marketType === 'hot_leads') {
      return; // Block deselection of Hot Lead
    }
    
    const isSelected = selectedMarkets.includes(marketType);
    if (isSelected) {
      // Remove market from selection
      onMarketsChange(selectedMarkets.filter(m => m !== marketType));
    } else {
      // Add market to selection
      onMarketsChange([...selectedMarkets, marketType]);
    }
  };

  const totalSelectedLeads = selectedMarkets.reduce((sum, market) => {
    return sum + (marketCounts[market as keyof MarketCounts] || 0);
  }, 0);

  return (
    <Card className="h-auto">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Market Selection
          <Badge variant="outline" className="text-xs">
            {totalSelectedLeads} leads
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between text-sm">
              {selectedMarkets.length === 0 
                ? 'Select Markets' 
                : selectedMarkets.length === 1 
                  ? marketConfig[selectedMarkets[0] as keyof typeof marketConfig]?.label
                  : `${selectedMarkets.length} markets selected`
              }
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {Object.entries(marketConfig).map(([marketType, config]) => {
              const count = marketCounts[marketType as keyof MarketCounts] || 0;
              const isSelected = selectedMarkets.includes(marketType);
              const isHotLead = marketType === 'hot_leads';
              
              return (
                <DropdownMenuCheckboxItem
                  key={marketType}
                  checked={isSelected}
                  onCheckedChange={() => toggleMarket(marketType)}
                  className={`flex items-center justify-between ${isHotLead ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isHotLead ? 'text-red-600' : ''}`}>
                      {config.label}
                      {isHotLead && <span className="text-xs ml-1 text-red-500">(Auto-Selected)</span>}
                    </span>
                    {isHotLead && count > 0 && (
                      <span className="text-orange-500 animate-pulse">🔥</span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs ml-2">
                    {isLoading ? '...' : count}
                  </Badge>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedMarkets.length > 0 && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-medium text-blue-900 dark:text-blue-100">
                  Active Markets
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {selectedMarkets.map(market => {
                    const config = marketConfig[market as keyof typeof marketConfig];
                    return config ? config.label : market;
                  }).join(', ')}
                </p>
              </div>
              <Badge className="bg-blue-600 text-white text-xs">
                {totalSelectedLeads} ready
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}