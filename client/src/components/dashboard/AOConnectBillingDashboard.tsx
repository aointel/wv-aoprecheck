import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Download, Users, TrendingUp, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { Link } from 'wouter';

interface BillingSummary {
  totalConnects: number;
  totalBilling: number;
  topproducers: Array<{
    agentName: string;
    connects: number;
    billing: number;
  }>;
}

interface MGATeam {
  mgaName: string;
  totalConnects: number;
  totalBilling: number;
  producers: Array<{
    agentName: string;
    agentEmail: string;
    associateId: string;
    connects: number;
    billing: number;
  }>;
}

interface MGAHierarchy {
  success: boolean;
  hierarchy: MGATeam[];
  generatedAt: string;
}

export function AOConnectBillingDashboard() {
  const [expandedMGAs, setExpandedMGAs] = useState<Set<string>>(new Set());

  // Fetch MGA hierarchy data
  const { data: mgaHierarchy, isLoading } = useQuery({
    queryKey: ['/api/billing/mga-hierarchy'],
    queryFn: async (): Promise<MGAHierarchy> => {
      const response = await fetch('/api/billing/mga-hierarchy');
      if (!response.ok) throw new Error('Failed to fetch MGA hierarchy');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleDownloadReport = () => {
    window.open('/api/billing/report/connect?format=csv', '_blank');
  };

  const toggleMGA = (mgaName: string) => {
    const newExpanded = new Set(expandedMGAs);
    if (newExpanded.has(mgaName)) {
      newExpanded.delete(mgaName);
    } else {
      newExpanded.add(mgaName);
    }
    setExpandedMGAs(newExpanded);
  };

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-green-600/20"></div>
        <CardHeader className="relative z-10">
          <CardTitle className="text-xl flex items-center gap-3 text-blue-700 dark:text-blue-300">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            💰 MGA Billing Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-blue-200 rounded w-3/4"></div>
            <div className="h-4 bg-blue-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalConnects = mgaHierarchy?.hierarchy?.reduce((sum, team) => sum + team.totalConnects, 0) || 0;
  const totalBilling = mgaHierarchy?.hierarchy?.reduce((sum, team) => sum + team.totalBilling, 0) || 0;

  return (
    <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-green-600/20"></div>
      <CardHeader className="relative z-10">
        <CardTitle className="text-xl flex items-center gap-3 text-blue-700 dark:text-blue-300">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          💰 MGA Billing Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {/* Total Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{totalConnects}</div>
              <div className="text-sm text-blue-600/80">Total AO Connects</div>
            </div>
            <div className="p-3 bg-green-50/50 dark:bg-green-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">${totalBilling.toLocaleString()}</div>
              <div className="text-sm text-green-600/80">Total Billing</div>
            </div>
          </div>

          {/* MGA Teams Hierarchy */}
          {mgaHierarchy?.hierarchy && mgaHierarchy.hierarchy.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                MGA Teams & producers
              </h4>
              
              {mgaHierarchy.hierarchy.map((team) => (
                <div key={team.mgaName} className="border border-slate-200 dark:border-slate-600 rounded-lg">
                  {/* MGA Team Header */}
                  <div 
                    className="p-3 bg-slate-50/60 dark:bg-slate-700/60 rounded-t-lg cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-600/60 transition-colors"
                    onClick={() => toggleMGA(team.mgaName)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {expandedMGAs.has(team.mgaName) ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {team.mgaName}
                        </div>
                        <div className="text-sm text-slate-500">
                          ({team.producers.length} producers)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          ${team.totalBilling.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500">
                          {team.totalConnects} connects
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Producer List (Expanded) */}
                  {expandedMGAs.has(team.mgaName) && (
                    <div className="border-t border-slate-200 dark:border-slate-600">
                      {team.producers.map((producer, index) => (
                        <div 
                          key={`${producer.agentEmail}-${index}`}
                          className="p-3 border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50/40 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                {producer.agentName}
                              </div>
                              <div className="text-xs text-slate-500">
                                ID: {producer.associateId} • {producer.agentEmail}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">
                                ${producer.billing.toLocaleString()}
                              </div>
                              <div className="text-xs text-slate-500">
                                {producer.connects} connects
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              onClick={handleDownloadReport}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV Report
            </Button>
            
            <Link href="/dashboard/billing-reports">
              <Button 
                variant="outline"
                className="w-full border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 font-medium transition-colors"
                size="sm"
              >
                <Users className="w-4 h-4 mr-2" />
                All Reports
              </Button>
            </Link>
          </div>

          {/* Last Updated */}
          <div className="text-xs text-slate-500 text-center">
            Updates every 30s • $8.00 per connect
          </div>
        </div>
      </CardContent>
    </Card>
  );
}