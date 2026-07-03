import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WarModal } from '@/components/WarModal';
import { DailyProductionStatus } from '@/components/DailyProductionStatus';
import { ConnectCardDeck } from '@/components/ConnectCardDeck';
import { DemoCardsButton } from '@/components/aoi-cards/demo-cards-button';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Phone,
  Target,
  BarChart3
} from 'lucide-react';

export default function AOICards() {
  const { authState } = useAuth();
  const { user } = authState;
  const [warModalOpen, setWarModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch WAR status
  const { data: warStatus, isLoading: warLoading } = useQuery({
    queryKey: ['/api/war/status'],
    enabled: !!user?.email,
  });

  // Type guard for warStatus
  const hasWarData = warStatus && typeof warStatus === 'object' && 
    'needsSubmission' in warStatus && 
    'unreportedConnects' in warStatus;

  // Get this week's date range
  const getWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    return { weekStart, weekEnd };
  };

  const { weekStart, weekEnd } = getWeekRange();

  if (warLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AOI Cards</h1>
            <p className="text-gray-600 dark:text-gray-400">Agent Connect Review System</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AOI Cards</h1>
            <p className="text-gray-600 dark:text-gray-400">Agent Connect Review System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Demo Cards Button */}
          <DemoCardsButton 
            agentEmail={user?.email || 'chrislafond@aoglobelife.com'}
            onCardsAdded={() => {
              // Refresh AOI cards after demo cards are added
              queryClient.invalidateQueries({ queryKey: ['/api/war/connects'] });
            }}
          />
          
          {hasWarData && (warStatus as any).needsSubmission && (
            <Button 
              onClick={() => setWarModalOpen(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Submit Report
            </Button>
          )}
        </div>
      </div>

      {/* Current Week Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Current Week Status - Monday-Sunday Connects
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Week of {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()} • Reports locked every Wednesday
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Unreported Connects */}
            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                    AOI Appointments & Sales
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Need disposition
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {hasWarData ? (warStatus as any).unreportedConnects || 0 : 0}
              </Badge>
            </div>

            {/* Pending Connects */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Pending Follow-ups
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Previous weeks
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {hasWarData ? (warStatus as any).pendingConnects || 0 : 0}
              </Badge>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                {hasWarData && (warStatus as any).needsSubmission ? (
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Wednesday Lock Status
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Report deadline
                  </p>
                </div>
              </div>
              <Badge 
                variant="secondary" 
                className={hasWarData && (warStatus as any).needsSubmission 
                  ? "bg-orange-100 text-orange-800" 
                  : "bg-green-100 text-green-800"
                }
              >
                {hasWarData && (warStatus as any).needsSubmission ? 'LOCKED - Report Now' : 'Current'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connect Card Deck - Gamified Review */}
      {user?.email && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Connect Review Deck 🎴
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Review your connects in a fun, interactive card deck! Swipe through and classify each one quickly.
            </p>
          </CardHeader>
          <CardContent>
            <ConnectCardDeck agentEmail={user.email} />
          </CardContent>
        </Card>
      )}

      {/* Daily Production Status */}
      {user?.email && (
        <DailyProductionStatus agentEmail={user.email} />
      )}

      {/* WAR Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* How WAR Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Daily AOI Connect Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <p className="font-medium">Daily Connect Logging</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  System tracks AOI appointments, press sales, and other connects made Monday through Sunday
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <p className="font-medium">Wednesday Lock Down</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Every Wednesday we lock down the week - you must tell us what happened with each Mon-Sun connect
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <p className="font-medium">Disposition Required</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Report final outcome: Appointment kept, Sale closed, Can't afford, Not interested, or mark Pending for more time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disposition Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              What Happened? (Dispositions)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Appointment Kept</span>
              <Badge className="bg-green-100 text-green-800">Success</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Sale Closed (with amount)</span>
              <Badge className="bg-green-100 text-green-800">Success</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Can't Afford</span>
              <Badge className="bg-yellow-100 text-yellow-800">Neutral</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Medically Uninsurable</span>
              <Badge className="bg-yellow-100 text-yellow-800">Neutral</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Not Interested</span>
              <Badge className="bg-red-100 text-red-800">No Sale</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pending (Need more time)</span>
              <Badge className="bg-blue-100 text-blue-800">Follow-up</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Required Alert */}
      {hasWarData && (warStatus as any).needsSubmission && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-900 dark:text-orange-100">
                    Wednesday Lock Down - Report Required
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    You have {(warStatus as any).unreportedConnects} AOI appointments/sales and {(warStatus as any).pendingConnects || 0} pending connects that need disposition reporting.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setWarModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Submit Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WAR Modal */}
      {warModalOpen && hasWarData && (
        <WarModal
          isOpen={warModalOpen}
          onClose={() => setWarModalOpen(false)}
          agentEmail={user?.email || ''}
          weekStart={(warStatus as any).weekStart}
          weekEnd={(warStatus as any).weekEnd}
        />
      )}
    </div>
  );
}