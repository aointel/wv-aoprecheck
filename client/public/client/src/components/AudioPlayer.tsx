import { useState, useRef, useEffect } from "react";
import { 
  X, Download, Minus, Plus, User, FileText, Play, Pause, 
  SkipBack, SkipForward, Volume2, VolumeX, Phone, Calendar,
  Clock, Mic, AlertTriangle, Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Call } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface AudioPlayerProps {
  recording: Call;
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioPlayer({ recording, isOpen, onClose }: AudioPlayerProps) {
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const { toast } = useToast();

  // State to track if there's an error
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);

  // Initialize transcript from existing data
  useEffect(() => {
    if (recording.transcriptionText) {
      setTranscriptionText(recording.transcriptionText);
    }
  }, [recording.transcriptionText]);

  // Load audio metadata when component mounts or recording changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Reset error state when trying to load a new recording
    setAudioError(null);
    
    console.log("Loading recording with TaalkUID:", recording.taalkUID);
    
    // Audio source is now set directly in the audio element
    try {
      // Just make sure the audio is loaded
      audio.load();
    } catch (error) {
      console.error("Exception while loading audio:", error);
      setAudioError("An error occurred while trying to load the recording.");
    }

    const handleLoadedMetadata = () => {
      console.log("Audio metadata loaded, duration:", audio.duration);
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      console.log("Audio playback ended");
      setIsPlaying(false);
      setCurrentTime(0);
      if (audio) audio.currentTime = 0;
    };
    
  // Handle audio loading errors
  const handleError = (e: any) => {
      console.error("Audio playback error:", e);
      
      const errorMessage = e.target && e.target.error 
        ? `Error code: ${e.target.error.code}, message: ${e.target.error.message || 'Unknown error'}`
        : 'Failed to load or play the recording';
      
      console.error("Detailed error:", errorMessage);
      console.error("TaalkUID used for fetching:", recording.taalkUID);
      
      // Set a simple error message
      setAudioError("Unable to play this recording. The file might be missing or corrupted.");
      
      const { toast } = useToast();
      toast({
        title: "Audio playback failed",
        description: "The recording file could not be loaded",
        variant: "destructive",
      });
      
      // Stop playback if it was playing
      setIsPlaying(false);
    };

    const handleCanPlayThrough = () => {
      console.log("Audio can play through without buffering");
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    // Attempt to play the audio once loaded to test if it works
    audio.oncanplaythrough = () => {
      console.log("Audio is ready to play");
    };

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      cancelAnimationFrame(animationRef.current as number);
    };
  }, [recording.taalkUID]);

  // Update playback speed when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update volume and mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  if (!isOpen) return null;

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      cancelAnimationFrame(animationRef.current as number);
    } else {
      audio.play();
      animationRef.current = requestAnimationFrame(updateProgress);
    }

    setIsPlaying(!isPlaying);
  };

  const updateProgress = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    animationRef.current = requestAnimationFrame(updateProgress);
  };

  const decreaseSpeed = () => {
    if (playbackSpeed > 0.5) {
      setPlaybackSpeed(prev => Math.round((prev - 0.25) * 10) / 10);
    }
  };

  const increaseSpeed = () => {
    if (playbackSpeed < 2.0) {
      setPlaybackSpeed(prev => Math.round((prev + 0.25) * 10) / 10);
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration, 
        audioRef.current.currentTime + 10
      );
    }
  };

  const handleSliderChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleDownload = () => {
    if (recording.taalkUID) {
      try {
        // Use the local storage URL for downloads
        const downloadUrl = `/api/recordings/local/${recording.taalkUID}.mp3`;
        
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `recording-${recording.taalkUID}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Download error:", error);
        toast({
          title: "Download Failed", 
          description: "An error occurred during download. Please try again later.",
          variant: "destructive"
        });
      }
    }
  };

  const handleTranscribe = async () => {
    if (!recording.taalkUID) return;
    
    // If transcript already exists, scroll to show it
    if (recording.transcriptionText || transcriptionText) {
      const transcriptElement = document.querySelector('[data-transcript]');
      if (transcriptElement) {
        transcriptElement.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    
    setIsTranscribing(true);
    try {
      const response = await fetch(`/api/transcribe/${recording.taalkUID}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Transcription failed: ${response.status}`;
        
        if (errorText.includes('quota') || errorText.includes('insufficient_quota')) {
          errorMessage = "OpenAI API quota exceeded. Contact administrator to update API key with sufficient credits.";
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setTranscriptionText(data.transcription);
      
      toast({
        title: "Transcription Complete",
        description: "Audio transcribed successfully with AOI formatting.",
      });
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        title: "Transcription Failed",
        description: error.message || "Failed to transcribe audio. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  // Format time (seconds) to MM:SS format
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <div className="bg-indigo-50 p-2.5 rounded-lg mr-3">
              <Mic className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Call Recording</h2>
              <div className="text-sm text-slate-500">ID: #{recording.id}</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex flex-col md:flex-row">
          {/* Left sidebar with call details */}
          <div className="w-full md:w-64 p-4 bg-slate-50 border-r border-slate-200">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Call Details</h3>
                <div>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    {recording.callDuration || '00:00'}
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium">{recording.phone}</p>
                    {recording.taalkUID && (
                      <p className="text-xs text-blue-600 mt-0.5">TaalkUID: {recording.taalkUID}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-start">
                  <User className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Client</p>
                    <p className="text-sm font-medium">{`${recording.firstName} ${recording.lastName}`}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Calendar className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="text-sm">
                      {recording.callDate ? formatDate(new Date(recording.callDate)) : 'No date'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Clock className="h-4 w-4 text-slate-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-xs text-slate-500">Time</p>
                    <p className="text-sm">
                      {recording.callDate ? new Date(recording.callDate).toLocaleTimeString() : 'No time'}
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Button 
                  variant="default" 
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Download MP3</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span>
                    {isTranscribing 
                      ? 'Transcribing...' 
                      : (recording.transcriptionText ? 'View Transcript' : 'Create Transcript')
                    }
                  </span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Main audio player */}
          <div className="flex-1 p-6">
            <div className="hidden">
              <audio 
                ref={audioRef}
                src={`/api/recordings/local/${recording.taalkUID}.mp3`}
                preload="auto"
                controls
              >
                Your browser does not support the audio element.
              </audio>
            </div>
            
            {/* Error message display */}
            {audioError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium mb-1">Audio Playback Issue</h3>
                    <p className="text-sm">{audioError}</p>
                    
                    {audioError.includes('authentication') || audioError.includes('credentials') ? (
                      <div className="mt-3 flex items-start">
                        <Key className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">
                          The TaalkAI API requires proper authentication credentials. 
                          Please contact an administrator to configure API access.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm mt-2">
                        Please try again later or contact support if this issue persists.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Transcription Section */}
            {(transcriptionText || recording.transcriptionText) && (
              <div data-transcript className="mb-6 border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-medium">Transcript</h3>
                </div>
                <div className="bg-white rounded border p-3 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {transcriptionText || recording.transcriptionText}
                  </p>
                </div>
              </div>
            )}
            
            {/* Waveform visualization (simplified) */}
            <div className="h-24 bg-slate-50 rounded-lg mb-6 flex items-center justify-center">
              <div className="relative w-full h-16 px-6">
                {/* Simplified waveform visualization */}
                <div className="absolute inset-0 flex items-center justify-center gap-1">
                  {Array.from({ length: 40 }).map((_, i) => {
                    // Create a simple pattern for visualization
                    const height = 20 + Math.sin(i * 0.5) * 15;
                    const isActive = (i / 40) < (currentTime / duration);
                    
                    return (
                      <div 
                        key={i} 
                        className={`w-1 rounded-full ${isActive ? 'bg-blue-500' : 'bg-slate-300'}`}
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Playback progress bar */}
            <div className="mb-6">
              <Slider 
                value={[currentTime]} 
                min={0} 
                max={duration || 100}
                step={0.01}
                onValueChange={handleSliderChange}
                className="mb-1"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            {/* Playback controls */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`h-8 w-8 rounded-full ${
                    audioError ? 'text-slate-400 cursor-not-allowed' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={skipBackward}
                  disabled={!!audioError}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                
                <Button 
                  variant="default" 
                  size="icon"
                  className={`h-12 w-12 rounded-full ${
                    audioError ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  onClick={togglePlayPause}
                  disabled={!!audioError}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`h-8 w-8 rounded-full ${
                    audioError ? 'text-slate-400 cursor-not-allowed' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={skipForward}
                  disabled={!!audioError}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Additional controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Playback speed control */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-7 w-7 rounded-full" 
                  onClick={decreaseSpeed}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 py-1 bg-white rounded border border-slate-200 text-xs font-medium min-w-[40px] text-center">
                  {playbackSpeed.toFixed(1)}x
                </span>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-7 w-7 rounded-full" 
                  onClick={increaseSpeed}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              {/* Volume control */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7 rounded-full text-slate-500"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </Button>
                <div className="w-24">
                  <Slider 
                    value={[isMuted ? 0 : volume]} 
                    min={0} 
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
