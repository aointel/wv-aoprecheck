import React, { useState } from 'react';
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
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

export function LowCreditsReminderModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Low Credits Warning</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your credit balance is running low.
            </AlertDescription>
          </Alert>
          <DialogDescription>
            You have less than 10 credits remaining. Consider purchasing more credits to continue using the platform.
          </DialogDescription>
        </div>
        <DialogFooter className="space-x-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Remind Me Later
          </Button>
          <Button asChild onClick={() => setIsOpen(false)}>
            <Link to="/dashboard/billing-dashboard">Purchase Credits</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}