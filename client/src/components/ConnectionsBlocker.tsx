import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Users, Clock } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface ConnectionsBlockerProps {
  children: React.ReactNode;
}

interface BlockingStatus {
  hasPendingConnections: boolean;
  pendingCount: number;
  mustReviewConnections: boolean;
}

export function ConnectionsBlocker({ children }: ConnectionsBlockerProps) {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();

  // Check if producer has pending connections requiring review
  const { data: blockingStatus, isLoading } = useQuery<BlockingStatus>({
    queryKey: ['/api/connections/check-blocking', authState?.email],
    enabled: !!authState?.email,
    refetchInterval: 10000, // Check every 10 seconds
  });

  // If loading or no blocking data, show children
  if (isLoading || !blockingStatus) {
    return <>{children}</>;
  }

  // If producer has pending connections, show blocking screen
  if (blockingStatus?.mustReviewConnections) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-purple-900 p-4 flex items-center justify-center">
        <Card className="max-w-2xl w-full bg-gray-900/80 border-orange-500/30 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-white mb-2">
              ⚠️ Connection Review Required
            </CardTitle>
            <p className="text-gray-300 text-lg">
              You have <Badge variant="outline" className="text-orange-400 border-orange-400 font-bold mx-1">
                {blockingStatus?.pendingCount || 0}
              </Badge> pending connections that need your review
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                What are Connections?
              </h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• <strong className="text-blue-400">AO Intelligence calls</strong> - Prospects you've contacted</li>
                <li>• <strong className="text-green-400">Pending connections</strong> - Follow-ups requiring attention</li>
                <li>• <strong className="text-purple-400">Call Connector Pro appointments</strong> - Scheduled meetings</li>
              </ul>
            </div>

            <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/30">
              <h3 className="text-orange-400 font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Why Review Now?
              </h3>
              <p className="text-gray-300 text-sm">
                Reviewing your connections helps track your progress, identify hot prospects, 
                and ensures no opportunities are missed. Complete your review to unlock access 
                to all platform features.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => setLocation('/connections')}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-3"
                size="lg"
              >
                Review {blockingStatus?.pendingCount || 0} Connection{(blockingStatus?.pendingCount || 0) !== 1 ? 's' : ''}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <p className="text-center text-gray-400 text-sm">
                You cannot access other features until all connections are reviewed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No pending connections - show normal content
  return <>{children}</>;
}