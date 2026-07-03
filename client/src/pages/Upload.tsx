import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CSVRow {
  taalkLeadId: string;
  associateId: string;
  leadInbox: string;
}

interface UploadResult {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  errors: Array<{ row: number; taalkLeadId: string; error: string }>;
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { authState } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);

  // Access control: System admins only
  const userEmail = authState?.user?.email?.toLowerCase();
  const isSysOp = userEmail === 'cnsysop@aoglobelife.com' || userEmail === 'robhay@aoglobelife.com';

  // Redirect if not sysop
  React.useEffect(() => {
    if (authState.initialized && !isSysOp) {
      toast({
        title: "Access Denied",
        description: "This page is only accessible to system administrators.",
        variant: "destructive"
      });
      setLocation('/dashboard');
    }
  }, [authState.initialized, isSysOp, setLocation, toast]);

  if (!authState.initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isSysOp) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                This page is only accessible to system administrators.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file.",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    setUploadResult(null);
    setPreviewData([]);

    // Preview CSV data
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV file must have a header row and at least one data row.",
          variant: "destructive"
        });
        return;
      }

      // Parse CSV line handling quoted values
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      // Parse header - be flexible with column names
      const header = parseCSVLine(lines[0]);
      const headerLower = header.map(h => h.toLowerCase());
      
      // Look for Lead ID column (flexible matching)
      const leadIdIndex = headerLower.findIndex(h => 
        (h.includes('lead') && h.includes('id')) || 
        h === 'id' || 
        h === 'leadid' ||
        h === 'lead_id' ||
        h === 'taalk_lead_id' ||
        h === 'taalk lead id'
      );
      
      // Look for Associate ID column (flexible matching)
      const associateIdIndex = headerLower.findIndex(h => 
        (h.includes('associate') && h.includes('id')) ||
        h === 'associateid' ||
        h === 'associate_id' ||
        h === 'associate id'
      );
      
      // Look for Lead inbox column (flexible matching)
      const leadInboxIndex = headerLower.findIndex(h => 
        (h.includes('lead') && h.includes('inbox')) ||
        h === 'leadinbox' ||
        h === 'lead_inbox' ||
        h === 'lead inbox' ||
        h === 'inbox'
      );

      if (leadIdIndex === -1 || associateIdIndex === -1 || leadInboxIndex === -1) {
        toast({
          title: "Invalid CSV Format",
          description: `CSV must contain columns: Lead ID (or Taalk_Lead_Id), Associate ID, and Lead inbox. Found: ${header.join(', ')}`,
          variant: "destructive"
        });
        return;
      }

      // Parse data rows
      const data: CSVRow[] = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) { // Preview first 10 rows
        const values = parseCSVLine(lines[i]);
        if (values.length > Math.max(leadIdIndex, associateIdIndex, leadInboxIndex)) {
          data.push({
            taalkLeadId: values[leadIdIndex] || '',
            associateId: values[associateIdIndex] || '',
            leadInbox: values[leadInboxIndex] || ''
          });
        }
      }

      setPreviewData(data);
    };
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch('/api/upload/ao-lead-box-assignment', {
        method: 'POST',
        headers: {
          'x-user-email': authState?.user?.email || '',
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadResult(result);
      
      toast({
        title: "Upload Complete",
        description: `Processed ${result.processed} leads successfully. ${result.failed > 0 ? `${result.failed} failed.` : ''}`,
        variant: result.failed > 0 ? "default" : "default"
      });

      // Clear file after successful upload
      if (result.failed === 0) {
        setFile(null);
        setPreviewData([]);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "An error occurred while uploading the file.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            AO Lead Box Assignment Upload
          </CardTitle>
          <CardDescription>
            Upload a CSV file to assign leads to AO lead box owners. CSV must contain: Taalk_Lead_Id, Associate ID, and Lead inbox columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <p className="text-sm text-muted-foreground">
              CSV format: Taalk_Lead_Id, Associate ID, Lead inbox
            </p>
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first {previewData.length} rows)</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Taalk Lead ID</th>
                      <th className="px-4 py-2 text-left font-semibold">Associate ID</th>
                      <th className="px-4 py-2 text-left font-semibold">Lead Inbox</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2">{row.taalkLeadId}</td>
                        <td className="px-4 py-2">{row.associateId}</td>
                        <td className="px-4 py-2">{row.leadInbox}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload and Process
              </>
            )}
          </Button>

          {/* Results */}
          {uploadResult && (
            <Alert variant={uploadResult.failed > 0 ? "default" : "default"}>
              <div className="flex items-start gap-3">
                {uploadResult.failed === 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertTitle>Upload Results</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-1">
                      <p>Total rows: {uploadResult.total}</p>
                      <p className="text-green-600">Successfully processed: {uploadResult.processed}</p>
                      {uploadResult.failed > 0 && (
                        <p className="text-red-600">Failed: {uploadResult.failed}</p>
                      )}
                      {uploadResult.errors.length > 0 && (
                        <div className="mt-3">
                          <p className="font-semibold mb-2">Errors:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {uploadResult.errors.slice(0, 10).map((error, index) => (
                              <li key={index}>
                                Row {error.row} (Lead ID: {error.taalkLeadId}): {error.error}
                              </li>
                            ))}
                            {uploadResult.errors.length > 10 && (
                              <li className="text-muted-foreground">
                                ... and {uploadResult.errors.length - 10} more errors
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
