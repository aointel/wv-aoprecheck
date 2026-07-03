import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FaExclamationTriangle, FaBolt, FaCreditCard, FaVolumeUp } from 'react-icons/fa';
import { MdAnnouncement, MdUpdate } from 'react-icons/md';

interface WeeklyDisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export function WeeklyDisclaimerModal({ isOpen, onAccept }: WeeklyDisclaimerModalProps) {
  const [audioCheckerAgreed, setAudioCheckerAgreed] = useState(false);
  const [creditProcessAgreed, setCreditProcessAgreed] = useState(false);

  const canProceed = audioCheckerAgreed && creditProcessAgreed;

  const handleAccept = () => {
    if (canProceed) {
      onAccept();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header with Gradient Text */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 rounded-lg flex items-center justify-center text-white">
                <MdAnnouncement className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 bg-clip-text text-transparent">
                  🎉 Important Update!
                </DialogTitle>
                <p className="text-gray-600 dark:text-gray-400 mt-1 bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 bg-clip-text text-transparent">
                  Important Updates for ConnectNow Users!
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Introduction */}
          <div className="text-center">
            <p className="text-gray-700 dark:text-gray-300">
              We've made important changes to improve your calling experience and billing process.
            </p>
          </div>

          {/* Critical Updates Header */}
          <div className="flex items-center justify-center space-x-2">
            <FaExclamationTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-bold bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 bg-clip-text text-transparent">
              Critical Updates:
            </h3>
          </div>

          {/* Updates Section */}
          <div className="space-y-6">
            {/* Audio Checker Update */}
            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/50">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <FaVolumeUp className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-bold bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent">🎧 NEW Audio Checker is now live!</h4>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      NEW
                    </Badge>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Make sure you have a connection to Chrome before taking calls to ensure optimal audio quality.
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="audio-checker" 
                      checked={audioCheckerAgreed}
                      onCheckedChange={(checked) => setAudioCheckerAgreed(checked as boolean)}
                    />
                    <label 
                      htmlFor="audio-checker" 
                      className="text-sm font-medium text-blue-800 dark:text-blue-200 cursor-pointer"
                    >
                      I understand and agree to ensure Chrome audio connection before taking calls
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit Purchase Update */}
            <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-950/50">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
                  <FaCreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-bold bg-gradient-to-r from-green-600 via-green-700 to-green-800 bg-clip-text text-transparent">💳 Credit Purchase Process Changed</h4>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      UPDATED
                    </Badge>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    To add credits, you will now be redirected to the billing page for a streamlined experience.
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="credit-process" 
                      checked={creditProcessAgreed}
                      onCheckedChange={(checked) => setCreditProcessAgreed(checked as boolean)}
                    />
                    <label 
                      htmlFor="credit-process" 
                      className="text-sm font-medium text-green-800 dark:text-green-200 cursor-pointer"
                    >
                      I understand the new credit purchase process
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Important Reminder */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FaBolt className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">Important Reminder</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Please ensure your Chrome connection is ready before taking calls. Click "Got it!" to continue to your dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Validation Message */}
          {!canProceed && (
            <div className="text-center">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                Please check all boxes above to continue
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-center pt-2">
            <Button 
              onClick={handleAccept}
              disabled={!canProceed}
              className={`px-8 py-3 text-lg font-semibold ${
                canProceed 
                  ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white' 
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              Got it! Continue to Dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}