import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen, Phone, CheckCircle } from 'lucide-react';

interface NewUserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewUserGuideModal({ isOpen, onClose }: NewUserGuideModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Call Connector Pro Quick Start
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            Use this page to get started fast. No video, no extra steps.
          </p>

          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Before you start
            </h3>
            <ul className="text-sm text-blue-900 space-y-1">
              <li>- Confirm your market and licensed states are correct.</li>
              <li>- Make sure leads are loaded in your queue.</li>
              <li>- Most calls are no answer; that is normal.</li>
            </ul>
          </div>

          <div className="border border-gray-200 bg-white rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-600" />
              Basic call flow
            </h3>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Click <strong>Start Dialing</strong>.</li>
              <li>Talk to the lead.</li>
              <li>If no one answers, click <strong>Complete Call</strong> then <strong>Dial Next</strong>.</li>
              <li>If someone answers, select and apply the correct disposition.</li>
              <li>Calls longer than 45 seconds are sent to your Intro Lead box in Planet.</li>
              <li>Click <strong>Dial Next</strong> to continue.</li>
            </ol>
          </div>

          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-900">
              <strong>Stats:</strong> Dial, Reach, and Booked update as your call outcomes are saved.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white">
              Got it, start dialing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
