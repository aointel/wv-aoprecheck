import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { AlertTriangle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function LowCreditsReminderModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Get user credits
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits'],
  });

  const creditsRemaining = (creditsData as any)?.creditsRemaining || (creditsData as any)?.credits_remaining || 0;

  useEffect(() => {
    // Show warning ONLY for negative credits (above -8)
    if (creditsRemaining < 0 && creditsRemaining > -8 && !dismissed) {
      setIsOpen(true);
    }
  }, [creditsRemaining, dismissed]);

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
    // Reset dismissed after 1 hour
    setTimeout(() => setDismissed(false), 60 * 60 * 1000);
  };

  // Don't show if credits are very negative (they're already blocked)
  if (creditsRemaining <= -8) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              ⚠️ Negative Balance Warning
            </DialogTitle>
            <DialogClose asChild>
              <button
                onClick={handleDismiss}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110"
                aria-label="Close"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your account has a negative balance of {creditsRemaining} credits.
            </AlertDescription>
          </Alert>
          <DialogDescription>
            🚨 WARNING: At -8 credits, VDP access will be completely blocked. Please purchase credits immediately to avoid service interruption.
          </DialogDescription>
        </div>
        <DialogFooter className="space-x-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Remind Me Later
          </Button>
          <Button asChild onClick={() => setIsOpen(false)}>
            <Link to="/dashboard/billing-dashboard">Purchase Credits Now</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}