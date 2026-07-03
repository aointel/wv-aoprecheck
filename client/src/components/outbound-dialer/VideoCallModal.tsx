import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Using Phone icon instead of Video to avoid import issues - it's just a decorative icon anyway
import { Phone, MessageSquare, ExternalLink, Clock, Users, Mail, Presentation, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Lead } from './types';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLead?: Lead;
  userEmail?: string;
  autoStart?: boolean;
}

export function VideoCallModal({ isOpen, onClose, currentLead, userEmail, autoStart = false }: VideoCallModalProps) {
  // Debug: Log the received lead data
  React.useEffect(() => {
    if (isOpen && currentLead) {
      console.log('🎥 VideoCallModal received lead data:', {
        name: currentLead.name,
        phone: currentLead.phone,
        isVDPCall: currentLead.isVDPCall,
        leadId: currentLead.leadId,
        taalk_lead_id: currentLead.taalk_lead_id,
        fullLead: currentLead
      });
    }
  }, [isOpen, currentLead]);

  // Generate producer-based room name for consistent meeting rooms
  const getproducerRoomName = () => {    
    // Use producer's email prefix (everything before @aoglobelife.com)
    if (userEmail) {
      return userEmail.split('@')[0];
    }
    // Fallback for testing
    return 'producer-room';
  };

  const [roomName, setRoomName] = useState(() => getproducerRoomName());
  const [smsMessage, setSmsMessage] = useState('');
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [wherebyMeeting, setWherebyMeeting] = useState<any>(null);
  const [showHPPro, setShowHPPro] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();

  // Set producer room name when modal opens and auto-start if requested
  React.useEffect(() => {
    if (isOpen && userEmail) {
      const producerRoomName = getproducerRoomName();
      setRoomName(producerRoomName);
      
      // Auto-start meeting if requested - DIRECTLY OPEN POPUP
      if (autoStart && !wherebyMeeting) {
        console.log('🚀 Auto-starting HP Pro popup window...');
        setTimeout(() => {
          openDirectPopup();
        }, 500);
      }
      console.log('🎥 VideoCallModal: Modal opened, setting producer room name:', producerRoomName);
      setRoomName(producerRoomName);
    }
  }, [isOpen, userEmail]);

  // Don't change room name when leads refresh - this was causing the problem!

  // Generate the consistent Whereby URL for this producer
  const getproducerWherebyUrl = () => {
    const agentName = getproducerRoomName();
    return `https://aoi.whereby.com/${agentName}`;
  };

  // Create a pre-populated SMS message with direct Whereby URL
  const defaultSmsMessage = React.useMemo(() => {
    const agentName = getproducerRoomName();
    // Use direct Whereby URL for SMS - clean and simple
    const wherebyUrl = `https://aoi.whereby.com/${agentName}`;
    
    return currentLead 
      ? `Hi ${currentLead.name}, please join our secure video meeting: ${wherebyUrl}`
      : `Hi! Please join our secure video meeting: ${wherebyUrl}`;
  }, [currentLead, userEmail]);

  React.useEffect(() => {
    if (isOpen) {
      console.log('🎥 VideoCallModal: Pre-populating SMS with meeting URL:', defaultSmsMessage);
      setSmsMessage(defaultSmsMessage);
    }
  }, [isOpen, defaultSmsMessage]);

  const sendSmsInvite = async () => {
    const phoneToUse = manualPhoneNumber || currentLead?.phone;
    
    if (!phoneToUse) {
      toast({
        title: "No Phone Number",
        description: "Please enter a phone number or select a lead with a phone number",
        variant: "destructive"
      });
      return;
    }

    // Ensure we have a meeting room first (with proper waiting room)
    if (!wherebyMeeting?.roomUrl) {
      toast({
        title: "No Waiting Room Active",
        description: "Please start a meeting first to create the waiting room",
        variant: "destructive"
      });
      return;
    }

    try {
      // Send SMS with actual waiting room URL from locked meeting
      const response = await fetch('/api/whereby/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneToUse,
          leadName: currentLead?.name || 'Client',
          agentName: 'producer',
          meetingUrl: wherebyMeeting.roomUrl // Real waiting room URL from API
        })
      });

      if (response.ok) {
        toast({
          title: "SMS Sent Successfully!",
          description: `Waiting room invite sent to ${phoneToUse}`,
        });
      } else {
        throw new Error('Failed to send SMS');
      }
    } catch (error) {
      toast({
        title: "SMS Failed",
        description: "Could not send meeting invite",
        variant: "destructive"
      });
    }
  };



  // DIRECT POPUP FUNCTION - NO MODAL INTERFACE
  const openDirectPopup = async () => {
    try {
      console.log('🚀 OPENING DIRECT HP PRO POPUP - NO MODAL');
      
      // Create meeting first
      const response = await fetch('/api/whereby/create-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: userEmail,
          roomName: roomName
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create meeting');
      }
      
      const meeting = await response.json();
      console.log('🎥 Meeting created, opening popup immediately:', meeting);
      
      // IMMEDIATELY OPEN POPUP - NO MODAL INTERFACE
      const popup = window.open(
        meeting.hostRoomUrl,
        'HPProWindow',
        'width=1600,height=1000,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no'
      );
      
      if (popup) {
        setTimeout(() => {
          const screenWidth = screen.width;
          const screenHeight = screen.height;
          const left = (screenWidth - 1600) / 2;
          const top = (screenHeight - 1000) / 2;
          popup.moveTo(left, top);
          popup.focus();
        }, 100);
        
        // Keep modal open - just show popup window
        
        toast({
          title: "HP Pro Opened",
          description: "Video interface opened in separate window",
          duration: 2000,
        });
      } else {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups and try again",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Failed to open HP Pro popup:', error);
      toast({
        title: "Failed to Open HP Pro",
        description: "Could not open video window. Please try again.",
        variant: "destructive"
      });
    }
  };

  const joinVideoCall = async () => {
    try {
      console.log('🎥 VideoCallModal: Creating locked waiting room for producer:', roomName);
      
      // Create proper locked waiting room via Whereby API
      const response = await fetch('/api/whereby/create-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: userEmail,
          roomName: roomName // producer room name (e.g., "cnsysop")
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create locked waiting room');
      }
      
      const meeting = await response.json();
      console.log('🎥 VideoCallModal: Locked waiting room created:', meeting);
      
      // Set meeting data with proper locked room URLs
      setWherebyMeeting({
        meetingId: meeting.meetingId,
        roomUrl: meeting.roomUrl,         // Client URL → lands in waiting room
        hostRoomUrl: meeting.hostRoomUrl  // Host URL → can admit clients
      });

      // Create SMS message with client waiting room URL
      const updatedSmsMessage = currentLead 
        ? `Hi ${currentLead.name}, please join our video meeting: ${meeting.roomUrl} - I'll admit you from the waiting room.`
        : `Hi! Please join our video meeting: ${meeting.roomUrl} - Please wait to be admitted.`;
      
      setSmsMessage(updatedSmsMessage);
      console.log('🎥 VideoCallModal: SMS ready with waiting room URL:', updatedSmsMessage);
      
      // ALWAYS OPEN IN POPUP WINDOW - NO MATTER WHAT (HP Pro)
      console.log('🚀 FORCE OPENING POPUP WINDOW - HP Pro interface');
      const popup = window.open(
        meeting.hostRoomUrl,
        'HPProVideoMeeting',
        'width=1600,height=1000,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no'
      );
      
      if (popup) {
        // Force focus and center the popup
        setTimeout(() => {
          const screenWidth = screen.width;
          const screenHeight = screen.height;
          const left = (screenWidth - 1600) / 2;
          const top = (screenHeight - 1000) / 2;
          popup.moveTo(left, top);
          popup.focus();
        }, 100);
        
        toast({
          title: "HP Pro Opened",
          description: "Video meeting interface opened in popup window",
          duration: 3000,
        });
      } else {
        // Force retry popup if blocked
        setTimeout(() => {
          const retryPopup = window.open(
            meeting.hostRoomUrl,
            'HPProVideoMeeting',
            'width=1600,height=1000'
          );
          if (!retryPopup) {
            toast({
              title: "Popup Blocked",
              description: "Please allow popups and try the Meeting button again",
              variant: "destructive"
            });
          } else {
            retryPopup.focus();
          }
        }, 500);
      }
    } catch (error) {
      console.error('❌ Failed to create waiting room:', error);
      toast({
        title: "Waiting Room Failed",
        description: "Could not create locked meeting room. Please try again.",
        variant: "destructive"
      });
    }
  };

  const copyClientLink = () => {
    // Use the actual waiting room URL from the locked meeting
    if (wherebyMeeting?.roomUrl) {
      navigator.clipboard.writeText(wherebyMeeting.roomUrl);
      toast({
        title: "Waiting Room Link Copied", 
        description: "Client will join the waiting room and await admission",
      });
    } else {
      toast({
        title: "No Waiting Room Active", 
        description: "Please start a meeting first to create the waiting room",
        variant: "destructive"
      });
    }
  };

  const openInPopupWindow = () => {
    const producerRoomName = getproducerRoomName();
    const meetingUrl = wherebyMeeting?.hostRoomUrl || `https://aoi.whereby.com/${producerRoomName}`;
    
    // Open in a separate browser window (true popup window, not modal)
    const popup = window.open(
      meetingUrl,
      'videoMeeting',
      'width=1600,height=1000,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no'
    );
    
    if (popup) {
      // Center the popup window on screen
      const screenWidth = screen.width;
      const screenHeight = screen.height;
      const left = (screenWidth - 1600) / 2;
      const top = (screenHeight - 1000) / 2;
      popup.moveTo(left, top);
      
      toast({
        title: "Meeting Opened in Separate Window",
        description: "Video call now running in its own browser window",
      });
    } else {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site and try again",
        variant: "destructive"
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl border overflow-hidden relative max-h-[90vh] flex flex-col"
           style={{ 
             width: '1600px',
             maxWidth: '95vw',
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
           }}
           onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
        >
          ×
        </button>

        
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side - Video or HP Pro Frame */}
          <div className="flex-1 bg-gray-900 rounded-l-lg overflow-hidden relative">
            {showHPPro ? (
              // HP Pro Iframe - now follows same widescreen sizing rules
              <>
                <div className="flex items-center justify-between p-3 bg-blue-600 text-white">
                  <h3 className="font-semibold text-sm">HP Pro Sales Platform</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        // Open HP Pro in popup window
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
              // Video meeting is running in separate popup - show control panel
              <div className="flex items-center justify-center h-full text-white">
                <div className="text-center space-y-4">
                  <div className="bg-green-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                    <Phone className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Video Meeting Active</h3>
                  <p className="text-gray-300">Meeting is running in a separate window</p>
                  <div className="space-y-2">
                    <Button
                      onClick={openInPopupWindow}
                      variant="outline"
                      className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Reopen Video Window
                    </Button>
                    <div className="text-sm text-gray-400">
                      Use this control panel to manage invites and settings
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Default state
              <div className="flex items-center justify-center h-full text-white">
                <div className="text-center">
                  <Phone className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300 mb-4">Click "Open Meeting Room" to start your session</p>
                  <p className="text-sm text-gray-400">Video will open in a separate window</p>
                </div>
              </div>
            )}
            {/* Title area */}
            <div className="absolute top-4 left-4">
              <div className="text-white">
                {/* Title removed to avoid covering content */}
              </div>
            </div>
          </div>

          {/* Sidebar Toggle Button */}
          {sidebarCollapsed && (
            <div className="absolute top-6 right-6 z-40">
              <Button
                onClick={() => setSidebarCollapsed(false)}
                variant="outline"
                size="sm"
                className="bg-white/95 backdrop-blur-sm shadow-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Right Sidebar - Meeting Controls */}
          <div className={`${sidebarCollapsed ? 'w-0' : 'w-96'} bg-white border-l transition-all duration-300 overflow-hidden flex flex-col`}>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Header with collapse only */}
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-semibold text-gray-900">Meeting Controls</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setSidebarCollapsed(true)}
                    variant="ghost"
                    size="sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            {/* Current Lead Info */}
            {currentLead && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <h3 className="font-semibold text-lg text-blue-900">{currentLead.name}</h3>
                    <div className="space-y-1 text-sm text-blue-700 mt-2">
                      <p className="flex items-center justify-center gap-2">
                        <Phone className="w-4 h-4" />
                        {currentLead.phone}
                      </p>
                      <p className="flex items-center justify-center gap-2">
                        <Mail className="w-4 h-4" />
                        {currentLead.email}
                      </p>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 mt-2">
                        {currentLead.market}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sales Presentation Tool - REMOVED - Use button in Call Connector Pro instead */}

            {/* AOI Meet Room Controls */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h4 className="font-medium">AOI Meet Room</h4>
                
                {/* Room ID */}
                <div>
                  <Label htmlFor="roomName" className="text-xs text-gray-600">Room ID</Label>
                  <Input
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                    placeholder="producer-room"
                    className="text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button onClick={joinVideoCall} className="w-full bg-green-600 hover:bg-green-700">
                    <Phone className="w-4 h-4 mr-2" />
                    Start AOI Meet (Popup Window)
                  </Button>
                  
                  <Button onClick={copyClientLink} variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Copy Client Link
                  </Button>
                </div>

                {/* AOI Meet Status */}
                {wherebyMeeting && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                      <span className="font-medium text-green-800 text-sm">Room Active</span>
                    </div>
                    <p className="text-xs text-green-700">
                      Clients will join waiting room and await admission
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMS Controls */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h4 className="font-medium text-sm">SMS Invitation</h4>
                
                {/* Phone Number */}
                <div>
                  <Label htmlFor="phoneNumber" className="text-xs text-gray-600">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={manualPhoneNumber}
                    onChange={(e) => setManualPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="font-mono text-sm"
                  />
                  {currentLead?.phone && (
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {currentLead.phone}
                    </p>
                  )}
                </div>

                {/* SMS Message */}
                <div>
                  <Label htmlFor="smsMessage" className="text-xs text-gray-600">Message</Label>
                  <Textarea
                    id="smsMessage"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    rows={3}
                    className="text-sm"
                    placeholder="Enter message..."
                  />
                </div>

                <Button onClick={sendSmsInvite} className="w-full bg-green-600 hover:bg-green-700">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send SMS Invite
                </Button>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-medium text-sm mb-2">How it works:</h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
                  <li>Open AOI Meet room to create waiting room</li>
                  <li>Send SMS invite with AOI Meet link</li>
                  <li>Client joins and waits for admission</li>
                  <li>Admit client from waiting room to begin</li>
                </ol>
              </CardContent>
            </Card>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}