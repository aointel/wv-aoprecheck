import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TrialWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrial?: () => void;
}

export function TrialWelcomeModal({ isOpen, onClose, onStartTrial }: TrialWelcomeModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleStartTrial = () => {
    if (onStartTrial) {
      onStartTrial();
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
              className="pointer-events-auto w-full max-w-md"
            >
              <Card className="relative overflow-hidden border-2 border-blue-500/50 bg-gradient-to-br from-blue-900/95 via-purple-900/95 to-blue-900/95 backdrop-blur-xl shadow-2xl">
                {/* Sparkle effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                      }}
                    />
                  ))}
                </div>

                <CardContent className="relative p-8">
                  {/* Close button */}
                  <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Rocket icon */}
                  <div className="flex justify-center mb-6">
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <Rocket className="w-16 h-16 text-yellow-300 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]" />
                    </motion.div>
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-bold text-center text-white mb-4">
                    Take Call Connector Pro for a spin!
                  </h2>

                  {/* Message */}
                  <p className="text-lg text-center text-blue-100 mb-2">
                    Subscribe to unlock unlimited dialing!
                  </p>
                  <p className="text-lg text-center text-yellow-300 font-semibold mb-8">
                    We know you are going to love it!
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={handleStartTrial}
                      className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white font-semibold py-6 text-lg shadow-lg"
                    >
                      <Rocket className="w-5 h-5 mr-2" />
                      Subscribe Now
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="ghost"
                      className="w-full text-white/70 hover:text-white hover:bg-white/10"
                    >
                      Maybe Later
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

