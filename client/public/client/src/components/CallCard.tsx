import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Mic, AlertTriangle, Flag, Check, X, FileText, Monitor } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AudioPlayer from "./AudioPlayer";
import { Call } from "@shared/schema";

interface CallCardProps {
  call: Call;
}

export default function CallCard({ call }: CallCardProps) {
  const { toast } = useToast();
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  
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
        description: `Call status has been updated to ${call.status}.`,
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
  
  const handleFlagToggle = () => {
    flagMutation.mutate(!call.isFlagged);
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
  
  const renderStatusBadge = () => {
    switch (call.status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Review</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">{call.status}</Badge>;
    }
  };
  
  const hasRecording = !!(call.recordingUrl || call.taalkUID);
  
  return (
    <>
      <Card className="overflow-hidden relative shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Flag indicator */}
        {call.isFlagged && (
          <div className="absolute top-0 right-0 m-1.5">
            <div className="bg-red-100 text-red-600 p-1.5 rounded-full shadow-sm">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
        )}
        
        <CardHeader className="p-3 flex flex-row items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-md">
              <Mic className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium line-clamp-1">{call.firstName} {call.lastName}</h3>
              <p className="text-xs text-slate-500">{call.phone}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {renderStatusBadge()}
            <p className="text-xs text-slate-500">{call.callDate ? formatDate(new Date(call.callDate)) : 'No date'}</p>
          </div>
        </CardHeader>
        
        <CardContent className="p-3 pt-2 flex justify-between border-t bg-slate-50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
            <div>
              <p className="text-xs text-slate-500">Premium</p>
              <p className="text-sm font-medium">{call.monthlyPremium}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Duration</p>
              <p className="text-sm font-medium">{call.callDuration || 'Unknown'}</p>
            </div>
            <div className="col-span-2 mt-1">
              <p className="text-xs text-slate-500">Agent</p>
              <p className="text-sm font-medium line-clamp-1">{call.agentName || 'Unassigned'}</p>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="p-3 pt-2 gap-1 border-t bg-white flex flex-wrap">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 text-xs ${!hasRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handlePlayRecording}
            disabled={!hasRecording}
          >
            <Mic className="h-3.5 w-3.5 mr-1" />
            {hasRecording ? 'Recording' : 'No Recording'}
          </Button>
          
          {call.transcriptionText && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Transcript
            </Button>
          )}
          
          {call.screenshotUrl && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
            >
              <Monitor className="h-3.5 w-3.5 mr-1" />
              Screenshot
            </Button>
          )}
          
          <div className="ml-auto flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleFlagToggle}
            >
              <Flag className={`h-3.5 w-3.5 ${call.isFlagged ? 'text-red-500' : 'text-slate-400'}`} />
            </Button>
            
            {call.status !== "approved" && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                onClick={() => handleStatusUpdate("approved")}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            
            {call.status !== "rejected" && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleStatusUpdate("rejected")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
      
      {/* Audio player modal */}
      <AudioPlayer 
        recording={call} 
        isOpen={showAudioPlayer} 
        onClose={() => setShowAudioPlayer(false)} 
      />
    </>
  );
}