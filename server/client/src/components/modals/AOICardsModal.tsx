import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConnectCardDeck } from "@/components/ConnectCardDeck";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AOICardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentEmail: string;
  remainingCount: number;
}

export function AOICardsModal({ isOpen, onClose, agentEmail, remainingCount }: AOICardsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700">
          <div>
            <DialogTitle className="text-xl font-bold text-white">
              AOI Cards Review
            </DialogTitle>
            <p className="text-sm text-blue-100 mt-1">
              {remainingCount} cards remaining to be sorted
            </p>
          </div>
        </DialogHeader>

        {/* Card Deck Container */}
        <div className="flex-1 overflow-hidden p-6">
          <ConnectCardDeck 
            agentEmail={agentEmail}
            onComplete={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}