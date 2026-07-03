import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PhoneOff, Phone, DollarSign, Clock, User, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface MissedCall {
  id: string;
  phone: string;
  leadName: string;
  agentId: string;
  agentName: string;
  billingAmount: number;
  callAttempts: Array<{
    cycle: number;
    timestamp: string;
    event: string;
    duration: string;
  }>;
  finalStatus: 'MISSED' | 'CONNECTED';
  chargedAt: string;
}

interface MissedCallCardProps {
  missedCall: MissedCall;
}

function MissedCallCard({ missedCall }: MissedCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <Card className="mb-4 border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`card-missed-call-${missedCall.phone}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PhoneOff className="h-5 w-5 text-red-600" />
            <div>
              <CardTitle className="text-lg" data-testid={`text-lead-name-${missedCall.phone}`}>
                {missedCall.leadName}
              </CardTitle>
              <CardDescription data-testid={`text-call-details-${missedCall.phone}`}>
                {missedCall.phone} • producer {missedCall.agentId} ({missedCall.agentName})
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-lg font-bold text-red-600" data-testid={`text-billing-amount-${missedCall.phone}`}>
                ${missedCall.billingAmount.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500" data-testid={`text-charged-date-${missedCall.phone}`}>
                {missedCall.chargedAt}
              </div>
            </div>
            {isExpanded ? 
              <ChevronUp className="h-5 w-5" data-testid={`icon-collapse-${missedCall.phone}`} /> : 
              <ChevronDown className="h-5 w-5" data-testid={`icon-expand-${missedCall.phone}`} />
            }
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="border-t bg-gray-50 dark:bg-gray-900/50">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300">
              📋 BILLING PROOF - WHY THIS CALL WAS CHARGED:
            </h4>
            
            <div className="space-y-2">
              {missedCall.callAttempts.map((attempt, index) => (
                <div 
                  key={index} 
                  className="animate-in slide-in-from-left duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`cycle-proof-${missedCall.phone}-${index}`}
                >
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border-l-4 border-orange-500">
                    <div className="flex items-center space-x-3">
                      <span className="text-orange-600 font-bold">🔄 CYCLE {attempt.cycle}</span>
                      <span className="text-sm">{attempt.event} - {attempt.duration}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{attempt.timestamp}</span>
                  </div>
                </div>
              ))}
              
              <div className="animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${missedCall.callAttempts.length * 100 + 200}ms` }}>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-500 mt-4">
                  <div className="text-center space-y-2">
                    <div className="text-red-700 dark:text-red-400 font-bold">
                      💸 RESULT: NO PICKUP AFTER {missedCall.callAttempts.length} CYCLES
                    </div>
                    <div className="text-xl font-bold text-red-600 bg-white dark:bg-gray-800 px-4 py-2 rounded">
                      CHARGE: ${missedCall.billingAmount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">
                      Lead transferred to Planet account
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function MissedCallValidation() {
  const { toast } = useToast();
  
  // Fetch actual missed calls from the database
  const { data: missedCalls = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/missed-calls/recent'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading missed calls...</p>
        </div>
      </div>
    );
  }

  const totalBillingAmount = missedCalls.reduce((sum: number, call: MissedCall) => sum + call.billingAmount, 0);

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4 text-red-700 dark:text-red-400">
          💸 Missed Call Billing Proof
        </h1>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
          Review all missed calls with detailed proof of why producers were charged $4.00. Click any call to see the complete timeline.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Total Missed Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-missed-calls">
              {missedCalls.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Total Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-billing">
              ${totalBillingAmount.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Average per Call</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-average-billing">
              ${missedCalls.length > 0 ? (totalBillingAmount / missedCalls.length).toFixed(2) : '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Recent Missed Calls</h2>
        <Button 
          onClick={() => refetch()}
          variant="outline"
          className="gap-2"
          data-testid="button-refresh-calls"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Missed Calls List */}
      <div className="space-y-4">
        {missedCalls.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Missed Calls</h3>
              <p className="text-muted-foreground">
                Great work! There are no missed calls requiring billing validation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {missedCalls.map((missedCall: MissedCall) => (
              <MissedCallCard key={missedCall.id} missedCall={missedCall} />
            ))}
            
            {/* Total Summary */}
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <DollarSign className="h-6 w-6 text-red-600" />
                    <div>
                      <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                        Total Billing for Period
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {missedCalls.length} missed calls with complete proof
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-red-600" data-testid="text-final-total">
                      ${totalBillingAmount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">
                      All leads transferred to Planet accounts
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}