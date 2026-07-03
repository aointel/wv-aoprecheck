import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

interface VolumeControlProps {
  className?: string;
  showLabel?: boolean;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({ 
  className = '', 
  showLabel = true 
}) => {
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if running in Electron
  const isElectron = window.isElectron;

  useEffect(() => {
    if (isElectron && window.electronAPI) {
      loadCurrentVolume();
    }
  }, [isElectron]);

  const loadCurrentVolume = async () => {
    if (!window.electronAPI?.getSystemVolume) return;
    
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getSystemVolume();
      if (result.success) {
        setVolume(result.volume);
      }
    } catch (error) {
      console.error('Failed to load volume:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    if (!window.electronAPI?.setSystemVolume) return;
    
    try {
      const result = await window.electronAPI.setSystemVolume(newVolume);
      if (result.success) {
        setVolume(result.volume);
        setIsMuted(false);
      }
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  };

  const handleMuteToggle = async () => {
    if (!window.electronAPI) return;
    
    try {
      if (isMuted) {
        const result = await window.electronAPI.unmuteSystem();
        if (result.success) {
          setIsMuted(false);
        }
      } else {
        const result = await window.electronAPI.muteSystem();
        if (result.success) {
          setIsMuted(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  // Don't render if not in Electron
  if (!isElectron) {
    return null;
  }

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX;
    if (volume < 50) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Volume
        </span>
      )}
      
      <button
        onClick={handleMuteToggle}
        disabled={isLoading}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      <div className="flex items-center space-x-2 flex-1 min-w-0">
        <input
          type="range"
          min="0"
          max="100"
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
          disabled={isLoading}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:opacity-50"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${isMuted ? 0 : volume}%, #e5e7eb ${isMuted ? 0 : volume}%, #e5e7eb 100%)`
          }}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
          {isMuted ? 'Muted' : `${volume}%`}
        </span>
      </div>
    </div>
  );
};

export default VolumeControl;
