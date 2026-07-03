import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video, Wrench } from 'lucide-react';
import { useHelpQueueStatus, markAcknowledged } from '@/hooks/use-help-queue-status';
import { formatAppointmentCountdown } from './HelpQueueStatusBanner';

function playItsYourTurnSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
    const osc2 = audioContext.createOscillator();
    osc2.connect(gainNode);
    osc2.frequency.value = 1108;
    osc2.type = 'sine';
    osc2.start(audioContext.currentTime + 0.2);
    osc2.stop(audioContext.currentTime + 0.45);
  } catch {
    // Silent fail if Web Audio not supported
  }
}

export default function ItsYourTurnModal() {
  const { stored, isReady, zoomLink, acknowledged, slotStart } = useHelpQueueStatus();
  const [countdown, setCountdown] = useState<string | null>(null);

  const isOpen = isReady && !!zoomLink && !!stored?.queueId && !acknowledged;

  useEffect(() => {
    if (!slotStart) {
      setCountdown(null);
      return;
    }
    const update = () => setCountdown(formatAppointmentCountdown(slotStart));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [slotStart]);

  useEffect(() => {
    if (isOpen && stored?.queueId) {
      playItsYourTurnSound();
    }
  }, [isOpen, stored?.queueId]);

  const handleClose = () => {
    if (stored?.queueId) {
      markAcknowledged(stored.queueId);
    }
  };

  const handleJoinZoom = () => {
    if (zoomLink) {
      window.open(zoomLink, '_blank', 'noopener,noreferrer');
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="max-w-3xl min-h-[60vh] flex flex-col justify-center mx-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <Wrench className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-3xl sm:text-4xl font-bold text-center">
            AOI Support — It&apos;s your turn!
          </DialogTitle>
          <DialogDescription className="text-center text-lg sm:text-xl">
            Your AOI Support session is ready. Join the Zoom call now.
            {countdown && <span className="block mt-2 font-mono text-base text-green-700 dark:text-green-300">{countdown}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-8">
          <Button
            size="lg"
            className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={handleJoinZoom}
          >
            <Video className="w-6 h-6" />
            Join Zoom
          </Button>
          <Button variant="outline" size="lg" className="w-full h-12 text-base" onClick={handleClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
