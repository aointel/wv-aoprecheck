import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';

interface ProcessingResult {
  success: boolean;
  missedCallsFound: number;
  processed: number;
  failed: number;
  missedCalls: Array<{
    phone: string;
    agentId: string;
    leadName: string;
    blasterCycles: number;
  }>;
}

export default function MissedCallAdmin() {
  const [csvData, setCsvData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvData(content);
        toast({
          title: "CSV Loaded",
          description: `Loaded ${content.split('\n').length - 1} rows from ${file.name}`
        });
      };
      reader.readAsText(file);
    }
  };

  const processCSVData = async () => {
    if (!csvData.trim()) {
      toast({
        title: "No Data",
        description: "Please upload or paste CSV data first",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const response = await apiRequest('POST', '/api/missed-calls/process-csv', {
        csvData: csvData.trim()
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        toast({
          title: "Processing Complete",
          description: `Processed ${data.processed} missed calls, ${data.failed} failed`,
          variant: data.failed > 0 ? "destructive" : "default"
        });
      } else {
        throw new Error(data.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearData = () => {
    setCsvData('');
    setResult(null);
  };

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-700 dark:text-red-400">
          Daily Missed Call Report
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Upload your morning report to automatically bill producers for missed calls
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Daily Report Upload
          </CardTitle>
          <CardDescription>
            Upload your morning CSV report and automatically process missed call billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div>
            <label htmlFor="csv-upload" className="block text-sm font-medium mb-2">
              Upload CSV File
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              data-testid="input-csv-upload"
            />
          </div>

          <div className="text-center text-muted-foreground">OR</div>

          {/* Manual Paste */}
          <div>
            <label htmlFor="csv-data" className="block text-sm font-medium mb-2">
              Paste CSV Data
            </label>
            <Textarea
              id="csv-data"
              placeholder="Date,Time,Event,Phone,producer,Params&#10;2025-01-01,10:30:00,BLASTER,+15551234567,123,..."
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              className="min-h-32 font-mono text-xs"
              data-testid="textarea-csv-data"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              onClick={processCSVData}
              disabled={!csvData.trim() || isProcessing}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-process-csv"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Process Missed Calls
                </>
              )}
            </Button>
            
            <Button
              onClick={clearData}
              variant="outline"
              disabled={isProcessing}
              data-testid="button-clear-data"
            >
              Clear Data
            </Button>
          </div>

          {csvData && (
            <div className="text-sm text-muted-foreground">
              {csvData.split('\n').length - 1} rows loaded
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Results */}
      {result && (
        <Card className={result.failed === 0 ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20"}>
          <CardHeader>
            <CardTitle className="flex items-center">
              {result.failed === 0 ? (
                <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-600" />
              )}
              Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{result.missedCallsFound}</p>
                <p className="text-sm text-muted-foreground">Missed Calls Found</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.processed}</p>
                <p className="text-sm text-muted-foreground">Successfully Billed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-sm text-muted-foreground">Failed to Bill</p>
              </div>
            </div>

            {/* Missed Call Details */}
            {result.missedCalls.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Billed Missed Calls
                </h4>
                <div className="space-y-2">
                  {result.missedCalls.map((call, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border">
                      <div>
                        <p className="font-medium">{call.leadName}</p>
                        <p className="text-sm text-muted-foreground">{call.phone}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">producer {call.agentId}</Badge>
                        <p className="text-xs text-muted-foreground">{call.blasterCycles} cycles</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 dark:text-blue-400">
            <FileText className="mr-2 h-5 w-5" />
            CSV Format Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-blue-700 dark:text-blue-300 mb-3">
              <strong>Required CSV Format:</strong>
            </p>
            <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
              Date,Time,Event,Phone,producer,Params<br/>
              2025-01-01,10:30:00,BLASTER,+15551234567,123,...<br/>
              2025-01-01,10:30:15,PICKUP,+15551234567,123,...
            </code>
            <div className="mt-4 space-y-2 text-blue-600 dark:text-blue-400">
              <p><strong>Billing Logic:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Must have at least 1 BLASTER cycle (10+ seconds)</li>
                <li>NO pickup events during the call session</li>
                <li>Valid Producer ID in the producer column</li>
                <li>Each billable missed call increments producer's aoi_missed_calls counter</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}