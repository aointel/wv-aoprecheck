import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, X, CalendarClock, AlertCircle, Video, CheckCircle2 } from 'lucide-react';

interface AppointmentResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetId: string;
  clientName: string;
  disposition: 'SALE' | 'NO_SALE' | 'THINK' | 'NO_SHOW' | 'CANCELLED' | 'ATTENDED';
  meetingLink?: string | null;
  onComplete: (data: {
    disposition: string;
    saleAmount?: number;
    notes?: string;
  }) => void;
}

export function AppointmentResolutionModal({
  isOpen,
  onClose,
  meetId,
  clientName,
  disposition,
  meetingLink,
  onComplete
}: AppointmentResolutionModalProps) {
  const [alpAmount, setAlpAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) setHasCompleted(false);
  }, [isOpen]);

  const handleSubmit = async () => {
    // Validate ALP for sales
    if (disposition === 'SALE') {
      const amount = parseFloat(alpAmount);
      if (!alpAmount || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid ALP amount for the sale');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const data: any = {
        disposition,
        notes: notes || undefined
      };

      if (disposition === 'SALE') {
        data.saleAmount = parseFloat(alpAmount);
      }

      await onComplete(data);
      setHasCompleted(true);
      onClose();

      // Reset form
      setAlpAmount('');
      setNotes('');
    } catch (error) {
      console.error('Failed to resolve appointment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDispositionConfig = () => {
    switch (disposition) {
      case 'SALE':
        return {
          icon: DollarSign,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          title: 'Record Sale',
          description: 'Congratulations! Please enter the sale details.'
        };
      case 'NO_SALE':
        return {
          icon: X,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          title: 'No Sale',
          description: 'Record why the client did not purchase.'
        };
      case 'THINK':
        return {
          icon: CalendarClock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          title: 'Think / Reschedule',
          description: 'Client needs time to think. A callback will be automatically created.'
        };
      case 'NO_SHOW':
        return {
          icon: AlertCircle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          title: 'No Show',
          description: 'Client did not attend the scheduled appointment.'
        };
      case 'CANCELLED':
        return {
          icon: X,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          title: 'Cancelled',
          description: 'Appointment was cancelled.'
        };
      case 'ATTENDED':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          title: 'Attended',
          description: 'Client attended but no presentation was given.'
        };
    }
  };

  const config = getDispositionConfig();
  const Icon = config.icon;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !hasCompleted) return;
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => hasCompleted || e.preventDefault()} onEscapeKeyDown={(e) => hasCompleted || e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-full ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <DialogTitle className="text-xl">{config.title}</DialogTitle>
              <p className="text-sm text-gray-600">{clientName}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">{config.description}</p>
        </DialogHeader>

        {meetingLink && (
          <div className="flex justify-center my-3">
            <Button
              type="button"
              variant="default"
              className="gap-2"
              onClick={() => window.open(meetingLink!, '_blank')}
            >
              <Video className="h-4 w-4" />
              Join Zoom
            </Button>
          </div>
        )}

        <div className="space-y-4 mt-4">
          {/* ALP Amount (SALE only) */}
          {disposition === 'SALE' && (
            <div>
              <Label htmlFor="alpAmount" className="text-base font-semibold">
                ALP Amount *
              </Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="alpAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={alpAmount}
                  onChange={(e) => setAlpAmount(e.target.value)}
                  className="pl-7 text-lg font-semibold"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the Annual Life Premium amount (e.g., 150.00, 275.50, 400.25)
              </p>
            </div>
          )}

          {/* Notes (all dispositions) */}
          <div>
            <Label htmlFor="notes" className="text-base font-semibold">
              Notes {disposition !== 'SALE' && '(Optional)'}
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any relevant notes about this appointment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Auto-callback notice for THINK */}
          {disposition === 'THINK' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> A callback appointment will be automatically created for 3 days from now.
              </p>
            </div>
          )}

          {/* Action Buttons - must complete to close */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled
              title="Complete the appointment to close"
            >
              Complete to close
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (disposition === 'SALE' && !alpAmount)}
              className={`flex-1 ${
                disposition === 'SALE'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Confirm & Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

