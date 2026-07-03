import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, FileText, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadResult {
  success: boolean;
  message: string;
  result?: {
    imported: number;
    synced: number;
    errors: string[];
  };
}

export default function CSVUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/sync/import-ttaalk", formData);
      return response.json();
    },
    onSuccess: (data: UploadResult) => {
      setUploadResult(data);
      if (data.success) {
        toast({
          title: "Upload Successful",
          description: data.message,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Upload Error",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setUploadResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('syncToSupabase', 'false'); // Keep local for now

    uploadMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const csvTemplate = `Date,Time,Phone,Name,Duration,Voicemail,Picked By,SMS,Clicked,Transferred,Duration After Transfer,Transfer Delay,Transfer Status,Persona,Taalk_PrimaryFirstName,Taalk_AgentLastName,Taalk_MonthlyPremium,Taalk_AgentFirstName,Taalk_ClientHomeP,Recording
05/06/2025,09:30:00,555-123-4567,John Smith,05:30,No,Michael Mandella,No,Yes,No,00:00:00,00:00:00,N/A,Hot Lead,John,Smith,150.00,Michael,555-123-4567,recording-123.mp3
05/06/2025,10:15:00,555-987-6543,Sarah Johnson,08:45,No,Michael Mandella,Yes,Yes,No,00:00:00,00:00:00,N/A,Warm Lead,Sarah,Johnson,250.00,Michael,555-987-6543,recording-456.mp3`;

    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'call-data-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">CSV Upload</h1>
        <p className="text-muted-foreground mt-2">
          Import call data from CSV files into your quality tracker
        </p>
      </div>

      <div className="grid gap-6">
        {/* Template Download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Template
            </CardTitle>
            <CardDescription>
              Get the CSV template with the correct column headers and sample data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </CardContent>
        </Card>

        {/* Field Mapping Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Required CSV Columns
            </CardTitle>
            <CardDescription>
              Your CSV file must include these columns for successful import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Basic Info</h4>
                <div className="space-y-1 text-sm">
                  <Badge variant="outline">Date</Badge>
                  <Badge variant="outline">Time</Badge>
                  <Badge variant="outline">Phone Number</Badge>
                  <Badge variant="outline">Client Name</Badge>
                  <Badge variant="outline">Call Duration</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Agent Information</h4>
                <div className="space-y-1 text-sm">
                  <Badge variant="outline">Agent First Name</Badge>
                  <Badge variant="outline">Agent Last Name</Badge>
                  <Badge variant="outline">Agent ID</Badge>
                  <Badge variant="outline">Office Name</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Client & Lead Info</h4>
                <div className="space-y-1 text-sm">
                  <Badge variant="outline">Member First Name</Badge>
                  <Badge variant="outline">Member Phone</Badge>
                  <Badge variant="outline">Lead ID</Badge>
                  <Badge variant="outline">Presentation ID</Badge>
                  <Badge variant="outline">ALP Amount</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Additional Data</h4>
                <div className="space-y-1 text-sm">
                  <Badge variant="outline">Lead Type</Badge>
                  <Badge variant="outline">Call Summary</Badge>
                  <Badge variant="outline">Screenshot URL</Badge>
                  <Badge variant="outline">Recording URL</Badge>
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Field Mapping Reference</h4>
              <p className="text-xs text-muted-foreground">
                Your CSV headers should match the database column names exactly (left column):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Date</span>
                    <span>→ Date</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Time</span>
                    <span>→ Time</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Phone</span>
                    <span>→ Phone Number</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Name</span>
                    <span>→ Client Name</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Duration</span>
                    <span>→ Call Duration</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Persona</span>
                    <span>→ Lead Type</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Recording</span>
                    <span>→ Recording URL</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_AgentFirstName</span>
                    <span>→ Agent First Name</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_AgentLastName</span>
                    <span>→ Agent Last Name</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_AgentAssociateID</span>
                    <span>→ Agent ID</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_MemberFirstName</span>
                    <span>→ Member First Name</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_MemberPhone</span>
                    <span>→ Member Phone</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_LeadId</span>
                    <span>→ Lead ID</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_PresentationGUID</span>
                    <span>→ Presentation ID</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_ALP</span>
                    <span>→ ALP Amount</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_OfficeName</span>
                    <span>→ Office Name</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_WhatHappenedText</span>
                    <span>→ Call Summary</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="font-mono">Taalk_ViewScreenshotURL</span>
                    <span>→ Screenshot URL</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select and upload your CSV file with call data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="csvFile">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
            </div>

            {file && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Ready to upload: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>

            {uploadMutation.isPending && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Processing your file...</div>
                <Progress value={undefined} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Results */}
        {uploadResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {uploadResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                Upload Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className={uploadResult.success ? "border-green-200" : "border-red-200"}>
                <AlertDescription>{uploadResult.message}</AlertDescription>
              </Alert>

              {uploadResult.result && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {uploadResult.result.imported}
                      </div>
                      <div className="text-sm text-green-700">Records Imported</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {uploadResult.result.synced}
                      </div>
                      <div className="text-sm text-blue-700">Records Synced</div>
                    </div>
                  </div>

                  {uploadResult.result.errors.length > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <h4 className="font-semibold text-red-600">Errors ({uploadResult.result.errors.length})</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {uploadResult.result.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-600 p-2 bg-red-50 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}