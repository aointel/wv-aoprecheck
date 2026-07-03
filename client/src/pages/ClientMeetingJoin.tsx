import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Users, Clock } from 'lucide-react';

export default function ClientMeetingJoin() {
  const [leadName, setLeadName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setLeadName(urlParams.get('leadName') || 'Client');
    setRoomId(urlParams.get('room') || 'meeting-room');
  }, []);

  const joinMeeting = () => {
    setIsJoining(true);
    
    // Redirect to the actual video meeting as a client
    const videoMeetingUrl = `/video-meeting?room=${encodeURIComponent(roomId)}&agentName=Client&leadName=${encodeURIComponent(leadName)}`;
    window.location.href = videoMeetingUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* AO Intelligence Branding */}
          <div className="mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">AO Intelligence</h1>
            <p className="text-gray-600">Secure Video Meeting</p>
          </div>

          {/* Meeting Information */}
          <div className="mb-8">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-gray-700 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">You're invited to join</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Meeting with your AO producer
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Hello {leadName}, your producer is waiting for you
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>Meeting ID: {roomId.split('-')[1] || 'Secure Room'}</span>
            </div>
          </div>

          {/* Join Button */}
          <Button 
            onClick={joinMeeting}
            disabled={isJoining}
            className="w-full py-3 text-lg font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isJoining ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Joining Meeting...
              </div>
            ) : (
              <>
                <Video className="w-5 h-5 mr-2" />
                Join Video Meeting
              </>
            )}
          </Button>

          {/* Privacy Notice */}
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            This is a secure, encrypted video meeting. Your privacy is protected.
            <br />
            By joining, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}