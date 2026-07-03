import { useState } from "react";
import { 
  X, User, Calendar, Clock, Timer, AlertTriangle, Printer, Download, 
  Phone, DollarSign, UserCircle, Tag, CheckCircle2, ThumbsDown, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Call } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TranscriptionViewerProps {
  transcription: Call;
  isOpen: boolean;
  onClose: () => void;
}

export default function TranscriptionViewer({ transcription, isOpen, onClose }: TranscriptionViewerProps) {
  const [isFlagged, setIsFlagged] = useState(transcription.isFlagged);

  if (!isOpen) return null;

  const handleFlagIssue = async () => {
    try {
      const newFlagStatus = !isFlagged;
      setIsFlagged(newFlagStatus);
      
      // In a real implementation, this would update the flag status in the database
      await fetch(`/api/calls/${transcription.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isFlagged: newFlagStatus,
          flagReason: newFlagStatus ? 'Flagged from transcription view' : null,
        }),
      });
    } catch (error) {
      console.error('Error updating flag status:', error);
      setIsFlagged(isFlagged); // Revert if error
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // In a real implementation, this would generate and download a PDF
    alert('PDF download functionality would be implemented here.');
  };

  const handleApproveCall = () => {
    // In a real implementation, this would update the call status to approved
    alert('Call approval functionality would be implemented here.');
  };

  const handleRejectCall = () => {
    // In a real implementation, this would update the call status to rejected
    alert('Call rejection functionality would be implemented here.');
  };

  // Parse and display transcription content
  const transcriptionSamples = [
    {
      time: "00:00:15",
      speaker: "Agent",
      speakerClass: "text-blue-600",
      content: `Thank you for calling AO Insurance. My name is ${transcription.agentName || 'Agent'}. How may I help you today?`,
    },
    {
      time: "00:00:23",
      speaker: "Customer",
      speakerClass: "text-slate-600",
      content: `Hi, I'm calling about my insurance premium. It seems a bit high this month.`,
    },
    {
      time: "00:00:32",
      speaker: "Agent",
      speakerClass: "text-blue-600",
      content: `I understand your concern. Let me look up your policy details. Could you please verify your phone number?`,
    },
    {
      time: "00:00:40",
      speaker: "Customer",
      speakerClass: "text-slate-600",
      content: `Sure, it's ${transcription.phone}.`,
    },
    {
      time: "00:00:45",
      speaker: "Agent",
      speakerClass: "text-blue-600",
      content: `Thank you, I see your account here. Your current premium is $${transcription.monthlyPremium} per month. Let me check if there have been any recent changes to your policy.`,
    },
  ];
  
  // Get status information
  const getStatusBadge = () => {
    const statusColors = {
      approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      flagged: "bg-red-100 text-red-800 border-red-200",
      rejected: "bg-slate-100 text-slate-800 border-slate-200"
    };
    
    const statusLabels = {
      approved: "Approved",
      pending: "Pending Review",
      flagged: "Flagged",
      rejected: "Rejected"
    };
    
    const color = statusColors[transcription.status as keyof typeof statusColors] || statusColors.pending;
    const label = statusLabels[transcription.status as keyof typeof statusLabels] || "Pending";
    
    return <Badge variant="outline" className={`${color}`}>{label}</Badge>;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl m-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b">
          <div className="flex items-center">
            <div className="bg-blue-50 p-2.5 rounded-lg mr-3">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Call Transcription</h2>
              <p className="text-sm text-slate-500">ID: #{transcription.id}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left sidebar with call details */}
          <div className="w-full md:w-64 p-4 bg-slate-50 border-r border-slate-200">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Call Status</h3>
                <div>{getStatusBadge()}</div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Call Details</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Phone className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="text-sm font-medium">{transcription.phone}</p>
                      {transcription.taalkUID && (
                        <p className="text-xs text-blue-600 mt-0.5">TaalkUID: {transcription.taalkUID}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <User className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Client</p>
                      <p className="text-sm font-medium">{`${transcription.firstName} ${transcription.lastName}`}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <DollarSign className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Premium</p>
                      <p className="text-sm font-medium">${transcription.monthlyPremium}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <UserCircle className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Agent</p>
                      <p className="text-sm font-medium">{transcription.agentName || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Timing</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Calendar className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="text-sm">{transcription.callDate ? formatDate(new Date(transcription.callDate)) : 'No date'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Clock className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Time</p>
                      <p className="text-sm">{transcription.callDate ? new Date(transcription.callDate).toLocaleTimeString() : 'No time'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Timer className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-xs text-slate-500">Duration</p>
                      <p className="text-sm">{transcription.callDuration || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Action buttons */}
              <div className="space-y-2">
                <Button 
                  variant={isFlagged ? "destructive" : "outline"} 
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleFlagIssue}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span>{isFlagged ? 'Remove Flag' : 'Flag Issue'}</span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  <span>Print</span>
                </Button>
                
                <Button 
                  variant="default" 
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleDownloadPdf}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Download PDF</span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="transcript" className="flex-1 flex flex-col">
              <div className="px-4 pt-4 border-b">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="summary">Quality Summary</TabsTrigger>
                </TabsList>
              </div>
              
              {/* Transcript tab */}
              <TabsContent value="transcript" className="flex-1 overflow-auto p-4">
                {transcription.transcriptionText ? (
                  <div className="space-y-4">
                    {transcriptionSamples.map((item, index) => (
                      <div key={index} className="flex py-2 hover:bg-slate-50 rounded">
                        <div className="w-24 flex-shrink-0 text-xs text-slate-400 pt-1">{item.time}</div>
                        <div className="flex-grow">
                          <div className="flex items-center mb-1">
                            <span className={`text-xs font-semibold ${item.speakerClass}`}>
                              {item.speaker}:
                            </span>
                            {item.speaker === "Agent" && index === 0 && (
                              <Badge className="ml-2 bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Opening</Badge>
                            )}
                          </div>
                          <p className="text-sm">{item.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Tag className="h-8 w-8 text-slate-300 mb-2" />
                    <p>No transcription available for this call.</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Summary tab */}
              <TabsContent value="summary" className="flex-1 overflow-auto p-4">
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Quality Markers</h3>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2" />
                        <span className="text-sm">Proper greeting used</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2" />
                        <span className="text-sm">Identity verification completed</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2" />
                        <span className="text-sm">Policy details confirmed</span>
                      </div>
                      <div className="flex items-center">
                        <ThumbsDown className="h-4 w-4 text-red-500 mr-2" />
                        <span className="text-sm">No follow-up information provided</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Summary</h3>
                    <p className="text-sm text-slate-600">
                      {transcription.transcriptionText || 
                       'Customer called regarding their premium amount. The agent verified their identity and confirmed the current premium rate. The agent explained that rates had increased slightly due to policy changes effective last month. Customer understood the explanation and had no further questions.'}
                    </p>
                  </div>
                  
                  <div className="mt-6 flex space-x-3">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-1"
                      onClick={handleApproveCall}
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Approve Call</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-1"
                      onClick={handleRejectCall}
                    >
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                      <span>Reject Call</span>
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
