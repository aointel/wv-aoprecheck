import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Loader2 } from 'lucide-react';

interface LocalPresenceStats {
  success: boolean;
  totalStates: number;
  stateStats: Array<{
    state: string;
    numberCount: number;
  }>;
  message: string;
}

export function LocalPresenceDisplay() {
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/outbound-dialer/local-presence'],
    enabled: showDetails,
    refetchOnWindowFocus: false,
  });

  const presenceData = data as LocalPresenceStats;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-blue-600" />
          Local Presence Dialing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowDetails(!showDetails);
                if (!showDetails) {
                  refetch();
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Phone className="w-4 h-4 mr-2" />
              )}
              {showDetails ? 'Hide Details' : 'Check Available Numbers'}
            </Button>
          </div>

          {showDetails && presenceData && (
            <div className="mt-4">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  📍 {presenceData.message}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                  Total coverage: {presenceData.totalStates} states
                </p>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Available Numbers by State:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {presenceData.stateStats
                    .sort((a, b) => b.numberCount - a.numberCount)
                    .map((stat) => (
                      <div
                        key={stat.state}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs"
                      >
                        <span className="font-medium">{stat.state}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            stat.numberCount > 3
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : stat.numberCount > 1
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {stat.numberCount}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-xs text-green-700 dark:text-green-300">
                  💡 <strong>Local Presence Active:</strong> When calling leads, the system automatically selects a local phone number from their state to improve answer rates.
                </p>
              </div>
            </div>
          )}

          {showDetails && !presenceData && !isLoading && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Unable to load local presence data. Check Twilio configuration.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}