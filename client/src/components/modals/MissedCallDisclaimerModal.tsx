import React, { useState, useRef, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhoneOff, AlertTriangle } from 'lucide-react';

interface MissedCallDisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline?: () => void;
  userEmail?: string;
}

export function MissedCallDisclaimerModal({
  isOpen,
  onAccept,
  onDecline,
  userEmail
}: MissedCallDisclaimerModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [readScrolled, setReadScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // If content fits without scrolling, enable immediately
    if (scrollHeight <= clientHeight) {
      setReadScrolled(true);
      return;
    }
    
    // Check if scrolled to bottom (with 50px tolerance for better UX)
    const scrollRemaining = scrollHeight - scrollTop - clientHeight;
    const isScrolledToBottom = scrollRemaining <= 50;
    
    if (isScrolledToBottom) {
      setReadScrolled(true);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    checkScrollPosition();
  };

  // Check on mount and when modal opens if content is already fully visible
  useEffect(() => {
    if (isOpen) {
      // Reset first
      setReadScrolled(false);
      setAgreed(false);
      
      // Check immediately and multiple times to catch different load states
      const checkInterval = setInterval(() => {
        checkScrollPosition();
      }, 100);
      
      // Also check after delays
      setTimeout(() => {
        checkScrollPosition();
        clearInterval(checkInterval);
      }, 1000);
      
      // Check on window resize
      const handleResize = () => checkScrollPosition();
      window.addEventListener('resize', handleResize);
      
      return () => {
        clearInterval(checkInterval);
        window.removeEventListener('resize', handleResize);
      };
    } else {
      // Reset when modal closes
      setReadScrolled(false);
      setAgreed(false);
    }
  }, [isOpen]);

  const handleAccept = async () => {
    if (agreed && readScrolled) {
      // Call API to store acceptance in Supabase
      if (userEmail) {
        try {
          const response = await fetch('/api/disclaimers/accept-vdp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userEmail }),
          });

          if (!response.ok) {
            console.error('Failed to save disclaimer acceptance to database');
          }
        } catch (error) {
          console.error('Error saving disclaimer acceptance:', error);
        }
      }

      // Store agreement in localStorage as fallback/cache
      localStorage.setItem('vdp_missed_call_disclaimer_accepted', 'true');
      onAccept();
      // Reset for next time
      setAgreed(false);
      setReadScrolled(false);
    }
  };

  const handleDecline = () => {
    if (onDecline) {
      onDecline();
    }
    setAgreed(false);
    setReadScrolled(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Missed Call Billing Disclaimer
          </DialogTitle>
          <DialogDescription>
            Please read and acknowledge the missed call billing policy before accessing ConnectNow
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-2 space-y-5"
          onScroll={handleScroll}
        >
          <Alert variant="destructive">
            <PhoneOff className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> You will be charged for missed calls when using ConnectNow.
            </AlertDescription>
          </Alert>

          <div className="space-y-5 text-sm">
            <div>
              <h3 className="font-semibold text-lg mb-2">Missed Call Billing Policy</h3>
              <p className="text-muted-foreground">
                By using ConnectNow, you agree to the following terms regarding missed calls:
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-red-500 pl-4 py-2">
                <h4 className="font-semibold mb-2 text-foreground">What Constitutes a Billable Missed Call?</h4>
                <p className="text-muted-foreground mb-2">
                  A missed call is billable when:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground ml-2">
                  <li>The system successfully matches you with a connect</li>
                  <li>You do not pick up or answer the call within 10 seconds</li>
                  <li><strong>Call where the customer is not present after you pick up is not a missed call</strong></li>
                </ul>
              </div>

              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <h4 className="font-semibold mb-2 text-foreground">Billing Amount</h4>
                <p className="text-muted-foreground">
                  <strong className="text-foreground text-base">$4.00 per missed call</strong> will be automatically charged to your account.
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50/50 dark:bg-blue-950/10 rounded-r">
                <h4 className="font-semibold mb-2 text-foreground">Your Responsibility</h4>
                <p className="text-foreground font-semibold text-base">
                  <strong>ENSURE YOU ARE AVAILABLE TO ANSWER CALLS WHEN ONLINE</strong>
                </p>
              </div>

              <div className="border-l-4 border-red-600 pl-4 py-3 bg-red-50 dark:bg-red-950/20 rounded-r-lg">
                <h4 className="font-semibold mb-3 text-red-700 dark:text-red-300">Immediate Consequences</h4>
                <div className="space-y-2.5 text-red-700 dark:text-red-300">
                  <div>
                    <strong>Automatic Log Off:</strong> Missing a call will immediately log you off from ConnectNow. You must log back in to continue receiving calls.
                  </div>
                  <div>
                    <strong>Continued Missed Calls:</strong> Multiple missed calls may result in:
                    <ul className="list-disc list-inside ml-4 mt-1.5 space-y-1">
                      <li>Temporary suspension of ConnectNow access</li>
                      <li>Account restrictions</li>
                      <li>Removal from the platform</li>
                    </ul>
                  </div>
                </div>
                <p className="text-sm mt-3 font-medium text-red-800 dark:text-red-200">
                  It is critical that you are available and ready to answer calls when online.
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                  Agreement Required
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  By accepting, you acknowledge that you understand and agree to the missed call billing terms. This agreement only needs to be accepted once.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="agree-checkbox"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              disabled={!readScrolled}
            />
            <label
              htmlFor="agree-checkbox"
              className="text-sm font-medium leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have read and understand the missed call billing policy. I agree to be charged $4.00 for each missed call as described above.
            </label>
          </div>

          {!readScrolled && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground italic">
                Please scroll to the bottom of the disclaimer to enable the agreement checkbox.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const container = scrollContainerRef.current;
                  if (container) {
                    container.scrollTo({
                      top: container.scrollHeight,
                      behavior: 'smooth'
                    });
                    // Check after scroll animation completes
                    setTimeout(() => {
                      checkScrollPosition();
                      // Force enable after scroll completes (fallback)
                      setTimeout(() => {
                        checkScrollPosition();
                        // If still not enabled, force it (user clicked scroll button)
                        const container = scrollContainerRef.current;
                        if (container) {
                          const scrollTop = container.scrollTop;
                          const scrollHeight = container.scrollHeight;
                          const clientHeight = container.clientHeight;
                          const scrollRemaining = scrollHeight - scrollTop - clientHeight;
                          if (scrollRemaining <= 100) {
                            setReadScrolled(true);
                          }
                        }
                      }, 200);
                    }, 700);
                  }
                }}
                className="w-full text-xs"
              >
                Scroll to Bottom
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleDecline}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!agreed || !readScrolled}
            className="bg-red-600 hover:bg-red-700"
          >
            I Agree - Continue to ConnectNow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

