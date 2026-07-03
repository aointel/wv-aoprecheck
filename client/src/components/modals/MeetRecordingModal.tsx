/**
 * Meet Recording Player Modal
 * Play Whereby recordings with transcript
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import { useState, useRef } from 'react';

interface MeetRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meet: {
    id: string;
    client_first_name?: string;
    client_last_name?: string;
    recording_url?: string;
    transcript?: string;
    conversation_analysis?: any;
  };
}

export function MeetRecordingModal({ isOpen, onClose, meet }: MeetRecordingModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const downloadRecording = () => {
    if (!meet.recording_url) return;
    window.open(meet.recording_url, '_blank');
  };

  const clientName = `${meet.client_first_name || ''} ${meet.client_last_name || ''}`.trim() || 'Client';

  if (!meet.recording_url) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>No Recording Available</DialogTitle>
          </DialogHeader>
          <div className="p-8 text-center text-gray-500">
            <p>This meeting was not recorded or the recording is still processing.</p>
            <p className="text-sm mt-2">Recordings are available ~5 minutes after the meeting ends.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Meeting Recording - {clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Player */}
          <div className="bg-black rounded-lg overflow-hidden">
            <video 
              ref={videoRef}
              src={meet.recording_url}
              className="w-full"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={togglePlay} size="sm">
                {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button onClick={toggleMute} size="sm" variant="outline">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>
            <Button onClick={downloadRecording} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>

          {/* AI Analysis */}
          {meet.conversation_analysis && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Outcome</div>
                <div className="text-lg font-bold text-blue-900">
                  {meet.conversation_analysis.outcome || 'N/A'}
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Talk Time</div>
                <div className="text-lg font-bold text-green-900">
                  {meet.conversation_analysis.agent_talk_time_percentage || 0}%
                </div>
              </div>
            </div>
          )}

          {/* Transcript */}
          {meet.transcript && (
            <div className="max-h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-semibold mb-2">Transcript:</div>
              <div className="text-sm whitespace-pre-wrap">{meet.transcript}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

