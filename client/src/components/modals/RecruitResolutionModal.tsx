import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserCheck } from 'lucide-react';

export const RECRUIT_DISPOSITIONS = [
  { value: 'hired', label: 'Hired' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'callback', label: 'Callback' },
  { value: 'no_show', label: 'No show' },
  { value: 'interview_completed', label: 'Interview completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'other', label: 'Other' },
] as const;

interface RecruitResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName?: string;
  onComplete: () => void;
}

export function RecruitResolutionModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  onComplete,
}: RecruitResolutionModalProps) {
  const [disposition, setDisposition] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasCompleted(false);
      setDisposition('');
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!disposition) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/recruit-candidates/${candidateId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition, notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save disposition');
      }
      setHasCompleted(true);
      onComplete();
      onClose();
    } catch (err) {
      console.error('Recruit resolve:', err);
      alert(err instanceof Error ? err.message : 'Failed to save disposition');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !hasCompleted) return;
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (!hasCompleted) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!hasCompleted) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Recruit outcome</DialogTitle>
              {candidateName && (
                <p className="text-sm text-gray-600">{candidateName}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Record the outcome of this recruiting session. Required before closing.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-base font-semibold">Disposition *</Label>
            <Select value={disposition} onValueChange={setDisposition}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                {RECRUIT_DISPOSITIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-base font-semibold">Notes (optional)</Label>
            <Textarea
              placeholder="Add any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled
              title="Complete the outcome to close"
            >
              Complete to close
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !disposition}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : 'Confirm & Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
