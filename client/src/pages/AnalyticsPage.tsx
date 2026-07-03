import React, { useState } from 'react';
import { UnifiedStatsCard } from '@/components/analytics/UnifiedStatsCard';

export function AnalyticsPage() {
  const [timeRange] = useState('today');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Analytics Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Real-time dials, reached, and booked tracking for All producers
            </p>
          </div>
          <div className="text-sm text-gray-500 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border">
            📊 Live data from war_connects table
          </div>
        </div>
        
        {/* Unified Real-Time Stats */}
        <UnifiedStatsCard timeRange={timeRange as 'today' | 'week' | 'month'} />
        
        <div className="mt-8 text-center text-sm text-gray-500">
          Data updates automatically every 30 seconds. All call tracking now logs to both outbound_call_history and war_connects tables.
        </div>
      </div>
    </div>
  );
}