import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MdPhone, 
  MdCheckCircle, 
  MdCalendarToday,
  MdTrendingUp 
} from 'react-icons/md';

interface CallTrackersProps {
  dialedCount: number;
  reachedCount: number;
  bookedCount: number;
}

export default function CallTrackers({ dialedCount, reachedCount, bookedCount }: CallTrackersProps) {
  const conversionRate = reachedCount > 0 ? Math.round((bookedCount / reachedCount) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
      {/* Dialed */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <MdPhone className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Dialed
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {dialedCount}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
              Total
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Reached */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <MdCheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">
                  Reached
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {reachedCount}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
              Connected
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Booked */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <MdCalendarToday className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  Booked
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {bookedCount}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
              Appointments
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rate */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                  <MdTrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  Rate
                </p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {conversionRate}%
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
              Conversion
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}