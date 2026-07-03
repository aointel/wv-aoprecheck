import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp } from 'lucide-react';

interface WeeklySalesData {
  success: boolean;
  agentEmail: string;
  weeklyTotal: number;
  reportsCount: number;
  salesCount: number;
  plusLeadsTotal: number;
  detailedSalesTotal: number;
  detailedSalesCount: number;
  weekStart: string;
  lastUpdated: string;
}

interface WeeklySalesTotalProps {
  agentEmail: string;
}

export function WeeklySalesTotal({ agentEmail }: WeeklySalesTotalProps) {
  const { data: salesData, isLoading, error } = useQuery<WeeklySalesData>({
    queryKey: ['/api/accountability/weekly-sales-total', agentEmail],
    queryFn: async () => {
      const response = await fetch(`/api/accountability/weekly-sales-total?agentEmail=${encodeURIComponent(agentEmail)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch weekly sales total');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
        <div className="text-5xl font-bold mb-2 text-white">
          <div className="w-32 h-12 bg-white/20 rounded animate-pulse"></div>
        </div>
        <div className="text-green-200 text-lg font-semibold">AOI ALP</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
        <div className="text-5xl font-bold mb-2 text-white">$0</div>
        <div className="text-red-200 text-lg font-semibold">AOI ALP</div>
        <div className="text-red-300 text-sm mt-1">Error loading data</div>
      </div>
    );
  }

  // Use detailed sales total if available, otherwise use weekly total from daily_accountability
  const displayTotal = (salesData?.detailedSalesTotal || 0) > 0 ? (salesData?.detailedSalesTotal || 0) : (salesData?.weeklyTotal || 0);
  const salesCount = (salesData?.detailedSalesCount || 0) > 0 ? (salesData?.detailedSalesCount || 0) : (salesData?.salesCount || 0);

  // Format currency
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(displayTotal);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-6 w-6 text-green-200" />
        <TrendingUp className="h-5 w-5 text-green-200" />
      </div>
      <div className="text-5xl font-bold mb-2 text-white">{formattedTotal}</div>
      <div className="text-green-200 text-lg font-semibold">AOI ALP</div>
      {salesCount > 0 && (
        <div className="text-green-300 text-sm">{salesCount} sales this week</div>
      )}
      {(salesData?.plusLeadsTotal || 0) > 0 && (
        <div className="text-purple-300 text-sm">{salesData?.plusLeadsTotal} Plus leads this week</div>
      )}
      {salesCount > 0 && false && (
        <div className="text-green-100 text-sm mt-1">
          {salesCount} sale{salesCount !== 1 ? 's' : ''} this week
        </div>
      )}
      {displayTotal === 0 && (
        <div className="text-blue-200 text-sm mt-1">
          No sales recorded this week
        </div>
      )}
    </div>
  );
}