import { useState, useRef, useEffect } from 'react';

interface DebugLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

export default function AlexTest() {
  const [isConnected, setIsConnected] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setDebugLogs(prev => [...prev.slice(-9), {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const startCall = async () => {
    try {
      addLog('Requesting microphone permission...', 'info');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        } 
      });
      
      mediaStreamRef.current = stream;
      addLog('Microphone access granted', 'success');
      
      // Create audio context for processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
      audioContextRef.current = audioContext;
      
      // Connect to WebSocket proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime/ws`;
      
      addLog('Connecting to voice agent...', 'info');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        addLog('Connected to voice agent', 'success');
        setIsConnected(true);
        setIsCalling(true);
        
        // Set up audio processing
        setupAudioProcessing(stream, audioContext, ws);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different event types from OpenAI Realtime API
          if (data.type === 'response.audio.delta') {
            // Audio data from AI (base64 encoded)
            if (data.delta) {
              handleAudioDelta(data.delta);
            }
          } else if (data.type === 'response.audio_transcript.delta') {
            // Transcript update
            if (data.delta) {
              setLastTranscript(prev => (prev + data.delta).trim());
            }
          } else if (data.type === 'response.text.delta') {
            // Text response
            if (data.delta) {
              setLastTranscript(prev => (prev + data.delta).trim());
            }
          } else if (data.type === 'response.audio_transcript.done') {
            // Full transcript available
            if (data.text) {
              setLastTranscript(data.text);
            }
          } else if (data.type === 'error') {
            addLog(`Error: ${data.error?.message || JSON.stringify(data)}`, 'error');
          } else if (data.type === 'session.updated') {
            addLog('Session configured', 'success');
            // Start the conversation
            ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] } }));
          } else if (data.type === 'session.created') {
            addLog('Session created', 'success');
          } else {
            // Log other event types for debugging
            console.log('Realtime event:', data.type, data);
          }
        } catch (err) {
          // Handle binary audio data
          if (event.data instanceof ArrayBuffer) {
            handleAudioData(event.data);
          }
        }
      };
      
      ws.onerror = (error) => {
        addLog('WebSocket error occurred', 'error');
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        addLog('Connection closed', 'info');
        setIsConnected(false);
        setIsCalling(false);
        cleanup();
      };
      
    } catch (error: any) {
      addLog(`Failed to start call: ${error.message}`, 'error');
      console.error('Start call error:', error);
    }
  };

  const setupAudioProcessing = async (stream: MediaStream, audioContext: AudioContext, ws: WebSocket) => {
    try {
      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create script processor for PCM16 conversion (fallback if AudioWorklet not available)
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isCalling || ws.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        // Convert float32 to int16 PCM
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send audio to OpenAI - base64 encode the PCM16 data
        // Convert Int16Array to Uint8Array for base64 encoding
        const uint8Array = new Uint8Array(pcm16.buffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Audio = btoa(binaryString);
        
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: base64Audio
        };
        
        ws.send(JSON.stringify(audioMessage));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Start capturing audio - commit the buffer
      // Note: We'll send audio chunks as they come in via input_audio_buffer.append
      
    } catch (error: any) {
      addLog(`Audio setup error: ${error.message}`, 'error');
      console.error('Audio processing error:', error);
    }
  };

  const handleAudioDelta = (delta: string) => {
    // Base64 audio data - decode and play
    if (delta && audioContextRef.current) {
      try {
        // Decode base64 to binary
        const binaryString = atob(delta);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        // Convert to Int16Array (PCM16)
        const pcm16 = new Int16Array(bytes.buffer);
        playAudioData(pcm16.buffer);
      } catch (err) {
        console.error('Error decoding audio delta:', err);
      }
    }
  };

  const handleAudioData = (arrayBuffer: ArrayBuffer) => {
    // Direct PCM16 audio data
    playAudioData(arrayBuffer);
  };

  const playAudioData = (audioBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
    const audioData = new Int16Array(audioBuffer);
    
    // Convert PCM16 to Float32
    const float32Data = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Data[i] = audioData[i] / 32768.0;
    }
    
    // Create audio buffer and play
    const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
    buffer.copyToChannel(float32Data, 0);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  };

  const endCall = () => {
    addLog('Ending call...', 'info');
    
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'session.update', session: { modalities: [] } }));
      wsRef.current.close();
      wsRef.current = null;
    }
    
    cleanup();
    setIsCalling(false);
    setIsConnected(false);
    setLastTranscript('');
  };

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2">Alex Voice Agent Demo</h1>
          <p className="text-white/70 mb-8">OpenAI Realtime Voice Agent - AO Globe Life</p>
          
          {/* Control Buttons */}
          <div className="flex gap-4 mb-8">
            {!isCalling ? (
              <button
                onClick={startCall}
                className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Call
              </button>
            ) : (
              <button
                onClick={endCall}
                className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-105"
              >
                End Call
              </button>
            )}
          </div>
          
          {/* Status Indicator */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-white font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          {/* Transcript Display */}
          {lastTranscript && (
            <div className="mb-6 bg-black/30 rounded-lg p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-2">Agent Transcript:</h3>
              <p className="text-white/90">{lastTranscript}</p>
            </div>
          )}
          
          {/* Debug Log */}
          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-3">Debug Log:</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {debugLogs.map((log, idx) => (
                <div key={idx} className="text-sm font-mono">
                  <span className="text-white/50">[{log.timestamp}]</span>{' '}
                  <span className={
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    'text-white/70'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
              {debugLogs.length === 0 && (
                <div className="text-white/50 text-sm">No logs yet...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
