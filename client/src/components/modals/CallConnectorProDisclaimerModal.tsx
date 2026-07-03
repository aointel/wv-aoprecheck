import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Info } from 'lucide-react';

interface CallConnectorProDisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline?: () => void;
  userEmail?: string;
  acceptEndpoint?: string; // Optional: custom endpoint for acceptance (defaults to regular CCPro endpoint)
  localStorageKey?: string; // Optional: custom localStorage key (defaults to regular CCPro key)
}

export function CallConnectorProDisclaimerModal({
  isOpen,
  onAccept,
  onDecline,
  userEmail,
  acceptEndpoint = '/api/disclaimers/accept-call-connector-pro',
  localStorageKey = 'call_connector_pro_disclaimer_accepted'
}: CallConnectorProDisclaimerModalProps) {
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
      // Call API to store acceptance in Supabase FIRST - THIS IS REQUIRED
      let apiSuccess = false;
      if (userEmail) {
        try {
          console.log(`📤 Saving disclaimer acceptance to Supabase for ${userEmail} via ${acceptEndpoint}`);
          const response = await fetch(acceptEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userEmail }),
          });

          if (response.ok) {
            const responseData = await response.json();
            apiSuccess = true;
            console.log('✅ Disclaimer acceptance saved to Supabase:', responseData);
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ FAILED to save disclaimer acceptance to Supabase:', response.status, errorData);
            // Show error to user - don't proceed if save failed
            alert(`Failed to save disclaimer acceptance. Please try again. Error: ${response.status}`);
            return; // Don't proceed if save failed
          }
        } catch (error) {
          console.error('❌ ERROR saving disclaimer acceptance to Supabase:', error);
          // Show error to user - don't proceed if save failed
          alert(`Failed to save disclaimer acceptance. Please check your connection and try again.`);
          return; // Don't proceed if save failed
        }
      } else {
        // No userEmail - can't save, but allow in demo mode
        console.warn('⚠️ No userEmail provided - skipping Supabase save (demo mode?)');
      }

      // Only store in localStorage AFTER successful Supabase save
      if (apiSuccess && localStorageKey) {
        localStorage.setItem(localStorageKey, 'true');
        console.log(`✅ Cached disclaimer acceptance in localStorage: ${localStorageKey}`);
      }
      
      // Only call onAccept if API call succeeded
      if (apiSuccess || !userEmail) {
        onAccept();
      }
      
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
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Phone className="h-5 w-5" />
            Call Connector Pro – Quick Acknowledgment
          </DialogTitle>
          <DialogDescription>
            Before accessing Call Connector Pro, please take a moment to review and acknowledge how connections and lead crediting work.
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-2 space-y-5"
          onScroll={handleScroll}
        >
          <div className="space-y-5 text-sm">
            <div>
              <h3 className="font-semibold text-lg mb-3">How Connections Work</h3>
              <p className="text-muted-foreground mb-3">
                When you connect with a client using Call Connector Pro:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                <li>The connection is handled through the standard AO instant lead-out transfer process</li>
                <li>Standard lead crediting from the Leads Department applies</li>
                <li>These connections follow the same policies as other AO lead sources</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-r">
              <h4 className="font-semibold mb-2 text-foreground">Lead Crediting</h4>
              <p className="text-muted-foreground">
                All client connections made through Call Connector Pro are credited according to existing Leads Department guidelines. There are no special or separate crediting rules for this tool.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-3">
              <h4 className="font-semibold mb-2 text-foreground">What to Expect</h4>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                <li><strong className="text-foreground">Automatic Transfer:</strong> Once a live connection is made, the lead is automatically transferred using AO's standard process</li>
                <li><strong className="text-foreground">Standard Crediting:</strong> Credit is applied consistently with other AO leads</li>
                <li><strong className="text-foreground">No Manual Overrides:</strong> Transfers and crediting occur automatically and cannot be reversed</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">
                Acknowledgment
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                By continuing, you confirm that you understand how Call Connector Pro handles connections, lead transfers, and crediting. This acknowledgment is required only once.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="agree-checkbox-ccpro"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              disabled={!readScrolled}
            />
            <label
              htmlFor="agree-checkbox-ccpro"
              className="text-sm font-medium leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have read and understand how Call Connector Pro works. I acknowledge that any successful connection with a client will follow the standard AO instant lead-out transfer and lead crediting process.
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            I Agree – Continue to Call Connector Pro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


