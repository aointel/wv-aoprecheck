import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Send, X } from 'lucide-react';
import type { RecruitCandidate } from '@shared/schema';

interface SMSMessengerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: RecruitCandidate | null;
  userEmail?: string;
}

export function SMSMessengerModal({ open, onOpenChange, candidate, userEmail }: SMSMessengerModalProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!candidate || !message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (!candidate.phone) {
      toast({
        title: 'Error',
        description: 'Candidate does not have a phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await apiRequest(
        'POST',
        '/api/recruit/candidates/sms',
        {
          candidateId: candidate.id,
          phone: candidate.phone,
          message: message.trim(),
        },
        userEmail
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send SMS' }));
        throw new Error(errorData.error || 'Failed to send SMS');
      }

      toast({
        title: 'SMS Sent',
        description: `Message sent to ${candidate.firstName} ${candidate.lastName}`,
      });

      // Clear message and close modal
      setMessage('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      toast({
        title: 'Failed to send SMS',
        description: error.message || 'An error occurred while sending the message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send SMS Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {candidate && (
            <div className="space-y-2">
              <Label>To:</Label>
              <div className="text-sm font-medium">
                {candidate.firstName} {candidate.lastName}
              </div>
              <div className="text-xs text-muted-foreground">
                {candidate.phone}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sms-message">Message:</Label>
            <Textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message here..."
              className="min-h-[120px] resize-none"
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="text-xs text-muted-foreground">
              {message.length} / 1600 characters
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSending}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

