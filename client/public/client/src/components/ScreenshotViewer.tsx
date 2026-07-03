import { useState } from "react";
import { 
  X, User, Calendar, Phone, Download, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Call } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ScreenshotViewerProps {
  call: Call;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScreenshotViewer({ call, isOpen, onClose }: ScreenshotViewerProps) {
  if (!isOpen) return null;

  const handleDownload = () => {
    // In a real implementation, this would download the screenshot
    if (call.screenshotUrl) {
      const link = document.createElement('a');
      link.href = call.screenshotUrl;
      link.download = `screenshot-${call.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl m-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <div className="bg-purple-50 p-2.5 rounded-lg mr-3">
              <ImageIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Call Screenshot</h2>
              <div className="text-sm text-slate-500">ID: #{call.id}</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex flex-col md:flex-row">
          {/* Left sidebar with call details */}
          <div className="w-full md:w-64 p-4 bg-slate-50 border-r border-slate-200">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium">{call.phone}</p>
                    {call.taalkUID && (
                      <p className="text-xs text-blue-600 mt-0.5">TaalkUID: {call.taalkUID}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-start">
                  <User className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Client</p>
                    <p className="text-sm font-medium">{`${call.firstName} ${call.lastName}`}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Calendar className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="text-sm">
                      {call.callDate ? formatDate(new Date(call.callDate)) : 'No date'}
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Button 
                  variant="default" 
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Download Image</span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Main content area */}
          <div className="flex-1 p-6 flex items-center justify-center bg-slate-100 overflow-auto" style={{ maxHeight: "70vh" }}>
            {call.screenshotUrl ? (
              <div className="relative">
                <img 
                  src={call.screenshotUrl} 
                  alt={`Screenshot from call with ${call.firstName} ${call.lastName}`}
                  className="max-w-full h-auto rounded-md shadow-md max-h-[60vh]"
                />
                <Badge className="absolute top-2 right-2 bg-slate-800 bg-opacity-70 text-white">
                  Agent Screenshot
                </Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 p-10">
                <div className="bg-slate-200 p-6 rounded-full mb-4">
                  <ImageIcon className="h-12 w-12 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Screenshot Available</h3>
                <p className="text-center text-sm max-w-md">
                  There is no screenshot attached to this call record. Screenshots are uploaded by agents to document important information from the call.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}