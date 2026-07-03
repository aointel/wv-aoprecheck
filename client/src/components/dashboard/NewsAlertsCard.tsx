import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, AlertTriangle, ExternalLink } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  url?: string;
}

interface AlertItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  date: string;
}

export function NewsAlertsCard() {
  // Sample news data - replace with real API data
  const newsItems: NewsItem[] = [];

  const alerts: AlertItem[] = [
    {
      id: '1',
      title: 'Lead Response Time',
      message: 'Average response time increased by 15% this week',
      type: 'warning',
      date: '2025-08-03'
    },
    {
      id: '2',
      title: 'Credit Balance Low',
      message: 'You have 12 credits remaining for this billing period',
      type: 'info',
      date: '2025-08-03'
    }
  ];

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'product': return 'bg-green-100 text-green-800';
      case 'sales': return 'bg-purple-100 text-purple-800';
      case 'system': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="p-6 space-y-6">
        {/* News Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">News</h3>
          </div>
          
          <div className="space-y-3">
            {newsItems.length > 0 ? (
              newsItems.slice(0, 3).map((item) => (
                <div 
                  key={item.id}
                  className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm text-gray-900 leading-tight">
                      {item.title}
                    </h4>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getCategoryColor(item.category)} shrink-0`}
                    >
                      {item.category}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {item.summary}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    {item.url && (
                      <ExternalLink className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-pointer" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No recent news updates</p>
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-100"></div>

        {/* Alerts Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-lg">Alerts</h3>
          </div>
          
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.slice(0, 3).map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border ${getAlertColor(alert.type)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-medium text-sm leading-tight">
                      {alert.title}
                    </h4>
                    <span className="text-xs opacity-75 shrink-0">
                      {new Date(alert.date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-xs opacity-90">
                    {alert.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No active alerts</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}