import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppointmentCardDeck } from "@/components/AppointmentCardDeck";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppointmentCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentEmail: string;
  remainingCount: number;
}

export function AppointmentCardsModal({ isOpen, onClose, agentEmail, remainingCount }: AppointmentCardsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden p-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 relative">
          <div>
            <DialogTitle className="text-xl font-bold text-white">
              Appointment Reviews
            </DialogTitle>
            <p className="text-sm text-purple-100 mt-1">
              {remainingCount} appointments ready for review
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-white transition-all rounded-full p-2.5 hover:bg-white/30 backdrop-blur-sm border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl hover:scale-110 group"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </DialogHeader>

        {/* Card Deck Container */}
        <div className="flex-1 overflow-hidden p-6">
          <AppointmentCardDeck 
            agentEmail={agentEmail}
            onComplete={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}