import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalkthroughVideoPlayerProps {
  videoUrl: string;
  title: string;
  description?: string;
  duration?: number;
  onProgress?: (watchTimeSeconds: number) => void;
  onComplete?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onReplay?: () => void;
  canSkip?: boolean;
  minWatchPercentage?: number; // Minimum percentage that must be watched to complete
  className?: string;
}

export function WalkthroughVideoPlayer({
  videoUrl,
  title,
  description,
  duration,
  onProgress,
  onComplete,
  onStart,
  onPause,
  onReplay,
  canSkip = false,
  minWatchPercentage = 90,
  className
}: WalkthroughVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [watchedTime, setWatchedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [skipAttempts, setSkipAttempts] = useState(0);

  // Track progress and watched time
  useEffect(() => {
    if (hasStarted && currentTime > watchedTime) {
      setWatchedTime(currentTime);
      onProgress?.(currentTime);
    }
  }, [currentTime, watchedTime, hasStarted, onProgress]);

  // Check completion based on minimum watch percentage
  useEffect(() => {
    if (videoDuration > 0 && watchedTime > 0 && !isCompleted) {
      const watchPercentage = (watchedTime / videoDuration) * 100;
      if (watchPercentage >= minWatchPercentage) {
        setIsCompleted(true);
        onComplete?.();
      }
    }
  }, [watchedTime, videoDuration, minWatchPercentage, isCompleted, onComplete]);

  const handlePlay = () => {
    if (!videoRef.current) return;
    
    if (!hasStarted) {
      setHasStarted(true);
      onStart?.();
    }

    videoRef.current.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    
    videoRef.current.pause();
    setIsPlaying(false);
    onPause?.();
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsCompleted(false);
    onReplay?.();
    
    if (isPlaying) {
      videoRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setVideoDuration(videoRef.current.duration);
  };

  const handleSeekAttempt = (e: React.MouseEvent) => {
    // Prevent seeking ahead if not allowed to skip
    if (!canSkip && !isCompleted) {
      e.preventDefault();
      setSkipAttempts(prev => prev + 1);
      return;
    }
  };

  const handleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (!isFullscreen) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  const watchedPercentage = videoDuration > 0 ? (watchedTime / videoDuration) * 100 : 0;

  return (
    <Card className={cn("w-full max-w-4xl mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {isCompleted && (
            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
              ✓ Completed
            </span>
          )}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Video Player */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={handleSeekAttempt}
            data-testid="walkthrough-video-player"
          />

          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center gap-3">
              {/* Play/Pause Button */}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={isPlaying ? handlePause : handlePlay}
                data-testid="video-play-pause-button"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              {/* Replay Button */}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={handleReplay}
                data-testid="video-replay-button"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              {/* Progress Bar */}
              <div className="flex-1 mx-3">
                <Progress 
                  value={progressPercentage} 
                  className="h-1 bg-white/30"
                  data-testid="video-progress-bar"
                />
                {/* Watched Progress Indicator */}
                <div 
                  className="absolute top-0 left-0 h-1 bg-green-500/60 rounded-full transition-all duration-300"
                  style={{ width: `${watchedPercentage}%` }}
                />
              </div>

              {/* Time Display */}
              <span className="text-white text-sm font-mono min-w-[80px]">
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </span>

              {/* Mute Button */}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={handleMute}
                data-testid="video-mute-button"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>

              {/* Fullscreen Button */}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={handleFullscreen}
                data-testid="video-fullscreen-button"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Watch Progress:</span>
              <span>{Math.round(watchedPercentage)}%</span>
            </div>
            <Progress value={watchedPercentage} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Required:</span>
              <span>{minWatchPercentage}%</span>
            </div>
            <Progress value={minWatchPercentage} className="h-2 opacity-50" />
          </div>
        </div>

        {/* Skip Attempts Warning */}
        {skipAttempts > 0 && !canSkip && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> You must watch at least {minWatchPercentage}% of this video to continue. 
              Skipping ahead is not allowed. ({skipAttempts} skip attempts detected)
            </p>
          </div>
        )}

        {/* Completion Status */}
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <strong>✓ Video Completed!</strong> You have successfully watched {Math.round(watchedPercentage)}% of this training video.
            </p>
          </div>
        )}

        {/* Instructions */}
        {!hasStarted && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Getting Started:</strong> Click the play button to begin this training video. 
              You must watch at least {minWatchPercentage}% to complete this section.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}