import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Phone, MessageSquare, ExternalLink, Clock, Users, Mail, Presentation, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '../components/outbound-dialer/types';
import { HPProComponent } from '../components/outbound-dialer/HPProComponent';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';

export function MeetingPopupPage() {
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [roomName, setRoomName] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [wherebyMeeting, setWherebyMeeting] = useState<any>(null);
  const [showHPPro, setShowHPPro] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Custom toast function for popup without hook dependency
  const showToast = (title: string, description: string) => {
    console.log(`Toast: ${title} - ${description}`);
    // Simple browser notification
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title, { body: description });
    } else {
      alert(`${title}: ${description}`);
    }
  };

  // Parse URL parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leadDataParam = urlParams.get('leadData');
    const userEmailParam = urlParams.get('userEmail');
    
    if (leadDataParam) {
      try {
        const parsedLead = JSON.parse(decodeURIComponent(leadDataParam));
        setCurrentLead(parsedLead);
        console.log('🎥 Meeting popup received lead data:', parsedLead);
      } catch (error) {
        console.error('❌ Failed to parse lead data:', error);
      }
    }
    
    if (userEmailParam) {
      setUserEmail(decodeURIComponent(userEmailParam));
    }
  }, []);

  // Generate producer-based room name
  const getproducerRoomName = () => {    
    if (userEmail) {
      return userEmail.split('@')[0];
    }
    return 'producer-room';
  };

  // Initialize room name and SMS message
  useEffect(() => {
    if (userEmail) {
      const producerRoomName = getproducerRoomName();
      setRoomName(producerRoomName);
      
      const wherebyUrl = `https://aoi.whereby.com/${producerRoomName}`;
      const defaultMessage = currentLead 
        ? `Hi ${currentLead.name}, please join our secure video meeting: ${wherebyUrl}`
        : `Hi! Please join our secure video meeting: ${wherebyUrl}`;
      
      setSmsMessage(defaultMessage);
    }
  }, [userEmail, currentLead]);

  const sendSmsInvite = async () => {
    const phoneToUse = manualPhoneNumber || currentLead?.phone;
    
    if (!phoneToUse) {
      showToast("No Phone Number", "Please enter a phone number or select a lead with a phone number");
      return;
    }

    if (!wherebyMeeting?.roomUrl) {
      showToast("No Waiting Room Active", "Please start a meeting first to create the waiting room");
      return;
    }

    try {
      const response = await fetch('/api/whereby/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneToUse,
          leadName: currentLead?.name || 'Client',
          agentName: 'producer',
          meetingUrl: wherebyMeeting.roomUrl
        })
      });

      if (response.ok) {
        showToast("SMS Sent Successfully!", `Waiting room invite sent to ${phoneToUse}`);
      } else {
        throw new Error('Failed to send SMS');
      }
    } catch (error) {
      showToast("SMS Failed", "Could not send meeting invite");
    }
  };

  const createEAppSale = async () => {
    if (!currentLead) {
      showToast("No Lead Selected", "Please select a lead first");
      return;
    }

    try {
      // Parse name into first/last
      const nameParts = (currentLead.name || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Build the payload - fill what we have from the lead, blanks for the rest
      const payload: any = {
        firstName,
        lastName,
        state: currentLead.state || '',
        training: 'false',
        agentNumber: '',
        contractType: 'SGA',
        situationCode: 'AO',
      };

      // Try to fetch full client data from HPPRO session if available
      // For now use what we have from the lead object
      if ((currentLead as any).dateOfBirth || (currentLead as any).date_of_birth) {
        const dob = new Date((currentLead as any).dateOfBirth || (currentLead as any).date_of_birth);
        payload.dobMonth = String(dob.getMonth() + 1).padStart(2, '0');
        payload.dobDay   = String(dob.getDate()).padStart(2, '0');
        payload.dobYear  = String(dob.getFullYear());
      }
      if ((currentLead as any).gender) payload.gender = (currentLead as any).gender;
      if ((currentLead as any).maritalStatus || (currentLead as any).marital_status) {
        payload.familyStatus = (currentLead as any).maritalStatus || (currentLead as any).marital_status;
      }

      const response = await fetch('http://localhost:7432/create-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        showToast("EApp Created!", `Application for ${currentLead.name} is ready in EApp (ID: ${result.saleId?.slice(0,8)}...)`);
      } else {
        throw new Error('EApp injector returned error');
      }
    } catch (error) {
      showToast("EApp Failed", "Could not create application. Is EApp injector running on localhost:7432?");
    }
  };

  const joinVideoCall = async () => {
    try {
      console.log('🎥 Creating locked waiting room for producer:', roomName);
      
      const response = await fetch('/api/whereby/create-locked-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: roomName,
          isLocked: true,
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      });

      const meeting = await response.json();
      
      if (!response.ok) {
        throw new Error(meeting.error || 'Failed to create meeting');
      }

      console.log('🎥 Locked meeting created:', meeting);
      
      setWherebyMeeting({
        meetingId: meeting.meetingId,
        roomUrl: meeting.roomUrl,
        hostRoomUrl: meeting.hostRoomUrl
      });

      const updatedSmsMessage = currentLead 
        ? `Hi ${currentLead.name}, please join our video meeting: ${meeting.roomUrl} - I'll admit you from the waiting room.`
        : `Hi! Please join our video meeting: ${meeting.roomUrl} - Please wait to be admitted.`;
      
      setSmsMessage(updatedSmsMessage);
      
      showToast("Meeting Room Created", "Locked waiting room is ready for clients");
    } catch (error) {
      console.error('❌ Failed to create waiting room:', error);
      showToast("Waiting Room Failed", "Could not create locked meeting room. Please try again.");
    }
  };

  const copyClientLink = () => {
    if (wherebyMeeting?.roomUrl) {
      navigator.clipboard.writeText(wherebyMeeting.roomUrl);
      showToast("Waiting Room Link Copied", "Client will join the waiting room and await admission");
    } else {
      showToast("No Waiting Room Active", "Please start a meeting first to create the waiting room");
    }
  };

  const closeMeeting = async () => {
    if (wherebyMeeting?.meetingId) {
      try {
        await fetch('/api/whereby/end-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId: wherebyMeeting.meetingId })
        });
      } catch (error) {
        console.error('❌ Failed to end meeting:', error);
      }
    }
    
    setWherebyMeeting(null);
    setParticipantCount(0);
    
    showToast("Meeting Ended", "Video meeting has been closed");
  };

  return (
    <TooltipProvider>
      <div className="bg-white rounded-lg shadow-2xl border overflow-hidden"
           style={{ 
             width: '1600px',
             height: '1000px',
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
           }}>
        
        <div className="flex h-full">
        {/* Left Side - Video or HP Pro Frame */}
        <div className="flex-1 bg-gray-900 rounded-l-lg overflow-hidden relative">
          {showHPPro ? (
            // HP Pro Iframe
            <>
              <div className="flex items-center justify-between p-3 bg-blue-600 text-white">
                <h3 className="font-semibold text-sm">HP Pro Sales Platform</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const popup = window.open(
                        'https://hppro.planetaltig.com/#/',
                        'hppro',
                        'width=1600,height=1000,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
                      );
                      if (popup) {
                        const screenWidth = screen.width;
                        const screenHeight = screen.height;
                        const left = (screenWidth - 1600) / 2;
                        const top = (screenHeight - 1000) / 2;
                        popup.moveTo(left, top);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-white text-blue-600 hover:bg-gray-100"
                  >
                    Open in Window
                  </Button>
                  <Button
                    onClick={() => setShowHPPro(false)}
                    variant="outline"
                    size="sm"
                    className="bg-white text-blue-600 hover:bg-gray-100"
                  >
                    Close
                  </Button>
                </div>
              </div>
              <iframe
                src="https://hppro.planetaltig.com/#/"
                className="w-full h-[calc(100%-3.5rem)] border-0"
                allow="camera; microphone; fullscreen; speaker; display-capture"
                allowFullScreen
              />
            </>
          ) : wherebyMeeting?.hostRoomUrl ? (
            // Whereby Video Meeting
            <iframe
              src={wherebyMeeting.hostRoomUrl}
              className="w-full h-full border-0"
              title="Whereby Video Meeting"
              allow="camera; microphone; fullscreen; speaker; display-capture"
              allowFullScreen
            />
          ) : (
            // Default state
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-300 mb-4">Click "Open Meeting Room" to start your session</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Controls */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-96'} bg-white border-l border-gray-200 flex flex-col transition-all duration-300`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {!sidebarCollapsed && (
              <h2 className="text-lg font-semibold text-gray-900">Meeting Controls</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Lead Information */}
              {currentLead && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Lead</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="font-medium">{currentLead.name}</p>
                      <p className="text-sm text-gray-600">{currentLead.phone}</p>
                      <Badge variant="outline" className="text-xs">
                        {currentLead.market}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Meeting Room Controls */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Video Meeting</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div>
                    <Label htmlFor="roomName" className="text-xs">Room Name</Label>
                    <Input
                      id="roomName"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={joinVideoCall}
                      size="sm"
                      className="text-xs"
                      disabled={!roomName.trim()}
                    >
                      <Video className="w-3 h-3 mr-1" />
                      Open Meeting Room
                    </Button>
                    <Button 
                      onClick={copyClientLink}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={!wherebyMeeting}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Copy Client Link
                    </Button>
                  </div>

                  {wherebyMeeting && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-green-700">Meeting Active</span>
                      </div>
                      <p className="text-xs text-green-600">Room: {roomName}</p>
                      <div className="flex gap-1 mt-2">
                        <Button
                          onClick={closeMeeting}
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          End Meeting
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SMS Invitation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">SMS Invitation</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div>
                    <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                    <Input
                      id="phone"
                      value={manualPhoneNumber || currentLead?.phone || ''}
                      onChange={(e) => setManualPhoneNumber(e.target.value)}
                      placeholder="+1234567890"
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="smsMessage" className="text-xs">Message</Label>
                    <Textarea
                      id="smsMessage"
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="Enter SMS message..."
                      className="text-sm min-h-[80px]"
                    />
                  </div>

                  <Button 
                    onClick={sendSmsInvite}
                    className="w-full text-xs"
                    size="sm"
                    disabled={!wherebyMeeting}
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Send SMS Invite
                  </Button>
                </CardContent>
              </Card>

              {/* HP Pro Integration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sales Tools</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Button 
                    onClick={() => setShowHPPro(!showHPPro)}
                    variant={showHPPro ? "default" : "outline"}
                    className="w-full text-xs"
                    size="sm"
                  >
                    <Presentation className="w-3 h-3 mr-1" />
                    {showHPPro ? 'Hide HP Pro' : 'Show HP Pro'}
                  </Button>
                  <Button
                    onClick={createEAppSale}
                    variant="outline"
                    className="w-full text-xs bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    size="sm"
                  >
                    📋 EApp
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}