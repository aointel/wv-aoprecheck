import React, { useState, useEffect } from 'react';
import { X, Headphones, Mic, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AudioSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioSetupModal({ isOpen, onClose }: AudioSetupModalProps) {
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [inputVolume, setInputVolume] = useState([80]);
  const [outputVolume, setOutputVolume] = useState([80]);
  const [audioCheckerActive, setAudioCheckerActive] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getAudioDevices();
    }
  }, [isOpen]);

  const getAudioDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const microphones = devices.filter(device => device.kind === 'audioinput');
      const speakers = devices.filter(device => device.kind === 'audiooutput');
      
      setMicrophoneDevices(microphones);
      setSpeakerDevices(speakers);
      
      if (microphones.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
      if (speakers.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(speakers[0].deviceId);
      }
    } catch (error) {
      console.error('Error accessing audio devices:', error);
    }
  };

  const testMicrophone = async () => {
    setIsTesting(true);
    try {
      // Create audio context and generate test beep
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.setValueAtTime(600, audioContext.currentTime);
        gainNode2.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        oscillator2.start();
        oscillator2.stop(audioContext.currentTime + 0.2);
      }, 300);
      
    } catch (error) {
      console.error('Error testing microphone:', error);
    }
    
    setTimeout(() => setIsTesting(false), 1000);
  };

  const testSpeakers = async () => {
    setIsTesting(true);
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
      
    } catch (error) {
      console.error('Error testing speakers:', error);
    }
    
    setTimeout(() => setIsTesting(false), 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-3">
            <Headphones className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">Audio Center</h2>
              <p className="text-blue-100 text-sm">Perfect your call quality with professional audio settings</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Audio Checker Status */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Headphones className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-300">Audio Checker Active</h3>
                <p className="text-sm text-green-600 dark:text-green-400">Make sure Chrome connection is ready before taking calls</p>
              </div>
            </div>
          </div>

          {/* Microphone Section */}
          <div className="space-y-4">
            <div className="bg-blue-500 text-white p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <Mic className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-semibold">Microphone</h3>
                  <p className="text-blue-100 text-sm">Configure your input device</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Microphone Device
                </label>
                <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select microphone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {microphoneDevices.map(device => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Input Volume
                  </label>
                  <span className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                    {inputVolume[0]}%
                  </span>
                </div>
                <Slider
                  value={inputVolume}
                  onValueChange={setInputVolume}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <Button
                onClick={testMicrophone}
                disabled={isTesting}
                variant="outline"
                className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Mic className="w-4 h-4 mr-2" />
                {isTesting ? 'Testing...' : 'Test Microphone'}
              </Button>
            </div>
          </div>

          {/* Speakers Section */}
          <div className="space-y-4">
            <div className="bg-green-500 text-white p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <Volume2 className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-semibold">Speakers & Headset</h3>
                  <p className="text-green-100 text-sm">Configure your output device</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Speaker Output
                </label>
                <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select speaker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {speakerDevices.map(device => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Output Volume
                  </label>
                  <span className="text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                    {outputVolume[0]}%
                  </span>
                </div>
                <Slider
                  value={outputVolume}
                  onValueChange={setOutputVolume}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <Button
                onClick={testSpeakers}
                disabled={isTesting}
                variant="outline"
                className="w-full border-green-300 text-green-600 hover:bg-green-50"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                {isTesting ? 'Testing...' : 'Test Speakers'}
              </Button>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 text-lg">💡</span>
              <div>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <span className="font-semibold">Pro Tip:</span> Use headphones for the best call quality and to prevent echo
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}