import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { Call } from "@shared/schema";

interface TranscriptModalProps {
  call: Call;
  isOpen: boolean;
  onClose: () => void;
}

export default function TranscriptModal({ call, isOpen, onClose }: TranscriptModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Call Transcript - {call.firstName} {call.lastName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {/* Call details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Phone:</span>
                  <span className="text-slate-700 ml-1">{call.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500">Office:</span>
                  <span className="text-slate-700 ml-1">{call.office || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Agent:</span>
                  <span className="text-slate-700 ml-1">{call.agentName || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>
                  <span className="text-slate-700 ml-1">{call.callDuration || 'Unknown'}</span>
                </div>
              </div>
            </div>
            
            {/* Transcript content */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Transcript</h3>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {call.transcriptionText || 'No transcript available for this call.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}