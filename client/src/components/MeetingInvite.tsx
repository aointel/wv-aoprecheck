import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface MeetingInviteProps {
  leadData: any;
  producerData: any;
}

export const MeetingInvite: React.FC<MeetingInviteProps> = ({ leadData, producerData }) => {
  const [phoneNumber, setPhoneNumber] = useState(leadData?.phoneNumber || leadData?.phone || '');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Generate clean meeting URL directly - no API calls needed
  const agentName = producerData?.name || producerData?.agentName || 'cnsysop';
  const meetingUrl = `https://aoi.whereby.com/${agentName}`;

  const sendSMSInvite = async () => {
    if (!phoneNumber) {
      toast({
        title: "Missing Information",
        description: "Need phone number to send invite",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    
    try {
      const leadName = leadData?.firstName || leadData?.first_name || 'Client';
      const producerDisplayName = producerData?.name || producerData?.agentName || 'producer';

      console.log('📱 Sending SMS with:', { phoneNumber, leadName, producerDisplayName, meetingUrl });

      const response = await fetch('/api/whereby/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          leadName,
          agentName: producerDisplayName,
          meetingUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send SMS');
      }

      const result = await response.json();
      console.log('✅ SMS sent successfully:', result);

      toast({
        title: "SMS Sent Successfully!",
        description: `Meeting invite sent to ${phoneNumber}`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      toast({
        title: "SMS Failed",
        description: error instanceof Error ? error.message : 'Failed to send SMS invite',
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const generateSMS = () => {
    const leadName = leadData?.firstName || leadData?.first_name || 'Client';
    const producerDisplayName = producerData?.name || producerData?.agentName || 'producer';
    
    return `Hi ${leadName}, this is ${producerDisplayName} from AO Intelligence. Please join our video meeting: ${meetingUrl}`;
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">Video Meeting Invite</h3>
      
      <div className="space-y-4">
        <div>
          <Label>Meeting URL:</Label>
          <div className="mt-1 p-2 bg-gray-100 rounded text-sm break-all">
            {meetingUrl}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Lead Phone Number:</Label>
          <Input
            id="phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number (e.g., +1234567890)"
            className="w-full"
          />
        </div>

        <div>
          <Label>SMS Message Preview:</Label>
          <textarea 
            value={generateSMS()} 
            readOnly 
            rows={4}
            className="mt-1 w-full p-2 border rounded text-sm resize-none bg-gray-50"
          />
        </div>

        <Button 
          onClick={sendSMSInvite}
          disabled={isSending || !phoneNumber}
          className="w-full"
        >
          {isSending ? 'Sending SMS...' : 'Send SMS Invite via Zapier'}
        </Button>

        <div className="text-xs text-gray-500">
          SMS will be sent through Zapier webhook integration
        </div>
      </div>
    </div>
  );
};