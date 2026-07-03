import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { PhoneOff, Phone, Calendar, MapPin, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

interface MissedCallLead {
  phone: string;
  agentId: string;
  leadName: string;
  leadData: {
    'First Name'?: string;
    'Last Name'?: string;
    'Email'?: string;
    'State'?: string;
    'City'?: string;
    'Zip Code'?: string;
  };
  blasterCycles: number;
  timestamp: string;
}

interface MissedCallStats {
  agentId: string;
  agentName: string;
  agentEmail: string;
  missedCalls: number;
}

function MissedCallLeadCard({ lead }: { lead: MissedCallLead }) {
  const callLead = () => {
    // Trigger call to the lead
    window.location.href = `tel:${lead.phone}`;
  };

  const scheduleCallback = () => {
    // Open calendar to schedule callback
    console.log('Schedule callback for', lead.phone);
  };

  const firstName = lead.leadData?.['First Name'] || '';
  const lastName = lead.leadData?.['Last Name'] || '';
  const fullName = `${firstName} ${lastName}`.trim() || lead.leadName;
  const email = lead.leadData?.['Email'] || '';
  const location = [lead.leadData?.['City'], lead.leadData?.['State']].filter(Boolean).join(', ');

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <PhoneOff className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-red-700 dark:text-red-400">
                {fullName}
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-500">
                Missed Call - {lead.phone}
              </CardDescription>
            </div>
          </div>
          <Badge variant="destructive">
            {lead.blasterCycles} cycle{lead.blasterCycles !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Lead Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {email && (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{email}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{location}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {format(new Date(lead.timestamp), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          <Button
            onClick={callLead}
            className="flex-1 bg-green-600 hover:bg-green-700"
            data-testid={`button-call-${lead.phone}`}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call Now
          </Button>
          <Button
            onClick={scheduleCallback}
            variant="outline"
            className="flex-1"
            data-testid={`button-schedule-${lead.phone}`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Callback
          </Button>
        </div>

        {/* Billing Notice */}
        <div className="bg-white dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-700">
          <p className="text-xs text-red-600 dark:text-red-500">
            <strong>Billing Notice:</strong> You were charged for this missed call because the system successfully connected with {fullName} but you didn't pick up.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MissedCalls() {
  const { user } = useAuth();

  // Get missed call statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/missed-calls/stats', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      // Get user credits data to find Producer ID
      const creditsResponse = await apiRequest('GET', '/api/connectnow/user-credits');
      const creditsData = await creditsResponse.json();
      
      if (!creditsData?.associate_id) return null;
      
      const response = await apiRequest('GET', `/api/missed-calls/stats/${creditsData.associate_id}`);
      return response.json() as Promise<MissedCallStats>;
    },
    enabled: !!user?.email
  });

  // Get real missed calls data from API
  const { data: missedCallsData, isLoading: missedCallsLoading } = useQuery({
    queryKey: ['/api/agent-billing', stats?.agentId],
    queryFn: async () => {
      if (!stats?.agentId) return null;
      const response = await apiRequest('GET', `/api/agent-billing/${stats.agentId}`);
      return response.json();
    },
    enabled: !!stats?.agentId
  });

  // Extract missed calls from billing data
  const realMissedCalls: MissedCallLead[] = (missedCallsData?.data?.aoiBilling?.missedCalls || []).map((call: any) => ({
    phone: call.clientPhone,
    agentId: call.agentId,
    leadName: call.clientName,
    leadData: {
      'First Name': call.firstName,
      'Last Name': call.lastName,
      'Email': '',
      'State': '',
      'City': '',
      'Zip Code': ''
    },
    blasterCycles: 1,
    timestamp: call.callDate + 'T' + call.callTime
  }));

  if (statsLoading || missedCallsLoading) {
    return (
      <div className="space-y-8 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const missedCallCount = stats?.missedCalls || 0;
  const displayedLeads = realMissedCalls.length > 0 ? realMissedCalls : [];

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-700 dark:text-red-400">
          Missed Call Management
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Review and follow up on missed calls that were billed to your account
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Total Missed Calls</p>
                <p className="text-3xl font-bold">{missedCallCount}</p>
                <p className="text-xs text-muted-foreground">Billed to your account</p>
              </div>
              <PhoneOff className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Pending Follow-ups</p>
                <p className="text-3xl font-bold">{displayedLeads.length}</p>
                <p className="text-xs text-muted-foreground">Require action</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Recovery Rate</p>
                <p className="text-3xl font-bold">0%</p>
                <p className="text-xs text-muted-foreground">Successful callbacks</p>
              </div>
              <Phone className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missed Call Lead Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Missed Call Leads</h2>
          <Badge variant="outline" className="text-red-600 border-red-600">
            {displayedLeads.length} Active
          </Badge>
        </div>

        {displayedLeads.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedLeads.map((lead, index) => (
              <MissedCallLeadCard key={`${lead.phone}-${index}`} lead={lead} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <PhoneOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Missed Calls</h3>
              <p className="text-muted-foreground">
                {missedCallCount === 0 
                  ? "Great job! You haven't missed any calls." 
                  : "All missed calls have been resolved."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Billing Information */}
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center text-red-700 dark:text-red-400">
            <PhoneOff className="mr-2 h-5 w-5" />
            Missed Call Billing Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-red-700 dark:text-red-300 mb-4">
              <strong>How Missed Call Billing Works:</strong>
            </p>
            <ul className="text-red-600 dark:text-red-400 space-y-2">
              <li>• <strong>Billable Event:</strong> When our system successfully connects with a lead but you don't pick up</li>
              <li>• <strong>Billing Amount:</strong> $4.00 per missed call (charged to your account)</li>
              <li>• <strong>Minimum Threshold:</strong> Must complete at least 1 BLASTER cycle (10+ seconds) to be billable</li>
              <li>• <strong>No Charge:</strong> If ANY pickup occurs during the call session, no charge applies</li>
              <li>• <strong>Lead Transfer:</strong> Missed call leads are automatically transferred to your Planet account</li>
              <li>• <strong>Tracking:</strong> All missed calls are tracked in your account for follow-up</li>
            </ul>
            <p className="text-red-600 dark:text-red-400 mt-4 text-sm">
              <strong>Recovery Opportunity:</strong> Successfully calling back these leads can improve your metrics and prevent future missed calls.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}