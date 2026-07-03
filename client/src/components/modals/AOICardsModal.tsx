import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConnectCardDeck } from "@/components/ConnectCardDeck";
import { X, ArrowLeft, ArrowRight, ArrowUp, Target, Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface AOICardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentEmail: string;
  remainingCount?: number;
}

export function AOICardsModal({ isOpen, onClose, agentEmail, remainingCount }: AOICardsModalProps) {
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialSeenKey = `aoi-cards-tutorial-seen-${agentEmail}`;

  useEffect(() => {
    if (isOpen) {
      const hasSeenTutorial = localStorage.getItem(tutorialSeenKey);
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }
    }
  }, [isOpen, tutorialSeenKey]);

  const handleTutorialClose = () => {
    setShowTutorial(false);
    localStorage.setItem(tutorialSeenKey, 'true');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden p-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 relative">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                AOI Cards Review
              </DialogTitle>
              <p className="text-sm text-blue-100 mt-1">
                {remainingCount !== undefined ? `${remainingCount} cards remaining` : 'Review your connects'}
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
          </div>
        </DialogHeader>

        {/* Tutorial Overlay */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
              onClick={handleTutorialClose}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    How to Review Cards 🎴
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Swipe or click buttons to classify your connects
                  </p>
                </div>

                <div className="space-y-6 mb-6">
                  {/* Confirmed Sales */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                    <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Confirmed Sales
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 mb-2">
                          <ArrowUp className="w-6 h-6 mx-auto text-gray-600 dark:text-gray-300" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Swipe Up</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Standard</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 mb-2">
                          <ArrowRight className="w-6 h-6 mx-auto text-green-600" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Swipe Right</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Call Connector Pro</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 mb-2">
                          <ArrowLeft className="w-6 h-6 mx-auto text-blue-600" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Swipe Left</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">AO Intelligence</p>
                      </div>
                    </div>
                  </div>

                  {/* Regular Connects */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      <Phone className="w-5 h-5" />
                      Regular Connects
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 mb-2">
                          <ArrowLeft className="w-6 h-6 mx-auto text-red-600" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Swipe Left</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Not Interested</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 mb-2">
                          <ArrowUp className="w-6 h-6 mx-auto text-green-600" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Swipe Up</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Sale!</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 mb-2">
                          <ArrowRight className="w-6 h-6 mx-auto text-green-600" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Swipe Right</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Appointment</p>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Cards */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Appointment Cards
                    </h3>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                      When an appointment date passes, you'll see 4 resolution options:
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-2 mb-1">
                          <span className="text-lg">💰</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Sale</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-2 mb-1">
                          <span className="text-lg">❌</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">No Sale</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-2 mb-1">
                          <span className="text-lg">📅</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Reschedule</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-white dark:bg-gray-700 rounded-lg p-2 mb-1">
                          <span className="text-lg">🚫</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Refused</p>
                      </div>
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 italic">
                      Future appointments show different action buttons
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleTutorialClose}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    Got it! Let's go 🚀
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Deck Container */}
        <div className="flex-1 overflow-auto p-6">
          <ConnectCardDeck 
            agentEmail={agentEmail}
            onComplete={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}