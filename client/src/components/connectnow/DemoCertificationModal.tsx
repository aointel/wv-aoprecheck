import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, X } from 'lucide-react';

interface DemoCertificationModalProps {
  isOpen: boolean;
  onCertify: () => void;
  onCancel: () => void;
  demoType?: 'aointel' | 'recruit' | 'callconnector';
}

export function DemoCertificationModal({ isOpen, onCertify, onCancel, demoType = 'aointel' }: DemoCertificationModalProps) {
  const productName = demoType === 'aointel' ? 'AO Intelligence' : demoType === 'recruit' ? 'AO Recruit' : 'Call Connector Pro';
  const [outboundAudio, setOutboundAudio] = useState(false);
  const [inboundAudio, setInboundAudio] = useState(false);
  const [canProceed, setCanProceed] = useState(false);

  const handleCheckboxChange = (type: 'outbound' | 'inbound', checked: boolean) => {
    if (type === 'outbound') {
      setOutboundAudio(checked);
    } else {
      setInboundAudio(checked);
    }
    
    // Enable proceed button only when both are checked
    if (type === 'outbound') {
      setCanProceed(checked && inboundAudio);
    } else {
      setCanProceed(checked && outboundAudio);
    }
  };

  const handleCertify = () => {
    if (outboundAudio && inboundAudio) {
      onCertify();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Demo Certification Required
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Please confirm that you successfully heard audio from both sources during the demo call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            {/* Outbound Audio Checkbox */}
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
              <Checkbox
                id="outbound-audio"
                checked={outboundAudio}
                onCheckedChange={(checked) => handleCheckboxChange('outbound', checked as boolean)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label
                  htmlFor="outbound-audio"
                  className="text-base font-semibold cursor-pointer"
                >
                  {demoType === 'callconnector' 
                    ? 'I received the call on my registered phone number'
                    : 'I heard audio on my cell phone (outbound call)'}
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {demoType === 'callconnector'
                    ? 'I received the direct call on my registered phone number and could hear the caller clearly.'
                    : 'I received the call on my registered phone number and could hear the Virtual Assistant clearly.'}
                </p>
              </div>
            </div>

            {/* Inbound Audio Checkbox */}
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
              <Checkbox
                id="inbound-audio"
                checked={inboundAudio}
                onCheckedChange={(checked) => handleCheckboxChange('inbound', checked as boolean)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label
                  htmlFor="inbound-audio"
                  className="text-base font-semibold cursor-pointer"
                >
                  {demoType === 'callconnector'
                    ? 'I heard audio through Call Connector Pro'
                    : `I heard audio through ${productName} (inbound call)`}
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {demoType === 'callconnector'
                    ? 'I could hear myself speaking through Call Connector Pro and confirmed clear audio quality.'
                    : `I received the incoming call through ${productName} and could hear myself on both my cell phone and through ${productName} simultaneously.`}
                </p>
              </div>
            </div>
          </div>

          {!canProceed && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please confirm both audio sources before proceeding.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleCertify}
            disabled={!canProceed}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Certify & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

