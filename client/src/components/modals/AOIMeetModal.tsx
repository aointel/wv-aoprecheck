import React, { useState } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Video, Copy, Send, Phone, X, Calendar, Clock, User, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

interface AOIMeetModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName?: string;
  producerPhone?: string;
  lead?: {
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export function AOIMeetModal({ isOpen, onClose, agentName, producerPhone, lead }: AOIMeetModalProps) {
  const [meetingId, setMeetingId] = useState('');
  const [meetingUrl, setMeetingUrl] = useState(''); // Real Whereby URL
  const [hostRoomUrl, setHostRoomUrl] = useState(''); // Host URL with controls
  const [clientPhone, setClientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Create NEW Whereby meeting EVERY TIME modal opens
  React.useEffect(() => {
    if (isOpen) {
      console.log('🎥 Modal opened - creating NEW unique Whereby meeting');
      createWherebyMeeting();
      
      // Pre-populate client phone if lead data available
      if (lead?.phone) {
        setClientPhone(lead.phone);
      }
    }
  }, [isOpen]);
  
  const createWherebyMeeting = async () => {
    try {
      console.log(`🎥 CREATING NEW UNIQUE Whereby meeting for agent: ${agentName}`);
      console.log('🔥 CRITICAL: Every modal open = NEW meeting - NO REUSE!');
      
      // 🔥 CRITICAL: Use /api/whereby/create-meeting to ALWAYS create NEW meeting
      // This is DIFFERENT from get-agent-meeting which reuses persistent meetings
      const response = await fetch('/api/whereby/create-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: agentName,
          leadName: lead ? `${lead.firstName} ${lead.lastName}` : undefined,
          leadId: lead ? `${lead.firstName}-${lead.lastName}` : undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.roomUrl) {
        // Extract meeting ID from roomUrl (e.g., https://aoi.whereby.com/abc-123)
        const url = new URL(data.roomUrl);
        const newMeetingId = data.meetingId || url.pathname.substring(1); // Use meetingId from response or extract from URL
        
        setMeetingId(newMeetingId);
        setMeetingUrl(data.roomUrl); // Store real Whereby URL
        setHostRoomUrl(data.hostRoomUrl || data.roomUrl); // Store host URL with controls
        
        // Set default message with lead's name
        const leadName = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'client' : 'client';
        // Filter out "undefined undefined" or empty agentName
        const cleanAgentName = agentName && agentName.trim() && !agentName.includes('undefined') ? agentName.trim() : null;
        const defaultMessage = `${cleanAgentName || 'Your producer'} has invited you to a video meeting, ${leadName}. Please join: ${data.roomUrl}`;
        setCustomMessage(defaultMessage);
        
        console.log('✅ NEW UNIQUE Whereby meeting created:', {
          meetingId: newMeetingId,
          roomUrl: data.roomUrl,
          hostRoomUrl: data.hostRoomUrl,
          agentEmail: agentName
        });
      } else {
        throw new Error(data.error || 'Failed to create Whereby meeting');
      }
    } catch (error: any) {
      console.error('❌ Whereby creation error:', error);
      toast({
        title: "Whereby API Error",
        description: `Failed to create real Whereby room: ${error.message}`,
        variant: "destructive"
      });
      
      // DON'T FALLBACK - show the error
      setMeetingId('ERROR');
      setMeetingUrl('');
      setHostRoomUrl('');
      const defaultMessage = `ERROR: Could not create Whereby meeting. Please try again.`;
      setCustomMessage(defaultMessage);
    }
  };

  const generateNewMeetingId = () => {
    // Re-create a new Whereby meeting
    createWherebyMeeting();
    
    toast({
      title: "Generating New Meeting",
      description: "Creating a new Whereby session...",
    });
  };

  const copyMeetingLink = () => {
    const meetingLink = meetingUrl || `https://aoi.whereby.com/${meetingId}`;
    navigator.clipboard.writeText(meetingLink);
    toast({
      title: "Meeting Link Copied",
      description: "The meeting link has been copied to your clipboard",
    });
  };

  const startMeeting = async () => {
    const meetingLink = hostRoomUrl || meetingUrl || `https://aoi.whereby.com/${meetingId}`;
    
    // Create BOTH a meet record AND a presentation session for tracking
    try {
      const now = new Date();
      
      // 1. Create meet record
      const meetResponse = await fetch('/api/meets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_email: agentName,
          agent_name: agentName?.split('@')[0] || 'agent',
          client_first_name: lead?.firstName || clientPhone || 'Client',
          client_last_name: lead?.lastName || '',
          client_phone: clientPhone,
          scheduled_date: now.toISOString(),
          scheduled_time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          meet_type: 'instant_meet',
          status: 'in_progress',
          notes: 'Instant Meet - Started immediately',
          created_from: 'instant_meet',
          whereby_room_url: meetingUrl || meetingLink
        })
      });
      
      const meetData = await meetResponse.json();
      console.log('✅ Instant meet created:', meetData.meet?.id);
      
      // 2. Create presentation session for analytics
      const presResponse = await fetch('/api/presentations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_email: agentName,
          agent_name: agentName?.split('@')[0] || 'agent',
          presentation_url: meetingLink,
          presentation_type: 'whereby',
          window_title: `AOI Meet - ${lead?.firstName || 'Client'}`
        })
      });
      
      const presData = await presResponse.json();
      console.log('✅ Presentation session created:', presData.sessionId);
      
      // 3. Link them together
      if (meetData.meet?.id && presData.sessionId) {
        await fetch(`/api/meets/${meetData.meet.id}/link-presentation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presentation_session_id: presData.sessionId })
        });
        console.log('✅ Meet linked to presentation session');
      }
      
    } catch (error) {
      console.error('❌ Failed to create instant meet:', error);
      // Continue anyway - don't block the meeting
    }
    
    // Open the meeting
    window.open(meetingLink, '_blank', 'width=1200,height=800');
    toast({
      title: "Meeting Started",
      description: "AOI Meet room opened in new window",
    });
  };

  const launchHPPro = () => {
    const hpProUrl = `https://leads.healthplanpro.com/`;
    window.open(hpProUrl, '_blank', 'width=1600,height=1000,toolbar=no,scrollbars=yes,resizable=yes');
    toast({
      title: "HP Pro Launched",
      description: "Health Plan Pro opened in new window",
    });
  };

  const sendSMS = async () => {
    // Validate phone number
    const phoneToSend = clientPhone.trim();
    if (!phoneToSend) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to send the meeting invite",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    
    try {
      // Make sure we have the meeting URL - use current meetingUrl or construct it
      const actualMeetingUrl = meetingUrl || `https://aoi.whereby.com/${meetingId}`;
      
      // ALWAYS ensure the message includes the meeting URL
      let messageToSend = customMessage || '';
      
      // If custom message doesn't include the URL, add it
      if (!messageToSend.includes(actualMeetingUrl)) {
        const leadName = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'client' : 'client';
        // Filter out "undefined undefined" or empty agentName
        const cleanAgentName = agentName && agentName.trim() && !agentName.includes('undefined') ? agentName.trim() : null;
        messageToSend = customMessage 
          ? `${customMessage}\n\nMeeting Link: ${actualMeetingUrl}`
          : `${cleanAgentName || 'Your producer'} has invited you to a video meeting, ${leadName}. Please join: ${actualMeetingUrl}`;
      }
      
      console.log('📱 Sending SMS with meeting URL:', { 
        to: phoneToSend, 
        message: messageToSend,
        meetingUrl: actualMeetingUrl
      });
      
      // SEND IT - Works with ANY phone number format (Twilio handles formatting)
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneToSend,
          message: messageToSend
        })
      });

      if (response.ok) {
        console.log('✅ SMS sent successfully to:', phoneToSend);
        toast({
          title: "Text Sent!",
          description: `Meeting invite sent to ${phoneToSend}`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ SMS failed:', errorData);
        throw new Error(errorData.message || 'SMS sending failed');
      }
    } catch (error: any) {
      console.error('❌ SMS Error:', error);
      toast({
        title: "SMS Failed",
        description: error.message || "Could not send text message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setMeetingId('');
    setClientPhone('');
    setCustomMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 [&>button]:hidden">
        {/* Header - Match Schedule Appointment Design */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative">
          <DialogClose asChild>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white hover:text-white transition-all rounded-full p-2.5 hover:bg-white/30 backdrop-blur-sm border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl hover:scale-110 group"
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </DialogClose>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">AOI Meet - Step 2</h2>
              <p className="text-blue-100">
                {lead ? `Meeting with ${lead.firstName} ${lead.lastName}` : 'Video Meeting Setup'}
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-blue-200">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-blue-500">
                1
              </div>
              <span className="text-sm font-medium">Meeting Type</span>
            </div>
            <div className="h-0.5 flex-1 bg-white" />
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-white text-blue-600">
                2
              </div>
              <span className="text-sm font-medium">Connect & Start</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Section - Meeting Details */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">Meeting Room Details</h3>
                
                {/* Meeting ID Section */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                  <Label htmlFor="meetingId" className="text-sm font-medium">Meeting ID</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="meetingId"
                      value={meetingId}
                      readOnly
                      className="flex-1 bg-white dark:bg-gray-800 font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateNewMeetingId}
                    >
                      Generate New
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Meeting URL: <span className="font-mono">{meetingUrl || `https://aoi.whereby.com/${meetingId}`}</span>
                  </p>
                </div>

                {/* Three Action Buttons */}
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    onClick={startMeeting}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Video className="w-5 h-5 mr-2" />
                    START Meeting
                  </Button>
                  
                  <Button
                    onClick={sendSMS}
                    disabled={isSending}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {isSending ? 'Sending...' : 'Send Text'}
                  </Button>
                  
                  <Button
                    onClick={launchHPPro}
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Launch HP PRO
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Section - SMS Configuration */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">SMS Invitation</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="clientPhone">Client Phone Number</Label>
                    <Input
                      id="clientPhone"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Enter any phone number (e.g., 5032018470 or +15032018470)"
                      type="tel"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Works with any format - Twilio will handle formatting automatically
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="customMessage">Custom Message</Label>
                    <Textarea
                      id="customMessage"
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={6}
                      placeholder="Enter your custom message..."
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={copyMeetingLink}
                    variant="outline"
                    className="w-full"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Meeting Link
                  </Button>
                </div>
              </div>

              {/* Meeting Info */}
              {lead && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">Client Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>{lead.firstName} {lead.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{lead.phone}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}