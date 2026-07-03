import React from 'react';
import { useLocation } from 'wouter';
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

interface AccountPausedModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsRemaining: number;
}

export function AccountPausedModal({ isOpen, onClose, creditsRemaining }: AccountPausedModalProps) {
  const [, setLocation] = useLocation();

  const handleAddCredits = () => {
    onClose();
    setLocation('/dashboard/billing-dashboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Account Paused
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your account has been temporarily paused because you have {creditsRemaining} credits remaining.
            </AlertDescription>
          </Alert>
          
          <DialogDescription className="text-muted-foreground">
            To reactivate your account and continue using our services, please add credits to your account. 
            Your account will be automatically reactivated when your balance exceeds 5 credits.
          </DialogDescription>
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleAddCredits} className="bg-primary hover:bg-primary/90">
            Add Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}