import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface producerMessageSenderProps {
  agentName?: string;
  agentEmail?: string;
}

const producerMessageSender = ({ agentName = 'CNsysop', agentEmail = 'cnsysop@aoglobelife.com' }: producerMessageSenderProps) => {
  const [roomId, setRoomId] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!roomId.trim() || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both room ID and message",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/agent-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomId.trim(),
          message: message.trim(),
          agentName: agentName
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Message Sent",
          description: `Message sent to waiting room ${roomId}`,
        });
        setMessage('');
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send producer message:', error);
      toast({
        title: "Failed to Send Message",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickMessages = [
    "I'll be with you in just a moment!",
    "Thank you for your patience. Connecting now...",
    "Please ensure your camera and microphone are ready.",
    "Having technical issues? Try refreshing your browser.",
    "Your consultation is about to begin!"
  ];

  const useQuickMessage = (quickMsg: string) => {
    setMessage(quickMsg);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Send Message to Waiting Room
        </h3>
      </div>

      <div className="space-y-4">
        {/* Room ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Room ID
          </label>
          <Input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g., video-room, cnsysop-meeting"
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enter the room ID where the client is waiting
          </p>
        </div>

        {/* Quick Messages */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Messages
          </label>
          <div className="grid grid-cols-1 gap-2">
            {quickMessages.map((quickMsg, index) => (
              <button
                key={index}
                onClick={() => useQuickMessage(quickMsg)}
                className="text-left p-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
              >
                {quickMsg}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Custom Message
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message to the client..."
            rows={3}
            className="w-full"
          />
        </div>

        {/* Send Button */}
        <Button
          onClick={sendMessage}
          disabled={isLoading || !roomId.trim() || !message.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 rounded-full animate-spin border-t-white"></div>
              Sending...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send Message
            </div>
          )}
        </Button>
      </div>

      {/* Producer Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Sending as:</strong> {agentName}</p>
          <p><strong>Email:</strong> {agentEmail}</p>
        </div>
      </div>
    </div>
  );
};

export default producerMessageSender;