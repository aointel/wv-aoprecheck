import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AccessibilityPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessibilityPolicyModal({ isOpen, onClose }: AccessibilityPolicyModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Accessibility Policy</DialogTitle>
          <DialogDescription>
            Last updated: January 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">1. Our Commitment</h3>
              <p className="text-muted-foreground">
                ConnectNow is committed to digital accessibility for people of all abilities.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">2. Conformance Status</h3>
              <p className="text-muted-foreground">
                We aim to conform to WCAG 2.1 Level AA standards.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">3. Accessibility Features</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                <li>Keyboard navigation support</li>
                <li>Screen reader compatibility</li>
                <li>Color contrast compliance</li>
                <li>Resizable text and scalable interface</li>
                <li>Alternative text for images</li>
                <li>Focus indicators for interactive elements</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">4. Assistive Technologies</h3>
              <p className="text-muted-foreground">
                Compatible with JAWS, NVDA, VoiceOver, screen magnifiers, voice recognition
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">5. Known Limitations</h3>
              <p className="text-muted-foreground">
                Some third-party content may not fully meet standards
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">6. Feedback</h3>
              <p className="text-muted-foreground">
                Contact us at{' '}
                <a href="mailto:aointel@aoglobelife.com" className="text-blue-600 hover:underline">
                  aointel@aoglobelife.com
                </a>
                {' '}with page URL, issue description, and contact info
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">7. Response Time</h3>
              <p className="text-muted-foreground">
                5 business days response, 30 days resolution
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

