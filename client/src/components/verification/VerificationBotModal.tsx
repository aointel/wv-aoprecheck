import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, Phone, Video, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VerificationBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  conferenceName?: string;
  leadPhone?: string;
  agentEmail?: string;
  sessionType?: 'video' | 'voice';
}

interface BotResponse {
  success: boolean;
  botCallSid?: string;
  conferenceName?: string;
  roomName?: string;
  botType?: string;
  verificationType?: string;
  accessToken?: string;
  identity?: string;
  message?: string;
  error?: string;
}

export function VerificationBotModal({
  isOpen,
  onClose,
  roomName: initialRoomName = '',
  conferenceName: initialConferenceName = '',
  leadPhone: initialLeadPhone = '',
  agentEmail: initialAgentEmail = '',
  sessionType = 'video'
}: VerificationBotModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BotResponse | null>(null);
  
  // Form state
  const [roomName, setRoomName] = useState(initialRoomName);
  const [conferenceName, setConferenceName] = useState(initialConferenceName);
  const [leadPhone, setLeadPhone] = useState(initialLeadPhone);
  const [agentEmail, setAgentEmail] = useState(initialAgentEmail);
  const [verificationType, setVerificationType] = useState<'voice' | 'compliance' | 'silent'>('voice');
  const [botType, setBotType] = useState<'voice-only' | 'programmatic'>('voice-only');

  const addVerificationBot = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const endpoint = sessionType === 'video' 
        ? '/api/twilio/add-video-verification-bot'
        : '/api/twilio/add-verification-bot';
        
      const payload = sessionType === 'video' 
        ? { roomName, leadPhone, agentEmail, verificationType, botType }
        : { conferenceName, leadPhone, agentEmail, verificationType };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        toast({
          title: "Verification Bot Added",
          description: data.message || `${sessionType} verification bot successfully joined the session`,
        });
      } else {
        toast({
          title: "Failed to Add Bot",
          description: data.error || 'Could not add verification bot to session',
          variant: "destructive",
        });
      }
    } catch (err) {
      const error = 'Network error: ' + (err as Error).message;
      setResult({ success: false, error });
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeBot = async () => {
    if (!result?.botCallSid) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/twilio/remove-verification-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botCallSid: result.botCallSid })
      });
      
      const data = await response.json();
      if (data.success) {
        setResult(null);
        toast({
          title: "Bot Removed",
          description: "Verification bot has been removed from the session",
        });
      }
    } catch (err) {
      toast({
        title: "Failed to Remove Bot",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickAdd = () => {
    // Auto-populate fields if not already filled
    if (!roomName && !conferenceName) {
      const timestamp = Date.now();
      if (sessionType === 'video') {
        setRoomName(`meeting-${timestamp}`);
      } else {
        setConferenceName(`aoi-conference-${timestamp}`);
      }
    }
    if (!leadPhone) setLeadPhone('+15551234567');
    // Producer Email should come from authenticated user, no hardcoded fallback
    
    // Trigger immediately
    setTimeout(addVerificationBot, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Add Verification Bot
            <Badge variant="outline" className="ml-auto">
              {sessionType === 'video' ? 'Video Session' : 'Voice Conference'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Add an AI verification bot to monitor this {sessionType} session for compliance and quality assurance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Session Identifier */}
          {sessionType === 'video' ? (
            <div>
              <Label htmlFor="roomName">Video Room Name</Label>
              <Input
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="video-room-123"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="conferenceName">Conference Name</Label>
              <Input
                id="conferenceName"
                value={conferenceName}
                onChange={(e) => setConferenceName(e.target.value)}
                placeholder="conference-123"
              />
            </div>
          )}

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="leadPhone">Lead Phone</Label>
              <Input
                id="leadPhone"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder="+15551234567"
              />
            </div>
            <div>
              <Label htmlFor="agentEmail">Producer Email</Label>
              <Input
                id="agentEmail"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="producer@example.com"
              />
            </div>
          </div>

          {/* Bot Configuration */}
          <div>
            <Label htmlFor="verificationType">Verification Type</Label>
            <Select value={verificationType} onValueChange={(value: 'voice' | 'compliance' | 'silent') => setVerificationType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voice">Voice Announcement</SelectItem>
                <SelectItem value="compliance">Compliance Monitoring</SelectItem>
                <SelectItem value="silent">Silent Recording</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sessionType === 'video' && (
            <div>
              <Label htmlFor="botType">Bot Type</Label>
              <Select value={botType} onValueChange={(value: 'voice-only' | 'programmatic') => setBotType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice-only">Voice Only (Audio Bridge)</SelectItem>
                  <SelectItem value="programmatic">Full Video Participant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={quickAdd} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : sessionType === 'video' ? (
                <Video className="h-4 w-4 mr-2" />
              ) : (
                <Phone className="h-4 w-4 mr-2" />
              )}
              Quick Add Bot
            </Button>
            
            <Button 
              onClick={addVerificationBot} 
              disabled={loading}
              variant="outline"
            >
              <Bot className="h-4 w-4 mr-2" />
              Add Bot
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium">
                  {result.success ? 'Bot Added Successfully' : 'Failed to Add Bot'}
                </span>
              </div>
              
              {result.message && (
                <p className="text-sm text-muted-foreground">{result.message}</p>
              )}
              
              {result.error && (
                <p className="text-sm text-red-600">{result.error}</p>
              )}
              
              {result.botCallSid && (
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    Bot ID: {result.botCallSid.slice(-8)}
                  </Badge>
                  <Button 
                    onClick={removeBot} 
                    size="sm" 
                    variant="destructive"
                    disabled={loading}
                  >
                    Remove Bot
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}