import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Clock, Shield, CheckCircle, Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

const VideoWaitingRoom = () => {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [waitingStatus, setWaitingStatus] = useState<'waiting' | 'connecting'>('waiting');
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(2);
  const [producerMessages, setproducerMessages] = useState<Array<{id: string, message: string, timestamp: Date}>>([]);
  const [connectionChecks, setConnectionChecks] = useState({
    camera: false,
    microphone: false,
    connection: true
  });
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const { authState } = useAuth();
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const leadName = urlParams.get('leadName') || 'Client';
  const agentName = urlParams.get('agentName') || authState.user?.email?.split('@')[0] || 'producer';
  const agentEmail = urlParams.get('agentEmail') || authState.user?.email || 'producer@aoglobelife.com';
  const leadId = urlParams.get('leadId') || urlParams.get('leadID') || null;
  
  // Use leadID-based room for private 1-on-1 meetings, fallback to current user
  const roomId = leadId ? `${leadId}-${agentEmail.split('@')[0]}` : agentEmail.split('@')[0] || 'default-producer';
  
  console.log('🎥 VideoWaitingRoom: Room ID generation:', {
    leadId,
    agentEmail,
    agentName: agentEmail.split('@')[0],
    finalRoomId: roomId
  });
  
  // Use profile picture from auth state or fallback
  const producerProfilePicture = authState.profile?.profilePicture || null;
  
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        console.log('🎥 Requesting camera and microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }, 
          audio: true 
        });
        
        console.log('✅ Media stream obtained:', stream);
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('✅ Video element connected to stream');
          console.log('🎥 Stream details:', {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active
          });
          
          // Ensure video element properties are set correctly
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.autoplay = true;
          
          // Ensure video plays
          localVideoRef.current.onloadedmetadata = () => {
            console.log('✅ Video metadata loaded, attempting to play');
            console.log('📹 Video dimensions:', {
              videoWidth: localVideoRef.current?.videoWidth,
              videoHeight: localVideoRef.current?.videoHeight
            });
            if (localVideoRef.current) {
              localVideoRef.current.play()
                .then(() => {
                  console.log('✅ Video playing successfully');
                  console.log('📹 Video element state:', {
                    paused: localVideoRef.current?.paused,
                    readyState: localVideoRef.current?.readyState,
                    currentTime: localVideoRef.current?.currentTime
                  });
                })
                .catch(e => console.warn('Video play failed:', e));
            }
          };
          
          // Additional event listeners for debugging
          localVideoRef.current.oncanplay = () => console.log('✅ Video can play');
          localVideoRef.current.onplaying = () => console.log('✅ Video is playing');
          localVideoRef.current.onerror = (e) => console.error('❌ Video error:', e);
          
          // Force video to start playing immediately
          setTimeout(() => {
            if (localVideoRef.current) {
              console.log('🔄 Force starting video...');
              localVideoRef.current.play()
                .then(() => console.log('✅ Video force-started successfully'))
                .catch(e => console.warn('Force play failed:', e));
            }
          }, 500);
        }
        
        setConnectionChecks(prev => ({
          ...prev,
          camera: stream.getVideoTracks().length > 0,
          microphone: stream.getAudioTracks().length > 0
        }));
        
      } catch (error) {
        console.error('❌ Error accessing media devices:', error);
        setConnectionChecks(prev => ({
          ...prev,
          camera: false,
          microphone: false
        }));
      }
    };

    initializeMedia();
    
    // WebSocket for producer messages
    const wsUrl = 'wss://aoirail-production.up.railway.app/ws';
    const socket = new WebSocket(wsUrl);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_message' && data.roomId === roomId) {
          setproducerMessages(prev => [...prev, {
            id: Date.now().toString(),
            message: data.message,
            timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    return () => {
      socket.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId]);
  
  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };
  
  const toggleAudio = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  };
  
  const joinConsultation = () => {
    setWaitingStatus('connecting');
    const videoCallUrl = `/twilio-client?room=${encodeURIComponent(roomId)}&leadName=${encodeURIComponent(leadName)}`;
    window.location.href = videoCallUrl;
  };
  
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Header with branding - Desktop */}
      <div className="hidden md:block absolute top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 z-10 shadow-sm">
        <div className="flex items-center justify-between p-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="h-12 w-auto flex items-center justify-center bg-blue-600 text-white font-bold text-xl px-4 rounded-lg">
              AO
            </div>
            <div className="border-l border-gray-300 dark:border-gray-600 pl-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AO Intelligence</h1>
              <p className="text-sm text-blue-600 dark:text-blue-400">powered by ConnectNow</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Secure Meeting</span>
          </div>
        </div>
      </div>

      {/* Header with branding - Mobile */}
      <div className="md:hidden absolute top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 z-10 shadow-sm">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-auto flex items-center justify-center bg-blue-600 text-white font-bold text-base px-3 rounded">
              AO
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white">AO Intelligence</h1>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span>Secure</span>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-center h-full p-8 pt-24">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left side - Welcome Message */}
          <div className="text-left">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
                Hey! Your representative will be with you shortly!
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
                Your meeting will begin in just a moment
              </p>

            </div>

            {/* producer Messages */}
            {producerMessages.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 mb-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Message from {agentName}</h3>
                </div>
                <div className="space-y-2">
                  {producerMessages.map((msg) => (
                    <div key={msg.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                      <p className="text-gray-800 dark:text-gray-200">{msg.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Producer Profile Card with actual profile picture */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  {producerProfilePicture ? (
                    <img 
                      src={producerProfilePicture} 
                      alt={`${agentName} Profile`}
                      className="w-16 h-16 rounded-full object-cover shadow-lg border-2 border-blue-500"
                      onError={(e) => {
                        // Fallback to gradient circle if image fails to load
                        const target = e.currentTarget as HTMLImageElement;
                        const sibling = target.nextElementSibling as HTMLElement;
                        target.style.display = 'none';
                        if (sibling) sibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full items-center justify-center text-white font-bold text-xl shadow-lg border-2 border-blue-500 ${producerProfilePicture ? 'hidden' : 'flex'}`}
                  >
                    {agentName.split(' ').map(n => n[0]).join('').toUpperCase() || 'CN'}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {agentName} - ConnectNow System Operator
                  </h3>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                    Producer
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Available now • Online
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">{agentEmail}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Secure communication</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-950/30 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">(605) 250-0834</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Direct support line</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 dark:bg-purple-950/30 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">Producer in 46+ States</p>
                  </div>
                </div>
              </div>
            </div>
            


          </div>
          
          {/* Right side - Video preview */}
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-lg aspect-video bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white dark:border-gray-700">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover bg-black"
                style={{ transform: 'scaleX(-1)' }}
                onLoadedData={() => console.log('📹 Video data loaded successfully')}
                onError={(e) => console.error('❌ Video element error:', e)}
                onCanPlay={() => console.log('📹 Desktop video can play')}
                onPlaying={() => console.log('📹 Desktop video is playing')}
              />
              {!connectionChecks.camera && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <div className="text-center text-gray-300">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-60" />
                    <p className="text-sm mb-2">Setting up camera...</p>
                    <p className="text-xs text-gray-400">Please allow camera access when prompted</p>
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-4 left-4 bg-black/75 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-lg border border-white/20">
                {leadName}
              </div>
              
              {/* Video controls overlay */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                    isVideoEnabled 
                      ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30' 
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                  title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                
                <button
                  onClick={toggleAudio}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                    isAudioEnabled 
                      ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30' 
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                  title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Large Join Meeting Button */}
            <div className="mt-8">
              <Button
                onClick={joinConsultation}
                disabled={waitingStatus === 'connecting'}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-12 py-6 rounded-2xl text-2xl font-bold transition-all duration-200 shadow-2xl hover:shadow-3xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {waitingStatus === 'connecting' ? (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-3 border-white/30 rounded-full animate-spin border-t-white"></div>
                    Connecting to Meeting...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8" />
                    Join Meeting Room
                  </div>
                )}
              </Button>
              

            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-full pt-16">
        {/* Mobile content - simplified for mobile experience */}
        <div className="flex-1 p-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Your representative will be with you shortly!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Please wait while we connect you
            </p>
          </div>

          {/* Mobile video preview */}
          <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden shadow-lg mb-4">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover bg-black"
              style={{ transform: 'scaleX(-1)' }}
              onLoadedData={() => console.log('📹 Mobile video data loaded')}
              onCanPlay={() => console.log('📹 Mobile video can play')}
              onPlaying={() => console.log('📹 Mobile video is playing')}
            />
            {!connectionChecks.camera && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center text-gray-300">
                  <Video className="w-8 h-8 mx-auto mb-2 opacity-60" />
                  <p className="text-xs mb-1">Setting up camera...</p>
                  <p className="text-xs text-gray-400">Allow camera access</p>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-sm text-white text-xs px-2 py-1 rounded border border-white/20">
              {leadName}
            </div>
            
            {/* Mobile video controls */}
            <div className="absolute bottom-2 right-2 flex gap-1">
              <button
                onClick={toggleVideo}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                  isVideoEnabled 
                    ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              </button>
              
              <button
                onClick={toggleAudio}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                  isAudioEnabled 
                    ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* producer Messages for mobile */}
          {producerMessages.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 mb-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">Message from {agentName}</h3>
              </div>
              <div className="space-y-2">
                {producerMessages.map((msg) => (
                  <div key={msg.id} className="bg-white dark:bg-gray-800 rounded-lg p-2 text-xs">
                    <p className="text-gray-800 dark:text-gray-200">{msg.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* Large Mobile join button */}
          <div className="sticky bottom-0 bg-gradient-to-t from-slate-50 to-transparent dark:from-gray-900 pt-6">
            <Button 
              onClick={joinConsultation}
              disabled={waitingStatus === 'connecting'}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-5 rounded-2xl shadow-2xl hover:shadow-3xl text-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
            >
              {waitingStatus === 'connecting' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-3 border-white border-t-transparent mr-3"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Video className="w-6 h-6 mr-3" />
                  Join Meeting Room
                </>
              )}
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoWaitingRoom;
