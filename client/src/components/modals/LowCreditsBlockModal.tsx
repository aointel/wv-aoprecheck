import React from 'react';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface LowCreditsBlockModalProps {
  isOpen: boolean;
  creditsRemaining: number;
}

export function LowCreditsBlockModal({
  isOpen,
  creditsRemaining
}: LowCreditsBlockModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg z-[9999] [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Insufficient Credits
              </DialogTitle>
              <DialogDescription>
                Your account balance is too low to access ConnectNow
              </DialogDescription>
            </div>
            {/* Note: This modal intentionally cannot be closed - user must purchase credits */}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Current Balance:</strong> {creditsRemaining} credits
            </AlertDescription>
          </Alert>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              To use ConnectNow, your account balance must be above <strong className="text-foreground">-2 credits</strong>. Your current balance is {creditsRemaining} credits.
            </p>
            <p className="text-muted-foreground">
              You can still access all other features of the platform. Only ConnectNow access is restricted until you purchase additional credits.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              // Modal cannot be closed - user must purchase credits
            }}
            disabled
          >
            Cancel
          </Button>
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Link to="/dashboard/billing-dashboard">
              <CreditCard className="h-4 w-4 mr-2" />
              Buy Credits
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

