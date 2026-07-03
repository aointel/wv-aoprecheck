import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Database, Users, DollarSign, Clock, CheckCircle, AlertCircle, Building2, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";

interface TaalkVdpLog {
  id: number;
  callId: string;
  agentName: string;
  clientName: string;
  phoneNumber: string;
  callDate: string;
  callStatus: string;
  duration: number;
  verificationResult: string;
  premiumAmount: string;
  uploadedAt: string;
  resolved: boolean;
  resolutionNotes?: string;
}

interface UploadStats {
  totalRecords: number;
  successfulUploads: number;
  errors: number;
}

interface producerBilling {
  agentId: string;
  agentName: string;
  email: string;
  mgaTeam: string | null;
  creditBalance: number;
  aoiConnects: number;
  aoiConnectCharges: number;
  missedCalls: number;
  missedCallCharges: number;
  totalCharges: number;
}

interface MgaBillingGroup {
  mgaName: string;
  producers: producerBilling[];
  totals: {
    creditBalance: number;
    aoiConnects: number;
    aoiConnectCharges: number;
    missedCalls: number;
    missedCallCharges: number;
    totalCharges: number;
  };
}

export default function AdminBillingManagement() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<TaalkVdpLog | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Taalk VDP logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['/api/admin/taalk-vdp-logs'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/taalk-vdp-logs');
      return response.json();
    }
  });

  // Fetch MGA billing report with REAL database lookups using associate IDs
  const { data: mgaBillingResponse, isLoading: isMgaLoading, error: mgaError } = useQuery({
    queryKey: ['/api/admin/mga-billing-with-lookups'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/mga-billing-with-lookups');
      const data = await response.json();
      
      console.log('📊 Admin Panel: Received MGA data with real associate ID lookups', data);
      
      // The backend now does the associate_id lookups to customers and user_credits tables
      // Return the full response to access totals from backend
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch MGA billing data');
      }
      
      return data;
    }
  });
  
  // Extract data from response
  const mgaBillingData = mgaBillingResponse?.mgaTeams || [];
  const backendTotals = {
    creditBalance: mgaBillingResponse?.totalCreditBalance || 0,
    totalCharges: mgaBillingResponse?.totalCharges || 0,
    aoiConnects: mgaBillingResponse?.totalConnects || 0,
    missedCalls: mgaBillingResponse?.totalMissed || 0
  };

  // Upload CSV mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch('/api/admin/upload-taalk-csv', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setUploadStats(data.stats);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/taalk-vdp-logs'] });
      toast({
        title: "CSV Upload Successful",
        description: `Uploaded ${data.stats.successfulUploads} records with ${data.stats.errors} errors.`,
      });
      setSelectedFile(null);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your CSV file.",
        variant: "destructive",
      });
    }
  });

  // Update resolution mutation
  const updateResolutionMutation = useMutation({
    mutationFn: async ({ id, resolved, notes }: { id: number; resolved: boolean; notes?: string }) => {
      return apiRequest('PUT', `/api/admin/taalk-vdp-logs/${id}`, {
        resolved,
        resolutionNotes: notes
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/taalk-vdp-logs'] });
      toast({
        title: "Resolution Updated",
        description: "Log resolution status has been updated.",
      });
      setSelectedLog(null);
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setUploadStats(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleResolve = (log: TaalkVdpLog, resolved: boolean, notes?: string) => {
    updateResolutionMutation.mutate({
      id: log.id,
      resolved,
      notes
    });
  };

  // Calculate summary stats
  const totalRecords = logs.length;
  const resolvedCount = logs.filter((log: TaalkVdpLog) => log.resolved).length;
  const totalPremiums = logs.reduce((sum: number, log: TaalkVdpLog) => sum + parseFloat(log.premiumAmount || '0'), 0);
  const avgDuration = logs.length > 0 ? logs.reduce((sum: number, log: TaalkVdpLog) => sum + (log.duration || 0), 0) / logs.length : 0;

  // Use backend totals instead of recalculating (more accurate)
  const mgaTotals = {
    creditBalance: backendTotals.creditBalance,
    aoiConnects: backendTotals.aoiConnects,
    aoiConnectCharges: mgaBillingData.reduce((acc: number, mga: MgaBillingGroup) => acc + mga.totals.aoiConnectCharges, 0),
    missedCalls: backendTotals.missedCalls,
    missedCallCharges: mgaBillingData.reduce((acc: number, mga: MgaBillingGroup) => acc + mga.totals.missedCallCharges, 0),
    totalCharges: backendTotals.totalCharges
  };

  const downloadMgaReport = () => {
    const csvContent = [
      ['MGA Team', 'Producer Name', 'Credit Balance', 'AOI Connects', 'AOI Charges', 'Missed Calls', 'Missed Charges', 'Total Charges'],
      ...mgaBillingData.flatMap((mga: MgaBillingGroup) => [
        ...mga.producers.map((producer: producerBilling) => [
          mga.mgaName,
          producer.agentName,
          producer.creditBalance,
          producer.aoiConnects,
          `$${producer.aoiConnectCharges.toFixed(2)}`,
          producer.missedCalls,
          `$${producer.missedCallCharges.toFixed(2)}`,
          `$${producer.totalCharges.toFixed(2)}`
        ]),
        ['', `${mga.mgaName} SUBTOTAL`, mga.totals.creditBalance, mga.totals.aoiConnects, `$${mga.totals.aoiConnectCharges.toFixed(2)}`, mga.totals.missedCalls, `$${mga.totals.missedCallCharges.toFixed(2)}`, `$${mga.totals.totalCharges.toFixed(2)}`],
        ['', '', '', '', '', '', '', ''] // Empty row
      ]),
      ['', 'AGENCY TOTAL', mgaTotals.creditBalance, mgaTotals.aoiConnects, `$${mgaTotals.aoiConnectCharges.toFixed(2)}`, mgaTotals.missedCalls, `$${mgaTotals.missedCallCharges.toFixed(2)}`, `$${mgaTotals.totalCharges.toFixed(2)}`]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `mga-billing-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Report Downloaded",
      description: "MGA billing report has been downloaded as CSV."
    });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            Admin Billing Management
          </h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive billing management, CSV uploads, and MGA reporting
          </p>
        </div>
      </div>

      <Tabs defaultValue="mga-report" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mga-report" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            MGA Billing Report
          </TabsTrigger>
          <TabsTrigger value="csv-upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            CSV Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mga-report" className="space-y-6">
          {/* MGA Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Total MGAs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{mgaBillingData.length}</div>
                <div className="text-xs text-muted-foreground">Active MGA Teams</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total producers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {mgaBillingData.reduce((acc, mga) => acc + mga.producers.length, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Active Producers</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">${backendTotals.totalCharges.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">All Billing Charges</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Credit Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{backendTotals.creditBalance}</div>
                <div className="text-xs text-muted-foreground">Total Credits Remaining</div>
              </CardContent>
            </Card>
          </div>

          {/* Download Report Button */}
          <div className="flex justify-end">
            <Button onClick={downloadMgaReport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download CSV Report
            </Button>
          </div>

          {/* MGA Billing Report Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                MGA Billing Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isMgaLoading ? (
                <div className="text-center py-8">Loading MGA billing data...</div>
              ) : (
                <div className="space-y-8">
                  {mgaBillingData.map((mga: MgaBillingGroup) => (
                    <div key={mga.mgaName} className="border rounded-lg p-4">
                      <h3 className="font-bold text-lg mb-4 text-blue-700 dark:text-blue-400">
                        MGA: {mga.mgaName || 'Unassigned'}
                      </h3>
                      
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Producer Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="text-right">Credit Balance</TableHead>
                              <TableHead className="text-right">AOI Connects</TableHead>
                              <TableHead className="text-right">AOI Charges</TableHead>
                              <TableHead className="text-right">Missed Calls</TableHead>
                              <TableHead className="text-right">Missed Charges</TableHead>
                              <TableHead className="text-right">Total Charges</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mga.producers.map((producer: producerBilling) => (
                              <TableRow key={producer.agentId}>
                                <TableCell className="font-medium">{producer.agentName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{producer.email}</TableCell>
                                <TableCell className="text-right font-medium">{producer.creditBalance}</TableCell>
                                <TableCell className="text-right">{producer.aoiConnects}</TableCell>
                                <TableCell className="text-right">${producer.aoiConnectCharges.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{producer.missedCalls}</TableCell>
                                <TableCell className="text-right">${producer.missedCallCharges.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-bold">${producer.totalCharges.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                            {/* MGA Subtotal Row */}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={2}>MGA SUBTOTAL</TableCell>
                              <TableCell className="text-right">{mga.totals.creditBalance}</TableCell>
                              <TableCell className="text-right">{mga.totals.aoiConnects}</TableCell>
                              <TableCell className="text-right">${mga.totals.aoiConnectCharges.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{mga.totals.missedCalls}</TableCell>
                              <TableCell className="text-right">${mga.totals.missedCallCharges.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-bold">${mga.totals.totalCharges.toFixed(2)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                  
                  {/* Agency Grand Total */}
                  <div className="border-t-2 pt-4 bg-muted/25 rounded-lg p-4">
                    <h3 className="font-bold text-lg mb-4 text-green-700 dark:text-green-400">AGENCY GRAND TOTAL</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{backendTotals.creditBalance}</div>
                        <div className="text-sm text-muted-foreground">Credit Balance</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{mgaTotals.aoiConnects}</div>
                        <div className="text-sm text-muted-foreground">AOI Connects</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{mgaTotals.missedCalls}</div>
                        <div className="text-sm text-muted-foreground">Missed Calls</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">${mgaTotals.totalCharges.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">Total Charges</div>
                      </div>
                    </div>
                  </div>
                  
                  {mgaBillingData.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No MGA billing data available.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv-upload" className="space-y-6">
          {/* Taalk VDP Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalRecords}</div>
            <div className="text-xs text-muted-foreground">Taalk VDP Logs</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
            <div className="text-xs text-muted-foreground">
              {totalRecords > 0 ? Math.round((resolvedCount / totalRecords) * 100) : 0}% Complete
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Premiums
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${totalPremiums.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">All Verification Calls</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{Math.round(avgDuration)}s</div>
            <div className="text-xs text-muted-foreground">Per Verification Call</div>
          </CardContent>
        </Card>
      </div>

      {/* CSV Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Taalk VDP CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="flex-1"
              data-testid="input-csv-file"
            />
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              data-testid="button-upload-csv"
            >
              {uploadMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>
          </div>

          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}

          {uploadStats && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Upload Results:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium ml-2">{uploadStats.totalRecords}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Success:</span>
                  <span className="font-medium ml-2 text-green-600">{uploadStats.successfulUploads}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="font-medium ml-2 text-red-600">{uploadStats.errors}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Taalk VDP Logs ({totalRecords} records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Call ID</TableHead>
                    <TableHead>producer</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: TaalkVdpLog) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">{log.callId}</TableCell>
                      <TableCell>{log.agentName}</TableCell>
                      <TableCell>{log.clientName}</TableCell>
                      <TableCell className="font-mono">{log.phoneNumber}</TableCell>
                      <TableCell>{log.callDate}</TableCell>
                      <TableCell>{log.duration}s</TableCell>
                      <TableCell>${parseFloat(log.premiumAmount || '0').toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={log.resolved ? "default" : "secondary"}>
                          {log.resolved ? "Resolved" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              data-testid={`button-manage-${log.id}`}
                            >
                              {log.resolved ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Manage Log - {log.callId}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><strong>producer:</strong> {log.agentName}</div>
                                <div><strong>Client:</strong> {log.clientName}</div>
                                <div><strong>Phone:</strong> {log.phoneNumber}</div>
                                <div><strong>Date:</strong> {log.callDate}</div>
                                <div><strong>Duration:</strong> {log.duration}s</div>
                                <div><strong>Premium:</strong> ${parseFloat(log.premiumAmount || '0').toFixed(2)}</div>
                              </div>
                              
                              {log.resolutionNotes && (
                                <div>
                                  <strong>Notes:</strong>
                                  <div className="bg-muted p-2 rounded text-sm mt-1">{log.resolutionNotes}</div>
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                {!log.resolved && (
                                  <Button
                                    onClick={() => handleResolve(log, true, "Marked as resolved")}
                                    className="flex-1"
                                    data-testid="button-resolve"
                                  >
                                    Mark Resolved
                                  </Button>
                                )}
                                {log.resolved && (
                                  <Button
                                    onClick={() => handleResolve(log, false)}
                                    variant="outline"
                                    className="flex-1"
                                    data-testid="button-unresolve"
                                  >
                                    Mark Unresolved
                                  </Button>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {logs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No Taalk VDP logs found. Upload a CSV file to get started.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}