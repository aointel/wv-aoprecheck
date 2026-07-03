import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>
            Last updated: January 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">1. Introduction</h3>
              <p className="text-muted-foreground">
                ConnectNow is committed to protecting your privacy.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">2. Information We Collect</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                <li><strong className="text-foreground">Personal:</strong> Name, email, phone, account credentials, billing info</li>
                <li><strong className="text-foreground">Usage:</strong> Call logs, analytics, device/IP info</li>
                <li><strong className="text-foreground">Lead/Client Data:</strong> Contacts, call dispositions, appointments</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">3. How We Use Your Information</h3>
              <p className="text-muted-foreground">
                Provide services, process transactions, facilitate calling, improve services, comply with laws
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">4. Information Sharing</h3>
              <p className="text-muted-foreground">
                We don't sell data. Share only with service providers (Twilio, Stripe) and when legally required.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">5. Data Security</h3>
              <p className="text-muted-foreground">
                Encryption, secure authentication, access controls, regular monitoring
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">6. Your Rights</h3>
              <p className="text-muted-foreground">
                Access, correct, delete data; opt-out of marketing; data portability
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

