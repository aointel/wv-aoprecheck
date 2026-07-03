import React, { useState } from 'react';
import { Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaPause, FaCreditCard, FaExclamationTriangle } from 'react-icons/fa';
import { MdBlock } from 'react-icons/md';
import { CreditPurchaseModal } from '@/components/stripe/CreditPurchaseModal';
import { useAuth } from '@/hooks/use-auth';
import { useQueryClient } from '@tanstack/react-query';

interface AccountPausedModalProps {
  isOpen: boolean;
  creditsRemaining: number;
  onPurchaseCredits?: () => void;
}

export function AccountPausedModal({ isOpen, creditsRemaining, onPurchaseCredits }: AccountPausedModalProps) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const { authState } = useAuth();
  const queryClient = useQueryClient();

  const handlePurchaseClick = () => {
    setShowPurchaseModal(true);
  };

  const handleCreditsAdded = () => {
    // Refresh credit data after successful purchase
    queryClient.invalidateQueries({ queryKey: ['/api/user/credits'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/agent-stats'] });
    setShowPurchaseModal(false);
  };

  return (
    <>
      <Dialog open={isOpen && !showPurchaseModal} onOpenChange={() => {}} modal>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {/* Header with Gradient Text */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-red-600 via-orange-600 to-red-700 rounded-lg flex items-center justify-center text-white">
                  <MdBlock className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold bg-gradient-to-r from-red-600 via-orange-600 to-red-700 bg-clip-text text-transparent">
                    Account Paused
                  </DialogTitle>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Service temporarily unavailable
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Credits Status */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <FaExclamationTriangle className="w-5 h-5 text-red-600" />
                <Badge variant="destructive" className="text-sm font-bold">
                  {creditsRemaining} Credits Remaining
                </Badge>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Your account has been temporarily paused because you have <span className="font-bold text-red-600">{creditsRemaining} credits remaining</span>.
              </p>
            </div>

            {/* Reactivation Info */}
            <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-950/30">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white">
                  <FaCreditCard className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold bg-gradient-to-r from-green-600 via-green-700 to-green-800 bg-clip-text text-transparent mb-1">
                    Automatic Reactivation
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    To reactivate your account and continue using our services, please add credits to your account. 
                    Your account will be <span className="font-semibold">automatically reactivated</span> when your balance exceeds <span className="font-bold">5 credits</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Purchase Button */}
            <div className="pt-4 space-y-3">
              <Button 
                asChild
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:opacity-90 text-white font-medium"
                size="lg"
              >
                <Link href="/dashboard/billing-dashboard">
                  <FaCreditCard className="w-4 h-4 mr-2" />
                  Purchase Credits In-App
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                size="lg"
              >
                <Link href="/dashboard/billing-dashboard">
                  <FaCreditCard className="w-4 h-4 mr-2" />
                  Open Billing Center
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stripe Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        userEmail={authState.user?.email}
        onCreditsAdded={handleCreditsAdded}
      />
    </>
  );
}