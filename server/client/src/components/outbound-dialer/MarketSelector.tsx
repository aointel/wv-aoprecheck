import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';

interface MarketCounts {
  globe_leads: number;
  masterlead: number;
  plus_leads: number;
  willkit_leads: number;
  connectnow_leads: number;
}

interface MarketSelectorProps {
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  agentEmail?: string;
}

const marketConfig = {
  globe_leads: {
    label: 'Globe',
    selectedColor: 'bg-blue-600 border-blue-400 text-white'
  },
  masterlead: {
    label: 'Masterlead', 
    selectedColor: 'bg-green-600 border-green-400 text-white'
  },
  plus_leads: {
    label: 'Plus',
    selectedColor: 'bg-purple-600 border-purple-400 text-white'
  },
  willkit_leads: {
    label: 'Will Kit',
    selectedColor: 'bg-orange-600 border-orange-400 text-white'
  },
  connectnow_leads: {
    label: 'CNow',
    selectedColor: 'bg-cyan-600 border-cyan-400 text-white'
  }
};

export function MarketSelector({ selectedMarkets, onMarketsChange, agentEmail }: MarketSelectorProps) {
  // Fetch market statistics - only if agentEmail is provided
  const { data: marketStats, isLoading } = useQuery({
    queryKey: ['/api/outbound-dialer/market-stats', agentEmail],
    queryFn: async () => {
      if (!agentEmail) {
        throw new Error('No agent email provided');
      }
      const response = await fetch('/api/outbound-dialer/market-stats', {
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
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const marketCounts: MarketCounts = marketStats?.marketCounts || {
    globe_leads: 0,
    veteran_leads: 0,
    plus_leads: 0,
    willkit_leads: 0,
    connectnow_leads: 0
  };

  const toggleMarket = (marketType: string) => {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Market Selection
        </h3>
        <Badge variant="outline" className="text-xs">
          {totalSelectedLeads} leads
        </Badge>
      </div>

      {selectedMarkets.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
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
      
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(marketConfig).map(([marketType, config]) => {
          const count = marketCounts[marketType as keyof MarketCounts] || 0;
          const isSelected = selectedMarkets.includes(marketType);
          
          return (
            <Card 
              key={marketType}
              className={`cursor-pointer transition-all duration-200 border ${
                isSelected 
                  ? config.selectedColor + ' shadow-md' 
                  : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => toggleMarket(marketType)}
            >
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  {isSelected && <CheckCircle className="h-4 w-4" />}
                </div>
                
                <h4 className="font-semibold text-sm mb-1">
                  {config.label}
                </h4>
                
                <div className="text-lg font-bold">
                  {isLoading ? '...' : count}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedMarkets.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p className="text-xs">Select markets to load leads</p>
        </div>
      )}
    </div>
  );
}