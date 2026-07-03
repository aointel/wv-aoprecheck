import React, { useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Volume1, Plus, Minus } from 'lucide-react';

interface AdvancedVolumeControlProps {
  className?: string;
  showLabel?: boolean;
  enableKeyboardShortcuts?: boolean;
}

export const AdvancedVolumeControl: React.FC<AdvancedVolumeControlProps> = ({ 
  className = '', 
  showLabel = true,
  enableKeyboardShortcuts = true
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

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts || !isElectron) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Shift + V for volume control
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        switch (event.key) {
          case 'v':
            event.preventDefault();
            handleMuteToggle();
            break;
          case 'ArrowUp':
          case '=':
          case '+':
            event.preventDefault();
            handleVolumeChange(Math.min(100, volume + 5));
            break;
          case 'ArrowDown':
          case '-':
            event.preventDefault();
            handleVolumeChange(Math.max(0, volume - 5));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [volume, enableKeyboardShortcuts, isElectron]);

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

  const handleVolumeChange = useCallback(async (newVolume: number) => {
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
  }, []);

  const handleMuteToggle = useCallback(async () => {
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
  }, [isMuted]);

  const handleVolumeUp = () => handleVolumeChange(Math.min(100, volume + 10));
  const handleVolumeDown = () => handleVolumeChange(Math.max(0, volume - 10));

  // Don't render if not in Electron
  if (!isElectron) {
    return null;
  }

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX;
    if (volume < 30) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Volume
          </span>
          {enableKeyboardShortcuts && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Ctrl+Shift+V to mute, +/- to adjust
            </span>
          )}
        </div>
      )}
      
      <div className="flex items-center space-x-1">
        <button
          onClick={handleVolumeDown}
          disabled={isLoading}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title="Volume Down (Ctrl+Shift+-)"
        >
          <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>

        <button
          onClick={handleMuteToggle}
          disabled={isLoading}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title={isMuted ? 'Unmute (Ctrl+Shift+V)' : 'Mute (Ctrl+Shift+V)'}
        >
          <VolumeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <button
          onClick={handleVolumeUp}
          disabled={isLoading}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title="Volume Up (Ctrl+Shift++)"
        >
          <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

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

export default AdvancedVolumeControl;
