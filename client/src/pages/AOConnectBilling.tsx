import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, Phone, ChevronDown, ChevronRight, AlertTriangle, CreditCard, CheckCircle } from "lucide-react";

interface producer {
  agentName: string;
  agentEmail: string;
  associateId: string;
  connects: number;
  missedCalls: number;
  billing: number;
}

interface MGATeam {
  mgaName: string;
  totalConnects: number;
  totalMissedCalls: number;
  totalBilling: number;
  producers: producer[];
}

interface MissedCallproducer {
  agentEmail: string;
  agentName: string;
  missedCallCharges: number;
  missedCallCount: number;
  chargePerMissedCall: number;
}

interface MissedCallData {
  success: boolean;
  totalproducersWithCharges: number;
  totalMissedCallCharges: number;
  totalMissedCalls: number;
  chargePerMissedCall: number;
  producers: MissedCallproducer[];
}

interface BillingData {
  success: boolean;
  hierarchy: MGATeam[];
  generatedAt: string;
}

export default function AOConnectBilling() {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [missedCallData, setMissedCallData] = useState<MissedCallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMissedCalls, setLoadingMissedCalls] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [processingBilling, setProcessingBilling] = useState(false);
  const [applyingMissedCalls, setApplyingMissedCalls] = useState(false);

  useEffect(() => {
    fetchBillingData();
    fetchMissedCallData();
  }, []);

  const fetchBillingData = async () => {
    try {
      // Get current user for billing data
      const storedUser = localStorage.getItem('user');
      const currentUserEmail = storedUser || 'unknown@aoglobelife.com';
      
      const response = await fetch(`/api/billing/mga-hierarchy?userEmail=${encodeURIComponent(currentUserEmail)}`);
      const data = await response.json();
      setBillingData(data);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMissedCallData = async () => {
    try {
      // Get current user for missed call data
      const storedUser = localStorage.getItem('user');
      const currentUserEmail = storedUser || 'unknown@aoglobelife.com';
      
      const response = await fetch(`/api/billing/missed-calls/all-producers?userEmail=${encodeURIComponent(currentUserEmail)}`);
      const data = await response.json();
      setMissedCallData(data);
    } catch (error) {
      console.error('Error fetching missed call data:', error);
    } finally {
      setLoadingMissedCalls(false);
    }
  };

  const processMissedCallBilling = async () => {
    setProcessingBilling(true);
    try {
      const response = await fetch('/api/billing/missed-calls/complete-cycle', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Missed call billing processed successfully! Notifications prepared (not sent).');
        await fetchMissedCallData(); // Refresh data
      } else {
        alert('Failed to process missed call billing.');
      }
    } catch (error) {
      console.error('Error processing missed call billing:', error);
      alert('Error processing missed call billing.');
    } finally {
      setProcessingBilling(false);
    }
  };

  const syncproducerDashboards = async () => {
    setProcessingBilling(true);
    try {
      const response = await fetch('/api/billing/sync-producer-dashboards', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        alert('✅ Producer Dashboard SYNC COMPLETED! Real CSV billing data has been synced to individual producer dashboards.');
        await fetchBillingData(); // Refresh billing data
        await fetchMissedCallData(); // Refresh missed call data
      } else {
        alert('Failed to sync producer dashboards: ' + (data.details || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error syncing producer dashboards:', error);
      alert('Error syncing producer dashboards: ' + error.message);
    } finally {
      setProcessingBilling(false);
    }
  };

  const toggleTeam = (teamName: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamName)) {
      newExpanded.delete(teamName);
    } else {
      newExpanded.add(teamName);
    }
    setExpandedTeams(newExpanded);
  };

  const applyMissedCallBilling = async () => {
    setApplyingMissedCalls(true);
    try {
      const response = await fetch('/api/billing/update-missed-call-billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Missed call billing applied:', result);
        alert(`✅ Missed call billing applied! ${result.message}`);
        await fetchMissedCallData(); // Refresh the missed call data
      } else {
        console.error('❌ Missed call billing failed:', result);
        alert(`❌ Failed to apply missed call billing: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error applying missed call billing:', error);
      alert('❌ Error applying missed call billing. Please try again.');
    } finally {
      setApplyingMissedCalls(false);
    }
  };

  const sendMGAReport = async (mgaName: string, recipientEmail: string) => {
    try {
      const response = await fetch(`/api/billing/send-mga-report/${mgaName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipientEmail })
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`✅ MGA billing report sent successfully to ${recipientEmail}!`);
      } else {
        alert(`❌ Failed to send MGA report: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error sending MGA report:', error);
      alert('❌ Error sending MGA report. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!billingData || !billingData.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <p className="text-red-500">Failed to load billing data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalConnects = billingData.hierarchy.reduce((sum, team) => sum + team.totalConnects, 0);
  const totalMissedCalls = billingData.hierarchy.reduce((sum, team) => sum + team.totalMissedCalls, 0);
  const totalBilling = billingData.hierarchy.reduce((sum, team) => sum + team.totalBilling, 0);
  const totalproducers = billingData.hierarchy.reduce((sum, team) => sum + team.producers.length, 0);
  const missedCallRevenue = totalMissedCalls * 4.00;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            AO Connect Billing Report
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Real-time billing: AO Connects ($8.00) + Missed Calls ($4.00)
          </p>
          <div className="flex items-center justify-center gap-4">
            <Badge variant="secondary" className="text-sm">
              Generated: {new Date(billingData.generatedAt).toLocaleString()}
            </Badge>
            <Button 
              onClick={syncproducerDashboards} 
              disabled={processingBilling}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-sync-dashboards"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {processingBilling ? 'Syncing...' : 'Sync producer Dashboards'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-5 w-5" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalBilling.toLocaleString()}</div>
              <p className="text-green-100 text-sm">From AO Connects</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-5 w-5" />
                Total Connects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalConnects.toLocaleString()}</div>
              <p className="text-blue-100 text-sm">12+ second calls</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-5 w-5 rotate-180" />
                Missed Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalMissedCalls.toLocaleString()}</div>
              <p className="text-red-100 text-sm">${missedCallRevenue.toLocaleString()} revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-5 w-5" />
                Active Producers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalproducers}</div>
              <p className="text-purple-100 text-sm">With activity</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-5 w-5" />
                Avg per producer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${Math.round(totalBilling / totalproducers)}</div>
              <p className="text-orange-100 text-sm">Revenue per producer</p>
            </CardContent>
          </Card>
        </div>

        {/* MGA Teams Breakdown */}
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            MGA Team Breakdown
          </h2>

          {billingData.hierarchy.map((team) => (
            <Card key={team.mgaName} className="overflow-hidden">
              <CardHeader>
                <Button
                  variant="ghost"
                  onClick={() => toggleTeam(team.mgaName)}
                  className="w-full justify-between p-0 h-auto text-left"
                >
                  <CardTitle className="flex items-center gap-3 text-xl">
                    {expandedTeams.has(team.mgaName) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    {team.mgaName}
                    <Badge variant="outline">
                      {team.producers.length} producers
                    </Badge>
                  </CardTitle>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      ${team.totalBilling.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {team.totalConnects} connects • {team.totalMissedCalls} missed
                    </div>
                  </div>
                </Button>
              </CardHeader>

              {expandedTeams.has(team.mgaName) && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {team.producers.map((producer, index) => (
                      <div
                        key={producer.agentEmail}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-lg">
                            {producer.agentName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {producer.agentEmail}
                          </div>
                          {producer.associateId !== 'N/A' && (
                            <div className="text-xs text-gray-400">
                              Associate ID: {producer.associateId}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600">
                            ${producer.billing.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {producer.connects} connects • {producer.missedCalls} missed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Missed Call Billing Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Individual producer Missed Call Billing
            </h2>
            <Button 
              onClick={processMissedCallBilling} 
              disabled={processingBilling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {processingBilling ? 'Processing...' : 'Process Billing & Notifications'}
            </Button>
          </div>

          {loadingMissedCalls ? (
            <Card>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ) : missedCallData && missedCallData.success ? (
            <>
              {/* Missed Call Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-5 w-5" />
                      Total Missed Call Charges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">${missedCallData.totalMissedCallCharges.toFixed(2)}</div>
                    <p className="text-red-100 text-sm">Charged to producers</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="h-5 w-5 rotate-180" />
                      Total Missed Calls
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{missedCallData.totalMissedCalls}</div>
                    <p className="text-orange-100 text-sm">Billable events</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-5 w-5" />
                      producers with Charges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{missedCallData.totalproducersWithCharges}</div>
                    <p className="text-purple-100 text-sm">Have missed call fees</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="h-5 w-5" />
                      Per Missed Call
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">${missedCallData.chargePerMissedCall.toFixed(2)}</div>
                    <p className="text-blue-100 text-sm">Standard rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* producer Missed Call Charges List */}
              {missedCallData.producers.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <CreditCard className="h-6 w-6" />
                      producer Missed Call Charges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {missedCallData.producers.map((producer) => (
                        <div
                          key={producer.agentEmail}
                          className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-lg text-red-900 dark:text-red-100">
                              {producer.agentName}
                            </div>
                            <div className="text-sm text-red-600 dark:text-red-300">
                              {producer.agentEmail}
                            </div>
                            <div className="text-xs text-red-500 dark:text-red-400">
                              {producer.missedCallCount} missed calls × ${producer.chargePerMissedCall.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                              -${producer.missedCallCharges.toFixed(2)}
                            </div>
                            <div className="text-sm text-red-500 dark:text-red-400">
                              Billed to producer
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-green-600 dark:text-green-400">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Missed Call Charges</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        All producers have completed their calls successfully.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-red-500">Failed to load missed call billing data.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="text-center space-x-4 flex flex-wrap justify-center gap-4">
          <Button onClick={fetchBillingData} size="lg" className="px-8">
            Refresh MGA Data
          </Button>
          <Button onClick={fetchMissedCallData} size="lg" variant="outline" className="px-8">
            Refresh Missed Call Data
          </Button>
          <Button 
            onClick={applyMissedCallBilling} 
            size="lg" 
            variant="destructive" 
            className="px-8"
            disabled={applyingMissedCalls}
            data-testid="button-apply-missed-call-billing"
          >
            {applyingMissedCalls ? "💳 Applying..." : "💳 Apply Missed Call Billing"}
          </Button>
          <Button 
            onClick={() => sendMGAReport('christopherlafond', 'michaelmandella@aoglobelife.com')} 
            size="lg" 
            className="px-8 bg-blue-600 hover:bg-blue-700"
            data-testid="button-send-mga-report"
          >
            📧 Send Chris Lafond Report to Michael
          </Button>
        </div>
      </div>
    </div>
  );
}