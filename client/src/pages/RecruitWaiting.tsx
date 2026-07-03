import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Video, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RecruitWaiting() {
  const [connectionId, setConnectionId] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [status, setStatus] = useState<'waiting' | 'ready' | 'error'>('waiting');
  const [roomUrl, setRoomUrl] = useState('');
  const [waitTime, setWaitTime] = useState(0);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const name = params.get('name');
      
      console.log('🔍 RecruitWaiting - URL params:', { id, name });
      
      if (id) setConnectionId(id);
      if (name) setCandidateName(decodeURIComponent(name));
    } catch (error) {
      console.error('❌ Error parsing URL params:', error);
      setStatus('error');
    }
  }, []);

  // Poll for connection status and auto-join when ready
  useEffect(() => {
    if (!connectionId) {
      console.log('⏸️ No connectionId yet, skipping polling');
      return;
    }

    console.log('🔄 Starting status polling for connection:', connectionId);

    const checkStatus = async () => {
      try {
        console.log('📡 Checking status for connection:', connectionId);
        const response = await fetch(`/api/recruit/connection-status/${connectionId}`);
        
        if (!response.ok) {
          console.error('❌ API response not OK:', response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log('✅ Status response:', data);
        
        if (data.success) {
          setStatus(data.status);
          if ((data.status === 'accepted' || data.status === 'ready') && data.roomUrl) {
            setRoomUrl(data.roomUrl);
            // Auto-join the Whereby room immediately
            console.log('🎥 producer accepted! Auto-joining room:', data.roomUrl);
            window.location.href = data.roomUrl;
          }
        } else {
          console.warn('⚠️ API returned success:false', data);
        }
      } catch (error) {
        console.error('❌ Error checking connection status:', error);
        setStatus('error');
      }
    };

    // Check immediately
    checkStatus();

    // Poll every 2 seconds
    const interval = setInterval(checkStatus, 2000);

    return () => {
      console.log('🛑 Cleaning up status polling');
      clearInterval(interval);
    };
  }, [connectionId]);

  // Wait time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const joinCall = () => {
    if (roomUrl) {
      window.location.href = roomUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 shadow-2xl">
        <div className="text-center space-y-6">
          
          {/* Status Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mx-auto"
          >
            {status === 'waiting' && (
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{formatWaitTime(waitTime)}</span>
                  </div>
                </div>
              </div>
            )}

            {status === 'ready' && (
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Video className="w-12 h-12 text-green-600" />
              </div>
            )}

            {status === 'error' && (
              <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">⚠️</span>
              </div>
            )}
          </motion.div>

          {/* Message */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {status === 'waiting' && `Hey ${candidateName}!`}
              {status === 'ready' && `You're all set!`}
              {status === 'error' && 'Oops!'}
            </h1>
            
            <p className="text-lg text-gray-600">
              {status === 'waiting' && (
                <>
                  Your manager will join you shortly.<br />
                  <span className="text-sm">This usually takes less than a minute.</span>
                </>
              )}
              {status === 'ready' && 'Your manager is ready to meet with you!'}
              {status === 'error' && (
                <>
                  Something went wrong. Please check the console for details.<br />
                  <span className="text-sm">Connection ID: {connectionId || 'Missing'}</span>
                </>
              )}
            </p>
          </div>

          {/* Action Button */}
          {status === 'ready' && roomUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Button
                onClick={joinCall}
                className="w-full h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-lg font-semibold rounded-xl shadow-lg"
              >
                <Video className="w-5 h-5 mr-2" />
                Join Video Call
              </Button>
            </motion.div>
          )}

          {/* Waiting Animation */}
          {status === 'waiting' && (
            <div className="flex justify-center gap-2 py-4">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 bg-purple-600 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t">
            <p className="text-sm text-gray-500">
              While you wait, make sure your camera and microphone are working properly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

