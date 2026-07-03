import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsOfServiceModal({ isOpen, onClose }: TermsOfServiceModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Last updated: January 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">1. Acceptance</h3>
              <p className="text-muted-foreground">
                By using ConnectNow, you agree to these Terms.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">2. Credit System</h3>
              <p className="text-muted-foreground">
                Credits in packages (50, 100, 200, 500). Min 5 credits required. Non-refundable.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">3. Acceptable Use</h3>
              <p className="text-muted-foreground">
                Don't violate laws, harass, violate TCPA, misrepresent identity, or abuse platform.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">4. Telecommunications Compliance</h3>
              <p className="text-muted-foreground">
                Comply with all telecom laws, maintain consent records, honor opt-outs.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">5. Limitation of Liability</h3>
              <p className="text-muted-foreground">
                Not liable for indirect damages. Total liability limited to 12 months of payments.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">6. Termination</h3>
              <p className="text-muted-foreground">
                May suspend for violations, fraud, non-payment, or inactivity.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">7. Governing Law</h3>
              <p className="text-muted-foreground">
                Texas
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">Contact</h3>
              <p className="text-muted-foreground">
                <a href="mailto:aointel@aoglobelife.com" className="text-blue-600 hover:underline">
                  aointel@aoglobelife.com
                </a>
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

