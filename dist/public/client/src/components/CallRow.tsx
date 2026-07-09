import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Play, AlertTriangle, Flag, Check, X, FileText, 
  Image, ChevronDown, Trash2 
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AudioPlayer from "./AudioPlayer";
import TranscriptModal from "./TranscriptModal";
import ScreenshotModal from "./ScreenshotModal";
import { Call } from "@shared/schema";

// Utility function to format phone numbers
function formatPhoneNumber(phone: string): string {
  if (!phone) return 'N/A';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle different phone number lengths
  if (cleaned.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // Format as +1 (XXX) XXX-XXXX
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length > 10) {
    // International format - just add dashes for readability
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  
  // Return original if can't format
  return phone;
}

// Utility function to format producer names with proper capitalization
function formatAgentName(name: string): string {
  if (!name) return 'Unknown Producer';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Utility function to format client names with proper capitalization
function formatClientName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CallRowProps {
  call: Call;
}

export default function CallRow({ call }: CallRowProps) {
  const { toast } = useToast();
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [showTranscriptOnly, setShowTranscriptOnly] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  
  // Toggle flag status mutation
  const flagMutation = useMutation({
    mutationFn: async (isFlagged: boolean) => {
      const response = await apiRequest("PATCH", `/api/calls/${call.id}`, {
        isFlagged
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({
        title: call.isFlagged ? "Call unflagged" : "Call flagged",
        description: call.isFlagged 
          ? "The call has been removed from the flagged list."
          : "The call has been added to the flagged list.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update flag status: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Update call status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/calls/${call.id}`, {
        status
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({
        title: "Status updated",
        description: `Call status has been updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete call mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/calls/${call.id}`);
      if (!response.ok) {
        throw new Error("Failed to delete call");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({
        title: "Call deleted",
        description: "The call has been permanently removed from the system.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete call: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleFlagToggle = () => {
    // Toggle flag status
    flagMutation.mutate(!call.isFlagged);
    
    // If we're flagging the call (not unflagging), also update status to "flagged"
    if (!call.isFlagged) {
      handleStatusUpdate("flagged");
    }
  };
  
  const handleStatusUpdate = (status: string) => {
    updateStatusMutation.mutate(status);
  };
  
  const handlePlayRecording = () => {
    if (!call.recordingUrl && !call.taalkUID) {
      toast({
        title: "No Recording Available",
        description: "This call does not have a recording URL or TaalkUID associated with it.",
        variant: "destructive",
      });
      return;
    }
    
    setShowAudioPlayer(true);
  };

  const handleViewTranscript = () => {
    if (!call.transcriptionText) {
      toast({
        title: "No Transcript Available",
        description: "This call does not have a transcript yet.",
        variant: "destructive",
      });
      return;
    }
    
    setShowTranscriptOnly(true);
  };
  
  const renderStatusBadge = () => {
    // Get the badge based on status
    const getBadge = (status: string) => {
      switch (status) {
        case "approved":
          return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
        case "rejected":
          return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
        case "pending":
          return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
        case "flagged":
          return <Badge className="bg-red-100 text-red-600 border-red-200">Flagged</Badge>;
        default:
          return <Badge className="bg-slate-100 text-slate-700 border-slate-200">{call.status || "Unknown"}</Badge>;
      }
    };
    
    // Render dropdown for status selection
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5">
            {getBadge(call.status)}
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleStatusUpdate("pending")}>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>
              {call.status === "pending" && <div className="h-2 w-2 rounded-full bg-amber-500" />}
            </div>  
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusUpdate("approved")}>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>
              {call.status === "approved" && <div className="h-2 w-2 rounded-full bg-green-500" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusUpdate("rejected")}>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>
              {call.status === "rejected" && <div className="h-2 w-2 rounded-full bg-red-500" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusUpdate("flagged")}>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-600 border-red-200">Flagged</Badge>
              {call.status === "flagged" && <div className="h-2 w-2 rounded-full bg-red-500" />}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  
  const hasRecording = !!(call.recordingUrl || call.taalkUID);
  
  return (
    <>
      <div className={`bg-white rounded-lg border shadow-sm p-4 ${call.isFlagged ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
        {/* Line 1: Member Info and Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {call.isFlagged && <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />}
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                {call.firstName && call.lastName ? `${formatClientName(call.firstName)} ${formatClientName(call.lastName)}` : formatClientName(call.firstName || '') || 'Unknown Member'}
              </h3>
              <p className="text-slate-600 text-sm">{formatPhoneNumber(call.phone)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {renderStatusBadge()}
            <span className="text-slate-500 text-sm">
              {call.callDate ? formatDate(new Date(call.callDate)) : 'No date'}
            </span>
          </div>
        </div>

        {/* Line 2: Details Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3 text-sm">
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs uppercase tracking-wide">Office</span>
            <span className="text-slate-800 font-medium">{call.office || 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs uppercase tracking-wide">Producer</span>
            <span className="text-slate-800 font-medium">{formatAgentName(call.agentName || '')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs uppercase tracking-wide">Premium</span>
            <span className="text-slate-900 font-semibold">{call.monthlyPremium?.startsWith('$') ? call.monthlyPremium : `$${call.monthlyPremium || '0.00'}`}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs uppercase tracking-wide">Duration</span>
            <span className="text-slate-800 font-medium">{call.callDuration || 'Unknown'}</span>
          </div>
        </div>

        {/* Line 3: Actions */}
        <div className="flex items-center justify-end border-t border-slate-100 pt-3">
          <div className="flex gap-2 items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full h-9 w-9 p-0 ${!hasRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100 hover:text-blue-600'}`}
              onClick={handlePlayRecording}
              disabled={!hasRecording}
            >
              <Play className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full h-9 w-9 p-0 ${!call.transcriptionText ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-100 hover:text-purple-600'}`}
              onClick={handleViewTranscript}
              disabled={!call.transcriptionText}
            >
              <FileText className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full h-9 w-9 p-0 hover:bg-green-100 hover:text-green-600"
              onClick={() => setShowScreenshot(true)}
            >
              <Image className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-full h-9 w-9 p-0 hover:bg-red-100 ${call.isFlagged ? 'bg-red-100 ring-1 ring-red-300' : ''}`}
              onClick={handleFlagToggle}
            >
              <Flag className={`h-4 w-4 ${call.isFlagged ? 'text-red-500' : 'text-slate-400'}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-full h-9 w-9 p-0 hover:bg-green-100 ${call.status === 'approved' ? 'bg-green-100 ring-1 ring-green-300' : ''}`}
              onClick={() => handleStatusUpdate("approved")}
            >
              <Check className={`h-4 w-4 ${call.status === 'approved' ? 'text-green-600' : 'text-slate-400'}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-full h-9 w-9 p-0 hover:bg-red-100 ${call.status === 'rejected' ? 'bg-red-100 ring-1 ring-red-300' : ''}`}
              onClick={() => handleStatusUpdate("rejected")}
            >
              <X className={`h-4 w-4 ${call.status === 'rejected' ? 'text-red-600' : 'text-slate-400'}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-9 w-9 p-0 hover:bg-red-100"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete this call for ${call.firstName} ${call.lastName}? This action cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Audio player modal */}
      <AudioPlayer 
        recording={call} 
        isOpen={showAudioPlayer} 
        onClose={() => setShowAudioPlayer(false)} 
      />
      
      {/* Transcript only modal */}
      <TranscriptModal 
        call={call} 
        isOpen={showTranscriptOnly} 
        onClose={() => setShowTranscriptOnly(false)} 
      />
      
      {/* Screenshot modal */}
      <ScreenshotModal 
        call={call} 
        isOpen={showScreenshot} 
        onClose={() => setShowScreenshot(false)} 
      />
    </>
  );
}