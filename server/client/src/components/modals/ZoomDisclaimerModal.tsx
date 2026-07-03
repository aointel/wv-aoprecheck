import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ZoomDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const ZoomDisclaimerModal: React.FC<ZoomDisclaimerModalProps> = ({
  isOpen,
  onClose,
  onAccept
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Zoom Meeting Disclaimer
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            By joining this Zoom meeting, you acknowledge that:
          </p>
          
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
            <li>This meeting may be recorded for quality assurance purposes</li>
            <li>You consent to the collection and use of your voice and video data</li>
            <li>Meeting participants may include authorized personnel only</li>
            <li>Any sensitive information should be handled according to company policy</li>
          </ul>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onAccept}>
              Accept & Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZoomDisclaimerModal;